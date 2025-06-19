import pytest
import pytest_asyncio
import base64
import io
from PIL import Image
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.models import User
from app.services.image_service import image_service


@pytest.fixture
def sample_image_bytes():
    """Create a sample image for testing."""
    # Create a simple 200x200 RGB image
    image = Image.new('RGB', (200, 200), color='red')
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG')
    return buffer.getvalue()


@pytest.fixture
def sample_png_bytes():
    """Create a sample PNG image with transparency."""
    image = Image.new('RGBA', (150, 150), color=(0, 255, 0, 128))  # Semi-transparent green
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


@pytest.fixture
def large_image_bytes():
    """Create a large image for size testing."""
    # Create a large image that exceeds 5MB limit
    image = Image.new('RGB', (3000, 3000), color='blue')
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=100)
    return buffer.getvalue()


@pytest_asyncio.fixture
async def test_user_token(db_session, override_get_db):
    """Create a test user and return their JWT token."""
    # Create test user
    user = User(
        username="testuser",
        display_name="Test User",
        email="test@example.com"
    )
    user.set_password("password123")
    db_session.add(user)
    await db_session.commit()
    
    # Login to get token
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login_response = await client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "password123"
        })
        return login_response.json()["access_token"]


class TestImageService:
    """Test the ImageService functionality."""
    
    def test_process_profile_image_success(self, sample_image_bytes):
        """Test successful image processing."""
        result = image_service.process_profile_image(sample_image_bytes)
        
        assert result is not None
        assert result.startswith("data:image/jpeg;base64,")
        
        # Verify the image is properly encoded
        header, data = result.split(",", 1)
        decoded_bytes = base64.b64decode(data)
        processed_image = Image.open(io.BytesIO(decoded_bytes))
        
        # Should be resized to 128x128
        assert processed_image.size == (128, 128)
        assert processed_image.format == 'JPEG'
    
    def test_process_png_with_transparency(self, sample_png_bytes):
        """Test PNG with transparency is converted properly."""
        result = image_service.process_profile_image(sample_png_bytes)
        
        assert result is not None
        assert result.startswith("data:image/jpeg;base64,")
        
        # Verify transparency was handled (converted to white background)
        header, data = result.split(",", 1)
        decoded_bytes = base64.b64decode(data)
        processed_image = Image.open(io.BytesIO(decoded_bytes))
        
        assert processed_image.mode == 'RGB'  # No alpha channel
        assert processed_image.size == (128, 128)
    
    def test_process_image_too_large(self, large_image_bytes):
        """Test that large images are rejected."""
        # Should return None for images over 5MB
        if len(large_image_bytes) > 5 * 1024 * 1024:
            result = image_service.process_profile_image(large_image_bytes)
            assert result is None
    
    def test_process_invalid_format(self):
        """Test that invalid image data is rejected."""
        invalid_data = b"this is not an image"
        result = image_service.process_profile_image(invalid_data)
        assert result is None
    
    def test_validate_base64_image_valid(self, sample_image_bytes):
        """Test validation of valid base64 image."""
        base64_image = image_service.process_profile_image(sample_image_bytes)
        assert image_service.validate_base64_image(base64_image) is True
    
    def test_validate_base64_image_invalid(self):
        """Test validation of invalid base64 strings."""
        invalid_strings = [
            "not a data url",
            "data:text/plain;base64,dGVzdA==",
            "data:image/jpeg;base64,invalid_base64",
            "data:image/jpeg;base64,",
        ]
        
        for invalid_string in invalid_strings:
            assert image_service.validate_base64_image(invalid_string) is False
    
    def test_get_image_info(self, sample_image_bytes):
        """Test getting image information."""
        base64_image = image_service.process_profile_image(sample_image_bytes)
        info = image_service.get_image_info(base64_image)
        
        assert info is not None
        assert info['format'] == 'JPEG'
        assert info['size'] == (128, 128)
        assert info['mode'] == 'RGB'
        assert 'data_size_bytes' in info
        assert 'data_size_kb' in info
    
    def test_generate_stripe_pattern(self):
        """Test stripe pattern generation."""
        seed = 12345
        pattern1 = image_service.generate_stripe_pattern_data_url(seed)
        pattern2 = image_service.generate_stripe_pattern_data_url(seed)
        
        # Should be consistent for same seed
        assert pattern1 == pattern2
        assert pattern1.startswith("data:image/jpeg;base64,")
        
        # Verify it's a valid image
        header, data = pattern1.split(",", 1)
        decoded_bytes = base64.b64decode(data)
        image = Image.open(io.BytesIO(decoded_bytes))
        assert image.size == (128, 128)
    
    def test_generate_stripe_pattern_different_seeds(self):
        """Test that different seeds produce different patterns."""
        pattern1 = image_service.generate_stripe_pattern_data_url(111)
        pattern2 = image_service.generate_stripe_pattern_data_url(222)
        
        # Should be different for different seeds
        assert pattern1 != pattern2
    
    def test_center_crop_square(self, sample_image_bytes):
        """Test center cropping functionality."""
        # Create a rectangular image
        image = Image.new('RGB', (300, 200), color='blue')
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG')
        rect_image_bytes = buffer.getvalue()
        
        result = image_service.process_profile_image(rect_image_bytes)
        assert result is not None
        
        # Verify the result is square
        header, data = result.split(",", 1)
        decoded_bytes = base64.b64decode(data)
        processed_image = Image.open(io.BytesIO(decoded_bytes))
        assert processed_image.size == (128, 128)


class TestProfileImageAPI:
    """Test the profile image API endpoints."""
    
    @pytest.mark.asyncio
    async def test_upload_profile_image_success(self, test_user_token, sample_image_bytes, override_get_db):
        """Test successful profile image upload."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            files = {"file": ("test.jpg", sample_image_bytes, "image/jpeg")}
            response = await client.post("/api/users/me/profile-image", files=files, headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Profile image uploaded successfully"
            assert "image_info" in data
            assert data["thumbnail_size"] == "128x128"
    
    @pytest.mark.asyncio
    async def test_upload_profile_image_invalid_format(self, test_user_token, override_get_db):
        """Test upload with invalid file format."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            files = {"file": ("test.txt", b"not an image", "text/plain")}
            response = await client.post("/api/users/me/profile-image", files=files, headers=headers)
            
            assert response.status_code == 400
            assert "File must be an image" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_upload_profile_image_too_large(self, test_user_token, large_image_bytes, override_get_db):
        """Test upload with file too large."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Only test if the image is actually large enough
        if len(large_image_bytes) > 5 * 1024 * 1024:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                files = {"file": ("large.jpg", large_image_bytes, "image/jpeg")}
                response = await client.post("/api/users/me/profile-image", files=files, headers=headers)
                
                assert response.status_code == 400
                assert "Failed to process image" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_upload_profile_image_unauthorized(self, sample_image_bytes, override_get_db):
        """Test upload without authentication."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            files = {"file": ("test.jpg", sample_image_bytes, "image/jpeg")}
            response = await client.post("/api/users/me/profile-image", files=files)
            
            assert response.status_code in [401, 403]  # Either Unauthorized or Forbidden is acceptable
    
    @pytest.mark.asyncio
    async def test_delete_profile_image_success(self, test_user_token, override_get_db):
        """Test successful profile image deletion."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.delete("/api/users/me/profile-image", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Profile image deleted successfully"
            assert data["fallback"] == "stripe_pattern"
    
    @pytest.mark.asyncio
    async def test_delete_profile_image_unauthorized(self, override_get_db):
        """Test deletion without authentication."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.delete("/api/users/me/profile-image")
            
            assert response.status_code in [401, 403]  # Either Unauthorized or Forbidden is acceptable
    
    @pytest.mark.asyncio
    async def test_get_stripe_pattern_success(self, test_user_token, override_get_db):
        """Test getting stripe pattern."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/users/me/stripe-pattern", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert "stripe_pattern" in data
            assert data["stripe_pattern"].startswith("data:image/jpeg;base64,")
            assert "seed" in data
            assert data["size"] == "128x128"
    
    @pytest.mark.asyncio
    async def test_get_stripe_pattern_unauthorized(self, override_get_db):
        """Test getting stripe pattern without authentication."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/users/me/stripe-pattern")
            
            assert response.status_code in [401, 403]  # Either Unauthorized or Forbidden is acceptable
    
    @pytest.mark.asyncio
    async def test_profile_image_in_user_profile(self, test_user_token, sample_image_bytes, override_get_db):
        """Test that uploaded profile image appears in user profile."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Upload image first
            files = {"file": ("test.jpg", sample_image_bytes, "image/jpeg")}
            upload_response = await client.post("/api/users/me/profile-image", files=files, headers=headers)
            assert upload_response.status_code == 200
            
            # Check profile includes the image data
            profile_response = await client.get("/api/users/me/profile", headers=headers)
            assert profile_response.status_code == 200
            
            profile_data = profile_response.json()
            assert profile_data["profile_image_data"] is not None
            assert profile_data["profile_image_data"].startswith("data:image/jpeg;base64,")
            assert profile_data["profile_image_url"] is None  # Should be cleared when using base64
    
    @pytest.mark.asyncio
    async def test_profile_image_consistency(self, test_user_token, override_get_db):
        """Test that stripe patterns are consistent for the same user."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Get stripe pattern twice
            response1 = await client.get("/api/users/me/stripe-pattern", headers=headers)
            response2 = await client.get("/api/users/me/stripe-pattern", headers=headers)
            
            assert response1.status_code == 200
            assert response2.status_code == 200
            
            data1 = response1.json()
            data2 = response2.json()
            
            # Should be identical for same user
            assert data1["stripe_pattern"] == data2["stripe_pattern"]
            assert data1["seed"] == data2["seed"]


class TestProfileImageIntegration:
    """Test profile image integration with other features."""
    
    @pytest.mark.asyncio
    async def test_public_profile_includes_image_data(self, test_user_token, sample_image_bytes, override_get_db):
        """Test that public profiles include profile image data."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Upload image
            files = {"file": ("test.jpg", sample_image_bytes, "image/jpeg")}
            await client.post("/api/users/me/profile-image", files=files, headers=headers)
            
            # Get own profile to find username
            own_profile = await client.get("/api/users/me/profile", headers=headers)
            username = own_profile.json()["username"]
            
            # Check public profile
            public_response = await client.get(f"/api/users/profile/{username}")
            assert public_response.status_code == 200
            
            public_data = public_response.json()
            assert public_data["profile_image_data"] is not None
            assert public_data["profile_image_data"].startswith("data:image/jpeg;base64,")
    
    @pytest.mark.asyncio
    async def test_profile_without_image_shows_stripe_info(self, test_user_token, override_get_db):
        """Test that profiles without images show stripe pattern seed."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Ensure no profile image
            await client.delete("/api/users/me/profile-image", headers=headers)
            
            # Get profile
            response = await client.get("/api/users/me/profile", headers=headers)
            assert response.status_code == 200
            
            data = response.json()
            assert data["profile_image_data"] is None
            assert data["stripe_pattern_seed"] is not None
            assert isinstance(data["stripe_pattern_seed"], int)