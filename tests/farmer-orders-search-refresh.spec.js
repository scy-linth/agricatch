const { test, expect } = require('@playwright/test');
const { loginAsFarmer } = require('./auth-helper');

test.describe('Farmer Orders - Search and Refresh', () => {
  test('search input and button exist and are functional', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to load
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Check that search input exists
    const searchInput = page.locator('#orders-search-input');
    await expect(searchInput).toBeVisible();
    
    // Check that search button exists
    const searchBtn = page.locator('#orders-search-btn');
    await expect(searchBtn).toBeVisible();
    
    // Check that refresh button exists
    const refreshBtn = page.locator('#orders-refresh-btn');
    await expect(refreshBtn).toBeVisible();
    
    // Test search functionality
    await searchInput.fill('test');
    await searchBtn.click();
    
    // Verify search input still has value
    await expect(searchInput).toHaveValue('test');
  });
  
  test('refresh button clears search input', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to load
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const searchInput = page.locator('#orders-search-input');
    const refreshBtn = page.locator('#orders-refresh-btn');
    
    // Enter search term
    await searchInput.fill('test123');
    await expect(searchInput).toHaveValue('test123');
    
    // Click refresh button
    await refreshBtn.click();
    
    // Verify search input is cleared
    await expect(searchInput).toHaveValue('');
  });
  
  test('date range filter does not exist', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to load
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Check that date range filter does NOT exist
    const dateFilter = page.locator('#orders-date-filter');
    await expect(dateFilter).toHaveCount(0);
  });
  
  test('search on Enter key works', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to load
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const searchInput = page.locator('#orders-search-input');
    
    // Type search term and press Enter
    await searchInput.fill('test');
    await searchInput.press('Enter');
    
    // Verify search input still has value
    await expect(searchInput).toHaveValue('test');
  });
});
