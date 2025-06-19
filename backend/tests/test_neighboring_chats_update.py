import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from sqlalchemy import select
from app.models import User, Conversation, Message
from app.main import app

class TestNeighboringChatsUpdate:
    @pytest.mark.asyncio
    async def test_neighboring_chats_update_after_summary_changes(self, db_session, override_get_db):
        """Test that neighboring chats are updated when a conversation's summary is regenerated"""
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
            
            # Create two conversations
            conv1_response = await client.post(
                "/api/conversations/",
                headers=auth_headers,
                json={
                    "title": "First conversation about Python",
                    "is_public": True
                }
            )
            assert conv1_response.status_code == 200
            conv1_id = conv1_response.json()["id"]
            
            conv2_response = await client.post(
                "/api/conversations/",
                headers=auth_headers,
                json={
                    "title": "Second conversation about JavaScript",
                    "is_public": True
                }
            )
            assert conv2_response.status_code == 200
            conv2_id = conv2_response.json()["id"]
            
            # Mock vector service to control similarity results
            with patch('app.services.vector_service.vector_service.find_similar_conversations') as mock_find_similar, \
                 patch('app.services.summary_service.SummaryService.generate_summary') as mock_summary, \
                 patch('app.services.vector_service.vector_service.store_conversation_embedding') as mock_store:
                
                # Mock summary generation
                mock_summary.return_value = "Python programming tutorial and best practices"
                
                # Initial state: no similar conversations
                mock_find_similar.return_value = []
                
                # Get initial similar conversations for conv1 (should be empty)
                similar_response = await client.get(
                    f"/api/conversations/{conv1_id}/similar",
                    headers=auth_headers
                )
                assert similar_response.status_code == 200
                initial_similar = similar_response.json()
                assert len(initial_similar["conversations"]) == 0
                
                # Add enough messages to conv1 to trigger summary generation
                # Need 1000+ tokens, so use longer messages (55+ tokens each)
                for i in range(20):
                    message_content = "This is a detailed Python programming message that discusses various programming concepts, best practices, and tutorial content. We cover object-oriented programming, functional programming, data structures, algorithms, and much more. " * 1
                    
                    response = await client.post(
                        f"/api/conversations/{conv1_id}/messages",
                        headers=auth_headers,
                        json={
                            "content": message_content,
                            "role": "user"
                        }
                    )
                    assert response.status_code == 200
                
                # Verify summary was generated
                assert mock_summary.call_count >= 1
                assert mock_store.call_count >= 1
                
                # Now mock that conv2 shows up as similar after conv1's summary was generated
                mock_find_similar.return_value = [
                    {
                        'id': conv2_id,
                        'title': 'Second conversation about JavaScript',
                        'summary': 'JavaScript programming and web development',
                        'similarity_score': 0.75,
                        'is_public': True,
                        'created_at': '2023-01-01T00:00:00Z',
                        'author': {
                            'id': user.id,
                            'username': user.username
                        }
                    }
                ]
                
                # Get similar conversations again - should now include conv2
                similar_response = await client.get(
                    f"/api/conversations/{conv1_id}/similar",
                    headers=auth_headers
                )
                assert similar_response.status_code == 200
                updated_similar = similar_response.json()
                
                # Should now have 1 similar conversation
                assert len(updated_similar["conversations"]) == 1
                assert updated_similar["conversations"][0]["id"] == conv2_id
                assert updated_similar["conversations"][0]["title"] == "Second conversation about JavaScript"
                assert updated_similar["conversations"][0]["similarity_score"] == 0.75

    @pytest.mark.asyncio
    async def test_similar_conversations_endpoint_called_with_updated_summary(self, db_session, override_get_db):
        """Test that the similar conversations endpoint uses the updated summary after regeneration"""
        # Create user
        user = User(
            username="testuser2",
            display_name="Test User 2",
            email="test2@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login to get token
            login_response = await client.post("/api/auth/login", json={
                "username": "testuser2",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}
            
            # Create a conversation
            response = await client.post(
                "/api/conversations/",
                headers=auth_headers,
                json={
                    "title": "Machine Learning Discussion",
                    "is_public": True
                }
            )
            assert response.status_code == 200
            conversation_id = response.json()["id"]
            
            # Mock services
            with patch('app.services.vector_service.vector_service.find_similar_conversations') as mock_find_similar, \
                 patch('app.services.summary_service.SummaryService.generate_summary') as mock_summary, \
                 patch('app.services.vector_service.vector_service.store_conversation_embedding') as mock_store:
                
                # Mock summary generation
                mock_summary.return_value = "Machine learning algorithms and neural networks discussion"
                mock_find_similar.return_value = []
                
                # Before adding messages, the conversation has no summary
                # Try to get similar conversations - should return no summary message
                similar_response = await client.get(
                    f"/api/conversations/{conversation_id}/similar",
                    headers=auth_headers
                )
                assert similar_response.status_code == 200
                data = similar_response.json()
                assert data["message"] == "No summary available for similarity search"
                
                # Add messages to trigger summary generation
                # Need 1000+ tokens, so use longer messages (55+ tokens each)
                for i in range(20):
                    message_content = "This is a comprehensive machine learning discussion covering neural networks, deep learning, algorithms, and practical applications in AI development. We explore supervised learning, unsupervised learning, reinforcement learning, and cutting-edge research. " * 1
                    
                    response = await client.post(
                        f"/api/conversations/{conversation_id}/messages",
                        headers=auth_headers,
                        json={
                            "content": message_content,
                            "role": "user"
                        }
                    )
                    assert response.status_code == 200
                
                # Verify summary was generated
                assert mock_summary.call_count >= 1
                
                # Verify the conversation now has a summary
                conversation_result = await db_session.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
                conversation = conversation_result.scalar_one()
                assert conversation.summary_public is not None
                
                # Now when we call similar conversations, it should use the vector service
                # (because there is a summary now)
                similar_response = await client.get(
                    f"/api/conversations/{conversation_id}/similar",
                    headers=auth_headers
                )
                assert similar_response.status_code == 200
                data = similar_response.json()
                
                # Should call find_similar_conversations with the conversation ID
                mock_find_similar.assert_called_with(
                    conversation_id=str(conversation_id),
                    limit=20
                )
                
                # Should not return the "no summary" message anymore
                assert "message" not in data or data["message"] != "No summary available for similarity search"