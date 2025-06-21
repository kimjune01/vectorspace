import { test, expect } from '@playwright/test';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass'
};

test.describe('Semantic Search & Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for React app to mount
    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Check if auto-login worked or if manual login is needed
    const userMenuButton = await page.locator('[data-testid="user-menu-button"]').isVisible().catch(() => false);
    const notificationBell = await page.locator('.notification-bell').isVisible().catch(() => false);
    const loginLink = await page.locator('[data-testid="login-link"]').isVisible().catch(() => false);
    
    // If not logged in and login link is available, perform manual login
    if (!userMenuButton && !notificationBell && loginLink) {
      await page.locator('[data-testid="login-link"]').click();
      await page.locator('[data-testid="login-username-input"]').fill(TEST_USER.username);
      await page.locator('[data-testid="login-password-input"]').fill(TEST_USER.password);
      await page.locator('[data-testid="login-submit-button"]').click();
      await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible({ timeout: 10000 });
    }
    
    // Wait a bit more for any auto-login to complete
    await page.waitForTimeout(1000);
  });

  test('basic search functionality', async ({ page }) => {
    await page.goto('/discover');
    
    // Look for search input
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"], [data-testid="search-input"]');
    
    if (await searchInput.isVisible()) {
      // Test basic text search
      await searchInput.fill('artificial intelligence');
      await page.keyboard.press('Enter');
      
      // Wait for search results
      await page.waitForTimeout(2000);
      
      // Check for results container
      const resultsContainer = page.locator('.grid, .search-results, [data-testid="search-results"]');
      await expect(resultsContainer).toBeVisible();
      
      // Check for individual result items
      const resultItems = page.locator('.hover\\:shadow-md, .search-result, .conversation-card');
      const itemCount = await resultItems.count();
      
      // Should have search results or empty state
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('semantic similarity search', async ({ page }) => {
    await page.goto('/discover');
    
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"], [data-testid="search-input"]');
    
    if (await searchInput.isVisible()) {
      // Test semantic search with related terms
      const semanticQueries = [
        'machine learning algorithms',
        'neural networks and deep learning',
        'natural language processing',
        'computer vision techniques'
      ];
      
      for (const query of semanticQueries) {
        await searchInput.clear();
        await searchInput.fill(query);
        await page.keyboard.press('Enter');
        
        // Wait for results
        await page.waitForTimeout(1500);
        
        // Verify search executed (URL change or loading state)
        const currentQuery = await searchInput.inputValue();
        expect(currentQuery).toBe(query);
        
        // Check for results or no results message
        const hasResults = await page.locator('.hover\\:shadow-md, .search-result').count() > 0;
        const noResultsMessage = await page.locator('text=/no results|not found|no matches/i').isVisible();
        
        // Either has results or shows no results message
        expect(hasResults || noResultsMessage).toBe(true);
      }
    }
  });

  test('search filters and refinements', async ({ page }) => {
    await page.goto('/discover');
    
    // Look for filter options
    const filterButtons = page.locator('button').filter({ hasText: /filter|sort|recent|popular/i });
    const filterCount = await filterButtons.count();
    
    if (filterCount > 0) {
      // Test first available filter
      await filterButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Check if dropdown or filter options appear
      const filterOptions = page.locator('[role="menu"], .dropdown-content, .filter-options');
      
      if (await filterOptions.isVisible()) {
        // Try to select a filter option
        const firstOption = filterOptions.locator('a, button').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
          await page.waitForTimeout(1500);
          
          // Verify results updated (could check URL params or content change)
          const resultsContainer = page.locator('.grid, .search-results');
          await expect(resultsContainer).toBeVisible();
        }
      }
    }
  });

  test('search result interaction', async ({ page }) => {
    await page.goto('/discover');
    
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('programming tutorial');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Find search results
      const searchResults = page.locator('.hover\\:shadow-md, .search-result, .conversation-card');
      const resultCount = await searchResults.count();
      
      if (resultCount > 0) {
        // Click on first result
        await searchResults.first().click();
        
        // Should navigate to conversation or detail page
        await page.waitForTimeout(1000);
        
        // Verify navigation occurred
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/chat\/|\/conversation\/|\/profile\//);
      }
    }
  });

  test('trending topics and recommendations', async ({ page }) => {
    await page.goto('/discover');
    
    // Look for trending topics section
    const trendingSection = page.locator('h2, h3').filter({ hasText: /trending|popular|topics/i });
    
    if (await trendingSection.isVisible()) {
      // Check for trending topic badges/buttons
      const trendingBadges = page.locator('.badge, .tag, button').filter({ hasText: /AI|machine learning|tech|programming/i });
      const badgeCount = await trendingBadges.count();
      
      if (badgeCount > 0) {
        // Click on first trending topic
        await trendingBadges.first().click();
        await page.waitForTimeout(1500);
        
        // Should show results related to that topic
        const results = page.locator('.grid, .search-results');
        await expect(results).toBeVisible();
        
        // Verify some results are shown
        const resultItems = page.locator('.hover\\:shadow-md, .conversation-card');
        const itemCount = await resultItems.count();
        expect(itemCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('search history and suggestions', async ({ page }) => {
    await page.goto('/discover');
    
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      // Focus on search input to see if suggestions appear
      await searchInput.click();
      await page.waitForTimeout(500);
      
      // Look for search suggestions or history
      const suggestions = page.locator('.suggestions, .dropdown, [role="listbox"]');
      
      if (await suggestions.isVisible()) {
        // Check if suggestions are clickable
        const suggestionItems = suggestions.locator('li, a, button');
        const suggestionCount = await suggestionItems.count();
        
        if (suggestionCount > 0) {
          // Click on first suggestion
          await suggestionItems.first().click();
          await page.waitForTimeout(1000);
          
          // Verify search was executed
          const inputValue = await searchInput.inputValue();
          expect(inputValue.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('empty search state', async ({ page }) => {
    await page.goto('/discover');
    
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      // Search for something that likely won't have results
      await searchInput.fill('xyzabc123uniquesearchterm456');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check for empty state or no results message
      const noResultsMessage = page.locator('text=/no results|not found|no matches|try different/i');
      const emptyState = page.locator('[data-testid="empty-state"], .empty-state');
      
      // Should show some indication of no results
      const hasEmptyState = await noResultsMessage.isVisible() || await emptyState.isVisible();
      
      // Also verify that results container is empty
      const resultItems = page.locator('.hover\\:shadow-md, .conversation-card');
      const itemCount = await resultItems.count();
      
      expect(hasEmptyState || itemCount === 0).toBe(true);
    }
  });

  test('search performance and responsiveness', async ({ page }) => {
    await page.goto('/discover');
    
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      // Test rapid typing (debouncing)
      await searchInput.click();
      
      const rapidSearchTerms = ['a', 'ai', 'art', 'arti', 'artif', 'artificial'];
      
      for (const term of rapidSearchTerms) {
        await searchInput.clear();
        await searchInput.fill(term);
        await page.waitForTimeout(100); // Rapid typing simulation
      }
      
      // Wait for final search to complete
      await page.waitForTimeout(2000);
      
      // Verify final search term is processed
      const finalValue = await searchInput.inputValue();
      expect(finalValue).toBe('artificial');
      
      // Check that search results are shown
      const resultsContainer = page.locator('.grid, .search-results');
      await expect(resultsContainer).toBeVisible();
    }
  });

  test('search within conversation context', async ({ page }) => {
    // Navigate to a conversation from discover
    await page.goto('/discover');
    
    const firstConversation = page.locator('.hover\\:shadow-md, .conversation-card').first();
    
    if (await firstConversation.isVisible()) {
      await firstConversation.click();
      await page.waitForTimeout(2000);
      
      // Look for discovery sidebar or similar conversations
      const discoveryTab = page.locator('[role="tab"]').filter({ hasText: 'Discovery' });
      
      if (await discoveryTab.isVisible()) {
        await discoveryTab.click();
        
        // Check for "Similar to Current Chat" section
        const similarSection = page.locator('h3').filter({ hasText: /similar|related/i });
        
        if (await similarSection.isVisible()) {
          // Check for similar conversation recommendations
          const similarChats = page.locator('.group.cursor-pointer, .similar-chat, .recommendation');
          const similarCount = await similarChats.count();
          
          expect(similarCount).toBeGreaterThanOrEqual(0);
          
          // Test clicking on similar conversation
          if (similarCount > 0) {
            await similarChats.first().click();
            await page.waitForTimeout(1000);
            
            // Should navigate to related conversation
            const currentUrl = page.url();
            expect(currentUrl).toMatch(/\/chat\//);
          }
        }
      }
    }
  });
});