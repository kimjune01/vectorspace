import { test, expect } from '@playwright/test';

const mockCollections = [
  {
    id: 1,
    name: 'AI Research',
    description: 'Collection of conversations about AI and machine learning',
    is_public: true,
    item_count: 12,
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z',
    user_id: 1
  },
  {
    id: 2,
    name: 'Work Projects',
    description: 'Professional discussions and project planning',
    is_public: false,
    item_count: 8,
    created_at: '2024-01-05T16:20:00Z',
    updated_at: '2024-01-14T11:45:00Z',
    user_id: 1
  }
];

const mockCollectionWithItems = {
  id: 1,
  name: 'AI Research',
  description: 'Collection of conversations about AI and machine learning',
  is_public: true,
  item_count: 3,
  created_at: '2024-01-10T10:00:00Z',
  updated_at: '2024-01-15T14:30:00Z',
  user_id: 1,
  items: [
    {
      id: 1,
      conversation_id: 101,
      added_at: '2024-01-12T10:00:00Z',
      conversation_title: 'Neural Networks Explained',
      conversation_summary: 'Deep dive into neural network architectures',
      conversation_author: 'ai_expert'
    },
    {
      id: 2,
      conversation_id: 102,
      added_at: '2024-01-13T15:30:00Z',
      conversation_title: 'Machine Learning Ethics',
      conversation_summary: 'Discussion about ethical considerations in ML',
      conversation_author: 'ethics_researcher'
    },
    {
      id: 3,
      conversation_id: 103,
      added_at: '2024-01-14T09:15:00Z',
      conversation_title: 'GPT and Language Models',
      conversation_summary: 'Understanding large language models and their capabilities',
      conversation_author: 'llm_specialist'
    }
  ]
};

test.describe('Collections Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock collections API
    await page.route('**/api/curation/collections', async (route) => {
      if (route.request().method() === 'GET') {
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
      } else if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        const newCollection = {
          id: 999,
          user_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          item_count: 0,
          ...requestBody
        };
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(newCollection)
        });
      }
    });

    // Mock individual collection with items
    await page.route('**/api/curation/collections/1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCollectionWithItems)
        });
      } else if (route.request().method() === 'PATCH') {
        const requestBody = await route.request().postDataJSON();
        const updatedCollection = {
          ...mockCollectionWithItems,
          ...requestBody,
          updated_at: new Date().toISOString()
        };
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updatedCollection)
        });
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Collection deleted successfully' })
        });
      }
    });

    // Mock adding/removing items from collection
    await page.route('**/api/curation/collections/1/items', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Conversation added to collection successfully' })
      });
    });

    await page.route('**/api/curation/collections/1/items/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Conversation removed from collection successfully' })
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

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock-token');
    });
  });

  test('should display collections list', async ({ page }) => {
    await page.goto('/saved');

    // Check collections section in sidebar
    await expect(page.locator('h2:has-text("My Collections")')).toBeVisible();
    
    // Should show all collections
    await expect(page.locator('[data-testid="collection-item"]')).toHaveCount(2);
    
    // Check first collection details
    const firstCollection = page.locator('[data-testid="collection-item"]').first();
    await expect(firstCollection).toContainText('AI Research');
    await expect(firstCollection).toContainText('12 items');
    await expect(firstCollection.locator('[data-testid="public-badge"]')).toBeVisible();
  });

  test('should create new collection', async ({ page }) => {
    await page.goto('/saved');

    // Click create collection button
    await page.locator('button:has-text("Create Collection")').click();

    // Fill out form
    await page.locator('input[placeholder*="Collection name"]').fill('New Test Collection');
    await page.locator('textarea[placeholder*="Description"]').fill('A test collection for automated testing');
    
    // Set visibility
    await page.locator('input[type="checkbox"]').check(); // Make public

    // Submit
    await page.locator('button:has-text("Create")').click();

    // Should show success message
    await expect(page.locator('text=Collection created successfully')).toBeVisible();
  });

  test('should view collection details', async ({ page }) => {
    await page.goto('/saved');

    // Click on a collection
    await page.locator('[data-testid="collection-item"]:has-text("AI Research")').click();

    // Should navigate to collection detail view
    await expect(page.locator('h1:has-text("AI Research")')).toBeVisible();
    await expect(page.locator('text=Collection of conversations about AI')).toBeVisible();
    
    // Should show collection items
    await expect(page.locator('[data-testid="collection-conversation"]')).toHaveCount(3);
    
    // Check first item
    const firstItem = page.locator('[data-testid="collection-conversation"]').first();
    await expect(firstItem).toContainText('Neural Networks Explained');
    await expect(firstItem).toContainText('ai_expert');
  });

  test('should edit collection details', async ({ page }) => {
    await page.goto('/collections/1'); // Navigate directly to collection

    // Click edit button
    await page.locator('button[aria-label*="Edit collection"]').click();

    // Update fields
    await page.locator('input[value="AI Research"]').fill('Advanced AI Research');
    await page.locator('textarea').fill('Updated description for advanced AI research topics');
    
    // Toggle visibility
    await page.locator('input[type="checkbox"]').uncheck();

    // Save changes
    await page.locator('button:has-text("Save Changes")').click();

    // Should show updated information
    await expect(page.locator('h1:has-text("Advanced AI Research")')).toBeVisible();
    await expect(page.locator('text=Updated description')).toBeVisible();
    await expect(page.locator('[data-testid="private-badge"]')).toBeVisible();
  });

  test('should remove conversation from collection', async ({ page }) => {
    await page.goto('/collections/1');

    // Wait for items to load
    await expect(page.locator('[data-testid="collection-conversation"]')).toHaveCount(3);

    // Click remove button on first item
    const firstItem = page.locator('[data-testid="collection-conversation"]').first();
    await firstItem.locator('button[aria-label*="Remove"]').click();

    // Confirm removal
    await page.locator('button:has-text("Remove")').click();

    // Should show success message
    await expect(page.locator('text=Conversation removed from collection')).toBeVisible();
  });

  test('should delete entire collection', async ({ page }) => {
    await page.goto('/collections/1');

    // Click delete collection button
    await page.locator('button:has-text("Delete Collection")').click();

    // Confirm deletion
    await page.locator('input[placeholder*="type the collection name"]').fill('AI Research');
    await page.locator('button:has-text("Delete Collection")').click();

    // Should redirect and show success message
    await expect(page).toHaveURL('/saved');
    await expect(page.locator('text=Collection deleted successfully')).toBeVisible();
  });

  test('should add conversation to collection from saved conversations', async ({ page }) => {
    // Mock saved conversations endpoint
    await page.route('**/api/curation/saved*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saved_conversations: [
            {
              id: 1,
              conversation_id: 999,
              conversation_title: 'Test Conversation',
              tags: ['test'],
              personal_note: 'Test note'
            }
          ],
          total: 1
        })
      });
    });

    await page.goto('/saved');

    // Find conversation and click "Add to Collection" button
    const conversation = page.locator('[data-testid="saved-conversation"]').first();
    await conversation.locator('button:has-text("Add to Collection")').click();

    // Select collection from dropdown
    await page.locator('select').selectOption('1'); // AI Research collection

    // Confirm addition
    await page.locator('button:has-text("Add")').click();

    // Should show success message
    await expect(page.locator('text=Added to collection successfully')).toBeVisible();
  });

  test('should filter collections by visibility', async ({ page }) => {
    await page.goto('/saved');

    // Should have filter for public/private collections
    await page.locator('button:has-text("All Collections")').click();
    await page.locator('[role="option"]:has-text("Public Only")').click();

    // Should filter to only public collections
    await expect(page.locator('[data-testid="collection-item"]')).toHaveCount(1);
    await expect(page.locator('text=AI Research')).toBeVisible();
  });

  test('should search collections', async ({ page }) => {
    await page.goto('/saved');

    // Use search in collections section
    await page.locator('input[placeholder*="Search collections"]').fill('AI');
    
    // Should filter collections locally
    await expect(page.locator('[data-testid="collection-item"]:has-text("AI Research")')).toBeVisible();
    await expect(page.locator('[data-testid="collection-item"]:has-text("Work Projects")')).not.toBeVisible();
  });

  test('should handle empty collections state', async ({ page }) => {
    // Mock empty collections response
    await page.route('**/api/curation/collections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collections: [],
          total: 0,
          page: 1,
          per_page: 50,
          has_next: false,
          has_prev: false
        })
      });
    });

    await page.goto('/saved');

    // Should show empty state
    await expect(page.locator('text=No collections yet')).toBeVisible();
    await expect(page.locator('text=Create your first collection')).toBeVisible();
    await expect(page.locator('button:has-text("Create Collection")')).toBeVisible();
  });

  test('should show collection statistics', async ({ page }) => {
    await page.goto('/collections/1');

    // Should show item count and other stats
    await expect(page.locator('text=3 conversations')).toBeVisible();
    await expect(page.locator('text=Public collection')).toBeVisible();
    
    // Should show creation/update dates
    await expect(page.locator('text=/Created|Updated/')).toHaveCount(1);
  });

  test('should support collection sharing', async ({ page }) => {
    await page.goto('/collections/1');

    // Public collection should have share button
    await expect(page.locator('button:has-text("Share")')).toBeVisible();
    
    // Click share button
    await page.locator('button:has-text("Share")').click();

    // Should show share dialog with URL
    await expect(page.locator('text=Share this collection')).toBeVisible();
    await expect(page.locator('input[readonly]')).toHaveValue(/collections\/1/);
    
    // Should have copy button
    await expect(page.locator('button:has-text("Copy Link")')).toBeVisible();
  });

  test('should validate collection form inputs', async ({ page }) => {
    await page.goto('/saved');

    // Click create collection
    await page.locator('button:has-text("Create Collection")').click();

    // Try to submit without name
    await page.locator('button:has-text("Create")').click();

    // Should show validation error
    await expect(page.locator('text=Collection name is required')).toBeVisible();

    // Name too long
    await page.locator('input[placeholder*="Collection name"]').fill('A'.repeat(101));
    await page.locator('button:has-text("Create")').click();
    
    await expect(page.locator('text=Name must be 100 characters or less')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock error response
    await page.route('**/api/curation/collections', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal server error' })
        });
      }
    });

    await page.goto('/saved');

    // Try to create collection
    await page.locator('button:has-text("Create Collection")').click();
    await page.locator('input[placeholder*="Collection name"]').fill('Test Collection');
    await page.locator('button:has-text("Create")').click();

    // Should show error message
    await expect(page.locator('text=Failed to create collection')).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await page.goto('/collections/1');

    // Check for proper headings
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that interactive elements have labels
    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBeGreaterThan(0);
    
    // Check for proper list semantics
    const listCount = await page.locator('[role="list"], ul').count();
    expect(listCount).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/saved');

    // Tab through collections
    await page.keyboard.press('Tab');
    
    // Should be able to activate with Enter
    await page.locator('[data-testid="collection-item"]').first().focus();
    await page.keyboard.press('Enter');
    
    // Should navigate to collection detail
    await expect(page).toHaveURL(/collections\/1/);
  });
});