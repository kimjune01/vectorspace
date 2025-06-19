import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.models import User
from app.main import app
from jose import jwt
import os


class TestAuthEndpoints:
    """Test cases for authentication endpoints."""
    
    @pytest.mark.asyncio
    async def test_signup_success(self, db_session, override_get_db):
        """Test successful user signup."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/signup", json={
                "username": "newuser123",
                "display_name": "New User",
                "email": "newuser@example.com",
                "password": "securepass123"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["username"] == "newuser123"
        assert data["user"]["display_name"] == "New User"
        assert "password" not in data["user"]
        
        # Verify user was created in database
        result = await db_session.execute(
            select(User).where(User.username == "newuser123")
        )
        user = result.scalar_one()
        assert user.display_name == "New User"
        assert user.verify_password("securepass123")
    
    @pytest.mark.asyncio
    async def test_signup_duplicate_username(self, db_session, override_get_db):
        """Test signup with duplicate username."""
        # Create existing user
        user = User(
            username="existinguser",
            display_name="Existing User",
            email="existing@example.com"
        )
        user.set_password("password123")
        db_session.add(user)
        await db_session.commit()
        
        # Try to signup with same username
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/signup", json={
                "username": "existinguser",
                "display_name": "Another User",
                "email": "another@example.com",
                "password": "anotherpass"
            })
        
        assert response.status_code == 400
        assert "already taken" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_login_success(self, db_session, override_get_db):
        """Test successful login."""
        # Create user
        user = User(
            username="loginuser",
            display_name="Login User",
            email="login@example.com"
        )
        user.set_password("correctpass")
        db_session.add(user)
        await db_session.commit()
        
        # Login
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/login", json={
                "username": "loginuser",
                "password": "correctpass"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        
        # Verify JWT token
        from app.auth import SECRET_KEY, ALGORITHM
        payload = jwt.decode(data["access_token"], SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "loginuser"
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, db_session, override_get_db):
        """Test login with invalid credentials."""
        # Create user
        user = User(
            username="testuser",
            display_name="Test User",
            email="test@example.com"
        )
        user.set_password("correctpass")
        db_session.add(user)
        await db_session.commit()
        
        # Try invalid password
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/login", json={
                "username": "testuser",
                "password": "wrongpass"
            })
        
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, db_session, override_get_db):
        """Test getting current user info."""
        # Create user
        user = User(
            username="currentuser",
            display_name="Current User",
            email="current@example.com",
            bio="Test bio",
            conversation_count=5
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Login to get token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "currentuser",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Get current user
            response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "currentuser"
        assert data["display_name"] == "Current User"
        assert data["bio"] == "Test bio"
        assert data["conversation_count"] == 5
        assert "password" not in data
        assert "password_hash" not in data
    
    @pytest.mark.asyncio
    async def test_protected_endpoint_without_token(self, override_get_db):
        """Test accessing protected endpoint without token."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/auth/me")
        
        assert response.status_code == 403
        assert "Not authenticated" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_logout_success(self, db_session, override_get_db):
        """Test successful logout."""
        # Create user and get token
        user = User(
            username="logoutuser",
            display_name="Logout User",
            email="logout@example.com"
        )
        user.set_password("password123")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login to get token
            login_response = await client.post("/api/auth/login", json={
                "username": "logoutuser",
                "password": "password123"
            })
            token = login_response.json()["access_token"]
            
            # Verify token works
            me_response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert me_response.status_code == 200
            
            # Logout
            logout_response = await client.post(
                "/api/auth/logout",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert logout_response.status_code == 200
            assert "logged out" in logout_response.json()["message"]
            
            # Verify token no longer works
            me_response_after = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert me_response_after.status_code == 401
    
    @pytest.mark.asyncio
    async def test_signup_duplicate_email(self, db_session, override_get_db):
        """Test signup with duplicate email."""
        # Create existing user
        user = User(
            username="user1",
            display_name="User One",
            email="duplicate@example.com"
        )
        user.set_password("password123")
        db_session.add(user)
        await db_session.commit()
        
        # Try to signup with same email
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/signup", json={
                "username": "user2",
                "display_name": "User Two",
                "email": "duplicate@example.com",
                "password": "anotherpass"
            })
        
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio 
    async def test_password_reset_request(self, db_session, override_get_db):
        """Test password reset request."""
        # Create user
        user = User(
            username="resetuser",
            display_name="Reset User",
            email="reset@example.com"
        )
        user.set_password("oldpassword")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Request password reset
            response = await client.post("/api/auth/password-reset-request", json={
                "email": "reset@example.com"
            })
            
            assert response.status_code == 200
            assert "reset link has been sent" in response.json()["message"]
    
    @pytest.mark.asyncio
    async def test_password_reset_request_nonexistent_email(self, override_get_db):
        """Test password reset request with non-existent email."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/password-reset-request", json={
                "email": "nonexistent@example.com"
            })
            
            # Should still return success to prevent email enumeration
            assert response.status_code == 200
            assert "reset link has been sent" in response.json()["message"]
    
    @pytest.mark.asyncio
    async def test_password_reset_with_valid_token(self, db_session, override_get_db):
        """Test password reset with valid token."""
        from app.models import PasswordResetToken
        
        # Create user
        user = User(
            username="resetuser2",
            display_name="Reset User 2",
            email="reset2@example.com"
        )
        user.set_password("oldpassword")
        db_session.add(user)
        await db_session.commit()
        
        # Create reset token
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=PasswordResetToken.generate_secure_token()
        )
        db_session.add(reset_token)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Reset password
            response = await client.post("/api/auth/password-reset", json={
                "token": reset_token.token,
                "new_password": "newpassword123"
            })
            
            assert response.status_code == 200
            assert "successfully updated" in response.json()["message"]
            
            # Verify old password no longer works
            login_old = await client.post("/api/auth/login", json={
                "username": "resetuser2",
                "password": "oldpassword"
            })
            assert login_old.status_code == 401
            
            # Verify new password works
            login_new = await client.post("/api/auth/login", json={
                "username": "resetuser2", 
                "password": "newpassword123"
            })
            assert login_new.status_code == 200
    
    @pytest.mark.asyncio
    async def test_password_reset_with_invalid_token(self, override_get_db):
        """Test password reset with invalid token."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/password-reset", json={
                "token": "invalid-token-123",
                "new_password": "newpassword123"
            })
            
            assert response.status_code == 400
            assert "invalid or expired" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_signup_missing_email(self, override_get_db):
        """Test signup without email should fail."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/auth/signup", json={
                "username": "noemailuser",
                "display_name": "No Email User",
                "password": "securepass123"
            })
        
        assert response.status_code == 422  # Validation error