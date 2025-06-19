import pytest
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from sqlalchemy import select
from app.models import User, Conversation
from app.main import app
import asyncio
import json
import threading
import time


class TestPresenceBroadcasting:
    @pytest.mark.asyncio
    async def test_user_presence_is_broadcasted_to_conversation_participants(self, db_session, override_get_db):
        """Test that user presence updates are broadcasted to all conversation participants"""
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
            # Login as both users
            login_response1 = await client.post("/api/auth/login", json={
                "username": "user1",
                "password": "password"
            })
            token1 = login_response1.json()["access_token"]
            
            login_response2 = await client.post("/api/auth/login", json={
                "username": "user2",
                "password": "password"
            })
            token2 = login_response2.json()["access_token"]
            
            # Create a conversation as user1
            conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token1}"},
                json={
                    "title": "Test conversation for presence broadcasting",
                    "is_public": True
                }
            )
            assert conv_response.status_code == 200
            conversation_id = conv_response.json()["id"]
            
            # Test presence broadcasting with TestClient
            with TestClient(app) as test_client:
                # Connect user1 first
                with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token1}") as ws1:
                    # User1 should receive their own join message
                    join_msg1 = ws1.receive_json()
                    assert join_msg1["type"] == "presence_update"
                    assert join_msg1["action"] == "joined"
                    assert join_msg1["user_id"] == user1.id
                    assert join_msg1["username"] == user1.username
                    
                    # User1 receives connection established
                    conn_msg1 = ws1.receive_json()
                    assert conn_msg1["type"] == "connection_established"
                    
                    # Now connect user2 - user1 should see user2 join
                    with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token2}") as ws2:
                        # User2 receives their own join message
                        join_msg2_self = ws2.receive_json()
                        assert join_msg2_self["type"] == "presence_update"
                        assert join_msg2_self["action"] == "joined"
                        assert join_msg2_self["user_id"] == user2.id
                        
                        # User1 should also receive user2's join message
                        join_msg2_to_user1 = ws1.receive_json()
                        assert join_msg2_to_user1["type"] == "presence_update"
                        assert join_msg2_to_user1["action"] == "joined"
                        assert join_msg2_to_user1["user_id"] == user2.id
                        assert join_msg2_to_user1["username"] == user2.username
                        
                        # User2 receives connection established
                        conn_msg2 = ws2.receive_json()
                        assert conn_msg2["type"] == "connection_established"
                        
                        # When user2 disconnects, user1 should see leave message
                        # (This happens automatically when the context manager exits)
                    
                    # User1 should receive user2's leave message
                    leave_msg = ws1.receive_json()
                    assert leave_msg["type"] == "presence_update"
                    assert leave_msg["action"] == "left"
                    assert leave_msg["user_id"] == user2.id
                    assert leave_msg["username"] == user2.username

    @pytest.mark.asyncio
    async def test_presence_updates_only_sent_to_authorized_participants(self, db_session, override_get_db):
        """Test that presence updates are only sent to users who have access to the conversation"""
        # Create three users
        owner = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com"
        )
        owner.set_password("password")
        db_session.add(owner)
        
        participant = User(
            username="participant",
            display_name="Participant",
            email="participant@example.com"
        )
        participant.set_password("password")
        db_session.add(participant)
        
        outsider = User(
            username="outsider",
            display_name="Outsider",
            email="outsider@example.com"
        )
        outsider.set_password("password")
        db_session.add(outsider)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login all users
            login_response_owner = await client.post("/api/auth/login", json={
                "username": "owner",
                "password": "password"
            })
            token_owner = login_response_owner.json()["access_token"]
            
            login_response_participant = await client.post("/api/auth/login", json={
                "username": "participant",
                "password": "password"
            })
            token_participant = login_response_participant.json()["access_token"]
            
            login_response_outsider = await client.post("/api/auth/login", json={
                "username": "outsider",
                "password": "password"
            })
            token_outsider = login_response_outsider.json()["access_token"]
            
            # Create a public conversation as owner
            conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token_owner}"},
                json={
                    "title": "Public conversation for testing",
                    "is_public": True
                }
            )
            assert conv_response.status_code == 200
            conversation_id = conv_response.json()["id"]
            
            # Create a private conversation as owner
            private_conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token_owner}"},
                json={
                    "title": "Private conversation for testing",
                    "is_public": False
                }
            )
            assert private_conv_response.status_code == 200
            private_conversation_id = private_conv_response.json()["id"]
            
            with TestClient(app) as test_client:
                # All users can connect to public conversation
                with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token_owner}") as ws_owner:
                    with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token_participant}") as ws_participant:
                        # Both users should see each other's presence
                        
                        # Skip initial messages
                        ws_owner.receive_json()  # owner join
                        ws_owner.receive_json()  # connection established
                        
                        ws_participant.receive_json()  # participant join
                        participant_join_to_owner = ws_owner.receive_json()  # participant join seen by owner
                        assert participant_join_to_owner["type"] == "presence_update"
                        assert participant_join_to_owner["action"] == "joined"
                        assert participant_join_to_owner["user_id"] == participant.id
                        
                        ws_participant.receive_json()  # connection established
                
                # Only owner can connect to private conversation
                with test_client.websocket_connect(f"/api/ws/conversations/{private_conversation_id}?token={token_owner}") as ws_owner_private:
                    # Owner joins private conversation
                    owner_join = ws_owner_private.receive_json()
                    assert owner_join["type"] == "presence_update"
                    assert owner_join["user_id"] == owner.id
                    
                    # Outsider cannot connect to private conversation
                    with pytest.raises(Exception):  # Should fail to connect
                        with test_client.websocket_connect(f"/api/ws/conversations/{private_conversation_id}?token={token_outsider}"):
                            pass

    @pytest.mark.asyncio
    async def test_presence_broadcasting_includes_conversation_metadata(self, db_session, override_get_db):
        """Test that presence update messages include proper conversation metadata"""
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
                    "title": "Metadata test conversation",
                    "is_public": True
                }
            )
            assert conv_response.status_code == 200
            conversation_id = conv_response.json()["id"]
            
            with TestClient(app) as test_client:
                with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token}") as websocket:
                    # Receive presence update
                    presence_data = websocket.receive_json()
                    
                    # Verify presence update structure
                    assert presence_data["type"] == "presence_update"
                    assert presence_data["user_id"] == user.id
                    assert presence_data["username"] == user.username
                    assert presence_data["action"] == "joined"
                    assert presence_data["conversation_id"] == conversation_id
                    assert "timestamp" in presence_data
                    assert isinstance(presence_data["timestamp"], (int, float))

    @pytest.mark.asyncio
    async def test_multiple_users_presence_in_same_conversation(self, db_session, override_get_db):
        """Test presence handling with multiple users joining and leaving the same conversation"""
        # Create three users
        users = []
        tokens = []
        
        for i in range(3):
            user = User(
                username=f"user{i+1}",
                display_name=f"User {i+1}",
                email=f"user{i+1}@example.com"
            )
            user.set_password("password")
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login all users
            for user in users:
                login_response = await client.post("/api/auth/login", json={
                    "username": user.username,
                    "password": "password"
                })
                tokens.append(login_response.json()["access_token"])
            
            # Create conversation
            conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {tokens[0]}"},
                json={
                    "title": "Multi-user presence test",
                    "is_public": True
                }
            )
            assert conv_response.status_code == 200
            conversation_id = conv_response.json()["id"]
            
            with TestClient(app) as test_client:
                websockets = []
                
                # Connect all users sequentially
                for i, token in enumerate(tokens):
                    ws = test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token}")
                    websocket = ws.__enter__()
                    websockets.append((ws, websocket))
                    
                    # Each user receives their own join message
                    own_join = websocket.receive_json()
                    assert own_join["type"] == "presence_update"
                    assert own_join["action"] == "joined"
                    assert own_join["user_id"] == users[i].id
                    
                    # All previously connected users should see this user join
                    for j in range(i):
                        other_join = websockets[j][1].receive_json()
                        assert other_join["type"] == "presence_update"
                        assert other_join["action"] == "joined" 
                        assert other_join["user_id"] == users[i].id
                    
                    # Skip connection established message
                    websocket.receive_json()
                
                # Disconnect users one by one
                for i in range(len(websockets)):
                    websockets[i][0].__exit__(None, None, None)
                    
                    # All remaining users should see this user leave
                    for j in range(i + 1, len(websockets)):
                        leave_msg = websockets[j][1].receive_json()
                        assert leave_msg["type"] == "presence_update"
                        assert leave_msg["action"] == "left"
                        assert leave_msg["user_id"] == users[i].id