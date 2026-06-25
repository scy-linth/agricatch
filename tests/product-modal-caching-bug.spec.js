const { test, expect } = require('@playwright/test');

test.describe('Product Modal Caching Bug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should not show previous product details when switching products', async ({ page }) => {
    // Find first product card (e.g., chico)
    const firstProduct = page.locator('.product-card').first();
    await firstProduct.click();
    
    // Wait for modal to open and load
    await page.waitForSelector('#product-details-modal.active', { timeout: 5000 });
    await page.waitForTimeout(1000); // Wait for data to populate
    
    // Get first product name
    const firstName = await page.locator('#product-details-name').textContent();
    console.log('First product name:', firstName);
    
    // Close modal
    await page.click('#close-product-details');
    await page.waitForSelector('#product-details-modal:not(.active)', { timeout: 3000 });
    
    // Wait a moment
    await page.waitForTimeout(500);
    
    // Click second product (e.g., brown rice)
    const secondProduct = page.locator('.product-card').nth(1);
    await secondProduct.click();
    
    // Wait for modal to open
    await page.waitForSelector('#product-details-modal.active', { timeout: 5000 });
    
    // Immediately check if the name shows the first product before updating
    // This is the bug - old data briefly visible
    const immediateName = await page.locator('#product-details-name').textContent();
    console.log('Immediate name after opening second product:', immediateName);
    
    // Wait for data to fully load
    await page.waitForTimeout(1500);
    
    const finalName = await page.locator('#product-details-name').textContent();
    console.log('Final name after loading:', finalName);
    
    // The bug is if immediateName shows firstName instead of loading state or secondName
    // After fix, immediateName should either be loading state or already show second product
    expect(immediateName).not.toBe(firstName);
  });

  test('should clear all fields when showing loading state', async ({ page }) => {
    // Open first product
    const firstProduct = page.locator('.product-card').first();
    await firstProduct.click();
    await page.waitForSelector('#product-details-modal.active', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Get first product data
    const firstName = await page.locator('#product-details-name').textContent();
    const firstPrice = await page.locator('#product-details-price').textContent();
    const firstFarmer = await page.locator('#product-details-farmer').textContent();
    
    console.log('First product - Name:', firstName, 'Price:', firstPrice, 'Farmer:', firstFarmer);
    
    // Close modal
    await page.click('#close-product-details');
    await page.waitForSelector('#product-details-modal:not(.active)', { timeout: 3000 });
    await page.waitForTimeout(500);
    
    // Open second product
    const secondProduct = page.locator('.product-card').nth(1);
    await secondProduct.click();
    await page.waitForSelector('#product-details-modal.active', { timeout: 5000 });
    
    // Immediately check all fields - they should not show first product data
    const immediatePrice = await page.locator('#product-details-price').textContent();
    const immediateFarmer = await page.locator('#product-details-farmer').textContent();
    
    console.log('Immediate second product - Price:', immediatePrice, 'Farmer:', immediateFarmer);
    
    // After fix, these should not equal the first product's data
    expect(immediatePrice).not.toBe(firstPrice);
    expect(immediateFarmer).not.toBe(firstFarmer);
  });
});
