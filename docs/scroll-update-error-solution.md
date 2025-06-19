# Solving "Unknown message type: scroll_update" Error

## Problem Analysis

The "Unknown message type: scroll_update" error indicates that the WebSocket message handler on the backend doesn't recognize the `scroll_update` message type. Based on my investigation, here's what I found:

### ✅ Backend Support Confirmed
The backend **does** support `scroll_update` messages:

```python
# In /backend/app/routers/websocket.py (lines 228-229)
elif message_type == "scroll_update":
    await handle_message_scroll_update(connection_id, user, conversation_id, message_data)
```

The handler function `handle_message_scroll_update` is fully implemented (lines 762-803).

### ✅ Frontend Integration Confirmed  
The frontend has `scroll_update` type defined:

```typescript
// In /frontend/src/hooks/useWebSocket.ts (line 4)
export interface WebSocketMessage {
  type: 'message' | 'user_message' | 'ai_message' | 'error' | 'conversation_archived' | 'presence_update' | 'connection_established' | 'scroll_update';
  // ...
}
```

## Root Cause Analysis

The error likely occurs due to one of these issues:

### 1. **WebSocket Connection Not Established**
- The message is sent before the WebSocket connection is fully established
- Authentication failures preventing connection
- Network connectivity issues

### 2. **Message Format Issues**
- Incorrect message structure
- Missing required fields
- JSON serialization problems

### 3. **Authentication Problems**
- Invalid JWT token
- Token expiration
- Token blacklisting

### 4. **Race Conditions**
- Messages sent before connection handshake completes
- Rapid message sending overwhelming the handler

## Solution Framework

### 1. **WebSocket Connection Debugging**

```javascript
// Enhanced WebSocket connection with comprehensive error handling
class ScrollPresenceWebSocket {
  constructor(conversationId, token) {
    this.conversationId = conversationId;
    this.token = token;
    this.ws = null;
    this.isConnected = false;
    this.messageQueue = [];
    this.connectionRetries = 0;
    this.maxRetries = 3;
  }
  
  connect() {
    const wsUrl = `ws://localhost:8000/api/ws/conversations/${this.conversationId}?token=${this.token}`;
    console.log('🔗 Connecting to:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = (event) => {
      console.log('✅ WebSocket connected successfully');
      this.isConnected = true;
      this.connectionRetries = 0;
      
      // Process queued messages
      this.flushMessageQueue();
      
      // Send test message to verify connection
      this.sendScrollUpdate(0, 'connection_test');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data.type, data);
        
        if (data.type === 'error') {
          console.error('🚨 Server Error:', data.message);
          if (data.message.includes('scroll_update')) {
            console.error('🎯 SCROLL_UPDATE ERROR DETECTED:', data.message);
            this.diagnoseScrollUpdateError(data);
          }
        }
      } catch (error) {
        console.error('📨 Message parse error:', error);
      }
    };
    
    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      this.isConnected = false;
      
      // Attempt reconnection
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`🔄 Reconnecting... (${this.connectionRetries}/${this.maxRetries})`);
        setTimeout(() => this.connect(), 2000 * this.connectionRetries);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('🚫 WebSocket error:', error);
    };
  }
  
  sendScrollUpdate(messageIndex, messageId) {
    const message = {
      type: 'scroll_update',
      current_message_index: messageIndex,
      current_message_id: messageId
    };
    
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending scroll_update:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.log('📋 Queueing scroll_update (not connected):', message);
      this.messageQueue.push(message);
    }
  }
  
  flushMessageQueue() {
    console.log(`📤 Flushing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }
  
  diagnoseScrollUpdateError(errorData) {
    console.log('🔍 DIAGNOSING SCROLL_UPDATE ERROR:');
    console.log('1. Error message:', errorData.message);
    console.log('2. Connection state:', this.ws.readyState);
    console.log('3. Is connected:', this.isConnected);
    console.log('4. Conversation ID:', this.conversationId);
    console.log('5. Token length:', this.token ? this.token.length : 'No token');
    
    // Test alternative message formats
    this.testAlternativeFormats();
  }
  
  testAlternativeFormats() {
    console.log('🧪 Testing alternative message formats...');
    
    // Test 1: scroll_position_update (different type)
    const positionUpdate = {
      type: 'scroll_position_update',
      scroll_position: {
        scrollTop: 100,
        scrollHeight: 500,
        clientHeight: 400,
        scrollPercentage: 20
      }
    };
    
    setTimeout(() => {
      console.log('📤 Testing scroll_position_update:', positionUpdate);
      this.ws.send(JSON.stringify(positionUpdate));
    }, 1000);
    
    // Test 2: ping (known working message)
    setTimeout(() => {
      const ping = { type: 'ping' };
      console.log('📤 Testing ping:', ping);
      this.ws.send(JSON.stringify(ping));
    }, 2000);
  }
}
```

### 2. **Puppeteer MCP Testing Implementation**

```javascript
// Complete scroll_update testing with Puppeteer MCP
async function testScrollUpdateWithPuppeteerMCP() {
  console.log('🧪 Testing scroll_update with Puppeteer MCP Server');
  
  // Setup comprehensive monitoring
  await mcp.puppeteer_evaluate({
    script: `
      // Initialize test environment
      window.scrollUpdateTest = {
        events: [],
        errors: [],
        successes: [],
        startTime: Date.now()
      };
      
      // Enhanced WebSocket monitoring
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        console.log('🔗 WebSocket created:', url);
        
        ws.addEventListener('open', () => {
          console.log('✅ WebSocket opened');
          window.scrollUpdateTest.events.push({
            type: 'open',
            timestamp: Date.now(),
            url: url
          });
        });
        
        ws.addEventListener('message', (event) => {
          const data = JSON.parse(event.data);
          console.log('📨 Message received:', data.type, data);
          
          window.scrollUpdateTest.events.push({
            type: 'message_received',
            messageType: data.type,
            data: data,
            timestamp: Date.now()
          });
          
          if (data.type === 'error' && data.message.includes('scroll_update')) {
            window.scrollUpdateTest.errors.push({
              error: data.message,
              timestamp: Date.now(),
              context: 'scroll_update_error'
            });
            console.error('🎯 SCROLL_UPDATE ERROR:', data.message);
          }
        });
        
        // Override send to log outgoing messages
        const originalSend = ws.send.bind(ws);
        ws.send = function(data) {
          const parsed = JSON.parse(data);
          console.log('📤 Sending:', parsed.type, parsed);
          
          window.scrollUpdateTest.events.push({
            type: 'message_sent',
            messageType: parsed.type,
            data: parsed,
            timestamp: Date.now()
          });
          
          return originalSend(data);
        };
        
        return ws;
      };
      
      'Enhanced WebSocket monitoring setup complete'
    `
  });
  
  // Navigate to conversation page
  await mcp.puppeteer_navigate({ url: 'http://localhost:5173/conversation/1' });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test scroll_update messages
  await mcp.puppeteer_evaluate({
    script: `
      // Get authentication token
      const token = localStorage.getItem('token') || 'test-token';
      const conversationId = 1;
      
      // Create WebSocket connection
      const ws = new WebSocket(\`ws://localhost:8000/api/ws/conversations/\${conversationId}?token=\${token}\`);
      
      ws.onopen = () => {
        console.log('🧪 Connection established, testing scroll_update...');
        
        // Test 1: Basic scroll_update
        setTimeout(() => {
          const scrollMessage = {
            type: 'scroll_update',
            current_message_index: 5,
            current_message_id: 'msg_123'
          };
          
          console.log('📤 Testing scroll_update:', scrollMessage);
          ws.send(JSON.stringify(scrollMessage));
        }, 1000);
        
        // Test 2: scroll_position_update (for comparison)
        setTimeout(() => {
          const positionMessage = {
            type: 'scroll_position_update',
            scroll_position: {
              scrollTop: 100,
              scrollHeight: 500,
              clientHeight: 400,
              scrollPercentage: 20
            }
          };
          
          console.log('📤 Testing scroll_position_update:', positionMessage);
          ws.send(JSON.stringify(positionMessage));
        }, 2000);
      };
      
      window.testWebSocket = ws;
      'Scroll update test initiated'
    `
  });
  
  // Wait for results
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Generate report
  const report = await mcp.puppeteer_evaluate({
    script: `
      const testData = window.scrollUpdateTest || {};
      const report = {
        duration: Date.now() - testData.startTime,
        totalEvents: testData.events.length,
        errors: testData.errors,
        messagesSent: testData.events.filter(e => e.type === 'message_sent'),
        messagesReceived: testData.events.filter(e => e.type === 'message_received'),
        scrollUpdateErrors: testData.errors.filter(e => e.context === 'scroll_update_error')
      };
      
      console.log('📊 Scroll Update Test Report:', report);
      
      if (report.scrollUpdateErrors.length > 0) {
        console.log('🚨 SCROLL_UPDATE ERRORS FOUND:');
        report.scrollUpdateErrors.forEach((error, index) => {
          console.log(\`  \${index + 1}. \${error.error}\`);
        });
      }
      
      report
    `
  });
  
  await mcp.puppeteer_screenshot({ name: 'scroll_update_test_complete' });
  
  return report;
}
```

### 3. **Backend Debugging**

To debug the backend, add enhanced logging to the WebSocket handler:

```python
# In handle_websocket_message function, add detailed logging
async def handle_websocket_message(
    connection_id: str, 
    user: User, 
    conversation_id: int, 
    message_data: dict, 
    db: AsyncSession
):
    # Add debug logging
    logger.info(f"Processing message: type={message_data.get('type')}, user={user.username}, conversation={conversation_id}")
    
    message_type = message_data.get("type")
    if not message_type:
        logger.error(f"Missing message type: {message_data}")
        # ... rest of handler
    
    # Add specific logging for scroll_update
    if message_type == "scroll_update":
        logger.info(f"Processing scroll_update: {message_data}")
        await handle_message_scroll_update(connection_id, user, conversation_id, message_data)
    elif message_type == "scroll_position_update":
        logger.info(f"Processing scroll_position_update: {message_data}")
        await handle_scroll_position_update(connection_id, user, conversation_id, message_data)
    else:
        logger.warning(f"Unknown message type '{message_type}' from user {user.username}")
        await websocket_manager.send_to_connection(connection_id, {
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        })
```

### 4. **Complete Solution Checklist**

#### ✅ **Immediate Fixes**
1. **Verify WebSocket Connection**: Ensure the connection is established before sending messages
2. **Check Authentication**: Verify JWT token is valid and not blacklisted
3. **Message Format Validation**: Ensure all required fields are present
4. **Error Handling**: Add comprehensive error handling and logging

#### ✅ **Testing Protocol**
1. **Connection Test**: Verify WebSocket connects successfully
2. **Authentication Test**: Test with valid/invalid tokens
3. **Message Format Test**: Test different message structures
4. **Error Response Test**: Verify error handling works correctly

#### ✅ **Production Monitoring**
1. **WebSocket Metrics**: Track connection success/failure rates
2. **Message Processing**: Monitor message types and processing times
3. **Error Tracking**: Log and alert on unknown message types
4. **Performance Monitoring**: Track scroll update frequency and impact

## Usage Examples

### Testing with Puppeteer MCP Server

```javascript
// Run the complete test suite
await testScrollUpdateWithPuppeteerMCP();

// Quick manual test
await mcp.puppeteer_navigate({ url: 'http://localhost:5173/conversation/1' });
await mcp.puppeteer_evaluate({
  script: `
    const ws = new WebSocket('ws://localhost:8000/api/ws/conversations/1?token=' + localStorage.getItem('token'));
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'scroll_update',
        current_message_index: 1,
        current_message_id: 'test_1'
      }));
    };
    ws.onmessage = (event) => {
      console.log('Response:', JSON.parse(event.data));
    };
  `
});
```

## Conclusion

The "Unknown message type: scroll_update" error is solvable through:

1. **Proper connection establishment** before sending messages
2. **Valid authentication** with correct JWT tokens
3. **Correct message format** with required fields
4. **Robust error handling** and retry mechanisms

The testing framework provided allows comprehensive validation of the scroll-based presence functionality using the Puppeteer MCP server, enabling both debugging and ongoing monitoring of the feature.