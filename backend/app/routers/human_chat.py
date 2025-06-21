"""
Human chat API endpoints for real-time user-to-user messaging.
Allows users to chat with each other on conversation pages.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, and_, or_, desc, func
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Conversation, HumanMessage
from app.schemas.social import (
    HumanMessageCreate,
    HumanMessageResponse,
    HumanChatRoomInfo
)
from app.services.websocket_manager import websocket_manager

router = APIRouter()


@router.post("/conversations/{conversation_id}/messages", response_model=HumanMessageResponse)
async def send_human_message(
    conversation_id: int,
    message: HumanMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a human chat message in a conversation."""
    
    # Verify conversation exists and is public
    conversation_query = select(Conversation).where(
        and_(
            Conversation.id == conversation_id,
            Conversation.is_public == True,
            Conversation.archived_at.is_(None)
        )
    )
    conversation_result = await db.execute(conversation_query)
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or not accessible"
        )
    
    # Create the human message
    human_message = HumanMessage(
        conversation_id=conversation_id,
        user_id=current_user.id,
        content=message.content.strip()
    )
    
    db.add(human_message)
    await db.commit()
    await db.refresh(human_message)
    
    # Load user details for response
    user_query = select(User).where(User.id == current_user.id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one()
    
    # Create response
    response = HumanMessageResponse(
        id=human_message.id,
        conversation_id=human_message.conversation_id,
        user_id=human_message.user_id,
        content=human_message.content,
        sent_at=human_message.sent_at,
        expires_at=human_message.expires_at,
        user_username=user.username,
        user_display_name=user.display_name,
        user_profile_image_data=user.profile_image_data
    )
    
    # Broadcast to WebSocket connections
    await websocket_manager.broadcast_to_conversation(
        conversation_id,
        {
            "type": "human_message",
            "data": response.model_dump()
        }
    )
    
    return response


@router.get("/conversations/{conversation_id}/messages", response_model=List[HumanMessageResponse])
async def get_human_messages(
    conversation_id: int,
    limit: int = 50,
    before_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get human chat messages for a conversation."""
    
    # Verify conversation exists and is accessible
    conversation_query = select(Conversation).where(
        and_(
            Conversation.id == conversation_id,
            Conversation.is_public == True,
            Conversation.archived_at.is_(None)
        )
    )
    conversation_result = await db.execute(conversation_query)
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or not accessible"
        )
    
    # Build query for messages
    message_query = (
        select(HumanMessage, User)
        .join(User, HumanMessage.user_id == User.id)
        .where(
            and_(
                HumanMessage.conversation_id == conversation_id,
                HumanMessage.expires_at > datetime.utcnow()  # Only non-expired messages
            )
        )
        .order_by(desc(HumanMessage.sent_at))
        .limit(limit)
    )
    
    # Add pagination if before_id is provided
    if before_id:
        message_query = message_query.where(HumanMessage.id < before_id)
    
    result = await db.execute(message_query)
    messages_with_users = result.all()
    
    # Convert to response format
    responses = []
    for human_message, user in messages_with_users:
        response = HumanMessageResponse(
            id=human_message.id,
            conversation_id=human_message.conversation_id,
            user_id=human_message.user_id,
            content=human_message.content,
            sent_at=human_message.sent_at,
            expires_at=human_message.expires_at,
            user_username=user.username,
            user_display_name=user.display_name,
            user_profile_image_data=user.profile_image_data
        )
        responses.append(response)
    
    # Return in chronological order (oldest first)
    return list(reversed(responses))


@router.get("/conversations/{conversation_id}/chat-info", response_model=HumanChatRoomInfo)
async def get_chat_room_info(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get information about the human chat room for a conversation."""
    
    # Verify conversation exists and is accessible
    conversation_query = select(Conversation).where(
        and_(
            Conversation.id == conversation_id,
            Conversation.is_public == True,
            Conversation.archived_at.is_(None)
        )
    )
    conversation_result = await db.execute(conversation_query)
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or not accessible"
        )
    
    # Get recent messages (last 20)
    recent_messages_query = (
        select(HumanMessage, User)
        .join(User, HumanMessage.user_id == User.id)
        .where(
            and_(
                HumanMessage.conversation_id == conversation_id,
                HumanMessage.expires_at > datetime.utcnow()
            )
        )
        .order_by(desc(HumanMessage.sent_at))
        .limit(20)
    )
    
    result = await db.execute(recent_messages_query)
    messages_with_users = result.all()
    
    # Convert to response format
    recent_messages = []
    for human_message, user in reversed(messages_with_users):  # Chronological order
        message_response = HumanMessageResponse(
            id=human_message.id,
            conversation_id=human_message.conversation_id,
            user_id=human_message.user_id,
            content=human_message.content,
            sent_at=human_message.sent_at,
            expires_at=human_message.expires_at,
            user_username=user.username,
            user_display_name=user.display_name,
            user_profile_image_data=user.profile_image_data
        )
        recent_messages.append(message_response)
    
    # Get online users from WebSocket manager
    online_users = websocket_manager.get_conversation_users(conversation_id)
    
    # All authenticated users can chat in public conversations
    can_chat = True
    
    return HumanChatRoomInfo(
        conversation_id=conversation_id,
        online_users=online_users,
        can_chat=can_chat,
        recent_messages=recent_messages
    )


@router.delete("/conversations/{conversation_id}/messages/{message_id}")
async def delete_human_message(
    conversation_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a human chat message (only by the author)."""
    
    # Find the message
    message_query = select(HumanMessage).where(
        and_(
            HumanMessage.id == message_id,
            HumanMessage.conversation_id == conversation_id,
            HumanMessage.user_id == current_user.id  # Only author can delete
        )
    )
    message_result = await db.execute(message_query)
    message = message_result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you don't have permission to delete it"
        )
    
    # Delete the message
    await db.delete(message)
    await db.commit()
    
    # Broadcast deletion to WebSocket connections
    await websocket_manager.broadcast_to_conversation(
        conversation_id,
        {
            "type": "message_deleted",
            "data": {
                "message_id": message_id,
                "conversation_id": conversation_id
            }
        }
    )
    
    return {"success": True, "message": "Message deleted"}


@router.post("/conversations/{conversation_id}/join")
async def join_chat_room(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Join a conversation's chat room (for WebSocket presence)."""
    
    # Verify conversation exists and is accessible
    conversation_query = select(Conversation).where(
        and_(
            Conversation.id == conversation_id,
            Conversation.is_public == True,
            Conversation.archived_at.is_(None)
        )
    )
    conversation_result = await db.execute(conversation_query)
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or not accessible"
        )
    
    # Add user to the conversation's online presence
    # This would typically be handled by WebSocket connection,
    # but this endpoint allows for explicit joining
    return {
        "success": True,
        "message": f"Joined chat room for conversation {conversation_id}",
        "conversation_id": conversation_id
    }


@router.post("/conversations/{conversation_id}/leave")
async def leave_chat_room(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Leave a conversation's chat room."""
    
    # Remove user from the conversation's online presence
    # This would typically be handled by WebSocket disconnection,
    # but this endpoint allows for explicit leaving
    return {
        "success": True,
        "message": f"Left chat room for conversation {conversation_id}",
        "conversation_id": conversation_id
    }


@router.get("/conversations/{conversation_id}/online-users")
async def get_online_users(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of users currently online in the conversation."""
    
    # Verify conversation exists and is accessible
    conversation_query = select(Conversation).where(
        and_(
            Conversation.id == conversation_id,
            Conversation.is_public == True,
            Conversation.archived_at.is_(None)
        )
    )
    conversation_result = await db.execute(conversation_query)
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or not accessible"
        )
    
    # Get online users from WebSocket manager
    online_user_ids = websocket_manager.get_conversation_users(conversation_id)
    
    # Get user details for online users
    if online_user_ids:
        users_query = select(User).where(User.id.in_(online_user_ids))
        result = await db.execute(users_query)
        users = result.scalars().all()
        
        online_users = [
            {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "profile_image_data": user.profile_image_data
            }
            for user in users
        ]
    else:
        online_users = []
    
    return {
        "conversation_id": conversation_id,
        "online_users": online_users,
        "count": len(online_users)
    }