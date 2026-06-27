const { test, expect } = require('@playwright/test');

test('Customer Orders - Debug loading issue', async ({ page }) => {
  // Listen to network requests
  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/orders')) {
      apiRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/orders')) {
      const body = await response.text();
      console.log('API Response:', response.status(), body);
    }
  });

  // Navigate to orders page
  await page.goto('http://localhost:3000/orders.html');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Check console logs
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });
  
  // Wait a bit for any async operations
  await page.waitForTimeout(3000);
  
  // Print console messages
  console.log('Console messages:', consoleMessages);
  
  // Print API requests
  console.log('API requests made:', apiRequests);
  
  // Check if orders are displayed
  const ordersList = page.locator('.order-card');
  const count = await ordersList.count();
  console.log('Order cards found:', count);
  
  // Check for empty state
  const emptyState = page.locator('.empty-state');
  const hasEmptyState = await emptyState.count() > 0;
  console.log('Has empty state:', hasEmptyState);
  
  if (hasEmptyState) {
    const emptyText = await emptyState.textContent();
    console.log('Empty state text:', emptyText);
  }
  
  // Check localStorage for token
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token exists:', !!token);
  console.log('Token (first 50 chars):', token ? token.substring(0, 50) : 'none');
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/customer-orders-debug.png' });
});
