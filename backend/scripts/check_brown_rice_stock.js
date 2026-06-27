const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkBrownRiceStock() {
  try {
    console.log('Checking Brown rice (Product #12) stock...\n');

    const result = await pool.query(`
      SELECT id, name, stock_quantity, reserved_quantity, max_preorder_quantity, 
             is_preorder, is_available, is_admin_disabled
      FROM products
      WHERE id = 12
    `);

    if (result.rows.length === 0) {
      console.log('Product #12 not found');
    } else {
      const product = result.rows[0];
      console.log('Product #12 - Brown rice:');
      console.log(`  Name: ${product.name}`);
      console.log(`  Stock Quantity: ${product.stock_quantity}`);
      console.log(`  Reserved Quantity: ${product.reserved_quantity}`);
      console.log(`  Max Pre-order Quantity: ${product.max_preorder_quantity}`);
      console.log(`  Is Pre-order: ${product.is_preorder}`);
      console.log(`  Is Available: ${product.is_available}`);
      console.log(`  Is Admin Disabled: ${product.is_admin_disabled}`);
      
      if (product.is_preorder) {
        const available = product.max_preorder_quantity - product.reserved_quantity;
        console.log(`  Available for pre-order: ${available}`);
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkBrownRiceStock();
