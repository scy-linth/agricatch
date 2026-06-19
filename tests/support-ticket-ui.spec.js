const { test, expect } = require('@playwright/test');

test.describe('Support Ticket UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to farmer page
    await page.goto('http://localhost:8080/farmer.html');
    await page.waitForLoadState('networkidle');
  });

  test('Support tickets dropdown link exists', async ({ page }) => {
    // Check if the support tickets dropdown link exists
    const supportTicketsLink = page.locator('#dropdown-support-tickets');
    await expect(supportTicketsLink).toBeVisible();
    
    // Check if it has the correct icon
    const icon = supportTicketsLink.locator('.bi-ticket-perforated');
    await expect(icon).toBeVisible();
    
    console.log('✓ Support tickets dropdown link exists');
  });

  test('Support tickets modal exists in DOM', async ({ page }) => {
    // Check if the support tickets modal exists
    const modal = page.locator('#support-tickets-modal');
    await expect(modal).toHaveCount(1);
    
    // Check if create ticket modal exists
    const createModal = page.locator('#create-support-ticket-modal');
    await expect(createModal).toHaveCount(1);
    
    // Check if ticket detail modal exists
    const detailModal = page.locator('#ticket-detail-modal');
    await expect(detailModal).toHaveCount(1);
    
    console.log('✓ All support ticket modals exist in DOM');
  });

  test('Support ticket form elements exist', async ({ page }) => {
    // Check create ticket form elements
    const subjectInput = page.locator('#support-ticket-subject');
    await expect(subjectInput).toHaveCount(1);
    
    const descriptionInput = page.locator('#support-ticket-description');
    await expect(descriptionInput).toHaveCount(1);
    
    const prioritySelect = page.locator('#support-ticket-priority');
    await expect(prioritySelect).toHaveCount(1);
    
    const submitBtn = page.locator('#btn-submit-support-ticket');
    await expect(submitBtn).toHaveCount(1);
    
    console.log('✓ Support ticket form elements exist');
  });

  test('Support ticket table exists', async ({ page }) => {
    // Check if the support tickets table exists
    const table = page.locator('#support-tickets-table');
    await expect(table).toHaveCount(1);
    
    // Check table headers
    const headers = table.locator('thead th');
    await expect(headers).toHaveCount(6);
    
    console.log('✓ Support ticket table exists with correct headers');
  });

  test('Character counters exist', async ({ page }) => {
    // Check character counters
    const subjectCounter = page.locator('#subject-char-count');
    await expect(subjectCounter).toHaveCount(1);
    
    const descriptionCounter = page.locator('#description-char-count');
    await expect(descriptionCounter).toHaveCount(1);
    
    const messageCounter = page.locator('#ticket-message-char-count');
    await expect(messageCounter).toHaveCount(1);
    
    console.log('✓ Character counters exist');
  });
});

test.describe('Admin Support Ticket UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin page
    await page.goto('http://localhost:8080/admin.html');
    await page.waitForLoadState('networkidle');
  });

  test('Support tickets sidebar link exists', async ({ page }) => {
    // Check if the support tickets sidebar link exists
    const supportTicketsLink = page.locator('a[data-section="support-tickets"]');
    await expect(supportTicketsLink).toBeVisible();
    
    // Check if it has the correct icon
    const icon = supportTicketsLink.locator('.bi-life-preserver');
    await expect(icon).toBeVisible();
    
    console.log('✓ Admin support tickets sidebar link exists');
  });

  test('Support tickets section exists', async ({ page }) => {
    // Check if the support tickets section exists
    const section = page.locator('#support-tickets');
    await expect(section).toHaveCount(1);
    
    console.log('✓ Admin support tickets section exists');
  });

  test('Admin support ticket table exists', async ({ page }) => {
    // Check if the admin support tickets table exists
    const table = page.locator('#admin-support-tickets-table');
    await expect(table).toHaveCount(1);
    
    // Check table headers
    const headers = table.locator('thead th');
    await expect(headers).toHaveCount(7);
    
    console.log('✓ Admin support ticket table exists with correct headers');
  });

  test('Support ticket tabs exist', async ({ page }) => {
    // Check if support ticket tabs exist
    const tabs = page.locator('.support-tabs .tab-btn');
    await expect(tabs).toHaveCount(4);
    
    // Check tab values
    const openTab = page.locator('.support-tabs .tab-btn[data-status="open"]');
    await expect(openTab).toBeVisible();
    
    const inProgressTab = page.locator('.support-tabs .tab-btn[data-status="in_progress"]');
    await expect(inProgressTab).toBeVisible();
    
    const resolvedTab = page.locator('.support-tabs .tab-btn[data-status="resolved"]');
    await expect(resolvedTab).toBeVisible();
    
    const closedTab = page.locator('.support-tabs .tab-btn[data-status="closed"]');
    await expect(closedTab).toBeVisible();
    
    console.log('✓ Support ticket tabs exist with correct values');
  });

  test('Admin ticket detail modal exists', async ({ page }) => {
    // Check if the admin ticket detail modal exists
    const modal = page.locator('#admin-ticket-detail-modal');
    await expect(modal).toHaveCount(1);
    
    // Check if status select exists
    const statusSelect = page.locator('#admin-ticket-status-select');
    await expect(statusSelect).toHaveCount(1);
    
    console.log('✓ Admin ticket detail modal exists');
  });
});
