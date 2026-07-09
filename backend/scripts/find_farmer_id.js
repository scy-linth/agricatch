const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.cxqyqffnrmfowwaefbff:etitsmwa123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
});

async function findFarmerId() {
  try {
    const result = await pool.query(`
      SELECT id, email, shop_name 
      FROM users 
      WHERE role = 'farmer' 
      ORDER BY id 
      LIMIT 10
    `);
    
    console.log('Farmers in database:');
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}, Email: ${row.email}, Shop: ${row.shop_name}`);
    });
    
    // Check orders for each farmer
    for (const farmer of result.rows) {
      const orders = await pool.query(`
        SELECT COUNT(*) as count
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.farmer_id = $1
      `, [farmer.id]);
      
      console.log(`  Farmer ${farmer.id} has ${orders.rows[0].count} orders`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

findFarmerId();
