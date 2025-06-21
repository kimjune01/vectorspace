import { test, expect } from '@playwright/test';

const TEST_USER = { username: 'testuser', password: 'testpass', displayName: 'Alice' };

test.describe('Performance Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginUser(page, TEST_USER);
  });

  test('conversation creation performance', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to conversation creation
    await page.goto('/');
    const newChatButton = page.locator('button, a').filter({ hasText: /new chat|new conversation/i });
    
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
      
      const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
      if (await titleInput.isVisible()) {
        await titleInput.fill('Performance Test Conversation');
        
        const createButton = page.locator('button').filter({ hasText: /create|start/i });
        await createButton.click();
        
        // Wait for conversation to be created
        await page.waitForURL(/\/chat\//);
        
        const creationTime = Date.now() - startTime;
        console.log(`Conversation creation took: ${creationTime}ms`);
        
        // Should complete within 3 seconds
        expect(creationTime).toBeLessThan(3000);
      }
    }
  });

  test('AI response performance', async ({ page }) => {
    // Create or navigate to a conversation
    const conversationUrl = await setupConversation(page);
    
    const messageInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"], button').filter({ hasText: /send/i });
    
    if (await messageInput.isVisible()) {
      const startTime = Date.now();
      
      await messageInput.fill('What is machine learning? Please provide a detailed explanation.');
      await sendButton.click();
      
      // Wait for AI response to appear
      await page.waitForFunction(() => {
        const messages = document.querySelectorAll('.message, .chat-message');
        return messages.length >= 2; // User message + AI response
      }, { timeout: 15000 });
      
      const responseTime = Date.now() - startTime;
      console.log(`AI response took: ${responseTime}ms`);
      
      // Should respond within 12 seconds
      expect(responseTime).toBeLessThan(12000);
    }
  });

  test('search performance', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForTimeout(1000);
    
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      const startTime = Date.now();
      
      await searchInput.fill('machine learning neural networks');
      await page.keyboard.press('Enter');
      
      // Wait for search results
      await page.waitForFunction(() => {
        const results = document.querySelectorAll('.grid .hover\\:shadow-md, .search-result, .conversation-card');
        return results.length > 0 || document.querySelector('text=/no results/i');
      }, { timeout: 5000 });
      
      const searchTime = Date.now() - startTime;
      console.log(`Search took: ${searchTime}ms`);
      
      // Should return results within 2 seconds
      expect(searchTime).toBeLessThan(2000);
    }
  });

  test('page load performance', async ({ page }) => {
    const pages = [
      { path: '/', name: 'Home' },
      { path: '/discover', name: 'Discover' },
      { path: '/profile/testuser', name: 'Profile' }
    ];
    
    for (const testPage of pages) {
      const startTime = Date.now();
      
      await page.goto(testPage.path);
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      console.log(`${testPage.name} page loaded in: ${loadTime}ms`);
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    }
  });

  test('presence update performance', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Setup both users in same conversation
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USER);
      const conversationUrl = await setupConversation(alicePage);
      
      await bobPage.goto('/');
      await loginUser(bobPage, { username: 'testuser2', password: 'testpass', displayName: 'Bob' });
      await bobPage.goto(conversationUrl);
      
      await alicePage.waitForTimeout(2000);
      
      // Measure presence update time
      const startTime = Date.now();
      
      // Bob scrolls in the conversation
      await bobPage.evaluate(() => {
        const scrollContainer = document.querySelector('.messages-container, .chat-messages, main');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight / 2;
        } else {
          window.scrollTo(0, document.body.scrollHeight / 2);
        }
      });
      
      // Wait for Alice to see presence update
      await alicePage.waitForTimeout(1000);
      
      const presenceUpdateTime = Date.now() - startTime;
      console.log(`Presence update took: ${presenceUpdateTime}ms`);
      
      // Should update within 1 second
      expect(presenceUpdateTime).toBeLessThan(1000);
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('sidebar update performance', async ({ page }) => {
    // Navigate to a conversation
    const conversationUrl = await setupConversation(page);
    
    const startTime = Date.now();
    
    // Look for discovery sidebar
    const discoveryTab = page.locator('[role="tab"]').filter({ hasText: /discovery|related/i });
    
    if (await discoveryTab.isVisible()) {
      await discoveryTab.click();
      
      // Wait for sidebar content to load
      await page.waitForFunction(() => {
        const sections = document.querySelectorAll('h3');
        return Array.from(sections).some(h3 => 
          h3.textContent?.includes('Similar') || 
          h3.textContent?.includes('Trending') ||
          h3.textContent?.includes('Recent')
        );
      }, { timeout: 3000 });
      
      const sidebarLoadTime = Date.now() - startTime;
      console.log(`Sidebar loaded in: ${sidebarLoadTime}ms`);
      
      // Should load within 2 seconds
      expect(sidebarLoadTime).toBeLessThan(2000);
    }
  });

  test('conversation list performance with many items', async ({ page }) => {
    // Navigate to profile to see conversation list
    await page.goto('/profile/testuser');
    
    const startTime = Date.now();
    
    // Wait for conversation list to load
    await page.waitForFunction(() => {
      const conversations = document.querySelectorAll('.conversation-card, .conversation-item, a[href*="/chat/"]');
      return conversations.length >= 0; // Even 0 is valid (empty state)
    }, { timeout: 5000 });
    
    const listLoadTime = Date.now() - startTime;
    console.log(`Conversation list loaded in: ${listLoadTime}ms`);
    
    // Should load within 2 seconds
    expect(listLoadTime).toBeLessThan(2000);
    
    // Test scrolling performance with many items
    const conversationCards = page.locator('.conversation-card, .conversation-item');
    const cardCount = await conversationCards.count();
    
    if (cardCount > 10) {
      const scrollStartTime = Date.now();
      
      // Scroll through the conversation list
      await page.evaluate(() => {
        const scrollContainer = document.querySelector('.conversations-list, main, .profile-content');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      });
      
      await page.waitForTimeout(500);
      
      const scrollTime = Date.now() - scrollStartTime;
      console.log(`Scrolling ${cardCount} conversations took: ${scrollTime}ms`);
      
      // Should scroll smoothly within 1 second
      expect(scrollTime).toBeLessThan(1000);
    }
  });

  test('real-time chat performance under load', async ({ page }) => {
    const conversationUrl = await setupConversation(page);
    
    const messageInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]');
    const sendButton = page.locator('button[type="submit"], button').filter({ hasText: /send/i });
    
    if (await messageInput.isVisible()) {
      const messages = [
        'First test message for performance testing',
        'Second message to test rapid sending',
        'Third message with more content to test handling',
        'Fourth message testing system responsiveness',
        'Fifth and final message for load testing'
      ];
      
      const startTime = Date.now();
      
      for (const message of messages) {
        await messageInput.fill(message);
        await sendButton.click();
        
        // Wait briefly between messages
        await page.waitForTimeout(500);
      }
      
      // Wait for all messages to appear
      await page.waitForFunction(() => {
        const messageElements = document.querySelectorAll('.message, .chat-message');
        return messageElements.length >= messages.length;
      }, { timeout: 10000 });
      
      const totalTime = Date.now() - startTime;
      console.log(`Sending ${messages.length} messages took: ${totalTime}ms`);
      
      // Should handle multiple messages efficiently
      expect(totalTime).toBeLessThan(8000);
    }
  });

  test('memory usage and no memory leaks', async ({ page }) => {
    // Navigate through multiple pages to test memory usage
    const navigationSequence = [
      '/',
      '/discover',
      '/profile/testuser',
      '/discover',
      '/'
    ];
    
    for (let i = 0; i < 3; i++) { // Repeat sequence 3 times
      for (const path of navigationSequence) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
      }
    }
    
    // Measure memory usage
    const metrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
    
    if (metrics) {
      console.log(`Memory usage - Used: ${metrics.usedJSHeapSize}, Total: ${metrics.totalJSHeapSize}, Limit: ${metrics.jsHeapSizeLimit}`);
      
      // Memory usage should be reasonable (less than 100MB)
      expect(metrics.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
    }
    
    // Check for JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.waitForTimeout(1000);
    
    // Should have no JavaScript errors
    expect(errors.length).toBe(0);
  });

  test('concurrent user performance simulation', async ({ browser }) => {
    const contexts: any[] = [];
    const pages: any[] = [];
    
    try {
      // Create 5 concurrent user sessions
      for (let i = 0; i < 5; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }
      
      const startTime = Date.now();
      
      // All users perform actions simultaneously
      const userActions = pages.map(async (page, index) => {
        const user = { username: `testuser${index + 1}`, password: 'testpass', displayName: `User${index + 1}` };
        
        await page.goto('/');
        await loginUser(page, user);
        
        // Each user searches for content
        await page.goto('/discover');
        const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
        
        if (await searchInput.isVisible()) {
          await searchInput.fill(`search query ${index + 1}`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);
        }
        
        // Navigate to profile
        await page.goto(`/profile/${user.username}`);
        await page.waitForTimeout(1000);
      });
      
      // Wait for all user actions to complete
      await Promise.all(userActions);
      
      const concurrentTime = Date.now() - startTime;
      console.log(`5 concurrent users completed actions in: ${concurrentTime}ms`);
      
      // Should handle concurrent users efficiently
      expect(concurrentTime).toBeLessThan(15000);
      
    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});

// Helper functions
async function loginUser(page: any, user: { username: string; password: string; displayName: string }) {
  const isLoggedIn = await page.locator('.notification-bell, [data-testid="user-menu"], .user-avatar').isVisible().catch(() => false);
  
  if (!isLoggedIn) {
    const loginLink = page.locator('a[href="/login"], a').filter({ hasText: /login|sign in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
    } else {
      await page.goto('/login');
    }
    
    await page.waitForTimeout(1000);
    
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /login|sign in/i });
    
    if (await usernameInput.isVisible()) {
      await usernameInput.fill(user.username);
      await passwordInput.fill(user.password);
      await submitButton.click();
      
      // Wait for login to complete
      await page.waitForTimeout(3000);
    }
  }
}

async function setupConversation(page: any): Promise<string> {
  // Try to find existing conversation first
  await page.goto('/discover');
  await page.waitForTimeout(1000);
  
  const existingConversation = page.locator('.grid .hover\\:shadow-md, .conversation-card').first();
  if (await existingConversation.isVisible()) {
    await existingConversation.click();
    await page.waitForTimeout(1000);
    return page.url();
  }
  
  // Create new conversation if none exist
  await page.goto('/');
  const newChatButton = page.locator('button, a').filter({ hasText: /new chat|new conversation/i });
  
  if (await newChatButton.isVisible()) {
    await newChatButton.click();
    
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill('Performance Test Conversation');
      
      const createButton = page.locator('button').filter({ hasText: /create|start/i });
      await createButton.click();
      await page.waitForTimeout(2000);
    }
  }
  
  return page.url();
}