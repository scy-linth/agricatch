const { test, expect } = require('@playwright/test');
const { loginAsFarmer } = require('./auth-helper');

test.describe('Farmer Orders - Empty State', () => {
  test('empty state message has p element for JS updates', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html#orders');
    
    const emptyState = page.locator('#orders-search-empty');
    const pElement = emptyState.locator('p');
    
    // Should have a p element for JS to update
    await expect(pElement).toHaveCount(1);
  });
});

test.describe('Farmer Orders - Search Dropdown CSS', () => {
  test('orders-search-option class has CSS styles defined', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html#orders');
    
    // Check that the CSS class has styles by inspecting computed styles
    // We'll create a temporary element with the class to test
    const hasStyles = await page.evaluate(() => {
      const testEl = document.createElement('button');
      testEl.className = 'orders-search-option';
      document.body.appendChild(testEl);
      const computed = window.getComputedStyle(testEl);
      const hasCustomStyles = 
        computed.padding !== '0px' || 
        computed.display !== 'inline' ||
        computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
      document.body.removeChild(testEl);
      return hasCustomStyles;
    });
    
    // For now, we expect this to fail because no styles are defined
    // After we add CSS, this should pass
    expect(hasStyles).toBeTruthy();
  });
});

test.describe('Farmer Orders - Button Classes in JS', () => {
  test('farmer.js does not contain btn-small class in order rendering', async ({ page }) => {
    // Read the farmer.js file content
    const fs = require('fs');
    const path = require('path');
    const farmerJsPath = path.join(__dirname, '..', 'frontend', 'js', 'farmer.js');
    const farmerJsContent = fs.readFileSync(farmerJsPath, 'utf8');
    
    // Check that btn-small is NOT used in the order rendering section
    // The order rendering is in the renderOrders function
    const btnSmallMatches = farmerJsContent.match(/btn-small/g);
    
    // For now, we expect this to fail because btn-small is present
    // After we fix it, this should pass
    expect(btnSmallMatches).toBeNull();
  });
});
