"""
Viewer Routes for Livestream Analytics API
===========================================
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import structlog

from middleware.auth import get_current_user, TokenData, require_roles
from database import ClickHouseQuery, PostgresQuery

logger = structlog.get_logger()

router = APIRouter()


# ==================== MODELS ====================

class ViewerProfileResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    anonymous_id: Optional[str] = None
    first_seen: datetime
    last_seen: datetime
    total_sessions: int
    total_watch_time_seconds: int
    avg_session_duration_seconds: float
    favorite_streamers: List[str] = []
    favorite_categories: List[str] = []
    preferred_quality: Optional[str] = None
    preferred_platform: Optional[str] = None
    preferred_device: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    is_high_engagement: bool = False
    is_frequent_viewer: bool = False
    is_mobile_viewer: bool = False
    is_binge_watcher: bool = False
    churn_risk_score: float = 0
    lifetime_value: float = 0
    segment: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ViewerSessionResponse(BaseModel):
    id: str
    viewer_profile_id: str
    stream_id: str
    session_id: str
    platform: Optional[str] = None
    device_type: Optional[str] = None
    os: Optional[str] = None
    browser: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    total_watch_time_seconds: Optional[int] = None
    quality_changes: int = 0
    buffer_events: int = 0
    total_buffer_time_seconds: float = 0
    errors_count: int = 0
    interactions_count: int = 0
    likes_count: int = 0
    shares_count: int = 0
    comments_count: int = 0
    is_active: bool = True
    
    class Config:
        from_attributes = True


class ViewerListResponse(BaseModel):
    viewers: List[ViewerProfileResponse]
    total: int
    page: int
    page_size: int


class SegmentStatsResponse(BaseModel):
    segment: str
    count: int
    percentage: float
    avg_watch_time: float
    avg_sessions: float
    churn_risk: float


class CohortAnalysisResponse(BaseModel):
    cohort_month: str
    viewers: int
    retention: List[float]  # Week 0, 1, 2, 3, 4 retention rates


# ==================== ROUTES ====================

@router.get("", response_model=ViewerListResponse)
async def list_viewers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    segment: Optional[str] = Query(None, description="Filter by segment"),
    country: Optional[str] = Query(None, description="Filter by country"),
    is_high_engagement: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Search by ID or location"),
    current_user: TokenData = Depends(require_roles("admin", "analyst"))
):
    """List viewer profiles with pagination."""
    async with PostgresQuery() as db:
        where_clauses = []
        params = []
        param_idx = 1
        
        if segment:
            where_clauses.append(f"segment = ${param_idx}")
            params.append(segment)
            param_idx += 1
        
        if country:
            where_clauses.append(f"country = ${param_idx}")
            params.append(country)
            param_idx += 1
        
        if is_high_engagement is not None:
            where_clauses.append(f"is_high_engagement = ${param_idx}")
            params.append(is_high_engagement)
            param_idx += 1
        
        if search:
            where_clauses.append(f"""
                (id::text ILIKE ${param_idx} 
                 OR user_id::text ILIKE ${param_idx} 
                 OR anonymous_id ILIKE ${param_idx}
                 OR country ILIKE ${param_idx}
                 OR city ILIKE ${param_idx})
            """)
            params.append(f"%{search}%")
            param_idx += 1
        
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Count
        count_sql = f"SELECT COUNT(*) FROM viewer_profiles {where_sql}"
        total = await db.fetchval(count_sql, *params)
        
        # Get viewers
        offset = (page - 1) * page_size
        select_sql = f"""
            SELECT * FROM viewer_profiles 
            {where_sql}
            ORDER BY last_seen DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([page_size, offset])
        
        rows = await db.fetch(select_sql, *params)
        viewers = [ViewerProfileResponse(**dict(row)) for row in rows]
        
        return ViewerListResponse(
            viewers=viewers,
            total=total,
            page=page,
            page_size=page_size
        )


@router.get("/segments", response_model=List[SegmentStatsResponse])
async def get_segment_stats(
    current_user: TokenData = Depends(require_roles("admin", "analyst"))
):
    """Get viewer segment statistics."""
    async with PostgresQuery() as db:
        result = await db.fetch("""
            SELECT 
                segment,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage,
                ROUND(AVG(total_watch_time_seconds) / 3600.0, 2) as avg_watch_time,
                ROUND(AVG(total_sessions)::numeric, 2) as avg_sessions,
                ROUND(AVG(churn_risk_score)::numeric, 4) as churn_risk
            FROM viewer_profiles
            GROUP BY segment
            ORDER BY count DESC
        """)
        
        return [SegmentStatsResponse(**dict(row)) for row in result]


@router.get("/cohorts", response_model=List[CohortAnalysisResponse])
async def get_cohort_analysis(
    months: int = Query(6, ge=1, le=24),
    current_user: TokenData = Depends(require_roles("admin", "analyst"))
):
    """Get cohort retention analysis."""
    async with ClickHouseQuery() as ch:
        result = await ch.query("""
            SELECT 
                toYYYYMM(first_seen) as cohort_month,
                count() as viewers
            FROM livestream_analytics.viewer_profiles
            WHERE first_seen >= now() - INTERVAL %(months)s MONTH
            GROUP BY cohort_month
            ORDER BY cohort_month
        """, {"months": months})
        
        cohorts = []
        for row in result:
            cohort_month = str(row["cohort_month"])
            viewers = row["viewers"]
            
            # Calculate weekly retention for this cohort
            retention = []
            for week in range(5):  # Week 0-4
                week_start = week * 7
                week_end = (week + 1) * 7
                
                retained = await ch.query("""
                    SELECT count(DISTINCT viewer_id) as retained
                    FROM livestream_analytics.viewer_sessions
                    WHERE viewer_profile_id IN (
                        SELECT id FROM viewer_profiles 
                        WHERE toYYYYMM(first_seen) = %(cohort)s
                    )
                    AND started_at >= first_seen + INTERVAL %(week_start)s DAY
                    AND started_at < first_seen + INTERVAL %(week_end)s DAY
                """, {"cohort": cohort_month, "week_start": week_start, "week_end": week_end})
                
                retained_count = retained[0]["retained"] if retained else 0
                retention.append(round(retained_count / viewers * 100, 2) if viewers > 0 else 0)
            
            cohorts.append(CohortAnalysisResponse(
                cohort_month=cohort_month,
                viewers=viewers,
                retention=retention
            ))
        
        return cohorts


@router.get("/{viewer_id}", response_model=ViewerProfileResponse)
async def get_viewer(
    viewer_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get viewer profile by ID."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM viewer_profiles WHERE id = $1", viewer_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Viewer not found")
        
        return ViewerProfileResponse(**dict(row))


@router.get("/{viewer_id}/sessions", response_model=List[ViewerSessionResponse])
async def get_viewer_sessions(
    viewer_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    current_user: TokenData = Depends(get_current_user)
):
    """Get viewer's session history."""
    async with PostgresQuery() as db:
        # Verify viewer exists
        viewer = await db.fetchrow("SELECT id FROM viewer_profiles WHERE id = $1", viewer_id)
        if not viewer:
            raise HTTPException(status_code=404, detail="Viewer not found")
        
        offset = (page - 1) * page_size
        rows = await db.fetch("""
            SELECT * FROM viewer_sessions
            WHERE viewer_profile_id = $1
            ORDER BY started_at DESC
            LIMIT $2 OFFSET $3
        """, viewer_id, page_size, offset)
        
        return [ViewerSessionResponse(**dict(row)) for row in rows]


@router.get("/{viewer_id}/behavior")
async def get_viewer_behavior(
    viewer_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: TokenData = Depends(get_current_user)
):
    """Get detailed viewer behavior analysis."""
    async with ClickHouseQuery() as ch:
        # Viewing patterns by hour of day
        hourly = await ch.query("""
            SELECT 
                toHour(timestamp) as hour,
                count(DISTINCT session_id) as sessions,
                sum(video_duration - video_time) as total_watch_time
            FROM livestream_analytics.raw_events
            WHERE viewer_id = %(viewer_id)s
              AND event_type = 'heartbeat'
              AND timestamp >= now() - INTERVAL %(days)s DAY
            GROUP BY hour
            ORDER BY hour
        """, {"viewer_id": viewer_id, "days": days})
        
        # Favorite categories
        categories = await ch.query("""
            SELECT 
                s.category,
                count(DISTINCT e.session_id) as sessions,
                sum(e.video_duration - e.video_time) as total_watch_time
            FROM livestream_analytics.raw_events e
            JOIN livestream_analytics.streams s ON e.stream_id = s.stream_id
            WHERE e.viewer_id = %(viewer_id)s
              AND e.event_type = 'heartbeat'
              AND e.timestamp >= now() - INTERVAL %(days)s DAY
            GROUP BY s.category
            ORDER BY sessions DESC
            LIMIT 10
        """, {"viewer_id": viewer_id, "days": days})
        
        # Quality preferences
        quality = await ch.query("""
            SELECT 
                quality,
                count() as count,
                avg(bitrate) as avg_bitrate
            FROM livestream_analytics.raw_events
            WHERE viewer_id = %(viewer_id)s
              AND event_type = 'heartbeat'
              AND timestamp >= now() - INTERVAL %(days)s DAY
            GROUP BY quality
            ORDER BY count DESC
        """, {"viewer_id": viewer_id, "days": days})
        
        # Device/platform usage
        devices = await ch.query("""
            SELECT 
                device_type,
                platform,
                count(DISTINCT session_id) as sessions
            FROM livestream_analytics.raw_events
            WHERE viewer_id = %(viewer_id)s
              AND event_type = 'view_start'
              AND timestamp >= now() - INTERVAL %(days)s DAY
            GROUP BY device_type, platform
            ORDER BY sessions DESC
        """, {"viewer_id": viewer_id, "days": days})
        
        # Engagement actions
        engagement = await ch.query("""
            SELECT 
                event_type as action,
                count() as count
            FROM livestream_analytics.raw_events
            WHERE viewer_id = %(viewer_id)s
              AND event_type IN ('like', 'share', 'comment', 'chat', 'reaction', 'follow', 'subscribe', 'donation')
              AND timestamp >= now() - INTERVAL %(days)s DAY
            GROUP BY event_type
            ORDER BY count DESC
        """, {"viewer_id": viewer_id, "days": days})
        
        return {
            "viewer_id": viewer_id,
            "period_days": days,
            "hourly_activity": hourly,
            "favorite_categories": categories,
            "quality_preferences": quality,
            "device_usage": devices,
            "engagement_actions": engagement
        }


@router.get("/live/current")
async def get_current_viewers(
    stream_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    current_user: TokenData = Depends(get_current_user)
):
    """Get currently active viewers."""
    async with ClickHouseQuery() as ch:
        stream_filter = "AND stream_id = %(stream_id)s" if stream_id else ""
        params = {"limit": limit}
        if stream_id:
            params["stream_id"] = stream_id
        
        result = await ch.query(f"""
            SELECT 
                viewer_id,
                stream_id,
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
            WHERE event_type IN ('view_start', 'heartbeat')
              AND timestamp >= now() - INTERVAL 5 MINUTE
              {stream_filter}
            ORDER BY timestamp DESC
            LIMIT %(limit)s
        """, params)
        
        # Deduplicate by viewer_id
        viewers = {}
        for row in result:
            vid = row["viewer_id"]
            if vid not in viewers:
                viewers[vid] = row
        
        return {
            "viewer_count": len(viewers),
            "viewers": list(viewers.values())
        }


@router.post("/{viewer_id}/segment")
async def update_viewer_segment(
    viewer_id: str,
    segment: str = Query(..., description="New segment"),
    current_user: TokenData = Depends(require_roles("admin"))
):
    """Manually update viewer segment (admin only)."""
    valid_segments = ["new", "casual", "regular", "loyal", "at_risk", "churned"]
    if segment not in valid_segments:
        raise HTTPException(status_code=400, detail=f"Invalid segment. Options: {valid_segments}")
    
    async with PostgresQuery() as db:
        result = await db.execute(
            "UPDATE viewer_profiles SET segment = $1, updated_at = NOW() WHERE id = $2",
            segment, viewer_id
        )
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Viewer not found")
        
        logger.info("Viewer segment updated", viewer_id=viewer_id, segment=segment, admin=current_user.user_id)
        return {"message": "Segment updated", "viewer_id": viewer_id, "segment": segment}