import { test, expect, Page } from '@playwright/test';

// Helper function to create a test conversation with summary
async function createConversationWithSummary(page: Page, title: string, summary: string) {
  // Navigate to home and create conversation
  await page.goto('/');
  await page.getByText('New Chat').click();
  
  // Wait for chat interface to load
  await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
  
  // Send a message to start the conversation
  const messageInput = page.locator('textarea[placeholder*="Type your message"]');
  await messageInput.fill('Tell me about machine learning applications in healthcare');
  await messageInput.press('Enter');
  
  // Wait for AI response
  await expect(page.locator('.message-content').last()).toBeVisible({ timeout: 10000 });
  
  // Mock the conversation summary by directly updating via API
  // This simulates the conversation being summarized
  const conversationId = await page.evaluate(() => {
    const url = window.location.pathname;
    const match = url.match(/\/chat\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  });
  
  if (conversationId) {
    // Mock API call to set summary (in real test this would be set by summary service)
    await page.evaluate(async (data) => {
      // This would typically be set by the backend summarization service
      // For testing, we'll mock the API response
      const { conversationId, summary } = data;
      
      // Store mock data in sessionStorage for our mock API
      sessionStorage.setItem(`conversation-${conversationId}-summary`, summary);
      sessionStorage.setItem(`conversation-${conversationId}-has-summary`, 'true');
    }, { conversationId, summary });
  }
  
  return conversationId;
}

// Helper to mock HN recommendations API response
async function mockHNRecommendations(page: Page, recommendations: any[]) {
  await page.route('/api/conversations/*/hn-recommendations', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(recommendations)
    });
  });
}

// Helper to mock conversation API to include summary
async function mockConversationWithSummary(page: Page, conversationId: number, summary: string) {
  await page.route(`/api/conversations/${conversationId}`, async route => {
    const response = await route.fetch();
    const data = await response.json();
    
    // Add summary to the conversation data
    data.summary_public = summary;
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });
  });
}

test.describe('HN Recommendations', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test-token');
      sessionStorage.setItem('test-user', JSON.stringify({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      }));
    });
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('HN recommendations appear after conversation is summarized', async ({ page }) => {
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
      },
      {
        title: "Deep Learning for Drug Discovery",
        url: "https://news.ycombinator.com/item?id=12347",
        score: 0.72,
        timestamp: "2024-01-13T09:15:00Z"
      }
    ];

    // Mock the HN recommendations API
    await mockHNRecommendations(page, mockRecommendations);
    
    // Mock homepage to show we're on Discovery tab
    await page.goto('/');
    
    // Ensure the Discovery tab is active
    const discoveryTab = page.locator('text=Discovery');
    if (await discoveryTab.isVisible()) {
      await discoveryTab.click();
    }
    
    // Wait for the discovery sidebar to load
    await expect(page.locator('[data-testid="discovery-sidebar"]')).toBeVisible();
    
    // Mock current conversation state by triggering the component with conversation data
    await page.evaluate(() => {
      // Mock a conversation being selected
      const mockConversation = {
        id: 123,
        title: "AI in Healthcare",
        summary_public: "Discussion about machine learning applications in healthcare and medical diagnosis",
        messages: []
      };
      
      // Store in global state to simulate conversation selection
      (window as any).currentConversation = mockConversation;
      
      // Trigger a React state update
      window.dispatchEvent(new CustomEvent('conversationSelected', { 
        detail: mockConversation 
      }));
    });
    
    // Check that HN recommendations section appears
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    
    // Verify recommendations are displayed
    await expect(page.locator('text=Machine Learning in Healthcare: Current Applications')).toBeVisible();
    await expect(page.locator('text=AI-Powered Medical Diagnosis Tools')).toBeVisible();
    await expect(page.locator('text=Deep Learning for Drug Discovery')).toBeVisible();
  });

  test('HN recommendations are not shown for unsummarized conversations', async ({ page }) => {
    // Mock conversation without summary
    await page.route('/api/conversations/*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.summary_public = null; // No summary
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/chat/123');
    
    // Wait for sidebar to load
    await expect(page.locator('[data-testid="discovery-sidebar"]')).toBeVisible();
    
    // HN recommendations should not appear
    await expect(page.locator('text=From Hacker News')).not.toBeVisible();
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

    // Mock conversations with summaries
    await page.route('/api/conversations/123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123,
          title: "AI Discussion",
          summary_public: "Discussion about artificial intelligence and machine learning",
          messages: []
        })
      });
    });

    await page.route('/api/conversations/456', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 456,
          title: "Web Dev Discussion", 
          summary_public: "Discussion about web development and modern frameworks",
          messages: []
        })
      });
    });

    // Start with first conversation
    await page.goto('/chat/123');
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    await expect(page.locator('text=The State of AI in 2024')).toBeVisible();

    // Switch to second conversation
    await page.goto('/chat/456');
    
    // Should show loading state briefly
    await page.waitForTimeout(100);
    
    // Then show different recommendations
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    await expect(page.locator('text=Modern Web Development Frameworks')).toBeVisible();
    
    // Original recommendation should be gone
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

    await mockHNRecommendations(page, mockRecommendations);
    
    await page.route('/api/conversations/*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.summary_public = "Discussion about React development and hooks";
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/chat/123');
    
    // Wait for recommendations to load
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    await expect(page.locator('text=React Hooks Best Practices')).toBeVisible();

    // Mock window.open to verify new tab behavior
    await page.evaluate(() => {
      window.open = (url: string, target: string, features: string) => {
        // Store the call details for verification
        (window as any).lastWindowOpen = { url, target, features };
        return null;
      };
    });

    // Click on the recommendation
    await page.locator('text=React Hooks Best Practices').click();

    // Verify window.open was called with correct parameters
    const windowOpenCall = await page.evaluate(() => (window as any).lastWindowOpen);
    expect(windowOpenCall.url).toBe('https://news.ycombinator.com/item?id=12345');
    expect(windowOpenCall.target).toBe('_blank');
    expect(windowOpenCall.features).toBe('noopener,noreferrer');
  });

  test('HN recommendations handle keyboard navigation', async ({ page }) => {
    const mockRecommendations = [
      {
        title: "Accessible Web Development",
        url: "https://news.ycombinator.com/item?id=12345",
        score: 0.85,
        timestamp: "2024-01-15T10:30:00Z"
      }
    ];

    await mockHNRecommendations(page, mockRecommendations);
    
    await page.route('/api/conversations/*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.summary_public = "Discussion about web accessibility";
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/chat/123');
    
    await expect(page.locator('text=Accessible Web Development')).toBeVisible();

    // Mock window.open
    await page.evaluate(() => {
      (window as any).windowOpenCalls = [];
      window.open = (url: string, target: string, features: string) => {
        (window as any).windowOpenCalls.push({ url, target, features });
        return null;
      };
    });

    // Focus the recommendation and press Enter
    await page.locator('text=Accessible Web Development').focus();
    await page.keyboard.press('Enter');

    // Verify it opened the link
    let calls = await page.evaluate(() => (window as any).windowOpenCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://news.ycombinator.com/item?id=12345');

    // Test Space key as well
    await page.locator('text=Accessible Web Development').focus();
    await page.keyboard.press('Space');

    calls = await page.evaluate(() => (window as any).windowOpenCalls);
    expect(calls).toHaveLength(2);
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

    await page.route('/api/conversations/*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.summary_public = "Discussion with corpus service down";
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/chat/123');
    
    // Wait for sidebar to load
    await expect(page.locator('[data-testid="discovery-sidebar"]')).toBeVisible();
    
    // HN section should not appear when service fails
    await expect(page.locator('text=From Hacker News')).not.toBeVisible();
    
    // Rest of sidebar should still function normally
    await expect(page.locator('[data-testid="discovery-sidebar"]')).toBeVisible();
  });

  test('shows loading state while fetching recommendations', async ({ page }) => {
    // Mock slow API response
    await page.route('/api/conversations/*/hn-recommendations', async route => {
      // Delay response to show loading state
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

    await page.route('/api/conversations/*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.summary_public = "Discussion for loading test";
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/chat/123');
    
    // Should show "From Hacker News" header immediately
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    
    // Should show loading skeletons
    await expect(page.locator('[data-testid="recommendation-skeleton"]')).toHaveCount(3);
    
    // Wait for actual content to load
    await expect(page.locator('text=Loading Test Article')).toBeVisible({ timeout: 5000 });
    
    // Loading skeletons should be gone
    await expect(page.locator('[data-testid="recommendation-skeleton"]')).toHaveCount(0);
  });

  test('displays maximum 5 recommendations', async ({ page }) => {
    // Create 10 recommendations to test the limit
    const manyRecommendations = Array.from({ length: 10 }, (_, i) => ({
      title: `Article ${i + 1}`,
      url: `https://news.ycombinator.com/item?id=${12345 + i}`,
      score: 0.8 - (i * 0.05),
      timestamp: "2024-01-15T10:30:00Z"
    }));

    await mockHNRecommendations(page, manyRecommendations);
    
    await page.route('/api/conversations/*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.summary_public = "Discussion with many potential recommendations";
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/chat/123');
    
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    
    // Should show exactly 5 recommendations
    const recommendations = page.locator('[data-testid="hn-recommendation"]');
    await expect(recommendations).toHaveCount(5);
    
    // First 5 articles should be visible
    await expect(page.locator('text=Article 1')).toBeVisible();
    await expect(page.locator('text=Article 2')).toBeVisible();
    await expect(page.locator('text=Article 3')).toBeVisible();
    await expect(page.locator('text=Article 4')).toBeVisible();
    await expect(page.locator('text=Article 5')).toBeVisible();
    
    // 6th article should not be visible
    await expect(page.locator('text=Article 6')).not.toBeVisible();
  });

  test('handles empty recommendations gracefully', async ({ page }) => {
    // Mock empty response
    await mockHNRecommendations(page, []);
    
    await page.route('/api/conversations/*', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.summary_public = "Very niche topic with no HN matches";
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.goto('/chat/123');
    
    // Wait for sidebar to load
    await expect(page.locator('[data-testid="discovery-sidebar"]')).toBeVisible();
    
    // HN section should not appear when no recommendations
    await expect(page.locator('text=From Hacker News')).not.toBeVisible();
    
    // Rest of sidebar should still work
    await expect(page.locator('[data-testid="discovery-sidebar"]')).toBeVisible();
  });

  test('recommendations work with private conversations', async ({ page }) => {
    const mockRecommendations = [
      {
        title: "Private Discussion Related Article",
        url: "https://news.ycombinator.com/item?id=12345",
        score: 0.85,
        timestamp: "2024-01-15T10:30:00Z"
      }
    ];

    await mockHNRecommendations(page, mockRecommendations);
    
    // Mock private conversation with summary
    await page.route('/api/conversations/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123,
          title: "Private Discussion",
          is_public: false,
          summary_public: "Private conversation about sensitive topics",
          messages: []
        })
      });
    });

    await page.goto('/chat/123');
    
    // Should still show recommendations for private conversations
    await expect(page.locator('text=From Hacker News')).toBeVisible();
    await expect(page.locator('text=Private Discussion Related Article')).toBeVisible();
  });
});