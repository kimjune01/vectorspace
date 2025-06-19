from PIL import Image
import io
import base64
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class ImageService:
    """Service for handling profile image processing and storage."""
    
    def __init__(self):
        self.thumbnail_size = (128, 128)  # 128x128 pixel thumbnails
        self.max_file_size = 5 * 1024 * 1024  # 5MB max
        self.allowed_formats = {"JPEG", "PNG", "WEBP", "GIF"}
    
    def process_profile_image(self, image_data: bytes) -> Optional[str]:
        """
        Process uploaded image into base64 thumbnail.
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            Base64 encoded thumbnail string or None if processing fails
        """
        try:
            # Check file size
            if len(image_data) > self.max_file_size:
                raise ValueError(f"Image too large. Max size: {self.max_file_size / (1024*1024):.1f}MB")
            
            # Open and validate image
            image = Image.open(io.BytesIO(image_data))
            
            # Check format
            if image.format not in self.allowed_formats:
                raise ValueError(f"Unsupported format. Allowed: {', '.join(self.allowed_formats)}")
            
            # Convert to RGB if necessary (for JPEG compatibility)
            if image.mode in ("RGBA", "P", "L"):
                # Create white background for transparency
                background = Image.new("RGB", image.size, (255, 255, 255))
                if image.mode == "P":
                    image = image.convert("RGBA")
                if image.mode == "RGBA":
                    background.paste(image, mask=image.split()[-1])  # Use alpha channel as mask
                    image = background
                else:
                    image = image.convert("RGB")
            
            # Create thumbnail maintaining aspect ratio
            image.thumbnail(self.thumbnail_size, Image.Resampling.LANCZOS)
            
            # Center crop to exact square if needed
            if image.size != self.thumbnail_size:
                image = self._center_crop_square(image, self.thumbnail_size[0])
            
            # Convert to base64
            output_buffer = io.BytesIO()
            image.save(output_buffer, format="JPEG", quality=85, optimize=True)
            image_bytes = output_buffer.getvalue()
            
            # Encode to base64
            base64_string = base64.b64encode(image_bytes).decode('utf-8')
            
            # Add data URL prefix
            return f"data:image/jpeg;base64,{base64_string}"
            
        except Exception as e:
            logger.error(f"Error processing profile image: {e}")
            return None
    
    def _center_crop_square(self, image: Image.Image, size: int) -> Image.Image:
        """Center crop image to square."""
        width, height = image.size
        
        # Calculate crop box for center square
        if width > height:
            left = (width - height) // 2
            top = 0
            right = left + height
            bottom = height
        else:
            left = 0
            top = (height - width) // 2
            right = width
            bottom = top + width
        
        # Crop and resize
        cropped = image.crop((left, top, right, bottom))
        return cropped.resize((size, size), Image.Resampling.LANCZOS)
    
    def validate_base64_image(self, base64_string: str) -> bool:
        """Validate that a base64 string is a valid image."""
        try:
            if not base64_string.startswith("data:image/"):
                return False
            
            # Extract base64 data
            header, data = base64_string.split(",", 1)
            image_bytes = base64.b64decode(data)
            
            # Try to open as image
            image = Image.open(io.BytesIO(image_bytes))
            image.verify()  # Verify it's a valid image
            
            return True
            
        except Exception:
            return False
    
    def get_image_info(self, base64_string: str) -> Optional[dict]:
        """Get information about a base64 encoded image."""
        try:
            if not base64_string.startswith("data:image/"):
                return None
            
            # Extract format from header
            header, data = base64_string.split(",", 1)
            format_info = header.split(";")[0].split("/")[1].upper()
            
            # Decode and get image info
            image_bytes = base64.b64decode(data)
            image = Image.open(io.BytesIO(image_bytes))
            
            return {
                "format": format_info,
                "size": image.size,
                "mode": image.mode,
                "data_size_bytes": len(image_bytes),
                "data_size_kb": round(len(image_bytes) / 1024, 1)
            }
            
        except Exception as e:
            logger.error(f"Error getting image info: {e}")
            return None
    
    def generate_stripe_pattern_data_url(self, seed: int, size: Tuple[int, int] = None) -> str:
        """
        Generate a stripe pattern as base64 data URL.
        
        Args:
            seed: Random seed for consistent pattern generation
            size: Image size (default: thumbnail_size)
            
        Returns:
            Base64 data URL string
        """
        import random
        
        if size is None:
            size = self.thumbnail_size
        
        # Use seed for consistent colors
        random.seed(seed)
        
        # Generate 3-5 stripe colors
        num_stripes = random.randint(3, 5)
        colors = []
        
        for _ in range(num_stripes):
            # Generate pleasant colors (avoid too dark or too light)
            hue = random.randint(0, 360)
            saturation = random.randint(40, 80)
            lightness = random.randint(40, 70)
            
            # Convert HSL to RGB (simplified)
            c = (100 - abs(2 * lightness - 100)) * saturation / 10000
            x = c * (1 - abs((hue / 60) % 2 - 1))
            m = lightness / 100 - c / 2
            
            if 0 <= hue < 60:
                r, g, b = c, x, 0
            elif 60 <= hue < 120:
                r, g, b = x, c, 0
            elif 120 <= hue < 180:
                r, g, b = 0, c, x
            elif 180 <= hue < 240:
                r, g, b = 0, x, c
            elif 240 <= hue < 300:
                r, g, b = x, 0, c
            else:
                r, g, b = c, 0, x
            
            # Convert to 0-255 range
            r = int((r + m) * 255)
            g = int((g + m) * 255)
            b = int((b + m) * 255)
            
            colors.append((r, g, b))
        
        # Create image with horizontal stripes
        image = Image.new("RGB", size, colors[0])
        
        stripe_height = size[1] // num_stripes
        for i, color in enumerate(colors):
            y_start = i * stripe_height
            y_end = (i + 1) * stripe_height if i < num_stripes - 1 else size[1]
            
            # Create stripe
            for y in range(y_start, y_end):
                for x in range(size[0]):
                    image.putpixel((x, y), color)
        
        # Convert to base64
        output_buffer = io.BytesIO()
        image.save(output_buffer, format="JPEG", quality=90)
        image_bytes = output_buffer.getvalue()
        base64_string = base64.b64encode(image_bytes).decode('utf-8')
        
        return f"data:image/jpeg;base64,{base64_string}"


# Global instance
image_service = ImageService()