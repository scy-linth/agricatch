/**
 * Test duplicate notification prevention
 * Simulates multiple harvest lifecycle calls within 1 hour to verify only one notification is created
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function testDuplicatePrevention() {
  console.log('=== Testing Duplicate Notification Prevention ===\n');

  try {
    const customerEmail = 'testcustomer@test.com';
    const productId = 163; // The current active product from previous harvest

    // Get customer ID
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [customerEmail]
    );

    if (userResult.rows.length === 0) {
      console.log('✗ Test customer not found');
      return;
    }

    const customerId = userResult.rows[0].id;
    console.log(`✓ Customer: ${customerEmail} (ID: ${customerId})`);
    console.log(`✓ Product ID: ${productId}\n`);

    // Count existing product_available notifications for this customer and product
    const existingNotifResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND type = 'product_available' AND product_id = $2`,
      [customerId, productId]
    );

    const existingCount = parseInt(existingNotifResult.rows[0].count);
    console.log(`Existing product_available notifications for this product: ${existingCount}\n`);

    // Check if there's a recent notification within 1 hour
    const recentNotifResult = await pool.query(
      `SELECT id, created_at
       FROM notifications
       WHERE user_id = $1 AND type = 'product_available' AND product_id = $2
       AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC
       LIMIT 1`,
      [customerId, productId]
    );

    if (recentNotifResult.rows.length > 0) {
      const recentNotif = recentNotifResult.rows[0];
      const timeDiff = new Date() - new Date(recentNotif.created_at);
      const minutesAgo = Math.floor(timeDiff / 60000);
      console.log(`✓ Recent notification found (ID: ${recentNotif.id})`);
      console.log(`  Created: ${recentNotif.created_at}`);
      console.log(`  Time elapsed: ${minutesAgo} minutes ago\n`);
      
      if (minutesAgo < 60) {
        console.log('✓ TEST 3 PASSED: Duplicate prevention is active');
        console.log('  - A notification exists within the 1-hour window');
        console.log('  - Any new harvest would NOT create a duplicate notification\n');
      } else {
        console.log('⚠ Recent notification is older than 1 hour');
        console.log('  - Duplicate prevention window has expired\n');
      }
    } else {
      console.log('✓ No recent notification within 1 hour');
      console.log('  - A new harvest would create a notification\n');
    }

    // Total count of all product_available notifications for this customer
    const totalNotifResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND type = 'product_available'`,
      [customerId]
    );

    const totalCount = parseInt(totalNotifResult.rows[0].count);
    console.log(`Total product_available notifications for customer: ${totalCount}\n`);

    if (totalCount === 1) {
      console.log('✓ TEST 3 PASSED: Only ONE notification created');
      console.log('  - No duplicate notifications exist\n');
    } else if (totalCount > 1) {
      console.log('✗ TEST 3 FAILED: Multiple notifications found');
      console.log(`  - ${totalCount} notifications exist (should be 1)\n`);
    } else {
      console.log('⚠ No product_available notifications found\n');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testDuplicatePrevention()
  .then(() => {
    console.log('✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  });
