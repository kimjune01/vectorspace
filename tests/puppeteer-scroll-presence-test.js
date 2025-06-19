/**
 * Scroll-Based Presence Testing with Puppeteer MCP Server
 * 
 * This script specifically tests the scroll_update functionality
 * and helps debug the "Unknown message type: scroll_update" error.
 */

// Test Configuration
const config = {
  baseUrl: 'http://localhost:5173',
  backendUrl: 'http://localhost:8000',
  wsUrl: 'ws://localhost:8000',
  testConversationId: 1  // We'll test with conversation ID 1
};

/**
 * Setup comprehensive WebSocket monitoring specifically for scroll events
 */
async function setupScrollWebSocketMonitoring() {
  console.log('🔧 Setting up scroll-specific WebSocket monitoring...');
  
  await mcp.puppeteer_evaluate({
    script: `
      // Initialize scroll test data storage
      window.scrollTestData = {
        wsEvents: [],
        wsConnections: [],
        scrollUpdates: [],
        errors: [],
        startTime: Date.now(),
        messagesSent: [],
        messagesReceived: []
      };
      
      // Override WebSocket to capture all scroll-related events
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        // Track this connection
        window.scrollTestData.wsConnections.push({
          url: url,
          created: Date.now(),
          instance: ws
        });
        
        console.log('🔗 WebSocket connection created for scroll testing:', url);
        
        // Monitor WebSocket events
        ws.addEventListener('open', (event) => {
          const logEntry = {
            type: 'ws_open',
            url: url,
            timestamp: Date.now(),
            readyState: ws.readyState
          };
          window.scrollTestData.wsEvents.push(logEntry);
          console.log('✅ WebSocket opened for scroll testing:', logEntry);
        });
        
        ws.addEventListener('close', (event) => {
          const logEntry = {
            type: 'ws_close',
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            timestamp: Date.now()
          };
          window.scrollTestData.wsEvents.push(logEntry);
          console.log('❌ WebSocket closed:', logEntry);
        });
        
        ws.addEventListener('error', (event) => {
          const logEntry = {
            type: 'ws_error',
            error: event.error?.message || 'Unknown error',
            timestamp: Date.now()
          };
          window.scrollTestData.wsEvents.push(logEntry);
          window.scrollTestData.errors.push(logEntry);
          console.log('🚫 WebSocket error:', logEntry);
        });
        
        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            const logEntry = {
              type: 'ws_message_received',
              messageType: data.type,
              userId: data.user_id,
              data: data,
              timestamp: Date.now()
            };
            window.scrollTestData.wsEvents.push(logEntry);
            window.scrollTestData.messagesReceived.push(logEntry);
            
            // Special handling for scroll-related messages
            if (data.type === 'scroll_update' || data.type === 'user_scroll_position') {
              window.scrollTestData.scrollUpdates.push(logEntry);
              console.log('📜 Scroll event received:', logEntry);
            } else if (data.type === 'error' && data.message && data.message.includes('scroll')) {
              window.scrollTestData.errors.push({
                ...logEntry,
                errorMessage: data.message
              });
              console.log('🚨 Scroll-related error:', data.message);
            } else {
              console.log('📨 Message received:', logEntry);
            }
          } catch (e) {
            const logEntry = {
              type: 'ws_message_received',
              messageType: 'non_json',
              data: event.data,
              timestamp: Date.now(),
              parseError: e.message
            };
            window.scrollTestData.wsEvents.push(logEntry);
            console.log('📨 Non-JSON message:', logEntry);
          }
        });
        
        // Override send method to log outgoing scroll messages
        const originalSend = ws.send.bind(ws);
        ws.send = function(data) {
          try {
            const parsedData = JSON.parse(data);
            const logEntry = {
              type: 'ws_message_sent',
              messageType: parsedData.type,
              data: parsedData,
              timestamp: Date.now(),
              rawData: data
            };
            window.scrollTestData.wsEvents.push(logEntry);
            window.scrollTestData.messagesSent.push(logEntry);
            
            // Special logging for scroll messages
            if (parsedData.type === 'scroll_update' || parsedData.type === 'scroll_position_update') {
              console.log('📤 Scroll message sent:', logEntry);
            } else {
              console.log('📤 Message sent:', logEntry);
            }
          } catch (e) {
            const logEntry = {
              type: 'ws_message_sent',
              messageType: 'non_json',
              data: data,
              timestamp: Date.now(),
              parseError: e.message
            };
            window.scrollTestData.wsEvents.push(logEntry);
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
      
      'Scroll WebSocket monitoring initialized'
    `
  });
  
  console.log('✅ Scroll WebSocket monitoring setup complete');
}

/**
 * Test scroll_update message sending with different formats
 */
async function testScrollUpdateMessages() {
  console.log('🧪 Testing scroll_update message formats...');
  
  // Navigate to a conversation page
  const conversationUrl = \`\${config.baseUrl}/conversation/\${config.testConversationId}\`;
  await mcp.puppeteer_navigate({ url: conversationUrl });
  
  // Wait for page to load and WebSocket to connect
  await new Promise(resolve => setTimeout(resolve, 3000));
  await mcp.puppeteer_screenshot({ name: 'conversation_page_loaded' });
  
  // Check if we have an active WebSocket connection
  const connectionStatus = await mcp.puppeteer_evaluate({
    script: \`
      const connections = window.scrollTestData?.wsConnections || [];
      const activeConnections = connections.filter(conn => 
        conn.instance && conn.instance.readyState === WebSocket.OPEN
      );
      
      const status = {
        totalConnections: connections.length,
        activeConnections: activeConnections.length,
        wsEvents: (window.scrollTestData?.wsEvents || []).length,
        lastConnectionUrl: connections.length > 0 ? connections[connections.length - 1].url : null,
        readyStates: connections.map(conn => ({
          url: conn.url,
          readyState: conn.instance?.readyState,
          readyStateText: conn.instance?.readyState === 0 ? 'CONNECTING' :
                         conn.instance?.readyState === 1 ? 'OPEN' :
                         conn.instance?.readyState === 2 ? 'CLOSING' :
                         conn.instance?.readyState === 3 ? 'CLOSED' : 'UNKNOWN'
        }))
      };
      
      console.log('WebSocket connection status:', status);
      status
    \`
  });
  
  console.log('📊 WebSocket Connection Status:', connectionStatus);
  
  if (connectionStatus.activeConnections === 0) {
    console.log('⚠️ No active WebSocket connections found. Attempting to create manual connection...');
    
    // Try to establish WebSocket connection manually
    await mcp.puppeteer_evaluate({
      script: \`
        const token = localStorage.getItem('token') || 'test-token';
        const wsUrl = 'ws://localhost:8000/api/ws/conversations/\${config.testConversationId}?token=' + token;
        
        console.log('Attempting to connect to:', wsUrl);
        
        try {
          const ws = new WebSocket(wsUrl);
          window.manualWebSocket = ws;
          
          ws.onopen = () => {
            console.log('✅ Manual WebSocket connection established');
            window.scrollTestData.wsConnections.push({
              url: wsUrl,
              created: Date.now(),
              instance: ws,
              manual: true
            });
          };
          
          ws.onerror = (error) => {
            console.log('❌ Manual WebSocket connection failed:', error);
          };
          
          'Manual WebSocket connection attempted'
        } catch (error) {
          console.log('🚫 Error creating manual WebSocket:', error);
          throw error;
        }
      \`
    });
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check connection status again
    const newStatus = await mcp.puppeteer_evaluate({
      script: \`
        const connections = window.scrollTestData?.wsConnections || [];
        const activeConnections = connections.filter(conn => 
          conn.instance && conn.instance.readyState === WebSocket.OPEN
        );
        
        ({
          totalConnections: connections.length,
          activeConnections: activeConnections.length,
          manualConnection: window.manualWebSocket ? {
            readyState: window.manualWebSocket.readyState,
            url: window.manualWebSocket.url
          } : null
        })
      \`
    });
    
    console.log('📊 Updated WebSocket Status:', newStatus);
  }
  
  // Now test different scroll_update message formats
  console.log('📤 Testing scroll_update message formats...');
  
  const testMessages = [
    // Format 1: Basic scroll_update (the one causing the error)
    {
      name: 'basic_scroll_update',
      message: {
        type: 'scroll_update',
        current_message_index: 5,
        current_message_id: 'msg_123'
      }
    },
    // Format 2: scroll_position_update (used by useScrollPositionTracking)
    {
      name: 'scroll_position_update',
      message: {
        type: 'scroll_position_update',
        scroll_position: {
          scrollTop: 100,
          scrollHeight: 500,
          clientHeight: 400,
          scrollPercentage: 20
        }
      }
    },
    // Format 3: Enhanced scroll_update with position data
    {
      name: 'enhanced_scroll_update',
      message: {
        type: 'scroll_update',
        current_message_index: 3,
        current_message_id: 'msg_456',
        scroll_position: {
          scrollTop: 200,
          scrollHeight: 600,
          clientHeight: 400,
          scrollPercentage: 33.33
        }
      }
    }
  ];
  
  for (const test of testMessages) {
    console.log(\`📤 Sending \${test.name} message...\`);
    
    const result = await mcp.puppeteer_evaluate({
      script: \`
        const connections = window.scrollTestData?.wsConnections || [];
        const activeConnection = connections.find(conn => 
          conn.instance && conn.instance.readyState === WebSocket.OPEN
        );
        
        if (activeConnection) {
          const message = \${JSON.stringify(test.message)};
          console.log('Sending message:', message);
          
          try {
            activeConnection.instance.send(JSON.stringify(\${JSON.stringify(test.message)}));
            'Message sent successfully'
          } catch (error) {
            console.error('Error sending message:', error);
            'Error: ' + error.message
          }
        } else {
          'No active WebSocket connection'
        }
      \`
    });
    
    console.log(\`📨 \${test.name} result: \${result}\`);
    
    // Wait a moment for response
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Wait for all responses
  await new Promise(resolve => setTimeout(resolve, 3000));
  await mcp.puppeteer_screenshot({ name: 'after_scroll_tests' });
}

/**
 * Simulate actual scroll events to test real-world usage
 */
async function testRealScrollEvents() {
  console.log('🧪 Testing real scroll events...');
  
  // Create some scrollable content and simulate scrolling
  await mcp.puppeteer_evaluate({
    script: \`
      // Create scrollable content for testing
      const scrollContainer = document.createElement('div');
      scrollContainer.id = 'scroll-test-container';
      scrollContainer.style.cssText = \`
        height: 400px;
        overflow-y: auto;
        border: 2px solid #ccc;
        margin: 20px;
        padding: 10px;
        position: relative;
      \`;
      
      // Add messages to scroll through
      for (let i = 0; i < 50; i++) {
        const message = document.createElement('div');
        message.className = 'test-message';
        message.dataset.messageIndex = i;
        message.dataset.messageId = 'test_msg_' + i;
        message.style.cssText = \`
          padding: 10px;
          margin: 5px 0;
          background: #f0f0f0;
          border-radius: 5px;
        \`;
        message.textContent = \`Test message \${i + 1} - This is a longer message to create scrollable content for testing scroll-based presence functionality.\`;
        scrollContainer.appendChild(message);
      }
      
      document.body.appendChild(scrollContainer);
      
      // Add scroll event listener that sends scroll_update messages
      scrollContainer.addEventListener('scroll', (event) => {
        const container = event.target;
        const messages = container.querySelectorAll('.test-message');
        
        // Find the message currently in the middle of the viewport
        const containerRect = container.getBoundingClientRect();
        const viewportMiddle = containerRect.top + (containerRect.height / 2);
        
        let currentMessageIndex = 0;
        let currentMessageId = 'test_msg_0';
        
        for (let i = 0; i < messages.length; i++) {
          const messageRect = messages[i].getBoundingClientRect();
          if (messageRect.bottom > viewportMiddle) {
            currentMessageIndex = i;
            currentMessageId = messages[i].dataset.messageId;
            break;
          }
        }
        
        // Send scroll update via WebSocket
        const connections = window.scrollTestData?.wsConnections || [];
        const activeConnection = connections.find(conn => 
          conn.instance && conn.instance.readyState === WebSocket.OPEN
        );
        
        if (activeConnection) {
          const scrollMessage = {
            type: 'scroll_update',
            current_message_index: currentMessageIndex,
            current_message_id: currentMessageId
          };
          
          console.log('Sending scroll update from real scroll event:', scrollMessage);
          
          try {
            activeConnection.instance.send(JSON.stringify(scrollMessage));
          } catch (error) {
            console.error('Error sending scroll update:', error);
          }
        }
      });
      
      window.scrollTestContainer = scrollContainer;
      'Scroll test container created'
    \`
  });
  
  await mcp.puppeteer_screenshot({ name: 'scroll_container_created' });
  
  // Simulate scrolling through the content
  for (let scroll = 0; scroll <= 300; scroll += 50) {
    console.log(\`📜 Scrolling to position \${scroll}...\`);
    
    await mcp.puppeteer_evaluate({
      script: \`
        const container = window.scrollTestContainer;
        if (container) {
          container.scrollTop = \${scroll};
          console.log('Scrolled to position:', \${scroll});
        }
      \`
    });
    
    // Wait for scroll event to be processed
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  await mcp.puppeteer_screenshot({ name: 'scroll_simulation_complete' });
}

/**
 * Generate comprehensive report of scroll testing
 */
async function generateScrollTestReport() {
  console.log('📊 Generating scroll test report...');
  
  const report = await mcp.puppeteer_evaluate({
    script: \`
      const testData = window.scrollTestData || {};
      const endTime = Date.now();
      
      const report = {
        testDuration: endTime - (testData.startTime || endTime),
        webSocketConnections: {
          total: testData.wsConnections?.length || 0,
          active: (testData.wsConnections || []).filter(conn => 
            conn.instance && conn.instance.readyState === WebSocket.OPEN
          ).length,
          connections: testData.wsConnections || []
        },
        messagesSent: {
          total: testData.messagesSent?.length || 0,
          scrollMessages: (testData.messagesSent || []).filter(msg => 
            msg.messageType === 'scroll_update' || msg.messageType === 'scroll_position_update'
          ).length,
          messages: testData.messagesSent || []
        },
        messagesReceived: {
          total: testData.messagesReceived?.length || 0,
          scrollResponses: (testData.messagesReceived || []).filter(msg => 
            msg.messageType === 'scroll_update' || msg.messageType === 'user_scroll_position'
          ).length,
          messages: testData.messagesReceived || []
        },
        scrollUpdates: {
          total: testData.scrollUpdates?.length || 0,
          updates: testData.scrollUpdates || []
        },
        errors: {
          total: testData.errors?.length || 0,
          scrollErrors: (testData.errors || []).filter(error => 
            error.errorMessage && (
              error.errorMessage.includes('scroll') ||
              error.errorMessage.includes('Unknown message type')
            )
          ).length,
          allErrors: testData.errors || []
        },
        allEvents: testData.wsEvents || []
      };
      
      console.log('📋 Scroll Test Report Generated:', report);
      report
    \`
  });
  
  console.log('📊 SCROLL TEST REPORT SUMMARY:');
  console.log('================================');
  console.log(\`Test Duration: \${report.testDuration}ms\`);
  console.log(\`WebSocket Connections: \${report.webSocketConnections.total} (Active: \${report.webSocketConnections.active})\`);
  console.log(\`Messages Sent: \${report.messagesSent.total} (Scroll: \${report.messagesSent.scrollMessages})\`);
  console.log(\`Messages Received: \${report.messagesReceived.total} (Scroll: \${report.messagesReceived.scrollResponses})\`);
  console.log(\`Scroll Updates: \${report.scrollUpdates.total}\`);
  console.log(\`Total Errors: \${report.errors.total} (Scroll-related: \${report.errors.scrollErrors})\`);
  
  if (report.errors.scrollErrors > 0) {
    console.log('\\n🚨 Scroll-related Errors:');
    report.errors.allErrors.forEach((error, index) => {
      if (error.errorMessage && (error.errorMessage.includes('scroll') || error.errorMessage.includes('Unknown message type'))) {
        console.log(\`  \${index + 1}. \${error.errorMessage} (at \${new Date(error.timestamp).toLocaleTimeString()})\`);
      }
    });
  }
  
  if (report.messagesSent.scrollMessages > 0) {
    console.log('\\n📤 Scroll Messages Sent:');
    report.messagesSent.messages.forEach((msg, index) => {
      if (msg.messageType === 'scroll_update' || msg.messageType === 'scroll_position_update') {
        console.log(\`  \${index + 1}. \${msg.messageType} - \${JSON.stringify(msg.data)}\`);
      }
    });
  }
  
  if (report.messagesReceived.scrollResponses > 0) {
    console.log('\\n📨 Scroll Responses Received:');
    report.messagesReceived.messages.forEach((msg, index) => {
      if (msg.messageType === 'scroll_update' || msg.messageType === 'user_scroll_position') {
        console.log(\`  \${index + 1}. \${msg.messageType} from user \${msg.userId}\`);
      }
    });
  }
  
  return report;
}

/**
 * Main test runner for scroll-based presence
 */
async function runScrollPresenceTestSuite() {
  console.log('🚀 VectorSpace Scroll Presence Testing Suite');
  console.log('===========================================');
  
  try {
    // Initialize monitoring
    await setupScrollWebSocketMonitoring();
    await mcp.puppeteer_screenshot({ name: 'scroll_test_start' });
    
    // Test 1: Message format testing
    await testScrollUpdateMessages();
    
    // Test 2: Real scroll events
    await testRealScrollEvents();
    
    // Generate comprehensive report
    const report = await generateScrollTestReport();
    
    await mcp.puppeteer_screenshot({ name: 'scroll_test_complete' });
    
    console.log('\\n✅ Scroll presence tests completed!');
    console.log('📸 Screenshots saved showing test progress');
    console.log('📋 Detailed test report generated');
    
    // Specific diagnosis for "Unknown message type: scroll_update"
    if (report.errors.scrollErrors > 0) {
      console.log('\\n🔍 DIAGNOSIS FOR "Unknown message type: scroll_update":');
      console.log('This error suggests that the backend WebSocket handler doesn\\'t recognize the scroll_update message type.');
      console.log('Possible causes:');
      console.log('1. WebSocket connection not established properly');
      console.log('2. Message format mismatch between frontend and backend');
      console.log('3. Backend handler routing issue');
      console.log('4. Authentication or authorization problem');
    } else {
      console.log('\\n✅ No scroll-related errors detected in this test run');
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ Scroll presence test suite failed:', error);
    await mcp.puppeteer_screenshot({ name: 'scroll_test_failure' });
    throw error;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runScrollPresenceTestSuite,
    setupScrollWebSocketMonitoring,
    testScrollUpdateMessages,
    testRealScrollEvents,
    generateScrollTestReport,
    config
  };
}

// Usage:
// await runScrollPresenceTestSuite();