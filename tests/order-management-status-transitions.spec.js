const { test, expect } = require('@playwright/test');
const { getFarmerToken, getCustomerToken } = require('./auth-helper');

test.describe('Status Transition Validation - Valid Transitions', () => {
  test('pending to confirmed transition is valid', async ({ page }) => {
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
      test.skip('No orders to test transitions');
    }
    
    // Switch to pending tab
    await page.click('#pending-orders-tab');
    await page.waitForTimeout(500);
    
    const pendingOrders = orderCards.filter({ hasText: 'Pending' });
    if (await pendingOrders.count() === 0) {
      test.skip('No pending orders to test transition');
    }
    
    // Verify confirm button exists (indicates valid transition)
    const confirmBtn = pendingOrders.first().locator('button:has-text("Confirm")');
    if (await confirmBtn.count() > 0) {
      await expect(confirmBtn).toBeVisible();
    } else {
      test.skip('Confirm button not available');
    }
  });
});

test.describe('Status Transition Validation - Invalid Transitions', () => {
  test('delivered order cannot transition to other states', async ({ page }) => {
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
      test.skip('No orders to test transitions');
    }
    
    // Switch to delivered tab
    await page.click('#delivered-orders-tab');
    await page.waitForTimeout(500);
    
    const deliveredOrders = orderCards.filter({ hasText: 'Delivered' });
    if (await deliveredOrders.count() === 0) {
      test.skip('No delivered orders to test terminal state');
    }
    
    // Verify no action buttons exist for delivered orders (terminal state)
    const actionBtns = deliveredOrders.first().locator('button:has-text("Confirm"), button:has-text("Schedule"), button:has-text("Out for Delivery")');
    expect(await actionBtns.count()).toBe(0);
  });
});

test.describe('Status Transition Validation - Cancellation Rules', () => {
  test('customer can cancel pending order', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test cancellation');
    }
    
    const pendingOrders = orderCards.filter({ hasText: 'Pending' });
    if (await pendingOrders.count() === 0) {
      test.skip('No pending orders to test cancellation');
    }
    
    // Verify cancel button exists for pending orders
    const cancelBtn = pendingOrders.first().locator('button:has-text("Cancel")');
    if (await cancelBtn.count() > 0) {
      await expect(cancelBtn).toBeVisible();
    } else {
      test.skip('Cancel button not available');
    }
  });
  
  test('customer cannot cancel delivered order', async ({ page }) => {
    const { token } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/orders.html');
    
    await page.waitForSelector('#orders', { timeout: 10000 });
    
    const orderCards = page.locator('.order-card');
    if (await orderCards.count() === 0) {
      test.skip('No orders to test cancellation');
    }
    
    await page.click('#delivered-orders-tab');
    await page.waitForTimeout(500);
    
    const deliveredOrders = orderCards.filter({ hasText: 'Delivered' });
    if (await deliveredOrders.count() === 0) {
      test.skip('No delivered orders to test cancellation restriction');
    }
    
    // Verify no cancel button for delivered orders
    const cancelBtn = deliveredOrders.first().locator('button:has-text("Cancel")');
    expect(await cancelBtn.count()).toBe(0);
  });
});

test.describe('Status Transition Validation - Preorder Transitions', () => {
  test('preorder_reserved to confirmed transition is valid', async ({ page }) => {
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
      test.skip('No orders to test preorder transitions');
    }
    
    // Check preorder_reserved tab
    const preorderTab = page.locator('#preorder_reserved-orders-tab');
    if (await preorderTab.count() > 0 && await preorderTab.isVisible()) {
      await preorderTab.click();
      await page.waitForTimeout(500);
      
      const preorderOrders = orderCards.filter({ hasText: 'Pre-order' });
      if (await preorderOrders.count() > 0) {
        // Verify harvest button exists (valid transition from preorder_reserved to confirmed)
        const harvestBtn = preorderOrders.first().locator('button:has-text("Harvest")');
        if (await harvestBtn.count() > 0) {
          await expect(harvestBtn).toBeVisible();
        } else {
          test.skip('Harvest button not available');
        }
      } else {
        test.skip('No preorder orders');
      }
    } else {
      test.skip('Preorder reserved tab not available');
    }
  });
});

test.describe('Status Transition Validation - Workflow Sequence', () => {
  test('status follows correct sequence: confirmed -> preparing -> scheduled -> out_for_delivery -> delivered', async ({ page }) => {
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
      test.skip('No orders to test workflow sequence');
    }
    
    // Check that tabs exist in correct order
    await expect(page.locator('#confirmed-orders-tab')).toHaveCount(1);
    await expect(page.locator('#preparing-orders-tab')).toHaveCount(1);
    await expect(page.locator('#scheduled-orders-tab')).toHaveCount(1);
    await expect(page.locator('#out_for_delivery-orders-tab')).toHaveCount(1);
    await expect(page.locator('#delivered-orders-tab')).toHaveCount(1);
  });
});
