const { test, expect } = require('@playwright/test');

const mockNotifications = [
  {
    id: 1,
    title: 'Order confirmed',
    message: 'Your order #123 has been confirmed',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    order_id: 123
  },
  {
    id: 2,
    title: 'Order delivered',
    message: 'Your order #122 has been delivered',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    order_id: 122
  },
  {
    id: 3,
    title: 'New product available',
    message: 'Fresh avocados are now available',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    order_id: null
  }
];

test.describe('Customer Notifications', () => {
  test('notification button should be visible for logged-in users', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/products') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    // Set token in localStorage to simulate logged-in user
    await page.goto('http://localhost:8888/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();

    await page.waitForLoadState('networkidle');

    // Wait for notification button to appear
    const notifBtn = page.locator('#customer-notif-btn');
    await expect(notifBtn).toBeVisible({ timeout: 5000 });

    // Check badge shows unread count
    const badge = page.locator('#customer-notif-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('2');
  });

  test('notification dropdown should toggle on click', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/products') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const notifBtn = page.locator('#customer-notif-btn');
    const dropdown = page.locator('#customer-notif-dropdown');

    // Initially dropdown should be hidden
    await expect(dropdown).not.toBeVisible();

    // Click to open
    await notifBtn.click();
    await expect(dropdown).toBeVisible();

    // Click to close
    await notifBtn.click();
    await expect(dropdown).not.toBeVisible();
  });

  test('notification dropdown should show recent notifications', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/products') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const notifBtn = page.locator('#customer-notif-btn');
    await notifBtn.click();

    const notifList = page.locator('#customer-notif-list');
    await expect(notifList).toBeVisible();

    // Check header shows count
    const count = page.locator('#customer-notif-count');
    await expect(count).toHaveText('2');

    // Check notification items are rendered (max 5)
    const items = page.locator('.notification-item-dropdown');
    await expect(items).toHaveCount(3);

    // Check first item has title and time
    const firstItemTitle = items.first().locator('.small');
    await expect(firstItemTitle).toContainText('Order confirmed');
  });

  test('notification button should be hidden for guest users', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/products') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/');
    await page.waitForLoadState('networkidle');

    // Clear any token
    await page.evaluate(() => {
      localStorage.removeItem('token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const notifContainer = page.locator('#customer-notifications');
    await expect(notifContainer).not.toBeVisible();
  });

  test('show all notifications link should navigate to notifications page', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/products') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const notifBtn = page.locator('#customer-notif-btn');
    await notifBtn.click();

    const showAllLink = page.locator('#customer-show-all-notifications');
    await expect(showAllLink).toBeVisible();

    // Click and verify href attribute
    const href = await showAllLink.getAttribute('href');
    expect(href).toBe('/notifications.html');
  });
});
