#!/usr/bin/env python3
"""
Test to see the debug response from scroll_update.
"""

import asyncio
import websockets
import json
from jose import jwt
from datetime import datetime, timedelta, timezone
import uuid
from app.auth import SECRET_KEY, ALGORITHM

async def test_debug_response():
    """Test to see if we get the debug response."""
    
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
            
            # Wait for initial messages
            await asyncio.sleep(1)
            
            # Clear any pending messages
            try:
                while True:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.1)
                    print(f"📨 Initial: {json.loads(msg)}")
            except asyncio.TimeoutError:
                pass
            
            # Send scroll_update
            message = {
                "type": "scroll_update",
                "current_message_index": 1,
                "current_message_id": "msg_1"
            }
            
            print(f"📤 Sending: {message}")
            await ws.send(json.dumps(message))
            
            # Wait for response
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=3.0)
                response_data = json.loads(response)
                print(f"📨 Response: {response_data}")
                
                if response_data.get("type") == "scroll_update_received":
                    print("✅ SUCCESS: Got debug response - routing works!")
                elif response_data.get("type") == "error":
                    print(f"❌ ERROR: {response_data.get('message')}")
                else:
                    print(f"❓ Unexpected response: {response_data.get('type')}")
                    
            except asyncio.TimeoutError:
                print("⏰ No response received")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_debug_response())