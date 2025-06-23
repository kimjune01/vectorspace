import httpx
import logging
from typing import List, Optional
from datetime import datetime, timezone
import os

from app.models.corpus import HNRecommendation, HNRecommendationsRequest

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
        
    async def get_hn_recommendations(self, summary_text: Optional[str]) -> List[HNRecommendation]:
        """Get Hacker News recommendations based on conversation summary.
        
        Args:
            summary_text: Text summary of the conversation
            
        Returns:
            List of HN recommendations, sorted by relevance × recency score
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
                
                # Convert to HNRecommendation objects
                recommendations = []
                for item in recommendations_data:
                    try:
                        # Validate required fields
                        if not all(key in item for key in ["title", "url", "score", "timestamp"]):
                            logger.warning(f"Missing required fields in recommendation: {item}")
                            continue
                            
                        rec = HNRecommendation(
                            title=item["title"],
                            url=item["url"], 
                            score=float(item["score"]),
                            timestamp=item["timestamp"]
                        )
                        recommendations.append(rec)
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Failed to parse recommendation: {item}, error: {e}")
                        continue
                
                # Sort by relevance × recency score and limit to 5
                sorted_recommendations = self._sort_by_relevance_recency(recommendations)
                return sorted_recommendations[:5]
                
        except httpx.TimeoutException:
            logger.warning("Timeout while fetching HN recommendations from corpus service")
            return []
        except httpx.HTTPError as e:
            logger.warning(f"HTTP error while fetching HN recommendations: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error while fetching HN recommendations: {e}")
            return []
    
    def _sort_by_relevance_recency(self, recommendations: List[HNRecommendation]) -> List[HNRecommendation]:
        """Sort recommendations by relevance × recency score.
        
        Args:
            recommendations: List of HN recommendations
            
        Returns:
            Sorted list with highest combined score first
        """
        if not recommendations:
            return []
            
        try:
            now = datetime.now(timezone.utc)
            
            def calculate_combined_score(rec: HNRecommendation) -> float:
                try:
                    # Parse timestamp
                    rec_time = datetime.fromisoformat(rec.timestamp.replace('Z', '+00:00'))
                    
                    # Calculate recency score (newer = higher score)
                    time_diff_hours = (now - rec_time).total_seconds() / 3600
                    
                    # Recency score: exponential decay with 24h half-life
                    # Score of 1.0 for current time, 0.5 for 24h ago, etc.
                    recency_score = 2 ** (-time_diff_hours / 24)
                    
                    # Combined score: relevance × recency
                    combined_score = rec.score * recency_score
                    
                    return combined_score
                    
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse timestamp for recommendation: {rec.title}, error: {e}")
                    # Fallback to just relevance score
                    return rec.score
            
            return sorted(recommendations, key=calculate_combined_score, reverse=True)
            
        except Exception as e:
            logger.error(f"Error sorting recommendations: {e}")
            # Fallback to relevance-only sorting
            return sorted(recommendations, key=lambda x: x.score, reverse=True)


# Global instance
corpus_service = CorpusService()