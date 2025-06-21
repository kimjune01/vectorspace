from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class PromptSuggestionStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted" 
    REJECTED = "rejected"
    INTEGRATED = "integrated"

class CollaborationType(str, enum.Enum):
    PROMPT_SUGGESTION = "prompt_suggestion"
    CONVERSATION_EDIT = "conversation_edit"
    CO_CREATION = "co_creation"

class PromptSuggestion(Base):
    """User-submitted suggestions for improving conversation prompts."""
    __tablename__ = "prompt_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    suggester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True, index=True)
    
    # Suggestion content
    suggested_prompt = Column(Text, nullable=False)
    reasoning = Column(Text, nullable=True)  # Why this suggestion would improve the conversation
    target_position = Column(Integer, nullable=True)  # Where in conversation to insert (0 = beginning)
    
    # Status and metadata
    status = Column(SQLEnum(PromptSuggestionStatus), default=PromptSuggestionStatus.PENDING, nullable=False)
    votes_up = Column(Integer, default=0, nullable=False)
    votes_down = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="prompt_suggestions")
    suggester = relationship("User", foreign_keys=[suggester_id], back_populates="prompt_suggestions")
    original_message = relationship("Message", foreign_keys=[original_message_id])
    votes = relationship("PromptSuggestionVote", back_populates="suggestion", cascade="all, delete-orphan")
    
    def calculate_score(self) -> int:
        """Calculate suggestion score based on votes."""
        return self.votes_up - self.votes_down
    
    def update_vote_counts(self):
        """Update vote counts from related votes."""
        up_votes = sum(1 for vote in self.votes if vote.is_upvote)
        down_votes = sum(1 for vote in self.votes if not vote.is_upvote)
        self.votes_up = up_votes
        self.votes_down = down_votes

class PromptSuggestionVote(Base):
    """Votes on prompt suggestions."""
    __tablename__ = "prompt_suggestion_votes"

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(Integer, ForeignKey("prompt_suggestions.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    is_upvote = Column(Boolean, nullable=False)  # True for upvote, False for downvote
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    suggestion = relationship("PromptSuggestion", back_populates="votes")
    user = relationship("User", foreign_keys=[user_id])
    
    # Ensure one vote per user per suggestion
    __table_args__ = (
        {"sqlite_autoincrement": True},
    )

class ConversationCollaboration(Base):
    """Tracks collaborative relationships between users and conversations."""
    __tablename__ = "conversation_collaborations"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    collaborator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    invited_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Collaboration details
    collaboration_type = Column(SQLEnum(CollaborationType), nullable=False)
    permissions = Column(String(255), nullable=False, default="suggest")  # suggest, edit, co_create
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Invitation metadata
    invitation_message = Column(Text, nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="collaborations")
    collaborator = relationship("User", foreign_keys=[collaborator_id], back_populates="collaborations")
    invited_by = relationship("User", foreign_keys=[invited_by_id])
    
    def is_accepted(self) -> bool:
        """Check if collaboration invitation has been accepted."""
        return self.accepted_at is not None
    
    def can_suggest(self) -> bool:
        """Check if collaborator can make suggestions."""
        return self.is_active and "suggest" in self.permissions
    
    def can_edit(self) -> bool:
        """Check if collaborator can edit content."""
        return self.is_active and "edit" in self.permissions
    
    def can_co_create(self) -> bool:
        """Check if collaborator can co-create."""
        return self.is_active and "co_create" in self.permissions

class ConversationVersion(Base):
    """Version history for collaborative conversation editing."""
    __tablename__ = "conversation_versions"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    editor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Version content
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    change_description = Column(Text, nullable=True)  # What changed in this version
    
    # Metadata
    is_current = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="versions")
    editor = relationship("User", foreign_keys=[editor_id])

class CollaborationInvitation(Base):
    """Invitations to collaborate on conversations."""
    __tablename__ = "collaboration_invitations"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    invitee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Invitation details
    collaboration_type = Column(SQLEnum(CollaborationType), nullable=False)
    permissions = Column(String(255), nullable=False, default="suggest")
    message = Column(Text, nullable=True)
    
    # Status
    is_accepted = Column(Boolean, nullable=True)  # None = pending, True = accepted, False = rejected
    responded_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    conversation = relationship("Conversation")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])
    
    def is_pending(self) -> bool:
        """Check if invitation is still pending."""
        return self.is_accepted is None and (
            self.expires_at is None or self.expires_at > func.now()
        )
    
    def is_expired(self) -> bool:
        """Check if invitation has expired."""
        return self.expires_at is not None and self.expires_at <= func.now()