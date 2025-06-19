import json
import logging
import time
from typing import Optional, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from jose import JWTError, jwt
from app.database import get_db
from app.models import User, Conversation, ConversationParticipant, Message
from app.services.websocket_manager import websocket_manager
from app.auth import SECRET_KEY, ALGORITHM, blacklisted_tokens
import os
import re

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_user_from_token(token: str, db: AsyncSession) -> Optional[User]:
    """Authenticate user from JWT token for WebSocket connections."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_id: str = payload.get("jti")
        
        # Check if token is blacklisted
        if token_id in blacklisted_tokens:
            return None
        
        if username is None:
            return None
        
        # Get user from database
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        return user
        
    except JWTError:
        return None


async def verify_conversation_access(user: User, conversation_id: int, db: AsyncSession) -> bool:
    """Verify that a user has access to a conversation."""
    # Get conversation
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        return False
    
    # Check if user is the owner
    if conversation.user_id == user.id:
        return True
    
    # Check if conversation is public
    if conversation.is_public:
        return True
    
    # Check if user is a participant in private conversation
    participant_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == user.id)
    )
    
    return participant_result.scalar_one_or_none() is not None


@router.websocket("/conversations/{conversation_id}")
async def conversation_websocket(
    websocket: WebSocket,
    conversation_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """WebSocket endpoint for real-time conversation communication."""
    connection_id = None
    
    try:
        # Authenticate user
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication")
            return
        
        # Verify conversation access
        if not await verify_conversation_access(user, conversation_id, db):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Access denied")
            return
        
        # Connect to WebSocket manager
        connection_id = await websocket_manager.connect(
            websocket, conversation_id, user.id, user.username
        )
        
        # Add user as participant if not already (for public conversations)
        await ensure_participant_record(user.id, conversation_id, db)
        
        # Send initial connection confirmation
        await websocket_manager.send_to_connection(connection_id, {
            "type": "connection_established",
            "conversation_id": conversation_id,
            "user_id": user.id,
            "connection_id": connection_id
        })
        
        # Main message loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Process the message
                await handle_websocket_message(
                    connection_id, user, conversation_id, message_data, db
                )
                
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for user {user.username} in conversation {conversation_id}")
                break
            except json.JSONDecodeError:
                await websocket_manager.send_to_connection(connection_id, {
                    "type": "error",
                    "message": "Invalid JSON format"
                })
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket_manager.send_to_connection(connection_id, {
                    "type": "error",
                    "message": "Internal server error"
                })
    
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    
    finally:
        # Clean up connection
        if connection_id:
            await websocket_manager.disconnect(connection_id)


async def ensure_participant_record(user_id: int, conversation_id: int, db: AsyncSession):
    """Ensure user has a participant record for the conversation."""
    # Check if participant record exists
    participant_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == user_id)
    )
    
    if not participant_result.scalar_one_or_none():
        # Get conversation to check ownership
        conversation_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conversation_result.scalar_one()
        
        # Determine role
        role = "owner" if conversation.user_id == user_id else "visitor"
        
        # Create participant record
        participant = ConversationParticipant(
            conversation_id=conversation_id,
            user_id=user_id,
            role=role
        )
        db.add(participant)
        await db.commit()


async def handle_websocket_message(
    connection_id: str, 
    user: User, 
    conversation_id: int, 
    message_data: dict, 
    db: AsyncSession
):
    """Handle incoming WebSocket messages with enhanced validation and routing."""
    # Validate message structure
    if not isinstance(message_data, dict):
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": "Invalid message format - must be JSON object"
        })
        return
    
    message_type = message_data.get("type")
    if not message_type:
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": "Message type is required"
        })
        return
    
    # Rate limiting check
    if await is_rate_limited(user.id, connection_id):
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": "Rate limit exceeded. Please slow down."
        })
        return
    
    # Route message based on type
    if message_type == "send_message":
        await handle_send_message(connection_id, user, conversation_id, message_data, db)
    elif message_type == "join_conversation":
        await handle_join_conversation(connection_id, user, conversation_id, db)
    elif message_type == "typing_indicator":
        await handle_typing_indicator(connection_id, user, conversation_id, message_data)
    elif message_type == "ping":
        await handle_ping(connection_id)
    elif message_type == "request_message_history":
        await handle_message_history_request(connection_id, user, conversation_id, message_data, db)
    elif message_type == "mark_messages_read":
        await handle_mark_messages_read(connection_id, user, conversation_id, message_data, db)
    else:
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        })


async def handle_send_message(
    connection_id: str, 
    user: User, 
    conversation_id: int, 
    message_data: dict, 
    db: AsyncSession
):
    """Handle sending a message to the conversation with enhanced validation."""
    content = message_data.get("content", "").strip()
    role = message_data.get("role", "user")
    message_type = message_data.get("message_type", "chat")
    parent_message_id = message_data.get("parent_message_id")
    
    # Enhanced content validation
    validation_error = validate_message_content(content, role, message_type)
    if validation_error:
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": validation_error
        })
        return
    
    # Validate parent message if specified
    if parent_message_id:
        parent_validation_error = await validate_parent_message(parent_message_id, conversation_id, db)
        if parent_validation_error:
            await websocket_manager.send_to_connection(connection_id, {
                "type": "error", 
                "message": parent_validation_error
            })
            return
    
    try:
        # Create message in database
        message = Message(
            conversation_id=conversation_id,
            from_user_id=user.id,
            role=role,
            message_type=message_type,
            content=content,
            parent_message_id=parent_message_id
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        
        # Update conversation last_message_at and token count
        conversation_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conversation_result.scalar_one()
        conversation.update_last_message_time()
        
        # Update conversation token count
        conversation.token_count += message.token_count
        await db.commit()
        
        # Check if conversation should be summarized (1500+ tokens)
        if conversation.should_auto_archive() and not conversation.summary_raw:
            from app.services.summary_service import summary_service
            await summary_service.check_and_generate_summary(conversation_id, db)
        
        # Broadcast message to all participants
        await websocket_manager.broadcast_to_conversation(conversation_id, {
            "type": "new_message",
            "message": {
                "id": message.id,
                "conversation_id": conversation_id,
                "from_user_id": user.id,
                "from_user_username": user.username,
                "from_user_display_name": user.display_name,
                "role": role,
                "message_type": message_type,
                "content": content,
                "parent_message_id": parent_message_id,
                "timestamp": message.timestamp.isoformat()
            }
        })
        
        # Determine routing based on user role and conversation ownership
        await route_message_by_context(user, conversation_id, message, db)
        
        # If this is a user message, trigger AI response
        if role == "user" and message_type == "chat":
            await handle_ai_response(connection_id, conversation_id, message.id, db)
        
    except Exception as e:
        logger.error(f"Error saving message: {e}")
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": "Failed to save message"
        })


async def handle_join_conversation(connection_id: str, user: User, conversation_id: int, db: AsyncSession):
    """Handle user joining a conversation."""
    try:
        # Ensure participant record exists (already done in main handler, but double-check)
        await ensure_participant_record(user.id, conversation_id, db)
        
        # Send confirmation
        await websocket_manager.send_to_connection(connection_id, {
            "type": "join_confirmed",
            "conversation_id": conversation_id,
            "participants": websocket_manager.get_conversation_participants(conversation_id)
        })
        
    except Exception as e:
        logger.error(f"Error joining conversation: {e}")
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": "Failed to join conversation"
        })


async def handle_typing_indicator(
    connection_id: str, 
    user: User, 
    conversation_id: int, 
    message_data: dict
):
    """Handle typing indicator from user."""
    is_typing = message_data.get("is_typing", False)
    
    # Broadcast typing indicator to other participants
    await websocket_manager.broadcast_to_conversation(
        conversation_id,
        {
            "type": "typing_indicator",
            "user_id": user.id,
            "username": user.username,
            "is_typing": is_typing
        },
        exclude_connection_id=connection_id
    )


async def handle_ping(connection_id: str):
    """Handle ping message for connection keep-alive."""
    await websocket_manager.send_to_connection(connection_id, {
        "type": "pong"
    })


async def handle_ai_response(connection_id: str, conversation_id: int, user_message_id: int, db: AsyncSession):
    """Handle AI response generation and streaming."""
    try:
        from app.services.ai_service import ai_service
        from sqlalchemy import select
        
        # Get recent conversation messages for context
        messages_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.timestamp.desc())
            .limit(10)  # Get last 10 messages for context
        )
        recent_messages = messages_result.scalars().all()
        
        # Format messages for AI service
        formatted_messages = []
        for msg in reversed(recent_messages):  # Chronological order
            formatted_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Generate streaming AI response
        ai_message_id = f"ai_{user_message_id}"
        accumulated_content = ""
        total_tokens = 0
        
        async for chunk in ai_service.stream_response(formatted_messages, conversation_id):
            if chunk["content"]:
                accumulated_content += chunk["content"]
                
                # Broadcast chunk to all participants
                await websocket_manager.broadcast_to_conversation(conversation_id, {
                    "type": "ai_response_chunk",
                    "content": chunk["content"],
                    "message_id": ai_message_id,
                    "is_final": False
                })
            
            if chunk.get("total_tokens"):
                total_tokens = chunk["total_tokens"]
            elif chunk["tokens"]:
                total_tokens += chunk["tokens"]
            
            # Check if response is complete
            if chunk.get("finish_reason") == "stop":
                break
        
        # Save AI response to database
        ai_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=accumulated_content,
            token_count=total_tokens
        )
        db.add(ai_message)
        
        # Update conversation token count
        conversation_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conversation_result.scalar_one()
        conversation.token_count += ai_message.token_count
        conversation.update_last_message_time()
        
        await db.commit()
        await db.refresh(ai_message)
        
        # Send completion signal
        await websocket_manager.broadcast_to_conversation(conversation_id, {
            "type": "ai_response_complete",
            "message_id": ai_message_id,
            "database_id": ai_message.id,
            "token_count": total_tokens,
            "conversation_tokens": conversation.token_count
        })
        
        # Check if conversation should be summarized after AI response
        if conversation.should_auto_archive() and not conversation.summary_raw:
            from app.services.summary_service import summary_service
            await summary_service.check_and_generate_summary(conversation_id, db)
        
    except Exception as e:
        logger.error(f"Error in AI response generation: {e}")
        await websocket_manager.broadcast_to_conversation(conversation_id, {
            "type": "ai_response_error",
            "message_id": f"ai_{user_message_id}",
            "error": "Failed to generate AI response"
        })


# Rate limiting storage - in production, use Redis
_rate_limit_storage: Dict[str, Dict] = {}


async def is_rate_limited(user_id: int, connection_id: str) -> bool:
    """Check if user/connection is rate limited."""
    current_time = time.time()
    key = f"user_{user_id}_{connection_id}"
    
    if key not in _rate_limit_storage:
        _rate_limit_storage[key] = {"count": 1, "window_start": current_time}
        return False
    
    rate_data = _rate_limit_storage[key]
    
    # Reset window if more than 60 seconds have passed
    if current_time - rate_data["window_start"] > 60:
        rate_data["count"] = 1
        rate_data["window_start"] = current_time
        return False
    
    # Increment count first
    rate_data["count"] += 1
    
    # Allow 30 messages per minute
    if rate_data["count"] > 30:
        return True
    
    return False


def validate_message_content(content: str, role: str, message_type: str) -> Optional[str]:
    """Validate message content and return error message if invalid."""
    if not content:
        return "Message content cannot be empty"
    
    if len(content) > 4000:
        return "Message content too long (max 4000 characters)"
    
    # Check for valid role
    valid_roles = ["user", "assistant", "system"]
    if role not in valid_roles:
        return f"Invalid role. Must be one of: {', '.join(valid_roles)}"
    
    # Check for valid message type
    valid_message_types = ["chat", "system", "visitor_message"]
    if message_type not in valid_message_types:
        return f"Invalid message type. Must be one of: {', '.join(valid_message_types)}"
    
    # Content quality checks
    if len(content.strip()) < 1:
        return "Message content cannot be only whitespace"
    
    # Check for potentially harmful patterns
    if re.search(r'<script|javascript:|data:|vbscript:', content, re.IGNORECASE):
        return "Message content contains potentially harmful code"
    
    # Check for excessive repeated characters (spam detection)
    if re.search(r'(.)\1{20,}', content):
        return "Message contains excessive repeated characters"
    
    return None


async def validate_parent_message(parent_message_id: int, conversation_id: int, db: AsyncSession) -> Optional[str]:
    """Validate that parent message exists and belongs to the conversation."""
    try:
        result = await db.execute(
            select(Message).where(
                Message.id == parent_message_id,
                Message.conversation_id == conversation_id
            )
        )
        parent_message = result.scalar_one_or_none()
        
        if not parent_message:
            return "Parent message not found or doesn't belong to this conversation"
        
        return None
        
    except Exception as e:
        logger.error(f"Error validating parent message: {e}")
        return "Error validating parent message"


async def route_message_by_context(user: User, conversation_id: int, message: Message, db: AsyncSession):
    """Route message based on user role and conversation context."""
    try:
        # Get conversation to check ownership
        conversation_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conversation_result.scalar_one()
        
        # Get user's participant role
        participant_result = await db.execute(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user.id
            )
        )
        participant = participant_result.scalar_one_or_none()
        
        # If user is visitor and conversation owner is different, mark as visitor message
        if (participant and participant.role == "visitor" and 
            conversation.user_id != user.id and 
            message.message_type == "chat"):
            
            # Send notification to conversation owner if they're connected
            await websocket_manager.send_to_user(conversation.user_id, {
                "type": "visitor_message_notification",
                "conversation_id": conversation_id,
                "from_user": user.username,
                "from_user_display_name": user.display_name,
                "message_preview": message.content[:100] + "..." if len(message.content) > 100 else message.content,
                "timestamp": message.timestamp.isoformat()
            })
        
    except Exception as e:
        logger.error(f"Error in message routing: {e}")


async def handle_message_history_request(
    connection_id: str, 
    user: User, 
    conversation_id: int, 
    message_data: dict, 
    db: AsyncSession
):
    """Handle request for message history."""
    try:
        limit = min(message_data.get("limit", 50), 100)  # Max 100 messages
        offset = max(message_data.get("offset", 0), 0)
        
        # Get messages with user information
        result = await db.execute(
            select(Message).where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.timestamp))
            .limit(limit)
            .offset(offset)
        )
        messages = result.scalars().all()
        
        # Format messages for response
        formatted_messages = []
        for msg in reversed(messages):  # Reverse to get chronological order
            # Get user info if from_user_id exists
            from_user_username = None
            from_user_display_name = None
            if msg.from_user_id:
                user_result = await db.execute(
                    select(User).where(User.id == msg.from_user_id)
                )
                msg_user = user_result.scalar_one_or_none()
                if msg_user:
                    from_user_username = msg_user.username
                    from_user_display_name = msg_user.display_name
            
            formatted_messages.append({
                "id": msg.id,
                "content": msg.content,
                "role": msg.role,
                "message_type": msg.message_type,
                "from_user_username": from_user_username,
                "from_user_display_name": from_user_display_name,
                "parent_message_id": msg.parent_message_id,
                "timestamp": msg.timestamp.isoformat()
            })
        
        await websocket_manager.send_to_connection(connection_id, {
            "type": "message_history",
            "messages": formatted_messages,
            "has_more": len(messages) == limit
        })
        
    except Exception as e:
        logger.error(f"Error handling message history request: {e}")
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": "Failed to retrieve message history"
        })


async def handle_mark_messages_read(
    connection_id: str, 
    user: User, 
    conversation_id: int, 
    message_data: dict, 
    db: AsyncSession
):
    """Handle marking messages as read."""
    try:
        # Update participant's last_seen_at
        participant_result = await db.execute(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user.id
            )
        )
        participant = participant_result.scalar_one_or_none()
        
        if participant:
            participant.update_last_seen()
            await db.commit()
            
            await websocket_manager.send_to_connection(connection_id, {
                "type": "messages_marked_read",
                "conversation_id": conversation_id,
                "timestamp": participant.last_seen_at.isoformat()
            })
        
    except Exception as e:
        logger.error(f"Error marking messages as read: {e}")
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": "Failed to mark messages as read"
        })