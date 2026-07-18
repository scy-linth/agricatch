const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const OUT_DIR = path.resolve(__dirname, 'mobile-ui-validation-screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  { name: 'index', path: 'index.html' },
  { name: 'product', path: 'product.html' },
  { name: 'farmers', path: 'farmers.html' },
  { name: 'admin', path: 'admin.html' },
  { name: 'farmer', path: 'farmer.html' },
  { name: 'customer-account', path: 'customer-account.html' },
  { name: 'checkout', path: 'checkout.html' },
  { name: 'orders', path: 'orders.html' },
  { name: 'wishlist', path: 'wishlist.html' },
  { name: 'chat', path: 'chat.html' },
  { name: 'notifications', path: 'notifications.html' },
  { name: 'request-product', path: 'request-product.html' },
  { name: 'admin-backup', path: 'admin-backup.html' },
  { name: '404', path: '404.html' },
  { name: 'clear_cache', path: 'clear_cache.html' },
  { name: 'clear_ui_orders', path: 'clear_ui_orders.html' },
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

      // Any element wider than viewport
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

      // Images
      if (tag === 'IMG' && (right > winWidth || width > winWidth)) {
        results.imagesOverflowing.push({
          src: (el.src || '').split('/').pop().substring(0, 80),
          width: Math.round(width),
          naturalWidth: el.naturalWidth,
          right: Math.round(right),
        });
      }

      // Inputs / selects / textareas
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && (right > winWidth + 2 || width > winWidth + 2)) {
        results.inputsOverflowing.push({
          tag,
          id: el.id,
          class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
          width: Math.round(width),
          right: Math.round(right),
        });
      }

      // Tables
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

      // Modals / panels
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

      // Sidebars
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

      // Navbars / headers
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

      // Overflowing text (nowrap + wider than viewport)
      if (style.whiteSpace === 'nowrap' && width > winWidth + 2) {
        results.overflowingText.push({
          tag,
          class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
          text: (el.textContent || '').replace(/\s+/g, ' ').substring(0, 80),
          width: Math.round(width),
        });
      }
    });

    // Footer overlap with main content
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

    // Sticky/fixed elements that might hide large content
    const sticky = document.querySelectorAll('[style*="position: sticky"], [style*="position:fixed"], [style*="position: fixed"]');
    sticky.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.height > winHeight * 0.35) {
        results.stickyHidingContent.push({
          tag: el.tagName,
          class: (el.className && typeof el.className === 'string' ? el.className : '').substring(0, 120),
          height: Math.round(rect.height),
        });
      }
    });

    // Clipped dropdowns
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

    // Floating buttons
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

      let finalUrl = '';
      try {
        const resp = await page.goto(`${BASE_URL}/${pageInfo.path}`, { waitUntil: 'networkidle', timeout: 25000 });
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
