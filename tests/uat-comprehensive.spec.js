const { test, expect } = require('@playwright/test');

// UAT Comprehensive Test - All User Roles
// This test performs a full User Acceptance Testing walkthrough
// covering Guest, Customer, Farmer, Admin, and Superadmin roles

test.describe('UAT - Comprehensive User Experience Walkthrough', () => {
  let page;
  const screenshotDir = 'test-results/uat-screenshots';

  test.beforeAll(async ({ browser }) => {
    // Ensure screenshot directory exists
    const fs = require('fs');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/index.html');
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ============================================
  // GUEST USER FLOW
  // ============================================
  test('GUEST - Landing Page and Navigation', async () => {
    console.log('\n=== GUEST USER FLOW ===');
    
    // Landing Page
    await page.screenshot({ path: `${screenshotDir}/01-guest-landing.png`, fullPage: true });
    console.log('✓ Landing page loaded');

    // Check navigation elements
    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();
    console.log('✓ Navigation bar visible');

    // Check hero section
    const heroSection = page.locator('.hero-section, .hero, #hero');
    const heroVisible = await heroSection.count() > 0;
    if (heroVisible) {
      await page.screenshot({ path: `${screenshotDir}/02-guest-hero-section.png`, fullPage: true });
      console.log('✓ Hero section visible');
    } else {
      console.log('⚠ Hero section not found');
    }

    // Check product cards
    const productCards = page.locator('.product-card, .card');
    const cardCount = await productCards.count();
    console.log(`✓ Found ${cardCount} product cards`);
    await page.screenshot({ path: `${screenshotDir}/03-guest-products.png`, fullPage: true });

    // Check footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    console.log('✓ Footer visible');

    // Try to access cart without login
    const cartBtn = page.locator('#cart-btn, .cart-btn, [href*="cart"], [href*="checkout"]');
    if (await cartBtn.count() > 0) {
      await cartBtn.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/04-guest-cart-access.png`, fullPage: true });
      console.log('✓ Cart access attempted');
    }

    // Check login modal/button
    const loginBtn = page.locator('#login-btn, .login-btn, [data-bs-target="#loginModal"]');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/05-guest-login-modal.png`, fullPage: true });
      console.log('✓ Login modal opened');
    }
  });

  // ============================================
  // CUSTOMER USER FLOW
  // ============================================
  test('CUSTOMER - Registration and Dashboard', async () => {
    console.log('\n=== CUSTOMER USER FLOW ===');

    // Navigate to registration/login
    await page.goto('http://localhost:3000/index.html');
    await page.screenshot({ path: `${screenshotDir}/06-customer-start.png`, fullPage: true });

    // Check for login/register options
    const loginBtn = page.locator('#login-btn, .login-btn, [data-bs-target="#loginModal"]');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/07-customer-login-modal.png`, fullPage: true });
      console.log('✓ Login modal accessible');
    }

    // Navigate to customer account page (simulating logged in state)
    await page.goto('http://localhost:3000/customer-account.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/08-customer-dashboard.png`, fullPage: true });
    console.log('✓ Customer dashboard loaded');

    // Check sidebar/navigation
    const sidebar = page.locator('.sidebar, .account-sidebar, #customer-sidebar');
    const sidebarVisible = await sidebar.count() > 0;
    if (sidebarVisible) {
      console.log('✓ Sidebar visible');
    } else {
      console.log('⚠ Sidebar not found');
    }

    // Check navigation tabs
    const tabs = page.locator('.nav-tabs, .tab, [role="tab"]');
    const tabCount = await tabs.count();
    console.log(`✓ Found ${tabCount} navigation tabs`);

    // Check orders section
    const ordersSection = page.locator('#orders, .orders-section, [data-section="orders"]');
    if (await ordersSection.count() > 0) {
      await page.screenshot({ path: `${screenshotDir}/09-customer-orders.png`, fullPage: true });
      console.log('✓ Orders section accessible');
    }

    // Check profile section
    const profileSection = page.locator('#profile, .profile-section, [data-section="profile"]');
    if (await profileSection.count() > 0) {
      await page.screenshot({ path: `${screenshotDir}/10-customer-profile.png`, fullPage: true });
      console.log('✓ Profile section accessible');
    }

    // Check notifications
    const notifBtn = page.locator('#notification-btn, .notification-btn, .bell-icon');
    if (await notifBtn.count() > 0) {
      await notifBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/11-customer-notifications.png`, fullPage: true });
      console.log('✓ Notifications accessible');
    }

    // Check wishlist
    const wishlistBtn = page.locator('#wishlist-btn, .wishlist-btn, [href*="wishlist"]');
    if (await wishlistBtn.count() > 0) {
      await wishlistBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/12-customer-wishlist.png`, fullPage: true });
      console.log('✓ Wishlist accessible');
    }
  });

  // ============================================
  // FARMER USER FLOW
  // ============================================
  test('FARMER - Dashboard and Order Management', async () => {
    console.log('\n=== FARMER USER FLOW ===');

    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/13-farmer-dashboard.png`, fullPage: true });
    console.log('✓ Farmer dashboard loaded');

    // Check sidebar
    const sidebar = page.locator('#farmer-sidebar, .sidebar, .admin-sidebar');
    await expect(sidebar).toBeVisible();
    console.log('✓ Farmer sidebar visible');

    // Check main sections
    const sections = ['overview', 'products', 'orders', 'reviews', 'shop', 'chat'];
    for (const section of sections) {
      const sectionEl = page.locator(`#${section}, [data-section="${section}"]`);
      const count = await sectionEl.count();
      if (count > 0) {
        console.log(`✓ Section '${section}' exists`);
      } else {
        console.log(`⚠ Section '${section}' not found`);
      }
    }

    // Navigate to products section
    const productsNav = page.locator('[data-section="products"], #products-nav, a[href*="#products"]');
    if (await productsNav.count() > 0) {
      await productsNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/14-farmer-products.png`, fullPage: true });
      console.log('✓ Products section navigated');
    }

    // Check add product button
    const addProductBtn = page.locator('#add-product-btn, .add-product-btn, [data-action="add-product"]');
    if (await addProductBtn.count() > 0) {
      await addProductBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/15-farmer-add-product-modal.png`, fullPage: true });
      console.log('✓ Add product modal opened');
    }

    // Navigate to orders section
    const ordersNav = page.locator('[data-section="orders"], #orders-nav, a[href*="#orders"]');
    if (await ordersNav.count() > 0) {
      await ordersNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/16-farmer-orders.png`, fullPage: true });
      console.log('✓ Orders section navigated');
    }

    // Check order table
    const orderTable = page.locator('.orders-table, table, .table');
    if (await orderTable.count() > 0) {
      console.log('✓ Order table visible');
    }

    // Check order status filters
    const filters = page.locator('.filter, .status-filter, [data-filter]');
    const filterCount = await filters.count();
    console.log(`✓ Found ${filterCount} filter options`);

    // Check chat section
    const chatNav = page.locator('[data-section="chat"], #chat-nav, a[href*="#chat"]');
    if (await chatNav.count() > 0) {
      await chatNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/17-farmer-chat.png`, fullPage: true });
      console.log('✓ Chat section navigated');
    }

    // Check shop profile section
    const shopNav = page.locator('[data-section="shop"], #shop-nav, a[href*="#shop"]');
    if (await shopNav.count() > 0) {
      await shopNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/18-farmer-shop.png`, fullPage: true });
      console.log('✓ Shop profile section navigated');
    }
  });

  // ============================================
  // ADMIN USER FLOW
  // ============================================
  test('ADMIN - Dashboard and User Management', async () => {
    console.log('\n=== ADMIN USER FLOW ===');

    await page.goto('http://localhost:3000/admin.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/19-admin-dashboard.png`, fullPage: true });
    console.log('✓ Admin dashboard loaded');

    // Check sidebar
    const sidebar = page.locator('#admin-sidebar, .sidebar, .admin-sidebar');
    await expect(sidebar).toBeVisible();
    console.log('✓ Admin sidebar visible');

    // Check main sections
    const sections = ['overview', 'users', 'farmers', 'products', 'orders', 'approvals', 'chat', 'support'];
    for (const section of sections) {
      const sectionEl = page.locator(`#${section}, [data-section="${section}"]`);
      const count = await sectionEl.count();
      if (count > 0) {
        console.log(`✓ Section '${section}' exists`);
      } else {
        console.log(`⚠ Section '${section}' not found`);
      }
    }

    // Navigate to users section
    const usersNav = page.locator('[data-section="users"], #users-nav, a[href*="#users"]');
    if (await usersNav.count() > 0) {
      await usersNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/20-admin-users.png`, fullPage: true });
      console.log('✓ Users section navigated');
    }

    // Check user table
    const userTable = page.locator('.users-table, table, .table');
    if (await userTable.count() > 0) {
      console.log('✓ User table visible');
    }

    // Navigate to product approvals
    const approvalsNav = page.locator('[data-section="approvals"], #approvals-nav, a[href*="#approvals"], [data-section="product-approvals"]');
    if (await approvalsNav.count() > 0) {
      await approvalsNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/21-admin-approvals.png`, fullPage: true });
      console.log('✓ Product approvals section navigated');
    }

    // Check approve/reject buttons
    const actionButtons = page.locator('.approve-btn, .reject-btn, [data-action="approve"], [data-action="reject"]');
    const actionCount = await actionButtons.count();
    console.log(`✓ Found ${actionCount} action buttons`);

    // Navigate to orders section
    const ordersNav = page.locator('[data-section="orders"], #orders-nav, a[href*="#orders"]');
    if (await ordersNav.count() > 0) {
      await ordersNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/22-admin-orders.png`, fullPage: true });
      console.log('✓ Orders section navigated');
    }

    // Check support tickets section
    const supportNav = page.locator('[data-section="support"], #support-nav, a[href*="#support"]');
    if (await supportNav.count() > 0) {
      await supportNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/23-admin-support.png`, fullPage: true });
      console.log('✓ Support tickets section navigated');
    }
  });

  // ============================================
  // SUPERADMIN USER FLOW
  // ============================================
  test('SUPERADMIN - Advanced Management', async () => {
    console.log('\n=== SUPERADMIN USER FLOW ===');

    await page.goto('http://localhost:3000/admin.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/24-superadmin-dashboard.png`, fullPage: true });
    console.log('✓ Superadmin dashboard loaded');

    // Check for superadmin-specific sections
    const advancedSections = ['settings', 'system', 'analytics', 'reports', 'logs'];
    for (const section of advancedSections) {
      const sectionEl = page.locator(`#${section}, [data-section="${section}"]`);
      const count = await sectionEl.count();
      if (count > 0) {
        console.log(`✓ Advanced section '${section}' exists`);
      } else {
        console.log(`⚠ Advanced section '${section}' not found`);
      }
    }

    // Check admin management
    const adminNav = page.locator('[data-section="admins"], #admins-nav, a[href*="#admins"]');
    if (await adminNav.count() > 0) {
      await adminNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/25-superadmin-admins.png`, fullPage: true });
      console.log('✓ Admin management section navigated');
    }

    // Check system settings
    const settingsNav = page.locator('[data-section="settings"], #settings-nav, a[href*="#settings"]');
    if (await settingsNav.count() > 0) {
      await settingsNav.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/26-superadmin-settings.png`, fullPage: true });
      console.log('✓ Settings section navigated');
    }
  });

  // ============================================
  // CROSS-CUTTING UX CHECKS
  // ============================================
  test('UX - Navigation and Consistency', async () => {
    console.log('\n=== CROSS-CUTTING UX CHECKS ===');

    // Check mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000/index.html');
    await page.screenshot({ path: `${screenshotDir}/27-mobile-landing.png`, fullPage: true });
    console.log('✓ Mobile landing page captured');

    // Check mobile menu
    const mobileMenuBtn = page.locator('.mobile-menu-btn, #mobile-menu-toggle, .navbar-toggler');
    if (await mobileMenuBtn.count() > 0) {
      await mobileMenuBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/28-mobile-menu.png`, fullPage: true });
      console.log('✓ Mobile menu opened');
    }

    // Check tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:3000/index.html');
    await page.screenshot({ path: `${screenshotDir}/29-tablet-landing.png`, fullPage: true });
    console.log('✓ Tablet landing page captured');

    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('UX - Product Details and Cart Flow', async () => {
    console.log('\n=== PRODUCT DETAILS AND CART FLOW ===');

    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');

    // Click on first product
    const firstProduct = page.locator('.product-card, .card').first();
    if (await firstProduct.count() > 0) {
      await firstProduct.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/30-product-details.png`, fullPage: true });
      console.log('✓ Product details opened');

      // Check add to cart button
      const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn, [data-action="add-to-cart"]');
      if (await addToCartBtn.count() > 0) {
        console.log('✓ Add to cart button visible');
      }

      // Check quantity selector
      const quantitySelector = page.locator('.quantity-selector, #quantity, [name="quantity"]');
      if (await quantitySelector.count() > 0) {
        console.log('✓ Quantity selector visible');
      }
    }

    // Check cart page
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/31-checkout-page.png`, fullPage: true });
    console.log('✓ Checkout page loaded');

    // Check cart items
    const cartItems = page.locator('.cart-item, .order-item');
    const itemCount = await cartItems.count();
    console.log(`✓ Found ${itemCount} cart items`);

    // Check checkout form
    const checkoutForm = page.locator('#checkout-form, .checkout-form, form');
    if (await checkoutForm.count() > 0) {
      console.log('✓ Checkout form visible');
    }
  });

  test('UX - Chat and Reviews', async () => {
    console.log('\n=== CHAT AND REVIEWS ===');

    // Check chat page
    await page.goto('http://localhost:3000/chat.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/32-chat-page.png`, fullPage: true });
    console.log('✓ Chat page loaded');

    // Check chat interface
    const chatInterface = page.locator('.chat-interface, .chat-container, #chat-container');
    if (await chatInterface.count() > 0) {
      console.log('✓ Chat interface visible');
    }

    // Check message input
    const messageInput = page.locator('#message-input, .message-input, textarea[name="message"]');
    if (await messageInput.count() > 0) {
      console.log('✓ Message input visible');
    }

    // Check reviews on product page
    await page.goto('http://localhost:3000/index.html');
    const firstProduct = page.locator('.product-card, .card').first();
    if (await firstProduct.count() > 0) {
      await firstProduct.click();
      await page.waitForTimeout(2000);
      
      const reviewsSection = page.locator('.reviews-section, #reviews, [data-section="reviews"]');
      if (await reviewsSection.count() > 0) {
        await page.screenshot({ path: `${screenshotDir}/33-product-reviews.png`, fullPage: true });
        console.log('✓ Reviews section visible');
      }
    }
  });

  test('UX - Notifications and Status Indicators', async () => {
    console.log('\n=== NOTIFICATIONS AND STATUS INDICATORS ===');

    await page.goto('http://localhost:3000/customer-account.html');
    await page.waitForLoadState('networkidle');

    // Check notification badge
    const notifBadge = page.locator('.notification-badge, .badge, [data-badge]');
    const badgeCount = await notifBadge.count();
    console.log(`✓ Found ${badgeCount} notification badges`);

    // Check status indicators
    const statusIndicators = page.locator('.status, .order-status, [data-status]');
    const statusCount = await statusIndicators.count();
    console.log(`✓ Found ${statusCount} status indicators`);

    // Check loading screens
    const loadingScreen = page.locator('.loading-screen, #loading-screen, .spinner');
    if (await loadingScreen.count() > 0) {
      console.log('✓ Loading screen elements found');
    }
  });

  test('UX - Modals and Forms', async () => {
    console.log('\n=== MODALS AND FORMS ===');

    await page.goto('http://localhost:3000/index.html');

    // Check all modals
    const modals = page.locator('.modal, [role="dialog"]');
    const modalCount = await modals.count();
    console.log(`✓ Found ${modalCount} modal elements`);

    // Check form validation
    const forms = page.locator('form');
    const formCount = await forms.count();
    console.log(`✓ Found ${formCount} forms`);

    // Check required fields
    const requiredFields = page.locator('[required], .required');
    const requiredCount = await requiredFields.count();
    console.log(`✓ Found ${requiredCount} required fields`);
  });
});
