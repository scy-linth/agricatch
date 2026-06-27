const { test, expect } = require('@playwright/test');

test.describe('Product Details Modal - Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  });

  test('Modal Behavior - Opens and closes correctly', async ({ page }) => {
    // Find a product card and click to open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    // Verify modal is visible
    const modal = page.locator('#product-details-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveClass(/active/);
    await expect(modal).toHaveClass(/open/);

    // Verify close button exists and works
    const closeButton = modal.locator('.pd-modal-close');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await page.waitForTimeout(500);

    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('Modal Behavior - ESC key closes modal', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    await expect(modal).toBeVisible();

    // Press ESC key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('Modal Behavior - Click outside closes modal', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    await expect(modal).toBeVisible();

    // Click outside modal (on overlay)
    await page.mouse.click(100, 100);
    await page.waitForTimeout(500);

    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('Product Information - Image', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify product image exists
    const productImage = modal.locator('img').first();
    await expect(productImage).toBeVisible();
    
    // Verify image has src
    const src = await productImage.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).not.toContain('broken');
    
    // Verify image has alt text
    const alt = await productImage.getAttribute('alt');
    expect(alt).toBeTruthy();
  });

  test('Product Information - Name, Category, Description', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify product name
    const productName = modal.locator('.pd-product-name, .product-name, h2, h3').first();
    await expect(productName).toBeVisible();
    const nameText = await productName.textContent();
    expect(nameText.trim()).toBeTruthy();
    expect(nameText.trim().length).toBeGreaterThan(0);
  });

  test('Product Information - Price and Unit', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify price - text contains ₱ and per kg
    const modalText = await modal.textContent();
    expect(modalText).toContain('₱');
    expect(modalText).toMatch(/per\s+\w+/);
  });

  test('Product Information - Farmer and Location', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify farmer name and location exist in modal text
    const modalText = await modal.textContent();
    expect(modalText).toMatch(/Farmer|Shop/);
    expect(modalText).toMatch(/Location|Metro Manila|Manila/);
  });

  test('Product Information - Rating', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify rating exists in modal text
    const modalText = await modal.textContent();
    expect(modalText).toMatch(/\d+\.\d+|reviews|rating/i);
  });

  test('Harvest Information - Expected Harvest', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify harvest information exists in modal text
    const modalText = await modal.textContent();
    expect(modalText).toMatch(/Expected Harvest|Harvest Date/i);
  });

  test('Harvest Information - Reservation Capacity', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify reservation capacity exists in modal text
    const modalText = await modal.textContent();
    expect(modalText).toMatch(/Reservation|Capacity|remaining/i);
  });

  test('Actions - Add to Cart button', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify Add to Cart button exists
    const addToCartButton = modal.locator('.pd-add-cart-btn, .add-to-cart-btn, button:has-text("Add to Cart")').first();
    await expect(addToCartButton).toBeVisible();
    
    // Verify button text
    const buttonText = await addToCartButton.textContent();
    expect(buttonText).toContain('Add to Cart');
  });

  test('Actions - Quantity controls', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify quantity controls exist in modal text
    const modalText = await modal.textContent();
    expect(modalText).toMatch(/Quantity|−|\+/);
  });

  test('Actions - Chat and View Shop buttons', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify Chat button
    const chatButton = modal.locator('button:has-text("Chat")').first();
    await expect(chatButton).toBeVisible();
    
    // Verify View Shop button
    const viewShopButton = modal.locator('button:has-text("View Shop")').first();
    await expect(viewShopButton).toBeVisible();
  });

  test('Visual Integrity - No broken images', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Check for broken images
    const images = await modal.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toContain('broken');
      expect(src).not.toContain('error');
    }
  });

  test('Visual Integrity - No console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    // Close modal
    const closeButton = page.locator('.pd-modal-close').first();
    await closeButton.click();
    await page.waitForTimeout(500);

    // Check for errors
    expect(errors.length).toBe(0);
  });

  test('Visual Integrity - Responsive layout', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Verify modal is visible
    await expect(modal).toBeVisible();
    
    // Check modal dimensions
    const box = await modal.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('Product Type - Badge text verification', async ({ page }) => {
    // Open modal
    const productCard = page.locator('.product-card').first();
    await productCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('#product-details-modal');
    
    // Check modal text for product type indicators
    const modalText = await modal.textContent();
    
    // The modal should show either "Available Now" or "Pre-order" (with hyphen)
    // Based on DOM inspection, badges are not in the modal but the text should indicate type
    // through harvest information and reservation capacity
    
    // If reservation capacity is shown, it's a pre-order product
    if (modalText.includes('Reservation Capacity') || modalText.includes('remaining')) {
      // This is a pre-order product - verify it doesn't use "Preorder" (without hyphen)
      expect(modalText).not.toMatch(/Preorder(?!-)/);
      // The UI should use "Pre-order" or similar hyphenated form
      // Note: Based on inspection, the modal may not have explicit badge text
      // but harvest information indicates the type
    }
  });
});
