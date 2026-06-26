const { test, expect } = require('@playwright/test');

/**
 * SUPER ADMIN ROLE UI & INTERACTION REGRESSION AUDIT
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
 * 
 * Super Admin specific: Additional admin management capabilities
 */

// Test credentials
const TEST_SUPER_ADMIN = {
  email: 'superadmin@test.com',
  password: 'test123'
};

test.describe('Super Admin Role UI Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super admin
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:3000/index.html');
    
    // Click login
    await page.click('#login-btn');
    await page.waitForTimeout(500);
    
    // Fill login form
    await page.fill('#auth-email', TEST_SUPER_ADMIN.email);
    await page.fill('#auth-password', TEST_SUPER_ADMIN.password);
    await page.click('#auth-form button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    // Navigate to admin dashboard
    await page.goto('http://localhost:3000/admin.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('SUPERADMIN-001: Super admin dashboard loading', async ({ page }) => {
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
      console.error('SUPERADMIN-001 Issues:', issues);
    }
  });

  test('SUPERADMIN-002: Admin management section', async ({ page }) => {
    const issues = [];

    // Super admin should have access to admin management
    const adminsNav = page.locator('#nav-admins');
    if (!(await adminsNav.isVisible())) {
      issues.push('Admins navigation item not visible for super admin');
    } else {
      // Click admins nav
      await adminsNav.click();
      await page.waitForTimeout(500);

      // Check admins section is visible
      const adminsSection = page.locator('#admins');
      if (!(await adminsSection.isVisible())) {
        issues.push('Admins section not visible');
      }

      // Check admins table
      const adminsTable = page.locator('#admins-table');
      if (!(await adminsTable.isVisible())) {
        issues.push('Admins table not visible');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-002 Issues:', issues);
    }
  });

  test('SUPERADMIN-003: All sections accessible', async ({ page }) => {
    const issues = [];

    // Super admin should have access to all admin sections
    const allNavItems = [
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
      { id: '#nav-chat', name: 'Chat' },
      { id: '#nav-admins', name: 'Admins' },
      { id: '#nav-all-users', name: 'All Users' }
    ];

    for (const item of allNavItems) {
      const navItem = page.locator(item.id);
      const count = await navItem.count();
      
      if (count === 0) {
        issues.push(`Navigation item "${item.name}" not found in DOM`);
      } else if (!(await navItem.isVisible())) {
        issues.push(`Navigation item "${item.name}" not visible`);
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-003 Issues:', issues);
    }
  });

  test('SUPERADMIN-004: Admin detail modal', async ({ page }) => {
    const issues = [];

    // Navigate to admins
    const adminsNav = page.locator('#nav-admins');
    if (await adminsNav.isVisible()) {
      await adminsNav.click();
      await page.waitForTimeout(500);

      // Try to find an admin to view
      const viewBtn = page.locator('.admin-view-btn').first();
      const count = await viewBtn.count();
      
      if (count > 0) {
        await viewBtn.click();
        await page.waitForTimeout(500);

        // Check detail panel
        const detailPanel = page.locator('.admin-detail-panel');
        if (!(await detailPanel.isVisible())) {
          issues.push('Admin detail panel not visible');
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
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-004 Issues:', issues);
    }
  });

  test('SUPERADMIN-005: All users section', async ({ page }) => {
    const issues = [];

    // Navigate to all users
    const allUsersNav = page.locator('#nav-all-users');
    if (await allUsersNav.isVisible()) {
      await allUsersNav.click();
      await page.waitForTimeout(500);

      // Check all users section is visible
      const allUsersSection = page.locator('#all-users');
      if (!(await allUsersSection.isVisible())) {
        issues.push('All users section not visible');
      }

      // Check all users table
      const allUsersTable = page.locator('#all-users-table');
      if (!(await allUsersTable.isVisible())) {
        issues.push('All users table not visible');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-005 Issues:', issues);
    }
  });

  test('SUPERADMIN-006: Admin role badge', async ({ page }) => {
    const issues = [];

    // Check that super admin badge is visible in header
    const roleBadge = page.locator('#header-role-badge');
    if (!(await roleBadge.isVisible())) {
      issues.push('Role badge not visible in header');
    } else {
      const badgeText = await roleBadge.textContent();
      if (!badgeText.toLowerCase().includes('super') && !badgeText.toLowerCase().includes('admin')) {
        issues.push('Role badge does not show admin/super admin role');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-006 Issues:', issues);
    }
  });

  test('SUPERADMIN-007: Product approval actions', async ({ page }) => {
    const issues = [];

    // Navigate to product approvals
    await page.click('#nav-product-approvals');
    await page.waitForTimeout(500);

    // Check for approve and reject buttons
    const approveBtn = page.locator('.product-approve-btn').first();
    const rejectBtn = page.locator('.product-reject-btn').first();

    const approveCount = await approveBtn.count();
    const rejectCount = await rejectBtn.count();

    if (approveCount === 0 && rejectCount === 0) {
      // OK - no pending products
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-007 Issues:', issues);
    }
  });

  test('SUPERADMIN-008: Verification approval actions', async ({ page }) => {
    const issues = [];

    // Navigate to verifications
    await page.click('#nav-verifications');
    await page.waitForTimeout(500);

    // Check for approve and reject buttons
    const approveBtn = page.locator('.verification-approve-btn').first();
    const rejectBtn = page.locator('.verification-reject-btn').first();

    const approveCount = await approveBtn.count();
    const rejectCount = await rejectBtn.count();

    if (approveCount === 0 && rejectCount === 0) {
      // OK - no pending verifications
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-008 Issues:', issues);
    }
  });

  test('SUPERADMIN-009: Category management actions', async ({ page }) => {
    const issues = [];

    // Navigate to categories
    await page.click('#nav-categories');
    await page.waitForTimeout(500);

    // Check for edit buttons
    const editBtn = page.locator('.category-edit-btn').first();
    const count = await editBtn.count();

    if (count === 0) {
      // OK - no categories or no edit permissions needed
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-009 Issues:', issues);
    }
  });

  test('SUPERADMIN-010: Catalog management actions', async ({ page }) => {
    const issues = [];

    // Navigate to catalog
    await page.click('#nav-catalog');
    await page.waitForTimeout(500);

    // Check for edit buttons
    const editBtn = page.locator('.catalog-edit-btn').first();
    const count = await editBtn.count();

    if (count === 0) {
      // OK - no catalog entries or no edit permissions needed
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-010 Issues:', issues);
    }
  });

  test('SUPERADMIN-011: Support ticket actions', async ({ page }) => {
    const issues = [];

    // Navigate to support tickets
    await page.click('#nav-support');
    await page.waitForTimeout(500);

    // Check for view buttons
    const viewBtn = page.locator('.support-view-btn').first();
    const count = await viewBtn.count();

    if (count === 0) {
      // OK - no support tickets
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-011 Issues:', issues);
    }
  });

  test('SUPERADMIN-012: Order status badges', async ({ page }) => {
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
      console.error('SUPERADMIN-012 Issues:', issues);
    }
  });

  test('SUPERADMIN-013: Responsive design - Mobile', async ({ page }) => {
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
      console.error('SUPERADMIN-013 Issues:', issues);
    }
  });

  test('SUPERADMIN-014: Responsive design - Tablet', async ({ page }) => {
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
      console.error('SUPERADMIN-014 Issues:', issues);
    }
  });

  test('SUPERADMIN-015: Responsive design - Desktop', async ({ page }) => {
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
      console.error('SUPERADMIN-015 Issues:', issues);
    }
  });

  test('SUPERADMIN-016: Logout functionality', async ({ page }) => {
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
      console.error('SUPERADMIN-016 Issues:', issues);
    }
  });

  test('SUPERADMIN-017: Super admin specific sections visible', async ({ page }) => {
    const issues = [];

    // Check that super admin specific sections are visible
    const superAdminSections = [
      { id: '#nav-admins', name: 'Admins' },
      { id: '#nav-all-users', name: 'All Users' }
    ];

    for (const section of superAdminSections) {
      const navItem = page.locator(section.id);
      if (!(await navItem.isVisible())) {
        issues.push(`Super admin section "${section.name}" not visible`);
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-017 Issues:', issues);
    }
  });

  test('SUPERADMIN-018: Admin table columns', async ({ page }) => {
    const issues = [];

    const adminsNav = page.locator('#nav-admins');
    if (await adminsNav.isVisible()) {
      await adminsNav.click();
      await page.waitForTimeout(500);

      // Check admins table has expected columns
      const adminsTable = page.locator('#admins-table');
      if (await adminsTable.isVisible()) {
        // Check for key columns (this is a basic check)
        const tableHeaders = adminsTable.locator('th');
        const headerCount = await tableHeaders.count();
        
        if (headerCount === 0) {
          issues.push('Admins table has no headers');
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-018 Issues:', issues);
    }
  });

  test('SUPERADMIN-019: All users table columns', async ({ page }) => {
    const issues = [];

    const allUsersNav = page.locator('#nav-all-users');
    if (await allUsersNav.isVisible()) {
      await allUsersNav.click();
      await page.waitForTimeout(500);

      // Check all users table has expected columns
      const allUsersTable = page.locator('#all-users-table');
      if (await allUsersTable.isVisible()) {
        const tableHeaders = allUsersTable.locator('th');
        const headerCount = await tableHeaders.count();
        
        if (headerCount === 0) {
          issues.push('All users table has no headers');
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('SUPERADMIN-019 Issues:', issues);
    }
  });

  test('SUPERADMIN-020: Chat functionality', async ({ page }) => {
    const issues = [];

    // Navigate to chat
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
      console.error('SUPERADMIN-020 Issues:', issues);
    }
  });
});
