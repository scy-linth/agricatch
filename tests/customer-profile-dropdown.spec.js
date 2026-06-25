const { test, expect } = require('@playwright/test');

const mockUser = {
  id: 1,
  username: 'testcustomer',
  full_name: 'Test Customer',
  email: 'test@example.com',
  role: 'customer',
  phone: '09123456789',
  address: 'Test Address'
};

test.describe('Customer Profile Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;
      const method = request.method();

      if (pathname === '/api/products') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
      }
      if (pathname === '/api/cart' && method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      if (pathname === '/api/notifications' && method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
      }
      if (pathname === '/api/orders') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ orders: [] }) });
      }
      if (pathname === '/api/auth/profile') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: mockUser }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('profile dropdown toggle is visible with name and initial', async ({ page }) => {
    const profileBtn = page.locator('#user-account-btn');
    await expect(profileBtn).toBeVisible({ timeout: 5000 });

    const userName = page.locator('#user-name');
    await expect(userName).toHaveText(mockUser.full_name.split(' ')[0]);

    const userInitial = page.locator('#user-initial');
    await expect(userInitial).toHaveText('T');
  });

  test('profile dropdown opens and shows header, role badge, and menu items', async ({ page }) => {
    const profileBtn = page.locator('#user-account-btn');
    await profileBtn.click();

    const dropdownMenu = page.locator('#user-dropdown-menu');
    await expect(dropdownMenu).toHaveClass(/show/);

    // Header info
    await expect(page.locator('#user-name-dd')).toHaveText(mockUser.full_name);
    await expect(page.locator('#user-email')).toHaveText(mockUser.email);
    await expect(page.locator('#header-role-badge')).toHaveText('CUSTOMER');

    // Menu items with icons
    await expect(page.locator('#customer-my-profile-btn')).toBeVisible();
    await expect(page.locator('#customer-my-profile-btn i')).toHaveClass(/bi-person/);
    await expect(page.locator('#customer-edit-profile-btn')).toBeVisible();
    await expect(page.locator('#customer-edit-profile-btn i')).toHaveClass(/bi-gear/);
    await expect(page.locator('#customer-change-password-btn')).toBeVisible();
    await expect(page.locator('#customer-change-password-btn i')).toHaveClass(/bi-shield-lock/);
    await expect(page.locator('#customer-request-verification-btn')).toBeVisible();
    await expect(page.locator('#customer-request-verification-btn i')).toHaveClass(/bi-shield-check/);
    await expect(page.locator('#customer-support-tickets-btn')).toBeVisible();
    await expect(page.locator('#customer-support-tickets-btn i')).toHaveClass(/bi-ticket-perforated/);
    await expect(page.locator('#logout-btn')).toBeVisible();
    await expect(page.locator('#logout-btn')).toHaveClass(/text-danger/);
    await expect(page.locator('#logout-btn i')).toHaveClass(/bi-box-arrow-right/);
  });

  test('My Profile navigates to customer-account.html#profile-overview', async ({ page }) => {
    await page.locator('#user-account-btn').click();
    await page.locator('#customer-my-profile-btn').click();
    await expect(page).toHaveURL(/customer-account\.html#profile-overview/);
  });

  test('Edit Profile navigates to customer-account.html#profile-edit', async ({ page }) => {
    await page.locator('#user-account-btn').click();
    await page.locator('#customer-edit-profile-btn').click();
    await expect(page).toHaveURL(/customer-account\.html#profile-edit/);
  });

  test('Change Password navigates to customer-account.html#profile-password', async ({ page }) => {
    await page.locator('#user-account-btn').click();
    await page.locator('#customer-change-password-btn').click();
    await expect(page).toHaveURL(/customer-account\.html#profile-password/);
  });

  test('Request Verification navigates to customer-account.html#profile-verification', async ({ page }) => {
    await page.locator('#user-account-btn').click();
    await page.locator('#customer-request-verification-btn').click();
    await expect(page).toHaveURL(/customer-account\.html#profile-verification/);
  });

  test('Support Tickets navigates to customer-account.html#support-tickets', async ({ page }) => {
    await page.locator('#user-account-btn').click();
    await page.locator('#customer-support-tickets-btn').click();
    await expect(page).toHaveURL(/customer-account\.html#support-tickets/);
  });

  test('Sign Out link is styled in red and logs out', async ({ page }) => {
    await page.locator('#user-account-btn').click();
    const logoutBtn = page.locator('#logout-btn');
    await expect(logoutBtn).toHaveClass(/text-danger/);
    await expect(logoutBtn.locator('i')).toHaveClass(/bi-box-arrow-right/);
  });

  test('profile dropdown screenshot matches farmer-style layout', async ({ page }) => {
    await page.locator('#user-account-btn').click();
    await page.locator('#user-dropdown-menu').waitFor({ state: 'visible' });
    await page.screenshot({ path: 'test-results/customer-profile-dropdown.png', fullPage: false });
  });
});
