"""
Comprehensive tests for curation API endpoints.
Tests all saved conversations and collections functionality.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete
from app.models import User, Conversation, SavedConversation, Collection, CollectionItem, Message
from app.main import app
from datetime import datetime, timezone


class TestSavedConversationsAPI:
    """Test cases for saved conversations endpoints."""
    
    @pytest.mark.asyncio
    async def test_save_conversation_success(self, auth_client, test_user, test_conversation, db_session):
        """Test successfully saving a conversation."""
        response = await auth_client.post(
            f"/api/curation/conversations/{test_conversation.id}/save",
            json={
                "tags": ["important", "work"],
                "personal_note": "This is a useful conversation about AI"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["conversation_id"] == test_conversation.id
        assert data["user_id"] == test_user.id
        assert data["tags"] == ["important", "work"]
        assert data["personal_note"] == "This is a useful conversation about AI"
        assert "saved_at" in data
        assert data["conversation_title"] == test_conversation.title
    
    @pytest.mark.asyncio
    async def test_save_conversation_minimal(self, auth_client, test_user, test_conversation):
        """Test saving a conversation with minimal data."""
        response = await auth_client.post(
            f"/api/curation/conversations/{test_conversation.id}/save",
            json={}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["conversation_id"] == test_conversation.id
        assert data["tags"] == []
        assert data["personal_note"] is None
    
    @pytest.mark.asyncio
    async def test_save_conversation_already_saved(self, auth_client, test_user, test_conversation, db_session):
        """Test error when trying to save an already saved conversation."""
        # First save
        await auth_client.post(f"/api/curation/conversations/{test_conversation.id}/save", json={})
        
        # Try to save again
        response = await auth_client.post(
            f"/api/curation/conversations/{test_conversation.id}/save",
            json={"tags": ["duplicate"]}
        )
        
        assert response.status_code == 400
        assert "already saved" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_save_nonexistent_conversation(self, auth_client):
        """Test error when trying to save a non-existent conversation."""
        response = await auth_client.post(
            "/api/curation/conversations/99999/save",
            json={}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_unsave_conversation_success(self, auth_client, test_user, test_conversation, db_session):
        """Test successfully unsaving a conversation."""
        # First save the conversation
        await auth_client.post(f"/api/curation/conversations/{test_conversation.id}/save", json={})
        
        # Then unsave it
        response = await auth_client.delete(f"/api/curation/conversations/{test_conversation.id}/save")
        
        assert response.status_code == 200
        assert "unsaved successfully" in response.json()["message"]
    
    @pytest.mark.asyncio
    async def test_unsave_conversation_not_saved(self, auth_client, test_conversation):
        """Test error when trying to unsave a conversation that wasn't saved."""
        response = await auth_client.delete(f"/api/curation/conversations/{test_conversation.id}/save")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_update_saved_conversation(self, auth_client, test_user, test_conversation, db_session):
        """Test updating tags and notes of a saved conversation."""
        # First save the conversation
        save_response = await auth_client.post(
            f"/api/curation/conversations/{test_conversation.id}/save",
            json={"tags": ["old_tag"], "personal_note": "Old note"}
        )
        saved_id = save_response.json()["id"]
        
        # Update it
        response = await auth_client.patch(
            f"/api/curation/saved/{saved_id}",
            json={
                "tags": ["new_tag", "updated"],
                "personal_note": "Updated note with more details"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["tags"] == ["new_tag", "updated"]
        assert data["personal_note"] == "Updated note with more details"
    
    @pytest.mark.asyncio
    async def test_get_saved_conversations(self, auth_client, test_user, test_conversation, db_session):
        """Test retrieving user's saved conversations."""
        # Save a conversation first
        await auth_client.post(
            f"/api/curation/conversations/{test_conversation.id}/save",
            json={"tags": ["test"], "personal_note": "Test note"}
        )
        
        response = await auth_client.get("/api/curation/saved")
        
        assert response.status_code == 200
        data = response.json()
        assert "saved_conversations" in data
        assert "total" in data
        assert data["total"] == 1
        assert len(data["saved_conversations"]) == 1
        
        saved = data["saved_conversations"][0]
        assert saved["conversation_id"] == test_conversation.id
        assert saved["tags"] == ["test"]
        assert saved["personal_note"] == "Test note"
    
    @pytest.mark.asyncio
    async def test_get_saved_conversations_with_tag_filter(self, auth_client, test_user, db_session):
        """Test filtering saved conversations by tag."""
        # Create multiple conversations and save them with different tags
        conv1 = Conversation(
            title="Work conversation",
            user_id=test_user.id,
            is_public=True,
            token_count=100
        )
        conv2 = Conversation(
            title="Personal conversation", 
            user_id=test_user.id,
            is_public=True,
            token_count=150
        )
        db_session.add_all([conv1, conv2])
        await db_session.commit()
        await db_session.refresh(conv1)
        await db_session.refresh(conv2)
        
        # Save with different tags
        await auth_client.post(f"/api/curation/conversations/{conv1.id}/save", 
                             json={"tags": ["work", "important"]})
        await auth_client.post(f"/api/curation/conversations/{conv2.id}/save", 
                             json={"tags": ["personal", "fun"]})
        
        # Filter by "work" tag
        response = await auth_client.get("/api/curation/saved?tag=work")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["saved_conversations"]) == 1
        assert data["saved_conversations"][0]["conversation_title"] == "Work conversation"
    
    @pytest.mark.asyncio
    async def test_check_conversation_saved_status(self, auth_client, test_conversation):
        """Test checking if a conversation is saved."""
        # Check unsaved conversation
        response = await auth_client.get(f"/api/curation/saved/check/{test_conversation.id}")
        assert response.status_code == 200
        assert response.json()["is_saved"] is False
        
        # Save the conversation
        await auth_client.post(f"/api/curation/conversations/{test_conversation.id}/save", json={})
        
        # Check saved conversation
        response = await auth_client.get(f"/api/curation/saved/check/{test_conversation.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_saved"] is True
        assert "saved_conversation" in data


class TestCollectionsAPI:
    """Test cases for collections endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_collection_success(self, auth_client, test_user):
        """Test successfully creating a collection."""
        response = await auth_client.post("/api/curation/collections", json={
            "name": "My AI Research",
            "description": "Collection of conversations about AI research",
            "is_public": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "My AI Research"
        assert data["description"] == "Collection of conversations about AI research"
        assert data["is_public"] is False
        assert data["user_id"] == test_user.id
        assert data["item_count"] == 0
    
    @pytest.mark.asyncio
    async def test_create_collection_minimal(self, auth_client, test_user):
        """Test creating a collection with minimal data."""
        response = await auth_client.post("/api/curation/collections", json={
            "name": "Simple Collection"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Simple Collection"
        assert data["description"] is None
        assert data["is_public"] is False  # Default value
    
    @pytest.mark.asyncio
    async def test_create_collection_duplicate_name(self, auth_client, test_user):
        """Test error when creating a collection with duplicate name."""
        # Create first collection
        await auth_client.post("/api/curation/collections", json={"name": "Duplicate Name"})
        
        # Try to create another with same name
        response = await auth_client.post("/api/curation/collections", json={"name": "Duplicate Name"})
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_get_user_collections(self, auth_client, test_user):
        """Test retrieving user's collections."""
        # Create a collection first
        await auth_client.post("/api/curation/collections", json={
            "name": "Test Collection",
            "description": "A test collection"
        })
        
        response = await auth_client.get("/api/curation/collections")
        
        assert response.status_code == 200
        data = response.json()
        assert "collections" in data
        assert "total" in data
        assert data["total"] == 1
        assert len(data["collections"]) == 1
        
        collection = data["collections"][0]
        assert collection["name"] == "Test Collection"
        assert collection["description"] == "A test collection"
    
    @pytest.mark.asyncio
    async def test_get_collection_with_items(self, auth_client, test_user, test_conversation, db_session):
        """Test retrieving a collection with its conversation items."""
        # Create a collection
        collection_response = await auth_client.post("/api/curation/collections", json={
            "name": "Collection with Items"
        })
        collection_id = collection_response.json()["id"]
        
        # Save a conversation and add it to the collection
        await auth_client.post(f"/api/curation/conversations/{test_conversation.id}/save", json={})
        await auth_client.post(f"/api/curation/collections/{collection_id}/items", json={
            "conversation_id": test_conversation.id
        })
        
        response = await auth_client.get(f"/api/curation/collections/{collection_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Collection with Items"
        assert "items" in data
        assert len(data["items"]) == 1
        assert data["items"][0]["conversation_id"] == test_conversation.id
    
    @pytest.mark.asyncio
    async def test_update_collection(self, auth_client, test_user):
        """Test updating a collection's details."""
        # Create a collection
        collection_response = await auth_client.post("/api/curation/collections", json={
            "name": "Original Name",
            "description": "Original description"
        })
        collection_id = collection_response.json()["id"]
        
        # Update it
        response = await auth_client.patch(f"/api/curation/collections/{collection_id}", json={
            "name": "Updated Name",
            "description": "Updated description",
            "is_public": True
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"
        assert data["is_public"] is True
    
    @pytest.mark.asyncio
    async def test_add_conversation_to_collection(self, auth_client, test_user, test_conversation, db_session):
        """Test adding a conversation to a collection."""
        # Create a collection
        collection_response = await auth_client.post("/api/curation/collections", json={
            "name": "Test Collection"
        })
        collection_id = collection_response.json()["id"]
        
        # Save the conversation first
        await auth_client.post(f"/api/curation/conversations/{test_conversation.id}/save", json={})
        
        # Add to collection
        response = await auth_client.post(f"/api/curation/collections/{collection_id}/items", json={
            "conversation_id": test_conversation.id
        })
        
        assert response.status_code == 200
        assert "added successfully" in response.json()["message"]
    
    @pytest.mark.asyncio
    async def test_add_unsaved_conversation_to_collection(self, auth_client, test_user, test_conversation, db_session):
        """Test error when adding an unsaved conversation to a collection."""
        # Create a collection
        collection_response = await auth_client.post("/api/curation/collections", json={
            "name": "Test Collection"
        })
        collection_id = collection_response.json()["id"]
        
        # Try to add unsaved conversation
        response = await auth_client.post(f"/api/curation/collections/{collection_id}/items", json={
            "conversation_id": test_conversation.id
        })
        
        assert response.status_code == 400
        assert "must be saved" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_remove_conversation_from_collection(self, auth_client, test_user, test_conversation, db_session):
        """Test removing a conversation from a collection."""
        # Create collection and add conversation
        collection_response = await auth_client.post("/api/curation/collections", json={
            "name": "Test Collection"
        })
        collection_id = collection_response.json()["id"]
        
        await auth_client.post(f"/api/curation/conversations/{test_conversation.id}/save", json={})
        await auth_client.post(f"/api/curation/collections/{collection_id}/items", json={
            "conversation_id": test_conversation.id
        })
        
        # Remove from collection
        response = await auth_client.delete(
            f"/api/curation/collections/{collection_id}/items/{test_conversation.id}"
        )
        
        assert response.status_code == 200
        assert "removed successfully" in response.json()["message"]
    
    @pytest.mark.asyncio
    async def test_delete_collection(self, auth_client, test_user):
        """Test deleting a collection."""
        # Create a collection
        collection_response = await auth_client.post("/api/curation/collections", json={
            "name": "Collection to Delete"
        })
        collection_id = collection_response.json()["id"]
        
        # Delete it
        response = await auth_client.delete(f"/api/curation/collections/{collection_id}")
        
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        
        # Verify it's gone
        response = await auth_client.get(f"/api/curation/collections/{collection_id}")
        assert response.status_code == 404


class TestCurationAuthentication:
    """Test authentication and authorization for curation endpoints."""
    
    @pytest.mark.asyncio
    async def test_save_conversation_requires_auth(self, test_conversation):
        """Test that saving a conversation requires authentication."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(f"/api/curation/conversations/{test_conversation.id}/save", json={})
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_saved_conversations_requires_auth(self):
        """Test that getting saved conversations requires authentication."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/curation/saved")
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_create_collection_requires_auth(self):
        """Test that creating collections requires authentication."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/curation/collections", json={"name": "Test"})
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_user_can_only_access_own_data(self, db_session, override_get_db):
        """Test that users can only access their own saved conversations and collections."""
        # Create two users
        user1 = User(
            username="user1",
            display_name="User One", 
            email="user1@example.com",
            hashed_password="hashed_password"
        )
        user2 = User(
            username="user2",
            display_name="User Two",
            email="user2@example.com", 
            hashed_password="hashed_password"
        )
        db_session.add_all([user1, user2])
        await db_session.commit()
        
        # Create conversations for each user
        conv1 = Conversation(title="User 1 Conv", user_id=user1.id, is_public=True, token_count=100)
        conv2 = Conversation(title="User 2 Conv", user_id=user2.id, is_public=True, token_count=100)
        db_session.add_all([conv1, conv2])
        await db_session.commit()
        
        # User 1 saves their conversation
        saved1 = SavedConversation(user_id=user1.id, conversation_id=conv1.id)
        db_session.add(saved1)
        await db_session.commit()
        
        # User 2 saves their conversation
        saved2 = SavedConversation(user_id=user2.id, conversation_id=conv2.id)
        db_session.add(saved2)
        await db_session.commit()
        
        # Test with authenticated client for user1
        from app.auth import create_access_token
        token1 = create_access_token(data={"sub": user1.username})
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {token1}"}
            response = await client.get("/api/curation/saved", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        # User 1 should only see their own saved conversation
        assert data["total"] == 1
        assert data["saved_conversations"][0]["conversation_title"] == "User 1 Conv"


class TestCurationPagination:
    """Test pagination for curation endpoints."""
    
    @pytest.mark.asyncio
    async def test_saved_conversations_pagination(self, auth_client, test_user, db_session):
        """Test pagination of saved conversations."""
        # Create multiple conversations and save them
        conversations = []
        for i in range(25):  # Create more than one page
            conv = Conversation(
                title=f"Conversation {i}",
                user_id=test_user.id,
                is_public=True,
                token_count=100
            )
            conversations.append(conv)
        
        db_session.add_all(conversations)
        await db_session.commit()
        
        # Save all conversations
        for conv in conversations:
            await db_session.refresh(conv)
            await auth_client.post(f"/api/curation/conversations/{conv.id}/save", json={})
        
        # Test first page
        response = await auth_client.get("/api/curation/saved?page=1&per_page=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["saved_conversations"]) == 10
        assert data["total"] == 25
        assert data["page"] == 1
        assert data["per_page"] == 10
        assert data["has_next"] is True
        assert data["has_prev"] is False
        
        # Test second page
        response = await auth_client.get("/api/curation/saved?page=2&per_page=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["saved_conversations"]) == 10
        assert data["page"] == 2
        assert data["has_next"] is True
        assert data["has_prev"] is True
    
    @pytest.mark.asyncio
    async def test_collections_pagination(self, auth_client, test_user):
        """Test pagination of collections."""
        # Create multiple collections
        for i in range(15):
            await auth_client.post("/api/curation/collections", json={
                "name": f"Collection {i}",
                "description": f"Description for collection {i}"
            })
        
        # Test pagination
        response = await auth_client.get("/api/curation/collections?page=1&per_page=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["collections"]) == 10
        assert data["total"] == 15
        assert data["has_next"] is True
        
        # Test second page
        response = await auth_client.get("/api/curation/collections?page=2&per_page=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["collections"]) == 5
        assert data["has_next"] is False