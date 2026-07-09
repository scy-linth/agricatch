const { test, expect } = require('@playwright/test');
const { loginAsFarmer } = require('./auth-helper');

test.describe('Farmer Order Action Confirmation Modal', () => {
  test('confirmation modal HTML exists in page', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Verify the modal exists in the DOM
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveCount(1);
    
    // Verify modal elements exist
    await expect(page.locator('#order-action-modal-title')).toHaveCount(1);
    await expect(page.locator('#order-action-modal-message')).toHaveCount(1);
    await expect(page.locator('#close-order-action-modal')).toHaveCount(1);
    await expect(page.locator('#cancel-order-action-btn')).toHaveCount(1);
    await expect(page.locator('#confirm-order-action-btn')).toHaveCount(1);
  });

  test('confirmation modal appears when clicking Confirm button', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click on orders section in sidebar
    await page.click('a[href="#orders"]');
    
    // Wait for orders section to be active
    await page.waitForTimeout(3000);
    
    // Find a pending order with a confirm button
    const confirmButton = page.locator('button[data-action="item-status"][data-status="confirmed"]').first();
    
    // Check if there's a pending order to test with
    const buttonCount = await confirmButton.count();
    
    if (buttonCount === 0) {
      test.skip('No pending orders found to test confirmation modal');
      return;
    }
    
    // Click the confirm button
    await confirmButton.click();
    
    // Verify the confirmation modal appears
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveClass(/open/);
    
    // Verify modal title
    const modalTitle = page.locator('#order-action-modal-title');
    await expect(modalTitle).toContainText('Confirm Order');
    
    // Verify modal message
    const modalMessage = page.locator('#order-action-modal-message');
    await expect(modalMessage).toContainText('Are you sure you want to confirm this order');
    
    // Verify cancel button exists
    const cancelButton = page.locator('#cancel-order-action-btn');
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toHaveText('Cancel');
    
    // Verify confirm button exists
    const confirmActionButton = page.locator('#confirm-order-action-btn');
    await expect(confirmActionButton).toBeVisible();
    await expect(confirmActionButton).toHaveText('Confirm');
    
    // Close the modal by clicking cancel
    await cancelButton.click();
    
    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('confirmation modal appears when clicking Cancel button', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click on orders section in sidebar
    await page.click('a[href="#orders"]');
    
    // Wait for orders section to be active
    await page.waitForTimeout(2000);
    
    // Wait for orders grid to be visible
    await page.waitForSelector('#orders-grid', { state: 'visible', timeout: 15000 });
    
    // Find a pending order with a cancel button
    const cancelButton = page.locator('button[data-action="item-status"][data-status="cancelled"]').first();
    
    // Check if there's a pending order to test with
    const buttonCount = await cancelButton.count();
    
    if (buttonCount === 0) {
      test.skip('No pending orders found to test confirmation modal');
      return;
    }
    
    // Click the cancel button
    await cancelButton.click();
    
    // Verify the confirmation modal appears
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveClass(/open/);
    
    // Verify modal title
    const modalTitle = page.locator('#order-action-modal-title');
    await expect(modalTitle).toContainText('Cancel Order');
    
    // Verify modal message
    const modalMessage = page.locator('#order-action-modal-message');
    await expect(modalMessage).toContainText('Are you sure you want to cancel this order');
    await expect(modalMessage).toContainText('cannot be undone');
    
    // Close the modal by clicking cancel
    await page.locator('#cancel-order-action-btn').click();
    
    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('confirmation modal appears when clicking Start Preparing button', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click on orders section in sidebar
    await page.click('a[href="#orders"]');
    
    // Wait for orders section to be active
    await page.waitForTimeout(2000);
    
    // Wait for orders grid to be visible
    await page.waitForSelector('#orders-grid', { state: 'visible', timeout: 15000 });
    
    // Find a confirmed order with a prepare button
    const prepareButton = page.locator('button[data-action="item-status"][data-status="preparing"]').first();
    
    // Check if there's a confirmed order to test with
    const buttonCount = await prepareButton.count();
    
    if (buttonCount === 0) {
      test.skip('No confirmed orders found to test confirmation modal');
      return;
    }
    
    // Click the prepare button
    await prepareButton.click();
    
    // Verify the confirmation modal appears
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveClass(/open/);
    
    // Verify modal title
    const modalTitle = page.locator('#order-action-modal-title');
    await expect(modalTitle).toContainText('Start Preparing');
    
    // Verify modal message
    const modalMessage = page.locator('#order-action-modal-message');
    await expect(modalMessage).toContainText('Are you sure you want to start preparing this order');
    
    // Close the modal by clicking cancel
    await page.locator('#cancel-order-action-btn').click();
    
    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('confirmation modal appears when clicking Mark as Out for Delivery button', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click on orders section in sidebar
    await page.click('a[href="#orders"]');
    
    // Wait for orders section to be active
    await page.waitForTimeout(2000);
    
    // Wait for orders grid to be visible
    await page.waitForSelector('#orders-grid', { state: 'visible', timeout: 15000 });
    
    // Find a scheduled order with a ship button
    const shipButton = page.locator('button[data-action="item-status"][data-status="out_for_delivery"]').first();
    
    // Check if there's a scheduled order to test with
    const buttonCount = await shipButton.count();
    
    if (buttonCount === 0) {
      test.skip('No scheduled orders found to test confirmation modal');
      return;
    }
    
    // Click the ship button
    await shipButton.click();
    
    // Verify the confirmation modal appears
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveClass(/open/);
    
    // Verify modal title
    const modalTitle = page.locator('#order-action-modal-title');
    await expect(modalTitle).toContainText('Mark as Out for Delivery');
    
    // Verify modal message
    const modalMessage = page.locator('#order-action-modal-message');
    await expect(modalMessage).toContainText('Are you sure you want to mark this order as out for delivery');
    
    // Close the modal by clicking cancel
    await page.locator('#cancel-order-action-btn').click();
    
    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('confirmation modal appears when clicking Mark as Delivered button', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click on orders section in sidebar
    await page.click('a[href="#orders"]');
    
    // Wait for orders section to be active
    await page.waitForTimeout(2000);
    
    // Wait for orders grid to be visible
    await page.waitForSelector('#orders-grid', { state: 'visible', timeout: 15000 });
    
    // Find an out for delivery order with a deliver button
    const deliverButton = page.locator('button[data-action="item-status"][data-status="delivered"]').first();
    
    // Check if there's an out for delivery order to test with
    const buttonCount = await deliverButton.count();
    
    if (buttonCount === 0) {
      test.skip('No out for delivery orders found to test confirmation modal');
      return;
    }
    
    // Click the deliver button
    await deliverButton.click();
    
    // Verify the confirmation modal appears
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveClass(/open/);
    
    // Verify modal title
    const modalTitle = page.locator('#order-action-modal-title');
    await expect(modalTitle).toContainText('Mark as Delivered');
    
    // Verify modal message
    const modalMessage = page.locator('#order-action-modal-message');
    await expect(modalMessage).toContainText('Are you sure you want to mark this order as delivered');
    
    // Close the modal by clicking cancel
    await page.locator('#cancel-order-action-btn').click();
    
    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('modal closes when clicking X button', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click on orders section in sidebar
    await page.click('a[href="#orders"]');
    
    // Wait for orders section to be active
    await page.waitForTimeout(2000);
    
    // Wait for orders grid to be visible
    await page.waitForSelector('#orders-grid', { state: 'visible', timeout: 15000 });
    
    // Find any action button
    const actionButton = page.locator('button[data-action="item-status"]').first();
    
    const buttonCount = await actionButton.count();
    
    if (buttonCount === 0) {
      test.skip('No orders with action buttons found');
      return;
    }
    
    // Click the action button
    await actionButton.click();
    
    // Verify the confirmation modal appears
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveClass(/open/);
    
    // Click the X close button
    await page.locator('#close-order-action-modal').click();
    
    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });

  test('modal closes when clicking backdrop', async ({ page }) => {
    await loginAsFarmer(page);
    await page.goto('/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Click on orders section in sidebar
    await page.click('a[href="#orders"]');
    
    // Wait for orders section to be active
    await page.waitForTimeout(2000);
    
    // Wait for orders grid to be visible
    await page.waitForSelector('#orders-grid', { state: 'visible', timeout: 15000 });
    
    // Find any action button
    const actionButton = page.locator('button[data-action="item-status"]').first();
    
    const buttonCount = await actionButton.count();
    
    if (buttonCount === 0) {
      test.skip('No orders with action buttons found');
      return;
    }
    
    // Click the action button
    await actionButton.click();
    
    // Verify the confirmation modal appears
    const modal = page.locator('#order-action-confirm-modal');
    await expect(modal).toHaveClass(/open/);
    
    // Click the modal backdrop (the modal itself, not the content)
    await modal.click({ position: { x: 10, y: 10 } });
    
    // Verify modal is closed
    await expect(modal).not.toHaveClass(/open/);
  });
});
