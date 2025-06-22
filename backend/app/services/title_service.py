from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Conversation, Message
from app.services.ai_service import ai_service


class TitleGenerationService:
    """Service for generating conversation titles based on content."""
    
    def __init__(self):
        self.ai_service = ai_service
    
    async def generate_title_from_messages(
        self, 
        conversation_id: int, 
        db: AsyncSession,
        use_ai: bool = True
    ) -> Optional[str]:
        """Generate a title from conversation messages.
        
        Args:
            conversation_id: ID of the conversation
            db: Database session
            use_ai: Whether to use AI for title generation (fallback to extractive)
            
        Returns:
            Generated title or None if failed
        """
        # Get conversation messages
        messages_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.timestamp)
        )
        messages = messages_result.scalars().all()
        
        if not messages:
            return None
        
        # Try AI generation first if enabled
        if use_ai:
            try:
                ai_title = await self._generate_ai_title(messages)
                if ai_title:
                    return ai_title
            except Exception as e:
                print(f"AI title generation failed: {e}")
        
        # Fallback to extractive title generation
        return self._generate_extractive_title(messages)
    
    async def generate_title_from_summary(
        self, 
        summary: str, 
        use_ai: bool = True
    ) -> Optional[str]:
        """Generate a title from an existing summary.
        
        Args:
            summary: Conversation summary
            use_ai: Whether to use AI for title generation
            
        Returns:
            Generated title or None if failed
        """
        if not summary:
            return None
        
        # Try AI generation first if enabled
        if use_ai:
            try:
                ai_title = await self._generate_ai_title_from_summary(summary)
                if ai_title:
                    return ai_title
            except Exception as e:
                print(f"AI title generation from summary failed: {e}")
        
        # Fallback to extractive title from summary
        return self._generate_extractive_title_from_summary(summary)
    
    async def update_conversation_title(
        self, 
        conversation_id: int, 
        db: AsyncSession,
        force_update: bool = False
    ) -> Optional[str]:
        """Update conversation title based on current content.
        
        Args:
            conversation_id: ID of the conversation
            db: Database session
            force_update: Whether to update even if title was manually set
            
        Returns:
            New title or None if not updated
        """
        # Get conversation
        conversation_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conversation_result.scalar_one_or_none()
        
        if not conversation:
            return None
        
        # Skip if title was manually customized (unless force_update)
        if not force_update and self._is_custom_title(conversation.title):
            return None
        
        # Generate new title
        new_title = await self.generate_title_from_messages(conversation_id, db)
        
        if new_title and new_title != conversation.title:
            conversation.title = new_title
            await db.commit()
            return new_title
        
        return None
    
    def _is_custom_title(self, title: str) -> bool:
        """Check if title appears to be manually customized."""
        # Check for generic date-based titles
        import re
        date_pattern = r'Chat \d{4}-\d{2}-\d{2}|Chat \d{1,2}/\d{1,2}/\d{4}|New Conversation'
        return not re.search(date_pattern, title, re.IGNORECASE)
    
    async def _generate_ai_title(self, messages: List[Message]) -> Optional[str]:
        """Generate title using AI service."""
        if not messages:
            return None
        
        # Create a prompt for title generation
        user_messages = [msg for msg in messages if msg.role == "user"]
        ai_messages = [msg for msg in messages if msg.role == "assistant"]
        
        if not user_messages:
            return None
        
        # Build context for title generation
        context_parts = []
        
        # Include first user message
        first_question = user_messages[0].content
        context_parts.append(f"First question: {first_question}")
        
        # Include last user message if different
        if len(user_messages) > 1:
            last_question = user_messages[-1].content
            if last_question != first_question:
                context_parts.append(f"Latest question: {last_question}")
        
        # Include a sample AI response
        if ai_messages:
            sample_response = ai_messages[0].content
            context_parts.append(f"AI response: {sample_response[:200]}...")
        
        context = "\n".join(context_parts)
        
        # Generate title using AI
        prompt = f"""Generate a concise, descriptive title for this conversation. The title should:
- Be 5-8 words maximum
- Capture the main topic or question
- Be specific and informative
- Not include generic words like "chat", "conversation", "discussion"

Conversation context:
{context}

Generate only the title, no explanation:"""
        
        try:
            messages = [{"role": "user", "content": prompt}]
            response_data = await self.ai_service.generate_complete_response(messages)
            
            if response_data and response_data.get("content"):
                # Clean up the response
                title = response_data["content"].strip().strip('"').strip("'")
                return self._validate_and_clean_title(title)
        
        except Exception as e:
            print(f"AI title generation error: {e}")
        
        return None
    
    async def _generate_ai_title_from_summary(self, summary: str) -> Optional[str]:
        """Generate title from summary using AI."""
        prompt = f"""Generate a concise, descriptive title for a conversation based on this summary. The title should:
- Be 5-8 words maximum
- Capture the main topic or question
- Be specific and informative
- Not include generic words like "chat", "conversation", "discussion"

Summary:
{summary}

Generate only the title, no explanation:"""
        
        try:
            messages = [{"role": "user", "content": prompt}]
            response_data = await self.ai_service.generate_complete_response(messages)
            
            if response_data and response_data.get("content"):
                title = response_data["content"].strip().strip('"').strip("'")
                return self._validate_and_clean_title(title)
        
        except Exception as e:
            print(f"AI title generation from summary error: {e}")
        
        return None
    
    def _generate_extractive_title(self, messages: List[Message]) -> str:
        """Generate title using extractive methods (fallback)."""
        if not messages:
            return "Empty Conversation"
        
        # Get first user message
        user_messages = [msg for msg in messages if msg.role == "user"]
        if not user_messages:
            return "System Conversation"
        
        first_message = user_messages[0].content
        
        # Extract key topics/questions
        title = self._extract_topic_from_text(first_message)
        
        # Add context if multiple questions
        if len(user_messages) > 1:
            title += f" (+{len(user_messages) - 1} more)"
        
        return self._validate_and_clean_title(title)
    
    def _generate_extractive_title_from_summary(self, summary: str) -> str:
        """Generate title from summary using extractive methods."""
        # Extract first sentence or key phrase
        sentences = summary.split('.')
        if sentences:
            first_sentence = sentences[0].strip()
            title = self._extract_topic_from_text(first_sentence)
            return self._validate_and_clean_title(title)
        
        return "Conversation Summary"
    
    def _extract_topic_from_text(self, text: str) -> str:
        """Extract main topic from text."""
        # Clean and truncate
        text = text.strip()
        
        # Remove common question starters
        prefixes = ["how to", "what is", "why", "when", "where", "who", "can you", "please", "i want to", "i need"]
        text_lower = text.lower()
        
        for prefix in prefixes:
            if text_lower.startswith(prefix):
                text = text[len(prefix):].strip()
                break
        
        # Take first few words
        words = text.split()[:6]
        topic = " ".join(words)
        
        # Remove trailing punctuation
        topic = topic.rstrip('.,!?;:')
        
        return topic or "General Discussion"
    
    def _validate_and_clean_title(self, title: str) -> str:
        """Validate and clean generated title."""
        if not title:
            return "Untitled Conversation"
        
        # Remove extra whitespace
        title = " ".join(title.split())
        
        # Ensure reasonable length
        if len(title) > 200:
            title = title[:197] + "..."
        
        # Ensure minimum length
        if len(title) < 3:
            return "Brief Conversation"
        
        # Capitalize first letter
        title = title[0].upper() + title[1:] if len(title) > 1 else title.upper()
        
        return title


# Global instance
title_service = TitleGenerationService()