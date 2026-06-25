const { test, expect } = require('@playwright/test');

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Customer Real Login Smoke Test', () => {
    let page;
    let consoleErrors = [];

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        consoleErrors = [];

        // Capture console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push({
                    text: msg.text(),
                    location: msg.location()
                });
                console.error('Console error:', msg.text(), msg.location());
            }
        });

        // Capture uncaught exceptions
        page.on('pageerror', error => {
            consoleErrors.push({
                text: error.message,
                stack: error.stack
            });
            console.error('Page error:', error.message, error.stack);
        });
    });

    test.afterEach(async () => {
        await page?.close();
    });

    test('Real token test - create support ticket with actual JWT', async () => {
        // Use the real token provided by user
        const realToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NDEsInVzZXJuYW1lIjoiY3VzdG9tZXIiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3ODIxMDA3ODYsImV4cCI6MTc4MjE4NzE4Nn0.atDl7S3u4JTXVMUXS7f63JXclmzKGwegYSUxQfGRixI';

        // Set token in localStorage
        await page.addInitScript((token) => {
            localStorage.setItem('token', token);
        }, realToken);

        // Go directly to customer account page
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');

        // Wait for support tickets section to be active
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });

        console.log('✓ Navigated to support tickets section with real token');

        // Check for support tickets table
        await expect(page.locator('#support-tickets-table')).toBeVisible();
        await expect(page.locator('#btn-create-support-ticket')).toBeVisible();

        console.log('✓ Support tickets UI loaded');

        // Clear errors before button click
        consoleErrors = [];

        // Click create ticket button
        await page.click('#btn-create-support-ticket');
        await page.waitForTimeout(1000);

        // Check for console errors after button click
        if (consoleErrors.length > 0) {
            console.error('Console errors after clicking create button:', consoleErrors);
            await page.screenshot({ path: 'test-results/create-button-error.png' });
        }

        // Check if modal is visible
        const modalVisible = await page.locator('#create-support-ticket-modal').isVisible().catch(() => false);
        if (!modalVisible) {
            console.error('Modal not visible after clicking create button');
            await page.screenshot({ path: 'test-results/modal-not-visible.png' });
        }
        expect(modalVisible).toBe(true);

        console.log('✓ Create ticket modal opened');

        // Clear errors before form fill
        consoleErrors = [];

        // Fill form
        await page.fill('#support-ticket-subject', 'Real Token Test Ticket');
        await page.fill('#support-ticket-description', 'This is a test ticket created with real JWT token');

        // Submit
        await page.click('#btn-submit-support-ticket');
        await page.waitForTimeout(2000);

        // Check for console errors after submission
        if (consoleErrors.length > 0) {
            console.error('Console errors after form submission:', consoleErrors);
            await page.screenshot({ path: 'test-results/submit-error.png' });
        }

        console.log('✓ Ticket form submitted');

        // Wait for modal to close
        await page.waitForTimeout(2000);

        // Check if modal is closed
        const modalClosed = await page.locator('#create-support-ticket-modal').isVisible().catch(() => true);
        if (modalClosed) {
            console.warn('Modal still visible after submission - may need manual close');
        }

        console.log('✓ Test completed with real token');
    });

});
