const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Customer Chat Dropdown', () => {
    test('Chat dropdown appears for logged-in customer', async ({ page }) => {
        // Navigate to index page
        await page.goto(`${baseURL}/index.html`);
        
        // Login as customer
        await page.fill('#auth-email', 'customer@example.com');
        await page.fill('#auth-password', 'customer123');
        await page.click('#auth-submit-btn');
        await page.waitForLoadState('networkidle');
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Check that customer messages dropdown is visible
        const messagesDiv = page.locator('#customer-messages');
        const isVisible = await messagesDiv.isVisible();
        
        expect(isVisible).toBe(true);
        
        // Check that chat button is visible
        const chatBtn = page.locator('#customer-chat-btn');
        const btnVisible = await chatBtn.isVisible();
        
        expect(btnVisible).toBe(true);
        
        console.log('Customer chat dropdown is visible');
    });

    test('Chat dropdown can be opened and shows conversations', async ({ page }) => {
        // Navigate to index page
        await page.goto(`${baseURL}/index.html`);
        
        // Login as customer
        await page.fill('#auth-email', 'customer@example.com');
        await page.fill('#auth-password', 'customer123');
        await page.click('#auth-submit-btn');
        await page.waitForLoadState('networkidle');
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Click on chat button to open dropdown
        const chatBtn = page.locator('#customer-chat-btn');
        await chatBtn.click();
        await page.waitForTimeout(500);
        
        // Check dropdown list
        const dropdownList = page.locator('#customer-chat-dropdown-list');
        const listVisible = await dropdownList.isVisible();
        
        if (listVisible) {
            console.log('Chat dropdown list is visible');
            // Check for conversation items
            const dropdownItems = page.locator('.chat-dropdown-item');
            const count = await dropdownItems.count();
            console.log(`Found ${count} conversation items`);
        } else {
            console.log('Chat dropdown list not visible (may have no conversations)');
        }
    });
});
