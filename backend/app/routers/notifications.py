"""
Notification system API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Notification
from app.schemas.social import (
    NotificationResponse,
    NotificationListResponse,
    NotificationStatsResponse
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notifications for the current user."""
    # Build query
    query = select(Notification).where(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    # Add eager loading for related user
    query = query.options(selectinload(Notification.related_user))
    
    # Count total notifications
    count_query = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
    if unread_only:
        count_query = count_query.where(Notification.is_read == False)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination and ordering
    query = query.order_by(Notification.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    # Convert to response format
    notification_responses = []
    for notification in notifications:
        notification_responses.append(NotificationResponse(
            id=notification.id,
            type=notification.type,
            title=notification.title,
            message=notification.message,
            is_read=notification.is_read,
            created_at=notification.created_at,
            related_user_id=notification.related_user_id,
            related_user=notification.related_user,
            related_conversation_id=notification.related_conversation_id
        ))
    
    return NotificationListResponse(
        notifications=notification_responses,
        total=total,
        page=page,
        per_page=per_page,
        has_next=total > page * per_page,
        has_prev=page > 1
    )


@router.get("/stats", response_model=NotificationStatsResponse)
async def get_notification_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notification statistics for the current user."""
    # Count unread notifications
    unread_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    )
    unread_count = unread_result.scalar() or 0
    
    # Count total notifications
    total_result = await db.execute(
        select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
    )
    total_count = total_result.scalar() or 0
    
    return NotificationStatsResponse(
        unread_count=unread_count,
        total_count=total_count
    )


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a notification as read."""
    # Find the notification
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if not notification.is_read:
        notification.is_read = True
        await db.commit()
    
    return {"message": "Notification marked as read"}


@router.post("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read for the current user."""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
        .values(is_read=True)
    )
    await db.commit()
    
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a notification."""
    # Find the notification
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notification)
    await db.commit()
    
    return {"message": "Notification deleted"}