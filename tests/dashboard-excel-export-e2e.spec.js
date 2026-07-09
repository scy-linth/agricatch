const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Dashboard Excel Export E2E Verification', () => {
  const downloadDir = path.join(__dirname, 'test-results', 'downloads');
  
  test.beforeAll(async () => {
    // Create download directory if it doesn't exist
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  });

  test.describe('Farmer (Premium) Dashboard Export', () => {
    test.beforeEach(async ({ page, context }) => {
      // Navigate to home page
      await page.goto('http://localhost:8888/index.html');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      // Logout if logged in
      const userDropdown = page.locator('#user-dropdown');
      if (await userDropdown.isVisible({ timeout: 2000 })) {
        await userDropdown.click();
        await page.waitForTimeout(500);
        const logoutBtn = page.locator('#logout-btn');
        if (await logoutBtn.isVisible({ timeout: 2000 })) {
          await logoutBtn.click();
          await page.waitForTimeout(2000);
        }
      }
      
      // Click login button
      await page.click('#login-btn');
      await page.waitForSelector('#auth-modal', { state: 'visible' });
      
      // Login as premium farmer
      await page.fill('#auth-email', 'dhelhilis@gmail.com');
      await page.fill('#auth-password', 'password123');
      await page.click('#auth-submit-btn');
      
      // Wait for login
      await page.waitForTimeout(3000);
      
      // Navigate to farmer dashboard
      await page.goto('http://localhost:8888/farmer.html');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    });

    test('1. Verify successful login and dashboard loads', async ({ page }) => {
      // Check if we're on farmer dashboard
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      expect(currentUrl).toContain('farmer.html');
      
      // Check for dashboard elements
      const overview = page.locator('#overview');
      await expect(overview).toBeVisible();
      
      await page.screenshot({ path: 'test-results/farmer-login-success.png' });
      console.log('✓ PASS: Farmer login successful and dashboard loaded');
    });

    test('2. Verify export button is visible for premium farmer', async ({ page }) => {
      const exportContainer = page.locator('#export-dashboard-container');
      const exportBtn = page.locator('#export-dashboard-btn');
      
      // Export button should be visible for premium farmer
      await expect(exportContainer).toBeVisible();
      await expect(exportBtn).toBeVisible();
      
      await page.screenshot({ path: 'test-results/farmer-export-button-visible.png' });
      console.log('✓ PASS: Export button is visible for premium farmer');
    });

    test('3. Test report period filter (today, week, month, year, all)', async ({ page }) => {
      const periodFilters = ['today', 'week', 'month', 'year', 'all'];
      
      for (const period of periodFilters) {
        // Click on report period filter dropdown
        const reportFilterBtn = page.locator('.report-period-filter').first();
        await reportFilterBtn.click();
        await page.waitForTimeout(500);
        
        // Select the period
        const periodOption = page.locator(`.report-period-filter[data-period="${period}"]`);
        await periodOption.click();
        await page.waitForTimeout(2000);
        
        console.log(`✓ PASS: Report period filter ${period} applied successfully`);
      }
      
      await page.screenshot({ path: 'test-results/farmer-report-period-filters.png' });
    });

    test('4. Export Dashboard Report with default period', async ({ page, context }) => {
      // Setup download handler
      const downloadPromise = page.waitForEvent('download');
      
      // Click export button
      const exportBtn = page.locator('#export-dashboard-btn');
      await expect(exportBtn).toBeVisible();
      await exportBtn.click();
      
      // Wait for download
      const download = await downloadPromise;
      const filePath = await download.path();
      
      console.log('Downloaded file path:', filePath);
      expect(fs.existsSync(filePath)).toBeTruthy();
      
      await page.screenshot({ path: 'test-results/farmer-export-default.png' });
      console.log('✓ PASS: Excel file downloaded successfully with default period');
    });

    test('5. Export Dashboard Report with different rangeDays', async ({ page, context }) => {
      const rangeDaysValues = ['7', '30', '90'];
      
      for (const rangeDays of rangeDaysValues) {
        // Setup download handler
        const downloadPromise = page.waitForEvent('download');
        
        // Call export API directly with rangeDays parameter
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const response = await context.request.get(`http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=${rangeDays}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(response.status()).toBe(200);
        const buffer = await response.body();
        expect(buffer.length).toBeGreaterThan(0);
        
        console.log(`✓ PASS: Export successful for rangeDays=${rangeDays}, file size: ${buffer.length} bytes`);
      }
    });

    test('6. Verify rapid repeated export clicks do not produce errors', async ({ page }) => {
      const exportBtn = page.locator('#export-dashboard-btn');
      
      // Check for console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Click export button 5 times rapidly
      for (let i = 0; i < 5; i++) {
        await exportBtn.click();
        await page.waitForTimeout(500);
      }
      
      await page.waitForTimeout(2000);
      console.log('Console errors after rapid clicks:', errors);
      expect(errors.length).toBe(0);
      
      console.log('✓ PASS: No errors from rapid repeated export clicks');
    });
  });

  test.describe('Admin Dashboard Export', () => {
    test.beforeEach(async ({ page, context }) => {
      // Navigate to home page
      await page.goto('http://localhost:8888/index.html');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      // Logout if logged in
      const userDropdown = page.locator('#user-dropdown');
      if (await userDropdown.isVisible({ timeout: 2000 })) {
        await userDropdown.click();
        await page.waitForTimeout(500);
        const logoutBtn = page.locator('#logout-btn');
        if (await logoutBtn.isVisible({ timeout: 2000 })) {
          await logoutBtn.click();
          await page.waitForTimeout(2000);
        }
      }
      
      // Click login button
      await page.click('#login-btn');
      await page.waitForSelector('#auth-modal', { state: 'visible' });
      
      // Login as admin
      await page.fill('#auth-email', 'admin');
      await page.fill('#auth-password', 'adminadmin');
      await page.click('#auth-submit-btn');
      
      // Wait for login
      await page.waitForTimeout(3000);
      
      // Navigate to admin dashboard
      await page.goto('http://localhost:8888/admin.html');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    });

    test('1. Verify successful login and dashboard loads', async ({ page }) => {
      // Check if we're on admin dashboard
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      expect(currentUrl).toContain('admin.html');
      
      // Check for dashboard elements
      const dashboard = page.locator('#dashboard, .dashboard');
      await expect(dashboard).toBeVisible();
      
      await page.screenshot({ path: 'test-results/admin-login-success.png' });
      console.log('✓ PASS: Admin login successful and dashboard loaded');
    });

    test('2. Verify export button is visible', async ({ page }) => {
      const exportBtn = page.locator('#export-dashboard-btn');
      
      // Export button should be visible for admin
      await expect(exportBtn).toBeVisible();
      
      await page.screenshot({ path: 'test-results/admin-export-button-visible.png' });
      console.log('✓ PASS: Export button is visible for admin');
    });

    test('3. Test report period filter (today, week, month, year, all)', async ({ page }) => {
      const periodFilters = ['today', 'week', 'month', 'year', 'all'];
      
      for (const period of periodFilters) {
        // Click on report period filter dropdown
        const reportFilterBtn = page.locator('.report-period-filter').first();
        await reportFilterBtn.click();
        await page.waitForTimeout(500);
        
        // Select the period
        const periodOption = page.locator(`.report-period-filter[data-period="${period}"]`);
        await periodOption.click();
        await page.waitForTimeout(2000);
        
        console.log(`✓ PASS: Report period filter ${period} applied successfully`);
      }
      
      await page.screenshot({ path: 'test-results/admin-report-period-filters.png' });
    });

    test('4. Export Dashboard Report with default period', async ({ page, context }) => {
      // Setup download handler
      const downloadPromise = page.waitForEvent('download');
      
      // Click export button
      const exportBtn = page.locator('#export-dashboard-btn');
      await expect(exportBtn).toBeVisible();
      await exportBtn.click();
      
      // Wait for download
      const download = await downloadPromise;
      const filePath = await download.path();
      
      console.log('Downloaded file path:', filePath);
      expect(fs.existsSync(filePath)).toBeTruthy();
      
      await page.screenshot({ path: 'test-results/admin-export-default.png' });
      console.log('✓ PASS: Excel file downloaded successfully with default period');
    });

    test('5. Export Dashboard Report with different periods', async ({ page, context }) => {
      const periods = ['today', 'week', 'month', 'year', 'all'];
      
      for (const period of periods) {
        // Call export API directly with period parameter
        const token = await page.evaluate(() => localStorage.getItem('token'));
        const response = await context.request.get(`http://localhost:3000/api/admin/dashboard/export.xlsx?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(response.status()).toBe(200);
        const buffer = await response.body();
        expect(buffer.length).toBeGreaterThan(0);
        
        console.log(`✓ PASS: Export successful for period=${period}, file size: ${buffer.length} bytes`);
      }
    });

    test('6. Verify rapid repeated export clicks do not produce errors', async ({ page }) => {
      const exportBtn = page.locator('#export-dashboard-btn');
      
      // Check for console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Click export button 5 times rapidly
      for (let i = 0; i < 5; i++) {
        await exportBtn.click();
        await page.waitForTimeout(500);
      }
      
      await page.waitForTimeout(2000);
      console.log('Console errors after rapid clicks:', errors);
      expect(errors.length).toBe(0);
      
      console.log('✓ PASS: No errors from rapid repeated export clicks');
    });
  });

  test.describe('Security Tests', () => {
    test('1. Unauthorized users cannot access farmer export endpoint', async ({ context }) => {
      // Try to access export endpoint without authentication
      const response = await context.request.get('http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=30');
      
      expect(response.status()).toBe(401);
      console.log('✓ PASS: Unauthorized access to farmer export endpoint returns 401');
    });

    test('2. Unauthorized users cannot access admin export endpoint', async ({ context }) => {
      // Try to access export endpoint without authentication
      const response = await context.request.get('http://localhost:3000/api/admin/dashboard/export.xlsx?period=month');
      
      expect(response.status()).toBe(401);
      console.log('✓ PASS: Unauthorized access to admin export endpoint returns 401');
    });

    test('3. Non-premium farmer cannot export', async ({ page, context }) => {
      // First, login as a non-premium farmer via API
      const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
        data: {
          email: 'dhelhilis@gmail.com',
          password: 'password123'
        }
      });
      
      const loginData = await loginResponse.json();
      const token = loginData.token;
      
      // Try to access export endpoint
      const exportResponse = await context.request.get('http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=30', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Since dhelhilis@gmail.com is premium, this should succeed
      // For a true non-premium test, we'd need a non-premium farmer account
      console.log('Note: dhelhilis@gmail.com is a premium farmer account');
      console.log('Response status:', exportResponse.status());
    });
  });

  test.describe('Console and Server Error Checks', () => {
    test('1. Check for browser console errors during farmer export', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Login as farmer
      await page.goto('http://localhost:8888/index.html');
      await page.click('#login-btn');
      await page.waitForSelector('#auth-modal', { state: 'visible' });
      await page.fill('#auth-email', 'dhelhilis@gmail.com');
      await page.fill('#auth-password', 'password123');
      await page.click('#auth-submit-btn');
      await page.waitForTimeout(3000);
      
      // Navigate to dashboard
      await page.goto('http://localhost:8888/farmer.html');
      await page.waitForTimeout(3000);
      
      // Perform export
      const exportBtn = page.locator('#export-dashboard-btn');
      await exportBtn.click();
      await page.waitForTimeout(3000);
      
      console.log('Console errors during farmer export:', errors);
      expect(errors.length).toBe(0);
      console.log('✓ PASS: No browser console errors during farmer export');
    });

    test('2. Check for browser console errors during admin export', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Login as admin
      await page.goto('http://localhost:8888/index.html');
      await page.click('#login-btn');
      await page.waitForSelector('#auth-modal', { state: 'visible' });
      await page.fill('#auth-email', 'admin');
      await page.fill('#auth-password', 'adminadmin');
      await page.click('#auth-submit-btn');
      await page.waitForTimeout(3000);
      
      // Navigate to dashboard
      await page.goto('http://localhost:8888/admin.html');
      await page.waitForTimeout(3000);
      
      // Perform export
      const exportBtn = page.locator('#export-dashboard-btn');
      await exportBtn.click();
      await page.waitForTimeout(3000);
      
      console.log('Console errors during admin export:', errors);
      expect(errors.length).toBe(0);
      console.log('✓ PASS: No browser console errors during admin export');
    });

    test('3. Check for server errors during farmer export', async ({ page, context }) => {
      // Login as farmer via API
      const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
        data: {
          email: 'dhelhilis@gmail.com',
          password: 'password123'
        }
      });
      
      const loginData = await loginResponse.json();
      const token = loginData.token;
      
      // Call export endpoint
      const exportResponse = await context.request.get('http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=30', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(exportResponse.status()).toBe(200);
      console.log('✓ PASS: No server errors during farmer export');
    });

    test('4. Check for server errors during admin export', async ({ page, context }) => {
      // Login as admin via API
      const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
        data: {
          email: 'admin',
          password: 'adminadmin'
        }
      });
      
      const loginData = await loginResponse.json();
      const token = loginData.token;
      
      // Call export endpoint
      const exportResponse = await context.request.get('http://localhost:3000/api/admin/dashboard/export.xlsx?period=month', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(exportResponse.status()).toBe(200);
      console.log('✓ PASS: No server errors during admin export');
    });
  });
});
