from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models import User, PasswordResetToken
from app.schemas.auth import (
    UserSignup, UserLogin, Token, UserResponse, 
    PasswordResetRequest, PasswordReset, MessageResponse
)
from app.auth import create_access_token, get_current_user, blacklist_token, security

router = APIRouter()


@router.post("/signup", response_model=Token)
async def signup(user_data: UserSignup, db: AsyncSession = Depends(get_db)):
    """Create a new user account with email, display name, and username."""
    # Check if username already exists
    username_result = await db.execute(select(User).where(User.username == user_data.username))
    if username_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check if email already exists
    email_result = await db.execute(select(User).where(User.email == user_data.email))
    if email_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        username=user_data.username,
        display_name=user_data.display_name,
        email=user_data.email,
        bio=user_data.bio
    )
    user.set_password(user_data.password)
    
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError as e:
        await db.rollback()
        if "username" in str(e):
            detail = "Username already taken"
        elif "email" in str(e):
            detail = "Email already registered"
        else:
            detail = "User registration failed"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )
    
    # Create non-expiring access token
    access_token = create_access_token(data={"sub": user.username})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return access token."""
    # Find user
    result = await db.execute(select(User).where(User.username == user_data.username))
    user = result.scalar_one_or_none()
    
    # Verify credentials
    if not user or not user.verify_password(user_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Create non-expiring access token
    access_token = create_access_token(data={"sub": user.username})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return UserResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout user by blacklisting their JWT token."""
    blacklist_token(credentials.credentials)
    return MessageResponse(message="Successfully logged out")


@router.post("/password-reset-request", response_model=MessageResponse)
async def request_password_reset(
    request_data: PasswordResetRequest, 
    db: AsyncSession = Depends(get_db)
):
    """Request a password reset via email."""
    # Find user by email
    result = await db.execute(select(User).where(User.email == request_data.email))
    user = result.scalar_one_or_none()
    
    # Always return success to prevent email enumeration
    if not user:
        return MessageResponse(message="If the email exists, a reset link has been sent")
    
    # Create password reset token
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=PasswordResetToken.generate_secure_token()
    )
    
    db.add(reset_token)
    await db.commit()
    
    # TODO: Send email with reset link
    # For now, we'll just log the token (remove in production)
    print(f"Password reset token for {user.email}: {reset_token.token}")
    
    return MessageResponse(message="If the email exists, a reset link has been sent")


@router.post("/password-reset", response_model=MessageResponse)
async def reset_password(
    reset_data: PasswordReset,
    db: AsyncSession = Depends(get_db)
):
    """Reset user password using a valid reset token."""
    # Find valid reset token
    result = await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.token == reset_data.token)
    )
    reset_token = result.scalar_one_or_none()
    
    if not reset_token or not reset_token.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Get the user
    user_result = await db.execute(
        select(User).where(User.id == reset_token.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Update password and mark token as used
    user.set_password(reset_data.new_password)
    reset_token.mark_as_used()
    
    await db.commit()
    
    return MessageResponse(message="Password successfully updated")