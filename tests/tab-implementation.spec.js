const { test, expect } = require('@playwright/test');
const { getAdminToken } = require('./auth-helper');
const fs = require('fs');
const path = require('path');

let authToken;
let adminUser;

test.beforeAll(async () => {
  const result = await getAdminToken();
  authToken = result.token;
  adminUser = result.user;
  console.log(`Authenticated as admin: ${adminUser.email} (${adminUser.role})`);
});

test.describe('Tab Implementation Tests', () => {
  let adminHtmlContent;

  test.beforeAll(async () => {
    // Read the admin.html file directly
    const adminHtmlPath = path.join(__dirname, '..', 'frontend', 'admin.html');
    adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');
  });

  test('Orders tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('order-tabs');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="pending"');
    expect(adminHtmlContent).toContain('data-status="confirmed"');
    expect(adminHtmlContent).toContain('data-status="cancelled"');
  });

  test('Users tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('users-tabs');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="active"');
    expect(adminHtmlContent).toContain('data-status="disabled"');
  });

  test('Products tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('products-tabs');
    expect(adminHtmlContent).toContain('data-status="available"');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="disabled"');
  });

  test('Categories tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('categories-tabs');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="active"');
    expect(adminHtmlContent).toContain('data-status="disabled"');
  });

  test('Catalog Products tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('catalog-tabs');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="active"');
    expect(adminHtmlContent).toContain('data-status="disabled"');
  });

  test('Farmers tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('farmers-tabs');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="active"');
    expect(adminHtmlContent).toContain('data-status="disabled"');
  });

  test('Admin tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('admin-tabs');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="active"');
    expect(adminHtmlContent).toContain('data-status="disabled"');
  });

  test('All Users tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('all-users-tabs');
    expect(adminHtmlContent).toContain('data-status=""');
    expect(adminHtmlContent).toContain('data-status="active"');
    expect(adminHtmlContent).toContain('data-status="disabled"');
  });

  test('Verification Requests tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('verification-tabs');
    expect(adminHtmlContent).toContain('data-status="all"');
    expect(adminHtmlContent).toContain('data-status="pending"');
    expect(adminHtmlContent).toContain('data-status="approved"');
  });

  test('Subscription Requests tabs exist in HTML', async () => {
    expect(adminHtmlContent).toContain('subscription-tabs');
    expect(adminHtmlContent).toContain('data-status="all"');
    expect(adminHtmlContent).toContain('data-status="pending"');
    expect(adminHtmlContent).toContain('data-status="active"');
    expect(adminHtmlContent).toContain('data-status="rejected"');
    expect(adminHtmlContent).toContain('data-status="expired"');
  });

  test('Search button styling is consistent', async () => {
    expect(adminHtmlContent).toContain('verification-requests-search-btn');
    expect(adminHtmlContent).toContain('subscriptions-search-btn');
    expect(adminHtmlContent).toContain('product-approval-search-btn');
    expect(adminHtmlContent).toContain('background: #41bf5b');
    expect(adminHtmlContent).toContain('border-radius: 8px');
  });

  test('Subscription requests table does not have Reason column', async () => {
    // Check the subscriptions table header
    const subscriptionsTableMatch = adminHtmlContent.match(/<table[^>]*id="subscriptions-table"[^>]*>[\s\S]*?<\/table>/);
    expect(subscriptionsTableMatch).toBeTruthy();
    
    const tableContent = subscriptionsTableMatch[0];
    expect(tableContent).not.toContain('<th>Reason</th>');
    expect(tableContent).toContain('<th>Farmer</th>');
    expect(tableContent).toContain('<th>Plan</th>');
    expect(tableContent).toContain('<th>Amount</th>');
    expect(tableContent).toContain('<th>Payment To</th>');
    expect(tableContent).toContain('<th>Date</th>');
    expect(tableContent).toContain('<th>Status</th>');
    expect(tableContent).toContain('<th>Proof</th>');
    expect(tableContent).toContain('<th>Actions</th>');
  });
});
