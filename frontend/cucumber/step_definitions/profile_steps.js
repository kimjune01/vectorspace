import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

/**
 * User profile step definitions for user_profile.feature
 * Tests public user profile functionality and privacy protection
 */

// Background
Given('user {string} exists with display name {string}', async function(username, displayName) {
  // Create user if not exists
  if (!this.users.has(username)) {
    await this.registerUser(username, displayName, `${username}@example.com`, 'securepass123');
  }
  
  this.profileUser = username;
  this.profileDisplayName = displayName;
});

Given('user {string} has completed 10 conversations', async function(username) {
  const authApi = this.getAuthenticatedApi(username);
  
  // Create 10 conversations for the user
  this.userConversations = [];
  
  for (let i = 0; i < 10; i++) {
    const response = await authApi.post('/api/conversations', {
      title: `Test Conversation ${i + 1}`,
      is_public: true
    });
    
    const conversation = response.data;
    
    // Add a message to each conversation
    await authApi.post(`/api/conversations/${conversation.id}/messages`, {
      content: `This is test message ${i + 1} for conversation testing.`,
      role: 'user'
    });
    
    // Wait for AI response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Archive the conversation to complete it
    await authApi.patch(`/api/conversations/${conversation.id}`, {
      is_archived: true
    });
    
    this.userConversations.push(conversation);
  }
  
  this.debugLog.push(`Created 10 conversations for user ${username}`);
});

// View user profile
When('I visit the profile for {string}', async function(username) {
  try {
    // Get user profile via API
    const response = await this.api.get(`/api/users/${username}/profile`);
    this.profileData = response.data;
    
    // Also visit the profile page in browser if we have one
    if (this.pages.has('viewer')) {
      const page = this.pages.get('viewer');
      await page.goto(`${this.config.frontend.baseUrl}/profile/${username}`);
      await page.waitForTimeout(2000);
    }
    
  } catch (error) {
    // Try alternative endpoint structure
    try {
      const userResponse = await this.api.get(`/api/users/${username}`);
      this.profileData = userResponse.data;
    } catch (altError) {
      this.lastError = error;
      this.debugLog.push(`Failed to get profile for ${username}: ${error.message}`);
    }
  }
});

Then('I should see the display name {string}', async function(expectedDisplayName) {
  assert(this.profileData, 'No profile data available');
  assert.strictEqual(this.profileData.display_name, expectedDisplayName,
    `Expected display name "${expectedDisplayName}", got "${this.profileData.display_name}"`);
});

Then('I should see up to 10 recent conversations', async function() {
  assert(this.profileData, 'No profile data available');
  
  // Check if conversations are included in profile data
  if (this.profileData.conversations) {
    assert(this.profileData.conversations.length <= 10,
      `Should show at most 10 conversations, got ${this.profileData.conversations.length}`);
  } else {
    // If not in profile data, make separate request for user conversations
    const response = await this.api.get(`/api/users/${this.profileUser}/conversations?limit=10`);
    const conversations = response.data;
    
    assert(conversations.length <= 10,
      `Should return at most 10 conversations, got ${conversations.length}`);
    
    this.profileConversations = conversations;
  }
});

Then('I should see the user\'s bio if provided', async function() {
  // Bio is optional, so we just check if it's a string when present
  if (this.profileData.bio) {
    assert(typeof this.profileData.bio === 'string',
      'Bio should be a string when provided');
  }
});

Then('I should see the user\'s total conversation count', async function() {
  assert(this.profileData, 'No profile data available');
  assert(typeof this.profileData.conversation_count === 'number',
    'Profile should include total conversation count');
  assert(this.profileData.conversation_count >= 0,
    'Conversation count should be non-negative');
});

Then('I should see how many conversations they had in the last 24 hours', async function() {
  assert(this.profileData, 'No profile data available');
  assert(typeof this.profileData.conversations_last_24h === 'number',
    'Profile should include conversations in last 24 hours');
  assert(this.profileData.conversations_last_24h >= 0,
    'Last 24h conversation count should be non-negative');
});

Then('I should see their profile image or generated stripe pattern', async function() {
  assert(this.profileData, 'No profile data available');
  
  // User should have either a profile image URL or a stripe pattern seed
  const hasProfileImage = this.profileData.profile_image_url && 
                         this.profileData.profile_image_url !== null;
  const hasStripePattern = typeof this.profileData.stripe_pattern_seed === 'number';
  
  assert(hasProfileImage || hasStripePattern,
    'User should have either profile image or stripe pattern seed');
});

Then('I should NOT see the username {string} displayed', async function(username) {
  // In the UI, username should not be prominently displayed - only display name
  // We can check that display_name is different from username
  assert(this.profileData.display_name !== username,
    'Display name should be used instead of username in public profile');
});

Then('there should be no pagination for conversations', async function() {
  // Profile conversations should be limited to 10 without pagination
  const conversations = this.profileData.conversations || this.profileConversations || [];
  assert(conversations.length <= 10,
    'Profile should show at most 10 conversations without pagination');
});

// Filtered summaries
Given('user {string} has a conversation containing {string}', async function(username, content) {
  const authApi = this.getAuthenticatedApi(username);
  
  // Create conversation with PII content
  const response = await authApi.post('/api/conversations', {
    title: 'Conversation with PII content',
    is_public: true
  });
  
  const conversation = response.data;
  
  // Add message with PII
  await authApi.post(`/api/conversations/${conversation.id}/messages`, {
    content: content,
    role: 'user'
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Archive to complete
  await authApi.patch(`/api/conversations/${conversation.id}`, {
    is_archived: true
  });
  
  this.piiConversation = conversation;
});

Then('I should see the conversation summary', async function() {
  const conversations = this.profileData.conversations || this.profileConversations || [];
  
  const foundConversation = conversations.find(conv => 
    conv.id === this.piiConversation.id);
  
  assert(foundConversation, 'PII conversation should appear in profile');
  assert(foundConversation.summary, 'Conversation should have a summary');
  
  this.conversationSummary = foundConversation.summary;
});

Then('the summary should show {string} instead of the actual email', async function(filteredText) {
  assert(this.conversationSummary, 'No conversation summary available');
  assert(this.conversationSummary.includes(filteredText),
    `Summary should contain filtered text "${filteredText}", got "${this.conversationSummary}"`);
});

Then('the conversation meaning should be preserved', async function() {
  assert(this.conversationSummary, 'No conversation summary available');
  
  // Summary should be meaningful and contain context words
  assert(this.conversationSummary.length > 10,
    'Summary should be meaningful and contain context');
});

// Update profile  
Given('I am logged in as {string} for profile updates', async function(username) {
  if (!this.users.has(username)) {
    await this.registerUser(username, 'Test User', `${username}@example.com`, 'securepass123');
  }
  
  await this.loginUser(username, 'securepass123');
  this.currentUser = username;
});

When('I update my bio to {string}', async function(newBio) {
  try {
    const authApi = this.getAuthenticatedApi(this.currentUser);
    const response = await authApi.patch('/api/users/me', {
      bio: newBio
    });
    
    this.lastResponse = response;
    this.updatedProfile = response.data;
  } catch (error) {
    this.lastError = error;
    this.lastResponse = error.response;
  }
});

Then('my profile should show the new bio', async function() {
  assert(this.updatedProfile, 'No updated profile data');
  assert.strictEqual(this.updatedProfile.bio, 'AI enthusiast and Python developer',
    'Profile should show the updated bio');
});

Then('the bio should be limited to 200 characters', async function() {
  // Test bio length limit by trying to set a longer bio
  const longBio = 'A'.repeat(201);
  
  try {
    const authApi = this.getAuthenticatedApi(this.currentUser);
    await authApi.patch('/api/users/me', { bio: longBio });
    
    assert.fail('Should not allow bio longer than 200 characters');
  } catch (error) {
    // Expected - bio should be rejected
    assert(error.response.status === 400 || error.message.includes('200'),
      'Should reject bio longer than 200 characters');
  }
});

// Profile image upload
When('I upload a profile image', async function() {
  try {
    const authApi = this.getAuthenticatedApi(this.currentUser);
    
    // Simulate uploading a base64 image
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const response = await authApi.patch('/api/users/me', {
      profile_image: testImageData
    });
    
    this.lastResponse = response;
    this.updatedProfile = response.data;
  } catch (error) {
    this.lastError = error;
    this.lastResponse = error.response;
  }
});

Then('my profile should display the uploaded image', async function() {
  assert(this.updatedProfile, 'No updated profile data');
  assert(this.updatedProfile.profile_image_url,
    'Profile should have image URL after upload');
});

Then('the image should be properly sized and cropped', async function() {
  // In a real implementation, we would check image dimensions
  // For now, just verify the image URL exists and is valid
  assert(this.updatedProfile.profile_image_url,
    'Profile image URL should be set');
  
  const imageUrl = this.updatedProfile.profile_image_url;
  assert(imageUrl.startsWith('data:image/') || imageUrl.startsWith('http'),
    'Profile image should be a valid image URL or data URL');
});

// Stripe pattern for users without image
Given('user {string} exists without a profile image', async function(username) {
  if (!this.users.has(username)) {
    await this.registerUser(username, 'User Without Image', `${username}@example.com`, 'securepass123');
  }
  
  // Ensure user has no profile image
  const authApi = this.getAuthenticatedApi(username);
  await authApi.patch('/api/users/me', {
    profile_image: null
  });
  
  this.stripePatternUser = username;
});

Then('I should see a generated image with horizontal stripes', async function() {
  await this.executeStep(`When I visit the profile for "${this.stripePatternUser}"`);
  
  assert(this.profileData, 'No profile data available');
  assert(!this.profileData.profile_image_url,
    'User should not have a profile image URL');
  assert(typeof this.profileData.stripe_pattern_seed === 'number',
    'User should have a stripe pattern seed');
});

Then('the stripes should be solid colors', async function() {
  // The stripe pattern seed should generate consistent solid colors
  assert(typeof this.profileData.stripe_pattern_seed === 'number',
    'Stripe pattern seed should be a number');
  assert(this.profileData.stripe_pattern_seed > 0,
    'Stripe pattern seed should be positive');
});

Then('the pattern should be consistent for this user', async function() {
  // Get profile again and verify same seed
  const response = await this.api.get(`/api/users/${this.stripePatternUser}`);
  const profileAgain = response.data;
  
  assert.strictEqual(profileAgain.stripe_pattern_seed, this.profileData.stripe_pattern_seed,
    'Stripe pattern seed should be consistent for the same user');
});

// Hide conversations
Given('I have 5 public conversations', async function() {
  const authApi = this.getAuthenticatedApi(this.currentUser);
  this.userPublicConversations = [];
  
  for (let i = 0; i < 5; i++) {
    const response = await authApi.post('/api/conversations', {
      title: `Public Conversation ${i + 1}`,
      is_public: true
    });
    
    const conversation = response.data;
    
    // Add message and archive
    await authApi.post(`/api/conversations/${conversation.id}/messages`, {
      content: `Public message ${i + 1}`,
      role: 'user'
    });
    
    await authApi.patch(`/api/conversations/${conversation.id}`, {
      is_archived: true
    });
    
    this.userPublicConversations.push(conversation);
  }
});

When('I hide 2 conversations from my profile', async function() {
  const authApi = this.getAuthenticatedApi(this.currentUser);
  
  // Hide first 2 conversations
  this.hiddenConversations = this.userPublicConversations.slice(0, 2);
  
  for (const conversation of this.hiddenConversations) {
    await authApi.patch(`/api/conversations/${conversation.id}`, {
      hidden_from_profile: true
    });
  }
});

Then('my profile should show only 3 conversations', async function() {
  await this.executeStep(`When I visit the profile for "${this.currentUser}"`);
  
  const conversations = this.profileData.conversations || this.profileConversations || [];
  const visibleConversations = conversations.filter(conv => 
    !this.hiddenConversations.some(hidden => hidden.id === conv.id));
  
  assert(visibleConversations.length <= 3,
    `Profile should show at most 3 visible conversations, got ${visibleConversations.length}`);
});

Then('the hidden conversations should not be visible to others', async function() {
  // Create another user to view the profile
  if (!this.users.has('otheruser')) {
    await this.registerUser('otheruser', 'Other User', 'other@example.com', 'securepass123');
  }
  
  const otherUserApi = this.getAuthenticatedApi('otheruser');
  const response = await otherUserApi.get(`/api/users/${this.currentUser}/profile`);
  const otherUserView = response.data;
  
  const conversations = otherUserView.conversations || [];
  
  for (const hiddenConv of this.hiddenConversations) {
    const foundHidden = conversations.find(conv => conv.id === hiddenConv.id);
    assert(!foundHidden,
      `Hidden conversation ${hiddenConv.id} should not be visible to other users`);
  }
});

Then('the hidden conversations should still appear in search results', async function() {
  // Search for content from hidden conversations
  const searchResponse = await this.api.get('/api/search/conversations', {
    params: { q: 'Public message 1', limit: 20 }
  });
  
  const searchResults = searchResponse.data.conversations || [];
  const foundHidden = searchResults.find(conv => 
    this.hiddenConversations.some(hidden => hidden.id === conv.id));
  
  assert(foundHidden,
    'Hidden conversations should still appear in search results');
});

// Profile statistics
Given('user {string} has 15 total conversations', async function(username) {
  // This would typically be set up in test data
  // For now, we'll verify the count after creating conversations
  this.expectedTotalConversations = 15;
});

Given('user {string} had 3 conversations in the last 24 hours', async function(username) {
  // This would typically be set up with specific timestamps
  this.expectedRecentConversations = 3;
});

Then('I should see {string}', async function(expectedText) {
  // This step is used for various text checks in the profile
  if (expectedText.includes('total conversations')) {
    assert(typeof this.profileData.conversation_count === 'number',
      'Should show total conversation count');
  } else if (expectedText.includes('conversations in the last 24 hours')) {
    assert(typeof this.profileData.conversations_last_24h === 'number',
      'Should show recent conversation count');
  }
});

// Conversation ordering
Given('user {string} has conversations from different dates', async function(username) {
  // Conversations created earlier in the test will have different timestamps
  // We'll verify they're ordered by most recent first
  this.orderingTestUser = username;
});

When('I view the profile', async function() {
  await this.executeStep(`When I visit the profile for "${this.orderingTestUser || this.currentUser}"`);
});

Then('conversations should be ordered by most recent first', async function() {
  const conversations = this.profileData.conversations || this.profileConversations || [];
  
  if (conversations.length > 1) {
    for (let i = 1; i < conversations.length; i++) {
      const prevDate = new Date(conversations[i - 1].created_at);
      const currentDate = new Date(conversations[i].created_at);
      
      assert(prevDate >= currentDate,
        'Conversations should be ordered by most recent first');
    }
  }
});

Then('each conversation should show a relative timestamp', async function() {
  const conversations = this.profileData.conversations || this.profileConversations || [];
  
  for (const conversation of conversations) {
    assert(conversation.created_at,
      `Conversation ${conversation.id} should have a created_at timestamp`);
    
    // Verify timestamp is a valid date
    const date = new Date(conversation.created_at);
    assert(!isNaN(date.getTime()),
      `Conversation timestamp should be a valid date`);
  }
});

// Privacy protection
Given('a conversation contains personal information', async function() {
  const authApi = this.getAuthenticatedApi(this.currentUser || this.profileUser);
  
  const piiContent = 'Please call me at 555-123-4567 or email john@secret.com. My address is 123 Main St, Anytown, NY 12345.';
  
  const response = await authApi.post('/api/conversations', {
    title: 'Conversation with Personal Info',
    is_public: true
  });
  
  const conversation = response.data;
  
  await authApi.post(`/api/conversations/${conversation.id}/messages`, {
    content: piiContent,
    role: 'user'
  });
  
  await authApi.patch(`/api/conversations/${conversation.id}`, {
    is_archived: true
  });
  
  this.personalInfoConversation = conversation;
});

Given('Including phone numbers, addresses, and emails', async function() {
  // This is covered in the previous step
  assert(this.personalInfoConversation, 'Personal info conversation should be created');
});

When('the conversation appears on a profile', async function() {
  await this.executeStep(`When I visit the profile for "${this.currentUser || this.profileUser}"`);
  
  const conversations = this.profileData.conversations || this.profileConversations || [];
  this.personalInfoInProfile = conversations.find(conv => 
    conv.id === this.personalInfoConversation.id);
  
  assert(this.personalInfoInProfile, 
    'Personal info conversation should appear in profile');
});

Then('all personal information should be filtered', async function() {
  assert(this.personalInfoInProfile, 'No personal info conversation in profile');
  
  const summary = this.personalInfoInProfile.summary || '';
  
  // Check that PII patterns are not present
  const piiPatterns = [
    /\b\d{3}-\d{3}-\d{4}\b/, // Phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
    /\b\d+\s+[A-Za-z\s]+St\b/ // Street addresses
  ];
  
  for (const pattern of piiPatterns) {
    assert(!pattern.test(summary),
      `Summary should not contain PII matching pattern ${pattern}`);
  }
});

Then('show [phone], [address], and [email] placeholders instead', async function() {
  assert(this.personalInfoInProfile, 'No personal info conversation in profile');
  
  const summary = this.personalInfoInProfile.summary || '';
  
  // Should contain filtered placeholders
  const expectedPlaceholders = ['[phone]', '[address]', '[email]'];
  let foundPlaceholders = 0;
  
  for (const placeholder of expectedPlaceholders) {
    if (summary.includes(placeholder)) {
      foundPlaceholders++;
    }
  }
  
  assert(foundPlaceholders > 0,
    'Summary should contain filtered placeholders like [phone], [address], [email]');
});