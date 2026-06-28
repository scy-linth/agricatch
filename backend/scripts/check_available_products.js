const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAvailableProducts() {
  try {
    // Check available products
    const availableRes = await pool.query(`
      SELECT id, name, is_available, is_admin_disabled, status, linked_product_id
      FROM products
      WHERE is_available = true
      AND is_admin_disabled = false
      AND status = 'approved'
      ORDER BY id DESC
      LIMIT 5
    `);
    
    console.log('\n=== Available Products (Case 1 candidates) ===');
    console.log(availableRes.rows.map(p => `ID: ${p.id}, Name: ${p.name}, Linked: ${p.linked_product_id}`).join('\n'));

    // Check products with linked products
    const linkedRes = await pool.query(`
      SELECT p1.id, p1.name, p1.is_available, p1.linked_product_id, p2.id as linked_id, p2.name as linked_name, p2.is_available as linked_available
      FROM products p1
      LEFT JOIN products p2 ON p1.linked_product_id = p2.id
      WHERE p1.linked_product_id IS NOT NULL
      ORDER BY p1.id DESC
      LIMIT 5
    `);
    
    console.log('\n=== Products with Linked Products (Case 2 candidates) ===');
    linkedRes.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Available: ${p.is_available}, Linked ID: ${p.linked_id}, Linked Name: ${p.linked_name}, Linked Available: ${p.linked_available}`);
    });

    // Check the specific product from Order #254
    const orderRes = await pool.query(`
      SELECT product_id FROM orders WHERE id = 254
    `);
    if (orderRes.rows.length > 0) {
      const productId = orderRes.rows[0].product_id;
      const productRes = await pool.query(`
        SELECT id, name, is_available, is_admin_disabled, status, linked_product_id
        FROM products WHERE id = $1
      `, [productId]);
      console.log('\n=== Product from Order #254 ===');
      console.log(productRes.rows[0]);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAvailableProducts();
