import pytest
import os
from app.services.ai_service import ai_service


class TestOpenAIConnection:
    """Test OpenAI API connection and basic functionality."""
    
    def test_ai_service_initialization(self):
        """Test that AI service initializes correctly."""
        assert ai_service is not None, "AI service should be initialized"
        assert hasattr(ai_service, 'client'), "AI service should have a client attribute"
        assert hasattr(ai_service, 'model'), "AI service should have a model attribute"
        assert hasattr(ai_service, 'max_tokens'), "AI service should have max_tokens"
        assert hasattr(ai_service, 'temperature'), "AI service should have temperature"
        
        # Check that we're in the expected mode
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "" or api_key.startswith("test-"):
            assert ai_service.client is None, "Should be in mock mode without valid API key"
            assert ai_service.model == "mock-ai-model", "Should use mock model"
        else:
            assert ai_service.client is not None, "Should have OpenAI client with valid API key"
            assert ai_service.model.startswith("gpt-"), "Should use GPT model"
    
    def test_openai_api_key_configuration(self):
        """Test that OpenAI API key is configured properly."""
        api_key = os.getenv("OPENAI_API_KEY")
        
        if api_key is None or api_key == "":
            # No API key set - this is valid for testing mode
            pytest.skip("No OpenAI API key configured - running in mock mode")
        
        if api_key.startswith("test-") or api_key.startswith("mock-"):
            # Test/mock API key - this is valid for testing
            pytest.skip("Test/mock API key detected - OpenAI integration disabled")
        
        # If we have a real API key, validate its format
        assert api_key.startswith("sk-"), "Real OpenAI API key should start with 'sk-'"
        assert len(api_key) > 20, "OpenAI API key appears to be too short"
    
    @pytest.mark.asyncio
    async def test_openai_simple_completion(self):
        """Test basic OpenAI API completion."""
        # Skip if no API key
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key.startswith("test-"):
            pytest.skip("No valid OpenAI API key available")
        
        # Test simple completion
        messages = [{"role": "user", "content": "Say 'Hello, World!' and nothing else."}]
        
        try:
            response = await ai_service.generate_complete_response(messages)
            
            # Basic response validation
            assert response is not None, "Response should not be None"
            assert isinstance(response, str), "Response should be a string"
            assert len(response.strip()) > 0, "Response should not be empty"
            assert "Hello" in response, "Response should contain 'Hello'"
            
        except Exception as e:
            pytest.fail(f"OpenAI API call failed: {e}")
    
    @pytest.mark.asyncio
    async def test_openai_streaming_response(self):
        """Test OpenAI streaming response."""
        # Skip if no API key
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key.startswith("test-"):
            pytest.skip("No valid OpenAI API key available")
        
        # Test streaming response
        messages = [{"role": "user", "content": "Count from 1 to 3, one number per line."}]
        
        try:
            response_chunks = []
            async for chunk in ai_service.stream_response(messages):
                assert isinstance(chunk, str), "Each chunk should be a string"
                response_chunks.append(chunk)
            
            # Validate streaming worked
            assert len(response_chunks) > 0, "Should receive at least one chunk"
            
            # Combine chunks and validate content
            full_response = "".join(response_chunks)
            assert len(full_response.strip()) > 0, "Combined response should not be empty"
            
        except Exception as e:
            pytest.fail(f"OpenAI streaming API call failed: {e}")
    
    @pytest.mark.asyncio
    async def test_openai_token_estimation(self):
        """Test token counting functionality."""
        # This should work even without API key since it's local calculation
        test_text = "Hello, this is a test message for token counting."
        
        try:
            token_count = ai_service.estimate_tokens(test_text)
            
            assert isinstance(token_count, int), "Token count should be an integer"
            assert token_count > 0, "Token count should be positive"
            assert token_count < 100, "Token count should be reasonable for short text"
            
        except Exception as e:
            pytest.fail(f"Token estimation failed: {e}")
    
    @pytest.mark.asyncio 
    async def test_openai_conversation_context(self):
        """Test getting conversation context with message limit."""
        # This tests the conversation context logic without API calls
        messages = [
            {"role": "user", "content": "First message"},
            {"role": "assistant", "content": "First response"},
            {"role": "user", "content": "Second message"},
            {"role": "assistant", "content": "Second response"},
            {"role": "user", "content": "Third message"}
        ]
        
        try:
            # Test with token limit
            context = ai_service.get_conversation_context(messages, max_context_tokens=50)
            
            assert isinstance(context, list), "Context should be a list"
            assert len(context) <= len(messages), "Context should not be longer than input"
            assert len(context) > 0, "Context should contain at least one message"
            
            # Should include the most recent messages
            assert context[-1]["content"] == "Third message", "Should include the latest message"
            
        except Exception as e:
            pytest.fail(f"Conversation context generation failed: {e}")