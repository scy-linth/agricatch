const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 1, username: 'testcustomer', full_name: 'Test Customer', email: 'test@example.com', role: 'customer', phone: '09123456789', address: 'Test Address' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.goto('http://localhost:8888/');
  await page.evaluate(() => localStorage.setItem('token', 'mock-jwt-token'));
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('#user-account-btn').click();
  await page.locator('#user-dropdown-menu').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  const screenshotPath = path.join(__dirname, '..', 'test-results', 'customer-profile-dropdown.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
})();
