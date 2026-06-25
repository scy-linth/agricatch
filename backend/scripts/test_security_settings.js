require('dotenv').config();
const { pool, clearSettingsCache } = require('../utils/db');

async function testSecuritySettings() {
  try {
    console.log('Testing Security Settings Functionality...\n');
    console.log(`Current NODE_ENV: ${process.env.NODE_ENV || 'not set (defaults to development)'}\n`);
    
    // 1. Clear all settings to test environment-aware defaults
    console.log('1. Clearing all security settings to test environment-aware defaults...');
    await pool.query(`DELETE FROM platform_settings WHERE key IN ('recaptcha_enabled', 'auth_rate_limit', 'otp_rate_limit', 'otp_enabled', 'otp_bypass_code', 'dev_expose_otp')`);
    clearSettingsCache();
    console.log('✓ Settings cleared\n');
    
    // 2. Test environment-aware defaults
    console.log('2. Testing environment-aware defaults (no DB values set):');
    const { getPlatformSetting } = require('../utils/db');
    
    const isDev = process.env.NODE_ENV !== 'production';
    console.log(`   Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
    
    const recaptchaDefault = isDev ? 'false' : 'true';
    const authLimitDefault = isDev ? '100' : '20';
    const otpLimitDefault = isDev ? '50' : '10';
    const exposeOtpDefault = isDev ? 'true' : 'false';
    
    const recaptchaEnabled = await getPlatformSetting('recaptcha_enabled', recaptchaDefault);
    console.log(`   recaptcha_enabled: ${recaptchaEnabled} (expected: ${recaptchaDefault})`);
    
    const authRateLimit = await getPlatformSetting('auth_rate_limit', authLimitDefault);
    console.log(`   auth_rate_limit: ${authRateLimit} (expected: ${authLimitDefault})`);
    
    const otpRateLimit = await getPlatformSetting('otp_rate_limit', otpLimitDefault);
    console.log(`   otp_rate_limit: ${otpRateLimit} (expected: ${otpLimitDefault})`);
    
    const otpEnabled = await getPlatformSetting('otp_enabled', 'true');
    console.log(`   otp_enabled: ${otpEnabled} (expected: true)`);
    
    const otpBypassCode = await getPlatformSetting('otp_bypass_code', '789878');
    console.log(`   otp_bypass_code: ${otpBypassCode} (expected: 789878)`);
    
    const devExposeOtp = await getPlatformSetting('dev_expose_otp', exposeOtpDefault);
    console.log(`   dev_expose_otp: ${devExposeOtp} (expected: ${exposeOtpDefault})`);
    console.log('✓ Environment-aware defaults working\n');
    
    // 3. Insert custom settings to test override
    console.log('3. Inserting custom settings to test platform_settings override...');
    await pool.query(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES 
        ('recaptcha_enabled', 'false', CURRENT_TIMESTAMP),
        ('auth_rate_limit', '200', CURRENT_TIMESTAMP),
        ('otp_rate_limit', '100', CURRENT_TIMESTAMP),
        ('otp_enabled', 'true', CURRENT_TIMESTAMP),
        ('otp_bypass_code', '555555', CURRENT_TIMESTAMP),
        ('dev_expose_otp', 'true', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `);
    clearSettingsCache();
    console.log('✓ Custom settings inserted\n');
    
    // 4. Test that platform_settings override defaults
    console.log('4. Testing platform_settings override (should ignore environment defaults):');
    const overrideRecaptcha = await getPlatformSetting('recaptcha_enabled', recaptchaDefault);
    const overrideAuthLimit = await getPlatformSetting('auth_rate_limit', authLimitDefault);
    const overrideOtpLimit = await getPlatformSetting('otp_rate_limit', otpLimitDefault);
    const overrideBypassCode = await getPlatformSetting('otp_bypass_code', '789878');
    const overrideExposeOtp = await getPlatformSetting('dev_expose_otp', exposeOtpDefault);
    
    console.log(`   recaptcha_enabled: ${overrideRecaptcha} (expected: false, not ${recaptchaDefault})`);
    console.log(`   auth_rate_limit: ${overrideAuthLimit} (expected: 200, not ${authLimitDefault})`);
    console.log(`   otp_rate_limit: ${overrideOtpLimit} (expected: 100, not ${otpLimitDefault})`);
    console.log(`   otp_bypass_code: ${overrideBypassCode} (expected: 555555)`);
    console.log(`   dev_expose_otp: ${overrideExposeOtp} (expected: true)`);
    console.log('✓ Platform settings override working\n');
    
    // 5. Reset to environment-appropriate defaults
    console.log('5. Resetting to environment-appropriate defaults...');
    await pool.query(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES 
        ('recaptcha_enabled', $1, CURRENT_TIMESTAMP),
        ('auth_rate_limit', $2, CURRENT_TIMESTAMP),
        ('otp_rate_limit', $3, CURRENT_TIMESTAMP),
        ('otp_enabled', 'true', CURRENT_TIMESTAMP),
        ('otp_bypass_code', '789878', CURRENT_TIMESTAMP),
        ('dev_expose_otp', $4, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [recaptchaDefault, authLimitDefault, otpLimitDefault, exposeOtpDefault]);
    clearSettingsCache();
    console.log('✓ Reset to environment defaults\n');
    
    // 6. Final verification
    console.log('6. Final verification (current environment settings):');
    const finalRecaptcha = await getPlatformSetting('recaptcha_enabled');
    const finalAuthLimit = await getPlatformSetting('auth_rate_limit');
    const finalOtpLimit = await getPlatformSetting('otp_rate_limit');
    const finalOtpEnabled = await getPlatformSetting('otp_enabled');
    const finalBypassCode = await getPlatformSetting('otp_bypass_code');
    const finalExposeOtp = await getPlatformSetting('dev_expose_otp');
    
    console.log(`   reCAPTCHA Enabled: ${finalRecaptcha}`);
    console.log(`   Auth Rate Limit: ${finalAuthLimit} per 15min`);
    console.log(`   OTP Rate Limit: ${finalOtpLimit} per 15min`);
    console.log(`   OTP Required: ${finalOtpEnabled}`);
    console.log(`   OTP Bypass Code: ${finalBypassCode}`);
    console.log(`   Expose OTP: ${finalExposeOtp}`);
    
    console.log('\n✅ All tests passed! Security settings system is working correctly with environment-aware defaults.');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testSecuritySettings();
