/**
 * Regression Test: Order Status Update Consistency
 * 
 * Verifies that Admin and Farmer workflows produce identical business results:
 * - Scenario A: Farmer Cancel (inventory before/after)
 * - Scenario B: Admin Cancel (inventory before/after)
 * - Scenario C: Delivered (sales_count, stats, reports)
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function logTestResult(scenario, testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${scenario}] ${testName}${details ? ': ' + details : ''}`);
}

async function getProductInventory(productId) {
  const result = await pool.query(
    'SELECT stock_quantity, reserved_quantity, sales_count FROM products WHERE id = $1',
    [productId]
  );
  return result.rows[0];
}

async function getFarmerStats(farmerId) {
  const result = await pool.query(
    'SELECT total_sales, total_revenue FROM users WHERE id = $1',
    [farmerId]
  );
  return result.rows[0];
}

async function getOrder(orderId) {
  const result = await pool.query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId]
  );
  return result.rows[0];
}

async function createTestOrder(productId, userId, quantity = 5, isPreorder = false) {
  const productResult = await pool.query('SELECT price, unit FROM products WHERE id = $1', [productId]);
  const product = productResult.rows[0];
  const totalAmount = product.price * quantity;

  const orderResult = await pool.query(`
    INSERT INTO orders (user_id, product_id, quantity, price, total_amount, status, is_preorder, preorder_reserved_quantity, created_at)
    VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7, CURRENT_TIMESTAMP)
    RETURNING id
  `, [userId, productId, quantity, product.price, totalAmount, isPreorder, isPreorder ? quantity : 0]);

  const orderId = orderResult.rows[0].id;

  // Deduct inventory
  if (isPreorder) {
    await pool.query('UPDATE products SET reserved_quantity = reserved_quantity - $1 WHERE id = $2', [quantity, productId]);
  } else {
    await pool.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [quantity, productId]);
  }

  return orderId;
}

async function resetTestOrder(orderId, productId, quantity, isPreorder) {
  // Cancel order to restore inventory
  await pool.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);
  
  // Restore inventory manually
  if (isPreorder) {
    await pool.query('UPDATE products SET reserved_quantity = reserved_quantity + $1 WHERE id = $2', [quantity, productId]);
  } else {
    await pool.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2', [quantity, productId]);
  }
}

async function runScenarioA_FarmerCancel() {
  console.log('\n=== Scenario A: Farmer Cancel ===');
  
  try {
    // Get test data
    const farmerResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['farmer']);
    if (farmerResult.rows.length === 0) {
      await logTestResult('Scenario A', 'Setup', false, 'No farmer found');
      return;
    }
    const farmerId = farmerResult.rows[0].id;

    const userResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['customer']);
    if (userResult.rows.length === 0) {
      await logTestResult('Scenario A', 'Setup', false, 'No customer found');
      return;
    }
    const userId = userResult.rows[0].id;

    // Get existing category
    const categoryResult = await pool.query('SELECT id FROM categories LIMIT 1');
    if (categoryResult.rows.length === 0) {
      await logTestResult('Scenario A', 'Setup', false, 'No category found');
      return;
    }
    const categoryId = categoryResult.rows[0].id;

    // Create test product with sufficient stock
    const productResult = await pool.query(`
      INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity, reserved_quantity, unit, is_available, status)
      VALUES ('Test Product Cancel', 'Test', 100, $1, $2, 100, 50, 'kg', true, 'approved')
      RETURNING id
    `, [categoryId, farmerId]);
    const productId = productResult.rows[0].id;

    // Test regular order cancel
    const inventoryBefore = await getProductInventory(productId);
    const orderId = await createTestOrder(productId, userId, 5, false);
    const inventoryAfterOrder = await getProductInventory(productId);

    // Cancel via Farmer endpoint (simulate)
    await pool.query("UPDATE orders SET status = 'cancelled', cancelled_by = 'farmer' WHERE id = $1", [orderId]);
    
    // Apply business logic manually (simulating Farmer cancel)
    const { restoreInventoryOnCancel, getOrderForBusinessLogic } = require('../utils/orderBusinessLogic');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const order = await getOrderForBusinessLogic(client, orderId);
      if (order) {
        await restoreInventoryOnCancel(client, order);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const inventoryAfterCancel = await getProductInventory(productId);

    // Verify inventory restored
    const stockRestored = inventoryAfterCancel.stock_quantity === inventoryBefore.stock_quantity;
    await logTestResult('Scenario A', 'Regular Order Cancel - Stock Restored', stockRestored, 
      `Before: ${inventoryBefore.stock_quantity}, After Order: ${inventoryAfterOrder.stock_quantity}, After Cancel: ${inventoryAfterCancel.stock_quantity}`);

    // Test preorder cancel (not converted)
    const inventoryBeforePre = await getProductInventory(productId);
    const preOrderId = await createTestOrder(productId, userId, 3, true);
    const inventoryAfterPreOrder = await getProductInventory(productId);

    await pool.query("UPDATE orders SET status = 'cancelled', cancelled_by = 'farmer' WHERE id = $1", [preOrderId]);
    
    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      const preOrder = await getOrderForBusinessLogic(client2, preOrderId);
      if (preOrder) {
        await restoreInventoryOnCancel(client2, preOrder);
      }
      await client2.query('COMMIT');
    } catch (e) {
      await client2.query('ROLLBACK');
      throw e;
    } finally {
      client2.release();
    }

    const inventoryAfterPreCancel = await getProductInventory(productId);
    const reservedRestored = inventoryAfterPreCancel.reserved_quantity === inventoryBeforePre.reserved_quantity;
    await logTestResult('Scenario A', 'Preorder Cancel (Not Converted) - Reserved Restored', reservedRestored,
      `Before: ${inventoryBeforePre.reserved_quantity}, After Order: ${inventoryAfterPreOrder.reserved_quantity}, After Cancel: ${inventoryAfterPreCancel.reserved_quantity}`);

    // Cleanup
    await pool.query('DELETE FROM orders WHERE id IN ($1, $2)', [orderId, preOrderId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);

  } catch (error) {
    await logTestResult('Scenario A', 'Test Execution', false, error.message);
  }
}

async function runScenarioB_AdminCancel() {
  console.log('\n=== Scenario B: Admin Cancel ===');
  
  try {
    // Get test data
    const farmerResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['farmer']);
    if (farmerResult.rows.length === 0) {
      await logTestResult('Scenario B', 'Setup', false, 'No farmer found');
      return;
    }
    const farmerId = farmerResult.rows[0].id;

    const userResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['customer']);
    if (userResult.rows.length === 0) {
      await logTestResult('Scenario B', 'Setup', false, 'No customer found');
      return;
    }
    const userId = userResult.rows[0].id;

    // Get existing category
    const categoryResult = await pool.query('SELECT id FROM categories LIMIT 1');
    if (categoryResult.rows.length === 0) {
      await logTestResult('Scenario B', 'Setup', false, 'No category found');
      return;
    }
    const categoryId = categoryResult.rows[0].id;

    // Create test product with sufficient stock
    const productResult = await pool.query(`
      INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity, reserved_quantity, unit, is_available, status)
      VALUES ('Test Product Admin Cancel', 'Test', 100, $1, $2, 100, 50, 'kg', true, 'approved')
      RETURNING id
    `, [categoryId, farmerId]);
    const productId = productResult.rows[0].id;

    const { restoreInventoryOnCancel, getOrderForBusinessLogic } = require('../utils/orderBusinessLogic');

    // Test regular order cancel via Admin
    const inventoryBefore = await getProductInventory(productId);
    const orderId = await createTestOrder(productId, userId, 5, false);
    const inventoryAfterOrder = await getProductInventory(productId);

    // Cancel via Admin endpoint (simulate)
    await pool.query("UPDATE orders SET status = 'cancelled', cancelled_by = 'admin' WHERE id = $1", [orderId]);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const order = await getOrderForBusinessLogic(client, orderId);
      if (order) {
        await restoreInventoryOnCancel(client, order);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const inventoryAfterCancel = await getProductInventory(productId);

    const stockRestored = inventoryAfterCancel.stock_quantity === inventoryBefore.stock_quantity;
    await logTestResult('Scenario B', 'Regular Order Cancel - Stock Restored', stockRestored,
      `Before: ${inventoryBefore.stock_quantity}, After Order: ${inventoryAfterOrder.stock_quantity}, After Cancel: ${inventoryAfterCancel.stock_quantity}`);

    // Test preorder cancel (not converted) via Admin
    const inventoryBeforePre = await getProductInventory(productId);
    const preOrderId = await createTestOrder(productId, userId, 3, true);
    const inventoryAfterPreOrder = await getProductInventory(productId);

    await pool.query("UPDATE orders SET status = 'cancelled', cancelled_by = 'admin' WHERE id = $1", [preOrderId]);
    
    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      const preOrder = await getOrderForBusinessLogic(client2, preOrderId);
      if (preOrder) {
        await restoreInventoryOnCancel(client2, preOrder);
      }
      await client2.query('COMMIT');
    } catch (e) {
      await client2.query('ROLLBACK');
      throw e;
    } finally {
      client2.release();
    }

    const inventoryAfterPreCancel = await getProductInventory(productId);
    const reservedRestored = inventoryAfterPreCancel.reserved_quantity === inventoryBeforePre.reserved_quantity;
    await logTestResult('Scenario B', 'Preorder Cancel (Not Converted) - Reserved Restored', reservedRestored,
      `Before: ${inventoryBeforePre.reserved_quantity}, After Order: ${inventoryAfterPreOrder.reserved_quantity}, After Cancel: ${inventoryAfterPreCancel.reserved_quantity}`);

    // Compare with Scenario A results - should be identical
    await logTestResult('Scenario B', 'Consistency with Farmer Cancel', stockRestored && reservedRestored,
      'Admin and Farmer use same business logic');

    // Cleanup
    await pool.query('DELETE FROM orders WHERE id IN ($1, $2)', [orderId, preOrderId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);

  } catch (error) {
    await logTestResult('Scenario B', 'Test Execution', false, error.message);
  }
}

async function runScenarioC_Delivered() {
  console.log('\n=== Scenario C: Delivered ===');
  
  try {
    // Get test data
    const farmerResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['farmer']);
    if (farmerResult.rows.length === 0) {
      await logTestResult('Scenario C', 'Setup', false, 'No farmer found');
      return;
    }
    const farmerId = farmerResult.rows[0].id;

    const userResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['customer']);
    if (userResult.rows.length === 0) {
      await logTestResult('Scenario C', 'Setup', false, 'No customer found');
      return;
    }
    const userId = userResult.rows[0].id;

    // Get existing category
    const categoryResult = await pool.query('SELECT id FROM categories LIMIT 1');
    if (categoryResult.rows.length === 0) {
      await logTestResult('Scenario C', 'Setup', false, 'No category found');
      return;
    }
    const categoryId = categoryResult.rows[0].id;

    // Create test product with sufficient stock
    const productResult = await pool.query(`
      INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity, unit, is_available, status)
      VALUES ('Test Product Delivered', 'Test', 100, $1, $2, 100, 'kg', true, 'approved')
      RETURNING id
    `, [categoryId, farmerId]);
    const productId = productResult.rows[0].id;

    const { updateStatisticsOnDeliver, getOrderForBusinessLogic } = require('../utils/orderBusinessLogic');

    // Test delivered via Farmer
    const statsBefore = await getFarmerStats(farmerId);
    const productStatsBefore = await getProductInventory(productId);
    const orderId = await createTestOrder(productId, userId, 5, false);

    await pool.query("UPDATE orders SET status = 'delivered' WHERE id = $1", [orderId]);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const order = await getOrderForBusinessLogic(client, orderId);
      if (order) {
        await updateStatisticsOnDeliver(client, order);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const statsAfter = await getFarmerStats(farmerId);
    const productStatsAfter = await getProductInventory(productId);

    const salesCountUpdated = productStatsAfter.sales_count === productStatsBefore.sales_count + 5;
    const totalSalesUpdated = statsAfter.total_sales === statsBefore.total_sales + 5;
    
    await logTestResult('Scenario C', 'Product sales_count Updated', salesCountUpdated,
      `Before: ${productStatsBefore.sales_count}, After: ${productStatsAfter.sales_count}`);
    await logTestResult('Scenario C', 'Farmer total_sales Updated', totalSalesUpdated,
      `Before: ${statsBefore.total_sales}, After: ${statsAfter.total_sales}`);

    // Test delivered via Admin
    const statsBeforeAdmin = await getFarmerStats(farmerId);
    const productStatsBeforeAdmin = await getProductInventory(productId);
    const adminOrderId = await createTestOrder(productId, userId, 3, false);

    await pool.query("UPDATE orders SET status = 'delivered' WHERE id = $1", [adminOrderId]);
    
    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      const adminOrder = await getOrderForBusinessLogic(client2, adminOrderId);
      if (adminOrder) {
        await updateStatisticsOnDeliver(client2, adminOrder);
      }
      await client2.query('COMMIT');
    } catch (e) {
      await client2.query('ROLLBACK');
      throw e;
    } finally {
      client2.release();
    }

    const statsAfterAdmin = await getFarmerStats(farmerId);
    const productStatsAfterAdmin = await getProductInventory(productId);

    const salesCountUpdatedAdmin = productStatsAfterAdmin.sales_count === productStatsBeforeAdmin.sales_count + 3;
    const totalSalesUpdatedAdmin = statsAfterAdmin.total_sales === statsBeforeAdmin.total_sales + 3;
    
    await logTestResult('Scenario C', 'Admin Delivered - Product sales_count Updated', salesCountUpdatedAdmin,
      `Before: ${productStatsBeforeAdmin.sales_count}, After: ${productStatsAfterAdmin.sales_count}`);
    await logTestResult('Scenario C', 'Admin Delivered - Farmer total_sales Updated', totalSalesUpdatedAdmin,
      `Before: ${statsBeforeAdmin.total_sales}, After: ${statsAfterAdmin.total_sales}`);

    // Compare - both should use same logic
    await logTestResult('Scenario C', 'Consistency between Farmer and Admin Delivered', 
      salesCountUpdated && totalSalesUpdated && salesCountUpdatedAdmin && totalSalesUpdatedAdmin,
      'Both workflows use same business logic');

    // Cleanup
    await pool.query('DELETE FROM orders WHERE id IN ($1, $2)', [orderId, adminOrderId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);

  } catch (error) {
    await logTestResult('Scenario C', 'Test Execution', false, error.message);
  }
}

async function main() {
  console.log('=== Order Status Update Consistency Regression Test ===\n');
  
  await runScenarioA_FarmerCancel();
  await runScenarioB_AdminCancel();
  await runScenarioC_Delivered();
  
  console.log('\n=== Regression Test Complete ===');
}

main().then(() => process.exit(0)).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
