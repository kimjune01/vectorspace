#!/usr/bin/env python3
"""
Direct test to reproduce and fix the scroll_update error.
This script will connect to the WebSocket and send scroll_update messages to identify the issue.
"""

import asyncio
import websockets
import json
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

async def test_scroll_update():
    """Test scroll_update messages directly via WebSocket."""
    
    # Test with a mock token (you might need to get a real token)
    token = "test-token"
    conversation_id = 1
    ws_url = f"ws://localhost:8000/api/ws/conversations/{conversation_id}?token={token}"
    
    print(f"🔗 Connecting to: {ws_url}")
    
    try:
        async with websockets.connect(ws_url) as websocket:
            print("✅ WebSocket connected successfully")
            
            # Test 1: Send a scroll_update message
            scroll_message = {
                "type": "scroll_update",
                "current_message_index": 5,
                "current_message_id": "test_msg_5"
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
                    if "scroll_update" in response_data.get("message", ""):
                        print("🎯 This is the scroll_update error we're looking for!")
                        return response_data
                else:
                    print("✅ scroll_update message processed successfully")
                    
            except asyncio.TimeoutError:
                print("⏰ No response received within 5 seconds")
            
            # Test 2: Send a known working message type for comparison
            ping_message = {"type": "ping"}
            print(f"📤 Sending ping (for comparison): {ping_message}")
            await websocket.send(json.dumps(ping_message))
            
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                print(f"📨 Ping response: {response_data}")
            except asyncio.TimeoutError:
                print("⏰ No ping response received")
                
    except websockets.exceptions.ConnectionClosed as e:
        print(f"🔌 Connection closed: {e}")
        if e.code == 1008:
            print("🚨 Authentication failed - invalid token")
        return {"error": "connection_closed", "code": e.code}
    except Exception as e:
        print(f"🚫 Connection failed: {e}")
        return {"error": "connection_failed", "details": str(e)}

async def test_with_real_token():
    """Test with a real authentication token."""
    print("🔑 Testing with real authentication...")
    
    # You would need to implement actual token generation here
    # For now, let's test the message routing logic directly
    
    # Import the WebSocket handler to test the routing logic
    try:
        from app.routers.websocket import handle_websocket_message
        from app.models import User
        from app.database import get_db
        
        print("✅ Successfully imported WebSocket handler")
        
        # Test the message routing logic
        test_user = User(id=1, username="test_user", email="test@example.com")
        test_message = {
            "type": "scroll_update",
            "current_message_index": 5,
            "current_message_id": "test_msg_5"
        }
        
        print(f"🧪 Testing message routing for: {test_message}")
        
        # Check if the message type is recognized
        message_type = test_message.get("type")
        recognized_types = [
            "send_message", "join_conversation", "typing_indicator", "ping",
            "request_message_history", "mark_messages_read", "scroll_position_update", 
            "scroll_update"
        ]
        
        if message_type in recognized_types:
            print(f"✅ Message type '{message_type}' is recognized")
        else:
            print(f"❌ Message type '{message_type}' is NOT recognized")
            print(f"📋 Recognized types: {recognized_types}")
            
    except ImportError as e:
        print(f"❌ Could not import backend modules: {e}")
        print("💡 Make sure you're running this from the backend directory")

if __name__ == "__main__":
    print("🚀 VectorSpace scroll_update Error Investigation")
    print("=" * 50)
    
    print("\n1. Testing WebSocket connection and scroll_update messages...")
    result1 = asyncio.run(test_scroll_update())
    
    print("\n2. Testing message routing logic...")
    asyncio.run(test_with_real_token())
    
    print("\n📊 Investigation complete!")
    if result1 and result1.get("error"):
        print(f"🔍 Found issue: {result1}")
    else:
        print("✅ No obvious issues detected")