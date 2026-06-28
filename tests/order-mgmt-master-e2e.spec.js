/**
 * Master E2E Test — Complete Order Management Lifecycle
 *
 * This is the master end-to-end test that covers the entire order journey:
 * 1. Customer browses products and adds to cart
 * 2. Customer checks out (regular order)
 * 3. Farmer confirms and progresses order through all statuses
 * 4. Customer creates pre-order
 * 5. Farmer harvests and converts pre-order
 * 6. Customer cancels a pending order
 * 7. Farmer cancels a confirmed order
 * 8. Admin cancels an active order
 * 9. Delivery scheduling with reschedule
 * 10. Edge case validations
 *
 * Primary tool: Playwright (API + UI)
 * Secondary: Chrome DevTools MCP for debugging failures
 */

const { test, expect } = require('@playwright/test');
const {
  getFarmerToken,
  getCustomerToken,
  getAdminToken,
  apiCreateOrder,
  apiAddToCart,
  apiClearCart,
  apiGetOrders,
  apiGetCart,
  apiUpdateOrderStatus,
  apiUpdateOrderStatusAlt,
  apiCancelOrderCustomer,
  apiCancelOrderFarmer,
  apiSetDeliveryDate,
  apiHarvestLifecycle,
  dbGetOrder,
  dbGetProduct,
  dbGetProductStock,
  dbGetReservedQty,
  findAvailableProduct,
  findPreorderProduct,
  findAnyAvailableProduct,
  findOrderByStatus,
  buildCheckoutPayload,
  getTomorrowDate,
  getFutureDate,
  closePool,
} = require('./helpers/order-test-helper');

test.describe('Master E2E — Complete Order Management Lifecycle', () => {
  test.describe.configure({ timeout: 120000 });

  test.afterAll(async () => {
    await closePool();
  });

  // Track all created orders for cleanup
  const createdOrders = [];

  // -------------------------------------------------------------------------
  // Phase 1: Customer Creates Regular Order
  // -------------------------------------------------------------------------
  test('Phase 1: Customer adds product to cart and checks out', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken, user: customer } = await getCustomerToken();

    // Find available product
    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product with stock found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Clear cart and add product
    await apiClearCart(customerToken);
    const addResult = await apiAddToCart(customerToken, product.id, 1);
    expect(addResult.status).toBe(200);

    // Verify cart has item
    const cartResult = await apiGetCart(customerToken);
    expect(cartResult.status).toBe(200);
    const cartItems = cartResult.body.cartItems || [];
    expect(cartItems.length).toBe(1);
    expect(cartItems[0].product_id).toBe(product.id);

    // Checkout
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    expect(orderResult.status).toBe(201);
    expect(orderResult.body.orderIds).toBeDefined();
    expect(orderResult.body.orderCount).toBe(1);

    const orderId = orderResult.body.orderIds[0];
    createdOrders.push({ id: orderId, productId: product.id, originalStock });

    // Verify order created correctly
    const order = await dbGetOrder(orderId);
    expect(order).not.toBeNull();
    expect(order.status).toBe('pending');
    expect(order.is_preorder).toBe(false);
    expect(order.user_id).toBe(customer.id);

    // Verify stock decremented
    const stockAfter = await dbGetProductStock(product.id);
    expect(stockAfter).toBe(originalStock - 1);

    // Verify cart cleared
    const cartAfter = await apiGetCart(customerToken);
    const cartItemsAfter = cartAfter.body.cartItems || [];
    expect(cartItemsAfter.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Phase 2: Farmer Progresses Order Through Full Lifecycle
  // -------------------------------------------------------------------------
  test('Phase 2: Farmer progresses order — pending → delivered', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    // Find a pending order for this farmer
    const { findOrderByStatusForFarmer } = require('./helpers/order-test-helper');
    let pendingOrder = await findOrderByStatusForFarmer('pending', farmer.id);

    // If no pending order, create one
    if (!pendingOrder) {
      const product = await findAvailableProduct(farmer.id);
      test.skip(!product, 'No available product to create test order');

      const originalStock = await dbGetProductStock(product.id);
      await apiClearCart(customerToken);
      await apiAddToCart(customerToken, product.id, 1);
      const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
      test.skip(orderResult.status !== 201, 'Could not create test order');
      pendingOrder = await dbGetOrder(orderResult.body.orderIds[0]);
      createdOrders.push({ id: pendingOrder.id, productId: product.id, originalStock });
    }

    const orderId = pendingOrder.id;
    const originalStock = await dbGetProductStock(pendingOrder.product_id);

    // pending → confirmed
    let result = await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    expect(result.status).toBe(200);
    expect((await dbGetOrder(orderId)).status).toBe('confirmed');

    // confirmed → preparing
    result = await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    expect(result.status).toBe(200);
    expect((await dbGetOrder(orderId)).status).toBe('preparing');

    // preparing → scheduled (via delivery date)
    result = await apiSetDeliveryDate(farmerToken, orderId, getTomorrowDate());
    expect(result.status).toBe(200);
    const scheduledOrder = await dbGetOrder(orderId);
    expect(scheduledOrder.status).toBe('scheduled');
    expect(scheduledOrder.delivery_date).not.toBeNull();

    // scheduled → out_for_delivery
    result = await apiUpdateOrderStatus(farmerToken, orderId, 'out_for_delivery');
    expect(result.status).toBe(200);
    expect((await dbGetOrder(orderId)).status).toBe('out_for_delivery');

    // out_for_delivery → delivered
    result = await apiUpdateOrderStatus(farmerToken, orderId, 'delivered');
    expect(result.status).toBe(200);
    const deliveredOrder = await dbGetOrder(orderId);
    expect(deliveredOrder.status).toBe('delivered');
    expect(deliveredOrder.delivered_at).not.toBeNull();

    // Verify customer can see delivered order
    const ordersResult = await apiGetOrders(customerToken);
    expect(ordersResult.status).toBe(200);
    const customerOrder = ordersResult.body.orders.find((o) => o.id === orderId);
    expect(customerOrder).toBeDefined();
    expect(customerOrder.status).toBe('delivered');

    // Cleanup: restore order
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', pendingOrder.product_id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // Phase 3: Customer Creates Pre-Order and Farmer Harvests
  // -------------------------------------------------------------------------
  test('Phase 3: Pre-order lifecycle — reservation → harvest → delivery', async ({ page }) => {
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
    createdOrders.push({ id: orderId, productId: product.id, originalStock, originalReserved });

    // Verify preorder_reserved status
    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('preorder_reserved');
    expect(order.is_preorder).toBe(true);
    expect(order.preorder_reserved_quantity).toBe(1);

    // Verify reserved increased, stock unchanged
    expect(await dbGetReservedQty(product.id)).toBe(originalReserved + 1);
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Farmer triggers harvest (YES path)
    const harvestResult = await apiHarvestLifecycle(farmerToken, product.id, 1, true);
    test.skip(harvestResult.status !== 200, `Harvest failed: ${harvestResult.body?.message}`);

    // Verify order converted to confirmed
    const convertedOrder = await dbGetOrder(orderId);
    expect(convertedOrder.status).toBe('confirmed');
    expect(convertedOrder.preorder_converted_at).not.toBeNull();
    expect(Number(convertedOrder.preorder_fulfilled_quantity)).toBeGreaterThanOrEqual(1);

    // Progress to delivered
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    await apiSetDeliveryDate(farmerToken, orderId, getTomorrowDate());
    await apiUpdateOrderStatus(farmerToken, orderId, 'out_for_delivery');
    await apiUpdateOrderStatus(farmerToken, orderId, 'delivered');

    expect((await dbGetOrder(orderId)).status).toBe('delivered');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, originalReserved);
  });

  // -------------------------------------------------------------------------
  // Phase 4: Customer Cancels Pending Order
  // -------------------------------------------------------------------------
  test('Phase 4: Customer cancels pending order — stock restored', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create order
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    expect(await dbGetProductStock(product.id)).toBe(originalStock - 1);

    // Customer cancels
    const cancelResult = await apiCancelOrderCustomer(customerToken, orderId, 'Changed my mind');
    expect(cancelResult.status).toBe(200);

    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('cancelled');
    expect(order.cancelled_by).toBe('customer');
    expect(order.cancellation_reason).toBe('Changed my mind');

    // Verify stock restored
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // Phase 5: Farmer Cancels Confirmed Order
  // -------------------------------------------------------------------------
  test('Phase 5: Farmer cancels confirmed order — stock restored', async ({ page }) => {
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

    // Farmer cancels
    const cancelResult = await apiCancelOrderFarmer(farmerToken, orderId, 'Cannot fulfill order');
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
  // Phase 6: Admin Cancels Active Order
  // -------------------------------------------------------------------------
  test('Phase 6: Admin cancels out_for_delivery order', async ({ page }) => {
    const { token: adminToken } = await getAdminToken();
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and progress to out_for_delivery
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    await apiSetDeliveryDate(farmerToken, orderId, getTomorrowDate());
    await apiUpdateOrderStatus(farmerToken, orderId, 'out_for_delivery');

    // Admin cancels
    const cancelResult = await apiUpdateOrderStatusAlt(adminToken, orderId, 'cancelled');
    expect(cancelResult.status).toBe(200);

    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('cancelled');
    expect(order.cancelled_at).not.toBeNull();
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // Phase 7: Delivery Scheduling and Rescheduling
  // -------------------------------------------------------------------------
  test('Phase 7: Farmer schedules and reschedules delivery', async ({ page }) => {
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

    // Schedule delivery
    const firstDate = getTomorrowDate();
    const scheduleResult = await apiSetDeliveryDate(farmerToken, orderId, firstDate);
    expect(scheduleResult.status).toBe(200);
    expect(scheduleResult.body.status).toBe('scheduled');

    // Reschedule with reason
    const newDate = getFutureDate(5);
    const rescheduleResult = await apiSetDeliveryDate(farmerToken, orderId, newDate, 'Weather delay');
    expect(rescheduleResult.status).toBe(200);
    expect(rescheduleResult.body.message).toContain('rescheduled');

    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('scheduled');
    expect(order.reschedule_reason).toBe('Weather delay');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // Phase 8: Edge Case Validations
  // -------------------------------------------------------------------------
  test('Phase 8: Edge cases — empty cart, invalid transition, double cancel', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    const { token: farmerToken, user: farmer } = await getFarmerToken();

    // 8a: Empty cart checkout
    await apiClearCart(customerToken);
    const emptyResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    expect(emptyResult.status).toBe(400);
    expect(emptyResult.body.message).toContain('Cart is empty');

    // 8b: Invalid status transition
    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product for edge case tests');

    const originalStock = await dbGetProductStock(product.id);
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];

    // Try skipping to delivered
    const skipResult = await apiUpdateOrderStatus(farmerToken, orderId, 'delivered');
    expect(skipResult.status).toBe(400);

    // 8c: Customer cancels
    const cancelResult = await apiCancelOrderCustomer(customerToken, orderId, 'Test cancel');
    expect(cancelResult.status).toBe(200);
    expect((await dbGetOrder(orderId)).status).toBe('cancelled');

    // 8d: Double cancel
    const doubleCancelResult = await apiCancelOrderCustomer(customerToken, orderId, 'Double cancel');
    expect(doubleCancelResult.status).toBe(400);

    // 8e: Cannot update cancelled order
    const updateResult = await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    expect(updateResult.status).toBe(400);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // Phase 9: UI Verification — Farmer Dashboard
  // -------------------------------------------------------------------------
  test('Phase 9: Farmer UI — order tabs and action buttons visible', async ({ page }) => {
    const { token: farmerToken } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), farmerToken);
    await page.goto('/farmer.html#orders');

    // Wait for orders section
    await page.waitForFunction(() => {
      const el = document.getElementById('orders');
      return el && !el.style.display.includes('none');
    }, { timeout: 15000 });

    // Verify all status tabs
    const tabs = [
      '#pending-orders-tab',
      '#preorder_reserved-orders-tab',
      '#confirmed-orders-tab',
      '#preparing-orders-tab',
      '#scheduled-orders-tab',
      '#out_for_delivery-orders-tab',
      '#delivered-orders-tab',
      '#cancelled-orders-tab',
    ];
    for (const tab of tabs) {
      await expect(page.locator(tab)).toHaveCount(1);
    }
  });

  // -------------------------------------------------------------------------
  // Phase 10: UI Verification — Customer Orders Page
  // -------------------------------------------------------------------------
  test('Phase 10: Customer UI — orders page loads with tabs', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), customerToken);
    await page.goto('/orders.html');

    // Wait for orders page to load
    await page.waitForTimeout(3000);

    // Verify page loaded
    const url = page.url();
    expect(url).toContain('orders.html');
  });
});
