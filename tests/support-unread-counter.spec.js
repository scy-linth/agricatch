const { test, expect } = require('@playwright/test');

test('Support Center unread counter shows correct count for multiple tickets', async ({ page }) => {
    // Test configuration
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    
    // Farmer credentials
    const farmerEmail = 'testfarmer@example.com';
    const farmerPassword = 'testpass123';
    
    // Admin credentials
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';

    // Step 1: Login as farmer
    await page.goto(baseURL);
    await page.click('text=Login');
    await page.fill('#auth-email', farmerEmail);
    await page.fill('#auth-password', farmerPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/farmer.html', { timeout: 10000 });

    // Step 2: Create first support ticket
    await page.goto(`${baseURL}/farmer.html#shop`);
    await page.waitForSelector('#support-center-btn', { timeout: 5000 });
    await page.click('#support-center-btn');
    
    await page.waitForSelector('#create-ticket-btn', { timeout: 5000 });
    await page.click('#create-ticket-btn');
    
    await page.fill('#ticket-subject', 'Test Ticket 1');
    await page.fill('#ticket-description', 'This is test ticket 1 for unread counter test');
    await page.selectOption('#ticket-priority', 'medium');
    await page.click('#submit-ticket-btn');
    await page.waitForSelector('.ticket-item', { timeout: 5000 });
    
    // Get first ticket ID
    const firstTicketElement = await page.locator('.ticket-item').first();
    const firstTicketId = await firstTicketElement.getAttribute('data-ticket-id');
    console.log('First ticket ID:', firstTicketId);

    // Step 3: Send message to first ticket
    await page.click(`[data-ticket-id="${firstTicketId}"]`);
    await page.waitForSelector('#chat-input', { timeout: 5000 });
    await page.fill('#chat-input', 'Test message for ticket 1');
    await page.click('#send-message-btn');
    await page.waitForTimeout(1000);

    // Step 4: Create second support ticket
    await page.click('#back-to-shop-btn');
    await page.click('#support-center-btn');
    await page.click('#create-ticket-btn');
    
    await page.fill('#ticket-subject', 'Test Ticket 2');
    await page.fill('#ticket-description', 'This is test ticket 2 for unread counter test');
    await page.selectOption('#ticket-priority', 'medium');
    await page.click('#submit-ticket-btn');
    await page.waitForSelector('.ticket-item', { timeout: 5000 });
    
    // Get second ticket ID
    const ticketElements = await page.locator('.ticket-item').all();
    const secondTicketElement = ticketElements[ticketElements.length - 1];
    const secondTicketId = await secondTicketElement.getAttribute('data-ticket-id');
    console.log('Second ticket ID:', secondTicketId);

    // Step 5: Send message to second ticket
    await page.click(`[data-ticket-id="${secondTicketId}"]`);
    await page.waitForSelector('#chat-input', { timeout: 5000 });
    await page.fill('#chat-input', 'Test message for ticket 2');
    await page.click('#send-message-btn');
    await page.waitForTimeout(1000);

    // Step 6: Logout farmer
    await page.click('#logout-btn');
    await page.waitForURL('**/index.html', { timeout: 5000 });

    // Step 7: Login as admin
    await page.click('text=Login');
    await page.fill('#auth-email', adminEmail);
    await page.fill('#auth-password', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin.html', { timeout: 10000 });

    // Step 8: Navigate to Support Center
    await page.click('a[href="#chat"]');
    await page.waitForSelector('#chat', { timeout: 5000 });

    // Step 9: Check unread counter badge
    await page.waitForTimeout(2000); // Wait for badge to load
    
    const sidebarBadge = page.locator('#chat-support-badge');
    const topbarBadge = page.locator('#chat-topbar-badge');
    
    const sidebarBadgeText = await sidebarBadge.textContent();
    const topbarBadgeText = await topbarBadge.textContent();
    
    console.log('Sidebar badge:', sidebarBadgeText);
    console.log('Topbar badge:', topbarBadgeText);
    
    // Both badges should show "2" (2 tickets with unread messages)
    expect(sidebarBadgeText).toBe('2');
    expect(topbarBadgeText).toBe('2');
});
