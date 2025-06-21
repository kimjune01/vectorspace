import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshots on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*.spec.ts',
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/social-features.spec.ts', '**/semantic-search.spec.ts', '**/user-profiles.spec.ts'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/auth-enhanced.spec.ts', '**/social-features.spec.ts'],
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: ['**/social-features.spec.ts', '**/auth-enhanced.spec.ts'],
    },

    /* Multi-user and performance tests - Chromium only for stability */
    {
      name: 'chromium-multi-user',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/presence-system.spec.ts', '**/human-connections.spec.ts', '**/multi-user-scenarios.spec.ts'],
    },

    {
      name: 'chromium-performance',
      use: { 
        ...devices['Desktop Chrome'],
        // Optimize for performance testing
        launchOptions: {
          args: ['--disable-dev-shm-usage', '--disable-extensions']
        }
      },
      testMatch: ['**/performance-benchmarks.spec.ts', '**/integration-workflows.spec.ts'],
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'cd ../backend && uv run python main.py',
      port: 8000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});