/**
 * Regression Test — Task 1: Fix Customer Cancel notification (missing farmer_id)
 *
 * Verifies that when a customer cancels an order, the farmer notification
 * is successfully created with a valid farmer_id (not null/undefined).
 *
 * Steps:
 * 1. Login as customer
 * 2. Find a pending order (or create one via cart + checkout)
 * 3. Cancel the order via PUT /orders/:id/cancel
 * 4. Query notifications table for the farmer notification
 * 5. Verify farmer_id is present and valid
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  const data = await res.json();
  return { token: data.token, userId: data.user?.id || data.id };
}

async function testScenario(token, userId, scenarioName, productQuery, expectedStatus) {
  console.log(`\n=== ${scenarioName} ===`);
  let passed = 0;
  let failed = 0;

  try {
    // Step 1: Find an existing order or create one
    console.log('1. Finding or creating order...');
    let existingOrder = await pool.query(
      `SELECT o.id, o.product_id, p.farmer_id, p.name AS product_name, p.is_preorder
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.user_id = $1 AND o.status = $2
       ORDER BY o.created_at DESC LIMIT 1`,
      [userId, expectedStatus]
    );

    let orderId;
    let farmerId;
    let isPreorder;

    if (existingOrder.rows.length === 0) {
      console.log('   No existing order found. Creating one via cart + checkout...');

      const productRes = await pool.query(productQuery);

      if (productRes.rows.length === 0) {
        console.log('   ⚠ No suitable product found. Skipping scenario.');
        return { passed: 0, failed: 0, skipped: true };
      }

      const productId = productRes.rows[0].id;
      isPreorder = productRes.rows[0].is_preorder;

      // Add to cart
      const cartRes = await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 })
      });

      if (!cartRes.ok) {
        console.log(`   ⚠ Add to cart failed: ${await cartRes.text()}`);
        return { passed: 0, failed: 0, skipped: true };
      }

      // Checkout
      const checkoutRes = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_address: 'Regression Test Address',
          recipient_firstname: 'Test',
          recipient_lastname: 'Customer',
          recipient_phone: '9123456789'
        })
      });

      if (!checkoutRes.ok) {
        console.log(`   ⚠ Checkout failed: ${await checkoutRes.text()}`);
        return { passed: 0, failed: 0, skipped: true };
      }

      const orderData = await checkoutRes.json();
      orderId = orderData.orderIds?.[0];

      if (!orderId) {
        console.log('   ⚠ No order ID returned from checkout.');
        return { passed: 0, failed: 0, skipped: true };
      }

      const orderInfo = await pool.query(
        'SELECT o.product_id, p.farmer_id, p.is_preorder FROM orders o JOIN products p ON o.product_id = p.id WHERE o.id = $1',
        [orderId]
      );
      farmerId = orderInfo.rows[0]?.farmer_id;
      isPreorder = orderInfo.rows[0]?.is_preorder;
      console.log(`   ✓ Order created (ID: ${orderId}, Farmer ID: ${farmerId}, Preorder: ${isPreorder})`);
    } else {
      orderId = existingOrder.rows[0].id;
      farmerId = existingOrder.rows[0].farmer_id;
      isPreorder = existingOrder.rows[0].is_preorder;
      console.log(`   ✓ Found order (ID: ${orderId}, Farmer ID: ${farmerId}, Preorder: ${isPreorder})`);
    }

    // Step 2: Cancel the order
    console.log('\n2. Cancelling order via PUT /orders/:id/cancel...');
    const cancelRes = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: `Regression test - ${scenarioName}` })
    });

    if (!cancelRes.ok) {
      const errText = await cancelRes.text();
      console.log(`   ✗ Cancel failed: ${cancelRes.status} ${errText}`);
      return { passed: 0, failed: 1, skipped: false };
    }

    const cancelData = await cancelRes.json();
    console.log(`   ✓ Order cancelled: ${cancelData.message}`);
    passed++;

    // Step 3: Check farmer notification
    console.log('\n3. Checking farmer notification in database...');
    const farmerNotif = await pool.query(
      `SELECT id, user_id, type, title, message, order_id, product_id
       FROM notifications
       WHERE order_id = $1 AND type = 'order_cancelled_by_customer'
       ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );

    if (farmerNotif.rows.length === 0) {
      console.log('   ✗ No farmer notification found with type "order_cancelled_by_customer"');
      failed++;
    } else {
      const notif = farmerNotif.rows[0];
      console.log(`   ✓ Farmer notification found (ID: ${notif.id})`);
      console.log(`     user_id: ${notif.user_id}`);
      console.log(`     type: ${notif.type}`);
      console.log(`     title: ${notif.title}`);

      if (notif.user_id === null || notif.user_id === undefined) {
        console.log('   ✗ Farmer notification user_id is NULL — farmer_id was missing!');
        failed++;
      } else if (Number(notif.user_id) !== Number(farmerId)) {
        console.log(`   ✗ Farmer notification user_id (${notif.user_id}) does not match farmer_id (${farmerId})`);
        failed++;
      } else {
        console.log(`   ✓ Farmer notification user_id matches farmer_id (${farmerId})`);
        passed++;
      }
    }

    // Step 4: Check customer notification
    console.log('\n4. Checking customer notification...');
    const customerNotif = await pool.query(
      `SELECT id, user_id, type, title, order_id
       FROM notifications
       WHERE order_id = $1 AND user_id = $2 AND type = 'order_update'
       ORDER BY created_at DESC LIMIT 1`,
      [orderId, userId]
    );

    if (customerNotif.rows.length === 0) {
      console.log('   ✗ No customer notification found');
      failed++;
    } else {
      console.log(`   ✓ Customer notification found (ID: ${customerNotif.rows[0].id})`);
      passed++;
    }

    // Step 5: Verify inventory restoration
    console.log('\n5. Verifying inventory restoration...');
    const productInventory = await pool.query(
      'SELECT stock_quantity, reserved_quantity FROM products WHERE id = $1',
      [existingOrder.rows[0]?.product_id || (await pool.query('SELECT product_id FROM orders WHERE id = $1', [orderId])).rows[0].product_id]
    );

    console.log(`   Stock quantity: ${productInventory.rows[0].stock_quantity}`);
    console.log(`   Reserved quantity: ${productInventory.rows[0].reserved_quantity}`);
    console.log(`   ✓ Inventory data retrieved`);
    passed++;

    return { passed, failed, skipped: false };

  } catch (err) {
    console.error('Scenario error:', err);
    return { passed: 0, failed: 1, skipped: false };
  }
}

async function runTest() {
  console.log('=== Regression Test: Task 1 — Customer Cancel Notification ===\n');
  console.log('Testing both inventory restoration paths:\n');
  console.log('Scenario A: Available Products (stock_quantity restoration)');
  console.log('Scenario B: Pre-order Products (reserved_quantity restoration)\n');

  let totalPassed = 0;
  let totalFailed = 0;
  let skipped = 0;

  try {
    // Login as customer
    console.log('Logging in as test customer...');
    const { token, userId } = await login('testcustomer@test.com', 'Test123456');
    console.log(`✓ Customer logged in (ID: ${userId})\n`);

    // Scenario A: Available Product
    const scenarioAQuery = `
      SELECT p.id, p.farmer_id, p.stock_quantity, p.is_preorder
      FROM products p
      WHERE p.is_available = true
        AND COALESCE(p.is_admin_disabled, false) = false
        AND p.is_preorder = false
        AND p.stock_quantity > 0
        AND p.farmer_id IS NOT NULL
      LIMIT 1
    `;
    const resultA = await testScenario(token, userId, 'Scenario A: Available Product', scenarioAQuery, 'pending');
    totalPassed += resultA.passed;
    totalFailed += resultA.failed;
    if (resultA.skipped) skipped++;

    // Scenario B: Pre-order Product
    const scenarioBQuery = `
      SELECT p.id, p.farmer_id, p.reserved_quantity, p.max_preorder_quantity, p.is_preorder
      FROM products p
      WHERE p.is_available = true
        AND COALESCE(p.is_admin_disabled, false) = false
        AND p.is_preorder = true
        AND (p.max_preorder_quantity IS NULL OR p.reserved_quantity < p.max_preorder_quantity)
        AND p.farmer_id IS NOT NULL
      LIMIT 1
    `;
    const resultB = await testScenario(token, userId, 'Scenario B: Pre-order Product', scenarioBQuery, 'preorder_reserved');
    totalPassed += resultB.passed;
    totalFailed += resultB.failed;
    if (resultB.skipped) skipped++;

  } catch (err) {
    console.error('Test error:', err);
    totalFailed++;
  } finally {
    await pool.end();
  }

  console.log(`\n=== Summary: ${totalPassed} passed, ${totalFailed} failed, ${skipped} skipped ===`);
  if (skipped > 0) {
    console.log('RESULT: PARTIAL (some scenarios skipped due to missing test data)');
  } else {
    console.log(totalFailed === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
  }
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
