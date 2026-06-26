const { test, expect } = require('@playwright/test');

/**
 * CUSTOMER ROLE UI & INTERACTION REGRESSION AUDIT
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

// Test credentials - these should match your test database
const TEST_CUSTOMER = {
  email: 'customer@test.com',
  password: 'test123'
};

test.describe('Customer Role UI Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Login as customer
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:3000/index.html');
    
    // Click login
    await page.click('#login-btn');
    await page.waitForTimeout(500);
    
    // Fill login form
    await page.fill('#auth-email', TEST_CUSTOMER.email);
    await page.fill('#auth-password', TEST_CUSTOMER.password);
    await page.click('#auth-form button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
  });

  test('CUSTOMER-001: Header elements after login', async ({ page }) => {
    const issues = [];

    // Check guest elements are hidden
    const loginBtn = page.locator('#login-btn');
    const registerBtn = page.locator('#register-btn');
    
    if (await loginBtn.isVisible()) {
      issues.push('Login button should be hidden after login');
    }
    if (await registerBtn.isVisible()) {
      issues.push('Register button should be hidden after login');
    }

    // Check customer elements are visible
    const myOrdersLi = page.locator('#my-orders-li');
    const customerMessages = page.locator('#customer-messages');
    const customerNotifications = page.locator('#customer-notifications');
    const userProfile = page.locator('#user-profile');

    if (!(await myOrdersLi.isVisible())) {
      issues.push('My Orders button not visible for customer');
    }
    if (!(await customerMessages.isVisible())) {
      issues.push('Messages dropdown not visible for customer');
    }
    if (!(await customerNotifications.isVisible())) {
      issues.push('Notifications dropdown not visible for customer');
    }
    if (!(await userProfile.isVisible())) {
      issues.push('User profile dropdown not visible for customer');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-001 Issues:', issues);
    }
  });

  test('CUSTOMER-002: User profile dropdown', async ({ page }) => {
    const issues = [];

    // Click user profile
    await page.click('#user-account-btn');
    await page.waitForTimeout(500);

    // Check dropdown menu
    const dropdownMenu = page.locator('#user-dropdown-menu');
    if (!(await dropdownMenu.isVisible())) {
      issues.push('User profile dropdown menu not visible');
    } else {
      // Check dropdown items
      const myProfileBtn = page.locator('#customer-my-profile-btn');
      const editProfileBtn = page.locator('#customer-edit-profile-btn');
      const changePasswordBtn = page.locator('#customer-change-password-btn');
      const verificationRequestBtn = page.locator('#verification-request-btn');
      const supportTicketsBtn = page.locator('#customer-support-tickets-btn');
      const logoutBtn = page.locator('#logout-btn');

      if (!(await myProfileBtn.isVisible())) {
        issues.push('My Profile button not visible in dropdown');
      }
      if (!(await editProfileBtn.isVisible())) {
        issues.push('Edit Profile button not visible in dropdown');
      }
      if (!(await changePasswordBtn.isVisible())) {
        issues.push('Change Password button not visible in dropdown');
      }
      if (!(await verificationRequestBtn.isVisible())) {
        issues.push('Request Verification button not visible in dropdown');
      }
      if (!(await supportTicketsBtn.isVisible())) {
        issues.push('Support Tickets button not visible in dropdown');
      }
      if (!(await logoutBtn.isVisible())) {
        issues.push('Logout button not visible in dropdown');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-002 Issues:', issues);
    }
  });

  test('CUSTOMER-003: Messages dropdown', async ({ page }) => {
    const issues = [];

    // Click messages dropdown
    await page.click('#customer-chat-btn');
    await page.waitForTimeout(500);

    // Check dropdown
    const dropdown = page.locator('#customer-chat-dropdown');
    if (!(await dropdown.isVisible())) {
      issues.push('Messages dropdown not visible');
    } else {
      // Check dropdown elements
      const header = page.locator('.dropdown-header');
      const showAllBtn = page.locator('#customer-show-all-messages');

      if (!(await header.isVisible())) {
        issues.push('Messages dropdown header not visible');
      }
      if (!(await showAllBtn.isVisible())) {
        issues.push('Show all messages button not visible');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-003 Issues:', issues);
    }
  });

  test('CUSTOMER-004: Notifications dropdown', async ({ page }) => {
    const issues = [];

    // Click notifications dropdown
    await page.click('#customer-notif-btn');
    await page.waitForTimeout(500);

    // Check dropdown
    const dropdown = page.locator('#customer-notif-dropdown');
    if (!(await dropdown.isVisible())) {
      issues.push('Notifications dropdown not visible');
    } else {
      // Check dropdown elements
      const header = page.locator('.dropdown-header');
      const showAllBtn = page.locator('#customer-show-all-notifications');

      if (!(await header.isVisible())) {
        issues.push('Notifications dropdown header not visible');
      }
      if (!(await showAllBtn.isVisible())) {
        issues.push('Show all notifications button not visible');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-004 Issues:', issues);
    }
  });

  test('CUSTOMER-005: My Orders button and badge', async ({ page }) => {
    const issues = [];

    // Check My Orders button
    const myOrdersBtn = page.locator('#my-orders-btn');
    if (!(await myOrdersBtn.isVisible())) {
      issues.push('My Orders button not visible');
    }

    // Check orders count badge
    const ordersCount = page.locator('#orders-count');
    if (!(await ordersCount.isVisible())) {
      issues.push('Orders count badge not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-005 Issues:', issues);
    }
  });

  test('CUSTOMER-006: Cart functionality', async ({ page }) => {
    const issues = [];

    // Try to add a product to cart
    await page.waitForTimeout(2000);
    const firstProduct = page.locator('#available-grid .product-card').first();
    const count = await firstProduct.count();
    
    if (count > 0) {
      await firstProduct.click();
      await page.waitForTimeout(500);

      // Check product details modal
      const modal = page.locator('#product-details-modal');
      if (await modal.isVisible()) {
        const addCartBtn = page.locator('#product-details-add-cart');
        
        if (!(await addCartBtn.isVisible())) {
          issues.push('Add to cart button not visible in product modal');
        } else {
          // Click add to cart
          await addCartBtn.click();
          await page.waitForTimeout(1000);

          // Check cart sidebar
          const cartSidebar = page.locator('#cart-sidebar');
          if (!(await cartSidebar.isVisible())) {
            issues.push('Cart sidebar not visible after adding product');
          } else {
            // Check cart elements
            const cartItems = page.locator('#cart-items');
            const cartTotal = page.locator('#cart-total');
            const checkoutBtn = page.locator('#checkout-btn');
            const closeCartBtn = page.locator('#close-cart');

            if (!(await cartItems.isVisible())) {
              issues.push('Cart items container not visible');
            }
            if (!(await cartTotal.isVisible())) {
              issues.push('Cart total not visible');
            }
            if (!(await checkoutBtn.isVisible())) {
              issues.push('Checkout button not visible');
            }
            if (!(await closeCartBtn.isVisible())) {
              issues.push('Close cart button not visible');
            }

            // Close cart
            await closeCartBtn.click();
          }
        }

        // Close product modal
        const closeBtn = page.locator('#close-product-details');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-006 Issues:', issues);
    }
  });

  test('CUSTOMER-007: Customer account page navigation', async ({ page }) => {
    const issues = [];

    // Navigate to customer account page
    await page.click('#customer-my-profile-btn');
    await page.waitForTimeout(1000);

    // Check if navigated to customer account page
    const currentUrl = page.url();
    if (!currentUrl.includes('customer-account.html')) {
      issues.push('Did not navigate to customer account page');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-007 Issues:', issues);
    }
  });

  test('CUSTOMER-008: Chat page navigation', async ({ page }) => {
    const issues = [];

    // Navigate to chat page
    await page.click('#customer-show-all-messages');
    await page.waitForTimeout(1000);

    // Check if navigated to chat page
    const currentUrl = page.url();
    if (!currentUrl.includes('chat.html')) {
      issues.push('Did not navigate to chat page');
    }

    // Go back to index
    await page.goto('http://localhost:3000/index.html');
    await page.waitForTimeout(1000);

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-008 Issues:', issues);
    }
  });

  test('CUSTOMER-009: Notifications page navigation', async ({ page }) => {
    const issues = [];

    // Navigate to notifications page
    await page.click('#customer-show-all-notifications');
    await page.waitForTimeout(1000);

    // Check if navigated to notifications page
    const currentUrl = page.url();
    if (!currentUrl.includes('notifications.html')) {
      issues.push('Did not navigate to notifications page');
    }

    // Go back to index
    await page.goto('http://localhost:3000/index.html');
    await page.waitForTimeout(1000);

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-009 Issues:', issues);
    }
  });

  test('CUSTOMER-010: Orders page navigation', async ({ page }) => {
    const issues = [];

    // Navigate to orders page
    await page.click('#my-orders-btn');
    await page.waitForTimeout(1000);

    // Check if navigated to orders page
    const currentUrl = page.url();
    if (!currentUrl.includes('orders.html')) {
      issues.push('Did not navigate to orders page');
    }

    // Go back to index
    await page.goto('http://localhost:3000/index.html');
    await page.waitForTimeout(1000);

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-010 Issues:', issues);
    }
  });

  test('CUSTOMER-011: Product details modal for customer', async ({ page }) => {
    const issues = [];
    await page.waitForTimeout(2000);

    const firstProduct = page.locator('#available-grid .product-card').first();
    const count = await firstProduct.count();
    
    if (count > 0) {
      await firstProduct.click();
      await page.waitForTimeout(500);

      const modal = page.locator('#product-details-modal');
      if (await modal.isVisible()) {
        // Check all modal elements
        const elements = [
          { id: '#product-details-name', name: 'Product name' },
          { id: '#product-details-price', name: 'Product price' },
          { id: '#product-details-image', name: 'Product image' },
          { id: '#product-details-farmer', name: 'Farmer name' },
          { id: '#product-details-location', name: 'Location' },
          { id: '#product-details-stock', name: 'Stock' },
          { id: '#product-details-harvest', name: 'Harvest date' },
          { id: '#product-details-expiry', name: 'Expiry date' },
          { id: '#product-details-description', name: 'Description' },
          { id: '#product-details-add-cart', name: 'Add to cart button' },
          { id: '#product-details-decrease', name: 'Decrease quantity button' },
          { id: '#product-details-increase', name: 'Increase quantity button' },
          { id: '#product-details-quantity', name: 'Quantity input' },
          { id: '#product-details-total', name: 'Total price' },
          { id: '#close-product-details', name: 'Close button' }
        ];

        for (const element of elements) {
          const el = page.locator(element.id);
          if (!(await el.isVisible())) {
            issues.push(`${element.name} not visible in product modal`);
          }
        }

        // Close modal
        await page.click('#close-product-details');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-011 Issues:', issues);
    }
  });

  test('CUSTOMER-012: Responsive design - Mobile', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Check mobile menu toggle
    const mobileMenuToggle = page.locator('#mobile-menu-toggle');
    if (!(await mobileMenuToggle.isVisible())) {
      issues.push('Mobile menu toggle not visible on mobile');
    }

    // Check user profile is visible
    const userProfile = page.locator('#user-profile');
    if (!(await userProfile.isVisible())) {
      issues.push('User profile not visible on mobile');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-012 Issues:', issues);
    }
  });

  test('CUSTOMER-013: Responsive design - Tablet', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // Check mobile menu toggle
    const mobileMenuToggle = page.locator('#mobile-menu-toggle');
    if (!(await mobileMenuToggle.isVisible())) {
      issues.push('Mobile menu toggle not visible on tablet');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-013 Issues:', issues);
    }
  });

  test('CUSTOMER-014: Responsive design - Desktop', async ({ page }) => {
    const issues = [];

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Check navigation is visible
    const nav = page.locator('#main-nav');
    if (!(await nav.isVisible())) {
      issues.push('Main navigation not visible on desktop');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-014 Issues:', issues);
    }
  });

  test('CUSTOMER-015: Logout functionality', async ({ page }) => {
    const issues = [];

    // Click user profile
    await page.click('#user-account-btn');
    await page.waitForTimeout(500);

    // Click logout
    await page.click('#logout-btn');
    await page.waitForTimeout(1000);

    // Check if logged out
    const loginBtn = page.locator('#login-btn');
    if (!(await loginBtn.isVisible())) {
      issues.push('Login button not visible after logout');
    }

    const userProfile = page.locator('#user-profile');
    if (await userProfile.isVisible()) {
      issues.push('User profile still visible after logout');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('CUSTOMER-015 Issues:', issues);
    }
  });
});
