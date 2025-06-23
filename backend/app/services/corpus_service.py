import httpx
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os

logger = logging.getLogger(__name__)


class CorpusService:
    """Service for interacting with the corpus microservice."""
    
    def __init__(self, base_url: Optional[str] = None):
        """Initialize corpus service client.
        
        Args:
            base_url: Base URL for corpus service. Defaults to env var or localhost:8001
        """
        self.base_url = base_url or os.getenv("CORPUS_SERVICE_URL", "http://localhost:8001")
        self.timeout = 5.0  # 5 second timeout
        
    async def get_hn_recommendations(self, summary_text: Optional[str]) -> List[Dict[str, Any]]:
        """Get Hacker News recommendations based on conversation summary.
        
        Args:
            summary_text: Text summary of the conversation
            
        Returns:
            List of HN recommendations with title, url, score, timestamp
        """
        if not summary_text or not summary_text.strip():
            return []
            
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
                    return []
                
                recommendations_data = data["recommendations"]
                if not isinstance(recommendations_data, list):
                    logger.warning("Recommendations field is not a list")
                    return []
                
                # Return the recommendations directly (already sorted by corpus service)
                return recommendations_data
                
        except httpx.TimeoutException:
            logger.warning("Timeout while fetching HN recommendations from corpus service")
            return []
        except httpx.HTTPError as e:
            logger.warning(f"HTTP error while fetching HN recommendations: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error while fetching HN recommendations: {e}")
            return []
    


# Global instance
corpus_service = CorpusService()