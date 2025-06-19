import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import User, Conversation, Message
from app.services.summary_service import summary_service


class TestSearchAPI:
    """Test search and discovery API endpoints."""
    
    @pytest.mark.asyncio
    async def test_search_endpoint_anonymous(self, db_session, override_get_db):
        """Test search endpoint for anonymous users."""
        # Create user and conversation with summary
        user = User(
            username="searchtest",
            display_name="Search Test",
            email="search@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Machine Learning Basics",
            token_count=1500,
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add messages and generate summary
        messages = [
            Message(
                conversation_id=conversation.id,
                from_user_id=user.id,
                role="user",
                content="What is machine learning and how does it work?"
            ),
            Message(
                conversation_id=conversation.id,
                role="assistant",
                content="Machine learning is a subset of AI that enables computers to learn from data without being explicitly programmed."
            )
        ]
        db_session.add_all(messages)
        await db_session.commit()
        
        # Force generate summary and embedding
        await summary_service.force_generate_summary(conversation.id, db_session)
        
        # Test anonymous search
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/search?query=machine learning")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "conversations" in data
            assert "pagination" in data
            assert data["pagination"]["is_anonymous"] is True
            assert data["query"] == "machine learning"
            
            # Should find our conversation
            if data["conversations"]:
                conv = data["conversations"][0]
                assert "id" in conv
                assert "title" in conv
                assert "summary" in conv
                assert "author" in conv
                assert "similarity_score" in conv
    
    @pytest.mark.asyncio
    async def test_search_pagination_anonymous_restricted(self, db_session, override_get_db):
        """Test that anonymous users can't access page 2."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/search?query=test&page=2")
            
            assert response.status_code == 401
            assert "Login required to access additional pages" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_search_with_authenticated_user(self, db_session, override_get_db):
        """Test search endpoint with authenticated user."""
        # Create user
        user = User(
            username="authsearch",
            display_name="Auth Search",
            email="authsearch@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login
            login_response = await client.post("/api/auth/login", json={
                "username": "authsearch",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Test authenticated search (should allow pagination)
            response = await client.post(
                "/api/search?query=test&page=2",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["pagination"]["is_anonymous"] is False
            assert data["pagination"]["page"] == 2
    
    @pytest.mark.asyncio
    async def test_search_empty_query(self, db_session, override_get_db):
        """Test search with empty query."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/search?query=")
            
            assert response.status_code == 400
            assert "Search query cannot be empty" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_discover_endpoint(self, db_session, override_get_db):
        """Test conversation discovery endpoint."""
        # Create user and conversation with summary
        user = User(
            username="discovertest",
            display_name="Discover Test",
            email="discover@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Discovery Test Conversation",
            token_count=1500,
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add message and generate summary
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="This is a test conversation for discovery."
        )
        db_session.add(message)
        await db_session.commit()
        
        await summary_service.force_generate_summary(conversation.id, db_session)
        
        # Test discovery endpoint
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/discover")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "conversations" in data
            assert "total_found" in data
            assert isinstance(data["conversations"], list)
            
            # Should include our conversation if found
            for conv in data["conversations"]:
                assert "id" in conv
                assert "title" in conv
                assert "summary" in conv
                assert "author" in conv
                assert "created_at" in conv
    
    @pytest.mark.asyncio
    async def test_discover_limit_parameter(self, db_session, override_get_db):
        """Test discovery endpoint with limit parameter."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/discover?limit=5")
            
            assert response.status_code == 200
            data = response.json()
            
            # Should respect limit
            assert len(data["conversations"]) <= 5
    
    @pytest.mark.asyncio
    async def test_similar_conversations_endpoint(self, db_session, override_get_db):
        """Test finding similar conversations endpoint."""
        # Create user and conversation
        user = User(
            username="similartest",
            display_name="Similar Test",
            email="similar@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Python Programming",
            token_count=1500,
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add messages and generate summary
        messages = [
            Message(
                conversation_id=conversation.id,
                from_user_id=user.id,
                role="user",
                content="How do I learn Python programming effectively?"
            ),
            Message(
                conversation_id=conversation.id,
                role="assistant",
                content="Start with basic syntax, practice regularly, and build projects."
            )
        ]
        db_session.add_all(messages)
        await db_session.commit()
        
        await summary_service.force_generate_summary(conversation.id, db_session)
        
        # Test similar conversations endpoint
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(f"/api/similar/{conversation.id}")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "source_conversation" in data
            assert "similar_conversations" in data
            assert "total_found" in data
            
            assert data["source_conversation"]["id"] == conversation.id
            assert isinstance(data["similar_conversations"], list)
    
    @pytest.mark.asyncio
    async def test_similar_conversations_not_found(self, db_session, override_get_db):
        """Test similar conversations for non-existent conversation."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/similar/99999")
            
            assert response.status_code == 404
            assert "Conversation not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_similar_conversations_no_summary(self, db_session, override_get_db):
        """Test similar conversations for conversation without summary."""
        # Create conversation without summary
        user = User(
            username="nosummary",
            display_name="No Summary",
            email="nosummary@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="No Summary Conversation",
            token_count=500,  # Below threshold
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(f"/api/similar/{conversation.id}")
            
            assert response.status_code == 400
            assert "does not have a summary yet" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_search_stats_endpoint(self, db_session, override_get_db):
        """Test search statistics endpoint."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/stats")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "total_indexed_conversations" in data
            assert "search_features" in data
            assert isinstance(data["total_indexed_conversations"], int)
            
            features = data["search_features"]
            assert features["semantic_search"] is True
            assert features["pagination"] is True
            assert features["anonymous_access"] == "first_page_only"
            assert features["max_results_per_page"] == 20


class TestSearchAPIEdgeCases:
    """Test edge cases for search API."""
    
    @pytest.mark.asyncio
    async def test_search_invalid_pagination(self, db_session, override_get_db):
        """Test search with invalid pagination parameters."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Invalid page number
            response = await client.post("/api/search?query=test&page=0")
            assert response.status_code == 422  # Validation error
            
            # Invalid limit
            response = await client.post("/api/search?query=test&limit=25")
            assert response.status_code == 422  # Validation error (max 20)
    
    @pytest.mark.asyncio
    async def test_discover_invalid_limit(self, db_session, override_get_db):
        """Test discovery with invalid limit."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/discover?limit=25")
            assert response.status_code == 422  # Validation error (max 20)
    
    @pytest.mark.asyncio
    async def test_similar_conversations_invalid_limit(self, db_session, override_get_db):
        """Test similar conversations with invalid limit."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/similar/1?limit=15")
            assert response.status_code == 422  # Validation error (max 10)