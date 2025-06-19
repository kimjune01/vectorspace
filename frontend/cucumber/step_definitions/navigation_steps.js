import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

/**
 * Basic UI navigation step definitions without API dependencies
 * Tests the React UI components and basic navigation
 */

// Background steps
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

Given('I open the VectorSpace application', async function() {
  const page = await this.launchBrowser('testuser');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Wait for React app to load - look for VectorSpace heading
  await page.waitForSelector('text=VectorSpace', { timeout: 10000 });
  this.debugLog.push('✅ VectorSpace application loaded');
});

When('I navigate to the register page', async function() {
  const page = this.pages.get('testuser');
  await page.goto('http://localhost:5173/register');
  await page.waitForSelector('text=Create account', { timeout: 5000 });
  this.debugLog.push('🧭 Navigated to registration page');
});

When('I navigate to the login page', async function() {
  const page = this.pages.get('testuser');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('text=Welcome back', { timeout: 5000 });
  this.debugLog.push('🧭 Navigated to login page');
});

When('I navigate back to home', async function() {
  const page = this.pages.get('testuser');
  await page.goto('http://localhost:5173');
  await page.waitForSelector('text=Welcome to VectorSpace', { timeout: 5000 });
  this.debugLog.push('🧭 Navigated back to home page');
});

Then('I should see the registration form', async function() {
  const page = this.pages.get('testuser');
  
  // Check for registration form elements
  const formElements = await Promise.all([
    page.$('#username'),
    page.$('#displayName'),
    page.$('#email'),
    page.$('#password'),
    page.$('#confirmPassword'),
    page.$('button[type="submit"]')
  ]);
  
  assert(formElements.every(el => el !== null), 'All registration form elements should be present');
  
  const buttonElement = await page.$('button[type="submit"]');
  const buttonText = await page.evaluate(el => el.textContent, buttonElement);
  assert(buttonText.includes('Create account'), 'Submit button should say "Create account"');
  
  this.debugLog.push('✅ Registration form is visible and complete');
});

Then('I should see the login form', async function() {
  const page = this.pages.get('testuser');
  
  // Check for login form elements
  const formElements = await Promise.all([
    page.$('#username'),
    page.$('#password'),
    page.$('button[type="submit"]')
  ]);
  
  assert(formElements.every(el => el !== null), 'All login form elements should be present');
  
  const buttonElement = await page.$('button[type="submit"]');
  const buttonText = await page.evaluate(el => el.textContent, buttonElement);
  assert(buttonText.includes('Sign in'), 'Submit button should say "Sign in"');
  
  this.debugLog.push('✅ Login form is visible and complete');
});

Then('I should see the welcome message', async function() {
  const page = this.pages.get('testuser');
  
  const welcomeElement = await page.$('text=Welcome to VectorSpace');
  assert(welcomeElement, 'Welcome message should be visible');
  
  const descElement = await page.$('text=Start a conversation and discover similar chats from the community');
  assert(descElement, 'Description text should be visible');
  
  this.debugLog.push('✅ Welcome message and description are visible');
});

When('I fill in the username field with {string}', async function(username) {
  const page = this.pages.get('testuser');
  await page.type('#username', username, { delay: 50 });
  this.testFormData = this.testFormData || {};
  this.testFormData.username = username;
  this.debugLog.push(`📝 Filled username field with "${username}"`);
});

When('I fill in the display name field with {string}', async function(displayName) {
  const page = this.pages.get('testuser');
  await page.type('#displayName', displayName, { delay: 50 });
  this.testFormData = this.testFormData || {};
  this.testFormData.displayName = displayName;
  this.debugLog.push(`📝 Filled display name field with "${displayName}"`);
});

When('I fill in the email field with {string}', async function(email) {
  const page = this.pages.get('testuser');
  await page.type('#email', email, { delay: 50 });
  this.testFormData = this.testFormData || {};
  this.testFormData.email = email;
  this.debugLog.push(`📝 Filled email field with "${email}"`);
});

Then('the form fields should contain the entered values', async function() {
  const page = this.pages.get('testuser');
  
  // Check that form fields contain the values we entered
  const usernameValue = await page.$eval('#username', el => el.value);
  const displayNameValue = await page.$eval('#displayName', el => el.value);
  const emailValue = await page.$eval('#email', el => el.value);
  
  assert.strictEqual(usernameValue, this.testFormData.username, 'Username field should contain entered value');
  assert.strictEqual(displayNameValue, this.testFormData.displayName, 'Display name field should contain entered value');
  assert.strictEqual(emailValue, this.testFormData.email, 'Email field should contain entered value');
  
  this.debugLog.push('✅ All form fields contain the correct values');
});

// Export for use by cucumber
export { Given, When, Then };