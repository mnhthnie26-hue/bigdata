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
    email: EmailStr
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

@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest):
    """Authenticate user and return JWT access and refresh tokens."""
    async with PostgresQuery() as db:
        user = await db.fetchrow(
            """
            SELECT id, email, username, password_hash, full_name, avatar_url,
                   role, is_active, email_verified, last_login, created_at, updated_at
            FROM users
            WHERE email = $1
            """,
            data.email.lower().strip()
        )
        
        if not user or not verify_password(data.password, user["password_hash"]):
            logger.warning("Failed login attempt", email=data.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc mật khẩu không chính xác"
            )
        
        if not user["is_active"]:
            logger.warning("Inactive user login attempt", email=data.email)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị vô hiệu hóa"
            )
        
        # Update last login timestamp
        await db.execute(
            "UPDATE users SET last_login = NOW() WHERE id = $1",
            user["id"]
        )
    
    token_payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "roles": [user["role"]],
        "email": user["email"]
    }
    
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    
    user_response = UserResponse(
        id=str(user["id"]),
        email=user["email"],
        username=user["username"],
        full_name=user["full_name"],
        avatar_url=user["avatar_url"],
        role=user["role"],
        is_active=user["is_active"],
        email_verified=user["email_verified"],
        last_login=user["last_login"],
        created_at=user["created_at"],
        updated_at=user["updated_at"]
    )
    
    logger.info("User logged in successfully", user_id=str(user["id"]), email=user["email"])
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_response
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: TokenData = Depends(get_current_user)):
    """Get current authenticated user profile."""
    try:
        user_uuid = uuid.UUID(current_user.user_id)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã người dùng không hợp lệ"
        )
    
    async with PostgresQuery() as db:
        user = await db.fetchrow(
            """
            SELECT id, email, username, full_name, avatar_url,
                   role, is_active, email_verified, last_login, created_at, updated_at
            FROM users
            WHERE id = $1
            """,
            user_uuid
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Người dùng không tồn tại"
            )
        
        return UserResponse(
            id=str(user["id"]),
            email=user["email"],
            username=user["username"],
            full_name=user["full_name"],
            avatar_url=user["avatar_url"],
            role=user["role"],
            is_active=user["is_active"],
            email_verified=user["email_verified"],
            last_login=user["last_login"],
            created_at=user["created_at"],
            updated_at=user["updated_at"]
        )


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
