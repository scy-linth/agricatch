const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agri_fishery_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: String(process.env.DB_HOST || '').includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function createOtpTable() {
  try {
    console.log('Creating OTP table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        purpose VARCHAR(50) NOT NULL DEFAULT 'login', -- 'login', 'register', 'reset_password'
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster lookups (without predicate to avoid immutable function issue)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_otps_email_purpose 
      ON otps(email, purpose)
    `);

    // Create index for expiration cleanup
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_otps_expires_at 
      ON otps(expires_at)
    `);

    console.log('✅ OTP table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating OTP table:', error);
    process.exit(1);
  }
}

createOtpTable();
