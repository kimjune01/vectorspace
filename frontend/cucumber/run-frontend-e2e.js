#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Frontend E2E Test Runner
 * Runs real browser-based integration tests using Puppeteer
 */

const testMode = process.argv[2] || 'critical';
const isHeaded = process.argv.includes('--headed');

// Test configurations by priority
const testConfigs = {
  critical: {
    features: ['features/frontend_e2e.feature'],
    tags: '@e2e and @critical',
    description: 'Critical user flows (auth, conversations, search)'
  },
  high: {
    features: ['features/frontend_e2e.feature'],
    tags: '@e2e and (@critical or @high)',
    description: 'Critical and high priority flows (includes presence, messaging)'
  },
  medium: {
    features: ['features/frontend_e2e.feature'],
    tags: '@e2e and (@critical or @high or @medium)',
    description: 'Critical, high, and medium priority flows'
  },
  all: {
    features: ['features/frontend_e2e.feature'],
    tags: '@e2e',
    description: 'All frontend E2E tests'
  }
};

async function checkServers() {
  console.log('🔍 Checking if servers are running...');
  
  try {
    // Check backend
    const backendResponse = await fetch('http://localhost:8000/health');
    if (!backendResponse.ok) {
      throw new Error('Backend health check failed');
    }
    
    // Check frontend
    const frontendResponse = await fetch('http://localhost:5173');
    if (!frontendResponse.ok) {
      throw new Error('Frontend health check failed');
    }
    
    console.log('✅ Both backend and frontend servers are running');
    return true;
  } catch (error) {
    console.error('❌ Server check failed:', error.message);
    console.log('');
    console.log('Please ensure both servers are running:');
    console.log('Backend:  cd backend/backend && uv run python main.py');
    console.log('Frontend: cd frontend && pnpm run dev');
    return false;
  }
}

async function runFrontendE2ETests() {
  const config = testConfigs[testMode];
  
  if (!config) {
    console.error(`❌ Unknown test mode: ${testMode}`);
    console.log('Available modes:', Object.keys(testConfigs).join(', '));
    process.exit(1);
  }
  
  console.log('🧪 Frontend E2E Test Runner');
  console.log(`📋 Mode: ${testMode} - ${config.description}`);
  console.log(`🎭 Browser: ${isHeaded ? 'Headed (visible)' : 'Headless'}`);
  console.log('');
  
  // Check servers first
  const serversReady = await checkServers();
  if (!serversReady) {
    process.exit(1);
  }
  
  // Set up environment
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    FRONTEND_E2E_MODE: testMode,
    FRONTEND_E2E_HEADED: isHeaded ? 'true' : 'false',
    VITE_AUTO_LOGIN: 'true' // Enable auto-login for easier testing
  };
  
  // Cucumber command
  const cucumberBin = join(__dirname, '..', 'node_modules', '.bin', 'cucumber-js');
  const cucumberArgs = [
    '--require', 'cucumber/world/TestWorld.js',
    '--require', 'cucumber/support/hooks.js',
    '--require', 'cucumber/step_definitions/frontend_e2e_steps.js',
    '--require', 'cucumber/step_definitions/frontend_presence_steps.js',
    '--format', '@cucumber/pretty-formatter',
    '--tags', config.tags,
    '--parallel', '1', // Run sequentially for browser tests
    ...config.features
  ];
  
  console.log('🚀 Starting frontend E2E tests...');
  console.log(`Command: cucumber-js ${cucumberArgs.join(' ')}`);
  console.log('');
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const cucumber = spawn(cucumberBin, cucumberArgs, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit'
    });
    
    cucumber.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log('');
      if (code === 0) {
        console.log(`✅ Frontend E2E tests completed successfully in ${duration}s`);
        console.log('📊 All critical user flows are working correctly!');
      } else {
        console.log(`❌ Frontend E2E tests failed with exit code ${code} after ${duration}s`);
        console.log('🔍 Check the output above for specific failures');
      }
      
      resolve(code);
    });
    
    cucumber.on('error', (error) => {
      console.error('💥 Failed to start frontend E2E tests:', error);
      reject(error);
    });
  });
}

// Handle CLI usage
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Frontend E2E Test Runner');
  console.log('');
  console.log('Usage: node run-frontend-e2e.js [mode] [options]');
  console.log('');
  console.log('Modes:');
  Object.entries(testConfigs).forEach(([mode, config]) => {
    console.log(`  ${mode.padEnd(8)} - ${config.description}`);
  });
  console.log('');
  console.log('Options:');
  console.log('  --headed    Run with visible browser (default: headless)');
  console.log('  --help, -h  Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node run-frontend-e2e.js critical           # Run critical tests headless');
  console.log('  node run-frontend-e2e.js high --headed      # Run high priority tests with visible browser');
  console.log('  node run-frontend-e2e.js all                # Run all frontend E2E tests');
  process.exit(0);
}

// Run the tests
runFrontendE2ETests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });