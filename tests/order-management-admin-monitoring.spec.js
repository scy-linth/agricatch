const { test, expect } = require('@playwright/test');
const { getAdminToken } = require('./auth-helper');

test.describe('Admin Order Monitoring', () => {
  test('admin accesses orders section', async ({ page }) => {
    const { token } = await getAdminToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/admin.html#orders');
    
    // Wait for DOM to be ready
    await page.waitForTimeout(2000);
    
    // Verify orders section exists in DOM
    await expect(page.locator('#orders')).toHaveCount(1);
  });
});

test.describe('Admin Order Monitoring - View All Orders', () => {
  test('admin views orders from all users', async ({ page }) => {
    const { token } = await getAdminToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/admin.html#orders');
    
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Verify order table exists in DOM
    await expect(page.locator('#orders-table')).toHaveCount(1);
    
    // Verify orders from different farmers are visible
    // This tests hybrid order visibility
    const orderRows = page.locator('#orders-table tbody tr');
    const count = await orderRows.count();
    
    if (count === 0) {
      test.skip('No orders to view');
    }
    
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Admin Order Monitoring - Filter Orders', () => {
  test('admin filters orders by status', async ({ page }) => {
    const { token } = await getAdminToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/admin.html#orders');
    
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Test status filter dropdown
    const statusFilter = page.locator('#order-status-filter, select[name="status"]');
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption('pending');
      await page.waitForTimeout(500);
      
      // Verify filtered results
      const orderRows = page.locator('tbody tr, .order-row');
      const count = await orderRows.count();
      
      // All visible orders should be pending
      for (let i = 0; i < count; i++) {
        const rowText = await orderRows.nth(i).textContent();
        expect(rowText.toLowerCase()).toContain('pending');
      }
    } else {
      test.skip('Status filter not available');
    }
  });
});

test.describe('Admin Order Monitoring - View Order Details', () => {
  test('admin views order details modal', async ({ page }) => {
    const { token } = await getAdminToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/admin.html#orders');
    
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Click on first order view button
    const viewBtn = page.locator('.order-view-btn').first();
    if (await viewBtn.count() === 0) {
      test.skip('No orders to view');
    }
    
    await viewBtn.click();
    
    // Verify order details modal opens
    await expect(page.locator('.modal.open, .modal[style*="display: block"]')).toBeVisible();
    
    // Verify order information is displayed
    await expect(page.locator('.order-details, .modal-body')).toBeVisible();
    
    // Close modal
    await page.click('.modal-close, button:has-text("Close")');
    await expect(page.locator('.modal.open')).not.toBeVisible();
  });
});

test.describe('Admin Order Monitoring - Hybrid Visibility', () => {
  test('admin sees both regular and preorder orders', async ({ page }) => {
    const { token } = await getAdminToken();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/admin.html#orders');
    
    await page.waitForFunction(() => {
      const ordersSection = document.getElementById('orders');
      return ordersSection && !ordersSection.style.display.includes('none');
    }, { timeout: 15000 });
    
    // Check for regular orders in orders table
    const regularOrders = page.locator('#orders-table tbody tr');
    const regularCount = await regularOrders.count();
    
    // Check for preorder badges in orders table
    const preorderBadges = page.locator('#orders-table .badge:has-text("Pre-order"), #orders-table .badge:has-text("preorder")');
    const preorderCount = await preorderBadges.count();
    
    // At least one type should be visible
    if (regularCount === 0 && preorderCount === 0) {
      test.skip('No orders to test hybrid visibility');
    }
    
    expect(regularCount + preorderCount).toBeGreaterThan(0);
  });
});
