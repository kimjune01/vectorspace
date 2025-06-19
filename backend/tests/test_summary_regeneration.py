import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from sqlalchemy import select
from app.models import User, Conversation, Message
from app.main import app

class TestSummaryRegeneration:
    @pytest.mark.asyncio
    async def test_summary_regeneration_triggers_at_1000_token_milestones(self, db_session, override_get_db):
        """Test that summary regeneration happens at 1000, 2000, 3000+ token milestones"""
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
            
            # Create a conversation
            response = await client.post(
                "/api/conversations/",
                headers=auth_headers,
                json={
                    "title": "Test conversation for summary",
                    "is_public": True
                }
            )
            assert response.status_code == 200
            conversation_id = response.json()["id"]
            
            # Mock the summary service to track calls
            with patch('app.services.summary_service.SummaryService.generate_summary') as mock_summary, \
                 patch('app.services.vector_service.vector_service.store_conversation_embedding') as mock_vector:
                
                # Mock the async generate_summary method to return a simple string
                mock_summary.return_value = "Test summary content for milestone testing"
                
                # Add messages to reach 1000 tokens (first milestone)
                # Token count = characters // 4, so we need 4000 characters for 1000 tokens
                # Each message will have ~200 characters, so we need 20 messages to reach 1000 tokens
                for i in range(20):
                    message_content = "This is a test message with enough content to have around fifty tokens for testing purposes and will help us reach the milestone. This message needs to be long enough to contribute significantly to the total token count. " * 1
                    
                    response = await client.post(
                        f"/api/conversations/{conversation_id}/messages",
                        headers=auth_headers,
                        json={
                            "content": message_content,
                            "role": "user"
                        }
                    )
                    assert response.status_code == 200
                
                # At 1000 tokens, summary should be generated once
                assert mock_summary.call_count >= 1
                
                # Reset mock to test second milestone
                mock_summary.reset_mock()
                
                # Add more messages to reach 2000 tokens (second milestone)
                for i in range(20):
                    message_content = "Another test message with enough content to have around fifty tokens for testing purposes and will help us reach the second milestone. This message also needs to be long enough to contribute significantly. " * 1
                    
                    response = await client.post(
                        f"/api/conversations/{conversation_id}/messages",
                        headers=auth_headers,
                        json={
                            "content": message_content,
                            "role": "user"
                        }
                    )
                    assert response.status_code == 200
                
                # At 2000 tokens, summary should be regenerated
                assert mock_summary.call_count >= 1
                
                # Verify the conversation has a summary
                conversation_result = await db_session.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
                conversation = conversation_result.scalar_one()
                assert conversation.summary_public is not None
                assert conversation.token_count >= 2000

    @pytest.mark.asyncio  
    async def test_summary_not_regenerated_before_1000_tokens(self, db_session, override_get_db):
        """Test that summary is not generated before reaching 1000 tokens"""
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
                    "title": "Test conversation no summary",
                    "is_public": True
                }
            )
            assert response.status_code == 200
            conversation_id = response.json()["id"]
            
            # Mock the summary service
            with patch('app.services.summary_service.SummaryService.generate_summary') as mock_summary:
                mock_summary.return_value = ("Test summary", "Test public summary")
                
                # Add only a few messages (less than 1000 tokens)
                for i in range(5):
                    message_content = "Short message with few tokens."
                    
                    response = await client.post(
                        f"/api/conversations/{conversation_id}/messages",
                        headers=auth_headers,
                        json={
                            "content": message_content,
                            "role": "user"
                        }
                    )
                    assert response.status_code == 200
                
                # Summary should not be generated yet (less than 1000 tokens)
                assert mock_summary.call_count == 0
                
                # Verify conversation has no summary
                conversation_result = await db_session.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
                conversation = conversation_result.scalar_one()
                assert conversation.summary_public is None
                assert conversation.token_count < 1000