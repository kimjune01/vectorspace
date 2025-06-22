import { test, expect } from '@playwright/test';

test.describe('WebSocket Chat Functionality', () => {
  test('user can start a new chat and send messages', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await expect(page.locator('main')).toBeVisible();
    
    
    // Check if we need to sign up first (test user might not exist)
    const signUpLink = page.locator('a:has-text("Sign up"), button:has-text("Sign up")');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      
      // Fill signup form
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="displayName"]', 'Test User');
      await page.fill('input[name="password"]', 'testpass');
      await page.click('button[type="submit"]');
      
      // Wait for redirect after signup
      await page.waitForURL('**/');
      await page.waitForTimeout(2000);
    }
    
    // Check if we still need to login
    const loginForm = page.locator('form').first();
    if (await loginForm.isVisible()) {
      // Fill in login form
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass');
      await page.click('button[type="submit"]');
      
      // Wait for login to complete
      await page.waitForTimeout(3000);
    }
    
    // Wait for the chat interface to be ready
    await expect(page.getByRole('heading', { name: 'VectorSpace', level: 1 })).toBeVisible();
    
    // Look for the chat input
    const chatInput = page.locator('input[placeholder*="conversation"], textarea[placeholder*="conversation"], input[placeholder*="message"], textarea[placeholder*="message"]').first();
    await expect(chatInput).toBeVisible();
    
    // Start a new conversation by typing a message
    const testMessage = 'Hello, this is a test message for WebSocket connection';
    await chatInput.fill(testMessage);
    
    // Look for send button
    const sendButton = page.locator('button[title="Send message"]');
    
    // Wait for button to be enabled (indicates connection is ready)
    await expect(sendButton).not.toHaveAttribute('disabled', { timeout: 10000 });
    
    // Click the send button
    await sendButton.click();
    
    // Wait for either success or stable error state
    await Promise.race([
      page.getByText(testMessage).waitFor({ state: 'visible', timeout: 8000 }),
      page.locator('text="Failed to establish connection"').waitFor({ state: 'hidden', timeout: 8000 })
    ]);
    
    // Wait for the message to appear in the chat
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    // Check for any error messages
    const errorMessage = await page.locator('text="Connection not established", text="Failed to establish WebSocket connection"').isVisible().catch(() => false);
    
    if (errorMessage) {
      // Take a screenshot for debugging
      await page.screenshot({ path: 'websocket-error.png', fullPage: true });
      
      // Log console messages
      const logs = await page.evaluate(() => {
        return window.console.toString();
      });
      console.log('Console logs:', logs);
      
      throw new Error('WebSocket connection failed - check websocket-error.png screenshot');
    }
    
    // Verify the message was sent successfully
    expect(errorMessage).toBe(false);
  });
  
  test('WebSocket connection state debugging', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`PAGE LOG: ${msg.text()}`);
    });
    
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await expect(page.locator('main')).toBeVisible();
    
    
    // Create test user account first
    const signUpLink = page.locator('a:has-text("Sign up"), button:has-text("Sign up")');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="displayName"]', 'Test User');
      await page.fill('input[name="password"]', 'testpass');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/');
    }
    
    // Wait for authentication to complete
    await page.waitForTimeout(2000);
    
    // Try to start a new conversation
    const chatInput = page.locator('input[placeholder*="conversation"]').first();
    
    if (await chatInput.isVisible()) {
      await chatInput.fill('Test WebSocket connection');
      
      const sendButton = page.locator('button[title="Send message"]');
      
      // Force click to bypass any overlays
      await sendButton.click({ force: true });
      
      // Wait to see what happens
      await page.waitForTimeout(5000);
      
      // Take a screenshot regardless
      await page.screenshot({ path: 'websocket-debug.png', fullPage: true });
    }
  });
});