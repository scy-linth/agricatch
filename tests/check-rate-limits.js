require('dotenv').config();
const { pool, clearSettingsCache } = require('../backend/utils/db');

async function checkRateLimitSettings() {
    try {
        console.log('Checking Rate Limit Settings in Platform Settings...\n');
        
        const { getPlatformSetting } = require('../backend/utils/db');
        
        const isDev = process.env.NODE_ENV !== 'production';
        console.log(`Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}\n`);
        
        const authLocal = await getPlatformSetting('auth_rate_limit_local', '100');
        const authProd = await getPlatformSetting('auth_rate_limit_production', '20');
        const otpLocal = await getPlatformSetting('otp_rate_limit_local', '50');
        const otpProd = await getPlatformSetting('otp_rate_limit_production', '10');
        
        console.log('Platform Settings:');
        console.log(`  auth_rate_limit_local: ${authLocal}`);
        console.log(`  auth_rate_limit_production: ${authProd}`);
        console.log(`  otp_rate_limit_local: ${otpLocal}`);
        console.log(`  otp_rate_limit_production: ${otpProd}`);
        
        console.log('\nEffective Limits (based on current environment):');
        console.log(`  Auth Rate Limit: ${isDev ? authLocal : authProd} per 15 minutes`);
        console.log(`  OTP Rate Limit: ${isDev ? otpLocal : otpProd} per 15 minutes`);
        
        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        await pool.end();
    }
}

checkRateLimitSettings();
