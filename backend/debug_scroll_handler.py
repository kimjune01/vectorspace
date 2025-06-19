#!/usr/bin/env python3
"""
Debug the scroll_update handler to find the exact issue.
"""

import asyncio
import logging
from app.routers.websocket import handle_message_scroll_update
from app.models import User
from app.services.websocket_manager import websocket_manager
from app.services.presence_manager import presence_manager

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def debug_scroll_handler():
    """Debug the scroll_update handler directly."""
    
    print("🔍 Debugging scroll_update handler...")
    
    # Create mock data
    connection_id = "debug_connection_123"
    user = User()
    user.id = 1
    user.username = "debug_user"
    conversation_id = 1
    
    message_data = {
        "type": "scroll_update",
        "current_message_index": 5,
        "current_message_id": "debug_msg_5"
    }
    
    print(f"📤 Testing with data: {message_data}")
    
    try:
        # Test the handler directly
        print("🧪 Calling handle_message_scroll_update...")
        await handle_message_scroll_update(connection_id, user, conversation_id, message_data)
        print("✅ Handler completed successfully!")
        
    except Exception as e:
        print(f"🚨 Handler threw exception: {e}")
        print(f"   Exception type: {type(e)}")
        import traceback
        traceback.print_exc()
        
        return {"error": True, "exception": str(e)}
    
    return {"error": False}

async def test_presence_manager():
    """Test the presence manager separately."""
    
    print("\n🔍 Testing presence manager...")
    
    try:
        await presence_manager.update_user_activity(1, 1)
        print("✅ Presence manager works")
        return True
    except Exception as e:
        print(f"🚨 Presence manager error: {e}")
        return False

async def test_websocket_manager():
    """Test the WebSocket manager separately."""
    
    print("\n🔍 Testing WebSocket manager...")
    
    try:
        result = await websocket_manager.broadcast_to_conversation(1, {
            "type": "test_message",
            "data": "debug"
        }, exclude_connection_id="debug_connection")
        
        print(f"✅ WebSocket manager works, sent to {result} connections")
        return True
    except Exception as e:
        print(f"🚨 WebSocket manager error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 VectorSpace scroll_update Handler Debug")
    print("=" * 45)
    
    # Test each component
    result1 = asyncio.run(test_presence_manager())
    result2 = asyncio.run(test_websocket_manager())
    result3 = asyncio.run(debug_scroll_handler())
    
    print(f"\n📊 Debug Results:")
    print(f"   Presence Manager: {'✅' if result1 else '❌'}")
    print(f"   WebSocket Manager: {'✅' if result2 else '❌'}")
    print(f"   Scroll Handler: {'✅' if not result3.get('error') else '❌'}")
    
    if result3.get("error"):
        print(f"   Handler Error: {result3.get('exception')}")
    
    if all([result1, result2, not result3.get("error")]):
        print("\n🎉 All components work individually!")
        print("💡 The issue might be in the message routing or timing")
    else:
        print("\n🚨 Found component issues")