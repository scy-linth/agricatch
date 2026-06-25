const { test, expect } = require('@playwright/test');
const { getAdminToken, getCustomerToken, loginAsAdmin } = require('./auth-helper');

test.describe('Delivery Address Setting', () => {
  const BASE_URL = 'http://localhost:3000';
  
  test.beforeEach(async ({ page }) => {
    // Login as superadmin using token
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin.html`);
    await page.waitForURL(`${BASE_URL}/admin.html`);
  });

  test('Superadmin can toggle delivery address setting', async ({ page }) => {
    // Navigate to Platform Settings
    await page.click('a[data-section="platform-settings"]');
    await page.waitForSelector('#platform-settings');

    // Find the delivery address toggle
    const toggle = page.locator('#setting-use-default-delivery-address');
    await expect(toggle).toBeVisible();
    
    // Verify it's checked by default
    await expect(toggle).toBeChecked();

    // Toggle it off
    await toggle.click();
    await page.waitForTimeout(2000); // Wait for save to complete

    // Verify it's unchecked
    await expect(toggle).not.toBeChecked();

    // Toggle it back on
    await toggle.click();
    await page.waitForTimeout(2000); // Wait for save to complete

    // Verify it's checked again
    await expect(toggle).toBeChecked();
  });

  test('API returns delivery address setting correctly', async ({ request }) => {
    // Test the public API endpoint
    const response = await request.get(`${BASE_URL}/api/settings`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('use_default_delivery_address');
    expect(typeof data.use_default_delivery_address).toBe('boolean');
  });
});
