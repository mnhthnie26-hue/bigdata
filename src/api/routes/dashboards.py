"""
Dashboard Routes for Livestream Analytics API
=============================================
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime
import json
import structlog

from middleware.auth import get_current_user, TokenData, require_roles
from database import PostgresQuery

logger = structlog.get_logger()

router = APIRouter()


# ==================== MODELS ====================

class WidgetConfig(BaseModel):
    """Widget configuration."""
    type: str  # line_chart, bar_chart, pie_chart, metric_card, table, heatmap, gauge
    title: str
    data_source: str  # API endpoint or query identifier
    query_params: dict = {}
    refresh_interval: int = 60  # seconds
    visualization: dict = {}  # Chart-specific options


class WidgetPosition(BaseModel):
    x: int = 0
    y: int = 0
    w: int = 6
    h: int = 4


class DashboardWidgetCreate(BaseModel):
    widget_type: str
    title: str
    config: WidgetConfig
    position: WidgetPosition


class DashboardWidgetResponse(BaseModel):
    id: str
    dashboard_id: str
    widget_type: str
    title: str
    config: dict
    position: dict
    data_source: str
    refresh_interval: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DashboardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    layout: List[DashboardWidgetCreate] = []
    is_public: bool = False


class DashboardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    layout: Optional[List[DashboardWidgetCreate]] = None
    is_public: Optional[bool] = None


class DashboardResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    layout: List[dict] = []
    is_default: bool = False
    is_public: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DashboardListResponse(BaseModel):
    dashboards: List[DashboardResponse]
    total: int


# ==================== ROUTES ====================

@router.get("", response_model=DashboardListResponse)
async def list_dashboards(
    current_user: TokenData = Depends(get_current_user)
):
    """List user's dashboards."""
    async with PostgresQuery() as db:
        rows = await db.fetch("""
            SELECT d.*, COUNT(w.id) as widget_count
            FROM dashboards d
            LEFT JOIN dashboard_widgets w ON d.id = w.dashboard_id
            WHERE d.user_id = $1 OR d.is_public = TRUE
            GROUP BY d.id
            ORDER BY d.is_default DESC, d.updated_at DESC
        """, current_user.user_id)
        
        dashboards = []
        for row in rows:
            d = dict(row)
            d.pop("widget_count", None)
            dashboards.append(DashboardResponse(**d))
        
        return DashboardListResponse(dashboards=dashboards, total=len(dashboards))


@router.post("", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    dashboard: DashboardCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Create a new dashboard."""
    async with PostgresQuery() as db:
        # Check if user already has a default dashboard
        if dashboard.is_default:
            await db.execute(
                "UPDATE dashboards SET is_default = FALSE WHERE user_id = $1",
                current_user.user_id
            )
        
        row = await db.fetchrow("""
            INSERT INTO dashboards (user_id, name, description, layout, is_default, is_public)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        """,
            current_user.user_id, dashboard.name, dashboard.description,
            json.dumps([w.model_dump() for w in dashboard.layout]),
            dashboard.is_default, dashboard.is_public
        )
        
        dashboard_id = row["id"]
        
        # Create widgets
        for widget in dashboard.layout:
            await db.execute("""
                INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, config, position, data_source, refresh_interval)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
                dashboard_id, widget.widget_type, widget.title,
                json.dumps(widget.config.model_dump()),
                json.dumps(widget.position.model_dump()),
                widget.config.data_source,
                widget.config.refresh_interval
            )
        
        logger.info("Dashboard created", dashboard_id=dashboard_id, user_id=current_user.user_id)
        return DashboardResponse(**dict(row))


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get dashboard with widgets."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM dashboards WHERE id = $1", dashboard_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Check access
        if row["user_id"] != current_user.user_id and not row["is_public"] and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        dashboard = DashboardResponse(**dict(row))
        
        # Get widgets
        widgets = await db.fetch(
            "SELECT * FROM dashboard_widgets WHERE dashboard_id = $1 ORDER BY created_at",
            dashboard_id
        )
        dashboard.layout = [dict(w) for w in widgets]
        
        return dashboard


@router.patch("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    dashboard_update: DashboardUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update dashboard."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM dashboards WHERE id = $1", dashboard_id)
        if not row:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        if row["user_id"] != current_user.user_id and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        updates = []
        params = [dashboard_id]
        param_idx = 2
        
        for field, value in dashboard_update.model_dump(exclude_unset=True).items():
            if field == "layout" and value is not None:
                value = json.dumps([w.model_dump() for w in value])
            
            updates.append(f"{field} = ${param_idx}")
            params.append(value)
            param_idx += 1
        
        if dashboard_update.is_default:
            await db.execute(
                "UPDATE dashboards SET is_default = FALSE WHERE user_id = $1 AND id != $2",
                current_user.user_id, dashboard_id
            )
        
        if not updates:
            return DashboardResponse(**dict(row))
        
        updates.append("updated_at = NOW()")
        
        sql = f"UPDATE dashboards SET {', '.join(updates)} WHERE id = $1 RETURNING *"
        updated = await db.fetchrow(sql, *params)
        
        # Update widgets if layout provided
        if dashboard_update.layout is not None:
            await db.execute("DELETE FROM dashboard_widgets WHERE dashboard_id = $1", dashboard_id)
            for widget in dashboard_update.layout:
                await db.execute("""
                    INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, config, position, data_source, refresh_interval)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                    dashboard_id, widget.widget_type, widget.title,
                    json.dumps(widget.config.model_dump()),
                    json.dumps(widget.position.model_dump()),
                    widget.config.data_source,
                    widget.config.refresh_interval
                )
        
        logger.info("Dashboard updated", dashboard_id=dashboard_id, user_id=current_user.user_id)
        return DashboardResponse(**dict(updated))


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Delete dashboard."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM dashboards WHERE id = $1", dashboard_id)
        if not row:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        if row["user_id"] != current_user.user_id and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        await db.execute("DELETE FROM dashboards WHERE id = $1", dashboard_id)
        logger.info("Dashboard deleted", dashboard_id=dashboard_id, user_id=current_user.user_id)


@router.post("/{dashboard_id}/widgets", response_model=DashboardWidgetResponse, status_code=status.HTTP_201_CREATED)
async def add_widget(
    dashboard_id: str,
    widget: DashboardWidgetCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Add widget to dashboard."""
    async with PostgresQuery() as db:
        # Verify dashboard ownership
        dashboard = await db.fetchrow("SELECT * FROM dashboards WHERE id = $1", dashboard_id)
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        if dashboard["user_id"] != current_user.user_id and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        row = await db.fetchrow("""
            INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, config, position, data_source, refresh_interval)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        """,
            dashboard_id, widget.widget_type, widget.title,
            json.dumps(widget.config.model_dump()),
            json.dumps(widget.position.model_dump()),
            widget.config.data_source,
            widget.config.refresh_interval
        )
        
        return DashboardWidgetResponse(**dict(row))


@router.patch("/widgets/{widget_id}", response_model=DashboardWidgetResponse)
async def update_widget(
    widget_id: str,
    widget_update: DashboardWidgetCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update widget."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("""
            SELECT w.*, d.user_id 
            FROM dashboard_widgets w
            JOIN dashboards d ON w.dashboard_id = d.id
            WHERE w.id = $1
        """, widget_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Widget not found")
        
        if row["user_id"] != current_user.user_id and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        updated = await db.fetchrow("""
            UPDATE dashboard_widgets 
            SET widget_type = $1, title = $2, config = $3, position = $4, 
                data_source = $5, refresh_interval = $6, updated_at = NOW()
            WHERE id = $7
            RETURNING *
        """,
            widget_update.widget_type, widget_update.title,
            json.dumps(widget_update.config.model_dump()),
            json.dumps(widget_update.position.model_dump()),
            widget_update.config.data_source,
            widget_update.config.refresh_interval,
            widget_id
        )
        
        return DashboardWidgetResponse(**dict(updated))


@router.delete("/widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_widget(
    widget_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Delete widget."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("""
            SELECT w.*, d.user_id 
            FROM dashboard_widgets w
            JOIN dashboards d ON w.dashboard_id = d.id
            WHERE w.id = $1
        """, widget_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Widget not found")
        
        if row["user_id"] != current_user.user_id and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        await db.execute("DELETE FROM dashboard_widgets WHERE id = $1", widget_id)


# ==================== PREDEFINED DASHBOARDS ====================

@router.get("/templates/default")
async def get_default_dashboard_template(
    current_user: TokenData = Depends(get_current_user)
):
    """Get default dashboard template."""
    return {
        "name": "Stream Overview",
        "description": "Default dashboard for stream monitoring",
        "layout": [
            {
                "widget_type": "metric_card",
                "title": "Current Viewers",
                "config": {
                    "type": "metric_card",
                    "title": "Current Viewers",
                    "data_source": "/api/v1/analytics/realtime/{stream_id}",
                    "query_params": {"metric": "concurrent_viewers"},
                    "refresh_interval": 10,
                    "visualization": {"format": "number", "prefix": "", "suffix": " viewers"}
                },
                "position": {"x": 0, "y": 0, "w": 3, "h": 2}
            },
            {
                "widget_type": "metric_card",
                "title": "Peak Viewers",
                "config": {
                    "type": "metric_card",
                    "title": "Peak Viewers",
                    "data_source": "/api/v1/analytics/realtime/{stream_id}",
                    "query_params": {"metric": "peak_viewers"},
                    "refresh_interval": 30,
                    "visualization": {"format": "number", "prefix": "", "suffix": ""}
                },
                "position": {"x": 3, "y": 0, "w": 3, "h": 2}
            },
            {
                "widget_type": "metric_card",
                "title": "Avg Watch Time",
                "config": {
                    "type": "metric_card",
                    "title": "Avg Watch Time",
                    "data_source": "/api/v1/analytics/realtime/{stream_id}",
                    "query_params": {"metric": "avg_watch_time_seconds"},
                    "refresh_interval": 30,
                    "visualization": {"format": "duration", "unit": "seconds"}
                },
                "position": {"x": 6, "y": 0, "w": 3, "h": 2}
            },
            {
                "widget_type": "metric_card",
                "title": "Engagement Rate",
                "config": {
                    "type": "metric_card",
                    "title": "Engagement Rate",
                    "data_source": "/api/v1/analytics/realtime/{stream_id}",
                    "query_params": {"metric": "engagement_rate"},
                    "refresh_interval": 30,
                    "visualization": {"format": "percent", "decimals": 2}
                },
                "position": {"x": 9, "y": 0, "w": 3, "h": 2}
            },
            {
                "widget_type": "line_chart",
                "title": "Viewers Over Time",
                "config": {
                    "type": "line_chart",
                    "title": "Viewers Over Time",
                    "data_source": "/api/v1/analytics/heatmap/{stream_id}",
                    "query_params": {"time_range": "1h"},
                    "refresh_interval": 30,
                    "visualization": {
                        "x_axis": "minute",
                        "y_axis": "avg_viewers",
                        "lines": ["avg_viewers", "peak_viewers"],
                        "colors": ["#3b82f6", "#ef4444"]
                    }
                },
                "position": {"x": 0, "y": 2, "w": 8, "h": 6}
            },
            {
                "widget_type": "bar_chart",
                "title": "Quality Distribution",
                "config": {
                    "type": "bar_chart",
                    "title": "Quality Distribution",
                    "data_source": "/api/v1/analytics/quality-distribution/{stream_id}",
                    "query_params": {"time_range": "1h"},
                    "refresh_interval": 60,
                    "visualization": {
                        "x_axis": "quality",
                        "y_axis": "viewer_count",
                        "horizontal": True
                    }
                },
                "position": {"x": 8, "y": 2, "w": 4, "h": 6}
            },
            {
                "widget_type": "pie_chart",
                "title": "Top Countries",
                "config": {
                    "type": "pie_chart",
                    "title": "Top Countries",
                    "data_source": "/api/v1/analytics/geographic/{stream_id}",
                    "query_params": {"time_range": "1h"},
                    "refresh_interval": 60,
                    "visualization": {
                        "value_field": "unique_viewers",
                        "label_field": "country",
                        "limit": 10
                    }
                },
                "position": {"x": 0, "y": 8, "w": 6, "h": 6}
            },
            {
                "widget_type": "table",
                "title": "Recent Alerts",
                "config": {
                    "type": "table",
                    "title": "Recent Alerts",
                    "data_source": "/api/v1/alerts",
                    "query_params": {"stream_id": "{stream_id}", "limit": 10},
                    "refresh_interval": 30,
                    "visualization": {
                        "columns": [
                            {"field": "created_at", "header": "Time", "type": "datetime"},
                            {"field": "severity", "header": "Severity", "type": "badge"},
                            {"field": "title", "header": "Title", "type": "text"},
                            {"field": "message", "header": "Message", "type": "text"}
                        ]
                    }
                },
                "position": {"x": 6, "y": 8, "w": 6, "h": 6}
            }
        ]
    }


@router.post("/{dashboard_id}/duplicate", response_model=DashboardResponse)
async def duplicate_dashboard(
    dashboard_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Duplicate a dashboard."""
    async with PostgresQuery() as db:
        # Get original
        original = await db.fetchrow("SELECT * FROM dashboards WHERE id = $1", dashboard_id)
        if not original:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Check access
        if original["user_id"] != current_user.user_id and not original["is_public"] and not current_user.has_role("admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Create duplicate
        row = await db.fetchrow("""
            INSERT INTO dashboards (user_id, name, description, layout, is_default, is_public)
            VALUES ($1, $2, $3, $4, FALSE, FALSE)
            RETURNING *
        """,
            current_user.user_id,
            f"{original['name']} (Copy)",
            original["description"],
            original["layout"],
        )
        
        # Copy widgets
        widgets = await db.fetch(
            "SELECT * FROM dashboard_widgets WHERE dashboard_id = $1",
            dashboard_id
        )
        
        for widget in widgets:
            await db.execute("""
                INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, config, position, data_source, refresh_interval)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
                row["id"], widget["widget_type"], widget["title"],
                widget["config"], widget["position"],
                widget["data_source"], widget["refresh_interval"]
            )
        
        logger.info("Dashboard duplicated", original_id=dashboard_id, new_id=row["id"], user_id=current_user.user_id)
        return DashboardResponse(**dict(row))