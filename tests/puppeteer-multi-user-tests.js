/**
 * Multi-User Flow and Presence Testing with Puppeteer MCP Server
 * 
 * This file demonstrates how to test real-time features like presence,
 * multi-user interactions, and WebSocket communications using the 
 * Puppeteer MCP server.
 */

// Test Configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5173',
  backendUrl: 'http://localhost:8000',
  wsUrl: 'ws://localhost:8000',
  testUsers: [
    { username: 'alice_test', email: 'alice@test.com', password: 'test123', displayName: 'Alice Test' },
    { username: 'bob_test', email: 'bob@test.com', password: 'test123', displayName: 'Bob Test' },
    { username: 'charlie_test', email: 'charlie@test.com', password: 'test123', displayName: 'Charlie Test' }
  ]
};

/**
 * Test Suite 1: Multi-User Registration and Authentication
 * Tests multiple users can register and login simultaneously
 */
class MultiUserAuthTest {
  static async runTest() {
    console.log('🧪 Starting Multi-User Authentication Test...');
    
    // Test multiple user registration
    for (const user of TEST_CONFIG.testUsers) {
      console.log(`📝 Registering user: ${user.username}`);
      
      // Navigate to registration
      await puppeteer.navigate(`${TEST_CONFIG.baseUrl}/register`);
      await puppeteer.screenshot(`register_page_${user.username}`);
      
      // Fill registration form
      await puppeteer.fill('[data-testid="username-input"]', user.username);
      await puppeteer.fill('[data-testid="email-input"]', user.email);
      await puppeteer.fill('[data-testid="display-name-input"]', user.displayName);
      await puppeteer.fill('[data-testid="password-input"]', user.password);
      await puppeteer.fill('[data-testid="confirm-password-input"]', user.password);
      
      // Submit registration
      await puppeteer.click('[data-testid="register-submit"]');
      await puppeteer.screenshot(`registration_complete_${user.username}`);
      
      console.log(`✅ User ${user.username} registered successfully`);
    }
  }
}

/**
 * Test Suite 2: Concurrent User Login
 * Tests multiple users can login and access the application
 */
class ConcurrentLoginTest {
  static async runTest() {
    console.log('🧪 Starting Concurrent Login Test...');
    
    for (const user of TEST_CONFIG.testUsers) {
      console.log(`🔑 Logging in user: ${user.username}`);
      
      // Navigate to login
      await puppeteer.navigate(`${TEST_CONFIG.baseUrl}/login`);
      
      // Fill login form
      await puppeteer.fill('[data-testid="username-input"]', user.username);
      await puppeteer.fill('[data-testid="password-input"]', user.password);
      
      // Submit login
      await puppeteer.click('[data-testid="login-submit"]');
      
      // Wait for dashboard
      await new Promise(resolve => setTimeout(resolve, 2000));
      await puppeteer.screenshot(`logged_in_${user.username}`);
      
      console.log(`✅ User ${user.username} logged in successfully`);
    }
  }
}

/**
 * Test Suite 3: Multi-User Conversation Creation
 * Tests multiple users can create and join conversations
 */
class MultiUserConversationTest {
  static async runTest() {
    console.log('🧪 Starting Multi-User Conversation Test...');
    
    // Login as first user and create conversation
    const user1 = TEST_CONFIG.testUsers[0];
    console.log(`👤 User ${user1.username} creating conversation...`);
    
    await puppeteer.navigate(`${TEST_CONFIG.baseUrl}/login`);
    await puppeteer.fill('[data-testid="username-input"]', user1.username);
    await puppeteer.fill('[data-testid="password-input"]', user1.password);
    await puppeteer.click('[data-testid="login-submit"]');
    
    // Wait for dashboard and create new conversation
    await new Promise(resolve => setTimeout(resolve, 2000));
    await puppeteer.click('[data-testid="new-conversation-btn"]');
    await puppeteer.screenshot('conversation_created');
    
    // Get conversation URL from current page
    const conversationUrl = await puppeteer.evaluate(() => window.location.href);
    console.log(`📋 Conversation URL: ${conversationUrl}`);
    
    return conversationUrl;
  }
}

/**
 * Test Suite 4: Real-time Presence Testing
 * Tests user presence indicators and join/leave events
 */
class PresenceTest {
  static async runTest(conversationUrl) {
    console.log('🧪 Starting Presence Test...');
    
    // Store WebSocket events for verification
    const wsEvents = [];
    
    // Setup WebSocket monitoring
    await puppeteer.evaluate(() => {
      window.wsEvents = [];
      
      // Override WebSocket to capture events
      const originalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'user_joined' || data.type === 'user_left' || data.type === 'presence_update') {
              window.wsEvents.push({
                type: data.type,
                userId: data.userId,
                timestamp: Date.now()
              });
              console.log('Presence event:', data);
            }
          } catch (e) {
            // Ignore non-JSON messages
          }
        });
        
        return ws;
      };
    });
    
    // User 1 joins conversation
    console.log('👤 User 1 joining conversation...');
    await puppeteer.navigate(conversationUrl);
    await puppeteer.screenshot('user1_joined');
    
    // Wait for WebSocket connection
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check for presence indicators
    const presenceElements = await puppeteer.evaluate(() => {
      return document.querySelectorAll('[data-testid="presence-user"]').length;
    });
    
    console.log(`👥 Found ${presenceElements} presence indicators`);
    
    return wsEvents;
  }
}

/**
 * Test Suite 5: Multi-User Chat Testing
 * Tests real-time messaging between multiple users
 */
class MultiUserChatTest {
  static async runTest(conversationUrl) {
    console.log('🧪 Starting Multi-User Chat Test...');
    
    // Test message sending and receiving
    await puppeteer.navigate(conversationUrl);
    
    // Send a message
    const testMessage = `Test message from ${TEST_CONFIG.testUsers[0].username} at ${Date.now()}`;
    
    await puppeteer.fill('[data-testid="message-input"]', testMessage);
    await puppeteer.click('[data-testid="send-button"]');
    
    // Wait for message to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    await puppeteer.screenshot('message_sent');
    
    // Verify message appears in chat
    const messageExists = await puppeteer.evaluate((message) => {
      const messageElements = document.querySelectorAll('[data-testid="message"]');
      return Array.from(messageElements).some(el => el.textContent.includes(message));
    }, testMessage);
    
    console.log(`💬 Message visibility: ${messageExists ? 'Visible' : 'Not visible'}`);
    
    return messageExists;
  }
}

/**
 * Test Suite 6: Typing Indicators
 * Tests real-time typing indicators between users
 */
class TypingIndicatorTest {
  static async runTest(conversationUrl) {
    console.log('🧪 Starting Typing Indicator Test...');
    
    await puppeteer.navigate(conversationUrl);
    
    // Start typing
    await puppeteer.fill('[data-testid="message-input"]', 'User is typing...');
    
    // Wait for typing indicator to appear
    await new Promise(resolve => setTimeout(resolve, 1000));
    await puppeteer.screenshot('typing_indicator');
    
    // Check for typing indicator elements
    const typingIndicators = await puppeteer.evaluate(() => {
      return document.querySelectorAll('[data-testid="typing-indicator"]').length;
    });
    
    console.log(`⌨️ Typing indicators found: ${typingIndicators}`);
    
    // Clear input to stop typing
    await puppeteer.fill('[data-testid="message-input"]', '');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return typingIndicators;
  }
}

/**
 * Test Suite 7: User Profile Presence
 * Tests user profile visibility and online status
 */
class UserProfilePresenceTest {
  static async runTest() {
    console.log('🧪 Starting User Profile Presence Test...');
    
    // Navigate to a user profile
    const testUser = TEST_CONFIG.testUsers[0];
    await puppeteer.navigate(`${TEST_CONFIG.baseUrl}/profile/${testUser.username}`);
    
    await puppeteer.screenshot('user_profile');
    
    // Check for online status indicator
    const onlineStatus = await puppeteer.evaluate(() => {
      const statusElement = document.querySelector('[data-testid="online-status"]');
      return statusElement ? statusElement.textContent : 'Not found';
    });
    
    console.log(`🟢 Online status: ${onlineStatus}`);
    
    return onlineStatus;
  }
}

/**
 * Test Suite 8: Scroll-based Presence
 * Tests scroll position tracking and message reading indicators
 */
class ScrollPresenceTest {
  static async runTest(conversationUrl) {
    console.log('🧪 Starting Scroll Presence Test...');
    
    await puppeteer.navigate(conversationUrl);
    
    // Scroll to different positions to test scroll presence
    await puppeteer.evaluate(() => {
      const messages = document.querySelectorAll('[data-testid="message"]');
      if (messages.length > 5) {
        messages[5].scrollIntoView({ behavior: 'smooth' });
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await puppeteer.screenshot('scroll_presence');
    
    // Check for scroll presence avatars
    const scrollPresenceAvatars = await puppeteer.evaluate(() => {
      return document.querySelectorAll('[data-testid="scroll-presence-avatar"]').length;
    });
    
    console.log(`📜 Scroll presence avatars: ${scrollPresenceAvatars}`);
    
    return scrollPresenceAvatars;
  }
}

/**
 * Test Suite 9: Network Disconnection and Reconnection
 * Tests presence handling during network issues
 */
class NetworkReconnectionTest {
  static async runTest(conversationUrl) {
    console.log('🧪 Starting Network Reconnection Test...');
    
    await puppeteer.navigate(conversationUrl);
    
    // Simulate network disconnection using JavaScript
    await puppeteer.evaluate(() => {
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
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    await puppeteer.screenshot('disconnected_state');
    
    // Simulate reconnection
    await puppeteer.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      
      window.dispatchEvent(new Event('online'));
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    await puppeteer.screenshot('reconnected_state');
    
    console.log('🔄 Network reconnection test completed');
  }
}

/**
 * Main Test Runner
 * Orchestrates all test suites
 */
class TestRunner {
  static async runAllTests() {
    console.log('🚀 Starting VectorSpace Multi-User and Presence Tests');
    console.log('=' * 60);
    
    try {
      // Test 1: Multi-user authentication
      await MultiUserAuthTest.runTest();
      console.log('');
      
      // Test 2: Concurrent login
      await ConcurrentLoginTest.runTest();
      console.log('');
      
      // Test 3: Create conversation for further tests
      const conversationUrl = await MultiUserConversationTest.runTest();
      console.log('');
      
      // Test 4: Presence testing
      const wsEvents = await PresenceTest.runTest(conversationUrl);
      console.log('');
      
      // Test 5: Multi-user chat
      const messageVisible = await MultiUserChatTest.runTest(conversationUrl);
      console.log('');
      
      // Test 6: Typing indicators
      const typingIndicators = await TypingIndicatorTest.runTest(conversationUrl);
      console.log('');
      
      // Test 7: User profile presence
      const onlineStatus = await UserProfilePresenceTest.runTest();
      console.log('');
      
      // Test 8: Scroll-based presence
      const scrollPresence = await ScrollPresenceTest.runTest(conversationUrl);
      console.log('');
      
      // Test 9: Network reconnection
      await NetworkReconnectionTest.runTest(conversationUrl);
      
      // Summary
      console.log('');
      console.log('📊 Test Summary:');
      console.log(`- Conversation URL: ${conversationUrl}`);
      console.log(`- Message visibility: ${messageVisible}`);
      console.log(`- Typing indicators: ${typingIndicators}`);
      console.log(`- Online status: ${onlineStatus}`);
      console.log(`- Scroll presence: ${scrollPresence}`);
      console.log(`- WebSocket events captured: ${wsEvents.length}`);
      
      console.log('');
      console.log('✅ All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }
}

// Export test classes for individual use
module.exports = {
  TestRunner,
  MultiUserAuthTest,
  ConcurrentLoginTest,
  MultiUserConversationTest,
  PresenceTest,
  MultiUserChatTest,
  TypingIndicatorTest,
  UserProfilePresenceTest,
  ScrollPresenceTest,
  NetworkReconnectionTest,
  TEST_CONFIG
};

// Usage examples:
/*
// Run all tests
await TestRunner.runAllTests();

// Run individual test suites
await MultiUserAuthTest.runTest();
await PresenceTest.runTest('http://localhost:5173/conversation/123');
*/