from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func
from sqlalchemy.orm import joinedload
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Conversation, Message
from app.models.collaboration import (
    PromptSuggestion, 
    PromptSuggestionVote,
    ConversationCollaboration,
    ConversationVersion,
    CollaborationInvitation,
    PromptSuggestionStatus,
    CollaborationType
)
from app.schemas.collaboration import (
    PromptSuggestionCreate,
    PromptSuggestionResponse,
    PromptSuggestionUpdate,
    PromptSuggestionVoteCreate,
    CollaborationInviteCreate,
    CollaborationInviteResponse,
    ConversationVersionCreate,
    ConversationVersionResponse,
    CollaborationStatsResponse
)

router = APIRouter()

# ========================================
# PROMPT SUGGESTIONS
# ========================================

@router.post("/conversations/{conversation_id}/suggestions", response_model=PromptSuggestionResponse)
async def create_prompt_suggestion(
    conversation_id: int,
    suggestion: PromptSuggestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new prompt suggestion for a conversation."""
    # Verify conversation exists and is accessible
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check if user has permission to suggest (public conversation or collaborator)
    if not conversation.is_public:
        # Check if user is owner or collaborator
        if conversation.user_id != current_user.id:
            collaboration_result = await db.execute(
                select(ConversationCollaboration).where(
                    and_(
                        ConversationCollaboration.conversation_id == conversation_id,
                        ConversationCollaboration.collaborator_id == current_user.id,
                        ConversationCollaboration.is_active == True
                    )
                )
            )
            collaboration = collaboration_result.scalar_one_or_none()
            if not collaboration or not collaboration.can_suggest():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No permission to suggest on this conversation"
                )
    
    # Validate original message if provided
    if suggestion.original_message_id:
        message_result = await db.execute(
            select(Message).where(
                and_(
                    Message.id == suggestion.original_message_id,
                    Message.conversation_id == conversation_id
                )
            )
        )
        if not message_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Original message not found in this conversation"
            )
    
    # Create the suggestion
    db_suggestion = PromptSuggestion(
        conversation_id=conversation_id,
        suggester_id=current_user.id,
        original_message_id=suggestion.original_message_id,
        suggested_prompt=suggestion.suggested_prompt,
        reasoning=suggestion.reasoning,
        target_position=suggestion.target_position
    )
    
    db.add(db_suggestion)
    await db.commit()
    await db.refresh(db_suggestion)
    
    # Load relationships for response
    await db.refresh(db_suggestion, ["suggester", "conversation"])
    
    return PromptSuggestionResponse(
        id=db_suggestion.id,
        conversation_id=db_suggestion.conversation_id,
        suggester_id=db_suggestion.suggester_id,
        suggester_username=db_suggestion.suggester.username,
        suggester_display_name=db_suggestion.suggester.display_name,
        original_message_id=db_suggestion.original_message_id,
        suggested_prompt=db_suggestion.suggested_prompt,
        reasoning=db_suggestion.reasoning,
        target_position=db_suggestion.target_position,
        status=db_suggestion.status,
        votes_up=db_suggestion.votes_up,
        votes_down=db_suggestion.votes_down,
        score=db_suggestion.calculate_score(),
        created_at=db_suggestion.created_at,
        updated_at=db_suggestion.updated_at
    )

@router.get("/conversations/{conversation_id}/suggestions", response_model=List[PromptSuggestionResponse])
async def get_conversation_suggestions(
    conversation_id: int,
    status_filter: Optional[PromptSuggestionStatus] = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get prompt suggestions for a conversation."""
    # Verify conversation access
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if not conversation.is_public and conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this conversation"
        )
    
    # Build query
    query = (
        select(PromptSuggestion)
        .options(joinedload(PromptSuggestion.suggester))
        .where(PromptSuggestion.conversation_id == conversation_id)
    )
    
    if status_filter:
        query = query.where(PromptSuggestion.status == status_filter)
    
    # Order by score (votes), then by creation time
    query = query.order_by(
        desc(PromptSuggestion.votes_up - PromptSuggestion.votes_down),
        desc(PromptSuggestion.created_at)
    ).limit(limit).offset(offset)
    
    result = await db.execute(query)
    suggestions = result.scalars().all()
    
    return [
        PromptSuggestionResponse(
            id=s.id,
            conversation_id=s.conversation_id,
            suggester_id=s.suggester_id,
            suggester_username=s.suggester.username,
            suggester_display_name=s.suggester.display_name,
            original_message_id=s.original_message_id,
            suggested_prompt=s.suggested_prompt,
            reasoning=s.reasoning,
            target_position=s.target_position,
            status=s.status,
            votes_up=s.votes_up,
            votes_down=s.votes_down,
            score=s.calculate_score(),
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in suggestions
    ]

@router.patch("/suggestions/{suggestion_id}", response_model=PromptSuggestionResponse)
async def update_suggestion_status(
    suggestion_id: int,
    update_data: PromptSuggestionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a prompt suggestion (owner only)."""
    # Get suggestion with conversation
    suggestion_result = await db.execute(
        select(PromptSuggestion)
        .options(joinedload(PromptSuggestion.conversation), joinedload(PromptSuggestion.suggester))
        .where(PromptSuggestion.id == suggestion_id)
    )
    suggestion = suggestion_result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found"
        )
    
    # Only conversation owner can update suggestion status
    if suggestion.conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only conversation owner can update suggestion status"
        )
    
    # Update status
    if update_data.status:
        suggestion.status = update_data.status
        if update_data.status in [PromptSuggestionStatus.ACCEPTED, PromptSuggestionStatus.REJECTED]:
            suggestion.reviewed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(suggestion)
    
    return PromptSuggestionResponse(
        id=suggestion.id,
        conversation_id=suggestion.conversation_id,
        suggester_id=suggestion.suggester_id,
        suggester_username=suggestion.suggester.username,
        suggester_display_name=suggestion.suggester.display_name,
        original_message_id=suggestion.original_message_id,
        suggested_prompt=suggestion.suggested_prompt,
        reasoning=suggestion.reasoning,
        target_position=suggestion.target_position,
        status=suggestion.status,
        votes_up=suggestion.votes_up,
        votes_down=suggestion.votes_down,
        score=suggestion.calculate_score(),
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at
    )

@router.post("/suggestions/{suggestion_id}/vote")
async def vote_on_suggestion(
    suggestion_id: int,
    vote_data: PromptSuggestionVoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Vote on a prompt suggestion."""
    # Verify suggestion exists
    suggestion_result = await db.execute(
        select(PromptSuggestion).where(PromptSuggestion.id == suggestion_id)
    )
    suggestion = suggestion_result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found"
        )
    
    # Check if user already voted
    existing_vote_result = await db.execute(
        select(PromptSuggestionVote).where(
            and_(
                PromptSuggestionVote.suggestion_id == suggestion_id,
                PromptSuggestionVote.user_id == current_user.id
            )
        )
    )
    existing_vote = existing_vote_result.scalar_one_or_none()
    
    if existing_vote:
        # Update existing vote
        existing_vote.is_upvote = vote_data.is_upvote
    else:
        # Create new vote
        new_vote = PromptSuggestionVote(
            suggestion_id=suggestion_id,
            user_id=current_user.id,
            is_upvote=vote_data.is_upvote
        )
        db.add(new_vote)
    
    # Recalculate vote counts
    votes_result = await db.execute(
        select(PromptSuggestionVote).where(PromptSuggestionVote.suggestion_id == suggestion_id)
    )
    all_votes = votes_result.scalars().all()
    
    suggestion.votes_up = sum(1 for vote in all_votes if vote.is_upvote)
    suggestion.votes_down = sum(1 for vote in all_votes if not vote.is_upvote)
    
    await db.commit()
    
    return {"message": "Vote recorded", "new_score": suggestion.calculate_score()}

# ========================================
# COLLABORATION INVITATIONS
# ========================================

@router.post("/conversations/{conversation_id}/invite", response_model=CollaborationInviteResponse)
async def invite_collaborator(
    conversation_id: int,
    invite_data: CollaborationInviteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite a user to collaborate on a conversation."""
    # Verify conversation ownership
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
            detail="Only conversation owner can invite collaborators"
        )
    
    # Verify invitee exists
    invitee_result = await db.execute(
        select(User).where(User.username == invite_data.invitee_username)
    )
    invitee = invitee_result.scalar_one_or_none()
    
    if not invitee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if invitee.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invite yourself"
        )
    
    # Check for existing invitation
    existing_invite_result = await db.execute(
        select(CollaborationInvitation).where(
            and_(
                CollaborationInvitation.conversation_id == conversation_id,
                CollaborationInvitation.invitee_id == invitee.id,
                CollaborationInvitation.is_accepted.is_(None)  # Pending
            )
        )
    )
    
    if existing_invite_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation already pending"
        )
    
    # Create invitation
    invitation = CollaborationInvitation(
        conversation_id=conversation_id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        collaboration_type=invite_data.collaboration_type,
        permissions=invite_data.permissions,
        message=invite_data.message,
        expires_at=datetime.utcnow() + timedelta(days=7)  # 7-day expiry
    )
    
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    
    return CollaborationInviteResponse(
        id=invitation.id,
        conversation_id=invitation.conversation_id,
        inviter_username=current_user.username,
        invitee_username=invitee.username,
        collaboration_type=invitation.collaboration_type,
        permissions=invitation.permissions,
        message=invitation.message,
        is_accepted=invitation.is_accepted,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at
    )

@router.post("/invitations/{invitation_id}/respond")
async def respond_to_invitation(
    invitation_id: int,
    accept: bool,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept or reject a collaboration invitation."""
    # Get invitation
    invitation_result = await db.execute(
        select(CollaborationInvitation)
        .options(joinedload(CollaborationInvitation.inviter))
        .where(CollaborationInvitation.id == invitation_id)
    )
    invitation = invitation_result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    if invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your invitation"
        )
    
    if not invitation.is_pending():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation already responded to or expired"
        )
    
    # Update invitation
    invitation.is_accepted = accept
    invitation.responded_at = datetime.utcnow()
    
    # If accepted, create collaboration record
    if accept:
        collaboration = ConversationCollaboration(
            conversation_id=invitation.conversation_id,
            collaborator_id=current_user.id,
            invited_by_id=invitation.inviter_id,
            collaboration_type=invitation.collaboration_type,
            permissions=invitation.permissions,
            accepted_at=datetime.utcnow()
        )
        db.add(collaboration)
    
    await db.commit()
    
    return {"message": "Invitation " + ("accepted" if accept else "rejected")}

@router.get("/my-invitations", response_model=List[CollaborationInviteResponse])
async def get_my_invitations(
    pending_only: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get collaboration invitations for the current user."""
    query = (
        select(CollaborationInvitation)
        .options(
            joinedload(CollaborationInvitation.inviter),
            joinedload(CollaborationInvitation.conversation)
        )
        .where(CollaborationInvitation.invitee_id == current_user.id)
    )
    
    if pending_only:
        query = query.where(CollaborationInvitation.is_accepted.is_(None))
    
    query = query.order_by(desc(CollaborationInvitation.created_at))
    
    result = await db.execute(query)
    invitations = result.scalars().all()
    
    return [
        CollaborationInviteResponse(
            id=inv.id,
            conversation_id=inv.conversation_id,
            conversation_title=inv.conversation.title,
            inviter_username=inv.inviter.username,
            invitee_username=current_user.username,
            collaboration_type=inv.collaboration_type,
            permissions=inv.permissions,
            message=inv.message,
            is_accepted=inv.is_accepted,
            created_at=inv.created_at,
            expires_at=inv.expires_at
        )
        for inv in invitations
    ]

# ========================================
# COLLABORATION STATS
# ========================================

@router.get("/conversations/{conversation_id}/stats", response_model=CollaborationStatsResponse)
async def get_collaboration_stats(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get collaboration statistics for a conversation."""
    # Verify access
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if not conversation.is_public and conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this conversation"
        )
    
    # Count suggestions by status
    suggestions_result = await db.execute(
        select(
            PromptSuggestion.status,
            func.count(PromptSuggestion.id).label('count')
        )
        .where(PromptSuggestion.conversation_id == conversation_id)
        .group_by(PromptSuggestion.status)
    )
    
    suggestion_counts = {row.status: row.count for row in suggestions_result}
    
    # Count active collaborators
    collaborators_result = await db.execute(
        select(func.count(ConversationCollaboration.id))
        .where(
            and_(
                ConversationCollaboration.conversation_id == conversation_id,
                ConversationCollaboration.is_active == True
            )
        )
    )
    
    active_collaborators = collaborators_result.scalar() or 0
    
    # Count total votes
    votes_result = await db.execute(
        select(func.count(PromptSuggestionVote.id))
        .join(PromptSuggestion)
        .where(PromptSuggestion.conversation_id == conversation_id)
    )
    
    total_votes = votes_result.scalar() or 0
    
    return CollaborationStatsResponse(
        conversation_id=conversation_id,
        total_suggestions=sum(suggestion_counts.values()),
        pending_suggestions=suggestion_counts.get(PromptSuggestionStatus.PENDING, 0),
        accepted_suggestions=suggestion_counts.get(PromptSuggestionStatus.ACCEPTED, 0),
        rejected_suggestions=suggestion_counts.get(PromptSuggestionStatus.REJECTED, 0),
        integrated_suggestions=suggestion_counts.get(PromptSuggestionStatus.INTEGRATED, 0),
        active_collaborators=active_collaborators,
        total_votes=total_votes
    )