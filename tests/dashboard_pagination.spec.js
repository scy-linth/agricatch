/**
 * Playwright test: Dashboard entries-per-page pagination
 * Tests that changing "entries per page" dropdown limits rows in all 4 sections
 */
const { test, expect } = require('@playwright/test');
const { getAdminToken } = require('./auth-helper');

let authToken;

test.beforeAll(async () => {
  // Generate a valid admin JWT token by querying the database
  const result = await getAdminToken();
  authToken = result.token;
  console.log(`Authenticated as admin: ${result.user.email}`);
});

test.describe('Dashboard Entries Per Page', () => {
  test.beforeEach(async ({ page }) => {
    // Inject token and navigate to admin dashboard
    await page.goto('http://localhost:3000/admin.html');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    // Reload so admin.js picks up the token
    await page.reload();
    // Wait for dashboard overview to be active
    await page.waitForSelector('#overview.active', { timeout: 10000 });
    // Wait for initial data to load
    await page.waitForTimeout(3000);

    // Wait for dashboard widgets to load (look for pagination text appearing)
    await page.waitForFunction(() => {
      const paginations = document.querySelectorAll('.pagination-info');
      return paginations.length >= 4;
    }, { timeout: 10000 });
  });

  test('Recent Sales entries-per-page sends correct limit in API call', async ({ page }) => {
    const section = 'recent-sales';
    const selectSelector = `[data-entries-section="${section}"]`;

    // Intercept the API call to verify limit parameter
    let capturedLimit = null;
    await page.route('**/api/admin/orders?*', async (route) => {
      const url = route.request().url();
      const limitMatch = url.match(/limit=(\d+)/);
      capturedLimit = limitMatch ? limitMatch[1] : null;
      console.log(`[INTERCEPT] Recent Sales API call: ${url}, limit=${capturedLimit}`);
      await route.continue();
    });

    // Change to limit=5
    await page.selectOption(selectSelector, '5');
    await page.waitForTimeout(3000);

    console.log(`[TEST] Captured limit for Recent Sales: ${capturedLimit}`);
    expect(capturedLimit).toBe('5');
  });

  test('Top Products entries-per-page sends correct limit in API call', async ({ page }) => {
    const section = 'top-products';
    const selectSelector = `[data-entries-section="${section}"]`;

    let capturedLimit = null;
    await page.route('**/api/admin/dashboard/top-products?*', async (route) => {
      const url = route.request().url();
      const limitMatch = url.match(/limit=(\d+)/);
      capturedLimit = limitMatch ? limitMatch[1] : null;
      console.log(`[INTERCEPT] Top Products API call: ${url}, limit=${capturedLimit}`);
      await route.continue();
    });

    await page.selectOption(selectSelector, '5');
    await page.waitForTimeout(3000);

    console.log(`[TEST] Captured limit for Top Products: ${capturedLimit}`);
    expect(capturedLimit).toBe('5');
  });

  test('Top Farmers entries-per-page sends correct limit in API call', async ({ page }) => {
    const section = 'top-farmers';
    const selectSelector = `[data-entries-section="${section}"]`;

    let capturedLimit = null;
    await page.route('**/api/admin/dashboard/top-farmers?*', async (route) => {
      const url = route.request().url();
      const limitMatch = url.match(/limit=(\d+)/);
      capturedLimit = limitMatch ? limitMatch[1] : null;
      console.log(`[INTERCEPT] Top Farmers API call: ${url}, limit=${capturedLimit}`);
      await route.continue();
    });

    await page.selectOption(selectSelector, '5');
    await page.waitForTimeout(3000);

    console.log(`[TEST] Captured limit for Top Farmers: ${capturedLimit}`);
    expect(capturedLimit).toBe('5');
  });

  test('Recent Activity entries-per-page sends correct limit in API call', async ({ page }) => {
    const section = 'activity';
    const selectSelector = `[data-entries-section="${section}"]`;

    let capturedLimit = null;
    await page.route('**/api/admin/dashboard/recent-activity?*', async (route) => {
      const url = route.request().url();
      const limitMatch = url.match(/limit=(\d+)/);
      capturedLimit = limitMatch ? limitMatch[1] : null;
      console.log(`[INTERCEPT] Recent Activity API call: ${url}, limit=${capturedLimit}`);
      await route.continue();
    });

    await page.selectOption(selectSelector, '5');
    await page.waitForTimeout(3000);

    console.log(`[TEST] Captured limit for Recent Activity: ${capturedLimit}`);
    expect(capturedLimit).toBe('5');
  });
});
