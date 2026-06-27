const { pool } = require('./utils/db');

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
