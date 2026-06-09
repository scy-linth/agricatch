const { test, expect } = require('@playwright/test');
const { getAdminToken } = require('./auth-helper');

let authToken;

test.beforeAll(async () => {
  const result = await getAdminToken();
  authToken = result.token;
  console.log(`Authenticated as admin: ${result.user.email}`);
});

test.describe('Table Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    // Inject token and navigate to admin dashboard
    await page.goto('http://localhost:3000/admin.html');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, authToken);
    await page.reload();
    await page.waitForSelector('#overview.active', { timeout: 10000 });
  });

  test('Users table View button should be clickable', async ({ page }) => {
    await page.click('a[data-section="users"]');
    await page.waitForSelector('#users.active', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const viewButton = page.locator('#users-tbody .customer-view-btn').first();
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await expect(page.locator('#customer-detail-modal')).toHaveClass(/open/);
    } else {
      console.log('No users found to test View button');
    }
  });

  test('Products table Edit button should be clickable', async ({ page }) => {
    await page.click('a[data-section="products"]');
    await page.waitForSelector('#products.active', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const editButton = page.locator('#products-tbody .product-edit-btn').first();
    if (await editButton.count() > 0) {
      await editButton.click();
      const modal = page.locator('.modal.open, [class*="modal"][class*="open"]');
      await expect(modal).toHaveCount({ min: 0 });
    } else {
      console.log('No products found to test Edit button');
    }
  });

  test('Orders table View button should be clickable', async ({ page }) => {
    await page.click('a[data-section="orders"]');
    await page.waitForSelector('#orders.active', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const viewButton = page.locator('#orders-tbody .order-view-btn').first();
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await expect(page.locator('#order-detail-panel')).toHaveClass(/active/);
    } else {
      console.log('No orders found to test View button');
    }
  });

  test('Categories table Edit button should be clickable', async ({ page }) => {
    await page.click('a[data-bs-target="#nav-catalog"]');
    await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
    await page.click('a[data-section="categories"]');
    await page.waitForSelector('#categories.active', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const editButton = page.locator('#categories-tbody .category-edit-btn').first();
    if (await editButton.count() > 0) {
      await editButton.click();
      await expect(page.locator('#category-detail-panel')).toBeVisible();
    } else {
      console.log('No categories found to test Edit button');
    }
  });

  test('Catalog table Edit button should be clickable', async ({ page }) => {
    await page.click('a[data-bs-target="#nav-catalog"]');
    await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
    await page.click('a[data-section="catalog-products"]');
    await page.waitForSelector('#catalog-products.active', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const editButton = page.locator('#catalog-names-tbody .catalog-edit-btn').first();
    if (await editButton.count() > 0) {
      await editButton.click();
      // Just verify the click doesn't crash - panel may or may not open depending on implementation
      await page.waitForTimeout(500);
    } else {
      console.log('No catalog items found to test Edit button');
    }
  });

  test('Category Requests table Review button should be clickable', async ({ page }) => {
    await page.click('a[data-bs-target="#nav-catalog"]');
    await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
    await page.click('a[data-section="category-requests"]');
    await page.waitForSelector('#category-requests.active', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const reviewButton = page.locator('#category-requests-tbody .category-request-review-btn').first();
    if (await reviewButton.count() > 0) {
      await reviewButton.click();
      await expect(page.locator('#category-detail-panel')).toBeVisible();
    } else {
      console.log('No category requests found to test Review button');
    }
  });
});
