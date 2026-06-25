require('dotenv').config();
const { pool, clearSettingsCache } = require('../utils/db');

async function testEnvironmentAwareRateLimits() {
  try {
    console.log('Testing Environment-Aware Rate Limits...\n');
    
    // 1. Set local development rate limits
    console.log('1. Setting local development rate limits...');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('auth_rate_limit_local', '100', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_rate_limit_local', '50', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const { getPlatformSetting } = require('../utils/db');
    const authLocal = await getPlatformSetting('auth_rate_limit_local');
    const otpLocal = await getPlatformSetting('otp_rate_limit_local');
    console.log(`   auth_rate_limit_local: ${authLocal}`);
    console.log(`   otp_rate_limit_local: ${otpLocal}`);
    console.log('   Expected: Local development uses these values\n');
    
    // 2. Set production rate limits
    console.log('2. Setting production rate limits...');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('auth_rate_limit_production', '20', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_rate_limit_production', '10', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const authProduction = await getPlatformSetting('auth_rate_limit_production');
    const otpProduction = await getPlatformSetting('otp_rate_limit_production');
    console.log(`   auth_rate_limit_production: ${authProduction}`);
    console.log(`   otp_rate_limit_production: ${otpProduction}`);
    console.log('   Expected: Production uses these values\n');
    
    // 3. Test backend logic (simulated)
    console.log('3. Testing backend rate limit logic...');
    const isDev = process.env.NODE_ENV === 'development';
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   isDev: ${isDev}`);
    
    const authKey = isDev ? 'auth_rate_limit_local' : 'auth_rate_limit_production';
    const otpKey = isDev ? 'otp_rate_limit_local' : 'otp_rate_limit_production';
    
    const authLimit = await getPlatformSetting(authKey, isDev ? '100' : '20');
    const otpLimit = await getPlatformSetting(otpKey, isDev ? '50' : '10');
    
    console.log(`   Auth limit will use: ${authKey} = ${authLimit}`);
    console.log(`   OTP limit will use: ${otpKey} = ${otpLimit}`);
    console.log('   Expected: Correct environment-specific values\n');
    
    // 4. Test defaults
    console.log('4. Testing default values when settings are missing...');
    await pool.query(`DELETE FROM platform_settings WHERE key IN ('auth_rate_limit_local', 'otp_rate_limit_local', 'auth_rate_limit_production', 'otp_rate_limit_production')`);
    clearSettingsCache();
    
    const defaultAuthLocal = await getPlatformSetting('auth_rate_limit_local', '100');
    const defaultOtpLocal = await getPlatformSetting('otp_rate_limit_local', '50');
    const defaultAuthProduction = await getPlatformSetting('auth_rate_limit_production', '20');
    const defaultOtpProduction = await getPlatformSetting('otp_rate_limit_production', '10');
    
    console.log(`   Default auth_rate_limit_local: ${defaultAuthLocal}`);
    console.log(`   Default otp_rate_limit_local: ${defaultOtpLocal}`);
    console.log(`   Default auth_rate_limit_production: ${defaultAuthProduction}`);
    console.log(`   Default otp_rate_limit_production: ${defaultOtpProduction}`);
    console.log('   Expected: Defaults are 100/50 for local, 20/10 for production\n');
    
    // 5. Restore recommended settings
    console.log('5. Restoring recommended settings...');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('auth_rate_limit_local', '100', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_rate_limit_local', '50', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('auth_rate_limit_production', '20', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_rate_limit_production', '10', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    console.log('   ✅ Settings restored\n');
    
    console.log('✅ Environment-aware rate limits test completed.');
    console.log('\nBackend Implementation:');
    console.log('- Updated createAuthRateLimit() to use auth_rate_limit_local/production');
    console.log('- Updated createOtpRateLimit() to use otp_rate_limit_local/production');
    console.log('- Defaults: Local (100/50), Production (20/10)');
    console.log('- Environment detection via NODE_ENV === "development"');
    console.log('\nFrontend Implementation:');
    console.log('- Updated admin.html with separate inputs for local and production');
    console.log('- Updated admin.js renderSecuritySettings() to handle new keys');
    console.log('- Updated filter to skip old rate limit settings');
    console.log('\nUI Changes:');
    console.log('- Badge changed from "Both Environments" to "Environment-Aware"');
    console.log('- Separate inputs for Auth Requests (Local) and Auth Requests (Production)');
    console.log('- Separate inputs for OTP Requests (Local) and OTP Requests (Production)');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testEnvironmentAwareRateLimits();
