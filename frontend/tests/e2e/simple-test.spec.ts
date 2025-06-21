import { test, expect } from '@playwright/test';

test('simple page load test', async ({ page }) => {
  // Capture console errors
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  
  // Capture page errors
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });
  
  const response = await page.goto('/');
  
  // Wait for any async operations
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Log what we found
  console.log('Console messages:', consoleMessages);
  console.log('Page errors:', pageErrors);
  console.log('Page response status:', response?.status());
  
  // Screenshot for debugging
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
  
  // Check HTML content
  const html = await page.content();
  console.log('HTML includes react:', html.includes('react'));
  console.log('HTML includes main.tsx:', html.includes('main.tsx'));
  console.log('HTML length:', html.length);
  
  // Check if page has any content
  const bodyText = await page.textContent('body');
  console.log('Page body text length:', bodyText?.length || 0);
  
  // Check if root div has content
  const rootContent = await page.locator('#root').innerHTML().catch(() => 'NOT_FOUND');
  console.log('Root div content:', rootContent?.substring(0, 100) || 'EMPTY');
  
  // More lenient assertion for debugging
  expect(response?.status()).toBe(200);
  expect(bodyText?.trim().length).toBeGreaterThan(0);
});