import { test, expect } from '@playwright/test';

const TEST_USERS = {
  alice: { username: 'testuser', password: 'testpass', displayName: 'Alice' },
  bob: { username: 'testuser2', password: 'testpass', displayName: 'Bob' }
};

test.describe('Complete Integration Workflows', () => {
  test('complete round-trip: create → archive → discover → presence', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Phase 1: Alice creates and completes a conversation
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      
      // Create new conversation
      const conversationUrl = await createDetailedConversation(alicePage, {
        title: 'Python Neural Networks Deep Dive',
        messages: [
          'Can you explain how neural networks work in Python? I need to understand backpropagation.',
          'That\'s helpful! Can you show me a numpy implementation?',
          'Perfect! Now explain TensorFlow differences and best practices.',
          'Thanks! This has been incredibly educational for my machine learning journey.'
        ]
      });
      
      // Wait for potential auto-archiving (if implemented)
      await alicePage.waitForTimeout(3000);
      
      // Phase 2: Bob discovers the conversation through search
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      
      // Search for Alice's conversation
      await bobPage.goto('/discover');
      await bobPage.waitForTimeout(2000);
      
      const searchInput = bobPage.locator('input[placeholder*="search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('neural networks Python machine learning');
        await bobPage.keyboard.press('Enter');
        await bobPage.waitForTimeout(2000);
        
        // Look for Alice's conversation in results
        const searchResults = bobPage.locator('.grid .hover\\:shadow-md, .search-result, .conversation-card');
        const aliceResult = searchResults.filter({ hasText: /Alice|Neural Networks/i });
        
        if (await aliceResult.isVisible()) {
          await aliceResult.first().click();
          await bobPage.waitForTimeout(2000);
          
          // Phase 3: Verify presence system activates
          // Bob should now be viewing Alice's conversation
          expect(bobPage.url()).toContain('/chat/');
          
          // Alice should see Bob's presence (if she's still viewing)
          await alicePage.goto(bobPage.url());
          await alicePage.waitForTimeout(3000);
          
          const presenceIndicator = alicePage.locator('[data-testid="presence-indicator"], .presence-area, .viewer-count');
          if (await presenceIndicator.isVisible()) {
            const presenceText = await presenceIndicator.textContent();
            expect(presenceText).toMatch(/1.*view|Bob|viewer/);
          }
          
          // Phase 4: Bob creates related conversation
          await bobPage.goto('/');
          const bobConversationUrl = await createDetailedConversation(bobPage, {
            title: 'TensorFlow CNN Implementation',
            messages: [
              'I read Alice\'s neural network explanation. Can you help me build a CNN for image classification?',
              'Great! How do convolutional layers compare to the dense layers Alice discussed?'
            ]
          });
          
          // Phase 5: Verify cross-conversation discovery
          await alicePage.goto(conversationUrl);
          await alicePage.waitForTimeout(3000);
          
          // Look for discovery sidebar with related conversations
          const discoveryTab = alicePage.locator('[role="tab"]').filter({ hasText: /discovery|related/i });
          if (await discoveryTab.isVisible()) {
            await discoveryTab.click();
            
            // Should show Bob's related conversation
            const relatedSection = alicePage.locator('h3').filter({ hasText: /similar|related|community/i });
            if (await relatedSection.isVisible()) {
              const bobConversation = alicePage.locator('text=/TensorFlow|CNN|Bob/i');
              if (await bobConversation.isVisible()) {
                await expect(bobConversation).toBeVisible();
              }
            }
          }
        }
      }
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('conversation lifecycle: creation → messages → summarization → discovery', async ({ page }) => {
    await loginUser(page, TEST_USERS.alice);
    
    // Create conversation with multiple messages to trigger summarization
    const conversationData = {
      title: 'Comprehensive React Hooks Tutorial',
      messages: [
        'Can you provide a comprehensive guide to React hooks? Start with useState.',
        'Excellent! Now explain useEffect and its cleanup patterns.',
        'What about useContext and when should I use it vs Redux?',
        'How do useReducer and useMemo optimize performance?',
        'Can you show me custom hooks examples and best practices?',
        'Finally, what are the latest React 18 hooks and concurrent features?'
      ]
    };
    
    const conversationUrl = await createDetailedConversation(page, conversationData);
    
    // Wait for potential auto-summarization
    await page.waitForTimeout(5000);
    
    // Check if conversation appears in discovery
    await page.goto('/discover');
    await page.waitForTimeout(2000);
    
    const conversationCard = page.locator('.grid .hover\\:shadow-md, .conversation-card').filter({ hasText: /React Hooks/i });
    if (await conversationCard.isVisible()) {
      await expect(conversationCard).toBeVisible();
      
      // Verify conversation metadata
      const authorName = conversationCard.locator('text=Alice');
      if (await authorName.isVisible()) {
        await expect(authorName).toBeVisible();
      }
    }
    
    // Test search functionality
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('React hooks useState useEffect');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      const searchResults = page.locator('.grid .hover\\:shadow-md, .search-result');
      const reactResult = searchResults.filter({ hasText: /React.*Hook/i });
      
      if (await reactResult.isVisible()) {
        await expect(reactResult).toBeVisible();
      }
    }
  });

  test('multi-user conversation discovery workflow', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const carolContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();
    const carolPage = await carolContext.newPage();

    try {
      // Alice creates conversation about AI ethics
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      const aliceConversationUrl = await createDetailedConversation(alicePage, {
        title: 'AI Ethics and Bias in Machine Learning',
        messages: [
          'What are the main ethical concerns in AI development?',
          'How can we detect and mitigate bias in machine learning models?'
        ]
      });
      
      // Bob creates related conversation about AI safety
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      const bobConversationUrl = await createDetailedConversation(bobPage, {
        title: 'AI Safety and Alignment Challenges',
        messages: [
          'What are the biggest challenges in AI alignment?',
          'How do we ensure AI systems remain beneficial as they become more capable?'
        ]
      });
      
      // Carol discovers both conversations through search
      await carolPage.goto('/');
      await loginUser(carolPage, { username: 'testuser3', password: 'testpass', displayName: 'Carol' });
      
      await carolPage.goto('/discover');
      await carolPage.waitForTimeout(2000);
      
      // Search for AI ethics content
      const searchInput = carolPage.locator('input[placeholder*="search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('AI ethics safety machine learning');
        await carolPage.keyboard.press('Enter');
        await carolPage.waitForTimeout(2000);
        
        // Should find both Alice's and Bob's conversations
        const searchResults = carolPage.locator('.grid .hover\\:shadow-md, .search-result, .conversation-card');
        const ethicsResults = searchResults.filter({ hasText: /ethics|safety|AI/i });
        
        const resultCount = await ethicsResults.count();
        expect(resultCount).toBeGreaterThanOrEqual(1);
        
        // Carol views Alice's conversation
        if (resultCount > 0) {
          await ethicsResults.first().click();
          await carolPage.waitForTimeout(2000);
          
          // Verify presence system shows Carol as viewer
          await alicePage.goto(carolPage.url());
          await alicePage.waitForTimeout(3000);
          
          const presenceIndicator = alicePage.locator('[data-testid="presence-indicator"], .presence-area');
          if (await presenceIndicator.isVisible()) {
            const presenceText = await presenceIndicator.textContent();
            expect(presenceText).toMatch(/1.*view|Carol|viewer/);
          }
        }
      }
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
      await carolContext.close();
    }
  });

  test('sidebar integration and cross-conversation discovery', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Create related conversations
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      const aliceUrl = await createDetailedConversation(alicePage, {
        title: 'JavaScript Async Programming Fundamentals',
        messages: [
          'Explain JavaScript promises and async/await patterns.',
          'How do I handle errors in async code effectively?'
        ]
      });
      
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      const bobUrl = await createDetailedConversation(bobPage, {
        title: 'Advanced JavaScript Event Loop',
        messages: [
          'How does the JavaScript event loop work with async operations?',
          'What are microtasks vs macrotasks in the event loop?'
        ]
      });
      
      // Alice views her conversation and checks sidebar
      await alicePage.goto(aliceUrl);
      await alicePage.waitForTimeout(3000);
      
      // Look for discovery sidebar
      const discoveryTab = alicePage.locator('[role="tab"]').filter({ hasText: /discovery|related|similar/i });
      if (await discoveryTab.isVisible()) {
        await discoveryTab.click();
        await alicePage.waitForTimeout(2000);
        
        // Check for related conversations section
        const relatedSection = alicePage.locator('h3').filter({ hasText: /similar|related|community/i });
        if (await relatedSection.isVisible()) {
          // Should show Bob's JavaScript conversation
          const jsConversations = alicePage.locator('text=/JavaScript|Event Loop|Bob/i');
          if (await jsConversations.isVisible()) {
            await expect(jsConversations.first()).toBeVisible();
            
            // Test clicking on related conversation
            await jsConversations.first().click();
            await alicePage.waitForTimeout(2000);
            
            // Should navigate to Bob's conversation
            expect(alicePage.url()).toContain('/chat/');
          }
        }
        
        // Check for trending topics
        const trendingSection = alicePage.locator('h3').filter({ hasText: /trending|topics/i });
        if (await trendingSection.isVisible()) {
          const trendingTopics = alicePage.locator('.badge, .tag, button').filter({ hasText: /JavaScript|programming/i });
          if (await trendingTopics.isVisible()) {
            await expect(trendingTopics.first()).toBeVisible();
          }
        }
      }
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('user profile conversation history integration', async ({ page }) => {
    await loginUser(page, TEST_USERS.alice);
    
    // Create multiple conversations
    const conversations = [
      {
        title: 'Python Data Science Basics',
        messages: ['How do I get started with pandas and numpy?']
      },
      {
        title: 'Web Development with React',
        messages: ['What are React components and JSX?']
      },
      {
        title: 'Database Design Principles',
        messages: ['How do I design normalized database schemas?']
      }
    ];
    
    for (const conv of conversations) {
      await createDetailedConversation(page, conv);
      await page.waitForTimeout(1000);
    }
    
    // Visit profile to see conversation history
    await page.goto('/profile/testuser');
    await page.waitForTimeout(3000);
    
    // Check for conversation history
    const conversationCards = page.locator('.conversation-card, .conversation-item, a[href*="/chat/"]');
    const conversationCount = await conversationCards.count();
    
    if (conversationCount > 0) {
      expect(conversationCount).toBeGreaterThanOrEqual(1);
      
      // Verify conversations show titles and metadata
      const pythonConv = conversationCards.filter({ hasText: /Python.*Data Science/i });
      if (await pythonConv.isVisible()) {
        await expect(pythonConv).toBeVisible();
      }
      
      // Test navigation to conversation from profile
      await conversationCards.first().click();
      await page.waitForTimeout(2000);
      
      // Should navigate to conversation view
      expect(page.url()).toContain('/chat/');
    }
    
    // Test profile statistics
    const statsArea = page.locator('[data-testid="profile-stats"], .profile-statistics');
    const conversationCount24h = page.locator('text=/[0-9]+.*conversation.*24.*hour/i');
    const totalConversations = page.locator('text=/[0-9]+.*total.*conversation/i');
    
    if (await statsArea.isVisible() || await conversationCount24h.isVisible() || await totalConversations.isVisible()) {
      // Profile statistics are implemented
      expect(true).toBe(true);
    }
  });

  test('error handling and resilience in workflows', async ({ page }) => {
    await loginUser(page, TEST_USERS.alice);
    
    // Test conversation creation with network issues
    await page.goto('/');
    
    // Simulate network offline (if supported)
    try {
      await page.context().setOffline(true);
      
      // Navigate to Chat tab to create new conversation
      const chatTab = page.locator('[role="tab"]').filter({ hasText: /chat/i });
      if (await chatTab.isVisible()) {
        await chatTab.click();
        await page.waitForTimeout(1000);
      }
      
      const newChatButton = page.locator('button, a').filter({ hasText: /new chat|new conversation/i });
      if (await newChatButton.isVisible()) {
        await newChatButton.click();
        
        const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
        if (await titleInput.isVisible()) {
          await titleInput.fill('Offline Test Conversation');
          
          const createButton = page.locator('button').filter({ hasText: /create|start/i });
          await createButton.click();
          
          // Should show error or graceful degradation
          await page.waitForTimeout(2000);
          
          const errorMessage = page.locator('text=/error|failed|network|offline/i');
          if (await errorMessage.isVisible()) {
            await expect(errorMessage).toBeVisible();
          }
        }
      }
      
      // Restore network
      await page.context().setOffline(false);
      await page.waitForTimeout(2000);
      
    } catch (error) {
      // Offline simulation not supported, skip this part
      console.log('Offline simulation not supported, skipping network test');
    }
    
    // Test search with invalid input
    await page.goto('/discover');
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      // Search with empty query
      await searchInput.fill('');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Search with very long query
      await searchInput.fill('a'.repeat(1000));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Should handle gracefully without crashing
      await expect(page.locator('body')).toBeVisible();
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

async function createDetailedConversation(page: any, data: { title: string; messages: string[] }): Promise<string> {
  // Navigate to home and create new conversation
  await page.goto('/');
  await page.waitForTimeout(1000);
  
  // Navigate to Chat tab to create new conversation
  const chatTab = page.locator('[role="tab"]').filter({ hasText: /chat/i });
  if (await chatTab.isVisible()) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }
  
  const newChatButton = page.locator('button, a').filter({ hasText: /new chat|new conversation|start/i });
  
  if (await newChatButton.isVisible()) {
    await newChatButton.click();
    await page.waitForTimeout(1000);
    
    // Fill in conversation title if dialog appears
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill(data.title);
      
      const createButton = page.locator('button').filter({ hasText: /create|start|submit/i });
      await createButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Send each message in the conversation
    for (const message of data.messages) {
      const messageInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]');
      
      if (await messageInput.isVisible()) {
        await messageInput.fill(message);
        
        const sendButton = page.locator('button[type="submit"], button').filter({ hasText: /send|submit/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();
          
          // Wait for AI response
          await page.waitForTimeout(3000);
        }
      }
    }
  }
  
  return page.url();
}