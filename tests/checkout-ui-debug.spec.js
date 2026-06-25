const { test, expect } = require('@playwright/test');

test.describe('Checkout Cart UI Debug', () => {
  test('Login, add to cart, and test checkout quantity updates', async ({ page }) => {
    console.log('=== Starting Checkout UI Debug Test ===');
    
    // Setup console logging
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push({ type: msg.type(), text });
      if (text.includes('[Checkout]') || text.includes('404')) {
        console.log(`[Browser Console] ${text}`);
      }
    });

    // Setup network monitoring
    const networkRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/cart')) {
        console.log(`[Network Request] ${request.method()} ${request.url()}`);
      }
    });
    page.on('response', response => {
      if (response.url().includes('/api/cart')) {
        console.log(`[Network Response] ${response.status()} ${response.url()}`);
        networkRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    // Navigate to index page
    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');
    console.log('=== Page loaded ===');

    // Click login button
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    console.log('=== Login modal opened ===');

    // Fill in credentials
    await page.fill('#auth-email', 'customer@gmail.com');
    await page.fill('#auth-password', 'customercustomer');
    console.log('=== Credentials filled ===');

    // Check if CAPTCHA is present
    const recaptchaElement = page.locator('#auth-recaptcha');
    const hasRecaptcha = await recaptchaElement.count() > 0;
    console.log(`=== CAPTCHA present: ${hasRecaptcha} ===`);

    if (hasRecaptcha) {
      // Try to bypass CAPTCHA by setting test mode
      await page.evaluate(() => {
        // Set test mode for reCAPTCHA if possible
        if (window.grecaptcha) {
          console.log('grecaptcha found, attempting to set test mode');
        }
      });
      
      // Wait a bit for any test mode to take effect
      await page.waitForTimeout(1000);
    }

    // Click login button
    await page.click('#auth-submit-btn');
    console.log('=== Login button clicked ===');

    // Wait for login to complete (check for user menu or redirect)
    await page.waitForTimeout(3000);
    
    // Check if login succeeded
    const userAccountBtn = page.locator('#user-account-btn');
    const isLoggedIn = await userAccountBtn.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isLoggedIn) {
      console.log('=== Login failed - checking for error message ===');
      const errorToast = page.locator('.toast').isVisible();
      console.log(`Error toast visible: ${errorToast}`);
      return;
    }
    
    console.log('=== Login successful ===');

    // Navigate to products section
    await page.click('a[href="#products"]');
    await page.waitForTimeout(1000);
    console.log('=== Navigated to products ===');

    // Add first product to cart
    const firstAddToCartBtn = page.locator('.add-to-cart-btn').first();
    const addToCartCount = await firstAddToCartBtn.count();
    
    if (addToCartCount === 0) {
      console.log('=== No add to cart buttons found ===');
      return;
    }
    
    await firstAddToCartBtn.click();
    console.log('=== Clicked add to cart ===');
    await page.waitForTimeout(2000);

    // Check cart count
    const cartCount = page.locator('#cart-count');
    const countText = await cartCount.textContent();
    console.log(`=== Cart count: ${countText} ===`);

    // Go to checkout page
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForLoadState('networkidle');
    console.log('=== Navigated to checkout ===');

    // Wait for checkout form to load
    await page.waitForTimeout(2000);

    // Check if checkout form is visible
    const checkoutForm = page.locator('#checkout-form');
    const formVisible = await checkoutForm.isVisible();
    console.log(`=== Checkout form visible: ${formVisible} ===`);

    if (!formVisible) {
      console.log('=== Checkout form not visible - checking for error ===');
      const loadingEl = page.locator('#checkout-loading');
      const loadingVisible = await loadingEl.isVisible();
      console.log(`Loading element visible: ${loadingVisible}`);
      return;
    }

    // Get cart items
    const cartItems = page.locator('.co-item');
    const itemCount = await cartItems.count();
    console.log(`=== Cart items: ${itemCount} ===`);

    if (itemCount === 0) {
      console.log('=== No cart items in checkout ===');
      return;
    }

    // Log each item
    for (let i = 0; i < itemCount; i++) {
      const item = cartItems.nth(i);
      const name = await item.locator('.co-item-name').textContent();
      const removeBtn = item.locator('.co-remove-btn-qty');
      const onclick = await removeBtn.getAttribute('onclick');
      console.log(`Item ${i + 1}: ${name.trim()}`);
      console.log(`  Remove onclick: ${onclick}`);
    }

    // Test quantity update
    const firstItem = cartItems.first();
    const qtyInput = firstItem.locator('.co-qty-input');
    const currentQty = await qtyInput.inputValue();
    console.log(`=== Current quantity: ${currentQty} ===`);

    // Click plus button
    const plusBtn = firstItem.locator('.co-qty-btn').last();
    await plusBtn.click();
    console.log('=== Clicked plus button ===');
    await page.waitForTimeout(2000);

    // Check console logs for errors
    console.log('=== Console Logs ===');
    consoleLogs.forEach(log => {
      if (log.text.includes('[Checkout]') || log.text.includes('404') || log.type === 'error') {
        console.log(`  [${log.type}] ${log.text}`);
      }
    });

    console.log('=== Network Requests ===');
    networkRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url} - ${req.status}`);
    });

    // Check if quantity updated
    const newQty = await qtyInput.inputValue();
    console.log(`=== New quantity: ${newQty} ===`);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/checkout-debug.png', fullPage: true });
    console.log('=== Screenshot saved ===');
  });
});
