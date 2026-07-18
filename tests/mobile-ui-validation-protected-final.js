const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const OUT_DIR = path.resolve(__dirname, 'mobile-ui-validation-screenshots');

function makeToken(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ role, sub: 'test', exp: 9999999999, iat: 0 })).toString('base64');
  return `${header}.${payload}.sig`;
}

const TARGETS = [
  { name: 'admin', path: 'admin.html', role: 'admin' },
  { name: 'farmer', path: 'farmer.html', role: 'farmer' },
  { name: 'admin-backup', path: 'admin-backup.html', role: 'admin' },
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

async function safeEval(page, fn) {
  try { return await page.evaluate(fn); } catch (e) { return { error: e.message }; }
}

async function runChecks(page) {
  return safeEval(page, () => {
    const results = {
      finalUrl: window.location.href,
      documentWidth: Math.round(document.documentElement.scrollWidth || 0),
      windowWidth: Math.round(window.innerWidth || 0),
      windowHeight: Math.round(window.innerHeight || 0),
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
      overflowingText: [],
    };

    const docWidth = document.documentElement.scrollWidth || document.body.scrollWidth || 0;
    const winWidth = window.innerWidth || 0;
    const winHeight = window.innerHeight || 0;

    results.horizontalScroll = docWidth > winWidth;
    results.horizontalScrollPx = Math.round(docWidth - winWidth);

    const all = document.querySelectorAll('*');
    all.forEach((el) => {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;

        const right = rect.right;
        const width = rect.width;
        const tag = el.tagName;

        if (width > winWidth + 2 && tag !== 'HTML' && tag !== 'BODY') {
          results.overflowingElements.push({ tag, class: (el.className || '').toString().substring(0, 120), id: (el.id || '').substring(0, 60), width: Math.round(width), right: Math.round(right), text: (el.textContent || '').replace(/\s+/g, ' ').substring(0, 60) });
        }
        if (tag === 'IMG' && (right > winWidth || width > winWidth)) {
          results.imagesOverflowing.push({ src: (el.src || '').split('/').pop().substring(0, 80), width: Math.round(width), naturalWidth: el.naturalWidth, right: Math.round(right) });
        }
        if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && (right > winWidth + 2 || width > winWidth + 2)) {
          results.inputsOverflowing.push({ tag, id: el.id, class: (el.className || '').toString().substring(0, 120), width: Math.round(width), right: Math.round(right) });
        }
        if (tag === 'TABLE') {
          const tw = el.scrollWidth;
          if (tw > winWidth) results.tablesHorizontalScroll.push({ class: (el.className || '').toString().substring(0, 120), id: el.id, width: tw, viewport: winWidth });
        }
        if (el.classList.contains('modal') || el.classList.contains('product-details-modal') || el.classList.contains('admin-detail-panel') || el.classList.contains('admin-modal') || (el.id && /modal/i.test(el.id))) {
          if (width > winWidth + 2 || rect.right > winWidth + 2 || rect.left < -2) {
            results.modalsExceedingScreen.push({ class: (el.className || '').toString().substring(0, 120), id: el.id, width: Math.round(width), right: Math.round(rect.right), left: Math.round(rect.left) });
          }
        }
        if (el.classList.contains('sidebar') || el.classList.contains('admin-sidebar') || ['admin-sidebar','farmer-sidebar','customer-sidebar'].includes(el.id)) {
          if (width > winWidth + 2 || rect.right > winWidth + 2 || rect.left < -2) {
            results.sidebarIssues.push({ class: (el.className || '').toString().substring(0, 120), id: el.id, width: Math.round(width), right: Math.round(rect.right), left: Math.round(rect.left), open: el.classList.contains('open') || el.classList.contains('active') });
          }
        }
        if (tag === 'HEADER' || el.classList.contains('header') || el.classList.contains('topbar') || el.id === 'header' || /topbar/i.test(el.className)) {
          if (width > winWidth + 2 || rect.right > winWidth + 2) {
            results.navbarIssues.push({ tag, class: (el.className || '').toString().substring(0, 120), id: el.id, width: Math.round(width), right: Math.round(rect.right) });
          }
        }
        if (style.whiteSpace === 'nowrap' && width > winWidth + 2) {
          results.overflowingText.push({ tag, class: (el.className || '').toString().substring(0, 120), text: (el.textContent || '').replace(/\s+/g, ' ').substring(0, 80), width: Math.round(width) });
        }
      } catch (e) {}
    });

    const footer = document.querySelector('footer, .footer');
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      const footerStyle = window.getComputedStyle(footer);
      const main = document.querySelector('main') || document.querySelector('.main') || document.querySelector('.admin-main');
      if (main) {
        const mainRect = main.getBoundingClientRect();
        if (footerStyle.position === 'fixed') results.footerOverlap = mainRect.bottom > footerRect.top;
      }
    }

    document.querySelectorAll('.float-cart-btn, .admin-float-chat-btn').forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0) results.floatingButtonsOverlap.push({ class: (btn.className || '').toString().substring(0, 120), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width) });
    });

    document.querySelectorAll('.dropdown-menu, .notifications-dropdown, .user-dropdown-menu, #customer-chat-dropdown, #customer-notif-dropdown').forEach((dd) => {
      const rect = dd.getBoundingClientRect();
      if (rect.width > 0 && (rect.right > winWidth + 2 || rect.bottom > winHeight + 2)) {
        results.clippedDropdowns.push({ class: (dd.className || '').toString().substring(0, 120), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width) });
      }
    });

    return results;
  });
}

(async () => {
  const reportPath = path.join(OUT_DIR, '..', 'mobile-ui-validation-report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  const browser = await chromium.launch({ headless: true });

  for (const pageInfo of TARGETS) {
    console.log(`Testing ${pageInfo.name}...`);
    const pageResults = { page: pageInfo.name, path: pageInfo.path, viewports: [] };

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
      await context.addInitScript((token) => { try { localStorage.setItem('token', token); } catch (e) {} }, makeToken(pageInfo.role));
      const page = await context.newPage();

      try {
        await page.goto(`${BASE_URL}/${pageInfo.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (e) {
        console.warn(`  ${pageInfo.name} ${vp.label}: goto error - ${e.message}`);
      }

      await page.waitForTimeout(3000);

      // Force-hide loading overlays so the page shell is visible for layout validation
      await safeEval(page, () => {
        ['admin-loading-screen','loading-screen','farmer-loading-screen','customer-loading-screen'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) { el.style.display = 'none'; el.style.visibility = 'hidden'; }
        });
        document.querySelectorAll('.loading-screen, .admin-loading-screen, .spinner-border, .spinner-border-sm, .preloader, .page-loading').forEach((el) => {
          try { el.style.display = 'none'; el.style.visibility = 'hidden'; } catch (e) {}
        });
      });

      const screenshotPath = path.join(OUT_DIR, `${pageInfo.name}-${vp.label}.png`);
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 25000 });
      } catch (e) {
        console.warn(`  Screenshot failed: ${e.message}`);
      }

      const checks = await runChecks(page);
      pageResults.viewports.push({ label: vp.label, width: vp.width, height: vp.height, screenshot: screenshotPath, checks });

      await context.close();
    }

    const idx = report.findIndex(p => p.page === pageInfo.name);
    if (idx >= 0) report[idx] = pageResults;
    else report.push(pageResults);
  }

  await browser.close();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Updated report: ${reportPath}`);
})();
