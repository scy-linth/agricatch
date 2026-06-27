require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkHarvestResult() {
  try {
    console.log('=== Checking Harvest Result ===\n');
    
    // Check product 99 status
    const product99 = await pool.query('SELECT * FROM products WHERE id = 99');
    console.log('Product 99 (original pre-order):');
    console.log(JSON.stringify(product99.rows[0], null, 2));
    console.log();
    
    // Check for any new available products with same name
    const availableProducts = await pool.query(
      `SELECT * FROM products 
       WHERE name = 'Test Scenario 2 Pre-order' 
         AND is_preorder = false 
         AND is_available = true
       ORDER BY created_at DESC`
    );
    console.log('Available products with same name:');
    if (availableProducts.rows.length > 0) {
      availableProducts.rows.forEach(p => {
        console.log(`  ID: ${p.id}, Is Pre-order: ${p.is_preorder}, Is Available: ${p.is_available}, Stock: ${p.stock_quantity}, Linked: ${p.linked_product_id}`);
      });
    } else {
      console.log('  None found');
    }
    console.log();
    
    // Check order 23 status
    const order23 = await pool.query('SELECT * FROM orders WHERE id = 23');
    console.log('Order 23 (pre-order reservation):');
    console.log(JSON.stringify(order23.rows[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkHarvestResult();
