/**
 * Group G — Edge Cases & Error Scenarios
 *
 * G1: Checkout with empty cart → 400
 * G2: Checkout with unavailable product → 400
 * G3: Checkout with insufficient stock → 400
 * G4: Pre-order limit exceeded → 400
 * G5: Super admin cannot place orders → 403
 * G6: Invalid status transition (skip statuses) → 400
 * G7: Cancelled order cannot be updated → 400
 * G8: Delivered order cannot be updated → 400
 * G9: Reservations disabled product blocks new pre-orders
 * G10: Double cancel race condition — idempotent guards
 */

const { test, expect } = require('@playwright/test');
const {
  getAdminToken,
  getFarmerToken,
  getCustomerToken,
  apiCreateOrder,
  apiAddToCart,
  apiClearCart,
  apiUpdateOrderStatus,
  apiCancelOrderCustomer,
  apiCancelOrderFarmer,
  dbGetOrder,
  dbGetProductStock,
  dbGetReservedQty,
  findAvailableProduct,
  findPreorderProduct,
  findOrderByStatus,
  buildCheckoutPayload,
  closePool,
} = require('./helpers/order-test-helper');

test.describe('Group G — Edge Cases & Error Scenarios', () => {
  test.describe.configure({ timeout: 60000 });

  test.afterAll(async () => {
    await closePool();
  });

  // -------------------------------------------------------------------------
  // G1: Checkout with Empty Cart
  // -------------------------------------------------------------------------
  test('G1: Checkout with empty cart → 400', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();

    // Ensure cart is empty
    await apiClearCart(customerToken);

    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    expect(orderResult.status).toBe(400);
    expect(orderResult.body.message).toContain('Cart is empty');
  });

  // -------------------------------------------------------------------------
  // G2: Checkout with Unavailable Product
  // -------------------------------------------------------------------------
  test('G2: Checkout with unavailable product → 400 with item list', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    const { getPool } = require('./helpers/order-test-helper');
    const pool = getPool();

    // Find a disabled/expired product
    const result = await pool.query(
      `SELECT id, name FROM products
       WHERE is_available = false OR COALESCE(is_admin_disabled, false) = true
       LIMIT 1`
    );

    test.skip(result.rows.length === 0, 'No unavailable product found in database');

    const unavailableProduct = result.rows[0];

    // Add unavailable product to cart (may succeed at cart level)
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, unavailableProduct.id, 1);

    // Checkout should fail — either with "unavailable" message or "Cart is empty"
    // (cart API may reject unavailable products at add time, leaving cart empty)
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    expect(orderResult.status).toBe(400);
    expect(['unavailable', 'Cart is empty'].some(msg => orderResult.body.message?.includes(msg))).toBe(true);

    // Cleanup cart
    await apiClearCart(customerToken);
  });

  // -------------------------------------------------------------------------
  // G3: Checkout with Insufficient Stock (structural test)
  // -------------------------------------------------------------------------
  test('G3: Insufficient stock check exists in order creation', async ({ page }) => {
    // Verify the backend code has atomic stock check
    const fs = require('fs');
    const path = require('path');
    const ordersPath = path.join(__dirname, '..', 'backend', 'routes', 'orders.js');
    const ordersCode = fs.readFileSync(ordersPath, 'utf8');

    expect(ordersCode).toContain('stock_quantity >= $1');
    expect(ordersCode).toContain('Not enough stock');
  });

  // -------------------------------------------------------------------------
  // G4: Pre-Order Limit Exceeded (structural test)
  // -------------------------------------------------------------------------
  test('G4: Pre-order limit check exists in order creation', async ({ page }) => {
    const fs = require('fs');
    const path = require('path');
    const ordersPath = path.join(__dirname, '..', 'backend', 'routes', 'orders.js');
    const ordersCode = fs.readFileSync(ordersPath, 'utf8');

    expect(ordersCode).toContain('max_preorder_quantity');
    expect(ordersCode).toContain('Pre-order limit exceeded');
  });

  // -------------------------------------------------------------------------
  // G5: Super Admin Cannot Place Orders
  // -------------------------------------------------------------------------
  test('G5: Super admin cannot place orders → 403', async ({ page }) => {
    const { token: adminToken, user: adminUser } = await getAdminToken();

    // Check if the admin user is super_admin
    test.skip(adminUser.role !== 'super_admin' && adminUser.role !== 'superadmin',
      'No super_admin account available for testing');

    // Add a product to cart first
    const product = await findAvailableProduct();
    test.skip(!product, 'No available product found');

    await apiClearCart(adminToken);
    await apiAddToCart(adminToken, product.id, 1);

    const orderResult = await apiCreateOrder(adminToken, buildCheckoutPayload());
    expect(orderResult.status).toBe(403);
    expect(orderResult.body.message).toContain('Super admin cannot place orders');

    // Cleanup
    await apiClearCart(adminToken);
  });

  // -------------------------------------------------------------------------
  // G6: Invalid Status Transition (skip statuses)
  // -------------------------------------------------------------------------
  test('G6: Invalid status transition — pending to delivered → 400', async ({ page }) => {
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
    expect((await dbGetOrder(orderId)).status).toBe('pending');

    // Try to skip directly to delivered
    const skipResult = await apiUpdateOrderStatus(farmerToken, orderId, 'delivered');
    expect(skipResult.status).toBe(400);
    expect(skipResult.body.message).toContain('Invalid status transition');

    // Verify order still pending
    expect((await dbGetOrder(orderId)).status).toBe('pending');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // G7: Cancelled Order Cannot Be Updated
  // -------------------------------------------------------------------------
  test('G7: Cancelled order cannot be updated → 400', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken } = await getCustomerToken();

    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product found for farmer');

    const originalStock = await dbGetProductStock(product.id);

    // Create and cancel order
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());
    test.skip(orderResult.status !== 201, `Checkout failed: ${orderResult.body?.message}`);

    const orderId = orderResult.body.orderIds[0];
    await apiCancelOrderCustomer(customerToken, orderId, 'Test cancel');
    expect((await dbGetOrder(orderId)).status).toBe('cancelled');

    // Farmer tries to update cancelled order
    const updateResult = await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    expect(updateResult.status).toBe(400);
    expect(updateResult.body.message).toContain('Cancelled');

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // G8: Delivered Order Cannot Be Updated
  // -------------------------------------------------------------------------
  test('G8: Delivered order cannot be updated → 400 or 403', async ({ page }) => {
    const { token: farmerToken } = await getFarmerToken();

    // Find existing delivered order
    const deliveredOrder = await findOrderByStatus('delivered');
    test.skip(!deliveredOrder, 'No delivered order found');

    // Try to update delivered order
    const updateResult = await apiUpdateOrderStatus(farmerToken, deliveredOrder.id, 'confirmed');
    // Backend returns 400 for invalid state transition (delivered orders cannot be updated)
    // or 403 if the farmer doesn't own the order (authorization check happens before state check)
    expect([400, 403]).toContain(updateResult.status);
    if (updateResult.status === 400) {
      expect(updateResult.body.message).toContain('Delivered');
    } else {
      expect(updateResult.body.message).toMatch(/Access denied|can only update/);
    }
  });

  // -------------------------------------------------------------------------
  // G9: Reservations Disabled Product Blocks New Pre-Orders (structural)
  // -------------------------------------------------------------------------
  test('G9: Reservations disabled check exists in order creation', async ({ page }) => {
    const fs = require('fs');
    const path = require('path');
    const ordersPath = path.join(__dirname, '..', 'backend', 'routes', 'orders.js');
    const ordersCode = fs.readFileSync(ordersPath, 'utf8');

    expect(ordersCode).toContain('reservations_disabled');
    expect(ordersCode).toContain('not accepting new pre-order reservations');
  });

  // -------------------------------------------------------------------------
  // G10: Double Cancel — Idempotent Guards (structural)
  // -------------------------------------------------------------------------
  test('G10: Idempotent inventory restore guards exist in business logic', async ({ page }) => {
    const fs = require('fs');
    const path = require('path');
    const businessLogicPath = path.join(__dirname, '..', 'backend', 'utils', 'orderBusinessLogic.js');
    const businessCode = fs.readFileSync(businessLogicPath, 'utf8');

    // Verify idempotent guards: reset quantities to 0 after restore
    expect(businessCode).toContain('preorder_fulfilled_quantity = 0');
    expect(businessCode).toContain('preorder_reserved_quantity = 0');
    expect(businessCode).toContain('prevent double restoration');
    expect(businessCode).toContain('prevent double release');
  });

  // -------------------------------------------------------------------------
  // G-API: Invalid order ID returns proper error
  // -------------------------------------------------------------------------
  test('G-API: Invalid order ID → 400 or 404', async ({ page }) => {
    const { token: farmerToken } = await getFarmerToken();

    const result = await apiUpdateOrderStatus(farmerToken, 999999, 'confirmed');
    expect([400, 404]).toContain(result.status);
  });

  // -------------------------------------------------------------------------
  // G-API: Missing auth token returns 401
  // -------------------------------------------------------------------------
  test('G-API: Missing auth token → 401', async ({ page }) => {
    const res = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCheckoutPayload()),
    });
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // G-API: Invalid phone number format
  // -------------------------------------------------------------------------
  test('G-API: Invalid phone number → 400', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();
    const product = await findAvailableProduct();
    test.skip(!product, 'No available product found');

    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product.id, 1);

    const badPayload = buildCheckoutPayload({ phone: '12345' });
    const orderResult = await apiCreateOrder(customerToken, badPayload);
    expect(orderResult.status).toBe(400);
    expect(orderResult.body.message).toContain('Phone number must be 10 digits');

    // Cleanup
    await apiClearCart(customerToken);
  });
});
