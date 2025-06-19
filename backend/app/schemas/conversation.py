from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ConversationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    is_public: bool = True


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    from_user_id: Optional[int]
    from_user_username: Optional[str] = None
    from_user_display_name: Optional[str] = None
    role: str
    message_type: str
    content: str
    token_count: int
    parent_message_id: Optional[int]
    timestamp: datetime
    
    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    summary_public: Optional[str]
    token_count: int
    created_at: datetime
    last_message_at: datetime
    archived_at: Optional[datetime]
    is_public: bool
    is_hidden_from_profile: bool
    view_count: int
    
    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []
    participant_count: int = 0


class ParticipantResponse(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: str
    role: str
    joined_at: datetime
    last_seen_at: datetime
    
    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int
    page: int
    per_page: int
    has_next: bool


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    role: str = Field(default="user", pattern="^(user|assistant|system)$")
    message_type: str = Field(default="chat", pattern="^(chat|system|visitor_message)$")
    parent_message_id: Optional[int] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    is_public: Optional[bool] = None
    is_hidden_from_profile: Optional[bool] = None


class JoinConversationRequest(BaseModel):
    pass  # No additional fields needed - user comes from auth


class SuccessResponse(BaseModel):
    message: str
    conversation_id: Optional[int] = None