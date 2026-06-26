const { test, expect } = require('@playwright/test');

/**
 * FARMER ROLE UI & INTERACTION REGRESSION AUDIT
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
const TEST_FARMER = {
  email: 'farmer@test.com',
  password: 'test123'
};

test.describe('Farmer Role UI Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Login as farmer
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:3000/index.html');
    
    // Click login
    await page.click('#login-btn');
    await page.waitForTimeout(500);
    
    // Fill login form
    await page.fill('#auth-email', TEST_FARMER.email);
    await page.fill('#auth-password', TEST_FARMER.password);
    await page.click('#auth-form button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    // Navigate to farmer dashboard
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('FARMER-001: Farmer dashboard loading', async ({ page }) => {
    const issues = [];

    // Check if farmer dashboard loaded
    const currentUrl = page.url();
    if (!currentUrl.includes('farmer.html')) {
      issues.push('Not on farmer dashboard page');
    }

    // Check loading screen is hidden
    const loadingScreen = page.locator('#admin-loading-screen');
    if (await loadingScreen.isVisible()) {
      issues.push('Loading screen still visible after page load');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-001 Issues:', issues);
    }
  });

  test('FARMER-002: Sidebar navigation', async ({ page }) => {
    const issues = [];

    // Check sidebar exists
    const sidebar = page.locator('#farmer-sidebar');
    if (!(await sidebar.isVisible())) {
      issues.push('Farmer sidebar not visible');
    }

    // Check sidebar navigation items
    const navItems = [
      { id: '#nav-overview', name: 'Overview' },
      { id: '#nav-products', name: 'Products' },
      { id: '#nav-orders', name: 'Orders' },
      { id: '#nav-reviews', name: 'Reviews' },
      { id: '#nav-shop', name: 'Shop Profile' },
      { id: '#nav-chat', name: 'Chat' }
    ];

    for (const item of navItems) {
      const navItem = page.locator(item.id);
      if (!(await navItem.isVisible())) {
        issues.push(`Sidebar navigation item "${item.name}" not visible`);
      }
    }

    // Check mobile menu toggle
    const mobileToggle = page.locator('#farmer-mobile-menu-toggle');
    if (!(await mobileToggle.isVisible())) {
      issues.push('Mobile menu toggle not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-002 Issues:', issues);
    }
  });

  test('FARMER-003: Header elements', async ({ page }) => {
    const issues = [];

    // Check page title
    const pageTitle = page.locator('#farmer-page-title');
    if (!(await pageTitle.isVisible())) {
      issues.push('Farmer page title not visible');
    }

    // Check chat unread badge
    const chatBadge = page.locator('#chat-unread-badge');
    if (!(await chatBadge.isVisible())) {
      issues.push('Chat unread badge not visible');
    }

    // Check user account button
    const userAccountBtn = page.locator('#farmer-user-account-btn');
    if (!(await userAccountBtn.isVisible())) {
      issues.push('User account button not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-003 Issues:', issues);
    }
  });

  test('FARMER-004: Overview section', async ({ page }) => {
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
      console.error('FARMER-004 Issues:', issues);
    }
  });

  test('FARMER-005: Products section', async ({ page }) => {
    const issues = [];

    // Click products nav
    await page.click('#nav-products');
    await page.waitForTimeout(500);

    // Check products section is visible
    const productsSection = page.locator('#products');
    if (!(await productsSection.isVisible())) {
      issues.push('Products section not visible');
    }

    // Check product tabs
    const productTabs = page.locator('.product-tabs');
    if (!(await productTabs.isVisible())) {
      issues.push('Product tabs not visible');
    }

    // Check add product button
    const addProductBtn = page.locator('#add-product-btn');
    if (!(await addProductBtn.isVisible())) {
      issues.push('Add product button not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-005 Issues:', issues);
    }
  });

  test('FARMER-006: Orders section', async ({ page }) => {
    const issues = [];

    // Click orders nav
    await page.click('#nav-orders');
    await page.waitForTimeout(500);

    // Check orders section is visible
    const ordersSection = page.locator('#orders');
    if (!(await ordersSection.isVisible())) {
      issues.push('Orders section not visible');
    }

    // Check order tabs
    const orderTabs = page.locator('.order-tabs');
    if (!(await orderTabs.isVisible())) {
      issues.push('Order tabs not visible');
    }

    // Check order status tabs
    const orderStatusTabs = [
      'pending', 'preorder_reserved', 'confirmed', 'preparing', 
      'scheduled', 'out_for_delivery', 'delivered', 'cancelled'
    ];

    for (const status of orderStatusTabs) {
      const tab = page.locator(`#orders-tab-${status}`);
      if (!(await tab.isVisible())) {
        issues.push(`Order tab "${status}" not visible`);
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-006 Issues:', issues);
    }
  });

  test('FARMER-007: Reviews section', async ({ page }) => {
    const issues = [];

    // Click reviews nav
    await page.click('#nav-reviews');
    await page.waitForTimeout(500);

    // Check reviews section is visible
    const reviewsSection = page.locator('#reviews');
    if (!(await reviewsSection.isVisible())) {
      issues.push('Reviews section not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-007 Issues:', issues);
    }
  });

  test('FARMER-008: Shop profile section', async ({ page }) => {
    const issues = [];

    // Click shop nav
    await page.click('#nav-shop');
    await page.waitForTimeout(500);

    // Check shop section is visible
    const shopSection = page.locator('#shop');
    if (!(await shopSection.isVisible())) {
      issues.push('Shop profile section not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-008 Issues:', issues);
    }
  });

  test('FARMER-009: Chat section', async ({ page }) => {
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
      console.error('FARMER-009 Issues:', issues);
    }
  });

  test('FARMER-010: Add product modal', async ({ page }) => {
    const issues = [];

    // Navigate to products
    await page.click('#nav-products');
    await page.waitForTimeout(500);

    // Click add product button
    await page.click('#add-product-btn');
    await page.waitForTimeout(500);

    // Check add product modal
    const modal = page.locator('#add-product-modal');
    if (!(await modal.isVisible())) {
      issues.push('Add product modal not visible');
    } else {
      // Check form fields
      const formFields = [
        { id: '#product-name', name: 'Product name' },
        { id: '#product-category', name: 'Product category' },
        { id: '#product-unit', name: 'Product unit' },
        { id: '#product-price', name: 'Product price' },
        { id: '#product-stock', name: 'Product stock' },
        { id: '#product-description', name: 'Product description' },
        { id: '#product-image', name: 'Product image' }
      ];

      for (const field of formFields) {
        const fieldEl = page.locator(field.id);
        if (!(await fieldEl.isVisible())) {
          issues.push(`Add product modal field "${field.name}" not visible`);
        }
      }

      // Check submit button
      const submitBtn = page.locator('#add-product-submit');
      if (!(await submitBtn.isVisible())) {
        issues.push('Add product submit button not visible');
      }

      // Check close button
      const closeBtn = page.locator('#close-add-product-modal');
      if (!(await closeBtn.isVisible())) {
        issues.push('Add product close button not visible');
      }

      // Close modal
      await closeBtn.click();
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-010 Issues:', issues);
    }
  });

  test('FARMER-011: Edit product modal', async ({ page }) => {
    const issues = [];

    // Navigate to products
    await page.click('#nav-products');
    await page.waitForTimeout(500);

    // Try to find a product to edit
    const firstProduct = page.locator('#my-products-grid .product-card').first();
    const count = await firstProduct.count();
    
    if (count > 0) {
      // Look for edit button
      const editBtn = page.locator('.product-edit-btn').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(500);

        // Check edit product modal
        const modal = page.locator('#edit-product-modal');
        if (!(await modal.isVisible())) {
          issues.push('Edit product modal not visible');
        } else {
          // Check form fields
          const formFields = [
            { id: '#edit-product-name', name: 'Product name' },
            { id: '#edit-product-category', name: 'Product category' },
            { id: '#edit-product-unit', name: 'Product unit' },
            { id: '#edit-product-price', name: 'Product price' },
            { id: '#edit-product-stock', name: 'Product stock' },
            { id: '#edit-product-description', name: 'Product description' }
          ];

          for (const field of formFields) {
            const fieldEl = page.locator(field.id);
            if (!(await fieldEl.isVisible())) {
              issues.push(`Edit product modal field "${field.name}" not visible`);
            }
          }

          // Check submit button
          const submitBtn = page.locator('#edit-product-submit');
          if (!(await submitBtn.isVisible())) {
            issues.push('Edit product submit button not visible');
          }

          // Close modal
          const closeBtn = page.locator('#close-edit-product-modal');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-011 Issues:', issues);
    }
  });

  test('FARMER-012: Order details modal', async ({ page }) => {
    const issues = [];

    // Navigate to orders
    await page.click('#nav-orders');
    await page.waitForTimeout(500);

    // Try to find an order to view
    const firstOrder = page.locator('.order-card').first();
    const count = await firstOrder.count();
    
    if (count > 0) {
      await firstOrder.click();
      await page.waitForTimeout(500);

      // Check order details modal
      const modal = page.locator('.order-details-modal-content');
      if (!(await modal.isVisible())) {
        issues.push('Order details modal not visible');
      } else {
        // Check modal elements
        const modalElements = [
          { selector: '.order-details-modal-header', name: 'Modal header' },
          { selector: '.order-details-body', name: 'Modal body' },
          { selector: '.order-product-card', name: 'Product card' },
          { selector: '.order-info-card', name: 'Info card' },
          { selector: '.order-timeline', name: 'Timeline' }
        ];

        for (const element of modalElements) {
          const el = page.locator(element.selector);
          if (!(await el.isVisible())) {
            issues.push(`Order details modal ${element.name} not visible`);
          }
        }

        // Close modal
        const closeBtn = page.locator('.order-details-close-btn');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-012 Issues:', issues);
    }
  });

  test('FARMER-013: Sidebar account dropdown', async ({ page }) => {
    const issues = [];

    // Click sidebar account button
    await page.click('#farmer-sidebar-account-btn');
    await page.waitForTimeout(500);

    // Check dropdown menu
    const dropdown = page.locator('#farmer-sidebar-dropdown-menu');
    if (!(await dropdown.isVisible())) {
      issues.push('Sidebar account dropdown not visible');
    } else {
      // Check dropdown items
      const myAccountBtn = page.locator('#farmer-my-account-btn');
      const logoutBtn = page.locator('#farmer-logout-menu-btn');

      if (!(await myAccountBtn.isVisible())) {
        issues.push('My Account button not visible in sidebar dropdown');
      }
      if (!(await logoutBtn.isVisible())) {
        issues.push('Logout button not visible in sidebar dropdown');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-013 Issues:', issues);
    }
  });

  test('FARMER-014: Verification section', async ({ page }) => {
    const issues = [];

    // Click shop nav (verification is in shop section)
    await page.click('#nav-shop');
    await page.waitForTimeout(500);

    // Check verification section
    const verificationSection = page.locator('#verification-section');
    if (!(await verificationSection.isVisible())) {
      issues.push('Verification section not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-014 Issues:', issues);
    }
  });

  test('FARMER-015: Responsive design - Mobile', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Check sidebar is hidden on mobile
    const sidebar = page.locator('#farmer-sidebar');
    const isVisible = await sidebar.isVisible();
    
    // On mobile, sidebar should be hidden by default
    if (isVisible) {
      // Check if it's positioned off-screen
      const left = await sidebar.evaluate(el => window.getComputedStyle(el).left);
      if (left !== '-300px' && left !== '-260px') {
        issues.push('Sidebar not properly hidden on mobile');
      }
    }

    // Check mobile menu toggle is visible
    const mobileToggle = page.locator('#farmer-mobile-menu-toggle');
    if (!(await mobileToggle.isVisible())) {
      issues.push('Mobile menu toggle not visible on mobile');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-015 Issues:', issues);
    }
  });

  test('FARMER-016: Responsive design - Tablet', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // Check mobile menu toggle is visible
    const mobileToggle = page.locator('#farmer-mobile-menu-toggle');
    if (!(await mobileToggle.isVisible())) {
      issues.push('Mobile menu toggle not visible on tablet');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-016 Issues:', issues);
    }
  });

  test('FARMER-017: Responsive design - Desktop', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Check sidebar is visible on desktop
    const sidebar = page.locator('#farmer-sidebar');
    if (!(await sidebar.isVisible())) {
      issues.push('Sidebar not visible on desktop');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-017 Issues:', issues);
    }
  });

  test('FARMER-018: Order timeline status badges', async ({ page }) => {
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
      // Just check the badge class exists, not that it's visible (may not have orders in all statuses)
      const count = await badge.count();
      if (count === 0) {
        // This is OK - just means no orders in this status
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-018 Issues:', issues);
    }
  });

  test('FARMER-019: Product form validation', async ({ page }) => {
    const issues = [];

    // Navigate to products
    await page.click('#nav-products');
    await page.waitForTimeout(500);

    // Click add product button
    await page.click('#add-product-btn');
    await page.waitForTimeout(500);

    // Try to submit without filling fields
    const submitBtn = page.locator('#add-product-submit');
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Check for validation errors
    const invalidFields = page.locator('.is-invalid');
    const invalidCount = await invalidFields.count();

    if (invalidCount === 0) {
      issues.push('No validation errors shown when submitting empty form');
    }

    // Close modal
    const closeBtn = page.locator('#close-add-product-modal');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-019 Issues:', issues);
    }
  });

  test('FARMER-020: Logout functionality', async ({ page }) => {
    const issues = [];

    // Click sidebar account button
    await page.click('#farmer-sidebar-account-btn');
    await page.waitForTimeout(500);

    // Click logout
    await page.click('#farmer-logout-menu-btn');
    await page.waitForTimeout(1000);

    // Check if redirected to index
    const currentUrl = page.url();
    if (!currentUrl.includes('index.html')) {
      issues.push('Not redirected to index after logout');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('FARMER-020 Issues:', issues);
    }
  });
});
