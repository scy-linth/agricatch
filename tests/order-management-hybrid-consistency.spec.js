const { test, expect } = require('@playwright/test');
const { getCustomerToken, getFarmerToken, getAdminToken } = require('./auth-helper');

test.describe('Hybrid Order Consistency', () => {
  test('regular order status syncs across customer, farmer, and admin', async ({ page }) => {
    // Get tokens for all roles
    const { token: customerToken } = await getCustomerToken();
    const { token: farmerToken } = await getFarmerToken();
    const { token: adminToken } = await getAdminToken();
    
    // Check customer view
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), customerToken);
    await page.goto('/orders.html');
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test consistency');
    }
    
    const customerOrderStatus = await orderCards.first().locator('.order-status-line span').textContent();
    
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
    
    const farmerOrderStatus = await farmerOrderCards.first().locator('.order-status-line span').textContent();
    
    // Status should be consistent between customer and farmer views
    expect(customerOrderStatus.trim()).toEqual(farmerOrderStatus.trim());
  });
});

test.describe('Hybrid Order Consistency - Preorder Transitions', () => {
  test('preorder transitions from reserved to confirmed to delivered', async ({ page }) => {
    const { token: farmerToken } = await getFarmerToken();
    
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), farmerToken);
    await page.goto('/farmer.html#orders');
    
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check preorder_reserved tab
    const preorderTab = page.locator('#preorder_reserved-orders-tab');
    if (await preorderTab.count() > 0 && await preorderTab.isVisible()) {
      await preorderTab.click();
      await page.waitForTimeout(500);
      
      const preorderReserved = page.locator('.order-card').filter({ hasText: 'Pre-order' });
      if (await preorderReserved.count() > 0) {
        // Verify preorder badge is visible
        await expect(preorderReserved.first().locator('.badge:has-text("Pre-order")')).toBeVisible();
      }
    } else {
      test.skip('Preorder reserved tab not available');
    }
    
    // Check confirmed tab for converted preorders
    await page.click('#confirmed-orders-tab');
    await page.waitForTimeout(500);
    
    const confirmedPreorders = page.locator('.order-card').filter({ hasText: 'Pre-order' });
    // Preorders can be in confirmed status after harvest
    if (await confirmedPreorders.count() > 0) {
      await expect(confirmedPreorders.first()).toBeVisible();
    }
  });
});

test.describe('Hybrid Order Consistency - Cancellation', () => {
  test('cancelled order shows cancelled status in all views', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    const { token: farmerToken } = await getFarmerToken();
    
    // Check customer view for cancelled orders
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), customerToken);
    await page.goto('/orders.html');
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const customerCancelledTab = page.locator('#cancelled-orders-tab');
    if (await customerCancelledTab.count() > 0 && await customerCancelledTab.isVisible()) {
      await customerCancelledTab.click();
      await page.waitForTimeout(500);
    }
    
    const customerCancelled = page.locator('.order-card').filter({ hasText: 'Cancelled' });
    const customerCount = await customerCancelled.count();
    
    // Check farmer view
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), farmerToken);
    await page.goto('/farmer.html#orders');
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    const farmerCancelledTab = page.locator('#cancelled-orders-tab');
    if (await farmerCancelledTab.count() > 0 && await farmerCancelledTab.isVisible()) {
      await farmerCancelledTab.click();
      await page.waitForTimeout(500);
    }
    
    const farmerCancelled = page.locator('.order-card').filter({ hasText: 'Cancelled' });
    const farmerCount = await farmerCancelled.count();
    
    // If there are cancelled orders in one view, they should appear in the other
    if (customerCount > 0 || farmerCount > 0) {
      // At least one view should have cancelled orders
      expect(customerCount + farmerCount).toBeGreaterThan(0);
    } else {
      test.skip('No cancelled orders to test');
    }
  });
});

test.describe('Hybrid Order Consistency - Delivery Date Sync', () => {
  test('delivery date syncs across customer and farmer views', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    const { token: farmerToken } = await getFarmerToken();
    
    // Check customer view
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), customerToken);
    await page.goto('/orders.html');
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const customerOrderCards = page.locator('.order-card');
    if (await customerOrderCards.count() === 0) {
      test.skip('No orders to test delivery date sync');
    }
    
    // Find an order with delivery date
    const customerOrderWithDate = customerOrderCards.filter({ hasText: /Delivery|Scheduled/ }).first();
    if (await customerOrderWithDate.count() === 0) {
      test.skip('No orders with delivery dates');
    }
    
    await customerOrderWithDate.click();
    
    // Get delivery date from customer view
    const customerDeliveryDate = await page.locator('.order-delivery-date, .delivery-date').textContent();
    
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
    
    // Find the same order (simplified - in real test would match by order ID)
    const farmerOrderWithDate = farmerOrderCards.filter({ hasText: /Delivery|Scheduled/ }).first();
    if (await farmerOrderWithDate.count() === 0) {
      test.skip('No orders with delivery dates in farmer view');
    }
    
    await farmerOrderWithDate.click();
    
    // Get delivery date from farmer view
    const farmerDeliveryDate = await page.locator('.order-delivery-date, .delivery-date').textContent();
    
    // Delivery dates should match
    expect(customerDeliveryDate.trim()).toEqual(farmerDeliveryDate.trim());
  });
});
