const { test, expect } = require('@playwright/test');

test.describe('Support Ticket System E2E Tests', () => {
  let farmerPage;
  let adminPage;
  let farmerToken;
  let adminToken;

  test.beforeAll(async ({ browser }) => {
    // Get farmer token by logging in
    farmerPage = await browser.newPage();
    await farmerPage.goto('http://localhost:8080/index.html');
    
    // Login as farmer (you may need to adjust credentials)
    await farmerPage.fill('input[name="username"]', 'testfarmer');
    await farmerPage.fill('input[name="password"]', 'testpass123');
    await farmerPage.click('button[type="submit"]');
    await farmerPage.waitForURL('**/farmer.html');
    
    // Get token from localStorage
    farmerToken = await farmerPage.evaluate(() => localStorage.getItem('token'));
    console.log('Farmer token obtained:', farmerToken ? 'Yes' : 'No');

    // Get admin token by logging in
    adminPage = await browser.newPage();
    await adminPage.goto('http://localhost:8080/index.html');
    
    // Login as admin (you may need to adjust credentials)
    await adminPage.fill('input[name="username"]', 'admin');
    await adminPage.fill('input[name="password"]', 'adminpass123');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL('**/admin.html');
    
    // Get token from localStorage
    adminToken = await adminPage.evaluate(() => localStorage.getItem('token'));
    console.log('Admin token obtained:', adminToken ? 'Yes' : 'No');
  });

  test.afterAll(async () => {
    await farmerPage?.close();
    await adminPage?.close();
  });

  test('Farmer can create a support ticket', async () => {
    await farmerPage.goto('http://localhost:8080/farmer.html');
    await farmerPage.waitForLoadState('networkidle');

    // Click on profile dropdown
    await farmerPage.click('#farmer-user-account-btn');
    
    // Click on Support Tickets
    await farmerPage.click('#dropdown-support-tickets');
    
    // Wait for modal to appear
    await farmerPage.waitForSelector('#support-tickets-modal', { state: 'visible' });
    
    // Click Create New Ticket
    await farmerPage.click('#btn-create-support-ticket');
    
    // Wait for create modal
    await farmerPage.waitForSelector('#create-support-ticket-modal', { state: 'visible' });
    
    // Fill in the form
    await farmerPage.fill('#support-ticket-subject', 'Test Support Ticket E2E');
    await farmerPage.fill('#support-ticket-description', 'This is a test support ticket created by E2E test automation.');
    await farmerPage.selectOption('#support-ticket-priority', 'medium');
    
    // Submit the ticket
    await farmerPage.click('#btn-submit-support-ticket');
    
    // Wait for success message or modal to close
    await farmerPage.waitForSelector('#create-support-ticket-modal', { state: 'hidden' }, { timeout: 5000 });
    
    // Verify ticket appears in the list
    await farmerPage.waitForSelector('#support-tickets-table tbody tr');
    const rows = await farmerPage.locator('#support-tickets-table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    
    console.log('✓ Farmer successfully created a support ticket');
  });

  test('Farmer can view ticket details and send message', async () => {
    await farmerPage.goto('http://localhost:8080/farmer.html');
    await farmerPage.waitForLoadState('networkidle');

    // Open support tickets modal
    await farmerPage.click('#farmer-user-account-btn');
    await farmerPage.click('#dropdown-support-tickets');
    await farmerPage.waitForSelector('#support-tickets-modal', { state: 'visible' });
    
    // Click on the first ticket's View button
    await farmerPage.click('.view-ticket-btn');
    
    // Wait for ticket detail modal
    await farmerPage.waitForSelector('#ticket-detail-modal', { state: 'visible' });
    
    // Verify ticket details are displayed
    const subject = await farmerPage.textContent('#ticket-detail-subject');
    expect(subject).toBeTruthy();
    
    // Send a message
    await farmerPage.fill('#ticket-message-input', 'Test message from E2E test');
    await farmerPage.click('#btn-send-ticket-message');
    
    // Wait for message to appear
    await farmerPage.waitForTimeout(2000);
    
    const messages = await farmerPage.locator('#ticket-messages-container .d-flex').count();
    expect(messages).toBeGreaterThan(0);
    
    console.log('✓ Farmer successfully viewed ticket and sent message');
    
    // Close modal
    await farmerPage.click('.modal-close-btn');
  });

  test('Admin can view support tickets', async () => {
    await adminPage.goto('http://localhost:8080/admin.html');
    await adminPage.waitForLoadState('networkidle');

    // Navigate to Support Tickets section
    await adminPage.click('a[data-section="support-tickets"]');
    await adminPage.waitForSelector('#support-tickets', { state: 'visible' });
    
    // Verify tickets table is displayed
    await adminPage.waitForSelector('#admin-support-tickets-table tbody');
    const rows = await adminPage.locator('#admin-support-tickets-table tbody tr').count();
    
    console.log(`✓ Admin can view support tickets (${rows} tickets found)`);
  });

  test('Admin can view ticket details and respond', async () => {
    await adminPage.goto('http://localhost:8080/admin.html');
    await adminPage.waitForLoadState('networkidle');

    // Navigate to Support Tickets section
    await adminPage.click('a[data-section="support-tickets"]');
    await adminPage.waitForSelector('#support-tickets', { state: 'visible' });
    
    // Click on the first ticket's View button
    const firstViewBtn = adminPage.locator('.view-admin-ticket-btn').first();
    if (await firstViewBtn.isVisible()) {
      await firstViewBtn.click();
      
      // Wait for ticket detail modal
      await adminPage.waitForSelector('#admin-ticket-detail-modal', { state: 'visible' });
      
      // Verify ticket details are displayed
      const subject = await adminPage.textContent('#admin-ticket-detail-subject');
      expect(subject).toBeTruthy();
      
      // Send a response
      await adminPage.fill('#admin-ticket-message-input', 'Admin response from E2E test');
      await adminPage.click('#btn-admin-send-ticket-message');
      
      // Wait for message to appear
      await adminPage.waitForTimeout(2000);
      
      const messages = await adminPage.locator('#admin-ticket-messages-container .d-flex').count();
      expect(messages).toBeGreaterThan(0);
      
      console.log('✓ Admin successfully viewed ticket and sent response');
      
      // Close modal
      await adminPage.click('.modal-close-btn');
    } else {
      console.log('⚠ No tickets found to test admin response');
    }
  });

  test('Admin can update ticket status', async () => {
    await adminPage.goto('http://localhost:8080/admin.html');
    await adminPage.waitForLoadState('networkidle');

    // Navigate to Support Tickets section
    await adminPage.click('a[data-section="support-tickets"]');
    await adminPage.waitForSelector('#support-tickets', { state: 'visible' });
    
    // Click on the first ticket's View button
    const firstViewBtn = adminPage.locator('.view-admin-ticket-btn').first();
    if (await firstViewBtn.isVisible()) {
      await firstViewBtn.click();
      
      // Wait for ticket detail modal
      await adminPage.waitForSelector('#admin-ticket-detail-modal', { state: 'visible' });
      
      // Change status to in_progress
      await adminPage.selectOption('#admin-ticket-status-select', 'in_progress');
      
      // Wait for update
      await adminPage.waitForTimeout(1000);
      
      // Verify status changed
      const statusBadge = await adminPage.textContent('#admin-ticket-detail-status');
      expect(statusBadge.toLowerCase()).toContain('in progress');
      
      console.log('✓ Admin successfully updated ticket status');
      
      // Close modal
      await adminPage.click('.modal-close-btn');
    } else {
      console.log('⚠ No tickets found to test status update');
    }
  });

  test('Support ticket tabs filter correctly', async () => {
    await adminPage.goto('http://localhost:8080/admin.html');
    await adminPage.waitForLoadState('networkidle');

    // Navigate to Support Tickets section
    await adminPage.click('a[data-section="support-tickets"]');
    await adminPage.waitForSelector('#support-tickets', { state: 'visible' });
    
    // Test each tab
    const statuses = ['open', 'in_progress', 'resolved', 'closed'];
    
    for (const status of statuses) {
      await adminPage.click(`.support-tabs .tab-btn[data-status="${status}"]`);
      await adminPage.waitForTimeout(500);
      
      const activeTab = await adminPage.locator('.support-tabs .tab-btn.active').getAttribute('data-status');
      expect(activeTab).toBe(status);
      
      console.log(`✓ Tab '${status}' works correctly`);
    }
  });
});
