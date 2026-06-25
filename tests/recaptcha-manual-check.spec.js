const { test, expect } = require('@playwright/test');

test('Manual reCAPTCHA verification - check if challenge can appear', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Open auth modal
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Check reCAPTCHA state
    const widgetState = await page.evaluate(() => {
        if (!window.grecaptcha || !window.agriCatchApp) return null;
        
        return {
            widgetIds: window.agriCatchApp.recaptchaWidgetIds,
            grecaptchaReady: typeof window.grecaptcha.ready === 'function',
            grecaptchaRender: typeof window.grecaptcha.render === 'function',
            grecaptchaGetResponse: typeof window.grecaptcha.getResponse === 'function',
            grecaptchaReset: typeof window.grecaptcha.reset === 'function'
        };
    });
    console.log('Widget state:', widgetState);

    // Check iframes
    const anchorIframe = page.locator('iframe[src*="recaptcha/api2/anchor"]').first();
    const challengeIframe = page.locator('iframe[src*="recaptcha/api2/bframe"]').first();
    
    const anchorVisible = await anchorIframe.isVisible();
    const challengeVisible = await challengeIframe.isVisible();
    
    console.log('Anchor iframe visible:', anchorVisible);
    console.log('Challenge iframe visible:', challengeVisible);
    
    // Check challenge iframe CSS
    const challengeCss = await challengeIframe.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            position: style.position,
            zIndex: style.zIndex
        };
    });
    console.log('Challenge iframe CSS:', challengeCss);

    // Take screenshot for manual verification
    await page.screenshot({ path: 'test-results/recaptcha-manual-check.png', fullPage: false });
    
    console.log('\n=== MANUAL VERIFICATION NEEDED ===');
    console.log('Please open test-results/recaptcha-manual-check.png');
    console.log('Then manually test in browser:');
    console.log('1. Go to http://localhost:3000');
    console.log('2. Click Login button');
    console.log('3. Click the reCAPTCHA "I\'m not a robot" checkbox');
    console.log('4. Check if the challenge popup appears');
    console.log('\nExpected behavior:');
    console.log('- Challenge iframe should become visible when checkbox is clicked');
    console.log('- Challenge should appear as a popup overlay');
    console.log('- Challenge should be above the auth modal (z-index: 100006)');
});
