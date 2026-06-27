const { test, expect } = require('@playwright/test');

test('Navigate to Farmer Products section', async ({ page, context }) => {
  // Use existing session (already logged in via Browser MCP)
  await page.goto('http://localhost:3000/farmer.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  
  // Navigate to products section via JavaScript (bypass click issues)
  await page.evaluate(() => {
    const link = document.querySelector('a[data-section="products"]');
    if (link) link.click();
  });
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/farmer-products-section.png', fullPage: true });
  
  console.log('Screenshot saved to test-results/farmer-products-section.png');
});
