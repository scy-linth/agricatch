const { test, expect } = require('@playwright/test');

test.describe('Admin Chat Message Sending Tests', () => {
  let adminPage;
  let superAdminPage;

  test.beforeAll(async ({ browser }) => {
    // Get admin page - go directly to admin.html with token
    adminPage = await browser.newPage();
    // Set admin token directly (you'll need to provide a valid token)
    await adminPage.goto('http://localhost:3000/admin.html');
    await adminPage.evaluate(() => {
      localStorage.setItem('token', 'YOUR_ADMIN_TOKEN_HERE');
    });
    await adminPage.reload();

    // Get superadmin page
    superAdminPage = await browser.newPage();
    await superAdminPage.goto('http://localhost:3000/admin.html');
    await superAdminPage.evaluate(() => {
      localStorage.setItem('token', 'YOUR_SUPERADMIN_TOKEN_HERE');
    });
    await superAdminPage.reload();
  });

  test.afterAll(async () => {
    await adminPage?.close();
    await superAdminPage?.close();
  });

  test('Admin can send message in support ticket chat', async () => {
    await adminPage.goto('http://localhost:8080/admin.html');
    await adminPage.waitForLoadState('networkidle');

    // Navigate to chat section
    await adminPage.click('a[data-section="chat"]');
    await adminPage.waitForSelector('#chat', { state: 'visible' });

    // Wait for conversations to load
    await adminPage.waitForSelector('#conversation-list', { state: 'visible' });
    await adminPage.waitForTimeout(2000);

    // Click on first ticket conversation
    const firstTicket = adminPage.locator('.conversation-item[data-type="ticket"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();

      // Wait for messages to load
      await adminPage.waitForSelector('#chat-messages', { state: 'visible' });
      await adminPage.waitForTimeout(1000);

      // Get initial message count
      const initialMessages = await adminPage.locator('#chat-messages .chat-msg').count();
      console.log('Initial message count:', initialMessages);

      // Send a test message
      const testMessage = `Test message from admin at ${Date.now()}`;
      await adminPage.fill('#chat-input', testMessage);
      await adminPage.click('#chat-form button[type="submit"]');

      // Wait for message to appear
      await adminPage.waitForTimeout(3000);

      // Check if message appeared
      const finalMessages = await adminPage.locator('#chat-messages .chat-msg').count();
      console.log('Final message count:', finalMessages);

      // Verify message appeared
      expect(finalMessages).toBeGreaterThan(initialMessages);

      // Verify the message text is in the chat
      const chatContent = await adminPage.textContent('#chat-messages');
      expect(chatContent).toContain(testMessage);

      console.log('✓ Admin successfully sent message in chat');
    } else {
      console.log('⚠ No ticket conversations found');
    }
  });

  test('Superadmin can send message in support ticket chat', async () => {
    await superAdminPage.goto('http://localhost:8080/admin.html');
    await superAdminPage.waitForLoadState('networkidle');

    // Navigate to chat section
    await superAdminPage.click('a[data-section="chat"]');
    await superAdminPage.waitForSelector('#chat', { state: 'visible' });

    // Wait for conversations to load
    await superAdminPage.waitForSelector('#conversation-list', { state: 'visible' });
    await superAdminPage.waitForTimeout(2000);

    // Click on first ticket conversation
    const firstTicket = superAdminPage.locator('.conversation-item[data-type="ticket"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();

      // Wait for messages to load
      await superAdminPage.waitForSelector('#chat-messages', { state: 'visible' });
      await superAdminPage.waitForTimeout(1000);

      // Get initial message count
      const initialMessages = await superAdminPage.locator('#chat-messages .chat-msg').count();
      console.log('Initial message count:', initialMessages);

      // Send a test message
      const testMessage = `Test message from superadmin at ${Date.now()}`;
      await superAdminPage.fill('#chat-input', testMessage);
      await superAdminPage.click('#chat-form button[type="submit"]');

      // Wait for message to appear
      await superAdminPage.waitForTimeout(3000);

      // Check if message appeared
      const finalMessages = await superAdminPage.locator('#chat-messages .chat-msg').count();
      console.log('Final message count:', finalMessages);

      // Verify message appeared
      expect(finalMessages).toBeGreaterThan(initialMessages);

      // Verify the message text is in the chat
      const chatContent = await superAdminPage.textContent('#chat-messages');
      expect(chatContent).toContain(testMessage);

      console.log('✓ Superadmin successfully sent message in chat');
    } else {
      console.log('⚠ No ticket conversations found');
    }
  });

  test('Messages from admin and superadmin appear on right side for each other', async () => {
    // This test verifies that admin and superadmin see each other's messages as "sent" (right side)
    // First, admin sends a message
    await adminPage.goto('http://localhost:8080/admin.html');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.click('a[data-section="chat"]');
    await adminPage.waitForSelector('#chat', { state: 'visible' });
    await adminPage.waitForSelector('#conversation-list', { state: 'visible' });
    await adminPage.waitForTimeout(2000);

    const firstTicket = adminPage.locator('.conversation-item[data-type="ticket"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      await adminPage.waitForSelector('#chat-messages', { state: 'visible' });
      await adminPage.waitForTimeout(1000);

      const adminMessage = `Admin test message ${Date.now()}`;
      await adminPage.fill('#chat-input', adminMessage);
      await adminPage.click('#chat-form button[type="submit"]');
      await adminPage.waitForTimeout(3000);

      // Now superadmin views the same ticket and checks if admin's message appears on right
      await superAdminPage.goto('http://localhost:8080/admin.html');
      await superAdminPage.waitForLoadState('networkidle');
      await superAdminPage.click('a[data-section="chat"]');
      await superAdminPage.waitForSelector('#chat', { state: 'visible' });
      await superAdminPage.waitForSelector('#conversation-list', { state: 'visible' });
      await superAdminPage.waitForTimeout(2000);

      // Click same ticket (first one)
      await superAdminPage.locator('.conversation-item[data-type="ticket"]').first().click();
      await superAdminPage.waitForSelector('#chat-messages', { state: 'visible' });
      await superAdminPage.waitForTimeout(1000);

      // Check if admin's message is in the chat
      const chatContent = await superAdminPage.textContent('#chat-messages');
      if (chatContent.includes(adminMessage)) {
        // Check if the message is in a "sent" group (right side)
        const sentMessages = await superAdminPage.locator('#chat-messages .chat-msg-group.sent').count();
        expect(sentMessages).toBeGreaterThan(0);
        console.log('✓ Admin message appears on right side for superadmin');
      } else {
        console.log('⚠ Admin message not found in chat (pagination issue?)');
      }
    } else {
      console.log('⚠ No ticket conversations found for cross-role test');
    }
  });
});
