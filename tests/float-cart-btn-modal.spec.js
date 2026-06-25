const { test, expect } = require('@playwright/test');

test('floating cart button is hidden and not clickable when product details modal is open', async ({ page }) => {
  // Navigate to the landing page and wait for it to load
  await page.goto('/index.html');
  await page.waitForSelector('#products-grid', { timeout: 10000 });

  const cartBtn = page.locator('#cart-btn');
  const modal = page.locator('#product-details-modal');

  // Check initial state: visible, near bottom-right, and green
  await expect(cartBtn).toBeVisible();
  const initialBox = await cartBtn.boundingBox();
  expect(initialBox).not.toBeNull();
  expect(initialBox.x + initialBox.width).toBeGreaterThan(1200); // near right edge
  expect(initialBox.y + initialBox.height).toBeGreaterThan(600);  // near bottom edge

  const initialBg = await cartBtn.evaluate(el => {
    const computed = window.getComputedStyle(el);
    return computed.backgroundColor || computed.background;
  });
  expect(initialBg).toMatch(/rgb\(74, 222, 128\)|#4ade80/);

  // Open the first product card that has a valid product id
  const firstProductCard = page.locator('.product-card').first();
  await expect(firstProductCard).toBeVisible();
  await firstProductCard.click();

  // Wait for product details modal to open
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  await expect(modal).toHaveClass(/active/);

  // Cart button should be hidden (no white background showing through)
  await expect(cartBtn).toBeHidden();

  // Cart button should not be clickable - clicking it should not open the cart drawer
  const cartDrawer = page.locator('#cart-drawer');
  await cartBtn.click({ force: true });
  await expect(cartDrawer).not.toBeVisible();

  // Close the modal and verify cart button reappears
  await page.locator('#close-product-details').click();
  await expect(modal).not.toHaveClass(/active/);
  await expect(cartBtn).toBeVisible();
});
