require('dotenv').config();
const { pool } = require('../backend/utils/db');

async function setRecaptchaMode(mode) {
  try {
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('recaptcha_mode', $1, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`, [mode]);
    console.log(`Set recaptcha_mode to: ${mode}`);
    
    const result = await pool.query('SELECT value FROM platform_settings WHERE key = $1', ['recaptcha_mode']);
    console.log('Current recaptcha_mode:', result.rows[0]?.value);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

const mode = process.argv[2] || 'auto';
setRecaptchaMode(mode);
