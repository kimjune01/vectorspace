from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import List
from app.models import Conversation, User
from app.services.summary_service import summary_service
import logging

logger = logging.getLogger(__name__)


class BackgroundTaskService:
    """Service for handling background tasks like auto-archiving and stats updates."""
    
    async def auto_archive_conversations(self, db: AsyncSession) -> int:
        """
        Auto-archive conversations that meet archiving criteria.
        
        Criteria:
        1. Token count >= 1500 tokens
        2. Inactive for 24+ hours
        3. Not already archived
        
        Returns:
            Number of conversations archived
        """
        archived_count = 0
        
        try:
            # Find conversations that should be auto-archived
            current_time = datetime.utcnow()
            cutoff_time = current_time - timedelta(hours=24)
            
            # Query for conversations that need archiving
            result = await db.execute(
                select(Conversation).where(
                    Conversation.archived_at.is_(None),  # Not already archived
                    Conversation.is_public == True,      # Only public conversations
                    (
                        (Conversation.token_count >= 1500) |  # High token count OR
                        (Conversation.last_message_at <= cutoff_time)  # Inactive for 24h
                    )
                )
            )
            
            conversations_to_archive = result.scalars().all()
            
            for conversation in conversations_to_archive:
                try:
                    # Generate summary if it doesn't exist
                    if not conversation.summary_raw:
                        await summary_service.force_generate_summary(conversation.id, db)
                    
                    # Archive the conversation
                    conversation.archive()
                    archived_count += 1
                    
                    logger.info(f"Auto-archived conversation {conversation.id}: "
                              f"tokens={conversation.token_count}, "
                              f"last_message={conversation.last_message_at}")
                
                except Exception as e:
                    logger.error(f"Error archiving conversation {conversation.id}: {e}")
                    continue
            
            # Commit all changes
            await db.commit()
            
            logger.info(f"Auto-archiving completed: {archived_count} conversations archived")
            return archived_count
            
        except Exception as e:
            logger.error(f"Error in auto-archiving process: {e}")
            await db.rollback()
            return 0
    
    async def update_user_stats(self, db: AsyncSession) -> int:
        """
        Update user statistics (conversations_last_24h).
        
        Returns:
            Number of users updated
        """
        updated_count = 0
        
        try:
            # Get all users
            users_result = await db.execute(select(User))
            users = users_result.scalars().all()
            
            current_time = datetime.utcnow()
            cutoff_time = current_time - timedelta(hours=24)
            
            for user in users:
                try:
                    # Count conversations in last 24 hours
                    recent_conversations_result = await db.execute(
                        select(Conversation).where(
                            Conversation.user_id == user.id,
                            Conversation.created_at >= cutoff_time
                        )
                    )
                    recent_count = len(recent_conversations_result.scalars().all())
                    
                    # Update user stats
                    user.conversations_last_24h = recent_count
                    updated_count += 1
                    
                except Exception as e:
                    logger.error(f"Error updating stats for user {user.id}: {e}")
                    continue
            
            await db.commit()
            
            logger.info(f"User stats update completed: {updated_count} users updated")
            return updated_count
            
        except Exception as e:
            logger.error(f"Error in user stats update: {e}")
            await db.rollback()
            return 0
    
    async def cleanup_old_password_reset_tokens(self, db: AsyncSession) -> int:
        """
        Clean up expired password reset tokens.
        
        Returns:
            Number of tokens cleaned up
        """
        try:
            from app.models import PasswordResetToken
            
            # Find expired tokens
            current_time = datetime.utcnow()
            
            expired_tokens_result = await db.execute(
                select(PasswordResetToken).where(
                    PasswordResetToken.expires_at <= current_time
                )
            )
            expired_tokens = expired_tokens_result.scalars().all()
            
            # Delete expired tokens
            for token in expired_tokens:
                await db.delete(token)
            
            await db.commit()
            
            cleanup_count = len(expired_tokens)
            logger.info(f"Cleaned up {cleanup_count} expired password reset tokens")
            return cleanup_count
            
        except Exception as e:
            logger.error(f"Error cleaning up password reset tokens: {e}")
            await db.rollback()
            return 0
    
    async def run_maintenance_tasks(self, db: AsyncSession) -> dict:
        """
        Run all maintenance tasks.
        
        Returns:
            Dictionary with results of each task
        """
        results = {}
        
        # Auto-archive conversations
        results['archived_conversations'] = await self.auto_archive_conversations(db)
        
        # Update user stats
        results['updated_user_stats'] = await self.update_user_stats(db)
        
        # Cleanup old tokens
        results['cleaned_tokens'] = await self.cleanup_old_password_reset_tokens(db)
        
        logger.info(f"Maintenance tasks completed: {results}")
        return results


# Global instance
background_task_service = BackgroundTaskService()


# FastAPI Background Task functions
async def schedule_auto_archive(db: AsyncSession):
    """Schedule auto-archiving as a background task."""
    await background_task_service.auto_archive_conversations(db)


async def schedule_user_stats_update(db: AsyncSession):
    """Schedule user stats update as a background task."""
    await background_task_service.update_user_stats(db)


async def schedule_maintenance(db: AsyncSession):
    """Schedule all maintenance tasks as a background task."""
    await background_task_service.run_maintenance_tasks(db)


def add_auto_archive_task(background_tasks: BackgroundTasks, db: AsyncSession):
    """Add auto-archiving task to FastAPI background tasks."""
    background_tasks.add_task(schedule_auto_archive, db)


def add_user_stats_task(background_tasks: BackgroundTasks, db: AsyncSession):
    """Add user stats update task to FastAPI background tasks."""
    background_tasks.add_task(schedule_user_stats_update, db)


def add_maintenance_task(background_tasks: BackgroundTasks, db: AsyncSession):
    """Add all maintenance tasks to FastAPI background tasks."""
    background_tasks.add_task(schedule_maintenance, db)