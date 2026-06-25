const { test, expect } = require('@playwright/test');

/**
 * Click Blocker Investigation
 * Checks if something is preventing the button click from reaching the onclick handler
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - Click Blocker Investigation', async ({ page }) => {
  console.log('\n=== CLICK BLOCKER INVESTIGATION ===\n');
  
  // Navigate to page
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Open product details
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();
  await page.waitForTimeout(1000);
  
  // Get button element info
  console.log('\nStep 1: Button element analysis');
  const buttonInfo = await page.evaluate(() => {
    const btn = document.querySelector('.add-to-cart-btn');
    if (!btn) return { error: 'Button not found' };
    
    const rect = btn.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(btn);
    
    // Check if element is visible and clickable
    const isVisible = rect.width > 0 && rect.height > 0;
    const isHidden = computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0';
    const pointerEvents = computedStyle.pointerEvents;
    const zIndex = computedStyle.zIndex;
    
    // Check if any element is covering it
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      isVisible,
      isHidden,
      pointerEvents,
      zIndex,
      elementAtPoint: elementAtPoint ? elementAtPoint.tagName + (elementAtPoint.className ? '.' + elementAtPoint.className : '') : 'none',
      isButtonAtPoint: elementAtPoint === btn
    };
  });
  
  console.log('Button info:');
  console.log(`  Position: ${JSON.stringify(buttonInfo.rect)}`);
  console.log(`  Visible: ${buttonInfo.isVisible}`);
  console.log(`  Hidden: ${buttonInfo.isHidden}`);
  console.log(`  Pointer events: ${buttonInfo.pointerEvents}`);
  console.log(`  Z-index: ${buttonInfo.zIndex}`);
  console.log(`  Element at center: ${buttonInfo.elementAtPoint}`);
  console.log(`  Button is at center: ${buttonInfo.isButtonAtPoint}`);
  
  // Try clicking via JavaScript
  console.log('\nStep 2: Click via JavaScript (btn.click())');
  const jsClickResult = await page.evaluate(() => {
    const btn = document.querySelector('.add-to-cart-btn');
    if (!btn) return { error: 'Button not found' };
    
    try {
      btn.click();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  console.log(`  Result: ${JSON.stringify(jsClickResult)}`);
  
  await page.waitForTimeout(2000);
  
  // Check cart count
  const cartCount1 = await page.locator('.cart-count').first();
  const count1 = await cartCount1.count() > 0 ? await cartCount1.textContent() : 'NOT_FOUND';
  console.log(`  Cart count after JS click: ${count1}`);
  
  // Try Playwright click
  console.log('\nStep 3: Click via Playwright (page.click)');
  const addToCartBtn = page.locator('.add-to-cart-btn').first();
  await addToCartBtn.click();
  await page.waitForTimeout(2000);
  
  const cartCount2 = await page.locator('.cart-count').first();
  const count2 = await cartCount2.count() > 0 ? await cartCount2.textContent() : 'NOT_FOUND';
  console.log(`  Cart count after Playwright click: ${count2}`);
  
  // Try force click
  console.log('\nStep 4: Click via Playwright force');
  await addToCartBtn.click({ force: true });
  await page.waitForTimeout(2000);
  
  const cartCount3 = await page.locator('.cart-count').first();
  const count3 = await cartCount3.count() > 0 ? await cartCount3.textContent() : 'NOT_FOUND';
  console.log(`  Cart count after force click: ${count3}`);
  
  // Check if there are event listeners blocking
  console.log('\nStep 5: Check parent elements for event listeners');
  const parentInfo = await page.evaluate(() => {
    const btn = document.querySelector('.add-to-cart-btn');
    if (!btn) return { error: 'Button not found' };
    
    let parent = btn.parentElement;
    const parents = [];
    let depth = 0;
    
    while (parent && depth < 10) {
      const style = window.getComputedStyle(parent);
      parents.push({
        tag: parent.tagName,
        class: parent.className,
        position: style.position,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
        overflow: style.overflow
      });
      parent = parent.parentElement;
      depth++;
    }
    
    return parents;
  });
  
  console.log('Parent chain:');
  parentInfo.forEach((p, i) => {
    console.log(`  ${i}. ${p.tag}.${p.class}`);
    console.log(`     position: ${p.position}, z-index: ${p.zIndex}, pointer-events: ${p.pointerEvents}, overflow: ${p.overflow}`);
  });
  
  // Screenshot
  await page.screenshot({ path: 'test-results/add-to-cart-click-blocker.png', fullPage: true });
  console.log('\nScreenshot saved: test-results/add-to-cart-click-blocker.png');
});
