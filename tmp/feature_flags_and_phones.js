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
    const ff = await pool.query('SELECT key, enabled FROM feature_flags ORDER BY key');
    console.log('FEATURE_FLAGS:');
    console.log(JSON.stringify(ff.rows, null, 2));
    const phones = await pool.query("SELECT id, username, role, phone FROM users WHERE phone IS NOT NULL AND phone <> '' ORDER BY id");
    console.log('USER_PHONES:');
    console.log(JSON.stringify(phones.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
