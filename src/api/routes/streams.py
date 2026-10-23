"""
Stream Routes for Livestream Analytics API
===========================================
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime
import structlog

from middleware.auth import get_current_user, TokenData, require_roles
from database import ClickHouseQuery, PostgresQuery

logger = structlog.get_logger()

router = APIRouter()


# ==================== MODELS ====================

class StreamBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    thumbnail_url: Optional[str] = None
    hls_url: Optional[str] = None
    dash_url: Optional[str] = None
    is_mature: bool = False
    language: str = "vi"
    scheduled_start: Optional[datetime] = None


class StreamCreate(StreamBase):
    pass


class StreamUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    thumbnail_url: Optional[str] = None
    hls_url: Optional[str] = None
    dash_url: Optional[str] = None
    is_mature: Optional[bool] = None
    language: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    status: Optional[str] = None


class StreamResponse(StreamBase):
    id: str
    streamer_id: str
    status: str
    max_concurrent_viewers: int = 0
    total_views: int = 0
    total_watch_time_seconds: int = 0
    created_at: datetime
    updated_at: datetime
    actual_start: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class StreamListResponse(BaseModel):
    streams: List[StreamResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class StreamStatsResponse(BaseModel):
    stream_id: str
    current_viewers: int
    peak_viewers: int
    total_views: int
    avg_watch_time_seconds: float
    engagement_rate: float
    avg_bitrate: int
    buffer_ratio: float
    error_rate: float


# ==================== ROUTES ====================

@router.get("", response_model=StreamListResponse)
async def list_streams(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    streamer_id: Optional[str] = Query(None, description="Filter by streamer"),
    search: Optional[str] = Query(None, description="Search in title/description"),
    current_user: TokenData = Depends(get_current_user)
):
    """List streams with pagination and filters."""
    async with PostgresQuery() as db:
        # Build query
        where_clauses = []
        params = []
        param_idx = 1
        
        if status:
            where_clauses.append(f"status = ${param_idx}")
            params.append(status)
            param_idx += 1
        
        if category:
            where_clauses.append(f"category = ${param_idx}")
            params.append(category)
            param_idx += 1
        
        if streamer_id:
            where_clauses.append(f"streamer_id = ${param_idx}")
            params.append(streamer_id)
            param_idx += 1
        
        if search:
            where_clauses.append(f"(title ILIKE ${param_idx} OR description ILIKE ${param_idx})")
            params.append(f"%{search}%")
            param_idx += 1
        
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Count total
        count_sql = f"SELECT COUNT(*) FROM streams {where_sql}"
        total = await db.fetchval(count_sql, *params)
        
        # Get streams
        offset = (page - 1) * page_size
        select_sql = f"""
            SELECT * FROM streams 
            {where_sql}
            ORDER BY created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([page_size, offset])
        
        rows = await db.fetch(select_sql, *params)
        streams = [StreamResponse(**dict(row)) for row in rows]
        
        return StreamListResponse(
            streams=streams,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        )


@router.post("", response_model=StreamResponse, status_code=status.HTTP_201_CREATED)
async def create_stream(
    stream: StreamCreate,
    current_user: TokenData = Depends(require_roles("streamer", "admin"))
):
    """Create a new stream."""
    async with PostgresQuery() as db:
        # Get streamer profile
        streamer = await db.fetchrow(
            "SELECT id FROM streamers WHERE user_id = $1",
            current_user.user_id
        )
        
        if not streamer and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Streamer profile not found")
        
        streamer_id = streamer["id"] if streamer else current_user.user_id
        
        # Insert stream
        row = await db.fetchrow("""
            INSERT INTO streams (
                streamer_id, title, description, category, tags,
                thumbnail_url, hls_url, dash_url, is_mature, language,
                scheduled_start, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'scheduled')
            RETURNING *
        """, 
            streamer_id, stream.title, stream.description, stream.category,
            stream.tags, stream.thumbnail_url, stream.hls_url, stream.dash_url,
            stream.is_mature, stream.language, stream.scheduled_start
        )
        
        logger.info("Stream created", stream_id=row["id"], user_id=current_user.user_id)
        return StreamResponse(**dict(row))


@router.get("/{stream_id}", response_model=StreamResponse)
async def get_stream(
    stream_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get stream by ID."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM streams WHERE id = $1", stream_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        return StreamResponse(**dict(row))


@router.patch("/{stream_id}", response_model=StreamResponse)
async def update_stream(
    stream_id: str,
    stream_update: StreamUpdate,
    current_user: TokenData = Depends(require_roles("streamer", "admin"))
):
    """Update stream."""
    async with PostgresQuery() as db:
        # Check ownership
        row = await db.fetchrow("SELECT * FROM streams WHERE id = $1", stream_id)
        if not row:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        if not current_user.has_role("admin"):
            streamer = await db.fetchrow(
                "SELECT id FROM streamers WHERE user_id = $1", current_user.user_id
            )
            if not streamer or row["streamer_id"] != streamer["id"]:
                raise HTTPException(status_code=403, detail="Not authorized")
        
        # Build update query
        updates = []
        params = [stream_id]
        param_idx = 2
        
        for field, value in stream_update.model_dump(exclude_unset=True).items():
            if field == "tags":
                updates.append(f"{field} = ${param_idx}")
            else:
                updates.append(f"{field} = ${param_idx}")
            params.append(value)
            param_idx += 1
        
        if not updates:
            return StreamResponse(**dict(row))
        
        updates.append("updated_at = NOW()")
        
        sql = f"""
            UPDATE streams SET {', '.join(updates)}
            WHERE id = $1
            RETURNING *
        """
        
        updated = await db.fetchrow(sql, *params)
        logger.info("Stream updated", stream_id=stream_id, user_id=current_user.user_id)
        return StreamResponse(**dict(updated))


@router.delete("/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stream(
    stream_id: str,
    current_user: TokenData = Depends(require_roles("streamer", "admin"))
):
    """Delete stream."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM streams WHERE id = $1", stream_id)
        if not row:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        if not current_user.has_role("admin"):
            streamer = await db.fetchrow(
                "SELECT id FROM streamers WHERE user_id = $1", current_user.user_id
            )
            if not streamer or row["streamer_id"] != streamer["id"]:
                raise HTTPException(status_code=403, detail="Not authorized")
        
        await db.execute("DELETE FROM streams WHERE id = $1", stream_id)
        logger.info("Stream deleted", stream_id=stream_id, user_id=current_user.user_id)


@router.get("/{stream_id}/stats", response_model=StreamStatsResponse)
async def get_stream_stats(
    stream_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get real-time stream statistics."""
    async with ClickHouseQuery() as ch:
        # Get latest realtime metrics
        result = await ch.query("""
            SELECT 
                concurrent_viewers as current_viewers,
                peak_concurrent_viewers as peak_viewers,
                unique_viewers as total_views,
                avg_watch_time_seconds,
                engagement_rate,
                avg_bitrate,
                buffer_ratio,
                error_rate
            FROM livestream_analytics.realtime_metrics
            WHERE stream_id = %(stream_id)s
            ORDER BY window_start DESC
            LIMIT 1
        """, {"stream_id": stream_id})
        
        if not result:
            # Return zeros if no data
            return StreamStatsResponse(
                stream_id=stream_id,
                current_viewers=0,
                peak_viewers=0,
                total_views=0,
                avg_watch_time_seconds=0,
                engagement_rate=0,
                avg_bitrate=0,
                buffer_ratio=0,
                error_rate=0
            )
        
        return StreamStatsResponse(stream_id=stream_id, **result[0])


@router.post("/{stream_id}/start", response_model=StreamResponse)
async def start_stream(
    stream_id: str,
    current_user: TokenData = Depends(require_roles("streamer", "admin"))
):
    """Start a scheduled stream."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM streams WHERE id = $1", stream_id)
        if not row:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        if row["status"] != "scheduled":
            raise HTTPException(status_code=400, detail="Stream is not in scheduled status")
        
        if not current_user.has_role("admin"):
            streamer = await db.fetchrow(
                "SELECT id FROM streamers WHERE user_id = $1", current_user.user_id
            )
            if not streamer or row["streamer_id"] != streamer["id"]:
                raise HTTPException(status_code=403, detail="Not authorized")
        
        updated = await db.fetchrow("""
            UPDATE streams 
            SET status = 'live', actual_start = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING *
        """, stream_id)
        
        logger.info("Stream started", stream_id=stream_id, user_id=current_user.user_id)
        return StreamResponse(**dict(updated))


@router.post("/{stream_id}/end", response_model=StreamResponse)
async def end_stream(
    stream_id: str,
    current_user: TokenData = Depends(require_roles("streamer", "admin"))
):
    """End a live stream."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM streams WHERE id = $1", stream_id)
        if not row:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        if row["status"] != "live":
            raise HTTPException(status_code=400, detail="Stream is not live")
        
        if not current_user.has_role("admin"):
            streamer = await db.fetchrow(
                "SELECT id FROM streamers WHERE user_id = $1", current_user.user_id
            )
            if not streamer or row["streamer_id"] != streamer["id"]:
                raise HTTPException(status_code=403, detail="Not authorized")
        
        updated = await db.fetchrow("""
            UPDATE streams 
            SET status = 'ended', ended_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING *
        """, stream_id)
        
        logger.info("Stream ended", stream_id=stream_id, user_id=current_user.user_id)
        return StreamResponse(**dict(updated))


@router.get("/{stream_id}/viewers/realtime")
async def get_realtime_viewers(
    stream_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get real-time viewer list for a stream."""
    async with ClickHouseQuery() as ch:
        result = await ch.query("""
            SELECT 
                viewer_id,
                session_id,
                platform,
                device_type,
                country,
                city,
                video_time,
                quality,
                bitrate,
                buffer_health,
                toDateTime(timestamp) as last_seen
            FROM livestream_analytics.raw_events
            WHERE stream_id = %(stream_id)s
              AND event_type IN ('view_start', 'heartbeat')
              AND timestamp >= now() - INTERVAL 5 MINUTE
            ORDER BY timestamp DESC
            LIMIT 1000
        """, {"stream_id": stream_id})
        
        # Get unique viewers
        viewers = {}
        for row in result:
            vid = row["viewer_id"]
            if vid not in viewers:
                viewers[vid] = row
        
        return {
            "stream_id": stream_id,
            "viewer_count": len(viewers),
            "viewers": list(viewers.values())
        }