require('dotenv').config();
const { pool } = require('../utils/db');

async function checkSecuritySettings() {
  try {
    const result = await pool.query(
      `SELECT key, value FROM platform_settings 
       WHERE key IN ('recaptcha_enabled', 'auth_rate_limit', 'otp_rate_limit', 'otp_enabled', 'otp_bypass_code', 'dev_expose_otp') 
       ORDER BY key`
    );
    
    console.log('Current Security Settings:');
    console.log('=========================');
    
    const settings = {
      recaptcha_enabled: 'true (default)',
      auth_rate_limit: '20 (default)',
      otp_rate_limit: '10 (default)',
      otp_enabled: 'true (default)',
      otp_bypass_code: '789878 (default)',
      dev_expose_otp: 'false (default)'
    };
    
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    console.log(`reCAPTCHA Enabled: ${settings.recaptcha_enabled}`);
    console.log(`Auth Rate Limit (per 15min): ${settings.auth_rate_limit}`);
    console.log(`OTP Rate Limit (per 15min): ${settings.otp_rate_limit}`);
    console.log(`OTP Required: ${settings.otp_enabled}`);
    console.log(`OTP Bypass Code: ${settings.otp_bypass_code}`);
    console.log(`Expose OTP in Response: ${settings.dev_expose_otp}`);
    console.log('=========================');
    
    await pool.end();
  } catch (error) {
    console.error('Error checking security settings:', error.message);
    process.exit(1);
  }
}

checkSecuritySettings();
