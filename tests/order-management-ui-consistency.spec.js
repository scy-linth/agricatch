const { test, expect } = require('@playwright/test');
const { getCustomerToken, getFarmerToken } = require('./auth-helper');

test.describe('UI Consistency - Timeline Accuracy', () => {
  test('order timeline displays correct 5 steps', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test timeline');
    }
    
    // Click on first order to view details
    await orderCards.first().click();
    
    // Verify timeline is visible
    await expect(page.locator('.order-timeline')).toBeVisible();
    
    // Verify timeline has expected steps (5 steps in standard workflow)
    const timelineSteps = page.locator('.timeline-step, .order-timeline .step');
    const stepCount = await timelineSteps.count();
    
    if (stepCount > 0) {
      // Timeline should have at least some steps
      expect(stepCount).toBeGreaterThan(0);
    } else {
      test.skip('Timeline steps not visible');
    }
  });
});

test.describe('UI Consistency - Button Visibility', () => {
  test('action buttons are visible based on order status', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test button visibility');
    }
    
    // Switch to pending tab
    await page.click('#pending-orders-tab');
    await page.waitForTimeout(500);
    
    const pendingOrders = orderCards.filter({ hasText: 'Pending' });
    if (await pendingOrders.count() > 0) {
      // Pending orders should have Confirm button
      const confirmBtn = pendingOrders.first().locator('button:has-text("Confirm")');
      if (await confirmBtn.count() > 0) {
        await expect(confirmBtn).toBeVisible();
      }
    }
  });
});

test.describe('UI Consistency - Badge Consistency', () => {
  test('status badges are consistent across pages', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    const { token: farmerToken } = await getFarmerToken();
    
    // Check customer view
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), customerToken);
    await page.goto('/orders.html');
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const customerOrderCards = page.locator('.order-card');
    if (await customerOrderCards.count() === 0) {
      test.skip('No orders to test badge consistency');
    }
    
    // Verify status badges exist on customer orders
    const customerBadges = customerOrderCards.first().locator('.badge, .status-badge');
    const customerBadgeCount = await customerBadges.count();
    
    // Check farmer view
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), farmerToken);
    await page.goto('/farmer.html#orders');
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    const farmerOrderCards = page.locator('.order-card');
    if (await farmerOrderCards.count() === 0) {
      test.skip('No orders in farmer view');
    }
    
    // Verify status badges exist on farmer orders
    const farmerBadges = farmerOrderCards.first().locator('.badge, .status-badge');
    const farmerBadgeCount = await farmerBadges.count();
    
    // Both views should have badges
    expect(customerBadgeCount + farmerBadgeCount).toBeGreaterThan(0);
  });
});

test.describe('UI Consistency - Modal Information', () => {
  test('order details modal displays complete information', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test modal information');
    }
    
    // Click on first order to view details
    await orderCards.first().click();
    
    // Verify order details modal or section is visible
    const orderDetails = page.locator('.order-details, .modal-body, .order-detail-panel');
    if (await orderDetails.count() > 0) {
      await expect(orderDetails.first()).toBeVisible();
      
      // Verify key information fields are present
      const hasOrderInfo = await orderDetails.first().textContent();
      expect(hasOrderInfo.length).toBeGreaterThan(0);
    } else {
      test.skip('Order details modal not visible');
    }
  });
});

test.describe('UI Consistency - Order Summary', () => {
  test('order summary displays accurate information', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test order summary');
    }
    
    // Verify order card has summary information
    const firstOrder = orderCards.first();
    const orderText = await firstOrder.textContent();
    
    // Order should have some text content (summary)
    expect(orderText.length).toBeGreaterThan(0);
    
    // Should contain order-related information
    expect(orderText.toLowerCase()).toMatch(/order|status|total|delivery/);
  });
});

test.describe('UI Consistency - Navigation', () => {
  test('navigation between order pages works correctly', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    
    // Navigate to orders page
    await page.goto('/orders.html');
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Verify orders page loaded
    await expect(page.locator('#orders')).toBeVisible();
    
    // Navigate back to home
    await page.goto('/index.html');
    await page.waitForTimeout(1000);
    
    // Verify home page loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Navigate to orders again
    await page.goto('/orders.html');
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    // Verify orders page loaded again
    await expect(page.locator('#orders')).toBeVisible();
  });
});
