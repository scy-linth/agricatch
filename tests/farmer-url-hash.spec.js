/**
 * Playwright test: Farmer URL Hash Verification
 * Tests that URL stays clean (no hash) when navigating between sections
 */
const { test, expect } = require('@playwright/test');
const { getFarmerToken } = require('./auth-helper');

let authToken;
let farmerUser;

test.beforeAll(async () => {
  // Generate a valid farmer JWT token by querying the database
  const result = await getFarmerToken();
  authToken = result.token;
  farmerUser = result.user;
  console.log(`Authenticated as farmer: ${farmerUser.email} (${farmerUser.role})`);
});

test.describe('Farmer URL Hash Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Inject token and navigate to farmer dashboard
    await page.goto('http://localhost:3000/farmer.html');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    // Reload so farmer.js picks up the token
    await page.reload();
    // Wait for dashboard overview to be active
    await page.waitForSelector('#overview.active', { timeout: 10000 });
  });

  // Helper function to test a sidebar navigation item and verify URL
  async function testSidebarLinkAndURL(page, sectionId, linkSelector) {
    // Wait for loading screen to disappear if present
    const loadingScreen = page.locator('#admin-loading-screen');
    if (await loadingScreen.isVisible()) {
      await loadingScreen.waitFor({ state: 'hidden', timeout: 10000 });
    }
    
    // Get current URL before navigation
    const urlBefore = page.url();
    console.log(`URL before clicking ${sectionId}:`, urlBefore);
    
    // Click the sidebar link
    await page.click(linkSelector);
    
    // Wait a moment for navigation to complete
    await page.waitForTimeout(100);
    
    // Verify the section becomes active
    await expect(page.locator(`#${sectionId}`)).toHaveClass(/active/);
    
    // Get URL after navigation
    const urlAfter = page.url();
    console.log(`URL after clicking ${sectionId}:`, urlAfter);
    
    // Verify URL does NOT contain a hash
    expect(urlAfter).not.toContain('#');
    expect(urlAfter).toBe('http://localhost:3000/farmer.html');
    
    return true;
  }

  test('Dashboard navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'overview', 'a[data-section="overview"]');
  });

  test('Orders navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'orders', 'a[data-section="orders"]');
  });

  test('Products navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'products', 'a[data-section="products"]');
  });

  test('Chat navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'chat', 'a[data-section="chat"]');
  });

  test('Notifications navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'notifications', 'a[data-section="notifications"]');
  });

  test('Reviews navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'reviews', 'a[data-section="reviews"]');
  });

  test('Subscription navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'subscription', 'a[data-section="subscription"]');
  });

  test('Shop Profile navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'shop', 'a[data-section="shop"]');
  });

  test('Profile navigation - URL should stay clean', async ({ page }) => {
    await testSidebarLinkAndURL(page, 'profile', 'a[data-section="profile"]');
  });

  test('Initial page load - URL should be clean', async ({ page }) => {
    const url = page.url();
    console.log('Initial URL:', url);
    expect(url).not.toContain('#');
    expect(url).toBe('http://localhost:3000/farmer.html');
  });

  test('Navigate through multiple sections - URL should stay clean', async ({ page }) => {
    const sections = ['orders', 'products', 'chat', 'notifications', 'profile'];
    
    for (const section of sections) {
      await page.click(`a[data-section="${section}"]`);
      await page.waitForTimeout(100);
      
      const url = page.url();
      console.log(`URL after navigating to ${section}:`, url);
      expect(url).not.toContain('#');
      expect(url).toBe('http://localhost:3000/farmer.html');
      
      // Verify section is active
      await expect(page.locator(`#${section}`)).toHaveClass(/active/);
    }
  });
});
