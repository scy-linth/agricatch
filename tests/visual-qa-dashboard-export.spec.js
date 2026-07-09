const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Visual QA Dashboard Excel Export', () => {
  const downloadDir = path.join(__dirname, 'test-results', 'downloads');
  
  test.beforeAll(async () => {
    // Create download directory if it doesn't exist
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  });

  test.describe('Farmer Dashboard Visual QA', () => {
    test.beforeEach(async ({ page, context }) => {
      // Setup download handler
      await context.route('**/*', route => route.continue());
      
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

    test('1. Visual QA - Export and verify file', async ({ page, context }) => {
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
      
      // Copy to test-results for inspection
      const destPath = path.join(downloadDir, 'Farmer_Visual_QA_Report.xlsx');
      fs.copyFileSync(filePath, destPath);
      
      await page.screenshot({ path: 'test-results/farmer-export-visual-qa.png' });
      console.log('✓ PASS: Farmer Excel file downloaded for visual QA');
      console.log('✓ File saved to:', destPath);
    });

    test('2. Rapid multi-click export test', async ({ page }) => {
      const exportBtn = page.locator('#export-dashboard-btn');
      
      // Check for console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Click export button 10 times rapidly
      for (let i = 0; i < 10; i++) {
        await exportBtn.click();
        await page.waitForTimeout(200);
      }
      
      await page.waitForTimeout(3000);
      console.log('Console errors after rapid clicks:', errors);
      expect(errors.length).toBe(0);
      
      console.log('✓ PASS: No errors from 10 rapid export clicks');
    });
  });

  test.describe('Admin Dashboard Visual QA', () => {
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

    test('1. Visual QA - Export and verify file', async ({ page, context }) => {
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
      
      // Copy to test-results for inspection
      const destPath = path.join(downloadDir, 'Admin_Visual_QA_Report.xlsx');
      fs.copyFileSync(filePath, destPath);
      
      await page.screenshot({ path: 'test-results/admin-export-visual-qa.png' });
      console.log('✓ PASS: Admin Excel file downloaded for visual QA');
      console.log('✓ File saved to:', destPath);
    });

    test('2. Rapid multi-click export test', async ({ page }) => {
      const exportBtn = page.locator('#export-dashboard-btn');
      
      // Check for console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Click export button 10 times rapidly
      for (let i = 0; i < 10; i++) {
        await exportBtn.click();
        await page.waitForTimeout(200);
      }
      
      await page.waitForTimeout(3000);
      console.log('Console errors after rapid clicks:', errors);
      expect(errors.length).toBe(0);
      
      console.log('✓ PASS: No errors from 10 rapid export clicks');
    });
  });
});
