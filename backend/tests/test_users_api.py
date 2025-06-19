import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import User, Conversation, Message


class TestUsersAPI:
    """Test user profile and management API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_user_profile_public(self, db_session, override_get_db):
        """Test getting a user's public profile."""
        # Create user with profile data
        user = User(
            username="profiletest",
            display_name="Profile Test User",
            email="profile@example.com",
            bio="I love AI and programming!"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create some public conversations
        conversations = [
            Conversation(
                user_id=user.id,
                title="Public Conversation 1",
                is_public=True,
                is_hidden_from_profile=False,
                summary_public="This is a public conversation about AI.",
                view_count=10
            ),
            Conversation(
                user_id=user.id,
                title="Hidden Conversation",
                is_public=True,
                is_hidden_from_profile=True,  # Should not appear in profile
                summary_public="This is hidden from profile."
            ),
            Conversation(
                user_id=user.id,
                title="Private Conversation",
                is_public=False,  # Should not appear in profile
                summary_public="This is private."
            )
        ]
        
        db_session.add_all(conversations)
        await db_session.commit()
        
        # Test getting public profile
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(f"/api/users/profile/{user.username}")
            
            assert response.status_code == 200
            data = response.json()
            
            # Check profile data
            assert data["username"] == user.username
            assert data["display_name"] == user.display_name
            assert data["bio"] == user.bio
            assert data["stripe_pattern_seed"] == user.stripe_pattern_seed
            assert "recent_conversations" in data
            
            # Should only show public, non-hidden conversations
            assert len(data["recent_conversations"]) == 1
            assert data["recent_conversations"][0]["title"] == "Public Conversation 1"
            assert data["recent_conversations"][0]["summary"] == "This is a public conversation about AI."
    
    @pytest.mark.asyncio
    async def test_get_user_profile_not_found(self, db_session, override_get_db):
        """Test getting profile for non-existent user."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/users/profile/nonexistent")
            
            assert response.status_code == 404
            assert "User not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_get_my_profile(self, db_session, override_get_db):
        """Test getting own profile (includes private data)."""
        # Create user
        user = User(
            username="myprofile",
            display_name="My Profile",
            email="myprofile@example.com",
            bio="My personal bio"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversations including hidden/private
        conversations = [
            Conversation(
                user_id=user.id,
                title="Public Conversation",
                is_public=True,
                is_hidden_from_profile=False,
                summary_raw="Raw summary with PII",
                summary_public="Filtered summary"
            ),
            Conversation(
                user_id=user.id,
                title="Hidden Conversation",
                is_public=True,
                is_hidden_from_profile=True
            ),
            Conversation(
                user_id=user.id,
                title="Private Conversation",
                is_public=False
            )
        ]
        
        db_session.add_all(conversations)
        await db_session.commit()
        
        # Login and get own profile
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login first
            login_response = await client.post("/api/auth/login", json={
                "username": "myprofile",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Get own profile
            response = await client.get(
                "/api/users/me/profile",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Should include private data
            assert data["email"] == user.email
            assert len(data["recent_conversations"]) == 3  # Includes all conversations
            
            # Should show raw summary for own profile
            public_conv = next(c for c in data["recent_conversations"] if c["title"] == "Public Conversation")
            assert public_conv["summary"] == "Raw summary with PII"
            assert public_conv["is_hidden_from_profile"] is False
            assert public_conv["is_public"] is True
    
    @pytest.mark.asyncio
    async def test_update_profile(self, db_session, override_get_db):
        """Test updating user profile."""
        # Create user
        user = User(
            username="updatetest",
            display_name="Original Name",
            email="update@example.com",
            bio="Original bio"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "updatetest",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Update profile
            response = await client.put(
                "/api/users/me/profile",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "bio": "Updated bio",
                    "display_name": "New Display Name"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["bio"] == "Updated bio"
            assert data["display_name"] == "New Display Name"
            
            # Verify in database
            await db_session.refresh(user)
            assert user.bio == "Updated bio"
            assert user.display_name == "New Display Name"
    
    @pytest.mark.asyncio
    async def test_update_profile_validation(self, db_session, override_get_db):
        """Test profile update validation."""
        # Create user
        user = User(
            username="validationtest",
            display_name="Validation Test",
            email="validation@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "validationtest",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Test bio too long
            response = await client.put(
                "/api/users/me/profile",
                headers={"Authorization": f"Bearer {token}"},
                json={"bio": "x" * 201}  # Exceeds 200 char limit
            )
            assert response.status_code == 400
            assert "200 characters or less" in response.json()["detail"]
            
            # Test empty display name
            response = await client.put(
                "/api/users/me/profile",
                headers={"Authorization": f"Bearer {token}"},
                json={"display_name": "   "}  # Whitespace only
            )
            assert response.status_code == 400
            assert "cannot be empty" in response.json()["detail"]
            
            # Test display name too long
            response = await client.put(
                "/api/users/me/profile",
                headers={"Authorization": f"Bearer {token}"},
                json={"display_name": "x" * 101}  # Exceeds 100 char limit
            )
            assert response.status_code == 400
            assert "100 characters or less" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_get_my_conversations(self, db_session, override_get_db):
        """Test getting user's own conversations with pagination."""
        # Create user
        user = User(
            username="myconvs",
            display_name="My Convs",
            email="myconvs@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create multiple conversations
        conversations = []
        for i in range(15):
            conv = Conversation(
                user_id=user.id,
                title=f"Conversation {i+1}",
                is_public=i % 2 == 0,  # Alternate public/private
                is_hidden_from_profile=i % 3 == 0  # Every 3rd is hidden
            )
            conversations.append(conv)
        
        db_session.add_all(conversations)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "myconvs",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Get first page of conversations
            response = await client.get(
                "/api/users/me/conversations?page=1&limit=10",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert len(data["conversations"]) == 10
            assert data["pagination"]["page"] == 1
            assert data["pagination"]["total_count"] == 15
            assert data["pagination"]["has_more"] is True
            
            # Test filtering
            response = await client.get(
                "/api/users/me/conversations?include_hidden=false&include_private=false",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Should only include public, non-hidden conversations
            for conv in data["conversations"]:
                assert conv["is_public"] is True
                assert conv["is_hidden_from_profile"] is False
    
    @pytest.mark.asyncio
    async def test_update_conversation_visibility(self, db_session, override_get_db):
        """Test hiding/showing conversations from profile."""
        # Create user and conversation
        user = User(
            username="visibilitytest",
            display_name="Visibility Test",
            email="visibility@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Visibility Test Conversation",
            is_public=True,
            is_hidden_from_profile=False
        )
        db_session.add(conversation)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "visibilitytest",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Hide conversation from profile
            response = await client.put(
                f"/api/users/me/conversations/{conversation.id}/visibility?is_hidden=true",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["is_hidden_from_profile"] is True
            
            # Verify in database
            await db_session.refresh(conversation)
            assert conversation.is_hidden_from_profile is True
            
            # Show conversation on profile again
            response = await client.put(
                f"/api/users/me/conversations/{conversation.id}/visibility?is_hidden=false",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            await db_session.refresh(conversation)
            assert conversation.is_hidden_from_profile is False
    
    @pytest.mark.asyncio
    async def test_update_conversation_visibility_not_owner(self, db_session, override_get_db):
        """Test that users can't modify conversations they don't own."""
        # Create two users
        user1 = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com"
        )
        user1.set_password("password")
        
        user2 = User(
            username="notowner",
            display_name="Not Owner",
            email="notowner@example.com"
        )
        user2.set_password("password")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        
        # Create conversation owned by user1
        conversation = Conversation(
            user_id=user1.id,
            title="Owner's Conversation",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as user2
            login_response = await client.post("/api/auth/login", json={
                "username": "notowner",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Try to modify conversation visibility
            response = await client.put(
                f"/api/users/me/conversations/{conversation.id}/visibility?is_hidden=true",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 404
            assert "not found or not owned" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_get_user_stats(self, db_session, override_get_db):
        """Test getting overall user statistics."""
        # Create some users with conversations
        users = [
            User(username="user1", display_name="User 1", email="user1@example.com", conversations_last_24h=3),
            User(username="user2", display_name="User 2", email="user2@example.com", conversations_last_24h=0),
            User(username="user3", display_name="User 3", email="user3@example.com", conversations_last_24h=1)
        ]
        
        for user in users:
            user.set_password("password")
        
        db_session.add_all(users)
        await db_session.commit()
        
        # Create some public conversations
        public_conversations = [
            Conversation(user_id=users[0].id, title="Public 1", is_public=True),
            Conversation(user_id=users[1].id, title="Public 2", is_public=True),
            Conversation(user_id=users[2].id, title="Private", is_public=False)
        ]
        
        db_session.add_all(public_conversations)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/users/stats")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["total_users"] == 3
            assert data["active_users_last_24h"] == 2  # users with conversations_last_24h > 0
            assert data["users_with_public_conversations"] == 2  # users with public conversations
            assert "user_features" in data


class TestUsersAPIEdgeCases:
    """Test edge cases for users API."""
    
    @pytest.mark.asyncio
    async def test_profile_without_bio(self, db_session, override_get_db):
        """Test profile for user without bio."""
        user = User(
            username="nobio",
            display_name="No Bio",
            email="nobio@example.com"
            # No bio set
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(f"/api/users/profile/{user.username}")
            
            assert response.status_code == 200
            data = response.json()
            assert data["bio"] is None
    
    @pytest.mark.asyncio
    async def test_profile_no_conversations(self, db_session, override_get_db):
        """Test profile for user with no conversations."""
        user = User(
            username="noconvs",
            display_name="No Conversations",
            email="noconvs@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(f"/api/users/profile/{user.username}")
            
            assert response.status_code == 200
            data = response.json()
            assert data["recent_conversations"] == []
            assert data["conversation_count"] == 0