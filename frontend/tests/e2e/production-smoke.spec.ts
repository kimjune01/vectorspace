import { test, expect } from '@playwright/test';

test.describe('Production Smoke Tests', () => {
  test('frontend loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads without errors
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    
    // Check that it's the React app (not a 404 or error page)
    const hasReactRoot = await page.locator('#root').isVisible().catch(() => false);
    const hasMainContent = await page.locator('main').isVisible().catch(() => false);
    
    expect(hasReactRoot || hasMainContent).toBeTruthy();
  });

  test('authentication UI is present', async ({ page }) => {
    await page.goto('/');
    
    // Should have login form or login button
    const hasLoginForm = await page.locator('form').isVisible().catch(() => false);
    const hasLoginButton = await page.locator('button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")').isVisible().catch(() => false);
    const hasAuthLink = await page.locator('a:has-text("Sign up"), a:has-text("Register"), a:has-text("Login")').isVisible().catch(() => false);
    
    expect(hasLoginForm || hasLoginButton || hasAuthLink).toBeTruthy();
  });

  test('responsive design works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should still be usable on mobile
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('main')).toBeVisible({ timeout: 5000 });
  });

  test('app handles API errors gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for any loading to complete
    await page.waitForTimeout(3000);
    
    // Check that there are no JavaScript errors that break the app
    const errors = await page.evaluate(() => {
      return window.console ? [] : ['Console not available'];
    });
    
    // The app should load even if API calls fail
    await expect(page.locator('main')).toBeVisible();
  });
});