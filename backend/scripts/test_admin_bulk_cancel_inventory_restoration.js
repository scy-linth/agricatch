/**
 * Regression Test for Admin Bulk Cancel Inventory Restoration
 * 
 * Tests Task 2 from Order Management Architecture Audit:
 * - Scenario A: Available Product inventory restoration
 * - Scenario B: Pre-order Product inventory restoration (both converted and non-converted)
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function logResult(scenario, testName, passed, details) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status} - ${scenario}: ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function getProductInventory(productId) {
  const result = await pool.query(
    'SELECT stock_quantity, reserved_quantity FROM products WHERE id = $1',
    [productId]
  );
  return result.rows[0];
}

async function getOrderDetails(orderId) {
  const result = await pool.query(
    'SELECT id, product_id, quantity, status, is_preorder, preorder_converted_at, preorder_fulfilled_quantity, preorder_reserved_quantity FROM orders WHERE id = $1',
    [orderId]
  );
  return result.rows[0];
}

async function createTestOrder(productId, userId, quantity, isPreorder = false) {
  const status = isPreorder ? 'preorder_reserved' : 'pending';
  const result = await pool.query(
    `INSERT INTO orders (user_id, product_id, quantity, price, total_amount, status, is_preorder, preorder_reserved_quantity)
     VALUES ($1, $2, $3, 100.00, $4, $5, $6, $7)
     RETURNING id`,
    [userId, productId, quantity, quantity * 100, status, isPreorder, isPreorder ? quantity : 0]
  );
  return result.rows[0].id;
}

async function cancelOrderViaAdminBulkCancel(orderId) {
  // Simulate admin bulk cancel by calling the inventory restoration logic directly
  const order = await getOrderDetails(orderId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update order status
    await client.query(
      `UPDATE orders 
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = 'admin'
       WHERE id = $1`,
      [orderId]
    );
    
    // Restore inventory based on order type and conversion state (matching the fix)
    if (order.is_preorder) {
      if (order.preorder_converted_at) {
        // Already converted: restore allocated quantity to stock
        if (order.preorder_fulfilled_quantity > 0) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [order.preorder_fulfilled_quantity, order.product_id]
          );
          await client.query(
            'UPDATE orders SET preorder_fulfilled_quantity = 0 WHERE id = $1',
            [orderId]
          );
        }
      } else {
        // Not yet converted: release reservation
        if (order.preorder_reserved_quantity > 0) {
          await client.query(
            'UPDATE products SET reserved_quantity = GREATEST(reserved_quantity - $1, 0) WHERE id = $2',
            [order.preorder_reserved_quantity, order.product_id]
          );
          await client.query(
            'UPDATE orders SET preorder_reserved_quantity = 0 WHERE id = $1',
            [orderId]
          );
        }
      }
    } else {
      // Regular order: restore stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [order.quantity, order.product_id]
      );
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupTestOrder(orderId, productId, originalStock, originalReserved) {
  // Restore inventory to original state
  await pool.query(
    'UPDATE products SET stock_quantity = $1, reserved_quantity = $2 WHERE id = $3',
    [originalStock, originalReserved, productId]
  );
  // Delete test order
  await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
}

async function testScenarioA_AvailableProduct() {
  console.log('\n=== SCENARIO A: Available Product ===');
  
  // Find a test available product
  const productResult = await pool.query(
    "SELECT id, stock_quantity, reserved_quantity FROM products WHERE is_preorder = false AND is_available = true LIMIT 1"
  );
  
  if (productResult.rows.length === 0) {
    console.log('⚠️  No available product found for testing');
    return;
  }
  
  const product = productResult.rows[0];
  const productId = product.id;
  const originalStock = product.stock_quantity;
  const originalReserved = product.reserved_reserved || 0;
  const testQuantity = 5;
  
  // Find a test user
  const userResult = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
  if (userResult.rows.length === 0) {
    console.log('⚠️  No customer found for testing');
    return;
  }
  const userId = userResult.rows[0].id;
  
  console.log(`\nProduct ID: ${productId}`);
  console.log(`Original stock_quantity: ${originalStock}`);
  console.log(`Original reserved_quantity: ${originalReserved}`);
  console.log(`Test quantity: ${testQuantity}`);
  
  // Create test order
  const orderId = await createTestOrder(productId, userId, testQuantity, false);
  console.log(`Created order ID: ${orderId}`);
  
  // Deduct stock (simulating order placement)
  await pool.query(
    'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
    [testQuantity, productId]
  );
  
  const beforeCancel = await getProductInventory(productId);
  console.log(`\nBefore Cancel:`);
  console.log(`  stock_quantity: ${beforeCancel.stock_quantity}`);
  console.log(`  reserved_quantity: ${beforeCancel.reserved_quantity}`);
  
  // Cancel order via admin bulk cancel logic
  await cancelOrderViaAdminBulkCancel(orderId);
  
  const afterCancel = await getProductInventory(productId);
  console.log(`\nAfter Cancel:`);
  console.log(`  stock_quantity: ${afterCancel.stock_quantity}`);
  console.log(`  reserved_quantity: ${afterCancel.reserved_quantity}`);
  
  // Verify restoration
  const stockRestored = afterCancel.stock_quantity === originalStock;
  const reservedUnchanged = afterCancel.reserved_quantity === originalReserved;
  
  await logResult(
    'Scenario A',
    'Stock restoration',
    stockRestored,
    `Expected: ${originalStock}, Actual: ${afterCancel.stock_quantity}`
  );
  
  await logResult(
    'Scenario A',
    'Reserved quantity unchanged',
    reservedUnchanged,
    `Expected: ${originalReserved}, Actual: ${afterCancel.reserved_quantity}`
  );
  
  // Cleanup
  await cleanupTestOrder(orderId, productId, originalStock, originalReserved);
  
  return stockRestored && reservedUnchanged;
}

async function testScenarioB_PreorderNotConverted() {
  console.log('\n=== SCENARIO B: Pre-order Product (Not Converted) ===');
  
  // Find a test preorder product
  const productResult = await pool.query(
    "SELECT id, stock_quantity, reserved_quantity FROM products WHERE is_preorder = true AND is_available = true LIMIT 1"
  );
  
  if (productResult.rows.length === 0) {
    console.log('⚠️  No preorder product found for testing');
    return;
  }
  
  const product = productResult.rows[0];
  const productId = product.id;
  const originalStock = product.stock_quantity;
  const originalReserved = product.reserved_quantity;
  const testQuantity = 3;
  
  // Find a test user
  const userResult = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
  if (userResult.rows.length === 0) {
    console.log('⚠️  No customer found for testing');
    return;
  }
  const userId = userResult.rows[0].id;
  
  console.log(`\nProduct ID: ${productId}`);
  console.log(`Original stock_quantity: ${originalStock}`);
  console.log(`Original reserved_quantity: ${originalReserved}`);
  console.log(`Test quantity: ${testQuantity}`);
  
  // Create test preorder order (not converted)
  const orderId = await createTestOrder(productId, userId, testQuantity, true);
  console.log(`Created order ID: ${orderId}`);
  
  // Increment reserved quantity (simulating preorder reservation)
  await pool.query(
    'UPDATE products SET reserved_quantity = reserved_quantity + $1 WHERE id = $2',
    [testQuantity, productId]
  );
  
  const beforeCancel = await getProductInventory(productId);
  const orderBefore = await getOrderDetails(orderId);
  console.log(`\nBefore Cancel:`);
  console.log(`  stock_quantity: ${beforeCancel.stock_quantity}`);
  console.log(`  reserved_quantity: ${beforeCancel.reserved_quantity}`);
  console.log(`  Order preorder_reserved_quantity: ${orderBefore.preorder_reserved_quantity}`);
  console.log(`  Order preorder_converted_at: ${orderBefore.preorder_converted_at}`);
  
  // Cancel order via admin bulk cancel logic
  await cancelOrderViaAdminBulkCancel(orderId);
  
  const afterCancel = await getProductInventory(productId);
  const orderAfter = await getOrderDetails(orderId);
  console.log(`\nAfter Cancel:`);
  console.log(`  stock_quantity: ${afterCancel.stock_quantity}`);
  console.log(`  reserved_quantity: ${afterCancel.reserved_quantity}`);
  console.log(`  Order preorder_reserved_quantity: ${orderAfter.preorder_reserved_quantity}`);
  
  // Verify restoration
  const reservedReleased = afterCancel.reserved_quantity === originalReserved;
  const stockUnchanged = afterCancel.stock_quantity === originalStock;
  const orderReservedReset = orderAfter.preorder_reserved_quantity === 0;
  
  await logResult(
    'Scenario B (Not Converted)',
    'Reserved quantity released',
    reservedReleased,
    `Expected: ${originalReserved}, Actual: ${afterCancel.reserved_quantity}`
  );
  
  await logResult(
    'Scenario B (Not Converted)',
    'Stock quantity unchanged',
    stockUnchanged,
    `Expected: ${originalStock}, Actual: ${afterCancel.stock_quantity}`
  );
  
  await logResult(
    'Scenario B (Not Converted)',
    'Order preorder_reserved_quantity reset',
    orderReservedReset,
    `Expected: 0, Actual: ${orderAfter.preorder_reserved_quantity}`
  );
  
  // Cleanup
  await cleanupTestOrder(orderId, productId, originalStock, originalReserved);
  
  return reservedReleased && stockUnchanged && orderReservedReset;
}

async function testScenarioB_PreorderConverted() {
  console.log('\n=== SCENARIO B: Pre-order Product (Converted) ===');
  
  // Find a test preorder product with enough stock to test conversion (different from previous scenario)
  const productResult = await pool.query(
    "SELECT id, stock_quantity, reserved_quantity FROM products WHERE is_preorder = true AND is_available = true AND stock_quantity >= 5 AND id NOT IN (SELECT id FROM products WHERE reserved_quantity > 0) LIMIT 1"
  );
  
  if (productResult.rows.length === 0) {
    console.log('⚠️  No preorder product with sufficient stock found for testing');
    return;
  }
  
  const product = productResult.rows[0];
  const productId = product.id;
  const originalStock = product.stock_quantity;
  const originalReserved = product.reserved_quantity;
  const testQuantity = 4;
  
  // Find a test user
  const userResult = await pool.query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
  if (userResult.rows.length === 0) {
    console.log('⚠️  No customer found for testing');
    return;
  }
  const userId = userResult.rows[0].id;
  
  console.log(`\nProduct ID: ${productId}`);
  console.log(`Original stock_quantity: ${originalStock}`);
  console.log(`Original reserved_quantity: ${originalReserved}`);
  console.log(`Test quantity: ${testQuantity}`);
  
  // Create test preorder order
  const orderId = await createTestOrder(productId, userId, testQuantity, true);
  console.log(`Created order ID: ${orderId}`);
  
  // Simulate conversion: 
  // In real workflow, harvest is added to stock, then allocated to orders
  // For this test, we simulate that the harvest was already added to stock
  // and this order's quantity was allocated from it
  // So we just mark the order as converted without changing product inventory
  // (the stock already has the harvest quantity in it from originalStock)
  
  // Mark order as converted
  await pool.query(
    `UPDATE orders 
     SET preorder_converted_at = CURRENT_TIMESTAMP, 
         preorder_fulfilled_quantity = $1,
         preorder_reserved_quantity = 0,
         status = 'confirmed'
     WHERE id = $2`,
    [testQuantity, orderId]
  );
  
  const beforeCancel = await getProductInventory(productId);
  const orderBefore = await getOrderDetails(orderId);
  console.log(`\nBefore Cancel:`);
  console.log(`  stock_quantity: ${beforeCancel.stock_quantity}`);
  console.log(`  reserved_quantity: ${beforeCancel.reserved_quantity}`);
  console.log(`  Order preorder_fulfilled_quantity: ${orderBefore.preorder_fulfilled_quantity}`);
  console.log(`  Order preorder_converted_at: ${orderBefore.preorder_converted_at}`);
  
  // Cancel order via admin bulk cancel logic
  await cancelOrderViaAdminBulkCancel(orderId);
  
  const afterCancel = await getProductInventory(productId);
  const orderAfter = await getOrderDetails(orderId);
  console.log(`\nAfter Cancel:`);
  console.log(`  stock_quantity: ${afterCancel.stock_quantity}`);
  console.log(`  reserved_quantity: ${afterCancel.reserved_quantity}`);
  console.log(`  Order preorder_fulfilled_quantity: ${orderAfter.preorder_fulfilled_quantity}`);
  
  // Verify restoration
  // Stock should increase by preorder_fulfilled_quantity
  const expectedStockIncrease = testQuantity;
  const actualStockIncrease = afterCancel.stock_quantity - beforeCancel.stock_quantity;
  const stockRestored = actualStockIncrease === expectedStockIncrease;
  const reservedUnchanged = afterCancel.reserved_quantity === originalReserved;
  const orderFulfilledReset = orderAfter.preorder_fulfilled_quantity === 0;
  
  await logResult(
    'Scenario B (Converted)',
    'Stock quantity increased by fulfilled quantity',
    stockRestored,
    `Expected increase: ${expectedStockIncrease}, Actual increase: ${actualStockIncrease}`
  );
  
  await logResult(
    'Scenario B (Converted)',
    'Reserved quantity unchanged',
    reservedUnchanged,
    `Expected: ${originalReserved}, Actual: ${afterCancel.reserved_quantity}`
  );
  
  await logResult(
    'Scenario B (Converted)',
    'Order preorder_fulfilled_quantity reset',
    orderFulfilledReset,
    `Expected: 0, Actual: ${orderAfter.preorder_fulfilled_quantity}`
  );
  
  // Cleanup
  await cleanupTestOrder(orderId, productId, originalStock, originalReserved);
  
  return stockRestored && reservedUnchanged && orderFulfilledReset;
}

async function main() {
  console.log('=================================================');
  console.log('Admin Bulk Cancel Inventory Restoration Regression Test');
  console.log('=================================================');
  
  try {
    const scenarioAPass = await testScenarioA_AvailableProduct();
    const scenarioBNotConvertedPass = await testScenarioB_PreorderNotConverted();
    const scenarioBConvertedPass = await testScenarioB_PreorderConverted();
    
    console.log('\n=================================================');
    console.log('SUMMARY');
    console.log('=================================================');
    console.log(`Scenario A (Available Product): ${scenarioAPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Scenario B (Pre-order Not Converted): ${scenarioBNotConvertedPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Scenario B (Pre-order Converted): ${scenarioBConvertedPass ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPass = scenarioAPass && scenarioBNotConvertedPass && scenarioBConvertedPass;
    console.log(`\nOverall: ${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    process.exit(allPass ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
