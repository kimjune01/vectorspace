#!/usr/bin/env python3
"""
Test scroll_update with proper authentication.
"""

import asyncio
import websockets
import json
from jose import jwt
from datetime import datetime, timedelta, timezone
import uuid

# Import app components
from app.auth import SECRET_KEY, ALGORITHM

async def create_test_token(username: str = "testuser"):
    """Create a valid JWT token for testing."""
    
    # Token payload
    to_encode = {
        "sub": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "jti": str(uuid.uuid4())  # Unique token ID
    }
    
    # Create token
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"🔑 Created token for user '{username}': {token[:50]}...")
    
    return token

async def test_scroll_update_with_auth():
    """Test scroll_update with proper authentication."""
    
    print("🔐 Testing scroll_update with valid authentication...")
    
    # Create a valid token
    token = await create_test_token("testuser")
    conversation_id = 1
    ws_url = f"ws://localhost:8000/api/ws/conversations/{conversation_id}?token={token}"
    
    print(f"🔗 Connecting to: {ws_url}")
    
    try:
        async with websockets.connect(ws_url) as websocket:
            print("✅ WebSocket connected successfully with authentication!")
            
            # Wait for connection established message
            try:
                welcome_msg = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                welcome_data = json.loads(welcome_msg)
                print(f"📨 Welcome message: {welcome_data}")
            except asyncio.TimeoutError:
                print("⏰ No welcome message received")
            
            # Test 1: Send scroll_update message
            scroll_message = {
                "type": "scroll_update",
                "current_message_index": 7,
                "current_message_id": "test_msg_7"
            }
            
            print(f"📤 Sending scroll_update: {scroll_message}")
            await websocket.send(json.dumps(scroll_message))
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                print(f"📨 Response: {response_data}")
                
                if response_data.get("type") == "error":
                    print(f"🚨 ERROR DETECTED: {response_data.get('message')}")
                    if "Unknown message type" in response_data.get("message", ""):
                        print("🎯 Found the 'Unknown message type' error!")
                        return {"error": True, "message": response_data.get("message")}
                    else:
                        print(f"❓ Different error: {response_data.get('message')}")
                elif response_data.get("type") == "scroll_update":
                    print("✅ Received scroll_update response - broadcasting works!")
                else:
                    print(f"ℹ️ Received other message type: {response_data.get('type')}")
                    
            except asyncio.TimeoutError:
                print("⏰ No response received - this might be normal for scroll_update")
                print("💡 scroll_update messages are typically broadcast to OTHER users, not back to sender")
            
            # Test 2: Send ping to verify connection is working
            ping_message = {"type": "ping"}
            print(f"📤 Sending ping (for verification): {ping_message}")
            await websocket.send(json.dumps(ping_message))
            
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                response_data = json.loads(response)
                print(f"📨 Ping response: {response_data}")
            except asyncio.TimeoutError:
                print("⏰ No ping response received")
            
            # Test 3: Send scroll_position_update for comparison
            position_message = {
                "type": "scroll_position_update",
                "scroll_position": {
                    "scrollTop": 150,
                    "scrollHeight": 600,
                    "clientHeight": 400,
                    "scrollPercentage": 25.0
                }
            }
            
            print(f"📤 Sending scroll_position_update: {position_message}")
            await websocket.send(json.dumps(position_message))
            
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                response_data = json.loads(response)
                print(f"📨 Position response: {response_data}")
            except asyncio.TimeoutError:
                print("⏰ No position response received")
            
            return {"error": False, "message": "Tests completed successfully"}
            
    except websockets.exceptions.ConnectionClosed as e:
        print(f"🔌 Connection closed: {e}")
        return {"error": True, "message": f"Connection closed: {e}"}
    except Exception as e:
        print(f"🚫 Connection failed: {e}")
        return {"error": True, "message": f"Connection failed: {e}"}

async def test_two_user_scroll_broadcast():
    """Test scroll_update broadcasting between two users."""
    
    print("\n👥 Testing scroll_update broadcasting between two users...")
    
    # Create tokens for two different users
    token1 = await create_test_token("testuser")
    token2 = await create_test_token("chatuser")
    
    conversation_id = 1
    ws_url1 = f"ws://localhost:8000/api/ws/conversations/{conversation_id}?token={token1}"
    ws_url2 = f"ws://localhost:8000/api/ws/conversations/{conversation_id}?token={token2}"
    
    print(f"🔗 User 1 connecting to: {ws_url1}")
    print(f"🔗 User 2 connecting to: {ws_url2}")
    
    try:
        # Connect both users
        async with websockets.connect(ws_url1) as ws1, websockets.connect(ws_url2) as ws2:
            print("✅ Both users connected successfully!")
            
            # Wait for connection messages
            await asyncio.sleep(1)
            
            # User 1 sends scroll_update
            scroll_message = {
                "type": "scroll_update",
                "current_message_index": 10,
                "current_message_id": "test_msg_10"
            }
            
            print(f"📤 User 1 sending scroll_update: {scroll_message}")
            await ws1.send(json.dumps(scroll_message))
            
            # Check if User 2 receives the broadcast
            try:
                response = await asyncio.wait_for(ws2.recv(), timeout=3.0)
                response_data = json.loads(response)
                print(f"📨 User 2 received: {response_data}")
                
                if response_data.get("type") == "scroll_update":
                    print("🎉 SUCCESS: scroll_update broadcasting works!")
                    return {"success": True}
                else:
                    print(f"❓ User 2 received different message: {response_data.get('type')}")
                    
            except asyncio.TimeoutError:
                print("⏰ User 2 did not receive broadcast")
            
            # Also check if User 1 receives anything (should not)
            try:
                response = await asyncio.wait_for(ws1.recv(), timeout=1.0)
                response_data = json.loads(response)
                print(f"📨 User 1 received (unexpected): {response_data}")
            except asyncio.TimeoutError:
                print("✅ User 1 correctly did not receive own scroll_update")
            
            return {"success": False}
            
    except Exception as e:
        print(f"🚫 Two-user test failed: {e}")
        return {"error": True, "message": str(e)}

if __name__ == "__main__":
    print("🚀 VectorSpace scroll_update Authentication Test")
    print("=" * 55)
    
    # Test 1: Single user with authentication
    print("1. Testing with valid authentication...")
    result1 = asyncio.run(test_scroll_update_with_auth())
    
    # Test 2: Two users to test broadcasting
    print("\n2. Testing broadcasting between users...")
    result2 = asyncio.run(test_two_user_scroll_broadcast())
    
    print(f"\n📊 Test Results:")
    print(f"   Single User Test: {'✅' if not result1.get('error') else '❌'}")
    print(f"   Two User Test: {'✅' if result2.get('success') else '❌'}")
    
    if result1.get("error"):
        print(f"   Error: {result1.get('message')}")
        
    print("\n🏁 Investigation complete!")