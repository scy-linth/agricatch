const { test, expect } = require('@playwright/test');

/**
 * JavaScript Execution Debug for Add to Cart
 * Captures console logs, errors, and function execution
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - JavaScript Debug', async ({ page }) => {
  console.log('\n=== ADD TO CART JAVASCRIPT DEBUG ===\n');
  
  // Capture all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  // Navigate to page
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Check if app object exists
  console.log('\nStep 1: Check if app object exists');
  const appExists = await page.evaluate(() => typeof window.app !== 'undefined');
  console.log(`  window.app exists: ${appExists}`);
  
  if (appExists) {
    const addToCartExists = await page.evaluate(() => typeof window.app.addToCart === 'function');
    console.log(`  app.addToCart exists: ${addToCartExists}`);
    
    const sessionId = await page.evaluate(() => window.app.sessionId);
    console.log(`  app.sessionId: ${sessionId}`);
  }
  
  // Open product details
  console.log('\nStep 2: Open product details');
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();
  await page.waitForTimeout(1000);
  
  // Get the button and its onclick attribute
  console.log('\nStep 3: Check button onclick attribute');
  const addToCartBtn = page.locator('.add-to-cart-btn').first();
  const onclickAttr = await addToCartBtn.getAttribute('onclick');
  console.log(`  onclick attribute: ${onclickAttr}`);
  
  // Try to call addToCart directly from page context
  console.log('\nStep 4: Call addToCart directly from page context');
  const directCallResult = await page.evaluate(async () => {
    try {
      if (typeof window.app !== 'undefined' && typeof window.app.addToCart === 'function') {
        // Call it but don't wait for completion
        window.app.addToCart(1);
        return { success: true, message: 'Function called' };
      } else {
        return { success: false, message: 'app or addToCart not available' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
  console.log(`  Direct call result: ${JSON.stringify(directCallResult)}`);
  
  await page.waitForTimeout(2000);
  
  // Check console messages after direct call
  console.log('\nStep 5: Console messages after direct call');
  const messagesAfterCall = consoleMessages.filter(m => m.text.includes('cart') || m.text.includes('error') || m.text.includes('Error'));
  messagesAfterCall.forEach(msg => {
    console.log(`  [${msg.type}] ${msg.text}`);
  });
  
  // Check cart count
  console.log('\nStep 6: Check cart count');
  const cartCount = await page.locator('.cart-count').first();
  const count = await cartCount.count() > 0 ? await cartCount.textContent() : 'NOT_FOUND';
  console.log(`  Cart count: ${count}`);
  
  // Check if there are any uncaught errors
  console.log('\nStep 7: Check for uncaught errors');
  const errors = consoleMessages.filter(m => m.type === 'error');
  console.log(`  Total errors: ${errors.length}`);
  errors.forEach(err => {
    console.log(`  - ${err.text}`);
    if (err.location) {
      console.log(`    Location: ${err.location.url}:${err.location.lineNumber}`);
    }
  });
  
  // Try clicking the button normally
  console.log('\nStep 8: Click button normally');
  await addToCartBtn.click({ force: true });
  await page.waitForTimeout(2000);
  
  // Check console messages after click
  console.log('\nStep 9: Console messages after button click');
  const messagesAfterClick = consoleMessages.slice(-10);
  messagesAfterClick.forEach(msg => {
    console.log(`  [${msg.type}] ${msg.text}`);
  });
  
  // Final cart count
  console.log('\nStep 10: Final cart count');
  const finalCount = await page.locator('.cart-count').first();
  const finalCountValue = await finalCount.count() > 0 ? await finalCount.textContent() : 'NOT_FOUND';
  console.log(`  Cart count: ${finalCountValue}`);
  
  // Screenshot
  await page.screenshot({ path: 'test-results/add-to-cart-js-debug.png', fullPage: true });
  console.log('\nScreenshot saved: test-results/add-to-cart-js-debug.png');
});
