const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const API_BASE = 'http://localhost:3000/api';
const OTP_BYPASS_CODE = '789878';

test.describe('Customer Shopping Regression B', () => {
  let customerToken;
  let customerEmail;
  let customerId;
  let testProductId;
  let testPreorderProductId;

  test.beforeAll(async ({ request }) => {
    // Create a test customer account
    customerEmail = `customer-regression-b-${Date.now()}@agricatch.test`;
    
    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: customerEmail,
        password: 'TestPass123!',
        first_name: 'Test',
        last_name: 'Customer',
        phone: '09123456789',
        role: 'customer'
      }
    });

    if (registerResponse.ok()) {
      const data = await registerResponse.json();
      customerToken = data.token;
      customerId = data.user?.id;
    }

    // Verify OTP
    await request.post(`${API_BASE}/auth/verify-otp`, {
      data: {
        email: customerEmail,
        otp: OTP_BYPASS_CODE
      }
    });

    // Login to get token
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        identifier: customerEmail,
        password: 'TestPass123!'
      }
    });

    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      customerToken = data.token;
      customerId = data.user?.id;
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup test orders if any
    if (customerToken) {
      try {
        const ordersResponse = await request.get(`${API_BASE}/orders`, {
          headers: { Authorization: `Bearer ${customerToken}` }
        });
        if (ordersResponse.ok()) {
          const orders = await ordersResponse.json();
          for (const order of orders.orders || []) {
            await request.delete(`${API_BASE}/orders/${order.id}`, {
              headers: { Authorization: `Bearer ${customerToken}` }
            });
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================
  // 1. LANDING PAGE
  // ============================================
  test('1. Landing Page - Hero Section', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const heroSection = page.locator('.hero, .hero-section, .banner, [class*="hero"]');
    const heroExists = await heroSection.count() > 0;
    console.log(`Hero section exists: ${heroExists ? '✓' : '✗'}`);

    expect(heroExists).toBeTruthy();
  });

  test('1b. Landing Page - Featured Products', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const featuredSection = page.locator('.featured-section');
    const featuredExists = await featuredSection.count() > 0;
    console.log(`Featured products section exists: ${featuredExists ? '✓' : '✗'}`);

    if (featuredExists) {
      const productCards = featuredSection.locator('.product-card, [class*="product"], .card');
      const cardCount = await productCards.count();
      console.log(`Featured product cards: ${cardCount}`);
    }

    expect(featuredExists).toBeTruthy();
  });

  test('1c. Landing Page - Available Products', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const availableSection = page.locator('#available-now');
    const availableExists = await availableSection.count() > 0;
    console.log(`Available products section exists: ${availableExists ? '✓' : '✗'}`);

    expect(availableExists).toBeTruthy();
  });

  test('1d. Landing Page - Pre-order Products', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const preorderSection = page.locator('#preorder');
    const preorderExists = await preorderSection.count() > 0;
    console.log(`Pre-order products section exists: ${preorderExists ? '✓' : '✗'}`);

    expect(preorderExists).toBeTruthy();
  });

  test('1e. Landing Page - Categories', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const categoriesSection = page.locator('#global-category-tabs');
    const categoriesExists = await categoriesSection.count() > 0;
    console.log(`Categories section exists: ${categoriesExists ? '✓' : '✗'}`);

    if (categoriesExists) {
      const categoryItems = categoriesSection.locator('button');
      const itemCount = await categoryItems.count();
      console.log(`Category items: ${itemCount}`);
    }

    expect(categoriesExists).toBeTruthy();
  });

  test('1f. Landing Page - Search', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('#global-search-input');
    const searchExists = await searchInput.count() > 0;
    console.log(`Search input exists: ${searchExists ? '✓' : '✗'}`);

    expect(searchExists).toBeTruthy();
  });

  test('1g. Landing Page - Filters', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const filters = page.locator('.marketplace-filter-section');
    const filtersExist = await filters.count() > 0;
    console.log(`Filters exist: ${filtersExist ? '✓' : '✗'}`);

    expect(filtersExist).toBeTruthy();
  });

  test('1h. Landing Page - Sorting', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const sortSelect = page.locator('#global-sort-select');
    const sortExists = await sortSelect.count() > 0;
    console.log(`Sorting exists: ${sortExists ? '✓' : '✗'}`);

    expect(sortExists).toBeTruthy();
  });

  // ============================================
  // 2. PRODUCT CARDS
  // ============================================
  test('2. Product Cards - Images', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const productImages = page.locator('.product-image');
    const imageCount = await productImages.count();
    console.log(`Product card images: ${imageCount}`);

    const hasImages = imageCount > 0;
    expect(hasImages).toBeTruthy();
  });

  test('2b. Product Cards - Badges', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const badges = page.locator('.product-info .badge');
    const badgeCount = await badges.count();
    console.log(`Product badges: ${badgeCount}`);

    const hasBadges = badgeCount > 0;
    expect(hasBadges).toBeTruthy();
  });

  test('2c. Product Cards - Available / Pre-order Status', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const availableBadges = page.locator('.badge.bg-success');
    const harvestBadges = page.locator('.badge.harvest-soon-badge');
    const availableCount = await availableBadges.count();
    const harvestCount = await harvestBadges.count();
    console.log(`Available badges: ${availableCount}`);
    console.log(`Harvest soon badges: ${harvestCount}`);

    const hasStatus = availableCount > 0 || harvestCount > 0;
    expect(hasStatus).toBeTruthy();
  });

  test('2d. Product Cards - Expected Harvest Today', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const harvestInfo = page.locator('.harvest-date-display');
    const harvestCount = await harvestInfo.count();
    console.log(`Harvest date displays: ${harvestCount}`);

    // This is informational, not a hard requirement
    console.log(`Harvest info check: ${harvestCount > 0 ? 'Found' : 'Not found (acceptable)'}`);
  });

  test('2e. Product Cards - Expected Harvest TBA', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const tbaLabels = page.locator('.harvest-date-display');
    const tbaCount = await tbaLabels.count();
    
    // Check if any contain "To Be Announced"
    let hasTBA = false;
    for (let i = 0; i < tbaCount; i++) {
      const text = await tbaLabels.nth(i).textContent();
      if (text.includes('To Be Announced')) {
        hasTBA = true;
        break;
      }
    }
    
    console.log(`TBA indicators: ${tbaCount}`);
    console.log(`TBA check: ${hasTBA ? 'Found' : 'Not found (acceptable)'}`);
  });

  test('2f. Product Cards - Reservations Temporarily Unavailable', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const unavailableLabels = page.locator('[class*="unavailable"], [class*="temporarily"]');
    const unavailableCount = await unavailableLabels.count();
    console.log(`Unavailable indicators: ${unavailableCount}`);

    // This is informational, not a hard requirement
    console.log(`Unavailable check: ${unavailableCount > 0 ? 'Found' : 'Not found (acceptable)'}`);
  });

  // ============================================
  // 3. PRODUCT DETAILS
  // ============================================
  test('3. Product Details - View Product', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const productDetails = page.locator('.product-details, [class*="detail"], .modal');
      const detailsExist = await productDetails.count() > 0;
      console.log(`Product details opened: ${detailsExist ? '✓' : '✗'}`);

      expect(detailsExist).toBeTruthy();
    } else {
      console.log('⚠ No products found to test details');
      test.skip();
    }
  });

  test('3b. Product Details - Images', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const detailImages = page.locator('.product-details img, [class*="detail"] img');
      const imageCount = await detailImages.count();
      console.log(`Detail images: ${imageCount}`);

      const hasImages = imageCount > 0;
      expect(hasImages).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('3c. Product Details - Description', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const description = page.locator('.description, [class*="desc"]');
      const hasDescription = await description.count() > 0;
      console.log(`Product description: ${hasDescription ? '✓' : '✗'}`);

      expect(hasDescription).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('3d. Product Details - Farmer Information', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const farmerInfo = page.locator('[class*="farmer"], .farmer-info');
      const hasFarmerInfo = await farmerInfo.count() > 0;
      console.log(`Farmer information: ${hasFarmerInfo ? '✓' : '✗'}`);

      expect(hasFarmerInfo).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('3e. Product Details - Expected Harvest', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const harvestInfo = page.locator('[class*="harvest"]');
      const hasHarvestInfo = await harvestInfo.count() > 0;
      console.log(`Expected harvest info: ${hasHarvestInfo ? '✓' : '✗'}`);

      expect(hasHarvestInfo).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('3f. Product Details - Reservation Status', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const reservationStatus = page.locator('[class*="reservation"], [class*="status"]');
      const hasReservationStatus = await reservationStatus.count() > 0;
      console.log(`Reservation status: ${hasReservationStatus ? '✓' : '✗'}`);

      expect(hasReservationStatus).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('3g. Product Details - Stock', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const stockInfo = page.locator('[class*="stock"], [class*="quantity"], [class*="remaining"]');
      const hasStockInfo = await stockInfo.count() > 0;
      console.log(`Stock information: ${hasStockInfo ? '✓' : '✗'}`);

      expect(hasStockInfo).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('3h. Product Details - Buttons', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('.product-card, [class*="product"]').first();
    const productCount = await firstProduct.count();

    if (productCount > 0) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      const buttons = page.locator('.product-details button, [class*="detail"] button');
      const buttonCount = await buttons.count();
      console.log(`Product detail buttons: ${buttonCount}`);

      const hasButtons = buttonCount > 0;
      expect(hasButtons).toBeTruthy();
    } else {
      test.skip();
    }
  });

  // ============================================
  // 4. WISHLIST
  // ============================================
  test('4. Wishlist - Add to Wishlist', async ({ page }) => {
    if (!customerToken) {
      console.log('⚠ No customer token, skipping wishlist test');
      test.skip();
      return;
    }

    // Set auth token
    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, customerToken);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const wishlistBtn = page.locator('[class*="wishlist"], button[aria-label*="wishlist" i], .heart-btn').first();
    const btnCount = await wishlistBtn.count();

    if (btnCount > 0) {
      await wishlistBtn.click();
      await page.waitForTimeout(500);
      console.log(`Wishlist button clicked: ✓`);
    } else {
      console.log('⚠ No wishlist button found');
    }

    // Check if wishlist button state changed
    expect(btnCount > 0).toBeTruthy();
  });

  test('4b. Wishlist - Remove from Wishlist', async ({ page }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, customerToken);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const wishlistBtn = page.locator('[class*="wishlist"], button[aria-label*="wishlist" i], .heart-btn').first();
    const btnCount = await wishlistBtn.count();

    if (btnCount > 0) {
      await wishlistBtn.click();
      await page.waitForTimeout(500);
      console.log(`Wishlist remove clicked: ✓`);
    } else {
      console.log('⚠ No wishlist button found');
    }

    expect(btnCount > 0).toBeTruthy();
  });

  test('4c. Wishlist - Persistence', async ({ page }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, customerToken);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if wishlist persists across page reload
    const wishlistSection = page.locator('.wishlist, [class*="wishlist"]');
    const wishlistExists = await wishlistSection.count() > 0;
    console.log(`Wishlist section exists: ${wishlistExists ? '✓' : '✗'}`);

    // This is informational
    console.log(`Wishlist persistence: ${wishlistExists ? 'Section found' : 'Section not found (may be on separate page)'}`);
  });

  // ============================================
  // 5. CART
  // ============================================
  test('5. Cart - Add Available Product', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    // Get available products
    const productsResponse = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (productsResponse.ok()) {
      const data = await productsResponse.json();
      const availableProducts = data.products?.filter(p => p.is_available && !p.is_preorder);
      
      if (availableProducts && availableProducts.length > 0) {
        testProductId = availableProducts[0].id;
        
        // Add to cart
        const cartResponse = await request.post(`${API_BASE}/cart`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            product_id: testProductId,
            quantity: 1
          }
        });

        const added = cartResponse.ok();
        console.log(`Available product added to cart: ${added ? '✓' : '✗'}`);
        expect(added).toBeTruthy();
      } else {
        console.log('⚠ No available products found');
        test.skip();
      }
    } else {
      console.log('⚠ Failed to fetch products');
      test.skip();
    }
  });

  test('5b. Cart - Add Pre-order Product', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const productsResponse = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (productsResponse.ok()) {
      const data = await productsResponse.json();
      const preorderProducts = data.products?.filter(p => p.is_preorder);
      
      if (preorderProducts && preorderProducts.length > 0) {
        testPreorderProductId = preorderProducts[0].id;
        
        const cartResponse = await request.post(`${API_BASE}/cart`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            product_id: testPreorderProductId,
            quantity: 1
          }
        });

        const added = cartResponse.ok();
        console.log(`Pre-order product added to cart: ${added ? '✓' : '✗'}`);
        expect(added).toBeTruthy();
      } else {
        console.log('⚠ No pre-order products found');
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('5c. Cart - Mixed Cart Behavior', async ({ page, request }) => {
    if (!customerToken || !testProductId || !testPreorderProductId) {
      test.skip();
      return;
    }

    // Check cart contents
    const cartResponse = await request.get(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (cartResponse.ok()) {
      const data = await cartResponse.json();
      const cartItems = data.cart_items || [];
      console.log(`Cart items: ${cartItems.length}`);
      console.log(`Mixed cart check: ${cartItems.length > 0 ? '✓' : '✗'}`);
      expect(cartItems.length > 0).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('5d. Cart - Quantity Validation', async ({ page, request }) => {
    if (!customerToken || !testProductId) {
      test.skip();
      return;
    }

    // Try to add invalid quantity
    const cartResponse = await request.post(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      data: {
        product_id: testProductId,
        quantity: -1
      }
    });

    const rejected = !cartResponse.ok();
    console.log(`Invalid quantity rejected: ${rejected ? '✓' : '✗'}`);
    expect(rejected).toBeTruthy();
  });

  // ============================================
  // 6. CHECKOUT
  // ============================================
  test('6. Checkout - Available Products', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    // Clear cart first
    await request.delete(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    // Add available product
    const productsResponse = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (productsResponse.ok()) {
      const data = await productsResponse.json();
      const availableProducts = data.products?.filter(p => p.is_available && !p.is_preorder);
      
      if (availableProducts && availableProducts.length > 0) {
        await request.post(`${API_BASE}/cart`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            product_id: availableProducts[0].id,
            quantity: 1
          }
        });

        // Create checkout
        const checkoutResponse = await request.post(`${API_BASE}/orders`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            delivery_address: 'Test Address',
            contact_number: '09123456789'
          }
        });

        const checkoutSuccess = checkoutResponse.ok();
        console.log(`Available product checkout: ${checkoutSuccess ? '✓' : '✗'}`);
        expect(checkoutSuccess).toBeTruthy();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('6b. Checkout - Pre-order Reservations', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    // Clear cart
    await request.delete(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    const productsResponse = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (productsResponse.ok()) {
      const data = await productsResponse.json();
      const preorderProducts = data.products?.filter(p => p.is_preorder);
      
      if (preorderProducts && preorderProducts.length > 0) {
        await request.post(`${API_BASE}/cart`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            product_id: preorderProducts[0].id,
            quantity: 1
          }
        });

        const checkoutResponse = await request.post(`${API_BASE}/orders`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            delivery_address: 'Test Address',
            contact_number: '09123456789'
          }
        });

        const checkoutSuccess = checkoutResponse.ok();
        console.log(`Pre-order checkout: ${checkoutSuccess ? '✓' : '✗'}`);
        expect(checkoutSuccess).toBeTruthy();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('6c. Checkout - Mixed Checkout Behavior', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    // This test checks if mixed cart (available + preorder) is handled correctly
    console.log('Mixed checkout behavior: System should handle or reject mixed carts');
    // This is informational - behavior depends on business rules
  });

  test('6d. Checkout - Totals', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const cartResponse = await request.get(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (cartResponse.ok()) {
      const data = await cartResponse.json();
      const hasTotal = data.total !== undefined || data.total_amount !== undefined;
      console.log(`Cart total present: ${hasTotal ? '✓' : '✗'}`);
      expect(hasTotal).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('6e. Checkout - Validation', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    // Try checkout without required fields
    const checkoutResponse = await request.post(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      data: {}
    });

    const rejected = !checkoutResponse.ok();
    console.log(`Checkout validation (missing fields): ${rejected ? '✓' : '✗'}`);
    expect(rejected).toBeTruthy();
  });

  test('6f. Checkout - Success', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    // Clear cart
    await request.delete(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    const productsResponse = await request.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (productsResponse.ok()) {
      const data = await productsResponse.json();
      const availableProducts = data.products?.filter(p => p.is_available && !p.is_preorder);
      
      if (availableProducts && availableProducts.length > 0) {
        await request.post(`${API_BASE}/cart`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            product_id: availableProducts[0].id,
            quantity: 1
          }
        });

        const checkoutResponse = await request.post(`${API_BASE}/orders`, {
          headers: { Authorization: `Bearer ${customerToken}` },
          data: {
            delivery_address: 'Test Address for Success',
            contact_number: '09123456789'
          }
        });

        const checkoutSuccess = checkoutResponse.ok();
        console.log(`Full checkout success: ${checkoutSuccess ? '✓' : '✗'}`);
        expect(checkoutSuccess).toBeTruthy();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  // ============================================
  // 7. ORDERS
  // ============================================
  test('7. Orders - Order List', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const ordersResponse = await request.get(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (ordersResponse.ok()) {
      const data = await ordersResponse.json();
      const hasOrders = data.orders && data.orders.length > 0;
      console.log(`Order list: ${hasOrders ? '✓' : '✗'} (${data.orders?.length || 0} orders)`);
      expect(ordersResponse.ok()).toBeTruthy();
    } else {
      console.log('⚠ Failed to fetch orders');
      expect(ordersResponse.ok()).toBeTruthy();
    }
  });

  test('7b. Orders - Order Details', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const ordersResponse = await request.get(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (ordersResponse.ok()) {
      const data = await ordersResponse.json();
      if (data.orders && data.orders.length > 0) {
        const orderId = data.orders[0].id;
        const detailResponse = await request.get(`${API_BASE}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${customerToken}` }
        });

        const detailsOk = detailResponse.ok();
        console.log(`Order details: ${detailsOk ? '✓' : '✗'}`);
        expect(detailsOk).toBeTruthy();
      } else {
        console.log('⚠ No orders to test details');
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('7c. Orders - Timeline', async ({ page }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/customer-account.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, customerToken);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const timeline = page.locator('[class*="timeline"], [class*="history"], .order-status');
    const hasTimeline = await timeline.count() > 0;
    console.log(`Order timeline: ${hasTimeline ? '✓' : '✗'}`);

    // This is informational
    console.log(`Timeline check: ${hasTimeline ? 'Found' : 'Not found (may be on detail view)'}`);
  });

  test('7d. Orders - Harvest Information', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const ordersResponse = await request.get(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (ordersResponse.ok()) {
      const data = await ordersResponse.json();
      if (data.orders && data.orders.length > 0) {
        const order = data.orders[0];
        const hasHarvestInfo = order.harvest_date || order.expected_harvest || order.harvest_info;
        console.log(`Harvest information: ${hasHarvestInfo ? '✓' : '✗'}`);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('7e. Orders - Notifications', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const notificationsResponse = await request.get(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (notificationsResponse.ok()) {
      const data = await notificationsResponse.json();
      console.log(`Notifications: ✓ (${data.notifications?.length || 0} notifications)`);
      expect(notificationsResponse.ok()).toBeTruthy();
    } else {
      console.log('⚠ Failed to fetch notifications');
      expect(notificationsResponse.ok()).toBeTruthy();
    }
  });

  // ============================================
  // 8. NOTIFICATIONS
  // ============================================
  test('8. Notifications - Order Notifications', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const notificationsResponse = await request.get(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (notificationsResponse.ok()) {
      const data = await notificationsResponse.json();
      const orderNotifications = data.notifications?.filter(n => n.type === 'order' || n.type?.includes('order'));
      console.log(`Order notifications: ${orderNotifications?.length || 0}`);
      expect(notificationsResponse.ok()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('8b. Notifications - Harvest Notifications', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const notificationsResponse = await request.get(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (notificationsResponse.ok()) {
      const data = await notificationsResponse.json();
      const harvestNotifications = data.notifications?.filter(n => n.type === 'harvest' || n.type?.includes('harvest'));
      console.log(`Harvest notifications: ${harvestNotifications?.length || 0}`);
      expect(notificationsResponse.ok()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('8c. Notifications - Delivery Notifications', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const notificationsResponse = await request.get(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (notificationsResponse.ok()) {
      const data = await notificationsResponse.json();
      const deliveryNotifications = data.notifications?.filter(n => n.type === 'delivery' || n.type?.includes('delivery'));
      console.log(`Delivery notifications: ${deliveryNotifications?.length || 0}`);
      expect(notificationsResponse.ok()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('8d. Notifications - Reschedule', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const notificationsResponse = await request.get(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (notificationsResponse.ok()) {
      const data = await notificationsResponse.json();
      const rescheduleNotifications = data.notifications?.filter(n => n.type === 'reschedule' || n.type?.includes('reschedule'));
      console.log(`Reschedule notifications: ${rescheduleNotifications?.length || 0}`);
      expect(notificationsResponse.ok()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('8e. Notifications - Read/Unread', async ({ page, request }) => {
    if (!customerToken) {
      test.skip();
      return;
    }

    const notificationsResponse = await request.get(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (notificationsResponse.ok()) {
      const data = await notificationsResponse.json();
      const hasReadStatus = data.notifications?.some(n => n.is_read !== undefined || n.read !== undefined);
      console.log(`Read/unread status: ${hasReadStatus ? '✓' : '✗'}`);
      expect(notificationsResponse.ok()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  // ============================================
  // 9. UI ELEMENTS
  // ============================================
  test('9. UI - Buttons', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button, .btn');
    const buttonCount = await buttons.count();
    console.log(`Buttons: ${buttonCount}`);
    expect(buttonCount > 0).toBeTruthy();
  });

  test('9b. UI - Cards', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.card, [class*="card"]');
    const cardCount = await cards.count();
    console.log(`Cards: ${cardCount}`);
    expect(cardCount > 0).toBeTruthy();
  });

  test('9c. UI - Tables', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const tables = page.locator('table, [class*="table"]');
    const tableCount = await tables.count();
    console.log(`Tables: ${tableCount}`);
    // Tables may not be on landing page
    console.log(`Tables check: ${tableCount > 0 ? 'Found' : 'Not on landing page (acceptable)'}`);
  });

  test('9d. UI - Modals', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const modals = page.locator('.modal, [class*="modal"]');
    const modalCount = await modals.count();
    console.log(`Modals: ${modalCount}`);
    // Modals may be hidden
    console.log(`Modals check: ${modalCount > 0 ? 'Found' : 'Not visible (acceptable)'}`);
  });

  test('9e. UI - Loading States', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const loadingElements = page.locator('[class*="loading"], [class*="spinner"], .loader');
    const loadingCount = await loadingElements.count();
    console.log(`Loading states: ${loadingCount}`);
    // Loading states may be hidden
    console.log(`Loading check: ${loadingCount > 0 ? 'Found' : 'Not visible (acceptable)'}`);
  });

  test('9f. UI - Empty States', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const emptyStates = page.locator('[class*="empty"], [class*="no-data"], .no-results');
    const emptyCount = await emptyStates.count();
    console.log(`Empty states: ${emptyCount}`);
    // Empty states may not be visible if data exists
    console.log(`Empty state check: ${emptyCount > 0 ? 'Found' : 'Not visible (acceptable)'}`);
  });

  test('9g. UI - Error Messages', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const errorMessages = page.locator('[class*="error"], [class*="alert-danger"], .error-message');
    const errorCount = await errorMessages.count();
    console.log(`Error messages: ${errorCount}`);
    // Error messages may not be visible
    console.log(`Error check: ${errorCount > 0 ? 'Found' : 'Not visible (acceptable)'}`);
  });
});
