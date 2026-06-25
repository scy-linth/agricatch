const { Pool } = require('pg');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'http://localhost:3000/api';

async function makeRequest(url, method, token, body) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTest() {
  console.log('=== HARVEST & FULFILL API TEST ===\n');
  let productId = null;
  let orderIds = [];

  try {
    const farmerResult = await pool.query("SELECT id, username FROM users WHERE role = 'farmer' LIMIT 1");
    const customerResult = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
    const categoryResult = await pool.query('SELECT id FROM categories LIMIT 1');

    if (!farmerResult.rows.length || !customerResult.rows.length || !categoryResult.rows.length) {
      console.error('Missing required test data (farmer, customer, or category).');
      return;
    }

    const farmer = farmerResult.rows[0];
    const customerId = customerResult.rows[0].id;
    const categoryId = categoryResult.rows[0].id;

    const token = jwt.sign(
      { id: farmer.id, username: farmer.username, role: 'farmer' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test preorder product with 30 reserved units
    const productResult = await pool.query(`
      INSERT INTO products (
        name, description, price, category_id, farmer_id, stock_quantity, unit,
        is_preorder, preorder_availability_date, max_preorder_quantity, reserved_quantity,
        is_available, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      'Test Harvest Fulfill Product',
      'Test product for harvest & fulfill workflow',
      100,
      categoryId,
      farmer.id,
      0,
      'kg',
      true,
      '2026-12-31',
      50,
      30,
      true,
      'approved'
    ]);
    productId = productResult.rows[0].id;
    console.log(`Created test product ID: ${productId}`);

    // Create 3 pre-order orders totaling 30 units
    for (let i = 0; i < 3; i++) {
      const qty = i === 2 ? 10 : 10;
      const orderResult = await pool.query(`
        INSERT INTO orders (
          user_id, product_id, quantity, price, total_amount, delivery_address,
          delivery_date, is_preorder, preorder_reserved_quantity, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        customerId,
        productId,
        qty,
        100,
        qty * 100,
        'Test Address',
        '2026-12-31',
        true,
        qty,
        'preorder_reserved'
      ]);
      orderIds.push(orderResult.rows[0].id);
    }
    console.log(`Created ${orderIds.length} pre-order orders: ${orderIds.join(', ')}`);

    // Test race-condition simulation by reading reserved before call
    const beforeProduct = await pool.query('SELECT reserved_quantity, stock_quantity, max_preorder_quantity FROM products WHERE id = $1', [productId]);
    console.log(`\nBefore harvest: reserved=${beforeProduct.rows[0].reserved_quantity}, stock=${beforeProduct.rows[0].stock_quantity}, max=${beforeProduct.rows[0].max_preorder_quantity}`);

    // Call the harvest & fulfill endpoint
    const harvestQuantity = 40;
    console.log(`\nCalling POST /products/${productId}/convert-preorders with harvest_quantity=${harvestQuantity}...`);
    const response = await makeRequest(`${BASE_URL}/products/${productId}/convert-preorders`, 'POST', token, { harvest_quantity: harvestQuantity });

    console.log(`Response status: ${response.status}`);
    console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);

    // Verify database state
    const afterProduct = await pool.query('SELECT reserved_quantity, stock_quantity, max_preorder_quantity FROM products WHERE id = $1', [productId]);
    const afterOrders = await pool.query(`
      SELECT id, status, preorder_reserved_quantity, preorder_fulfilled_quantity, quantity
      FROM orders WHERE id = ANY($1::int[])
    `, [orderIds]);

    console.log(`\nAfter harvest: reserved=${afterProduct.rows[0].reserved_quantity}, stock=${afterProduct.rows[0].stock_quantity}, max=${afterProduct.rows[0].max_preorder_quantity}`);
    console.log('After orders:');
    afterOrders.rows.forEach(row => {
      console.log(`  Order ${row.id}: status=${row.status}, qty=${row.quantity}, fulfilled=${row.preorder_fulfilled_quantity}, reserved=${row.preorder_reserved_quantity}`);
    });

    // Assertions
    const checks = [];
    checks.push({ name: 'API returned 200', pass: response.status === 200 });
    checks.push({ name: 'allocated_quantity === 30', pass: response.data?.allocated_quantity === 30 });
    checks.push({ name: 'surplus_quantity === 10', pass: response.data?.surplus_quantity === 10 });
    checks.push({ name: 'shortage_quantity === 0', pass: response.data?.shortage_quantity === 0 });
    checks.push({ name: 'new_stock_quantity === 10', pass: response.data?.new_stock_quantity === 10 });
    checks.push({ name: 'product reserved_quantity === 0', pass: afterProduct.rows[0].reserved_quantity === 0 });
    checks.push({ name: 'product stock_quantity === 10', pass: afterProduct.rows[0].stock_quantity === 10 });
    checks.push({ name: 'all orders status === confirmed', pass: afterOrders.rows.every(r => r.status === 'confirmed') });
    checks.push({ name: 'all orders fulfilled === quantity', pass: afterOrders.rows.every(r => Number(r.preorder_fulfilled_quantity) === Number(r.quantity)) });
    checks.push({ name: 'all orders reserved === 0', pass: afterOrders.rows.every(r => Number(r.preorder_reserved_quantity) === 0) });

    console.log('\n=== RESULTS ===');
    let passed = 0;
    let failed = 0;
    for (const check of checks) {
      if (check.pass) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}`);
        failed++;
      }
    }
    console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  } catch (error) {
    console.error('Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    if (orderIds.length) {
      await pool.query('DELETE FROM notifications WHERE order_id = ANY($1::int[])', [orderIds]).catch(() => {});
      await pool.query('DELETE FROM orders WHERE id = ANY($1::int[])', [orderIds]).catch(() => {});
    }
    if (productId) {
      await pool.query('DELETE FROM products WHERE id = $1', [productId]).catch(() => {});
    }
    await pool.end();
    console.log('\nCleanup complete.');
  }
}

runTest();
