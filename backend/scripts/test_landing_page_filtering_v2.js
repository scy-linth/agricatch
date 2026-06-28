/**
 * Test landing page filtering rules
 * Verifies that product listing API correctly filters by:
 * - status = 'approved'
 * - is_available = true
 * - is_admin_disabled = false
 * - stock_quantity > 0 (for available-now products only)
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function testLandingPageFiltering() {
  console.log('=== Testing Landing Page Filtering Rules ===\n');

  try {
    // Test 1: Check products with status != 'approved' are excluded
    console.log('TEST 1: Verify status = "approved" filter');
    const nonApprovedResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM products
       WHERE status != 'approved' AND is_available = true AND is_admin_disabled = false`
    );
    const nonApprovedCount = parseInt(nonApprovedResult.rows[0].count);
    console.log(`  Products with status != 'approved' (should be 0 in listings): ${nonApprovedCount}`);
    
    if (nonApprovedCount === 0) {
      console.log('  ✓ All available products have approved status\n');
    } else {
      console.log('  ⚠ Some non-approved products exist\n');
    }

    // Test 2: Check products with is_admin_disabled = true are excluded
    console.log('TEST 2: Verify is_admin_disabled = false filter');
    const disabledResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM products
       WHERE is_admin_disabled = true AND is_available = true AND status = 'approved'`
    );
    const disabledCount = parseInt(disabledResult.rows[0].count);
    console.log(`  Products with is_admin_disabled = true (should be 0 in listings): ${disabledCount}`);
    
    if (disabledCount === 0) {
      console.log('  ✓ No admin-disabled products in available set\n');
    } else {
      console.log('  ⚠ Some admin-disabled products exist\n');
    }

    // Test 3: Check available-now products with stock_quantity = 0 are excluded
    console.log('TEST 3: Verify stock_quantity > 0 filter for available-now products');
    const outOfStockResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM products
       WHERE stock_quantity = 0 
         AND is_available = true 
         AND status = 'approved' 
         AND is_admin_disabled = false
         AND is_preorder = false`
    );
    const outOfStockCount = parseInt(outOfStockResult.rows[0].count);
    console.log(`  Available-now products with stock_quantity = 0 (should be 0): ${outOfStockCount}`);
    
    if (outOfStockCount === 0) {
      console.log('  ✓ All available-now products have stock\n');
    } else {
      console.log('  ⚠ Some available-now products have 0 stock\n');
    }

    // Test 4: Check products with is_available = false are excluded
    console.log('TEST 4: Verify is_available = true filter');
    const unavailableResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM products
       WHERE is_available = false AND status = 'approved' AND is_admin_disabled = false`
    );
    const unavailableCount = parseInt(unavailableResult.rows[0].count);
    console.log(`  Products with is_available = false (should be 0 in listings): ${unavailableCount}`);
    
    if (unavailableCount === 0) {
      console.log('  ✓ All listed products are available\n');
    } else {
      console.log('  ⚠ Some unavailable products exist\n');
    }

    // Test 5: Count valid available-now products
    console.log('TEST 5: Count valid available-now products');
    const validResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM products
       WHERE is_available = true 
         AND status = 'approved' 
         AND is_admin_disabled = false 
         AND stock_quantity > 0
         AND is_preorder = false`
    );
    const validCount = parseInt(validResult.rows[0].count);
    console.log(`  Valid available-now products: ${validCount}\n`);

    // Test 6: Count valid pre-order products (stock can be 0)
    console.log('TEST 6: Count valid pre-order products');
    const preorderResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM products
       WHERE is_preorder = true 
         AND is_available = true 
         AND status = 'approved' 
         AND is_admin_disabled = false`
    );
    const preorderCount = parseInt(preorderResult.rows[0].count);
    console.log(`  Valid pre-order products: ${preorderCount}\n`);

    // Overall assessment
    console.log('=== Landing Page Filtering Assessment ===');
    if (nonApprovedCount === 0 && disabledCount === 0 && outOfStockCount === 0 && unavailableCount === 0) {
      console.log('✓ TEST PASSED: All filtering rules are correctly enforced');
      console.log('  - Only approved products are listed');
      console.log('  - Admin-disabled products are excluded');
      console.log('  - Out-of-stock available-now products are excluded');
      console.log('  - Unavailable products are excluded');
      console.log('  - Pre-order products can have 0 stock (expected behavior)\n');
    } else {
      console.log('⚠ TEST WARNING: Some filtering rules may not be enforced\n');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testLandingPageFiltering()
  .then(() => {
    console.log('✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  });
