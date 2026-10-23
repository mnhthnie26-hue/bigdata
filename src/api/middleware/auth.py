"""
Authentication Middleware for Livestream Analytics API
======================================================
JWT-based authentication with role-based access control.
"""

from typing import Optional, List
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
import structlog
from config import settings

logger = structlog.get_logger()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


# ==================== PASSWORD UTILS ====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ==================== JWT UTILS ====================

def create_access_token(data: dict, expires_delta: Optional[int] = None) -> str:
    to_encode = data.copy()
    expire_minutes = expires_delta or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    import datetime
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=expire_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    import datetime
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning("JWT decode failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid token")


# ==================== USER MODEL ====================

class TokenData:
    def __init__(self, user_id: str, username: str, roles: List[str], email: str):
        self.user_id = user_id
        self.username = username
        self.roles = roles
        self.email = email
    
    def has_role(self, role: str) -> bool:
        return role in self.roles or "admin" in self.roles
    
    def has_any_role(self, roles: List[str]) -> bool:
        return any(r in self.roles for r in roles) or "admin" in self.roles


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> TokenData:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    payload = decode_token(credentials.credentials)
    
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user_id = payload.get("sub")
    username = payload.get("username")
    roles = payload.get("roles", [])
    email = payload.get("email", "")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    return TokenData(user_id=user_id, username=username, roles=roles, email=email)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[TokenData]:
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_roles(*required_roles: str):
    """Dependency factory for role-based access control."""
    async def role_checker(user: TokenData = Depends(get_current_user)) -> TokenData:
        if not user.has_any_role(list(required_roles)):
            raise HTTPException(
                status_code=403,
                detail=f"Required roles: {', '.join(required_roles)}"
            )
        return user
    return role_checker


# ==================== MIDDLEWARE ====================

class AuthMiddleware:
    """Middleware to attach user info to request state."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # This middleware just passes through
        # Actual auth is done via Depends in routes
        await self.app(scope, receive, send)