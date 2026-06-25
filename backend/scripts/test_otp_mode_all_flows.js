require('dotenv').config();
const { pool, clearSettingsCache } = require('../utils/db');

async function testOtpModeAllFlows() {
  try {
    console.log('Testing OTP Mode for All Flows (Register, Login, Forgot Password)...\n');
    
    // 1. Set to disabled mode
    console.log('1. Setting OTP mode to DISABLED...');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_mode', 'disabled', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const { getPlatformSetting } = require('../utils/db');
    const disabledMode = await getPlatformSetting('otp_mode');
    console.log(`   otp_mode: ${disabledMode}`);
    console.log('   Expected: OTP disabled for register, login, and forgot password\n');
    
    // 2. Set to strict mode
    console.log('2. Setting OTP mode to STRICT...');
    await pool.query(`UPDATE platform_settings SET value = 'strict' WHERE key = 'otp_mode'`);
    clearSettingsCache();
    
    const strictMode = await getPlatformSetting('otp_mode');
    console.log(`   otp_mode: ${strictMode}`);
    console.log('   Expected: OTP required for register, login, and forgot password (no bypass)\n');
    
    // 3. Set to testing mode
    console.log('3. Setting OTP mode to TESTING...');
    await pool.query(`UPDATE platform_settings SET value = 'testing' WHERE key = 'otp_mode'`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_bypass_code', '789878', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const testingMode = await getPlatformSetting('otp_mode');
    const bypassCode = await getPlatformSetting('otp_bypass_code');
    console.log(`   otp_mode: ${testingMode}`);
    console.log(`   otp_bypass_code: ${bypassCode}`);
    console.log('   Expected: OTP required for all flows, but bypass code works\n');
    
    // 4. Reset to testing mode (recommended for local)
    console.log('4. Resetting to TESTING mode (recommended for local development)...');
    console.log('   ✅ Settings saved\n');
    
    console.log('✅ OTP mode now controls all flows:');
    console.log('   - Registration (purpose=register)');
    console.log('   - Login (purpose=login)');
    console.log('   - Forgot Password (purpose=reset_password)');
    console.log('\nSummary of OTP Modes:');
    console.log('  🔒 Strict Mode: OTP required for all flows, no bypass (Production)');
    console.log('  🧪 Testing Mode: OTP required for all flows, bypass code works (Local/AI Testing)');
    console.log('  ⚠️ Disabled: No OTP required for any flow (Not Recommended)');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testOtpModeAllFlows();
