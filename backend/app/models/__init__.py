"""
Models package for VectorSpace backend.

This package contains all database models for the application.
"""

# Import core models (User, Conversation, etc.)
from .core import (
    User,
    Conversation,
    Message,
    PasswordResetToken,
    ConversationParticipant,
    Follow,
    SavedConversation,
    Collection,
    CollectionItem,
    HumanMessage,
    Collaborator,
    Notification
)

# Import collaboration models
from .collaboration import (
    PromptSuggestion,
    PromptSuggestionVote,
    ConversationCollaboration,
    ConversationVersion,
    CollaborationInvitation,
    PromptSuggestionStatus,
    CollaborationType
)

# Import discovery models
from .discovery import (
    TrendingPeriod,
    RecommendationType,
    ConversationMetrics,
    UserInteraction,
    TopicCluster,
    ConversationTopicAssignment,
    UserTopicPreference,
    RecommendationCache,
    TrendingSnapshot,
    PopularityDecay
)

__all__ = [
    # Core models
    'User',
    'Conversation',
    'Message',
    'PasswordResetToken',
    'ConversationParticipant',
    'Follow',
    'SavedConversation',
    'Collection',
    'CollectionItem',
    'HumanMessage',
    'Collaborator',
    'Notification',
    
    # Collaboration models
    'PromptSuggestion',
    'PromptSuggestionVote', 
    'ConversationCollaboration',
    'ConversationVersion',
    'CollaborationInvitation',
    'PromptSuggestionStatus',
    'CollaborationType',
    
    # Discovery models
    'TrendingPeriod',
    'RecommendationType',
    'ConversationMetrics',
    'UserInteraction',
    'TopicCluster',
    'ConversationTopicAssignment',
    'UserTopicPreference',
    'RecommendationCache',
    'TrendingSnapshot',
    'PopularityDecay'
]