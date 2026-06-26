require('dotenv').config();
const { pool } = require('../backend/utils/db');

async function checkRecaptchaMode() {
  try {
    const result = await pool.query('SELECT value FROM platform_settings WHERE key = $1', ['recaptcha_mode']);
    const mode = result.rows[0]?.value || 'auto (default)';
    console.log('recaptcha_mode:', mode);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    if (mode === 'auto' || mode === 'auto (default)') {
      const enabled = process.env.NODE_ENV !== 'development';
      console.log('reCAPTCHA enabled:', enabled);
      console.log('=> In development, reCAPTCHA is AUTOMATICALLY BYPASSED');
    } else if (mode === 'always_off') {
      console.log('=> reCAPTCHA is ALWAYS OFF (bypassed)');
    } else if (mode === 'always_on') {
      console.log('=> reCAPTCHA is ALWAYS ON (not bypassed)');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkRecaptchaMode();
