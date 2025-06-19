from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from passlib.context import CryptContext
from app.database import Base
import random
import secrets

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(Base):
    """User model with public profile support."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    bio = Column(String(200), nullable=True)
    profile_image_url = Column(String(500), nullable=True)
    profile_image_data = Column(Text, nullable=True)  # Base64 encoded thumbnail
    stripe_pattern_seed = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    conversation_count = Column(Integer, default=0)
    conversations_last_24h = Column(Integer, default=0)
    
    # Relationships
    conversations = relationship("Conversation", back_populates="user")
    
    def __init__(self, **kwargs):
        """Initialize user with auto-generated stripe pattern seed."""
        if 'stripe_pattern_seed' not in kwargs:
            kwargs['stripe_pattern_seed'] = random.randint(1000000, 9999999)
        super().__init__(**kwargs)
    
    def set_password(self, password: str):
        """Hash and set the user's password."""
        self.password_hash = pwd_context.hash(password)
    
    def verify_password(self, password: str) -> bool:
        """Verify a password against the hash."""
        return pwd_context.verify(password, self.password_hash)


class Conversation(Base):
    """Conversation model with privacy and summarization."""
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    summary_raw = Column(Text, nullable=True)  # Original summary with PII
    summary_public = Column(Text, nullable=True)  # Filtered summary
    token_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_at = Column(DateTime(timezone=True), server_default=func.now())
    archived_at = Column(DateTime(timezone=True), nullable=True)
    is_public = Column(Boolean, default=True)
    is_hidden_from_profile = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")
    participants = relationship("ConversationParticipant", back_populates="conversation")
    
    def archive(self):
        """Archive this conversation."""
        if not self.archived_at:
            self.archived_at = datetime.utcnow()
    
    def is_archived(self) -> bool:
        """Check if conversation is archived."""
        return self.archived_at is not None
    
    def hide_from_profile(self):
        """Hide this conversation from user's profile."""
        self.is_hidden_from_profile = True
    
    def show_on_profile(self):
        """Show this conversation on user's profile."""
        self.is_hidden_from_profile = False
    
    def should_auto_archive(self) -> bool:
        """Check if conversation should be auto-archived based on token count."""
        return self.token_count >= 1500
    
    def is_inactive_for_24h(self) -> bool:
        """Check if conversation has been inactive for 24+ hours."""
        if not self.last_message_at:
            return False
        from datetime import timedelta
        return datetime.utcnow() - self.last_message_at > timedelta(hours=24)
    
    def update_last_message_time(self):
        """Update the last message timestamp to now."""
        self.last_message_at = datetime.utcnow()
    
    def update_token_count(self):
        """Recalculate total token count from all messages."""
        if hasattr(self, 'messages') and self.messages:
            self.token_count = sum(msg.token_count for msg in self.messages)
        else:
            # If messages aren't loaded, we'll need to query them
            # This will be handled in the service layer
            pass


class Message(Base):
    """Individual messages within a conversation."""
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # NULL for AI messages
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    message_type = Column(String(20), default="chat")  # "chat", "system", "visitor_message"
    content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    parent_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)  # For threading
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    from_user = relationship("User", foreign_keys=[from_user_id])
    parent_message = relationship("Message", remote_side=[id])
    replies = relationship("Message", back_populates="parent_message")
    
    def __init__(self, **kwargs):
        """Initialize message with automatic token counting."""
        if 'content' in kwargs and 'token_count' not in kwargs:
            kwargs['token_count'] = self.estimate_token_count(kwargs['content'])
        super().__init__(**kwargs)
    
    @staticmethod
    def estimate_token_count(text: str) -> int:
        """Estimate token count using character approximation.
        
        Approximation: ~4 characters per token (GPT-style tokenization)
        This is a reasonable estimate for English text.
        """
        if not text:
            return 0
        # Remove extra whitespace and count characters
        cleaned_text = ' '.join(text.split())
        return max(1, len(cleaned_text) // 4)
    
    def update_token_count(self):
        """Recalculate and update token count based on current content."""
        self.token_count = self.estimate_token_count(self.content)
    
    def is_from_ai(self) -> bool:
        """Check if message is from AI (no from_user_id)."""
        return self.from_user_id is None and self.role == "assistant"
    
    def is_from_user(self) -> bool:
        """Check if message is from a user."""
        return self.from_user_id is not None and self.role == "user"
    
    def is_system_message(self) -> bool:
        """Check if message is a system message."""
        return self.role == "system"
    
    def is_visitor_message(self) -> bool:
        """Check if message is from a visitor to the conversation owner."""
        return self.message_type == "visitor_message"
    
    def add_reply(self, reply_content: str, from_user_id: int = None, role: str = "user") -> "Message":
        """Add a reply to this message (threading)."""
        reply = Message(
            conversation_id=self.conversation_id,
            from_user_id=from_user_id,
            role=role,
            content=reply_content,
            parent_message_id=self.id,
            message_type="chat"
        )
        return reply


class PasswordResetToken(Base):
    """Password reset tokens for secure password recovery."""
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User")
    
    def __init__(self, **kwargs):
        """Initialize token with 1-hour expiration if not provided."""
        if 'expires_at' not in kwargs:
            kwargs['expires_at'] = datetime.utcnow() + timedelta(hours=1)
        super().__init__(**kwargs)
    
    def is_expired(self) -> bool:
        """Check if the token has expired."""
        return datetime.utcnow() > self.expires_at
    
    def is_used(self) -> bool:
        """Check if the token has been used."""
        return self.used_at is not None
    
    def is_valid(self) -> bool:
        """Check if the token is valid (not expired and not used)."""
        return not self.is_expired() and not self.is_used()
    
    def mark_as_used(self):
        """Mark the token as used."""
        self.used_at = datetime.utcnow()
    
    @staticmethod
    def generate_secure_token() -> str:
        """Generate a cryptographically secure random token."""
        return secrets.token_urlsafe(32)


class ConversationParticipant(Base):
    """Participants in conversations for user-to-user messaging."""
    __tablename__ = "conversation_participants"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), default="visitor")  # "owner", "visitor"
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")
    
    def update_last_seen(self):
        """Update the last seen timestamp to now."""
        self.last_seen_at = datetime.utcnow()
    
    def is_owner(self) -> bool:
        """Check if participant is the conversation owner."""
        return self.role == "owner"
    
    def is_visitor(self) -> bool:
        """Check if participant is a visitor."""
        return self.role == "visitor"