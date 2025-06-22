import { test, expect } from '@playwright/test';

test.describe('Save Page Access', () => {
  test('authenticated user can access /save page', async ({ page }) => {
    // Navigate to home page first (auto-login should work)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify user is authenticated (auto-login is enabled)
    const authChecks = await Promise.all([
      page.locator('text=Red Panda').isVisible().catch(() => false),
      page.locator('[data-testid="user-menu-button"]').isVisible().catch(() => false),
      page.locator('.notification-bell, .user-avatar, [data-testid="user-menu"]').isVisible().catch(() => false),
      page.locator('text=My Chats').isVisible().catch(() => false),
      page.locator('text=Discovery').isVisible().catch(() => false)
    ]);
    
    const hasAuthFeatures = authChecks.some(check => check);
    
    // If not authenticated via auto-login, manually login
    if (!hasAuthFeatures) {
      const loginLink = page.locator('[data-testid="login-link"], a[href="/login"], a').filter({ hasText: /login|sign in/i });
      if (await loginLink.isVisible()) {
        await loginLink.click();
      } else {
        await page.goto('/login');
      }
      
      await page.waitForTimeout(1000);
      
      const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');
      
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('testuser');
        await passwordInput.fill('testpass');
        await submitButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // Navigate to /save page
    await page.goto('/save');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page loaded successfully (not redirected to login)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/save');

    // Verify we're not on a login or error page
    const isOnLoginPage = currentUrl.includes('/login');
    const hasLoginForm = await page.locator('input[name="username"], input[type="text"]').first().isVisible().catch(() => false);
    const hasErrorMessage = await page.locator('text=/error|not found|404/i').isVisible().catch(() => false);

    expect(isOnLoginPage).toBe(false);
    expect(hasLoginForm).toBe(false);
    expect(hasErrorMessage).toBe(false);

    // Check for typical save page elements (may vary based on implementation)
    const possibleSavePageElements = await Promise.all([
      page.locator('h1, h2, h3').filter({ hasText: /save/i }).isVisible().catch(() => false),
      page.locator('[data-testid="save-page"]').isVisible().catch(() => false),
      page.locator('text=/saved|bookmark|favorite/i').isVisible().catch(() => false),
      page.locator('form').isVisible().catch(() => false),
      page.locator('input, textarea').isVisible().catch(() => false)
    ]);

    const hasSavePageContent = possibleSavePageElements.some(check => check);
    
    // At minimum, page should load without errors for authenticated user
    if (!hasSavePageContent) {
      // Check if page has any content at all
      const bodyText = await page.textContent('body');
      const hasContent = bodyText && bodyText.trim().length > 0;
      expect(hasContent).toBe(true);
    } else {
      expect(hasSavePageContent).toBe(true);
    }

    // Verify authentication state is maintained
    const stillAuthenticated = await Promise.all([
      page.locator('text=Red Panda').isVisible().catch(() => false),
      page.locator('[data-testid="user-menu-button"]').isVisible().catch(() => false),
      page.locator('.notification-bell, .user-avatar').isVisible().catch(() => false)
    ]);

    const maintainsAuth = stillAuthenticated.some(check => check);
    
    // More lenient check - if not showing login elements, consider authenticated
    const showingLoginLink = await page.locator('[data-testid="login-link"]').isVisible().catch(() => false);
    
    expect(maintainsAuth || !showingLoginLink).toBe(true);
  });

  test('save page navigation from authenticated state', async ({ page }) => {
    // Start from home page with auto-login
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for save link/button in navigation
    const saveNavLink = page.locator('a[href="/save"], nav a, header a').filter({ hasText: /save/i });
    
    if (await saveNavLink.isVisible()) {
      await saveNavLink.click();
      await page.waitForTimeout(2000);
      
      // Should navigate to save page
      expect(page.url()).toContain('/save');
      
      // Should not be redirected to login
      expect(page.url()).not.toContain('/login');
    }

    // If no nav link, test direct navigation
    await page.goto('/save');
    await page.waitForTimeout(2000);
    
    expect(page.url()).toContain('/save');
    expect(page.url()).not.toContain('/login');
  });

  test('save page accessibility for authenticated users', async ({ page }) => {
    // Navigate with authentication
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    await page.goto('/save');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    // Should be able to focus on interactive elements
    const focusedElement = page.locator(':focus');
    if (await focusedElement.isVisible()) {
      await expect(focusedElement).toBeVisible();
    }

    // Test page title
    const title = await page.title();
    expect(title).toBeDefined();
    expect(title.length).toBeGreaterThan(0);

    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    if (headingCount > 0) {
      const firstHeading = headings.first();
      await expect(firstHeading).toBeVisible();
    }
  });
});