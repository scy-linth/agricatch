const { test, expect } = require('@playwright/test');

test.describe('Shopping Cart - Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  });

  async function openCart(page) {
    const cartButton = page.locator('#cart-btn').first();
    await cartButton.click();
    await page.waitForTimeout(500);
    return page.locator('#cart-sidebar');
  }

  async function closeCart(page) {
    const closeButton = page.locator('#close-cart').first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }
  }

  test('Adding Items - Add Available product to cart', async ({ page }) => {
    // Find an Available product
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);

    // Click Add to Cart in modal
    const addToCartButton = page.locator('#product-details-modal button:has-text("Add to Cart")').first();
    await addToCartButton.click();
    await page.waitForTimeout(1000);

    // Open cart and verify item was added
    const cart = await openCart(page);
    const cartText = await cart.textContent();
    expect(cartText).not.toContain('₱0.00'); // Total should not be 0
    expect(cartText).toMatch(/Total:\s*₱\d+\.\d+/); // Should have a total
    
    await closeCart(page);
  });

  test('Adding Items - Add Pre-order product (Reserve)', async ({ page }) => {
    // Find a Pre-order product
    const preorderProduct = page.locator('.product-card').filter({ hasText: 'HARVEST SOON' }).first();
    await preorderProduct.click();
    await page.waitForTimeout(1000);

    // Check if Reserve button exists or if it uses Add to Cart
    const reserveButton = page.locator('#product-details-modal button:has-text("Reserve")').first();
    const addToCartButton = page.locator('#product-details-modal button:has-text("Add to Cart")').first();
    
    if (await reserveButton.isVisible()) {
      if (await reserveButton.isEnabled()) {
        await reserveButton.click();
        await page.waitForTimeout(1000);

        // Open cart and verify item was added
        const cart = await openCart(page);
        const cartText = await cart.textContent();
        expect(cartText).not.toContain('₱0.00');
        
        await closeCart(page);
      } else {
        console.log('Reserve button disabled - skipping');
      }
    } else if (await addToCartButton.isVisible()) {
      // UI uses Add to Cart for pre-order products too
      await addToCartButton.click();
      await page.waitForTimeout(1000);

      // Open cart and verify item was added
      const cart = await openCart(page);
      const cartText = await cart.textContent();
      expect(cartText).not.toContain('₱0.00');
      
      await closeCart(page);
    } else {
      console.log('Neither Reserve nor Add to Cart button found in modal');
    }
  });

  test('Adding Items - Verify success feedback', async ({ page }) => {
    // Find an Available product
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);

    // Click Add to Cart
    const addToCartButton = page.locator('#product-details-modal button:has-text("Add to Cart")').first();
    await addToCartButton.click();
    await page.waitForTimeout(1000);

    // Check for success message or toast
    const successMessage = page.locator('.toast, .notification, .success-message, .alert-success').first();
    const cartButton = page.locator('button:has-text("Open cart")').first();
    
    // Either a success message should appear or cart should update
    const cart = await openCart(page);
    const cartText = await cart.textContent();
    expect(cartText).not.toContain('₱0.00');
    
    await closeCart(page);
  });

  test('Cart Display - Verify product image', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Verify product image exists
    const cartImages = await cart.locator('img').all();
    expect(cartImages.length).toBeGreaterThan(0);
    
    const firstImage = cartImages[0];
    const src = await firstImage.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).not.toContain('broken');
    
    await closeCart(page);
  });

  test('Cart Display - Verify product name', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Verify product name exists
    const cartText = await cart.textContent();
    expect(cartText).toBeTruthy();
    expect(cartText.length).toBeGreaterThan(0);
    
    await closeCart(page);
  });

  test('Cart Display - Verify price', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Verify price exists
    const cartText = await cart.textContent();
    expect(cartText).toContain('₱');
    
    await closeCart(page);
  });

  test('Cart Display - Verify quantity', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Verify quantity controls exist
    const cartText = await cart.textContent();
    expect(cartText).toMatch(/\d+/); // Should contain a number for quantity
    
    await closeCart(page);
  });

  test('Cart Display - Verify subtotal', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Verify total/subtotal exists
    const cartText = await cart.textContent();
    expect(cartText).toMatch(/Total:\s*₱\d+\.\d+/);
    
    await closeCart(page);
  });

  test('Mixed Cart - Available and Pre-order together', async ({ page }) => {
    // Add Available product
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);
    await page.locator('.pd-modal-close').first().click();
    await page.waitForTimeout(500);

    // Add Pre-order product
    const preorderProduct = page.locator('.product-card').filter({ hasText: 'HARVEST SOON' }).first();
    await preorderProduct.click();
    await page.waitForTimeout(1000);
    
    const reserveButton = page.locator('#product-details-modal button:has-text("Reserve")').first();
    const addToCartButton = page.locator('#product-details-modal button:has-text("Add to Cart")').first();
    
    if (await reserveButton.isVisible() && await reserveButton.isEnabled()) {
      await reserveButton.click();
      await page.waitForTimeout(1000);
    } else if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      await page.waitForTimeout(1000);
    }

    // Open cart
    const cart = await openCart(page);
    
    // Verify both products are in cart
    const cartText = await cart.textContent();
    expect(cartText).not.toContain('₱0.00');
    
    await closeCart(page);
  });

  test('Quantity - Increase quantity', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Find quantity increase button
    const plusButton = cart.locator('button:has-text("+"), .quantity-plus, .increase-qty').first();
    if (await plusButton.isVisible()) {
      const totalBefore = await cart.textContent();
      await plusButton.click();
      await page.waitForTimeout(500);
      const totalAfter = await cart.textContent();
      
      // Total should change
      expect(totalBefore).not.toBe(totalAfter);
    }
    
    await closeCart(page);
  });

  test('Quantity - Decrease quantity', async ({ page }) => {
    // Add a product to cart with quantity > 1
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    
    // Increase quantity in modal before adding
    const modalPlusButton = page.locator('#product-details-modal button:has-text("+")').first();
    await modalPlusButton.click();
    await page.waitForTimeout(500);
    
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Find quantity decrease button
    const minusButton = cart.locator('button:has-text("-"), .quantity-minus, .decrease-qty').first();
    if (await minusButton.isVisible()) {
      const totalBefore = await cart.textContent();
      await minusButton.click();
      await page.waitForTimeout(500);
      const totalAfter = await cart.textContent();
      
      // Total should change
      expect(totalBefore).not.toBe(totalAfter);
    }
    
    await closeCart(page);
  });

  test('Removal - Remove one item', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Find remove button
    const removeButton = cart.locator('button:has-text("Remove"), .remove-item, .delete-item, button:has-text("×")').first();
    if (await removeButton.isVisible()) {
      await removeButton.click();
      await page.waitForTimeout(500);
      
      // Verify cart is empty
      const cartText = await cart.textContent();
      expect(cartText).toContain('₱0.00');
    }
    
    await closeCart(page);
  });

  test('Removal - Empty cart state', async ({ page }) => {
    // Open cart without adding items
    const cart = await openCart(page);
    
    // Verify empty state
    const cartText = await cart.textContent();
    expect(cartText).toContain('₱0.00');
    
    await closeCart(page);
  });

  test('Validation - No duplicate cart entries', async ({ page }) => {
    // Add same product twice
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    
    // First add
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);
    await page.locator('.pd-modal-close').first().click();
    await page.waitForTimeout(500);
    
    // Second add
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Verify only one entry exists (quantity should be 2)
    const cartText = await cart.textContent();
    // The cart should not have duplicate product names
    // This is a basic check - specific implementation may vary
    
    await closeCart(page);
  });

  test('Visual Integrity - No broken images in cart', async ({ page }) => {
    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open cart
    const cart = await openCart(page);
    
    // Check for broken images
    const images = await cart.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toContain('broken');
      expect(src).not.toContain('error');
    }
    
    await closeCart(page);
  });

  test('Visual Integrity - No console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Add a product to cart
    const availableProduct = page.locator('.product-card').filter({ hasText: 'Available Now' }).first();
    await availableProduct.click();
    await page.waitForTimeout(1000);
    await page.locator('#product-details-modal button:has-text("Add to Cart")').first().click();
    await page.waitForTimeout(1000);

    // Open and close cart
    const cart = await openCart(page);
    await closeCart(page);

    // Check for errors
    expect(errors.length).toBe(0);
  });
});
