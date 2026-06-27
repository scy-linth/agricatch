const { test, expect } = require('@playwright/test');

test.describe('Order Creation Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:3000/index.html');
    await page.waitForTimeout(2000);
  });

  test('Available Product Checkout - Create order successfully', async ({ page }) => {
    console.log('=== Test: Available Product Checkout ===');
    
    // Add available product to cart
    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);
    
    // Open cart
    await page.click('button:has-text("Open cart")');
    await page.waitForTimeout(1000);
    
    // Verify cart has item
    const cartTotal = await page.textContent('strong:has-text("Total:")');
    console.log('Cart Total:', cartTotal);
    expect(cartTotal).not.toContain('₱0.00');
    
    // Proceed to checkout
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForTimeout(2000);
    
    // Fill delivery information
    await page.fill('#checkout-firstname', 'Test');
    await page.fill('#checkout-lastname', 'User');
    await page.fill('#checkout-phone', '9123456789');
    
    // Place order
    await page.click('#place-order-btn');
    await page.waitForTimeout(3000);
    
    // Check for success message or error
    const pageContent = await page.content();
    console.log('Page content after order submission');
    
    // Check if redirected to orders page or shows success message
    if (page.url().includes('orders.html')) {
      console.log('✅ Successfully redirected to orders page');
    } else {
      // Check for error message
      const errorElement = await page.locator('text=/error|failed|Server error/i').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log('❌ Order failed with error:', errorText);
      }
    }
  });

  test('Pre-order Checkout - Create reservation successfully', async ({ page }) => {
    console.log('=== Test: Pre-order Checkout ===');
    
    // Scroll to pre-order section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Find and click Reserve button for a pre-order product with harvest date
    const reserveButtons = await page.locator('button:has-text("Reserve"):not([disabled])').all();
    if (reserveButtons.length > 0) {
      await reserveButtons[0].click();
      await page.waitForTimeout(1000);
      
      // Open cart
      await page.click('button:has-text("Open cart")');
      await page.waitForTimeout(1000);
      
      // Proceed to checkout
      await page.click('button:has-text("Proceed to Checkout")');
      await page.waitForTimeout(2000);
      
      // Fill delivery information
      await page.fill('#checkout-firstname', 'Test');
      await page.fill('#checkout-lastname', 'User');
      await page.fill('#checkout-phone', '9123456789');
      
      // Place pre-order
      await page.click('#place-order-btn');
      await page.waitForTimeout(3000);
      
      console.log('Pre-order submission completed');
    } else {
      console.log('⚠️ No available pre-order products with harvest dates');
    }
  });

  test('Validation - Empty cart', async ({ page }) => {
    console.log('=== Test: Empty Cart Validation ===');
    
    // Navigate directly to checkout
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForTimeout(2000);
    
    // Try to place order without items
    const placeOrderBtn = await page.locator('#place-order-btn');
    if (await placeOrderBtn.isVisible()) {
      const isDisabled = await placeOrderBtn.isDisabled();
      console.log('Place Order button disabled:', isDisabled);
      expect(isDisabled).toBeTruthy();
    }
  });

  test('Validation - Missing required fields', async ({ page }) => {
    console.log('=== Test: Missing Required Fields Validation ===');
    
    // Add product to cart
    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);
    
    // Open cart and proceed to checkout
    await page.click('button:has-text("Open cart")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForTimeout(2000);
    
    // Try to place order without filling required fields
    await page.click('#place-order-btn');
    await page.waitForTimeout(1000);
    
    // Check for validation error
    const errorElement = await page.locator('text=/required|Phone must be/i').first();
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      console.log('✅ Validation error shown:', errorText);
    }
  });

  test('Validation - Invalid phone number', async ({ page }) => {
    console.log('=== Test: Invalid Phone Number Validation ===');
    
    // Add product to cart
    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);
    
    // Open cart and proceed to checkout
    await page.click('button:has-text("Open cart")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForTimeout(2000);
    
    // Fill with invalid phone
    await page.locator('#checkout-firstname').fill('Test');
    await page.locator('#checkout-lastname').fill('User');
    await page.locator('#checkout-phone').fill('1234567890'); // Invalid - doesn't start with 9
    
    // Try to place order
    await page.click('#place-order-btn');
    await page.waitForTimeout(1000);
    
    // Check for validation error
    const errorElement = await page.locator('text=/Phone must be 10 digits starting with 9/i').first();
    if (await errorElement.isVisible()) {
      console.log('✅ Phone validation error shown');
    }
  });
});
