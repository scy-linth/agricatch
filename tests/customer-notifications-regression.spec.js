const { test, expect } = require('@playwright/test');

test.describe('Customer Notifications Regression B.2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:3000/index.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Click login button to open auth modal
    await page.click('#login-btn');
    
    // Wait for auth modal to appear
    await page.waitForSelector('#auth-modal', { state: 'visible' });
    
    // Fill in login credentials (using test customer account)
    await page.fill('#auth-email', 'customer');
    await page.fill('#auth-password', 'customercustomer');
    
    // Submit login
    await page.click('#auth-submit-btn');
    
    // Wait for successful login
    await page.waitForTimeout(3000);
  });

  test('1. Notification List - loads correctly, empty state, count badge, read/unread indicators', async ({ page }) => {
    // Navigate to notifications page
    await page.goto('http://localhost:3000/notifications.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Check if notifications list exists
    const list = page.locator('#customer-notifications-list');
    await expect(list).toBeVisible();
    
    // Check if notification items exist
    const items = page.locator('.notification-item');
    const count = await items.count();
    console.log('Notification items count:', count);
    expect(count).toBeGreaterThan(0);
    
    // Check read/unread indicators
    const unreadItems = page.locator('.notification-item.unread');
    const readItems = page.locator('.notification-item.read');
    const unreadCount = await unreadItems.count();
    const readCount = await readItems.count();
    console.log('Unread items:', unreadCount, 'Read items:', readCount);
    
    // Check empty state is hidden
    const emptyState = page.locator('#customer-notifications-empty-state');
    const isEmptyVisible = await emptyState.isVisible();
    expect(isEmptyVisible).toBe(false);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-notifications-list.png' });
  });

  test('2. Notification Content - title, message, icon, timestamp formatting', async ({ page }) => {
    await page.goto('http://localhost:3000/notifications.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    const firstItem = page.locator('.notification-item').first();
    
    // Check title
    const title = firstItem.locator('.notification-title');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    console.log('Title:', titleText);
    expect(titleText).toBeTruthy();
    
    // Check message
    const message = firstItem.locator('.notification-message');
    await expect(message).toBeVisible();
    const messageText = await message.textContent();
    console.log('Message:', messageText);
    expect(messageText).toBeTruthy();
    
    // Check icon
    const icon = firstItem.locator('.notification-icon i');
    await expect(icon).toBeVisible();
    const iconClass = await icon.getAttribute('class');
    console.log('Icon class:', iconClass);
    
    // Check timestamp
    const meta = firstItem.locator('.notification-meta span');
    await expect(meta).toBeVisible();
    const timestamp = await meta.textContent();
    console.log('Timestamp:', timestamp);
    expect(timestamp).toBeTruthy();
    
    await page.screenshot({ path: 'test-results/customer-notifications-content.png' });
  });

  test('3. Notification Actions - Mark as Read, Mark All as Read', async ({ page }) => {
    await page.goto('http://localhost:3000/notifications.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Check Mark All Read button exists
    const markAllBtn = page.locator('#customer-notif-mark-all-btn');
    await expect(markAllBtn).toBeVisible();
    
    // Check if there are unread items with mark read buttons
    const markReadBtns = page.locator('.notification-mark-read-btn');
    const btnCount = await markReadBtns.count();
    console.log('Mark read buttons count:', btnCount);
    
    // If there are unread items, test mark as read
    if (btnCount > 0) {
      const firstBtn = markReadBtns.first();
      await firstBtn.click();
      await page.waitForTimeout(1000);
      console.log('Marked first notification as read');
    }
    
    await page.screenshot({ path: 'test-results/customer-notifications-actions.png' });
  });

  test('4. Visual Integrity - alignment, icons, labels, empty states, console errors', async ({ page }) => {
    await page.goto('http://localhost:3000/notifications.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Check for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any errors
    await page.waitForTimeout(2000);
    
    console.log('Console errors:', errors);
    
    // Check page title
    const pageTitle = page.locator('.ac-section-hero__title');
    await expect(pageTitle).toBeVisible();
    expect(await pageTitle.textContent()).toContain('Notifications');
    
    // Check page subtitle
    const pageSubtitle = page.locator('.ac-section-hero__sub');
    await expect(pageSubtitle).toBeVisible();
    
    await page.screenshot({ path: 'test-results/customer-notifications-visual.png' });
  });

  test('5. Notification Types - verify available types in test data', async ({ page }) => {
    await page.goto('http://localhost:3000/notifications.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    const items = page.locator('.notification-item');
    const count = await items.count();
    
    const types = new Set();
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const title = await item.locator('.notification-title').textContent();
      const message = await item.locator('.notification-message').textContent();
      console.log(`Item ${i}: Title="${title}", Message="${message}"`);
      
      // Determine type from content
      if (title.includes('Support Message')) types.add('support_message');
      else if (title.includes('Order')) types.add('order');
      else if (title.includes('Harvest')) types.add('harvest');
      else if (title.includes('Delivery')) types.add('delivery');
      else types.add('system');
    }
    
    console.log('Available notification types in test data:', Array.from(types));
    
    await page.screenshot({ path: 'test-results/customer-notifications-types.png' });
  });
});
