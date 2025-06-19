import pytest
from app.services.pii_filter import PIIFilter


class TestPIIFilter:
    """Test cases for PII (Personally Identifiable Information) filtering."""
    
    def test_filter_email_addresses(self):
        """Test that email addresses are properly filtered."""
        filter = PIIFilter()
        
        # Single email
        text = "Contact me at john.doe@example.com for more info"
        filtered = filter.filter_text(text)
        assert "john.doe@example.com" not in filtered
        assert "[email]" in filtered
        assert "Contact me at [email] for more info" == filtered
        
        # Multiple emails
        text = "Email jane@test.com or admin@site.org for help"
        filtered = filter.filter_text(text)
        assert "jane@test.com" not in filtered
        assert "admin@site.org" not in filtered
        assert filtered.count("[email]") == 2
    
    def test_filter_phone_numbers(self):
        """Test that phone numbers are properly filtered."""
        filter = PIIFilter()
        
        # US phone formats
        test_cases = [
            ("Call me at 555-123-4567", "Call me at [phone]"),
            ("My number is (555) 123-4567", "My number is [phone]"),
            ("Phone: 5551234567", "Phone: [phone]"),
            ("Tel: +1-555-123-4567", "Tel: [phone]"),
        ]
        
        for original, expected in test_cases:
            assert filter.filter_text(original) == expected
    
    def test_filter_urls(self):
        """Test that URLs are properly filtered."""
        filter = PIIFilter()
        
        # Various URL formats
        text = "Visit https://example.com or http://test.org for info"
        filtered = filter.filter_text(text)
        assert "https://example.com" not in filtered
        assert "http://test.org" not in filtered
        assert filtered.count("[link]") == 2
        
        # URL with path
        text = "Check out https://github.com/user/repo for the code"
        filtered = filter.filter_text(text)
        assert "Check out [link] for the code" == filtered
    
    def test_filter_addresses(self):
        """Test that physical addresses are filtered."""
        filter = PIIFilter()
        
        # Street addresses
        text = "I live at 123 Main Street, Apt 4B, New York, NY 10001"
        filtered = filter.filter_text(text)
        assert "123 Main Street" not in filtered
        assert "[address]" in filtered
        
        # Simple address
        text = "Ship to 456 Oak Ave, Boston MA"
        filtered = filter.filter_text(text)
        assert "456 Oak Ave" not in filtered
    
    def test_preserve_conversation_meaning(self):
        """Test that filtering preserves the conversation's meaning."""
        filter = PIIFilter()
        
        text = """I was discussing Python decorators with my colleague at 
        john@company.com. He suggested checking the documentation at 
        https://docs.python.org. You can call him at 555-0123 if needed."""
        
        filtered = filter.filter_text(text)
        
        # Check that PII is removed
        assert "john@company.com" not in filtered
        assert "https://docs.python.org" not in filtered
        assert "555-0123" not in filtered
        
        # Check that context is preserved
        assert "Python decorators" in filtered
        assert "colleague" in filtered
        assert "documentation" in filtered
        assert "suggested checking" in filtered
    
    def test_empty_and_none_text(self):
        """Test handling of empty and None inputs."""
        filter = PIIFilter()
        
        assert filter.filter_text("") == ""
        assert filter.filter_text(None) == ""
        assert filter.filter_text("   ") == "   "
    
    def test_mixed_pii_types(self):
        """Test filtering text with multiple types of PII."""
        filter = PIIFilter()
        
        text = """Contact John at john.smith@email.com or call 555-1234. 
        Visit our website at https://example.com or mail us at 
        123 Business Rd, Suite 100."""
        
        filtered = filter.filter_text(text)
        
        assert "[email]" in filtered
        assert "[phone]" in filtered
        assert "[link]" in filtered
        assert "[address]" in filtered
        assert "john.smith@email.com" not in filtered
        assert "555-1234" not in filtered
    
    def test_case_preservation(self):
        """Test that non-PII text case is preserved."""
        filter = PIIFilter()
        
        text = "Email ME at USER@EXAMPLE.COM about Python"
        filtered = filter.filter_text(text)
        
        assert "Email ME at [email] about Python" == filtered
        assert "ME" in filtered  # Original case preserved
        assert "Python" in filtered  # Original case preserved