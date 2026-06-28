/**
 * Group D — Farmer Cancellation
 *
 * D1: Farmer cancels pending order → stock restored
 * D2: Farmer cancels confirmed order → stock restored
 * D3: Farmer cancels preparing order → stock restored
 * D4: Farmer cannot cancel scheduled+ order → 400 blocked
 * D5: Farmer cancels converted pre-order → stock from fulfilled_quantity
 */

const { test, expect } = require('@playwright/test');
const {
  getFarmerToken,
  getCustomerToken,
  apiCreateOrder,
  apiAddToCart,
  apiClearCart,
  apiCancelOrderFarmer,
  apiUpdateOrderStatus,
  apiSetDeliveryDate,
  dbGetOrder,
  dbGetProductStock,
  dbGetReservedQty,
  findAvailableProduct,
  findPreorderProduct,
  findOrderByStatusForFarmer,
  findOrderByStatus,
  buildCheckoutPayload,
  getTomorrowDate,
  closePool,
} = require('./helpers/order-test-helper');

test.describe('Group D — Farmer Cancellation', () => {
  test.describe.configure({ timeout: 60000 });

  test.afterAll(async () => {
    await closePool();
  });

  // -------------------------------------------------------------------------
  // D1: Farmer Cancels Pending Order
  // -------------------------------------------------------------------------
  test('D1: Farmer cancels pending order — stock restored, customer notified', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create order as customer
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    expect((await dbGetOrder(orderId)).status).toBe('pending');
    expect(await dbGetProductStock(product.id)).toBe(originalStock - 1);

    // Farmer cancels
    const cancelResult = await apiCancelOrderFarmer(farmerToken, orderId, 'Out of stock');
    expect(cancelResult.status).toBe(200);

    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('cancelled');
    expect(order.cancelled_by).toBe('farmer');
    expect(order.cancellation_reason).toBe('Out of stock');
    expect(order.cancelled_at).not.toBeNull();

    // Verify stock restored
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // D2: Farmer Cancels Confirmed Order
  // -------------------------------------------------------------------------
  test('D2: Farmer cancels confirmed order — stock restored', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and confirm
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    expect((await dbGetOrder(orderId)).status).toBe('confirmed');

    // Farmer cancels from confirmed
    const cancelResult = await apiCancelOrderFarmer(farmerToken, orderId, 'Cannot fulfill');
    expect(cancelResult.status).toBe(200);

    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('cancelled');
    expect(order.cancelled_by).toBe('farmer');
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // D3: Farmer Cancels Preparing Order
  // -------------------------------------------------------------------------
  test('D3: Farmer cancels preparing order — stock restored', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create, confirm, start preparing
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    expect((await dbGetOrder(orderId)).status).toBe('preparing');

    // Farmer cancels from preparing
    const cancelResult = await apiCancelOrderFarmer(farmerToken, orderId, 'Quality issue');
    expect(cancelResult.status).toBe(200);

    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('cancelled');
    expect(order.cancelled_by).toBe('farmer');
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // D4: Farmer Cannot Cancel Scheduled or Later
  // -------------------------------------------------------------------------
  test('D4: Farmer cannot cancel scheduled order — 400 blocked', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create, confirm, prepare, schedule
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    await apiSetDeliveryDate(farmerToken, orderId, getTomorrowDate());
    expect((await dbGetOrder(orderId)).status).toBe('scheduled');

    // Farmer tries to cancel scheduled order
    const cancelResult = await apiCancelOrderFarmer(farmerToken, orderId, 'Trying to cancel');
    expect(cancelResult.status).toBe(400);
    expect(cancelResult.body.message).toContain('scheduled');

    // Verify order still scheduled
    expect((await dbGetOrder(orderId)).status).toBe('scheduled');

    // Cleanup — use admin to cancel since farmer can't
    const { getAdminToken, apiUpdateOrderStatusAlt, dbRestoreOrder } = require('./helpers/order-test-helper');
    const { token: adminToken } = await getAdminToken();
    await apiUpdateOrderStatusAlt(adminToken, orderId, 'cancelled');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // D5: Farmer Cancels Converted Pre-Order
  // -------------------------------------------------------------------------
  test('D5: Farmer cancels converted pre-order — stock from fulfilled_quantity', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findPreorderProduct(farmer.id);
    test.skip(!product, 'No pre-order product found for farmer');

    const originalReserved = await dbGetReservedQty(product.id);
    const originalStock = await dbGetProductStock(product.id);

    // Create pre-order
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Pre-order checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    expect((await dbGetOrder(orderId)).status).toBe('preorder_reserved');

    // Convert pre-order via harvest lifecycle
    const { apiHarvestLifecycle } = require('./helpers/order-test-helper');
    const harvestResult = await apiHarvestLifecycle(farmerToken, product.id, 1, true);
    test.skip(harvestResult.status !== 200, `Harvest failed: ${harvestResult.body?.message}`);

    // Verify order is now confirmed (converted)
    const convertedOrder = await dbGetOrder(orderId);
    expect(convertedOrder.status).toBe('confirmed');
    expect(convertedOrder.preorder_converted_at).not.toBeNull();
    expect(Number(convertedOrder.preorder_fulfilled_quantity)).toBeGreaterThanOrEqual(1);

    const stockAfterHarvest = await dbGetProductStock(product.id);

    // Farmer cancels the converted pre-order
    const cancelResult = await apiCancelOrderFarmer(farmerToken, orderId, 'Cancelled after conversion');
    expect(cancelResult.status).toBe(200);

    const cancelledOrder = await dbGetOrder(orderId);
    expect(cancelledOrder.status).toBe('cancelled');
    expect(cancelledOrder.cancelled_by).toBe('farmer');

    // Verify stock restored by fulfilled_quantity (not reserved)
    const stockAfterCancel = await dbGetProductStock(product.id);
    expect(stockAfterCancel).toBe(stockAfterHarvest + Number(convertedOrder.preorder_fulfilled_quantity));

    // Verify preorder_fulfilled_quantity reset to 0
    const finalOrder = await dbGetOrder(orderId);
    expect(Number(finalOrder.preorder_fulfilled_quantity)).toBe(0);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, originalReserved);
  });

  // -------------------------------------------------------------------------
  // D-UI: Farmer UI cancel modal works
  // -------------------------------------------------------------------------
  test('D-UI: Farmer cancel modal opens and submits with reason', async ({ page }) => {
    const { token: farmerToken } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), farmerToken);
    await page.goto('/farmer.html#orders');

    await page.waitForFunction(() => {
      const el = document.getElementById('orders');
      return el && !el.style.display.includes('none');
    }, { timeout: 15000 });

    // Check confirmed tab for cancel button
    await page.click('#confirmed-orders-tab');
    await page.waitForTimeout(500);

    const confirmedCards = page.locator('.order-card');
    if (await confirmedCards.count() === 0) {
      test.skip('No confirmed orders to test cancel modal');
    }

    const cancelBtn = confirmedCards.first().locator('button:has-text("Cancel")');
    if (await cancelBtn.count() === 0) {
      test.skip('No cancel button on confirmed order');
    }

    // Click cancel — modal should open
    await cancelBtn.click();
    const cancelModal = page.locator('#order-cancel-modal');
    await expect(cancelModal).toHaveClass(/open/);

    // Enter reason
    await page.fill('#order-cancel-reason-input', 'Test cancellation from UI');
    await page.click('#submit-order-cancel-btn');

    // Modal should close
    await expect(cancelModal).not.toHaveClass(/open/);
  });
});
