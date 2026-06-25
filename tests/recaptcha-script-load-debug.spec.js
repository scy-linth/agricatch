const { test, expect } = require('@playwright/test');

test.describe('reCAPTCHA Script Load Debug', () => {
    test('should verify reCAPTCHA script is loaded', async ({ page }) => {
        // Monitor network requests
        const scriptRequests = [];
        page.on('request', request => {
            if (request.url().includes('recaptcha')) {
                scriptRequests.push({ url: request.url(), method: request.method() });
                console.log('reCAPTCHA request:', request.url());
            }
        });

        page.on('response', response => {
            if (response.url().includes('recaptcha')) {
                console.log('reCAPTCHA response:', response.url(), response.status());
            }
        });

        // Monitor console for script errors
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push({ type: msg.type(), text: msg.text() });
            if (msg.text().includes('recaptcha') || msg.text().includes('script') || msg.type() === 'error') {
                console.log('Console:', msg.type(), msg.text());
            }
        });

        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        
        // Wait a bit more for deferred scripts
        await page.waitForTimeout(3000);
        
        // Check if script tag exists
        const scriptTagExists = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            return scripts.some(s => s.src && s.src.includes('recaptcha'));
        });
        console.log('reCAPTCHA script tag exists:', scriptTagExists);
        
        // Check if grecaptcha is available
        const grecaptchaAvailable = await page.evaluate(() => {
            return typeof window.grecaptcha !== 'undefined';
        });
        console.log('grecaptcha available:', grecaptchaAvailable);
        
        // Check for script errors
        const scriptErrors = consoleMessages.filter(m => 
            m.text.includes('Failed to load') || 
            m.text.includes('net::ERR') ||
            (m.text.includes('recaptcha') && m.type === 'error')
        );
        console.log('Script errors found:', scriptErrors.length);
        scriptErrors.forEach(e => console.log('Error:', e.text));
        
        console.log('Total reCAPTCHA requests:', scriptRequests.length);
    });

    test('should verify callback function is defined', async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Check if callback exists
        const callbackExists = await page.evaluate(() => {
            return typeof window.agriCatchRecaptchaOnLoad === 'function';
        });
        console.log('agriCatchRecaptchaOnLoad callback exists:', callbackExists);
        
        // Check if callback was called
        const callbackCalled = await page.evaluate(() => {
            return window.agriCatchRecaptchaOnLoadCalled || false;
        });
        console.log('Callback was called:', callbackCalled);
    });

    test('should check for CSP or network blocking', async ({ page }) => {
        // Monitor all failed requests
        const failedRequests = [];
        page.on('requestfailed', request => {
            failedRequests.push({ url: request.url(), failure: request.failure() });
            console.log('Failed request:', request.url(), request.failure());
        });

        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        console.log('Total failed requests:', failedRequests.length);
        const recaptchaFailures = failedRequests.filter(r => r.url.includes('recaptcha'));
        console.log('reCAPTCHA failures:', recaptchaFailures.length);
    });
});
