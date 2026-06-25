const { test, expect } = require('@playwright/test');

// REAL WORLD USER SIMULATION AND ABUSE TEST
// This test performs actual browser interactions with realistic data

test.describe('Real World Simulation - Access Control & Abuse Testing', () => {
  let page;
  const screenshotDir = 'test-results/simulation-screenshots';
  const evidenceDir = 'test-results/simulation-evidence';

  test.beforeAll(async ({ browser }) => {
    const fs = require('fs');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Clear localStorage before each test
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => localStorage.clear());
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ============================================
  // GUEST ACCESS CONTROL TESTING
  // ============================================
  test('GUEST - Direct Access to Protected Pages', async () => {
    console.log('\n=== GUEST ACCESS CONTROL TESTING ===');
    
    const protectedPages = [
      { url: '/checkout.html', name: 'Checkout' },
      { url: '/orders.html', name: 'Orders' },
      { url: '/customer-account.html', name: 'Customer Account' },
      { url: '/farmer.html', name: 'Farmer Dashboard' },
      { url: '/admin.html', name: 'Admin Dashboard' },
      { url: '/notifications.html', name: 'Notifications' },
      { url: '/chat.html', name: 'Chat' }
    ];

    const accessResults = [];

    for (const pageInfo of protectedPages) {
      console.log(`Testing: ${pageInfo.name}`);
      await page.goto(`http://localhost:3000${pageInfo.url}`);
      await page.waitForTimeout(2000);
      
      const screenshotName = `guest-access-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      await page.screenshot({ path: `${screenshotDir}/${screenshotName}`, fullPage: true });
      
      // Check if redirected to login or shows error
      const currentUrl = page.url();
      const hasLoginModal = await page.locator('#loginModal, .login-modal, [data-modal="login"]').count() > 0;
      const hasLoginPrompt = await page.locator('.login-prompt, .guest-login-prompt').count() > 0;
      
      const isProtected = currentUrl.includes('login') || hasLoginModal || hasLoginPrompt;
      accessResults.push({
        page: pageInfo.name,
        url: pageInfo.url,
        isProtected: isProtected,
        currentUrl: currentUrl,
        hasLoginModal: hasLoginModal,
        hasLoginPrompt: hasLoginPrompt
      });
      
      console.log(`  - Protected: ${isProtected ? 'YES' : 'NO'}`);
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/guest-access-control.json`,
      JSON.stringify(accessResults, null, 2)
    );
  });

  // ============================================
  // CART FUNCTIONALITY TESTING
  // ============================================
  test('CART - Add Regular and Preorder Products', async () => {
    console.log('\n=== CART FUNCTIONALITY TESTING ===');
    
    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/cart-01-landing.png`, fullPage: true });

    // Find and click on first product
    const productCards = page.locator('.product-card, .card');
    const cardCount = await productCards.count();
    console.log(`Found ${cardCount} product cards`);

    if (cardCount > 0) {
      // Click first product
      await productCards.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/cart-02-product-details.png`, fullPage: true });

      // Check for preorder indicator
      const preorderIndicator = page.locator('.preorder-badge, [data-preorder="true"], .preorder-indicator');
      const isPreorder = await preorderIndicator.count() > 0;
      console.log(`Product is preorder: ${isPreorder ? 'YES' : 'NO'}`);

      // Try to add to cart
      const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn, [data-action="add-to-cart"]');
      if (await addToCartBtn.count() > 0) {
        await addToCartBtn.first().click();
        await page.waitForTimeout(2000);
        
        // Check for toast/notification
        const toast = page.locator('.toast, .notification, [role="alert"]');
        const toastVisible = await toast.count() > 0;
        console.log(`Toast visible: ${toastVisible ? 'YES' : 'NO'}`);
        
        await page.screenshot({ path: `${screenshotDir}/cart-03-after-add-to-cart.png`, fullPage: true });
      }

      // Check cart count
      const cartCount = page.locator('.cart-count, #cart-count, [data-cart-count]');
      const countValue = await cartCount.textContent();
      console.log(`Cart count: ${countValue || '0'}`);
    }

    // Navigate to checkout
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/cart-04-checkout-page.png`, fullPage: true });

    // Check for guest login prompt
    const guestPrompt = page.locator('.guest-login-prompt, .login-prompt, #guest-login');
    const hasGuestPrompt = await guestPrompt.count() > 0;
    console.log(`Guest login prompt: ${hasGuestPrompt ? 'YES' : 'NO'}`);
  });

  // ============================================
  // CONCURRENT STOCK TESTING
  // ============================================
  test('CONCURRENT STOCK - Multiple Users Purchase Last Stock', async () => {
    console.log('\n=== CONCURRENT STOCK TESTING ===');
    
    // This test simulates multiple users trying to purchase the same product
    // We'll create multiple browser contexts to simulate concurrent users
    
    const browser = page.context().browser();
    const contexts = [];
    const results = [];

    // Create 3 concurrent users
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext();
      const userPage = await context.newPage();
      contexts.push({ context, page: userPage, userId: i + 1 });
    }

    // Have all users navigate to the same product
    for (const { page, userId } of contexts) {
      await page.goto('http://localhost:3000/index.html');
      await page.waitForLoadState('networkidle');
      console.log(`User ${userId} navigated to landing page`);
    }

    // Take screenshot of initial state
    await contexts[0].page.screenshot({ path: `${screenshotDir}/concurrent-01-initial.png`, fullPage: true });

    // All users try to add the same product to cart
    for (const { page, userId } of contexts) {
      const productCards = page.locator('.product-card, .card');
      if (await productCards.count() > 0) {
        await productCards.first().click();
        await page.waitForTimeout(1000);
        
        const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn');
        if (await addToCartBtn.count() > 0) {
          try {
            await addToCartBtn.first().click();
            await page.waitForTimeout(1000);
            results.push({ userId: userId, action: 'add_to_cart', success: true });
          } catch (error) {
            results.push({ userId: userId, action: 'add_to_cart', success: false, error: error.message });
          }
        }
      }
    }

    // Check for stock error messages
    for (const { page, userId } of contexts) {
      const errorMessage = page.locator('.error, .alert-danger, [data-error="stock"]');
      const hasError = await errorMessage.count() > 0;
      const errorText = hasError ? await errorMessage.textContent() : 'No error';
      
      await page.screenshot({ path: `${screenshotDir}/concurrent-user-${userId}.png`, fullPage: true });
      results.push({ userId: userId, hasStockError: hasError, errorText: errorText });
    }

    // Clean up contexts
    for (const { context } of contexts) {
      await context.close();
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/concurrent-stock-results.json`,
      JSON.stringify(results, null, 2)
    );
    
    console.log('Concurrent stock test completed');
  });

  // ============================================
  // TOAST AND FEEDBACK TESTING
  // ============================================
  test('TOAST - User Feedback Messages', async () => {
    console.log('\n=== TOAST AND FEEDBACK TESTING ===');
    
    const feedbackTests = [
      { action: 'add_to_cart', selector: '#add-to-cart-btn, .add-to-cart-btn' },
      { action: 'remove_from_cart', selector: '.remove-from-cart, [data-action="remove"]' },
      { action: 'checkout', selector: '.checkout-btn, #checkout-btn' }
    ];

    const feedbackResults = [];

    for (const test of feedbackTests) {
      console.log(`Testing feedback for: ${test.action}`);
      
      await page.goto('http://localhost:3000/index.html');
      await page.waitForLoadState('networkidle');

      const button = page.locator(test.selector);
      if (await button.count() > 0) {
        await button.first().click();
        await page.waitForTimeout(2000);

        // Check for toast
        const toast = page.locator('.toast, .notification, [role="alert"]');
        const toastVisible = await toast.count() > 0;
        const toastText = toastVisible ? await toast.textContent() : 'No toast';

        await page.screenshot({ path: `${screenshotDir}/toast-${test.action}.png`, fullPage: true });

        feedbackResults.push({
          action: test.action,
          toastVisible: toastVisible,
          toastText: toastText
        });

        console.log(`  - Toast visible: ${toastVisible ? 'YES' : 'NO'}`);
        console.log(`  - Toast text: ${toastText}`);
      }
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/toast-feedback-results.json`,
      JSON.stringify(feedbackResults, null, 2)
    );
  });

  // ============================================
  // PREORDER CONSISTENCY TESTING
  // ============================================
  test('PREORDER - Indicator Consistency Across Pages', async () => {
    console.log('\n=== PREORDER INDICATOR CONSISTENCY TESTING ===');
    
    const pagesToCheck = [
      { url: '/index.html', name: 'Landing Page' },
      { url: '/checkout.html', name: 'Checkout' },
      { url: '/orders.html', name: 'Orders' }
    ];

    const preorderResults = [];

    for (const pageInfo of pagesToCheck) {
      console.log(`Checking: ${pageInfo.name}`);
      await page.goto(`http://localhost:3000${pageInfo.url}`);
      await page.waitForTimeout(2000);

      // Look for preorder indicators
      const preorderBadges = page.locator('.preorder-badge, [data-preorder="true"]');
      const preorderCount = await preorderBadges.count();

      await page.screenshot({ path: `${screenshotDir}/preorder-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });

      preorderResults.push({
        page: pageInfo.name,
        preorderIndicatorsFound: preorderCount,
        hasPreorder: preorderCount > 0
      });

      console.log(`  - Preorder indicators: ${preorderCount}`);
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/preorder-consistency.json`,
      JSON.stringify(preorderResults, null, 2)
    );
  });

  // ============================================
  // UI CONSISTENCY AUDIT
  // ============================================
  test('UI CONSISTENCY - Buttons, Colors, Badges, Tabs, Tables, Cards, Modals', async () => {
    console.log('\n=== UI CONSISTENCY AUDIT ===');
    
    const auditPages = [
      { url: '/index.html', name: 'Landing' },
      { url: '/customer-account.html', name: 'Customer Account' },
      { url: '/farmer.html', name: 'Farmer Dashboard' },
      { url: '/admin.html', name: 'Admin Dashboard' }
    ];

    const auditResults = [];

    for (const pageInfo of auditPages) {
      console.log(`Auditing: ${pageInfo.name}`);
      await page.goto(`http://localhost:3000${pageInfo.url}`);
      await page.waitForTimeout(2000);

      const audit = {
        page: pageInfo.name,
        buttons: await page.locator('button, .btn').count(),
        badges: await page.locator('.badge, [class*="badge"]').count(),
        tabs: await page.locator('.tab, [role="tab"], .nav-tabs').count(),
        tables: await page.locator('table, .table').count(),
        cards: await page.locator('.card, .product-card').count(),
        modals: await page.locator('.modal, [role="dialog"]').count()
      };

      await page.screenshot({ path: `${screenshotDir}/audit-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });

      auditResults.push(audit);
      console.log(`  - Buttons: ${audit.buttons}`);
      console.log(`  - Badges: ${audit.badges}`);
      console.log(`  - Tabs: ${audit.tabs}`);
      console.log(`  - Tables: ${audit.tables}`);
      console.log(`  - Cards: ${audit.cards}`);
      console.log(`  - Modals: ${audit.modals}`);
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/ui-consistency-audit.json`,
      JSON.stringify(auditResults, null, 2)
    );
  });

  // ============================================
  // COMPLETE CUSTOMER WORKFLOW
  // ============================================
  test('WORKFLOW - Complete Customer Journey', async () => {
    console.log('\n=== COMPLETE CUSTOMER WORKFLOW ===');
    
    // Step 1: Browse products
    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/workflow-customer-01-browse.png`, fullPage: true });
    console.log('Step 1: Browsing products');

    // Step 2: View product details
    const productCards = page.locator('.product-card, .card');
    if (await productCards.count() > 0) {
      await productCards.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/workflow-customer-02-product-details.png`, fullPage: true });
      console.log('Step 2: Viewing product details');

      // Step 3: Add to cart
      const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn');
      if (await addToCartBtn.count() > 0) {
        await addToCartBtn.first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${screenshotDir}/workflow-customer-03-add-to-cart.png`, fullPage: true });
        console.log('Step 3: Added to cart');
      }
    }

    // Step 4: Navigate to checkout
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/workflow-customer-04-checkout.png`, fullPage: true });
    console.log('Step 4: On checkout page');

    // Step 5: Check orders page
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/workflow-customer-05-orders.png`, fullPage: true });
    console.log('Step 5: On orders page');
  });

  // ============================================
  // COMPLETE FARMER WORKFLOW
  // ============================================
  test('WORKFLOW - Complete Farmer Journey', async () => {
    console.log('\n=== COMPLETE FARMER WORKFLOW ===');
    
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/workflow-farmer-01-dashboard.png`, fullPage: true });
    console.log('Step 1: On farmer dashboard');

    // Try to navigate to products section
    const productsNav = page.locator('[data-section="products"], #products-nav, a[href*="#products"]');
    if (await productsNav.count() > 0) {
      await productsNav.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/workflow-farmer-02-products.png`, fullPage: true });
      console.log('Step 2: Navigated to products');

      // Try to add product button
      const addProductBtn = page.locator('#add-product-btn, .add-product-btn');
      if (await addProductBtn.count() > 0) {
        await addProductBtn.first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${screenshotDir}/workflow-farmer-03-add-product-modal.png`, fullPage: true });
        console.log('Step 3: Add product modal opened');
      }
    }

    // Navigate to orders
    const ordersNav = page.locator('[data-section="orders"], #orders-nav, a[href*="#orders"]');
    if (await ordersNav.count() > 0) {
      await ordersNav.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/workflow-farmer-04-orders.png`, fullPage: true });
      console.log('Step 4: Navigated to orders');
    }
  });

  // ============================================
  // COMPLETE ADMIN WORKFLOW
  // ============================================
  test('WORKFLOW - Complete Admin Journey', async () => {
    console.log('\n=== COMPLETE ADMIN WORKFLOW ===');
    
    await page.goto('http://localhost:3000/admin.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/workflow-admin-01-dashboard.png`, fullPage: true });
    console.log('Step 1: On admin dashboard');

    // Try to navigate to users section
    const usersNav = page.locator('[data-section="users"], #users-nav, a[href*="#users"]');
    if (await usersNav.count() > 0) {
      await usersNav.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/workflow-admin-02-users.png`, fullPage: true });
      console.log('Step 2: Navigated to users');
    }

    // Try to navigate to approvals
    const approvalsNav = page.locator('[data-section="approvals"], #approvals-nav, a[href*="#approvals"]');
    if (await approvalsNav.count() > 0) {
      await approvalsNav.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/workflow-admin-03-approvals.png`, fullPage: true });
      console.log('Step 3: Navigated to approvals');
    }

    // Try to navigate to orders
    const ordersNav = page.locator('[data-section="orders"], #orders-nav, a[href*="#orders"]');
    if (await ordersNav.count() > 0) {
      await ordersNav.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/workflow-admin-04-orders.png`, fullPage: true });
      console.log('Step 4: Navigated to orders');
    }
  });

  // ============================================
  // ABUSE TESTING - Rapid Actions
  // ============================================
  test('ABUSE - Rapid Button Clicks', async () => {
    console.log('\n=== ABUSE TESTING - RAPID CLICKS ===');
    
    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');

    const productCards = page.locator('.product-card, .card');
    if (await productCards.count() > 0) {
      await productCards.first().click();
      await page.waitForTimeout(1000);

      const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn');
      if (await addToCartBtn.count() > 0) {
        // Rapid click 10 times
        for (let i = 0; i < 10; i++) {
          await addToCartBtn.first().click();
          await page.waitForTimeout(100);
        }
        
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${screenshotDir}/abuse-rapid-clicks.png`, fullPage: true });
        console.log('Rapid clicks test completed');

        // Check for errors or warnings
        const errors = page.locator('.error, .alert-danger');
        const errorCount = await errors.count();
        console.log(`Errors after rapid clicks: ${errorCount}`);
      }
    }
  });

  // ============================================
  // ABUSE TESTING - Invalid Data
  // ============================================
  test('ABUSE - Invalid Data Input', async () => {
    console.log('\n=== ABUSE TESTING - INVALID DATA ===');
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);

    // Try to find form inputs and submit invalid data
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();
    console.log(`Found ${inputCount} form inputs`);

    for (let i = 0; i < Math.min(inputCount, 5); i++) {
      const input = inputs.nth(i);
      const inputType = await input.getAttribute('type');
      
      if (inputType !== 'hidden' && inputType !== 'submit') {
        await input.fill('INVALID_TEST_DATA_<>{}');
      }
    }

    await page.screenshot({ path: `${screenshotDir}/abuse-invalid-data.png`, fullPage: true });
    console.log('Invalid data test completed');
  });
});
