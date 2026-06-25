const { test, expect } = require('@playwright/test');

test.describe('reCAPTCHA Challenge Debug', () => {
    test('should show challenge when clicking I am not a robot', async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Open auth modal
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });

        // Wait for reCAPTCHA to render
        await page.waitForTimeout(2000);

        // Check reCAPTCHA container
        const recaptchaContainer = page.locator('#auth-recaptcha-login');
        console.log('reCAPTCHA container visible:', await recaptchaContainer.isVisible());
        console.log('reCAPTCHA container HTML:', await recaptchaContainer.innerHTML());

        // Check for iframe
        const recaptchaIframes = page.locator('iframe[src*="recaptcha"]');
        const iframeCount = await recaptchaIframes.count();
        console.log('reCAPTCHA iframe count:', iframeCount);

        if (iframeCount === 0) {
            console.log('ERROR: No reCAPTCHA iframe found!');
            await page.screenshot({ path: 'test-results/recaptcha-no-iframe.png', fullPage: false });
            return;
        }

        // Get the first iframe
        const firstIframe = recaptchaIframes.first();
        console.log('First iframe visible:', await firstIframe.isVisible());
        console.log('First iframe src:', await firstIframe.getAttribute('src'));

        // Take screenshot before clicking
        await page.screenshot({ path: 'test-results/recaptcha-before-click.png', fullPage: false });

        // Listen for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
                console.log('Console error:', msg.text());
            }
        });

        // Try to click the reCAPTCHA checkbox
        try {
            // Switch to iframe context
            const frame = await firstIframe.contentFrame();
            
            if (!frame) {
                console.log('ERROR: Could not access iframe content frame');
                await page.screenshot({ path: 'test-results/recaptcha-no-frame-access.png', fullPage: false });
                return;
            }

            // Wait for checkbox to be visible in iframe
            await frame.waitForTimeout(1000);
            
            // Check for checkbox element
            const checkbox = frame.locator('.recaptcha-checkbox');
            const checkboxExists = await checkbox.count() > 0;
            console.log('Checkbox exists in iframe:', checkboxExists);

            if (checkboxExists) {
                console.log('Checkbox visible:', await checkbox.isVisible());
                
                // Click the checkbox
                await checkbox.click();
                console.log('Clicked checkbox');
                
                // Wait for challenge to appear
                await page.waitForTimeout(3000);
                
                // Take screenshot after clicking
                await page.screenshot({ path: 'test-results/recaptcha-after-click.png', fullPage: false });
                
                // Check if challenge appeared
                const challengeVisible = await page.locator('iframe[src*="recaptcha"]').count() > 1;
                console.log('Challenge iframe appeared:', challengeVisible);
                
                // Check for any challenge modal
                const challengeModal = page.locator('.rc-challenge-wrapper');
                console.log('Challenge modal visible:', await challengeModal.isVisible());
                
            } else {
                console.log('ERROR: Checkbox not found in iframe');
                console.log('Iframe HTML:', await frame.content());
            }
        } catch (error) {
            console.log('Error clicking reCAPTCHA:', error.message);
        }

        // Check for any JavaScript errors
        console.log('Console errors:', consoleErrors);

        // Check reCAPTCHA widget state
        const widgetState = await page.evaluate(() => {
            if (window.grecaptcha && window.agriCatchApp) {
                return {
                    widgetIds: window.agriCatchApp.recaptchaWidgetIds,
                    response: window.grecaptcha.getResponse(),
                    ready: typeof window.grecaptcha.ready === 'function'
                };
            }
            return null;
        });
        console.log('Widget state:', widgetState);

        // Check CSS that might hide the challenge
        const cssCheck = await page.evaluate(() => {
            const recaptcha = document.getElementById('auth-recaptcha-login');
            if (!recaptcha) return null;
            
            const computed = window.getComputedStyle(recaptcha);
            return {
                display: computed.display,
                visibility: computed.visibility,
                opacity: computed.opacity,
                zIndex: computed.zIndex,
                position: computed.position
            };
        });
        console.log('reCAPTCHA CSS:', cssCheck);
    });

    test('should check reCAPTCHA script loading and initialization', async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Check if reCAPTCHA script is loaded
        const scriptLoaded = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src*="recaptcha"]'));
            return scripts.map(s => s.src);
        });
        console.log('reCAPTCHA scripts:', scriptLoaded);

        // Check grecaptcha object
        const grecaptchaCheck = await page.evaluate(() => {
            return {
                exists: typeof window.grecaptcha !== 'undefined',
                hasRender: typeof window.grecaptcha?.render === 'function',
                hasGetResponse: typeof window.grecaptcha?.getResponse === 'function',
                hasReset: typeof window.grecaptcha?.reset === 'function',
                hasReady: typeof window.grecaptcha?.ready === 'function'
            };
        });
        console.log('grecaptcha methods:', grecaptchaCheck);

        // Open auth modal
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        await page.waitForTimeout(2000);

        // Check widget rendering
        const widgetInfo = await page.evaluate(() => {
            if (!window.grecaptcha || !window.agriCatchApp) return null;
            
            const widgetIds = window.agriCatchApp.recaptchaWidgetIds;
            const info = {};
            
            for (const [scope, widgetId] of Object.entries(widgetIds)) {
                if (widgetId !== null) {
                    try {
                        const response = window.grecaptcha.getResponse(widgetId);
                        info[scope] = {
                            widgetId,
                            hasResponse: response && response.length > 0,
                            responseLength: response?.length || 0
                        };
                    } catch (e) {
                        info[scope] = { widgetId, error: e.message };
                    }
                } else {
                    info[scope] = { widgetId: null };
                }
            }
            
            return info;
        });
        console.log('Widget info:', widgetInfo);
    });

    test('should check if challenge is hidden by CSS', async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Open auth modal
        await page.click('#login-btn');
        await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
        await page.waitForTimeout(2000);

        // Check all iframes that might be reCAPTCHA
        const allIframes = await page.locator('iframe').all();
        console.log('Total iframes:', allIframes.length);

        for (let i = 0; i < allIframes.length; i++) {
            const iframe = allIframes[i];
            const src = await iframe.getAttribute('src');
            const visible = await iframe.isVisible();
            const computedStyle = await iframe.evaluate(el => {
                const style = window.getComputedStyle(el);
                return {
                    display: style.display,
                    visibility: style.visibility,
                    opacity: style.opacity,
                    zIndex: style.zIndex,
                    position: style.position,
                    width: style.width,
                    height: style.height
                };
            });
            
            console.log(`Iframe ${i}:`, {
                src: src?.substring(0, 50),
                visible,
                style: computedStyle
            });
        }

        // Check for any elements that might overlay the reCAPTCHA
        const overlayCheck = await page.evaluate(() => {
            const recaptcha = document.getElementById('auth-recaptcha-login');
            if (!recaptcha) return null;
            
            const rect = recaptcha.getBoundingClientRect();
            const elementsAtPoint = document.elementsFromPoint(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
            );
            
            return {
                recaptchaRect: rect,
                elementsAtPoint: elementsAtPoint.map(el => ({
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    zIndex: window.getComputedStyle(el).zIndex
                }))
            };
        });
        console.log('Overlay check:', overlayCheck);

        await page.screenshot({ path: 'test-results/recaptcha-overlay-check.png', fullPage: false });
    });
});
