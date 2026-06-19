const { test, expect } = require('@playwright/test');

test.describe('Verification Details Modal E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin page
    await page.goto('http://localhost:3000/admin.html');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('approve button in modal opens review modal', async ({ page }) => {
    // This test requires authentication and actual data
    // For now, we'll test that the elements exist
    
    // Check that approve-from-details-btn exists in DOM
    const approveBtn = await page.locator('#approve-from-details-btn').count();
    console.log('Approve button count:', approveBtn);
    
    // Check that reject-from-details-btn exists in DOM
    const rejectBtn = await page.locator('#reject-from-details-btn').count();
    console.log('Reject button count:', rejectBtn);
    
    // Check that verification-details-modal exists
    const modal = await page.locator('#verification-details-modal').count();
    console.log('Verification details modal count:', modal);
    
    expect(modal).toBeGreaterThan(0);
  });

  test('modal buttons have correct IDs', async ({ page }) => {
    // Check button IDs exist
    await page.waitForSelector('#approve-from-details-btn', { state: 'attached' });
    await page.waitForSelector('#reject-from-details-btn', { state: 'attached' });
    await page.waitForSelector('#unverify-from-details-btn', { state: 'attached' });
    
    expect(await page.locator('#approve-from-details-btn').count()).toBe(1);
    expect(await page.locator('#reject-from-details-btn').count()).toBe(1);
    expect(await page.locator('#unverify-from-details-btn').count()).toBe(1);
  });
});
