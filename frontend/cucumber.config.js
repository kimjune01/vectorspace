export default {
  requireModule: ['@babel/register'],
  require: [
    'cucumber/world/TestWorld.js',
    'cucumber/support/hooks.js',
    'cucumber/step_definitions/**/*.js'
  ],
  format: ['@cucumber/pretty-formatter'],
  parallel: 1,
  worldParameters: {
    backend: {
      baseUrl: 'http://localhost:8000/api',
      timeout: 30000
    },
    frontend: {
      baseUrl: 'http://localhost:5173',
      timeout: 30000
    },
    test: {
      headless: true,
      slowMo: 0,
      timeout: 60000
    }
  }
};