import { test, expect } from '@playwright/test';

test('edit profile functionality', async ({ page }) => {
  // Go directly to profile page (assuming user is logged in via auto-login)
  await page.goto('http://localhost:5173/profile/testuser');
  
  // Wait for page to load
  await page.waitForTimeout(3000);
  
  // Look for Edit Profile button
  const editButton = page.getByRole('button', { name: /Edit.*Profile|Settings/ });
  await expect(editButton).toBeVisible({ timeout: 10000 });
  
  // Click the Edit Profile button
  await editButton.click();
  
  // Should navigate to profile settings page
  await expect(page).toHaveURL(/profile-settings/);
  
  // Check that form fields are present
  await expect(page.locator('#display-name')).toBeVisible();
  await expect(page.locator('#bio')).toBeVisible();
  
  // Try filling out the form
  await page.locator('#display-name').fill('Test Updated Name');
  await page.locator('#bio').fill('This is my updated bio for testing');
  
  // Check that Save button is present
  await expect(page.getByRole('button', { name: /Save/ })).toBeVisible();
  
  console.log('✅ Edit Profile functionality verified successfully!');
});