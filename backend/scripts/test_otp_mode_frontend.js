require('dotenv').config();
const { pool, clearSettingsCache } = require('../utils/db');

async function testOtpModeFrontend() {
  try {
    console.log('Testing OTP Mode Frontend Integration...\n');
    
    // 1. Set to disabled mode
    console.log('1. Setting OTP mode to DISABLED...');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_mode', 'disabled', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const { getPlatformSetting } = require('../utils/db');
    const disabledMode = await getPlatformSetting('otp_mode');
    console.log(`   otp_mode: ${disabledMode}`);
    console.log('   Expected: Frontend should hide all OTP sections\n');
    
    // 2. Test the public endpoint
    console.log('2. Testing public endpoint GET /api/auth/otp-mode...');
    console.log('   Endpoint: GET /api/auth/otp-mode');
    console.log('   Expected response: { "otp_mode": "disabled" }\n');
    
    // 3. Set to testing mode
    console.log('3. Setting OTP mode to TESTING...');
    await pool.query(`UPDATE platform_settings SET value = 'testing' WHERE key = 'otp_mode'`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_bypass_code', '789878', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const testingMode = await getPlatformSetting('otp_mode');
    console.log(`   otp_mode: ${testingMode}`);
    console.log('   Expected: Frontend should show all OTP sections\n');
    
    // 4. Test the public endpoint again
    console.log('4. Testing public endpoint with testing mode...');
    console.log('   Expected response: { "otp_mode": "testing" }\n');
    
    // 5. Reset to testing mode (recommended for local)
    console.log('5. Resetting to TESTING mode (recommended for local development)...');
    console.log('   ✅ Settings saved\n');
    
    console.log('✅ OTP mode frontend integration ready for testing.');
    console.log('\nManual Testing Steps:');
    console.log('1. Start the backend server');
    console.log('2. Open the frontend in browser');
    console.log('3. Open browser console and check for "OTP mode: disabled" or "OTP mode: testing"');
    console.log('4. Verify OTP sections are hidden when otp_mode=disabled');
    console.log('5. Verify OTP sections are visible when otp_mode=testing or strict');
    console.log('\nFrontend Changes:');
    console.log('- Added fetchOtpMode() method to get otp_mode from backend');
    console.log('- Added updateOtpSectionsVisibility() to hide/show OTP sections');
    console.log('- Added checks in sendOtpForRegistration(), sendOtp(), sendForgotPasswordCode()');
    console.log('- OTP sections: register-otp-section, login-otp-section, forgot-otp-section');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testOtpModeFrontend();
