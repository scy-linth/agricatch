const { test, expect } = require('@playwright/test');

/**
 * Test Add to Cart button click after CSS fix
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - Button Click After CSS Fix', async ({ page }) => {
  console.log('\n=== ADD TO CART BUTTON CLICK TEST ===\n');
  
  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  // Navigate to page
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Open product details
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();
  await page.waitForTimeout(1000);
  
  // Check if button is now clickable
  console.log('\nStep 1: Check button clickability');
  const buttonInfo = await page.evaluate(() => {
    const btn = document.getElementById('product-details-add-cart');
    if (!btn) return { error: 'Button not found' };
    
    const rect = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      elementAtPoint: elementAtPoint ? elementAtPoint.tagName + (elementAtPoint.className ? '.' + elementAtPoint.className : '') : 'none',
      isButtonAtPoint: elementAtPoint === btn
    };
  });
  
  console.log('Button info:');
  console.log(`  Position: ${JSON.stringify(buttonInfo.rect)}`);
  console.log(`  Element at center: ${buttonInfo.elementAtPoint}`);
  console.log(`  Button is at center: ${buttonInfo.isButtonAtPoint}`);
  
  // Click the button
  console.log('\nStep 2: Click Add to Cart button');
  const addToCartBtn = page.locator('#product-details-add-cart');
  await addToCartBtn.click();
  await page.waitForTimeout(2000);
  
  // Check cart count
  console.log('\nStep 3: Check cart count');
  const cartCount = await page.locator('.cart-count').first();
  const count = await cartCount.count() > 0 ? await cartCount.textContent() : 'NOT_FOUND';
  console.log(`  Cart count: ${count}`);
  
  // Check for success message
  console.log('\nStep 4: Check for success message');
  const successMessages = consoleMessages.filter(m => m.text.includes('added to cart') || m.text.includes('success'));
  console.log(`  Success messages: ${successMessages.length}`);
  successMessages.forEach(msg => {
    console.log(`    - ${msg.text}`);
  });
  
  // Screenshot
  await page.screenshot({ path: 'test-results/add-to-cart-button-click.png', fullPage: true });
  console.log('\nScreenshot saved: test-results/add-to-cart-button-click.png');
  
  // Analysis
  console.log('\n=== ANALYSIS ===\n');
  if (buttonInfo.isButtonAtPoint) {
    console.log('PASS: Button is no longer covered by overlay');
  } else {
    console.log('FAIL: Button is still covered by overlay');
  }
  
  if (count !== '0' && count !== 'NOT_FOUND') {
    console.log('PASS: Cart count increased');
  } else {
    console.log('FAIL: Cart count did not increase');
  }
  
  if (successMessages.length > 0) {
    console.log('PASS: Success message appeared');
  } else {
    console.log('FAIL: No success message');
  }
});
