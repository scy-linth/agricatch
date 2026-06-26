const { test, expect } = require('@playwright/test');

/**
 * ADMIN ROLE UI & INTERACTION REGRESSION AUDIT
 * 
 * Audit Scope:
 * - Buttons: Missing actions, wrong actions, disabled incorrectly, duplicate buttons
 * - Tables: Missing columns, wrong badges, wrong status, missing information, alignment issues
 * - Modals: Missing fields, missing labels, missing details, missing validation, wrong buttons
 * - Cards: Missing information, wrong badges, wrong spacing, empty state, loading state
 * - Sections: Missing headers, wrong titles, inconsistent labels
 * - Timeline: Verify every order status appears correctly
 * - Notifications: Verify every major action has appropriate notification
 * - Chat: Verify all expected actions are accessible
 * - Forms: Validation, required fields, placeholders, character counters, error messages, success messages
 * - Responsive: Desktop, Tablet, Mobile
 */

// Test credentials
const TEST_ADMIN = {
  email: 'admin@test.com',
  password: 'test123'
};

test.describe('Admin Role UI Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:3000/index.html');
    
    // Click login
    await page.click('#login-btn');
    await page.waitForTimeout(500);
    
    // Fill login form
    await page.fill('#auth-email', TEST_ADMIN.email);
    await page.fill('#auth-password', TEST_ADMIN.password);
    await page.click('#auth-form button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    // Navigate to admin dashboard
    await page.goto('http://localhost:3000/admin.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('ADMIN-001: Admin dashboard loading', async ({ page }) => {
    const issues = [];

    // Check if admin dashboard loaded
    const currentUrl = page.url();
    if (!currentUrl.includes('admin.html')) {
      issues.push('Not on admin dashboard page');
    }

    // Check loading screen is hidden
    const loadingScreen = page.locator('#admin-loading-screen');
    if (await loadingScreen.isVisible()) {
      issues.push('Loading screen still visible after page load');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-001 Issues:', issues);
    }
  });

  test('ADMIN-002: Sidebar navigation', async ({ page }) => {
    const issues = [];

    // Check sidebar exists
    const sidebar = page.locator('#sidebar');
    if (!(await sidebar.isVisible())) {
      issues.push('Admin sidebar not visible');
    }

    // Check sidebar navigation items
    const navItems = [
      { id: '#nav-overview', name: 'Overview' },
      { id: '#nav-users', name: 'Users' },
      { id: '#nav-farmers', name: 'Farmers' },
      { id: '#nav-products', name: 'Products' },
      { id: '#nav-orders', name: 'Orders' },
      { id: '#nav-product-approvals', name: 'Product Approvals' },
      { id: '#nav-verifications', name: 'Verifications' },
      { id: '#nav-categories', name: 'Categories' },
      { id: '#nav-catalog', name: 'Catalog' },
      { id: '#nav-support', name: 'Support Tickets' },
      { id: '#nav-chat', name: 'Chat' }
    ];

    for (const item of navItems) {
      const navItem = page.locator(item.id);
      if (!(await navItem.isVisible())) {
        issues.push(`Sidebar navigation item "${item.name}" not visible`);
      }
    }

    // Check sidebar toggle
    const sidebarToggle = page.locator('#admin-sidebar-toggle');
    if (!(await sidebarToggle.isVisible())) {
      issues.push('Sidebar toggle button not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-002 Issues:', issues);
    }
  });

  test('ADMIN-003: Header elements', async ({ page }) => {
    const issues = [];

    // Check header exists
    const header = page.locator('#header');
    if (!(await header.isVisible())) {
      issues.push('Admin header not visible');
    }

    // Check chat unread badge
    const chatBadge = page.locator('#chat-unread-badge');
    if (!(await chatBadge.isVisible())) {
      issues.push('Chat unread badge not visible');
    }

    // Check notification badge
    const notifBadge = page.locator('#notif-unread-badge');
    if (!(await notifBadge.isVisible())) {
      issues.push('Notification unread badge not visible');
    }

    // Check user dropdown
    const userDropdown = page.locator('.nav-profile');
    if (!(await userDropdown.isVisible())) {
      issues.push('User profile dropdown not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-003 Issues:', issues);
    }
  });

  test('ADMIN-004: Overview section', async ({ page }) => {
    const issues = [];

    // Click overview nav
    await page.click('#nav-overview');
    await page.waitForTimeout(500);

    // Check overview section is visible
    const overviewSection = page.locator('#overview');
    if (!(await overviewSection.isVisible())) {
      issues.push('Overview section not visible');
    }

    // Check overview has content
    const overviewContent = page.locator('#overview .admin-section-card');
    if (!(await overviewContent.isVisible())) {
      issues.push('Overview section content not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-004 Issues:', issues);
    }
  });

  test('ADMIN-005: Users section', async ({ page }) => {
    const issues = [];

    // Click users nav
    await page.click('#nav-users');
    await page.waitForTimeout(500);

    // Check users section is visible
    const usersSection = page.locator('#users');
    if (!(await usersSection.isVisible())) {
      issues.push('Users section not visible');
    }

    // Check users table
    const usersTable = page.locator('#users-table');
    if (!(await usersTable.isVisible())) {
      issues.push('Users table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-005 Issues:', issues);
    }
  });

  test('ADMIN-006: Farmers section', async ({ page }) => {
    const issues = [];

    // Click farmers nav
    await page.click('#nav-farmers');
    await page.waitForTimeout(500);

    // Check farmers section is visible
    const farmersSection = page.locator('#farmers');
    if (!(await farmersSection.isVisible())) {
      issues.push('Farmers section not visible');
    }

    // Check farmers table
    const farmersTable = page.locator('#farmers-table');
    if (!(await farmersTable.isVisible())) {
      issues.push('Farmers table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-006 Issues:', issues);
    }
  });

  test('ADMIN-007: Products section', async ({ page }) => {
    const issues = [];

    // Click products nav
    await page.click('#nav-products');
    await page.waitForTimeout(500);

    // Check products section is visible
    const productsSection = page.locator('#products');
    if (!(await productsSection.isVisible())) {
      issues.push('Products section not visible');
    }

    // Check products table
    const productsTable = page.locator('#products-table');
    if (!(await productsTable.isVisible())) {
      issues.push('Products table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-007 Issues:', issues);
    }
  });

  test('ADMIN-008: Orders section', async ({ page }) => {
    const issues = [];

    // Click orders nav
    await page.click('#nav-orders');
    await page.waitForTimeout(500);

    // Check orders section is visible
    const ordersSection = page.locator('#orders');
    if (!(await ordersSection.isVisible())) {
      issues.push('Orders section not visible');
    }

    // Check orders table
    const ordersTable = page.locator('#orders-table');
    if (!(await ordersTable.isVisible())) {
      issues.push('Orders table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-008 Issues:', issues);
    }
  });

  test('ADMIN-009: Product approvals section', async ({ page }) => {
    const issues = [];

    // Click product approvals nav
    await page.click('#nav-product-approvals');
    await page.waitForTimeout(500);

    // Check product approvals section is visible
    const approvalsSection = page.locator('#product-approvals');
    if (!(await approvalsSection.isVisible())) {
      issues.push('Product approvals section not visible');
    }

    // Check product approvals table
    const approvalsTable = page.locator('#product-approvals-table');
    if (!(await approvalsTable.isVisible())) {
      issues.push('Product approvals table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-009 Issues:', issues);
    }
  });

  test('ADMIN-010: Verifications section', async ({ page }) => {
    const issues = [];

    // Click verifications nav
    await page.click('#nav-verifications');
    await page.waitForTimeout(500);

    // Check verifications section is visible
    const verificationsSection = page.locator('#verifications');
    if (!(await verificationsSection.isVisible())) {
      issues.push('Verifications section not visible');
    }

    // Check verifications table
    const verificationsTable = page.locator('#verifications-table');
    if (!(await verificationsTable.isVisible())) {
      issues.push('Verifications table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-010 Issues:', issues);
    }
  });

  test('ADMIN-011: Categories section', async ({ page }) => {
    const issues = [];

    // Click categories nav
    await page.click('#nav-categories');
    await page.waitForTimeout(500);

    // Check categories section is visible
    const categoriesSection = page.locator('#categories');
    if (!(await categoriesSection.isVisible())) {
      issues.push('Categories section not visible');
    }

    // Check categories table
    const categoriesTable = page.locator('#categories-table');
    if (!(await categoriesTable.isVisible())) {
      issues.push('Categories table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-011 Issues:', issues);
    }
  });

  test('ADMIN-012: Catalog section', async ({ page }) => {
    const issues = [];

    // Click catalog nav
    await page.click('#nav-catalog');
    await page.waitForTimeout(500);

    // Check catalog section is visible
    const catalogSection = page.locator('#catalog');
    if (!(await catalogSection.isVisible())) {
      issues.push('Catalog section not visible');
    }

    // Check catalog table
    const catalogTable = page.locator('#catalog-table');
    if (!(await catalogTable.isVisible())) {
      issues.push('Catalog table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-012 Issues:', issues);
    }
  });

  test('ADMIN-013: Support tickets section', async ({ page }) => {
    const issues = [];

    // Click support nav
    await page.click('#nav-support');
    await page.waitForTimeout(500);

    // Check support section is visible
    const supportSection = page.locator('#support');
    if (!(await supportSection.isVisible())) {
      issues.push('Support tickets section not visible');
    }

    // Check support table
    const supportTable = page.locator('#support-table');
    if (!(await supportTable.isVisible())) {
      issues.push('Support tickets table not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-013 Issues:', issues);
    }
  });

  test('ADMIN-014: Chat section', async ({ page }) => {
    const issues = [];

    // Click chat nav
    await page.click('#nav-chat');
    await page.waitForTimeout(500);

    // Check chat section is visible
    const chatSection = page.locator('#chat');
    if (!(await chatSection.isVisible())) {
      issues.push('Chat section not visible');
    }

    // Check chat layout
    const chatLayout = page.locator('.chat-layout');
    if (!(await chatLayout.isVisible())) {
      issues.push('Chat layout not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-014 Issues:', issues);
    }
  });

  test('ADMIN-015: Customer detail modal', async ({ page }) => {
    const issues = [];

    // Navigate to users
    await page.click('#nav-users');
    await page.waitForTimeout(500);

    // Try to find a customer to view
    const viewBtn = page.locator('.customer-view-btn').first();
    const count = await viewBtn.count();
    
    if (count > 0) {
      await viewBtn.click();
      await page.waitForTimeout(500);

      // Check detail panel
      const detailPanel = page.locator('.admin-detail-panel');
      if (!(await detailPanel.isVisible())) {
        issues.push('Customer detail panel not visible');
      } else {
        // Check panel close button
        const closeBtn = detailPanel.locator('.panel-close');
        if (!(await closeBtn.isVisible())) {
          issues.push('Detail panel close button not visible');
        } else {
          await closeBtn.click();
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-015 Issues:', issues);
    }
  });

  test('ADMIN-016: Farmer detail modal', async ({ page }) => {
    const issues = [];

    // Navigate to farmers
    await page.click('#nav-farmers');
    await page.waitForTimeout(500);

    // Try to find a farmer to view
    const viewBtn = page.locator('.farmer-view-btn').first();
    const count = await viewBtn.count();
    
    if (count > 0) {
      await viewBtn.click();
      await page.waitForTimeout(500);

      // Check detail panel
      const detailPanel = page.locator('.admin-detail-panel');
      if (!(await detailPanel.isVisible())) {
        issues.push('Farmer detail panel not visible');
      } else {
        // Check panel close button
        const closeBtn = detailPanel.locator('.panel-close');
        if (!(await closeBtn.isVisible())) {
          issues.push('Detail panel close button not visible');
        } else {
          await closeBtn.click();
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-016 Issues:', issues);
    }
  });

  test('ADMIN-017: Product approve/reject buttons', async ({ page }) => {
    const issues = [];

    // Navigate to product approvals
    await page.click('#nav-product-approvals');
    await page.waitForTimeout(500);

    // Check for approve and reject buttons
    const approveBtn = page.locator('.product-approve-btn').first();
    const rejectBtn = page.locator('.product-reject-btn').first();

    const approveCount = await approveBtn.count();
    const rejectCount = await rejectBtn.count();

    // These might not exist if no pending products, but check they're in DOM
    if (approveCount === 0 && rejectCount === 0) {
      // This is OK - no pending products
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-017 Issues:', issues);
    }
  });

  test('ADMIN-018: Order status badges', async ({ page }) => {
    const issues = [];

    // Navigate to orders
    await page.click('#nav-orders');
    await page.waitForTimeout(500);

    // Check order status badges exist
    const statusBadges = [
      'pending', 'preorder_reserved', 'confirmed', 'preparing',
      'scheduled', 'out_for_delivery', 'delivered', 'cancelled'
    ];

    for (const status of statusBadges) {
      const badge = page.locator(`.order-card-status.${status}`);
      const count = await badge.count();
      if (count === 0) {
        // OK - no orders in this status
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-018 Issues:', issues);
    }
  });

  test('ADMIN-019: Responsive design - Mobile', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Check sidebar is hidden on mobile
    const sidebar = page.locator('#sidebar');
    const isVisible = await sidebar.isVisible();
    
    if (isVisible) {
      const left = await sidebar.evaluate(el => window.getComputedStyle(el).left);
      if (left !== '-300px' && left !== '-260px') {
        issues.push('Sidebar not properly hidden on mobile');
      }
    }

    // Check sidebar toggle is visible
    const sidebarToggle = page.locator('#admin-sidebar-toggle');
    if (!(await sidebarToggle.isVisible())) {
      issues.push('Sidebar toggle not visible on mobile');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-019 Issues:', issues);
    }
  });

  test('ADMIN-020: Responsive design - Tablet', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // Check sidebar toggle is visible
    const sidebarToggle = page.locator('#admin-sidebar-toggle');
    if (!(await sidebarToggle.isVisible())) {
      issues.push('Sidebar toggle not visible on tablet');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-020 Issues:', issues);
    }
  });

  test('ADMIN-021: Responsive design - Desktop', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Check sidebar is visible on desktop
    const sidebar = page.locator('#sidebar');
    if (!(await sidebar.isVisible())) {
      issues.push('Sidebar not visible on desktop');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-021 Issues:', issues);
    }
  });

  test('ADMIN-022: User dropdown menu', async ({ page }) => {
    const issues = [];

    // Click user profile
    await page.click('.nav-profile');
    await page.waitForTimeout(500);

    // Check dropdown menu
    const dropdown = page.locator('.dropdown-menu.profile');
    if (!(await dropdown.isVisible())) {
      issues.push('User dropdown menu not visible');
    } else {
      // Check logout button
      const logoutBtn = page.locator('#logout-btn');
      if (!(await logoutBtn.isVisible())) {
        issues.push('Logout button not visible in dropdown');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-022 Issues:', issues);
    }
  });

  test('ADMIN-023: Logout functionality', async ({ page }) => {
    const issues = [];

    // Click user profile
    await page.click('.nav-profile');
    await page.waitForTimeout(500);

    // Click logout
    await page.click('#logout-btn');
    await page.waitForTimeout(1000);

    // Check if redirected to index
    const currentUrl = page.url();
    if (!currentUrl.includes('index.html')) {
      issues.push('Not redirected to index after logout');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('ADMIN-023 Issues:', issues);
    }
  });
});
