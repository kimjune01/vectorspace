"""AI-powered content summarization service."""

import asyncio
import logging
import time
from typing import List, Optional
from openai import AsyncOpenAI

from ..models.post import SummaryRequest, SummaryResponse

logger = logging.getLogger(__name__)


class SummarizerService:
    """OpenAI-powered content summarization service."""
    
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-3.5-turbo",
        max_retries: int = 3,
        timeout: float = 30.0
    ):
        self.client = AsyncOpenAI(api_key=api_key, timeout=timeout)
        self.model = model
        self.max_retries = max_retries
        
        # Summarization prompt template
        self.system_prompt = """You are a content summarizer for a discussion discovery platform. 
Your task is to create concise, informative summaries of forum posts and their comments.

Guidelines:
- Summarize the main topic, key points, and notable insights
- Include important technical details and conclusions
- Capture the essence of community discussion
- Keep summaries around 300-500 tokens
- Focus on content that would help someone find relevant discussions
- Maintain objective tone and factual accuracy"""
    
    def _build_user_prompt(
        self, 
        title: str, 
        content: str, 
        comments: List[str],
        max_tokens: int = 500
    ) -> str:
        """Build the user prompt for summarization."""
        prompt_parts = [
            f"Title: {title}",
            "",
            "Content:",
            content,
        ]
        
        if comments:
            prompt_parts.extend([
                "",
                "Key Comments:",
                *[f"- {comment[:500]}..." if len(comment) > 500 else f"- {comment}" 
                  for comment in comments[:5]]  # Limit to top 5 comments
            ])
        
        prompt_parts.extend([
            "",
            f"Please provide a comprehensive summary in approximately {max_tokens} tokens that captures the main discussion points, technical details, and community insights."
        ])
        
        return "\n".join(prompt_parts)
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (4 chars ≈ 1 token)."""
        return max(1, len(text) // 4)
    
    async def summarize(
        self,
        title: str,
        content: str,
        comments: List[str] = None,
        max_tokens: int = 500
    ) -> SummaryResponse:
        """
        Summarize content using OpenAI API.
        
        Args:
            title: Post title
            content: Main post content
            comments: List of comment texts
            max_tokens: Target summary length
            
        Returns:
            SummaryResponse with generated summary
        """
        start_time = time.time()
        
        if comments is None:
            comments = []
        
        user_prompt = self._build_user_prompt(title, content, comments, max_tokens)
        
        # Retry logic for API calls
        last_error = None
        for attempt in range(self.max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=max_tokens + 100,  # Some buffer for the AI
                    temperature=0.3,  # Lower temperature for more consistent summaries
                )
                
                summary = response.choices[0].message.content.strip()
                processing_time = int((time.time() - start_time) * 1000)
                
                return SummaryResponse(
                    summary=summary,
                    token_count=self._estimate_tokens(summary),
                    processing_time_ms=processing_time
                )
                
            except Exception as e:
                last_error = e
                logger.warning(f"Summarization attempt {attempt + 1} failed: {e}")
                
                if attempt < self.max_retries - 1:
                    # Exponential backoff
                    await asyncio.sleep(2 ** attempt)
        
        # If all retries failed, raise the last error
        logger.error(f"Summarization failed after {self.max_retries} attempts")
        raise last_error
    
    async def summarize_batch(
        self,
        requests: List[SummaryRequest]
    ) -> List[SummaryResponse]:
        """
        Summarize multiple pieces of content concurrently.
        
        Args:
            requests: List of summarization requests
            
        Returns:
            List of summary responses
        """
        tasks = [
            self.summarize(
                title=req.title,
                content=req.content,
                comments=req.comments,
                max_tokens=req.max_tokens
            )
            for req in requests
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to error responses
        responses = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Batch summarization failed for request {i}: {result}")
                # Create fallback summary
                req = requests[i]
                fallback_summary = f"{req.title}\n\n{req.content[:500]}..."
                responses.append(SummaryResponse(
                    summary=fallback_summary,
                    token_count=self._estimate_tokens(fallback_summary),
                    processing_time_ms=0
                ))
            else:
                responses.append(result)
        
        return responses
    
    async def health_check(self) -> bool:
        """Check if the OpenAI API is accessible."""
        try:
            # Simple test request
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": "Hello, this is a test."}
                ],
                max_tokens=10
            )
            return bool(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Summarizer health check failed: {e}")
            return False