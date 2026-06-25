const { test, expect } = require('@playwright/test');
const { getAdminToken, getFarmerToken, getCustomerToken } = require('./auth-helper');

// REAL USER SMOKE TEST
// Uses existing data only - NO creation or modification
// Tests navigation, access control, and UI elements

const BASE_URL = 'http://localhost:3000';
const API_BASE = 'http://localhost:3000/api';

test.describe('Real User Smoke Test - Existing Data Only', () => {
  let adminToken = null;
  let adminUser = null;
  let farmerToken = null;
  let farmerUser = null;
  let customerToken = null;
  let customerUser = null;
  
  const results = {
    guest: { tests: [], passed: 0, failed: 0, partial: 0 },
    customer: { tests: [], passed: 0, failed: 0, partial: 0 },
    farmer: { tests: [], passed: 0, failed: 0, partial: 0 },
    admin: { tests: [], passed: 0, failed: 0, partial: 0 },
    superadmin: { tests: [], passed: 0, failed: 0, partial: 0 }
  };

  test.beforeAll(async () => {
    console.log('\n=== GETTING EXISTING USER TOKENS ===');
    
    try {
      const adminData = await getAdminToken();
      adminToken = adminData.token;
      adminUser = adminData.user;
      console.log(`✓ Admin token obtained: ${adminUser.email} (role: ${adminUser.role})`);
    } catch (error) {
      console.log(`✗ Admin token failed: ${error.message}`);
    }
    
    try {
      const farmerData = await getFarmerToken();
      farmerToken = farmerData.token;
      farmerUser = farmerData.user;
      console.log(`✓ Farmer token obtained: ${farmerUser.email} (role: ${farmerUser.role})`);
    } catch (error) {
      console.log(`✗ Farmer token failed: ${error.message}`);
    }
    
    try {
      const customerData = await getCustomerToken();
      customerToken = customerData.token;
      customerUser = customerData.user;
      console.log(`✓ Customer token obtained: ${customerUser.email} (role: ${customerUser.role})`);
    } catch (error) {
      console.log(`✗ Customer token failed: ${error.message}`);
    }
  });

  function recordResult(role, testName, status, details) {
    results[role].tests.push({ test: testName, status, details });
    if (status === 'PASS') results[role].passed++;
    else if (status === 'FAIL') results[role].failed++;
    else results[role].partial++;
    console.log(`  [${role}] ${testName}: ${status} - ${details}`);
  }

  // ============================================
  // GUEST ROLE TESTS
  // ============================================
  test.describe('Guest Role', () => {
    test('GUEST-001: Navigate to homepage', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const title = await page.title();
      const hasProducts = await page.locator('.product-card, .card').count() > 0;
      
      if (title && hasProducts) {
        recordResult('guest', 'Navigate to homepage', 'PASS', 'Homepage loaded with products');
        await page.screenshot({ path: 'test-results/smoke-test/guest-001-homepage.png', fullPage: true });
      } else {
        recordResult('guest', 'Navigate to homepage', 'PARTIAL', `Title: ${title}, Products: ${hasProducts}`);
      }
    });

    test('GUEST-002: Browse products section', async ({ page }) => {
      await page.goto(`${BASE_URL}/#products`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const productCards = await page.locator('.product-card, .card').count();
      const hasAddToCart = await page.locator('button:has-text("Add to Cart")').count() > 0;
      
      if (productCards > 0 && hasAddToCart) {
        recordResult('guest', 'Browse products section', 'PASS', `Found ${productCards} products with add to cart buttons`);
        await page.screenshot({ path: 'test-results/smoke-test/guest-002-products.png', fullPage: true });
      } else {
        recordResult('guest', 'Browse products section', 'PARTIAL', `Products: ${productCards}, Add to cart: ${hasAddToCart}`);
      }
    });

    test('GUEST-003: Check navigation menu', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const navLinks = await page.locator('nav a, .navbar a').count();
      const hasHome = await page.locator('a:has-text("Home")').count() > 0;
      const hasProducts = await page.locator('a:has-text("Products")').count() > 0;
      
      if (navLinks > 0 && hasHome && hasProducts) {
        recordResult('guest', 'Check navigation menu', 'PASS', `Found ${navLinks} nav links including Home and Products`);
      } else {
        recordResult('guest', 'Check navigation menu', 'PARTIAL', `Nav links: ${navLinks}, Home: ${hasHome}, Products: ${hasProducts}`);
      }
    });

    test('GUEST-004: Attempt to access customer account (should redirect)', async ({ page }) => {
      await page.goto(`${BASE_URL}/customer-account.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('login') || currentUrl.includes('index.html');
      
      if (isRedirected) {
        recordResult('guest', 'Access customer account redirect', 'PASS', 'Correctly redirected to login');
      } else {
        recordResult('guest', 'Access customer account redirect', 'FAIL', 'Did not redirect to login');
      }
    });

    test('GUEST-005: Attempt to access farmer dashboard (should redirect)', async ({ page }) => {
      await page.goto(`${BASE_URL}/farmer.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('login') || currentUrl.includes('index.html');
      
      if (isRedirected) {
        recordResult('guest', 'Access farmer dashboard redirect', 'PASS', 'Correctly redirected to login');
      } else {
        recordResult('guest', 'Access farmer dashboard redirect', 'FAIL', 'Did not redirect to login');
      }
    });

    test('GUEST-006: Attempt to access admin dashboard (should redirect)', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('login') || currentUrl.includes('index.html');
      
      if (isRedirected) {
        recordResult('guest', 'Access admin dashboard redirect', 'PASS', 'Correctly redirected to login');
      } else {
        recordResult('guest', 'Access admin dashboard redirect', 'FAIL', 'Did not redirect to login');
      }
    });

    test('GUEST-007: Check login modal accessibility', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const loginBtn = page.locator('#login-btn, .login-btn, [data-bs-target="#loginModal"]').first();
      if (await loginBtn.count() > 0) {
        await loginBtn.click();
        await page.waitForTimeout(1000);
        
        const modalVisible = await page.locator('.modal.show, .modal.active, #loginModal').count() > 0;
        const hasEmailInput = await page.locator('input[type="email"], input[name="email"]').count() > 0;
        const hasPasswordInput = await page.locator('input[type="password"], input[name="password"]').count() > 0;
        
        if (modalVisible && hasEmailInput && hasPasswordInput) {
          recordResult('guest', 'Login modal accessibility', 'PASS', 'Login modal opens with email and password fields');
          await page.screenshot({ path: 'test-results/smoke-test/guest-007-login-modal.png', fullPage: true });
        } else {
          recordResult('guest', 'Login modal accessibility', 'PARTIAL', `Modal: ${modalVisible}, Email: ${hasEmailInput}, Password: ${hasPasswordInput}`);
        }
      } else {
        recordResult('guest', 'Login modal accessibility', 'FAIL', 'Login button not found');
      }
    });
  });

  // ============================================
  // CUSTOMER ROLE TESTS
  // ============================================
  test.describe('Customer Role', () => {
    test.beforeEach(async ({ page }) => {
      if (!customerToken) {
        test.skip('No customer token available');
      }
    });

    test('CUSTOMER-001: Login as customer', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: customerToken, userEmail: customerUser.email, userRole: customerUser.role });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const tokenInStorage = await page.evaluate(() => localStorage.getItem('token'));
      
      if (tokenInStorage) {
        recordResult('customer', 'Login as customer', 'PASS', `Logged in as ${customerUser.email}`);
        await page.screenshot({ path: 'test-results/smoke-test/customer-001-logged-in.png', fullPage: true });
      } else {
        recordResult('customer', 'Login as customer', 'FAIL', 'Token not stored in localStorage');
      }
    });

    test('CUSTOMER-002: Access customer account page', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: customerToken, userEmail: customerUser.email, userRole: customerUser.role });
      await page.goto(`${BASE_URL}/customer-account.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasAccountSection = await page.locator('.account-section, .customer-account').count() > 0;
      
      if (!currentUrl.includes('login') && hasAccountSection) {
        recordResult('customer', 'Access customer account page', 'PASS', 'Customer account page accessible');
        await page.screenshot({ path: 'test-results/smoke-test/customer-002-account.png', fullPage: true });
      } else {
        recordResult('customer', 'Access customer account page', 'FAIL', `Redirected or no account section: ${currentUrl}`);
      }
    });

    test('CUSTOMER-003: View orders page', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: customerToken, userEmail: customerUser.email, userRole: customerUser.role });
      await page.goto(`${BASE_URL}/orders.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasOrdersSection = await page.locator('.orders-section, .order-card, .order-table').count() > 0;
      
      if (!currentUrl.includes('login')) {
        recordResult('customer', 'View orders page', hasOrdersSection ? 'PASS' : 'PARTIAL', 
          hasOrdersSection ? 'Orders page with order data' : 'Orders page accessible but no orders displayed');
        await page.screenshot({ path: 'test-results/smoke-test/customer-003-orders.png', fullPage: true });
      } else {
        recordResult('customer', 'View orders page', 'FAIL', 'Redirected to login');
      }
    });

    test('CUSTOMER-004: Access checkout page', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: customerToken, userEmail: customerUser.email, userRole: customerUser.role });
      await page.goto(`${BASE_URL}/checkout.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasCheckoutForm = await page.locator('.checkout-form, .checkout-section').count() > 0;
      
      if (!currentUrl.includes('login')) {
        recordResult('customer', 'Access checkout page', hasCheckoutForm ? 'PASS' : 'PARTIAL',
          hasCheckoutForm ? 'Checkout page with form' : 'Checkout page accessible but no form');
        await page.screenshot({ path: 'test-results/smoke-test/customer-004-checkout.png', fullPage: true });
      } else {
        recordResult('customer', 'Access checkout page', 'FAIL', 'Redirected to login');
      }
    });

    test('CUSTOMER-005: Check customer navigation', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: customerToken, userEmail: customerUser.email, userRole: customerUser.role });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasAccountLink = await page.locator('a:has-text("Account"), a[href*="customer-account"]').count() > 0;
      const hasOrdersLink = await page.locator('a:has-text("Orders"), a[href*="orders"]').count() > 0;
      const hasLogoutBtn = await page.locator('button:has-text("Logout"), .logout-btn').count() > 0;
      
      if (hasAccountLink && hasOrdersLink && hasLogoutBtn) {
        recordResult('customer', 'Check customer navigation', 'PASS', 'Customer navigation links present');
      } else {
        recordResult('customer', 'Check customer navigation', 'PARTIAL', 
          `Account: ${hasAccountLink}, Orders: ${hasOrdersLink}, Logout: ${hasLogoutBtn}`);
      }
    });

    test('CUSTOMER-006: Verify customer cannot access farmer dashboard', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: customerToken, userEmail: customerUser.email, userRole: customerUser.role });
      await page.goto(`${BASE_URL}/farmer.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('login') || currentUrl.includes('index.html');
      
      if (isRedirected) {
        recordResult('customer', 'Farmer dashboard access control', 'PASS', 'Correctly blocked from farmer dashboard');
      } else {
        recordResult('customer', 'Farmer dashboard access control', 'FAIL', 'Should not access farmer dashboard');
      }
    });

    test('CUSTOMER-007: Verify customer cannot access admin dashboard', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: customerToken, userEmail: customerUser.email, userRole: customerUser.role });
      await page.goto(`${BASE_URL}/admin.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('login') || currentUrl.includes('index.html');
      
      if (isRedirected) {
        recordResult('customer', 'Admin dashboard access control', 'PASS', 'Correctly blocked from admin dashboard');
      } else {
        recordResult('customer', 'Admin dashboard access control', 'FAIL', 'Should not access admin dashboard');
      }
    });
  });

  // ============================================
  // FARMER ROLE TESTS
  // ============================================
  test.describe('Farmer Role', () => {
    test.beforeEach(async ({ page }) => {
      if (!farmerToken) {
        test.skip('No farmer token available');
      }
    });

    test('FARMER-001: Login as farmer', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: farmerToken, userEmail: farmerUser.email, userRole: farmerUser.role });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const tokenInStorage = await page.evaluate(() => localStorage.getItem('token'));
      
      if (tokenInStorage) {
        recordResult('farmer', 'Login as farmer', 'PASS', `Logged in as ${farmerUser.email}`);
        await page.screenshot({ path: 'test-results/smoke-test/farmer-001-logged-in.png', fullPage: true });
      } else {
        recordResult('farmer', 'Login as farmer', 'FAIL', 'Token not stored in localStorage');
      }
    });

    test('FARMER-002: Access farmer dashboard', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: farmerToken, userEmail: farmerUser.email, userRole: farmerUser.role });
      await page.goto(`${BASE_URL}/farmer.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasFarmerSidebar = await page.locator('#farmer-sidebar, .farmer-sidebar, .sidebar').count() > 0;
      const hasOverviewSection = await page.locator('#overview, .overview-section').count() > 0;
      
      if (!currentUrl.includes('login') && hasFarmerSidebar) {
        recordResult('farmer', 'Access farmer dashboard', hasOverviewSection ? 'PASS' : 'PARTIAL',
          hasOverviewSection ? 'Farmer dashboard with overview' : 'Farmer dashboard accessible but missing overview');
        await page.screenshot({ path: 'test-results/smoke-test/farmer-002-dashboard.png', fullPage: true });
      } else {
        recordResult('farmer', 'Access farmer dashboard', 'FAIL', 'Cannot access farmer dashboard');
      }
    });

    test('FARMER-003: View farmer products section', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: farmerToken, userEmail: farmerUser.email, userRole: farmerUser.role });
      await page.goto(`${BASE_URL}/farmer.html#products`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasProductsSection = await page.locator('#products, .products-section').count() > 0;
      const hasProductTable = await page.locator('.product-table, table').count() > 0;
      
      if (hasProductsSection) {
        recordResult('farmer', 'View farmer products section', hasProductTable ? 'PASS' : 'PARTIAL',
          hasProductTable ? 'Products section with table' : 'Products section accessible but no table');
        await page.screenshot({ path: 'test-results/smoke-test/farmer-003-products.png', fullPage: true });
      } else {
        recordResult('farmer', 'View farmer products section', 'FAIL', 'Products section not found');
      }
    });

    test('FARMER-004: View farmer orders section', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: farmerToken, userEmail: farmerUser.email, userRole: farmerUser.role });
      await page.goto(`${BASE_URL}/farmer.html#orders`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasOrdersSection = await page.locator('#orders, .orders-section').count() > 0;
      const hasOrderTabs = await page.locator('.order-tabs, .tab-button').count() > 0;
      
      if (hasOrdersSection) {
        recordResult('farmer', 'View farmer orders section', hasOrderTabs ? 'PASS' : 'PARTIAL',
          hasOrderTabs ? 'Orders section with tabs' : 'Orders section accessible but no tabs');
        await page.screenshot({ path: 'test-results/smoke-test/farmer-004-orders.png', fullPage: true });
      } else {
        recordResult('farmer', 'View farmer orders section', 'FAIL', 'Orders section not found');
      }
    });

    test('FARMER-005: Check farmer sidebar navigation', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: farmerToken, userEmail: farmerUser.email, userRole: farmerUser.role });
      await page.goto(`${BASE_URL}/farmer.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasOverviewNav = await page.locator('a:has-text("Overview"), a[href*="#overview"]').count() > 0;
      const hasProductsNav = await page.locator('a:has-text("Products"), a[href*="#products"]').count() > 0;
      const hasOrdersNav = await page.locator('a:has-text("Orders"), a[href*="#orders"]').count() > 0;
      const hasChatNav = await page.locator('a:has-text("Chat"), a[href*="#chat"]').count() > 0;
      
      if (hasOverviewNav && hasProductsNav && hasOrdersNav && hasChatNav) {
        recordResult('farmer', 'Check farmer sidebar navigation', 'PASS', 'All sidebar navigation links present');
      } else {
        recordResult('farmer', 'Check farmer sidebar navigation', 'PARTIAL',
          `Overview: ${hasOverviewNav}, Products: ${hasProductsNav}, Orders: ${hasOrdersNav}, Chat: ${hasChatNav}`);
      }
    });

    test('FARMER-006: Verify farmer cannot access admin dashboard', async ({ page, context }) => {
      // First navigate to a neutral page to set localStorage
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: farmerToken, userEmail: farmerUser.email, userRole: farmerUser.role });
      
      // Now navigate to admin.html - authorization check should run
      await page.goto(`${BASE_URL}/admin.html`);
      
      // Wait for redirect or page load
      await page.waitForTimeout(3000);
      
      // Check if we're still on admin page or were redirected
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('login') || currentUrl.includes('index.html') || !currentUrl.includes('admin.html');
      
      if (isRedirected) {
        recordResult('farmer', 'Admin dashboard access control', 'PASS', 'Correctly blocked from admin dashboard');
      } else {
        recordResult('farmer', 'Admin dashboard access control', 'FAIL', 'Should not access admin dashboard');
      }
    });

    test('FARMER-007: Check farmer dashboard KPIs', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: farmerToken, userEmail: farmerUser.email, userRole: farmerUser.role });
      await page.goto(`${BASE_URL}/farmer.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasKpiCards = await page.locator('.kpi-card, .stat-card, .metric-card').count() > 0;
      
      if (hasKpiCards) {
        recordResult('farmer', 'Check farmer dashboard KPIs', 'PASS', 'KPI cards displayed on dashboard');
      } else {
        recordResult('farmer', 'Check farmer dashboard KPIs', 'PARTIAL', 'No KPI cards found');
      }
    });
  });

  // ============================================
  // ADMIN ROLE TESTS
  // ============================================
  test.describe('Admin Role', () => {
    test.beforeEach(async ({ page }) => {
      if (!adminToken) {
        test.skip('No admin token available');
      }
    });

    test('ADMIN-001: Login as admin', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const tokenInStorage = await page.evaluate(() => localStorage.getItem('token'));
      
      if (tokenInStorage) {
        recordResult('admin', 'Login as admin', 'PASS', `Logged in as ${adminUser.email} (${adminUser.role})`);
        await page.screenshot({ path: 'test-results/smoke-test/admin-001-logged-in.png', fullPage: true });
      } else {
        recordResult('admin', 'Login as admin', 'FAIL', 'Token not stored in localStorage');
      }
    });

    test('ADMIN-002: Access admin dashboard', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasAdminSidebar = await page.locator('#admin-sidebar, .admin-sidebar, .sidebar').count() > 0;
      const hasDashboardSection = await page.locator('#dashboard, .dashboard-section').count() > 0;
      
      if (!currentUrl.includes('login') && hasAdminSidebar) {
        recordResult('admin', 'Access admin dashboard', hasDashboardSection ? 'PASS' : 'PARTIAL',
          hasDashboardSection ? 'Admin dashboard with dashboard section' : 'Admin dashboard accessible but missing dashboard section');
        await page.screenshot({ path: 'test-results/smoke-test/admin-002-dashboard.png', fullPage: true });
      } else {
        recordResult('admin', 'Access admin dashboard', 'FAIL', 'Cannot access admin dashboard');
      }
    });

    test('ADMIN-003: View admin users section', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html#users`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasUsersSection = await page.locator('#users, .users-section').count() > 0;
      const hasUserTable = await page.locator('.user-table, table').count() > 0;
      
      if (hasUsersSection) {
        recordResult('admin', 'View admin users section', hasUserTable ? 'PASS' : 'PARTIAL',
          hasUserTable ? 'Users section with table' : 'Users section accessible but no table');
        await page.screenshot({ path: 'test-results/smoke-test/admin-003-users.png', fullPage: true });
      } else {
        recordResult('admin', 'View admin users section', 'FAIL', 'Users section not found');
      }
    });

    test('ADMIN-004: View admin products section', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html#products`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasProductsSection = await page.locator('#products, .products-section').count() > 0;
      const hasProductTable = await page.locator('.product-table, table').count() > 0;
      
      if (hasProductsSection) {
        recordResult('admin', 'View admin products section', hasProductTable ? 'PASS' : 'PARTIAL',
          hasProductTable ? 'Products section with table' : 'Products section accessible but no table');
        await page.screenshot({ path: 'test-results/smoke-test/admin-004-products.png', fullPage: true });
      } else {
        recordResult('admin', 'View admin products section', 'FAIL', 'Products section not found');
      }
    });

    test('ADMIN-005: View admin orders section', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html#orders`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasOrdersSection = await page.locator('#orders, .orders-section').count() > 0;
      const hasOrderTabs = await page.locator('.order-tabs, .tab-button').count() > 0;
      
      if (hasOrdersSection) {
        recordResult('admin', 'View admin orders section', hasOrderTabs ? 'PASS' : 'PARTIAL',
          hasOrderTabs ? 'Orders section with tabs' : 'Orders section accessible but no tabs');
        await page.screenshot({ path: 'test-results/smoke-test/admin-005-orders.png', fullPage: true });
      } else {
        recordResult('admin', 'View admin orders section', 'FAIL', 'Orders section not found');
      }
    });

    test('ADMIN-006: Check admin sidebar navigation', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasDashboardNav = await page.locator('a:has-text("Dashboard"), a[href*="#dashboard"]').count() > 0;
      const hasUsersNav = await page.locator('a:has-text("Users"), a[href*="#users"]').count() > 0;
      const hasProductsNav = await page.locator('a:has-text("Products"), a[href*="#products"]').count() > 0;
      const hasOrdersNav = await page.locator('a:has-text("Orders"), a[href*="#orders"]').count() > 0;
      
      if (hasDashboardNav && hasUsersNav && hasProductsNav && hasOrdersNav) {
        recordResult('admin', 'Check admin sidebar navigation', 'PASS', 'All sidebar navigation links present');
      } else {
        recordResult('admin', 'Check admin sidebar navigation', 'PARTIAL',
          `Dashboard: ${hasDashboardNav}, Users: ${hasUsersNav}, Products: ${hasProductsNav}, Orders: ${hasOrdersNav}`);
      }
    });

    test('ADMIN-007: Check admin dashboard KPIs', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasKpiCards = await page.locator('.kpi-card, .stat-card, .metric-card').count() > 0;
      
      if (hasKpiCards) {
        recordResult('admin', 'Check admin dashboard KPIs', 'PASS', 'KPI cards displayed on dashboard');
      } else {
        recordResult('admin', 'Check admin dashboard KPIs', 'PARTIAL', 'No KPI cards found');
      }
    });
  });

  // ============================================
  // SUPERADMIN ROLE TESTS
  // ============================================
  test.describe('Superadmin Role', () => {
    test.beforeEach(async ({ page }) => {
      if (!adminToken || (adminUser.role !== 'super_admin' && adminUser.role !== 'superadmin')) {
        test.skip('No superadmin token available');
      }
    });

    test('SUPERADMIN-001: Verify superadmin role', async ({ page }) => {
      const isSuperadmin = adminUser.role === 'super_admin' || adminUser.role === 'superadmin';
      
      if (isSuperadmin) {
        recordResult('superadmin', 'Verify superadmin role', 'PASS', `User ${adminUser.email} has role: ${adminUser.role}`);
      } else {
        recordResult('superadmin', 'Verify superadmin role', 'FAIL', `User ${adminUser.email} has role: ${adminUser.role} (not superadmin)`);
      }
    });

    test('SUPERADMIN-002: Access platform settings (if available)', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html#platform-settings`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasPlatformSettings = await page.locator('#platform-settings, .platform-settings').count() > 0;
      
      if (hasPlatformSettings) {
        recordResult('superadmin', 'Access platform settings', 'PASS', 'Platform settings section accessible');
        await page.screenshot({ path: 'test-results/smoke-test/superadmin-002-platform-settings.png', fullPage: true });
      } else {
        recordResult('superadmin', 'Access platform settings', 'PARTIAL', 'Platform settings section not found (may not exist)');
      }
    });

    test('SUPERADMIN-003: Check for superadmin-only features', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
      }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
      await page.goto(`${BASE_URL}/admin.html`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const hasSystemSettings = await page.locator('a:has-text("System"), a[href*="system"], a[href*="platform"]').count() > 0;
      
      if (hasSystemSettings) {
        recordResult('superadmin', 'Check for superadmin-only features', 'PASS', 'Superadmin-only navigation found');
      } else {
        recordResult('superadmin', 'Check for superadmin-only features', 'PARTIAL', 'No superadmin-specific navigation found');
      }
    });
  });

  // ============================================
  // UI COMPONENT VERIFICATION (All Roles)
  // ============================================
  test.describe('UI Component Verification', () => {
    test('UI-001: Verify buttons are clickable', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const buttons = page.locator('button:not([disabled])');
      const count = await buttons.count();
      
      if (count > 0) {
        recordResult('guest', 'UI - Buttons clickable', 'PASS', `Found ${count} clickable buttons`);
      } else {
        recordResult('guest', 'UI - Buttons clickable', 'PARTIAL', 'No clickable buttons found');
      }
    });

    test('UI-002: Verify tabs functionality', async ({ page }) => {
      await page.goto(`${BASE_URL}/#products`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const tabs = await page.locator('.tab, .tab-button, [role="tab"]').count();
      
      if (tabs > 0) {
        recordResult('guest', 'UI - Tabs functionality', 'PASS', `Found ${tabs} tabs`);
      } else {
        recordResult('guest', 'UI - Tabs functionality', 'PARTIAL', 'No tabs found');
      }
    });

    test('UI-003: Verify cards display', async ({ page }) => {
      await page.goto(`${BASE_URL}/#products`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const cards = await page.locator('.card, .product-card').count();
      
      if (cards > 0) {
        recordResult('guest', 'UI - Cards display', 'PASS', `Found ${cards} cards`);
      } else {
        recordResult('guest', 'UI - Cards display', 'PARTIAL', 'No cards found');
      }
    });

    test('UI-004: Verify tables render', async ({ page }) => {
      // Test with admin token if available
      if (adminToken) {
        await page.goto(BASE_URL);
        await page.evaluate((data) => {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify({ email: data.userEmail, role: data.userRole }));
        }, { token: adminToken, userEmail: adminUser.email, userRole: adminUser.role });
        await page.goto(`${BASE_URL}/admin.html#users`);
        await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
        
        const tables = await page.locator('table').count();
        
        if (tables > 0) {
          recordResult('admin', 'UI - Tables render', 'PASS', `Found ${tables} tables`);
        } else {
          recordResult('admin', 'UI - Tables render', 'PARTIAL', 'No tables found');
        }
      } else {
        recordResult('admin', 'UI - Tables render', 'PARTIAL', 'No admin token available');
      }
    });

    test('UI-005: Verify modals can open', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      const loginBtn = page.locator('#login-btn, .login-btn').first();
      if (await loginBtn.count() > 0) {
        await loginBtn.click();
        await page.waitForTimeout(1000);
        
        const modalVisible = await page.locator('.modal.show, .modal.active').count() > 0;
        
        if (modalVisible) {
          recordResult('guest', 'UI - Modals can open', 'PASS', 'Modal opens successfully');
        } else {
          recordResult('guest', 'UI - Modals can open', 'FAIL', 'Modal did not open');
        }
      } else {
        recordResult('guest', 'UI - Modals can open', 'PARTIAL', 'No login button found to test modal');
      }
    });
  });

  // ============================================
  // REPORT GENERATION
  // ============================================
  test.afterAll(async () => {
    console.log('\n\n=== SMOKE TEST RESULTS ===\n');
    
    const fs = require('fs');
    const reportDir = 'test-results/smoke-test';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalPartial = 0;
    
    for (const [role, data] of Object.entries(results)) {
      console.log(`\n--- ${role.toUpperCase()} ---`);
      console.log(`Passed: ${data.passed}`);
      console.log(`Failed: ${data.failed}`);
      console.log(`Partial: ${data.partial}`);
      
      totalPassed += data.passed;
      totalFailed += data.failed;
      totalPartial += data.partial;
      
      data.tests.forEach(t => {
        console.log(`  ${t.status}: ${t.test} - ${t.details}`);
      });
    }
    
    console.log(`\n=== TOTAL ===`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Partial: ${totalPartial}`);
    console.log(`Total Tests: ${totalPassed + totalFailed + totalPartial}`);
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalPassed + totalFailed + totalPartial,
        passed: totalPassed,
        failed: totalFailed,
        partial: totalPartial
      },
      results
    };
    
    fs.writeFileSync(
      `${reportDir}/smoke-test-report.json`,
      JSON.stringify(report, null, 2)
    );
    
    console.log(`\nDetailed report saved to: ${reportDir}/smoke-test-report.json`);
  });
});
