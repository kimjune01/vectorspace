"""
User service layer - Business logic for user operations.
Separates business logic from HTTP concerns in routes.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import base64
import logging

from app.models import User, Conversation, Follow
from app.schemas.user import UserProfileResponse, UserStats, UserSummary

logger = logging.getLogger(__name__)


class UserService:
    """Service class for user-related business logic."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_user_profile(
        self, 
        username: str, 
        requesting_user: Optional[User] = None
    ) -> Optional[UserProfileResponse]:
        """
        Get comprehensive user profile with stats and recent conversations.
        
        Args:
            username: Username to get profile for
            requesting_user: User making the request (for permission checks)
            
        Returns:
            UserProfileResponse if user found, None otherwise
        """
        user = await self.get_user_by_username(username)
        if not user:
            return None
        
        # Get user statistics
        stats = await self._get_user_stats(user.id)
        
        # Get recent conversations (respecting privacy settings)
        recent_conversations = await self._get_recent_conversations(
            user.id, 
            requesting_user
        )
        
        return UserProfileResponse(
            username=user.username,
            display_name=user.display_name,
            bio=user.bio,
            profile_image_url=None,  # Legacy field
            profile_image_data=user.profile_image_data,
            stripe_pattern_seed=user.stripe_pattern_seed,
            conversation_count=stats.conversation_count,
            conversations_last_24h=stats.conversations_last_24h,
            created_at=user.created_at.isoformat(),
            recent_conversations=recent_conversations
        )
    
    async def update_profile(
        self,
        user: User,
        bio: Optional[str] = None,
        display_name: Optional[str] = None
    ) -> User:
        """Update user profile fields."""
        if bio is not None:
            user.bio = bio
        if display_name is not None:
            user.display_name = display_name
        
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def update_profile_image(
        self,
        user: User,
        image_data: bytes,
        max_size: int = 150
    ) -> User:
        """
        Update user profile image with automatic resizing.
        
        Args:
            user: User to update
            image_data: Raw image bytes
            max_size: Maximum image dimension in pixels
            
        Returns:
            Updated user object
        """
        try:
            from PIL import Image
            import io
            
            # Process image
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB')
            
            # Resize maintaining aspect ratio
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Save as JPEG
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=85, optimize=True)
            processed_data = output.getvalue()
            
            # Encode as base64
            base64_data = base64.b64encode(processed_data).decode('utf-8')
            user.profile_image_data = f"data:image/jpeg;base64,{base64_data}"
            
            await self.db.commit()
            await self.db.refresh(user)
            
            logger.info(f"Updated profile image for user {user.username}")
            return user
            
        except Exception as e:
            logger.error(f"Failed to process profile image for user {user.username}: {e}")
            raise ValueError("Invalid image format or processing failed")
    
    async def _get_user_stats(self, user_id: int) -> UserStats:
        """Get user statistics."""
        # Total conversation count
        total_count_result = await self.db.execute(
            select(func.count(Conversation.id))
            .where(Conversation.user_id == user_id)
        )
        total_count = total_count_result.scalar() or 0
        
        # Conversations in last 24 hours
        yesterday = datetime.now() - timedelta(days=1)
        recent_count_result = await self.db.execute(
            select(func.count(Conversation.id))
            .where(
                Conversation.user_id == user_id,
                Conversation.created_at >= yesterday
            )
        )
        recent_count = recent_count_result.scalar() or 0
        
        # Get user creation date
        user_result = await self.db.execute(
            select(User.created_at).where(User.id == user_id)
        )
        created_at = user_result.scalar() or datetime.now()
        
        return UserStats(
            conversation_count=total_count,
            conversations_last_24h=recent_count,
            created_at=created_at
        )
    
    async def _get_recent_conversations(
        self,
        user_id: int,
        requesting_user: Optional[User],
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent conversations for user profile."""
        query = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .where(Conversation.archived_at.is_(None))
        )
        
        # Apply privacy filters
        if requesting_user is None or requesting_user.id != user_id:
            # Public conversations only for non-owners
            query = query.where(
                Conversation.is_public == True,
                Conversation.is_hidden_from_profile == False
            )
        
        query = query.order_by(desc(Conversation.created_at)).limit(limit)
        
        result = await self.db.execute(query)
        conversations = result.scalars().all()
        
        return [
            {
                "id": conv.id,
                "title": conv.title,
                "summary": conv.summary_public,
                "created_at": conv.created_at.isoformat(),
                "view_count": conv.view_count,
                "token_count": conv.token_count
            }
            for conv in conversations
        ]