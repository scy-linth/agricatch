require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

(async () => {
  try {
    const res = await pool.query("SELECT key, value FROM platform_settings WHERE key IN ('otp_mode', 'recaptcha_mode', 'otp_bypass_code') ORDER BY key");
    console.log('Current platform settings:');
    if (res.rows.length === 0) {
      console.log('  (no settings found - using defaults)');
    }
    res.rows.forEach(r => console.log(`  ${r.key}: ${r.value}`));
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
