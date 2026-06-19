const { test, expect } = require('@playwright/test');

test.describe('Support Center Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin page with token
    await page.goto('http://localhost:3000/admin.html');
    
    // Set admin token (you'll need to replace with actual token)
    await page.evaluate(() => {
      localStorage.setItem('token', 'YOUR_ADMIN_TOKEN_HERE');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Support Center section loads and displays correctly', async ({ page }) => {
    // Navigate to Support Center
    await page.click('a[data-section="chat"]');
    await page.waitForSelector('#chat', { state: 'visible' });
    await page.waitForTimeout(1000);

    // Verify section hero is visible
    const hero = page.locator('#chat .ac-section-hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('.ac-section-hero__title')).toHaveText('Support Center');

    // Verify card is visible
    const card = page.locator('#chat .card');
    await expect(card).toBeVisible();

    // Verify card-body is visible
    const cardBody = page.locator('#chat .card .card-body');
    await expect(cardBody).toBeVisible();

    // Verify stats dashboard is visible
    const statsCards = page.locator('#chat .card .card-body .row .col-md-3 .card');
    await expect(statsCards).toHaveCount(4);

    // Verify each stat card has a title and count
    await expect(page.locator('#support-open-count')).toBeVisible();
    await expect(page.locator('#support-in-progress-count')).toBeVisible();
    await expect(page.locator('#support-resolved-count')).toBeVisible();
    await expect(page.locator('#support-closed-count')).toBeVisible();

    // Verify panel-conversations is visible
    const panel = page.locator('#panel-conversations');
    await expect(panel).toBeVisible();

    // Verify admin-chat-drawer is visible
    const drawer = page.locator('#admin-chat-drawer');
    await expect(drawer).toBeVisible();

    // Verify chat sidebar is visible
    const sidebar = page.locator('.chat-sidebar-panel');
    await expect(sidebar).toBeVisible();

    // Verify chat main panel is visible
    const mainPanel = page.locator('.chat-main-panel');
    await expect(mainPanel).toBeVisible();

    // Verify conversation list is visible
    const convList = page.locator('#conversation-list');
    await expect(convList).toBeVisible();

    // Verify status tabs are visible
    const tabs = page.locator('.support-status-tabs .support-status-pill');
    await expect(tabs).toHaveCount(5);

    console.log('✓ Support Center section loads and displays correctly');
  });

  test('Support Center has no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Navigate to Support Center
    await page.click('a[data-section="chat"]');
    await page.waitForSelector('#chat', { state: 'visible' });
    await page.waitForTimeout(2000);

    // Check for console errors
    if (errors.length > 0) {
      console.error('Console errors found:', errors);
      throw new Error(`Console errors found: ${errors.join(', ')}`);
    }

    console.log('✓ No console errors in Support Center');
  });

  test('Support Center elements are properly structured', async ({ page }) => {
    // Navigate to Support Center
    await page.click('a[data-section="chat"]');
    await page.waitForSelector('#chat', { state: 'visible' });
    await page.waitForTimeout(1000);

    // Check HTML structure
    const structure = await page.evaluate(() => {
      const section = document.getElementById('chat');
      const card = section.querySelector('.card');
      const cardBody = card?.querySelector('.card-body');
      const panel = document.getElementById('panel-conversations');
      const drawer = document.getElementById('admin-chat-drawer');

      return {
        hasSection: !!section,
        hasCard: !!card,
        hasCardBody: !!cardBody,
        hasPanel: !!panel,
        hasDrawer: !!drawer,
        panelInsideCardBody: cardBody?.contains(panel),
        drawerInsidePanel: panel?.contains(drawer)
      };
    });

    expect(structure.hasSection).toBe(true);
    expect(structure.hasCard).toBe(true);
    expect(structure.hasCardBody).toBe(true);
    expect(structure.hasPanel).toBe(true);
    expect(structure.hasDrawer).toBe(true);
    expect(structure.panelInsideCardBody).toBe(true);
    expect(structure.drawerInsidePanel).toBe(true);

    console.log('✓ Support Center HTML structure is correct');
  });
});
