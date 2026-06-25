const { test, expect } = require('@playwright/test');

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// Mock customer profile returned by the auth/profile endpoint
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

    // Intercept support tickets endpoint
    apiBases.forEach(apiBase => {
        page.route(`${apiBase}/api/support-tickets**`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ tickets: [], total: 0, page: 1, totalPages: 0 })
            });
        });
    });
}

async function gotoCustomerAccount(page) {
    setupCustomerMocks(page);
    // Set a fake JWT token so customer-account.js doesn't redirect to login
    const fakePayload = Buffer.from(JSON.stringify({ id: 123, role: 'customer' })).toString('base64');
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + fakePayload + '.fake_signature';
    await page.addInitScript((token) => {
        localStorage.setItem('token', token);
    }, fakeToken);
    await page.goto(`${baseUrl}/customer-account.html`, { waitUntil: 'domcontentloaded' });
    // Wait for profile-dependent render - check for new header profile initial
    await page.waitForFunction(() => {
        const name = document.getElementById('user-name');
        return name && name.textContent.trim() === 'testcustomer';
    }, { timeout: 5000 });
}

test.describe('Customer Account Page Smoke Test', () => {
    test('customer-account.html loads without console errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
                console.log('CONSOLE ERROR:', msg.text());
            }
        });
        page.on('pageerror', err => {
            errors.push(err.message);
            console.log('PAGE ERROR:', err.message);
        });

        await gotoCustomerAccount(page);
        await page.waitForTimeout(1000);

        expect(errors.length).toBe(0);
    });

    test('customer-account.html has expected structure', async ({ page }) => {
        await gotoCustomerAccount(page);

        // Header elements
        await expect(page.locator('#header')).toBeAttached();
        await expect(page.locator('#user-name')).toBeAttached();
        await expect(page.locator('#header-profile-initial')).toBeAttached();

        // Sidebar elements
        await expect(page.locator('#customer-sidebar')).toBeAttached();
        await expect(page.locator('#sidebar-nav')).toBeAttached();
        await expect(page.locator('.sidebar-link[data-section="profile-overview"]')).toBeAttached();
        await expect(page.locator('.sidebar-link[data-section="profile-edit"]')).toBeAttached();
        await expect(page.locator('.sidebar-link[data-section="profile-password"]')).toBeAttached();
        await expect(page.locator('.sidebar-link[data-section="profile-verification"]')).toBeAttached();
        await expect(page.locator('.sidebar-link[data-section="support-tickets"]')).toBeAttached();

        // Overlay
        await expect(page.locator('#sidebar-overlay')).toBeAttached();

        // Sections
        await expect(page.locator('#profile-overview')).toBeAttached();
        await expect(page.locator('#profile-edit')).toBeAttached();
        await expect(page.locator('#profile-password')).toBeAttached();
        await expect(page.locator('#profile-verification')).toBeAttached();
        await expect(page.locator('#support-tickets')).toBeAttached();
    });

    test('customer-account sidebar navigation works', async ({ page }) => {
        await gotoCustomerAccount(page);

        // Click edit profile
        await page.click('.sidebar-link[data-section="profile-edit"]');
        await expect(page.locator('.sidebar-link[data-section="profile-edit"]')).toHaveClass(/active/);
        await expect(page.locator('#profile-edit')).toHaveClass(/active/);
        expect(await page.evaluate(() => window.location.hash)).toBe('#profile-edit');

        // Click support tickets
        await page.click('.sidebar-link[data-section="support-tickets"]');
        await expect(page.locator('.sidebar-link[data-section="support-tickets"]')).toHaveClass(/active/);
        await expect(page.locator('#support-tickets')).toHaveClass(/active/);
        expect(await page.evaluate(() => window.location.hash)).toBe('#support-tickets');
    });

    test('customer-account mobile sidebar toggles', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await gotoCustomerAccount(page);

        await page.click('#customer-sidebar-toggle');
        await expect(page.locator('body')).toHaveClass(/toggle-sidebar/);

        await page.click('#sidebar-overlay');
        await expect(page.locator('body')).not.toHaveClass(/toggle-sidebar/);
    });

    test('unverified customer can edit name fields', async ({ page }) => {
        await gotoCustomerAccount(page);

        // Navigate to edit profile
        await page.click('.sidebar-link[data-section="profile-edit"]');
        await expect(page.locator('#profile-edit')).toHaveClass(/active/);

        // Check that name fields are enabled
        const firstNameInput = page.locator('#edit-firstname');
        const middleNameInput = page.locator('#edit-middlename');
        const lastNameInput = page.locator('#edit-lastname');

        await expect(firstNameInput).not.toBeDisabled();
        await expect(middleNameInput).not.toBeDisabled();
        await expect(lastNameInput).not.toBeDisabled();

        // Check that verified hint is hidden
        await expect(page.locator('#edit-name-verified-hint')).not.toBeVisible();
    });

    test('verified customer cannot edit name fields', async ({ page }) => {
        // Create a verified profile mock
        const verifiedProfile = {
            ...mockProfile,
            user: {
                ...mockProfile.user,
                is_verified: true
            }
        };

        const apiBases = [baseUrl, 'http://localhost:3000'];
        apiBases.forEach(apiBase => {
            page.route(`${apiBase}/api/auth/profile`, route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(verifiedProfile)
                });
            });
        });

        // Set fake token
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

        // Navigate to edit profile
        await page.click('.sidebar-link[data-section="profile-edit"]');
        await expect(page.locator('#profile-edit')).toHaveClass(/active/);

        // Check that name fields are disabled
        const firstNameInput = page.locator('#edit-firstname');
        const middleNameInput = page.locator('#edit-middlename');
        const lastNameInput = page.locator('#edit-lastname');

        await expect(firstNameInput).toBeDisabled();
        await expect(middleNameInput).toBeDisabled();
        await expect(lastNameInput).toBeDisabled();

        // Check that verified hint is visible
        await expect(page.locator('#edit-name-verified-hint')).toBeVisible();
        await expect(page.locator('#edit-name-verified-hint')).toContainText('Verified: name can\'t be edited');
    });
});
