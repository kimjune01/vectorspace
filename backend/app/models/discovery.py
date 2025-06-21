from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from datetime import datetime, timedelta
import enum

class TrendingPeriod(str, enum.Enum):
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"

class RecommendationType(str, enum.Enum):
    SIMILAR_CONTENT = "similar_content"
    USER_BEHAVIOR = "user_behavior"
    TRENDING = "trending"
    COLLABORATIVE_FILTERING = "collaborative_filtering"
    TOPIC_BASED = "topic_based"

class ConversationMetrics(Base):
    """Real-time metrics for conversations to drive recommendations."""
    __tablename__ = "conversation_metrics"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, unique=True, index=True)
    
    # Engagement metrics
    view_count = Column(Integer, default=0, nullable=False)
    view_count_24h = Column(Integer, default=0, nullable=False)
    view_count_7d = Column(Integer, default=0, nullable=False)
    
    # Social metrics
    save_count = Column(Integer, default=0, nullable=False)
    save_count_24h = Column(Integer, default=0, nullable=False)
    share_count = Column(Integer, default=0, nullable=False)
    
    # Collaboration metrics
    suggestion_count = Column(Integer, default=0, nullable=False)
    collaborator_count = Column(Integer, default=0, nullable=False)
    vote_count = Column(Integer, default=0, nullable=False)
    
    # Human chat metrics
    human_message_count = Column(Integer, default=0, nullable=False)
    human_message_count_24h = Column(Integer, default=0, nullable=False)
    active_chatters_count = Column(Integer, default=0, nullable=False)
    
    # Quality metrics
    avg_session_duration = Column(Float, default=0.0, nullable=False)  # Average time spent viewing
    bounce_rate = Column(Float, default=0.0, nullable=False)  # Percentage of quick exits
    engagement_score = Column(Float, default=0.0, nullable=False)  # Computed engagement score
    
    # Trending scores
    trending_score_1h = Column(Float, default=0.0, nullable=False)
    trending_score_24h = Column(Float, default=0.0, nullable=False)
    trending_score_7d = Column(Float, default=0.0, nullable=False)
    
    # Timestamps
    last_view_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    conversation = relationship("Conversation")
    
    def calculate_engagement_score(self) -> float:
        """Calculate overall engagement score based on multiple factors."""
        # Weight different metrics
        view_weight = 1.0
        save_weight = 5.0
        suggestion_weight = 3.0
        chat_weight = 2.0
        
        # Recent activity gets higher weight
        recent_view_bonus = self.view_count_24h * 2.0
        recent_chat_bonus = self.human_message_count_24h * 3.0
        
        score = (
            (self.view_count * view_weight) +
            (self.save_count * save_weight) +
            (self.suggestion_count * suggestion_weight) +
            (self.human_message_count * chat_weight) +
            recent_view_bonus +
            recent_chat_bonus
        )
        
        # Apply quality modifiers
        if self.avg_session_duration > 60:  # Over 1 minute
            score *= 1.2
        if self.bounce_rate < 0.3:  # Low bounce rate
            score *= 1.1
        
        return score
    
    def update_trending_scores(self):
        """Update trending scores for different time periods."""
        now = datetime.utcnow()
        
        # 1-hour trending (high weight on very recent activity)
        self.trending_score_1h = (
            (self.view_count_24h * 2.0) +
            (self.save_count_24h * 10.0) +
            (self.human_message_count_24h * 5.0) +
            (self.suggestion_count * 3.0)
        )
        
        # 24-hour trending (balanced recent activity)
        self.trending_score_24h = (
            (self.view_count_24h * 1.5) +
            (self.save_count * 8.0) +
            (self.human_message_count_24h * 4.0) +
            (self.collaborator_count * 6.0)
        )
        
        # 7-day trending (sustained engagement)
        self.trending_score_7d = (
            (self.view_count_7d * 1.0) +
            (self.save_count * 6.0) +
            (self.human_message_count * 2.0) +
            (self.engagement_score * 0.5)
        )
        
        self.engagement_score = self.calculate_engagement_score()

class UserInteraction(Base):
    """Track user interactions for personalized recommendations."""
    __tablename__ = "user_interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    
    # Interaction types
    interaction_type = Column(String(50), nullable=False)  # view, save, share, suggest, chat
    interaction_strength = Column(Float, default=1.0, nullable=False)  # Weight of the interaction
    
    # Session data
    session_duration = Column(Integer, nullable=True)  # Duration in seconds
    page_depth = Column(Integer, default=1, nullable=False)  # How deep they went
    referrer_source = Column(String(100), nullable=True)  # How they found it
    
    # Context
    interaction_context = Column(JSON, default=dict)  # Additional context data
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User")
    conversation = relationship("Conversation")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_user_interaction_type', 'user_id', 'interaction_type'),
        Index('idx_conversation_interaction', 'conversation_id', 'interaction_type'),
        Index('idx_user_interaction_time', 'user_id', 'created_at'),
    )

class TopicCluster(Base):
    """Topic clusters for content-based recommendations."""
    __tablename__ = "topic_clusters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # Cluster characteristics
    keywords = Column(JSON, default=list)  # Key terms defining this cluster
    embedding_centroid = Column(JSON, default=list)  # Vector representation of cluster center
    cluster_size = Column(Integer, default=0, nullable=False)  # Number of conversations
    
    # Metrics
    engagement_score = Column(Float, default=0.0, nullable=False)
    trending_score = Column(Float, default=0.0, nullable=False)
    quality_score = Column(Float, default=0.0, nullable=False)
    
    # Auto-generated or manual
    is_auto_generated = Column(Boolean, default=True, nullable=False)
    confidence_score = Column(Float, default=0.0, nullable=False)  # How confident we are in this cluster
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_reclustered_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    conversations = relationship("ConversationTopicAssignment", back_populates="topic_cluster")

class ConversationTopicAssignment(Base):
    """Many-to-many relationship between conversations and topic clusters."""
    __tablename__ = "conversation_topic_assignments"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    topic_cluster_id = Column(Integer, ForeignKey("topic_clusters.id"), nullable=False, index=True)
    
    # Assignment strength and confidence
    relevance_score = Column(Float, nullable=False)  # How relevant is this topic to the conversation
    confidence_score = Column(Float, nullable=False)  # How confident are we in this assignment
    
    # Assignment method
    assignment_method = Column(String(50), nullable=False)  # "embedding", "keyword", "manual"
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # If manually assigned
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    conversation = relationship("Conversation")
    topic_cluster = relationship("TopicCluster", back_populates="conversations")
    assigned_by = relationship("User", foreign_keys=[assigned_by_user_id])

class UserTopicPreference(Base):
    """Track user preferences for different topics to improve recommendations."""
    __tablename__ = "user_topic_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic_cluster_id = Column(Integer, ForeignKey("topic_clusters.id"), nullable=False, index=True)
    
    # Preference strength (can be negative for dislikes)
    preference_score = Column(Float, default=0.0, nullable=False)
    
    # How we determined this preference
    preference_source = Column(String(50), nullable=False)  # "implicit", "explicit", "behavioral"
    interaction_count = Column(Integer, default=0, nullable=False)  # Number of interactions with this topic
    
    # Confidence in this preference
    confidence_score = Column(Float, default=0.0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_interaction_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User")
    topic_cluster = relationship("TopicCluster")
    
    # Ensure one preference per user per topic
    __table_args__ = (
        Index('idx_user_topic_unique', 'user_id', 'topic_cluster_id', unique=True),
    )

class RecommendationCache(Base):
    """Cache computed recommendations for performance."""
    __tablename__ = "recommendation_cache"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recommendation_type = Column(String(50), nullable=False, index=True)
    
    # Cached recommendations (conversation IDs with scores)
    recommendations = Column(JSON, nullable=False)  # [{"conversation_id": 123, "score": 0.95, "reason": "..."}]
    
    # Cache metadata
    cache_key = Column(String(255), nullable=False, index=True)  # For cache invalidation
    parameters = Column(JSON, default=dict)  # Parameters used to generate recommendations
    
    # Cache validity
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_valid = Column(Boolean, default=True, nullable=False)
    
    # Performance metrics
    generation_time_ms = Column(Integer, nullable=True)  # How long it took to generate
    hit_count = Column(Integer, default=0, nullable=False)  # How many times this cache was used
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User")
    
    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        return datetime.utcnow() > self.expires_at
    
    def update_access(self):
        """Update access tracking."""
        self.hit_count += 1
        self.last_accessed_at = datetime.utcnow()

class TrendingSnapshot(Base):
    """Periodic snapshots of trending conversations."""
    __tablename__ = "trending_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    period = Column(String(20), nullable=False, index=True)  # "hour", "day", "week"
    snapshot_time = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Trending data
    trending_conversations = Column(JSON, nullable=False)  # List of conversation IDs with scores
    total_conversations = Column(Integer, nullable=False)
    total_activity = Column(Integer, nullable=False)
    
    # Metadata
    algorithm_version = Column(String(50), nullable=False)
    parameters = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    @staticmethod
    def get_latest_for_period(db, period: TrendingPeriod):
        """Get the most recent trending snapshot for a period."""
        return db.query(TrendingSnapshot)\
                .filter(TrendingSnapshot.period == period.value)\
                .order_by(TrendingSnapshot.snapshot_time.desc())\
                .first()

class PopularityDecay(Base):
    """Track popularity decay curves for different content types."""
    __tablename__ = "popularity_decay"

    id = Column(Integer, primary_key=True, index=True)
    content_type = Column(String(50), nullable=False, index=True)  # "conversation", "topic", etc.
    content_id = Column(Integer, nullable=False, index=True)
    
    # Decay parameters
    initial_score = Column(Float, nullable=False)
    current_score = Column(Float, nullable=False)
    decay_rate = Column(Float, nullable=False)  # How fast popularity decays
    half_life_hours = Column(Float, nullable=False)  # Hours for score to halve
    
    # Timestamps
    peak_time = Column(DateTime(timezone=True), nullable=False)  # When this content peaked
    last_calculated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    def calculate_current_score(self) -> float:
        """Calculate current popularity score based on decay."""
        now = datetime.utcnow()
        hours_since_peak = (now - self.peak_time).total_seconds() / 3600
        
        # Exponential decay: score = initial * (0.5) ^ (hours / half_life)
        decay_factor = 0.5 ** (hours_since_peak / self.half_life_hours)
        return self.initial_score * decay_factor