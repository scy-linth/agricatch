/**
 * Setup Test Orders for Task 3 Regression Test (Direct Database)
 * 
 * Creates test orders directly in database for:
 * - Scenario A: Farmer Cancel (regular available product)
 * - Scenario B: Admin Cancel (pre-order not converted)
 * - Scenario C: Delivered (out_for_delivery status)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function setupTestOrders() {
  console.log('=== Setting up Test Orders for Task 3 (Direct DB) ===\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get test customer and product IDs
    const customerResult = await client.query(
      "SELECT id FROM users WHERE email = 'testcustomer@test.com' LIMIT 1"
    );
    if (customerResult.rows.length === 0) {
      throw new Error('Test customer not found');
    }
    const customerId = customerResult.rows[0].id;
    console.log('✓ Customer ID:', customerId);
    
    // Get regular product (Chico)
    const regularProductResult = await client.query(
      "SELECT id, farmer_id, price FROM products WHERE id = 15 LIMIT 1"
    );
    if (regularProductResult.rows.length === 0) {
      throw new Error('Regular product not found');
    }
    const regularProduct = regularProductResult.rows[0];
    console.log('✓ Regular Product ID:', regularProduct.id, 'Farmer ID:', regularProduct.farmer_id);
    
    // Get pre-order product (Kangkong)
    const preorderProductResult = await client.query(
      "SELECT id, farmer_id, price FROM products WHERE id = 65 LIMIT 1"
    );
    if (preorderProductResult.rows.length === 0) {
      throw new Error('Pre-order product not found');
    }
    const preorderProduct = preorderProductResult.rows[0];
    console.log('✓ Pre-order Product ID:', preorderProduct.id, 'Farmer ID:', preorderProduct.farmer_id);
    console.log();
    
    // Scenario A: Regular available product for Farmer Cancel
    console.log('1. Creating Order A (Farmer Cancel - Regular Product)...');
    const orderAResult = await client.query(
      `INSERT INTO orders (user_id, product_id, quantity, price, total_amount, status, is_preorder, delivery_address, created_at, updated_at)
       VALUES ($1, $2, 1, $3, $4, 'pending', false, 'Test Customer | +639123456789 | Task 3 Scenario A - Farmer Cancel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [customerId, regularProduct.id, regularProduct.price, regularProduct.price]
    );
    const orderAId = orderAResult.rows[0].id;
    console.log('✓ Order A created:', orderAId);
    
    // Deduct stock
    await client.query(
      'UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = $1',
      [regularProduct.id]
    );
    console.log('✓ Stock deducted for product', regularProduct.id);
    console.log();
    
    // Scenario B: Pre-order for Admin Cancel
    console.log('2. Creating Order B (Admin Cancel - Pre-order)...');
    const orderBResult = await client.query(
      `INSERT INTO orders (user_id, product_id, quantity, price, total_amount, status, is_preorder, preorder_reserved_quantity, delivery_address, created_at, updated_at)
       VALUES ($1, $2, 1, $3, $4, 'preorder_reserved', true, 1, 'Test Customer | +639123456789 | Task 3 Scenario B - Admin Cancel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [customerId, preorderProduct.id, preorderProduct.price, preorderProduct.price]
    );
    const orderBId = orderBResult.rows[0].id;
    console.log('✓ Order B created:', orderBId);
    
    // Increment reserved quantity
    await client.query(
      'UPDATE products SET reserved_quantity = reserved_quantity + 1 WHERE id = $1',
      [preorderProduct.id]
    );
    console.log('✓ Reserved quantity incremented for product', preorderProduct.id);
    console.log();
    
    // Scenario C: Order for Delivered test
    console.log('3. Creating Order C (Delivered)...');
    const orderCResult = await client.query(
      `INSERT INTO orders (user_id, product_id, quantity, price, total_amount, status, is_preorder, delivery_address, created_at, updated_at)
       VALUES ($1, $2, 2, $3, $4, 'out_for_delivery', false, 'Test Customer | +639123456789 | Task 3 Scenario C - Delivered', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [customerId, regularProduct.id, regularProduct.price, regularProduct.price * 2]
    );
    const orderCId = orderCResult.rows[0].id;
    console.log('✓ Order C created:', orderCId);
    
    // Deduct stock
    await client.query(
      'UPDATE products SET stock_quantity = stock_quantity - 2 WHERE id = $1',
      [regularProduct.id]
    );
    console.log('✓ Stock deducted for product', regularProduct.id);
    console.log();
    
    await client.query('COMMIT');
    
    console.log('=== Test Orders Setup Complete ===');
    console.log('Order IDs for regression test:');
    console.log(`  Scenario A (Farmer Cancel): ${orderAId}`);
    console.log(`  Scenario B (Admin Cancel): ${orderBId}`);
    console.log(`  Scenario C (Delivered): ${orderCId}`);
    console.log();
    console.log('Run regression test with:');
    console.log(`  node backend/scripts/test_task3_admin_status_consistency.js ${orderAId} ${orderBId} ${orderCId}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Setup failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

setupTestOrders();
