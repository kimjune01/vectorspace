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
        update_title: bool = True
    ) -> Optional[str]:
        """Check if conversation needs summary and generate if required.
        
        Args:
            conversation_id: ID of the conversation
            db: Database session
            update_title: Whether to update conversation title when summary is generated
        
        Returns the generated summary if one was created, None otherwise.
        """
        # Get conversation with messages
        conversation = await db.get(Conversation, conversation_id)
        
        if not conversation:
            return None
        
        # Check if summary already exists or if we need to generate one
        if conversation.summary_raw is not None:
            return conversation.summary_raw  # type: ignore
        
        # Check if conversation has reached 1500 tokens
        if not conversation.should_auto_archive():
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
                await self._update_conversation_title(conversation_id, summary, db)
            
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
        """Generate a short, topical summary for sidebar display.
        
        This summary is intended for a UI sidebar and is generated from the
        first user message in the conversation. It is truncated to 7 words.
        """
        if not messages:
            return ""

        first_user_message_content = next(
            (msg.content for msg in messages if msg.role == "user"), 
            None
        )

        if not first_user_message_content:
            first_message_content = next((msg.content for msg in messages), None)
            if not first_message_content:
                return "New Conversation"
            words = first_message_content.split()
        else:
            words = first_user_message_content.split()
        
        if len(words) > 7:
            return " ".join(words[:7]) + "..."
        
        return " ".join(words)
    
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
                    await self._update_conversation_title(conversation_id, summary, db)
        
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