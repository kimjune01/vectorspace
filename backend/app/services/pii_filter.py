import re
from typing import Optional


class PIIFilter:
    """Service for filtering Personally Identifiable Information from text."""
    
    def __init__(self):
        # Email pattern
        self.email_pattern = re.compile(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        )
        
        # Phone patterns (US formats) - Order matters!
        self.phone_patterns = [
            re.compile(r'\+1-\d{3}-\d{3}-\d{4}\b'),  # +1-555-123-4567
            re.compile(r'\b\d{3}-\d{3}-\d{4}\b'),  # 555-123-4567
            re.compile(r'\(\d{3}\)\s*\d{3}-\d{4}\b'),  # (555) 123-4567
            re.compile(r'\b\d{10}\b'),  # 5551234567
            re.compile(r'\b\d{3}-\d{4}\b'),  # 555-0123
        ]
        
        # URL pattern
        self.url_pattern = re.compile(
            r'https?://[^\s<>"{}|\\^`\[\]]+',
            re.IGNORECASE
        )
        
        # Simple address pattern (matches common street address formats)
        self.address_pattern = re.compile(
            r'\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Court|Ct)\.?(?:\s*(?:Apt|Apartment|Suite|Ste|Unit|#)\s*\w+)?\b',
            re.IGNORECASE
        )
    
    def filter_text(self, text: Optional[str]) -> str:
        """
        Filter PII from the given text.
        
        Args:
            text: The text to filter
            
        Returns:
            The filtered text with PII replaced by placeholders
        """
        if not text:
            return ""
        
        # Filter emails
        text = self.email_pattern.sub("[email]", text)
        
        # Filter phone numbers
        for phone_pattern in self.phone_patterns:
            text = phone_pattern.sub("[phone]", text)
        
        # Filter URLs
        text = self.url_pattern.sub("[link]", text)
        
        # Filter addresses
        text = self.address_pattern.sub("[address]", text)
        
        return text