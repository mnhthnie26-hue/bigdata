"""
Authentication Routes for Livestream Analytics API
===================================================
Login, token refresh, and user profile endpoints.
"""

from datetime import datetime
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
import structlog

from database import PostgresQuery
from middleware.auth import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    TokenData
)

logger = structlog.get_logger()

router = APIRouter()


# ==================== MODELS ====================

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_active: bool
    email_verified: bool
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ==================== ROUTES ====================

@router.post("/login")
async def login(data: LoginRequest = None):
    """Authenticate user and return JWT access and refresh tokens (bypassed for demo)."""
    return {
        "access_token": "demo_token_123",
        "token_type": "bearer",
        "user": {
            "email": "admin@livestream.com",
            "role": "admin"
        }
    }


@router.get("/me")
async def get_me(current_user: TokenData = Depends(get_current_user)):
    """Get current authenticated user profile (bypassed for demo)."""
    return {
        "id": "demo",
        "email": "admin@livestream.com",
        "username": "admin",
        "full_name": "Demo Admin",
        "avatar_url": None,
        "role": "admin",
        "is_active": True,
        "email_verified": True,
        "last_login": None,
        "created_at": None,
        "updated_at": None
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest):
    """Generate new access token using valid refresh token."""
    try:
        payload = decode_token(data.refresh_token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token không hợp lệ hoặc đã hết hạn"
        )
    
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không phải là refresh token"
        )
    
    user_id = payload.get("sub")
    username = payload.get("username")
    roles = payload.get("roles", [])
    email = payload.get("email", "")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Payload của token không hợp lệ"
        )
    
    new_access_token = create_access_token({
        "sub": user_id,
        "username": username,
        "roles": roles,
        "email": email
    })
    
    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer"
    )
