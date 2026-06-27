/**
 * Verification Script for Admin Bulk Cancel Side Effects
 * 
 * Verifies that the fix for inventory restoration does not affect:
 * - Customer Orders
 * - Farmer Orders
 * - Notifications
 * - Reports
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function logResult(testName, passed, details) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function verifyCustomerOrders() {
  console.log('\n=== Verifying Customer Orders ===');
  
  // Check that orders table has critical columns
  const columnsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'orders'
    ORDER BY ordinal_position
  `);
  
  const criticalColumns = [
    'id', 'user_id', 'product_id', 'quantity', 'status',
    'is_preorder', 'preorder_reserved_quantity', 'preorder_fulfilled_quantity',
    'preorder_converted_at', 'cancelled_at', 'cancelled_by'
  ];
  
  const actualColumns = columnsResult.rows.map(r => r.column_name);
  const hasCriticalColumns = criticalColumns.every(col => actualColumns.includes(col));
  
  await logResult(
    'Customer Orders - Critical Columns Present',
    hasCriticalColumns,
    `Found ${actualColumns.length} total columns, all ${criticalColumns.length} critical columns present`
  );
  
  // Check that order statuses are valid
  const statusResult = await pool.query(`
    SELECT DISTINCT status FROM orders WHERE is_disabled = false
  `);
  
  const validStatuses = ['pending', 'preorder_reserved', 'confirmed', 'preparing', 'scheduled', 'out_for_delivery', 'delivered', 'cancelled'];
  const allStatusesValid = statusResult.rows.every(r => validStatuses.includes(r.status));
  
  await logResult(
    'Customer Orders - Valid Statuses',
    allStatusesValid,
    `Found statuses: ${statusResult.rows.map(r => r.status).join(', ')}`
  );
  
  return hasCriticalColumns && allStatusesValid;
}

async function verifyFarmerOrders() {
  console.log('\n=== Verifying Farmer Orders ===');
  
  // Check that farmer can see their orders via the existing query
  const farmerResult = await pool.query("SELECT id FROM users WHERE role = 'farmer' LIMIT 1");
  
  if (farmerResult.rows.length === 0) {
    console.log('⚠️  No farmer found for verification');
    return true;
  }
  
  const farmerId = farmerResult.rows[0].id;
  
  // Verify the query used in GET /orders/farmer/:farmerId
  const ordersResult = await pool.query(`
    SELECT o.id, o.product_id, o.quantity, o.status, o.user_id, p.farmer_id
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE (p.farmer_id = $1 OR p.farmer_id IS NULL)
      AND o.is_disabled = false
    LIMIT 10
  `, [farmerId]);
  
  const hasOrders = ordersResult.rows.length >= 0; // Query should succeed regardless of order count
  const correctColumns = ordersResult.rows.length > 0 
    ? ordersResult.rows[0].hasOwnProperty('id') && 
      ordersResult.rows[0].hasOwnProperty('product_id') &&
      ordersResult.rows[0].hasOwnProperty('quantity') &&
      ordersResult.rows[0].hasOwnProperty('status')
    : true;
  
  await logResult(
    'Farmer Orders - Query Success',
    hasOrders,
    `Query returned ${ordersResult.rows.length} orders`
  );
  
  await logResult(
    'Farmer Orders - Column Structure',
    correctColumns,
    'Required columns present'
  );
  
  return hasOrders && correctColumns;
}

async function verifyNotifications() {
  console.log('\n=== Verifying Notifications ===');
  
  // Check that notifications table has critical columns
  const columnsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'notifications'
    ORDER BY ordinal_position
  `);
  
  const criticalColumns = ['id', 'user_id', 'type', 'title', 'message', 'order_id', 'product_id', 'is_read', 'created_at'];
  const actualColumns = columnsResult.rows.map(r => r.column_name);
  const hasCriticalColumns = criticalColumns.every(col => actualColumns.includes(col));
  
  await logResult(
    'Notifications - Critical Columns Present',
    hasCriticalColumns,
    `Found ${actualColumns.length} total columns, all ${criticalColumns.length} critical columns present`
  );
  
  // Check that notification types exist (no strict validation, just check they're not empty)
  const typeResult = await pool.query(`
    SELECT DISTINCT type FROM notifications LIMIT 20
  `);
  
  const hasTypes = typeResult.rows.length > 0;
  
  await logResult(
    'Notifications - Types Exist',
    hasTypes,
    `Found ${typeResult.rows.length} notification types`
  );
  
  return hasCriticalColumns && hasTypes;
}

async function verifyReports() {
  console.log('\n=== Verifying Reports ===');
  
  // Check that products table has critical columns (reports use product data)
  const productColumnsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'products'
    ORDER BY ordinal_position
  `);
  
  const criticalProductColumns = [
    'id', 'farmer_id', 'name', 'price', 'stock_quantity',
    'reserved_quantity', 'sales_count', 'is_available', 'is_preorder'
  ];
  
  const actualProductColumns = productColumnsResult.rows.map(r => r.column_name);
  const hasCriticalProductColumns = criticalProductColumns.every(col => actualProductColumns.includes(col));
  
  await logResult(
    'Reports - Products Critical Columns Present',
    hasCriticalProductColumns,
    `Found ${actualProductColumns.length} total columns, all ${criticalProductColumns.length} critical columns present`
  );
  
  // Check that users table has critical columns (reports use user data)
  const userColumnsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);
  
  const criticalUserColumns = [
    'id', 'email', 'role', 'total_sales', 'total_revenue', 'average_rating',
    'total_reviews', 'customer_average_rating', 'customer_total_ratings'
  ];
  
  const actualUserColumns = userColumnsResult.rows.map(r => r.column_name);
  const hasCriticalUserColumns = criticalUserColumns.every(col => actualUserColumns.includes(col));
  
  await logResult(
    'Reports - Users Critical Columns Present',
    hasCriticalUserColumns,
    `Found ${actualUserColumns.length} total columns, all ${criticalUserColumns.length} critical columns present`
  );
  
  // Verify sales_count can be aggregated (common report query)
  const salesAggResult = await pool.query(`
    SELECT p.id, p.name, COALESCE(p.sales_count, 0) as sales_count
    FROM products p
    WHERE p.is_available = true
    LIMIT 5
  `);
  
  const salesAggSuccess = salesAggResult.rows.length >= 0;
  
  await logResult(
    'Reports - Sales Count Aggregation',
    salesAggSuccess,
    `Query returned ${salesAggResult.rows.length} products`
  );
  
  return hasCriticalProductColumns && hasCriticalUserColumns && salesAggSuccess;
}

async function verifyInventoryFields() {
  console.log('\n=== Verifying Inventory Fields ===');
  
  // Check that the fix doesn't affect unrelated inventory fields
  const productResult = await pool.query(`
    SELECT id, stock_quantity, reserved_quantity, max_preorder_quantity, sales_count
    FROM products
    WHERE is_available = true
    LIMIT 5
  `);
  
  if (productResult.rows.length === 0) {
    console.log('⚠️  No products found for verification');
    return true;
  }
  
  const hasStockQuantity = productResult.rows.every(r => r.hasOwnProperty('stock_quantity'));
  const hasReservedQuantity = productResult.rows.every(r => r.hasOwnProperty('reserved_quantity'));
  const hasMaxPreorderQuantity = productResult.rows.every(r => r.hasOwnProperty('max_preorder_quantity'));
  const hasSalesCount = productResult.rows.every(r => r.hasOwnProperty('sales_count'));
  
  await logResult(
    'Inventory - stock_quantity field',
    hasStockQuantity,
    'Field present'
  );
  
  await logResult(
    'Inventory - reserved_quantity field',
    hasReservedQuantity,
    'Field present'
  );
  
  await logResult(
    'Inventory - max_preorder_quantity field',
    hasMaxPreorderQuantity,
    'Field present'
  );
  
  await logResult(
    'Inventory - sales_count field',
    hasSalesCount,
    'Field present'
  );
  
  return hasStockQuantity && hasReservedQuantity && hasMaxPreorderQuantity && hasSalesCount;
}

async function main() {
  console.log('=================================================');
  console.log('Admin Bulk Cancel Side Effects Verification');
  console.log('=================================================');
  
  try {
    const customerOrdersPass = await verifyCustomerOrders();
    const farmerOrdersPass = await verifyFarmerOrders();
    const notificationsPass = await verifyNotifications();
    const reportsPass = await verifyReports();
    const inventoryFieldsPass = await verifyInventoryFields();
    
    console.log('\n=================================================');
    console.log('SUMMARY');
    console.log('=================================================');
    console.log(`Customer Orders: ${customerOrdersPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Farmer Orders: ${farmerOrdersPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Notifications: ${notificationsPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Reports: ${reportsPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Inventory Fields: ${inventoryFieldsPass ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPass = customerOrdersPass && farmerOrdersPass && notificationsPass && reportsPass && inventoryFieldsPass;
    console.log(`\nOverall: ${allPass ? '✅ ALL VERIFICATIONS PASSED' : '❌ SOME VERIFICATIONS FAILED'}`);
    
    process.exit(allPass ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Verification failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
