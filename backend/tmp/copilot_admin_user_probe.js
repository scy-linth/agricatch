require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    const res = await pool.query("SELECT id, username, email, role FROM users WHERE role IN ('admin','super_admin') ORDER BY id ASC LIMIT 5");
    console.log(JSON.stringify(res.rows));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
