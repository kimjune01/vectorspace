from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Conversation, Message
from app.services.pii_filter import PIIFilter


class SummaryService:
    """Service for generating conversation summaries."""
    
    def __init__(self):
        self.pii_filter = PIIFilter()
    
    async def check_and_generate_summary(
        self, 
        conversation_id: int, 
        db: AsyncSession,
        update_title: bool = True,
        force_generate: bool = False
    ) -> Optional[str]:
        """Check if conversation needs summary and generate if required.
        
        Args:
            conversation_id: ID of the conversation
            db: Database session
            update_title: Whether to update conversation title when summary is generated
            force_generate: Whether to generate summary regardless of token count
        
        Returns the generated summary if one was created, None otherwise.
        """
        # Get conversation with messages
        conversation = await db.get(Conversation, conversation_id)
        
        if not conversation:
            return None
        
        # Check if summary already exists or if we need to generate one
        if conversation.summary_raw is not None:
            return conversation.summary_raw  # type: ignore
        
        # Check if conversation has reached 1500 tokens (unless forcing)
        if not force_generate and not conversation.should_auto_archive():
            return None
        
        # Generate summary
        summary = await self.generate_summary(conversation_id, db)
        
        if summary:
            # Store both raw and filtered versions
            conversation.summary_raw = summary  # type: ignore
            conversation.summary_public = self.pii_filter.filter_text(summary)
            await db.commit()
            
            # Generate and store embedding in ChromaDB
            await self._store_embedding(conversation, summary, db)
            
            # Update conversation title based on new summary
            if update_title:
                try:
                    await self._update_conversation_title(conversation_id, summary, db)
                except Exception as e:
                    print(f"Error updating title in check_and_generate_summary: {e}")
            
            return summary
        
        return None
    
    async def generate_summary(
        self, 
        conversation_id: int, 
        db: AsyncSession
    ) -> Optional[str]:
        """Generate a summary from conversation messages."""
        # Get all messages for the conversation
        messages_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.timestamp)
        )
        messages = messages_result.scalars().all()
        
        if not messages:
            return None
        
        # For now, use extractive summarization
        # In production, this would integrate with an AI service
        return self._generate_extractive_summary(list(messages))
    
    def _generate_extractive_summary(self, messages: List[Message]) -> str:
        """Generate a comprehensive summary for HN recommendations and similarity matching.
        
        This creates a more detailed summary that includes the main topics,
        technical terms, and context from the conversation to enable better
        semantic similarity matching with Hacker News articles.
        """
        if not messages:
            return ""

        # Collect all message content to analyze themes and topics
        user_messages = [msg.content for msg in messages if msg.role == "user"]
        assistant_messages = [msg.content for msg in messages if msg.role == "assistant"]
        
        if not user_messages:
            return "New Conversation"
        
        # Create a more comprehensive summary for better HN matching
        summary_parts = []
        
        # Add primary topic from first user message
        first_user_msg = user_messages[0]
        if len(first_user_msg.split()) > 3:
            summary_parts.append(f"Discussion about {' '.join(first_user_msg.split()[:10])}")
        else:
            summary_parts.append(first_user_msg)
        
        # Extract key technical terms and topics
        all_content = " ".join(user_messages + assistant_messages)
        tech_keywords = self._extract_key_terms(all_content)
        
        if tech_keywords:
            summary_parts.append(f"Topics include: {', '.join(tech_keywords[:5])}")
        
        # Add conversation context if multiple exchanges
        if len(messages) > 2:
            summary_parts.append(f"Interactive conversation with {len(user_messages)} user messages covering technical implementation, best practices, and problem-solving approaches.")
        
        # Combine and limit length
        full_summary = ". ".join(summary_parts)
        
        # Keep summary reasonable length for vector similarity
        if len(full_summary) > 300:
            full_summary = full_summary[:297] + "..."
        
        return full_summary
    
    def _extract_key_terms(self, text: str) -> List[str]:
        """Extract key technical terms and topics from conversation text."""
        import re
        
        # Common technical keywords to look for
        tech_patterns = [
            r'\b(?:API|REST|GraphQL|JSON|XML|HTTP|HTTPS|WebSocket|OAuth|JWT)\b',
            r'\b(?:React|Vue|Angular|JavaScript|TypeScript|Node\.js|Python|Java|Go|Rust)\b',
            r'\b(?:Docker|Kubernetes|AWS|Azure|GCP|CI\/CD|Git|GitHub)\b',
            r'\b(?:database|SQL|NoSQL|MongoDB|PostgreSQL|MySQL|Redis)\b',
            r'\b(?:machine learning|AI|neural network|deep learning|algorithm)\b',
            r'\b(?:frontend|backend|fullstack|microservices|serverless)\b',
            r'\b(?:performance|optimization|security|authentication|authorization)\b',
            r'\b(?:testing|debugging|deployment|monitoring|logging)\b'
        ]
        
        found_terms = []
        text_lower = text.lower()
        
        for pattern in tech_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            found_terms.extend(matches)
        
        # Remove duplicates and return most common terms
        unique_terms = list(set(found_terms))
        return unique_terms[:8]  # Return top 8 terms
    
    async def force_generate_summary(
        self, 
        conversation_id: int, 
        db: AsyncSession,
        update_title: bool = True
    ) -> Optional[str]:
        """Force generate summary regardless of token count.
        
        Args:
            conversation_id: ID of the conversation
            db: Database session
            update_title: Whether to update conversation title when summary is generated
        
        Useful for manual archiving or testing.
        """
        summary = await self.generate_summary(conversation_id, db)
        
        if summary:
            # Get conversation and update summaries
            conversation = await db.get(Conversation, conversation_id)
            
            if conversation:
                conversation.summary_raw = summary  # type: ignore
                conversation.summary_public = self.pii_filter.filter_text(summary)
                await db.commit()
                
                # Generate and store embedding
                await self._store_embedding(conversation, summary, db)
                
                # Update conversation title based on new summary
                if update_title:
                    try:
                        await self._update_conversation_title(conversation_id, summary, db)
                    except Exception as e:
                        print(f"Error updating title in force_generate_summary: {e}")
        
        return summary
    
    def estimate_summary_tokens(self, summary: str) -> int:
        """Estimate token count for a summary."""
        return Message.estimate_token_count(summary)
    
    async def _store_embedding(self, conversation: Conversation, summary: str, db: AsyncSession):
        """Store conversation embedding in ChromaDB."""
        try:
            from app.services.vector_service import vector_service
            from sqlalchemy import select
            from app.models import User
            
            # Get user info for metadata
            user = await db.get(User, conversation.user_id)
            
            if user:
                # Use the filtered summary for embedding to ensure no PII
                filtered_summary = conversation.summary_public or self.pii_filter.filter_text(summary)
                
                success = await vector_service.store_conversation_embedding(
                    conversation_id=conversation.id,  # type: ignore
                    summary=filtered_summary,  # type: ignore
                    user_id=user.id,  # type: ignore
                    username=user.username,  # type: ignore
                    display_name=user.display_name,  # type: ignore
                    title=conversation.title,  # type: ignore
                    created_at=conversation.created_at.isoformat()
                )
                
                if success:
                    print(f"Successfully stored embedding for conversation {conversation.id}")
                else:
                    print(f"Failed to store embedding for conversation {conversation.id}")
            
        except Exception as e:
            print(f"Error storing embedding: {e}")
    
    def _truncate_text(self, text: str, max_length: int) -> str:
        """Truncate text to max_length at word boundary."""
        if len(text) <= max_length:
            return text
        
        # Find the last space within max_length
        truncated = text[:max_length]
        last_space = truncated.rfind(' ')
        
        if last_space > 0:
            truncated = truncated[:last_space]
        
        return truncated + "..."
    
    async def _update_conversation_title(self, conversation_id: int, summary: str, db: AsyncSession):
        """Update conversation title based on new summary."""
        try:
            from app.services.title_service import title_service
            
            # Try to generate title from summary first, fallback to messages
            new_title = await title_service.generate_title_from_summary(summary)
            
            if not new_title:
                # Fallback to generating from messages
                new_title = await title_service.generate_title_from_messages(conversation_id, db)
            
            if new_title:
                # Get conversation and update title
                conversation = await db.get(Conversation, conversation_id)
                
                if conversation and new_title != conversation.title:
                    # Only update if title appears to be auto-generated (not custom)
                    if not title_service._is_custom_title(conversation.title):  # type: ignore
                        conversation.title = new_title  # type: ignore
                        await db.commit()
                        print(f"Updated title for conversation {conversation_id}: {new_title}")
                    else:
                        print(f"Skipped title update for conversation {conversation_id} (custom title detected)")
        
        except Exception as e:
            print(f"Error updating conversation title: {e}")


# Global instance
summary_service = SummaryService()