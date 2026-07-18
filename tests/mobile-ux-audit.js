const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve(__dirname, 'mobile-ui-validation-screenshots');
const OUT_FILE = path.resolve(__dirname, 'mobile-ux-audit.json');

function makeToken(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ id: 1, role, sub: 'audit', exp: 9999999999, iat: 0 })).toString('base64');
  return `${header}.${payload}.audit`;
}

const PAGES = [
  { name: 'index', path: 'index.html', role: null },
  { name: 'product', path: 'product.html', role: null },
  { name: 'farmers', path: 'farmers.html', role: null },
  { name: 'customer-account', path: 'customer-account.html', role: 'customer' },
  { name: 'checkout', path: 'checkout.html', role: 'customer' },
  { name: 'orders', path: 'orders.html', role: 'customer' },
  { name: 'wishlist', path: 'wishlist.html', role: 'customer' },
  { name: 'chat', path: 'chat.html', role: 'customer' },
  { name: 'notifications', path: 'notifications.html', role: 'customer' },
  { name: 'request-product', path: 'request-product.html', role: 'customer' },
  { name: '404', path: '404.html', role: null },
  { name: 'admin', path: 'admin.html', role: 'admin' },
  { name: 'farmer', path: 'farmer.html', role: 'farmer' },
  { name: 'admin-backup', path: 'admin-backup.html', role: 'admin' },
];

const VIEWPORTS = [
  { label: 'small', width: 320, height: 568 },
  { label: 'medium', width: 390, height: 844 },
  { label: 'desktop', width: 1280, height: 720 },
];

function userFor(role) {
  if (role === 'admin') return { id: 1, role: 'admin', email: 'admin@agricatch.com', first_name: 'Admin', last_name: 'User' };
  if (role === 'farmer') return { id: 2, role: 'farmer', email: 'farmer@agricatch.com', first_name: 'Farmer', last_name: 'User' };
  if (role === 'customer') return { id: 3, role: 'customer', email: 'customer@agricatch.com', first_name: 'Customer', last_name: 'User' };
  return null;
}

async function auditPage(page, vp) {
  return page.evaluate((vp) => {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const docW = Math.max(
      (document.documentElement && document.documentElement.scrollWidth) || 0,
      (document.body && document.body.scrollWidth) || 0
    );
    if (!document.body || !document.documentElement) {
      return { url: window.location.href, viewport: vp, error: 'document not ready' };
    }
    const results = {
      url: window.location.href,
      viewport: vp,
      windowWidth: winW,
      windowHeight: winH,
      documentWidth: docW,
      scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: docW - winW,
      counts: { buttons: 0, inputs: 0, images: 0, cards: 0, modals: 0, headings: 0, links: 0, floating: 0 },
      headerHeight: 0,
      footerHeight: 0,
      sidebar: null,
      issues: [],
      largeFonts: [],
      smallFonts: [],
      smallTouchTargets: [],
      tallElements: [],
      wideElements: [],
      excessivePadding: [],
      excessiveMargin: [],
      floatingButtons: [],
      heroStats: null,
    };

    const addIssue = (type, severity, title, detail) => {
      results.issues.push({ type, severity, title, detail });
    };

    const all = Array.from(document.querySelectorAll('*'));

    // Header/footer/sidebar/floating
    const header = document.querySelector('header, .header, #header');
    if (header) {
      const r = header.getBoundingClientRect();
      results.headerHeight = Math.round(r.height);
      if (r.height > winH * 0.12) addIssue('navbar', 'medium', 'Header is tall on mobile', `height: ${Math.round(r.height)}px on ${winH}px viewport`);
    }
    const footer = document.querySelector('footer, .footer, #footer');
    if (footer) {
      const r = footer.getBoundingClientRect();
      results.footerHeight = Math.round(r.height);
    }
    const sidebar = document.querySelector('.sidebar, .admin-sidebar, .customer-sidebar, #admin-sidebar, #farmer-sidebar');
    if (sidebar) {
      const r = sidebar.getBoundingClientRect();
      results.sidebar = { id: sidebar.id, class: sidebar.className.substring(0, 120), width: Math.round(r.width), height: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
    }

    all.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const tag = el.tagName;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Buttons and links
      if (tag === 'BUTTON' || el.getAttribute('role') === 'button' || (tag === 'A' && style.display !== 'inline')) {
        results.counts.buttons++;
        const h = Math.round(rect.height);
        const w = Math.round(rect.width);
        const fs = parseFloat(style.fontSize);
        if (h < 44 || w < 44) {
          results.smallTouchTargets.push({ tag, class: el.className.substring(0, 80), id: el.id, text: (el.textContent || '').trim().substring(0, 30), width: w, height: h, fontSize: fs });
        }
      }
      if (tag === 'A') results.counts.links++;

      // Inputs
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        results.counts.inputs++;
        const h = Math.round(rect.height);
        const w = Math.round(rect.width);
        const fs = parseFloat(style.fontSize);
        if (h < 44) {
          results.smallTouchTargets.push({ tag, type: el.type, id: el.id, class: el.className.substring(0, 80), width: w, height: h, fontSize: fs });
        }
      }

      // Images
      if (tag === 'IMG') {
        results.counts.images++;
      }

      // Cards
      if (/(card|admin-section-card|product-card|order-card|farmer-card|chat-card)/i.test(el.className)) {
        results.counts.cards++;
        if (rect.height > winH * 0.6) {
          results.tallElements.push({ tag, class: el.className.substring(0, 120), id: el.id, height: Math.round(rect.height), width: Math.round(rect.width), text: (el.textContent || '').trim().substring(0, 50) });
        }
      }

      // Modals
      if (/(modal|dialog|drawer|panel)/i.test(el.className) || /modal/i.test(el.id)) {
        results.counts.modals++;
        if (rect.width > winW + 2 || rect.right > winW + 2 || rect.left < -2) {
          results.wideElements.push({ tag, class: el.className.substring(0, 120), id: el.id, width: Math.round(rect.width), right: Math.round(rect.right), left: Math.round(rect.left), text: (el.textContent || '').trim().substring(0, 40) });
        }
      }

      // Headings
      if (['H1','H2','H3'].includes(tag)) {
        results.counts.headings++;
        const fs = parseFloat(style.fontSize);
        if (fs > 48) results.largeFonts.push({ tag, class: el.className.substring(0, 80), text: (el.textContent || '').trim().substring(0, 60), fontSize: fs, width: Math.round(rect.width), height: Math.round(rect.height) });
        if (fs < 12) results.smallFonts.push({ tag, class: el.className.substring(0, 80), text: (el.textContent || '').trim().substring(0, 60), fontSize: fs });
      }

      // Text nodes: font sizes
      if (['P','SPAN','DIV','A','LABEL','LI','TD','TH'].includes(tag) && el.children.length === 0) {
        const fs = parseFloat(style.fontSize);
        if (fs < 11) results.smallFonts.push({ tag, class: el.className.substring(0, 80), text: (el.textContent || '').trim().substring(0, 60), fontSize: fs });
        if (fs > 64) results.largeFonts.push({ tag, class: el.className.substring(0, 80), text: (el.textContent || '').trim().substring(0, 60), fontSize: fs, width: Math.round(rect.width) });
      }

      // Overflow
      if (rect.width > winW + 2 && tag !== 'HTML' && tag !== 'BODY') {
        results.wideElements.push({ tag, class: el.className.substring(0, 120), id: el.id, width: Math.round(rect.width), right: Math.round(rect.right), text: (el.textContent || '').trim().substring(0, 50) });
      }

      // Tall standalone elements (not body/html)
      if (rect.height > winH * 0.7 && tag !== 'HTML' && tag !== 'BODY' && tag !== 'MAIN') {
        results.tallElements.push({ tag, class: el.className.substring(0, 120), id: el.id, height: Math.round(rect.height), width: Math.round(rect.width), text: (el.textContent || '').trim().substring(0, 50) });
      }

      // Excessive padding / margin
      const pt = parseFloat(style.paddingTop), pr = parseFloat(style.paddingRight), pb = parseFloat(style.paddingBottom), pl = parseFloat(style.paddingLeft);
      if (pt > 40 || pr > 40 || pb > 40 || pl > 40) {
        results.excessivePadding.push({ tag, class: el.className.substring(0, 120), id: el.id, padding: `${pt} ${pr} ${pb} ${pl}`, text: (el.textContent || '').trim().substring(0, 40) });
      }
      const mt = parseFloat(style.marginTop), mb = parseFloat(style.marginBottom);
      if (mt > 48 || mb > 48) {
        results.excessiveMargin.push({ tag, class: el.className.substring(0, 120), id: el.id, margin: `${mt}/${mb}`, text: (el.textContent || '').trim().substring(0, 40) });
      }
    });

    // Floating buttons
    document.querySelectorAll('.float-cart-btn, .admin-float-chat-btn, .btn-floating, .floating-btn, [class*="float"]').forEach((btn) => {
      const r = btn.getBoundingClientRect();
      if (r.width > 0) {
        results.counts.floating++;
        results.floatingButtons.push({ class: btn.className.substring(0, 120), id: btn.id, width: Math.round(r.width), height: Math.round(r.height), right: Math.round(winW - r.right), bottom: Math.round(winH - r.bottom) });
      }
    });

    // Hero / first large section
    const hero = document.querySelector('.hero, #hero, .banner, .jumbotron, section:first-of-type, .hero-section');
    if (hero) {
      const r = hero.getBoundingClientRect();
      results.heroStats = { class: hero.className.substring(0, 120), id: hero.id, height: Math.round(r.height), width: Math.round(r.width), percentViewport: Math.round((r.height / winH) * 100) };
      if (r.height > winH * 0.85) addIssue('hero', 'medium', 'Hero/first section is very tall on mobile', `height: ${Math.round(r.height)}px (${Math.round((r.height/winH)*100)}% of viewport)`);
    }

    // Horizontal overflow issue
    if (results.horizontalOverflow > 0) addIssue('overflow', 'high', 'Horizontal scrolling required', `document is ${docW}px wide on ${winW}px viewport (+${results.horizontalOverflow}px)`);

    // Small touch target summary
    if (results.smallTouchTargets.length) addIssue('touch', 'high', 'Small touch targets found', `${results.smallTouchTargets.length} elements under 44x44px`);

    // Large fonts summary
    if (results.largeFonts.length) addIssue('typography', 'medium', 'Very large typography on mobile', `${results.largeFonts.length} text elements > 48px`);

    // Excessive padding summary
    if (results.excessivePadding.length) addIssue('spacing', 'low', 'Excessive padding detected', `${results.excessivePadding.length} elements with > 40px padding`);

    return results;
  }, vp);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const output = [];

  for (const pg of PAGES) {
    const pageResult = { page: pg.name, path: pg.path, viewports: [] };
    console.log(`Auditing ${pg.name}...`);

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
      const viewportResult = { label: vp.label };

      try {
        if (pg.role) {
          const token = makeToken(pg.role);
          await context.addInitScript((t) => { try { localStorage.setItem('token', t); } catch (e) {} }, token);

          // Mock auth profile and generic API responses for protected pages so the shell renders
          await context.route('**/api/auth/profile', (route) => {
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user: userFor(pg.role) }) });
          });
          if (pg.name === 'admin' || pg.name === 'farmer' || pg.name === 'admin-backup') {
            await context.route('**/api/**', (route, request) => {
              if (request.url().includes('/api/auth/profile')) return route.continue();
              route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
            });
          } else {
            await context.route('**/api/**', (route, request) => {
              if (request.url().includes('/api/auth/profile')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user: userFor(pg.role) }) });
              route.continue();
            });
          }
        }

        const page = await context.newPage();
        try {
          await page.goto(`${BASE_URL}/${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (e) {
          console.warn(`  goto error for ${pg.name}/${vp.label}: ${e.message}`);
          viewportResult.gotoError = e.message;
        }
        try {
          await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch (_) {}

        // Hide loading screens for dashboard pages
        if (['admin','farmer','admin-backup'].includes(pg.name)) {
          try {
            await page.evaluate(() => {
              ['admin-loading-screen','loading-screen','farmer-loading-screen','customer-loading-screen'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) { el.style.display = 'none'; el.style.visibility = 'hidden'; }
              });
              document.querySelectorAll('.loading-screen, .admin-loading-screen, .spinner-border, .preloader, .page-loading').forEach((el) => { try { el.style.display = 'none'; el.style.visibility = 'hidden'; } catch (e) {} });
            });
          } catch (e) {
            console.warn(`  loading-screen hide error for ${pg.name}/${vp.label}: ${e.message}`);
          }
        }

        // Wait a beat for JS-driven rendering
        await page.waitForTimeout(1500);

        try {
          const audit = await auditPage(page, vp);
          Object.assign(viewportResult, audit);
        } catch (e) {
          console.warn(`  audit error for ${pg.name}/${vp.label}: ${e.message}`);
          viewportResult.auditError = e.message;
        }

        // capture a reference screenshot
        const screenshot = path.join(OUT_DIR, `${pg.name}-audit-${vp.label}.png`);
        try {
          await page.screenshot({ path: screenshot, fullPage: true, timeout: 20000 });
          viewportResult.screenshot = screenshot;
        } catch (e) {
          console.warn(`  screenshot error for ${pg.name}/${vp.label}: ${e.message}`);
        }
      } finally {
        await context.close().catch(() => {});
      }

      pageResult.viewports.push(viewportResult);
    }

    output.push(pageResult);
  }

  await browser.close();
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Audit written to ${OUT_FILE}`);
})();
