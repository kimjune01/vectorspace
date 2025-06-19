module.exports = {
  default: {
    // Feature files location
    features: ['./features/*.feature'],
    
    // Step definitions location
    require: [
      './cucumber/step_definitions/**/*.js',
      './cucumber/support/**/*.js'
    ],
    
    // Formatters for output
    formatters: [
      ['@cucumber/pretty-formatter'],
      ['json:./cucumber/reports/cucumber_report.json'],
      ['html:./cucumber/reports/cucumber_report.html']
    ],
    
    // World parameters
    worldParameters: {
      // Backend configuration
      backend: {
        baseUrl: 'http://localhost:8000',
        timeout: 30000
      },
      
      // Frontend configuration  
      frontend: {
        baseUrl: 'http://localhost:5173',
        timeout: 10000,
        headless: process.env.HEADLESS !== 'false'
      },
      
      // Test data
      testUsers: {
        alice: {
          username: 'alice123',
          displayName: 'Alice',
          email: 'alice@example.com',
          password: 'securepass123'
        },
        bob: {
          username: 'bob456', 
          displayName: 'Bob',
          email: 'bob@example.com',
          password: 'securepass123'
        },
        charlie: {
          username: 'charlie789',
          displayName: 'Charlie', 
          email: 'charlie@example.com',
          password: 'securepass123'
        }
      }
    },
    
    // Parallel execution
    parallel: 2,
    
    // Retry configuration
    retry: 1,
    
    // Tags configuration for running specific scenarios
    tags: process.env.CUCUMBER_TAGS || 'not @skip',
    
    // Timeout for step definitions
    timeout: 60000
  }
};