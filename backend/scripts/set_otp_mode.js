const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setOtpMode(mode) {
  try {
    await pool.query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_mode', $1, CURRENT_TIMESTAMP) 
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [mode]
    );
    console.log(`✅ Set otp_mode to: ${mode}`);
    
    const result = await pool.query('SELECT value FROM platform_settings WHERE key = $1', ['otp_mode']);
    console.log(`Current otp_mode: ${result.rows[0]?.value}`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error setting otp_mode:', error.message);
    process.exit(1);
  }
}

const mode = process.argv[2] || 'bypass_only';
setOtpMode(mode);
