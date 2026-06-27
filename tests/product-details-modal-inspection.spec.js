const { test, expect } = require('@playwright/test');

test.describe('Product Details Modal - DOM Inspection', () => {
  test('Inspect Product Details Modal structure', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Find a product card and click to open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    // Get all elements in the modal
    const modal = page.locator('.product-details-modal, .modal, .product-modal').first();
    if (await modal.isVisible()) {
      console.log('Modal is visible');
      
      // Get all text content
      const modalText = await modal.textContent();
      console.log('Modal Text Content:', modalText);

      // Get all images
      const images = await modal.locator('img').all();
      console.log(`Found ${images.length} images in modal`);
      for (const img of images) {
        const src = await img.getAttribute('src');
        const alt = await img.getAttribute('alt');
        console.log(`Image: src=${src}, alt=${alt}`);
      }

      // Get all buttons
      const buttons = await modal.locator('button').all();
      console.log(`Found ${buttons.length} buttons in modal`);
      for (const btn of buttons) {
        const text = await btn.textContent();
        const classes = await btn.getAttribute('class');
        console.log(`Button: text=${text}, classes=${classes}`);
      }

      // Get all badges
      const badges = await modal.locator('.badge, .product-type-badge, .harvest-badge').all();
      console.log(`Found ${badges.length} badges in modal`);
      for (const badge of badges) {
        const text = await badge.textContent();
        const classes = await badge.getAttribute('class');
        console.log(`Badge: text=${text}, classes=${classes}`);
      }

      // Get harvest information
      const harvestInfo = await modal.locator('.harvest-info, .harvest-date, .expected-harvest').all();
      console.log(`Found ${harvestInfo.length} harvest info elements`);
      for (const info of harvestInfo) {
        const text = await info.textContent();
        console.log(`Harvest Info: ${text}`);
      }

      // Get modal class and id
      const modalClass = await modal.getAttribute('class');
      const modalId = await modal.getAttribute('id');
      console.log(`Modal class: ${modalClass}, id: ${modalId}`);
    } else {
      console.log('Modal not found or not visible');
    }

    // Close modal
    const closeButton = page.locator('.close-modal, .modal-close, button[aria-label="Close"]').first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    await page.waitForTimeout(1000);
  });
});
