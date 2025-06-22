from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from app.database import get_db
from app.models import User, Conversation, Message, ConversationParticipant
from app.schemas.conversation import (
    ConversationCreate, ConversationResponse, ConversationDetailResponse,
    MessageResponse, ParticipantResponse, ConversationListResponse,
    MessageCreate, ConversationUpdate, JoinConversationRequest, SuccessResponse
)
from app.services.vector_service import vector_service
from app.services.summary_service import SummaryService
from app.auth import get_current_user

router = APIRouter()


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    conversation_data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation."""
    conversation = Conversation(
        user_id=current_user.id,
        title=conversation_data.title,
        is_public=conversation_data.is_public
    )
    
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    
    # Create owner participant record
    owner_participant = ConversationParticipant(
        conversation_id=conversation.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(owner_participant)
    await db.commit()
    
    return ConversationResponse.model_validate(conversation)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get conversation details with messages and participants."""
    # Get conversation with author information
    conversation_result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.user))
        .where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check access permissions
    if not conversation.is_public and conversation.user_id != current_user.id:
        # Check if user is a participant
        participant_result = await db.execute(
            select(ConversationParticipant)
            .where(and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            ))
        )
        if not participant_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to private conversation"
            )
    
    # Increment view count if not the owner
    if conversation.user_id != current_user.id:
        conversation.view_count += 1
        await db.commit()
    
    # Get messages with user info
    messages_result = await db.execute(
        select(Message)
        .options(selectinload(Message.from_user))
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp)
    )
    messages = messages_result.scalars().all()
    
    # Convert messages to response format
    message_responses = []
    for msg in messages:
        message_data = MessageResponse.model_validate(msg)
        if msg.from_user:
            message_data.from_user_username = msg.from_user.username
            message_data.from_user_display_name = msg.from_user.display_name
        message_responses.append(message_data)
    
    # Get participant count
    participant_count_result = await db.execute(
        select(func.count(ConversationParticipant.id))
        .where(ConversationParticipant.conversation_id == conversation_id)
    )
    participant_count = participant_count_result.scalar()
    
    # Build response - convert to dict first to avoid lazy loading issues
    conversation_dict = {
        "id": conversation.id,
        "title": conversation.title,
        "user_id": conversation.user_id,
        "author_username": conversation.user.username,
        "author_display_name": conversation.user.display_name,
        "is_public": conversation.is_public,
        "is_hidden_from_profile": conversation.is_hidden_from_profile,
        "created_at": conversation.created_at,
        "last_message_at": conversation.last_message_at,
        "summary_public": conversation.summary_public,
        "archived_at": conversation.archived_at,
        "view_count": conversation.view_count,
        "token_count": conversation.token_count,
        "messages": message_responses,
        "participant_count": participant_count
    }
    
    return ConversationDetailResponse(**conversation_dict)


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0)
):
    """Get paginated conversation messages."""
    # Verify access to conversation
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check access permissions
    if not conversation.is_public and conversation.user_id != current_user.id:
        participant_result = await db.execute(
            select(ConversationParticipant)
            .where(and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            ))
        )
        if not participant_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to private conversation"
            )
    
    # Get messages
    messages_result = await db.execute(
        select(Message)
        .options(selectinload(Message.from_user))
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    messages = messages_result.scalars().all()
    
    # Convert to response format
    message_responses = []
    for msg in reversed(messages):  # Reverse to get chronological order
        message_data = MessageResponse.model_validate(msg)
        if msg.from_user:
            message_data.from_user_username = msg.from_user.username
            message_data.from_user_display_name = msg.from_user.display_name
        message_responses.append(message_data)
    
    return message_responses


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def create_message(
    conversation_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new message in a conversation with automatic summary regeneration."""
    # Verify conversation exists and user has access
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check if user is the owner or a participant
    if conversation.user_id != current_user.id:
        participant_result = await db.execute(
            select(ConversationParticipant)
            .where(and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            ))
        )
        if not participant_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this conversation"
            )
    
    # Create the message
    message = Message(
        conversation_id=conversation_id,
        from_user_id=current_user.id,
        role=message_data.role,
        content=message_data.content
    )
    
    db.add(message)
    await db.commit()
    await db.refresh(message)
    
    # Update conversation metadata
    conversation.update_last_message_time()
    
    # Recalculate token count for the conversation
    messages_result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id)
    )
    all_messages = messages_result.scalars().all()
    total_tokens = sum(msg.token_count for msg in all_messages)
    
    previous_token_count = conversation.token_count
    conversation.token_count = total_tokens
    
    await db.commit()
    
    # Check if we've crossed a 1000-token milestone for summary regeneration
    previous_milestone = previous_token_count // 1000
    current_milestone = total_tokens // 1000
    
    if current_milestone > previous_milestone and total_tokens >= 1000:
        # Regenerate summary at milestone
        try:
            summary_service = SummaryService()
            
            # Generate summary using the existing async method
            summary_raw = await summary_service.generate_summary(conversation_id, db)
            
            if summary_raw:
                # Filter summary for public use
                summary_public = summary_service.pii_filter.filter_text(summary_raw)
                
                # Update conversation with new summary
                conversation.summary_raw = summary_raw
                conversation.summary_public = summary_public
                await db.commit()
                
                # Store embedding in vector database
                await vector_service.store_conversation_embedding(
                    conversation_id=str(conversation.id),
                    summary=summary_public,
                    metadata={
                        'title': conversation.title,
                        'user_id': str(conversation.user_id),
                        'username': current_user.username,
                        'is_public': str(conversation.is_public),
                        'created_at': conversation.created_at.isoformat(),
                        'token_count': str(total_tokens)
                    }
                )
            
        except Exception as e:
            # Log error but don't fail the message creation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to generate summary for conversation {conversation_id}: {e}")
    
    # Prepare response
    message_response = MessageResponse.model_validate(message)
    message_response.from_user_username = current_user.username
    message_response.from_user_display_name = current_user.display_name
    
    return message_response


@router.post("/{conversation_id}/join", response_model=SuccessResponse)
async def join_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Join a public conversation as a participant."""
    # Get conversation
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if not conversation.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot join private conversation"
        )
    
    if conversation.is_archived():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot join archived conversation"
        )
    
    # Check if already a participant
    existing_participant = await db.execute(
        select(ConversationParticipant)
        .where(and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        ))
    )
    
    if existing_participant.scalar_one_or_none():
        return SuccessResponse(
            message="Already a participant in this conversation",
            conversation_id=conversation_id
        )
    
    # Add as participant
    participant = ConversationParticipant(
        conversation_id=conversation_id,
        user_id=current_user.id,
        role="visitor"
    )
    db.add(participant)
    await db.commit()
    
    return SuccessResponse(
        message="Successfully joined conversation",
        conversation_id=conversation_id
    )


@router.delete("/{conversation_id}/leave", response_model=SuccessResponse)
async def leave_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Leave a conversation as a participant."""
    # Get participant record
    participant_result = await db.execute(
        select(ConversationParticipant)
        .where(and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        ))
    )
    participant = participant_result.scalar_one_or_none()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not a participant in this conversation"
        )
    
    if participant.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation owner cannot leave their own conversation"
        )
    
    # Remove participant
    await db.delete(participant)
    await db.commit()
    
    return SuccessResponse(
        message="Successfully left conversation",
        conversation_id=conversation_id
    )


@router.get("/{conversation_id}/participants", response_model=List[ParticipantResponse])
async def get_conversation_participants(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of conversation participants."""
    # Verify access to conversation
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check access permissions
    if not conversation.is_public and conversation.user_id != current_user.id:
        participant_result = await db.execute(
            select(ConversationParticipant)
            .where(and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id
            ))
        )
        if not participant_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to private conversation"
            )
    
    # Get participants with user info
    participants_result = await db.execute(
        select(ConversationParticipant)
        .options(selectinload(ConversationParticipant.user))
        .where(ConversationParticipant.conversation_id == conversation_id)
        .order_by(ConversationParticipant.joined_at)
    )
    participants = participants_result.scalars().all()
    
    # Convert to response format
    participant_responses = []
    for participant in participants:
        response_data = ParticipantResponse(
            id=participant.id,
            user_id=participant.user_id,
            username=participant.user.username,
            display_name=participant.user.display_name,
            role=participant.role,
            joined_at=participant.joined_at,
            last_seen_at=participant.last_seen_at
        )
        participant_responses.append(response_data)
    
    return participant_responses


@router.post("/{conversation_id}/archive", response_model=SuccessResponse)
async def archive_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually archive a conversation."""
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only conversation owner can archive"
        )
    
    if conversation.is_archived():
        return SuccessResponse(
            message="Conversation already archived",
            conversation_id=conversation_id
        )
    
    conversation.archive()
    await db.commit()
    
    return SuccessResponse(
        message="Conversation archived successfully",
        conversation_id=conversation_id
    )


@router.delete("/{conversation_id}", response_model=SuccessResponse)
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a conversation permanently."""
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only conversation owner can delete"
        )
    
    # Delete the conversation (cascade will handle related records)
    await db.delete(conversation)
    await db.commit()
    
    return SuccessResponse(
        message="Conversation deleted successfully",
        conversation_id=conversation_id
    )


@router.put("/{conversation_id}/hide", response_model=SuccessResponse)
async def toggle_conversation_visibility(
    conversation_id: int,
    update_data: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Hide or unhide conversation from profile."""
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only conversation owner can modify visibility"
        )
    
    # Update fields
    if update_data.is_hidden_from_profile is not None:
        if update_data.is_hidden_from_profile:
            conversation.hide_from_profile()
        else:
            conversation.show_on_profile()
    
    if update_data.title is not None:
        conversation.title = update_data.title
    
    if update_data.is_public is not None:
        conversation.is_public = update_data.is_public
    
    await db.commit()
    
    action = "hidden from" if conversation.is_hidden_from_profile else "visible on"
    return SuccessResponse(
        message=f"Conversation {action} profile",
        conversation_id=conversation_id
    )


@router.get("/", response_model=ConversationListResponse)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    public_only: bool = Query(False),
    include_archived: bool = Query(False)
):
    """List user's conversations with pagination."""
    offset = (page - 1) * per_page
    
    # Build query
    query = select(Conversation).where(Conversation.user_id == current_user.id)
    
    if public_only:
        query = query.where(Conversation.is_public == True)
    
    if not include_archived:
        query = query.where(Conversation.archived_at.is_(None))
    
    # Get total count
    count_query = select(func.count(Conversation.id)).where(Conversation.user_id == current_user.id)
    if public_only:
        count_query = count_query.where(Conversation.is_public == True)
    if not include_archived:
        count_query = count_query.where(Conversation.archived_at.is_(None))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get conversations
    conversations_result = await db.execute(
        query.order_by(Conversation.last_message_at.desc())
        .limit(per_page)
        .offset(offset)
    )
    conversations = conversations_result.scalars().all()
    
    # Convert to response format
    conversation_responses = [
        ConversationResponse.model_validate(conv) for conv in conversations
    ]
    
    has_next = (offset + per_page) < total
    
    return ConversationListResponse(
        conversations=conversation_responses,
        total=total,
        page=page,
        per_page=per_page,
        has_next=has_next
    )


@router.get("/{conversation_id}/similar")
async def get_similar_conversations(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=50)
):
    """Get conversations similar to the specified conversation."""
    # Verify conversation exists
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check if conversation has a summary for similarity search
    if not conversation.summary_public:
        return {
            "conversations": [],
            "message": "No summary available for similarity search"
        }
    
    # Find similar conversations using vector service
    similar_conversations = vector_service.find_similar_conversations(
        conversation_id=str(conversation_id),
        limit=limit
    )
    
    # Filter out private conversations (only show public ones)
    public_similar_conversations = [
        conv for conv in similar_conversations 
        if conv.get('is_public', False)
    ]
    
    return {
        "conversations": public_similar_conversations[:limit]
    }


@router.post("/{conversation_id}/generate-title", response_model=dict)
async def generate_conversation_title(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    force_update: bool = Query(False, description="Force update even if title is custom")
):
    """Generate a new title for the conversation based on its content."""
    # Check if conversation exists and user has access
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check if user owns the conversation or is a participant
    if conversation.user_id != current_user.id:
        if conversation.is_public:
            # Public conversations can only be title-updated by owner
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only conversation owner can generate title"
            )
        else:
            # Check if user is a participant in private conversation
            participant_result = await db.execute(
                select(ConversationParticipant)
                .where(ConversationParticipant.conversation_id == conversation_id)
                .where(ConversationParticipant.user_id == current_user.id)
            )
            
            if not participant_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
    
    # Generate new title
    from app.services.title_service import title_service
    
    try:
        new_title = await title_service.update_conversation_title(
            conversation_id, db, force_update=force_update
        )
        
        if new_title:
            return {
                "success": True,
                "title": new_title,
                "message": "Title updated successfully"
            }
        else:
            return {
                "success": False,
                "title": conversation.title,
                "message": "Title not updated (may be custom or generation failed)"
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate title: {str(e)}"
        )


@router.post("/{conversation_id}/regenerate-summary-and-title", response_model=dict)
async def regenerate_summary_and_title(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Regenerate both summary and title for the conversation."""
    # Check if conversation exists and user has access
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check if user owns the conversation
    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only conversation owner can regenerate summary and title"
        )
    
    try:
        from app.services.summary_service import summary_service
        
        # Clear existing summary to force regeneration
        conversation.summary_raw = None
        conversation.summary_public = None
        await db.commit()
        
        # Force generate new summary and title
        new_summary = await summary_service.force_generate_summary(
            conversation_id, db, update_title=True
        )
        
        # Get updated conversation
        await db.refresh(conversation)
        
        return {
            "success": True,
            "summary": conversation.summary_public,
            "title": conversation.title,
            "message": "Summary and title regenerated successfully"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate summary and title: {str(e)}"
        )