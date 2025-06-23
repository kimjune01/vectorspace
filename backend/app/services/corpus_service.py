import httpx
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os

logger = logging.getLogger(__name__)

# Build flag for mocking HN recommendations
MOCK_HN_RECOMMENDATIONS = os.getenv("MOCK_HN_RECOMMENDATIONS", "false").lower() == "true"

class CorpusService:
    """Service for interacting with the corpus microservice."""
    
    def __init__(self, base_url: Optional[str] = None):
        """Initialize corpus service client.
        
        Args:
            base_url: Base URL for corpus service. Defaults to env var or localhost:8001
        """
        self.base_url = base_url or os.getenv("CORPUS_SERVICE_URL", "http://localhost:8001")
        self.timeout = 5.0  # 5 second timeout
        
    def _generate_mock_recommendations(self, summary_text: str) -> List[Dict[str, Any]]:
        """Generate mock HN recommendations for testing purposes."""
        # Create contextual mock recommendations based on summary content
        base_recommendations = [
            {
                "title": "Show HN: Building a Modern Chat Interface with WebSockets",
                "url": "https://news.ycombinator.com/item?id=38471822",
                "score": 0.89,
                "timestamp": "2025-06-23T10:30:00Z"
            },
            {
                "title": "Machine Learning in Production: Lessons Learned",
                "url": "https://news.ycombinator.com/item?id=38469334", 
                "score": 0.85,
                "timestamp": "2025-06-23T09:15:00Z"
            },
            {
                "title": "The State of AI Development Tools in 2025",
                "url": "https://news.ycombinator.com/item?id=38468123",
                "score": 0.82,
                "timestamp": "2025-06-23T08:45:00Z"
            },
            {
                "title": "Open Source Vector Databases: A Comprehensive Guide",
                "url": "https://news.ycombinator.com/item?id=38467890",
                "score": 0.78,
                "timestamp": "2025-06-23T07:20:00Z"
            },
            {
                "title": "Real-time Collaboration Features in Web Applications",
                "url": "https://news.ycombinator.com/item?id=38466777",
                "score": 0.75,
                "timestamp": "2025-06-23T06:00:00Z"
            }
        ]
        
        # Filter recommendations based on summary keywords
        summary_lower = summary_text.lower()
        contextual_recs = []
        
        # Add tech-specific recommendations based on summary content
        if any(term in summary_lower for term in ["ai", "artificial intelligence", "machine learning", "ml"]):
            contextual_recs.append({
                "title": "GPT-4 Integration Patterns for Production Applications",
                "url": "https://news.ycombinator.com/item?id=38470500",
                "score": 0.92,
                "timestamp": "2025-06-23T11:00:00Z"
            })
        
        if any(term in summary_lower for term in ["websocket", "real-time", "chat", "collaboration"]):
            contextual_recs.append({
                "title": "WebSocket Performance Optimization in Node.js",
                "url": "https://news.ycombinator.com/item?id=38471000",
                "score": 0.90,
                "timestamp": "2025-06-23T10:45:00Z"
            })
        
        if any(term in summary_lower for term in ["database", "vector", "embedding", "search"]):
            contextual_recs.append({
                "title": "ChromaDB vs Pinecone: Vector Database Comparison",
                "url": "https://news.ycombinator.com/item?id=38469800",
                "score": 0.87,
                "timestamp": "2025-06-23T09:30:00Z"
            })
        
        # Combine contextual and base recommendations
        all_recommendations = contextual_recs + base_recommendations
        
        # Remove duplicates and return top 5
        seen_titles = set()
        unique_recommendations = []
        for rec in all_recommendations:
            if rec["title"] not in seen_titles:
                seen_titles.add(rec["title"])
                unique_recommendations.append(rec)
        
        return unique_recommendations[:5]

    async def get_hn_recommendations(self, summary_text: Optional[str]) -> List[Dict[str, Any]]:
        """Get Hacker News recommendations based on conversation summary.
        
        Args:
            summary_text: Text summary of the conversation
            
        Returns:
            List of HN recommendations with title, url, score, timestamp
        """
        if not summary_text or not summary_text.strip():
            return []
        
        # Use mock recommendations if flag is enabled
        if MOCK_HN_RECOMMENDATIONS:
            logger.info(f"Using mock HN recommendations for summary: {summary_text[:50]}...")
            return self._generate_mock_recommendations(summary_text.strip())
            
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/hn-recommendations",
                    json={"summary": summary_text.strip()}
                )
                response.raise_for_status()
                
                data = response.json()
                
                # Validate response structure
                if not isinstance(data, dict) or "recommendations" not in data:
                    logger.warning("Invalid response structure from corpus service")
                    # Fall back to mock recommendations if corpus returns empty/invalid response
                    if MOCK_HN_RECOMMENDATIONS:
                        logger.info("Falling back to mock recommendations due to invalid corpus response")
                        return self._generate_mock_recommendations(summary_text.strip())
                    return []
                
                recommendations_data = data["recommendations"]
                if not isinstance(recommendations_data, list):
                    logger.warning("Recommendations field is not a list")
                    # Fall back to mock recommendations if corpus returns invalid list
                    if MOCK_HN_RECOMMENDATIONS:
                        logger.info("Falling back to mock recommendations due to invalid recommendations list")
                        return self._generate_mock_recommendations(summary_text.strip())
                    return []
                
                # If corpus returns empty recommendations, optionally fall back to mock
                if not recommendations_data and MOCK_HN_RECOMMENDATIONS:
                    logger.info("Corpus returned empty recommendations, using mock data")
                    return self._generate_mock_recommendations(summary_text.strip())
                
                # Return the recommendations directly (already sorted by corpus service)
                return recommendations_data
                
        except httpx.TimeoutException:
            logger.warning("Timeout while fetching HN recommendations from corpus service")
            # Fall back to mock recommendations on timeout
            if MOCK_HN_RECOMMENDATIONS:
                logger.info("Using mock recommendations due to corpus service timeout")
                return self._generate_mock_recommendations(summary_text.strip())
            return []
        except httpx.HTTPError as e:
            logger.warning(f"HTTP error while fetching HN recommendations: {e}")
            # Fall back to mock recommendations on HTTP error
            if MOCK_HN_RECOMMENDATIONS:
                logger.info("Using mock recommendations due to corpus service HTTP error")
                return self._generate_mock_recommendations(summary_text.strip())
            return []
        except Exception as e:
            logger.error(f"Unexpected error while fetching HN recommendations: {e}")
            # Fall back to mock recommendations on any error
            if MOCK_HN_RECOMMENDATIONS:
                logger.info("Using mock recommendations due to unexpected corpus service error")
                return self._generate_mock_recommendations(summary_text.strip())
            return []
    


# Global instance
corpus_service = CorpusService()