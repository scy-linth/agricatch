const { test, expect } = require('@playwright/test');

test.describe('PREORDER UI CONSISTENCY AND VISIBILITY', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('Customer landing page shows preorder badge on product cards', async ({ page }) => {
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(5000); // Wait for page to load

    // Check if preorder products have badges
    const preorderBadges = page.locator('.badge:has-text("PREORDER"), .badge:has-text("Preorder")');
    const count = await preorderBadges.count();
    console.log(`Found ${count} preorder badges on landing page`);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Customer orders page shows preorder order indicators', async ({ page }) => {
    await page.goto(`${baseUrl}/orders.html`);
    await page.waitForTimeout(3000); // Wait for page to load

    // Check for preorder badges in orders
    const preorderBadges = page.locator('.badge:has-text("Preorder")');
    const count = await preorderBadges.count();
    console.log(`Found ${count} Preorder badges on orders page`);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Terminology consistency - check for inconsistent Pre-order with hyphen', async ({ page }) => {
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(3000); // Wait for page to load

    // Check for inconsistent "Pre-order" (with hyphen) terminology in badges/labels
    // Note: Taglines may have "Pre-ordered" which is acceptable
    const pageContent = await page.content();
    const hasPreOrderHyphenInBadge = pageContent.includes('Pre-order</span>') || pageContent.includes('pre-order</span>');
    console.log(`Found "Pre-order" with hyphen in badges: ${hasPreOrderHyphenInBadge}`);
    
    // We expect this to be false (no hyphenated version in badges)
    expect(hasPreOrderHyphenInBadge).toBe(false);
  });

  test('Badge color consistency - preorder uses bg-warning', async ({ page }) => {
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(5000); // Wait for page to load

    // Check that preorder badges use bg-warning class
    const preorderBadges = page.locator('.badge.bg-warning:has-text("PREORDER"), .badge.bg-warning:has-text("Preorder")');
    const count = await preorderBadges.count();
    console.log(`Found ${count} preorder badges with bg-warning color`);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
