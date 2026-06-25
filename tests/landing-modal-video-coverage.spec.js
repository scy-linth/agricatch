const { test, expect } = require('@playwright/test');

test.describe('Landing Page Modal Video Coverage Bug', () => {
  test('should NOT have hero video covering products when modal opens', async ({ page }) => {
    // Navigate to landing page
    await page.goto('http://localhost:3000/index.html');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Scroll to products section
    await page.evaluate(() => {
      document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Wait for scroll to complete
    await page.waitForTimeout(500);
    
    // Get initial scroll position
    const scrollYBefore = await page.evaluate(() => window.scrollY);
    console.log('Scroll Y before modal:', scrollYBefore);
    
    // Check if products are visible before modal
    const productsSectionVisibleBefore = await page.locator('#products').isVisible();
    console.log('Products section visible before modal:', productsSectionVisibleBefore);
    
    // Check hero video position before modal
    const heroRectBefore = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      if (!hero) return null;
      const rect = hero.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height
      };
    });
    console.log('Hero rect before modal:', heroRectBefore);
    
    // Check if hero video is covering products before modal
    const videoCoversProductsBefore = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      const products = document.querySelector('#products');
      if (!hero || !products) return false;
      
      const heroRect = hero.getBoundingClientRect();
      const productsRect = products.getBoundingClientRect();
      
      // Check if hero bottom is below products top (hero is covering products)
      return heroRect.bottom > productsRect.top;
    });
    console.log('Hero video covers products before modal:', videoCoversProductsBefore);
    
    // Click on first product to open modal
    const firstProduct = page.locator('.product-card').first();
    await firstProduct.click();
    
    // Wait for modal to open
    await page.waitForSelector('#product-details-modal.active', { timeout: 5000 });
    
    // Check if products are still visible after modal opens
    const productsSectionVisibleAfter = await page.locator('#products').isVisible();
    console.log('Products section visible after modal:', productsSectionVisibleAfter);
    
    // Check hero video position after modal
    const heroRectAfter = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      if (!hero) return null;
      const rect = hero.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height
      };
    });
    console.log('Hero rect after modal:', heroRectAfter);
    
    // Check if hero video is covering products after modal
    const videoCoversProductsAfter = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      const products = document.querySelector('#products');
      if (!hero || !products) return false;
      
      const heroRect = hero.getBoundingClientRect();
      const productsRect = products.getBoundingClientRect();
      
      // Check if hero bottom is below products top (hero is covering products)
      return heroRect.bottom > productsRect.top;
    });
    console.log('Hero video covers products after modal:', videoCoversProductsAfter);
    
    // The bug: hero video should NOT cover products when modal is open
    // If videoCoversProductsAfter is true, the bug exists
    expect(videoCoversProductsAfter).toBe(false);
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: 'modal-video-coverage-bug.png', fullPage: true });
    console.log('Screenshot saved as modal-video-coverage-bug.png');
    
    // Close modal
    await page.click('.product-details-close');
    await page.waitForSelector('#product-details-modal:not(.active)', { timeout: 5000 });
  });

  test('should NOT have hero video covering products when login modal opens', async ({ page }) => {
    // Navigate to landing page
    await page.goto('http://localhost:3000/index.html');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Scroll to products section
    await page.evaluate(() => {
      document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Wait for scroll to complete
    await page.waitForTimeout(500);
    
    // Click login button to open auth modal
    await page.click('#login-btn');
    
    // Wait for modal to open
    await page.waitForSelector('#auth-modal.modal.open', { timeout: 5000 });
    
    // Check if hero video is covering products after modal opens
    const videoCoversProductsAfter = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      const products = document.querySelector('#products');
      if (!hero || !products) return false;
      
      const heroRect = hero.getBoundingClientRect();
      const productsRect = products.getBoundingClientRect();
      
      // Check if hero bottom is below products top (hero is covering products)
      return heroRect.bottom > productsRect.top;
    });
    console.log('Hero video covers products after login modal:', videoCoversProductsAfter);
    
    // The bug: hero video should NOT cover products when modal is open
    expect(videoCoversProductsAfter).toBe(false);
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: 'login-modal-video-coverage-bug.png', fullPage: true });
    console.log('Screenshot saved as login-modal-video-coverage-bug.png');
    
    // Close modal
    await page.click('#auth-close-btn');
    await page.waitForSelector('#auth-modal', { state: 'hidden', timeout: 5000 });
  });
});
