#!/usr/bin/env python3
"""
Simple scroll_update test to trigger debug logs.
"""

import asyncio
import websockets
import json
from jose import jwt
from datetime import datetime, timedelta, timezone
import uuid
from app.auth import SECRET_KEY, ALGORITHM

async def simple_test():
    """Simple test to trigger debug logs."""
    
    # Create token
    token_data = {
        "sub": "testuser",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "jti": str(uuid.uuid4())
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    url = f"ws://localhost:8000/api/ws/conversations/1?token={token}"
    
    print(f"🔗 Connecting to: {url}")
    
    try:
        async with websockets.connect(url) as ws:
            print("✅ Connected")
            
            # Wait for welcome messages
            await asyncio.sleep(1)
            
            # Send scroll_update
            message = {
                "type": "scroll_update",
                "current_message_index": 1,
                "current_message_id": "msg_1"
            }
            
            print(f"📤 Sending: {message}")
            await ws.send(json.dumps(message))
            
            # Wait for response
            await asyncio.sleep(2)
            
            print("✅ Test complete")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(simple_test())