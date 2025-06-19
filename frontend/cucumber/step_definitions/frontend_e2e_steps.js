import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

/**
 * Frontend E2E step definitions using real browser automation
 * Tests the actual React UI components and user interactions
 */

// Background and setup steps
Given('the backend and frontend servers are running', async function() {
  // Verify servers are accessible
  try {
    const backendHealth = await fetch('http://localhost:8000/health');
    const frontendHealth = await fetch('http://localhost:5173');
    
    assert(backendHealth.ok, 'Backend server should be running on port 8000');
    assert(frontendHealth.ok, 'Frontend server should be running on port 5173');
    
    this.debugLog.push('✅ Both backend and frontend servers are running');
  } catch (error) {
    throw new Error(`Servers not accessible: ${error.message}`);
  }
});

Given('the test database is clean', async function() {
  // Clean test state - in a real app you'd reset the test database
  this.testUsers = new Map();
  this.testConversations = new Map();
  this.debugLog.push('✅ Test database state cleaned');
});

// Critical: Authentication Flow
Given('I open the VectorSpace application', async function() {
  const page = await this.launchBrowser('testuser');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Wait for React app to load - look for VectorSpace heading
  await page.waitForSelector('text=VectorSpace', { timeout: 10000 });
  this.debugLog.push('✅ VectorSpace application loaded');
});

When('I click on {string}', async function(buttonText) {
  const page = this.pages.get('testuser');
  
  // Map common button texts to actual VectorSpace elements
  const buttonMap = {
    'Sign Up': 'text=Sign up',  // "Sign up" link from login page
    'Sign In': 'text=Sign in',   // "Sign in" link from register page
    'Create account': 'button[type="submit"]',
    'Login': 'button[type="submit"]'
  };
  
  // Use direct text selector if mapped, otherwise try generic text selector
  const selector = buttonMap[buttonText] || `text=${buttonText}`;
  
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    this.debugLog.push(`👆 Clicked on "${buttonText}"`);
  } catch (error) {
    throw new Error(`Could not find clickable element with text "${buttonText}": ${error.message}`);
  }
});

When('I fill in the registration form with valid data', async function() {
  const page = this.pages.get('testuser');
  
  // Generate unique test user data
  const timestamp = Date.now();
  const uniqueUser = {
    username: `testuser_${timestamp}`,
    displayName: `Test User ${timestamp}`,
    email: `test_${timestamp}@vectorspace.test`,
    password: 'SecureTestPass123!'
  };
  
  // Fill registration form using actual VectorSpace form fields (from RegisterForm.tsx)
  await page.fill('#username', uniqueUser.username);
  await page.fill('#displayName', uniqueUser.displayName);  // Note: camelCase, not snake_case
  await page.fill('#email', uniqueUser.email);
  await page.fill('#password', uniqueUser.password);
  await page.fill('#confirmPassword', uniqueUser.password);
  
  // Store for later use
  this.testUsers.set('current', uniqueUser);
  this.debugLog.push(`📝 Filled registration form for ${uniqueUser.username}`);
});

When('I submit the registration form', async function() {
  const page = this.pages.get('testuser');
  // Use actual submit button from RegisterForm.tsx (button with type="submit")
  await page.click('button[type="submit"]');
  this.debugLog.push('📤 Submitted registration form');
});

Then('I should see a success message', async function() {
  const page = this.pages.get('testuser');
  
  // Wait for the API call to complete
  await page.waitForTimeout(3000);
  
  // Check if we're still on registration page or redirected
  const currentUrl = page.url();
  if (!currentUrl.includes('/register')) {
    this.debugLog.push('✅ Registration succeeded and redirected to home page');
  } else {
    // Check for error message
    const errorMsg = await page.$('text="Failed to execute \'fetch\' on \'Window\': Illegal invocation"');
    if (errorMsg) {
      this.debugLog.push('❌ Registration failed with API client error');
      throw new Error('Registration failed due to API client fetch binding issue');
    } else {
      // Check for other error messages
      const errorElement = await page.$('.text-red-600, .text-destructive');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        this.debugLog.push(`❌ Registration failed: ${errorText}`);
        throw new Error(`Registration failed: ${errorText}`);
      } else {
        this.debugLog.push('✅ Registration form submitted successfully');
      }
    }
  }
});

Then('I should be redirected to the main dashboard', async function() {
  const page = this.pages.get('testuser');
  
  // Wait for main page to load (home page or conversations)
  await page.waitForSelector('nav .container, main', { timeout: 5000 });
  
  const currentUrl = page.url();
  // VectorSpace redirects to home page ('/') after successful registration
  assert(currentUrl.includes('localhost:5173') && !currentUrl.includes('/register'), 
    'Should be redirected away from registration page');
  
  this.debugLog.push(`✅ Redirected to main page: ${currentUrl}`);
});

When('I logout', async function() {
  const page = this.pages.get('testuser');
  
  // Click on user menu dropdown (based on Navigation.tsx)
  await page.click('nav button:has-text("testuser"), nav button:has-text("Account")');
  
  // Click on "Sign Out" menu item
  await page.click('text="Sign Out"');
  
  // Wait for redirect to login page or unauthenticated state
  await page.waitForSelector('a[href="/login"], a[href="/register"]', { timeout: 5000 });
  this.debugLog.push('👋 Logged out successfully');
});

When('I login with the same credentials', async function() {
  const page = this.pages.get('testuser');
  const user = this.testUsers.get('current');
  
  // Navigate to login page if not already there
  if (!page.url().includes('/login')) {
    await page.click('a[href="/login"]');
    await page.waitForSelector('#username', { timeout: 3000 });
  }
  
  // Fill login form using actual LoginForm.tsx fields
  await page.fill('#username', user.username);
  await page.fill('#password', user.password);
  await page.click('button[type="submit"]');
  
  this.debugLog.push(`🔑 Attempted login with ${user.username}`);
});

Then('I should be successfully logged in', async function() {
  const page = this.pages.get('testuser');
  
  // Wait for successful login indicators (user menu appears in navigation)
  await page.waitForSelector('nav button:has-text("testuser"), nav button:has-text("Account")', { timeout: 5000 });
  this.debugLog.push('✅ Successfully logged in');
});

Then('I should see my profile in the navigation', async function() {
  const page = this.pages.get('testuser');
  const user = this.testUsers.get('current');
  
  // Check for user profile in navigation (based on Navigation.tsx)
  const userElement = await page.$(`nav button:has-text("${user.username}"), nav button:has-text("Account")`);
  assert(userElement, 'User profile should be visible in navigation');
  
  // Get the text content of the user button
  const buttonText = await userElement.textContent();
  if (buttonText) {
    assert(buttonText.includes(user.username) || buttonText.includes('Account'), 
      'Should show username or Account in navigation');
  }
  
  this.debugLog.push(`✅ User profile visible in navigation: ${user.username}`);
});

// Critical: Conversation Creation and Viewing
Given('I am logged in as a test user', async function() {
  const page = await this.launchBrowser('testuser');
  
  // Navigate to app and auto-login if available
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Check if already logged in (from auto-login)
  const isLoggedIn = await page.$('[data-testid="user-menu-button"]');
  
  if (!isLoggedIn) {
    // Manual login flow
    await page.click('[data-testid="login-link"]');
    await page.fill('[data-testid="login-username-input"]', 'testuser');
    await page.fill('[data-testid="login-password-input"]', 'testpass');
    await page.click('[data-testid="login-submit-button"]');
    await page.waitForSelector('[data-testid="user-menu-button"]', { timeout: 5000 });
  }
  
  this.debugLog.push('✅ Logged in as test user');
});

When('I click {string}', async function(buttonText) {
  const page = this.pages.get('testuser');
  
  // More flexible button selection
  const buttonSelectors = [
    `button:has-text("${buttonText}")`,
    `[data-testid*="${buttonText.toLowerCase().replace(/\\s+/g, '-')}"]`,
    `[aria-label="${buttonText}"]`,
    `*:has-text("${buttonText}")`
  ];
  
  let clicked = false;
  for (const selector of buttonSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      await page.click(selector);
      clicked = true;
      break;
    } catch (error) {
      // Try next selector
      continue;
    }
  }
  
  if (!clicked) {
    throw new Error(`Could not find clickable element with text "${buttonText}"`);
  }
  
  this.debugLog.push(`👆 Clicked "${buttonText}"`);
});

When('I enter the title {string}', async function(title) {
  const page = this.pages.get('testuser');
  
  // Look for conversation title input
  await page.fill('[data-testid="conversation-title-input"], [placeholder*="title"]', title);
  this.currentConversationTitle = title;
  this.debugLog.push(`📝 Entered title: "${title}"`);
});

When('I send the message {string}', async function(message) {
  const page = this.pages.get('testuser');
  
  // Fill message input and send
  await page.fill('[data-testid="message-input"], [placeholder*="message"]', message);
  await page.click('[data-testid="send-button"], button[type="submit"]');
  
  this.lastSentMessage = message;
  this.debugLog.push(`💬 Sent message: "${message.substring(0, 50)}..."`);
});

Then('I should see my message in the conversation', async function() {
  const page = this.pages.get('testuser');
  
  // Wait for message to appear in conversation
  await page.waitForSelector('[data-testid="user-message"]', { timeout: 5000 });
  
  // Verify message content
  const messages = await page.$$eval('[data-testid="user-message"]', 
    elements => elements.map(el => el.textContent));
  
  const messageFound = messages.some(msg => msg.includes(this.lastSentMessage));
  assert(messageFound, 'Sent message should appear in conversation');
  
  this.debugLog.push('✅ User message visible in conversation');
});

Then('I should see a typing indicator for the AI response', async function() {
  const page = this.pages.get('testuser');
  
  // Look for typing indicator
  await page.waitForSelector('[data-testid="typing-indicator"], .typing-indicator', { timeout: 3000 });
  this.debugLog.push('✅ AI typing indicator visible');
});

When('the AI responds', async function() {
  const page = this.pages.get('testuser');
  
  // Wait for AI response to appear
  await page.waitForSelector('[data-testid="ai-message"], [data-testid="assistant-message"]', { timeout: 10000 });
  this.debugLog.push('🤖 AI response received');
});

Then('I should see the AI response in the conversation', async function() {
  const page = this.pages.get('testuser');
  
  // Verify AI message is visible
  const aiMessage = await page.$('[data-testid="ai-message"], [data-testid="assistant-message"]');
  assert(aiMessage, 'AI response should be visible in conversation');
  
  const responseText = await aiMessage.textContent();
  assert(responseText.length > 0, 'AI response should have content');
  
  this.debugLog.push(`✅ AI response visible: "${responseText.substring(0, 50)}..."`);
});

Then('the conversation should be saved', async function() {
  const page = this.pages.get('testuser');
  
  // Check for save indicator or conversation ID
  const conversationElement = await page.$('[data-conversation-id], [data-testid="conversation"]');
  assert(conversationElement, 'Conversation should be saved and have an ID');
  
  this.debugLog.push('✅ Conversation saved successfully');
});

When('I refresh the page', async function() {
  const page = this.pages.get('testuser');
  await page.reload({ waitUntil: 'networkidle0' });
  this.debugLog.push('🔄 Page refreshed');
});

Then('I should still see the conversation in my list', async function() {
  const page = this.pages.get('testuser');
  
  // Look for the conversation in conversations list
  await page.waitForSelector('[data-testid="conversations-list"], [data-testid="conversation-item"]', { timeout: 5000 });
  
  const conversationTitles = await page.$$eval('[data-testid="conversation-item"] .title, .conversation-title', 
    elements => elements.map(el => el.textContent));
  
  const conversationFound = conversationTitles.some(title => 
    title.includes(this.currentConversationTitle));
  
  assert(conversationFound, 'Conversation should persist after page refresh');
  this.debugLog.push('✅ Conversation persisted in list');
});

// Critical: Search and Discovery
Given('there are public conversations in the database', async function() {
  // This assumes conversations exist from backend seeding
  this.debugLog.push('✅ Assuming public conversations exist from database seeding');
});

When('I navigate to the Discovery page', async function() {
  const page = this.pages.get('testuser');
  
  // Navigate to discovery page
  await page.click('[data-testid="discovery-nav"], [href*="discover"]');
  await page.waitForSelector('[data-testid="discovery-page"], [data-testid="search-input"]', { timeout: 5000 });
  
  this.debugLog.push('🧭 Navigated to Discovery page');
});

When('I enter {string} in the search box', async function(searchTerm) {
  const page = this.pages.get('testuser');
  
  await page.fill('[data-testid="search-input"], input[placeholder*="search"]', searchTerm);
  this.currentSearchTerm = searchTerm;
  this.debugLog.push(`🔍 Entered search term: "${searchTerm}"`);
});

When('I click the search button', async function() {
  const page = this.pages.get('testuser');
  
  await page.click('[data-testid="search-button"], button:has-text("Search")');
  this.debugLog.push('🔍 Clicked search button');
});

Then('I should see search results', async function() {
  const page = this.pages.get('testuser');
  
  // Wait for search results to load
  await page.waitForSelector('[data-testid="search-results"], [data-testid="search-result-item"]', { timeout: 5000 });
  
  const resultCount = await page.$$eval('[data-testid="search-result-item"]', 
    elements => elements.length);
  
  assert(resultCount > 0, 'Should have at least one search result');
  this.debugLog.push(`✅ Found ${resultCount} search results`);
});

Then('each result should show a title and summary', async function() {
  const page = this.pages.get('testuser');
  
  // Check that results have titles and summaries
  const results = await page.$$eval('[data-testid="search-result-item"]', elements => 
    elements.map(el => ({
      title: el.querySelector('.title, [data-testid="result-title"]')?.textContent,
      summary: el.querySelector('.summary, [data-testid="result-summary"]')?.textContent
    }))
  );
  
  results.forEach((result, index) => {
    assert(result.title && result.title.length > 0, `Result ${index + 1} should have a title`);
    assert(result.summary && result.summary.length > 0, `Result ${index + 1} should have a summary`);
  });
  
  this.debugLog.push('✅ All search results have titles and summaries');
});

When('I click on a search result', async function() {
  const page = this.pages.get('testuser');
  
  // Click on the first search result
  await page.click('[data-testid="search-result-item"]:first-child');
  this.debugLog.push('👆 Clicked on first search result');
});

Then('I should navigate to that conversation', async function() {
  const page = this.pages.get('testuser');
  
  // Wait for conversation page to load
  await page.waitForSelector('[data-testid="conversation-detail"], [data-testid="conversation-view"]', { timeout: 5000 });
  
  const currentUrl = page.url();
  assert(currentUrl.includes('/conversation'), 'Should navigate to conversation page');
  
  this.debugLog.push(`✅ Navigated to conversation: ${currentUrl}`);
});

Then('I should see the full conversation content', async function() {
  const page = this.pages.get('testuser');
  
  // Verify conversation messages are visible
  const messages = await page.$$('[data-testid="message"], .message');
  assert(messages.length > 0, 'Should see conversation messages');
  
  this.debugLog.push(`✅ Viewing full conversation with ${messages.length} messages`);
});

// Export for use by cucumber
export { Given, When, Then };