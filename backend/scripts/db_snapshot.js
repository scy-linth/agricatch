const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../utils/db');

(async () => {
  try {
    const db = await pool.query('SELECT current_database() AS db, inet_server_addr()::text AS host, inet_server_port() AS port');
    const totals = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM products) AS products,
        (SELECT COUNT(*)::int FROM orders) AS orders,
        (SELECT COUNT(*)::int FROM categories) AS categories
    `);
    const roles = await pool.query('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role');

    console.log(JSON.stringify({ db: db.rows[0], totals: totals.rows[0], roles: roles.rows }, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
