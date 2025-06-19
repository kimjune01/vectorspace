from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.services.background_tasks import (
    background_task_service,
    add_auto_archive_task,
    add_user_stats_task, 
    add_maintenance_task
)
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/maintenance/auto-archive")
async def trigger_auto_archive(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger auto-archiving of conversations that meet criteria.
    
    - Conversations with 1500+ tokens
    - Conversations inactive for 24+ hours
    """
    try:
        # Add background task
        add_auto_archive_task(background_tasks, db)
        
        logger.info(f"Auto-archive task triggered by user {current_user.username}")
        
        return {
            "message": "Auto-archiving task scheduled",
            "status": "scheduled",
            "triggered_by": current_user.username
        }
        
    except Exception as e:
        logger.error(f"Error triggering auto-archive: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule auto-archive task")


@router.post("/maintenance/update-stats")
async def trigger_user_stats_update(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger user statistics update (conversations_last_24h).
    """
    try:
        # Add background task
        add_user_stats_task(background_tasks, db)
        
        logger.info(f"User stats update triggered by user {current_user.username}")
        
        return {
            "message": "User stats update task scheduled",
            "status": "scheduled", 
            "triggered_by": current_user.username
        }
        
    except Exception as e:
        logger.error(f"Error triggering user stats update: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule user stats update")


@router.post("/maintenance/full")
async def trigger_full_maintenance(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger all maintenance tasks:
    - Auto-archive conversations
    - Update user statistics  
    - Clean up expired tokens
    """
    try:
        # Add background task
        add_maintenance_task(background_tasks, db)
        
        logger.info(f"Full maintenance triggered by user {current_user.username}")
        
        return {
            "message": "Full maintenance task scheduled",
            "status": "scheduled",
            "tasks": [
                "auto_archive_conversations",
                "update_user_stats", 
                "cleanup_expired_tokens"
            ],
            "triggered_by": current_user.username
        }
        
    except Exception as e:
        logger.error(f"Error triggering full maintenance: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule maintenance tasks")


@router.get("/maintenance/status")
async def get_maintenance_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current maintenance status and statistics.
    """
    try:
        from sqlalchemy import select, func
        from app.models import Conversation, PasswordResetToken
        from datetime import datetime, timedelta
        
        current_time = datetime.utcnow()
        cutoff_24h = current_time - timedelta(hours=24)
        
        # Count conversations that need archiving
        high_token_result = await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.token_count >= 1500,
                Conversation.archived_at.is_(None)
            )
        )
        high_token_count = high_token_result.scalar()
        
        inactive_result = await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.last_message_at <= cutoff_24h,
                Conversation.archived_at.is_(None)
            )
        )
        inactive_count = inactive_result.scalar()
        
        # Count expired tokens
        expired_tokens_result = await db.execute(
            select(func.count(PasswordResetToken.id)).where(
                PasswordResetToken.expires_at <= current_time
            )
        )
        expired_tokens_count = expired_tokens_result.scalar()
        
        # Count total archived conversations
        archived_result = await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.archived_at.isnot(None)
            )
        )
        total_archived = archived_result.scalar()
        
        return {
            "status": "healthy",
            "pending_tasks": {
                "conversations_ready_for_archive_by_tokens": high_token_count,
                "conversations_ready_for_archive_by_inactivity": inactive_count,
                "expired_password_reset_tokens": expired_tokens_count
            },
            "statistics": {
                "total_archived_conversations": total_archived
            },
            "last_checked": current_time.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting maintenance status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get maintenance status")


@router.post("/force-summary/{conversation_id}")
async def force_generate_summary(
    conversation_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Force generate summary for a specific conversation (admin/debugging).
    """
    try:
        from app.services.summary_service import summary_service
        from sqlalchemy import select
        from app.models import Conversation
        
        # Check if conversation exists
        conversation_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conversation_result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Generate summary in background
        async def generate_summary_task():
            await summary_service.force_generate_summary(conversation_id, db)
        
        background_tasks.add_task(generate_summary_task)
        
        logger.info(f"Force summary generation triggered for conversation {conversation_id} by user {current_user.username}")
        
        return {
            "message": f"Summary generation scheduled for conversation {conversation_id}",
            "conversation_id": conversation_id,
            "status": "scheduled",
            "triggered_by": current_user.username
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering summary generation: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule summary generation")