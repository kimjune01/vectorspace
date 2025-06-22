import { test, expect } from '@playwright/test';

// Mock the API responses for saved conversations functionality
const mockSavedConversations = [
  {
    id: 1,
    user_id: 1,
    conversation_id: 1,
    saved_at: '2024-01-15T10:00:00Z',
    tags: ['work', 'important'],
    personal_note: 'Very useful discussion about React patterns',
    conversation_title: 'React Design Patterns',
    conversation_summary: 'Discussion about various React design patterns and best practices',
    conversation_author: 'john_doe'
  },
  {
    id: 2,
    user_id: 1,
    conversation_id: 2,
    saved_at: '2024-01-14T15:30:00Z',
    tags: ['personal', 'learning'],
    personal_note: 'Good explanation of async/await',
    conversation_title: 'JavaScript Async Programming',
    conversation_summary: 'Deep dive into asynchronous programming in JavaScript',
    conversation_author: 'jane_smith'
  },
  {
    id: 3,
    user_id: 1,
    conversation_id: 3,
    saved_at: '2024-01-13T09:45:00Z',
    tags: ['ai', 'research'],
    personal_note: null,
    conversation_title: 'Machine Learning Basics',
    conversation_summary: 'Introduction to machine learning concepts and algorithms',
    conversation_author: 'ai_expert'
  }
];

const mockCollections = [
  {
    id: 1,
    name: 'Work Projects',
    description: 'Conversations related to current work projects',
    is_public: false,
    item_count: 5,
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z'
  },
  {
    id: 2,
    name: 'Learning Resources',
    description: 'Educational conversations and tutorials',
    is_public: true,
    item_count: 8,
    created_at: '2024-01-05T16:20:00Z',
    updated_at: '2024-01-14T11:45:00Z'
  }
];

test.describe('Saved Conversations Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API endpoints
    await page.route('**/api/curation/saved*', async (route) => {
      const url = new URL(route.request().url());
      const tag = url.searchParams.get('tag');
      
      let filteredConversations = mockSavedConversations;
      if (tag && tag !== 'all') {
        filteredConversations = mockSavedConversations.filter(conv => 
          conv.tags.includes(tag)
        );
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saved_conversations: filteredConversations,
          total: filteredConversations.length,
          page: 1,
          per_page: 20,
          has_next: false,
          has_prev: false
        })
      });
    });

    await page.route('**/api/curation/collections*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collections: mockCollections,
          total: mockCollections.length,
          page: 1,
          per_page: 50,
          has_next: false,
          has_prev: false
        })
      });
    });

    // Mock user authentication
    await page.route('**/api/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'testuser',
          display_name: 'Test User',
          email: 'test@example.com'
        })
      });
    });

    // Set up authentication
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock-token');
    });
  });

  test('should display saved conversations page correctly', async ({ page }) => {
    await page.goto('/saved');

    // Wait for auth to load
    await page.waitForTimeout(1000);

    // Check page title (should show auth'd content, not login)
    await expect(page.locator('h1')).toContainText('My Saved Conversations');
    
    // Check that conversations are displayed
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);
    
    // Check first conversation details
    const firstConv = page.locator('[data-testid="saved-conversation"]').first();
    await expect(firstConv.locator('a')).toContainText('React Design Patterns');
    await expect(firstConv).toContainText('john_doe');
    await expect(firstConv).toContainText('Very useful discussion about React patterns');
    
    // Check tags (using Badge component)
    await expect(firstConv.getByText('work')).toBeVisible();
    await expect(firstConv.getByText('important')).toBeVisible();
  });

  test('should filter conversations by tag', async ({ page }) => {
    await page.goto('/saved');

    // Wait for conversations to load
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);

    // Click on tag filter dropdown
    await page.locator('button:has-text("All tags")').click();
    
    // Select "work" tag
    await page.locator('[role="option"]:has-text("work")').click();

    // Should only show conversations with "work" tag
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(1);
    await expect(page.locator('a:has-text("React Design Patterns")')).toBeVisible();
  });

  test('should search conversations', async ({ page }) => {
    await page.goto('/saved');

    // Wait for conversations to load
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);

    // Type in search box
    await page.locator('input[placeholder*="Search"]').fill('JavaScript');
    
    // Click search button
    await page.locator('button:has-text("Search")').click();

    // Should filter results locally (mocked behavior)
    // In real implementation, this would also trigger API call
    await expect(page.locator('a:has-text("JavaScript Async Programming")')).toBeVisible();
  });

  test('should display collections sidebar', async ({ page }) => {
    await page.goto('/saved');

    // Check collections section
    await expect(page.locator('h2:has-text("My Collections")')).toBeVisible();
    
    // Check that collections are displayed
    await expect(page.locator('[data-testid="collection-item"]')).toHaveCount(2);
    
    // Check first collection
    const firstCollection = page.locator('[data-testid="collection-item"]').first();
    await expect(firstCollection).toContainText('Work Projects');
    await expect(firstCollection).toContainText('5 items');
  });

  test('should handle empty state', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/curation/saved*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saved_conversations: [],
          total: 0,
          page: 1,
          per_page: 20,
          has_next: false,
          has_prev: false
        })
      });
    });

    await page.goto('/saved');

    // Should show empty state
    await expect(page.locator('text=No saved conversations yet')).toBeVisible();
    await expect(page.locator('text=Start saving conversations')).toBeVisible();
  });

  test('should edit personal notes', async ({ page }) => {
    await page.goto('/saved');

    // Wait for conversations to load
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);

    // Find conversation with a note and click edit button
    const firstConv = page.locator('[data-testid="saved-conversation"]').first();
    await firstConv.locator('button[aria-label*="Edit note"]').click();

    // Should show textarea with current note
    const textarea = firstConv.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue('Very useful discussion about React patterns');

    // Edit the note
    await textarea.fill('Updated note about React patterns and best practices');
    
    // Save the changes
    await firstConv.locator('button:has-text("Save")').click();

    // Note should be updated (in real app, this would trigger API call)
    await expect(firstConv).toContainText('Updated note about React patterns');
  });

  test('should edit tags', async ({ page }) => {
    await page.goto('/saved');

    // Wait for conversations to load
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);

    // Find conversation and click edit tags button
    const firstConv = page.locator('[data-testid="saved-conversation"]').first();
    await firstConv.locator('button[aria-label*="Edit tags"]').click();

    // Should show input with current tags
    const input = firstConv.locator('input[placeholder*="tags"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('work, important');

    // Edit the tags
    await input.fill('work, important, react, frontend');
    
    // Save the changes
    await firstConv.locator('button:has-text("Save")').click();

    // Tags should be updated
    await expect(firstConv).toContainText('react');
    await expect(firstConv).toContainText('frontend');
  });

  test('should create new collection', async ({ page }) => {
    await page.goto('/saved');

    // Click "Create Collection" button
    await page.locator('button:has-text("Create Collection")').click();

    // Fill out collection form
    await page.locator('input[placeholder*="Collection name"]').fill('New Test Collection');
    await page.locator('textarea[placeholder*="Description"]').fill('A collection for testing purposes');
    
    // Make it public
    await page.locator('input[type="checkbox"]').check();

    // Submit form
    await page.locator('button:has-text("Create")').click();

    // Should show success message (mocked)
    await expect(page.locator('text=Collection created successfully')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/curation/saved*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Internal server error'
        })
      });
    });

    await page.goto('/saved');

    // Should show error message
    await expect(page.locator('text=Failed to load saved conversations')).toBeVisible();
    
    // Should show retry button
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('should support pagination', async ({ page }) => {
    // Mock paginated response
    await page.route('**/api/curation/saved*', async (route) => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') || '1');
      
      const conversations = page_num === 1 ? mockSavedConversations : [];
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saved_conversations: conversations,
          total: 25, // More than one page
          page: page_num,
          per_page: 20,
          has_next: page_num === 1,
          has_prev: page_num > 1
        })
      });
    });

    await page.goto('/saved');

    // Should show pagination controls when there are more results
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
    
    // Click next page
    await page.locator('button:has-text("Next")').click();
    
    // Should update page indicator
    await expect(page.locator('text=Page 2')).toBeVisible();
  });

  test('should navigate to conversation detail when clicked', async ({ page }) => {
    await page.goto('/saved');

    // Wait for conversations to load
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);

    // Click on conversation title
    await page.locator('a:has-text("React Design Patterns")').click();

    // Should navigate to conversation detail page
    await expect(page).toHaveURL(/\/conversations\/1/);
  });

  test('should show correct relative timestamps', async ({ page }) => {
    await page.goto('/saved');

    // Check that relative timestamps are displayed
    await expect(page.locator('text=/\\d+[dhm] ago|Just now/')).toHaveCount(3);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/saved');

    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Search input
    await page.keyboard.press('Tab'); // Tag filter
    await page.keyboard.press('Tab'); // Search button

    // Should be able to activate elements with Enter/Space
    await page.keyboard.press('Enter');
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/saved');

    // Collections should be hidden on mobile or shown in collapsed state
    // Conversations should be displayed in mobile-friendly layout
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);
    
    // Check that layout adapts to mobile
    const firstConv = page.locator('[data-testid="saved-conversation"]').first();
    await expect(firstConv).toBeVisible();
  });
});

test.describe('Saved Conversations - Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Don't set up authentication
    await page.goto('/saved');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show login prompt in error state', async ({ page }) => {
    // Mock 401 unauthorized response
    await page.route('**/api/curation/saved*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Not authenticated'
        })
      });
    });

    await page.goto('/saved');

    // Should show authentication error
    await expect(page.locator('text=Please log in')).toBeVisible();
  });
});

test.describe('Saved Conversations - Accessibility', () => {
  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/saved');

    // Check main landmarks
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toHaveAccessibleName('Saved Conversations');
    
    // Check that interactive elements have proper labels
    await expect(page.locator('button:has-text("Search")')).toHaveAccessibleName();
    await expect(page.locator('input[placeholder*="Search"]')).toHaveAccessibleName();
  });

  test('should support screen readers', async ({ page }) => {
    await page.goto('/saved');

    // Check that important content has proper structure
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h2')).toBeVisible();
    
    // Lists should have proper semantics
    await expect(page.locator('[role="list"], ul, ol')).toHaveCount.greaterThan(0);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/saved');

    // This would require additional accessibility testing tools
    // For now, ensure key elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="saved-conversation"]')).toHaveCount(3);
  });
});