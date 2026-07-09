require('dotenv').config();
const { Pool } = require('../backend/node_modules/pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('supabase') ? { rejectUnauthorized: false } : false
});

(async () => {
  const result = await pool.query("SELECT id, username, email, full_name, role FROM users WHERE role = 'customer' LIMIT 20");
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
})();
