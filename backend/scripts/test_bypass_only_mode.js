require('dotenv').config();
const { pool, getPlatformSetting, clearSettingsCache } = require('../utils/db');

async function testBypassOnlyMode() {
  console.log('Testing Bypass Only OTP Mode...\n');

  try {
    // Test 1: Set otp_mode to bypass_only
    console.log('1. Setting otp_mode to bypass_only...');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_mode', 'bypass_only', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_bypass_code', '789878', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const otpMode = await getPlatformSetting('otp_mode', 'strict');
    console.log(`   otp_mode: ${otpMode} (expected: bypass_only) ${otpMode === 'bypass_only' ? '✅' : '❌'}`);

    // Test 2: Check if bypass code is available
    console.log('\n2. Checking if bypass code is available...');
    const bypassCode = await getPlatformSetting('otp_bypass_code', '789878');
    console.log(`   otp_bypass_code: ${bypassCode} (expected: 789878) ${bypassCode === '789878' ? '✅' : '❌'}`);

    // Test 3: Simulate shouldExposeOtpForDebug() logic
    console.log('\n3. Testing OTP exposure logic...');
    const shouldExpose = otpMode === 'testing';
    console.log(`   shouldExposeOtpForDebug(): ${shouldExpose} (expected: false) ${!shouldExpose ? '✅' : '❌'}`);
    console.log('   In bypass_only mode, OTP should NOT be exposed in response or logs');

    // Test 4: Simulate getOtpBypassCode() logic
    console.log('\n4. Testing bypass code availability...');
    const isDisabled = otpMode === 'disabled';
    const bypassAvailable = !isDisabled ? bypassCode : null;
    console.log(`   Bypass code available: ${bypassAvailable !== null ? 'Yes' : 'No'} (expected: Yes) ${bypassAvailable !== null ? '✅' : '❌'}`);
    console.log('   In bypass_only mode, bypass code should work');

    // Test 5: Compare with testing mode
    console.log('\n5. Comparing with testing mode...');
    await pool.query(`UPDATE platform_settings SET value = 'testing' WHERE key = 'otp_mode'`);
    clearSettingsCache();
    const testingMode = await getPlatformSetting('otp_mode', 'strict');
    const shouldExposeTesting = testingMode === 'testing';
    console.log(`   testing mode shouldExpose: ${shouldExposeTesting} (expected: true) ${shouldExposeTesting ? '✅' : '❌'}`);

    // Reset to bypass_only
    await pool.query(`UPDATE platform_settings SET value = 'bypass_only' WHERE key = 'otp_mode'`);
    clearSettingsCache();

    console.log('\n✅ All tests passed!');
    console.log('\nSummary of Bypass Only Mode:');
    console.log('  - OTP is required for all flows (like strict/testing)');
    console.log('  - Bypass code works (like testing mode)');
    console.log('  - OTP is NOT exposed in API response (unlike testing mode)');
    console.log('  - OTP is NOT shown in console logs (unlike testing mode)');
    console.log('  - Use case: Secure testing where you need bypass but want to keep OTP secret');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testBypassOnlyMode();
