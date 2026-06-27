const { Pool } = require('pg');
const { sendOtpEmail } = require('../utils/emailService');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testOtpBypassOnly() {
  console.log('Testing OTP bypass_only mode...\n');
  
  // Check current settings
  const settings = await pool.query(
    "SELECT key, value FROM platform_settings WHERE key IN ('otp_mode', 'otp_bypass_code')"
  );
  console.log('Current settings:');
  settings.rows.forEach(row => {
    console.log(`  ${row.key}: ${row.value}`);
  });
  console.log();
  
  // Test email sending (should fail in bypass_only mode if we modify emailService)
  // But actually, bypass_only mode in otp.js still sends email - it just doesn't expose OTP
  // Let me check the actual behavior in otp.js
  
  console.log('Checking email service configuration...');
  console.log(`RESEND_API_KEY set: ${!!process.env.RESEND_API_KEY}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log();
  
  // Test with a dummy email
  const testEmail = 'test@example.com';
  console.log(`Testing email send to ${testEmail}...`);
  
  const emailResult = await sendOtpEmail(testEmail, '123456', 'login');
  console.log('Email result:', emailResult);
  console.log();
  
  if (emailResult.success) {
    console.log('❌ ISSUE: Email was sent (should not send in bypass_only mode)');
  } else {
    console.log('✅ Email was not sent (expected in bypass_only mode)');
  }
  
  await pool.end();
}

testOtpBypassOnly().catch(console.error);
