"""
Pydantic schemas for social features API.
"""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# ========================================
# FOLLOW SYSTEM SCHEMAS
# ========================================

class FollowCreate(BaseModel):
    """Schema for creating a follow relationship."""
    following_id: int


class FollowResponse(BaseModel):
    """Schema for follow relationship response."""
    id: int
    follower_id: int
    following_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserFollowStats(BaseModel):
    """Schema for user's follow statistics."""
    followers_count: int
    following_count: int


class FollowerResponse(BaseModel):
    """Schema for follower/following user response."""
    id: int
    username: str
    display_name: str
    bio: Optional[str]
    profile_image_data: Optional[str]
    stripe_pattern_seed: int
    followed_at: datetime
    
    class Config:
        from_attributes = True


# ========================================
# CURATION SCHEMAS
# ========================================

class SaveConversationRequest(BaseModel):
    """Schema for saving a conversation."""
    tags: Optional[List[str]] = []
    personal_note: Optional[str] = None


class SavedConversationResponse(BaseModel):
    """Schema for saved conversation response."""
    id: int
    user_id: int
    conversation_id: int
    saved_at: datetime
    tags: List[str]
    personal_note: Optional[str]
    # Include conversation details
    conversation_title: str
    conversation_summary: Optional[str]
    conversation_author: str
    
    class Config:
        from_attributes = True


class UpdateSavedConversationRequest(BaseModel):
    """Schema for updating saved conversation tags/notes."""
    tags: Optional[List[str]] = None
    personal_note: Optional[str] = None


class CollectionCreate(BaseModel):
    """Schema for creating a collection."""
    name: str
    description: Optional[str] = None
    is_public: bool = True
    conversation_ids: List[int] = []


class CollectionUpdate(BaseModel):
    """Schema for updating a collection."""
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


class CollectionResponse(BaseModel):
    """Schema for collection response."""
    id: int
    user_id: int
    name: str
    description: Optional[str]
    is_public: bool
    created_at: datetime
    updated_at: datetime
    items_count: int
    
    class Config:
        from_attributes = True


class CollectionWithItemsResponse(BaseModel):
    """Schema for collection with its items."""
    id: int
    user_id: int
    name: str
    description: Optional[str]
    is_public: bool
    created_at: datetime
    updated_at: datetime
    items: List[SavedConversationResponse]
    
    class Config:
        from_attributes = True


class AddToCollectionRequest(BaseModel):
    """Schema for adding conversations to a collection."""
    conversation_ids: List[int]


# ========================================
# HUMAN CHAT SCHEMAS
# ========================================

class HumanMessageCreate(BaseModel):
    """Schema for creating a human chat message."""
    content: str


class HumanMessageResponse(BaseModel):
    """Schema for human chat message response."""
    id: int
    conversation_id: int
    user_id: int
    content: str
    sent_at: datetime
    expires_at: datetime
    # Include user details
    user_username: str
    user_display_name: str
    user_profile_image_data: Optional[str]
    
    class Config:
        from_attributes = True


class HumanChatRoomInfo(BaseModel):
    """Schema for human chat room information."""
    conversation_id: int
    online_users: List[int]  # User IDs currently online
    can_chat: bool  # Whether current user can send messages
    recent_messages: List[HumanMessageResponse]


# ========================================
# COLLABORATION SCHEMAS
# ========================================

class CollaborationInvite(BaseModel):
    """Schema for inviting collaborators."""
    user_ids: List[int]
    message: Optional[str] = None


class CollaboratorResponse(BaseModel):
    """Schema for collaborator response."""
    id: int
    conversation_id: int
    user_id: int
    invited_by_id: int
    invited_at: datetime
    accepted_at: Optional[datetime]
    left_at: Optional[datetime]
    can_suggest_prompts: bool
    # Include user details
    user_username: str
    user_display_name: str
    user_profile_image_data: Optional[str]
    
    class Config:
        from_attributes = True


class CollaborationInviteResponse(BaseModel):
    """Schema for collaboration invitation response."""
    id: int
    conversation_id: int
    conversation_title: str
    conversation_author: str
    invited_by_username: str
    invited_by_display_name: str
    invited_at: datetime
    message: Optional[str]
    
    class Config:
        from_attributes = True


class PromptSuggestion(BaseModel):
    """Schema for suggesting prompts to conversation owner."""
    suggested_prompt: str
    context_note: Optional[str] = None


class AcceptCollaborationRequest(BaseModel):
    """Schema for accepting collaboration invitation."""
    accept: bool = True


# ========================================
# NOTIFICATION SCHEMAS
# ========================================

class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: int
    user_id: int
    type: str
    title: str
    content: str
    related_user_id: Optional[int]
    related_conversation_id: Optional[int]
    topic_tags: List[str]
    created_at: datetime
    read_at: Optional[datetime]
    # Include related user/conversation details
    related_user_username: Optional[str]
    related_user_display_name: Optional[str]
    related_conversation_title: Optional[str]
    
    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    """Schema for updating notification (mark as read)."""
    read: bool = True


# ========================================
# DISCOVERY SCHEMAS
# ========================================

class DiscoverPeopleResponse(BaseModel):
    """Schema for people discovery response."""
    id: int
    username: str
    display_name: str
    bio: Optional[str]
    profile_image_data: Optional[str]
    stripe_pattern_seed: int
    common_topics: List[str]
    recent_conversations_count: int
    is_following: bool
    
    class Config:
        from_attributes = True


class FollowingActivityResponse(BaseModel):
    """Schema for following activity feed."""
    type: str  # 'new_conversation', 'saved_conversation'
    user_id: int
    user_username: str
    user_display_name: str
    conversation_id: Optional[int]
    conversation_title: Optional[str]
    activity_at: datetime
    
    class Config:
        from_attributes = True


# ========================================
# PAGINATION SCHEMAS
# ========================================

class PaginatedFollowersResponse(BaseModel):
    """Schema for paginated followers response."""
    followers: List[FollowerResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool


class PaginatedFollowingResponse(BaseModel):
    """Schema for paginated following response."""
    following: List[FollowerResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool


class PaginatedSavedConversationsResponse(BaseModel):
    """Schema for paginated saved conversations response."""
    saved_conversations: List[SavedConversationResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool


class PaginatedCollectionsResponse(BaseModel):
    """Schema for paginated collections response."""
    collections: List[CollectionResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool


class PaginatedNotificationsResponse(BaseModel):
    """Schema for paginated notifications response."""
    notifications: List[NotificationResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool
    unread_count: int