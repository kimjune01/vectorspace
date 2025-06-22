"""
Curation system API endpoints for saved conversations and collections.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Conversation, SavedConversation, Collection, CollectionItem, Message
from app.schemas.social import (
    SaveConversationRequest,
    SavedConversationResponse,
    UpdateSavedConversationRequest,
    CollectionCreate,
    CollectionUpdate,
    CollectionResponse,
    CollectionWithItemsResponse,
    AddToCollectionRequest,
    PaginatedSavedConversationsResponse,
    PaginatedCollectionsResponse,
    CreateConversationFromExternalRequest,
    CreateConversationFromExternalResponse
)

router = APIRouter(prefix="/curation", tags=["curation"])


# ========================================
# SAVED CONVERSATIONS ENDPOINTS
# ========================================

@router.post("/conversations/{conversation_id}/save", response_model=SavedConversationResponse)
async def save_conversation(
    conversation_id: int,
    request: SaveConversationRequest = SaveConversationRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save a conversation with optional tags and personal note."""
    # Check if conversation exists
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if already saved
    existing = await db.execute(
        select(SavedConversation).where(
            SavedConversation.user_id == current_user.id,
            SavedConversation.conversation_id == conversation_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Conversation already saved")
    
    # Create saved conversation
    saved = SavedConversation(
        user_id=current_user.id,
        conversation_id=conversation_id,
        tags=request.tags or [],
        personal_note=request.personal_note
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    
    # Load conversation details for response
    await db.refresh(saved, ["conversation", "conversation.user"])
    
    return SavedConversationResponse(
        id=saved.id,
        user_id=saved.user_id,
        conversation_id=saved.conversation_id,
        saved_at=saved.saved_at,
        tags=saved.tags,
        personal_note=saved.personal_note,
        conversation_title=saved.conversation.title,
        conversation_summary=saved.conversation.summary,
        conversation_author=saved.conversation.user.username
    )


@router.delete("/conversations/{conversation_id}/save")
async def unsave_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a conversation from saved list."""
    result = await db.execute(
        select(SavedConversation).where(
            SavedConversation.user_id == current_user.id,
            SavedConversation.conversation_id == conversation_id
        )
    )
    saved = result.scalar_one_or_none()
    
    if not saved:
        raise HTTPException(status_code=404, detail="Saved conversation not found")
    
    await db.delete(saved)
    await db.commit()
    
    return {"message": "Conversation unsaved successfully"}


@router.patch("/saved/{saved_id}", response_model=SavedConversationResponse)
async def update_saved_conversation(
    saved_id: int,
    request: UpdateSavedConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update tags or personal note for a saved conversation."""
    # Get saved conversation
    result = await db.execute(
        select(SavedConversation).where(
            SavedConversation.id == saved_id,
            SavedConversation.user_id == current_user.id
        )
    )
    saved = result.scalar_one_or_none()
    
    if not saved:
        raise HTTPException(status_code=404, detail="Saved conversation not found")
    
    # Update fields
    if request.tags is not None:
        saved.tags = request.tags
    if request.personal_note is not None:
        saved.personal_note = request.personal_note
    
    await db.commit()
    await db.refresh(saved, ["conversation", "conversation.user"])
    
    return SavedConversationResponse(
        id=saved.id,
        user_id=saved.user_id,
        conversation_id=saved.conversation_id,
        saved_at=saved.saved_at,
        tags=saved.tags,
        personal_note=saved.personal_note,
        conversation_title=saved.conversation.title,
        conversation_summary=saved.conversation.summary,
        conversation_author=saved.conversation.user.username
    )


@router.get("/saved", response_model=PaginatedSavedConversationsResponse)
async def get_saved_conversations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tag: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's saved conversations with optional tag filtering."""
    # Build query
    query = select(SavedConversation).where(SavedConversation.user_id == current_user.id)
    
    if tag:
        query = query.where(SavedConversation.tags.contains([tag]))
    
    # Count total
    count_query = select(func.count(SavedConversation.id)).where(SavedConversation.user_id == current_user.id)
    if tag:
        count_query = count_query.where(SavedConversation.tags.contains([tag]))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination and ordering
    query = query.options(selectinload(SavedConversation.conversation).selectinload(Conversation.user))
    query = query.order_by(SavedConversation.saved_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    result = await db.execute(query)
    saved_conversations = result.scalars().all()
    
    # Convert to response format
    saved_responses = []
    for saved in saved_conversations:
        saved_responses.append(SavedConversationResponse(
            id=saved.id,
            user_id=saved.user_id,
            conversation_id=saved.conversation_id,
            saved_at=saved.saved_at,
            tags=saved.tags,
            personal_note=saved.personal_note,
            conversation_title=saved.conversation.title,
            conversation_summary=saved.conversation.summary,
            conversation_author=saved.conversation.user.username
        ))
    
    return PaginatedSavedConversationsResponse(
        saved_conversations=saved_responses,
        total=total,
        page=page,
        per_page=per_page,
        has_next=total > page * per_page,
        has_prev=page > 1
    )


@router.get("/saved/check/{conversation_id}")
async def check_if_saved(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if a conversation is saved by the current user."""
    result = await db.execute(
        select(SavedConversation).where(
            SavedConversation.user_id == current_user.id,
            SavedConversation.conversation_id == conversation_id
        )
    )
    saved = result.scalar_one_or_none()
    
    return {"is_saved": saved is not None}


@router.post("/conversations", response_model=CreateConversationFromExternalResponse)
async def create_conversation_from_external(
    request: CreateConversationFromExternalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation from external content and save it to user's collection."""
    # Create the conversation
    conversation = Conversation(
        user_id=current_user.id,
        title=request.title,
        is_public=request.is_public,
        summary_public=f"External content from {request.source_type or 'unknown source'}: {request.title}"
    )
    db.add(conversation)
    await db.flush()  # Get the conversation ID
    
    # Create the initial message with the external content
    message = Message(
        conversation_id=conversation.id,
        from_user_id=current_user.id,
        role="user",
        message_type="chat",
        content=request.content,
        token_count=len(request.content.split())  # Simple token count approximation
    )
    db.add(message)
    
    # Add source information as a system message if URL is provided
    if request.source_url:
        source_message = Message(
            conversation_id=conversation.id,
            from_user_id=None,  # System message
            role="system",
            message_type="system",
            content=f"Source: {request.source_url}",
            token_count=len(request.source_url.split())
        )
        db.add(source_message)
    
    await db.flush()  # Ensure messages are created
    
    # Update conversation token count
    conversation.token_count = sum([message.token_count for message in [message] + ([source_message] if request.source_url else [])])
    conversation.last_message_at = message.timestamp
    
    # Save the conversation to user's collection
    saved_conversation = SavedConversation(
        user_id=current_user.id,
        conversation_id=conversation.id,
        tags=request.tags or [],
        personal_note=request.personal_note
    )
    db.add(saved_conversation)
    
    await db.commit()
    await db.refresh(conversation)
    await db.refresh(saved_conversation)
    
    return CreateConversationFromExternalResponse(
        conversation_id=conversation.id,
        saved_conversation_id=saved_conversation.id,
        title=conversation.title,
        content=request.content,
        source_url=request.source_url,
        source_type=request.source_type,
        tags=saved_conversation.tags,
        personal_note=saved_conversation.personal_note,
        is_public=conversation.is_public,
        created_at=conversation.created_at,
        saved_at=saved_conversation.saved_at
    )


# ========================================
# COLLECTIONS ENDPOINTS
# ========================================

@router.post("/collections", response_model=CollectionResponse)
async def create_collection(
    request: CollectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new collection."""
    # Check if collection name already exists for user
    existing = await db.execute(
        select(Collection).where(
            Collection.user_id == current_user.id,
            Collection.name == request.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Collection with this name already exists")
    
    # Create collection
    collection = Collection(
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        is_public=request.is_public if request.is_public is not None else True
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    
    # Add initial conversations if provided
    if request.conversation_ids:
        for conv_id in request.conversation_ids:
            # Check if conversation exists
            conversation = await db.get(Conversation, conv_id)
            if conversation:
                item = CollectionItem(
                    collection_id=collection.id,
                    conversation_id=conv_id
                )
                db.add(item)
        await db.commit()
    
    # Get item count
    count_result = await db.execute(
        select(func.count(CollectionItem.id)).where(CollectionItem.collection_id == collection.id)
    )
    items_count = count_result.scalar() or 0
    
    return CollectionResponse(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        items_count=items_count
    )


@router.get("/collections", response_model=PaginatedCollectionsResponse)
async def get_my_collections(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's collections."""
    # Count total
    count_result = await db.execute(
        select(func.count(Collection.id)).where(Collection.user_id == current_user.id)
    )
    total = count_result.scalar() or 0
    
    # Get collections with item counts
    query = select(Collection).where(Collection.user_id == current_user.id)
    query = query.order_by(Collection.updated_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    result = await db.execute(query)
    collections = result.scalars().all()
    
    # Get item counts for each collection
    collection_responses = []
    for collection in collections:
        count_result = await db.execute(
            select(func.count(CollectionItem.id)).where(CollectionItem.collection_id == collection.id)
        )
        items_count = count_result.scalar() or 0
        
        collection_responses.append(CollectionResponse(
            id=collection.id,
            user_id=collection.user_id,
            name=collection.name,
            description=collection.description,
            is_public=collection.is_public,
            created_at=collection.created_at,
            updated_at=collection.updated_at,
            items_count=items_count
        ))
    
    return PaginatedCollectionsResponse(
        collections=collection_responses,
        total=total,
        page=page,
        per_page=per_page,
        has_next=total > page * per_page,
        has_prev=page > 1
    )


@router.get("/collections/{collection_id}", response_model=CollectionWithItemsResponse)
async def get_collection_details(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get collection details with all conversations."""
    # Get collection
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check access (owner or public)
    if collection.user_id != current_user.id and not collection.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get collection items with conversation details
    items_result = await db.execute(
        select(SavedConversation)
        .join(CollectionItem, CollectionItem.conversation_id == SavedConversation.conversation_id)
        .where(
            CollectionItem.collection_id == collection_id,
            SavedConversation.user_id == collection.user_id
        )
        .options(selectinload(SavedConversation.conversation).selectinload(Conversation.user))
    )
    saved_conversations = items_result.scalars().all()
    
    # Convert to response format
    saved_responses = []
    for saved in saved_conversations:
        saved_responses.append(SavedConversationResponse(
            id=saved.id,
            user_id=saved.user_id,
            conversation_id=saved.conversation_id,
            saved_at=saved.saved_at,
            tags=saved.tags,
            personal_note=saved.personal_note,
            conversation_title=saved.conversation.title,
            conversation_summary=saved.conversation.summary,
            conversation_author=saved.conversation.user.username
        ))
    
    return CollectionWithItemsResponse(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        items=saved_responses
    )


@router.patch("/collections/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: int,
    request: CollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update collection details."""
    # Get collection
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update fields
    if request.name is not None:
        # Check if new name already exists
        existing = await db.execute(
            select(Collection).where(
                Collection.user_id == current_user.id,
                Collection.name == request.name,
                Collection.id != collection_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Collection with this name already exists")
        collection.name = request.name
    
    if request.description is not None:
        collection.description = request.description
    
    if request.is_public is not None:
        collection.is_public = request.is_public
    
    await db.commit()
    await db.refresh(collection)
    
    # Get item count
    count_result = await db.execute(
        select(func.count(CollectionItem.id)).where(CollectionItem.collection_id == collection.id)
    )
    items_count = count_result.scalar() or 0
    
    return CollectionResponse(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        items_count=items_count
    )


@router.post("/collections/{collection_id}/items")
async def add_to_collection(
    collection_id: int,
    request: AddToCollectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add conversations to a collection."""
    # Get collection
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    added_count = 0
    for conv_id in request.conversation_ids:
        # Check if conversation exists and user has saved it
        saved_result = await db.execute(
            select(SavedConversation).where(
                SavedConversation.user_id == current_user.id,
                SavedConversation.conversation_id == conv_id
            )
        )
        if not saved_result.scalar_one_or_none():
            continue  # Skip if not saved
        
        # Check if already in collection
        existing = await db.execute(
            select(CollectionItem).where(
                CollectionItem.collection_id == collection_id,
                CollectionItem.conversation_id == conv_id
            )
        )
        if not existing.scalar_one_or_none():
            item = CollectionItem(
                collection_id=collection_id,
                conversation_id=conv_id
            )
            db.add(item)
            added_count += 1
    
    await db.commit()
    
    return {
        "message": f"Added {added_count} conversations to collection",
        "added_count": added_count
    }


@router.delete("/collections/{collection_id}/items/{conversation_id}")
async def remove_from_collection(
    collection_id: int,
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a conversation from a collection."""
    # Get collection
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete item
    await db.execute(
        delete(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.conversation_id == conversation_id
        )
    )
    await db.commit()
    
    return {"message": "Conversation removed from collection"}


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a collection and all its items."""
    # Get collection
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete collection (cascade will delete items)
    await db.delete(collection)
    await db.commit()
    
    return {"message": "Collection deleted successfully"}