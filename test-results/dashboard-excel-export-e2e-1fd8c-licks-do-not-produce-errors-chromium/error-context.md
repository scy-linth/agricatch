# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-excel-export-e2e.spec.js >> Dashboard Excel Export E2E Verification >> Farmer (Premium) Dashboard Export >> 6. Verify rapid repeated export clicks do not produce errors
- Location: tests\dashboard-excel-export-e2e.spec.js:139:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8888/index.html
Call log:
  - navigating to "http://localhost:8888/index.html", waiting until "load"

```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const fs = require('fs');
  3   | const path = require('path');
  4   | 
  5   | test.describe('Dashboard Excel Export E2E Verification', () => {
  6   |   const downloadDir = path.join(__dirname, 'test-results', 'downloads');
  7   |   
  8   |   test.beforeAll(async () => {
  9   |     // Create download directory if it doesn't exist
  10  |     if (!fs.existsSync(downloadDir)) {
  11  |       fs.mkdirSync(downloadDir, { recursive: true });
  12  |     }
  13  |   });
  14  | 
  15  |   test.describe('Farmer (Premium) Dashboard Export', () => {
  16  |     test.beforeEach(async ({ page, context }) => {
  17  |       // Navigate to home page
> 18  |       await page.goto('http://localhost:8888/index.html');
      |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8888/index.html
  19  |       await page.waitForLoadState('domcontentloaded');
  20  |       await page.waitForTimeout(1000);
  21  |       
  22  |       // Logout if logged in
  23  |       const userDropdown = page.locator('#user-dropdown');
  24  |       if (await userDropdown.isVisible({ timeout: 2000 })) {
  25  |         await userDropdown.click();
  26  |         await page.waitForTimeout(500);
  27  |         const logoutBtn = page.locator('#logout-btn');
  28  |         if (await logoutBtn.isVisible({ timeout: 2000 })) {
  29  |           await logoutBtn.click();
  30  |           await page.waitForTimeout(2000);
  31  |         }
  32  |       }
  33  |       
  34  |       // Click login button
  35  |       await page.click('#login-btn');
  36  |       await page.waitForSelector('#auth-modal', { state: 'visible' });
  37  |       
  38  |       // Login as premium farmer
  39  |       await page.fill('#auth-email', 'dhelhilis@gmail.com');
  40  |       await page.fill('#auth-password', 'password123');
  41  |       await page.click('#auth-submit-btn');
  42  |       
  43  |       // Wait for login
  44  |       await page.waitForTimeout(3000);
  45  |       
  46  |       // Navigate to farmer dashboard
  47  |       await page.goto('http://localhost:8888/farmer.html');
  48  |       await page.waitForLoadState('domcontentloaded');
  49  |       await page.waitForTimeout(3000);
  50  |     });
  51  | 
  52  |     test('1. Verify successful login and dashboard loads', async ({ page }) => {
  53  |       // Check if we're on farmer dashboard
  54  |       const currentUrl = page.url();
  55  |       console.log('Current URL:', currentUrl);
  56  |       expect(currentUrl).toContain('farmer.html');
  57  |       
  58  |       // Check for dashboard elements
  59  |       const overview = page.locator('#overview');
  60  |       await expect(overview).toBeVisible();
  61  |       
  62  |       await page.screenshot({ path: 'test-results/farmer-login-success.png' });
  63  |       console.log('✓ PASS: Farmer login successful and dashboard loaded');
  64  |     });
  65  | 
  66  |     test('2. Verify export button is visible for premium farmer', async ({ page }) => {
  67  |       const exportContainer = page.locator('#export-dashboard-container');
  68  |       const exportBtn = page.locator('#export-dashboard-btn');
  69  |       
  70  |       // Export button should be visible for premium farmer
  71  |       await expect(exportContainer).toBeVisible();
  72  |       await expect(exportBtn).toBeVisible();
  73  |       
  74  |       await page.screenshot({ path: 'test-results/farmer-export-button-visible.png' });
  75  |       console.log('✓ PASS: Export button is visible for premium farmer');
  76  |     });
  77  | 
  78  |     test('3. Test report period filter (today, week, month, year, all)', async ({ page }) => {
  79  |       const periodFilters = ['today', 'week', 'month', 'year', 'all'];
  80  |       
  81  |       for (const period of periodFilters) {
  82  |         // Click on report period filter dropdown
  83  |         const reportFilterBtn = page.locator('.report-period-filter').first();
  84  |         await reportFilterBtn.click();
  85  |         await page.waitForTimeout(500);
  86  |         
  87  |         // Select the period
  88  |         const periodOption = page.locator(`.report-period-filter[data-period="${period}"]`);
  89  |         await periodOption.click();
  90  |         await page.waitForTimeout(2000);
  91  |         
  92  |         console.log(`✓ PASS: Report period filter ${period} applied successfully`);
  93  |       }
  94  |       
  95  |       await page.screenshot({ path: 'test-results/farmer-report-period-filters.png' });
  96  |     });
  97  | 
  98  |     test('4. Export Dashboard Report with default period', async ({ page, context }) => {
  99  |       // Setup download handler
  100 |       const downloadPromise = page.waitForEvent('download');
  101 |       
  102 |       // Click export button
  103 |       const exportBtn = page.locator('#export-dashboard-btn');
  104 |       await expect(exportBtn).toBeVisible();
  105 |       await exportBtn.click();
  106 |       
  107 |       // Wait for download
  108 |       const download = await downloadPromise;
  109 |       const filePath = await download.path();
  110 |       
  111 |       console.log('Downloaded file path:', filePath);
  112 |       expect(fs.existsSync(filePath)).toBeTruthy();
  113 |       
  114 |       await page.screenshot({ path: 'test-results/farmer-export-default.png' });
  115 |       console.log('✓ PASS: Excel file downloaded successfully with default period');
  116 |     });
  117 | 
  118 |     test('5. Export Dashboard Report with different rangeDays', async ({ page, context }) => {
```