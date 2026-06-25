const { test, expect } = require('@playwright/test');

/**
 * Execute Add to Cart with Debug Logging
 * Captures all console logs to identify execution stop point
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - With Debug Logging', async ({ page }) => {
  console.log('\n=== ADD TO CART WITH DEBUG LOGGING ===\n');
  
  // Capture all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({
      type: msg.type(),
      text: text,
      location: msg.location()
    });
    console.log(`[${msg.type().toUpperCase()}] ${text}`);
  });
  
  // Navigate to page
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Open product details
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();
  await page.waitForTimeout(1000);
  
  // Click Add to Cart button
  console.log('\n=== CLICKING ADD TO CART BUTTON ===\n');
  const addToCartBtn = page.locator('.add-to-cart-btn').first();
  await addToCartBtn.click({ force: true });
  
  // Wait for logs
  await page.waitForTimeout(3000);
  
  // Filter debug logs
  console.log('\n=== DEBUG LOG SEQUENCE ===\n');
  const debugLogs = consoleMessages.filter(m => m.text.includes('[DEBUG addToCart]'));
  
  if (debugLogs.length === 0) {
    console.log('NO DEBUG LOGS FOUND - Function may not have been called');
  } else {
    debugLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.text}`);
    });
  }
  
  // Check for error logs
  console.log('\n=== ERROR LOGS ===\n');
  const errorLogs = consoleMessages.filter(m => m.type === 'error');
  errorLogs.forEach(log => {
    console.log(`- ${log.text}`);
    if (log.location) {
      console.log(`  Location: ${log.location.url}:${log.location.lineNumber}`);
    }
  });
  
  // Check cart count
  console.log('\n=== CART COUNT ===\n');
  const cartCount = await page.locator('.cart-count').first();
  const count = await cartCount.count() > 0 ? await cartCount.textContent() : 'NOT_FOUND';
  console.log(`Cart count: ${count}`);
  
  // Screenshot
  await page.screenshot({ path: 'test-results/add-to-cart-logging.png', fullPage: true });
  console.log('\nScreenshot saved: test-results/add-to-cart-logging.png');
  
  // Analysis
  console.log('\n=== ANALYSIS ===\n');
  console.log(`Total debug logs: ${debugLogs.length}`);
  console.log(`Last debug log: ${debugLogs.length > 0 ? debugLogs[debugLogs.length - 1].text : 'NONE'}`);
  
  if (debugLogs.length > 0) {
    const lastLog = debugLogs[debugLogs.length - 1].text;
    console.log(`\nLast log message reached: ${lastLog}`);
    
    // Determine what comes next
    if (lastLog.includes('FUNCTION ENTRY')) {
      console.log('Next statement would be: VALIDATION PASSED');
    } else if (lastLog.includes('VALIDATION PASSED')) {
      console.log('Next statement would be: LOOKING FOR BUTTON');
    } else if (lastLog.includes('LOOKING FOR BUTTON')) {
      console.log('Next statement would be: BUTTON FOUND');
    } else if (lastLog.includes('BUTTON FOUND')) {
      console.log('Next statement would be: TRY BLOCK START');
    } else if (lastLog.includes('TRY BLOCK START')) {
      console.log('Next statement would be: apiBase log');
    } else if (lastLog.includes('apiBase:')) {
      console.log('Next statement would be: token exists log');
    } else if (lastLog.includes('token exists:')) {
      console.log('Next statement would be: sessionId log');
    } else if (lastLog.includes('sessionId:')) {
      console.log('Next statement would be: PREPARING PAYLOAD');
    } else if (lastLog.includes('PREPARING PAYLOAD')) {
      console.log('Next statement would be: PAYLOAD CREATED');
    } else if (lastLog.includes('PAYLOAD CREATED')) {
      console.log('Next statement would be: FETCH CALL START');
    } else if (lastLog.includes('FETCH CALL START')) {
      console.log('Next statement would be: FETCH RESPONSE RECEIVED');
    } else if (lastLog.includes('FETCH RESPONSE RECEIVED')) {
      console.log('Next statement would be: CALLING response.json()');
    } else if (lastLog.includes('CALLING response.json()')) {
      console.log('Next statement would be: response.json() COMPLETE');
    } else if (lastLog.includes('response.json() COMPLETE')) {
      console.log('Next statement would be: SUCCESS PATH ENTERED or ERROR PATH ENTERED');
    } else if (lastLog.includes('SUCCESS PATH ENTERED')) {
      console.log('Next statement would be: TRIGGERING ANIMATION or UPDATING CART COUNT');
    } else if (lastLog.includes('TRY BLOCK COMPLETE')) {
      console.log('Next statement would be: FUNCTION EXIT');
    } else if (lastLog.includes('CATCH BLOCK ENTERED')) {
      console.log('Next statement would be: FUNCTION EXIT');
    }
  }
});
