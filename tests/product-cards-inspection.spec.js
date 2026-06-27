const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

test.describe('Product Cards DOM Inspection', () => {
  test('Inspect Available Product Card Structure', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Scroll to available products
    await page.evaluate(() => {
      document.querySelector('#available-now')?.scrollIntoView({ behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    // Get first available product card
    const firstCard = page.locator('#available-grid .product-card').first();
    const cardCount = await page.locator('#available-grid .product-card').count();
    console.log(`Available product cards: ${cardCount}`);

    if (cardCount > 0) {
      // Inspect card structure
      const cardHTML = await firstCard.evaluate(el => el.outerHTML);
      console.log('First available product card HTML:');
      console.log(cardHTML);

      // Check for key elements
      const hasImage = await firstCard.locator('img').count() > 0;
      const hasName = await firstCard.locator('h3, .product-name').count() > 0;
      const hasPrice = await firstCard.evaluate(el => el.textContent.includes('₱'));
      const hasBadge = await firstCard.locator('[class*="badge"], [class*="status"]').count() > 0;
      const hasButton = await firstCard.locator('button').count() > 0;

      console.log(`Has image: ${hasImage}`);
      console.log(`Has name: ${hasName}`);
      console.log(`Has price: ${hasPrice}`);
      console.log(`Has badge: ${hasBadge}`);
      console.log(`Has button: ${hasButton}`);

      // Get badge text
      const badgeText = await firstCard.locator('[class*="badge"], [class*="status"]').first().textContent().catch(() => 'N/A');
      console.log(`Badge text: ${badgeText}`);

      // Get button text
      const buttonText = await firstCard.locator('button').first().textContent();
      console.log(`Button text: ${buttonText}`);
    }
  });

  test('Inspect Pre-order Product Card Structure', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Scroll to preorder products
    await page.evaluate(() => {
      document.querySelector('#preorder')?.scrollIntoView({ behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    // Get first preorder product card
    const firstCard = page.locator('#preorder-grid .product-card').first();
    const cardCount = await page.locator('#preorder-grid .product-card').count();
    console.log(`Pre-order product cards: ${cardCount}`);

    if (cardCount > 0) {
      // Inspect card structure
      const cardHTML = await firstCard.evaluate(el => el.outerHTML);
      console.log('First pre-order product card HTML:');
      console.log(cardHTML);

      // Check for key elements
      const hasImage = await firstCard.locator('img').count() > 0;
      const hasName = await firstCard.locator('h3, .product-name').count() > 0;
      const hasPrice = await firstCard.evaluate(el => el.textContent.includes('₱'));
      const hasBadge = await firstCard.locator('[class*="badge"], [class*="status"]').count() > 0;
      const hasButton = await firstCard.locator('button').count() > 0;

      console.log(`Has image: ${hasImage}`);
      console.log(`Has name: ${hasName}`);
      console.log(`Has price: ${hasPrice}`);
      console.log(`Has badge: ${hasBadge}`);
      console.log(`Has button: ${hasButton}`);

      // Get badge text
      const badgeText = await firstCard.locator('[class*="badge"], [class*="status"]').first().textContent().catch(() => 'N/A');
      console.log(`Badge text: ${badgeText}`);

      // Get button text
      const buttonText = await firstCard.locator('button').first().textContent();
      console.log(`Button text: ${buttonText}`);

      // Check for harvest info
      const hasHarvestInfo = await firstCard.evaluate(el => el.textContent.includes('Expected Harvest') || el.textContent.includes('HARVEST'));
      console.log(`Has harvest info: ${hasHarvestInfo}`);
    }
  });

  test('Check Badge Text Format', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check all badges on page
    const badges = page.locator('[class*="badge"], [class*="status"], .product-card > div:first-child');
    const badgeCount = await badges.count();
    console.log(`Total badges found: ${badgeCount}`);

    for (let i = 0; i < Math.min(badgeCount, 10); i++) {
      const text = await badges.nth(i).textContent();
      console.log(`Badge ${i}: "${text}"`);
    }
  });
});
