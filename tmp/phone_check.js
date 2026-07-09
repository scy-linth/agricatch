require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('../backend/node_modules/pg');

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false
  });
  try {
    const res = await pool.query(
      `SELECT id, username, email, role, phone FROM users WHERE username IN ('scy_linth','testadmin','testfarmer','testcustomer','customer','Theressa') ORDER BY id`
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
})();
