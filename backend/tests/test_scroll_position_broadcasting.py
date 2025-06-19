import pytest
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.models import User, Conversation
from app.main import app
import json


class TestScrollPositionBroadcasting:
    @pytest.mark.asyncio
    async def test_backend_processes_and_broadcasts_scroll_positions(self, db_session, override_get_db):
        """Test that backend receives scroll position updates and broadcasts them to other users"""
        # Create two users
        user1 = User(
            username="user1",
            display_name="User 1",
            email="user1@example.com"
        )
        user1.set_password("password")
        db_session.add(user1)
        
        user2 = User(
            username="user2",
            display_name="User 2",
            email="user2@example.com"
        )
        user2.set_password("password")
        db_session.add(user2)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login both users
            login1 = await client.post("/api/auth/login", json={
                "username": "user1",
                "password": "password"
            })
            token1 = login1.json()["access_token"]
            
            login2 = await client.post("/api/auth/login", json={
                "username": "user2",
                "password": "password"
            })
            token2 = login2.json()["access_token"]
            
            # Create conversation
            conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token1}"},
                json={
                    "title": "Test conversation for scroll tracking",
                    "is_public": True
                }
            )
            conversation_id = conv_response.json()["id"]
            
            with TestClient(app) as test_client:
                # Connect both users via WebSocket
                with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token1}") as ws1:
                    with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token2}") as ws2:
                        # Skip initial connection messages
                        ws1.receive_json()  # presence update
                        ws1.receive_json()  # connection established
                        
                        ws2.receive_json()  # presence update  
                        ws1.receive_json()  # user2 joined (seen by user1)
                        ws2.receive_json()  # connection established
                        
                        # User1 sends scroll position update
                        scroll_update = {
                            "type": "scroll_position_update",
                            "scroll_position": {
                                "scrollTop": 500,
                                "scrollHeight": 2000,
                                "clientHeight": 800,
                                "scrollPercentage": 25.0
                            }
                        }
                        ws1.send_json(scroll_update)
                        
                        # User2 should receive user1's scroll position
                        scroll_broadcast = ws2.receive_json()
                        assert scroll_broadcast["type"] == "user_scroll_position"
                        assert scroll_broadcast["user_id"] == user1.id
                        assert scroll_broadcast["username"] == user1.username
                        assert scroll_broadcast["scroll_position"]["scrollTop"] == 500
                        assert scroll_broadcast["scroll_position"]["scrollHeight"] == 2000
                        assert scroll_broadcast["scroll_position"]["clientHeight"] == 800
                        assert scroll_broadcast["scroll_position"]["scrollPercentage"] == 25.0

    @pytest.mark.asyncio
    async def test_scroll_position_not_sent_to_sender(self, db_session, override_get_db):
        """Test that scroll position updates are not echoed back to the sender"""
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
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "testuser",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Create conversation
            conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "title": "Test conversation",
                    "is_public": True
                }
            )
            conversation_id = conv_response.json()["id"]
            
            with TestClient(app) as test_client:
                with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token}") as websocket:
                    # Skip initial messages
                    websocket.receive_json()  # presence update
                    websocket.receive_json()  # connection established
                    
                    # Send scroll update
                    scroll_update = {
                        "type": "scroll_position_update",
                        "scroll_position": {
                            "scrollTop": 100,
                            "scrollHeight": 1000,
                            "clientHeight": 600,
                            "scrollPercentage": 10.0
                        }
                    }
                    websocket.send_json(scroll_update)
                    
                    # Should not receive own scroll update back
                    # Try to receive with timeout - should timeout
                    import asyncio
                    with pytest.raises(Exception):  # Should timeout or raise
                        websocket.receive_json(timeout=0.5)

    @pytest.mark.asyncio
    async def test_invalid_scroll_position_message_handled(self, db_session, override_get_db):
        """Test that invalid scroll position messages are handled gracefully"""
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
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "testuser",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Create conversation
            conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "title": "Test conversation",
                    "is_public": True
                }
            )
            conversation_id = conv_response.json()["id"]
            
            with TestClient(app) as test_client:
                with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token}") as websocket:
                    # Skip initial messages
                    websocket.receive_json()  # presence update
                    websocket.receive_json()  # connection established
                    
                    # Send invalid scroll update (missing required fields)
                    invalid_update = {
                        "type": "scroll_position_update",
                        "scroll_position": {
                            "scrollTop": 100
                            # Missing other required fields
                        }
                    }
                    websocket.send_json(invalid_update)
                    
                    # Should receive error message
                    error_msg = websocket.receive_json()
                    assert error_msg["type"] == "error"
                    assert "scroll position" in error_msg["message"].lower()

    @pytest.mark.asyncio
    async def test_scroll_position_only_broadcast_within_conversation(self, db_session, override_get_db):
        """Test that scroll positions are only broadcast to users in the same conversation"""
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
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "testuser",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Create two conversations
            conv1_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "title": "Conversation 1",
                    "is_public": True
                }
            )
            conv1_id = conv1_response.json()["id"]
            
            conv2_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "title": "Conversation 2",
                    "is_public": True
                }
            )
            conv2_id = conv2_response.json()["id"]
            
            with TestClient(app) as test_client:
                # Connect to both conversations
                with test_client.websocket_connect(f"/api/ws/conversations/{conv1_id}?token={token}") as ws1:
                    with test_client.websocket_connect(f"/api/ws/conversations/{conv2_id}?token={token}") as ws2:
                        # Skip initial messages
                        ws1.receive_json()  # presence update conv1
                        ws1.receive_json()  # connection established conv1
                        
                        ws2.receive_json()  # presence update conv2
                        ws2.receive_json()  # connection established conv2
                        
                        # Send scroll update to conversation 1
                        scroll_update = {
                            "type": "scroll_position_update",
                            "scroll_position": {
                                "scrollTop": 200,
                                "scrollHeight": 1000,
                                "clientHeight": 500,
                                "scrollPercentage": 20.0
                            }
                        }
                        ws1.send_json(scroll_update)
                        
                        # Conversation 2 should not receive the update
                        with pytest.raises(Exception):  # Should timeout
                            ws2.receive_json(timeout=0.5)