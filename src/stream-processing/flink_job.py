#!/usr/bin/env python3
"""
Flink Stream Processing Job for Livestream Analytics
=====================================================
Real-time processing of viewer events with windowed aggregations.
"""

import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from pyflink.datastream import StreamExecutionEnvironment, TimeCharacteristic
from pyflink.datastream.connectors.kafka import FlinkKafkaConsumer, FlinkKafkaProducer
from pyflink.datastream.functions import ProcessWindowFunction, ProcessFunction
from pyflink.datastream.window import TumblingEventTimeWindows, SlidingEventTimeWindows
from pyflink.common import WatermarkStrategy, Time, Duration, Types
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream.state import ValueStateDescriptor, ListStateDescriptor
from pyflink.common.configuration import Configuration
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==================== CONFIGURATION ====================

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
INPUT_TOPIC = os.getenv("INPUT_TOPIC", "livestream-events")
OUTPUT_TOPIC_METRICS = os.getenv("OUTPUT_TOPIC_METRICS", "livestream-metrics")
OUTPUT_TOPIC_ALERTS = os.getenv("OUTPUT_TOPIC_ALERTS", "livestream-alerts")
CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "clickhouse")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", "9000"))
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "analytics")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "analytics_password")
CLICKHOUSE_DB = os.getenv("CLICKHOUSE_DB", "livestream_analytics")

WINDOW_SIZE_MINUTES = int(os.getenv("WINDOW_SIZE_MINUTES", "1"))
SLIDE_SIZE_MINUTES = int(os.getenv("SLIDE_SIZE_MINUTES", "30"))
SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", "30"))

PARALLELISM = int(os.getenv("PARALLELISM", "2"))
CHECKPOINT_INTERVAL = int(os.getenv("CHECKPOINT_INTERVAL", "60000"))  # 60 seconds


# ==================== EVENT PARSING ====================

def parse_event(event_json: str) -> Dict[str, Any]:
    """Parse JSON event string to dictionary with proper types."""
    try:
        event = json.loads(event_json)
        
        # Convert timestamp string to milliseconds
        ts_str = event.get("timestamp", "")
        if ts_str:
            dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            event["event_time_ms"] = int(dt.timestamp() * 1000)
        else:
            event["event_time_ms"] = int(datetime.now(timezone.utc).timestamp() * 1000)
        
        # Ensure numeric fields
        event["video_time"] = float(event.get("video_time", 0) or 0)
        event["video_duration"] = float(event.get("video_duration", 0) or 0)
        event["bitrate"] = int(event.get("bitrate", 0) or 0)
        event["buffer_health"] = float(event.get("buffer_health", 1.0) or 1.0)
        
        return event
    except Exception as e:
        logger.error(f"Failed to parse event: {e}")
        return {}


# ==================== PROCESS FUNCTIONS ====================

class EventTimestampAssigner:
    """Assign timestamps and watermarks for event-time processing."""
    
    def __init__(self, max_out_of_orderness_ms: int = 60000):
        self.max_out_of_orderness_ms = max_out_of_orderness_ms
        self.current_max_ts = 0
    
    def extract_timestamp(self, event: Dict[str, Any], record_timestamp: int) -> int:
        ts = event.get("event_time_ms", 0)
        self.current_max_ts = max(self.current_max_ts, ts)
        return ts
    
    def emit_watermark(self) -> int:
        return self.current_max_ts - self.max_out_of_orderness_ms


class SessionWindowAssigner(ProcessFunction):
    """Assign events to sessions based on viewer_id + stream_id."""
    
    def __init__(self, session_timeout_ms: int):
        self.session_timeout_ms = session_timeout_ms
        self.session_state: ValueStateDescriptor = None
    
    def open(self, runtime_context):
        self.session_state = runtime_context.get_state(
            ValueStateDescriptor("session_state", Types.MAP(Types.STRING, Types.LONG))
        )
    
    def process_element(self, event: Dict[str, Any], ctx, out):
        viewer_id = event.get("viewer_id", "")
        stream_id = event.get("stream_id", "")
        session_key = f"{viewer_id}:{stream_id}"
        event_time = event.get("event_time_ms", 0)
        
        # Get or create session
        sessions = self.session_state.value() or {}
        last_activity = sessions.get(session_key, 0)
        
        # Check if new session needed
        if event_time - last_activity > self.session_timeout_ms:
            # Emit session end for previous session
            if last_activity > 0:
                out.collect({
                    "type": "session_end",
                    "session_key": session_key,
                    "viewer_id": viewer_id,
                    "stream_id": stream_id,
                    "start_time": sessions.get(f"{session_key}_start", event_time),
                    "end_time": last_activity,
                    "duration_ms": last_activity - sessions.get(f"{session_key}_start", event_time)
                })
            
            # Start new session
            sessions[session_key] = event_time
            sessions[f"{session_key}_start"] = event_time
        else:
            # Update last activity
            sessions[session_key] = event_time
        
        self.session_state.update(sessions)
        
        # Emit event with session info
        event["session_key"] = session_key
        out.collect(event)
    
    def on_timer(self, timestamp, ctx, out):
        # Clean up expired sessions
        sessions = self.session_state.value() or {}
        current_time = timestamp
        to_remove = []
        
        for key, last_activity in sessions.items():
            if not key.endswith("_start") and current_time - last_activity > self.session_timeout_ms:
                to_remove.append(key)
                if f"{key}_start" in sessions:
                    to_remove.append(f"{key}_start")
        
        for key in to_remove:
            del sessions[key]
        
        self.session_state.update(sessions)


class MinuteAggregator(ProcessWindowFunction):
    """Aggregate events into 1-minute windows per stream."""
    
    def process(self, key: str, context, events: Iterable[Dict[str, Any]]) -> Iterable[Dict[str, Any]]:
        stream_id = key
        events_list = list(events)
        
        if not events_list:
            return
        
        window_start = context.window().start
        window_end = context.window().end
        
        # Initialize aggregations
        viewers = set()
        viewer_sessions = {}  # viewer_id -> {first_event, last_event, watch_time, ...}
        total_watch_time = 0.0
        quality_changes = 0
        buffer_events = 0
        total_buffer_time = 0.0
        errors = 0
        interactions = {"like": 0, "share": 0, "comment": 0, "chat": 0, "reaction": 0}
        bitrates = []
        buffer_healths = []
        countries = {}
        cities = {}
        platforms = {}
        devices = {}
        os_types = {}
        browsers = {}
        
        for event in events_list:
            viewer_id = event.get("viewer_id", "")
            event_type = event.get("event_type", "")
            viewers.add(viewer_id)
            
            # Track viewer session info
            if viewer_id not in viewer_sessions:
                viewer_sessions[viewer_id] = {
                    "first_event": event.get("event_time_ms", 0),
                    "last_event": event.get("event_time_ms", 0),
                    "watch_time": 0.0,
                    "quality": event.get("quality", "auto"),
                    "bitrate": event.get("bitrate", 0),
                    "buffer_health": event.get("buffer_health", 1.0)
                }
            else:
                viewer_sessions[viewer_id]["last_event"] = event.get("event_time_ms", 0)
            
            # Event-type specific aggregations
            if event_type == "heartbeat":
                vt = event.get("video_time", 0)
                vd = event.get("video_duration", 0)
                viewer_sessions[viewer_id]["watch_time"] = vt
                bitrates.append(event.get("bitrate", 0))
                buffer_healths.append(event.get("buffer_health", 1.0))
                
            elif event_type == "quality_change":
                quality_changes += 1
                
            elif event_type == "buffer_start":
                buffer_events += 1
                
            elif event_type == "buffer_end":
                # Calculate buffer duration from previous buffer_start
                pass  # Would need state to track
                
            elif event_type == "error":
                errors += 1
                
            elif event_type in interactions:
                interactions[event_type] += 1
            
            # Demographics
            country = event.get("country", "unknown")
            city = event.get("city", "unknown")
            platform = event.get("platform", "unknown")
            device = event.get("device_type", "unknown")
            os_type = event.get("os", "unknown")
            browser = event.get("browser", "unknown")
            
            countries[country] = countries.get(country, 0) + 1
            cities[city] = cities.get(city, 0) + 1
            platforms[platform] = platforms.get(platform, 0) + 1
            devices[device] = devices.get(device, 0) + 1
            os_types[os_type] = os_types.get(os_type, 0) + 1
            browsers[browser] = browsers.get(browser, 0) + 1
        
        # Calculate metrics
        concurrent_viewers = len(viewers)
        unique_viewers = len(viewers)
        
        # Average watch time
        watch_times = [s["watch_time"] for s in viewer_sessions.values() if s["watch_time"] > 0]
        avg_watch_time = sum(watch_times) / len(watch_times) if watch_times else 0
        
        # Bitrate stats
        avg_bitrate = sum(bitrates) / len(bitrates) if bitrates else 0
        
        # Buffer health
        avg_buffer_health = sum(buffer_healths) / len(buffer_healths) if buffer_healths else 1.0
        
        # Engagement rate
        total_interactions = sum(interactions.values())
        engagement_rate = total_interactions / max(unique_viewers, 1)
        
        # Error rate
        error_rate = errors / max(len(events_list), 1)
        
        # Quality distribution
        quality_dist = {}
        for s in viewer_sessions.values():
            q = s.get("quality", "auto")
            quality_dist[q] = quality_dist.get(q, 0) + 1
        
        result = {
            "stream_id": stream_id,
            "window_start": window_start,
            "window_end": window_end,
            "concurrent_viewers": concurrent_viewers,
            "unique_viewers": unique_viewers,
            "avg_watch_time_seconds": avg_watch_time / 1000.0,  # Convert ms to seconds
            "total_watch_time_seconds": sum(watch_times) / 1000.0,
            "engagement_rate": engagement_rate,
            "avg_bitrate": int(avg_bitrate),
            "quality_distribution": quality_dist,
            "buffer_ratio": buffer_events / max(len(events_list), 1),
            "avg_buffer_health": avg_buffer_health,
            "error_rate": error_rate,
            "error_count": errors,
            "likes_count": interactions["like"],
            "shares_count": interactions["share"],
            "comments_count": interactions["comment"],
            "chat_messages_count": interactions["chat"],
            "reactions_count": interactions["reaction"],
            "top_countries": dict(sorted(countries.items(), key=lambda x: x[1], reverse=True)[:10]),
            "top_cities": dict(sorted(cities.items(), key=lambda x: x[1], reverse=True)[:10]),
            "platform_distribution": platforms,
            "device_distribution": devices,
            "os_distribution": os_types,
            "browser_distribution": browsers,
            "computed_at": int(datetime.now(timezone.utc).timestamp() * 1000)
        }
        
        yield result


class AlertDetector(ProcessFunction):
    """Detect anomalies and generate alerts."""
    
    def __init__(self):
        self.metrics_state: ValueStateDescriptor = None
    
    def open(self, runtime_context):
        self.metrics_state = runtime_context.get_state(
            ValueStateDescriptor("metrics_state", Types.MAP(Types.STRING, Types.DOUBLE))
        )
    
    def process_element(self, metrics: Dict[str, Any], ctx, out):
        stream_id = metrics.get("stream_id", "")
        concurrent = metrics.get("concurrent_viewers", 0)
        buffer_ratio = metrics.get("buffer_ratio", 0)
        error_rate = metrics.get("error_rate", 0)
        avg_buffer_health = metrics.get("avg_buffer_health", 1.0)
        
        alerts = []
        
        # Low viewers alert (less than 10 viewers for a live stream)
        if concurrent < 10:
            alerts.append({
                "stream_id": stream_id,
                "alert_type": "low_viewers",
                "severity": "warning",
                "title": "Low Concurrent Viewers",
                "message": f"Stream has only {concurrent} concurrent viewers",
                "value": concurrent,
                "threshold": 10
            })
        
        # High buffer ratio
        if buffer_ratio > 0.1:  # More than 10% buffer events
            alerts.append({
                "stream_id": stream_id,
                "alert_type": "high_buffer_ratio",
                "severity": "warning",
                "title": "High Buffer Ratio",
                "message": f"Buffer ratio is {buffer_ratio:.1%}",
                "value": buffer_ratio,
                "threshold": 0.1
            })
        
        # Low buffer health
        if avg_buffer_health < 0.5:
            alerts.append({
                "stream_id": stream_id,
                "alert_type": "low_buffer_health",
                "severity": "critical",
                "title": "Critical Buffer Health",
                "message": f"Average buffer health is {avg_buffer_health:.1%}",
                "value": avg_buffer_health,
                "threshold": 0.5
            })
        
        # High error rate
        if error_rate > 0.05:  # More than 5% errors
            alerts.append({
                "stream_id": stream_id,
                "alert_type": "high_error_rate",
                "severity": "critical",
                "title": "High Error Rate",
                "message": f"Error rate is {error_rate:.1%}",
                "value": error_rate,
                "threshold": 0.05
            })
        
        # Sudden viewer drop (compare with previous window)
        prev_metrics = self.metrics_state.value() or {}
        prev_concurrent = prev_metrics.get(f"{stream_id}_concurrent", 0)
        
        if prev_concurrent > 0 and concurrent < prev_concurrent * 0.5:  # 50% drop
            alerts.append({
                "stream_id": stream_id,
                "alert_type": "viewer_drop",
                "severity": "warning",
                "title": "Sudden Viewer Drop",
                "message": f"Viewers dropped from {prev_concurrent} to {concurrent} ({((prev_concurrent - concurrent) / prev_concurrent * 100):.0f}% drop)",
                "value": concurrent,
                "previous_value": prev_concurrent
            })
        
        # Update state
        prev_metrics[f"{stream_id}_concurrent"] = concurrent
        prev_metrics[f"{stream_id}_buffer_ratio"] = buffer_ratio
        prev_metrics[f"{stream_id}_error_rate"] = error_rate
        self.metrics_state.update(prev_metrics)
        
        # Emit alerts
        for alert in alerts:
            alert["timestamp"] = int(datetime.now(timezone.utc).timestamp() * 1000)
            out.collect(alert)
        
        # Also pass through metrics
        out.collect(metrics)


# ==================== MAIN JOB ====================

def create_kafka_consumer():
    """Create Kafka consumer for input events."""
    return FlinkKafkaConsumer(
        topics=INPUT_TOPIC,
        deserialization_schema=SimpleStringSchema(),
        properties={
            "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
            "group.id": "flink-stream-processor",
            "auto.offset.reset": "latest",
            "enable.auto.commit": "true"
        }
    )


def create_kafka_producer(topic: str):
    """Create Kafka producer for output."""
    return FlinkKafkaProducer(
        topic=topic,
        serialization_schema=SimpleStringSchema(),
        producer_config={
            "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
            "acks": "all",
            "retries": "3",
            "linger.ms": "10",
            "batch.size": "16384",
            "compression.type": "snappy"
        }
    )


def define_workflow(env: StreamExecutionEnvironment):
    """Define the Flink streaming workflow."""
    
    # Set event time characteristic
    env.set_stream_time_characteristic(TimeCharacteristic.EventTime)
    env.enable_checkpointing(CHECKPOINT_INTERVAL)
    env.get_checkpoint_config().set_min_pause_between_checkpoints(10000)
    env.get_checkpoint_config().set_checkpoint_timeout(60000)
    env.get_checkpoint_config().set_tolerable_checkpoint_failure_number(3)
    env.set_parallelism(PARALLELISM)
    
    # Create source
    kafka_source = create_kafka_consumer()
    
    # Parse events and assign timestamps
    watermark_strategy = WatermarkStrategy\
        .for_bounded_out_of_orderness(Duration.of_seconds(60))\
        .with_timestamp_assigner(lambda event, ts: event.get("event_time_ms", 0))\
        .with_idleness(Duration.of_minutes(1))
    
    events = env.add_source(kafka_source)\
        .map(parse_event, output_type=Types.MAP(Types.STRING, Types.STRING))\
        .assign_timestamps_and_watermarks(watermark_strategy)\
        .name("Parse Events")
    
    # Key by stream_id for per-stream aggregations
    keyed_events = events.key_by(lambda e: e.get("stream_id", "unknown"))
    
    # 1-minute tumbling window aggregation
    minute_metrics = keyed_events\
        .window(TumblingEventTimeWindows.of(Time.minutes(WINDOW_SIZE_MINUTES)))\
        .process(MinuteAggregator(), output_type=Types.MAP(Types.STRING, Types.STRING))\
        .name("Minute Aggregation")
    
    # Alert detection
    alerts = minute_metrics\
        .process(AlertDetector(), output_type=Types.MAP(Types.STRING, Types.STRING))\
        .name("Alert Detection")
    
    # Split alerts and metrics
    metrics_stream = alerts.filter(lambda x: "alert_type" not in x)
    alerts_stream = alerts.filter(lambda x: "alert_type" in x)
    
    # Sink metrics to Kafka
    metrics_stream\
        .map(lambda x: json.dumps(x), output_type=Types.STRING)\
        .add_sink(create_kafka_producer(OUTPUT_TOPIC_METRICS))\
        .name("Sink Metrics to Kafka")
    
    # Sink alerts to Kafka
    alerts_stream\
        .map(lambda x: json.dumps(x), output_type=Types.STRING)\
        .add_sink(create_kafka_producer(OUTPUT_TOPIC_ALERTS))\
        .name("Sink Alerts to Kafka")
    
    # Also sink raw events for debugging (optional)
    events\
        .map(lambda x: json.dumps(x), output_type=Types.STRING)\
        .add_sink(create_kafka_producer("livestream-events-parsed"))\
        .name("Sink Parsed Events")
    
    return env


def main():
    """Main entry point."""
    config = Configuration()
    config.set_string("execution.checkpointing.mode", "EXACTLY_ONCE")
    config.set_string("state.backend", "rocksdb")
    config.set_string("state.backend.incremental", "true")
    
    env = StreamExecutionEnvironment.get_execution_environment(config)
    
    define_workflow(env)
    
    logger.info("Starting Flink stream processing job...")
    env.execute("Livestream Analytics Stream Processor")


if __name__ == "__main__":
    main()