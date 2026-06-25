const { test, expect } = require('@playwright/test');

test.describe('Debug notification icon in topbar', () => {
  test('report notification icon visibility state', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('http://localhost:8888/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });

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
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
      }
      if (pathname === '/api/auth/profile' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          user: {
            id: 1,
            username: 'testuser',
            full_name: 'Test User',
            email: 'test@example.com',
            role: 'customer'
          }
        }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Collect diagnostic state
    const collectState = () => {
      const userMenu = document.getElementById('user-menu');
      const userProfile = document.getElementById('user-profile');
      const notifContainer = document.getElementById('customer-notifications');
      const notifBtn = document.getElementById('customer-notif-btn');
      const badge = document.getElementById('customer-notif-badge');
      const myOrdersBtn = document.getElementById('my-orders-btn');
      const notifIcon = notifBtn ? notifBtn.querySelector('i') : null;
      const notifTooltip = notifBtn ? notifBtn.querySelector('.header-tooltip') : null;

      const toRect = el => el ? el.getBoundingClientRect().toJSON() : null;
      const toStyle = el => ({
        display: window.getComputedStyle(el).display,
        position: window.getComputedStyle(el).position,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
        zIndex: window.getComputedStyle(el).zIndex,
        fontFamily: window.getComputedStyle(el).fontFamily,
        fontSize: window.getComputedStyle(el).fontSize,
        color: window.getComputedStyle(el).color,
        content: window.getComputedStyle(el, '::before').content
      });

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        token: localStorage.getItem('token'),
        userMenu: userMenu ? toStyle(userMenu) : 'missing',
        userProfile: userProfile ? { ...toStyle(userProfile), rect: toRect(userProfile) } : 'missing',
        notifContainer: notifContainer ? { ...toStyle(notifContainer), rect: toRect(notifContainer) } : 'missing',
        notifBtn: notifBtn ? { ...toStyle(notifBtn), rect: toRect(notifBtn), html: notifBtn.outerHTML.slice(0, 300) } : 'missing',
        notifIcon: notifIcon ? { ...toStyle(notifIcon), rect: toRect(notifIcon), className: notifIcon.className, textContent: notifIcon.textContent, outerHTML: notifIcon.outerHTML, parentElement: notifIcon.parentElement ? notifIcon.parentElement.id : null, offsetLeft: notifIcon.offsetLeft, offsetTop: notifIcon.offsetTop } : 'missing',
        notifTooltip: notifTooltip ? { ...toStyle(notifTooltip), rect: toRect(notifTooltip), offsetLeft: notifTooltip.offsetLeft, offsetTop: notifTooltip.offsetTop, parentElement: notifTooltip.parentElement ? notifTooltip.parentElement.id : null, outerHTML: notifTooltip.outerHTML } : 'missing',
        badge: badge ? { ...toStyle(badge), rect: toRect(badge) } : 'missing',
        myOrdersBtn: myOrdersBtn ? toStyle(myOrdersBtn) : 'missing',
        headerActions: document.querySelector('.header-actions') ? toRect(document.querySelector('.header-actions')) : null,
        bootstrapIconsLoaded: !!document.querySelector('link[href*="bootstrap-icons"]')
      };
    };

    const state = await page.evaluate(collectState);
    console.log('Diagnostic state:', JSON.stringify(state, null, 2));

    await page.screenshot({ path: 'd:/Codings/AgriCatch/test-results/debug-notif-icon.png', fullPage: true });

    const notifBtn = page.locator('#customer-notif-btn');
    await expect(notifBtn).toBeVisible({ timeout: 5000 });
    const notifIcon = page.locator('#customer-notif-btn i');
    await expect(notifIcon).toBeVisible({ timeout: 5000 });

    // Verify notification tooltip appears on hover like My Orders tooltip
    const notifTooltip = page.locator('#customer-notif-btn .header-tooltip');
    await notifBtn.hover();
    await page.waitForTimeout(300);
    await expect(notifTooltip).toHaveCSS('opacity', '1');
    await expect(notifTooltip).toHaveCSS('transform', /matrix\(1, 0, 0, 1/);
    await expect(notifTooltip).toHaveText('Notifications');
    await page.screenshot({ path: 'd:/Codings/AgriCatch/test-results/debug-notif-tooltip-hover.png', fullPage: false });

    const ordersBtn = page.locator('#my-orders-btn');
    const ordersTooltip = page.locator('#my-orders-btn .header-tooltip');
    await ordersBtn.hover();
    await page.waitForTimeout(300);
    await expect(ordersTooltip).toHaveCSS('opacity', '1');
    await expect(ordersTooltip).toHaveCSS('transform', /matrix\(1, 0, 0, 1/);
    await expect(ordersTooltip).toHaveText('My Orders');
  });

  test('notification icon at common mobile and desktop widths', async ({ page }) => {
    test.setTimeout(60000);
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
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
      }
      if (pathname === '/api/auth/profile' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          user: {
            id: 1,
            username: 'testuser',
            full_name: 'Test User',
            email: 'test@example.com',
            role: 'customer'
          }
        }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    const widths = [1280, 768, 414, 375, 320];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 720 });
      await page.goto('http://localhost:8888/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('token', 'mock-jwt-token');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      const state = await page.evaluate(() => {
        const notifBtn = document.getElementById('customer-notif-btn');
        const userProfile = document.getElementById('user-profile');
        const myOrdersBtn = document.getElementById('my-orders-btn');
        const notifContainer = document.getElementById('customer-notifications');
        const headerActions = document.querySelector('.header-actions');
        const headerContent = document.querySelector('.header-content');
        return {
          width: window.innerWidth,
          notifBtnVisible: !!notifBtn && notifBtn.offsetParent !== null,
          notifBtnRect: notifBtn ? notifBtn.getBoundingClientRect().toJSON() : null,
          myOrdersBtnRect: myOrdersBtn ? myOrdersBtn.getBoundingClientRect().toJSON() : null,
          notifContainerDisplay: notifContainer ? window.getComputedStyle(notifContainer).display : 'missing',
          userProfileRect: userProfile ? userProfile.getBoundingClientRect().toJSON() : null,
          userProfileComputed: userProfile ? {
            minWidth: window.getComputedStyle(userProfile).minWidth,
            display: window.getComputedStyle(userProfile).display
          } : 'missing',
          headerActionsRect: headerActions ? headerActions.getBoundingClientRect().toJSON() : null,
          headerContentRect: headerContent ? headerContent.getBoundingClientRect().toJSON() : null,
          headerActionsHtml: headerActions ? headerActions.innerHTML.slice(0, 600) : null
        };
      });
      console.log(`Width ${width}:`, JSON.stringify(state, null, 2));
      await page.screenshot({ path: `d:/Codings/AgriCatch/test-results/debug-notif-icon-${width}.png`, fullPage: true });
    }
  });

  test('notification icon with long user name', async ({ page }) => {
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
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
      }
      if (pathname === '/api/auth/profile' && request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          user: {
            id: 1,
            username: 'testuser',
            full_name: 'Alexander Jonathan Dela Cruz',
            email: 'test@example.com',
            role: 'customer'
          }
        }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto('http://localhost:8888/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      const notifBtn = document.getElementById('customer-notif-btn');
      const userProfile = document.getElementById('user-profile');
      const userName = document.getElementById('user-name');
      return {
        notifBtnVisible: !!notifBtn && notifBtn.offsetParent !== null,
        notifBtnRect: notifBtn ? notifBtn.getBoundingClientRect().toJSON() : null,
        userProfileRect: userProfile ? userProfile.getBoundingClientRect().toJSON() : null,
        userNameText: userName ? userName.textContent : null,
        userNameWidth: userName ? window.getComputedStyle(userName).width : null,
        headerActionsRect: document.querySelector('.header-actions') ? document.querySelector('.header-actions').getBoundingClientRect().toJSON() : null
      };
    });
    console.log('Long name state:', JSON.stringify(state, null, 2));
    await page.screenshot({ path: 'd:/Codings/AgriCatch/test-results/debug-notif-icon-long-name.png', fullPage: true });

    const notifBtn = page.locator('#customer-notif-btn');
    await expect(notifBtn).toBeVisible({ timeout: 5000 });
  });
});
