from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, Dict, Any
from app.database import get_db
from app.models import User, Conversation
from app.auth import get_current_user, get_current_user_optional
from app.services.vector_service import vector_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/search")
async def search_conversations(
    query: str,
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=20, description="Results per page (max 20)"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Semantic search for conversations.
    
    - Anonymous users: First page only (20 results max)
    - Logged-in users: Full pagination access
    - Results ordered by semantic similarity
    - Only public conversations with summaries are searchable
    """
    try:
        # Validate query
        if not query or not query.strip():
            raise HTTPException(status_code=400, detail="Search query cannot be empty")
        
        # Anonymous users can only access first page
        if not current_user and page > 1:
            raise HTTPException(
                status_code=401, 
                detail="Login required to access additional pages"
            )
        
        # Calculate offset for pagination
        offset = (page - 1) * limit
        
        # Perform semantic search
        search_results = vector_service.semantic_search(
            query=query.strip(),
            limit=limit,
            offset=offset
        )
        
        # Format results for API response
        conversations = []
        if search_results['results']['ids'][0]:
            for i, conv_id in enumerate(search_results['results']['ids'][0]):
                try:
                    conversation_id = int(conv_id)
                    metadata = search_results['results']['metadatas'][0][i]
                    document = search_results['results']['documents'][0][i]
                    similarity_score = 1.0 - search_results['results']['distances'][0][i]  # Convert distance to similarity
                    
                    # Get full conversation details from database
                    conversation_result = await db.execute(
                        select(Conversation).where(
                            Conversation.id == conversation_id,
                            Conversation.is_public == True,
                            Conversation.summary_public.isnot(None)  # Only conversations with summaries
                        )
                    )
                    conversation = conversation_result.scalar_one_or_none()
                    
                    if conversation:
                        conversations.append({
                            "id": conversation.id,
                            "title": conversation.title,
                            "summary": conversation.summary_public,  # PII-filtered summary
                            "created_at": conversation.created_at.isoformat(),
                            "view_count": conversation.view_count,
                            "similarity_score": round(similarity_score, 3),
                            "author": {
                                "username": metadata.get("username"),
                                "display_name": metadata.get("display_name")
                            }
                        })
                
                except (ValueError, KeyError) as e:
                    logger.warning(f"Error processing search result {conv_id}: {e}")
                    continue
        
        # Pagination info
        total_found = search_results['total_found']
        has_more = search_results['has_more'] and (current_user is not None or page == 1)
        
        return {
            "conversations": conversations,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_found": total_found,
                "has_more": has_more,
                "is_anonymous": current_user is None
            },
            "query": query
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in conversation search: {e}")
        raise HTTPException(status_code=500, detail="Search service temporarily unavailable")


@router.get("/discover")
async def discover_conversations(
    limit: int = Query(20, ge=1, le=20, description="Number of conversations to return (max 20)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Browse recent public conversations for discovery.
    
    - Returns 20 most recent public conversations with summaries
    - No authentication required
    - Ordered by creation time (most recent first)
    - Shows PII-filtered summaries only
    """
    try:
        # Get recent conversations from vector database
        discovery_results = vector_service.get_nearest_conversations(limit=limit)
        
        # Format results for API response
        conversations = []
        if discovery_results['results']['ids']:
            for i, conv_id in enumerate(discovery_results['results']['ids']):
                try:
                    conversation_id = int(conv_id)
                    metadata = discovery_results['results']['metadatas'][i]
                    
                    # Get full conversation details from database
                    conversation_result = await db.execute(
                        select(Conversation).where(
                            Conversation.id == conversation_id,
                            Conversation.is_public == True,
                            Conversation.summary_public.isnot(None)
                        )
                    )
                    conversation = conversation_result.scalar_one_or_none()
                    
                    if conversation:
                        conversations.append({
                            "id": conversation.id,
                            "title": conversation.title,
                            "summary": conversation.summary_public,  # PII-filtered
                            "created_at": conversation.created_at.isoformat(),
                            "view_count": conversation.view_count,
                            "author": {
                                "username": metadata.get("username"),
                                "display_name": metadata.get("display_name")
                            }
                        })
                
                except (ValueError, KeyError) as e:
                    logger.warning(f"Error processing discovery result {conv_id}: {e}")
                    continue
        
        return {
            "conversations": conversations,
            "total_found": len(conversations)
        }
        
    except Exception as e:
        logger.error(f"Error in conversation discovery: {e}")
        raise HTTPException(status_code=500, detail="Discovery service temporarily unavailable")


@router.get("/similar/{conversation_id}")
async def find_similar_conversations(
    conversation_id: int,
    limit: int = Query(5, ge=1, le=10, description="Number of similar conversations (max 10)"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Find conversations similar to a given conversation.
    
    - Uses the conversation's summary to find semantically similar conversations
    - Excludes the original conversation from results
    - Returns public conversations only
    """
    try:
        # Get the source conversation
        conversation_result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.is_public == True
            )
        )
        conversation = conversation_result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found or not public")
        
        if not conversation.summary_public:
            raise HTTPException(status_code=400, detail="Conversation does not have a summary yet")
        
        # Use the conversation's summary as the search query
        search_results = vector_service.semantic_search(
            query=conversation.summary_public,
            limit=limit + 1,  # Get one extra to exclude the original
            offset=0
        )
        
        # Format results, excluding the original conversation
        similar_conversations = []
        if search_results['results']['ids'][0]:
            for i, conv_id in enumerate(search_results['results']['ids'][0]):
                try:
                    similar_id = int(conv_id)
                    
                    # Skip the original conversation
                    if similar_id == conversation_id:
                        continue
                    
                    metadata = search_results['results']['metadatas'][0][i]
                    similarity_score = 1.0 - search_results['results']['distances'][0][i]
                    
                    # Get conversation details
                    similar_result = await db.execute(
                        select(Conversation).where(
                            Conversation.id == similar_id,
                            Conversation.is_public == True,
                            Conversation.summary_public.isnot(None)
                        )
                    )
                    similar_conv = similar_result.scalar_one_or_none()
                    
                    if similar_conv and len(similar_conversations) < limit:
                        similar_conversations.append({
                            "id": similar_conv.id,
                            "title": similar_conv.title,
                            "summary": similar_conv.summary_public,
                            "created_at": similar_conv.created_at.isoformat(),
                            "view_count": similar_conv.view_count,
                            "similarity_score": round(similarity_score, 3),
                            "author": {
                                "username": metadata.get("username"),
                                "display_name": metadata.get("display_name")
                            }
                        })
                
                except (ValueError, KeyError) as e:
                    logger.warning(f"Error processing similar conversation {conv_id}: {e}")
                    continue
        
        return {
            "source_conversation": {
                "id": conversation.id,
                "title": conversation.title
            },
            "similar_conversations": similar_conversations,
            "total_found": len(similar_conversations)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding similar conversations: {e}")
        raise HTTPException(status_code=500, detail="Similar conversation service temporarily unavailable")


@router.get("/stats")
async def get_search_stats():
    """
    Get statistics about the searchable conversation database.
    
    - Total number of indexed conversations
    - No authentication required
    """
    try:
        total_conversations = vector_service.get_conversation_count()
        
        return {
            "total_indexed_conversations": total_conversations,
            "search_features": {
                "semantic_search": True,
                "pagination": True,
                "anonymous_access": "first_page_only",
                "max_results_per_page": 20
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting search stats: {e}")
        raise HTTPException(status_code=500, detail="Stats service temporarily unavailable")