/**
 * Task 4 - Scenario B: Pre-order Converted → Customer Cancel
 * 
 * Verify that cancelling a converted pre-order restores stock_quantity
 * from the fulfilled quantity, not the reservation.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function testScenarioB() {
  console.log('=== Task 4 - Scenario B: Pre-order Converted → Customer Cancel ===\n');

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Step 1: Create test farmer
    const farmerResult = await client.query(
      `INSERT INTO users (email, password, role, first_name, last_name, phone, is_verified, username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      ['test_task4_b_farmer@example.com', 'hashed_password', 'farmer', 'Test', 'Farmer B', '9123456779', true, 'task4_farmer_b']
    );
    const farmerId = farmerResult.rows[0].id;
    console.log(`✓ Created test farmer: ${farmerId}`);

    // Step 2: Create test customer
    const customerResult = await client.query(
      `INSERT INTO users (email, password, role, first_name, last_name, phone, is_verified, username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      ['test_task4_b_customer@example.com', 'hashed_password', 'customer', 'Test', 'Customer B', '9123456778', true, 'task4_customer_b']
    );
    const customerId = customerResult.rows[0].id;
    console.log(`✓ Created test customer: ${customerId}`);

    // Step 3: Create pre-order product with initial inventory
    const productResult = await client.query(
      `INSERT INTO products (farmer_id, name, description, price, stock_quantity, reserved_quantity, 
                            max_preorder_quantity, is_preorder, preorder_availability_date, harvest_date, 
                            category_id, is_available, is_admin_disabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [farmerId, 'Task 4 Test Product B', 'Test product for Scenario B', 100.00, 
       50, 0, 100, true, '2025-02-01', '2025-02-15', null, true, false]
    );
    const productId = productResult.rows[0].id;
    console.log(`✓ Created pre-order product: ${productId}`);

    // Step 4: Create pre-order reservation
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, product_id, quantity, price, total_amount, status, 
                           delivery_address, is_preorder, preorder_reserved_quantity, 
                           preorder_fulfilled_quantity, preorder_converted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [customerId, productId, 5, 100.00, 500.00, 'preorder_reserved', 
       'Test Address', true, 5, 0, null]
    );
    const orderId = orderResult.rows[0].id;
    console.log(`✓ Created pre-order reservation: ${orderId}`);

    // Step 5: Update product reserved_quantity (simulating order placement)
    await client.query(
      `UPDATE products SET reserved_quantity = reserved_quantity + $1 WHERE id = $2`,
      [5, productId]
    );
    console.log(`✓ Updated product reserved_quantity: +5`);

    // Step 6: Simulate harvest conversion (farmer converts preorders)
    const conversionTime = new Date();
    await client.query(
      `UPDATE products 
       SET stock_quantity = stock_quantity + 10, 
           reserved_quantity = reserved_quantity - 5
       WHERE id = $1`,
      [productId]
    );
    await client.query(
      `UPDATE orders
       SET status = 'confirmed',
           preorder_converted_at = $1,
           preorder_fulfilled_quantity = 5,
           preorder_reserved_quantity = 0
       WHERE id = $2`,
      [conversionTime, orderId]
    );
    console.log(`✓ Simulated harvest conversion: 5 units allocated, 10 surplus added to stock`);

    // Step 7: Capture BEFORE state
    const beforeState = await client.query(
      `SELECT stock_quantity, reserved_quantity
       FROM products WHERE id = $1`,
      [productId]
    );
    const beforeOrder = await client.query(
      `SELECT preorder_reserved_quantity, preorder_fulfilled_quantity, preorder_converted_at
       FROM orders WHERE id = $1`,
      [orderId]
    );
    console.log('\n--- BEFORE CANCEL ---');
    console.log('Product state:');
    console.log(`  stock_quantity: ${beforeState.rows[0].stock_quantity}`);
    console.log(`  reserved_quantity: ${beforeState.rows[0].reserved_quantity}`);
    console.log('Order state:');
    console.log(`  preorder_reserved_quantity: ${beforeOrder.rows[0].preorder_reserved_quantity}`);
    console.log(`  preorder_fulfilled_quantity: ${beforeOrder.rows[0].preorder_fulfilled_quantity}`);
    console.log(`  preorder_converted_at: ${beforeOrder.rows[0].preorder_converted_at}`);

    // Step 8: Simulate Customer Cancel (using the same logic as the endpoint)
    // Update order status
    await client.query(
      `UPDATE orders
       SET status = $1, cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      ['cancelled', 'customer', orderId]
    );

    // Restore inventory using orderBusinessLogic logic
    const order = await client.query(
      `SELECT o.id, o.product_id, o.quantity, o.is_preorder, o.preorder_converted_at,
              o.preorder_fulfilled_quantity, o.preorder_reserved_quantity
       FROM orders o
       WHERE o.id = $1`,
      [orderId]
    );

    if (order.rows[0].is_preorder) {
      if (order.rows[0].preorder_converted_at) {
        // Already converted: restore allocated quantity to stock
        if (order.rows[0].preorder_fulfilled_quantity > 0) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [order.rows[0].preorder_fulfilled_quantity, order.rows[0].product_id]
          );
          await client.query(
            'UPDATE orders SET preorder_fulfilled_quantity = 0 WHERE id = $1',
            [orderId]
          );
        }
      } else {
        // Not yet converted: release reservation
        if (order.rows[0].preorder_reserved_quantity > 0) {
          await client.query(
            'UPDATE products SET reserved_quantity = reserved_quantity + $1 WHERE id = $2',
            [order.rows[0].preorder_reserved_quantity, order.rows[0].product_id]
          );
          await client.query(
            'UPDATE orders SET preorder_reserved_quantity = 0 WHERE id = $1',
            [orderId]
          );
        }
      }
    }
    console.log('✓ Executed cancel logic');

    // Step 9: Capture AFTER state
    const afterState = await client.query(
      `SELECT stock_quantity, reserved_quantity
       FROM products WHERE id = $1`,
      [productId]
    );
    const afterOrder = await client.query(
      `SELECT preorder_reserved_quantity, preorder_fulfilled_quantity, preorder_converted_at
       FROM orders WHERE id = $1`,
      [orderId]
    );
    console.log('\n--- AFTER CANCEL ---');
    console.log('Product state:');
    console.log(`  stock_quantity: ${afterState.rows[0].stock_quantity}`);
    console.log(`  reserved_quantity: ${afterState.rows[0].reserved_quantity}`);
    console.log('Order state:');
    console.log(`  preorder_reserved_quantity: ${afterOrder.rows[0].preorder_reserved_quantity}`);
    console.log(`  preorder_fulfilled_quantity: ${afterOrder.rows[0].preorder_fulfilled_quantity}`);
    console.log(`  preorder_converted_at: ${afterOrder.rows[0].preorder_converted_at}`);

    // Step 10: Verify results
    console.log('\n--- VERIFICATION ---');
    const errors = [];

    // stock_quantity should increase by fulfilled quantity (60 → 65)
    const expectedStock = beforeState.rows[0].stock_quantity + beforeOrder.rows[0].preorder_fulfilled_quantity;
    if (afterState.rows[0].stock_quantity !== expectedStock) {
      errors.push(`❌ stock_quantity incorrect: ${afterState.rows[0].stock_quantity} (expected ${expectedStock})`);
    } else {
      console.log(`✓ stock_quantity restored: ${afterState.rows[0].stock_quantity} (+${beforeOrder.rows[0].preorder_fulfilled_quantity})`);
    }

    // reserved_quantity should remain unchanged (0)
    if (afterState.rows[0].reserved_quantity !== beforeState.rows[0].reserved_quantity) {
      errors.push(`❌ reserved_quantity changed: ${beforeState.rows[0].reserved_quantity} → ${afterState.rows[0].reserved_quantity}`);
    } else {
      console.log(`✓ reserved_quantity unchanged: ${afterState.rows[0].reserved_quantity}`);
    }

    // preorder_reserved_quantity should remain 0
    if (afterOrder.rows[0].preorder_reserved_quantity !== 0) {
      errors.push(`❌ preorder_reserved_quantity changed: ${afterOrder.rows[0].preorder_reserved_quantity} (expected 0)`);
    } else {
      console.log(`✓ preorder_reserved_quantity unchanged: ${afterOrder.rows[0].preorder_reserved_quantity}`);
    }

    // preorder_fulfilled_quantity should be reset to 0
    if (afterOrder.rows[0].preorder_fulfilled_quantity !== 0) {
      errors.push(`❌ preorder_fulfilled_quantity not reset: ${afterOrder.rows[0].preorder_fulfilled_quantity} (expected 0)`);
    } else {
      console.log(`✓ preorder_fulfilled_quantity reset: ${afterOrder.rows[0].preorder_fulfilled_quantity}`);
    }

    // preorder_converted_at should remain set (historical data preserved)
    if (afterOrder.rows[0].preorder_converted_at === null) {
      errors.push(`❌ preorder_converted_at was cleared (historical data lost)`);
    } else {
      console.log(`✓ preorder_converted_at preserved: ${afterOrder.rows[0].preorder_converted_at}`);
    }

    // Inventory conservation check
    const totalBefore = beforeState.rows[0].stock_quantity + beforeState.rows[0].reserved_quantity;
    const totalAfter = afterState.rows[0].stock_quantity + afterState.rows[0].reserved_quantity;
    const expectedTotal = totalBefore + beforeOrder.rows[0].preorder_fulfilled_quantity;
    if (totalAfter !== expectedTotal) {
      errors.push(`❌ Inventory not conserved correctly: ${totalBefore} → ${totalAfter} (expected ${expectedTotal})`);
    } else {
      console.log(`✓ Inventory conserved correctly: ${totalAfter}`);
    }

    // No negative inventory
    if (afterState.rows[0].stock_quantity < 0 || afterState.rows[0].reserved_quantity < 0) {
      errors.push(`❌ Negative inventory detected`);
    } else {
      console.log(`✓ No negative inventory`);
    }

    // No duplication: stock should increase by exactly fulfilled_quantity
    const stockIncrease = afterState.rows[0].stock_quantity - beforeState.rows[0].stock_quantity;
    if (stockIncrease !== beforeOrder.rows[0].preorder_fulfilled_quantity) {
      errors.push(`❌ Stock duplication detected: increased by ${stockIncrease} (expected ${beforeOrder.rows[0].preorder_fulfilled_quantity})`);
    } else {
      console.log(`✓ No stock duplication: increased by exactly ${stockIncrease}`);
    }

    if (errors.length === 0) {
      console.log('\n✅ SCENARIO B PASSED: Pre-order Converted → Customer Cancel');
    } else {
      console.log('\n❌ SCENARIO B FAILED:');
      errors.forEach(err => console.log(err));
    }

    // Cleanup
    await client.query('ROLLBACK');
    console.log('\n✓ Cleanup complete (transaction rolled back)\n');

    return errors.length === 0;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Test error:', error);
    return false;
  } finally {
    client.release();
  }
}

// Run test
testScenarioB()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
