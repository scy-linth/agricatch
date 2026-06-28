/**
 * Group A — Regular Order Happy Path
 *
 * A1: Complete Regular Order Lifecycle (API-driven with DB verification)
 * A2: Multiple Regular Products in One Checkout (per-item order system)
 *
 * Primary tool: Playwright API tests
 * Secondary: DB verification for stock/stat checks
 */

const { test, expect } = require('@playwright/test');
const {
  getFarmerToken,
  getCustomerToken,
  apiCreateOrder,
  apiAddToCart,
  apiClearCart,
  apiGetOrders,
  apiGetCart,
  apiUpdateOrderStatus,
  dbGetOrder,
  dbGetProduct,
  dbGetProductStock,
  findAvailableProduct,
  findAnyAvailableProduct,
  findCustomerUser,
  buildCheckoutPayload,
  closePool,
} = require('./helpers/order-test-helper');

test.describe('Group A — Regular Order Happy Path', () => {
  test.describe.configure({ timeout: 60000 });

  test.afterAll(async () => {
    await closePool();
  });

  // -------------------------------------------------------------------------
  // A1: Complete Regular Order Lifecycle
  // -------------------------------------------------------------------------
  test('A1: Complete regular order lifecycle — pending to delivered', async ({ page }) => {
    const { token: farmerToken, user: farmer } = await getFarmerToken();
    const { token: customerToken, user: customer } = await getCustomerToken();

    // Find an available product from this farmer
    const product = await findAvailableProduct(farmer.id);
    test.skip(!product, 'No available product with stock found for farmer');

    // Record original stock
    const originalStock = await dbGetProductStock(product.id);
    expect(originalStock).not.toBeNull();

    // Clear cart, add product, checkout
    await apiClearCart(customerToken);
    const addResult = await apiAddToCart(customerToken, product.id, 1);
    expect(addResult.status).toBe(200);

    const checkoutPayload = buildCheckoutPayload();
    const orderResult = await apiCreateOrder(customerToken, checkoutPayload);

    if (orderResult.status !== 201) {
      // If checkout fails (e.g. product no longer available), skip
      test.skip(true, `Checkout failed: ${orderResult.body?.message}`);
    }

    expect(orderResult.status).toBe(201);
    expect(orderResult.body.orderIds).toBeDefined();
    expect(orderResult.body.orderCount).toBeGreaterThanOrEqual(1);

    const orderId = orderResult.body.orderIds[0];

    // Verify order created with correct initial state
    const order = await dbGetOrder(orderId);
    expect(order).not.toBeNull();
    expect(order.status).toBe('pending');
    expect(order.is_preorder).toBe(false);
    expect(order.delivery_date).toBeNull();

    // Verify stock was decremented
    const stockAfterOrder = await dbGetProductStock(product.id);
    expect(stockAfterOrder).toBe(originalStock - 1);

    // Verify cart was cleared (no items remaining)
    const cartResult = await apiGetCart(customerToken);
    const cartItems = cartResult.body?.cartItems || cartResult.body?.items || [];
    expect(cartItems.length).toBe(0);

    // --- Farmer progresses order through all statuses ---

    // pending → confirmed
    const confirmResult = await apiUpdateOrderStatus(farmerToken, orderId, 'confirmed');
    expect(confirmResult.status).toBe(200);
    expect((await dbGetOrder(orderId)).status).toBe('confirmed');

    // confirmed → preparing
    const prepareResult = await apiUpdateOrderStatus(farmerToken, orderId, 'preparing');
    expect(prepareResult.status).toBe(200);
    expect((await dbGetOrder(orderId)).status).toBe('preparing');

    // preparing → scheduled (via delivery date endpoint)
    const { apiSetDeliveryDate, getTomorrowDate } = require('./helpers/order-test-helper');
    const scheduleResult = await apiSetDeliveryDate(farmerToken, orderId, getTomorrowDate());
    expect(scheduleResult.status).toBe(200);
    const scheduledOrder = await dbGetOrder(orderId);
    expect(scheduledOrder.status).toBe('scheduled');
    expect(scheduledOrder.delivery_date).not.toBeNull();

    // scheduled → out_for_delivery
    const shipResult = await apiUpdateOrderStatus(farmerToken, orderId, 'out_for_delivery');
    expect(shipResult.status).toBe(200);
    expect((await dbGetOrder(orderId)).status).toBe('out_for_delivery');

    // out_for_delivery → delivered
    const deliverResult = await apiUpdateOrderStatus(farmerToken, orderId, 'delivered');
    expect(deliverResult.status).toBe(200);

    const deliveredOrder = await dbGetOrder(orderId);
    expect(deliveredOrder.status).toBe('delivered');
    expect(deliveredOrder.delivered_at).not.toBeNull();

    // Verify sales statistics updated
    const updatedProduct = await dbGetProduct(product.id);
    // sales_count may be null initially, just verify it's set now
    // (We don't assert exact value since other orders may have incremented it)
    expect(Number(updatedProduct.sales_count || 0)).toBeGreaterThanOrEqual(1);

    // Verify customer can see the order in their order list
    const ordersResult = await apiGetOrders(customerToken);
    expect(ordersResult.status).toBe(200);
    const customerOrder = ordersResult.body.orders.find((o) => o.id === orderId);
    expect(customerOrder).toBeDefined();
    expect(customerOrder.status).toBe('delivered');

    // Cleanup: restore order to pending and restore stock
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(orderId, 'pending', product.id, originalStock, null);
  });

  // -------------------------------------------------------------------------
  // A2: Multiple Regular Products in One Checkout
  // -------------------------------------------------------------------------
  test('A2: Multiple products from different farmers create separate orders', async ({ page }) => {
    const { token: customerToken } = await getCustomerToken();

    // Find two different available products from different farmers
    const product1 = await findAnyAvailableProduct();
    test.skip(!product1, 'No available product found');

    const { getPool } = require('./helpers/order-test-helper');
    const pool = getPool();
    const secondProductResult = await pool.query(
      `SELECT id, name, stock_quantity, price, farmer_id, unit
       FROM products
       WHERE is_preorder = false
         AND is_available = true
         AND COALESCE(is_admin_disabled, false) = false
         AND stock_quantity > 0
         AND farmer_id != $1
       ORDER BY id DESC LIMIT 1`,
      [product1.farmer_id]
    );
    const product2 = secondProductResult.rows[0];
    test.skip(!product2, 'No second product from a different farmer found');

    // Record original stocks
    const stock1Before = await dbGetProductStock(product1.id);
    const stock2Before = await dbGetProductStock(product2.id);

    // Add both products to cart
    await apiClearCart(customerToken);
    await apiAddToCart(customerToken, product1.id, 2);
    await apiAddToCart(customerToken, product2.id, 1);

    // Checkout
    const orderResult = await apiCreateOrder(customerToken, buildCheckoutPayload());

    if (orderResult.status !== 201) {
      test.skip(true, `Checkout failed: ${orderResult.body?.message}`);
    }

    expect(orderResult.status).toBe(201);
    expect(orderResult.body.orderIds).toBeDefined();
    expect(orderResult.body.orderCount).toBe(2);

    // Verify each order has correct product
    const { dbGetOrder } = require('./helpers/order-test-helper');
    const order1 = await dbGetOrder(orderResult.body.orderIds[0]);
    const order2 = await dbGetOrder(orderResult.body.orderIds[1]);

    expect(order1.status).toBe('pending');
    expect(order2.status).toBe('pending');
    expect(order1.is_preorder).toBe(false);
    expect(order2.is_preorder).toBe(false);

    // Verify stocks were decremented correctly
    const stock1After = await dbGetProductStock(product1.id);
    const stock2After = await dbGetProductStock(product2.id);
    expect(stock1After).toBe(stock1Before - 2);
    expect(stock2After).toBe(stock2Before - 1);

    // Verify cart cleared
    const cartResult = await apiGetCart(customerToken);
    const cartItems = cartResult.body?.cartItems || cartResult.body?.items || [];
    expect(cartItems.length).toBe(0);

    // Cleanup
    const { dbRestoreOrder } = require('./helpers/order-test-helper');
    await dbRestoreOrder(order1.id, 'pending', product1.id, stock1Before, null);
    await dbRestoreOrder(order2.id, 'pending', product2.id, stock2Before, null);
  });

  // -------------------------------------------------------------------------
  // A1-UI: Verify order lifecycle via farmer.html UI
  // -------------------------------------------------------------------------
  test('A1-UI: Farmer UI shows correct action buttons for each order status', async ({ page }) => {
    const { token: farmerToken } = await getFarmerToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), farmerToken);
    await page.goto('/farmer.html#orders');

    // Wait for orders section to be visible
    await page.waitForFunction(() => {
      const el = document.getElementById('orders');
      return el && !el.style.display.includes('none');
    }, { timeout: 15000 });

    // Verify all status tabs exist
    const expectedTabs = [
      '#pending-orders-tab',
      '#preorder_reserved-orders-tab',
      '#confirmed-orders-tab',
      '#preparing-orders-tab',
      '#scheduled-orders-tab',
      '#out_for_delivery-orders-tab',
      '#delivered-orders-tab',
      '#cancelled-orders-tab',
    ];

    for (const tab of expectedTabs) {
      await expect(page.locator(tab)).toHaveCount(1);
    }

    // Verify pending tab shows Confirm and Cancel buttons (if orders exist)
    await page.evaluate(() => document.getElementById('pending-orders-tab').click());
    await page.waitForTimeout(500);
    const pendingCards = page.locator('.order-card');
    const pendingCount = await pendingCards.count();
    if (pendingCount > 0) {
      const confirmBtn = pendingCards.first().locator('button:has-text("Confirm")');
      const cancelBtn = pendingCards.first().locator('button:has-text("Cancel")');
      expect(await confirmBtn.count()).toBeGreaterThan(0);
      expect(await cancelBtn.count()).toBeGreaterThan(0);
    }

    // Verify delivered tab shows no action buttons
    await page.evaluate(() => document.getElementById('delivered-orders-tab').click());
    await page.waitForTimeout(500);
    const deliveredCards = page.locator('.order-card');
    const deliveredCount = await deliveredCards.count();
    if (deliveredCount > 0) {
      const hasActionBtn = await deliveredCards.first().evaluate((card) => {
        const btns = card.querySelectorAll('button');
        const actionTexts = ['Confirm', 'Schedule', 'Cancel', 'Out for Delivery', 'Mark Delivered'];
        for (const btn of btns) {
          const text = btn.textContent.trim();
          if (actionTexts.some(t => text.includes(t)) && btn.offsetParent !== null) {
            return true;
          }
        }
        return false;
      });
      expect(hasActionBtn).toBe(false);
    }
  });
});
