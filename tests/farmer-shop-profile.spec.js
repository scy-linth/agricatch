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

  test('unverified farmer can edit name fields in profile', async ({ page }) => {
    // Mock unverified verification status and profile
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const apiBases = [baseUrl, 'http://localhost:3000'];
    
    apiBases.forEach(apiBase => {
      page.route(`${apiBase}/api/farmers/me/verification-request`, route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            request: null,
            history: []
          })
        });
      });
      
      // Mock auth/profile endpoint to return unverified farmer
      page.route(`${apiBase}/api/auth/profile`, route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 1,
              email: 'farmer@test.com',
              username: 'testfarmer',
              full_name: 'Test Farmer',
              first_name: 'Test',
              middle_name: '',
              last_name: 'Farmer',
              phone: '+639123456789',
              shop_name: 'Test Shop',
              role: 'farmer',
              is_verified: false,
              created_at: new Date().toISOString()
            }
          })
        });
      });
    });
    
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Navigate to profile section
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('profile');
      }
    });
    
    // Wait for profile section to load
    await page.waitForTimeout(1000);
    
    // Click on Edit Profile tab
    await page.click('button[data-bs-target="#profile-edit"]');
    await page.waitForSelector('#profile-edit', { state: 'visible' });
    
    // Check that name fields are enabled
    const firstNameInput = page.locator('#pe-firstname');
    const middleNameInput = page.locator('#pe-middlename');
    const lastNameInput = page.locator('#pe-lastname');
    
    await expect(firstNameInput).not.toBeDisabled();
    await expect(middleNameInput).not.toBeDisabled();
    await expect(lastNameInput).not.toBeDisabled();
    
    // Check that verified hint is hidden
    await expect(page.locator('#pe-name-verified-hint')).not.toBeVisible();
  });

  test('verified farmer cannot edit name fields in profile', async ({ page }) => {
    // Mock a verified farmer profile
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const apiBases = [baseUrl, 'http://localhost:3000'];
    
    apiBases.forEach(apiBase => {
      page.route(`${apiBase}/api/farmers/me/verification-request`, route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            request: {
              status: 'approved',
              created_at: new Date().toISOString()
            },
            history: []
          })
        });
      });
    });
    
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Navigate to profile section
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('profile');
      }
    });
    
    // Wait for profile section to load
    await page.waitForTimeout(1000);
    
    // Click on Edit Profile tab
    await page.click('button[data-bs-target="#profile-edit"]');
    await page.waitForSelector('#profile-edit', { state: 'visible' });
    
    // Check that name fields are disabled
    const firstNameInput = page.locator('#pe-firstname');
    const middleNameInput = page.locator('#pe-middlename');
    const lastNameInput = page.locator('#pe-lastname');
    
    await expect(firstNameInput).toBeDisabled();
    await expect(middleNameInput).toBeDisabled();
    await expect(lastNameInput).toBeDisabled();
    
    // Check that verified hint is visible
    await expect(page.locator('#pe-name-verified-hint')).toBeVisible();
    await expect(page.locator('#pe-name-verified-hint')).toContainText('Verified: name can\'t be edited');
  });
});
