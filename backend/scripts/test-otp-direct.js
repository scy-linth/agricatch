/**
 * Direct OTP test - bypasses HTTP route
 * Tests OTP sending directly to database and email
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { sendOtpEmail } = require('../utils/emailService');

const TEST_EMAIL = 'scylinthgaming@gmail.com';
const PURPOSE = 'reset_password';

const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agri_fishery_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: pgSsl,
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function testOtpDirect() {
  console.log('\n=== Direct OTP Test ===\n');
  console.log(`Email: ${TEST_EMAIL}`);
  console.log(`Purpose: ${PURPOSE}\n`);

  try {
    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('1. Generating OTP...');
    console.log(`   OTP Code: ${otp}`);
    console.log(`   Expires at: ${expiresAt.toISOString()}\n`);

    // Invalidate previous unused OTPs
    console.log('2. Invalidating previous OTPs...');
    await pool.query(
      'UPDATE otps SET is_used = true WHERE email = $1 AND purpose = $2 AND is_used = false',
      [TEST_EMAIL, PURPOSE]
    );
    console.log('   ✅ Previous OTPs invalidated\n');

    // Store OTP in database
    console.log('3. Storing OTP in database...');
    await pool.query(
      'INSERT INTO otps (email, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [TEST_EMAIL, otp, PURPOSE, expiresAt]
    );
    console.log('   ✅ OTP stored in database\n');

    // Send OTP via email
    console.log('4. Sending OTP email...');
    console.log(`   SMTP Host: ${process.env.SMTP_HOST}`);
    console.log(`   SMTP Port: ${process.env.SMTP_PORT}`);
    console.log(`   SMTP User: ${process.env.SMTP_USER}\n`);

    const emailResult = await sendOtpEmail(TEST_EMAIL, otp, PURPOSE);

    if (emailResult.success) {
      console.log('   ✅ OTP email sent successfully!');
      console.log(`   Message ID: ${emailResult.messageId}\n`);
      console.log('📧 Please check your email inbox at:', TEST_EMAIL);
      console.log('   The OTP code is:', otp);
      console.log('   (This is shown for testing purposes only)\n');
    } else {
      console.log('   ❌ Failed to send OTP email');
      console.log('   Error:', emailResult.error);
      console.log('\n   Please check your SMTP settings in .env file');
    }

    await pool.end();
    process.exit(emailResult.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testOtpDirect();
