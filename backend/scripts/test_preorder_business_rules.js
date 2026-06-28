/**
 * Test pre-order products follow existing business rules
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function testPreorderRules() {
  console.log('=== Testing Pre-order Business Rules ===\n');

  try {
    // Get all pre-order products
    const result = await pool.query(
      `SELECT id, name, is_preorder, is_available, status, is_admin_disabled, 
              stock_quantity, preorder_availability_date, max_preorder_quantity, 
              reserved_quantity, linked_product_id
       FROM products
       WHERE is_preorder = true
       ORDER BY id`
    );

    if (result.rows.length === 0) {
      console.log('✓ No pre-order products found\n');
      return;
    }

    console.log(`Found ${result.rows.length} pre-order product(s):\n`);

    let allRulesPassed = true;

    result.rows.forEach(prod => {
      console.log(`Product ID: ${prod.id} - ${prod.name}`);
      
      let productPassed = true;

      // Rule 1: is_preorder must be true
      if (!prod.is_preorder) {
        console.log('  ✗ FAIL: is_preorder is not true');
        productPassed = false;
        allRulesPassed = false;
      } else {
        console.log('  ✓ is_preorder = true');
      }

      // Rule 2: status should be approved (or pending for new products)
      if (prod.status !== 'approved' && prod.status !== 'pending') {
        console.log(`  ⚠ WARNING: status is "${prod.status}" (expected approved or pending)`);
      } else {
        console.log(`  ✓ status = ${prod.status}`);
      }

      // Rule 3: is_admin_disabled should be false
      if (prod.is_admin_disabled) {
        console.log('  ⚠ WARNING: is_admin_disabled = true');
      } else {
        console.log('  ✓ is_admin_disabled = false');
      }

      // Rule 4: stock_quantity can be 0 (expected for pre-orders)
      console.log(`  ✓ stock_quantity = ${prod.stock_quantity} (can be 0 for pre-orders)`);

      // Rule 5: Should have preorder_availability_date
      if (!prod.preorder_availability_date) {
        console.log('  ⚠ WARNING: No preorder_availability_date set');
      } else {
        console.log(`  ✓ preorder_availability_date = ${prod.preorder_availability_date}`);
      }

      // Rule 6: Should have max_preorder_quantity
      if (!prod.max_preorder_quantity) {
        console.log('  ⚠ WARNING: No max_preorder_quantity set');
      } else {
        console.log(`  ✓ max_preorder_quantity = ${prod.max_preorder_quantity}`);
      }

      // Rule 7: reserved_quantity should be <= max_preorder_quantity
      if (prod.max_preorder_quantity && prod.reserved_quantity > prod.max_preorder_quantity) {
        console.log(`  ✗ FAIL: reserved_quantity (${prod.reserved_quantity}) > max_preorder_quantity (${prod.max_preorder_quantity})`);
        productPassed = false;
        allRulesPassed = false;
      } else {
        console.log(`  ✓ reserved_quantity (${prod.reserved_quantity}) <= max_preorder_quantity (${prod.max_preorder_quantity || 'N/A'})`);
      }

      // Rule 8: linked_product_id should be set for harvested pre-orders
      if (prod.linked_product_id) {
        console.log(`  ✓ linked_product_id = ${prod.linked_product_id} (harvested)`);
      } else {
        console.log('  ✓ linked_product_id = null (not yet harvested)');
      }

      console.log(productPassed ? '  ✓ Product PASSED\n' : '  ✗ Product FAILED\n');
    });

    console.log('=== Overall Assessment ===');
    if (allRulesPassed) {
      console.log('✓ TEST PASSED: All pre-order products follow business rules\n');
    } else {
      console.log('✗ TEST FAILED: Some pre-order products violate business rules\n');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testPreorderRules()
  .then(() => {
    console.log('✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  });
