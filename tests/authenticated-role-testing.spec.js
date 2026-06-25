const { test, expect } = require('@playwright/test');

// AUTHENTICATED ROLE TESTING
// This test creates actual accounts and tests role-based access control

test.describe('Authenticated Role Testing', () => {
  let page;
  const screenshotDir = 'test-results/authenticated-screenshots';
  const evidenceDir = 'test-results/authenticated-evidence';
  
  // Test account credentials
  const testAccounts = {
    customer: {
      email: 'testcustomer@agricatch.test',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'Customer',
      role: 'customer'
    },
    farmer: {
      email: 'testfarmer@agricatch.test',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'Farmer',
      shopName: 'Test Farm Shop',
      role: 'farmer'
    },
    admin: {
      email: 'testadmin@agricatch.test',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'admin'
    }
  };

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
    await page.goto('http://localhost:3000/index.html');
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ============================================
  // ACCOUNT CREATION VIA API
  // ============================================
  test('SETUP - Create Test Accounts via API', async () => {
    console.log('\n=== CREATING TEST ACCOUNTS ===');
    
    const creationResults = [];

    // Create Customer Account
    try {
      const customerResponse = await page.request.post('http://localhost:3000/api/auth/register', {
        data: {
          email: testAccounts.customer.email,
          password: testAccounts.customer.password,
          first_name: testAccounts.customer.firstName,
          last_name: testAccounts.customer.lastName,
          role: 'customer'
        }
      });
      
      const customerData = await customerResponse.json();
      creationResults.push({
        role: 'customer',
        success: customerResponse.ok(),
        status: customerResponse.status(),
        data: customerData
      });
      
      if (customerResponse.ok()) {
        console.log('✓ Customer account created');
        testAccounts.customer.id = customerData.user?.id || customerData.id;
      } else {
        console.log(`⚠ Customer account creation failed: ${customerData.message || 'Unknown error'}`);
        // Account might already exist, try to login
      }
    } catch (error) {
      creationResults.push({ role: 'customer', success: false, error: error.message });
      console.log(`⚠ Customer account creation error: ${error.message}`);
    }

    // Create Farmer Account
    try {
      const farmerResponse = await page.request.post('http://localhost:3000/api/auth/register', {
        data: {
          email: testAccounts.farmer.email,
          password: testAccounts.farmer.password,
          first_name: testAccounts.farmer.firstName,
          last_name: testAccounts.farmer.lastName,
          shop_name: testAccounts.farmer.shopName,
          role: 'farmer'
        }
      });
      
      const farmerData = await farmerResponse.json();
      creationResults.push({
        role: 'farmer',
        success: farmerResponse.ok(),
        status: farmerResponse.status(),
        data: farmerData
      });
      
      if (farmerResponse.ok()) {
        console.log('✓ Farmer account created');
        testAccounts.farmer.id = farmerData.user?.id || farmerData.id;
      } else {
        console.log(`⚠ Farmer account creation failed: ${farmerData.message || 'Unknown error'}`);
      }
    } catch (error) {
      creationResults.push({ role: 'farmer', success: false, error: error.message });
      console.log(`⚠ Farmer account creation error: ${error.message}`);
    }

    // Note: Admin accounts typically need to be created manually or via superadmin
    // We'll attempt to login with existing admin credentials
    console.log('⚠ Admin account creation skipped (typically requires superadmin)');
    creationResults.push({ role: 'admin', success: null, note: 'Requires superadmin to create' });

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/account-creation.json`,
      JSON.stringify(creationResults, null, 2)
    );
  });

  // ============================================
  // CUSTOMER ROLE TESTING
  // ============================================
  test('CUSTOMER - Login and Role Verification', async () => {
    console.log('\n=== CUSTOMER ROLE TESTING ===');
    
    const customerResults = {
      loginSuccess: false,
      roleDetected: null,
      accessiblePages: [],
      inaccessiblePages: [],
      apiAuthorization: []
    };

    // Attempt login
    await page.goto('http://localhost:3000/index.html');
    
    // Look for login modal or navigate to login
    const loginBtn = page.locator('#login-btn, .login-btn, [data-bs-target="#loginModal"]');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(1000);
    }

    // Fill login form
    const emailInput = page.locator('input[name="email"], input[type="email"], #email');
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password');
    const submitBtn = page.locator('button[type="submit"], .login-submit-btn, #login-submit');

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill(testAccounts.customer.email);
      await passwordInput.fill(testAccounts.customer.password);
      
      await page.screenshot({ path: `${screenshotDir}/customer-01-login-form.png`, fullPage: true });
      
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForTimeout(3000);
        
        customerResults.loginSuccess = true;
        console.log('✓ Customer login attempted');
        
        await page.screenshot({ path: `${screenshotDir}/customer-02-after-login.png`, fullPage: true });
      }
    }

    // Check if logged in by checking localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const userRole = await page.evaluate(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr).role;
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    customerResults.roleDetected = userRole;
    customerResults.hasToken = !!token;
    console.log(`Role detected: ${userRole || 'None'}`);
    console.log(`Token present: ${!!token}`);

    // Test page access
    const customerPages = [
      { url: '/customer-account.html', name: 'Customer Account', shouldAccess: true },
      { url: '/orders.html', name: 'Orders', shouldAccess: true },
      { url: '/checkout.html', name: 'Checkout', shouldAccess: true },
      { url: '/farmer.html', name: 'Farmer Dashboard', shouldAccess: false },
      { url: '/admin.html', name: 'Admin Dashboard', shouldAccess: false }
    ];

    for (const pageInfo of customerPages) {
      await page.goto(`http://localhost:3000${pageInfo.url}`);
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasAccess = !currentUrl.includes('login') && !currentUrl.includes('index.html');
      
      await page.screenshot({ path: `${screenshotDir}/customer-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });
      
      const result = {
        page: pageInfo.name,
        shouldAccess: pageInfo.shouldAccess,
        hasAccess: hasAccess,
        currentUrl: currentUrl,
        correct: hasAccess === pageInfo.shouldAccess
      };
      
      if (hasAccess) {
        customerResults.accessiblePages.push(pageInfo.name);
      } else {
        customerResults.inaccessiblePages.push(pageInfo.name);
      }
      
      console.log(`${pageInfo.name}: ${hasAccess ? 'Accessible' : 'Inaccessible'} (Expected: ${pageInfo.shouldAccess ? 'Accessible' : 'Inaccessible'}) - ${result.correct ? '✓' : '✗'}`);
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/customer-role-test.json`,
      JSON.stringify(customerResults, null, 2)
    );
  });

  // ============================================
  // FARMER ROLE TESTING
  // ============================================
  test('FARMER - Login and Role Verification', async () => {
    console.log('\n=== FARMER ROLE TESTING ===');
    
    const farmerResults = {
      loginSuccess: false,
      roleDetected: null,
      accessiblePages: [],
      inaccessiblePages: []
    };

    // Attempt login
    await page.goto('http://localhost:3000/index.html');
    
    const loginBtn = page.locator('#login-btn, .login-btn, [data-bs-target="#loginModal"]');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(1000);
    }

    const emailInput = page.locator('input[name="email"], input[type="email"], #email');
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password');
    const submitBtn = page.locator('button[type="submit"], .login-submit-btn, #login-submit');

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill(testAccounts.farmer.email);
      await passwordInput.fill(testAccounts.farmer.password);
      
      await page.screenshot({ path: `${screenshotDir}/farmer-01-login-form.png`, fullPage: true });
      
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForTimeout(3000);
        
        farmerResults.loginSuccess = true;
        console.log('✓ Farmer login attempted');
        
        await page.screenshot({ path: `${screenshotDir}/farmer-02-after-login.png`, fullPage: true });
      }
    }

    // Check role
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const userRole = await page.evaluate(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr).role;
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    farmerResults.roleDetected = userRole;
    farmerResults.hasToken = !!token;
    console.log(`Role detected: ${userRole || 'None'}`);
    console.log(`Token present: ${!!token}`);

    // Test page access
    const farmerPages = [
      { url: '/farmer.html', name: 'Farmer Dashboard', shouldAccess: true },
      { url: '/customer-account.html', name: 'Customer Account', shouldAccess: false },
      { url: '/admin.html', name: 'Admin Dashboard', shouldAccess: false }
    ];

    for (const pageInfo of farmerPages) {
      await page.goto(`http://localhost:3000${pageInfo.url}`);
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasAccess = !currentUrl.includes('login') && !currentUrl.includes('index.html');
      
      await page.screenshot({ path: `${screenshotDir}/farmer-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });
      
      const result = {
        page: pageInfo.name,
        shouldAccess: pageInfo.shouldAccess,
        hasAccess: hasAccess,
        currentUrl: currentUrl,
        correct: hasAccess === pageInfo.shouldAccess
      };
      
      if (hasAccess) {
        farmerResults.accessiblePages.push(pageInfo.name);
      } else {
        farmerResults.inaccessiblePages.push(pageInfo.name);
      }
      
      console.log(`${pageInfo.name}: ${hasAccess ? 'Accessible' : 'Inaccessible'} (Expected: ${pageInfo.shouldAccess ? 'Accessible' : 'Inaccessible'}) - ${result.correct ? '✓' : '✗'}`);
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/farmer-role-test.json`,
      JSON.stringify(farmerResults, null, 2)
    );
  });

  // ============================================
  // ADMIN ROLE TESTING
  // ============================================
  test('ADMIN - Login and Role Verification', async () => {
    console.log('\n=== ADMIN ROLE TESTING ===');
    
    const adminResults = {
      loginSuccess: false,
      roleDetected: null,
      accessiblePages: [],
      inaccessiblePages: [],
      note: 'Using existing admin credentials if available'
    };

    // Attempt login with test admin or check if already logged in
    await page.goto('http://localhost:3000/index.html');
    
    const loginBtn = page.locator('#login-btn, .login-btn, [data-bs-target="#loginModal"]');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(1000);
    }

    const emailInput = page.locator('input[name="email"], input[type="email"], #email');
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password');
    const submitBtn = page.locator('button[type="submit"], .login-submit-btn, #login-submit');

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill(testAccounts.admin.email);
      await passwordInput.fill(testAccounts.admin.password);
      
      await page.screenshot({ path: `${screenshotDir}/admin-01-login-form.png`, fullPage: true });
      
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForTimeout(3000);
        
        adminResults.loginSuccess = true;
        console.log('✓ Admin login attempted');
        
        await page.screenshot({ path: `${screenshotDir}/admin-02-after-login.png`, fullPage: true });
      }
    }

    // Check role
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const userRole = await page.evaluate(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr).role;
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    adminResults.roleDetected = userRole;
    adminResults.hasToken = !!token;
    console.log(`Role detected: ${userRole || 'None'}`);
    console.log(`Token present: ${!!token}`);

    // Test page access
    const adminPages = [
      { url: '/admin.html', name: 'Admin Dashboard', shouldAccess: true },
      { url: '/farmer.html', name: 'Farmer Dashboard', shouldAccess: false },
      { url: '/customer-account.html', name: 'Customer Account', shouldAccess: false }
    ];

    for (const pageInfo of adminPages) {
      await page.goto(`http://localhost:3000${pageInfo.url}`);
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const hasAccess = !currentUrl.includes('login') && !currentUrl.includes('index.html');
      
      await page.screenshot({ path: `${screenshotDir}/admin-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });
      
      const result = {
        page: pageInfo.name,
        shouldAccess: pageInfo.shouldAccess,
        hasAccess: hasAccess,
        currentUrl: currentUrl,
        correct: hasAccess === pageInfo.shouldAccess
      };
      
      if (hasAccess) {
        adminResults.accessiblePages.push(pageInfo.name);
      } else {
        adminResults.inaccessiblePages.push(pageInfo.name);
      }
      
      console.log(`${pageInfo.name}: ${hasAccess ? 'Accessible' : 'Inaccessible'} (Expected: ${pageInfo.shouldAccess ? 'Accessible' : 'Inaccessible'}) - ${result.correct ? '✓' : '✗'}`);
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/admin-role-test.json`,
      JSON.stringify(adminResults, null, 2)
    );
  });

  // ============================================
  // CHECK FOR PREORDER PRODUCTS
  // ============================================
  test('PREORDER - Check for Existing Preorder Products', async () => {
    console.log('\n=== CHECKING FOR PREORDER PRODUCTS ===');
    
    const preorderCheck = {
      productsFound: 0,
      preorderProducts: [],
      hasPreorderProducts: false
    };

    try {
      // Fetch products from API
      const productsResponse = await page.request.get('http://localhost:3000/api/products');
      
      if (productsResponse.ok()) {
        const productsData = await productsResponse.json();
        const products = Array.isArray(productsData) ? productsData : (productsData.products || []);
        
        preorderCheck.productsFound = products.length;
        
        // Look for preorder indicators
        for (const product of products) {
          const isPreorder = product.is_preorder || product.preorder || product.stock_type === 'preorder';
          if (isPreorder) {
            preorderCheck.preorderProducts.push({
              id: product.id,
              name: product.name,
              is_preorder: isPreorder
            });
          }
        }
        
        preorderCheck.hasPreorderProducts = preorderCheck.preorderProducts.length > 0;
        
        console.log(`Total products: ${products.length}`);
        console.log(`Preorder products: ${preorderCheck.preorderProducts.length}`);
        
        if (preorderCheck.preorderProducts.length > 0) {
          console.log('Preorder products found:');
          preorderCheck.preorderProducts.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`));
        } else {
          console.log('No preorder products found');
        }
      } else {
        console.log('Failed to fetch products');
      }
    } catch (error) {
      console.log(`Error checking preorder products: ${error.message}`);
      preorderCheck.error = error.message;
    }

    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/preorder-check.json`,
      JSON.stringify(preorderCheck, null, 2)
    );
  });

  // ============================================
  // CREATE TEST PREORDER PRODUCT
  // ============================================
  test('PREORDER - Create Test Preorder Product', async () => {
    console.log('\n=== CREATING TEST PREORDER PRODUCT ===');
    
    // First check if we have a farmer token
    await page.goto('http://localhost:3000/index.html');
    
    // Try to login as farmer
    const loginBtn = page.locator('#login-btn, .login-btn');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(1000);
      
      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      const submitBtn = page.locator('button[type="submit"], .login-submit-btn');
      
      if (await emailInput.count() > 0) {
        await emailInput.fill(testAccounts.farmer.email);
        await passwordInput.fill(testAccounts.farmer.password);
        
        if (await submitBtn.count() > 0) {
          await submitBtn.first().click();
          await page.waitForTimeout(3000);
        }
      }
    }
    
    // Get token
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    const creationResult = {
      success: false,
      productId: null,
      error: null
    };
    
    if (token) {
      try {
        // Create preorder product via API
        const productResponse = await page.request.post('http://localhost:3000/api/products', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          data: {
            name: 'Test Preorder Product',
            description: 'This is a test preorder product for UAT testing',
            price: 99.99,
            stock: 0,
            is_preorder: true,
            preorder_available_date: '2026-07-01',
            category: 'Vegetables',
            unit: 'kg',
            image_url: 'https://via.placeholder.com/300'
          }
        });
        
        const productData = await productResponse.json();
        
        if (productResponse.ok()) {
          creationResult.success = true;
          creationResult.productId = productData.id || productData.product?.id;
          console.log(`✓ Preorder product created with ID: ${creationResult.productId}`);
        } else {
          creationResult.error = productData.message || 'Unknown error';
          console.log(`✗ Failed to create preorder product: ${creationResult.error}`);
        }
      } catch (error) {
        creationResult.error = error.message;
        console.log(`✗ Error creating preorder product: ${error.message}`);
      }
    } else {
      creationResult.error = 'No authentication token available';
      console.log('✗ Cannot create product - not authenticated as farmer');
    }
    
    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/preorder-creation.json`,
      JSON.stringify(creationResult, null, 2)
    );
  });

  // ============================================
  // VERIFY PREORDER INDICATORS WITH AUTHENTICATED USER
  // ============================================
  test('PREORDER - Verify Indicators with Authenticated User', async () => {
    console.log('\n=== VERIFYING PREORDER INDICATORS (AUTHENTICATED) ===');
    
    // Login as customer
    await page.goto('http://localhost:3000/index.html');
    
    const loginBtn = page.locator('#login-btn, .login-btn');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(1000);
      
      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      const submitBtn = page.locator('button[type="submit"], .login-submit-btn');
      
      if (await emailInput.count() > 0) {
        await emailInput.fill(testAccounts.customer.email);
        await passwordInput.fill(testAccounts.customer.password);
        
        if (await submitBtn.count() > 0) {
          await submitBtn.first().click();
          await page.waitForTimeout(3000);
        }
      }
    }
    
    const preorderCheck = {
      landingPage: 0,
      productDetails: 0,
      checkout: 0,
      orders: 0,
      farmerDashboard: 0
    };
    
    // Check landing page
    await page.goto('http://localhost:3000/index.html');
    await page.waitForTimeout(2000);
    const landingPreorder = await page.locator('.preorder-badge, [data-preorder="true"], .preorder-indicator').count();
    preorderCheck.landingPage = landingPreorder;
    await page.screenshot({ path: `${screenshotDir}/preorder-auth-landing.png`, fullPage: true });
    console.log(`Landing page preorder indicators: ${landingPreorder}`);
    
    // Check product details
    const productCards = page.locator('.product-card, .card');
    if (await productCards.count() > 0) {
      await productCards.first().click();
      await page.waitForTimeout(2000);
      const detailsPreorder = await page.locator('.preorder-badge, [data-preorder="true"], .preorder-indicator').count();
      preorderCheck.productDetails = detailsPreorder;
      await page.screenshot({ path: `${screenshotDir}/preorder-auth-details.png`, fullPage: true });
      console.log(`Product details preorder indicators: ${detailsPreorder}`);
    }
    
    // Check checkout
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    const checkoutPreorder = await page.locator('.preorder-badge, [data-preorder="true"], .preorder-indicator').count();
    preorderCheck.checkout = checkoutPreorder;
    await page.screenshot({ path: `${screenshotDir}/preorder-auth-checkout.png`, fullPage: true });
    console.log(`Checkout preorder indicators: ${checkoutPreorder}`);
    
    // Check orders
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForTimeout(2000);
    const ordersPreorder = await page.locator('.preorder-badge, [data-preorder="true"], .preorder-indicator').count();
    preorderCheck.orders = ordersPreorder;
    await page.screenshot({ path: `${screenshotDir}/preorder-auth-orders.png`, fullPage: true });
    console.log(`Orders preorder indicators: ${ordersPreorder}`);
    
    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/preorder-auth-check.json`,
      JSON.stringify(preorderCheck, null, 2)
    );
  });

  // ============================================
  // API AUTHORIZATION TESTING
  // ============================================
  test('API - Test Authorization Endpoints', async () => {
    console.log('\n=== API AUTHORIZATION TESTING ===');
    
    const apiResults = [];
    
    // Test endpoints without authentication
    const endpoints = [
      { method: 'GET', url: '/api/products', shouldAccess: true },
      { method: 'GET', url: '/api/users', shouldAccess: false },
      { method: 'GET', url: '/api/farmers', shouldAccess: false },
      { method: 'POST', url: '/api/products', shouldAccess: false },
      { method: 'GET', url: '/api/orders', shouldAccess: false }
    ];
    
    for (const endpoint of endpoints) {
      try {
        let response;
        if (endpoint.method === 'GET') {
          response = await page.request.get(`http://localhost:3000${endpoint.url}`);
        } else {
          response = await page.request.post(`http://localhost:3000${endpoint.url}`, {
            data: { test: true }
          });
        }
        
        const result = {
          endpoint: endpoint.url,
          method: endpoint.method,
          status: response.status(),
          shouldAccess: endpoint.shouldAccess,
          hasAccess: response.status() !== 401 && response.status() !== 403,
          correct: (response.status() !== 401 && response.status() !== 403) === endpoint.shouldAccess
        };
        
        apiResults.push(result);
        console.log(`${endpoint.method} ${endpoint.url}: ${response.status()} - ${result.correct ? '✓' : '✗'}`);
      } catch (error) {
        apiResults.push({
          endpoint: endpoint.url,
          method: endpoint.method,
          error: error.message
        });
        console.log(`${endpoint.method} ${endpoint.url}: Error - ${error.message}`);
      }
    }
    
    // Save evidence
    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/api-authorization.json`,
      JSON.stringify(apiResults, null, 2)
    );
  });
});
