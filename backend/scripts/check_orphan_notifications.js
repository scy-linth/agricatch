require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('../utils/db');

async function checkOrphanNotifications() {
  console.log('=== ORPHAN NOTIFICATIONS CHECK ===\n');

  try {
    // Check 1: Notifications for non-existent users
    const invalidUser = await pool.query(`
      SELECT n.id, n.user_id, n.type, n.message
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
      WHERE u.id IS NULL
    `);
    console.log(`1. Notifications for non-existent users: ${invalidUser.rows.length}`);
    if (invalidUser.rows.length > 0) {
      invalidUser.rows.forEach(n => {
        console.log(`   - Notification ${n.id} for non-existent user ${n.user_id}: ${n.type}`);
      });
    }

    // Check 2: Notifications for non-existent orders
    const invalidOrder = await pool.query(`
      SELECT n.id, n.order_id, n.type, n.message
      FROM notifications n
      LEFT JOIN orders o ON o.id = n.order_id
      WHERE n.order_id IS NOT NULL AND o.id IS NULL
    `);
    console.log(`2. Notifications for non-existent orders: ${invalidOrder.rows.length}`);
    if (invalidOrder.rows.length > 0) {
      invalidOrder.rows.forEach(n => {
        console.log(`   - Notification ${n.id} for non-existent order ${n.order_id}: ${n.type}`);
      });
    }

    // Check 3: Notifications for non-existent products
    const invalidProduct = await pool.query(`
      SELECT n.id, n.product_id, n.type, n.message
      FROM notifications n
      LEFT JOIN products p ON p.id = n.product_id
      WHERE n.product_id IS NOT NULL AND p.id IS NULL
    `);
    console.log(`3. Notifications for non-existent products: ${invalidProduct.rows.length}`);
    if (invalidProduct.rows.length > 0) {
      invalidProduct.rows.forEach(n => {
        console.log(`   - Notification ${n.id} for non-existent product ${n.product_id}: ${n.type}`);
      });
    }

    // Check 4: Duplicate notifications (same user, type, and order within 1 minute)
    const duplicates = await pool.query(`
      SELECT n1.id, n1.user_id, n1.type, n1.order_id, n1.created_at
      FROM notifications n1
      JOIN notifications n2 ON n1.user_id = n2.user_id 
        AND n1.type = n2.type 
        AND n1.order_id = n2.order_id
        AND n1.id != n2.id
        AND ABS(EXTRACT(EPOCH FROM (n1.created_at - n2.created_at))) < 60
      GROUP BY n1.id, n1.user_id, n1.type, n1.order_id, n1.created_at
    `);
    console.log(`4. Potential duplicate notifications: ${duplicates.rows.length}`);
    if (duplicates.rows.length > 0) {
      duplicates.rows.forEach(n => {
        console.log(`   - Notification ${n.id} for user ${n.user_id}: ${n.type}`);
      });
    }

    const totalIssues = invalidUser.rows.length + invalidOrder.rows.length + 
                       invalidProduct.rows.length + duplicates.rows.length;
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total orphan notification issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✓ No orphan notifications detected');
    } else {
      console.log('✗ Orphan notifications detected - review above issues');
    }

  } catch (error) {
    console.error('Error checking orphan notifications:', error);
  } finally {
    await pool.end();
  }
}

checkOrphanNotifications();
