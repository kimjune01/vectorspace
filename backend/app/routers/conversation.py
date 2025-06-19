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