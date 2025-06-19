import { setWorldConstructor, World } from '@cucumber/cucumber';
import puppeteer from 'puppeteer';
import axios from 'axios';

/**
 * TestWorld class provides shared context and utilities for cucumber tests
 * This integrates with the existing debugging infrastructure from the VectorSpace project
 */
class TestWorld extends World {
  constructor(options) {
    super(options);
    
    // Configuration from cucumber.config.js or defaults
    this.config = options.parameters || {
      backend: {
        baseUrl: 'http://localhost:8000',
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
    };
    
    // Shared test state
    this.users = new Map();
    this.conversations = new Map(); 
    this.tokens = new Map();
    this.browsers = new Map();
    this.pages = new Map();
    
    // API client for backend testing
    const backendConfig = this.config?.backend || {
      baseUrl: 'http://localhost:8000',
      timeout: 30000
    };
    
    this.api = axios.create({
      baseURL: backendConfig.baseUrl,
      timeout: backendConfig.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Debug logging (integrates with existing debug infrastructure)
    this.debugLog = [];
    this.apiLog = [];
  }

  /**
   * Launch a browser instance for a user
   */
  async launchBrowser(userId, options = {}) {
    const browser = await puppeteer.launch({
      headless: this.config.frontend.headless,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...options
    });
    
    this.browsers.set(userId, browser);
    
    const page = await browser.newPage();
    
    // Enable API request/response logging (matches frontend useApiLogger)
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        this.apiLog.push({
          type: 'request',
          method: request.method(),
          url: request.url(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: new Date().toISOString()
        });
      }
      request.continue();
    });
    
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        this.apiLog.push({
          type: 'response', 
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    this.pages.set(userId, page);
    return page;
  }

  /**
   * Get or create a page for a user
   */
  async getPage(userId) {
    if (!this.pages.has(userId)) {
      await this.launchBrowser(userId);
    }
    return this.pages.get(userId);
  }

  /**
   * Register a new user via API
   */
  async registerUser(username, displayName, email, password) {
    try {
      const response = await this.api.post('/api/auth/signup', {
        username,
        display_name: displayName,
        email,
        password
      });
      
      const userData = {
        ...response.data.user,
        token: response.data.access_token
      };
      
      this.users.set(username, userData);
      this.tokens.set(username, response.data.access_token);
      
      this.debugLog.push(`User ${username} registered successfully`);
      return userData;
    } catch (error) {
      this.debugLog.push(`Failed to register user ${username}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Login a user via API
   */
  async loginUser(username, password) {
    try {
      const response = await this.api.post('/api/auth/login', {
        username,
        password
      });
      
      const userData = {
        ...response.data.user,
        token: response.data.access_token
      };
      
      this.users.set(username, userData);
      this.tokens.set(username, response.data.access_token);
      
      this.debugLog.push(`User ${username} logged in successfully`);
      return userData;
    } catch (error) {
      this.debugLog.push(`Failed to login user ${username}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get authenticated API client for a user
   */
  getAuthenticatedApi(username) {
    const token = this.tokens.get(username);
    if (!token) {
      throw new Error(`No token found for user ${username}`);
    }
    
    const backendConfig = this.config?.backend || {
      baseUrl: 'http://localhost:8000',
      timeout: 30000
    };
    
    return axios.create({
      baseURL: backendConfig.baseUrl,
      timeout: backendConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /**
   * Navigate to frontend page with authentication
   */
  async navigateToPage(userId, path = '') {
    const page = await this.getPage(userId);
    const url = `${this.config.frontend.baseUrl}${path}`;
    
    // Auto-login if user has token (matches frontend auto-login in dev mode)
    const token = this.tokens.get(userId);
    if (token) {
      await page.evaluateOnNewDocument((token) => {
        localStorage.setItem('auth_token', token);
      }, token);
    }
    
    await page.goto(url, { waitUntil: 'networkidle0' });
    return page;
  }

  /**
   * Wait for element with debugging information
   */
  async waitForElement(page, selector, timeout = 10000) {
    try {
      const element = await page.waitForSelector(selector, { timeout });
      this.debugLog.push(`Found element: ${selector}`);
      return element;
    } catch (error) {
      // Take screenshot for debugging
      await page.screenshot({ 
        path: `./cucumber/reports/debug_${Date.now()}.png`,
        fullPage: true 
      });
      this.debugLog.push(`Failed to find element: ${selector}`);
      throw error;
    }
  }

  /**
   * Take screenshot with descriptive name
   */
  async takeScreenshot(userId, name) {
    const page = this.pages.get(userId);
    if (page) {
      const filename = `./cucumber/reports/${name}_${userId}_${Date.now()}.png`;
      await page.screenshot({ path: filename, fullPage: true });
      this.debugLog.push(`Screenshot saved: ${filename}`);
      return filename;
    }
  }

  /**
   * Cleanup resources after test
   */
  async cleanup() {
    // Close all browser instances
    for (const [userId, browser] of this.browsers) {
      try {
        await browser.close();
        this.debugLog.push(`Browser closed for user ${userId}`);
      } catch (error) {
        this.debugLog.push(`Error closing browser for ${userId}: ${error.message}`);
      }
    }
    
    // Clear maps
    this.browsers.clear();
    this.pages.clear();
    this.users.clear();
    this.tokens.clear();
    this.conversations.clear();
    
    // Save debug logs if there were failures
    if (this.debugLog.length > 0) {
      const fs = await import('fs');
      const logFile = `./cucumber/reports/debug_${Date.now()}.log`;
      fs.writeFileSync(logFile, JSON.stringify({
        debugLog: this.debugLog,
        apiLog: this.apiLog
      }, null, 2));
    }
  }
}

setWorldConstructor(TestWorld);
export default TestWorld;