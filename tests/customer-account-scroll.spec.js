const { test, expect } = require('@playwright/test');

test.describe('Customer Account Scroll Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customer-account.html');
    await page.waitForSelector('#admin-loading-screen', { state: 'hidden', timeout: 10000 }).catch(() => {});
  });

  test('should be at scroll position 0 after clicking Edit Profile', async ({ page }) => {
    // Click Edit Profile
    await page.click('a[data-section="profile-edit"]');
    
    // Wait a moment for navigation
    await page.waitForTimeout(100);
    
    // Check scroll position should be 0
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('should be at scroll position 0 after clicking Request Verification', async ({ page }) => {
    // Click Request Verification
    await page.click('a[data-section="profile-verification"]');
    
    // Wait a moment for navigation
    await page.waitForTimeout(100);
    
    // Check scroll position should be 0
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('should be at scroll position 0 after clicking Change Password', async ({ page }) => {
    // Click Change Password
    await page.click('a[data-section="profile-password"]');
    
    // Wait a moment for navigation
    await page.waitForTimeout(100);
    
    // Check scroll position should be 0
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('should be at scroll position 0 after clicking Support Tickets', async ({ page }) => {
    // Click Support Tickets
    await page.click('a[data-section="support-tickets"]');
    
    // Wait a moment for navigation
    await page.waitForTimeout(100);
    
    // Check scroll position should be 0
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('should be at scroll position 0 after clicking My Profile', async ({ page }) => {
    // Click My Profile
    await page.click('a[data-section="profile-overview"]');
    
    // Wait a moment for navigation
    await page.waitForTimeout(100);
    
    // Check scroll position should be 0
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('should be at top when loading page with hash', async ({ page }) => {
    // Navigate directly to edit profile with hash
    await page.goto('/customer-account.html#profile-edit');
    await page.waitForSelector('#admin-loading-screen', { state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Wait for section to load
    await page.waitForTimeout(200);
    
    // Check scroll position
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('should be at top when loading page with verification hash', async ({ page }) => {
    // Navigate directly to verification with hash
    await page.goto('/customer-account.html#profile-verification');
    await page.waitForSelector('#admin-loading-screen', { state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Wait for section to load
    await page.waitForTimeout(200);
    
    // Check scroll position
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
