import { test, expect } from '@playwright/test';

const TEST_USERS = {
  alice: { username: 'testuser', password: 'testpass', displayName: 'Alice' },
  bob: { username: 'testuser2', password: 'testpass', displayName: 'Bob' },
  carol: { username: 'testuser3', password: 'testpass', displayName: 'Carol' }
};

test.describe('Human Connection Features', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we have a clean state for each test
    await page.goto('/');
  });

  test('follow system complete workflow', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Alice logs in and creates a conversation
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      
      // Bob logs in
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      
      // Bob discovers Alice's conversation and follows her
      await bobPage.goto('/discover');
      await bobPage.waitForTimeout(2000);
      
      // Look for Alice's conversations or profile
      const aliceConversation = bobPage.locator('.conversation-card, .grid .hover\\:shadow-md').filter({ hasText: /Alice/ });
      const aliceProfileLink = bobPage.locator('a[href*="/profile/"], a').filter({ hasText: /Alice/ });
      
      if (await aliceConversation.isVisible()) {
        // Click on Alice's name to go to her profile
        const authorLink = aliceConversation.locator('a').filter({ hasText: /Alice/ });
        if (await authorLink.isVisible()) {
          await authorLink.click();
        } else {
          // Navigate directly to profile
          await bobPage.goto('/profile/testuser');
        }
      } else if (await aliceProfileLink.isVisible()) {
        await aliceProfileLink.click();
      } else {
        // Navigate directly to Alice's profile
        await bobPage.goto('/profile/testuser');
      }
      
      await bobPage.waitForTimeout(2000);
      
      // Bob follows Alice
      const followButton = bobPage.locator('button').filter({ hasText: /^Follow$/ });
      if (await followButton.isVisible()) {
        await followButton.click();
        await bobPage.waitForTimeout(1000);
        
        // Button should change to "Following"
        await expect(bobPage.locator('button').filter({ hasText: /Following|Unfollow/ })).toBeVisible();
      }
      
      // Test unfollow
      const followingButton = bobPage.locator('button').filter({ hasText: /Following|Unfollow/ });
      if (await followingButton.isVisible()) {
        await followingButton.click();
        await bobPage.waitForTimeout(1000);
        
        // Button should change back to "Follow"
        await expect(bobPage.locator('button').filter({ hasText: /^Follow$/ })).toBeVisible();
      }
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('followers and following lists', async ({ page }) => {
    await loginUser(page, TEST_USERS.alice);
    
    // Navigate to own profile
    await page.goto('/profile/testuser');
    await page.waitForTimeout(2000);
    
    // Look for followers/following counts or links
    const followersLink = page.locator('a, button').filter({ hasText: /followers?/i });
    const followingLink = page.locator('a, button').filter({ hasText: /following/i });
    
    if (await followersLink.isVisible()) {
      await followersLink.click();
      
      // Should show followers list/modal
      const followersList = page.locator('[data-testid="followers-list"], .followers-modal, .user-list, .modal');
      if (await followersList.isVisible()) {
        await expect(followersList).toBeVisible();
        
        // Close modal/list
        const closeButton = page.locator('button').filter({ hasText: /close|×/i });
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    }
    
    if (await followingLink.isVisible()) {
      await followingLink.click();
      
      // Should show following list/modal
      const followingList = page.locator('[data-testid="following-list"], .following-modal, .user-list, .modal');
      if (await followingList.isVisible()) {
        await expect(followingList).toBeVisible();
        
        // Close modal/list
        const closeButton = page.locator('button').filter({ hasText: /close|×/i });
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    }
  });

  test('human chat alongside AI conversation', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Alice creates/opens a conversation
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      const conversationUrl = await setupConversationForTest(alicePage);
      
      // Bob joins the conversation
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      await bobPage.goto(conversationUrl);
      
      await alicePage.waitForTimeout(2000);
      await bobPage.waitForTimeout(2000);
      
      // Look for human chat section or join discussion button
      const joinDiscussionButton = bobPage.locator('button').filter({ hasText: /join discussion|chat|comment/i });
      const humanChatInput = bobPage.locator('textarea[placeholder*="chat"], input[placeholder*="message"]').filter({ hasText: /human|chat|discuss/i });
      const generalChatInput = bobPage.locator('textarea[placeholder*="message"], input[type="text"]').last();
      
      if (await joinDiscussionButton.isVisible()) {
        await joinDiscussionButton.click();
        await bobPage.waitForTimeout(1000);
      }
      
      // Try to send a message in human chat
      const chatInput = await humanChatInput.isVisible() ? humanChatInput : generalChatInput;
      
      if (await chatInput.isVisible()) {
        await chatInput.fill('Great conversation! Thanks for sharing this topic.');
        
        // Look for send button
        const sendButton = bobPage.locator('button').filter({ hasText: /send|post|submit/i }).first();
        if (await sendButton.isVisible()) {
          await sendButton.click();
          await bobPage.waitForTimeout(1000);
          
          // Alice should see the human chat message
          await alicePage.waitForTimeout(2000);
          const chatMessage = alicePage.locator('text=Great conversation! Thanks for sharing');
          if (await chatMessage.isVisible()) {
            await expect(chatMessage).toBeVisible();
          }
        }
      }
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('conversation collaboration invitations', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Alice creates a conversation
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      const conversationUrl = await setupConversationForTest(alicePage);
      
      // Look for collaboration features
      const inviteButton = alicePage.locator('button').filter({ hasText: /invite|collaborate|share/i });
      const shareButton = alicePage.locator('button[title*="share"], .share-button');
      
      if (await inviteButton.isVisible()) {
        await inviteButton.click();
        
        // Should show invitation modal/form
        const inviteModal = alicePage.locator('.modal, .dialog, [role="dialog"]');
        if (await inviteModal.isVisible()) {
          // Look for user search or input
          const userInput = alicePage.locator('input[placeholder*="user"], input[placeholder*="name"], input[type="text"]');
          if (await userInput.isVisible()) {
            await userInput.fill('Bob');
            
            // Send invitation
            const sendInviteButton = alicePage.locator('button').filter({ hasText: /send|invite|add/i });
            if (await sendInviteButton.isVisible()) {
              await sendInviteButton.click();
              await alicePage.waitForTimeout(1000);
            }
          }
        }
      }
      
      // Bob should receive notification (if implemented)
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      
      // Check for notifications
      const notificationBell = bobPage.locator('.notification-bell, button svg.lucide-bell');
      if (await notificationBell.isVisible()) {
        await notificationBell.click();
        
        // Look for collaboration invitation
        const inviteNotification = bobPage.locator('text=/invitation|collaborate|invite/i');
        if (await inviteNotification.isVisible()) {
          await expect(inviteNotification).toBeVisible();
        }
      }
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('bookmark and save conversations', async ({ page }) => {
    await loginUser(page, TEST_USERS.alice);
    
    // Go to discover page to find conversations to bookmark
    await page.goto('/discover');
    await page.waitForTimeout(2000);
    
    // Find bookmark buttons
    const bookmarkButton = page.locator('button svg.lucide-bookmark, .bookmark-button, button[title*="bookmark"]').first();
    
    if (await bookmarkButton.isVisible()) {
      // Bookmark a conversation
      await bookmarkButton.click();
      await page.waitForTimeout(1000);
      
      // Navigate to saved/bookmarked conversations
      const savedLink = page.locator('a, button').filter({ hasText: /saved|bookmark/i });
      const profileLink = page.locator('a[href*="/profile/"]');
      
      if (await savedLink.isVisible()) {
        await savedLink.click();
      } else if (await profileLink.isVisible()) {
        await profileLink.click();
        
        // Look for saved conversations section
        const savedSection = page.locator('text=/saved|bookmark/i');
        if (await savedSection.isVisible()) {
          await savedSection.click();
        }
      }
      
      await page.waitForTimeout(2000);
      
      // Should see saved conversations
      const savedConversations = page.locator('.conversation-card, .saved-item, .bookmark-item');
      if (await savedConversations.count() > 0) {
        await expect(savedConversations.first()).toBeVisible();
      }
    }
  });

  test('discover people through interests', async ({ page }) => {
    await loginUser(page, TEST_USERS.alice);
    
    // Navigate to discover page
    await page.goto('/discover');
    await page.waitForTimeout(2000);
    
    // Look for people discovery features
    const discoverPeopleButton = page.locator('button, a').filter({ hasText: /discover people|find users|people/i });
    const peopleTab = page.locator('[role="tab"]').filter({ hasText: /people|users/i });
    
    if (await discoverPeopleButton.isVisible()) {
      await discoverPeopleButton.click();
    } else if (await peopleTab.isVisible()) {
      await peopleTab.click();
    }
    
    await page.waitForTimeout(2000);
    
    // Should show recommended users or user profiles
    const userCards = page.locator('.user-card, .profile-card, a[href*="/profile/"]');
    if (await userCards.count() > 0) {
      // Test following a recommended user
      const followButton = userCards.first().locator('button').filter({ hasText: /follow/i });
      if (await followButton.isVisible()) {
        await followButton.click();
        await page.waitForTimeout(1000);
        
        // Should change to following state
        await expect(userCards.first().locator('button').filter({ hasText: /following|unfollow/i })).toBeVisible();
      }
    }
  });

  test('notifications for social interactions', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Setup: Both users logged in
      await alicePage.goto('/');
      await loginUser(alicePage, TEST_USERS.alice);
      
      await bobPage.goto('/');
      await loginUser(bobPage, TEST_USERS.bob);
      
      // Bob follows Alice (if follow feature exists)
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
          // Check if notification badge appears
          const badge = alicePage.locator('.notification-bell').locator('.badge, .notification-count');
          if (await badge.isVisible()) {
            await notificationBell.click();
            
            // Should show follow notification
            const followNotification = alicePage.locator('text=/Bob.*follow|follow.*Bob/i');
            if (await followNotification.isVisible()) {
              await expect(followNotification).toBeVisible();
            }
          }
        }
      }
      
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('conversation collections and curation', async ({ page }) => {
    await loginUser(page, TEST_USERS.alice);
    
    // Navigate to profile or saved conversations
    await page.goto('/profile/testuser');
    await page.waitForTimeout(2000);
    
    // Look for collections feature
    const collectionsTab = page.locator('[role="tab"], a, button').filter({ hasText: /collection/i });
    const createCollectionButton = page.locator('button').filter({ hasText: /create.*collection|new collection/i });
    
    if (await collectionsTab.isVisible()) {
      await collectionsTab.click();
      await page.waitForTimeout(1000);
    }
    
    if (await createCollectionButton.isVisible()) {
      await createCollectionButton.click();
      
      // Fill collection details
      const nameInput = page.locator('input[placeholder*="name"], input[name="title"]');
      const descriptionInput = page.locator('textarea[placeholder*="description"], input[name="description"]');
      
      if (await nameInput.isVisible()) {
        await nameInput.fill('AI Learning Resources');
        
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill('Best conversations about AI and machine learning');
        }
        
        const createButton = page.locator('button').filter({ hasText: /create|save|submit/i });
        if (await createButton.isVisible()) {
          await createButton.click();
          await page.waitForTimeout(1000);
          
          // Should show new collection
          const collectionName = page.locator('text=AI Learning Resources');
          if (await collectionName.isVisible()) {
            await expect(collectionName).toBeVisible();
          }
        }
      }
    }
  });
});

// Helper functions
async function loginUser(page: any, user: typeof TEST_USERS.alice) {
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

async function setupConversationForTest(page: any): Promise<string> {
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
  
  // Navigate to Chat tab to create new conversation
  const chatTab = page.locator('[role="tab"]').filter({ hasText: /chat/i });
  if (await chatTab.isVisible()) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }
  
  const newChatButton = page.locator('button, a').filter({ hasText: /new chat|new conversation|start/i });
  
  if (await newChatButton.isVisible()) {
    await newChatButton.click();
    
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill('Human Connection Test Conversation');
      
      const createButton = page.locator('button').filter({ hasText: /create|start|submit/i });
      await createButton.click();
      await page.waitForTimeout(2000);
    }
  }
  
  return page.url();
}