from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class UserSignup(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Email is required for signup")
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    bio: Optional[str] = Field(None, max_length=200)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    email: str
    bio: Optional[str]
    conversation_count: int
    conversations_last_24h: int
    profile_image_url: Optional[str]
    stripe_pattern_seed: int
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, description="New password must be at least 8 characters")


class MessageResponse(BaseModel):
    message: str