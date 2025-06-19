import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

/**
 * Semantic search step definitions for search.feature
 * Tests vector search functionality and conversation discovery
 */

// Background
Given('the vector database contains embedded conversations', async function() {
  // Ensure vector database has some test data
  // Create a few test conversations with different topics for search testing
  
  const testTopics = [
    'Python decorators and how they work',
    'React hooks useState and useEffect', 
    'Machine learning basics with neural networks',
    'JavaScript async/await patterns',
    'CSS grid layout techniques'
  ];
  
  this.searchTestConversations = [];
  
  for (let i = 0; i < testTopics.length; i++) {
    const username = `searchtestuser${i}`;
    
    // Create user if needed
    if (!this.users.has(username)) {
      await this.registerUser(username, `Search Test User ${i}`, `${username}@example.com`, 'securepass123');
    }
    
    const authApi = this.getAuthenticatedApi(username);
    
    // Create conversation
    const convResponse = await authApi.post('/api/conversations', {
      title: `Conversation about ${testTopics[i]}`,
      is_public: true
    });
    
    const conversation = convResponse.data;
    
    // Add messages about the topic
    await authApi.post(`/api/conversations/${conversation.id}/messages`, {
      content: `I want to learn about ${testTopics[i]}. Can you explain it to me?`,
      role: 'user'
    });
    
    // Wait for AI response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Archive to make it searchable
    await authApi.patch(`/api/conversations/${conversation.id}`, {
      is_archived: true
    });
    
    this.searchTestConversations.push({
      ...conversation,
      topic: testTopics[i]
    });
  }
  
  // Wait for vector embeddings to be generated
  await new Promise(resolve => setTimeout(resolve, 2000));
});

// Search while chatting
Given('I am logged in', async function() {
  if (!this.currentUser) {
    const { alice } = this.config.testUsers;
    await this.loginUser(alice.username, alice.password);
    this.currentUser = alice.username;
  }
});

Given('I am having a conversation about {string}', async function(topic) {
  const authApi = this.getAuthenticatedApi(this.currentUser);
  
  // Create new conversation
  const response = await authApi.post('/api/conversations', {
    title: `Current conversation about ${topic}`,
    is_public: true
  });
  
  this.currentConversation = response.data;
  
  // Add a message about the topic
  await authApi.post(`/api/conversations/${this.currentConversation.id}/messages`, {
    content: `I'm currently learning about ${topic}. Tell me more about it.`,
    role: 'user'
  });
  
  this.currentTopic = topic;
});

When('I click {string}', async function(buttonText) {
  // This would typically be a frontend action
  // For API testing, we'll simulate by calling the search endpoint
  if (buttonText === 'Find Similar Conversations') {
    const authApi = this.getAuthenticatedApi(this.currentUser);
    
    try {
      const response = await authApi.post('/api/search/similar', {
        conversation_id: this.currentConversation.id,
        limit: 20
      });
      
      this.lastResponse = response;
      this.searchResults = response.data;
    } catch (error) {
      this.lastError = error;
      this.lastResponse = error.response;
    }
  }
});

Then('I should see up to 20 conversations with similar topics', async function() {
  assert(this.searchResults, 'No search results found');
  assert(this.searchResults.conversations, 'Search results should have conversations array');
  assert(this.searchResults.conversations.length <= 20, 
    `Should return at most 20 results, got ${this.searchResults.conversations.length}`);
});

Then('results should be ordered by similarity score', async function() {
  assert(this.searchResults.conversations.length > 0, 'Should have at least one result');
  
  // Check that similarity scores are in descending order
  for (let i = 1; i < this.searchResults.conversations.length; i++) {
    const prevScore = this.searchResults.conversations[i - 1].similarity_score;
    const currentScore = this.searchResults.conversations[i].similarity_score;
    
    assert(prevScore >= currentScore, 
      `Results should be ordered by similarity score (${prevScore} >= ${currentScore})`);
  }
});

Then('each result should show a preview of the conversation', async function() {
  for (const conversation of this.searchResults.conversations) {
    assert(conversation.summary || conversation.preview, 
      `Conversation ${conversation.id} should have a summary or preview`);
  }
});

Then('I should be able to navigate to additional pages', async function() {
  // Check if pagination is available for logged-in users
  assert(this.searchResults.has_more !== false, 
    'Logged-in users should be able to access additional pages');
});

// Discovery page search
Given('I am on the discovery page', async function() {
  // Navigate to discovery page (simulate frontend navigation)
  this.currentPage = 'discovery';
});

When('I perform a basic search for {string}', async function(searchQuery) {
  const authApi = this.currentUser ? this.getAuthenticatedApi(this.currentUser) : this.api;
  
  try {
    const response = await authApi.get('/api/search/conversations', {
      params: {
        q: searchQuery,
        limit: 20
      }
    });
    
    this.lastResponse = response;
    this.searchResults = response.data;
    this.searchQuery = searchQuery;
  } catch (error) {
    this.lastError = error;
    this.lastResponse = error.response;
  }
});

Then('I should see up to 20 relevant conversations per page', async function() {
  assert(this.searchResults, 'No search results found');
  assert(this.searchResults.conversations, 'Search results should have conversations array');
  assert(this.searchResults.conversations.length <= 20, 
    `Should return at most 20 results per page, got ${this.searchResults.conversations.length}`);
});

Then('the results should be ordered by semantic similarity', async function() {
  if (this.searchResults.conversations.length > 1) {
    // Check that results have similarity scores and are ordered
    for (let i = 1; i < this.searchResults.conversations.length; i++) {
      const prevScore = this.searchResults.conversations[i - 1].similarity_score || 1;
      const currentScore = this.searchResults.conversations[i].similarity_score || 0;
      
      assert(prevScore >= currentScore, 
        'Results should be ordered by semantic similarity');
    }
  }
});

Then('I should see who started each conversation', async function() {
  for (const conversation of this.searchResults.conversations) {
    assert(conversation.author_display_name, 
      `Conversation ${conversation.id} should show who started it`);
  }
});

// Search results context
Given('there are conversations about {string}', async function(topic) {
  // Ensure we have conversations about this specific topic
  const username = 'contexttester';
  
  if (!this.users.has(username)) {
    await this.registerUser(username, 'Context Tester', `${username}@example.com`, 'securepass123');
  }
  
  const authApi = this.getAuthenticatedApi(username);
  
  // Create conversation about the topic
  const response = await authApi.post('/api/conversations', {
    title: `Learning about ${topic}`,
    is_public: true
  });
  
  const conversation = response.data;
  
  // Add detailed messages about the topic
  await authApi.post(`/api/conversations/${conversation.id}/messages`, {
    content: `I want to understand ${topic} better. What are the key concepts I should know?`,
    role: 'user'
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Archive to make searchable
  await authApi.patch(`/api/conversations/${conversation.id}`, {
    is_archived: true
  });
  
  this.topicConversations = this.topicConversations || [];
  this.topicConversations.push(conversation);
});

Then('I should see matching conversations', async function() {
  assert(this.searchResults.conversations.length > 0, 
    'Should find matching conversations for the search query');
  
  // Verify that some results are relevant to the search query
  const queryWords = this.searchQuery.toLowerCase().split(' ');
  let foundRelevant = false;
  
  for (const conversation of this.searchResults.conversations) {
    const text = (conversation.title + ' ' + conversation.summary).toLowerCase();
    
    for (const word of queryWords) {
      if (text.includes(word)) {
        foundRelevant = true;
        break;
      }
    }
    
    if (foundRelevant) break;
  }
  
  assert(foundRelevant, 'Search results should include conversations relevant to the query');
});

Then('each result should highlight relevant parts', async function() {
  // In a full implementation, this would check for highlighted text
  // For now, verify that results have summaries that can show context
  for (const conversation of this.searchResults.conversations) {
    assert(conversation.summary, 
      `Conversation ${conversation.id} should have summary for context`);
  }
});

Then('show the conversation title and summary', async function() {
  for (const conversation of this.searchResults.conversations) {
    assert(conversation.title, `Conversation ${conversation.id} should have a title`);
    assert(conversation.summary, `Conversation ${conversation.id} should have a summary`);
  }
});

// Anonymous vs authenticated search
Given('I am not logged in', async function() {
  // Clear current user authentication
  this.currentUser = null;
  this.tokens.clear();
});

Then('I should NOT be able to navigate to additional pages', async function() {
  // Anonymous users should be limited to first page only
  assert(!this.searchResults.has_more || this.searchResults.has_more === false, 
    'Anonymous users should not have access to additional pages');
});

Then('I should see a prompt to log in for more results', async function() {
  // Check for login prompt in response
  assert(this.searchResults.login_required_for_more || this.searchResults.message, 
    'Should prompt anonymous users to login for more results');
});

// Pagination for logged-in users
When('there are more than 20 matching conversations', async function() {
  // This would be ensured by having enough test data
  // For testing, we can simulate by checking the has_more flag
  if (this.searchResults.conversations.length >= 20) {
    this.hasMoreResults = true;
  }
});

Then('I should see up to 20 conversations on the first page', async function() {
  assert(this.searchResults.conversations.length <= 20, 
    'First page should have at most 20 conversations');
});

Then('I should be able to navigate to page 2, 3, etc.', async function() {
  // For logged-in users, pagination should be available
  if (this.currentUser) {
    assert(this.searchResults.has_more !== false, 
      'Logged-in users should be able to access additional pages');
  }
});

Then('each page should show up to 20 results', async function() {
  // Test second page
  if (this.currentUser && this.searchResults.has_more) {
    const authApi = this.getAuthenticatedApi(this.currentUser);
    
    const page2Response = await authApi.get('/api/search/conversations', {
      params: {
        q: this.searchQuery,
        limit: 20,
        offset: 20
      }
    });
    
    assert(page2Response.data.conversations.length <= 20, 
      'Each page should show at most 20 results');
  }
});

// Empty results
When('no similar conversations exist', async function() {
  // This scenario happens when search query returns no results
  // The search query should be unusual enough to return empty results
});

Then('I should see a message {string}', async function(expectedMessage) {
  const responseMessage = this.searchResults.message || '';
  assert(responseMessage.includes(expectedMessage) || 
         responseMessage.toLowerCase().includes(expectedMessage.toLowerCase()),
    `Expected message containing "${expectedMessage}", got "${responseMessage}"`);
});

Then('I should see suggestions to start a new conversation', async function() {
  // Check for suggestion to start new conversation
  const hasNewConversationSuggestion = this.searchResults.suggestions && 
    this.searchResults.suggestions.some(s => s.includes('new conversation'));
  
  assert(hasNewConversationSuggestion || this.searchResults.message.includes('start'),
    'Should suggest starting a new conversation when no results found');
});

// PII filtering in search
Given('a conversation contains {string}', async function(contentWithPII) {
  const username = 'piitester';
  
  if (!this.users.has(username)) {
    await this.registerUser(username, 'PII Tester', `${username}@example.com`, 'securepass123');
  }
  
  const authApi = this.getAuthenticatedApi(username);
  
  // Create conversation with PII content
  const response = await authApi.post('/api/conversations', {
    title: 'Conversation with PII',
    is_public: true
  });
  
  const conversation = response.data;
  
  // Add message with PII
  await authApi.post(`/api/conversations/${conversation.id}/messages`, {
    content: contentWithPII,
    role: 'user'
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Archive to make searchable
  await authApi.patch(`/api/conversations/${conversation.id}`, {
    is_archived: true
  });
  
  this.piiConversation = conversation;
});

When('I search and this conversation appears in results', async function() {
  // Search for content that would match the PII conversation
  const authApi = this.currentUser ? this.getAuthenticatedApi(this.currentUser) : this.api;
  
  const response = await authApi.get('/api/search/conversations', {
    params: {
      q: 'contact help',
      limit: 20
    }
  });
  
  this.searchResults = response.data;
  
  // Find the PII conversation in results
  this.piiConversationInResults = this.searchResults.conversations.find(conv => 
    conv.id === this.piiConversation.id);
});

Then('the summary should show {string}', async function(expectedFilteredText) {
  assert(this.piiConversationInResults, 'PII conversation should appear in search results');
  
  const summary = this.piiConversationInResults.summary;
  assert(summary.includes(expectedFilteredText), 
    `Summary should show filtered text "${expectedFilteredText}", got "${summary}"`);
});

Then('personal information should remain filtered', async function() {
  assert(this.piiConversationInResults, 'PII conversation should appear in search results');
  
  const summary = this.piiConversationInResults.summary;
  
  // Check that common PII patterns are filtered
  const piiPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
    /\b\d{3}-\d{3}-\d{4}\b/, // Phone numbers
    /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/ // Credit card numbers
  ];
  
  for (const pattern of piiPatterns) {
    assert(!pattern.test(summary), 
      `Summary should not contain PII matching pattern ${pattern}`);
  }
  
  // Should contain filtered placeholders instead
  assert(summary.includes('[email]') || summary.includes('[phone]') || summary.includes('[contact]'),
    'Summary should contain filtered placeholders like [email], [phone], etc.');
});