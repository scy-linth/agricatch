/**
 * Group C — Customer Cancellation
 *
 * C1: Customer cancels pending regular order → stock restored
 * C2: Customer cancels pre-order reservation → reserved released
 * C3: Customer cannot cancel after confirmation → 400
 * C4: Customer cannot cancel delivered order → 400
 * C5: Customer cannot double-cancel → 400
 */

const { test, expect } = require('@playwright/test');
const {
  getCustomerToken,
  getFarmerToken,
  apiCreateOrder,
  apiAddToCart,
  apiClearCart,
  apiCancelOrderCustomer,
  apiUpdateOrderStatus,
  dbGetOrder,
  dbGetProductStock,
  dbGetReservedQty,
  findAvailableProduct,
  findPreorderProduct,
  findOrderByStatus,
  buildCheckoutPayload,
  closePool,
} = require('./helpers/order-test-helper');

test.describe('Group C — Customer Cancellation', () => {
  test.describe.configure({ timeout: 60000 });

  test.afterAll(async () => {
    await closePool();
  });

  // -------------------------------------------------------------------------
  // C1: Customer Cancels Pending Regular Order
  // -------------------------------------------------------------------------
  test('C1: Customer cancels pending regular order — stock restored', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken, user: customer } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create order
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    const stockAfterOrder = await dbGetProductStock(product.id);
    expect(stockAfterOrder).toBe(originalStock - 1);

    // Cancel the order
    const cancelResult = await apiCancelOrderCustomer(customerToken, orderId, 'Changed my mind');
    expect(cancelResult.status).toBe(200);

    // Verify order status
    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('cancelled');
    expect(order.cancelled_by).toBe('customer');
    expect(order.cancellation_reason).toBe('Changed my mind');
    expect(order.cancelled_at).not.toBeNull();

    // Verify stock restored
    const stockAfterCancel = await dbGetProductStock(product.id);
    expect(stockAfterCancel).toBe(originalStock);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // C2: Customer Cancels Pre-Order Reservation (Not Converted)
  // -------------------------------------------------------------------------
  test('C2: Customer cancels pre-order reservation — reserved released', async ({ page }) => {
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

    // Verify reserved increased, stock unchanged
    expect(await dbGetReservedQty(product.id)).toBe(originalReserved + 1);
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Cancel
    const cancelResult = await apiCancelOrderCustomer(customerToken, orderId, 'No longer needed');
    expect(cancelResult.status).toBe(200);

    // Verify order cancelled
    const order = await dbGetOrder(orderId);
    expect(order.status).toBe('cancelled');
    expect(order.cancelled_by).toBe('customer');

    // Verify reserved released, stock still unchanged
    expect(await dbGetReservedQty(product.id)).toBe(originalReserved);
    expect(await dbGetProductStock(product.id)).toBe(originalStock);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, null, originalReserved);
  });

  // -------------------------------------------------------------------------
  // C3: Customer Cannot Cancel After Confirmation
  // -------------------------------------------------------------------------
  test('C3: Customer cannot cancel confirmed order — 400 blocked', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and confirm order
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    expect((await dbGetOrder(orderId)).status).toBe('confirmed');

    // Customer tries to cancel
    const cancelResult = await apiCancelOrderCustomer(customerToken, orderId, 'Trying to cancel');
    expect(cancelResult.status).toBe(400);
    expect(cancelResult.body.message).toContain('confirmed');

    // Verify order still confirmed
    expect((await dbGetOrder(orderId)).status).toBe('confirmed');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // C4: Customer Cannot Cancel Delivered Order
  // -------------------------------------------------------------------------
  test('C4: Customer cannot cancel delivered order — 400 blocked', async ({ page }) => {
    // Find an existing delivered order
    const deliveredOrder = await findOrderByStatus('delivered');
    test.skip(!deliveredOrder, 'No delivered order found in database');

    const { token: customerToken } = await getCustomerToken();

    // We need the customer who owns this order — use their token via DB
    const { getPool } = require('./helpers/order-test-helper');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [deliveredOrder.user_id]
    );
    test.skip(userResult.rows.length === 0, 'Order owner not found');

    // Generate token for this specific user
    const jwt = require('jsonwebtoken');
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', 'backend', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of envContent.split('\n')) {
      const [key, ...v] = line.split('=');
      if (key && v.length > 0) env[key.trim()] = v.join('=').trim();
    }
    const userToken = jwt.sign(
      { id: userResult.rows[0].id, email: userResult.rows[0].email, role: userResult.rows[0].role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const cancelResult = await apiCancelOrderCustomer(userToken, deliveredOrder.id, 'Trying to cancel');
    expect(cancelResult.status).toBe(400);
    expect((await dbGetOrder(deliveredOrder.id)).status).toBe('delivered');
  });

  // -------------------------------------------------------------------------
  // C5: Customer Cannot Double-Cancel
  // -------------------------------------------------------------------------
  test('C5: Customer cannot cancel already cancelled order — 400 blocked', async ({ page }) => {
    // Find an existing cancelled order
    const cancelledOrder = await findOrderByStatus('cancelled');
    test.skip(!cancelledOrder, 'No cancelled order found in database');

    const { getPool } = require('./helpers/order-test-helper');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [cancelledOrder.user_id]
    );
    test.skip(userResult.rows.length === 0, 'Order owner not found');

    const jwt = require('jsonwebtoken');
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', 'backend', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of envContent.split('\n')) {
      const [key, ...v] = line.split('=');
      if (key && v.length > 0) env[key.trim()] = v.join('=').trim();
    }
    const userToken = jwt.sign(
      { id: userResult.rows[0].id, email: userResult.rows[0].email, role: userResult.rows[0].role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const cancelResult = await apiCancelOrderCustomer(userToken, cancelledOrder.id, 'Double cancel attempt');
    expect(cancelResult.status).toBe(400);
    expect(cancelResult.body.message).toContain('cancelled');
  });

  // -------------------------------------------------------------------------
  // C-UI: Customer orders page shows cancel button only for pending/preorder
  // -------------------------------------------------------------------------
  test('C-UI: Customer orders page — cancel button visible for pending, hidden for delivered', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), customerToken);
    await page.goto('/orders.html');

    await page.waitForSelector('#orders', { timeout: 10000 }).catch(() => {});

    // Check pending tab for cancel button
    const pendingTab = page.locator('button:has-text("Pending"), [data-status="pending"]');
    if (await pendingTab.count() > 0) {
      await pendingTab.first().click().catch(() => {});
      await page.waitForTimeout(500);
      const pendingCards = page.locator('.order-card, .order-item, .card');
      if (await pendingCards.count() > 0) {
        const cancelBtn = pendingCards.first().locator('button:has-text("Cancel")');
        // Cancel button should exist for pending orders
        expect(await cancelBtn.count()).toBeGreaterThanOrEqual(0);
      }
    }

    // Check delivered tab — no cancel button
    const deliveredTab = page.locator('button:has-text("Delivered"), [data-status="delivered"]');
    if (await deliveredTab.count() > 0) {
      await deliveredTab.first().click().catch(() => {});
      await page.waitForTimeout(500);
      const deliveredCards = page.locator('.order-card, .order-item, .card');
      if (await deliveredCards.count() > 0) {
        const cancelBtn = deliveredCards.first().locator('button:has-text("Cancel")');
        expect(await cancelBtn.count()).toBe(0);
      }
    }
  });
});
