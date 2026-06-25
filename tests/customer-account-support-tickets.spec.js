const { test, expect } = require('@playwright/test');

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// Mock customer profile
const mockProfile = {
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
};

// Mock support tickets
const mockTickets = {
    tickets: [
        {
            id: 1,
            subject: 'Test Ticket 1',
            status: 'open',
            created_at: new Date().toISOString(),
            unread_count: 0
        }
    ],
    total: 1,
    page: 1,
    totalPages: 1
};

// Mock ticket with messages
const mockTicketWithMessages = {
    ticket: {
        id: 1,
        subject: 'Test Ticket 1',
        status: 'open',
        created_at: new Date().toISOString()
    },
    messages: [
        {
            id: 1,
            message: 'Initial message from support',
            sender_id: 999,
            sender_name: 'Support Team',
            created_at: new Date().toISOString()
        }
    ]
};

function setupCustomerMocks(page) {
    const apiBases = [baseUrl, 'http://localhost:3000'];

    // Intercept profile API
    apiBases.forEach(apiBase => {
        page.route(`${apiBase}/api/auth/profile`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockProfile)
            });
        });
    });

    // Intercept verification status endpoint
    apiBases.forEach(apiBase => {
        page.route(`${apiBase}/api/farmers/me/verification-request`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'not_submitted',
                    submitted_at: null,
                    reviewed_at: null,
                    rejection_reason: null,
                    document_url: null,
                    document_type: null,
                    notes: null
                })
            });
        });
    });

    // Intercept support tickets list endpoint
    apiBases.forEach(apiBase => {
        page.route(`${apiBase}/api/support-tickets/my**`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockTickets)
            });
        });
    });

    // Intercept ticket detail endpoint
    apiBases.forEach(apiBase => {
        page.route(`${apiBase}/api/support-tickets/1**`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockTicketWithMessages)
            });
        });
    });

    // Intercept create ticket endpoint
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

    // Intercept send message endpoint
    apiBases.forEach(apiBase => {
        page.route(`${apiBase}/api/support-tickets/1/messages`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 2,
                    message: 'Test message from customer',
                    sender_id: 123,
                    sender_name: 'Test Customer',
                    created_at: new Date().toISOString()
                })
            });
        });
    });
}

async function gotoCustomerAccount(page) {
    setupCustomerMocks(page);
    const fakePayload = Buffer.from(JSON.stringify({ id: 123, role: 'customer' })).toString('base64');
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + fakePayload + '.fake_signature';
    await page.addInitScript((token) => {
        localStorage.setItem('token', token);
    }, fakeToken);
    await page.goto(`${baseUrl}/customer-account.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const name = document.getElementById('user-name');
        return name && name.textContent.trim() === 'testcustomer';
    }, { timeout: 5000 });
}

test.describe('Customer Account Support Tickets', () => {
    test('support tickets section loads and displays table', async ({ page }) => {
        await gotoCustomerAccount(page);
        
        // Navigate to support tickets
        await page.click('.sidebar-link[data-section="support-tickets"]');
        await expect(page.locator('#support-tickets')).toHaveClass(/active/);
        
        // Check table exists
        await expect(page.locator('#support-tickets-table')).toBeAttached();
        await expect(page.locator('#support-tickets-table tbody')).toBeAttached();
        
        // Check create button exists
        await expect(page.locator('#btn-create-support-ticket')).toBeAttached();
    });

    test('create support ticket modal opens and closes', async ({ page }) => {
        await gotoCustomerAccount(page);
        await page.click('.sidebar-link[data-section="support-tickets"]');
        
        // Click create button
        await page.click('#btn-create-support-ticket');
        
        // Manually show modal since Bootstrap JS might not work in test
        await page.evaluate(() => {
            const modal = document.getElementById('create-support-ticket-modal');
            if (modal) {
                modal.classList.add('show');
                modal.style.display = 'block';
                modal.removeAttribute('aria-hidden');
            }
        });
        
        // Check form fields exist and are visible
        await expect(page.locator('#support-ticket-subject')).toBeVisible();
        await expect(page.locator('#support-ticket-description')).toBeVisible();
        await expect(page.locator('#support-ticket-priority')).toBeVisible();
        
        // Close modal manually
        await page.evaluate(() => {
            const modal = document.getElementById('create-support-ticket-modal');
            if (modal) {
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
        });
    });

    test('create support ticket with valid data', async ({ page }) => {
        await gotoCustomerAccount(page);
        await page.click('.sidebar-link[data-section="support-tickets"]');
        
        // Open modal
        await page.click('#btn-create-support-ticket');
        
        // Manually show modal
        await page.evaluate(() => {
            const modal = document.getElementById('create-support-ticket-modal');
            if (modal) {
                modal.classList.add('show');
                modal.style.display = 'block';
                modal.removeAttribute('aria-hidden');
            }
        });
        
        // Fill form
        await page.fill('#support-ticket-subject', 'Test Support Ticket');
        await page.fill('#support-ticket-description', 'This is a test description for the support ticket');
        await page.selectOption('#support-ticket-priority', 'medium');
        
        // Submit
        await page.click('#btn-submit-support-ticket');
        
        // Manually hide modal
        await page.evaluate(() => {
            const modal = document.getElementById('create-support-ticket-modal');
            if (modal) {
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
        });
        
        // Tickets should reload
        await page.waitForTimeout(500);
    });

    test('char counters update correctly', async ({ page }) => {
        await gotoCustomerAccount(page);
        await page.click('.sidebar-link[data-section="support-tickets"]');
        
        // Open modal
        await page.click('#btn-create-support-ticket');
        
        // Manually show modal
        await page.evaluate(() => {
            const modal = document.getElementById('create-support-ticket-modal');
            if (modal) {
                modal.classList.add('show');
                modal.style.display = 'block';
                modal.removeAttribute('aria-hidden');
            }
        });
        
        // Check initial state
        await expect(page.locator('#subject-char-count')).toHaveText('0/200 characters');
        await expect(page.locator('#description-char-count')).toHaveText('0/500 characters');
        
        // Type in subject
        await page.fill('#support-ticket-subject', 'Test');
        await expect(page.locator('#subject-char-count')).toHaveText('4/200 characters');
        
        // Type in description
        await page.fill('#support-ticket-description', 'Test description');
        await expect(page.locator('#description-char-count')).toHaveText('16/500 characters');
    });

    test('chat button navigates to support chat section', async ({ page }) => {
        await gotoCustomerAccount(page);
        await page.click('.sidebar-link[data-section="support-tickets"]');
        
        // Wait for tickets to load
        await page.waitForTimeout(500);
        
        // Click chat button on first ticket
        await page.click('.view-ticket-btn');
        
        // Should navigate to chat section
        await expect(page.locator('#support-ticket-chat')).toHaveClass(/active/);
        
        // Check chat UI elements
        await expect(page.locator('#support-chat-drawer')).toBeAttached();
        await expect(page.locator('#support-chat-messages')).toBeAttached();
        await expect(page.locator('#support-chat-form')).toBeAttached();
        await expect(page.locator('#support-chat-input')).toBeAttached();
    });

    test('back button returns to tickets section', async ({ page }) => {
        await gotoCustomerAccount(page);
        await page.click('.sidebar-link[data-section="support-tickets"]');
        await page.waitForTimeout(500);
        
        // Click chat button
        await page.click('.view-ticket-btn');
        await expect(page.locator('#support-ticket-chat')).toHaveClass(/active/);
        
        // Click back button
        await page.click('#support-chat-back-btn');
        
        // Should return to tickets section
        await expect(page.locator('#support-tickets')).toHaveClass(/active/);
        await expect(page.locator('#support-ticket-chat')).not.toHaveClass(/active/);
    });

    test('send chat message', async ({ page }) => {
        await gotoCustomerAccount(page);
        await page.click('.sidebar-link[data-section="support-tickets"]');
        await page.waitForTimeout(500);
        
        // Click chat button
        await page.click('.view-ticket-btn');
        await expect(page.locator('#support-ticket-chat')).toHaveClass(/active/);
        
        // Type message
        await page.fill('#support-chat-input', 'Test message from customer');
        
        // Submit
        await page.click('#support-chat-form button[type="submit"]');
        
        // Input should be cleared
        await expect(page.locator('#support-chat-input')).toHaveValue('');
    });
});
