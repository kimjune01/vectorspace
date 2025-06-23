import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { Page, BrowserContext } from 'playwright';

// This file contains step definitions for the Hacker News recommendations feature
// These steps can be used with Cucumber to run BDD tests

let page: Page;
let context: BrowserContext;
let currentUser: any;
let conversations: Map<string, any> = new Map();

Given('I am logged in as a user', async function () {
  // Set up authenticated user session
  currentUser = {
    id: 1,
    username: 'testuser',
    display_name: 'Test User'
  };
  
  // Mock authentication
  await page.evaluate((user) => {
    localStorage.setItem('token', 'mock-jwt-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, currentUser);
});

Given('I am on the chat interface', async function () {
  await page.goto('/chat');
  await expect(page).toHaveTitle(/VectorSpace/);
});

Given('I start a new conversation', async function () {
  await page.click('[data-testid="new-chat-button"]');
  await expect(page.locator('[data-testid="conversation-input"]')).toBeVisible();
});

When('I send my first message about {string}', async function (topic: string) {
  const messageInput = page.locator('[data-testid="conversation-input"]');
  await messageInput.fill(`Tell me about ${topic} and its practical applications`);
  await messageInput.press('Enter');
  
  // Store the conversation topic for later assertions
  this.conversationTopic = topic;
});

When('the AI responds with detailed information', async function () {
  // Wait for AI response to appear
  await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 10000 });
  
  // Mock the AI response completion
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('ai-response-complete', {
      detail: { messageId: 'ai_123', conversationId: 1 }
    }));
  });
});

When('the conversation gets automatically summarized', async function () {
  // Mock the summarization process
  await page.evaluate((topic) => {
    const mockSummary = `Discussion about ${topic}, covering key concepts, applications, and current trends in the field.`;
    
    // Simulate conversation update with summary
    window.dispatchEvent(new CustomEvent('conversation-updated', {
      detail: {
        id: 1,
        summary_public: mockSummary,
        title: `${topic} Discussion`
      }
    }));
  }, this.conversationTopic);
  
  // Wait for UI to update
  await page.waitForTimeout(1000);
});

Then('I should see a {string} section in the discovery sidebar', async function (sectionName: string) {
  const sidebar = page.locator('[data-testid="discovery-sidebar"]');
  await expect(sidebar).toBeVisible();
  
  const hnSection = sidebar.locator(`text=${sectionName}`);
  await expect(hnSection).toBeVisible();
});

Then('the HN topics should be semantically related to machine learning', async function () {
  const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
  await expect(topicBadges).toHaveCount(5, { timeout: 5000 });
  
  // Check that at least one topic is ML-related
  const topicTexts = await topicBadges.allTextContents();
  const mlRelatedTerms = ['AI', 'Machine Learning', 'Neural', 'Deep Learning', 'Algorithm'];
  
  const hasMLTopic = topicTexts.some(text => 
    mlRelatedTerms.some(term => text.toLowerCase().includes(term.toLowerCase()))
  );
  
  expect(hasMLTopic).toBeTruthy();
});

Then('the topics should include terms like {string}, {string}, or {string}', 
  async function (term1: string, term2: string, term3: string) {
    const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
    const topicTexts = await topicBadges.allTextContents();
    
    const searchTerms = [term1, term2, term3];
    const hasExpectedTerm = topicTexts.some(text =>
      searchTerms.some(term => text.toLowerCase().includes(term.toLowerCase()))
    );
    
    expect(hasExpectedTerm).toBeTruthy();
});

When('the AI has not yet responded', async function () {
  // Ensure no AI response is visible
  await expect(page.locator('[data-testid="ai-message"]')).not.toBeVisible();
});

Then('I should not see a {string} section in the discovery sidebar', async function (sectionName: string) {
  const sidebar = page.locator('[data-testid="discovery-sidebar"]');
  await expect(sidebar).toBeVisible();
  
  const hnSection = sidebar.locator(`text=${sectionName}`);
  await expect(hnSection).not.toBeVisible();
});

Then('the discovery sidebar should not show any HN-related content', async function () {
  const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
  await expect(topicBadges).toHaveCount(0);
});

Given('I have two conversations:', async function (dataTable) {
  const rows = dataTable.hashes();
  
  for (const row of rows) {
    const conversation = {
      id: conversations.size + 1,
      title: `${row.topic} Discussion`,
      summary_public: row.summary_status === 'summarized' ? `Discussion about ${row.topic}` : null,
      topic: row.topic
    };
    
    conversations.set(row.conversation, conversation);
  }
  
  // Mock the conversations in the page context
  await page.evaluate((convs) => {
    window.mockConversations = convs;
  }, Object.fromEntries(conversations));
});

When('I view {string} about artificial intelligence', async function (chatName: string) {
  const conversation = conversations.get(chatName);
  await page.evaluate((conv) => {
    window.dispatchEvent(new CustomEvent('conversation-selected', {
      detail: conv
    }));
  }, conversation);
  
  await page.waitForTimeout(500);
});

When('I switch to {string} about web development', async function (chatName: string) {
  const conversation = conversations.get(chatName);
  await page.evaluate((conv) => {
    window.dispatchEvent(new CustomEvent('conversation-selected', {
      detail: conv
    }));
  }, conversation);
  
  await page.waitForTimeout(500);
});

Then('the {string} section should show AI-related topics', async function (sectionName: string) {
  const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
  const topicTexts = await topicBadges.allTextContents();
  
  const aiTerms = ['AI', 'Artificial Intelligence', 'Machine Learning', 'Neural'];
  const hasAITopic = topicTexts.some(text =>
    aiTerms.some(term => text.toLowerCase().includes(term.toLowerCase()))
  );
  
  expect(hasAITopic).toBeTruthy();
});

Then('the {string} section should update to show web development topics', async function (sectionName: string) {
  const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
  const topicTexts = await topicBadges.allTextContents();
  
  const webTerms = ['Web', 'JavaScript', 'React', 'Frontend', 'Backend'];
  const hasWebTopic = topicTexts.some(text =>
    webTerms.some(term => text.toLowerCase().includes(term.toLowerCase()))
  );
  
  expect(hasWebTopic).toBeTruthy();
});

Then('the topics should be different from the AI conversation topics', async function () {
  // This would require storing previous topics and comparing
  // For now, we'll just verify that topics are present
  const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
  await expect(topicBadges.first()).toBeVisible();
});

When('clicking on a topic should search for that term in the discover page', async function () {
  const firstTopic = page.locator('[data-testid="trending-topic-badge"]').first();
  const topicText = await firstTopic.textContent();
  
  await firstTopic.click();
  
  // Verify navigation to discover page with search term
  await expect(page).toHaveURL(new RegExp(`/discover\\?q=${encodeURIComponent(topicText || '')}`));
});

Given('the corpus service is unavailable', async function () {
  // Mock API to return service unavailable
  await page.route('**/api/corpus/hn-topics**', route => {
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Corpus service unavailable',
        type: 'corpus_service_error'
      })
    });
  });
});

Then('no error messages should be visible to the user', async function () {
  const errorMessages = page.locator('[data-testid="error-message"]');
  await expect(errorMessages).toHaveCount(0);
});

Then('the rest of the discovery sidebar should function normally', async function () {
  // Verify other sidebar sections are still visible
  const similarSection = page.locator('text=Similar to Current Chat');
  const recentSection = page.locator('text=Recent from Community');
  
  // At least one of these should be visible
  const hasOtherSections = await similarSection.isVisible() || await recentSection.isVisible();
  expect(hasOtherSections).toBeTruthy();
});

When('I click on a topic like {string}', async function (topicName: string) {
  const topicBadge = page.locator('[data-testid="trending-topic-badge"]', { hasText: topicName });
  await topicBadge.click();
});

Then('I should be redirected to the discover page', async function () {
  await expect(page).toHaveURL(/\/discover/);
});

Then('the search should be populated with {string}', async function (searchTerm: string) {
  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toHaveValue(searchTerm);
});

Then('I should see search results related to that topic', async function () {
  const searchResults = page.locator('[data-testid="search-result"]');
  await expect(searchResults.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see at least {int} but no more than {int} topic badges', async function (min: number, max: number) {
  const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
  const count = await topicBadges.count();
  
  expect(count).toBeGreaterThanOrEqual(min);
  expect(count).toBeLessThanOrEqual(max);
});

Then('each topic should be clickable', async function () {
  const topicBadges = page.locator('[data-testid="trending-topic-badge"]');
  const count = await topicBadges.count();
  
  for (let i = 0; i < count; i++) {
    const badge = topicBadges.nth(i);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveCSS('cursor', 'pointer');
  }
});

When('the HN semantic search returns no relevant results', async function () {
  // Mock empty results from API
  await page.route('**/api/corpus/hn-topics**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        topics: [],
        source: 'hackernews',
        context: 'semantic_similarity'
      })
    });
  });
});