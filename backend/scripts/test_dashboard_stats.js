const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function testDashboardStats() {
  try {
    console.log('Testing dashboard stats queries...\n');

    // Test sales query
    const salesRes = await pool.query(`SELECT COUNT(*) AS count FROM orders o WHERE DATE(CASE WHEN o.status = 'delivered' THEN COALESCE(o.updated_at, o.created_at) ELSE o.created_at END) = CURRENT_DATE AND o.status != 'cancelled'`);
    console.log('Sales (today):', salesRes.rows[0]);

    // Test revenue query
    const revenueRes = await pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS total FROM orders o WHERE DATE(CASE WHEN o.status = 'delivered' THEN COALESCE(o.updated_at, o.created_at) ELSE o.created_at END) = CURRENT_DATE AND o.status NOT IN ('cancelled','disabled')`);
    console.log('Revenue (today):', revenueRes.rows[0]);

    // Test customers query
    const custRes = await pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'customer' AND DATE(u.created_at) = CURRENT_DATE`);
    console.log('Customers (today):', custRes.rows[0]);

    // Test farmers query
    const farmerRes = await pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'farmer' AND DATE(u.created_at) = CURRENT_DATE`);
    console.log('Farmers (today):', farmerRes.rows[0]);

    // Test harvest attention query
    const harvestRes = await pool.query(`SELECT COUNT(*) AS count FROM products p WHERE p.is_available = true AND p.harvest_date IS NOT NULL AND p.harvest_date < CURRENT_DATE`);
    console.log('Harvest attention:', harvestRes.rows[0]);

    console.log('\n✅ All queries executed successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testDashboardStats();
