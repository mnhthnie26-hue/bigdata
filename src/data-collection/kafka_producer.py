"""
Kafka Producer for Livestream Event Collection
==============================================
High-performance async producer with batching, compression, and retry logic.
"""

import asyncio
import json
import uuid
import time
import random
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
import logging

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError, KafkaTimeoutError
import backoff

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EventType(str, Enum):
    VIEW_START = "view_start"
    VIEW_END = "view_end"
    HEARTBEAT = "heartbeat"
    QUALITY_CHANGE = "quality_change"
    BUFFER_START = "buffer_start"
    BUFFER_END = "buffer_end"
    SEEK = "seek"
    PAUSE = "pause"
    PLAY = "play"
    FULLSCREEN_ENTER = "fullscreen_enter"
    FULLSCREEN_EXIT = "fullscreen_exit"
    LIKE = "like"
    SHARE = "share"
    COMMENT = "comment"
    CHAT = "chat"
    REACTION = "reaction"
    FOLLOW = "follow"
    SUBSCRIBE = "subscribe"
    DONATION = "donation"
    ERROR = "error"
    AD_START = "ad_start"
    AD_END = "ad_end"
    AD_SKIP = "ad_skip"
    AD_ERROR = "ad_error"


class Platform(str, Enum):
    WEB = "web"
    IOS = "ios"
    ANDROID = "android"
    TV = "tv"
    DESKTOP = "desktop"
    UNKNOWN = "unknown"


class DeviceType(str, Enum):
    MOBILE = "mobile"
    TABLET = "tablet"
    DESKTOP = "desktop"
    TV = "tv"
    CONSOLE = "console"
    UNKNOWN = "unknown"


class Quality(str, Enum):
    AUTO = "auto"
    P144 = "144p"
    P240 = "240p"
    P360 = "360p"
    P480 = "480p"
    P720 = "720p"
    P1080 = "1080p"
    P1440 = "1440p"
    P2160 = "2160p"
    P4320 = "4320p"


@dataclass
class LivestreamEvent:
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec='milliseconds'))
    stream_id: str = ""
    viewer_id: str = ""
    session_id: str = ""
    platform: str = Platform.UNKNOWN.value
    device_type: str = DeviceType.UNKNOWN.value
    os: str = "unknown"
    browser: str = "unknown"
    country: str = "US"
    city: str = "unknown"
    ip: str = "0.0.0.0"
    user_agent: str = "unknown"
    video_time: float = 0.0
    video_duration: float = 0.0
    quality: str = Quality.AUTO.value
    bitrate: int = 0
    buffer_health: float = 1.0
    action: str = ""
    error_code: str = ""
    error_message: str = ""
    properties: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)


@dataclass
class ProducerConfig:
    bootstrap_servers: str = "localhost:9092"
    topic: str = "livestream-events"
    client_id: str = "livestream-producer"
    acks: str = "all"
    retries: int = 3
    retry_backoff_ms: int = 1000
    batch_size: int = 16384
    linger_ms: int = 10
    buffer_memory: int = 33554432
    compression_type: str = "snappy"
    max_in_flight_requests_per_connection: int = 5
    request_timeout_ms: int = 30000
    delivery_timeout_ms: int = 120000
    enable_idempotence: bool = True
    transactional_id: Optional[str] = None


class LivestreamEventProducer:
    def __init__(self, config: ProducerConfig):
        self.config = config
        self.producer: Optional[AIOKafkaProducer] = None
        self._running = False
        self._stats = {
            "sent": 0,
            "failed": 0,
            "bytes_sent": 0,
            "last_send_time": None,
            "errors": []
        }

    async def start(self):
        """Initialize and start the producer."""
        self.producer = AIOKafkaProducer(
            bootstrap_servers=self.config.bootstrap_servers,
            client_id=self.config.client_id,
            acks=self.config.acks,
            retries=self.config.retries,
            retry_backoff_ms=self.config.retry_backoff_ms,
            batch_size=self.config.batch_size,
            linger_ms=self.config.linger_ms,
            buffer_memory=self.config.buffer_memory,
            compression_type=self.config.compression_type,
            max_in_flight_requests_per_connection=self.config.max_in_flight_requests_per_connection,
            request_timeout_ms=self.config.request_timeout_ms,
            delivery_timeout_ms=self.config.delivery_timeout_ms,
            enable_idempotence=self.config.enable_idempotence,
            transactional_id=self.config.transactional_id,
            value_serializer=lambda v: v.encode('utf-8') if isinstance(v, str) else json.dumps(v, ensure_ascii=False).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None,
        )
        await self.producer.start()
        self._running = True
        logger.info(f"Producer started: {self.config.client_id} -> {self.config.bootstrap_servers}")

    async def stop(self):
        """Stop the producer gracefully."""
        self._running = False
        if self.producer:
            await self.producer.stop()
            logger.info("Producer stopped")

    @backoff.on_exception(
        backoff.expo,
        (KafkaError, KafkaTimeoutError),
        max_tries=3,
        max_time=30
    )
    async def send_event(self, event: LivestreamEvent, key: Optional[str] = None) -> bool:
        """Send a single event to Kafka."""
        if not self._running or not self.producer:
            raise RuntimeError("Producer not started")

        try:
            event_json = event.to_json()
            partition_key = key or event.viewer_id or event.stream_id
            
            future = await self.producer.send_and_wait(
                self.config.topic,
                value=event_json,
                key=partition_key,
                timestamp_ms=int(time.time() * 1000)
            )
            
            self._stats["sent"] += 1
            self._stats["bytes_sent"] += len(event_json)
            self._stats["last_send_time"] = datetime.now(timezone.utc).isoformat()
            
            logger.debug(f"Event sent: {event.event_type} for stream {event.stream_id} (partition: {future.partition}, offset: {future.offset})")
            return True
            
        except Exception as e:
            self._stats["failed"] += 1
            self._stats["errors"].append({
                "time": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
                "event_type": event.event_type
            })
            logger.error(f"Failed to send event: {e}")
            raise

    async def send_batch(self, events: List[LivestreamEvent]) -> Dict[str, int]:
        """Send multiple events in a batch."""
        if not self._running or not self.producer:
            raise RuntimeError("Producer not started")

        results = {"sent": 0, "failed": 0}
        
        # Use transaction for exactly-once semantics
        async with self.producer.transaction():
            for event in events:
                try:
                    event_json = event.to_json()
                    partition_key = event.viewer_id or event.stream_id
                    
                    await self.producer.send(
                        self.config.topic,
                        value=event_json,
                        key=partition_key,
                        timestamp_ms=int(time.time() * 1000)
                    )
                    results["sent"] += 1
                    self._stats["sent"] += 1
                    self._stats["bytes_sent"] += len(event_json)
                except Exception as e:
                    results["failed"] += 1
                    self._stats["failed"] += 1
                    logger.error(f"Failed to send event in batch: {e}")

        self._stats["last_send_time"] = datetime.now(timezone.utc).isoformat()
        return results

    def get_stats(self) -> Dict[str, Any]:
        """Get producer statistics."""
        return self._stats.copy()

    async def health_check(self) -> bool:
        """Check producer health."""
        try:
            if not self.producer:
                return False
            # Try to get metadata
            await self.producer.client.fetch_cluster_metadata()
            return True
        except Exception:
            return False


# ==================== CONVENIENCE FUNCTIONS ====================

def create_view_start_event(
    stream_id: str,
    viewer_id: str,
    session_id: str,
    **kwargs
) -> LivestreamEvent:
    """Create a view_start event."""
    return LivestreamEvent(
        event_type=EventType.VIEW_START.value,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        **kwargs
    )


def create_heartbeat_event(
    stream_id: str,
    viewer_id: str,
    session_id: str,
    video_time: float,
    video_duration: float,
    quality: str = Quality.AUTO.value,
    bitrate: int = 0,
    buffer_health: float = 1.0,
    **kwargs
) -> LivestreamEvent:
    """Create a heartbeat event (sent every 10-30 seconds during viewing)."""
    return LivestreamEvent(
        event_type=EventType.HEARTBEAT.value,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=video_time,
        video_duration=video_duration,
        quality=quality,
        bitrate=bitrate,
        buffer_health=buffer_health,
        **kwargs
    )


def create_quality_change_event(
    stream_id: str,
    viewer_id: str,
    session_id: str,
    from_quality: str,
    to_quality: str,
    video_time: float,
    **kwargs
) -> LivestreamEvent:
    """Create a quality_change event."""
    return LivestreamEvent(
        event_type=EventType.QUALITY_CHANGE.value,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=video_time,
        quality=to_quality,
        action=f"quality_change:{from_quality}->{to_quality}",
        **kwargs
    )


def create_buffer_event(
    stream_id: str,
    viewer_id: str,
    session_id: str,
    video_time: float,
    is_start: bool,
    buffer_health: float = 0.0,
    **kwargs
) -> LivestreamEvent:
    """Create buffer_start or buffer_end event."""
    return LivestreamEvent(
        event_type=EventType.BUFFER_START.value if is_start else EventType.BUFFER_END.value,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=video_time,
        buffer_health=buffer_health,
        **kwargs
    )


def create_interaction_event(
    event_type: EventType,
    stream_id: str,
    viewer_id: str,
    session_id: str,
    video_time: float,
    action: str = "",
    **kwargs
) -> LivestreamEvent:
    """Create an interaction event (like, share, comment, etc.)."""
    return LivestreamEvent(
        event_type=event_type.value,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=video_time,
        action=action or event_type.value,
        **kwargs
    )


def create_error_event(
    stream_id: str,
    viewer_id: str,
    session_id: str,
    error_code: str,
    error_message: str,
    video_time: float = 0.0,
    **kwargs
) -> LivestreamEvent:
    """Create an error event."""
    return LivestreamEvent(
        event_type=EventType.ERROR.value,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=video_time,
        error_code=error_code,
        error_message=error_message,
        **kwargs
    )


# ==================== DEMO / TESTING ====================

async def demo_producer():
    """Demo producer sending sample events."""
    config = ProducerConfig(
        bootstrap_servers="localhost:9092",
        topic="livestream-events"
    )
    
    producer = LivestreamEventProducer(config)
    await producer.start()
    
    # Simulate a viewing session
    stream_id = str(uuid.uuid4())
    viewer_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    # View start
    event = create_view_start_event(
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        platform=Platform.WEB.value,
        device_type=DeviceType.DESKTOP.value,
        os="Windows 10",
        browser="Chrome 119.0",
        country="VN",
        city="Ho Chi Minh City",
        video_duration=3600.0
    )
    await producer.send_event(event)
    
    # Simulate heartbeats every 10 seconds for 5 minutes
    for i in range(30):
        video_time = i * 10
        event = create_heartbeat_event(
            stream_id=stream_id,
            viewer_id=viewer_id,
            session_id=session_id,
            video_time=video_time,
            video_duration=3600.0,
            quality=Quality.P720.value,
            bitrate=2500 + random.randint(-200, 200),
            buffer_health=0.9 + random.random() * 0.1
        )
        await producer.send_event(event)
        await asyncio.sleep(0.1)  # Fast demo
    
    # Quality change
    event = create_quality_change_event(
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        from_quality=Quality.P720.value,
        to_quality=Quality.P1080.value,
        video_time=300.0
    )
    await producer.send_event(event)
    
    # Buffer event
    event = create_buffer_event(
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=450.0,
        is_start=True,
        buffer_health=0.0
    )
    await producer.send_event(event)
    
    await asyncio.sleep(0.5)
    
    event = create_buffer_event(
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=455.0,
        is_start=False,
        buffer_health=1.0
    )
    await producer.send_event(event)
    
    # Interaction
    event = create_interaction_event(
        EventType.LIKE,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=600.0
    )
    await producer.send_event(event)
    
    # View end
    event = LivestreamEvent(
        event_type=EventType.VIEW_END.value,
        stream_id=stream_id,
        viewer_id=viewer_id,
        session_id=session_id,
        video_time=1800.0,
        video_duration=3600.0
    )
    await producer.send_event(event)
    
    print(f"Producer stats: {producer.get_stats()}")
    await producer.stop()


if __name__ == "__main__":
    asyncio.run(demo_producer())