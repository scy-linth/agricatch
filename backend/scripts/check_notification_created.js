/**
 * Check if notification was created for wishlist customer
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function checkNotification() {
  console.log('=== Checking for Wishlist Notification ===\n');

  try {
    const customerEmail = 'testcustomer@test.com';
    const preOrderId = 102; // Test Linked Pre-order

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
    console.log(`✓ Customer: ${customerEmail} (ID: ${customerId})\n`);

    // Check for product_available notifications
    const notifResult = await pool.query(
      `SELECT id, type, title, message, product_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1 AND type = 'product_available'
       ORDER BY created_at DESC
       LIMIT 5`,
      [customerId]
    );

    if (notifResult.rows.length === 0) {
      console.log('✗ No product_available notifications found');
      console.log('TEST 1 FAILED: Notification was NOT created');
    } else {
      console.log(`✓ Found ${notifResult.rows.length} product_available notification(s):\n`);
      notifResult.rows.forEach(notif => {
        console.log(`  - ID: ${notif.id}`);
        console.log(`  - Type: ${notif.type}`);
        console.log(`  - Title: ${notif.title}`);
        console.log(`  - Message: ${notif.message}`);
        console.log(`  - Product ID: ${notif.product_id}`);
        console.log(`  - Read: ${notif.is_read}`);
        console.log(`  - Created: ${notif.created_at}`);
        console.log();
      });
      console.log('TEST 1 PASSED: Notification was created successfully');
    }

    // Check the linked available product
    const productResult = await pool.query(
      `SELECT id, name, is_available, is_preorder, linked_product_id, stock_quantity
       FROM products
       WHERE id = $1 OR linked_product_id = $1`,
      [preOrderId]
    );

    console.log('\nProduct status after harvest:');
    productResult.rows.forEach(prod => {
      console.log(`  - ID: ${prod.id}, Name: ${prod.name}, Available: ${prod.is_available}, Pre-order: ${prod.is_preorder}, Linked: ${prod.linked_product_id}, Stock: ${prod.stock_quantity}`);
    });

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkNotification()
  .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Check failed:', error.message);
    process.exit(1);
  });
