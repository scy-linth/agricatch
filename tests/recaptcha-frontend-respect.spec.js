const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

test.describe('reCAPTCHA Frontend Respect Test', () => {
  test('RECAPTCHA-FRONTEND-001: Verify frontend fetches and respects recaptcha_mode', async ({ page }) => {
    console.log('\n=== TEST: Frontend fetches and respects recaptcha_mode ===');
    
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    // Wait for app to initialize and fetch settings
    await page.waitForTimeout(3000);
    
    // Check if recaptcha_mode is fetched correctly
    const recaptchaMode = await page.evaluate(() => {
      return window.app?.recaptchaMode || 'not loaded';
    });
    console.log('Frontend recaptcha_mode:', recaptchaMode);
    
    // Check if shouldRequireRecaptcha works
    const shouldRequire = await page.evaluate(() => {
      return window.app?.shouldRequireRecaptcha();
    });
    console.log('shouldRequireRecaptcha():', shouldRequire);
    
    await page.screenshot({ path: 'tests/screenshots/recaptcha-frontend-fetch.png', fullPage: true });
    
    // Should have fetched the setting
    expect(recaptchaMode).not.toBe('not loaded');
  });

  test('RECAPTCHA-FRONTEND-002: Verify shouldRequireRecaptcha logic', async ({ page }) => {
    console.log('\n=== TEST: shouldRequireRecaptcha logic ===');
    
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Test different scenarios by manipulating the recaptchaMode
    const testAlwaysOff = await page.evaluate(() => {
      window.app.recaptchaMode = 'always_off';
      return window.app.shouldRequireRecaptcha();
    });
    console.log('always_off -> shouldRequire:', testAlwaysOff);
    expect(testAlwaysOff).toBe(false);
    
    const testAlwaysOn = await page.evaluate(() => {
      window.app.recaptchaMode = 'always_on';
      return window.app.shouldRequireRecaptcha();
    });
    console.log('always_on -> shouldRequire:', testAlwaysOn);
    expect(testAlwaysOn).toBe(true);
    
    const testAutoLocalhost = await page.evaluate(() => {
      window.app.recaptchaMode = 'auto';
      return window.app.shouldRequireRecaptcha();
    });
    console.log('auto (localhost) -> shouldRequire:', testAutoLocalhost);
    expect(testAutoLocalhost).toBe(false); // localhost should be false in auto mode
  });
});
