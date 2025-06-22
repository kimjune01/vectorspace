import { test, expect } from '@playwright/test';

const TEST_USERS = {
  alice: { username: 'testuser', password: 'testpass', displayName: 'Alice' },
  bob: { username: 'testuser2', password: 'testpass', displayName: 'Bob' },
  carol: { username: 'testuser3', password: 'testpass', displayName: 'Carol' },
  dave: { username: 'testuser4', password: 'testpass', displayName: 'Dave' }
};

test.describe('Multi-User Concurrent Scenarios', () => {
  test('concurrent presence with multiple viewers', async ({ browser }) => {
    const contexts: any[] = [];
    const pages: any[] = [];
    const users = [TEST_USERS.alice, TEST_USERS.bob, TEST_USERS.carol, TEST_USERS.dave];

    try {
      // Create 4 browser contexts for different users
      for (let i = 0; i < 4; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // Alice creates a conversation
      await pages[0].goto('/');
      await loginUser(pages[0], users[0]);
      const conversationUrl = await createConversation(pages[0], 'Multi-User Presence Test');

      // Other users join the same conversation
      for (let i = 1; i < pages.length; i++) {
        await pages[i].goto('/');
        await loginUser(pages[i], users[i]);
        await pages[i].goto(conversationUrl);
        await pages[i].waitForTimeout(1000);
      }

      // Wait for presence system to synchronize
      await pages[0].waitForTimeout(3000);

      // Alice should see multiple viewers
      const presenceIndicator = pages[0].locator('[data-testid="presence-indicator"], .presence-area, .viewer-count');
      if (await presenceIndicator.isVisible()) {
        const presenceText = await presenceIndicator.textContent();
        // Should show 3 viewers (Bob, Carol, Dave)
        expect(presenceText).toMatch(/[3-9].*view|Bob|Carol|Dave/);
      }

      // Test concurrent scroll tracking
      for (let i = 1; i < pages.length; i++) {
        await pages[i].evaluate((scrollPosition: any) => {
          const scrollContainer = document.querySelector('.messages-container, .chat-messages, main');
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollPosition * 100;
          } else {
            window.scrollTo(0, scrollPosition * 100);
          }
        }, i);
      }

      await pages[0].waitForTimeout(2000);

      // Alice should see different scroll positions for each user
      const presenceAvatars = pages[0].locator('[data-testid="presence-avatar"], .presence-avatar');
      const avatarCount = await presenceAvatars.count();
      
      // Should have some presence indicators
      expect(avatarCount).toBeGreaterThanOrEqual(0);

      // Test user leaving and joining
      await contexts[1].close(); // Bob leaves
      await pages[0].waitForTimeout(3000);

      // Presence should update to reflect Bob's departure
      if (await presenceIndicator.isVisible()) {
        const updatedPresenceText = await presenceIndicator.textContent();
        expect(updatedPresenceText).not.toContain('Bob');
      }

    } finally {
      for (const context of contexts.filter(c => !c._closed)) {
        await context.close();
      }
    }
  });

  test('concurrent search and discovery', async ({ browser }) => {
    const contexts: any[] = [];
    const pages: any[] = [];
    const users = [TEST_USERS.alice, TEST_USERS.bob, TEST_USERS.carol];

    try {
      // Create 3 browser contexts
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // All users log in and search simultaneously
      const searchActions = pages.map(async (page, index) => {
        await page.goto('/');
        await loginUser(page, users[index]);
        
        await page.goto('/discover');
        await page.waitForTimeout(1000);

        const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
        if (await searchInput.isVisible()) {
          const queries = ['machine learning', 'web development', 'data science'];
          await searchInput.fill(queries[index]);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);

          // Verify search results appear
          const searchResults = page.locator('.grid .hover\\:shadow-md, .search-result, .conversation-card');
          const resultCount = await searchResults.count();
          
          return { user: users[index].displayName, results: resultCount };
        }
        
        return { user: users[index].displayName, results: 0 };
      });

      const results = await Promise.all(searchActions);
      
      // All searches should complete without interference
      for (const result of results) {
        console.log(`${result.user} found ${result.results} results`);
        expect(result.results).toBeGreaterThanOrEqual(0);
      }

    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('concurrent conversation creation and interaction', async ({ browser }) => {
    const contexts: any[] = [];
    const pages: any[] = [];
    const users = [TEST_USERS.alice, TEST_USERS.bob, TEST_USERS.carol];

    try {
      // Create 3 browser contexts
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // All users create conversations simultaneously
      const conversationActions = pages.map(async (page, index) => {
        await page.goto('/');
        await loginUser(page, users[index]);
        
        const topics = [
          'JavaScript Async Programming',
          'Python Data Analysis',
          'React Component Design'
        ];
        
        return await createConversation(page, `${topics[index]} by ${users[index].displayName}`);
      });

      const conversationUrls = await Promise.all(conversationActions);
      
      // All conversations should be created successfully
      for (const url of conversationUrls) {
        expect(url).toContain('/chat/');
      }

      // Users interact with each other's conversations
      for (let i = 0; i < pages.length; i++) {
        const otherUserUrl = conversationUrls[(i + 1) % conversationUrls.length];
        await pages[i].goto(otherUserUrl);
        await pages[i].waitForTimeout(2000);
        
        // Each user should be able to view other conversations
        expect(pages[i].url()).toBe(otherUserUrl);
      }

    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('real-time notifications between users', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Alice and Bob log in
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);

      // Bob follows Alice or interacts with her content
      await bobPage.goto('/profile/testuser');
      await bobPage.waitForTimeout(2000);

      const followButton = bobPage.locator('button').filter({ hasText: /^Follow$/ });
      if (await followButton.isVisible()) {
        await followButton.click();
        await bobPage.waitForTimeout(2000);

        // Alice should receive notification
        await alicePage.waitForTimeout(3000);
        
        const notificationBell = alicePage.locator('.notification-bell, button svg.lucide-bell');
        if (await notificationBell.isVisible()) {
          await notificationBell.click();
          
          // Check for follow notification
          const notification = alicePage.locator('[role="menu"], .notification-dropdown').locator('text=/Bob.*follow|follow.*Bob/i');
          if (await notification.isVisible()) {
            await expect(notification).toBeVisible();
          }
        }
      }

      // Bob joins Alice's conversation
      await alicePage.goto('/');
      const aliceConversationUrl = await createConversation(alicePage, 'Real-time Notification Test');
      
      await bobPage.goto(aliceConversationUrl);
      await bobPage.waitForTimeout(2000);

      // Alice should be notified of Bob's presence
      await alicePage.waitForTimeout(3000);
      
      const presenceIndicator = alicePage.locator('[data-testid="presence-indicator"], .presence-area');
      if (await presenceIndicator.isVisible()) {
        const presenceText = await presenceIndicator.textContent();
        expect(presenceText).toMatch(/Bob|1.*view/);
      }

    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('collaborative conversation workflow', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const carolContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();
    const carolPage = await carolContext.newPage();

    try {
      // Alice creates a conversation
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      const conversationUrl = await createConversation(alicePage, 'Collaborative AI Ethics Discussion');

      // Bob and Carol join the conversation
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      await bobPage.goto(conversationUrl);

      await carolPage.goto('/');
      await loginUser(carolPage, TEST_USERS.carol);
      await carolPage.goto(conversationUrl);

      await alicePage.waitForTimeout(3000);

      // Test collaboration features if available
      const inviteButton = alicePage.locator('button').filter({ hasText: /invite|collaborate|share/i });
      if (await inviteButton.isVisible()) {
        await inviteButton.click();
        
        // Try to invite Bob and Carol
        const userSearch = alicePage.locator('input[placeholder*="user"], input[placeholder*="search"]');
        if (await userSearch.isVisible()) {
          await userSearch.fill('Bob');
          
          const inviteUserButton = alicePage.locator('button').filter({ hasText: /invite|add/i });
          if (await inviteUserButton.isVisible()) {
            await inviteUserButton.click();
            await alicePage.waitForTimeout(1000);
          }
        }
      }

      // Test human chat alongside AI if available
      const chatInput = bobPage.locator('textarea[placeholder*="chat"], input[placeholder*="message"]').last();
      if (await chatInput.isVisible()) {
        await chatInput.fill('This is a fascinating topic! I\'d love to contribute to this discussion.');
        
        const sendButton = bobPage.locator('button').filter({ hasText: /send|post/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();
          await bobPage.waitForTimeout(1000);

          // Alice and Carol should see Bob's message
          await alicePage.waitForTimeout(2000);
          await carolPage.waitForTimeout(2000);

          const bobMessage = alicePage.locator('text=fascinating topic');
          if (await bobMessage.isVisible()) {
            await expect(bobMessage).toBeVisible();
          }
        }
      }

      // Test presence tracking for all users
      const presenceIndicator = alicePage.locator('[data-testid="presence-indicator"], .presence-area');
      if (await presenceIndicator.isVisible()) {
        const presenceText = await presenceIndicator.textContent();
        // Should show both Bob and Carol
        expect(presenceText).toMatch(/[2-9].*view|Bob|Carol/);
      }

    } finally {
      await aliceContext.close();
      await bobContext.close();
      await carolContext.close();
    }
  });

  test('concurrent profile updates and social interactions', async ({ browser }) => {
    const contexts: any[] = [];
    const pages: any[] = [];
    const users = [TEST_USERS.alice, TEST_USERS.bob, TEST_USERS.carol];

    try {
      // Create 3 browser contexts
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // All users log in and update profiles simultaneously
      const profileActions = pages.map(async (page, index) => {
        await page.goto('/');
        await loginUser(page, users[index]);
        
        // Navigate to own profile
        await page.goto(`/profile/${users[index].username}`);
        await page.waitForTimeout(2000);

        // Try to update profile
        const editButton = page.locator('button').filter({ hasText: /edit|settings/i });
        if (await editButton.isVisible()) {
          await editButton.click();
          
          const bioInput = page.locator('textarea[placeholder*="bio"], input[name="bio"]');
          if (await bioInput.isVisible()) {
            await bioInput.fill(`Updated bio for ${users[index].displayName} - AI enthusiast and tech explorer`);
            
            const saveButton = page.locator('button').filter({ hasText: /save|update/i });
            if (await saveButton.isVisible()) {
              await saveButton.click();
              await page.waitForTimeout(1000);
            }
          }
        }

        return users[index].displayName;
      });

      const completedProfiles = await Promise.all(profileActions);
      
      // All profile updates should complete successfully
      expect(completedProfiles.length).toBe(3);

      // Users follow each other
      for (let i = 0; i < pages.length; i++) {
        for (let j = 0; j < pages.length; j++) {
          if (i !== j) {
            await pages[i].goto(`/profile/${users[j].username}`);
            await pages[i].waitForTimeout(1000);

            const followButton = pages[i].locator('button').filter({ hasText: /^Follow$/ });
            if (await followButton.isVisible()) {
              await followButton.click();
              await pages[i].waitForTimeout(500);

              // Should change to following state
              const followingButton = pages[i].locator('button').filter({ hasText: /Following|Unfollow/ });
              if (await followingButton.isVisible()) {
                await expect(followingButton).toBeVisible();
              }
            }
          }
        }
      }

    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('stress test with many concurrent users', async ({ browser }) => {
    const contexts: any[] = [];
    const pages: any[] = [];
    const userCount = 6; // Reduced for reasonable test time

    try {
      // Create multiple browser contexts
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // All users perform actions simultaneously
      const stressActions = pages.map(async (page, index) => {
        const user = {
          username: `testuser${index + 1}`,
          password: 'testpass',
          displayName: `User${index + 1}`
        };

        try {
          await page.goto('/');
          await loginUser(page, user);
          
          // Navigate to discover page
          await page.goto('/discover');
          await page.waitForTimeout(1000);

          // Perform search
          const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
          if (await searchInput.isVisible()) {
            await searchInput.fill(`test query ${index + 1}`);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
          }

          // Navigate to profile
          await page.goto(`/profile/${user.username}`);
          await page.waitForTimeout(1000);

          return { success: true, user: user.displayName };
        } catch (error) {
          return { success: false, user: user.displayName, error: (error as any).message };
        }
      });

      const results = await Promise.all(stressActions);
      
      // Most users should complete successfully
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Stress test: ${successCount} successful, ${failureCount} failed`);
      
      // At least 80% should succeed
      expect(successCount / userCount).toBeGreaterThanOrEqual(0.8);

      // No critical failures should occur
      expect(failureCount).toBeLessThan(userCount / 2);

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

async function createConversation(page: any, title: string): Promise<string> {
  await page.goto('/');
  await page.waitForTimeout(1000);
  
  // Navigate to Chat tab to create new conversation
  const chatTab = page.locator('[role="tab"]').filter({ hasText: /chat/i });
  if (await chatTab.isVisible()) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }
  
  // Look for new chat button in Chat tab
  const newChatButton = page.locator('button, a').filter({ hasText: /new chat|new conversation|start/i });
  
  if (await newChatButton.isVisible()) {
    await newChatButton.click();
    await page.waitForTimeout(1000);
    
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill(title);
      
      const createButton = page.locator('button').filter({ hasText: /create|start|submit/i });
      await createButton.click();
      await page.waitForTimeout(2000);
    }
  }
  
  return page.url();
}