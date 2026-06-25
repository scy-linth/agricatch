const { test, expect } = require('@playwright/test');

test.describe('Header Layout Shift Debug', () => {
    test('should not shift when profile loads', async ({ page }) => {
        await page.goto('http://localhost:3000');
        
        // Wait for initial page load
        await page.waitForLoadState('networkidle');
        
        // Get header actions container position before profile loads
        const headerActions = page.locator('.header-actions');
        const initialBox = await headerActions.boundingBox();
        console.log('Initial header-actions box:', initialBox);
        
        // Get user-menu position (login/register buttons)
        const userMenu = page.locator('#user-menu');
        const userMenuBox = await userMenu.boundingBox();
        console.log('Initial user-menu box:', userMenuBox);
        
        // Wait for profile to load (simulate logged-in state)
        // For this test, we'll check if there's a shift when switching states
        await page.waitForTimeout(2000);
        
        // Check if user-profile is now visible
        const userProfile = page.locator('#user-profile');
        const isProfileVisible = await userProfile.isVisible();
        console.log('User profile visible:', isProfileVisible);
        
        if (isProfileVisible) {
            const userProfileBox = await userProfile.boundingBox();
            console.log('User profile box:', userProfileBox);
            
            // Get header actions position after profile loads
            const finalBox = await headerActions.boundingBox();
            console.log('Final header-actions box:', finalBox);
            
            // Check for layout shift
            const xShift = Math.abs(finalBox.x - initialBox.x);
            const yShift = Math.abs(finalBox.y - initialBox.y);
            const widthShift = Math.abs(finalBox.width - initialBox.width);
            
            console.log('X shift:', xShift);
            console.log('Y shift:', yShift);
            console.log('Width shift:', widthShift);
            
            // Allow small tolerance for rendering differences
            expect(xShift).toBeLessThan(2);
            expect(yShift).toBeLessThan(2);
            expect(widthShift).toBeLessThan(2);
        } else {
            console.log('Profile not loaded - user is in guest state');
        }
    });
    
    test('measure width difference between user-menu and user-profile', async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        
        // Measure user-menu width
        const userMenu = page.locator('#user-menu');
        const userMenuBox = await userMenu.boundingBox();
        console.log('User-menu width:', userMenuBox?.width);
        
        // Temporarily make user-profile visible to measure its width
        const userProfile = page.locator('#user-profile');
        await page.evaluate(() => {
            const profile = document.getElementById('user-profile');
            if (profile) {
                profile.style.visibility = 'visible';
                profile.style.opacity = '0';
            }
        });
        
        const userProfileBox = await userProfile.boundingBox();
        console.log('User-profile width (temporarily visible):', userProfileBox?.width);
        
        // Hide it again
        await page.evaluate(() => {
            const profile = document.getElementById('user-profile');
            if (profile) {
                profile.style.visibility = 'hidden';
                profile.style.opacity = '';
            }
        });
        
        if (userMenuBox && userProfileBox) {
            const widthDiff = Math.abs(userMenuBox.width - userProfileBox.width);
            console.log('Width difference:', widthDiff);
            
            // If width difference is significant, this causes layout shift
            if (widthDiff > 10) {
                console.log('SIGNIFICANT WIDTH DIFFERENCE DETECTED - This causes layout shift');
            } else {
                console.log('Width difference is acceptable - layout shift should be minimal');
            }
        }
    });
    
    test('visual regression - capture header before and after profile load', async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        
        // Capture header before profile
        const header = page.locator('header');
        await header.screenshot({ path: 'test-results/header-before-profile.png' });
        
        // Wait and capture again
        await page.waitForTimeout(3000);
        await header.screenshot({ path: 'test-results/header-after-profile.png' });
    });
});
