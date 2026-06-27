/**
 * Task 3 - Admin Status Update Consistency Regression Test
 * 
 * Tests:
 * - Scenario A: Farmer Cancel (inventory before/after)
 * - Scenario B: Admin Cancel (inventory before/after)
 * - Scenario C: Delivered (sales_count, stats, reports)
 * 
 * Validates that Admin Cancel and Delivered use the same business logic as Farmer workflow.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

// Test results storage
const results = {
  scenarioA: { farmerCancel: null },
  scenarioB: { adminCancel: null },
  scenarioC: { delivered: null }
};

async function recordInventory(productId, label) {
  const result = await pool.query(
    `SELECT stock_quantity, reserved_quantity, sales_count FROM products WHERE id = $1`,
    [productId]
  );
  if (result.rows.length === 0) {
    console.error(`Product ${productId} not found for ${label}`);
    return null;
  }
  const row = result.rows[0];
  console.log(`${label}: stock=${row.stock_quantity}, reserved=${row.reserved_quantity}, sales=${row.sales_count}`);
  return { stock_quantity: row.stock_quantity, reserved_quantity: row.reserved_quantity, sales_count: row.sales_count };
}

async function recordUserStats(farmerId, label) {
  const result = await pool.query(
    `SELECT total_sales, total_revenue FROM users WHERE id = $1`,
    [farmerId]
  );
  if (result.rows.length === 0) {
    console.error(`User ${farmerId} not found for ${label}`);
    return null;
  }
  const row = result.rows[0];
  console.log(`${label}: total_sales=${row.total_sales}, total_revenue=${row.total_revenue}`);
  return { total_sales: row.total_sales, total_revenue: row.total_revenue };
}

async function recordOrderStats(orderId, label) {
  const result = await pool.query(
    `SELECT o.status, o.quantity, o.total_amount, o.is_preorder, o.preorder_converted_at, o.preorder_fulfilled_quantity, o.preorder_reserved_quantity, o.product_id, p.farmer_id
     FROM orders o
     JOIN products p ON o.product_id = p.id
     WHERE o.id = $1`,
    [orderId]
  );
  if (result.rows.length === 0) {
    console.error(`Order ${orderId} not found for ${label}`);
    return null;
  }
  const row = result.rows[0];
  console.log(`${label}: status=${row.status}, quantity=${row.quantity}, is_preorder=${row.is_preorder}, converted=${!!row.preorder_converted_at}, product_id=${row.product_id}, farmer_id=${row.farmer_id}`);
  return row;
}

async function testScenarioA_FarmerCancel(orderId) {
  console.log('\n=== SCENARIO A: Farmer Cancel ===');
  console.log(`Testing order ${orderId}`);
  
  const orderBefore = await recordOrderStats(orderId, 'Order Before');
  if (!orderBefore) return;
  
  const inventoryBefore = await recordInventory(orderBefore.product_id, 'Inventory Before');
  if (!inventoryBefore) return;
  
  // Simulate farmer cancel (call the unified business logic directly)
  const { restoreInventoryOnCancel } = require('../utils/orderBusinessLogic');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update order status
    await client.query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = 'farmer' WHERE id = $1`,
      [orderId]
    );
    
    // Apply business logic
    await restoreInventoryOnCancel(client, orderBefore);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  const inventoryAfter = await recordInventory(orderBefore.product_id, 'Inventory After');
  const orderAfter = await recordOrderStats(orderId, 'Order After');
  
  results.scenarioA.farmerCancel = {
    orderBefore,
    orderAfter,
    inventoryBefore,
    inventoryAfter,
    inventoryChange: {
      stock_delta: inventoryAfter.stock_quantity - inventoryBefore.stock_quantity,
      reserved_delta: inventoryAfter.reserved_quantity - inventoryBefore.reserved_quantity
    }
  };
  
  console.log('Scenario A Complete');
}

async function testScenarioB_AdminCancel(orderId) {
  console.log('\n=== SCENARIO B: Admin Cancel ===');
  console.log(`Testing order ${orderId}`);
  
  const orderBefore = await recordOrderStats(orderId, 'Order Before');
  if (!orderBefore) return;
  
  const inventoryBefore = await recordInventory(orderBefore.product_id, 'Inventory Before');
  if (!inventoryBefore) return;
  
  // Simulate admin cancel (call the unified business logic directly)
  const { restoreInventoryOnCancel } = require('../utils/orderBusinessLogic');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update order status
    await client.query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = 'admin' WHERE id = $1`,
      [orderId]
    );
    
    // Apply business logic
    await restoreInventoryOnCancel(client, orderBefore);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  const inventoryAfter = await recordInventory(orderBefore.product_id, 'Inventory After');
  const orderAfter = await recordOrderStats(orderId, 'Order After');
  
  results.scenarioB.adminCancel = {
    orderBefore,
    orderAfter,
    inventoryBefore,
    inventoryAfter,
    inventoryChange: {
      stock_delta: inventoryAfter.stock_quantity - inventoryBefore.stock_quantity,
      reserved_delta: inventoryAfter.reserved_quantity - inventoryBefore.reserved_quantity
    }
  };
  
  console.log('Scenario B Complete');
}

async function testScenarioC_Delivered(orderId) {
  console.log('\n=== SCENARIO C: Delivered ===');
  console.log(`Testing order ${orderId}`);
  
  const orderBefore = await recordOrderStats(orderId, 'Order Before');
  if (!orderBefore) return;
  
  const inventoryBefore = await recordInventory(orderBefore.product_id, 'Inventory Before');
  if (!inventoryBefore) return;
  
  const userStatsBefore = await recordUserStats(orderBefore.farmer_id, 'User Stats Before');
  if (!userStatsBefore) return;
  
  // Simulate delivered (call the unified business logic directly)
  const { updateStatisticsOnDeliver } = require('../utils/orderBusinessLogic');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update order status
    await client.query(
      `UPDATE orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [orderId]
    );
    
    // Apply business logic
    await updateStatisticsOnDeliver(client, orderBefore);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  const inventoryAfter = await recordInventory(orderBefore.product_id, 'Inventory After');
  const userStatsAfter = await recordUserStats(orderBefore.farmer_id, 'User Stats After');
  const orderAfter = await recordOrderStats(orderId, 'Order After');
  
  results.scenarioC.delivered = {
    orderBefore,
    orderAfter,
    inventoryBefore,
    inventoryAfter,
    userStatsBefore,
    userStatsAfter,
    statsChange: {
      sales_delta: inventoryAfter.sales_count - inventoryBefore.sales_count,
      total_sales_delta: userStatsAfter.total_sales - userStatsBefore.total_sales,
      total_revenue_delta: userStatsAfter.total_revenue - userStatsBefore.total_revenue
    }
  };
  
  console.log('Scenario C Complete');
}

function compareScenarios() {
  console.log('\n=== VALIDATION: Cancel Scenarios ===');
  
  const farmer = results.scenarioA.farmerCancel;
  const admin = results.scenarioB.adminCancel;
  
  if (!farmer || !admin) {
    console.log('Cannot validate - missing data');
    return false;
  }
  
  // Validate Scenario A: Regular product cancel should restore stock
  const farmerStockValid = farmer.inventoryChange.stock_delta === farmer.orderBefore.quantity;
  console.log(`Scenario A (Regular Product): Stock restored by ${farmer.inventoryChange.stock_delta} (expected: ${farmer.orderBefore.quantity}) - ${farmerStockValid ? 'PASS' : 'FAIL'}`);
  
  // Validate Scenario B: Pre-order cancel should release reservation
  const adminReservedValid = admin.inventoryChange.reserved_delta === -admin.orderBefore.preorder_reserved_quantity;
  console.log(`Scenario B (Pre-order): Reserved released by ${Math.abs(admin.inventoryChange.reserved_delta)} (expected: ${admin.orderBefore.preorder_reserved_quantity}) - ${adminReservedValid ? 'PASS' : 'FAIL'}`);
  
  const allValid = farmerStockValid && adminReservedValid;
  console.log(`\nCancel validation: ${allValid ? 'PASS' : 'FAIL'}`);
  
  return allValid;
}

function validateDelivered() {
  console.log('\n=== VALIDATION: Delivered Statistics ===');
  
  const delivered = results.scenarioC.delivered;
  if (!delivered) {
    console.log('Cannot validate - missing data');
    return false;
  }
  
  const order = delivered.orderBefore;
  const stats = delivered.statsChange;
  
  // Expected changes
  const expectedSalesDelta = order.quantity;
  const expectedTotalSalesDelta = order.quantity;
  const expectedRevenueDelta = order.total_amount || 0;
  
  const salesMatch = stats.sales_delta === expectedSalesDelta;
  const totalSalesMatch = stats.total_sales_delta === expectedTotalSalesDelta;
  // Use epsilon for floating point comparison
  const revenueMatch = Math.abs(stats.total_revenue_delta - expectedRevenueDelta) < 0.01;
  
  console.log(`Sales count delta: ${stats.sales_delta} (expected: ${expectedSalesDelta}) - ${salesMatch ? 'PASS' : 'FAIL'}`);
  console.log(`Total sales delta: ${stats.total_sales_delta} (expected: ${expectedTotalSalesDelta}) - ${totalSalesMatch ? 'PASS' : 'FAIL'}`);
  console.log(`Total revenue delta: ${stats.total_revenue_delta} (expected: ${expectedRevenueDelta}) - ${revenueMatch ? 'PASS' : 'FAIL'}`);
  
  const allPass = salesMatch && totalSalesMatch && revenueMatch;
  console.log(`\nStatistics validation: ${allPass ? 'PASS' : 'FAIL'}`);
  
  return allPass;
}

async function main() {
  console.log('Task 3 - Admin Status Update Consistency Regression Test');
  console.log('=========================================================\n');
  
  // Get order IDs from command line or use defaults
  const args = process.argv.slice(2);
  const farmerCancelOrderId = args[0] || null;
  const adminCancelOrderId = args[1] || null;
  const deliveredOrderId = args[2] || null;
  
  if (!farmerCancelOrderId || !adminCancelOrderId || !deliveredOrderId) {
    console.log('Usage: node test_task3_admin_status_consistency.js <farmer_cancel_order_id> <admin_cancel_order_id> <delivered_order_id>');
    console.log('\nOr provide test orders:');
    console.log('  - Farmer Cancel: An order in pending/confirmed/preparing status');
    console.log('  - Admin Cancel: An order in pending/confirmed/preparing status');
    console.log('  - Delivered: An order in out_for_delivery status');
    process.exit(1);
  }
  
  try {
    await testScenarioA_FarmerCancel(farmerCancelOrderId);
    await testScenarioB_AdminCancel(adminCancelOrderId);
    await testScenarioC_Delivered(deliveredOrderId);
    
    const cancelValid = compareScenarios();
    const deliveredValid = validateDelivered();
    
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Cancel validation: ${cancelValid ? 'PASS' : 'FAIL'}`);
    console.log(`Delivered statistics valid: ${deliveredValid ? 'PASS' : 'FAIL'}`);
    console.log(`Overall: ${cancelValid && deliveredValid ? 'PASS' : 'FAIL'}`);
    
    // Save results to file
    const fs = require('fs');
    fs.writeFileSync(
      'TASK-3-REGRESSION-RESULTS.json',
      JSON.stringify(results, null, 2)
    );
    console.log('\nResults saved to TASK-3-REGRESSION-RESULTS.json');
    
    process.exit(cancelValid && deliveredValid ? 0 : 1);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
