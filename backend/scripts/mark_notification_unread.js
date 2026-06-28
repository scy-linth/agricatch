/**
 * Mark notification as unread for testing
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function markUnread() {
  console.log('=== Marking Notification as Unread ===\n');

  try {
    const notificationId = 1193;

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = false 
       WHERE id = $1
       RETURNING id, type, title, message, product_id, is_read`,
      [notificationId]
    );

    if (result.rows.length === 0) {
      console.log('✗ Notification not found');
      return;
    }

    const notif = result.rows[0];
    console.log(`✓ Notification marked as unread:`);
    console.log(`  - ID: ${notif.id}`);
    console.log(`  - Type: ${notif.type}`);
    console.log(`  - Title: ${notif.title}`);
    console.log(`  - Product ID: ${notif.product_id}`);
    console.log(`  - Read: ${notif.is_read}`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

markUnread()
  .then(() => {
    console.log('\n✓ Completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Failed:', error.message);
    process.exit(1);
  });
