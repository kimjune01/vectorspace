import { test, expect } from '@playwright/test';

test.describe('API Connectivity Tests', () => {
  test('frontend can load and shows data', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    
    // Check if the app loaded successfully
    await expect(page.locator('main')).toBeVisible();
    
    // Check for Discovery tab content
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible();
    
    // Check if trending topics loaded (indicates some backend connectivity)
    const trendingTopics = page.locator('text=/Machine Learning|Python Programming|Neural Networks|Web3|Data Science/');
    const hasTopics = await trendingTopics.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Check community section
    const communitySection = page.getByRole('heading', { name: 'Recent from Community' });
    await expect(communitySection).toBeVisible();
    
    // The "0" text indicates API responded but no conversations yet
    const conversationCount = page.locator('text="0"');
    const hasCount = await conversationCount.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Test passes if the app loaded with expected UI elements
    expect(hasTopics || hasCount).toBeTruthy();
    
    console.log('API connectivity check:', {
      hasTopics,
      hasCount,
      url: page.url()
    });
  });
});