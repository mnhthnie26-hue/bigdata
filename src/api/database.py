"""
Database Connections for Livestream Analytics API
==================================================
Manages connections to ClickHouse, PostgreSQL, and Redis.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional, List, Dict, Any
import asyncpg
import redis.asyncio as redis
from clickhouse_connect import get_client
from clickhouse_connect.driver.client import Client as ClickHouseClient
from config import settings
import structlog

logger = structlog.get_logger()


# ==================== GLOBAL CONNECTION POOLS ====================

_clickhouse_client: Optional[ClickHouseClient] = None
_postgres_pool: Optional[asyncpg.Pool] = None
_redis_pool: Optional[redis.ConnectionPool] = None
_redis_client: Optional[redis.Redis] = None


# ==================== CLICKHOUSE ====================

async def get_clickhouse_client() -> ClickHouseClient:
    """Get or create ClickHouse client."""
    global _clickhouse_client
    
    if _clickhouse_client is None:
        _clickhouse_client = get_client(
            host=settings.CLICKHOUSE_HOST,
            port=settings.CLICKHOUSE_PORT,
            username=settings.CLICKHOUSE_USER,
            password=settings.CLICKHOUSE_PASSWORD,
            database=settings.CLICKHOUSE_DB,
            secure=settings.CLICKHOUSE_SECURE,
            connect_timeout=10,
            send_receive_timeout=30,
            compress=True,
            settings={
                "max_threads": 4,
                "max_memory_usage": "10000000000"
            }
        )
        logger.info("ClickHouse client initialized", host=settings.CLICKHOUSE_HOST)
    
    return _clickhouse_client


async def close_clickhouse():
    """Close ClickHouse client."""
    global _clickhouse_client
    if _clickhouse_client:
        _clickhouse_client.close()
        _clickhouse_client = None
        logger.info("ClickHouse client closed")


# ==================== POSTGRESQL ====================

async def get_postgres_pool() -> asyncpg.Pool:
    """Get or create PostgreSQL connection pool."""
    global _postgres_pool
    
    if _postgres_pool is None:
        _postgres_pool = await asyncpg.create_pool(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            min_size=5,
            max_size=settings.POSTGRES_POOL_SIZE,
            command_timeout=30,
            server_settings={
                "application_name": "livestream-analytics-api",
                "timezone": "UTC"
            }
        )
        logger.info("PostgreSQL pool initialized", host=settings.POSTGRES_HOST)
    
    return _postgres_pool


async def close_postgres():
    """Close PostgreSQL pool."""
    global _postgres_pool
    if _postgres_pool:
        await _postgres_pool.close()
        _postgres_pool = None
        logger.info("PostgreSQL pool closed")


@asynccontextmanager
async def get_postgres_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get a PostgreSQL connection from pool."""
    pool = await get_postgres_pool()
    async with pool.acquire() as conn:
        yield conn


# ==================== REDIS ====================

async def get_redis_client() -> redis.Redis:
    """Get or create Redis client."""
    global _redis_client, _redis_pool
    
    if _redis_client is None:
        _redis_pool = redis.ConnectionPool.from_url(
            f"redis://{':{}@'.format(settings.REDIS_PASSWORD) if settings.REDIS_PASSWORD else ''}{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}",
            max_connections=settings.REDIS_POOL_SIZE,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30
        )
        _redis_client = redis.Redis(connection_pool=_redis_pool)
        logger.info("Redis client initialized", host=settings.REDIS_HOST)
    
    return _redis_client


async def close_redis():
    """Close Redis client and pool."""
    global _redis_client, _redis_pool
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
    if _redis_pool:
        await _redis_pool.disconnect()
        _redis_pool = None
    logger.info("Redis client closed")


# ==================== INITIALIZATION ====================

async def init_db():
    """Initialize all database connections."""
    await asyncio.gather(
        get_clickhouse_client(),
        get_postgres_pool(),
        get_redis_client(),
        return_exceptions=True
    )
    
    # Verify connections
    try:
        ch = await get_clickhouse_client()
        ch.query("SELECT 1")
        logger.info("ClickHouse connection verified")
    except Exception as e:
        logger.error("ClickHouse connection failed", error=str(e))
        raise
    
    try:
        async with get_postgres_connection() as conn:
            await conn.fetchval("SELECT 1")
        logger.info("PostgreSQL connection verified")
    except Exception as e:
        logger.error("PostgreSQL connection failed", error=str(e))
        raise
    
    try:
        r = await get_redis_client()
        await r.ping()
        logger.info("Redis connection verified")
    except Exception as e:
        logger.error("Redis connection failed", error=str(e))
        raise


async def close_db():
    """Close all database connections."""
    await asyncio.gather(
        close_clickhouse(),
        close_postgres(),
        close_redis(),
        return_exceptions=True
    )


# ==================== QUERY HELPERS ====================

class ClickHouseQuery:
    """Helper class for ClickHouse queries."""
    
    def __init__(self):
        self.client = None
    
    async def __aenter__(self):
        self.client = await get_clickhouse_client()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass  # Client is global
    
    async def query(self, sql: str, params: Optional[Dict] = None) -> List[Dict]:
        """Execute query and return list of dicts."""
        result = self.client.query(sql, parameters=params or {})
        columns = result.column_names
        return [dict(zip(columns, row)) for row in result.result_rows]
    
    async def query_df(self, sql: str, params: Optional[Dict] = None):
        """Execute query and return pandas DataFrame."""
        return self.client.query_df(sql, parameters=params or {})
    
    async def execute(self, sql: str, params: Optional[Dict] = None) -> int:
        """Execute DDL/DML and return affected rows."""
        result = self.client.command(sql, parameters=params or {})
        return result


class PostgresQuery:
    """Helper class for PostgreSQL queries."""
    
    def __init__(self):
        self.conn = None
    
    async def __aenter__(self):
        pool = await get_postgres_pool()
        self.conn = await pool.acquire()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            pool = await get_postgres_pool()
            await pool.release(self.conn)
    
    async def fetch(self, sql: str, *args) -> List[asyncpg.Record]:
        """Execute query and return records."""
        return await self.conn.fetch(sql, *args)
    
    async def fetchrow(self, sql: str, *args) -> Optional[asyncpg.Record]:
        """Execute query and return single record."""
        return await self.conn.fetchrow(sql, *args)
    
    async def fetchval(self, sql: str, *args) -> Any:
        """Execute query and return single value."""
        return await self.conn.fetchval(sql, *args)
    
    async def execute(self, sql: str, *args) -> str:
        """Execute DDL/DML and return status."""
        return await self.conn.execute(sql, *args)
    
    async def executemany(self, sql: str, args_list: List[tuple]) -> None:
        """Execute many statements."""
        await self.conn.executemany(sql, args_list)


class RedisCache:
    """Helper class for Redis caching."""
    
    def __init__(self):
        self.client = None
    
    async def __aenter__(self):
        self.client = await get_redis_client()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    
    async def get(self, key: str) -> Optional[str]:
        return await self.client.get(key)
    
    async def set(self, key: str, value: str, ttl: int = 300) -> bool:
        return await self.client.set(key, value, ex=ttl)
    
    async def delete(self, key: str) -> int:
        return await self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        return await self.client.exists(key) > 0
    
    async def incr(self, key: str, ttl: int = 300) -> int:
        pipe = self.client.pipeline()
        pipe.incr(key)
        pipe.expire(key, ttl)
        results = await pipe.execute()
        return results[0]
    
    async def get_json(self, key: str) -> Optional[Dict]:
        import json
        data = await self.client.get(key)
        return json.loads(data) if data else None
    
    async def set_json(self, key: str, value: Dict, ttl: int = 300) -> bool:
        import json
        return await self.client.set(key, json.dumps(value), ex=ttl)
    
    async def keys(self, pattern: str) -> List[str]:
        return await self.client.keys(pattern)
    
    async def scan_iter(self, pattern: str) -> AsyncGenerator[str, None]:
        async for key in self.client.scan_iter(match=pattern):
            yield key