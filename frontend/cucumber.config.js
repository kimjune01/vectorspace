const { defineConfig } = require('@cucumber/cucumber');

module.exports = defineConfig({
  // Feature files location
  features: ['tests/features/**/*.feature'],
  
  // Step definitions location
  require: [
    'tests/step-definitions/**/*.steps.js',
    'tests/support/**/*.js'
  ],
  
  // Use TypeScript
  requireModule: ['ts-node/register'],
  
  // TypeScript support
  loader: ['ts-node/esm'],
  
  // Test environment setup
  worldParameters: {
    playwright: {
      browserName: 'chromium',
      headless: process.env.CI === 'true',
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      video: 'retain-on-failure',
      screenshot: 'only-on-failure'
    }
  },
  
  // Output formatting
  format: [
    '@cucumber/pretty-formatter',
    'html:test-results/cucumber-report.html',
    'json:test-results/cucumber-report.json'
  ],
  
  // Retry configuration
  retry: process.env.CI === 'true' ? 2 : 0,
  
  // Parallel execution
  parallel: process.env.CI === 'true' ? 2 : 1,
  
  // Tags for selective test execution
  tags: process.env.CUCUMBER_TAGS || 'not @skip',
  
  // Timeout settings
  timeout: 30000,
  
  // Publish results
  publish: false,
  
  // Dry run option
  dryRun: false,
  
  // Fail fast
  failFast: false,
  
  // Strict mode
  strict: true
});