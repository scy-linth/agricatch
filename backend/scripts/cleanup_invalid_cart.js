const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupInvalidCartItems() {
  console.log('=== Cleaning Up Invalid Cart Items ===\n');
  
  try {
    // Delete cart items with quantity 0 or below MOQ
    const result = await pool.query(`
      DELETE FROM cart
      WHERE quantity < COALESCE((SELECT minimum_order_quantity FROM products WHERE products.id = cart.product_id), 1)
      RETURNING id, product_id, quantity
    `);
    
    console.log(`✅ Deleted ${result.rows.length} invalid cart items:`);
    result.rows.forEach(item => {
      console.log(`   Cart ID: ${item.id}, Product ID: ${item.product_id}, Qty: ${item.quantity}`);
    });
    
    console.log('\n=== Cleanup Complete ===');
    
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await pool.end();
  }
}

cleanupInvalidCartItems();
