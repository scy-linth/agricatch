const { test, expect } = require('@playwright/test');

test.describe('reCAPTCHA Widget ID Debug', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
    });

    test('should verify widget IDs are stored after rendering', async ({ page }) => {
        // Open auth modal
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        
        // Wait for reCAPTCHA to potentially render
        await page.waitForTimeout(3000);
        
        // Check widget IDs
        const widgetIds = await page.evaluate(() => {
            return window.agriCatchApp?.recaptchaWidgetIds;
        });
        console.log('Widget IDs after modal open:', widgetIds);
        
        // Check if grecaptcha is loaded
        const grecaptchaLoaded = await page.evaluate(() => {
            return typeof window.grecaptcha !== 'undefined';
        });
        console.log('grecaptcha loaded:', grecaptchaLoaded);
        
        // Check if render function exists
        const renderExists = await page.evaluate(() => {
            return window.grecaptcha && typeof window.grecaptcha.render === 'function';
        });
        console.log('grecaptcha.render exists:', renderExists);
        
        // Try to manually trigger render
        await page.evaluate(() => {
            if (window.agriCatchApp && typeof window.agriCatchApp.renderRecaptchaWidgets === 'function') {
                console.log('Calling renderRecaptchaWidgets manually');
                window.agriCatchApp.renderRecaptchaWidgets();
            }
        });
        
        await page.waitForTimeout(2000);
        
        // Check widget IDs again
        const widgetIdsAfter = await page.evaluate(() => {
            return window.agriCatchApp?.recaptchaWidgetIds;
        });
        console.log('Widget IDs after manual render:', widgetIdsAfter);
        
        // Check container HTML
        const loginContainer = page.locator('#auth-recaptcha-login');
        const containerHtml = await loginContainer.innerHTML();
        console.log('Login container HTML:', containerHtml);
        console.log('Login container has children:', containerHtml.length > 0);
    });

    test('should verify getRecaptchaResponse returns valid token', async ({ page }) => {
        // Open auth modal
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        
        // Wait for reCAPTCHA
        await page.waitForTimeout(3000);
        
        // Try to get response
        const response = await page.evaluate(() => {
            if (window.agriCatchApp && typeof window.agriCatchApp.getRecaptchaResponse === 'function') {
                return window.agriCatchApp.getRecaptchaResponse('auth');
            }
            return null;
        });
        console.log('getRecaptchaResponse result:', response);
        console.log('Response length:', response?.length || 0);
        
        // Check widget ID used
        const widgetId = await page.evaluate(() => {
            const scope = window.agriCatchApp?.resolveRecaptchaScope('auth');
            return window.agriCatchApp?.recaptchaWidgetIds?.[scope];
        });
        console.log('Widget ID used:', widgetId);
    });

    test('should verify grecaptcha.render is called successfully', async ({ page }) => {
        // Open auth modal
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        
        // Monitor console for render errors
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push({ type: msg.type(), text: msg.text() });
            if (msg.text().includes('recaptcha') || msg.text().includes('render')) {
                console.log('Console:', msg.type(), msg.text());
            }
        });
        
        // Wait for reCAPTCHA
        await page.waitForTimeout(3000);
        
        // Check for render errors
        const renderErrors = consoleMessages.filter(m => 
            m.text.includes('Failed to render') || 
            m.text.includes('recaptcha') && m.type === 'error'
        );
        console.log('Render errors found:', renderErrors.length);
        renderErrors.forEach(e => console.log('Error:', e.text));
    });
});
