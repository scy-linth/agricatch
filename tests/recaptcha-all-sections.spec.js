const { test, expect } = require('@playwright/test');

test.describe('reCAPTCHA challenge positioning across all sections', () => {
    const sections = [
        { name: 'Home', selector: 'a[href="#home"]', hash: '#home' },
        { name: 'Featured', selector: 'a[href="#featured"]', hash: '#featured' },
        { name: 'Products', selector: 'a[href="#products"]', hash: '#products' },
        { name: 'About', selector: 'a[href="#about"]', hash: '#about' },
        { name: 'Contact', selector: 'a[href="#contact"]', hash: '#contact' }
    ];

    sections.forEach(({ name, selector, hash }) => {
        test(`reCAPTCHA challenge when opening login from ${name} section`, async ({ page }) => {
            await page.goto('http://localhost:3000');
            await page.waitForLoadState('networkidle');

            // Navigate to section
            if (hash !== '#home') {
                await page.click(selector);
                await page.waitForTimeout(1000);
            }
            
            console.log(`\n=== Testing ${name} section ===`);
            console.log('Current hash:', await page.evaluate(() => window.location.hash));

            // Open auth modal
            await page.click('#login-btn');
            await page.waitForSelector('#auth-modal.open', { timeout: 5000 });
            await page.waitForTimeout(2000);

            // Check challenge iframe positioning
            const challengeIframe = page.locator('iframe[src*="recaptcha/api2/bframe"]').first();
            const challengeCss = await challengeIframe.evaluate(el => {
                const style = window.getComputedStyle(el);
                return {
                    display: style.display,
                    visibility: style.visibility,
                    position: style.position,
                    zIndex: style.zIndex,
                    top: style.top,
                    left: style.left,
                    width: style.width,
                    height: style.height
                };
            });
            
            console.log('Challenge iframe CSS:', challengeCss);
            
            // Verify positioning is centered
            const top = parseFloat(challengeCss.top);
            const left = parseFloat(challengeCss.left);
            const isCentered = top > 0 && top < 1000 && left > 0 && left < 2000;
            
            console.log('Is centered in viewport:', isCentered);
            
            if (!isCentered) {
                console.error(`ERROR: Challenge iframe not centered in ${name} section!`);
                await page.screenshot({ path: `test-results/recaptcha-${name.toLowerCase()}-error.png`, fullPage: false });
            } else {
                console.log(`✓ Challenge iframe correctly positioned in ${name} section`);
            }
            
            expect(isCentered).toBe(true);
        });
    });
});
