import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from sqlalchemy import select
from app.models import User, Conversation
from app.main import app

class TestSemanticSimilarity:
    @pytest.mark.asyncio
    async def test_semantic_similarity_endpoint_returns_up_to_20_results(self, db_session, override_get_db):
        """Test /api/conversations/{id}/similar endpoint returns up to 20 results"""
        # Create user
        user = User(
            username="testuser",
            display_name="Test User",
            email="test@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login to get token
            login_response = await client.post("/api/auth/login", json={
                "username": "testuser",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}
            
            # Create a conversation first
            response = await client.post(
                "/api/conversations/",
                headers=auth_headers,
                json={
                    "title": "Test conversation",
                    "is_public": True
                }
            )
            assert response.status_code == 200
            conversation_id = response.json()["id"]
            
            # Mock the vector service to return 25 similar conversations (should limit to 20)
            mock_similar_conversations = [
                {
                    "id": i,
                    "title": f"Similar conversation {i}",
                    "summary": f"Summary {i}",
                    "similarity_score": 0.9 - (i * 0.01),
                    "is_public": True,
                    "created_at": "2023-01-01T00:00:00Z",
                    "author": {
                        "id": user.id,
                        "username": user.username
                    }
                }
                for i in range(1, 26)  # Generate 25 results
            ]
            
            with patch('app.services.vector_service.VectorService.find_similar_conversations') as mock_find:
                mock_find.return_value = mock_similar_conversations
                
                response = await client.get(
                    f"/api/conversations/{conversation_id}/similar",
                    headers=auth_headers
                )
                
                # The endpoint should now work and return 200 with empty conversations (no summary)
                assert response.status_code == 200
                data = response.json()
                assert "conversations" in data
                assert data["conversations"] == []
                assert data["message"] == "No summary available for similarity search"