require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('../utils/db');

async function checkReservationLeak() {
  console.log('=== RESERVATION LEAK CHECK ===\n');

  try {
    // Check if reservations table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'reservations'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Reservations table does not exist - checking pre-order reservations via orders table\n');
      
      // Check pre-orders with "Pre-order Reserved" status that are cancelled
      const cancelledReserved = await pool.query(`
        SELECT id, product_id, user_id, quantity, status
        FROM orders
        WHERE status = 'cancelled'
      `);
      console.log(`1. Cancelled orders: ${cancelledReserved.rows.length}`);
      
      // Check pre-orders with "Pre-order Reserved" status that are delivered
      const deliveredReserved = await pool.query(`
        SELECT id, product_id, user_id, quantity, status
        FROM orders
        WHERE status = 'delivered'
      `);
      console.log(`2. Delivered orders: ${deliveredReserved.rows.length}`);
      
      // Check pre-orders with Reserved status for non-existent products
      const invalidProduct = await pool.query(`
        SELECT o.id, o.product_id, o.user_id, o.status
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        WHERE o.status = 'Pre-order Reserved' AND p.id IS NULL
      `);
      console.log(`3. Pre-order reservations for non-existent products: ${invalidProduct.rows.length}`);
      
      const totalIssues = cancelledReserved.rows.length + deliveredReserved.rows.length + invalidProduct.rows.length;
      
      console.log(`\n=== SUMMARY ===`);
      console.log(`Total reservation leak issues: ${totalIssues}`);
      
      if (totalIssues === 0) {
        console.log('✓ No reservation leaks detected');
      } else {
        console.log('✗ Reservation leaks detected - review above issues');
      }
      return;
    }

    // Original reservations table checks
    const cancelledReservations = await pool.query(`
      SELECT r.id, r.product_id, r.user_id, r.quantity, o.id as order_id, o.status
      FROM reservations r
      JOIN orders o ON o.id = r.order_id
      WHERE o.status = 'cancelled'
    `);
    console.log(`1. Reservations for cancelled orders: ${cancelledReservations.rows.length}`);
    
    const deliveredReservations = await pool.query(`
      SELECT r.id, r.product_id, r.user_id, r.quantity, o.id as order_id, o.status
      FROM reservations r
      JOIN orders o ON o.id = r.order_id
      WHERE o.status = 'delivered'
    `);
    console.log(`2. Reservations for delivered orders: ${deliveredReservations.rows.length}`);
    
    const orphanedReservations = await pool.query(`
      SELECT r.id, r.product_id, r.user_id, r.quantity, r.order_id
      FROM reservations r
      LEFT JOIN orders o ON o.id = r.order_id
      WHERE o.id IS NULL
    `);
    console.log(`3. Orphaned reservations (no matching order): ${orphanedReservations.rows.length}`);
    
    const totalIssues = cancelledReservations.rows.length + deliveredReservations.rows.length + orphanedReservations.rows.length;
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total reservation leak issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✓ No reservation leaks detected');
    } else {
      console.log('✗ Reservation leaks detected - review above issues');
    }

  } catch (error) {
    console.error('Error checking reservation leaks:', error);
  } finally {
    await pool.end();
  }
}

checkReservationLeak();
