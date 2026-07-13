# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-excel-export-e2e.spec.js >> Dashboard Excel Export E2E Verification >> Admin Dashboard Export >> 4. Export Dashboard Report with default period
- Location: tests\dashboard-excel-export-e2e.spec.js:245:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8888/index.html
Call log:
  - navigating to "http://localhost:8888/index.html", waiting until "load"

```

# Test source

```ts
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
  119 |       const rangeDaysValues = ['7', '30', '90'];
  120 |       
  121 |       for (const rangeDays of rangeDaysValues) {
  122 |         // Setup download handler
  123 |         const downloadPromise = page.waitForEvent('download');
  124 |         
  125 |         // Call export API directly with rangeDays parameter
  126 |         const token = await page.evaluate(() => localStorage.getItem('token'));
  127 |         const response = await context.request.get(`http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=${rangeDays}`, {
  128 |           headers: { 'Authorization': `Bearer ${token}` }
  129 |         });
  130 |         
  131 |         expect(response.status()).toBe(200);
  132 |         const buffer = await response.body();
  133 |         expect(buffer.length).toBeGreaterThan(0);
  134 |         
  135 |         console.log(`✓ PASS: Export successful for rangeDays=${rangeDays}, file size: ${buffer.length} bytes`);
  136 |       }
  137 |     });
  138 | 
  139 |     test('6. Verify rapid repeated export clicks do not produce errors', async ({ page }) => {
  140 |       const exportBtn = page.locator('#export-dashboard-btn');
  141 |       
  142 |       // Check for console errors
  143 |       const errors = [];
  144 |       page.on('console', msg => {
  145 |         if (msg.type() === 'error') {
  146 |           errors.push(msg.text());
  147 |         }
  148 |       });
  149 |       
  150 |       // Click export button 5 times rapidly
  151 |       for (let i = 0; i < 5; i++) {
  152 |         await exportBtn.click();
  153 |         await page.waitForTimeout(500);
  154 |       }
  155 |       
  156 |       await page.waitForTimeout(2000);
  157 |       console.log('Console errors after rapid clicks:', errors);
  158 |       expect(errors.length).toBe(0);
  159 |       
  160 |       console.log('✓ PASS: No errors from rapid repeated export clicks');
  161 |     });
  162 |   });
  163 | 
  164 |   test.describe('Admin Dashboard Export', () => {
  165 |     test.beforeEach(async ({ page, context }) => {
  166 |       // Navigate to home page
> 167 |       await page.goto('http://localhost:8888/index.html');
      |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8888/index.html
  168 |       await page.waitForLoadState('domcontentloaded');
  169 |       await page.waitForTimeout(1000);
  170 |       
  171 |       // Logout if logged in
  172 |       const userDropdown = page.locator('#user-dropdown');
  173 |       if (await userDropdown.isVisible({ timeout: 2000 })) {
  174 |         await userDropdown.click();
  175 |         await page.waitForTimeout(500);
  176 |         const logoutBtn = page.locator('#logout-btn');
  177 |         if (await logoutBtn.isVisible({ timeout: 2000 })) {
  178 |           await logoutBtn.click();
  179 |           await page.waitForTimeout(2000);
  180 |         }
  181 |       }
  182 |       
  183 |       // Click login button
  184 |       await page.click('#login-btn');
  185 |       await page.waitForSelector('#auth-modal', { state: 'visible' });
  186 |       
  187 |       // Login as admin
  188 |       await page.fill('#auth-email', 'admin');
  189 |       await page.fill('#auth-password', 'adminadmin');
  190 |       await page.click('#auth-submit-btn');
  191 |       
  192 |       // Wait for login
  193 |       await page.waitForTimeout(3000);
  194 |       
  195 |       // Navigate to admin dashboard
  196 |       await page.goto('http://localhost:8888/admin.html');
  197 |       await page.waitForLoadState('domcontentloaded');
  198 |       await page.waitForTimeout(3000);
  199 |     });
  200 | 
  201 |     test('1. Verify successful login and dashboard loads', async ({ page }) => {
  202 |       // Check if we're on admin dashboard
  203 |       const currentUrl = page.url();
  204 |       console.log('Current URL:', currentUrl);
  205 |       expect(currentUrl).toContain('admin.html');
  206 |       
  207 |       // Check for dashboard elements
  208 |       const dashboard = page.locator('#dashboard, .dashboard');
  209 |       await expect(dashboard).toBeVisible();
  210 |       
  211 |       await page.screenshot({ path: 'test-results/admin-login-success.png' });
  212 |       console.log('✓ PASS: Admin login successful and dashboard loaded');
  213 |     });
  214 | 
  215 |     test('2. Verify export button is visible', async ({ page }) => {
  216 |       const exportBtn = page.locator('#export-dashboard-btn');
  217 |       
  218 |       // Export button should be visible for admin
  219 |       await expect(exportBtn).toBeVisible();
  220 |       
  221 |       await page.screenshot({ path: 'test-results/admin-export-button-visible.png' });
  222 |       console.log('✓ PASS: Export button is visible for admin');
  223 |     });
  224 | 
  225 |     test('3. Test report period filter (today, week, month, year, all)', async ({ page }) => {
  226 |       const periodFilters = ['today', 'week', 'month', 'year', 'all'];
  227 |       
  228 |       for (const period of periodFilters) {
  229 |         // Click on report period filter dropdown
  230 |         const reportFilterBtn = page.locator('.report-period-filter').first();
  231 |         await reportFilterBtn.click();
  232 |         await page.waitForTimeout(500);
  233 |         
  234 |         // Select the period
  235 |         const periodOption = page.locator(`.report-period-filter[data-period="${period}"]`);
  236 |         await periodOption.click();
  237 |         await page.waitForTimeout(2000);
  238 |         
  239 |         console.log(`✓ PASS: Report period filter ${period} applied successfully`);
  240 |       }
  241 |       
  242 |       await page.screenshot({ path: 'test-results/admin-report-period-filters.png' });
  243 |     });
  244 | 
  245 |     test('4. Export Dashboard Report with default period', async ({ page, context }) => {
  246 |       // Setup download handler
  247 |       const downloadPromise = page.waitForEvent('download');
  248 |       
  249 |       // Click export button
  250 |       const exportBtn = page.locator('#export-dashboard-btn');
  251 |       await expect(exportBtn).toBeVisible();
  252 |       await exportBtn.click();
  253 |       
  254 |       // Wait for download
  255 |       const download = await downloadPromise;
  256 |       const filePath = await download.path();
  257 |       
  258 |       console.log('Downloaded file path:', filePath);
  259 |       expect(fs.existsSync(filePath)).toBeTruthy();
  260 |       
  261 |       await page.screenshot({ path: 'test-results/admin-export-default.png' });
  262 |       console.log('✓ PASS: Excel file downloaded successfully with default period');
  263 |     });
  264 | 
  265 |     test('5. Export Dashboard Report with different periods', async ({ page, context }) => {
  266 |       const periods = ['today', 'week', 'month', 'year', 'all'];
  267 |       
```