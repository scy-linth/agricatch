const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // login via API
  const res = await context.request.post('http://localhost:3000/api/auth/login', {
    data: { email: 'testcustomer@test.com', password: 'Test123456' }
  });
  const { token } = await res.json();
  console.log('token ok', !!token);

  await page.goto('http://localhost:3000/customer-account.html');
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.reload();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tmp/smoke.png' });
  const phone = await page.locator('#edit-phone');
  console.log('edit-phone visible', await phone.isVisible().catch(() => false));
  console.log('placeholder', await phone.getAttribute('placeholder'));
  await browser.close();
})();
