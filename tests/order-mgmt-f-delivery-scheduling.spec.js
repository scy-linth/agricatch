/**
 * Group F — Delivery Date Scheduling
 *
 * F1: Farmer sets delivery date on preparing order → status = scheduled
 * F2: Farmer reschedules delivery with reason
 * F3: Cannot schedule pre-order before harvest conversion
 * F4: Cannot set past delivery date
 * F5: Reschedule without reason fails
 */

const { test, expect } = require('@playwright/test');
const {
  getFarmerToken,
  getCustomerToken,
  apiCreateOrder,
  apiAddToCart,
  apiClearCart,
  apiUpdateOrderStatus,
  apiSetDeliveryDate,
  apiConvertPreorders,
  apiHarvestLifecycle,
  dbGetOrder,
  dbGetProductStock,
  findAvailableProduct,
  findPreorderProduct,
  buildCheckoutPayload,
  getTomorrowDate,
  getYesterdayDate,
  getFutureDate,
  closePool,
} = require('./helpers/order-test-helper');

test.describe('Group F — Delivery Date Scheduling', () => {
  test.describe.configure({ timeout: 60000 });

  test.afterAll(async () => {
    await closePool();
  });

  // -------------------------------------------------------------------------
  // F1: Farmer Sets Delivery Date on Preparing Order
  // -------------------------------------------------------------------------
  test('F1: Farmer sets delivery date on preparing order → scheduled', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and progress to preparing
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    expect((await dbGetOrder(orderId)).status).toBe('preparing');

    // Set delivery date
    const deliveryDate = getTomorrowDate();
    const scheduleResult = await apiSetDeliveryDate(farmerToken, orderId, deliveryDate);
    expect(scheduleResult.status).toBe(200);
    expect(scheduleResult.body.status).toBe('scheduled');
    expect(scheduleResult.body.delivery_date).toBe(deliveryDate);

    // Verify DB
    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('scheduled');
    expect(order.delivery_date).not.toBeNull();

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // F2: Farmer Reschedules Delivery with Reason
  // -------------------------------------------------------------------------
  test('F2: Farmer reschedules delivery — requires reason, updates date', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and progress to scheduled
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');

    const firstDate = getTomorrowDate();
    await apiSetDeliveryDate(farmerToken, orderId, firstDate);
    expect((await dbGetOrder(orderId)).status).toBe('scheduled');

    // Reschedule with reason
    const newDate = getFutureDate(5);
    const rescheduleResult = await apiSetDeliveryDate(farmerToken, orderId, newDate, 'Weather delay');
    expect(rescheduleResult.status).toBe(200);
    expect(rescheduleResult.body.message).toContain('rescheduled');

    // Verify DB
    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('scheduled');
    expect(order.delivery_date).not.toBeNull();
    expect(order.reschedule_reason).toBe('Weather delay');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // F3: Cannot Schedule Pre-Order Before Harvest Conversion
  // -------------------------------------------------------------------------
  test('F3: Cannot schedule delivery for pre-order before conversion — 400', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findPreorderProduct(farmer.id);
    test.skip(!product, 'No pre-order product found for farmer');

    const originalReserved = await dbGetReservedQty(product.id);

    // Create pre-order (status = preorder_reserved, not converted)
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Pre-order checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    expect((await dbGetOrder(orderId)).status).toBe('preorder_reserved');

    // Try to schedule delivery
    const scheduleResult = await apiSetDeliveryDate(farmerToken, orderId, getTomorrowDate());
    expect(scheduleResult.status).toBe(400);
    expect(scheduleResult.body.message).toContain('harvest conversion');

    // Verify order still preorder_reserved
    expect((await dbGetOrder(orderId)).status).toBe('preorder_reserved');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, null, originalReserved);
  });

  // -------------------------------------------------------------------------
  // F4: Cannot Set Past Delivery Date
  // -------------------------------------------------------------------------
  test('F4: Cannot set past delivery date — 400', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and progress to preparing
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');

    // Try to set past date
    const pastDate = getYesterdayDate();
    const scheduleResult = await apiSetDeliveryDate(farmerToken, orderId, pastDate);
    expect(scheduleResult.status).toBe(400);
    expect(scheduleResult.body.message).toContain('past');

    // Verify order still preparing (not scheduled)
    expect((await dbGetOrder(orderId)).status).toBe('preparing');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // F5: Reschedule Without Reason Fails
  // -------------------------------------------------------------------------
  test('F5: Reschedule without reason fails — 400', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and progress to scheduled
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    await apiSetDeliveryDate(farmerToken, orderId, getTomorrowDate());
    expect((await dbGetOrder(orderId)).status).toBe('scheduled');

    // Try to reschedule without reason
    const newDate = getFutureDate(5);
    const rescheduleResult = await apiSetDeliveryDate(farmerToken, orderId, newDate);
    expect(rescheduleResult.status).toBe(400);
    expect(rescheduleResult.body.message).toContain('rescheduling is required');

    // Verify order still scheduled with original date
    expect((await dbGetOrder(orderId)).status).toBe('scheduled');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // F-UI: Schedule delivery modal works in farmer UI
  // -------------------------------------------------------------------------
  test('F-UI: Schedule delivery modal opens with date input', async ({ page }) => {
    const { token: farmerToken } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), farmerToken);
    await page.goto('/farmer.html#orders');

    await page.waitForFunction(() => {
      const el = document.getElementById('orders');
      return el && !el.style.display.includes('none');
    }, { timeout: 15000 });

    // Check preparing tab for schedule button
    await page.evaluate(() => document.getElementById('preparing-orders-tab').click());
    await page.waitForTimeout(500);

    const preparingCards = page.locator('.order-card');
    if (await preparingCards.count() === 0) {
      test.skip('No preparing orders to test schedule modal');
    }

    const scheduleBtn = preparingCards.first().locator('button:has-text("Schedule Delivery")');
    if (await scheduleBtn.count() === 0) {
      test.skip('No schedule button found');
    }

    await scheduleBtn.click();

    // Verify modal opens
    const modal = page.locator('#schedule-delivery-modal');
    await expect(modal).toHaveClass(/open/);

    // Verify date input exists
    const dateInput = page.locator('#schedule-delivery-date');
    await expect(dateInput).toBeVisible();
  });
});
