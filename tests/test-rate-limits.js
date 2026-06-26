require('dotenv').config();

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function setProductionRateLimits() {
    const { pool } = require('../backend/utils/db');
    try {
        await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('auth_rate_limit_local', '20', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
        await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_rate_limit_local', '10', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
        const { clearSettingsCache } = require('../backend/utils/db');
        clearSettingsCache();
        console.log('✅ Set production rate limits for testing\n');
    } catch (error) {
        console.error('Failed to set production limits:', error.message);
    }
}

async function resetDevelopmentRateLimits() {
    const { pool } = require('../backend/utils/db');
    try {
        await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('auth_rate_limit_local', '100', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
        await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('otp_rate_limit_local', '50', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
        const { clearSettingsCache } = require('../backend/utils/db');
        clearSettingsCache();
        console.log('✅ Reset development rate limits\n');
    } catch (error) {
        console.error('Failed to reset limits:', error.message);
    }
}

async function testLoginRateLimit() {
    console.log('\n=== Testing Login Rate Limit (20 attempts per 15 minutes) ===\n');
    
    let successCount = 0;
    let rateLimited = false;
    
    for (let i = 1; i <= 25; i++) {
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                })
            });
            
            const data = await response.json();
            
            if (response.status === 429) {
                console.log(`Attempt ${i}: ❌ Rate limited - ${data.error || data.message}`);
                rateLimited = true;
                break;
            } else {
                console.log(`Attempt ${i}: ✅ Status ${response.status} - ${data.message || 'Login failed (expected)'}`);
                successCount++;
            }
        } catch (error) {
            console.log(`Attempt ${i}: ❌ Error - ${error.message}`);
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\nResult: ${successCount} successful attempts before rate limit`);
    console.log(`Rate limit active: ${rateLimited ? '✅ YES' : '❌ NO'}`);
}

async function testOtpRateLimit() {
    console.log('\n=== Testing OTP Rate Limit (10 attempts per 15 minutes) ===\n');
    
    let successCount = 0;
    let rateLimited = false;
    
    for (let i = 1; i <= 15; i++) {
        try {
            const response = await fetch(`${API_BASE}/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'test@example.com',
                    purpose: 'register'
                })
            });
            
            const data = await response.json();
            
            if (response.status === 429) {
                console.log(`Attempt ${i}: ❌ Rate limited - ${data.error || data.message}`);
                rateLimited = true;
                break;
            } else {
                console.log(`Attempt ${i}: ✅ Status ${response.status} - ${data.message || 'OTP sent'}`);
                successCount++;
            }
        } catch (error) {
            console.log(`Attempt ${i}: ❌ Error - ${error.message}`);
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\nResult: ${successCount} successful attempts before rate limit`);
    console.log(`Rate limit active: ${rateLimited ? '✅ YES' : '❌ NO'}`);
}

async function testForgotPasswordRateLimit() {
    console.log('\n=== Testing Forgot Password Rate Limit ===\n');
    
    let successCount = 0;
    let rateLimited = false;
    
    for (let i = 1; i <= 15; i++) {
        try {
            const response = await fetch(`${API_BASE}/auth/forgot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'test@example.com'
                })
            });
            
            const data = await response.json();
            
            if (response.status === 429) {
                console.log(`Attempt ${i}: ❌ Rate limited - ${data.error || data.message}`);
                rateLimited = true;
                break;
            } else {
                console.log(`Attempt ${i}: ✅ Status ${response.status} - ${data.message || 'Code sent'}`);
                successCount++;
            }
        } catch (error) {
            console.log(`Attempt ${i}: ❌ Error - ${error.message}`);
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\nResult: ${successCount} successful attempts before rate limit`);
    console.log(`Rate limit active: ${rateLimited ? '✅ YES' : '❌ NO'}`);
}

async function runTests() {
    console.log('🧪 Rate Limiting Tests');
    console.log(`API Base: ${API_BASE}\n`);
    
    // Set production limits for testing
    await setProductionRateLimits();
    
    await testLoginRateLimit();
    await testOtpRateLimit();
    await testForgotPasswordRateLimit();
    
    // Reset to development limits
    await resetDevelopmentRateLimits();
    
    console.log('\n✅ All rate limit tests completed!\n');
}

runTests().catch(console.error);
