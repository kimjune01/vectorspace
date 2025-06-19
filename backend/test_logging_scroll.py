#!/usr/bin/env python3
"""
Test scroll_update with explicit logging to identify where the issue occurs.
"""

import asyncio
import websockets
import json
import logging
from jose import jwt
from datetime import datetime, timedelta, timezone
import uuid
from app.auth import SECRET_KEY, ALGORITHM

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_with_logging():
    """Test scroll_update with detailed logging to see what's happening."""
    
    # Create token
    token_data = {
        "sub": "testuser",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "jti": str(uuid.uuid4())
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    url = f"ws://localhost:8000/api/ws/conversations/1?token={token}"
    
    logger.info(f"🔗 Connecting to: {url}")
    
    try:
        async with websockets.connect(url) as ws:
            logger.info("✅ Connected successfully")
            
            # Listen for initial messages
            await asyncio.sleep(1)
            initial_messages = []
            try:
                while True:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.1)
                    initial_msg = json.loads(msg)
                    initial_messages.append(initial_msg)
                    logger.info(f"📨 Initial message: {initial_msg}")
            except asyncio.TimeoutError:
                pass
            
            logger.info(f"📋 Received {len(initial_messages)} initial messages")
            
            # Send scroll_update message
            message = {
                "type": "scroll_update",
                "current_message_index": 3,
                "current_message_id": "test_msg_3"
            }
            
            logger.info(f"📤 Sending scroll_update: {message}")
            await ws.send(json.dumps(message))
            logger.info("✅ Message sent successfully")
            
            # Wait for response with timeout
            logger.info("⏳ Waiting for response...")
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                response_data = json.loads(response)
                logger.info(f"📨 Received response: {response_data}")
                
                if response_data.get("type") == "scroll_update_received":
                    logger.info("🎉 SUCCESS: Received debug response!")
                    return {"success": True, "response": response_data}
                elif response_data.get("type") == "error":
                    logger.error(f"❌ ERROR response: {response_data.get('message')}")
                    return {"success": False, "error": response_data.get("message")}
                else:
                    logger.warning(f"❓ Unexpected response type: {response_data.get('type')}")
                    return {"success": False, "unexpected": response_data}
                    
            except asyncio.TimeoutError:
                logger.error("⏰ TIMEOUT: No response received within 5 seconds")
                return {"success": False, "error": "timeout"}
            
    except Exception as e:
        logger.error(f"🚨 Connection error: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    logger.info("🚀 VectorSpace scroll_update Debug Test")
    logger.info("=" * 50)
    
    result = asyncio.run(test_with_logging())
    
    logger.info("📊 Test Results:")
    logger.info(f"   Success: {result.get('success')}")
    if not result.get("success"):
        logger.info(f"   Error: {result.get('error')}")
    
    logger.info("🏁 Test complete!")