/**
 * Playwright test: Admin Sidebar Navigation Verification
 * Tests each sidebar navigation item, section loading, modals, buttons, and API endpoints
 */
const { test, expect } = require('@playwright/test');
const { getAdminToken } = require('./auth-helper');

let authToken;
let adminUser;

test.beforeAll(async () => {
  // Generate a valid admin JWT token by querying the database
  const result = await getAdminToken();
  authToken = result.token;
  adminUser = result.user;
  console.log(`Authenticated as admin: ${adminUser.email} (${adminUser.role})`);
});

test.describe('Admin Sidebar Navigation', () => {
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
  });

  // Helper function to test a sidebar navigation item
  async function testSidebarLink(page, sectionId, linkSelector, expectedTitle) {
    // Wait for loading screen to disappear if present
    const loadingScreen = page.locator('#admin-loading-screen');
    if (await loadingScreen.isVisible()) {
      await loadingScreen.waitFor({ state: 'hidden', timeout: 10000 });
    }
    
    // Click the sidebar link
    await page.click(linkSelector);
    
    // Verify the section becomes active
    await expect(page.locator(`#${sectionId}`)).toHaveClass(/active/);
    
    // Verify page title is updated
    const pageTitle = await page.locator('.page-title').textContent();
    expect(pageTitle).toContain(expectedTitle);
    
    // Verify the section element exists in DOM
    await expect(page.locator(`#${sectionId}`)).toBeVisible();
    
    return true;
  }

  test('Dashboard navigation', async ({ page }) => {
    await testSidebarLink(page, 'overview', 'a[data-section="overview"]', 'Dashboard Overview');
  });

  test('Orders navigation', async ({ page }) => {
    await testSidebarLink(page, 'orders', 'a[data-section="orders"]', 'Order Management');
  });

  test('Listings (Products) navigation', async ({ page }) => {
    await testSidebarLink(page, 'products', 'a[data-section="products"]', 'Listings');
  });

  test('Catalog submenu - Products navigation', async ({ page }) => {
    // First expand the catalog submenu
    await page.click('a[data-bs-target="#nav-catalog"]');
    await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
    
    await testSidebarLink(page, 'catalog-products', 'a[data-section="catalog-products"]', 'Product Catalog');
  });

  test('Catalog submenu - Categories navigation', async ({ page }) => {
    await page.click('a[data-bs-target="#nav-catalog"]');
    await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
    
    await testSidebarLink(page, 'categories', 'a[data-section="categories"]', 'Category Management');
  });

  test('Catalog submenu - Catalog Requests navigation', async ({ page }) => {
    await page.click('a[data-bs-target="#nav-catalog"]');
    await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
    
    await testSidebarLink(page, 'category-requests', 'a[data-section="category-requests"]', 'Product Catalog Requests');
  });

  test('Pending Approvals navigation', async ({ page }) => {
    await testSidebarLink(page, 'product-approvals', 'a[data-section="product-approvals"]', 'Pending Approvals');
  });

  test('Customers navigation', async ({ page }) => {
    await testSidebarLink(page, 'users', 'a[data-section="users"]', 'Customer Management');
  });

  test('Farmers navigation', async ({ page }) => {
    await testSidebarLink(page, 'farmers', 'a[data-section="farmers"]', 'Farmer Management');
  });

  test('Chat & Support navigation', async ({ page }) => {
    await testSidebarLink(page, 'chat', 'a[data-section="chat"]', 'Chat & Support');
  });

  test('Notifications navigation', async ({ page }) => {
    await testSidebarLink(page, 'notifications', 'a[data-section="notifications"]', 'Notifications');
  });

  // Super Admin only sections
  test.describe('Super Admin Sections', () => {
    test.beforeEach(async ({ page }) => {
      // Skip if user is not super_admin
      if (adminUser.role !== 'super_admin') {
        test.skip();
      }
    });

    test('Staff navigation', async ({ page }) => {
      await testSidebarLink(page, 'staff', 'a[data-section="staff"]', 'Staff Management');
    });

    test('All Users navigation', async ({ page }) => {
      await testSidebarLink(page, 'all-users', 'a[data-section="all-users"]', 'All Users');
    });

    test('Suspicious Patterns navigation', async ({ page }) => {
      await testSidebarLink(page, 'suspicious-patterns', 'a[data-section="suspicious-patterns"]', 'Suspicious Patterns');
    });

    test('Flagged Users navigation', async ({ page }) => {
      await testSidebarLink(page, 'flagged-users', 'a[data-section="flagged-users"]', 'Flagged Users');
    });

    test('Security Log navigation', async ({ page }) => {
      await testSidebarLink(page, 'security-log', 'a[data-section="security-log"]', 'Security Log');
    });

    test('Audit Logs navigation', async ({ page }) => {
      await testSidebarLink(page, 'logs', 'a[data-section="logs"]', 'Audit Logs');
    });

    test('Platform Settings navigation', async ({ page }) => {
      await testSidebarLink(page, 'platform-settings', 'a[data-section="platform-settings"]', 'Platform Settings');
    });

    test('Feature Flags navigation', async ({ page }) => {
      await testSidebarLink(page, 'feature-flags', 'a[data-section="feature-flags"]', 'Feature Flags');
    });

    test('Broadcast navigation', async ({ page }) => {
      await testSidebarLink(page, 'broadcast', 'a[data-section="broadcast"]', 'Broadcast Announcement');
    });
  });

  // Test that staff users cannot access super_admin sections
  test.describe('Role-Based Access Control', () => {
    test.beforeEach(async ({ page }) => {
      // Only test if user is NOT super_admin
      if (adminUser.role === 'super_admin') {
        test.skip();
      }
    });

    test('Staff cannot access super_admin sections', async ({ page }) => {
      // Verify super_admin sections have data-roles attribute
      const superAdminSections = page.locator('.admin-section-card[data-roles="super_admin"]');
      const count = await superAdminSections.count();
      expect(count).toBeGreaterThan(0);
      
      // Try to navigate to a super_admin section directly
      await page.goto('http://localhost:3000/admin.html#staff');
      await page.reload();
      
      // Should be redirected to overview with access denied message
      await page.waitForSelector('#overview.active', { timeout: 5000 });
      
      // Check for toast message
      const toast = page.locator('.toast');
      if (await toast.count() > 0) {
        expect(await toast.textContent()).toContain('Access denied');
      }
    });
  });

  // Test catalog submenu behavior
  test('Catalog submenu expand/collapse', async ({ page }) => {
    const catalogMenu = page.locator('#nav-catalog');
    const catalogToggle = page.locator('a[data-bs-target="#nav-catalog"]');
    
    // Initially collapsed
    await expect(catalogMenu).not.toHaveClass(/show/);
    await expect(catalogToggle).toHaveClass(/collapsed/);
    
    // Expand
    await catalogToggle.click();
    await expect(catalogMenu).toHaveClass(/show/);
    await expect(catalogToggle).not.toHaveClass(/collapsed/);
    
    // Navigate to a catalog section
    await page.click('a[data-section="catalog-products"]');
    await page.waitForSelector('#catalog-products.active', { timeout: 5000 });
    
    // Menu should remain expanded
    await expect(catalogMenu).toHaveClass(/show/);
    
    // Navigate to a non-catalog section
    await page.click('a[data-section="orders"]');
    await page.waitForSelector('#orders.active', { timeout: 5000 });
    
    // Menu should collapse
    await expect(catalogMenu).not.toHaveClass(/show/);
    await expect(catalogToggle).toHaveClass(/collapsed/);
  });
});

test.describe('Backend API Health Check', () => {
  test('Health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/_health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('db');
    
    console.log(`Health check: status=${body.status}, db=${body.db}`);
  });

  test('Admin stats endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('stats');
    console.log('Admin stats endpoint: OK');
  });

  test('Admin users endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/admin/users?page=1&limit=10', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('users');
    console.log('Admin users endpoint: OK');
  });

  test('Admin orders endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/admin/orders?page=1&limit=10', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('orders');
    console.log('Admin orders endpoint: OK');
  });

  test('Admin products endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/admin/products?page=1&limit=10', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('products');
    console.log('Admin products endpoint: OK');
  });

  test('Admin categories endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/admin/categories?page=1&limit=10', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('categories');
    console.log('Admin categories endpoint: OK');
  });

  test('Admin logs endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/admin/logs?page=1&limit=10', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('logs');
    console.log('Admin logs endpoint: OK');
  });
});

test.describe('Database Connectivity', () => {
  test('Database connection via health check', async ({ request }) => {
    const response = await request.get('http://localhost:3000/_health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.db).toBe('ok');
    console.log('Database connectivity: OK');
  });

  test('Database query via auth helper', async () => {
    // Reuse the auth helper to verify database connection
    const result = await getAdminToken();
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user).toHaveProperty('id');
    expect(result.user).toHaveProperty('email');
    console.log('Database query via auth helper: OK');
  });
});
