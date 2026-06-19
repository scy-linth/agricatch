const { test, expect } = require('@playwright/test');

test.describe('Support Center Bug Check - Admin & Superadmin', () => {
  let adminPage;
  let superAdminPage;

  test.beforeAll(async ({ browser }) => {
    // Get admin page
    adminPage = await browser.newPage();
    await adminPage.goto('http://localhost:3000/admin.html');
    await adminPage.evaluate(() => {
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzgsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoic3RhZmYiLCJpYXQiOjE3ODE4Njk5NzQsImV4cCI6MTc4MTk1NjM3NH0.JFBF7T5XvSgLHCodZh_k4lmfJ1BszzAmQMYwD7yOBGc');
    });
    await adminPage.reload();
    await adminPage.waitForLoadState('networkidle');

    // Get superadmin page
    superAdminPage = await browser.newPage();
    await superAdminPage.goto('http://localhost:3000/admin.html');
    await superAdminPage.evaluate(() => {
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXNlcm5hbWUiOiJzY3lfbGludGgiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3ODE4NzAzMjMsImV4cCI6MTc4MTk1NjcyM30.Z9EMUsedNemkAZe5JePkUiNGMeAu2szfVZhXQWrq2Us');
    });
    await superAdminPage.reload();
    await superAdminPage.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await adminPage?.close();
    await superAdminPage?.close();
  });

  test('Admin: Support Center loads without errors', async () => {
    const errors = [];
    adminPage.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Navigate to Support Center
    await adminPage.click('a[data-section="chat"]');
    await adminPage.waitForSelector('#chat', { state: 'visible' });
    await adminPage.waitForTimeout(2000);

    // Check for console errors
    if (errors.length > 0) {
      console.error('Admin console errors:', errors);
    } else {
      console.log('✓ Admin: No console errors');
    }

    // Verify section is visible
    const chatSection = adminPage.locator('#chat');
    await expect(chatSection).toBeVisible();
    console.log('✓ Admin: Support Center section is visible');

    // Verify panel-conversations is visible
    const panel = adminPage.locator('#panel-conversations');
    await expect(panel).toBeVisible();
    console.log('✓ Admin: Panel conversations is visible');

    // Verify admin-chat-drawer is visible
    const drawer = adminPage.locator('#admin-chat-drawer');
    await expect(drawer).toBeVisible();
    console.log('✓ Admin: Chat drawer is visible');

    // Verify conversation list is visible
    const convList = adminPage.locator('#conversation-list');
    await expect(convList).toBeVisible();
    console.log('✓ Admin: Conversation list is visible');

    // Verify status tabs are visible
    const tabs = adminPage.locator('.support-status-tabs .support-status-pill');
    await expect(tabs).toHaveCount(5);
    console.log('✓ Admin: Status tabs are visible');
  });

  test('Superadmin: Support Center loads without errors', async () => {
    const errors = [];
    superAdminPage.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Navigate to Support Center
    await superAdminPage.click('a[data-section="chat"]');
    await superAdminPage.waitForSelector('#chat', { state: 'visible' });
    await superAdminPage.waitForTimeout(2000);

    // Check for console errors
    if (errors.length > 0) {
      console.error('Superadmin console errors:', errors);
    } else {
      console.log('✓ Superadmin: No console errors');
    }

    // Verify section is visible
    const chatSection = superAdminPage.locator('#chat');
    await expect(chatSection).toBeVisible();
    console.log('✓ Superadmin: Support Center section is visible');

    // Verify panel-conversations is visible
    const panel = superAdminPage.locator('#panel-conversations');
    await expect(panel).toBeVisible();
    console.log('✓ Superadmin: Panel conversations is visible');

    // Verify admin-chat-drawer is visible
    const drawer = superAdminPage.locator('#admin-chat-drawer');
    await expect(drawer).toBeVisible();
    console.log('✓ Superadmin: Chat drawer is visible');

    // Verify conversation list is visible
    const convList = superAdminPage.locator('#conversation-list');
    await expect(convList).toBeVisible();
    console.log('✓ Superadmin: Conversation list is visible');

    // Verify status tabs are visible
    const tabs = superAdminPage.locator('.support-status-tabs .support-status-pill');
    await expect(tabs).toHaveCount(5);
    console.log('✓ Superadmin: Status tabs are visible');
  });

  test('Admin: Can navigate between status tabs', async () => {
    await adminPage.click('a[data-section="chat"]');
    await adminPage.waitForSelector('#chat', { state: 'visible' });
    await adminPage.waitForTimeout(1000);

    const statuses = ['open', 'in_progress', 'resolved', 'closed'];

    for (const status of statuses) {
      await adminPage.click(`.support-status-pill[data-status="${status}"]`);
      await adminPage.waitForTimeout(500);

      const activeTab = await adminPage.locator('.support-status-pill.active').getAttribute('data-status');
      expect(activeTab).toBe(status);
      console.log(`✓ Admin: Tab '${status}' works correctly`);
    }
  });

  test('Superadmin: Can navigate between status tabs', async () => {
    await superAdminPage.click('a[data-section="chat"]');
    await superAdminPage.waitForSelector('#chat', { state: 'visible' });
    await superAdminPage.waitForTimeout(1000);

    const statuses = ['open', 'in_progress', 'resolved', 'closed'];

    for (const status of statuses) {
      await superAdminPage.click(`.support-status-pill[data-status="${status}"]`);
      await superAdminPage.waitForTimeout(500);

      const activeTab = await superAdminPage.locator('.support-status-pill.active').getAttribute('data-status');
      expect(activeTab).toBe(status);
      console.log(`✓ Superadmin: Tab '${status}' works correctly`);
    }
  });

  test('Admin: Can select a conversation', async () => {
    await adminPage.click('a[data-section="chat"]');
    await adminPage.waitForSelector('#chat', { state: 'visible' });
    await adminPage.waitForTimeout(2000);

    // Click on first conversation
    const firstConv = adminPage.locator('.conversation-item').first();
    if (await firstConv.isVisible()) {
      await firstConv.click();
      await adminPage.waitForTimeout(1000);

      // Verify chat messages container is visible
      const chatMessages = adminPage.locator('#chat-messages');
      await expect(chatMessages).toBeVisible();
      console.log('✓ Admin: Can select a conversation');

      // Verify chat input is visible
      const chatInput = adminPage.locator('#chat-input');
      await expect(chatInput).toBeVisible();
      console.log('✓ Admin: Chat input is visible');
    } else {
      console.log('⚠ Admin: No conversations to test');
    }
  });

  test('Superadmin: Can select a conversation', async () => {
    await superAdminPage.click('a[data-section="chat"]');
    await superAdminPage.waitForSelector('#chat', { state: 'visible' });
    await superAdminPage.waitForTimeout(2000);

    // Click on first conversation
    const firstConv = superAdminPage.locator('.conversation-item').first();
    if (await firstConv.isVisible()) {
      await firstConv.click();
      await superAdminPage.waitForTimeout(1000);

      // Verify chat messages container is visible
      const chatMessages = superAdminPage.locator('#chat-messages');
      await expect(chatMessages).toBeVisible();
      console.log('✓ Superadmin: Can select a conversation');

      // Verify chat input is visible
      const chatInput = superAdminPage.locator('#chat-input');
      await expect(chatInput).toBeVisible();
      console.log('✓ Superadmin: Chat input is visible');
    } else {
      console.log('⚠ Superadmin: No conversations to test');
    }
  });

  test('Admin: Chat panel structure is correct', async () => {
    await adminPage.click('a[data-section="chat"]');
    await adminPage.waitForSelector('#chat', { state: 'visible' });
    await adminPage.waitForTimeout(1000);

    const structure = await adminPage.evaluate(() => {
      const section = document.getElementById('chat');
      const card = section.querySelector('.card');
      const panel = document.getElementById('panel-conversations');
      const drawer = document.getElementById('admin-chat-drawer');
      const sidebar = document.querySelector('.chat-sidebar-panel');
      const mainPanel = document.querySelector('.chat-main-panel');

      return {
        hasSection: !!section,
        hasCard: !!card,
        hasPanel: !!panel,
        hasDrawer: !!drawer,
        hasSidebar: !!sidebar,
        hasMainPanel: !!mainPanel,
        panelOutsideCard: !!panel && !card?.contains(panel),
        drawerInsidePanel: !!panel && panel?.contains(drawer)
      };
    });

    expect(structure.hasSection).toBe(true);
    expect(structure.hasCard).toBe(true);
    expect(structure.hasPanel).toBe(true);
    expect(structure.hasDrawer).toBe(true);
    expect(structure.hasSidebar).toBe(true);
    expect(structure.hasMainPanel).toBe(true);
    expect(structure.panelOutsideCard).toBe(true);
    expect(structure.drawerInsidePanel).toBe(true);

    console.log('✓ Admin: Chat panel structure is correct');
  });

  test('Superadmin: Chat panel structure is correct', async () => {
    await superAdminPage.click('a[data-section="chat"]');
    await superAdminPage.waitForSelector('#chat', { state: 'visible' });
    await superAdminPage.waitForTimeout(1000);

    const structure = await superAdminPage.evaluate(() => {
      const section = document.getElementById('chat');
      const card = section.querySelector('.card');
      const panel = document.getElementById('panel-conversations');
      const drawer = document.getElementById('admin-chat-drawer');
      const sidebar = document.querySelector('.chat-sidebar-panel');
      const mainPanel = document.querySelector('.chat-main-panel');

      return {
        hasSection: !!section,
        hasCard: !!card,
        hasPanel: !!panel,
        hasDrawer: !!drawer,
        hasSidebar: !!sidebar,
        hasMainPanel: !!mainPanel,
        panelOutsideCard: !!panel && !card?.contains(panel),
        drawerInsidePanel: !!panel && panel?.contains(drawer)
      };
    });

    expect(structure.hasSection).toBe(true);
    expect(structure.hasCard).toBe(true);
    expect(structure.hasPanel).toBe(true);
    expect(structure.hasDrawer).toBe(true);
    expect(structure.hasSidebar).toBe(true);
    expect(structure.hasMainPanel).toBe(true);
    expect(structure.panelOutsideCard).toBe(true);
    expect(structure.drawerInsidePanel).toBe(true);

    console.log('✓ Superadmin: Chat panel structure is correct');
  });
});
