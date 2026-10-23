"""
Alerts Routes for Livestream Analytics API
===========================================
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
import structlog

from middleware.auth import get_current_user, TokenData, require_roles
from database import PostgresQuery, ClickHouseQuery

logger = structlog.get_logger()

router = APIRouter()


# ==================== MODELS ====================

class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(str, Enum):
    LOW_VIEWERS = "low_viewers"
    HIGH_BUFFER = "high_buffer"
    HIGH_ERRORS = "high_errors"
    QUALITY_DROP = "quality_drop"
    VIEWER_DROP = "viewer_drop"
    STREAM_OFFLINE = "stream_offline"
    HIGH_LATENCY = "high_latency"
    CDN_ISSUE = "cdn_issue"


class AlertResponse(BaseModel):
    id: str
    stream_id: str
    alert_type: str
    severity: str
    title: str
    message: str
    metadata: dict = {}
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    alerts: List[AlertResponse]
    total: int
    page: int
    page_size: int


class AlertCreate(BaseModel):
    stream_id: str
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    metadata: dict = {}


class AlertUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    resolved_by: Optional[str] = None


class AlertRuleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    alert_type: AlertType
    severity: AlertSeverity
    condition: dict
    threshold: float
    window_minutes: int
    is_enabled: bool = True
    created_by: str
    created_at: datetime
    updated_at: datetime


class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    alert_type: AlertType
    severity: AlertSeverity
    condition: dict
    threshold: float
    window_minutes: int = Field(..., ge=1, le=1440)
    is_enabled: bool = True


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    severity: Optional[AlertSeverity] = None
    condition: Optional[dict] = None
    threshold: Optional[float] = None
    window_minutes: Optional[int] = Field(None, ge=1, le=1440)
    is_enabled: Optional[bool] = None


# ==================== ROUTES ====================

@router.get("", response_model=AlertListResponse)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    stream_id: Optional[str] = Query(None),
    alert_type: Optional[AlertType] = Query(None),
    severity: Optional[AlertSeverity] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    """List alerts with filters."""
    async with PostgresQuery() as db:
        where_clauses = []
        params = []
        param_idx = 1
        
        if stream_id:
            where_clauses.append(f"stream_id = ${param_idx}")
            params.append(stream_id)
            param_idx += 1
        
        if alert_type:
            where_clauses.append(f"alert_type = ${param_idx}")
            params.append(alert_type.value)
            param_idx += 1
        
        if severity:
            where_clauses.append(f"severity = ${param_idx}")
            params.append(severity.value)
            param_idx += 1
        
        if is_resolved is not None:
            where_clauses.append(f"is_resolved = ${param_idx}")
            params.append(is_resolved)
            param_idx += 1
        
        if start_time:
            where_clauses.append(f"created_at >= ${param_idx}")
            params.append(start_time)
            param_idx += 1
        
        if end_time:
            where_clauses.append(f"created_at <= ${param_idx}")
            params.append(end_time)
            param_idx += 1
        
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Count
        count_sql = f"SELECT COUNT(*) FROM alerts {where_sql}"
        total = await db.fetchval(count_sql, *params)
        
        # Get alerts
        offset = (page - 1) * page_size
        select_sql = f"""
            SELECT * FROM alerts 
            {where_sql}
            ORDER BY created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([page_size, offset])
        
        rows = await db.fetch(select_sql, *params)
        alerts = [AlertResponse(**dict(row)) for row in rows]
        
        return AlertListResponse(
            alerts=alerts,
            total=total,
            page=page,
            page_size=page_size
        )


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    alert: AlertCreate,
    current_user: TokenData = Depends(require_roles("admin", "system"))
):
    """Create a new alert (typically called by monitoring system)."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("""
            INSERT INTO alerts (stream_id, alert_type, severity, title, message, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        """, 
            alert.stream_id, alert.alert_type.value, alert.severity.value,
            alert.title, alert.message, alert.metadata
        )
        
        logger.info("Alert created", alert_id=row["id"], stream_id=alert.stream_id, type=alert.alert_type)
        return AlertResponse(**dict(row))


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get alert by ID."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM alerts WHERE id = $1", alert_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        return AlertResponse(**dict(row))


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: str,
    alert_update: AlertUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update alert (resolve/unresolve)."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM alerts WHERE id = $1", alert_id)
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        updates = []
        params = [alert_id]
        param_idx = 2
        
        if alert_update.is_resolved is not None:
            updates.append(f"is_resolved = ${param_idx}")
            params.append(alert_update.is_resolved)
            param_idx += 1
            
            if alert_update.is_resolved:
                updates.append("resolved_at = NOW()")
                updates.append(f"resolved_by = ${param_idx}")
                params.append(current_user.user_id)
                param_idx += 1
        
        if not updates:
            return AlertResponse(**dict(row))
        
        sql = f"UPDATE alerts SET {', '.join(updates)} WHERE id = $1 RETURNING *"
        updated = await db.fetchrow(sql, *params)
        
        logger.info("Alert updated", alert_id=alert_id, user_id=current_user.user_id)
        return AlertResponse(**dict(updated))


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Resolve an alert."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM alerts WHERE id = $1", alert_id)
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        if row["is_resolved"]:
            raise HTTPException(status_code=400, detail="Alert already resolved")
        
        updated = await db.fetchrow("""
            UPDATE alerts 
            SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = $1
            WHERE id = $2
            RETURNING *
        """, current_user.user_id, alert_id)
        
        logger.info("Alert resolved", alert_id=alert_id, user_id=current_user.user_id)
        return AlertResponse(**dict(updated))


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: str,
    current_user: TokenData = Depends(require_roles("admin"))
):
    """Delete alert (admin only)."""
    async with PostgresQuery() as db:
        result = await db.execute("DELETE FROM alerts WHERE id = $1", alert_id)
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Alert not found")
        
        logger.info("Alert deleted", alert_id=alert_id, user_id=current_user.user_id)


# ==================== ALERT RULES ====================

@router.get("/rules", response_model=List[AlertRuleResponse])
async def list_alert_rules(
    current_user: TokenData = Depends(require_roles("admin", "analyst"))
):
    """List alert rules."""
    async with PostgresQuery() as db:
        rows = await db.fetch("SELECT * FROM alert_rules ORDER BY created_at DESC")
        return [AlertRuleResponse(**dict(row)) for row in rows]


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    rule: AlertRuleCreate,
    current_user: TokenData = Depends(require_roles("admin"))
):
    """Create alert rule."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("""
            INSERT INTO alert_rules (name, description, alert_type, severity, condition, threshold, window_minutes, is_enabled, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        """,
            rule.name, rule.description, rule.alert_type.value, rule.severity.value,
            rule.condition, rule.threshold, rule.window_minutes, rule.is_enabled,
            current_user.user_id
        )
        
        logger.info("Alert rule created", rule_id=row["id"], user_id=current_user.user_id)
        return AlertRuleResponse(**dict(row))


@router.get("/rules/{rule_id}", response_model=AlertRuleResponse)
async def get_alert_rule(
    rule_id: str,
    current_user: TokenData = Depends(require_roles("admin", "analyst"))
):
    """Get alert rule by ID."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM alert_rules WHERE id = $1", rule_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Alert rule not found")
        
        return AlertRuleResponse(**dict(row))


@router.patch("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: str,
    rule_update: AlertRuleUpdate,
    current_user: TokenData = Depends(require_roles("admin"))
):
    """Update alert rule."""
    async with PostgresQuery() as db:
        row = await db.fetchrow("SELECT * FROM alert_rules WHERE id = $1", rule_id)
        if not row:
            raise HTTPException(status_code=404, detail="Alert rule not found")
        
        updates = []
        params = [rule_id]
        param_idx = 2
        
        for field, value in rule_update.model_dump(exclude_unset=True).items():
            if field == "alert_type" and value:
                value = value.value
            elif field == "severity" and value:
                value = value.value
            
            updates.append(f"{field} = ${param_idx}")
            params.append(value)
            param_idx += 1
        
        if not updates:
            return AlertRuleResponse(**dict(row))
        
        updates.append("updated_at = NOW()")
        
        sql = f"UPDATE alert_rules SET {', '.join(updates)} WHERE id = $1 RETURNING *"
        updated = await db.fetchrow(sql, *params)
        
        logger.info("Alert rule updated", rule_id=rule_id, user_id=current_user.user_id)
        return AlertRuleResponse(**dict(updated))


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    rule_id: str,
    current_user: TokenData = Depends(require_roles("admin"))
):
    """Delete alert rule."""
    async with PostgresQuery() as db:
        result = await db.execute("DELETE FROM alert_rules WHERE id = $1", rule_id)
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Alert rule not found")
        
        logger.info("Alert rule deleted", rule_id=rule_id, user_id=current_user.user_id)


# ==================== REAL-TIME ALERTS ====================

@router.get("/realtime/{stream_id}")
async def get_realtime_alerts(
    stream_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get real-time alerts for a stream from Kafka/ClickHouse."""
    async with ClickHouseQuery() as ch:
        # Get recent alerts from stream processing
        result = await ch.query("""
            SELECT 
                stream_id,
                alert_type,
                severity,
                title,
                message,
                value,
                threshold,
                timestamp
            FROM livestream_analytics.realtime_alerts
            WHERE stream_id = %(stream_id)s
              AND timestamp >= now() - INTERVAL 1 HOUR
            ORDER BY timestamp DESC
            LIMIT 50
        """, {"stream_id": stream_id})
        
        return {
            "stream_id": stream_id,
            "alerts": result,
            "count": len(result)
        }


@router.get("/summary/dashboard")
async def get_alert_summary(
    current_user: TokenData = Depends(get_current_user)
):
    """Get alert summary for dashboard."""
    async with PostgresQuery() as db:
        # Active alerts by severity
        active_by_severity = await db.fetch("""
            SELECT severity, COUNT(*) as count
            FROM alerts
            WHERE is_resolved = FALSE
            GROUP BY severity
        """)
        
        # Active alerts by type
        active_by_type = await db.fetch("""
            SELECT alert_type, COUNT(*) as count
            FROM alerts
            WHERE is_resolved = FALSE
            GROUP BY alert_type
            ORDER BY count DESC
        """)
        
        # Recent alerts (last 24h)
        recent = await db.fetch("""
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_resolved = FALSE) as active,
                COUNT(*) FILTER (WHERE severity = 'critical') as critical
            FROM alerts
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour
        """)
        
        # Top streams with alerts
        top_streams = await db.fetch("""
            SELECT 
                stream_id,
                COUNT(*) as alert_count,
                COUNT(*) FILTER (WHERE is_resolved = FALSE) as active_count
            FROM alerts
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY stream_id
            ORDER BY alert_count DESC
            LIMIT 10
        """)
        
        return {
            "active_by_severity": {r["severity"]: r["count"] for r in active_by_severity},
            "active_by_type": {r["alert_type"]: r["count"] for r in active_by_type},
            "recent_timeline": [dict(r) for r in recent],
            "top_streams": [dict(r) for r in top_streams]
        }


@router.post("/test/{stream_id}")
async def test_alert(
    stream_id: str,
    alert_type: AlertType = AlertType.LOW_VIEWERS,
    current_user: TokenData = Depends(require_roles("admin", "analyst"))
):
    """Create a test alert for a stream."""
    test_messages = {
        AlertType.LOW_VIEWERS: "Test alert: Stream has low viewer count",
        AlertType.HIGH_BUFFER: "Test alert: High buffer ratio detected",
        AlertType.HIGH_ERRORS: "Test alert: High error rate",
        AlertType.QUALITY_DROP: "Test alert: Video quality dropped",
        AlertType.VIEWER_DROP: "Test alert: Sudden viewer drop",
        AlertType.STREAM_OFFLINE: "Test alert: Stream went offline",
        AlertType.HIGH_LATENCY: "Test alert: High latency detected",
        AlertType.CDN_ISSUE: "Test alert: CDN issue detected",
    }
    
    async with PostgresQuery() as db:
        row = await db.fetchrow("""
            INSERT INTO alerts (stream_id, alert_type, severity, title, message, metadata)
            VALUES ($1, $2, 'info', $3, $4, $5)
            RETURNING *
        """,
            stream_id, alert_type.value,
            f"Test Alert: {alert_type.value}",
            test_messages.get(alert_type, "Test alert"),
            {"test": True, "created_by": current_user.user_id}
        )
        
        return AlertResponse(**dict(row))