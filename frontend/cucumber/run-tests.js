#!/usr/bin/env node

/**
 * Cucumber test runner with VectorSpace debugging integration
 * This script provides various test execution modes and integrates with existing debugging tools
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Test execution modes
const MODES = {
  all: 'Run all cucumber tests',
  auth: 'Run authentication tests only',
  conversation: 'Run conversation discovery tests only', 
  search: 'Run search functionality tests only',
  profile: 'Run user profile tests only',
  presence: 'Run presence and discovery tests only',
  integration: 'Run round-trip integration tests',
  smoke: 'Run smoke tests (quick validation)',
  debug: 'Run tests with enhanced debugging'
};

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'smoke';
const headless = !args.includes('--headed');
const parallel = args.includes('--parallel') ? 2 : 1;
const tags = args.find(arg => arg.startsWith('--tags='))?.split('=')[1] || '';

// Validate mode
if (!MODES[mode] && mode !== '--help' && mode !== '-h') {
  console.error(`❌ Unknown mode: ${mode}`);
  console.log('Available modes:', Object.keys(MODES).join(', '));
  process.exit(1);
}

// Show help
if (mode === '--help' || mode === '-h') {
  console.log('🥒 VectorSpace Cucumber Test Runner\n');
  console.log('Usage: node cucumber/run-tests.js [mode] [options]\n');
  console.log('Modes:');
  for (const [key, description] of Object.entries(MODES)) {
    console.log(`  ${key.padEnd(12)} ${description}`);
  }
  console.log('\nOptions:');
  console.log('  --headed         Run browser tests in headed mode (visible)');
  console.log('  --parallel       Run tests in parallel (2 workers)');
  console.log('  --tags=@tag      Run only tests with specific tags');
  console.log('\nExamples:');
  console.log('  node cucumber/run-tests.js auth --headed');
  console.log('  node cucumber/run-tests.js all --parallel');
  console.log('  node cucumber/run-tests.js smoke --tags=@quick');
  process.exit(0);
}

// Configuration based on mode
const getTestConfig = (mode) => {
  const baseConfig = {
    features: ['./features/*.feature'],
    require: [
      './cucumber/step_definitions/**/*.js',
      './cucumber/support/**/*.js',
      './cucumber/world/TestWorld.js'
    ],
    formatters: [
      ['@cucumber/pretty-formatter'],
      ['json:./cucumber/reports/cucumber_report.json'],
      ['html:./cucumber/reports/cucumber_report.html']
    ],
    parallel: parallel,
    retry: 1,
    timeout: 60000
  };

  const modeConfigs = {
    auth: {
      ...baseConfig,
      features: ['./features/auth.feature'],
      tags: tags || '@auth or @authentication'
    },
    conversation: {
      ...baseConfig,
      features: ['./features/conversation_discovery.feature'], 
      tags: tags || '@conversation or @discovery'
    },
    search: {
      ...baseConfig,
      features: ['./features/search.feature'],
      tags: tags || '@search or @semantic'
    },
    profile: {
      ...baseConfig,
      features: ['./features/user_profile.feature'],
      tags: tags || '@profile or @user'
    },
    presence: {
      ...baseConfig,
      features: ['./features/enhanced_discovery_and_presence.feature'],
      tags: tags || '@presence or @websocket'
    },
    integration: {
      ...baseConfig,
      features: ['./features/round_trip_integration.feature'],
      tags: tags || '@integration or @round-trip',
      parallel: 1, // Run integration tests sequentially
      timeout: 120000 // Longer timeout for complex workflows
    },
    smoke: {
      ...baseConfig,
      features: ['./features/auth.feature', './features/conversation_discovery.feature'],
      tags: tags || '@smoke or not @slow'
    },
    debug: {
      ...baseConfig,
      parallel: 1, // No parallel for debugging
      tags: tags || 'not @skip',
      retry: 0 // No retries in debug mode
    },
    all: {
      ...baseConfig,
      tags: tags || 'not @skip'
    }
  };

  return modeConfigs[mode] || modeConfigs.smoke;
};

// Setup test environment
const setupEnvironment = () => {
  console.log('🔧 Setting up test environment...');
  
  // Create reports directory
  const reportsDir = './cucumber/reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.HEADLESS = headless.toString();
  process.env.CUCUMBER_PARALLEL = parallel.toString();
  
  // Enable auto-login for cucumber testing
  process.env.VITE_AUTO_LOGIN = 'true';
  
  if (mode === 'debug') {
    process.env.DEBUG = 'true';
    process.env.CUCUMBER_DEBUG = 'true';
  }
  
  console.log(`✅ Environment: ${mode} mode, headless: ${headless}, parallel: ${parallel}`);
};

// Check if servers are running
const checkServers = async () => {
  console.log('🔍 Checking if servers are running...');
  
  try {
    // Check backend (correct endpoint)
    const backendCheck = await fetch('http://localhost:8000/health');
    if (!backendCheck.ok) throw new Error('Backend not responding');
    
    // Check frontend  
    const frontendCheck = await fetch('http://localhost:5173');
    if (!frontendCheck.ok) throw new Error('Frontend not responding');
    
    console.log('✅ Both backend and frontend servers are running');
    return true;
  } catch (error) {
    console.log('⚠️  Servers not running, will start them automatically');
    return false;
  }
};

// Start servers if needed
const startServers = () => {
  return new Promise((resolve) => {
    console.log('🚀 Starting VectorSpace servers...');
    
    // Start backend
    const backend = spawn('uv', ['run', 'python', 'main.py'], {
      cwd: '../backend/backend',
      stdio: 'pipe',
      detached: false
    });
    
    // Start frontend  
    const frontend = spawn('pnpm', ['run', 'dev'], {
      cwd: '.',
      stdio: 'pipe',
      detached: false
    });
    
    // Wait for servers to be ready
    setTimeout(() => {
      console.log('✅ Servers started');
      resolve({ backend, frontend });
    }, 8000);
  });
};

// Run cucumber tests
const runCucumberTests = (config) => {
  return new Promise((resolve, reject) => {
    console.log(`🥒 Running cucumber tests in ${mode} mode...`);
    
    // Build cucumber command
    const cucumberArgs = [
      'npx', 'cucumber-js',
      ...config.features,
      '--require', 'cucumber/world/TestWorld.js',
      '--require', 'cucumber/support/hooks.js',
      '--require', 'cucumber/step_definitions/**/*.js',
      '--format', '@cucumber/pretty-formatter',
      '--format', `json:${config.formatters[1][1]}`,
      '--parallel', config.parallel.toString(),
      '--retry', config.retry.toString()
    ];
    
    if (config.tags) {
      cucumberArgs.push('--tags', config.tags);
    }
    
    const cucumber = spawn('npx', cucumberArgs.slice(1), {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    cucumber.on('close', (code) => {
      if (code === 0) {
        console.log('✅ All tests passed!');
        resolve(code);
      } else {
        console.log(`❌ Tests failed with exit code ${code}`);
        reject(code);
      }
    });
    
    cucumber.on('error', (error) => {
      console.error('❌ Failed to start cucumber:', error);
      reject(error);
    });
  });
};

// Generate test report
const generateReport = () => {
  console.log('📊 Generating test reports...');
  
  const reportsDir = './cucumber/reports';
  const jsonReport = path.join(reportsDir, 'cucumber_report.json');
  const htmlReport = path.join(reportsDir, 'cucumber_report.html');
  
  if (fs.existsSync(jsonReport)) {
    const results = JSON.parse(fs.readFileSync(jsonReport, 'utf8'));
    
    let totalScenarios = 0;
    let passedScenarios = 0;
    let failedScenarios = 0;
    
    results.forEach(feature => {
      feature.elements.forEach(scenario => {
        if (scenario.type === 'scenario') {
          totalScenarios++;
          const passed = scenario.steps.every(step => step.result.status === 'passed');
          if (passed) {
            passedScenarios++;
          } else {
            failedScenarios++;
          }
        }
      });
    });
    
    console.log('\n📈 Test Results Summary:');
    console.log(`  Total scenarios: ${totalScenarios}`);
    console.log(`  Passed: ${passedScenarios}`);
    console.log(`  Failed: ${failedScenarios}`);
    console.log(`  Success rate: ${((passedScenarios/totalScenarios)*100).toFixed(1)}%`);
    
    if (fs.existsSync(htmlReport)) {
      console.log(`\n📄 HTML Report: file://${path.resolve(htmlReport)}`);
    }
  }
};

// Cleanup function
const cleanup = (servers) => {
  if (servers) {
    console.log('🧹 Cleaning up servers...');
    if (servers.backend) servers.backend.kill('SIGTERM');
    if (servers.frontend) servers.frontend.kill('SIGTERM');
  }
};

// Main execution
const main = async () => {
  let servers = null;
  
  try {
    setupEnvironment();
    
    // Check if servers are running, start if needed
    const serversRunning = await checkServers();
    if (!serversRunning) {
      servers = await startServers();
    }
    
    // Get test configuration
    const config = getTestConfig(mode);
    
    // Run tests
    await runCucumberTests(config);
    
    // Generate reports
    generateReport();
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Test execution failed:', error);
    generateReport(); // Generate report even on failure
    process.exit(1);
  } finally {
    cleanup(servers);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⏹️  Test execution interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Test execution terminated');
  process.exit(1);
});

// Run main function
main().catch(console.error);

export default main;