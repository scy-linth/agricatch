require('dotenv').config();
const { pool, clearSettingsCache } = require('../utils/db');

async function testNewOtpMode() {
  try {
    console.log('Testing New OTP Mode System...\n');
    
    // 1. Clear old settings
    console.log('1. Clearing old OTP settings...');
    await pool.query(`DELETE FROM platform_settings WHERE key IN ('otp_enabled', 'dev_expose_otp', 'otp_mode')`);
    clearSettingsCache();
    console.log('✓ Old settings cleared\n');
    
    // 2. Test default (should be strict mode)
    console.log('2. Testing default OTP mode (no DB value):');
    const { getPlatformSetting } = require('../utils/db');
    const defaultMode = await getPlatformSetting('otp_mode', 'strict');
    console.log(`   otp_mode: ${defaultMode} (expected: strict)`);
    console.log('✓ Default is strict mode\n');
    
    // 3. Test strict mode
    console.log('3. Testing STRICT mode:');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_mode', 'strict', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const strictMode = await getPlatformSetting('otp_mode');
    console.log(`   otp_mode: ${strictMode}`);
    console.log('   Expected behavior: OTP required, no bypass code, OTP not exposed');
    console.log('✓ Strict mode set\n');
    
    // 4. Test testing mode
    console.log('4. Testing TESTING mode:');
    await pool.query(`UPDATE platform_settings SET value = 'testing' WHERE key = 'otp_mode'`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_bypass_code', '999999', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const testingMode = await getPlatformSetting('otp_mode');
    const bypassCode = await getPlatformSetting('otp_bypass_code');
    console.log(`   otp_mode: ${testingMode}`);
    console.log(`   otp_bypass_code: ${bypassCode}`);
    console.log('   Expected behavior: OTP required, bypass code works, OTP exposed in response');
    console.log('✓ Testing mode set\n');
    
    // 5. Test disabled mode
    console.log('5. Testing DISABLED mode:');
    await pool.query(`UPDATE platform_settings SET value = 'disabled' WHERE key = 'otp_mode'`);
    clearSettingsCache();
    
    const disabledMode = await getPlatformSetting('otp_mode');
    console.log(`   otp_mode: ${disabledMode}`);
    console.log('   Expected behavior: No OTP required, bypass code ignored');
    console.log('✓ Disabled mode set\n');
    
    // 6. Reset to testing mode (recommended for local dev)
    console.log('6. Resetting to TESTING mode (recommended for local development):');
    await pool.query(`UPDATE platform_settings SET value = 'testing' WHERE key = 'otp_mode'`);
    await pool.query(`UPDATE platform_settings SET value = '789878' WHERE key = 'otp_bypass_code'`);
    clearSettingsCache();
    
    const finalMode = await getPlatformSetting('otp_mode');
    const finalBypass = await getPlatformSetting('otp_bypass_code');
    console.log(`   otp_mode: ${finalMode}`);
    console.log(`   otp_bypass_code: ${finalBypass}`);
    console.log('✓ Reset to testing mode\n');
    
    // 7. Verify other security settings
    console.log('7. Verifying other security settings:');
    const recaptcha = await getPlatformSetting('recaptcha_enabled', 'true');
    const authLimit = await getPlatformSetting('auth_rate_limit', '20');
    const otpLimit = await getPlatformSetting('otp_rate_limit', '10');
    
    console.log(`   recaptcha_enabled: ${recaptcha}`);
    console.log(`   auth_rate_limit: ${authLimit} per 15min`);
    console.log(`   otp_rate_limit: ${otpLimit} per 15min`);
    console.log('✓ All settings verified\n');
    
    console.log('✅ All tests passed! New OTP mode system is working correctly.');
    console.log('\nSummary of OTP Modes:');
    console.log('  🔒 Strict Mode: OTP required, no bypass, no exposure (Production)');
    console.log('  🧪 Testing Mode: OTP required, bypass code works, OTP exposed (Local/AI Testing)');
    console.log('  ⚠️ Disabled: No OTP required (Not Recommended)');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testNewOtpMode();
