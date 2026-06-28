/**
 * Check all product_available notifications for the test customer
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function checkAllNotifications() {
  console.log('=== Checking All Product Available Notifications ===\n');

  try {
    const customerEmail = 'testcustomer@test.com';

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

    // Check ALL notifications (not just product_available)
    const notifResult = await pool.query(
      `SELECT id, type, title, message, product_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [customerId]
    );

    if (notifResult.rows.length === 0) {
      console.log('✗ No notifications found');
    } else {
      console.log(`✓ Found ${notifResult.rows.length} notification(s):\n`);
      notifResult.rows.forEach((notif, index) => {
        console.log(`  ${index + 1}. ID: ${notif.id}`);
        console.log(`     Type: ${notif.type}`);
        console.log(`     Title: ${notif.title}`);
        console.log(`     Message: ${notif.message}`);
        console.log(`     Product ID: ${notif.product_id}`);
        console.log(`     Read: ${notif.is_read}`);
        console.log(`     Created: ${notif.created_at}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkAllNotifications()
  .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Check failed:', error.message);
    process.exit(1);
  });
