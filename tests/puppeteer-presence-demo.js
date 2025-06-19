/**
 * VectorSpace Presence Testing Demo using Puppeteer MCP Server
 * 
 * This script demonstrates how to use the Puppeteer MCP server to test
 * multi-user flows and presence functionality in VectorSpace.
 */

// Configuration
const config = {
  baseUrl: 'http://localhost:5173',
  backendUrl: 'http://localhost:8000',
  testUsers: [
    { username: 'alice_presence', email: 'alice@presence.test', password: 'test123' },
    { username: 'bob_presence', email: 'bob@presence.test', password: 'test123' },
    { username: 'charlie_presence', email: 'charlie@presence.test', password: 'test123' }
  ]
};

/**
 * Setup WebSocket monitoring to capture all real-time events
 */
async function setupWebSocketMonitoring() {
  console.log('🔧 Setting up WebSocket monitoring...');
  
  const result = await mcp.puppeteer_evaluate({
    script: `
      // Initialize monitoring
      window.presenceTestData = {
        wsEvents: [],
        wsConnections: [],
        userActions: [],
        startTime: Date.now()
      };
      
      // Override WebSocket to capture all events
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        // Track this connection
        window.presenceTestData.wsConnections.push({
          url: url,
          created: Date.now(),
          instance: ws
        });
        
        console.log('🔗 WebSocket connection created:', url);
        
        // Monitor all WebSocket events
        ws.addEventListener('open', (event) => {
          const logEntry = {
            type: 'ws_open',
            url: url,
            timestamp: Date.now(),
            readyState: ws.readyState
          };
          window.presenceTestData.wsEvents.push(logEntry);
          console.log('✅ WebSocket opened:', logEntry);
        });
        
        ws.addEventListener('close', (event) => {
          const logEntry = {
            type: 'ws_close',
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            timestamp: Date.now()
          };
          window.presenceTestData.wsEvents.push(logEntry);
          console.log('❌ WebSocket closed:', logEntry);
        });
        
        ws.addEventListener('error', (event) => {
          const logEntry = {
            type: 'ws_error',
            error: event.error?.message || 'Unknown error',
            timestamp: Date.now()
          };
          window.presenceTestData.wsEvents.push(logEntry);
          console.log('🚫 WebSocket error:', logEntry);
        });
        
        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            const logEntry = {
              type: 'ws_message_received',
              messageType: data.type,
              userId: data.userId,
              data: data,
              timestamp: Date.now()
            };
            window.presenceTestData.wsEvents.push(logEntry);
            
            // Special logging for presence events
            if (['user_joined', 'user_left', 'presence_update', 'typing_start', 'typing_stop'].includes(data.type)) {
              console.log('👥 Presence event:', logEntry);
            } else {
              console.log('📨 Message received:', logEntry);
            }
          } catch (e) {
            const logEntry = {
              type: 'ws_message_received',
              messageType: 'non_json',
              data: event.data,
              timestamp: Date.now()
            };
            window.presenceTestData.wsEvents.push(logEntry);
            console.log('📨 Non-JSON message:', logEntry);
          }
        });
        
        // Override send method to log outgoing messages
        const originalSend = ws.send.bind(ws);
        ws.send = function(data) {
          try {
            const parsedData = JSON.parse(data);
            const logEntry = {
              type: 'ws_message_sent',
              messageType: parsedData.type,
              data: parsedData,
              timestamp: Date.now()
            };
            window.presenceTestData.wsEvents.push(logEntry);
            console.log('📤 Message sent:', logEntry);
          } catch (e) {
            const logEntry = {
              type: 'ws_message_sent',
              messageType: 'non_json',
              data: data,
              timestamp: Date.now()
            };
            window.presenceTestData.wsEvents.push(logEntry);
            console.log('📤 Non-JSON message sent:', logEntry);
          }
          return originalSend(data);
        };
        
        return ws;
      };
      
      // Preserve WebSocket prototype
      Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
      Object.defineProperty(window.WebSocket, 'prototype', {
        value: OriginalWebSocket.prototype,
        writable: false
      });
      
      'WebSocket monitoring initialized'
    `
  });
  
  console.log('✅ WebSocket monitoring setup complete');
  return result;
}

/**
 * Log a user action for tracking user behavior
 */
async function logUserAction(action, details = {}) {
  await mcp.puppeteer_evaluate({
    script: `
      if (window.presenceTestData) {
        window.presenceTestData.userActions.push({
          action: '${action}',
          details: ${JSON.stringify(details)},
          timestamp: Date.now(),
          url: window.location.href
        });
        console.log('👤 User action logged:', '${action}', ${JSON.stringify(details)});
      }
    `
  });
}

/**
 * Test multi-user registration flow
 */
async function testUserRegistration() {
  console.log('🧪 Testing multi-user registration...');
  
  for (let i = 0; i < config.testUsers.length; i++) {
    const user = config.testUsers[i];
    console.log(`📝 Registering user ${i + 1}: ${user.username}`);
    
    // Navigate to registration page
    await mcp.puppeteer_navigate({ url: `${config.baseUrl}/register` });
    await mcp.puppeteer_screenshot({ name: `register_page_user_${i + 1}` });
    
    await logUserAction('navigate_to_register', { username: user.username });
    
    // Fill registration form (check if elements exist first)
    const formExists = await mcp.puppeteer_evaluate({
      script: `
        const usernameInput = document.querySelector('input[name="username"], input[type="text"]:first-of-type, #username');
        const emailInput = document.querySelector('input[name="email"], input[type="email"], #email');
        const passwordInput = document.querySelector('input[name="password"], input[type="password"], #password');
        
        const result = {
          usernameInput: !!usernameInput,
          emailInput: !!emailInput,
          passwordInput: !!passwordInput,
          anyForm: !!document.querySelector('form'),
          allInputs: document.querySelectorAll('input').length
        };
        
        console.log('Registration form analysis:', result);
        result
      `
    });
    
    if (formExists.anyForm) {
      console.log('📋 Registration form found, filling fields...');
      
      // Try to fill common input selectors
      try {
        await mcp.puppeteer_fill({ 
          selector: 'input[name="username"], input[type="text"]:first-of-type, #username', 
          value: user.username 
        });
        await logUserAction('fill_username', { username: user.username });
      } catch (e) {
        console.log('⚠️ Could not fill username field');
      }
      
      try {
        await mcp.puppeteer_fill({ 
          selector: 'input[name="email"], input[type="email"], #email', 
          value: user.email 
        });
        await logUserAction('fill_email', { email: user.email });
      } catch (e) {
        console.log('⚠️ Could not fill email field');
      }
      
      try {
        await mcp.puppeteer_fill({ 
          selector: 'input[name="password"], input[type="password"], #password', 
          value: user.password 
        });
        await logUserAction('fill_password');
      } catch (e) {
        console.log('⚠️ Could not fill password field');
      }
      
      // Try to submit
      try {
        await mcp.puppeteer_click({ selector: 'button[type="submit"], .submit-btn, button:contains("Register")' });
        await logUserAction('submit_registration');
      } catch (e) {
        console.log('⚠️ Could not click submit button');
      }
      
      await mcp.puppeteer_screenshot({ name: `registration_attempt_user_${i + 1}` });
    } else {
      console.log('⚠️ No registration form found on page');
    }
    
    // Wait a moment between registrations
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('✅ User registration test completed');
}

/**
 * Test presence in a conversation
 */
async function testConversationPresence() {
  console.log('🧪 Testing conversation presence...');
  
  // Navigate to conversation (try multiple possible URLs)
  const conversationUrls = [
    `${config.baseUrl}/conversation/1`,
    `${config.baseUrl}/chat/1`,
    `${config.baseUrl}/conversations/1`
  ];
  
  for (const url of conversationUrls) {
    console.log(`🔗 Trying conversation URL: ${url}`);
    await mcp.puppeteer_navigate({ url });
    await logUserAction('navigate_to_conversation', { url });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if conversation page loaded successfully
    const pageAnalysis = await mcp.puppeteer_evaluate({
      script: `
        const analysis = {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.textContent.trim().substring(0, 100),
          hasContent: document.body.textContent.trim().length > 0,
          elements: {
            messages: document.querySelectorAll('[data-testid="message"], .message, .chat-message').length,
            messageInput: !!document.querySelector('[data-testid="message-input"], input[placeholder*="message"], .message-input'),
            sendButton: !!document.querySelector('[data-testid="send-button"], .send-btn, button:contains("Send")'),
            presenceUsers: document.querySelectorAll('[data-testid="presence-user"], .presence-user, .online-user').length,
            typingIndicators: document.querySelectorAll('[data-testid="typing-indicator"], .typing-indicator').length
          },
          wsConnections: (window.presenceTestData?.wsConnections || []).length,
          wsEvents: (window.presenceTestData?.wsEvents || []).length
        };
        
        console.log('Conversation page analysis:', analysis);
        analysis
      `
    });
    
    await mcp.puppeteer_screenshot({ name: `conversation_page_${url.split('/').pop()}` });
    
    if (pageAnalysis.hasContent || pageAnalysis.wsConnections > 0) {
      console.log('✅ Found working conversation page:', url);
      
      // Test message sending if input is available
      if (pageAnalysis.elements.messageInput) {
        console.log('💬 Testing message sending...');
        await testMessageSending();
      }
      
      // Test typing indicators
      if (pageAnalysis.elements.messageInput) {
        console.log('⌨️ Testing typing indicators...');
        await testTypingIndicators();
      }
      
      break;
    } else {
      console.log('❌ Conversation page not functional:', url);
    }
  }
}

/**
 * Test message sending functionality
 */
async function testMessageSending() {
  const testMessage = `Test message from Puppeteer at ${Date.now()}`;
  
  try {
    // Fill message input
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="message-input"], input[placeholder*="message"], .message-input', 
      value: testMessage 
    });
    await logUserAction('fill_message', { message: testMessage });
    
    // Send message
    await mcp.puppeteer_click({ 
      selector: '[data-testid="send-button"], .send-btn, button:contains("Send")' 
    });
    await logUserAction('send_message');
    
    // Wait for message to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify message appears
    const messageVisible = await mcp.puppeteer_evaluate({
      script: `
        const messages = Array.from(document.querySelectorAll('[data-testid="message"], .message, .chat-message'));
        const found = messages.some(el => el.textContent.includes('${testMessage}'));
        console.log('Message visibility check:', found);
        found
      `
    });
    
    await mcp.puppeteer_screenshot({ name: 'message_sent' });
    console.log(`📨 Message visibility: ${messageVisible ? 'Visible' : 'Not visible'}`);
    
  } catch (error) {
    console.log('⚠️ Message sending failed:', error.message);
  }
}

/**
 * Test typing indicators
 */
async function testTypingIndicators() {
  try {
    // Start typing
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="message-input"], input[placeholder*="message"], .message-input', 
      value: 'User is typing a message...' 
    });
    await logUserAction('start_typing');
    
    // Wait for typing indicator
    await new Promise(resolve => setTimeout(resolve, 1500));
    await mcp.puppeteer_screenshot({ name: 'typing_state' });
    
    // Check for typing indicators
    const typingIndicators = await mcp.puppeteer_evaluate({
      script: `
        const indicators = document.querySelectorAll('[data-testid="typing-indicator"], .typing-indicator').length;
        console.log('Typing indicators found:', indicators);
        indicators
      `
    });
    
    console.log(`⌨️ Typing indicators: ${typingIndicators}`);
    
    // Stop typing
    await mcp.puppeteer_fill({ 
      selector: '[data-testid="message-input"], input[placeholder*="message"], .message-input', 
      value: '' 
    });
    await logUserAction('stop_typing');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await mcp.puppeteer_screenshot({ name: 'stopped_typing' });
    
  } catch (error) {
    console.log('⚠️ Typing indicator test failed:', error.message);
  }
}

/**
 * Test scroll-based presence
 */
async function testScrollPresence() {
  console.log('🧪 Testing scroll-based presence...');
  
  try {
    // Scroll through content
    await mcp.puppeteer_evaluate({
      script: `
        // Scroll to different positions
        window.scrollTo(0, 100);
        setTimeout(() => window.scrollTo(0, 200), 500);
        setTimeout(() => window.scrollTo(0, 300), 1000);
        
        'Scroll sequence initiated'
      `
    });
    
    await logUserAction('scroll_through_content');
    
    // Wait for scroll position updates
    await new Promise(resolve => setTimeout(resolve, 2000));
    await mcp.puppeteer_screenshot({ name: 'scroll_presence' });
    
    // Check for scroll-based presence indicators
    const scrollPresence = await mcp.puppeteer_evaluate({
      script: `
        const scrollAvatars = document.querySelectorAll('[data-testid="scroll-presence-avatar"], .scroll-presence').length;
        console.log('Scroll presence avatars:', scrollAvatars);
        scrollAvatars
      `
    });
    
    console.log(`📜 Scroll presence indicators: ${scrollPresence}`);
    
  } catch (error) {
    console.log('⚠️ Scroll presence test failed:', error.message);
  }
}

/**
 * Test network disconnection and reconnection
 */
async function testNetworkReconnection() {
  console.log('🧪 Testing network disconnection/reconnection...');
  
  try {
    // Simulate network disconnection
    await mcp.puppeteer_evaluate({
      script: `
        // Store original WebSocket connections
        window.originalConnections = window.presenceTestData?.wsConnections?.map(conn => conn.instance) || [];
        
        // Close all WebSocket connections to simulate disconnect
        window.originalConnections.forEach(ws => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'Simulated disconnect');
          }
        });
        
        // Simulate navigator offline
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false
        });
        
        window.dispatchEvent(new Event('offline'));
        console.log('🔌 Simulated network disconnection');
        
        'Network disconnected'
      `
    });
    
    await logUserAction('simulate_disconnect');
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
        console.log('🔌 Simulated network reconnection');
        
        'Network reconnected'
      `
    });
    
    await logUserAction('simulate_reconnect');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await mcp.puppeteer_screenshot({ name: 'reconnected_state' });
    
  } catch (error) {
    console.log('⚠️ Network reconnection test failed:', error.message);
  }
}

/**
 * Generate comprehensive test report
 */
async function generateTestReport() {
  console.log('📊 Generating test report...');
  
  const report = await mcp.puppeteer_evaluate({
    script: `
      const testData = window.presenceTestData || {};
      const endTime = Date.now();
      
      const report = {
        testDuration: endTime - (testData.startTime || endTime),
        webSocketEvents: {
          total: testData.wsEvents?.length || 0,
          byType: (testData.wsEvents || []).reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
          }, {}),
          presenceEvents: (testData.wsEvents || []).filter(event => 
            ['user_joined', 'user_left', 'presence_update', 'typing_start', 'typing_stop'].includes(event.messageType)
          )
        },
        userActions: {
          total: testData.userActions?.length || 0,
          actions: testData.userActions || []
        },
        webSocketConnections: {
          total: testData.wsConnections?.length || 0,
          connections: testData.wsConnections || []
        },
        pageState: {
          url: window.location.href,
          title: document.title,
          hasWebSocketSupport: typeof WebSocket !== 'undefined',
          isOnline: navigator.onLine
        }
      };
      
      console.log('📋 Test Report Generated:', report);
      report
    `
  });
  
  console.log('📊 TEST REPORT SUMMARY:');
  console.log('========================');
  console.log(`Test Duration: ${report.testDuration}ms`);
  console.log(`WebSocket Events: ${report.webSocketEvents.total}`);
  console.log(`User Actions: ${report.userActions.total}`);
  console.log(`WebSocket Connections: ${report.webSocketConnections.total}`);
  console.log(`Presence Events: ${report.webSocketEvents.presenceEvents.length}`);
  console.log(`Current Page: ${report.pageState.url}`);
  console.log(`Online Status: ${report.pageState.isOnline}`);
  
  if (report.webSocketEvents.total > 0) {
    console.log('\n📈 WebSocket Event Types:');
    Object.entries(report.webSocketEvents.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }
  
  if (report.webSocketEvents.presenceEvents.length > 0) {
    console.log('\n👥 Presence Events:');
    report.webSocketEvents.presenceEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.messageType} - User: ${event.userId} - Time: ${new Date(event.timestamp).toLocaleTimeString()}`);
    });
  }
  
  return report;
}

/**
 * Main test runner
 */
async function runPresenceTestSuite() {
  console.log('🚀 VectorSpace Presence Testing Suite with Puppeteer MCP');
  console.log('=' .repeat(60));
  
  try {
    // Initialize
    await setupWebSocketMonitoring();
    await mcp.puppeteer_screenshot({ name: 'test_start' });
    
    // Test 1: User Registration
    await testUserRegistration();
    
    // Test 2: Conversation Presence
    await testConversationPresence();
    
    // Test 3: Scroll Presence
    await testScrollPresence();
    
    // Test 4: Network Reconnection
    await testNetworkReconnection();
    
    // Generate final report
    const report = await generateTestReport();
    
    await mcp.puppeteer_screenshot({ name: 'test_complete' });
    
    console.log('\n✅ All tests completed successfully!');
    console.log('📸 Screenshots saved with test progress');
    console.log('📋 Full test report generated');
    
    return report;
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    await mcp.puppeteer_screenshot({ name: 'test_failure' });
    throw error;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runPresenceTestSuite,
    setupWebSocketMonitoring,
    testUserRegistration,
    testConversationPresence,
    testMessageSending,
    testTypingIndicators,
    testScrollPresence,
    testNetworkReconnection,
    generateTestReport,
    config
  };
}

// Usage example:
// await runPresenceTestSuite();