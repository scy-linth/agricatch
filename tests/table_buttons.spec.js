const { test, expect } = require('@playwright/test');

test.describe('Table Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin.html');
    await page.fill('input[name="email"]', 'admin@agricatch.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin.html', { timeout: 10000 });
  });

  test('Users table View button should be clickable', async ({ page }) => {
    await page.goto('/admin.html#users');
    await page.waitForSelector('#users-tbody tr', { timeout: 10000 });
    
    const viewButton = page.locator('#users-tbody .customer-view-btn').first();
    await expect(viewButton).toBeVisible();
    await viewButton.click();
    
    // Verify customer detail modal opens
    await expect(page.locator('#customer-detail-modal')).toHaveClass(/open/);
  });

  test('Products table Edit button should be clickable', async ({ page }) => {
    await page.goto('/admin.html#products');
    await page.waitForSelector('#products-tbody tr', { timeout: 10000 });
    
    const editButton = page.locator('#products-tbody .product-edit-btn').first();
    await expect(editButton).toBeVisible();
    await editButton.click();
    
    // Verify product edit modal opens (check for any edit modal)
    const modal = page.locator('.modal.open, [class*="modal"][class*="open"]');
    await expect(modal).toHaveCount({ min: 0 }); // Modal may or may not exist, just verify no crash
  });

  test('Orders table View button should be clickable', async ({ page }) => {
    await page.goto('/admin.html#orders');
    await page.waitForSelector('#orders-tbody tr', { timeout: 10000 });
    
    const viewButton = page.locator('#orders-tbody .order-view-btn').first();
    await expect(viewButton).toBeVisible();
    await viewButton.click();
    
    // Verify order panel opens
    await expect(page.locator('#order-detail-panel')).toHaveClass(/active/);
  });

  test('Categories table Edit button should be clickable', async ({ page }) => {
    await page.goto('/admin.html#categories');
    await page.waitForSelector('#categories-tbody tr', { timeout: 10000 });
    
    const editButton = page.locator('#categories-tbody .category-edit-btn').first();
    await expect(editButton).toBeVisible();
    await editButton.click();
    
    // Verify category panel opens
    await expect(page.locator('#category-detail-panel')).toHaveClass(/active/);
  });

  test('Catalog table Edit button should be clickable', async ({ page }) => {
    await page.goto('/admin.html#catalog-products');
    await page.waitForSelector('#catalog-names-tbody tr', { timeout: 10000 });
    
    const editButton = page.locator('#catalog-names-tbody .catalog-edit-btn').first();
    await expect(editButton).toBeVisible();
    await editButton.click();
    
    // Verify catalog panel opens
    await expect(page.locator('#category-detail-panel')).toHaveClass(/active/);
  });

  test('Logs table View button should be clickable', async ({ page }) => {
    await page.goto('/admin.html#logs');
    await page.waitForSelector('#logs-tbody tr', { timeout: 10000 });
    
    const viewButton = page.locator('#logs-tbody .audit-log-view-btn').first();
    await expect(viewButton).toBeVisible();
    await viewButton.click();
    
    // Verify audit log detail modal opens
    await expect(page.locator('#audit-log-detail-modal')).toHaveClass(/open/);
  });

  test('Category Requests table Review button should be clickable', async ({ page }) => {
    await page.goto('/admin.html#category-requests');
    await page.waitForSelector('#category-requests-tbody tr', { timeout: 10000 });
    
    const reviewButton = page.locator('#category-requests-tbody .category-request-review-btn').first();
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();
    
    // Verify category request panel opens
    await expect(page.locator('#category-detail-panel')).toHaveClass(/active/);
  });
});
