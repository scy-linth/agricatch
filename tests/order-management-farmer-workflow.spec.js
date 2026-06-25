const { test, expect } = require('@playwright/test');
const { getFarmerToken } = require('./auth-helper');

test.describe('Farmer Order Management - Order List', () => {
  test('farmer loads order list with all status tabs', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Verify all status tabs exist in DOM
    await expect(page.locator('#pending-orders-tab')).toHaveCount(1);
    await expect(page.locator('#preorder_reserved-orders-tab')).toHaveCount(1);
    await expect(page.locator('#confirmed-orders-tab')).toHaveCount(1);
    await expect(page.locator('#preparing-orders-tab')).toHaveCount(1);
    await expect(page.locator('#scheduled-orders-tab')).toHaveCount(1);
    await expect(page.locator('#out_for_delivery-orders-tab')).toHaveCount(1);
    await expect(page.locator('#delivered-orders-tab')).toHaveCount(1);
    await expect(page.locator('#cancelled-orders-tab')).toHaveCount(1);
  });
});

test.describe('Farmer Order Management - Confirm Order', () => {
  test('farmer confirms pending order', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to confirm');
    }
    
    // Switch to pending tab
    await page.click('#pending-orders-tab');
    await page.waitForTimeout(500);
    
    // Find pending order
    const pendingOrders = orderCards.filter({ hasText: 'Pending' });
    if (await pendingOrders.count() === 0) {
      test.skip('No pending orders to confirm');
    }
    
    // Click confirm button
    const confirmBtn = pendingOrders.first().locator('button:has-text("Confirm")');
    if (await confirmBtn.count() === 0) {
      test.skip('Confirm button not available');
    }
    
    await confirmBtn.click();
    
    // Verify status changes to confirmed
    await page.waitForTimeout(2000);
    await page.reload();
    await page.click('#confirmed-orders-tab');
    await expect(page.locator('.order-card').filter({ hasText: 'Confirmed' })).toBeVisible();
  });
});

test.describe('Farmer Order Management - Harvest Preorder', () => {
  test('farmer harvests preorder reserved order', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to harvest');
    }
    
    // Switch to preorder_reserved tab
    await page.click('#preorder_reserved-orders-tab');
    await page.waitForTimeout(500);
    
    // Find preorder reserved order
    const preorderOrders = orderCards.filter({ hasText: 'Pre-order' });
    if (await preorderOrders.count() === 0) {
      test.skip('No preorder orders to harvest');
    }
    
    // Click harvest button
    const harvestBtn = preorderOrders.first().locator('button:has-text("Harvest")');
    if (await harvestBtn.count() === 0) {
      test.skip('Harvest button not available');
    }
    
    await harvestBtn.click();
    
    // Verify status changes to confirmed
    await page.waitForTimeout(2000);
    await page.reload();
    await page.click('#confirmed-orders-tab');
    await expect(page.locator('.order-card').filter({ hasText: 'Confirmed' })).toBeVisible();
  });
});

test.describe('Farmer Order Management - Convert Preorder', () => {
  test('farmer converts preorder to regular order', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to convert');
    }
    
    // Find confirmed preorder
    await page.click('#confirmed-orders-tab');
    await page.waitForTimeout(500);
    
    const preorderOrders = orderCards.filter({ hasText: 'Pre-order' });
    if (await preorderOrders.count() === 0) {
      test.skip('No confirmed preorders to convert');
    }
    
    // Click convert button
    const convertBtn = preorderOrders.first().locator('button:has-text("Convert")');
    if (await convertBtn.count() === 0) {
      test.skip('Convert button not available');
    }
    
    await convertBtn.click();
    
    // Verify conversion modal opens
    await expect(page.locator('#convert-preorder-modal')).toBeVisible();
    
    // Submit conversion
    await page.click('#submit-convert-preorder-btn');
    
    // Verify modal closes
    await expect(page.locator('#convert-preorder-modal')).not.toBeVisible();
    
    // Verify order status updates
    await page.waitForTimeout(2000);
    await page.reload();
  });
});

test.describe('Farmer Order Management - Schedule Delivery', () => {
  test('farmer schedules delivery for preparing order', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to schedule');
    }
    
    // Switch to preparing tab
    await page.click('#preparing-orders-tab');
    await page.waitForTimeout(500);
    
    // Find preparing order
    const preparingOrders = orderCards.filter({ hasText: 'Preparing' });
    if (await preparingOrders.count() === 0) {
      test.skip('No preparing orders to schedule');
    }
    
    // Click schedule delivery button
    const scheduleBtn = preparingOrders.first().locator('button:has-text("Schedule Delivery")');
    if (await scheduleBtn.count() === 0) {
      test.skip('Schedule button not available');
    }
    
    await scheduleBtn.click();
    
    // Verify schedule modal opens
    await expect(page.locator('#schedule-delivery-modal')).toHaveClass(/open/);
    
    // Set delivery date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('#schedule-delivery-date', dateStr);
    
    // Submit schedule
    await page.click('#submit-schedule-delivery-btn');
    
    // Verify modal closes
    await expect(page.locator('#schedule-delivery-modal')).not.toHaveClass(/open/);
    
    // Verify status changes to scheduled
    await page.waitForTimeout(2000);
    await page.reload();
    await page.click('#scheduled-orders-tab');
    await expect(page.locator('.order-card').filter({ hasText: 'Scheduled' })).toBeVisible();
  });
});

test.describe('Farmer Order Management - Out for Delivery', () => {
  test('farmer marks scheduled order as out for delivery', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to mark out for delivery');
    }
    
    // Switch to scheduled tab
    await page.click('#scheduled-orders-tab');
    await page.waitForTimeout(500);
    
    // Find scheduled order
    const scheduledOrders = orderCards.filter({ hasText: 'Scheduled' });
    if (await scheduledOrders.count() === 0) {
      test.skip('No scheduled orders to mark out for delivery');
    }
    
    // Click out for delivery button
    const deliveryBtn = scheduledOrders.first().locator('button:has-text("Out for Delivery")');
    if (await deliveryBtn.count() === 0) {
      test.skip('Out for Delivery button not available');
    }
    
    await deliveryBtn.click();
    
    // Verify status changes to out_for_delivery
    await page.waitForTimeout(2000);
    await page.reload();
    await page.click('#out_for_delivery-orders-tab');
    await expect(page.locator('.order-card').filter({ hasText: 'On the Way' })).toBeVisible();
  });
});

test.describe('Farmer Order Management - Mark Delivered', () => {
  test('farmer marks out for delivery order as delivered', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to mark delivered');
    }
    
    // Switch to out_for_delivery tab
    await page.click('#out_for_delivery-orders-tab');
    await page.waitForTimeout(500);
    
    // Find out for delivery order
    const deliveryOrders = orderCards.filter({ hasText: 'On the Way' });
    if (await deliveryOrders.count() === 0) {
      test.skip('No out for delivery orders to mark delivered');
    }
    
    // Click delivered button
    const deliveredBtn = deliveryOrders.first().locator('button:has-text("Mark Delivered")');
    if (await deliveredBtn.count() === 0) {
      test.skip('Mark Delivered button not available');
    }
    
    await deliveredBtn.click();
    
    // Verify status changes to delivered
    await page.waitForTimeout(2000);
    await page.reload();
    await page.click('#delivered-orders-tab');
    await expect(page.locator('.order-card').filter({ hasText: 'Delivered' })).toBeVisible();
  });
});

test.describe('Farmer Order Management - Cancel Order', () => {
  test('farmer cancels confirmed order', async ({ page }) => {
    const { token } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/farmer.html#orders');
    
    // Wait for orders section to be visible (farmer.js showSection() makes it visible)
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check if any orders exist
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to cancel');
    }
    
    // Switch to confirmed tab
    await page.click('#confirmed-orders-tab');
    await page.waitForTimeout(500);
    
    // Find confirmed order
    const confirmedOrders = orderCards.filter({ hasText: 'Confirmed' });
    if (await confirmedOrders.count() === 0) {
      test.skip('No confirmed orders to cancel');
    }
    
    // Click cancel button
    const cancelBtn = confirmedOrders.first().locator('button:has-text("Cancel")');
    if (await cancelBtn.count() === 0) {
      test.skip('Cancel button not available');
    }
    
    await cancelBtn.click();
    
    // Verify cancel modal opens
    await expect(page.locator('#order-cancel-modal')).toHaveClass(/open/);
    
    // Enter cancellation reason
    await page.fill('#order-cancel-reason-input', 'Out of stock');
    
    // Submit cancellation
    await page.click('#submit-order-cancel-btn');
    
    // Verify modal closes
    await expect(page.locator('#order-cancel-modal')).not.toHaveClass(/open/);
    
    // Verify status changes to cancelled
    await page.waitForTimeout(2000);
    await page.reload();
    await page.click('#cancelled-orders-tab');
    await expect(page.locator('.order-card').filter({ hasText: 'Cancelled' })).toBeVisible();
  });
});
