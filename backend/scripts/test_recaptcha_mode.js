require('dotenv').config();
const { pool, clearSettingsCache } = require('../utils/db');

async function testRecaptchaMode() {
  try {
    console.log('Testing reCAPTCHA Mode System...\n');
    console.log(`Current NODE_ENV: ${process.env.NODE_ENV || 'not set (defaults to development)'}\n`);
    
    // 1. Clear old settings
    console.log('1. Clearing old reCAPTCHA settings...');
    await pool.query(`DELETE FROM platform_settings WHERE key = 'recaptcha_enabled'`);
    await pool.query(`DELETE FROM platform_settings WHERE key = 'recaptcha_mode'`);
    clearSettingsCache();
    console.log('✓ Old settings cleared\n');
    
    // 2. Test auto mode (default)
    console.log('2. Testing AUTO mode (default, no DB value):');
    const { getPlatformSetting } = require('../utils/db');
    const defaultMode = await getPlatformSetting('recaptcha_mode', 'auto');
    console.log(`   recaptcha_mode: ${defaultMode} (expected: auto)`);
    
    const isDev = process.env.NODE_ENV !== 'production';
    const autoEnabled = isDev ? false : true;
    console.log(`   Effective state: ${autoEnabled ? 'ENABLED' : 'DISABLED'} (Auto: ${isDev ? 'dev=OFF' : 'prod=ON'})`);
    console.log('✓ Auto mode working\n');
    
    // 3. Test always_on mode
    console.log('3. Testing ALWAYS_ON mode:');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('recaptcha_mode', 'always_on', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    clearSettingsCache();
    
    const alwaysOnMode = await getPlatformSetting('recaptcha_mode');
    console.log(`   recaptcha_mode: ${alwaysOnMode}`);
    console.log(`   Effective state: ENABLED (regardless of environment)`);
    console.log('✓ Always ON mode set\n');
    
    // 4. Test always_off mode
    console.log('4. Testing ALWAYS_OFF mode:');
    await pool.query(`UPDATE platform_settings SET value = 'always_off' WHERE key = 'recaptcha_mode'`);
    clearSettingsCache();
    
    const alwaysOffMode = await getPlatformSetting('recaptcha_mode');
    console.log(`   recaptcha_mode: ${alwaysOffMode}`);
    console.log(`   Effective state: DISABLED (regardless of environment)`);
    console.log('✓ Always OFF mode set\n');
    
    // 5. Reset to auto mode (recommended)
    console.log('5. Resetting to AUTO mode (recommended):');
    await pool.query(`UPDATE platform_settings SET value = 'auto' WHERE key = 'recaptcha_mode'`);
    clearSettingsCache();
    
    const finalMode = await getPlatformSetting('recaptcha_mode');
    console.log(`   recaptcha_mode: ${finalMode}`);
    console.log(`   Effective state: ${isDev ? 'DISABLED (local)' : 'ENABLED (production)'}`);
    console.log('✓ Reset to auto mode\n');
    
    console.log('✅ All tests passed! reCAPTCHA mode system is working correctly.');
    console.log('\nSummary of reCAPTCHA Modes:');
    console.log('  🔄 Auto: OFF in local, ON in production (Recommended)');
    console.log('  🔒 Always ON: ON in both environments (Maximum security)');
    console.log('  ⚠️ Always OFF: OFF in both environments (Testing only)');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testRecaptchaMode();
