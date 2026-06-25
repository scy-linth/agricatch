const { test, expect } = require('@playwright/test');

const mockNotifications = [
  {
    id: 1,
    title: 'Order confirmed',
    message: 'Your order #123 has been confirmed',
    type: 'order_confirmed',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  {
    id: 2,
    title: 'Order delivered',
    message: 'Your order #122 has been delivered',
    type: 'order_delivered',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: 3,
    title: 'Payment received',
    message: 'Payment for order #123 received',
    type: 'payment',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  }
];

test.describe('Customer Notifications Page', () => {
  test('should load notifications page and display notifications', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/notifications.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for app to initialize and manually call loadCustomerNotificationsPage
    await page.waitForFunction(() => window.app !== undefined, { timeout: 5000 });
    await page.evaluate(() => {
      if (window.app && window.app.loadCustomerNotificationsPage) {
        window.app.loadCustomerNotificationsPage();
      }
    });
    await page.waitForTimeout(500);

    const list = page.locator('#customer-notifications-list');
    await expect(list).toBeVisible({ timeout: 5000 });

    const items = page.locator('.notification-item');
    await expect(items).toHaveCount(3);
  });

  test('should display empty state when no notifications', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/notifications.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for app to initialize and manually call loadCustomerNotificationsPage
    await page.waitForFunction(() => window.app !== undefined, { timeout: 5000 });
    await page.evaluate(() => {
      if (window.app && window.app.loadCustomerNotificationsPage) {
        window.app.loadCustomerNotificationsPage();
      }
    });
    await page.waitForTimeout(500);

    const emptyState = page.locator('#customer-notifications-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No notifications yet');
  });

  test('should mark notification as read when clicked', async ({ page }) => {
    let markReadCalled = false;
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      if (pathname === '/api/notifications/1/read' && request.method() === 'PUT') {
        markReadCalled = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/notifications.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for app to initialize and manually call loadCustomerNotificationsPage
    await page.waitForFunction(() => window.app !== undefined, { timeout: 5000 });
    await page.evaluate(() => {
      if (window.app && window.app.loadCustomerNotificationsPage) {
        window.app.loadCustomerNotificationsPage();
      }
    });
    await page.waitForTimeout(500);

    const firstItem = page.locator('.notification-item').first();
    await firstItem.click();
    await page.waitForTimeout(500);

    expect(markReadCalled).toBe(true);
  });

  test('should mark all notifications as read', async ({ page }) => {
    let markAllReadCalled = false;
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      if (pathname === '/api/notifications/read-all' && request.method() === 'PUT') {
        markAllReadCalled = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/notifications.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for app to initialize and manually call loadCustomerNotificationsPage
    await page.waitForFunction(() => window.app !== undefined, { timeout: 5000 });
    await page.evaluate(() => {
      if (window.app && window.app.loadCustomerNotificationsPage) {
        window.app.loadCustomerNotificationsPage();
      }
    });
    await page.waitForTimeout(500);

    // Call markAllCustomerNotificationsRead directly
    await page.evaluate(() => {
      if (window.app && window.app.markAllCustomerNotificationsRead) {
        window.app.markAllCustomerNotificationsRead();
      }
    });
    await page.waitForTimeout(500);

    expect(markAllReadCalled).toBe(true);
  });

  test('should show notification header with icon and actions', async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === '/api/notifications' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: mockNotifications }) });
      }
      if (pathname === '/api/cart' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], summary: { itemCount: 0, subtotal: '0.00' } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('http://localhost:8888/notifications.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for app to initialize
    await page.waitForTimeout(1000);

    const topbar = page.locator('.notifications-topbar');
    await expect(topbar).toBeVisible();
    await expect(topbar.locator('.brand-name')).toHaveText('AgriCatch');

    const headerIcon = page.locator('.card-body .d-flex div[style*="linear-gradient"] i');
    await expect(headerIcon).toHaveClass(/bi-bell/);

    const headerTitle = page.locator('.card-body h4');
    await expect(headerTitle).toHaveText('Notifications');

    const markAllBtn = page.locator('#customer-notif-mark-all-btn');
    await expect(markAllBtn).toBeVisible();
  });
});
