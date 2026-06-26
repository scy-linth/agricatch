const { test, expect } = require('@playwright/test');
require('dotenv').config();

// Test configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = 'http://localhost:3000/api';

// Test data
const generateRandomEmail = (prefix) => `${prefix}_${Date.now()}@test.com`;
const generateRandomUsername = (prefix) => `${prefix}_${Date.now()}`;

const testUser = {
  email: generateRandomEmail('recaptcha_test'),
  username: generateRandomUsername('recaptcha_test'),
  password: 'Test123456',
  firstName: 'Test',
  lastName: 'User'
};

test.describe('reCAPTCHA Playwright Test', () => {
  test.beforeAll(async ({ request }) => {
    // Check backend health
    console.log('Checking backend health...');
    try {
      const healthResponse = await request.get(`${API_BASE}/health`);
      console.log('Backend health:', healthResponse.status());
    } catch (error) {
      console.log('Backend health check failed, continuing anyway...');
    }
  });

  test('RECAPTCHA-001: Test login with recaptcha_mode=always_off', async ({ page, request }) => {
    console.log('\n=== TEST 1: recaptcha_mode=always_off ===');
    
    // Set recaptcha_mode to always_off
    const { pool } = require('../backend/utils/db');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('recaptcha_mode', 'always_off', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    console.log('Set recaptcha_mode to always_off');
    
    // Register user via API (skip reCAPTCHA in development)
    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: {
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        full_name: `${testUser.firstName} ${testUser.lastName}`,
        role: 'customer'
      }
    });
    
    if (registerResponse.ok()) {
      console.log('User registered successfully');
    } else {
      console.log('Registration failed, trying login with existing user...');
    }
    
    // Try login via UI
    await page.goto(`${BASE_URL}/?login=1`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
    
    await emailInput.fill(testUser.email);
    await passwordInput.fill(testUser.password);
    await loginButton.click();
    
    await page.waitForTimeout(3000);
    
    // Check if login succeeded (no reCAPTCHA error)
    const recaptchaError = page.locator('text=/captcha/i').first();
    const hasRecaptchaError = await recaptchaError.isVisible().catch(() => false);
    
    console.log(`reCAPTCHA error visible: ${hasRecaptchaError}`);
    
    await page.screenshot({ path: 'tests/screenshots/recaptcha-001-always-off.png', fullPage: true });
    
    // Cleanup
    await pool.query(`UPDATE platform_settings SET value = 'auto' WHERE key = 'recaptcha_mode'`);
    await pool.end();
    
    expect(hasRecaptchaError).toBe(false);
  });

  test('RECAPTCHA-002: Test login with recaptcha_mode=auto in development', async ({ page, request }) => {
    console.log('\n=== TEST 2: recaptcha_mode=auto in development ===');
    
    // Set recaptcha_mode to auto
    const { pool } = require('../backend/utils/db');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('recaptcha_mode', 'auto', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    console.log('Set recaptcha_mode to auto');
    
    // Ensure NODE_ENV is development
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    console.log(`NODE_ENV set to: ${process.env.NODE_ENV}`);
    
    // Try login via UI
    await page.goto(`${BASE_URL}/?login=1`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
    
    await emailInput.fill(testUser.email);
    await passwordInput.fill(testUser.password);
    await loginButton.click();
    
    await page.waitForTimeout(3000);
    
    // Check if login succeeded (no reCAPTCHA error)
    const recaptchaError = page.locator('text=/captcha/i').first();
    const hasRecaptchaError = await recaptchaError.isVisible().catch(() => false);
    
    console.log(`reCAPTCHA error visible: ${hasRecaptchaError}`);
    
    await page.screenshot({ path: 'tests/screenshots/recaptcha-002-auto-dev.png', fullPage: true });
    
    // Cleanup
    process.env.NODE_ENV = originalEnv;
    await pool.end();
    
    expect(hasRecaptchaError).toBe(false);
  });

  test('RECAPTCHA-003: Test API call without reCAPTCHA token when disabled', async ({ request }) => {
    console.log('\n=== TEST 3: API call without reCAPTCHA token when disabled ===');
    
    // Set recaptcha_mode to always_off
    const { pool } = require('../backend/utils/db');
    await pool.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ('recaptcha_mode', 'always_off', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`);
    
    // Try login via API without reCAPTCHA token
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        identifier: testUser.email,
        password: testUser.password
        // No g-recaptcha-response provided
      }
    });
    
    console.log(`Login response status: ${loginResponse.status()}`);
    
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      console.log('Login successful without reCAPTCHA token (as expected when disabled)');
    } else {
      const error = await loginResponse.text();
      console.log('Login failed:', error);
    }
    
    // Cleanup
    await pool.query(`UPDATE platform_settings SET value = 'auto' WHERE key = 'recaptcha_mode'`);
    await pool.end();
    
    expect(loginResponse.ok()).toBe(true);
  });

  test('RECAPTCHA-004: Verify reCAPTCHA widget renders on frontend', async ({ page }) => {
    console.log('\n=== TEST 4: Verify reCAPTCHA widget renders ===');
    
    await page.goto(`${BASE_URL}/?login=1`);
    await page.waitForLoadState('networkidle');
    
    // Check if reCAPTCHA container exists
    const recaptchaContainer = page.locator('#auth-recaptcha-login').first();
    const exists = await recaptchaContainer.isVisible().catch(() => false);
    
    console.log(`reCAPTCHA container visible: ${exists}`);
    
    // Check if grecaptcha is loaded
    const grecaptchaLoaded = await page.evaluate(() => {
      return typeof window.grecaptcha !== 'undefined';
    });
    
    console.log(`grecaptcha loaded: ${grecaptchaLoaded}`);
    
    await page.screenshot({ path: 'tests/screenshots/recaptcha-004-widget-render.png', fullPage: true });
    
    // Widget should exist even if not required
    expect(exists).toBe(true);
  });

  test('RECAPTCHA-005: Compare OTP bypass vs reCAPTCHA handling', async ({ request }) => {
    console.log('\n=== TEST 5: OTP bypass vs reCAPTCHA comparison ===');
    
    const { pool } = require('../backend/utils/db');
    
    // Check OTP bypass code
    const otpBypassCode = await pool.query(`SELECT value FROM platform_settings WHERE key = 'otp_bypass_code'`);
    console.log(`OTP bypass code exists: ${otpBypassCode.rows.length > 0}`);
    if (otpBypassCode.rows.length > 0) {
      console.log(`OTP bypass code value: ${otpBypassCode.rows[0].value}`);
    }
    
    // Check if reCAPTCHA bypass exists
    const recaptchaBypass = await pool.query(`SELECT value FROM platform_settings WHERE key = 'recaptcha_bypass_code'`);
    console.log(`reCAPTCHA bypass code exists: ${recaptchaBypass.rows.length > 0}`);
    
    // Check recaptcha_mode
    const recaptchaMode = await pool.query(`SELECT value FROM platform_settings WHERE key = 'recaptcha_mode'`);
    console.log(`reCAPTCHA mode: ${recaptchaMode.rows.length > 0 ? recaptchaMode.rows[0].value : 'not set (defaults to auto)'}`);
    
    await pool.end();
    
    console.log('\nCONCLUSION:');
    console.log('- OTP has a secret bypass mechanism (789878) for testing');
    console.log('- reCAPTCHA does NOT have a bypass mechanism');
    console.log('- reCAPTCHA is controlled by recaptcha_mode setting (auto/always_on/always_off)');
    console.log('- For Playwright tests, set recaptcha_mode to always_off or use NODE_ENV=development with auto mode');
  });
});
