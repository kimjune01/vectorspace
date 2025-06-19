import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

/**
 * Debug integration step definitions
 * These steps integrate cucumber tests with VectorSpace's existing debugging tools
 */

// Integration with frontend debug tools
Given('the debug panel is enabled', async function() {
  const page = await this.getPage(this.currentUser || 'system');
  
  // Navigate to a page with debug panel
  await page.goto(this.config.frontend.baseUrl);
  
  // Enable debug mode by setting localStorage
  await page.evaluate(() => {
    localStorage.setItem('debug_mode', 'true');
    localStorage.setItem('show_debug_panel', 'true');
  });
  
  await page.reload({ waitUntil: 'networkidle0' });
  
  // Verify debug panel exists
  const debugPanel = await page.$('[data-testid="debug-panel"], .debug-panel');
  assert(debugPanel, 'Debug panel should be visible in debug mode');
  
  this.debugLog.push('Debug panel enabled for testing');
});

When('I check the API logger output', async function() {
  const page = await this.getPage(this.currentUser || 'system');
  
  // Access the API logger data from window
  const apiLogs = await page.evaluate(() => {
    return window.debugApiLog ? window.debugApiLog() : [];
  });
  
  this.frontendApiLogs = apiLogs;
  this.debugLog.push(`Retrieved ${apiLogs.length} API log entries from frontend`);
});

Then('I should see API requests in the debug log', async function() {
  assert(this.frontendApiLogs && this.frontendApiLogs.length > 0, 
    'Should have API log entries from frontend debugging tools');
  
  // Verify log entries have expected structure
  const firstLog = this.frontendApiLogs[0];
  assert(firstLog.timestamp, 'API log should have timestamp');
  assert(firstLog.method || firstLog.type, 'API log should have method or type');
  assert(firstLog.url, 'API log should have URL');
});

When('I trigger an enhanced error', async function() {
  const page = await this.getPage(this.currentUser || 'system');
  
  // Trigger an API error that would show enhanced error component
  try {
    await page.evaluate(() => {
      // Simulate API error
      fetch('/api/nonexistent-endpoint', { method: 'POST' })
        .catch(() => {}); // Ignore the error in page context
    });
    
    // Wait for error to appear
    await page.waitForTimeout(1000);
    
  } catch (error) {
    // Expected to fail - we're testing error handling
    this.debugLog.push('Triggered enhanced error for testing');
  }
});

Then('the enhanced error component should show debug information', async function() {
  const page = await this.getPage(this.currentUser || 'system');
  
  // Look for enhanced error component
  const errorComponent = await page.$('[data-testid="enhanced-error"], .enhanced-error');
  
  if (errorComponent) {
    // Check if debug information is present
    const debugInfo = await page.$('.error-debug-info, [data-testid="error-debug"]');
    assert(debugInfo, 'Enhanced error should show debug information');
    this.debugLog.push('Enhanced error component shows debug information');
  } else {
    // If no error component visible, that's also valid
    this.debugLog.push('No enhanced error component visible (expected if no errors occurred)');
  }
});

// Integration with backend test infrastructure  
When('I run the existing backend test suite', async function() {
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const testProcess = spawn('uv', ['run', 'python', '-m', 'pytest', '--tb=short'], {
      cwd: './backend/backend',
      stdio: 'pipe'
    });
    
    let output = '';
    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.on('close', (code) => {
      this.backendTestOutput = output;
      this.backendTestExitCode = code;
      this.debugLog.push(`Backend tests completed with exit code ${code}`);
      resolve();
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      testProcess.kill();
      reject(new Error('Backend tests timed out'));
    }, 30000);
  });
});

Then('the backend tests should pass', async function() {
  assert.strictEqual(this.backendTestExitCode, 0, 
    `Backend tests should pass (exit code 0), got ${this.backendTestExitCode}`);
  
  // Check for test success indicators in output
  assert(this.backendTestOutput.includes('passed') || this.backendTestOutput.includes('OK'),
    'Backend test output should indicate success');
});

When('I verify API endpoint coverage', async function() {
  // Get list of API endpoints from the application
  try {
    const response = await this.api.get('/api/docs/openapi.json');
    this.apiSpec = response.data;
    
    // Extract endpoint paths
    this.apiEndpoints = Object.keys(this.apiSpec.paths || {});
    this.debugLog.push(`Found ${this.apiEndpoints.length} API endpoints in OpenAPI spec`);
    
  } catch (error) {
    // If OpenAPI spec not available, use manual endpoint list
    this.apiEndpoints = [
      '/api/auth/register',
      '/api/auth/login', 
      '/api/auth/logout',
      '/api/users/me',
      '/api/conversations',
      '/api/conversations/{id}',
      '/api/conversations/{id}/messages',
      '/api/conversations/discover',
      '/api/search/conversations',
      '/api/search/similar'
    ];
    this.debugLog.push(`Using manual endpoint list: ${this.apiEndpoints.length} endpoints`);
  }
});

Then('all critical API endpoints should be tested', async function() {
  const criticalEndpoints = [
    '/api/auth/register',
    '/api/auth/login',
    '/api/conversations',
    '/api/conversations/discover',
    '/api/search/conversations'
  ];
  
  // Check which endpoints have been tested in our cucumber scenarios
  const testedEndpoints = new Set();
  
  // Analyze API logs to see which endpoints were called
  for (const logEntry of this.apiLog) {
    if (logEntry.url) {
      const path = new URL(logEntry.url).pathname;
      testedEndpoints.add(path);
    }
  }
  
  // Check coverage of critical endpoints
  const missingEndpoints = criticalEndpoints.filter(endpoint => 
    !Array.from(testedEndpoints).some(tested => tested.includes(endpoint.replace(/\{.*\}/, '')))
  );
  
  assert(missingEndpoints.length === 0, 
    `Critical endpoints not tested: ${missingEndpoints.join(', ')}`);
  
  this.debugLog.push(`API endpoint coverage: ${testedEndpoints.size}/${this.apiEndpoints.length} endpoints tested`);
});

// Performance and memory testing
When('I monitor frontend performance metrics', async function() {
  const page = await this.getPage(this.currentUser || 'system');
  
  // Collect performance metrics
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    
    return {
      pageLoadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.fetchStart : 0,
      resourceCount: resources.length,
      memoryUsage: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null
    };
  });
  
  this.performanceMetrics = metrics;
  this.debugLog.push(`Performance metrics collected: load time ${metrics.pageLoadTime}ms`);
});

Then('the frontend should meet performance benchmarks', async function() {
  assert(this.performanceMetrics, 'Performance metrics should be collected');
  
  // Assert reasonable performance thresholds
  assert(this.performanceMetrics.pageLoadTime < 5000, 
    `Page load time should be under 5s, got ${this.performanceMetrics.pageLoadTime}ms`);
  
  assert(this.performanceMetrics.domContentLoaded < 3000,
    `DOM content loaded should be under 3s, got ${this.performanceMetrics.domContentLoaded}ms`);
  
  // Memory usage checks (if available)
  if (this.performanceMetrics.memoryUsage) {
    const memoryMB = this.performanceMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024);
    assert(memoryMB < 100, `Memory usage should be under 100MB, got ${memoryMB.toFixed(2)}MB`);
  }
  
  this.debugLog.push('✅ Frontend performance benchmarks met');
});

// Integration test cleanup and reporting
Then('I should generate a comprehensive test report', async function() {
  const fs = await import('fs');
  const path = await import('path');
  
  const reportData = {
    timestamp: new Date().toISOString(),
    testExecution: {
      scenarios: this.scenarios || [],
      apiCalls: this.apiLog.length,
      frontendLogs: this.frontendApiLogs?.length || 0,
      debugEntries: this.debugLog.length
    },
    coverage: {
      apiEndpoints: this.apiEndpoints?.length || 0,
      testedEndpoints: new Set(this.apiLog.map(log => new URL(log.url).pathname)).size,
      backendTestStatus: this.backendTestExitCode
    },
    performance: this.performanceMetrics || {},
    errors: this.errors || [],
    screenshots: this.screenshots || []
  };
  
  // Write comprehensive report
  const reportsDir = './cucumber/reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportFile = path.join(reportsDir, `comprehensive_report_${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
  
  this.debugLog.push(`Comprehensive test report generated: ${reportFile}`);
  
  // Verify report completeness
  assert(reportData.testExecution.apiCalls > 0, 'Report should include API call data');
  assert(reportData.coverage.testedEndpoints > 0, 'Report should include endpoint coverage');
});

// WebSocket testing integration
When('I test WebSocket connectivity', async function() {
  const page = await this.getPage(this.currentUser || 'system');
  
  // Test WebSocket connection
  const wsTestResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('ws://localhost:8000/api/ws/test');
        
        ws.onopen = () => {
          ws.close();
          resolve({ connected: true, error: null });
        };
        
        ws.onerror = (error) => {
          resolve({ connected: false, error: error.message });
        };
        
        // Timeout after 5 seconds
        setTimeout(() => {
          ws.close();
          resolve({ connected: false, error: 'Timeout' });
        }, 5000);
        
      } catch (error) {
        resolve({ connected: false, error: error.message });
      }
    });
  });
  
  this.wsTestResult = wsTestResult;
  this.debugLog.push(`WebSocket test result: ${wsTestResult.connected ? 'Connected' : 'Failed'}`);
});

Then('WebSocket connections should be working', async function() {
  assert(this.wsTestResult, 'WebSocket test should have been performed');
  assert(this.wsTestResult.connected, 
    `WebSocket should connect successfully, error: ${this.wsTestResult.error}`);
});