const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const OUT_DIR = path.resolve(__dirname, 'mobile-ui-validation-screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function makeToken(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role, sub: 'test', exp: 9999999999, iat: 0 })).toString('base64url');
  return `${header}.${payload}.`;
}

const PAGES = [
  { name: 'index', path: 'index.html', role: null },
  { name: 'product', path: 'product.html', role: null },
  { name: 'farmers', path: 'farmers.html', role: null },
  { name: 'admin', path: 'admin.html', role: 'admin' },
  { name: 'farmer', path: 'farmer.html', role: 'farmer' },
  { name: 'customer-account', path: 'customer-account.html', role: 'customer' },
  { name: 'checkout', path: 'checkout.html', role: 'customer' },
  { name: 'orders', path: 'orders.html', role: 'customer' },
  { name: 'wishlist', path: 'wishlist.html', role: 'customer' },
  { name: 'chat', path: 'chat.html', role: 'customer' },
  { name: 'notifications', path: 'notifications.html', role: 'customer' },
  { name: 'request-product', path: 'request-product.html', role: 'customer' },
  { name: 'admin-backup', path: 'admin-backup.html', role: 'admin' },
  { name: '404', path: '404.html', role: null },
  { name: 'clear_cache', path: 'clear_cache.html', role: null },
  { name: 'clear_ui_orders', path: 'clear_ui_orders.html', role: null },
];

const VIEWPORTS = [
  { width: 320, height: 568, label: '320x568' },
  { width: 360, height: 800, label: '360x800' },
  { width: 375, height: 812, label: '375x812' },
  { width: 390, height: 844, label: '390x844' },
  { width: 414, height: 896, label: '414x896' },
  { width: 430, height: 932, label: '430x932' },
  { width: 1280, height: 720, label: 'desktop' },
];

async function runChecks(page, viewport) {
  return page.evaluate((vp) => {
    const results = {
      finalUrl: window.location.href,
      documentWidth: Math.round(document.documentElement.scrollWidth),
      windowWidth: Math.round(window.innerWidth),
      windowHeight: Math.round(window.innerHeight),
      horizontalScroll: false,
      horizontalScrollPx: 0,
      overflowingElements: [],
      imagesOverflowing: [],
      inputsOverflowing: [],
      tablesHorizontalScroll: [],
      modalsExceedingScreen: [],
      sidebarIssues: [],
      navbarIssues: [],
      footerOverlap: false,
      clippedDropdowns: [],
      floatingButtonsOverlap: [],
      brokenGrids: [],
      brokenFlexLayouts: [],
      stickyHidingContent: [],
      overflowingText: [],
    };

    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    results.horizontalScroll = docWidth > winWidth;
    results.horizontalScrollPx = Math.round(docWidth - winWidth);

    const all = document.querySelectorAll('*');
    all.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      const right = rect.right;
      const width = rect.width;
      const tag = el.tagName;

      if (width > winWidth + 2 && tag !== 'HTML' && tag !== 'BODY') {
        results.overflowingElements.push({
          tag,
          class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
          id: (el.id || '').substring(0, 60),
          width: Math.round(width),
          right: Math.round(right),
          text: (el.textContent || '').replace(/\s+/g, ' ').substring(0, 60),
        });
      }

      if (tag === 'IMG' && (right > winWidth || width > winWidth)) {
        results.imagesOverflowing.push({
          src: (el.src || '').split('/').pop().substring(0, 80),
          width: Math.round(width),
          naturalWidth: el.naturalWidth,
          right: Math.round(right),
        });
      }

      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && (right > winWidth + 2 || width > winWidth + 2)) {
        results.inputsOverflowing.push({
          tag,
          id: el.id,
          class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
          width: Math.round(width),
          right: Math.round(right),
        });
      }

      if (tag === 'TABLE') {
        const tableWidth = el.scrollWidth;
        if (tableWidth > winWidth) {
          results.tablesHorizontalScroll.push({
            class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
            id: el.id,
            width: tableWidth,
            viewport: winWidth,
          });
        }
      }

      if (
        el.classList.contains('modal') ||
        el.classList.contains('product-details-modal') ||
        el.classList.contains('admin-detail-panel') ||
        el.classList.contains('admin-modal') ||
        (el.id && /modal/i.test(el.id))
      ) {
        if (width > winWidth + 2 || rect.right > winWidth + 2 || rect.left < -2) {
          results.modalsExceedingScreen.push({
            class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
            id: el.id,
            width: Math.round(width),
            right: Math.round(rect.right),
            left: Math.round(rect.left),
          });
        }
      }

      if (
        el.classList.contains('sidebar') ||
        el.classList.contains('admin-sidebar') ||
        el.id === 'admin-sidebar' ||
        el.id === 'farmer-sidebar' ||
        el.id === 'customer-sidebar'
      ) {
        if (width > winWidth + 2 || rect.right > winWidth + 2 || rect.left < -2) {
          results.sidebarIssues.push({
            class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
            id: el.id,
            width: Math.round(width),
            right: Math.round(rect.right),
            left: Math.round(rect.left),
            open: el.classList.contains('open') || el.classList.contains('active'),
          });
        }
      }

      if (
        tag === 'HEADER' ||
        el.classList.contains('header') ||
        el.classList.contains('topbar') ||
        el.id === 'header' ||
        el.classList.contains('orders-topbar') ||
        el.classList.contains('checkout-topbar') ||
        el.classList.contains('chat-topbar') ||
        el.classList.contains('notifications-topbar') ||
        el.classList.contains('wishlist-topbar') ||
        el.classList.contains('customer-account-topbar')
      ) {
        if (width > winWidth + 2 || rect.right > winWidth + 2) {
          results.navbarIssues.push({
            tag,
            class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
            id: el.id,
            width: Math.round(width),
            right: Math.round(rect.right),
          });
        }
      }

      if (style.whiteSpace === 'nowrap' && width > winWidth + 2) {
        results.overflowingText.push({
          tag,
          class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
          text: (el.textContent || '').replace(/\s+/g, ' ').substring(0, 80),
          width: Math.round(width),
        });
      }
    });

    const footer = document.querySelector('footer, .footer');
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      const footerStyle = window.getComputedStyle(footer);
      const main = document.querySelector('main') || document.querySelector('.main') || document.querySelector('.admin-main');
      if (main) {
        const mainRect = main.getBoundingClientRect();
        if (footerStyle.position === 'fixed') {
          results.footerOverlap = mainRect.bottom > footerRect.top;
        }
      }
    }

    // floating buttons
    document.querySelectorAll('.float-cart-btn, .admin-float-chat-btn').forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0) {
        results.floatingButtonsOverlap.push({
          class: (btn.className && typeof btn.className === 'string' ? btn.className : '').substring(0, 120),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
        });
      }
    });

    // clipped dropdowns
    const dropdowns = document.querySelectorAll('.dropdown-menu, .notifications-dropdown, .user-dropdown-menu, #customer-chat-dropdown, #customer-notif-dropdown');
    dropdowns.forEach((dd) => {
      const rect = dd.getBoundingClientRect();
      if (rect.width > 0 && (rect.right > winWidth + 2 || rect.bottom > winHeight + 2)) {
        results.clippedDropdowns.push({
          class: (dd.className && typeof dd.className === 'string' ? dd.className : '').substring(0, 120),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
        });
      }
    });

    return results;
  }, viewport);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const pageInfo of PAGES) {
    console.log(`Testing ${pageInfo.name}...`);
    const pageResults = { page: pageInfo.name, path: pageInfo.path, viewports: [] };

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
      const page = await context.newPage();

      if (pageInfo.role) {
        await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
        await page.evaluate((token) => { localStorage.setItem('token', token); }, makeToken(pageInfo.role));
      }

      let finalUrl = '';
      try {
        await page.goto(`${BASE_URL}/${pageInfo.path}`, { waitUntil: 'networkidle', timeout: 25000 });
        finalUrl = page.url();
      } catch (e) {
        finalUrl = page.url();
        console.warn(`  ${pageInfo.name} ${vp.label}: navigation issue - ${e.message}`);
      }

      await page.waitForTimeout(2500);

      const screenshotPath = path.join(OUT_DIR, `${pageInfo.name}-${vp.label}.png`);
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (e) {
        console.warn(`  Screenshot failed for ${pageInfo.name} ${vp.label}: ${e.message}`);
      }

      const checks = await runChecks(page, vp);
      checks.finalUrl = finalUrl;
      pageResults.viewports.push({ label: vp.label, width: vp.width, height: vp.height, screenshot: screenshotPath, checks });

      await context.close();
    }

    report.push(pageResults);
  }

  await browser.close();

  const reportPath = path.join(OUT_DIR, '..', 'mobile-ui-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to: ${reportPath}`);
  console.log(`Screenshots in: ${OUT_DIR}`);
})();
