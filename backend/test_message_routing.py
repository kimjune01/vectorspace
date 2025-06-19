#!/usr/bin/env python3
"""
Test the message routing logic with detailed logging.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
from app.routers.websocket import handle_websocket_message
from app.models import User

async def test_message_routing():
    """Test the exact message routing logic."""
    
    print("🔍 Testing message routing logic...")
    
    # Create mock objects
    connection_id = "test_connection_123"
    user = User()
    user.id = 1
    user.username = "test_user"
    conversation_id = 1
    
    # Mock database session
    db_mock = AsyncMock()
    
    # Test different message types
    test_messages = [
        {"type": "ping"},
        {"type": "scroll_position_update", "scroll_position": {"scrollTop": 100, "scrollHeight": 500, "clientHeight": 400, "scrollPercentage": 20}},
        {"type": "scroll_update", "current_message_index": 5, "current_message_id": "test_msg_5"},
        {"type": "invalid_message_type"}
    ]
    
    for message in test_messages:
        print(f"\n📤 Testing message: {message}")
        
        try:
            # Call the handler and see what happens
            await handle_websocket_message(connection_id, user, conversation_id, message, db_mock)
            print(f"✅ Message '{message['type']}' processed successfully")
            
        except Exception as e:
            print(f"🚨 Message '{message['type']}' threw exception: {e}")
            import traceback
            traceback.print_exc()

async def test_scroll_update_specifically():
    """Test scroll_update message specifically with detailed tracing."""
    
    print("\n🎯 Testing scroll_update specifically...")
    
    # Mock all the dependencies
    from unittest.mock import patch
    
    connection_id = "test_connection_456"
    user = User()
    user.id = 1
    user.username = "test_user"
    conversation_id = 1
    
    message_data = {
        "type": "scroll_update", 
        "current_message_index": 7,
        "current_message_id": "test_msg_7"
    }
    
    db_mock = AsyncMock()
    
    print(f"📤 Message data: {message_data}")
    print(f"👤 User: {user.username} (ID: {user.id})")
    print(f"🔗 Connection: {connection_id}")
    print(f"💬 Conversation: {conversation_id}")
    
    # Patch the specific handlers to see which one gets called
    with patch('app.routers.websocket.handle_message_scroll_update') as mock_scroll_handler, \
         patch('app.routers.websocket.handle_scroll_position_update') as mock_position_handler, \
         patch('app.routers.websocket.websocket_manager') as mock_ws_manager:
        
        # Set up mocks
        mock_scroll_handler.return_value = asyncio.create_future()
        mock_scroll_handler.return_value.set_result(None)
        
        mock_position_handler.return_value = asyncio.create_future()
        mock_position_handler.return_value.set_result(None)
        
        mock_ws_manager.send_to_connection = AsyncMock()
        
        print("🧪 Calling handle_websocket_message...")
        
        try:
            await handle_websocket_message(connection_id, user, conversation_id, message_data, db_mock)
            print("✅ handle_websocket_message completed")
            
            # Check which handlers were called
            if mock_scroll_handler.called:
                print("✅ handle_message_scroll_update was called!")
                print(f"   Called with: {mock_scroll_handler.call_args}")
            else:
                print("❌ handle_message_scroll_update was NOT called")
                
            if mock_position_handler.called:
                print("❓ handle_scroll_position_update was called (unexpected)")
                
            if mock_ws_manager.send_to_connection.called:
                print("🚨 Error message was sent!")
                print(f"   Error calls: {mock_ws_manager.send_to_connection.call_args_list}")
            else:
                print("✅ No error message sent")
                
        except Exception as e:
            print(f"🚨 Exception in routing: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    print("🚀 VectorSpace Message Routing Debug")
    print("=" * 40)
    
    # Test 1: General routing
    print("1. Testing general message routing...")
    asyncio.run(test_message_routing())
    
    # Test 2: Specific scroll_update routing
    print("\n2. Testing scroll_update routing specifically...")
    asyncio.run(test_scroll_update_specifically())
    
    print("\n🏁 Routing debug complete!")