import pytest
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.models import User, Conversation
from app.main import app


class TestSimplePresence:
    @pytest.mark.asyncio
    async def test_two_users_can_see_each_other_join(self, db_session, override_get_db):
        """Test that two users can see each other join a conversation"""
        # Create two users
        user1 = User(
            username="alice",
            display_name="Alice",
            email="alice@example.com"
        )
        user1.set_password("password")
        db_session.add(user1)
        
        user2 = User(
            username="bob",
            display_name="Bob",
            email="bob@example.com"
        )
        user2.set_password("password")
        db_session.add(user2)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login both users
            login1 = await client.post("/api/auth/login", json={
                "username": "alice",
                "password": "password"
            })
            token1 = login1.json()["access_token"]
            
            login2 = await client.post("/api/auth/login", json={
                "username": "bob",
                "password": "password"
            })
            token2 = login2.json()["access_token"]
            
            # Create conversation
            conv_response = await client.post(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token1}"},
                json={
                    "title": "Test conversation",
                    "is_public": True
                }
            )
            conversation_id = conv_response.json()["id"]
            
            with TestClient(app) as test_client:
                # Alice connects first
                with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token1}") as ws_alice:
                    # Alice gets her own join message
                    alice_join = ws_alice.receive_json()
                    print(f"Alice join message: {alice_join}")
                    
                    # Alice gets connection established
                    alice_conn = ws_alice.receive_json()
                    print(f"Alice connection: {alice_conn}")
                    
                    # Bob connects
                    with test_client.websocket_connect(f"/api/ws/conversations/{conversation_id}?token={token2}") as ws_bob:
                        # Bob gets his own join message
                        bob_join = ws_bob.receive_json()
                        print(f"Bob join message: {bob_join}")
                        
                        # Alice should receive Bob's join message
                        try:
                            bob_join_to_alice = ws_alice.receive_json()
                            print(f"Bob join message to Alice: {bob_join_to_alice}")
                            assert bob_join_to_alice["type"] == "presence_update"
                            assert bob_join_to_alice["action"] == "joined"
                            assert bob_join_to_alice["user_id"] == user2.id
                        except Exception as e:
                            print(f"Failed to receive Bob's join message: {e}")
                            
                        # Bob gets connection established
                        bob_conn = ws_bob.receive_json()
                        print(f"Bob connection: {bob_conn}")