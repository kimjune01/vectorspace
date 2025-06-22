import { test, expect } from '@playwright/test';

test.describe('Frontend-Only Production Tests', () => {
  test('app loads and renders main UI', async ({ page }) => {
    await page.goto('/');
    
    // Check if the app content loads (more reliable than title)
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'VectorSpace', exact: true })).toBeVisible();
    
    // Should show some form of authentication UI
    const hasLoginForm = await page.locator('form').isVisible().catch(() => false);
    const hasLoginButton = await page.locator('button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")').isVisible().catch(() => false);
    
    expect(hasLoginForm || hasLoginButton).toBeTruthy();
  });

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Page should still be usable on mobile
    await expect(page.locator('main')).toBeVisible();
  });

  test('navigation elements exist', async ({ page }) => {
    await page.goto('/');
    
    // Wait for main content to load
    await expect(page.locator('main')).toBeVisible();
    
    // The VectorSpace heading should be present (this is our "branding")
    await expect(page.getByRole('heading', { name: 'VectorSpace', level: 1 })).toBeVisible();
  });
});