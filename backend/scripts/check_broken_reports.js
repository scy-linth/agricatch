require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('../utils/db');

async function checkBrokenReports() {
  console.log('=== BROKEN REPORTS CHECK ===\n');

  try {
    // Check 1: Orders with NULL total_amount
    const nullTotal = await pool.query(`
      SELECT id, user_id, product_id, total_amount, status
      FROM orders
      WHERE total_amount IS NULL
    `);
    console.log(`1. Orders with NULL total_amount: ${nullTotal.rows.length}`);
    if (nullTotal.rows.length > 0) {
      nullTotal.rows.forEach(o => {
        console.log(`   - Order ${o.id} for user ${o.user_id}: ${o.status}`);
      });
    }

    // Check 2: Orders with negative total_amount
    const negativeTotal = await pool.query(`
      SELECT id, user_id, product_id, total_amount, status
      FROM orders
      WHERE total_amount < 0
    `);
    console.log(`2. Orders with negative total_amount: ${negativeTotal.rows.length}`);
    if (negativeTotal.rows.length > 0) {
      negativeTotal.rows.forEach(o => {
        console.log(`   - Order ${o.id} for user ${o.user_id}: ₱${o.total_amount}`);
      });
    }

    // Check 3: Orders with NULL quantity
    const nullQuantity = await pool.query(`
      SELECT id, user_id, product_id, quantity, status
      FROM orders
      WHERE quantity IS NULL
    `);
    console.log(`3. Orders with NULL quantity: ${nullQuantity.rows.length}`);
    if (nullQuantity.rows.length > 0) {
      nullQuantity.rows.forEach(o => {
        console.log(`   - Order ${o.id} for user ${o.user_id}: ${o.status}`);
      });
    }

    // Check 4: Orders with negative quantity
    const negativeQuantity = await pool.query(`
      SELECT id, user_id, product_id, quantity, status
      FROM orders
      WHERE quantity < 0
    `);
    console.log(`4. Orders with negative quantity: ${negativeQuantity.rows.length}`);
    if (negativeQuantity.rows.length > 0) {
      negativeQuantity.rows.forEach(o => {
        console.log(`   - Order ${o.id} for user ${o.user_id}: ${o.quantity} units`);
      });
    }

    // Check 5: Orders with inconsistent pricing (total != price * quantity)
    const inconsistentPricing = await pool.query(`
      SELECT o.id, o.user_id, o.product_id, o.total_amount, o.quantity, p.price
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.total_amount != (o.quantity * p.price)
        AND o.status != 'cancelled'
    `);
    console.log(`5. Orders with inconsistent pricing: ${inconsistentPricing.rows.length}`);
    if (inconsistentPricing.rows.length > 0) {
      inconsistentPricing.rows.forEach(o => {
        const expected = o.quantity * o.price;
        console.log(`   - Order ${o.id}: total=${o.total_amount}, expected=${expected} (${o.quantity} × ₱${o.price})`);
      });
    }

    // Check 6: Reviews with invalid ratings
    const invalidRatings = await pool.query(`
      SELECT id, product_id, user_id, rating
      FROM reviews
      WHERE rating < 1 OR rating > 5
    `);
    console.log(`6. Reviews with invalid ratings (not 1-5): ${invalidRatings.rows.length}`);
    if (invalidRatings.rows.length > 0) {
      invalidRatings.rows.forEach(r => {
        console.log(`   - Review ${r.id} for product ${r.product_id}: rating=${r.rating}`);
      });
    }

    const totalIssues = nullTotal.rows.length + negativeTotal.rows.length + nullQuantity.rows.length + 
                       negativeQuantity.rows.length + inconsistentPricing.rows.length + invalidRatings.rows.length;
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total broken report issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✓ No broken reports detected');
    } else {
      console.log('✗ Broken reports detected - review above issues');
    }

  } catch (error) {
    console.error('Error checking broken reports:', error);
  } finally {
    await pool.end();
  }
}

checkBrokenReports();
