"""
Configuration Management for Livestream Analytics API
======================================================
"""

from functools import lru_cache
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # App
    API_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        description="Allowed CORS origins"
    )
    
    # Security
    SECRET_KEY: str = Field(
        default="your-secret-key-change-in-production",
        description="Secret key for JWT tokens"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database - ClickHouse
    CLICKHOUSE_HOST: str = "localhost"
    CLICKHOUSE_PORT: int = 9000
    CLICKHOUSE_USER: str = "analytics"
    CLICKHOUSE_PASSWORD: str = "analytics_password"
    CLICKHOUSE_DB: str = "livestream_analytics"
    CLICKHOUSE_SECURE: bool = False
    
    # Database - PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "analytics"
    POSTGRES_PASSWORD: str = "analytics_password"
    POSTGRES_DB: str = "livestream_analytics"
    POSTGRES_POOL_SIZE: int = 20
    POSTGRES_MAX_OVERFLOW: int = 10
    
    # Database - Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    REDIS_POOL_SIZE: int = 10
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_CONSUMER_GROUP: str = "analytics-api"
    KAFKA_TOPICS: List[str] = Field(
        default=["livestream-events", "livestream-metrics", "livestream-alerts"]
    )
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_BURST: int = 20
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 500
    
    # Cache TTL (seconds)
    CACHE_TTL_SHORT: int = 30
    CACHE_TTL_MEDIUM: int = 300
    CACHE_TTL_LONG: int = 3600
    
    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 10000
    
    # Analytics
    REALTIME_WINDOW_MINUTES: int = 5
    HOURLY_AGGREGATION_ENABLED: bool = True
    SESSION_TIMEOUT_MINUTES: int = 30
    
    # Monitoring
    PROMETHEUS_ENABLED: bool = True
    LOG_LEVEL: str = "INFO"
    
    # Feature Flags
    ENABLE_REALTIME_WS: bool = True
    ENABLE_EXPORT: bool = True
    ENABLE_ALERTS: bool = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()