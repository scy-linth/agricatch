require('dotenv').config();
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    ssl: String(process.env.DB_HOST || '').includes('render.com') || String(process.env.DB_HOST || '').includes('supabase.com') ? { rejectUnauthorized: false } : false
  });
  try {
    const counts = await pool.query('SELECT c.id AS category_id, c.name AS category, COUNT(p.id)::int AS cnt FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id, c.name ORDER BY c.id');
    console.log('Product counts per category:');
    counts.rows.forEach(r => console.log(`- [${r.category_id}] ${r.category}: ${r.cnt}`));

    const sample = await pool.query('SELECT id, name, farmer_id, category_id, stock_quantity, harvest_date, expiry_date FROM products WHERE harvest_date IS NOT NULL ORDER BY id DESC LIMIT 10');
    console.log('\nSample products with harvest/expiry dates:');
    sample.rows.forEach(r => console.log(`- id:${r.id} name:"${r.name}" farmer:${r.farmer_id} cat:${r.category_id} stock:${r.stock_quantity} harvest:${r.harvest_date} expiry:${r.expiry_date}`));
  } catch (e) {
    console.error('report failed:', e.message || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();