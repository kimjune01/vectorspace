import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { spawn } from 'child_process';

// Global state for managing backend server
let backendServer = null;
let frontendServer = null;

/**
 * Setup test environment before all scenarios
 */
BeforeAll(async function() {
  console.log('🚀 Setting up VectorSpace test environment...');
  
  // Check if servers are already running
  try {
    const backendCheck = await fetch('http://localhost:8000/health');
    const frontendCheck = await fetch('http://localhost:5173');
    
    if (backendCheck.ok && frontendCheck.ok) {
      console.log('✅ Servers already running, skipping startup');
      return;
    }
  } catch (error) {
    console.log('⚠️ Servers not running, but we should not start them in hooks');
    console.log('ℹ️ Please ensure backend and frontend servers are running manually');
  }
  
  console.log('✅ Test environment ready');
});

/**
 * Cleanup after all scenarios
 */
AfterAll(async function() {
  console.log('🧹 Cleaning up test environment...');
  
  // Only kill servers if we started them
  if (backendServer) {
    backendServer.kill('SIGTERM');
    console.log('📡 Backend server stopped');
  }
  
  if (frontendServer) {
    frontendServer.kill('SIGTERM');
    console.log('🌐 Frontend server stopped');
  }
  
  console.log('✅ Cleanup complete');
});

/**
 * Setup before each scenario
 */
Before(async function() {
  // Reset test state
  this.debugLog = [];
  this.apiLog = [];
  
  // Create fresh test database state (if needed)
  try {
    await this.api.post('/api/admin/reset-test-data');
  } catch (error) {
    // Continue if admin endpoint doesn't exist
    console.log('⚠️  Admin reset endpoint not available');
  }
});

/**
 * Cleanup after each scenario
 */
After(async function(scenario) {
  // Take screenshot on failure
  if (scenario.result.status === 'FAILED') {
    console.log(`❌ Scenario failed: ${scenario.pickle.name}`);
    
    // Take screenshots from all open pages
    for (const [userId, page] of this.pages) {
      try {
        await this.takeScreenshot(userId, `failed_${scenario.pickle.name.replace(/\s+/g, '_')}`);
      } catch (error) {
        console.log(`Failed to take screenshot for ${userId}: ${error.message}`);
      }
    }
  } else {
    console.log(`✅ Scenario passed: ${scenario.pickle.name}`);
  }
  
  // Cleanup resources
  await this.cleanup();
});

/**
 * Tagged hooks for specific scenarios
 */

// Skip scenarios marked with @skip
Before({ tags: '@skip' }, function() {
  return 'skipped';
});

// Setup for presence testing scenarios
Before({ tags: '@presence' }, async function() {
  console.log('🔄 Setting up presence testing environment...');
  // Additional setup for presence tests can go here
});

// Setup for WebSocket scenarios
Before({ tags: '@websocket' }, async function() {
  console.log('🔌 Setting up WebSocket testing environment...');
  // WebSocket specific setup can go here
});

export { Before, After, BeforeAll, AfterAll };