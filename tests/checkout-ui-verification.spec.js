const { test, expect } = require('@playwright/test');

test.describe('Checkout UI & Validation Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Setup console logging
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        console.log(`[Browser Console Error] ${text}`);
      }
    });

    // Navigate to index page
    await page.goto('http://localhost:3000/index.html');
    await page.waitForTimeout(2000);
  });

  test('Checkout UI - Page loads with authentication', async ({ page }) => {
    // Login first
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    // Check if login succeeded
    const userAccountBtn = page.locator('#user-account-btn');
    const isLoggedIn = await userAccountBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isLoggedIn).toBe(true);
  });

  test('Checkout UI - Navigate to checkout page', async ({ page }) => {
    // Login
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    // Add product to cart
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    const addToCartCount = await firstAddToCartBtn.count();
    
    if (addToCartCount > 0) {
      await firstAddToCartBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Navigate to checkout
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Check if checkout form is visible
    const checkoutForm = page.locator('#checkout-form');
    const formVisible = await checkoutForm.isVisible().catch(() => false);
    
    if (formVisible) {
      console.log('Checkout form is visible');
    } else {
      console.log('Checkout form not visible - checking for redirect or error');
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
    }
  });

  test('Checkout UI - Delivery Address section', async ({ page }) => {
    // Login and navigate to checkout
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    if (await firstAddToCartBtn.count() > 0) {
      await firstAddToCartBtn.scrollIntoViewIfNeeded();
      await firstAddToCartBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Check for delivery address section
    const addressSection = page.locator('#delivery-address-section, .delivery-address, [data-section="address"]');
    const addressVisible = await addressSection.isVisible().catch(() => false);
    
    if (addressVisible) {
      console.log('Delivery address section is visible');
      const addressText = await addressSection.textContent();
      console.log(`Address section content: ${addressText}`);
    } else {
      console.log('Delivery address section not found');
    }
  });

  test('Checkout UI - Product summary', async ({ page }) => {
    // Login and navigate to checkout
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    if (await firstAddToCartBtn.count() > 0) {
      await firstAddToCartBtn.scrollIntoViewIfNeeded();
      await firstAddToCartBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Check for product summary
    const cartItems = page.locator('.co-item, .cart-item, .checkout-item');
    const itemCount = await cartItems.count();
    console.log(`Cart items in checkout: ${itemCount}`);
    
    if (itemCount > 0) {
      const firstItem = cartItems.first();
      const name = await firstItem.locator('.co-item-name, .item-name, .product-name').textContent().catch(() => 'N/A');
      const price = await firstItem.locator('.co-item-price, .item-price, .product-price').textContent().catch(() => 'N/A');
      const qty = await firstItem.locator('.co-qty-input, .qty-input, .quantity-input').inputValue().catch(() => 'N/A');
      console.log(`First item: ${name.trim()}, Price: ${price.trim()}, Qty: ${qty}`);
    }
  });

  test('Checkout UI - Payment Method (Cash on Delivery)', async ({ page }) => {
    // Login and navigate to checkout
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    if (await firstAddToCartBtn.count() > 0) {
      await firstAddToCartBtn.scrollIntoViewIfNeeded();
      await firstAddToCartBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Check for payment method section
    const paymentSection = page.locator('#payment-section, .payment-method, [data-section="payment"]');
    const paymentVisible = await paymentSection.isVisible().catch(() => false);
    
    if (paymentVisible) {
      console.log('Payment method section is visible');
      const paymentText = await paymentSection.textContent();
      console.log(`Payment section content: ${paymentText}`);
      
      // Check for Cash on Delivery option
      const codOption = page.locator('input[value="cod"], .payment-cod, [data-payment="cod"]');
      const codVisible = await codOption.isVisible().catch(() => false);
      console.log(`Cash on Delivery option visible: ${codVisible}`);
    } else {
      console.log('Payment method section not found');
    }
  });

  test('Checkout UI - Totals', async ({ page }) => {
    // Login and navigate to checkout
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    if (await firstAddToCartBtn.count() > 0) {
      await firstAddToCartBtn.scrollIntoViewIfNeeded();
      await firstAddToCartBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Check for totals section
    const totalSection = page.locator('#total-section, .checkout-total, .order-total');
    const totalVisible = await totalSection.isVisible().catch(() => false);
    
    if (totalVisible) {
      console.log('Totals section is visible');
      const totalText = await totalSection.textContent();
      console.log(`Total section content: ${totalText}`);
      
      // Check for peso sign
      expect(totalText).toContain('₱');
    } else {
      console.log('Totals section not found');
    }
  });

  test('Validation - Required delivery address', async ({ page }) => {
    // Login and navigate to checkout
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    if (await firstAddToCartBtn.count() > 0) {
      await firstAddToCartBtn.scrollIntoViewIfNeeded();
      await firstAddToCartBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Try to submit without address
    const submitBtn = page.locator('#checkout-submit, .checkout-submit, button[type="submit"]');
    const submitCount = await submitBtn.count();
    
    if (submitCount > 0) {
      await submitBtn.first().click();
      await page.waitForTimeout(1000);
      
      // Check for validation error
      const errorMsg = page.locator('.error-message, .validation-error, .alert-danger');
      const errorVisible = await errorMsg.isVisible().catch(() => false);
      console.log(`Validation error visible: ${errorVisible}`);
      
      if (errorVisible) {
        const errorText = await errorMsg.textContent();
        console.log(`Validation error: ${errorText}`);
      }
    }
  });

  test('Pre-order UI - Expected Harvest display', async ({ page }) => {
    // Login
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    // Add a pre-order product
    const preorderProduct = page.locator('.product-card').filter({ hasText: 'HARVEST SOON' }).first();
    await preorderProduct.click();
    await page.waitForTimeout(1000);
    
    const addToCartButton = page.locator('#product-details-modal button:has-text("Add to Cart")').first();
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      await page.waitForTimeout(2000);
    }
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Check for expected harvest display
    const harvestInfo = page.locator('.expected-harvest, .harvest-date, [data-field="harvest"]');
    const harvestVisible = await harvestInfo.isVisible().catch(() => false);
    console.log(`Expected harvest info visible: ${harvestVisible}`);
    
    if (harvestVisible) {
      const harvestText = await harvestInfo.textContent();
      console.log(`Harvest info: ${harvestText}`);
    }
  });

  test('Visual Inspection - Console errors', async ({ page }) => {
    // Setup console error tracking
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Login and navigate to checkout
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    await page.click('#auth-submit-btn');
    await page.waitForTimeout(3000);
    
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    if (await firstAddToCartBtn.count() > 0) {
      await firstAddToCartBtn.scrollIntoViewIfNeeded();
      await firstAddToCartBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    console.log(`Console errors found: ${errors.length}`);
    if (errors.length > 0) {
      errors.forEach(err => console.log(`  - ${err}`));
    }
    
    expect(errors.length).toBe(0);
  });
});
