"""
Rate Limiting Middleware for Livestream Analytics API
======================================================
Token bucket algorithm with Redis backend.
"""

import time
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import structlog

from database import RedisCache
from config import settings

logger = structlog.get_logger()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using token bucket algorithm."""
    
    def __init__(self, app):
        super().__init__(app)
        self.requests_per_window = settings.RATE_LIMIT_REQUESTS
        self.window_seconds = settings.RATE_LIMIT_WINDOW_SECONDS
        self.burst = settings.RATE_LIMIT_BURST
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and metrics
        if request.url.path in ["/health", "/metrics", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Skip for WebSocket connections
        if request.url.path.startswith("/ws"):
            return await call_next(request)
        
        # Get client identifier
        client_ip = self._get_client_ip(request)
        user_id = getattr(request.state, "user_id", None)
        
        # Use user_id if authenticated, otherwise IP
        identifier = f"user:{user_id}" if user_id else f"ip:{client_ip}"
        
        # Check rate limit
        allowed, retry_after = await self._check_rate_limit(identifier)
        
        if not allowed:
            logger.warning(
                "Rate limit exceeded",
                identifier=identifier,
                path=request.url.path,
                retry_after=retry_after
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "retry_after": retry_after
                },
                headers={
                    "X-RateLimit-Limit": str(self.requests_per_window),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                    "Retry-After": str(retry_after)
                }
            )
        
        # Add rate limit headers
        response = await call_next(request)
        
        remaining = await self._get_remaining(identifier)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_window)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + self.window_seconds)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check for forwarded headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    async def _check_rate_limit(self, identifier: str) -> tuple[bool, int]:
        """Check if request is allowed under rate limit."""
        async with RedisCache() as cache:
            key = f"ratelimit:{identifier}"
            
            # Get current count
            current = await cache.get(key)
            current_count = int(current) if current else 0
            
            if current_count >= self.requests_per_window:
                # Get TTL for retry-after
                ttl = await cache.client.ttl(key) if hasattr(cache.client, 'ttl') else self.window_seconds
                return False, max(ttl, 1)
            
            # Increment counter
            new_count = await cache.incr(key, self.window_seconds)
            
            # Set expiry on first request
            if new_count == 1:
                await cache.client.expire(key, self.window_seconds)
            
            return True, 0
    
    async def _get_remaining(self, identifier: str) -> int:
        """Get remaining requests in current window."""
        async with RedisCache() as cache:
            key = f"ratelimit:{identifier}"
            current = await cache.get(key)
            current_count = int(current) if current else 0
            return max(0, self.requests_per_window - current_count)


# ==================== ADVANCED RATE LIMITER ====================

class TokenBucketRateLimiter:
    """Token bucket rate limiter for more sophisticated limiting."""
    
    def __init__(
        self,
        capacity: int = 100,
        refill_rate: float = 10.0,  # tokens per second
        key_prefix: str = "tokenbucket"
    ):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.key_prefix = key_prefix
    
    async def consume(self, identifier: str, tokens: int = 1) -> tuple[bool, dict]:
        """Try to consume tokens from bucket."""
        async with RedisCache() as cache:
            key = f"{self.key_prefix}:{identifier}"
            
            # Get current state
            state = await cache.get_json(key)
            now = time.time()
            
            if state is None:
                # New bucket - full capacity
                state = {
                    "tokens": self.capacity - tokens,
                    "last_refill": now
                }
                await cache.set_json(key, state, ttl=int(self.capacity / self.refill_rate) + 60)
                return True, state
            
            # Refill tokens based on time elapsed
            elapsed = now - state["last_refill"]
            refill_tokens = elapsed * self.refill_rate
            state["tokens"] = min(self.capacity, state["tokens"] + refill_tokens)
            state["last_refill"] = now
            
            if state["tokens"] >= tokens:
                state["tokens"] -= tokens
                await cache.set_json(key, state, ttl=int(self.capacity / self.refill_rate) + 60)
                return True, state
            
            # Not enough tokens
            await cache.set_json(key, state, ttl=int(self.capacity / self.refill_rate) + 60)
            retry_after = int((tokens - state["tokens"]) / self.refill_rate) + 1
            return False, {"retry_after": retry_after, **state}


# Global rate limiter instances
api_rate_limiter = TokenBucketRateLimiter(
    capacity=settings.RATE_LIMIT_REQUESTS,
    refill_rate=settings.RATE_LIMIT_REQUESTS / settings.RATE_LIMIT_WINDOW_SECONDS,
    key_prefix="api"
)

websocket_rate_limiter = TokenBucketRateLimiter(
    capacity=100,
    refill_rate=5.0,
    key_prefix="ws"
)