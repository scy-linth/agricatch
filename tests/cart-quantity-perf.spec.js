const { test, expect } = require('@playwright/test');

const mockProduct = {
  id: 1,
  name: 'Test Avocado',
  description: 'Fresh test avocado',
  price: 50,
  stock_quantity: 100,
  unit: 'kg',
  image_url: '/images/logo.png',
  farmer_name: 'Test Farmer',
  farmer_id: 1,
  province: 'Benguet',
  city: 'La Trinidad',
  average_rating: 4.5,
  total_reviews: 10,
  sold_qty: 25,
  is_available_for_checkout: true
};

function mockCartResponse(quantity) {
  return {
    cartItems: [{
      id: 123,
      product_id: 1,
      name: mockProduct.name,
      price: mockProduct.price,
      quantity: quantity,
      stock_quantity: mockProduct.stock_quantity,
      unit: mockProduct.unit,
      image_url: mockProduct.image_url,
      farmer_name: mockProduct.farmer_name,
      is_available_for_checkout: true
    }],
    summary: {
      itemCount: 1,
      subtotal: String((mockProduct.price * quantity).toFixed(2)),
      has_unavailable_items: false
    }
  };
}

test.describe('Cart quantity performance', () => {
  test('cart plus/minus should update input instantly and debounce API calls', async ({ page }) => {
    let cartPutRequests = [];

    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/products') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [mockProduct] }) });
      }
      if (pathname === '/api/products/1') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProduct) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCartResponse(1)) });
      }
      if (pathname === '/api/cart' && request.method() === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCartResponse(1)) });
      }
      if (pathname.startsWith('/api/cart/') && request.method() === 'PUT') {
        cartPutRequests.push({ time: Date.now(), body: request.postData() });
        const body = JSON.parse(request.postData() || '{}');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCartResponse(body.quantity)) });
      }
      if (pathname === '/api/settings/delivery-fee') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ delivery_fee: 35 }) });
      }
      if (pathname === '/api/test-db') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    const testUrl = process.env.TEST_URL || 'http://localhost:8888/';
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');

    // Wait for product cards to render
    await page.waitForSelector('.product-card', { timeout: 5000 });
    const productCards = await page.locator('.product-card').all();
    expect(productCards.length).toBeGreaterThan(0);

    await productCards[0].click();
    await page.waitForSelector('#product-details-modal.active', { timeout: 5000 });

    const addToCartBtn = page.locator('#product-details-add-cart');
    await expect(addToCartBtn).toBeEnabled();
    await addToCartBtn.click();

    await page.waitForTimeout(300);

    // Close product modal
    const closeModalBtn = page.locator('#close-product-details, #product-details-modal .pd-modal-close').first();
    if (await closeModalBtn.isVisible().catch(() => false)) {
      await closeModalBtn.click();
      await page.waitForTimeout(200);
    }

    // Open cart
    const cartBtn = page.locator('#cart-btn, .cart-toggle, .header-cart-btn, [data-action="open-cart"], #cart-count').first();
    await cartBtn.click();
    await page.waitForSelector('#cart-sidebar.open', { timeout: 5000 });

    const qtyInput = page.locator('.quantity-value-input').first();
    await expect(qtyInput).toBeVisible();
    expect(await qtyInput.inputValue()).toBe('1');

    cartPutRequests = [];

    // Click plus and measure how fast the input value changes
    const plusBtn = page.locator('.cart-item .quantity-btn', { hasText: '+' }).first();
    const startTime = Date.now();
    await plusBtn.click();

    await expect(async () => {
      const value = await qtyInput.inputValue();
      expect(value).toBe('2');
    }).toPass({ timeout: 100 });
    const elapsed = Date.now() - startTime;

    console.log(`Cart plus input update took: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(100);

    // Wait for debounced API call
    await page.waitForTimeout(600);
    expect(cartPutRequests.length).toBe(1);

    // Verify consecutive clicks actually keep incrementing (not stuck at 2)
    await plusBtn.click();
    await expect(async () => {
      const value = await qtyInput.inputValue();
      expect(value).toBe('3');
    }).toPass({ timeout: 100 });
    await page.waitForTimeout(600);

    await plusBtn.click();
    await expect(async () => {
      const value = await qtyInput.inputValue();
      expect(value).toBe('4');
    }).toPass({ timeout: 100 });
    await page.waitForTimeout(600);

    // Click rapidly 5 times and verify only one debounced API call is made
    cartPutRequests = [];
    for (let i = 0; i < 5; i++) {
      await plusBtn.click();
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(600);

    console.log(`Rapid clicks PUT requests: ${cartPutRequests.length}`);
    expect(cartPutRequests.length).toBeLessThanOrEqual(1);
  });
});
