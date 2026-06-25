const { test, expect } = require('@playwright/test');

/**
 * Event Listener Debug for Add to Cart
 * Checks if event listeners are blocking the click
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - Event Listener Debug', async ({ page }) => {
  console.log('\n=== ADD TO CART EVENT LISTENER DEBUG ===\n');
  
  // Navigate to page
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Open product details
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();
  await page.waitForTimeout(1000);
  
  // Check event listeners on the button
  console.log('Step 1: Check event listeners on Add to Cart button');
  const buttonInfo = await page.evaluate(() => {
    const btn = document.querySelector('.add-to-cart-btn');
    if (!btn) return { error: 'Button not found' };
    
    // Get event listeners (limited in browser environment)
    const listeners = [];
    
    // Check onclick attribute
    listeners.push({
      type: 'onclick attribute',
      value: btn.getAttribute('onclick')
    });
    
    // Check if button is disabled
    listeners.push({
      type: 'disabled',
      value: btn.disabled
    });
    
    // Check pointer events
    const computedStyle = window.getComputedStyle(btn);
    listeners.push({
      type: 'pointer-events',
      value: computedStyle.pointerEvents
    });
    
    // Check visibility
    listeners.push({
      type: 'display',
      value: computedStyle.display
    });
    
    // Check z-index
    listeners.push({
      type: 'z-index',
      value: computedStyle.zIndex
    });
    
    // Check parent elements for overlays
    let parent = btn.parentElement;
    let overlayCount = 0;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.position === 'absolute' || parentStyle.position === 'fixed') {
        overlayCount++;
      }
      parent = parent.parentElement;
    }
    listeners.push({
      type: 'overlay elements in parent chain',
      value: overlayCount
    });
    
    return { button: btn.tagName, className: btn.className, listeners };
  });
  
  console.log('  Button info:');
  buttonInfo.listeners.forEach(info => {
    console.log(`    ${info.type}: ${info.value}`);
  });
  
  // Try to manually trigger the onclick
  console.log('\nStep 2: Manually trigger onclick');
  const manualClickResult = await page.evaluate(() => {
    const btn = document.querySelector('.add-to-cart-btn');
    if (!btn) return { error: 'Button not found' };
    
    try {
      btn.click();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  console.log(`  Manual click result: ${JSON.stringify(manualClickResult)}`);
  
  await page.waitForTimeout(2000);
  
  // Check cart count
  console.log('\nStep 3: Check cart count after manual click');
  const cartCount = await page.locator('.cart-count').first();
  const count = await cartCount.count() > 0 ? await cartCount.textContent() : 'NOT_FOUND';
  console.log(`  Cart count: ${count}`);
  
  // Try calling the onclick code directly
  console.log('\nStep 4: Call onclick code directly');
  const directOncallResult = await page.evaluate(() => {
    try {
      event.stopPropagation();
      window.app.addToCart(1);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  console.log(`  Direct onclick result: ${JSON.stringify(directOncallResult)}`);
  
  await page.waitForTimeout(2000);
  
  // Check cart count again
  console.log('\nStep 5: Check cart count after direct onclick');
  const cartCount2 = await page.locator('.cart-count').first();
  const count2 = await cartCount2.count() > 0 ? await cartCount2.textContent() : 'NOT_FOUND';
  console.log(`  Cart count: ${count2}`);
  
  // Check if there's a modal overlay blocking clicks
  console.log('\nStep 6: Check for modal overlay');
  const overlayInfo = await page.evaluate(() => {
    const modal = document.querySelector('.product-details-modal.active');
    if (!modal) return { modalActive: false };
    
    const modalStyle = window.getComputedStyle(modal);
    const footer = document.querySelector('.pd-modal-footer');
    const footerStyle = footer ? window.getComputedStyle(footer) : null;
    
    return {
      modalActive: true,
      modalZIndex: modalStyle.zIndex,
      modalPosition: modalStyle.position,
      footerDisplay: footerStyle ? footerStyle.display : 'N/A',
      footerPointerEvents: footerStyle ? footerStyle.pointerEvents : 'N/A'
    };
  });
  
  console.log('  Modal overlay info:');
  Object.entries(overlayInfo).forEach(([key, value]) => {
    console.log(`    ${key}: ${value}`);
  });
  
  // Screenshot
  await page.screenshot({ path: 'test-results/add-to-cart-event-debug.png', fullPage: true });
  console.log('\nScreenshot saved: test-results/add-to-cart-event-debug.png');
});
