import { test, expect } from '@playwright/test';

test.describe('Production Health Check', () => {
  test('app loads and shows login form', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page loads
    await expect(page).toHaveTitle(/VectorSpace/);
    
    // Check if login form is present
    const loginForm = page.locator('form');
    await expect(loginForm).toBeVisible({ timeout: 10000 });
    
    // Check for username and password fields
    await expect(page.locator('input[type="text"], input[name="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('can register new user', async ({ page }) => {
    await page.goto('/');
    
    // Click register link
    await page.click('text=Sign up');
    
    // Fill registration form
    const timestamp = Date.now();
    await page.fill('input[name="username"]', `testuser${timestamp}`);
    await page.fill('input[name="email"]', `test${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'testpass123');
    await page.fill('input[name="displayName"]', `Test User ${timestamp}`);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard or show success
    await expect(page).toHaveURL(/\/(discover|chat)/, { timeout: 15000 });
  });

  test('api health check', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
  });
});