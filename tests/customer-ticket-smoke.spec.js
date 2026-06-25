const { test, expect } = require('@playwright/test');

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Customer Support Ticket Smoke Test - No Console Errors', () => {
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

        // Set up mock token for testing
        const customerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 
            Buffer.from(JSON.stringify({ id: 123, role: 'customer', email: 'customer@test.com' })).toString('base64') + 
            '.fake_signature';

        await page.addInitScript((token) => {
            localStorage.setItem('token', token);
        }, customerToken);

        // Set up API mocks
        setupApiMocks(page);
    });

    test.afterEach(async () => {
        await page?.close();
    });

    function setupApiMocks(page) {
        const apiBases = [baseUrl, 'http://localhost:3000'];

        // Mock profile API
        apiBases.forEach(apiBase => {
            page.route(`${apiBase}/api/auth/profile`, route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        user: {
                            id: 123,
                            email: 'customer@test.com',
                            username: 'testcustomer',
                            full_name: 'Test Customer',
                            first_name: 'Test',
                            middle_name: '',
                            last_name: 'Customer',
                            phone: '+639123456789',
                            address: 'Test Address',
                            role: 'customer',
                            is_verified: false,
                            created_at: new Date().toISOString()
                        }
                    })
                });
            });
        });

        // Mock verification request API (to avoid 401 errors)
        apiBases.forEach(apiBase => {
            page.route(`${apiBase}/api/farmers/me/verification-request**`, route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Verification status' })
                });
            });
        });

        // Mock support tickets list
        apiBases.forEach(apiBase => {
            page.route(`${apiBase}/api/support-tickets/my**`, route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        tickets: [
                            {
                                id: 1,
                                subject: 'Test Support Ticket',
                                status: 'open',
                                created_at: new Date().toISOString()
                            }
                        ],
                        total: 1,
                        page: 1,
                        totalPages: 1
                    })
                });
            });
        });

        // Mock create ticket
        apiBases.forEach(apiBase => {
            page.route(`${apiBase}/api/support-tickets/`, route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 2,
                        subject: 'New Test Ticket',
                        status: 'open',
                        created_at: new Date().toISOString()
                    })
                });
            });
        });

        // Mock ticket messages
        apiBases.forEach(apiBase => {
            page.route(`${apiBase}/api/support-tickets/1**`, route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ticket: {
                            id: 1,
                            subject: 'Test Support Ticket',
                            status: 'open',
                            created_at: new Date().toISOString()
                        },
                        messages: [
                            {
                                id: 1,
                                message: 'Customer message',
                                sender_id: 123,
                                sender_name: 'Test Customer',
                                created_at: new Date().toISOString()
                            },
                            {
                                id: 2,
                                message: 'Admin reply',
                                sender_id: 1,
                                sender_name: 'Admin User',
                                created_at: new Date().toISOString()
                            }
                        ]
                    })
                });
            });
        });

        // Mock send message
        apiBases.forEach(apiBase => {
            page.route(`${apiBase}/api/support-tickets/1/messages`, route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 3,
                        message: 'Test message',
                        sender_id: 123,
                        sender_name: 'Test Customer',
                        created_at: new Date().toISOString()
                    })
                });
            });
        });
    }

    test('Smoke test: Navigate to support tickets and check for console errors', async () => {
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');

        // Wait for section to load
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });

        // Wait a bit for any delayed errors
        await page.waitForTimeout(2000);

        // Check for console errors
        expect(consoleErrors.length).toBe(0);
        if (consoleErrors.length > 0) {
            console.error('Console errors found:', consoleErrors);
        }
    });

    test('Smoke test: Click create ticket button and check for errors', async () => {
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });

        // Clear any previous errors
        consoleErrors = [];

        // Click create ticket button
        await page.click('#btn-create-support-ticket');

        // Wait for modal to appear
        await page.waitForTimeout(1000);

        // Check for console errors after button click
        expect(consoleErrors.length).toBe(0);
        if (consoleErrors.length > 0) {
            console.error('Console errors after clicking create button:', consoleErrors);
        }
    });

    test('Smoke test: Fill form and submit without errors', async () => {
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });

        // Click create button
        await page.click('#btn-create-support-ticket');
        await page.waitForTimeout(1000);

        // Clear errors
        consoleErrors = [];

        // Fill form
        await page.fill('#support-ticket-subject', 'Smoke Test Ticket');
        await page.fill('#support-ticket-description', 'This is a smoke test to check for console errors');

        // Submit
        await page.click('#btn-submit-support-ticket');
        await page.waitForTimeout(2000);

        // Check for console errors
        expect(consoleErrors.length).toBe(0);
        if (consoleErrors.length > 0) {
            console.error('Console errors after form submission:', consoleErrors);
        }
    });

    test('Smoke test: Open ticket and check for errors', async () => {
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(1000);

        // Clear errors
        consoleErrors = [];

        // Click chat button
        await page.click('.view-ticket-btn');
        await page.waitForTimeout(1000);

        // Check for console errors
        expect(consoleErrors.length).toBe(0);
        if (consoleErrors.length > 0) {
            console.error('Console errors after opening ticket:', consoleErrors);
        }
    });

    test('Smoke test: Send chat message without errors', async () => {
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(1000);

        // Open ticket
        await page.click('.view-ticket-btn');
        await page.waitForTimeout(1000);

        // Clear errors
        consoleErrors = [];

        // Send message
        await page.fill('#support-chat-input', 'Smoke test message');
        await page.click('#support-chat-form button[type="submit"]');
        await page.waitForTimeout(1000);

        // Check for console errors
        expect(consoleErrors.length).toBe(0);
        if (consoleErrors.length > 0) {
            console.error('Console errors after sending message:', consoleErrors);
        }
    });

    test('Smoke test: Click back button without errors', async () => {
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(1000);

        // Open ticket
        await page.click('.view-ticket-btn');
        await page.waitForTimeout(1000);

        // Clear errors
        consoleErrors = [];

        // Click back button
        await page.click('#support-chat-back-btn');
        await page.waitForTimeout(1000);

        // Check for console errors
        expect(consoleErrors.length).toBe(0);
        if (consoleErrors.length > 0) {
            console.error('Console errors after clicking back button:', consoleErrors);
        }
    });

    test('Smoke test: Complete flow - create ticket, open, chat, back', async () => {
        await page.goto(`${baseUrl}/customer-account.html#support-tickets`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#support-tickets.active', { state: 'visible', timeout: 10000 });

        // Clear errors
        consoleErrors = [];

        // Step 1: Click create button
        await page.click('#btn-create-support-ticket');
        await page.waitForTimeout(500);

        // Step 2: Fill form
        await page.fill('#support-ticket-subject', 'Complete Flow Test');
        await page.fill('#support-ticket-description', 'Testing complete flow without errors');

        // Step 3: Submit
        await page.click('#btn-submit-support-ticket');
        await page.waitForTimeout(1000);

        // Step 3.5: Close modal (wait for Bootstrap to hide it)
        await page.waitForFunction(() => {
            const modal = document.getElementById('create-support-ticket-modal');
            return modal && !modal.classList.contains('show');
        }, { timeout: 5000 }).catch(() => {
            // If Bootstrap doesn't hide it, manually hide
            return page.evaluate(() => {
                const modal = document.getElementById('create-support-ticket-modal');
                if (modal) {
                    modal.classList.remove('show');
                    modal.style.display = 'none';
                }
                // Also remove backdrop
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            });
        });
        await page.waitForTimeout(500);

        // Step 4: Open ticket
        await page.click('.view-ticket-btn');
        await page.waitForTimeout(500);

        // Step 5: Send message
        await page.fill('#support-chat-input', 'Test message in complete flow');
        await page.click('#support-chat-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 6: Click back
        await page.click('#support-chat-back-btn');
        await page.waitForTimeout(500);

        // Check for any console errors throughout the flow
        expect(consoleErrors.length).toBe(0);
        if (consoleErrors.length > 0) {
            console.error('Console errors during complete flow:', consoleErrors);
        }
    });
});
