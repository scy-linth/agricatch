const { test, expect } = require('@playwright/test');
const { loginAsFarmer } = require('./auth-helper');

test.describe('Farmer Profile - Change Password', () => {
  test('change password form exists and has required fields', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Manually trigger profile section using farmerDashboard.showSection
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('profile');
      }
    });
    
    // Wait for profile section to become active
    await page.waitForSelector('#profile.active', { state: 'visible' });
    
    // Click on Change Password tab
    await page.click('button[data-bs-target="#profile-change-password"]');
    await page.waitForSelector('#profile-change-password', { state: 'visible' });
    
    // Check that all required fields exist
    await expect(page.locator('#pp-current')).toBeVisible();
    await expect(page.locator('#pp-new')).toBeVisible();
    await expect(page.locator('#pp-confirm')).toBeVisible();
    await expect(page.locator('#pp-submit-btn')).toBeVisible();
  });

  test('change password form has submit button with correct text', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('profile');
      }
    });
    
    await page.waitForSelector('#profile.active', { state: 'visible' });
    await page.click('button[data-bs-target="#profile-change-password"]');
    await page.waitForSelector('#profile-change-password', { state: 'visible' });
    
    const submitBtn = page.locator('#pp-submit-btn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Change Password');
  });

  test('password fields have toggle visibility buttons', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('profile');
      }
    });
    
    await page.waitForSelector('#profile.active', { state: 'visible' });
    await page.click('button[data-bs-target="#profile-change-password"]');
    await page.waitForSelector('#profile-change-password', { state: 'visible' });
    
    // Check that each password field has a toggle button
    const currentToggle = page.locator('#pp-current').locator('xpath=following-sibling::button');
    const newToggle = page.locator('#pp-new').locator('xpath=following-sibling::button');
    const confirmToggle = page.locator('#pp-confirm').locator('xpath=following-sibling::button');
    
    await expect(currentToggle).toBeVisible();
    await expect(newToggle).toBeVisible();
    await expect(confirmToggle).toBeVisible();
  });

  test('error message container exists', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('profile');
      }
    });
    
    await page.waitForSelector('#profile.active', { state: 'visible' });
    await page.click('button[data-bs-target="#profile-change-password"]');
    await page.waitForSelector('#profile-change-password', { state: 'visible' });
    
    const errorDiv = page.locator('#pp-error');
    // Error div exists in DOM but is hidden by default (d-none class)
    await expect(errorDiv).toHaveCount(1);
    await expect(errorDiv).toHaveClass(/alert/);
    await expect(errorDiv).toHaveClass(/danger/);
  });

  test('form is inside a form element', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    await page.evaluate(() => {
      if (window.farmerDashboard && window.farmerDashboard.showSection) {
        window.farmerDashboard.showSection('profile');
      }
    });
    
    await page.waitForSelector('#profile.active', { state: 'visible' });
    
    // Click on Change Password tab
    await page.click('button[data-bs-target="#profile-change-password"]');
    await page.waitForSelector('#profile-change-password', { state: 'visible' });
    
    const form = page.locator('#profile-password-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('id', 'profile-password-form');
  });
});
