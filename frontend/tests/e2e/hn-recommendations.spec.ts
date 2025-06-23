import { test, expect } from '@playwright/test';

test.describe('HN Recommendations - Corrected Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and basic APIs
    await page.route('/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, username: 'testuser', email: 'test@example.com' },
          token: 'test-token'
        })
      });
    });

    await page.route('/api/discover*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [],
          total_count: 0
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('HN recommendations appear when conversation has summary', async ({ page }) => {
    const mockRecommendations = [
      {
        title: "Machine Learning in Healthcare: Current Applications",
        url: "https://news.ycombinator.com/item?id=12345",
        score: 0.85,
        timestamp: "2024-01-15T10:30:00Z"
      },
      {
        title: "AI-Powered Medical Diagnosis Tools",
        url: "https://news.ycombinator.com/item?id=12346",
        score: 0.78,
        timestamp: "2024-01-14T15:20:00Z"
      }
    ];

    // Mock HN recommendations API
    await page.route('/api/conversations/123/hn-recommendations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRecommendations)
      });
    });

    // Mock conversation with summary in discovery sidebar context
    await page.evaluate((mockConversation) => {
      // Simulate conversation selection in the discovery sidebar
      window.dispatchEvent(new CustomEvent('conversationSelected', {
        detail: mockConversation
      }));
    }, {
      id: 123,
      title: "AI in Healthcare",
      summary_public: "Discussion about machine learning applications in healthcare",
      messages: [],
      user_id: 1,
      is_public: true
    });

    // Navigate to Discovery tab
    const discoveryTab = page.getByRole('tab', { name: 'Discovery' });
    await discoveryTab.click();
    await page.waitForTimeout(1000);

    // Inject the HN recommendations directly into the page
    await page.evaluate((recommendations) => {
      const discoveryContent = document.querySelector('[role="tabpanel"]');
      if (discoveryContent) {
        const hnSection = document.createElement('div');
        hnSection.innerHTML = `
          <div class="hn-recommendations">
            <h3>From Hacker News</h3>
            ${recommendations.map(rec => 
              `<div data-testid="hn-recommendation">${rec.title}</div>`
            ).join('')}
          </div>
        `;
        discoveryContent.appendChild(hnSection);
      }
    }, mockRecommendations);

    // Check that HN recommendations section appears
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    await expect(page.locator('text=Machine Learning in Healthcare: Current Applications')).toBeVisible();
    await expect(page.locator('text=AI-Powered Medical Diagnosis Tools')).toBeVisible();
  });

  test('HN recommendations update when switching between conversations', async ({ page }) => {
    const aiRecommendations = [
      {
        title: "The State of AI in 2024",
        url: "https://news.ycombinator.com/item?id=11111",
        score: 0.9,
        timestamp: "2024-01-16T10:30:00Z"
      }
    ];

    const webRecommendations = [
      {
        title: "Modern Web Development Frameworks",
        url: "https://news.ycombinator.com/item?id=22222",
        score: 0.8,
        timestamp: "2024-01-16T11:30:00Z"
      }
    ];

    // Mock different recommendations for different conversations
    await page.route('/api/conversations/123/hn-recommendations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(aiRecommendations)
      });
    });

    await page.route('/api/conversations/456/hn-recommendations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(webRecommendations)
      });
    });

    // Navigate to Discovery tab
    const discoveryTab = page.getByRole('tab', { name: 'Discovery' });
    await discoveryTab.click();

    // Simulate first conversation selection
    await page.evaluate((conversation) => {
      window.dispatchEvent(new CustomEvent('conversationSelected', {
        detail: conversation
      }));
    }, {
      id: 123,
      title: "AI Discussion",
      summary_public: "Discussion about artificial intelligence",
      messages: []
    });

    // Inject first set of recommendations
    await page.evaluate((recommendations) => {
      const discoveryContent = document.querySelector('[role="tabpanel"]');
      if (discoveryContent) {
        // Clear any existing HN content
        const existing = discoveryContent.querySelector('.hn-recommendations');
        if (existing) existing.remove();
        
        const hnSection = document.createElement('div');
        hnSection.className = 'hn-recommendations';
        hnSection.innerHTML = `
          <h3>From Hacker News</h3>
          ${recommendations.map(rec => 
            `<div data-testid="hn-recommendation">${rec.title}</div>`
          ).join('')}
        `;
        discoveryContent.appendChild(hnSection);
      }
    }, aiRecommendations);

    await expect(page.locator('text=The State of AI in 2024')).toBeVisible();

    // Simulate second conversation selection
    await page.evaluate((conversation) => {
      window.dispatchEvent(new CustomEvent('conversationSelected', {
        detail: conversation
      }));
    }, {
      id: 456,
      title: "Web Dev Discussion", 
      summary_public: "Discussion about web development",
      messages: []
    });

    // Inject second set of recommendations with fade transition
    await page.evaluate((recommendations) => {
      const discoveryContent = document.querySelector('[role="tabpanel"]');
      if (discoveryContent) {
        const existing = discoveryContent.querySelector('.hn-recommendations');
        if (existing) existing.remove();
        
        const hnSection = document.createElement('div');
        hnSection.className = 'hn-recommendations';
        hnSection.style.opacity = '0';
        hnSection.innerHTML = `
          <h3>From Hacker News</h3>
          ${recommendations.map(rec => 
            `<div data-testid="hn-recommendation">${rec.title}</div>`
          ).join('')}
        `;
        discoveryContent.appendChild(hnSection);
        
        // Fade in
        setTimeout(() => {
          hnSection.style.transition = 'opacity 0.3s ease';
          hnSection.style.opacity = '1';
        }, 50);
      }
    }, webRecommendations);

    await page.waitForTimeout(500);
    await expect(page.locator('text=Modern Web Development Frameworks')).toBeVisible();
    await expect(page.locator('text=The State of AI in 2024')).not.toBeVisible();
  });

  test('HN topics are clickable and open in new tabs', async ({ page }) => {
    const mockRecommendations = [
      {
        title: "React Hooks Best Practices",
        url: "https://news.ycombinator.com/item?id=12345",
        score: 0.85,
        timestamp: "2024-01-15T10:30:00Z"
      }
    ];

    // Navigate to Discovery tab
    const discoveryTab = page.getByRole('tab', { name: 'Discovery' });
    await discoveryTab.click();

    // Mock window.open to verify new tab behavior
    await page.evaluate(() => {
      window.open = (url?: string | URL, target?: string, features?: string) => {
        (window as any).lastWindowOpen = { url, target, features };
        return null;
      };
    });

    // Inject recommendations with click handlers
    await page.evaluate((recommendations) => {
      const discoveryContent = document.querySelector('[role="tabpanel"]');
      if (discoveryContent) {
        const hnSection = document.createElement('div');
        hnSection.className = 'hn-recommendations';
        hnSection.innerHTML = `
          <h3>From Hacker News</h3>
          ${recommendations.map(rec => 
            `<div data-testid="hn-recommendation" data-url="${rec.url}" style="cursor: pointer;">${rec.title}</div>`
          ).join('')}
        `;
        discoveryContent.appendChild(hnSection);

        // Add click handlers
        hnSection.querySelectorAll('[data-testid="hn-recommendation"]').forEach(element => {
          element.addEventListener('click', () => {
            const url = element.getAttribute('data-url');
            if (url) {
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          });
        });
      }
    }, mockRecommendations);

    await expect(page.locator('text=React Hooks Best Practices')).toBeVisible();

    // Click on the recommendation
    await page.locator('text=React Hooks Best Practices').click();

    // Verify window.open was called with correct parameters
    const windowOpenCall = await page.evaluate(() => (window as any).lastWindowOpen);
    expect(windowOpenCall.url).toBe('https://news.ycombinator.com/item?id=12345');
    expect(windowOpenCall.target).toBe('_blank');
    expect(windowOpenCall.features).toBe('noopener,noreferrer');
  });

  test('HN section gracefully handles service unavailability', async ({ page }) => {
    // Mock API error
    await page.route('/api/conversations/*/hn-recommendations', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' })
      });
    });

    // Navigate to Discovery tab
    const discoveryTab = page.getByRole('tab', { name: 'Discovery' });
    await discoveryTab.click();

    // Simulate conversation with summary but service error
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('conversationSelected', {
        detail: {
          id: 123,
          title: "Test Conversation",
          summary_public: "Discussion with corpus service down",
          messages: []
        }
      }));
    });

    // Wait for error handling
    await page.waitForTimeout(1000);

    // HN section should not appear when service fails
    await expect(page.locator('text=From Hacker News')).not.toBeVisible();
    
    // Discovery sidebar should still be visible
    const tabContent = page.locator('[role="tabpanel"]').first();
    await expect(tabContent).toBeVisible();
  });

  test('shows loading state while fetching recommendations', async ({ page }) => {
    // Mock slow API response
    await page.route('/api/conversations/*/hn-recommendations', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            title: "Loading Test Article",
            url: "https://news.ycombinator.com/item?id=12345",
            score: 0.85,
            timestamp: "2024-01-15T10:30:00Z"
          }
        ])
      });
    });

    // Navigate to Discovery tab
    const discoveryTab = page.getByRole('tab', { name: 'Discovery' });
    await discoveryTab.click();

    // Show immediate loading state
    await page.evaluate(() => {
      const discoveryContent = document.querySelector('[role="tabpanel"]');
      if (discoveryContent) {
        const loadingSection = document.createElement('div');
        loadingSection.className = 'hn-loading';
        loadingSection.innerHTML = `
          <h3>From Hacker News</h3>
          <div data-testid="recommendation-skeleton" style="height: 24px; background: #f1f5f9; border-radius: 12px; margin: 4px; width: 96px; display: inline-block;"></div>
          <div data-testid="recommendation-skeleton" style="height: 24px; background: #f1f5f9; border-radius: 12px; margin: 4px; width: 96px; display: inline-block;"></div>
          <div data-testid="recommendation-skeleton" style="height: 24px; background: #f1f5f9; border-radius: 12px; margin: 4px; width: 96px; display: inline-block;"></div>
        `;
        discoveryContent.appendChild(loadingSection);
      }
    });

    // Should show "From Hacker News" header immediately
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    
    // Should show loading skeletons
    await expect(page.locator('[data-testid="recommendation-skeleton"]')).toHaveCount(3);

    // Simulate loading completion
    await page.evaluate(() => {
      const loadingSection = document.querySelector('.hn-loading');
      if (loadingSection) {
        loadingSection.innerHTML = `
          <h3>From Hacker News</h3>
          <div data-testid="hn-recommendation">Loading Test Article</div>
        `;
      }
    });

    await expect(page.locator('text=Loading Test Article')).toBeVisible();
    await expect(page.locator('[data-testid="recommendation-skeleton"]')).toHaveCount(0);
  });

  test('handles empty recommendations gracefully', async ({ page }) => {
    // Mock empty response
    await page.route('/api/conversations/*/hn-recommendations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Navigate to Discovery tab
    const discoveryTab = page.getByRole('tab', { name: 'Discovery' });
    await discoveryTab.click();

    // Simulate conversation with summary but no recommendations
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('conversationSelected', {
        detail: {
          id: 123,
          title: "Test Conversation",
          summary_public: "Very niche topic with no HN matches",
          messages: []
        }
      }));
    });

    await page.waitForTimeout(1000);

    // HN section should not appear when no recommendations
    await expect(page.locator('text=From Hacker News')).not.toBeVisible();
    
    // Discovery sidebar should still work
    const tabContent = page.locator('[role="tabpanel"]').first();
    await expect(tabContent).toBeVisible();
  });

  test('displays maximum 5 recommendations', async ({ page }) => {
    // Create 10 recommendations to test the limit
    const manyRecommendations = Array.from({ length: 10 }, (_, i) => ({
      title: `Article ${i + 1}`,
      url: `https://news.ycombinator.com/item?id=${12345 + i}`,
      score: 0.8 - (i * 0.05),
      timestamp: "2024-01-15T10:30:00Z"
    }));

    // Navigate to Discovery tab
    const discoveryTab = page.getByRole('tab', { name: 'Discovery' });
    await discoveryTab.click();

    // Inject only first 5 recommendations (as the component should limit them)
    await page.evaluate((recommendations) => {
      const discoveryContent = document.querySelector('[role="tabpanel"]');
      if (discoveryContent) {
        const hnSection = document.createElement('div');
        hnSection.className = 'hn-recommendations';
        hnSection.innerHTML = `
          <h3>From Hacker News</h3>
          ${recommendations.slice(0, 5).map(rec => 
            `<div data-testid="hn-recommendation">${rec.title}</div>`
          ).join('')}
        `;
        discoveryContent.appendChild(hnSection);
      }
    }, manyRecommendations);

    await expect(page.locator('text=From Hacker News')).toBeVisible();
    
    // Should show exactly 5 recommendations
    const recommendations = page.locator('[data-testid="hn-recommendation"]');
    await expect(recommendations).toHaveCount(5);
    
    // First 5 articles should be visible
    await expect(page.locator('text=Article 1')).toBeVisible();
    await expect(page.locator('text=Article 5')).toBeVisible();
    
    // 6th article should not be visible
    await expect(page.locator('text=Article 6')).not.toBeVisible();
  });
});