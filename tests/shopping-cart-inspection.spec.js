const { test, expect } = require('@playwright/test');

test.describe('Shopping Cart - DOM Inspection', () => {
  test('Inspect Shopping Cart structure', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Find all buttons that might be cart buttons
    const allButtons = await page.locator('button').all();
    console.log(`Found ${allButtons.length} buttons on page`);
    for (const btn of allButtons) {
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const classes = await btn.getAttribute('class');
      const id = await btn.getAttribute('id');
      console.log(`Button: text="${text.trim()}", aria-label="${ariaLabel}", class="${classes}", id="${id}"`);
    }

    // Look for cart-related elements
    const cartElements = await page.locator('[class*="cart"], [id*="cart"]').all();
    console.log(`Found ${cartElements.length} cart-related elements`);
    for (const el of cartElements) {
      const tag = await el.evaluate(e => e.tagName);
      const id = await el.getAttribute('id');
      const classes = await el.getAttribute('class');
      console.log(`Cart element: tag=${tag}, id=${id}, class=${classes}`);
    }
  });
});
