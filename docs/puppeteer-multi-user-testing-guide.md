# Multi-User Flow and Presence Testing with Puppeteer MCP Server

This guide demonstrates how to use the Puppeteer MCP server to test multi-user flows and presence functionality in VectorSpace.

## Overview

The Puppeteer MCP server provides several tools for browser automation that are perfect for testing real-time, multi-user features:

- `puppeteer_navigate` - Navigate to URLs
- `puppeteer_screenshot` - Capture visual state
- `puppeteer_click` - Interact with elements  
- `puppeteer_fill` - Fill form inputs
- `puppeteer_evaluate` - Execute JavaScript for complex interactions
- `puppeteer_hover` - Test hover states and interactions

## Testing Strategies

### 1. Multi-User Authentication Testing

```javascript
// Test multiple users can register and login
async function testMultiUserAuth() {
  const users = [
    { username: 'alice_test', email: 'alice@test.com', password: 'test123' },
    { username: 'bob_test', email: 'bob@test.com', password: 'test123' }
  ];
  
  for (const user of users) {
    // Navigate to registration
    await mcp.puppeteer_navigate({ url: 'http://localhost:5173/register' });
    await mcp.puppeteer_screenshot({ name: `register_${user.username}` });
    
    // Fill registration form
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="username-input"]', 
      value: user.username 
    });
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="email-input"]', 
      value: user.email 
    });
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="password-input"]', 
      value: user.password 
    });
    
    // Submit and verify
    await mcp.puppeteer_click({ selector: '[data-testid="register-submit"]' });
    await mcp.puppeteer_screenshot({ name: `registered_${user.username}` });
  }
}
```

### 2. Presence System Testing

The key to presence testing is simulating multiple browser sessions and monitoring WebSocket events:

```javascript
// Test user presence indicators
async function testPresence() {
  // Monitor WebSocket events for presence
  await mcp.puppeteer_evaluate({
    script: `
      window.presenceEvents = [];
      
      // Override WebSocket to capture presence events
      const originalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'user_joined' || 
                data.type === 'user_left' || 
                data.type === 'presence_update') {
              window.presenceEvents.push({
                type: data.type,
                userId: data.userId,
                timestamp: Date.now()
              });
              console.log('Presence event captured:', data);
            }
          } catch (e) {
            // Ignore non-JSON messages
          }
        });
        
        return ws;
      };
    `
  });
  
  // Join conversation and wait for presence updates
  await mcp.puppeteer_navigate({ 
    url: 'http://localhost:5173/conversation/123' 
  });
  
  // Wait for WebSocket connection and presence indicators
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Capture presence UI
  await mcp.puppeteer_screenshot({ name: 'presence_indicators' });
  
  // Verify presence events were captured
  const events = await mcp.puppeteer_evaluate({
    script: 'window.presenceEvents || []'
  });
  
  console.log('Presence events captured:', events);
}
```

### 3. Real-time Chat Testing

```javascript
// Test real-time message delivery
async function testRealTimeChat() {
  const conversationUrl = 'http://localhost:5173/conversation/123';
  
  // Navigate to conversation
  await mcp.puppeteer_navigate({ url: conversationUrl });
  
  // Send a test message
  const testMessage = `Test message at ${Date.now()}`;
  await mcp.puppeteer_fill({ 
    selector: '[data-testid="message-input"]', 
    value: testMessage 
  });
  await mcp.puppeteer_click({ selector: '[data-testid="send-button"]' });
  
  // Wait for message to appear
  await new Promise(resolve => setTimeout(resolve, 2000));
  await mcp.puppeteer_screenshot({ name: 'message_sent' });
  
  // Verify message appears in chat
  const messageVisible = await mcp.puppeteer_evaluate({
    script: `
      const messages = Array.from(document.querySelectorAll('[data-testid="message"]'));
      messages.some(el => el.textContent.includes('${testMessage}'))
    `
  });
  
  console.log('Message visible:', messageVisible);
}
```

### 4. Typing Indicators Testing

```javascript
// Test typing indicators
async function testTypingIndicators() {
  await mcp.puppeteer_navigate({ 
    url: 'http://localhost:5173/conversation/123' 
  });
  
  // Start typing
  await mcp.puppeteer_fill({ 
    selector: '[data-testid="message-input"]', 
    value: 'User is typing...' 
  });
  
  // Wait for typing indicator to appear
  await new Promise(resolve => setTimeout(resolve, 1000));
  await mcp.puppeteer_screenshot({ name: 'typing_indicator' });
  
  // Check for typing indicator elements
  const typingIndicators = await mcp.puppeteer_evaluate({
    script: `
      document.querySelectorAll('[data-testid="typing-indicator"]').length
    `
  });
  
  console.log('Typing indicators found:', typingIndicators);
  
  // Clear input to stop typing
  await mcp.puppeteer_fill({ 
    selector: '[data-testid="message-input"]', 
    value: '' 
  });
}
```

### 5. Scroll-Based Presence Testing

```javascript
// Test scroll position tracking
async function testScrollPresence() {
  await mcp.puppeteer_navigate({ 
    url: 'http://localhost:5173/conversation/123' 
  });
  
  // Scroll to specific message
  await mcp.puppeteer_evaluate({
    script: `
      const messages = document.querySelectorAll('[data-testid="message"]');
      if (messages.length > 5) {
        messages[5].scrollIntoView({ behavior: 'smooth' });
      }
    `
  });
  
  // Wait for scroll presence to update
  await new Promise(resolve => setTimeout(resolve, 2000));
  await mcp.puppeteer_screenshot({ name: 'scroll_presence' });
  
  // Check for scroll presence avatars
  const scrollPresenceAvatars = await mcp.puppeteer_evaluate({
    script: `
      document.querySelectorAll('[data-testid="scroll-presence-avatar"]').length
    `
  });
  
  console.log('Scroll presence avatars:', scrollPresenceAvatars);
}
```

### 6. Network Disconnection Testing

```javascript
// Test presence during network issues
async function testNetworkReconnection() {
  await mcp.puppeteer_navigate({ 
    url: 'http://localhost:5173/conversation/123' 
  });
  
  // Simulate network disconnection
  await mcp.puppeteer_evaluate({
    script: `
      // Close WebSocket connections
      if (window.webSocket) {
        window.webSocket.close();
      }
      
      // Simulate offline status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      // Trigger offline event
      window.dispatchEvent(new Event('offline'));
    `
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  await mcp.puppeteer_screenshot({ name: 'disconnected_state' });
  
  // Simulate reconnection
  await mcp.puppeteer_evaluate({
    script: `
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      
      window.dispatchEvent(new Event('online'));
    `
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  await mcp.puppeteer_screenshot({ name: 'reconnected_state' });
}
```

## Advanced Testing Scenarios

### Concurrent User Simulation

Since the Puppeteer MCP server operates on a single browser instance, true multi-user testing requires careful session management:

```javascript
// Simulate multiple users with session switching
async function testConcurrentUsers() {
  const users = ['alice', 'bob', 'charlie'];
  const conversationUrl = 'http://localhost:5173/conversation/123';
  
  for (const user of users) {
    // Login as different user
    await mcp.puppeteer_navigate({ url: 'http://localhost:5173/login' });
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="username-input"]', 
      value: user 
    });
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="password-input"]', 
      value: 'password123' 
    });
    await mcp.puppeteer_click({ selector: '[data-testid="login-submit"]' });
    
    // Join conversation
    await mcp.puppeteer_navigate({ url: conversationUrl });
    
    // Perform user-specific actions
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="message-input"]', 
      value: `Hello from ${user}!` 
    });
    await mcp.puppeteer_click({ selector: '[data-testid="send-button"]' });
    
    await mcp.puppeteer_screenshot({ name: `user_${user}_active` });
    
    // Simulate user activity (scrolling, typing, etc.)
    await simulateUserActivity(user);
  }
}

async function simulateUserActivity(username) {
  // Scroll through messages
  await mcp.puppeteer_evaluate({
    script: `
      window.scrollBy(0, 100);
    `
  });
  
  // Hover over elements
  await mcp.puppeteer_hover({ 
    selector: '[data-testid="message"]:last-child' 
  });
  
  // Start and stop typing
  await mcp.puppeteer_fill({ 
    selector: '[data-testid="message-input"]', 
    value: 'Typing...' 
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await mcp.puppeteer_fill({ 
    selector: '[data-testid="message-input"]', 
    value: '' 
  });
}
```

### WebSocket Event Monitoring

```javascript
// Comprehensive WebSocket event capture
async function setupWebSocketMonitoring() {
  await mcp.puppeteer_evaluate({
    script: `
      window.wsEventLog = [];
      window.wsConnections = [];
      
      // Override WebSocket constructor
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        // Track connection
        window.wsConnections.push(ws);
        
        // Log connection events
        ws.addEventListener('open', (event) => {
          window.wsEventLog.push({
            type: 'connection_opened',
            url: url,
            timestamp: Date.now()
          });
        });
        
        ws.addEventListener('close', (event) => {
          window.wsEventLog.push({
            type: 'connection_closed',
            code: event.code,
            reason: event.reason,
            timestamp: Date.now()
          });
        });
        
        ws.addEventListener('error', (event) => {
          window.wsEventLog.push({
            type: 'connection_error',
            error: event.error?.message || 'Unknown error',
            timestamp: Date.now()
          });
        });
        
        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            window.wsEventLog.push({
              type: 'message_received',
              messageType: data.type,
              data: data,
              timestamp: Date.now()
            });
          } catch (e) {
            window.wsEventLog.push({
              type: 'message_received',
              messageType: 'non_json',
              data: event.data,
              timestamp: Date.now()
            });
          }
        });
        
        // Override send to log outgoing messages
        const originalSend = ws.send.bind(ws);
        ws.send = function(data) {
          try {
            const parsedData = JSON.parse(data);
            window.wsEventLog.push({
              type: 'message_sent',
              messageType: parsedData.type,
              data: parsedData,
              timestamp: Date.now()
            });
          } catch (e) {
            window.wsEventLog.push({
              type: 'message_sent',
              messageType: 'non_json',
              data: data,
              timestamp: Date.now()
            });
          }
          return originalSend(data);
        };
        
        return ws;
      };
      
      // Copy static properties
      Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
      Object.defineProperty(window.WebSocket, 'prototype', {
        value: OriginalWebSocket.prototype,
        writable: false
      });
    `
  });
}

// Retrieve and analyze WebSocket events
async function analyzeWebSocketEvents() {
  const events = await mcp.puppeteer_evaluate({
    script: 'window.wsEventLog || []'
  });
  
  console.log('WebSocket Events Analysis:');
  console.log('Total events:', events.length);
  
  const eventTypes = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('Event types:', eventTypes);
  
  const presenceEvents = events.filter(event => 
    event.messageType === 'user_joined' ||
    event.messageType === 'user_left' ||
    event.messageType === 'presence_update'
  );
  
  console.log('Presence events:', presenceEvents.length);
  
  return { events, eventTypes, presenceEvents };
}
```

## Best Practices

1. **Setup WebSocket Monitoring Early**: Always setup WebSocket event monitoring before navigating to conversation pages.

2. **Use Appropriate Delays**: Real-time features need time to propagate. Use delays between actions.

3. **Capture Screenshots**: Visual verification is crucial for presence indicators and UI state.

4. **Test Error Scenarios**: Include network disconnection, reconnection, and error handling.

5. **Verify Both Sender and Receiver**: Test that events are properly sent and received.

6. **Clean Up**: Clear WebSocket connections and reset state between tests.

## Example Test Suite

```javascript
// Complete test suite example
async function runFullPresenceTestSuite() {
  console.log('🧪 Starting VectorSpace Presence Test Suite');
  
  try {
    // Setup
    await setupWebSocketMonitoring();
    
    // Test 1: Basic presence
    await testPresence();
    
    // Test 2: Chat functionality
    await testRealTimeChat();
    
    // Test 3: Typing indicators
    await testTypingIndicators();
    
    // Test 4: Scroll presence
    await testScrollPresence();
    
    // Test 5: Network resilience
    await testNetworkReconnection();
    
    // Analyze results
    const analysis = await analyzeWebSocketEvents();
    
    console.log('✅ Test suite completed successfully!');
    return analysis;
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    await mcp.puppeteer_screenshot({ name: 'test_failure' });
    throw error;
  }
}
```

This guide provides a comprehensive approach to testing multi-user flows and presence functionality using the Puppeteer MCP server. The key is combining browser automation with WebSocket monitoring to verify real-time behavior.