"""
User-related schemas and response models.
Centralizes user data structures for better maintainability.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UserProfileResponse(BaseModel):
    """Response model for user profile."""
    username: str
    display_name: str
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_image_data: Optional[str] = None  # Base64 encoded thumbnail
    stripe_pattern_seed: int
    conversation_count: int
    conversations_last_24h: int
    created_at: str
    recent_conversations: List[dict]


class UpdateProfileRequest(BaseModel):
    """Request model for updating user profile."""
    bio: Optional[str] = None
    display_name: Optional[str] = None


class UserSummary(BaseModel):
    """Lightweight user summary for lists and references."""
    id: int
    username: str
    display_name: str
    profile_image_data: Optional[str] = None
    stripe_pattern_seed: int


class UserStats(BaseModel):
    """User statistics and metrics."""
    conversation_count: int
    conversations_last_24h: int
    follower_count: Optional[int] = None
    following_count: Optional[int] = None
    created_at: datetime