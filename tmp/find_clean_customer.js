require('dotenv').config();
const { Pool } = require('../backend/node_modules/pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('supabase') ? { rejectUnauthorized: false } : false
});

(async () => {
  const customers = await pool.query("SELECT id, username FROM users WHERE role = 'customer' ORDER BY id LIMIT 50");
  const counts = await pool.query(`
    SELECT customer_id, COUNT(*) as conv_count
    FROM conversations
    WHERE customer_id = ANY($1::int[])
    GROUP BY customer_id
  `, [customers.rows.map(c => c.id)]);
  const countMap = new Map(counts.rows.map(r => [r.customer_id, parseInt(r.conv_count)]));
  for (const c of customers.rows) {
    console.log(`${c.id}\t${c.username}\tconversations=${countMap.get(c.id) || 0}`);
  }
  await pool.end();
})();
