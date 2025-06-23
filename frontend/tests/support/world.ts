import { BeforeAll, AfterAll, Before, After, setWorldConstructor } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page, chromium, Route } from '@playwright/test';

class CustomWorld {
  public browser!: Browser;
  public context!: BrowserContext;
  public page!: Page;
  public conversationTopic?: string;
  public currentUser?: any;
  public testData: Map<string, any> = new Map();

  async init() {
    this.browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: process.env.CI !== 'true' ? 100 : 0
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      // Mock API base URL for testing
      baseURL: 'http://localhost:5173'
    });
    
    this.page = await this.context.newPage();
    
    // Set up common mocks
    await this.setupCommonMocks();
  }

  async cleanup() {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  private async setupCommonMocks() {
    // Mock authentication endpoints
    await this.page.route('**/api/auth/**', (route: Route) => {
      const url = route.request().url();
      
      if (url.includes('/me')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            username: 'testuser',
            display_name: 'Test User',
            email: 'test@example.com'
          })
        });
      } else {
        route.continue();
      }
    });

    // Mock HN topics endpoint with dynamic responses
    await this.page.route('**/api/corpus/hn-topics**', (route: Route) => {
      const url = new URL(route.request().url());
      const summary = url.searchParams.get('current_conversation_summary');
      
      if (!summary) {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Conversation summary is required'
          })
        });
        return;
      }

      // Generate contextual topics based on summary content
      let topics: string[] = [];
      
      if (summary.toLowerCase().includes('machine learning') || summary.toLowerCase().includes('ai')) {
        topics = ['Machine Learning', 'Neural Networks', 'Deep Learning', 'AI Ethics', 'TensorFlow'];
      } else if (summary.toLowerCase().includes('web development') || summary.toLowerCase().includes('javascript')) {
        topics = ['React', 'JavaScript', 'Frontend', 'Node.js', 'TypeScript'];
      } else if (summary.toLowerCase().includes('blockchain')) {
        topics = ['Cryptocurrency', 'Smart Contracts', 'DeFi', 'Ethereum', 'Web3'];
      } else if (summary.toLowerCase().includes('cybersecurity')) {
        topics = ['Security', 'Encryption', 'Privacy', 'Vulnerabilities', 'Penetration Testing'];
      } else {
        topics = ['Programming', 'Technology', 'Software', 'Development', 'Innovation'];
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          topics,
          source: 'hackernews',
          context: 'semantic_similarity'
        })
      });
    });

    // Mock conversation endpoints
    await this.page.route('**/api/conversations/**', (route: Route) => {
      const method = route.request().method();
      
      if (method === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            conversations: [],
            total: 0,
            page: 1,
            per_page: 20
          })
        });
      } else {
        route.continue();
      }
    });

    // Mock discover/search endpoints
    await this.page.route('**/api/discover**', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [],
          total: 0
        })
      });
    });
  }
}

setWorldConstructor(CustomWorld);

// Global hooks
BeforeAll(async function () {
  console.log('🥒 Starting Cucumber tests for HN recommendations...');
});

AfterAll(async function () {
  console.log('🥒 Cucumber tests completed!');
});

Before(async function () {
  await this.init();
});

After(async function () {
  await this.cleanup();
});