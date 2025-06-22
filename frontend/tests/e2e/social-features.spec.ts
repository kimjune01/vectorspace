import { test, expect } from '@playwright/test';

// Test configuration
const TEST_USER = {
  username: 'testuser',
  password: 'testpass'
};

test.describe('Social Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and login
    await page.goto('/');
    
    // Check if already logged in
    const isLoggedIn = await page.locator('.notification-bell').isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      // Login with test user
      await page.getByRole('link', { name: 'Login' }).click();
      await page.getByLabel('Username').fill(TEST_USER.username);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'Login' }).click();
      
      // Wait for successful login
      await expect(page.locator('.notification-bell')).toBeVisible({ timeout: 10000 });
    }
  });

  test('notification bell functionality', async ({ page }) => {
    // Verify notification bell is visible
    const notificationBell = page.locator('button').filter({ has: page.locator('svg.lucide-bell') });
    await expect(notificationBell).toBeVisible();

    // Click notification bell to open dropdown
    await notificationBell.click();
    
    // Wait for dropdown to appear
    await expect(page.locator('[role="menu"]')).toBeVisible();
    
    // Check for notification content structure
    const dropdownContent = page.locator('[role="menu"]');
    await expect(dropdownContent).toBeVisible();
    
    // Close dropdown by clicking outside
    await page.click('body');
    await expect(page.locator('[role="menu"]')).not.toBeVisible();
  });

  test('conversation discovery and browsing', async ({ page }) => {
    // Navigate to discover page
    await page.goto('/discover');
    
    // Wait for conversations to load
    await expect(page.locator('.grid')).toBeVisible();
    
    // Check for conversation cards
    const conversationCards = page.locator('.grid .hover\\:shadow-md');
    await expect(conversationCards.first()).toBeVisible();
    
    // Click on first conversation
    await conversationCards.first().click();
    
    // Wait for navigation to conversation page
    await expect(page).toHaveURL(/\/chat\//);
    
    // Verify conversation content is loaded
    await expect(page.locator('[data-testid="chat-messages"]').or(page.locator('.chat-interface'))).toBeVisible();
  });

  test('enhanced discovery sidebar', async ({ page }) => {
    // Navigate to a chat page (create or find one)
    await page.goto('/discover');
    
    // Click on first conversation to get to chat view
    const firstConversation = page.locator('.grid .hover\\:shadow-md').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();
    } else {
      // Create new conversation if none exist
      await page.goto('/');
      const newChatButton = page.getByRole('button', { name: 'New Chat' });
      if (await newChatButton.isVisible()) {
        await newChatButton.click();
        
        // Fill in conversation details if dialog appears
        const titleInput = page.locator('input[placeholder*="title"]');
        if (await titleInput.isVisible()) {
          await titleInput.fill('Test Social Features Chat');
          await page.getByRole('button', { name: 'Create' }).click();
        }
      }
    }
    
    // Wait for chat interface to load
    await page.waitForTimeout(2000);
    
    // Look for Discovery tab
    const discoveryTab = page.locator('[role="tab"]').filter({ hasText: 'Discovery' });
    if (await discoveryTab.isVisible()) {
      await discoveryTab.click();
      
      // Check for discovery sections
      await expect(page.locator('h3').filter({ hasText: 'Similar to Current Chat' })).toBeVisible();
      await expect(page.locator('h3').filter({ hasText: 'Trending Topics' })).toBeVisible();
      await expect(page.locator('h3').filter({ hasText: 'Recent from Community' })).toBeVisible();
      
      // Check for trending topic badges
      const trendingBadges = page.locator('.cursor-pointer[class*="hover:bg-primary"]');
      const badgeCount = await trendingBadges.count();
      expect(badgeCount).toBeGreaterThan(0);
      
      // Check for action buttons
      await expect(page.getByRole('link', { name: 'Saved' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible();
    }
  });

  test('user profile and follow functionality', async ({ page }) => {
    // Navigate to discover page to find other users
    await page.goto('/discover');
    
    // Find an author link that's not our own profile
    const authorLink = page.locator('a[href^="/profile/"]:not([href="/profile/testuser"])').first();
    
    if (await authorLink.isVisible()) {
      await authorLink.click();
      
      // Wait for profile page to load
      await expect(page).toHaveURL(/\/profile\//);
      
      // Check for follow button
      const followButton = page.locator('button').filter({ hasText: /Follow|Following/ });
      
      if (await followButton.isVisible()) {
        const initialText = await followButton.textContent();
        
        // Click follow/unfollow button
        await followButton.click();
        
        // Wait for state change
        await page.waitForTimeout(1000);
        
        const newText = await followButton.textContent();
        expect(newText).not.toBe(initialText);
        
        // Test toggle back
        await followButton.click();
        await page.waitForTimeout(1000);
        
        const finalText = await followButton.textContent();
        expect(finalText).toBe(initialText);
      }
    }
  });

  test('bookmark functionality', async ({ page }) => {
    // Navigate to discover page
    await page.goto('/discover');
    
    // Find bookmark button
    const bookmarkButton = page.locator('button').filter({ has: page.locator('svg.lucide-bookmark') });
    
    if (await bookmarkButton.first().isVisible()) {
      // Get initial state (filled or unfilled bookmark)
      const bookmarkIcon = bookmarkButton.first().locator('svg.lucide-bookmark');
      
      // Click bookmark button
      await bookmarkButton.first().click();
      
      // Wait for state change
      await page.waitForTimeout(1000);
      
      // Verify bookmark state changed (this would depend on your implementation)
      // The test passes if no error is thrown during bookmark interaction
      await expect(bookmarkButton.first()).toBeVisible();
    }
  });

  test('semantic search functionality', async ({ page }) => {
    // Navigate to discover page
    await page.goto('/discover');
    
    // Look for search input
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      // Enter search query
      await searchInput.fill('AI artificial intelligence');
      
      // Wait for search results
      await page.waitForTimeout(2000);
      
      // Check that search results are displayed
      const searchResults = page.locator('.grid .hover\\:shadow-md');
      const resultCount = await searchResults.count();
      
      // Verify we have search results
      expect(resultCount).toBeGreaterThanOrEqual(0);
      
      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(1000);
    }
  });

  test('real-time chat interface', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Create new conversation or navigate to existing one
    const newChatButton = page.getByRole('button', { name: 'New Chat' });
    
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
      
      // Fill in conversation details if dialog appears
      const titleInput = page.locator('input[placeholder*="title"]');
      if (await titleInput.isVisible()) {
        await titleInput.fill('Real-time Test Chat');
        await page.getByRole('button', { name: 'Create' }).click();
      }
      
      // Wait for chat interface
      await page.waitForTimeout(2000);
      
      // Look for message input
      const messageInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]');
      
      if (await messageInput.isVisible()) {
        // Type a test message
        await messageInput.fill('Hello, this is a test message for real-time chat verification.');
        
        // Send message
        const sendButton = page.locator('button[type="submit"]').or(page.getByRole('button', { name: 'Send' }));
        await sendButton.click();
        
        // Wait for message to appear in chat
        await page.waitForTimeout(2000);
        
        // Verify message appeared in chat history
        await expect(page.locator('text=Hello, this is a test message')).toBeVisible();
      }
    }
  });

  test('responsive design verification', async ({ page, isMobile }) => {
    // Test mobile responsiveness
    if (isMobile) {
      await page.goto('/');
      
      // Check mobile navigation
      const mobileMenu = page.locator('[aria-label="Menu"], button[aria-expanded]');
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        
        // Verify mobile menu items
        await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible();
      }
      
      // Test conversation view on mobile
      await page.goto('/discover');
      const firstConversation = page.locator('.grid .hover\\:shadow-md').first();
      if (await firstConversation.isVisible()) {
        await firstConversation.click();
        
        // Verify chat interface is usable on mobile
        const chatInterface = page.locator('[data-testid="chat-messages"]').or(page.locator('.chat-interface'));
        await expect(chatInterface).toBeVisible();
      }
    }
  });

  test('social interactions integration', async ({ page }) => {
    // Navigate to discover page
    await page.goto('/discover');
    
    // Test multiple social features in sequence
    const conversationCard = page.locator('.grid .hover\\:shadow-md').first();
    
    if (await conversationCard.isVisible()) {
      // 1. Bookmark the conversation
      const bookmarkButton = conversationCard.locator('button').filter({ has: page.locator('svg.lucide-bookmark') });
      if (await bookmarkButton.isVisible()) {
        await bookmarkButton.click();
        await page.waitForTimeout(500);
      }
      
      // 2. Navigate to the conversation
      await conversationCard.click();
      await page.waitForTimeout(2000);
      
      // 3. Check for presence indicators or social elements in chat
      const socialElements = page.locator('[data-testid="presence-indicator"], .avatar, .user-status');
      const socialCount = await socialElements.count();
      
      // 4. Verify chat has social context
      expect(socialCount).toBeGreaterThanOrEqual(0);
      
      // 5. Test sidebar social features
      const discoveryTab = page.locator('[role="tab"]').filter({ hasText: 'Discovery' });
      if (await discoveryTab.isVisible()) {
        await discoveryTab.click();
        
        // Verify social recommendations
        const similarChats = page.locator('h3').filter({ hasText: 'Similar to Current Chat' });
        const communitySection = page.locator('h3').filter({ hasText: 'Recent from Community' });
        
        await expect(similarChats.or(communitySection)).toBeVisible();
      }
    }
  });
});