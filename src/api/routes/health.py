"""
Health Check Routes for Livestream Analytics API
=================================================
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
import structlog
from typing import Optional, List

from config import settings
from database import get_clickhouse_client, get_postgres_pool, get_redis_client

logger = structlog.get_logger()

router = APIRouter()


# ==================== MODELS ====================

class HealthStatus(BaseModel):
    status: str
    service: str
    latency_ms: Optional[float] = None
    details: dict = {}


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime
    services: List[HealthStatus]


# ==================== ROUTES ====================

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Comprehensive health check for all services."""
    services = []
    overall_healthy = True
    
    # Check ClickHouse
    ch_start = datetime.utcnow()
    try:
        ch = await get_clickhouse_client()
        ch.query("SELECT 1")
        ch_latency = (datetime.utcnow() - ch_start).total_seconds() * 1000
        services.append(HealthStatus(
            status="healthy",
            service="clickhouse",
            latency_ms=round(ch_latency, 2)
        ))
    except Exception as e:
        overall_healthy = False
        services.append(HealthStatus(
            status="unhealthy",
            service="clickhouse",
            details={"error": str(e)}
        ))
    
    # Check PostgreSQL
    pg_start = datetime.utcnow()
    try:
        pool = await get_postgres_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        pg_latency = (datetime.utcnow() - pg_start).total_seconds() * 1000
        services.append(HealthStatus(
            status="healthy",
            service="postgresql",
            latency_ms=round(pg_latency, 2),
            details={"pool_size": pool.get_size(), "idle_connections": pool.get_idle_size()}
        ))
    except Exception as e:
        overall_healthy = False
        services.append(HealthStatus(
            status="unhealthy",
            service="postgresql",
            details={"error": str(e)}
        ))
    
    # Check Redis
    redis_start = datetime.utcnow()
    try:
        redis = await get_redis_client()
        await redis.ping()
        redis_latency = (datetime.utcnow() - redis_start).total_seconds() * 1000
        services.append(HealthStatus(
            status="healthy",
            service="redis",
            latency_ms=round(redis_latency, 2)
        ))
    except Exception as e:
        overall_healthy = False
        services.append(HealthStatus(
            status="unhealthy",
            service="redis",
            details={"error": str(e)}
        ))
    
    # Check Kafka (via metadata)
    kafka_start = datetime.utcnow()
    try:
        from aiokafka import AIOKafkaProducer
        producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            client_id="health-check"
        )
        await producer.start()
        await producer.client.fetch_cluster_metadata()
        await producer.stop()
        kafka_latency = (datetime.utcnow() - kafka_start).total_seconds() * 1000
        services.append(HealthStatus(
            status="healthy",
            service="kafka",
            latency_ms=round(kafka_latency, 2)
        ))
    except Exception as e:
        overall_healthy = False
        services.append(HealthStatus(
            status="unhealthy",
            service="kafka",
            details={"error": str(e)}
        ))
    
    return HealthResponse(
        status="healthy" if overall_healthy else "degraded",
        version=settings.API_VERSION,
        timestamp=datetime.utcnow(),
        services=services
    )


@router.get("/health/live")
async def liveness_probe():
    """Kubernetes liveness probe."""
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness_probe():
    """Kubernetes readiness probe."""
    try:
        # Quick checks
        ch = await get_clickhouse_client()
        ch.query("SELECT 1")
        
        pool = await get_postgres_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        
        redis = await get_redis_client()
        await redis.ping()
        
        return {"status": "ready"}
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "error": str(e)}
        )


@router.get("/version")
async def version():
    """Get API version."""
    return {
        "version": settings.API_VERSION,
        "name": "Livestream Analytics API",
        "build_time": datetime.utcnow().isoformat()
    }