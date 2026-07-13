const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, 'test-results');
const outDir = reportsDir;

const reports = [
  'Admin_Dashboard',
  'Admin_Orders',
  'Admin_Users',
  'Farmer_Dashboard',
  'Farmer_Orders'
];

async function capturePage(page, htmlPath, prefix) {
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`);
  await page.waitForTimeout(1000);

  const viewportHeight = 900;
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);

  // Top screenshot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${prefix}_top.png`) });

  // Middle/table screenshots
  const sections = 3;
  for (let i = 1; i < sections; i++) {
    const scrollY = Math.min((pageHeight / sections) * i, pageHeight - viewportHeight);
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `${prefix}_middle_${i}.png`) });
  }

  // Bottom screenshot
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, pageHeight - viewportHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${prefix}_bottom.png`) });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  for (const r of reports) {
    const htmlPath = path.join(reportsDir, `${r}_Report.html`);
    if (fs.existsSync(htmlPath)) {
      console.log(`Capturing ${r}...`);
      await capturePage(page, htmlPath, r);
    } else {
      console.error(`Missing HTML for ${r}`);
    }
  }

  await browser.close();
  console.log('Screenshots captured.');
})();
