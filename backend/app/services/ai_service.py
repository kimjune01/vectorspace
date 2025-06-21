from typing import AsyncGenerator, Optional, Dict, Any, List
import asyncio
import random
import string
import json
import logging
import os
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class AIService:
    """Service for integrating with AI providers for chatbot responses."""
    
    def __init__(self):
        """Initialize AI service with OpenAI client."""
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OPENAI_API_KEY not found, falling back to mock mode")
            self.client = None
            self.model = "mock-ai-model"
        else:
            self.client = AsyncOpenAI(api_key=self.api_key)
            self.model = os.getenv("AI_MODEL", "gpt-4o-mini")
        
        self.max_tokens = int(os.getenv("AI_MAX_TOKENS", "4000"))
        self.temperature = float(os.getenv("AI_TEMPERATURE", "0.7"))
        
    async def stream_response(
        self, 
        messages: list[Dict[str, str]], 
        conversation_id: Optional[int] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Generate streaming AI response for conversation.
        
        Args:
            messages: List of conversation messages in format [{"role": "user", "content": "..."}]
            conversation_id: Optional conversation ID for context
            
        Yields:
            Chunks with format: {"content": "text", "finish_reason": None|"stop", "tokens": int}
        """
        try:
            # Get the latest user message
            if not messages or messages[-1]["role"] != "user":
                yield {
                    "content": "I need a message from you to respond to.",
                    "finish_reason": "stop",
                    "tokens": 10
                }
                return
            
            # Use real OpenAI API if available, otherwise fall back to mock
            if self.client:
                async for chunk in self._stream_openai_response(messages):
                    yield chunk
            else:
                # Fall back to mock response
                user_message = messages[-1]["content"]
                response_text = await self._generate_mock_response(user_message)
                
                # Stream the mock response in chunks
                chunk_size = 8  # Characters per chunk
                total_tokens = 0
                
                for i in range(0, len(response_text), chunk_size):
                    chunk = response_text[i:i + chunk_size]
                    chunk_tokens = max(1, len(chunk) // 4)  # Approximate token count
                    total_tokens += chunk_tokens
                    
                    # Add natural delay to simulate streaming (skip in tests)
                    if not os.getenv("TESTING"):
                        await asyncio.sleep(0.1)
                    
                    yield {
                        "content": chunk,
                        "finish_reason": None,
                        "tokens": chunk_tokens
                    }
            
                # Final chunk with completion signal for mock mode
                yield {
                    "content": "",
                    "finish_reason": "stop", 
                    "tokens": 0,
                    "total_tokens": total_tokens
                }
            
        except Exception as e:
            logger.error(f"Error in AI streaming: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error details: {str(e)}")
            yield {
                "content": "I'm sorry, I encountered an error while processing your request.",
                "finish_reason": "stop",
                "tokens": 12
            }
    
    async def _stream_openai_response(self, messages: list[Dict[str, str]]) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream response from OpenAI API.
        
        Args:
            messages: List of conversation messages
            
        Yields:
            Chunks with format: {"content": "text", "finish_reason": None|"stop", "tokens": int}
        """
        try:
            # Convert messages to OpenAI format
            openai_messages = []
            for msg in messages:
                openai_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            # Create streaming chat completion
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                stream=True
            )
            
            total_tokens = 0
            
            # Stream the response chunks
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    choice = chunk.choices[0]
                    delta = choice.delta
                    
                    # Extract content from delta
                    content = ""
                    if hasattr(delta, 'content') and delta.content:
                        content = delta.content
                    
                    # Estimate tokens for this chunk
                    chunk_tokens = max(1, len(content) // 4) if content else 0
                    total_tokens += chunk_tokens
                    
                    # Check for finish reason
                    finish_reason = None
                    if hasattr(choice, 'finish_reason') and choice.finish_reason:
                        finish_reason = choice.finish_reason
                    
                    yield {
                        "content": content,
                        "finish_reason": finish_reason,
                        "tokens": chunk_tokens
                    }
                    
                    # Break if we're done
                    if finish_reason:
                        break
            
            # Final completion chunk
            yield {
                "content": "",
                "finish_reason": "stop",
                "tokens": 0,
                "total_tokens": total_tokens
            }
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error details: {str(e)}")
            yield {
                "content": "I encountered an error while communicating with the AI service.",
                "finish_reason": "stop",
                "tokens": 12
            }
    
    async def _generate_mock_response(self, user_message: str) -> str:
        """
        Generate a mock AI response based on user input.
        
        In production, this would be replaced with actual AI API calls.
        """
        user_lower = user_message.lower()
        
        # Pattern-based responses for common topics
        if any(keyword in user_lower for keyword in ["hello", "hi", "hey"]):
            responses = [
                "Hello! How can I help you today?",
                "Hi there! What would you like to know?",
                "Hey! I'm here to assist you with any questions you have."
            ]
            return random.choice(responses)
        
        elif any(keyword in user_lower for keyword in ["python", "programming", "code"]):
            return (
                "Python is a versatile programming language known for its readability and simplicity. "
                "It's great for beginners and powerful enough for complex applications. "
                "What specific aspect of Python programming would you like to explore?"
            )
        
        elif any(keyword in user_lower for keyword in ["machine learning", "ml", "ai", "artificial intelligence"]):
            return (
                "Machine learning is a subset of artificial intelligence that enables computers to learn "
                "and make decisions from data without being explicitly programmed for every task. "
                "It includes supervised learning, unsupervised learning, and reinforcement learning. "
                "Would you like me to explain any of these concepts in more detail?"
            )
        
        elif any(keyword in user_lower for keyword in ["react", "javascript", "frontend"]):
            return (
                "React is a popular JavaScript library for building user interfaces, especially web applications. "
                "It uses a component-based architecture and virtual DOM for efficient updates. "
                "Are you looking to learn React basics or working on a specific project?"
            )
        
        elif any(keyword in user_lower for keyword in ["database", "sql", "data"]):
            return (
                "Databases are essential for storing and managing data in applications. "
                "SQL databases like PostgreSQL are great for structured data with relationships, "
                "while NoSQL databases like MongoDB work well for flexible, document-based data. "
                "What kind of data management challenge are you facing?"
            )
        
        elif "?" in user_message:
            # Generic response for questions
            return (
                f"That's an interesting question about {self._extract_topic(user_message)}. "
                "Let me think about this... "
                "Based on my understanding, there are several important aspects to consider. "
                "Could you provide more specific details about what you're trying to achieve?"
            )
        
        else:
            # Generic conversational response
            return (
                f"I understand you're interested in {self._extract_topic(user_message)}. "
                "That's a fascinating topic with many different perspectives. "
                "What specific aspect would you like to explore further? "
                "I'm here to help you dive deeper into any area you find interesting."
            )
    
    def _extract_topic(self, message: str) -> str:
        """Extract a likely topic from the user message."""
        # Simple keyword extraction
        words = message.lower().split()
        
        # Common technical terms
        tech_terms = [
            "python", "javascript", "react", "api", "database", "sql", "frontend",
            "backend", "machine learning", "ai", "algorithm", "programming",
            "software", "development", "coding", "web", "application"
        ]
        
        for word in words:
            if word in tech_terms:
                return word
        
        # If no tech terms found, use a generic term
        if len(words) > 2:
            return " ".join(words[:2])
        else:
            return "that topic"
    
    async def generate_complete_response(
        self, 
        messages: list[Dict[str, str]], 
        conversation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate a complete AI response (non-streaming).
        
        Returns:
            Dictionary with response content and metadata
        """
        try:
            # Collect all chunks from streaming response
            full_content = ""
            total_tokens = 0
            
            async for chunk in self.stream_response(messages, conversation_id):
                if chunk["content"]:
                    full_content += chunk["content"]
                if chunk.get("total_tokens"):
                    total_tokens = chunk["total_tokens"]
                elif chunk["tokens"]:
                    total_tokens += chunk["tokens"]
            
            return {
                "content": full_content,
                "tokens": total_tokens,
                "model": self.model,
                "finish_reason": "stop"
            }
            
        except Exception as e:
            logger.error(f"Error generating complete response: {e}")
            return {
                "content": "I apologize, but I encountered an error while generating a response.",
                "tokens": 12,
                "model": self.model,
                "finish_reason": "error"
            }
    
    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text (using same logic as Message model)."""
        from app.models import Message
        return Message.estimate_token_count(text)
    
    def get_conversation_context(self, messages: list[Dict[str, str]], max_context_tokens: int = 2000) -> list[Dict[str, str]]:
        """
        Get conversation context within token limit.
        
        Returns recent messages that fit within the token limit.
        """
        context_messages = []
        current_tokens = 0
        
        # Process messages in reverse order (most recent first)
        for message in reversed(messages):
            message_tokens = self.estimate_tokens(message["content"])
            
            if current_tokens + message_tokens > max_context_tokens:
                break
            
            context_messages.insert(0, message)  # Insert at beginning to maintain order
            current_tokens += message_tokens
        
        return context_messages

    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding vector for text using OpenAI's embedding model.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            Exception: If OpenAI API fails or client not configured
        """
        if not self.client:
            raise Exception("OpenAI client not configured - OPENAI_API_KEY required for embeddings")
        
        try:
            # Use OpenAI's embedding model
            embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
            
            response = await self.client.embeddings.create(
                model=embedding_model,
                input=text
            )
            
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise Exception(f"Embedding generation failed: {str(e)}")


# Global instance
ai_service = AIService()