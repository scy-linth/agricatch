const { test, expect } = require('@playwright/test');

test.describe('Harvest & Fulfill Modal', () => {
  test('new single button and modal exist in edit pre-order product modal', async ({ page }) => {
    // Login as farmer
    const tokenResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'dhelhilis@gmail.com',
        password: 'password123'
      }
    });
    const tokenData = await tokenResponse.json();
    const token = tokenData.token;

    await page.goto('/farmer.html');
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
    }, token);
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate to products
    await page.click('aside a[href="#products"]');
    await page.waitForTimeout(3000);

    // Switch to pre-orders tab if available
    const preorderTab = page.locator('button:has-text("Pre-orders")').first();
    if (await preorderTab.isVisible().catch(() => false)) {
      await preorderTab.click();
      await page.waitForTimeout(1500);
    }

    // Take screenshot of products page
    await page.screenshot({ path: 'test-results/harvest-fulfill-products-page.png', fullPage: true });

    // Check that old buttons are not in product rows
    const oldHarvestRowBtns = await page.locator('#preorder-products-tbody .btn-success:has-text("Harvest")').count();
    const oldConvertRowBtns = await page.locator('#preorder-products-tbody .btn-warning:has-text("Convert")').count();
    console.log(`Old Harvest buttons in rows: ${oldHarvestRowBtns}`);
    console.log(`Old Convert buttons in rows: ${oldConvertRowBtns}`);

    // Click first edit button in pre-order table
    const editBtn = page.locator('#preorder-products-tbody .btn:has-text("Edit")').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await page.waitForTimeout(1000);

    // Check the new Harvest & Fulfill button exists
    const harvestFulfillBtn = page.locator('#edit-harvest-fulfill-btn');
    await expect(harvestFulfillBtn).toBeVisible();
    await expect(harvestFulfillBtn).toHaveText(/Harvest & Fulfill/);

    // Check old buttons are not in modal
    await expect(page.locator('#edit-harvest-now-btn')).toHaveCount(0);
    await expect(page.locator('#edit-convert-inventory-btn')).toHaveCount(0);

    // Click Harvest & Fulfill and check modal
    await harvestFulfillBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator('#harvest-fulfill-modal');
    await expect(modal).toHaveClass(/open/);
    await expect(page.locator('#harvest-modal-reserved-qty')).toBeVisible();
    await expect(page.locator('#harvest-modal-remaining-qty')).toBeVisible();
    await expect(page.locator('#harvest-fulfill-quantity')).toBeVisible();
    await expect(page.locator('#harvest-fulfill-preview')).toBeHidden();

    // Type quantity and verify preview appears
    await page.fill('#harvest-fulfill-quantity', '50');
    await page.waitForTimeout(300);
    await expect(page.locator('#harvest-fulfill-preview')).toBeVisible();

    await page.screenshot({ path: 'test-results/harvest-fulfill-modal-open.png', fullPage: true });
  });
});
