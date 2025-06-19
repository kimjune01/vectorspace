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
        conversation_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conversation_result.scalar_one_or_none()
        
        if not conversation:
            return None
        
        # Check if summary already exists or if we need to generate one
        if conversation.summary_raw is not None:
            return conversation.summary_raw
        
        # Check if conversation has reached 1500 tokens
        if not conversation.should_auto_archive():
            return None
        
        # Generate summary
        summary = await self.generate_summary(conversation_id, db)
        
        if summary:
            # Store both raw and filtered versions
            conversation.summary_raw = summary
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
        return self._generate_extractive_summary(messages)
    
    def _generate_extractive_summary(self, messages: List[Message]) -> str:
        """Generate an extractive summary from messages.
        
        This is a simple implementation. In production, you'd use:
        - AI models (OpenAI, Anthropic) for abstractive summarization
        - More sophisticated extractive techniques
        - Topic modeling and clustering
        """
        if not messages:
            return ""
        
        # Get conversation flow
        user_messages = [msg for msg in messages if msg.role == "user"]
        ai_messages = [msg for msg in messages if msg.role == "assistant"]
        
        if not user_messages:
            return "System conversation with no user input."
        
        # Extract key elements
        first_question = user_messages[0].content
        last_question = user_messages[-1].content if len(user_messages) > 1 else None
        
        # Get representative AI response (middle or last)
        representative_response = ""
        if ai_messages:
            middle_idx = len(ai_messages) // 2
            representative_response = ai_messages[middle_idx].content
        
        # Count topics/questions
        question_count = len(user_messages)
        total_messages = len(messages)
        
        # Generate summary
        summary_parts = []
        
        # Opening
        if question_count == 1:
            summary_parts.append(f"User asked: {self._truncate_text(first_question, 100)}")
        else:
            summary_parts.append(f"User asked {question_count} questions starting with: {self._truncate_text(first_question, 80)}")
            if last_question and last_question != first_question:
                summary_parts.append(f"Final question: {self._truncate_text(last_question, 80)}")
        
        # AI response summary
        if representative_response:
            summary_parts.append(f"AI provided: {self._truncate_text(representative_response, 150)}")
        
        # Conversation stats
        summary_parts.append(f"Conversation included {total_messages} messages covering various aspects of the topic.")
        
        # Join and ensure reasonable length (~500 tokens / ~2000 characters)
        summary = " ".join(summary_parts)
        return self._truncate_text(summary, 2000)
    
    def _truncate_text(self, text: str, max_length: int) -> str:
        """Truncate text to maximum length, ending at word boundary."""
        if len(text) <= max_length:
            return text
        
        truncated = text[:max_length]
        # Find last space to avoid cutting words
        last_space = truncated.rfind(' ')
        if last_space > max_length * 0.8:  # Only if we don't lose too much
            truncated = truncated[:last_space]
        
        return truncated + "..."
    
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
            conversation_result = await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = conversation_result.scalar_one_or_none()
            
            if conversation:
                conversation.summary_raw = summary
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
            user_result = await db.execute(
                select(User).where(User.id == conversation.user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if user:
                # Use the filtered summary for embedding to ensure no PII
                filtered_summary = conversation.summary_public or self.pii_filter.filter_text(summary)
                
                success = await vector_service.store_conversation_embedding(
                    conversation_id=conversation.id,
                    summary=filtered_summary,
                    user_id=user.id,
                    username=user.username,
                    display_name=user.display_name,
                    title=conversation.title,
                    created_at=conversation.created_at.isoformat()
                )
                
                if success:
                    print(f"Successfully stored embedding for conversation {conversation.id}")
                else:
                    print(f"Failed to store embedding for conversation {conversation.id}")
            
        except Exception as e:
            print(f"Error storing embedding: {e}")
    
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
                conversation_result = await db.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
                conversation = conversation_result.scalar_one_or_none()
                
                if conversation and new_title != conversation.title:
                    # Only update if title appears to be auto-generated (not custom)
                    if not title_service._is_custom_title(conversation.title):
                        conversation.title = new_title
                        await db.commit()
                        print(f"Updated title for conversation {conversation_id}: {new_title}")
                    else:
                        print(f"Skipped title update for conversation {conversation_id} (custom title detected)")
        
        except Exception as e:
            print(f"Error updating conversation title: {e}")


# Global instance
summary_service = SummaryService()