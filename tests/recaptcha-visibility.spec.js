const { test, expect } = require('@playwright/test');

test.describe('reCAPTCHA Visibility Debug', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
    });

    test('should show reCAPTCHA when auth modal opens', async ({ page }) => {
        // Open auth modal
        await page.click('#login-btn');
        
        // Wait for modal to be visible
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        
        // Check if modal is open
        const modal = page.locator('#auth-modal');
        await expect(modal).toHaveClass(/open/);
        
        // Wait a bit for reCAPTCHA to render
        await page.waitForTimeout(2000);
        
        // Check reCAPTCHA container
        const recaptchaContainer = page.locator('#auth-recaptcha-login');
        console.log('reCAPTCHA container visible:', await recaptchaContainer.isVisible());
        console.log('reCAPTCHA container HTML:', await recaptchaContainer.innerHTML());
        
        // Check for iframe
        const recaptchaIframe = page.locator('iframe[src*="recaptcha"]').first();
        console.log('reCAPTCHA iframe count:', await page.locator('iframe[src*="recaptcha"]').count());
        console.log('reCAPTCHA iframe visible:', await recaptchaIframe.isVisible());
        
        // Check if grecaptcha is loaded
        const grecaptchaLoaded = await page.evaluate(() => {
            return typeof window.grecaptcha !== 'undefined';
        });
        console.log('grecaptcha loaded:', grecaptchaLoaded);
        
        // Check widget IDs
        const widgetIds = await page.evaluate(() => {
            return window.agriCatchApp?.recaptchaWidgetIds;
        });
        console.log('Widget IDs:', widgetIds);
        
        // Take screenshot
        await page.screenshot({ path: 'test-results/recaptcha-modal-open.png', fullPage: false });
    });

    test('should render reCAPTCHA when switching to register mode', async ({ page }) => {
        // Open auth modal in login mode
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        
        // Wait for reCAPTCHA
        await page.waitForTimeout(2000);
        
        // Switch to register mode
        await page.click('#switch-to-register');
        await page.waitForTimeout(1000);
        
        // Check register reCAPTCHA
        const recaptchaContainer = page.locator('#auth-recaptcha');
        console.log('Register reCAPTCHA container visible:', await recaptchaContainer.isVisible());
        console.log('Register reCAPTCHA container HTML:', await recaptchaContainer.innerHTML());
        
        // Take screenshot
        await page.screenshot({ path: 'test-results/recaptcha-register-mode.png', fullPage: false });
    });

    test('should render reCAPTCHA after clicking login button', async ({ page }) => {
        // Open auth modal
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        
        // Fill in email and password
        await page.fill('#auth-email', 'test@example.com');
        await page.fill('#auth-password', 'password123');
        
        // Click login button
        await page.click('#auth-submit-btn');
        
        // Wait for reCAPTCHA to potentially render
        await page.waitForTimeout(2000);
        
        // Check reCAPTCHA
        const recaptchaContainer = page.locator('#auth-recaptcha-login');
        console.log('After login click - reCAPTCHA container visible:', await recaptchaContainer.isVisible());
        console.log('After login click - reCAPTCHA container HTML:', await recaptchaContainer.innerHTML());
        
        // Check iframe count
        const iframeCount = await page.locator('iframe[src*="recaptcha"]').count();
        console.log('After login click - iframe count:', iframeCount);
        
        // Take screenshot
        await page.screenshot({ path: 'test-results/recaptcha-after-login-click.png', fullPage: false });
    });
});
