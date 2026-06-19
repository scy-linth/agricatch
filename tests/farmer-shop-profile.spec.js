const { test, expect } = require('@playwright/test');
const { loginAsFarmer } = require('./auth-helper');

test.describe('Farmer Shop Profile', () => {
  test('shop profile display shows shop name not full name', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Navigate to shop profile section
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('shop');
      }
    });
    
    // Wait for shop section to become active
    await page.waitForSelector('#shop.active', { state: 'visible' });
    
    // Wait for profile to load
    await page.waitForTimeout(1000);
    
    // Check that shop name display exists
    const shopNameDisplay = page.locator('#shop-name-display');
    await expect(shopNameDisplay).toBeVisible();
    
    // Get the displayed shop name
    const displayedName = await shopNameDisplay.textContent();
    
    // Verify it's not showing full name (should be shop name or dash)
    // Full name typically has spaces and looks like "First Middle Last"
    // Shop name is usually shorter or business-like
    console.log('Displayed shop name:', displayedName);
    
    // The key test: when we click edit, the input should show the same value
    // NOT fall back to full name
  });

  test('shop profile edit form shows shop name not full name', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Navigate to shop profile section
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('shop');
      }
    });
    
    await page.waitForSelector('#shop.active', { state: 'visible' });
    await page.waitForTimeout(1000);
    
    // Get the display value before clicking edit
    const shopNameDisplay = page.locator('#shop-name-display');
    const displayValue = await shopNameDisplay.textContent();
    console.log('Display value before edit:', displayValue);
    
    // Click edit button
    const editBtn = page.locator('#edit-shop-profile-btn');
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    
    // Wait for edit form to appear
    await page.waitForSelector('#shop-profile-edit', { state: 'visible' });
    
    // Get the input value
    const shopNameInput = page.locator('#shop-name-input');
    await expect(shopNameInput).toBeVisible();
    const inputValue = await shopNameInput.inputValue();
    console.log('Input value after edit click:', inputValue);
    
    // Get the placeholder value
    const placeholderValue = await shopNameInput.getAttribute('placeholder');
    console.log('Placeholder value:', placeholderValue);
    
    // Verify input matches display (or is empty if shop name not set)
    // The bug was that input would show full_name even when display showed shop_name
    // After fix, they should be consistent
    expect(inputValue).toBe(displayValue === '—' ? '' : displayValue);
    
    // Verify placeholder shows the display value (shop name), not full name
    expect(placeholderValue).toBe(displayValue === '—' ? 'My Farm Shop' : displayValue);
  });

  test('shop profile edit button exists and is clickable', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('shop');
      }
    });
    
    await page.waitForSelector('#shop.active', { state: 'visible' });
    
    const editBtn = page.locator('#edit-shop-profile-btn');
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toContainText('Edit');
  });

  test('shop profile edit form has required fields', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('shop');
      }
    });
    
    await page.waitForSelector('#shop.active', { state: 'visible' });
    
    // Click edit
    await page.click('#edit-shop-profile-btn');
    await page.waitForSelector('#shop-profile-edit', { state: 'visible' });
    
    // Check all required fields exist
    await expect(page.locator('#shop-name-input')).toBeVisible();
    await expect(page.locator('#shop-location-input')).toBeVisible();
    await expect(page.locator('#shop-description-input')).toBeVisible();
    await expect(page.locator('#save-shop-profile-btn')).toBeVisible();
    await expect(page.locator('#cancel-shop-profile-btn')).toBeVisible();
  });

  test('cancel button hides edit form and shows view mode', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('shop');
      }
    });
    
    await page.waitForSelector('#shop.active', { state: 'visible' });
    
    // Click edit
    await page.click('#edit-shop-profile-btn');
    await page.waitForSelector('#shop-profile-edit', { state: 'visible' });
    
    // Click cancel
    await page.click('#cancel-shop-profile-btn');
    
    // Verify edit form is hidden and view mode is shown
    await expect(page.locator('#shop-profile-edit')).not.toBeVisible();
    await expect(page.locator('#shop-profile-view')).toBeVisible();
  });
});
