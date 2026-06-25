const { test, expect } = require('@playwright/test');
const { loginAsFarmer } = require('./auth-helper');

test.describe('Farmer Orders - Search "pak" in Delivered Tab', () => {
  test('search for pakwan in delivered orders', async ({ page }) => {
    // Login using the auth helper (uses dhelhilis@gmail.com from database)
    await loginAsFarmer(page);
    
    // Navigate to orders section
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible
    await page.waitForSelector('#orders', { state: 'visible', timeout: 15000 });
    
    // Wait for orders to load
    await page.waitForTimeout(3000);
    
    // Click on delivered tab
    const deliveredTab = page.locator('#delivered-orders-tab');
    await deliveredTab.click();
    await page.waitForTimeout(1000);
    
    // Check initial card count
    const orderCards = page.locator('#orders-grid .order-card');
    const initialCardCount = await orderCards.count();
    console.log(`Initial order cards in delivered: ${initialCardCount}`);
    
    // Enter "pak" in search input
    const searchInput = page.locator('#orders-search-input');
    await searchInput.fill('pak');
    
    // Click search button
    const searchBtn = page.locator('#orders-search-btn');
    await searchBtn.click();
    
    // Wait for search to process
    await page.waitForTimeout(500);
    
    // Check visible cards after search
    const visibleCards = page.locator('#orders-grid .order-card');
    const visibleCardCount = await visibleCards.count();
    console.log(`Visible order cards after search: ${visibleCardCount}`);
    
    // Check which cards are actually visible (not hidden by display:none)
    let visibleCount = 0;
    for (let i = 0; i < initialCardCount; i++) {
      const card = orderCards.nth(i);
      const display = await card.evaluate(el => window.getComputedStyle(el).display);
      const searchText = await card.getAttribute('data-search-text');
      console.log(`Card ${i}: display=${display}, data-search-text="${searchText}"`);
      if (display !== 'none') visibleCount++;
    }
    
    console.log(`Cards with display != 'none': ${visibleCount}`);
    
    // Verify search input still has value
    await expect(searchInput).toHaveValue('pak');
    
    // Should have at least 1 visible card (the pakwan one)
    expect(visibleCount).toBeGreaterThan(0);
  });
  
  test('check all tabs for pakwan orders', async ({ page }) => {
    // Login using the auth helper (uses dhelhilis@gmail.com from database)
    await loginAsFarmer(page);
    
    // Navigate to orders section
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible
    await page.waitForSelector('#orders', { state: 'visible', timeout: 15000 });
    
    // Wait for orders to load
    await page.waitForTimeout(3000);
    
    // Check the orders-grid container
    const ordersGrid = page.locator('#orders-grid');
    const gridHtml = await ordersGrid.innerHTML();
    console.log('Orders grid HTML length:', gridHtml.length);
    console.log('Orders grid contains order-card:', gridHtml.includes('order-card'));
    
    // Check all tabs
    const tabs = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    for (const tab of tabs) {
      console.log(`\n=== Checking ${tab} tab ===`);
      const tabBtn = page.locator(`#${tab}-orders-tab`);
      await tabBtn.click();
      await page.waitForTimeout(1000);
      
      // Check both possible selectors
      const orderCardsInGrid = page.locator('#orders-grid .order-card');
      const gridCardCount = await orderCardsInGrid.count();
      
      const orderCardsInList = page.locator('.orders-list .order-card');
      const listCardCount = await orderCardsInList.count();
      
      console.log(`Order cards in #orders-grid: ${gridCardCount}`);
      console.log(`Order cards in .orders-list: ${listCardCount}`);
      
      // Use whichever has cards
      const cards = gridCardCount > 0 ? orderCardsInGrid : orderCardsInList;
      const cardCount = gridCardCount > 0 ? gridCardCount : listCardCount;
      
      for (let i = 0; i < cardCount; i++) {
        const card = cards.nth(i);
        const searchText = await card.getAttribute('data-search-text');
        const cardText = await card.textContent();
        console.log(`Card ${i}:`);
        console.log(`  data-search-text: ${searchText}`);
        console.log(`  visible text: ${cardText.substring(0, 150)}...`);
      }
    }
  });
});
