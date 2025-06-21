from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.collaboration import PromptSuggestionStatus, CollaborationType

# ========================================
# PROMPT SUGGESTION SCHEMAS
# ========================================

class PromptSuggestionCreate(BaseModel):
    suggested_prompt: str = Field(..., min_length=1, max_length=2000, description="The suggested prompt text")
    reasoning: Optional[str] = Field(None, max_length=1000, description="Why this suggestion would improve the conversation")
    original_message_id: Optional[int] = Field(None, description="ID of the message this suggestion is based on")
    target_position: Optional[int] = Field(None, ge=0, description="Position in conversation to insert (0 = beginning)")

class PromptSuggestionUpdate(BaseModel):
    status: Optional[PromptSuggestionStatus] = None

class PromptSuggestionResponse(BaseModel):
    id: int
    conversation_id: int
    suggester_id: int
    suggester_username: str
    suggester_display_name: str
    original_message_id: Optional[int]
    suggested_prompt: str
    reasoning: Optional[str]
    target_position: Optional[int]
    status: PromptSuggestionStatus
    votes_up: int
    votes_down: int
    score: int
    created_at: datetime
    updated_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PromptSuggestionVoteCreate(BaseModel):
    is_upvote: bool = Field(..., description="True for upvote, False for downvote")

# ========================================
# COLLABORATION SCHEMAS
# ========================================

class CollaborationInviteCreate(BaseModel):
    invitee_username: str = Field(..., min_length=1, max_length=50, description="Username of the user to invite")
    collaboration_type: CollaborationType = Field(..., description="Type of collaboration")
    permissions: str = Field(default="suggest", description="Permissions for the collaborator")
    message: Optional[str] = Field(None, max_length=500, description="Optional invitation message")

class CollaborationInviteResponse(BaseModel):
    id: int
    conversation_id: int
    conversation_title: Optional[str] = None
    inviter_username: str
    invitee_username: str
    collaboration_type: CollaborationType
    permissions: str
    message: Optional[str]
    is_accepted: Optional[bool]
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True

class ConversationCollaborationResponse(BaseModel):
    id: int
    conversation_id: int
    collaborator_id: int
    collaborator_username: str
    collaborator_display_name: str
    invited_by_id: int
    invited_by_username: str
    collaboration_type: CollaborationType
    permissions: str
    is_active: bool
    invitation_message: Optional[str]
    accepted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ========================================
# VERSION CONTROL SCHEMAS
# ========================================

class ConversationVersionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Updated conversation title")
    description: Optional[str] = Field(None, max_length=1000, description="Updated conversation description")
    change_description: Optional[str] = Field(None, max_length=500, description="What changed in this version")

class ConversationVersionResponse(BaseModel):
    id: int
    conversation_id: int
    editor_id: int
    editor_username: str
    version_number: int
    title: str
    description: Optional[str]
    change_description: Optional[str]
    is_current: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ========================================
# STATISTICS SCHEMAS
# ========================================

class CollaborationStatsResponse(BaseModel):
    conversation_id: int
    total_suggestions: int
    pending_suggestions: int
    accepted_suggestions: int
    rejected_suggestions: int
    integrated_suggestions: int
    active_collaborators: int
    total_votes: int

class UserCollaborationStatsResponse(BaseModel):
    user_id: int
    total_suggestions_made: int
    accepted_suggestions: int
    total_votes_received: int
    collaborations_count: int
    conversations_owned: int

# ========================================
# FEED AND DISCOVERY SCHEMAS
# ========================================

class CollaborationFeedItem(BaseModel):
    """Item in the collaboration activity feed."""
    id: int
    type: str  # 'suggestion_created', 'suggestion_accepted', 'collaboration_started', etc.
    conversation_id: int
    conversation_title: str
    user_id: int
    username: str
    display_name: str
    content: str  # Description of the activity
    created_at: datetime
    metadata: Optional[dict] = None  # Additional context data

class CollaborationFeedResponse(BaseModel):
    items: List[CollaborationFeedItem]
    total: int
    page: int
    per_page: int
    has_more: bool

# ========================================
# SEARCH AND FILTER SCHEMAS
# ========================================

class SuggestionSearchRequest(BaseModel):
    query: Optional[str] = Field(None, max_length=200, description="Search query for suggestions")
    status: Optional[PromptSuggestionStatus] = None
    conversation_ids: Optional[List[int]] = None
    suggester_ids: Optional[List[int]] = None
    min_score: Optional[int] = None
    limit: int = Field(default=20, le=100, ge=1)
    offset: int = Field(default=0, ge=0)

class SuggestionSearchResponse(BaseModel):
    suggestions: List[PromptSuggestionResponse]
    total: int
    page: int
    per_page: int
    has_more: bool

# ========================================
# NOTIFICATION SCHEMAS
# ========================================

class CollaborationNotificationCreate(BaseModel):
    user_id: int
    type: str  # 'collaboration_invite', 'suggestion_accepted', etc.
    title: str
    content: str
    related_conversation_id: Optional[int] = None
    related_user_id: Optional[int] = None

class CollaborationNotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    content: str
    related_conversation_id: Optional[int]
    related_user_id: Optional[int]
    created_at: datetime
    read_at: Optional[datetime]

    class Config:
        from_attributes = True

# ========================================
# BULK OPERATIONS SCHEMAS
# ========================================

class BulkSuggestionUpdate(BaseModel):
    suggestion_ids: List[int] = Field(..., min_items=1, max_items=50)
    status: PromptSuggestionStatus

class BulkCollaborationInvite(BaseModel):
    conversation_id: int
    invitee_usernames: List[str] = Field(..., min_items=1, max_items=10)
    collaboration_type: CollaborationType
    permissions: str = "suggest"
    message: Optional[str] = None

class BulkOperationResponse(BaseModel):
    success_count: int
    error_count: int
    errors: List[dict] = []  # List of error details

# ========================================
# ANALYTICS SCHEMAS
# ========================================

class CollaborationAnalytics(BaseModel):
    """Analytics data for collaboration features."""
    time_period: str  # 'day', 'week', 'month'
    suggestions_created: int
    suggestions_accepted: int
    suggestions_rejected: int
    new_collaborations: int
    active_collaborators: int
    top_contributors: List[dict]  # Top users by contribution
    popular_conversations: List[dict]  # Most collaborated conversations

class ConversationCollaborationHealth(BaseModel):
    """Health metrics for a conversation's collaboration."""
    conversation_id: int
    engagement_score: float  # 0-100 based on activity
    suggestion_acceptance_rate: float
    average_response_time_hours: float
    top_contributors: List[dict]
    recent_activity_count: int
    collaboration_trend: str  # 'increasing', 'stable', 'decreasing'