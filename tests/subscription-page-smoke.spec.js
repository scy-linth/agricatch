const { test, expect } = require('@playwright/test');

test.describe('Subscription Page Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to farmer subscription page
    await page.goto('http://localhost:3000/farmer.html#subscription');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('subscription section exists and is visible', async ({ page }) => {
    const subscriptionSection = page.locator('#subscription');
    await expect(subscriptionSection).toBeVisible();
  });

  test('all subscription panels exist', async ({ page }) => {
    const panels = [
      '#subscription-free-panel',
      '#subscription-active-panel',
      '#subscription-pending-panel',
      '#subscription-expired-panel'
    ];
    
    for (const panelId of panels) {
      const panel = page.locator(panelId);
      await expect(panel).toBeAttached();
    }
  });

  test('subscription modal exists', async ({ page }) => {
    const modal = page.locator('#subscription-modal');
    await expect(modal).toBeAttached();
  });

  test('upgrade button exists', async ({ page }) => {
    const upgradeBtn = page.locator('#btn-upgrade-premium');
    await expect(upgradeBtn).toBeAttached();
  });

  test('submit button exists', async ({ page }) => {
    const submitBtn = page.locator('#btn-submit-subscription');
    await expect(submitBtn).toBeAttached();
  });

  test('check for console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }
    expect(errors.length).toBe(0);
  });

  test('check for JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    if (errors.length > 0) {
      console.log('JavaScript errors found:', errors);
    }
    expect(errors.length).toBe(0);
  });
});
