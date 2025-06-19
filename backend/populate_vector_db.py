#!/usr/bin/env python3
"""
Vector Database Population Script
=================================

This script populates the ChromaDB vector database with conversation summaries
for semantic search functionality.
"""

import asyncio
import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import async_session, Base, engine
from app.models import User, Conversation, Message
from app.services.vector_service import VectorService
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def populate_vector_database():
    """Populate ChromaDB with conversation summaries for semantic search."""
    print("🔍 Populating vector database for semantic search...")
    
    # Initialize vector service
    vector_service = VectorService()
    
    # Get all conversations with their messages
    async with async_session() as session:
        result = await session.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.is_public == True)
        )
        conversations = result.scalars().all()
    
    print(f"📚 Found {len(conversations)} public conversations to process")
    
    # Process each conversation
    for i, conversation in enumerate(conversations, 1):
        print(f"\n{i}/{len(conversations)}: Processing '{conversation.title}'")
        
        try:
            # Create comprehensive summary for better semantic search
            summary = conversation.summary_public if conversation.summary_public else conversation.title
            
            # Add all message content to improve search
            if conversation.messages:
                message_content = " ".join([msg.content for msg in conversation.messages])
                # Combine title, summary, and first part of content
                full_content = f"{conversation.title} {summary} {message_content[:500]}"
            else:
                full_content = f"{conversation.title} {summary}"
            
            # Create metadata
            metadata = {
                "conversation_id": conversation.id,
                "title": conversation.title,
                "summary": summary,
                "user_id": conversation.user_id,
                "token_count": conversation.token_count,
                "message_count": len(conversation.messages) if conversation.messages else 0,
                "created_at": conversation.created_at.isoformat(),
            }
            
            # Add to vector database
            vector_service.add_conversation_summary(
                conversation_id=str(conversation.id),
                summary=full_content,
                metadata=metadata
            )
            
            print(f"  ✅ Added to vector DB: {len(full_content)} chars")
            
        except Exception as e:
            print(f"  ❌ Error processing conversation {conversation.id}: {e}")
    
    print(f"\n🎉 Vector database populated with {len(conversations)} conversations!")
    print("\n🔍 Ready for semantic search testing!")

async def test_semantic_search():
    """Test semantic search functionality with sample queries."""
    print("\n🧪 Testing Semantic Search Functionality")
    print("=" * 50)
    
    vector_service = VectorService()
    
    # Test queries that should match our seeded content
    test_queries = [
        ("machine learning algorithms", "Should find ML conversation"),
        ("renewable energy solar wind", "Should find energy conversation"),
        ("web development performance", "Should find web dev conversation"),
        ("productivity psychology motivation", "Should find productivity conversation"),
        ("quantum computing qubits", "Should find quantum conversation"),
        ("sustainable cities urban planning", "Should find urban planning conversation"),
        ("memory learning strategies", "Should find memory/learning conversation"),
        ("blockchain cryptocurrency applications", "Should find blockchain conversation"),
    ]
    
    for query, expected in test_queries:
        print(f"\n🔍 Query: '{query}'")
        print(f"Expected: {expected}")
        
        try:
            results = vector_service.search_similar_conversations(
                query=query,
                n_results=3
            )
            
            if results and 'documents' in results and results['documents']:
                print(f"  ✅ Found {len(results['documents'][0])} results:")
                for j, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
                    title = metadata.get('title', 'No title')
                    print(f"    {j+1}. {title}")
                    if j < 2:  # Show first few chars of content
                        content_preview = doc[:100] + "..." if len(doc) > 100 else doc
                        print(f"       Content: {content_preview}")
            else:
                print("  ❌ No results found")
                
        except Exception as e:
            print(f"  ❌ Search error: {e}")

if __name__ == "__main__":
    asyncio.run(populate_vector_database())
    asyncio.run(test_semantic_search())