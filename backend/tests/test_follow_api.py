"""
Tests for follow system API endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import User, Follow, Notification
from app.database import get_db
from sqlalchemy import select


class TestFollowAPI:
    """Test follow/unfollow API endpoints."""
    
    @pytest.mark.asyncio
    async def test_follow_user_success(self, db_session, test_users, override_get_db):
        """Test successfully following a user."""
        alice, bob = test_users[:2]
        
        with TestClient(app) as client:
            # Mock authentication to return alice
            app.dependency_overrides.clear()
            app.dependency_overrides[get_db] = lambda: db_session
            
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: alice
            
            # Follow bob
            response = client.post(f"/api/users/{bob.id}/follow")
            
            assert response.status_code == 200
            data = response.json()
            assert data["follower_id"] == alice.id
            assert data["following_id"] == bob.id
            assert "created_at" in data
            
            # Verify follow relationship in database
            follow_result = await db_session.execute(
                select(Follow).where(
                    Follow.follower_id == alice.id,
                    Follow.following_id == bob.id
                )
            )
            follow = follow_result.scalar_one_or_none()
            assert follow is not None
            
            # Verify notification was created
            notification_result = await db_session.execute(
                select(Notification).where(
                    Notification.user_id == bob.id,
                    Notification.type == "follow"
                )
            )
            notification = notification_result.scalar_one_or_none()
            assert notification is not None
            assert notification.related_user_id == alice.id
    
    @pytest.mark.asyncio
    async def test_follow_self_error(self, db_session, test_user, override_get_db):
        """Test that users cannot follow themselves."""
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: test_user
            
            response = client.post(f"/api/users/{test_user.id}/follow")
            
            assert response.status_code == 400
            assert "Cannot follow yourself" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_follow_nonexistent_user(self, db_session, test_user, override_get_db):
        """Test following a non-existent user."""
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: test_user
            
            response = client.post("/api/users/99999/follow")
            
            assert response.status_code == 404
            assert "User not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_follow_already_following(self, db_session, test_users, override_get_db):
        """Test following a user already being followed."""
        alice, bob = test_users[:2]
        
        # Create existing follow relationship
        follow = Follow(follower_id=alice.id, following_id=bob.id)
        db_session.add(follow)
        await db_session.commit()
        
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: alice
            
            response = client.post(f"/api/users/{bob.id}/follow")
            
            assert response.status_code == 400
            assert "Already following this user" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_unfollow_user_success(self, db_session, test_users, override_get_db):
        """Test successfully unfollowing a user."""
        alice, bob = test_users[:2]
        
        # Create follow relationship
        follow = Follow(follower_id=alice.id, following_id=bob.id)
        db_session.add(follow)
        await db_session.commit()
        
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: alice
            
            response = client.delete(f"/api/users/{bob.id}/follow")
            
            assert response.status_code == 200
            assert "Successfully unfollowed user" in response.json()["message"]
            
            # Verify follow relationship was deleted
            follow_result = await db_session.execute(
                select(Follow).where(
                    Follow.follower_id == alice.id,
                    Follow.following_id == bob.id
                )
            )
            follow = follow_result.scalar_one_or_none()
            assert follow is None
    
    @pytest.mark.asyncio
    async def test_unfollow_not_following(self, db_session, test_users, override_get_db):
        """Test unfollowing a user not being followed (should not error)."""
        alice, bob = test_users[:2]
        
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: alice
            
            response = client.delete(f"/api/users/{bob.id}/follow")
            
            assert response.status_code == 200
            assert "Successfully unfollowed user" in response.json()["message"]


class TestFollowListAPI:
    """Test follower/following list API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_followers_success(self, db_session, test_users, override_get_db):
        """Test getting a user's followers list."""
        alice, bob, carol = test_users[:3]
        
        # Create follow relationships (alice and carol follow bob)
        follow1 = Follow(follower_id=alice.id, following_id=bob.id)
        follow2 = Follow(follower_id=carol.id, following_id=bob.id)
        db_session.add_all([follow1, follow2])
        await db_session.commit()
        
        with TestClient(app) as client:
            response = client.get(f"/api/users/{bob.id}/followers")
            
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 2
            assert len(data["followers"]) == 2
            
            # Check follower data structure
            follower = data["followers"][0]
            assert "id" in follower
            assert "username" in follower
            assert "display_name" in follower
            assert "followed_at" in follower
    
    @pytest.mark.asyncio
    async def test_get_following_success(self, db_session, test_users, override_get_db):
        """Test getting a user's following list."""
        alice, bob, carol = test_users[:3]
        
        # Create follow relationships (alice follows bob and carol)
        follow1 = Follow(follower_id=alice.id, following_id=bob.id)
        follow2 = Follow(follower_id=alice.id, following_id=carol.id)
        db_session.add_all([follow1, follow2])
        await db_session.commit()
        
        with TestClient(app) as client:
            response = client.get(f"/api/users/{alice.id}/following")
            
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 2
            assert len(data["following"]) == 2
    
    @pytest.mark.asyncio
    async def test_get_followers_pagination(self, db_session, test_users, override_get_db):
        """Test followers list pagination."""
        alice, bob = test_users[:2]
        
        # Create multiple follow relationships
        followers = test_users[2:5]  # Use users 2, 3, 4 as followers
        for follower in followers:
            follow = Follow(follower_id=follower.id, following_id=bob.id)
            db_session.add(follow)
        await db_session.commit()
        
        with TestClient(app) as client:
            # Test first page
            response = client.get(f"/api/users/{bob.id}/followers?page=1&per_page=2")
            
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 3
            assert len(data["followers"]) == 2
            assert data["has_next"] is True
            assert data["has_prev"] is False
            
            # Test second page
            response = client.get(f"/api/users/{bob.id}/followers?page=2&per_page=2")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data["followers"]) == 1
            assert data["has_next"] is False
            assert data["has_prev"] is True
    
    @pytest.mark.asyncio
    async def test_get_followers_nonexistent_user(self, db_session, override_get_db):
        """Test getting followers for non-existent user."""
        with TestClient(app) as client:
            response = client.get("/api/users/99999/followers")
            
            assert response.status_code == 404
            assert "User not found" in response.json()["detail"]


class TestFollowStatsAPI:
    """Test follow statistics API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_follow_stats_success(self, db_session, test_users, override_get_db):
        """Test getting user's follow statistics."""
        alice, bob, carol = test_users[:3]
        
        # Alice follows bob, bob follows carol, carol follows alice
        follows = [
            Follow(follower_id=alice.id, following_id=bob.id),
            Follow(follower_id=bob.id, following_id=carol.id),
            Follow(follower_id=carol.id, following_id=alice.id)
        ]
        db_session.add_all(follows)
        await db_session.commit()
        
        with TestClient(app) as client:
            response = client.get(f"/api/users/{alice.id}/follow-stats")
            
            assert response.status_code == 200
            data = response.json()
            assert data["followers_count"] == 1  # carol follows alice
            assert data["following_count"] == 1  # alice follows bob
    
    @pytest.mark.asyncio
    async def test_check_if_following_true(self, db_session, test_users, override_get_db):
        """Test checking follow status when following."""
        alice, bob = test_users[:2]
        
        # Create follow relationship
        follow = Follow(follower_id=alice.id, following_id=bob.id)
        db_session.add(follow)
        await db_session.commit()
        
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: alice
            
            response = client.get(f"/api/users/me/is-following/{bob.id}")
            
            assert response.status_code == 200
            assert response.json()["is_following"] is True
    
    @pytest.mark.asyncio
    async def test_check_if_following_false(self, db_session, test_users, override_get_db):
        """Test checking follow status when not following."""
        alice, bob = test_users[:2]
        
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: alice
            
            response = client.get(f"/api/users/me/is-following/{bob.id}")
            
            assert response.status_code == 200
            assert response.json()["is_following"] is False


class TestFollowIntegration:
    """Test follow system integration scenarios."""
    
    @pytest.mark.asyncio
    async def test_follow_unfollow_cycle(self, db_session, test_users, override_get_db):
        """Test complete follow/unfollow cycle."""
        alice, bob = test_users[:2]
        
        with TestClient(app) as client:
            from app.auth import get_current_user
            app.dependency_overrides[get_current_user] = lambda: alice
            
            # Follow
            response = client.post(f"/api/users/{bob.id}/follow")
            assert response.status_code == 200
            
            # Check following status
            response = client.get(f"/api/users/me/is-following/{bob.id}")
            assert response.json()["is_following"] is True
            
            # Check stats
            response = client.get(f"/api/users/{bob.id}/follow-stats")
            data = response.json()
            assert data["followers_count"] == 1
            
            # Unfollow
            response = client.delete(f"/api/users/{bob.id}/follow")
            assert response.status_code == 200
            
            # Check following status again
            response = client.get(f"/api/users/me/is-following/{bob.id}")
            assert response.json()["is_following"] is False
            
            # Check stats again
            response = client.get(f"/api/users/{bob.id}/follow-stats")
            data = response.json()
            assert data["followers_count"] == 0