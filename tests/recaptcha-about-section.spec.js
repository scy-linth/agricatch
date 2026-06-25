const { test, expect } = require('@playwright/test');

test('reCAPTCHA challenge when opening login from About section', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Navigate to About section
    await page.click('a[href="#about"]');
    await page.waitForTimeout(1000);
    
    console.log('Current URL:', page.url());
    console.log('Current hash:', await page.evaluate(() => window.location.hash));

    // Open auth modal from About section
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Check reCAPTCHA state
    const widgetState = await page.evaluate(() => {
        if (!window.grecaptcha || !window.agriCatchApp) return null;
        
        return {
            widgetIds: window.agriCatchApp.recaptchaWidgetIds,
            grecaptchaReady: typeof window.grecaptcha.ready === 'function'
        };
    });
    console.log('Widget state:', widgetState);

    // Check iframes
    const anchorIframe = page.locator('iframe[src*="recaptcha/api2/anchor"]').first();
    const challengeIframe = page.locator('iframe[src*="recaptcha/api2/bframe"]').first();
    
    const anchorCount = await page.locator('iframe[src*="recaptcha/api2/anchor"]').count();
    const challengeCount = await page.locator('iframe[src*="recaptcha/api2/bframe"]').count();
    
    console.log('Anchor iframe count:', anchorCount);
    console.log('Challenge iframe count:', challengeCount);
    
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
            zIndex: style.zIndex,
            top: style.top,
            left: style.left,
            width: style.width,
            height: style.height
        };
    });
    console.log('Challenge iframe CSS:', challengeCss);

    // Check modal z-index
    const modalCss = await page.evaluate(() => {
        const modal = document.getElementById('auth-modal');
        const modalContent = document.querySelector('#auth-modal .modal-content');
        return {
            modalZIndex: window.getComputedStyle(modal).zIndex,
            modalContentZIndex: window.getComputedStyle(modalContent).zIndex
        };
    });
    console.log('Modal z-index:', modalCss);

    // Check if modal is properly positioned
    const modalRect = await page.evaluate(() => {
        const modal = document.getElementById('auth-modal');
        const rect = modal.getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
        };
    });
    console.log('Modal rect:', modalRect);

    // Take screenshot
    await page.screenshot({ path: 'test-results/recaptcha-about-section.png', fullPage: false });
    
    console.log('\n=== RESULTS ===');
    console.log('If challenge iframe is hidden or has wrong position, the issue is confirmed');
    console.log('Expected: Challenge iframe should have position: fixed, z-index: 100006');
    console.log('Expected: Challenge iframe should be able to become visible when checkbox is clicked');
});

test('reCAPTCHA challenge when opening login from Home section (baseline)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Stay on Home section (default)
    await page.waitForTimeout(1000);
    
    console.log('Current URL:', page.url());
    console.log('Current hash:', await page.evaluate(() => window.location.hash));

    // Open auth modal from Home section
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Check reCAPTCHA state
    const widgetState = await page.evaluate(() => {
        if (!window.grecaptcha || !window.agriCatchApp) return null;
        
        return {
            widgetIds: window.agriCatchApp.recaptchaWidgetIds,
            grecaptchaReady: typeof window.grecaptcha.ready === 'function'
        };
    });
    console.log('Widget state:', widgetState);

    // Check iframes
    const anchorIframe = page.locator('iframe[src*="recaptcha/api2/anchor"]').first();
    const challengeIframe = page.locator('iframe[src*="recaptcha/api2/bframe"]').first();
    
    const anchorCount = await page.locator('iframe[src*="recaptcha/api2/anchor"]').count();
    const challengeCount = await page.locator('iframe[src*="recaptcha/api2/bframe"]').count();
    
    console.log('Anchor iframe count:', anchorCount);
    console.log('Challenge iframe count:', challengeCount);
    
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
            zIndex: style.zIndex,
            top: style.top,
            left: style.left,
            width: style.width,
            height: style.height
        };
    });
    console.log('Challenge iframe CSS:', challengeCss);

    // Take screenshot
    await page.screenshot({ path: 'test-results/recaptcha-home-section.png', fullPage: false });
});
