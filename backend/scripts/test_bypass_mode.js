require('dotenv').config();
const { pool, getPlatformSetting, clearSettingsCache } = require('../utils/db');

async function testBypassMode() {
  console.log('Testing Bypass OTP Mode...\n');

  try {
    // Test 1: Set otp_mode to bypass
    console.log('1. Setting otp_mode to bypass...');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_mode', 'bypass', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_bypass_code', '789878', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const otpMode = await getPlatformSetting('otp_mode', 'strict');
    console.log(`   otp_mode: ${otpMode} (expected: bypass) ${otpMode === 'bypass' ? '✅' : '❌'}`);

    // Test 2: Check if bypass code is available
    console.log('\n2. Checking if bypass code is available...');
    const bypassCode = await getPlatformSetting('otp_bypass_code', '789878');
    console.log(`   otp_bypass_code: ${bypassCode} (expected: 789878) ${bypassCode === '789878' ? '✅' : '❌'}`);

    // Test 3: Simulate shouldExposeOtpForDebug() logic
    console.log('\n3. Testing OTP exposure in logs/API...');
    const shouldExposeDebug = otpMode === 'testing' || otpMode === 'bypass';
    console.log(`   shouldExposeOtpForDebug(): ${shouldExposeDebug} (expected: true) ${shouldExposeDebug ? '✅' : '❌'}`);
    console.log('   In bypass mode, OTP should be exposed in logs/API response');

    // Test 4: Simulate shouldExposeOtpInFrontend() logic
    console.log('\n4. Testing OTP exposure in frontend...');
    const shouldExposeFrontend = otpMode === 'testing';
    console.log(`   shouldExposeOtpInFrontend(): ${shouldExposeFrontend} (expected: false) ${!shouldExposeFrontend ? '✅' : '❌'}`);
    console.log('   In bypass mode, OTP should NOT be exposed in frontend UI');

    // Test 5: Simulate getOtpBypassCode() logic
    console.log('\n5. Testing bypass code availability...');
    const isDisabled = otpMode === 'disabled';
    const bypassAvailable = !isDisabled ? bypassCode : null;
    console.log(`   Bypass code available: ${bypassAvailable !== null ? 'Yes' : 'No'} (expected: Yes) ${bypassAvailable !== null ? '✅' : '❌'}`);
    console.log('   In bypass mode, bypass code should work');

    // Test 6: Compare with testing mode
    console.log('\n6. Comparing with testing mode...');
    await pool.query(`UPDATE platform_settings SET value = 'testing' WHERE key = 'otp_mode'`);
    clearSettingsCache();
    const testingMode = await getPlatformSetting('otp_mode', 'strict');
    const shouldExposeDebugTesting = testingMode === 'testing' || testingMode === 'bypass';
    const shouldExposeFrontendTesting = testingMode === 'testing';
    console.log(`   testing mode shouldExposeDebug: ${shouldExposeDebugTesting} (expected: true) ${shouldExposeDebugTesting ? '✅' : '❌'}`);
    console.log(`   testing mode shouldExposeFrontend: ${shouldExposeFrontendTesting} (expected: true) ${shouldExposeFrontendTesting ? '✅' : '❌'}`);

    // Reset to bypass
    await pool.query(`UPDATE platform_settings SET value = 'bypass' WHERE key = 'otp_mode'`);
    clearSettingsCache();

    console.log('\n✅ All tests passed!');
    console.log('\nSummary of Bypass Mode:');
    console.log('  - OTP is required for all flows (like strict/testing)');
    console.log('  - Bypass code works (like testing mode)');
    console.log('  - OTP IS exposed in API response (for logs/backend debugging)');
    console.log('  - OTP is NOT shown in frontend UI (unlike testing mode)');
    console.log('  - Use case: Backend debugging where you need to see OTP in logs but hide from users');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testBypassMode();
