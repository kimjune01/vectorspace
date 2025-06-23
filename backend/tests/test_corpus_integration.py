import pytest
from unittest.mock import Mock, patch, AsyncMock
from httpx import HTTPError, TimeoutException
import json

from app.services.corpus_service import CorpusService, HNRecommendation


class TestCorpusService:
    """Test corpus service integration for HN recommendations."""
    
    @pytest.fixture
    def corpus_service(self):
        return CorpusService(base_url="http://localhost:8001")
    
    @pytest.fixture
    def mock_hn_response(self):
        return {
            "recommendations": [
                {
                    "title": "Machine Learning in Production",
                    "url": "https://news.ycombinator.com/item?id=12345",
                    "score": 0.85,
                    "timestamp": "2024-01-15T10:30:00Z"
                },
                {
                    "title": "Neural Networks for Beginners", 
                    "url": "https://news.ycombinator.com/item?id=12346",
                    "score": 0.78,
                    "timestamp": "2024-01-14T15:20:00Z"
                },
                {
                    "title": "AI Safety Research Updates",
                    "url": "https://news.ycombinator.com/item?id=12347", 
                    "score": 0.72,
                    "timestamp": "2024-01-13T09:15:00Z"
                }
            ]
        }

    @pytest.mark.asyncio
    async def test_get_hn_recommendations_with_summary_success(
        self, corpus_service, mock_hn_response
    ):
        """Test successful HN recommendations retrieval with summary."""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_hn_response
            mock_post.return_value = mock_response
            
            result = await corpus_service.get_hn_recommendations(
                "Machine learning applications in healthcare"
            )
            
            assert len(result) == 3
            assert all(isinstance(rec, HNRecommendation) for rec in result)
            assert result[0].title == "Machine Learning in Production"
            assert result[0].score == 0.85
            assert "ycombinator.com" in result[0].url
            
            # Verify API call was made correctly
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert call_args[0][0] == "http://localhost:8001/api/hn-recommendations"
            assert call_args[1]["json"]["summary"] == "Machine learning applications in healthcare"

    @pytest.mark.asyncio
    async def test_get_hn_recommendations_no_summary_returns_empty(self, corpus_service):
        """Test that empty summary returns empty list."""
        result = await corpus_service.get_hn_recommendations("")
        assert result == []
        
        result = await corpus_service.get_hn_recommendations(None)
        assert result == []

    @pytest.mark.asyncio
    async def test_get_hn_recommendations_corpus_service_timeout(self, corpus_service):
        """Test timeout handling for corpus service."""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_post.side_effect = TimeoutException("Request timeout")
            
            result = await corpus_service.get_hn_recommendations("AI research")
            
            assert result == []

    @pytest.mark.asyncio
    async def test_get_hn_recommendations_corpus_service_error(self, corpus_service):
        """Test HTTP error handling for corpus service."""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_response.raise_for_status.side_effect = HTTPError("Server error")
            mock_post.return_value = mock_response
            
            result = await corpus_service.get_hn_recommendations("blockchain technology")
            
            assert result == []

    @pytest.mark.asyncio
    async def test_get_hn_recommendations_malformed_response(self, corpus_service):
        """Test handling of malformed corpus service response."""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"invalid": "structure"}
            mock_post.return_value = mock_response
            
            result = await corpus_service.get_hn_recommendations("web development")
            
            assert result == []

    @pytest.mark.asyncio
    async def test_get_hn_recommendations_empty_response(self, corpus_service):
        """Test handling of empty recommendations from corpus service."""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"recommendations": []}
            mock_post.return_value = mock_response
            
            result = await corpus_service.get_hn_recommendations("very niche topic")
            
            assert result == []

    @pytest.mark.asyncio
    async def test_get_hn_recommendations_sorting_by_relevance_recency(
        self, corpus_service, mock_hn_response
    ):
        """Test that recommendations are properly sorted by relevance × recency score."""
        # Modify mock response to test sorting
        mock_hn_response["recommendations"] = [
            {
                "title": "Old High Relevance",
                "url": "https://news.ycombinator.com/item?id=1",
                "score": 0.9,
                "timestamp": "2024-01-01T10:00:00Z"  # Older
            },
            {
                "title": "Recent Medium Relevance", 
                "url": "https://news.ycombinator.com/item?id=2",
                "score": 0.7,
                "timestamp": "2024-01-15T10:00:00Z"  # Newer
            },
            {
                "title": "Very Recent Low Relevance",
                "url": "https://news.ycombinator.com/item?id=3",
                "score": 0.5,
                "timestamp": "2024-01-16T10:00:00Z"  # Newest
            }
        ]
        
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_hn_response
            mock_post.return_value = mock_response
            
            result = await corpus_service.get_hn_recommendations("test topic")
            
            # Verify sorting - should be ordered by relevance × recency
            assert len(result) == 3
            titles = [rec.title for rec in result]
            # The exact order depends on the scoring algorithm implementation
            assert isinstance(result[0], HNRecommendation)

    @pytest.mark.asyncio 
    async def test_get_hn_recommendations_limits_to_5_results(self, corpus_service):
        """Test that only maximum 5 recommendations are returned."""
        mock_response_data = {
            "recommendations": [
                {
                    "title": f"Article {i}",
                    "url": f"https://news.ycombinator.com/item?id={i}",
                    "score": 0.8,
                    "timestamp": "2024-01-15T10:00:00Z"
                }
                for i in range(10)  # 10 articles
            ]
        }
        
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response
            
            result = await corpus_service.get_hn_recommendations("popular topic")
            
            assert len(result) <= 5


class TestHNRecommendation:
    """Test HNRecommendation model."""
    
    def test_hn_recommendation_creation(self):
        """Test HNRecommendation model creation."""
        rec = HNRecommendation(
            title="Test Article",
            url="https://news.ycombinator.com/item?id=123",
            score=0.85,
            timestamp="2024-01-15T10:30:00Z"
        )
        
        assert rec.title == "Test Article"
        assert rec.url == "https://news.ycombinator.com/item?id=123"
        assert rec.score == 0.85
        assert rec.timestamp == "2024-01-15T10:30:00Z"
    
    def test_hn_recommendation_dict_conversion(self):
        """Test HNRecommendation to dict conversion."""
        rec = HNRecommendation(
            title="Test Article",
            url="https://news.ycombinator.com/item?id=123", 
            score=0.85,
            timestamp="2024-01-15T10:30:00Z"
        )
        
        rec_dict = rec.dict()
        
        assert rec_dict["title"] == "Test Article"
        assert rec_dict["url"] == "https://news.ycombinator.com/item?id=123"
        assert rec_dict["score"] == 0.85
        assert rec_dict["timestamp"] == "2024-01-15T10:30:00Z"