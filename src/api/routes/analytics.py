"""
Analytics Routes for Livestream Analytics API
==============================================
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from enum import Enum
import structlog

from middleware.auth import get_current_user, TokenData, require_roles
from database import ClickHouseQuery, PostgresQuery

logger = structlog.get_logger()

router = APIRouter()


# ==================== MODELS ====================

class TimeRange(str, Enum):
    LAST_5_MIN = "5m"
    LAST_15_MIN = "15m"
    LAST_30_MIN = "30m"
    LAST_HOUR = "1h"
    LAST_6_HOURS = "6h"
    LAST_24_HOURS = "24h"
    LAST_7_DAYS = "7d"
    LAST_30_DAYS = "30d"
    CUSTOM = "custom"


class Granularity(str, Enum):
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"


class MetricType(str, Enum):
    VIEWERS = "viewers"
    ENGAGEMENT = "engagement"
    QUALITY = "quality"
    ERRORS = "errors"
    GEOGRAPHIC = "geographic"
    DEVICE = "device"


class AnalyticsQuery(BaseModel):
    stream_ids: Optional[List[str]] = None
    streamer_id: Optional[str] = None
    time_range: TimeRange = TimeRange.LAST_HOUR
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    granularity: Granularity = Granularity.MINUTE
    metrics: List[MetricType] = [MetricType.VIEWERS, MetricType.ENGAGEMENT, MetricType.QUALITY]


class RealtimeMetricsResponse(BaseModel):
    stream_id: str
    timestamp: datetime
    concurrent_viewers: int
    unique_viewers: int
    avg_watch_time_seconds: float
    engagement_rate: float
    avg_bitrate: int
    quality_distribution: Dict[str, int]
    buffer_ratio: float
    avg_buffer_health: float
    error_rate: float
    error_count: int
    likes_count: int
    shares_count: int
    comments_count: int
    top_countries: Dict[str, int]
    platform_distribution: Dict[str, int]


class HistoricalMetricsResponse(BaseModel):
    stream_id: str
    granularity: Granularity
    data_points: List[Dict[str, Any]]


class StreamComparisonResponse(BaseModel):
    streams: List[Dict[str, Any]]
    comparison_metrics: List[str]


class TopStreamsResponse(BaseModel):
    streams: List[Dict[str, Any]]
    metric: str
    time_range: TimeRange


# ==================== HELPER FUNCTIONS ====================

def get_time_range_filter(time_range: TimeRange, start_time: Optional[datetime], end_time: Optional[datetime]) -> tuple[str, dict]:
    """Generate SQL time filter based on time range."""
    params = {}
    
    if time_range == TimeRange.CUSTOM:
        if not start_time or not end_time:
            raise HTTPException(status_code=400, detail="Custom time range requires start_time and end_time")
        return "window_start >= %(start)s AND window_start <= %(end)s", {"start": start_time, "end": end_time}
    
    now = datetime.utcnow()
    intervals = {
        TimeRange.LAST_5_MIN: timedelta(minutes=5),
        TimeRange.LAST_15_MIN: timedelta(minutes=15),
        TimeRange.LAST_30_MIN: timedelta(minutes=30),
        TimeRange.LAST_HOUR: timedelta(hours=1),
        TimeRange.LAST_6_HOURS: timedelta(hours=6),
        TimeRange.LAST_24_HOURS: timedelta(hours=24),
        TimeRange.LAST_7_DAYS: timedelta(days=7),
        TimeRange.LAST_30_DAYS: timedelta(days=30),
    }
    
    delta = intervals[time_range]
    start = now - delta
    
    return "window_start >= %(start)s AND window_start <= %(end)s", {"start": start, "end": now}


def get_granularity_interval(granularity: Granularity) -> str:
    """Get ClickHouse interval for granularity."""
    intervals = {
        Granularity.MINUTE: "1 MINUTE",
        Granularity.HOUR: "1 HOUR",
        Granularity.DAY: "1 DAY",
    }
    return intervals[granularity]


# ==================== ROUTES ====================

@router.get("/realtime/{stream_id}", response_model=RealtimeMetricsResponse)
async def get_realtime_metrics(
    stream_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get real-time metrics for a stream (last 1-5 minutes)."""
    async with ClickHouseQuery() as ch:
        result = await ch.query("""
            SELECT 
                stream_id,
                window_start as timestamp,
                concurrent_viewers,
                unique_viewers,
                avg_watch_time_seconds,
                engagement_rate,
                avg_bitrate,
                quality_distribution,
                buffer_ratio,
                avg_buffer_health,
                error_rate,
                error_count,
                likes_count,
                shares_count,
                comments_count,
                top_countries,
                platform_distribution
            FROM livestream_analytics.realtime_metrics
            WHERE stream_id = %(stream_id)s
            ORDER BY window_start DESC
            LIMIT 1
        """, {"stream_id": stream_id})
        
        if not result:
            raise HTTPException(status_code=404, detail="No metrics found for stream")
        
        return RealtimeMetricsResponse(**result[0])


@router.post("/historical", response_model=List[HistoricalMetricsResponse])
async def get_historical_metrics(
    query: AnalyticsQuery,
    current_user: TokenData = Depends(get_current_user)
):
    """Get historical metrics with flexible filtering."""
    # Build stream filter
    stream_filter = ""
    params = {}
    
    if query.stream_ids:
        placeholders = ",".join([f"%(stream_id_{i})s" for i in range(len(query.stream_ids))])
        stream_filter = f"AND stream_id IN ({placeholders})"
        for i, sid in enumerate(query.stream_ids):
            params[f"stream_id_{i}"] = sid
    elif query.streamer_id:
        # Get streams for streamer
        async with PostgresQuery() as db:
            rows = await db.fetch(
                "SELECT id FROM streams WHERE streamer_id = $1",
                query.streamer_id
            )
            stream_ids = [str(r["id"]) for r in rows]
            if stream_ids:
                placeholders = ",".join([f"%(stream_id_{i})s" for i in range(len(stream_ids))])
                stream_filter = f"AND stream_id IN ({placeholders})"
                for i, sid in enumerate(stream_ids):
                    params[f"stream_id_{i}"] = sid
            else:
                return []
    
    # Time filter
    time_filter, time_params = get_time_range_filter(query.time_range, query.start_time, query.end_time)
    params.update(time_params)
    
    # Granularity
    interval = get_granularity_interval(query.granularity)
    
    async with ClickHouseQuery() as ch:
        # Build metrics selection
        metric_selects = []
        
        if MetricType.VIEWERS in query.metrics:
            metric_selects.extend([
                "avg(concurrent_viewers) as avg_concurrent_viewers",
                "max(concurrent_viewers) as max_concurrent_viewers",
                "avg(unique_viewers) as avg_unique_viewers",
                "sum(unique_viewers) as total_unique_viewers"
            ])
        
        if MetricType.ENGAGEMENT in query.metrics:
            metric_selects.extend([
                "avg(engagement_rate) as avg_engagement_rate",
                "sum(likes_count) as total_likes",
                "sum(shares_count) as total_shares",
                "sum(comments_count) as total_comments",
                "sum(chat_messages_count) as total_chat_messages"
            ])
        
        if MetricType.QUALITY in query.metrics:
            metric_selects.extend([
                "avg(avg_bitrate) as avg_bitrate",
                "max(avg_bitrate) as max_bitrate",
                "avg(avg_buffer_health) as avg_buffer_health",
                "avg(buffer_ratio) as avg_buffer_ratio"
            ])
        
        if MetricType.ERRORS in query.metrics:
            metric_selects.extend([
                "avg(error_rate) as avg_error_rate",
                "sum(error_count) as total_errors"
            ])
        
        select_clause = ", ".join(metric_selects) if metric_selects else "count() as event_count"
        
        sql = f"""
            SELECT 
                stream_id,
                toStartOfInterval(window_start, INTERVAL {interval}) as period_start,
                {select_clause}
            FROM livestream_analytics.realtime_metrics
            WHERE {time_filter}
            {stream_filter}
            GROUP BY stream_id, period_start
            ORDER BY stream_id, period_start
        """
        
        result = await ch.query(sql, params)
        
        # Group by stream
        streams_data = {}
        for row in result:
            sid = row["stream_id"]
            if sid not in streams_data:
                streams_data[sid] = []
            streams_data[sid].append(row)
        
        return [
            HistoricalMetricsResponse(
                stream_id=sid,
                granularity=query.granularity,
                data_points=data
            )
            for sid, data in streams_data.items()
        ]


@router.get("/top-streams", response_model=TopStreamsResponse)
async def get_top_streams(
    metric: str = Query("concurrent_viewers", description="Metric to rank by"),
    time_range: TimeRange = TimeRange.LAST_HOUR,
    limit: int = Query(10, ge=1, le=100),
    current_user: TokenData = Depends(get_current_user)
):
    """Get top streams by metric."""
    metric_map = {
        "concurrent_viewers": "avg(concurrent_viewers)",
        "peak_viewers": "max(concurrent_viewers)",
        "unique_viewers": "sum(unique_viewers)",
        "watch_time": "sum(avg_watch_time_seconds * concurrent_viewers)",
        "engagement": "avg(engagement_rate)",
        "total_likes": "sum(likes_count)",
        "total_shares": "sum(shares_count)",
    }
    
    if metric not in metric_map:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Options: {list(metric_map.keys())}")
    
    time_filter, time_params = get_time_range_filter(time_range, None, None)
    
    async with ClickHouseQuery() as ch:
        sql = f"""
            SELECT 
                stream_id,
                {metric_map[metric]} as metric_value,
                avg(concurrent_viewers) as avg_concurrent_viewers,
                max(concurrent_viewers) as peak_concurrent_viewers,
                sum(unique_viewers) as total_unique_viewers,
                avg(engagement_rate) as avg_engagement_rate,
                sum(likes_count) as total_likes,
                sum(shares_count) as total_shares,
                sum(comments_count) as total_comments
            FROM livestream_analytics.realtime_metrics
            WHERE {time_filter}
            GROUP BY stream_id
            ORDER BY metric_value DESC
            LIMIT {limit}
        """
        
        result = await ch.query(sql, time_params)
        
        # Enrich with stream info
        async with PostgresQuery() as db:
            for row in result:
                stream = await db.fetchrow(
                    "SELECT title, streamer_id, category, thumbnail_url FROM streams WHERE id = $1",
                    row["stream_id"]
                )
                if stream:
                    row.update(dict(stream))
        
        return TopStreamsResponse(
            streams=result,
            metric=metric,
            time_range=time_range
        )


@router.post("/compare", response_model=StreamComparisonResponse)
async def compare_streams(
    stream_ids: List[str] = Query(..., min_length=2, max_length=10),
    time_range: TimeRange = TimeRange.LAST_HOUR,
    current_user: TokenData = Depends(get_current_user)
):
    """Compare multiple streams side by side."""
    if len(stream_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 streams required for comparison")
    
    placeholders = ",".join([f"%(stream_id_{i})s" for i in range(len(stream_ids))])
    params = {f"stream_id_{i}": sid for i, sid in enumerate(stream_ids)}
    
    time_filter, time_params = get_time_range_filter(time_range, None, None)
    params.update(time_params)
    
    async with ClickHouseQuery() as ch:
        sql = f"""
            SELECT 
                stream_id,
                avg(concurrent_viewers) as avg_concurrent_viewers,
                max(concurrent_viewers) as peak_concurrent_viewers,
                sum(unique_viewers) as total_unique_viewers,
                avg(avg_watch_time_seconds) as avg_watch_time_seconds,
                avg(engagement_rate) as avg_engagement_rate,
                avg(avg_bitrate) as avg_bitrate,
                avg(avg_buffer_health) as avg_buffer_health,
                avg(buffer_ratio) as avg_buffer_ratio,
                avg(error_rate) as avg_error_rate,
                sum(likes_count) as total_likes,
                sum(shares_count) as total_shares,
                sum(comments_count) as total_comments
            FROM livestream_analytics.realtime_metrics
            WHERE stream_id IN ({placeholders})
              AND {time_filter}
            GROUP BY stream_id
        """
        
        result = await ch.query(sql, params)
        
        # Enrich with stream info
        async with PostgresQuery() as db:
            for row in result:
                stream = await db.fetchrow(
                    "SELECT title, category, thumbnail_url FROM streams WHERE id = $1",
                    row["stream_id"]
                )
                if stream:
                    row.update(dict(stream))
        
        return StreamComparisonResponse(
            streams=result,
            comparison_metrics=[
                "avg_concurrent_viewers", "peak_concurrent_viewers", "total_unique_viewers",
                "avg_watch_time_seconds", "avg_engagement_rate", "avg_bitrate",
                "avg_buffer_health", "avg_buffer_ratio", "avg_error_rate",
                "total_likes", "total_shares", "total_comments"
            ]
        )


@router.get("/viewer-retention/{stream_id}")
async def get_viewer_retention(
    stream_id: str,
    time_range: TimeRange = TimeRange.LAST_HOUR,
    current_user: TokenData = Depends(get_current_user)
):
    """Get viewer retention curve for a stream."""
    time_filter, time_params = get_time_range_filter(time_range, None, None)
    time_params["stream_id"] = stream_id
    
    async with ClickHouseQuery() as ch:
        # Get retention from hourly stats
        result = await ch.query("""
            SELECT 
                hour,
                viewer_retention_5min,
                viewer_retention_15min,
                viewer_retention_30min,
                viewer_retention_60min
            FROM livestream_analytics.hourly_stream_stats
            WHERE stream_id = %(stream_id)s
              AND hour >= %(start)s
              AND hour <= %(end)s
            ORDER BY hour
        """, time_params)
        
        # Also get realtime session data for more granular retention
        session_result = await ch.query("""
            SELECT 
                session_id,
                viewer_id,
                started_at,
                ended_at,
                duration_seconds,
                total_watch_time_seconds
            FROM livestream_analytics.viewer_sessions
            WHERE stream_id = %(stream_id)s
              AND started_at >= %(start)s
              AND started_at <= %(end)s
            ORDER BY started_at
            LIMIT 10000
        """, time_params)
        
        # Calculate retention curve
        if session_result:
            sessions = session_result
            total_sessions = len(sessions)
            
            # Retention at different time points
            retention_points = [1, 2, 5, 10, 15, 30, 60]  # minutes
            retention_data = []
            
            for minutes in retention_points:
                threshold_seconds = minutes * 60
                retained = sum(1 for s in sessions if (s["duration_seconds"] or 0) >= threshold_seconds)
                retention_data.append({
                    "time_minutes": minutes,
                    "retention_rate": retained / total_sessions if total_sessions > 0 else 0,
                    "retained_sessions": retained,
                    "total_sessions": total_sessions
                })
        else:
            retention_data = []
        
        return {
            "stream_id": stream_id,
            "hourly_retention": result,
            "retention_curve": retention_data
        }


@router.get("/heatmap/{stream_id}")
async def get_engagement_heatmap(
    stream_id: str,
    time_range: TimeRange = TimeRange.LAST_HOUR,
    current_user: TokenData = Depends(get_current_user)
):
    """Get engagement heatmap (viewers over time)."""
    time_filter, time_params = get_time_range_filter(time_range, None, None)
    time_params["stream_id"] = stream_id
    
    async with ClickHouseQuery() as ch:
        result = await ch.query(f"""
            SELECT 
                toStartOfMinute(window_start) as minute,
                avg(concurrent_viewers) as avg_viewers,
                max(concurrent_viewers) as peak_viewers,
                sum(likes_count) as likes,
                sum(shares_count) as shares,
                sum(comments_count) as comments,
                sum(chat_messages_count) as chat_messages
            FROM livestream_analytics.realtime_metrics
            WHERE stream_id = %(stream_id)s
              AND {time_filter}
            GROUP BY minute
            ORDER BY minute
        """, time_params)
        
        return {
            "stream_id": stream_id,
            "heatmap_data": result,
            "time_range": time_range.value
        }


@router.get("/quality-distribution/{stream_id}")
async def get_quality_distribution(
    stream_id: str,
    time_range: TimeRange = TimeRange.LAST_HOUR,
    current_user: TokenData = Depends(get_current_user)
):
    """Get video quality distribution for a stream."""
    time_filter, time_params = get_time_range_filter(time_range, None, None)
    time_params["stream_id"] = stream_id
    
    async with ClickHouseQuery() as ch:
        result = await ch.query(f"""
            SELECT 
                quality,
                count() as viewer_count,
                avg(bitrate) as avg_bitrate,
                avg(buffer_health) as avg_buffer_health
            FROM livestream_analytics.raw_events
            WHERE stream_id = %(stream_id)s
              AND event_type = 'heartbeat'
              AND {time_filter}
              AND quality != ''
            GROUP BY quality
            ORDER BY viewer_count DESC
        """, time_params)
        
        return {
            "stream_id": stream_id,
            "quality_distribution": result,
            "time_range": time_range.value
        }


@router.get("/geographic/{stream_id}")
async def get_geographic_distribution(
    stream_id: str,
    time_range: TimeRange = TimeRange.LAST_HOUR,
    current_user: TokenData = Depends(get_current_user)
):
    """Get geographic viewer distribution."""
    time_filter, time_params = get_time_range_filter(time_range, None, None)
    time_params["stream_id"] = stream_id
    
    async with ClickHouseQuery() as ch:
        # Country level
        countries = await ch.query(f"""
            SELECT 
                country,
                count(DISTINCT viewer_id) as unique_viewers,
                count() as total_events,
                avg(video_time) as avg_watch_time
            FROM livestream_analytics.raw_events
            WHERE stream_id = %(stream_id)s
              AND event_type IN ('view_start', 'heartbeat')
              AND {time_filter}
            GROUP BY country
            ORDER BY unique_viewers DESC
            LIMIT 50
        """, time_params)
        
        # City level (top 20)
        cities = await ch.query(f"""
            SELECT 
                country,
                city,
                count(DISTINCT viewer_id) as unique_viewers,
                count() as total_events
            FROM livestream_analytics.raw_events
            WHERE stream_id = %(stream_id)s
              AND event_type IN ('view_start', 'heartbeat')
              AND {time_filter}
            GROUP BY country, city
            ORDER BY unique_viewers DESC
            LIMIT 20
        """, time_params)
        
        return {
            "stream_id": stream_id,
            "countries": countries,
            "cities": cities,
            "time_range": time_range.value
        }


@router.get("/export/{stream_id}")
async def export_analytics(
    stream_id: str,
    format: str = Query("csv", enum=["csv", "json", "xlsx"]),
    time_range: TimeRange = TimeRange.LAST_24_HOURS,
    current_user: TokenData = Depends(require_roles("streamer", "admin"))
):
    """Export analytics data."""
    # Implementation would generate file and return download link
    # For now, return a placeholder
    return {
        "message": "Export functionality would generate a downloadable file",
        "stream_id": stream_id,
        "format": format,
        "time_range": time_range.value,
        "download_url": f"/api/v1/analytics/download/{stream_id}/{format}?range={time_range.value}"
    }