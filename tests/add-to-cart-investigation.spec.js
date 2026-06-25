const { test, expect } = require('@playwright/test');

/**
 * Focused Investigation: Add to Cart Flow
 * Monitors network requests, storage, and console errors
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - Detailed Investigation', async ({ page, context }) => {
  console.log('\n=== ADD TO CART INVESTIGATION ===\n');
  
  // Storage for evidence
  const evidence = {
    networkRequests: [],
    consoleErrors: [],
    storageChanges: { before: {}, after: {} },
    cartCountBefore: null,
    cartCountAfter: null,
    apiResponses: {},
    authRequired: false
  };
  
  // Monitor all network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/cart') || url.includes('/api/products')) {
      evidence.networkRequests.push({
        type: 'REQUEST',
        url: url,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
      console.log(`[REQUEST] ${request.method()} ${url}`);
    }
  });
  
  // Monitor all responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/cart') || url.includes('/api/products')) {
      const status = response.status();
      const body = await response.text().catch(() => 'Unable to read body');
      
      evidence.networkRequests.push({
        type: 'RESPONSE',
        url: url,
        status: status,
        body: body
      });
      
      evidence.apiResponses[url] = {
        status: status,
        body: body
      };
      
      console.log(`[RESPONSE] ${status} ${url}`);
      if (status >= 400) {
        console.log(`  Body: ${body.substring(0, 200)}`);
      }
    }
  });
  
  // Monitor console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      evidence.consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
      console.error(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  
  // Navigate to page
  console.log('Step 1: Navigate to index.html');
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Capture initial storage state
  console.log('\nStep 2: Capture initial storage state');
  evidence.storageChanges.before = {
    localStorage: await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    }),
    sessionStorage: await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        data[key] = sessionStorage.getItem(key);
      }
      return data;
    })
  };
  
  console.log('  localStorage keys:', Object.keys(evidence.storageChanges.before.localStorage));
  console.log('  sessionStorage keys:', Object.keys(evidence.storageChanges.before.sessionStorage));
  
  // Check initial cart count
  console.log('\nStep 3: Check initial cart count');
  const cartCountBefore = await page.locator('.cart-count').first();
  evidence.cartCountBefore = await cartCountBefore.count() > 0 ? await cartCountBefore.textContent() : 'NOT_FOUND';
  console.log(`  Cart count before: ${evidence.cartCountBefore}`);
  
  // Check if user is authenticated
  console.log('\nStep 4: Check authentication status');
  const authToken = await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token'));
  const userId = await page.evaluate(() => localStorage.getItem('userId') || sessionStorage.getItem('userId'));
  console.log(`  Token exists: ${!!authToken}`);
  console.log(`  User ID exists: ${!!userId}`);
  evidence.authRequired = !authToken;
  
  // Open product details
  console.log('\nStep 5: Open product details');
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();
  await page.waitForTimeout(1000);
  
  // Check if modal opened
  const modalVisible = await page.locator('.product-details-modal.active').count() > 0;
  console.log(`  Modal visible: ${modalVisible}`);
  
  // Get product ID from page
  const productId = await page.evaluate(() => {
    const btn = document.querySelector('.add-to-cart-btn');
    return btn ? btn.getAttribute('onclick')?.match(/app\.addToCart\((\d+)\)/)?.[1] : 'NOT_FOUND';
  });
  console.log(`  Product ID: ${productId}`);
  
  // Click add to cart
  console.log('\nStep 6: Click Add to Cart button');
  const addToCartBtn = page.locator('.add-to-cart-btn').first();
  await addToCartBtn.click({ force: true });
  await page.waitForTimeout(2000);
  
  // Capture storage after add to cart
  console.log('\nStep 7: Capture storage after add to cart');
  evidence.storageChanges.after = {
    localStorage: await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    }),
    sessionStorage: await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        data[key] = sessionStorage.getItem(key);
      }
      return data;
    })
  };
  
  console.log('  localStorage keys:', Object.keys(evidence.storageChanges.after.localStorage));
  console.log('  sessionStorage keys:', Object.keys(evidence.storageChanges.after.sessionStorage));
  
  // Check cart count after
  console.log('\nStep 8: Check cart count after');
  const cartCountAfter = await page.locator('.cart-count').first();
  evidence.cartCountAfter = await cartCountAfter.count() > 0 ? await cartCountAfter.textContent() : 'NOT_FOUND';
  console.log(`  Cart count after: ${evidence.cartCountAfter}`);
  
  // Check for cart data in storage
  console.log('\nStep 9: Check for cart data in storage');
  const cartDataLocal = await page.evaluate(() => localStorage.getItem('cart'));
  const cartDataSession = await page.evaluate(() => sessionStorage.getItem('cart'));
  console.log(`  Cart in localStorage: ${cartDataLocal ? 'YES' : 'NO'}`);
  console.log(`  Cart in sessionStorage: ${cartDataSession ? 'YES' : 'NO'}`);
  
  if (cartDataLocal) {
    console.log(`  localStorage cart data: ${cartDataLocal.substring(0, 200)}`);
  }
  if (cartDataSession) {
    console.log(`  sessionStorage cart data: ${cartDataSession.substring(0, 200)}`);
  }
  
  // Open cart to verify contents
  console.log('\nStep 10: Open cart modal');
  await page.mouse.click(10, 10); // Close product modal
  await page.waitForTimeout(500);
  
  const cartBtn = page.locator('#cart-btn').first();
  if (await cartBtn.count() > 0) {
    await cartBtn.click();
    await page.waitForTimeout(500);
    
    const cartItems = await page.locator('.cart-item').count();
    console.log(`  Cart items visible: ${cartItems}`);
  }
  
  // Print evidence summary
  console.log('\n=== EVIDENCE SUMMARY ===\n');
  
  console.log('1. Was the product actually added to cart?');
  console.log(`   Cart count before: ${evidence.cartCountBefore}`);
  console.log(`   Cart count after: ${evidence.cartCountAfter}`);
  console.log(`   Cart count increased: ${evidence.cartCountAfter !== evidence.cartCountBefore && evidence.cartCountAfter !== 'NOT_FOUND'}`);
  
  console.log('\n2. Did the cart count increase?');
  console.log(`   ${evidence.cartCountBefore} → ${evidence.cartCountAfter}`);
  console.log(`   Increased: ${evidence.cartCountAfter !== evidence.cartCountBefore}`);
  
  console.log('\n3. Was an API request sent?');
  console.log(`   Total cart-related requests: ${evidence.networkRequests.length}`);
  evidence.networkRequests.forEach(req => {
    console.log(`   - ${req.type}: ${req.method || req.status} ${req.url}`);
  });
  
  console.log('\n4. What was the API response?');
  Object.entries(evidence.apiResponses).forEach(([url, data]) => {
    console.log(`   ${url}:`);
    console.log(`     Status: ${data.status}`);
    console.log(`     Body: ${data.body.substring(0, 300)}`);
  });
  
  console.log('\n5. Were there any console errors?');
  console.log(`   Total errors: ${evidence.consoleErrors.length}`);
  evidence.consoleErrors.forEach(err => {
    console.log(`   - ${err.text}`);
  });
  
  console.log('\n6. Is authentication required?');
  console.log(`   Token exists: ${!!authToken}`);
  console.log(`   User ID exists: ${!!userId}`);
  console.log(`   Auth required: ${evidence.authRequired}`);
  
  console.log('\n7. Cart data storage mechanism:');
  console.log(`   localStorage: ${Object.keys(evidence.storageChanges.after.localStorage).join(', ')}`);
  console.log(`   sessionStorage: ${Object.keys(evidence.storageChanges.after.sessionStorage).join(', ')}`);
  console.log(`   Cart in localStorage: ${!!cartDataLocal}`);
  console.log(`   Cart in sessionStorage: ${!!cartDataSession}`);
  
  console.log('\n8. Storage changes:');
  const localKeysBefore = Object.keys(evidence.storageChanges.before.localStorage);
  const localKeysAfter = Object.keys(evidence.storageChanges.after.localStorage);
  const newLocalKeys = localKeysAfter.filter(k => !localKeysBefore.includes(k));
  console.log(`   New localStorage keys: ${newLocalKeys.join(', ')}`);
  
  const sessionKeysBefore = Object.keys(evidence.storageChanges.before.sessionStorage);
  const sessionKeysAfter = Object.keys(evidence.storageChanges.after.sessionStorage);
  const newSessionKeys = sessionKeysAfter.filter(k => !sessionKeysBefore.includes(k));
  console.log(`   New sessionStorage keys: ${newSessionKeys.join(', ')}`);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/add-to-cart-investigation.png', fullPage: true });
  console.log('\nScreenshot saved: test-results/add-to-cart-investigation.png');
  
  // Save evidence to file
  await page.evaluate((ev) => {
    const blob = new Blob([JSON.stringify(ev, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'add-to-cart-evidence.json';
    a.click();
  }, evidence);
  
  console.log('\nEvidence saved as: add-to-cart-evidence.json');
});
