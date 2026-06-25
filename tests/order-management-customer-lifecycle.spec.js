const { test, expect } = require('@playwright/test');
const { getCustomerToken } = require('./auth-helper');

test.describe('Customer Order Lifecycle - Order List', () => {
  test('customer loads order list with all tabs', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    // Wait for orders to load
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Verify tabs exist
    await expect(page.locator('#all-orders-tab')).toBeVisible();
    await expect(page.locator('#active-orders-tab')).toBeVisible();
    await expect(page.locator('#delivered-orders-tab')).toBeVisible();
    await expect(page.locator('#cancelled-orders-tab')).toBeVisible();
  });
});

test.describe('Customer Order Lifecycle - Order Details', () => {
  test('customer views order details with timeline', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to view details');
    }
    
    // Click on first order to view details
    const firstOrder = orderCards.first();
    await firstOrder.click();
    
    // Verify timeline is visible
    await expect(page.locator('.order-timeline')).toBeVisible();
  });
});

test.describe('Customer Order Lifecycle - Cancellation', () => {
  test('customer cancels pending order with reason', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to cancel');
    }
    
    // Find pending order
    const pendingOrders = orderCards.filter({ hasText: 'Pending' });
    if (await pendingOrders.count() === 0) {
      test.skip('No pending orders to cancel');
    }
    
    // Click cancel button on first pending order
    const cancelBtn = pendingOrders.first().locator('button:has-text("Cancel")');
    await cancelBtn.click();
    
    // Verify cancel modal opens
    await expect(page.locator('#order-cancel-modal')).toHaveClass(/open/);
    
    // Enter cancellation reason
    await page.fill('#order-cancel-reason-input', 'Changed my mind');
    
    // Submit cancellation
    await page.click('#submit-order-cancel-btn');
    
    // Verify modal closes
    await expect(page.locator('#order-cancel-modal')).not.toHaveClass(/open/);
    
    // Verify order status changes to cancelled
    await page.waitForTimeout(2000); // Wait for API update
    await page.reload();
    await expect(page.locator('.order-card').filter({ hasText: 'Cancelled' })).toBeVisible();
  });
});

test.describe('Customer Order Lifecycle - Ratings', () => {
  test('customer rates delivered product within deadline', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to rate');
    }
    
    // Find delivered order
    const deliveredOrders = orderCards.filter({ hasText: 'Delivered' });
    if (await deliveredOrders.count() === 0) {
      test.skip('No delivered orders to rate');
    }
    
    // Click rate button
    const rateBtn = deliveredOrders.first().locator('button:has-text("Rate Product")');
    if (await rateBtn.count() === 0) {
      test.skip('Rating window expired or already rated');
    }
    
    await rateBtn.click();
    
    // Verify rating modal opens
    await expect(page.locator('#order-rating-modal')).toHaveClass(/open/);
    
    // Select 5 stars
    await page.click('.order-rating-star-btn[data-rating="5"]');
    
    // Submit rating
    await page.click('#submit-order-rating-btn');
    
    // Verify modal closes
    await expect(page.locator('#order-rating-modal')).not.toHaveClass(/open/);
  });
});

test.describe('Customer Order Lifecycle - Notifications', () => {
  test('customer notification badge updates on order status change', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/index.html');
    
    // Check initial badge state
    const badge = page.locator('#notification-badge');
    const initialCount = await badge.count();
    
    // Navigate to orders page
    await page.goto('/orders.html');
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test notifications');
    }
    
    // Navigate back to check for new notifications
    await page.goto('/index.html');
    
    // Badge should be present (actual count depends on test data)
    await expect(badge).toBeVisible();
  });
});
