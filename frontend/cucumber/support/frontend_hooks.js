import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';

/**
 * Frontend E2E Test Hooks
 * Specialized hooks for browser-based integration tests
 */

// Global state for frontend E2E tests
let testRunId = null;

BeforeAll(async function() {
  console.log('🌐 Setting up Frontend E2E test environment...');
  
  // Generate unique test run ID
  testRunId = `e2e_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Check if servers are running
  try {
    const backendCheck = await fetch('http://localhost:8000/health');
    const frontendCheck = await fetch('http://localhost:5173');
    
    if (!backendCheck.ok || !frontendCheck.ok) {
      throw new Error('Servers not accessible');
    }
    
    console.log('✅ Backend and frontend servers are accessible');
  } catch (error) {
    console.error('❌ Server check failed:', error.message);
    console.log('');
    console.log('Please ensure both servers are running:');
    console.log('Backend:  cd backend/backend && uv run python main.py');
    console.log('Frontend: cd frontend && pnpm run dev');
    throw error;
  }
  
  console.log(`📋 Test Run ID: ${testRunId}`);
  console.log('✅ Frontend E2E environment ready');
});

AfterAll(async function() {
  console.log('🧹 Cleaning up Frontend E2E test environment...');
  
  // Global cleanup would go here (e.g., test data cleanup)
  console.log('✅ Frontend E2E cleanup complete');
});

Before({ tags: '@e2e' }, async function() {
  // Setup for browser-based tests
  this.testRunId = testRunId;
  this.debugLog = [];
  this.apiLog = [];
  
  // Initialize test state for frontend tests
  this.testUsers = new Map();
  this.testConversations = new Map();
  this.currentConversationUrl = null;
  this.currentSearchTerm = null;
  this.conversationTopic = null;
  this.messageCount = 0;
  
  // Frontend-specific state
  this.currentConversationTitle = null;
  this.lastSentMessage = null;
});

After({ tags: '@e2e' }, async function(scenario) {
  // Take screenshots on failure for frontend tests
  if (scenario.result.status === 'FAILED') {
    console.log(`❌ Frontend E2E scenario failed: ${scenario.pickle.name}`);
    
    // Take screenshots from all open browser pages
    for (const [userId, page] of this.pages) {
      try {
        const filename = `./cucumber/reports/frontend_failed_${scenario.pickle.name.replace(/\\s+/g, '_')}_${userId}_${Date.now()}.png`;
        await page.screenshot({ 
          path: filename,
          fullPage: true 
        });
        console.log(`📸 Screenshot saved: ${filename}`);
      } catch (error) {
        console.log(`Failed to take screenshot for ${userId}: ${error.message}`);
      }
    }
    
    // Log any console errors from the browser
    for (const [userId, page] of this.pages) {
      try {
        const consoleLogs = await page.evaluate(() => {
          return window.__testConsoleLogs || [];
        });
        
        if (consoleLogs.length > 0) {
          console.log(`🔍 Console logs for ${userId}:`, consoleLogs);
        }
      } catch (error) {
        // Page might be closed
      }
    }
  } else {
    console.log(`✅ Frontend E2E scenario passed: ${scenario.pickle.name}`);
  }
  
  // Cleanup browser instances
  await this.cleanup();
});

// Tagged hooks for specific frontend test types

Before({ tags: '@e2e and @critical' }, async function() {
  console.log('🔥 Running critical frontend E2E test...');
  this.testPriority = 'critical';
});

Before({ tags: '@e2e and @auth' }, async function() {
  console.log('🔐 Setting up authentication test environment...');
  // Could pre-clear any existing auth state
});

Before({ tags: '@e2e and @realtime-presence' }, async function() {
  console.log('👥 Setting up real-time presence test environment...');
  // Could set up WebSocket monitoring
});

Before({ tags: '@e2e and @conversation' }, async function() {
  console.log('💬 Setting up conversation test environment...');
  // Could seed test conversations if needed
});

Before({ tags: '@e2e and @search' }, async function() {
  console.log('🔍 Setting up search test environment...');
  // Could seed searchable conversations if needed
});

Before({ tags: '@e2e and @responsive' }, async function() {
  console.log('📱 Setting up responsive/mobile test environment...');
  // Configure mobile viewport for responsive tests
  if (this.pages.size > 0) {
    for (const [userId, page] of this.pages) {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE size
    }
  }
});

// Performance monitoring for frontend tests
Before({ tags: '@e2e and @performance' }, async function() {
  console.log('⚡ Setting up performance monitoring...');
  this.performanceMetrics = {
    startTime: Date.now(),
    loadTimes: {},
    interactionTimes: {}
  };
});

After({ tags: '@e2e and @performance' }, async function() {
  if (this.performanceMetrics) {
    const totalDuration = Date.now() - this.performanceMetrics.startTime;
    console.log(`⚡ Frontend E2E performance: ${totalDuration}ms total`);
    
    if (this.performanceMetrics.loadTimes) {
      Object.entries(this.performanceMetrics.loadTimes).forEach(([page, time]) => {
        console.log(`  📄 ${page}: ${time}ms`);
      });
    }
  }
});

export { Before, After, BeforeAll, AfterAll };