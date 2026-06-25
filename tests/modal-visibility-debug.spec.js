const { test, expect } = require('@playwright/test');

test.describe('Product Modal Visibility Debug', () => {
  test('should show products behind modal when opened', async ({ page }) => {
    // Navigate to landing page
    await page.goto('http://localhost:3000/index.html');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Get initial state of products
    const productsBeforeModal = await page.locator('.product-card').count();
    console.log('Products before modal:', productsBeforeModal);
    
    // Check if products are visible
    const firstProductBefore = page.locator('.product-card').first();
    const isVisibleBefore = await firstProductBefore.isVisible();
    console.log('First product visible before modal:', isVisibleBefore);
    
    // Check body overflow before modal
    const bodyOverflowBefore = await page.evaluate(() => document.body.style.overflow);
    const htmlOverflowBefore = await page.evaluate(() => document.documentElement.style.overflow);
    console.log('Body overflow before:', bodyOverflowBefore);
    console.log('HTML overflow before:', htmlOverflowBefore);
    
    // Check body position before modal
    const bodyPositionBefore = await page.evaluate(() => document.body.style.position);
    const bodyTopBefore = await page.evaluate(() => document.body.style.top);
    console.log('Body position before:', bodyPositionBefore);
    console.log('Body top before:', bodyTopBefore);
    
    // Check header position before modal
    const headerRectBefore = await page.evaluate(() => {
      const header = document.querySelector('.header');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width
      };
    });
    console.log('Header rect before modal:', headerRectBefore);
    
    // Check cart button position before modal
    const cartRectBefore = await page.evaluate(() => {
      const cart = document.querySelector('.float-cart-btn');
      if (!cart) return null;
      const rect = cart.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width
      };
    });
    console.log('Cart button rect before modal:', cartRectBefore);
    
    // Click on first product to open modal
    await firstProductBefore.click();
    
    // Wait for modal to open
    await page.waitForSelector('#product-details-modal.active', { timeout: 5000 });
    
    // Check modal state
    const modalActive = await page.locator('#product-details-modal').evaluate(el => el.classList.contains('active'));
    console.log('Modal active:', modalActive);
    
    // Check modal overlay background
    const overlayBackground = await page.evaluate(() => {
      const overlay = document.querySelector('.product-details-overlay');
      return overlay ? window.getComputedStyle(overlay).background : 'not found';
    });
    console.log('Overlay background:', overlayBackground);
    
    // Check modal content background
    const contentBackground = await page.evaluate(() => {
      const content = document.querySelector('.product-details-content');
      return content ? window.getComputedStyle(content).background : 'not found';
    });
    console.log('Content background:', contentBackground);
    
    // Check body overflow after modal
    const bodyOverflowAfter = await page.evaluate(() => document.body.style.overflow);
    const htmlOverflowAfter = await page.evaluate(() => document.documentElement.style.overflow);
    console.log('Body overflow after:', bodyOverflowAfter);
    console.log('HTML overflow after:', htmlOverflowAfter);
    
    // Check body position after modal
    const bodyPositionAfter = await page.evaluate(() => document.body.style.position);
    const bodyTopAfter = await page.evaluate(() => document.body.style.top);
    console.log('Body position after:', bodyPositionAfter);
    console.log('Body top after:', bodyTopAfter);
    
    // Check header position after modal
    const headerRectAfter = await page.evaluate(() => {
      const header = document.querySelector('.header');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width
      };
    });
    console.log('Header rect after modal:', headerRectAfter);
    
    // Check cart button position after modal
    const cartRectAfter = await page.evaluate(() => {
      const cart = document.querySelector('.float-cart-btn');
      if (!cart) return null;
      const rect = cart.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width
      };
    });
    console.log('Cart button rect after modal:', cartRectAfter);
    
    // Calculate layout shift
    if (headerRectBefore && headerRectAfter) {
      const headerShift = Math.abs(headerRectBefore.right - headerRectAfter.right);
      console.log('Header horizontal shift:', headerShift);
    }
    if (cartRectBefore && cartRectAfter) {
      const cartShift = Math.abs(cartRectBefore.right - cartRectAfter.right);
      console.log('Cart button horizontal shift:', cartShift);
    }
    
    // Check if products are still visible after modal opens
    const firstProductAfter = page.locator('.product-card').first();
    const isVisibleAfter = await firstProductAfter.isVisible();
    console.log('First product visible after modal:', isVisibleAfter);
    
    // Check if products are in viewport
    const isInViewport = await page.evaluate(() => {
      const product = document.querySelector('.product-card');
      if (!product) return false;
      const rect = product.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
    });
    console.log('First product in viewport:', isInViewport);
    
    // Check if products are obscured by modal content
    const isObscured = await page.evaluate(() => {
      const product = document.querySelector('.product-card');
      const modalContent = document.querySelector('.product-details-content');
      if (!product || !modalContent) return false;
      
      const productRect = product.getBoundingClientRect();
      const modalRect = modalContent.getBoundingClientRect();
      
      // Check if modal covers the product
      return !(productRect.right < modalRect.left || 
               productRect.left > modalRect.right || 
               productRect.bottom < modalRect.top || 
               productRect.top > modalRect.bottom);
    });
    console.log('Product obscured by modal content:', isObscured);
    
    // Check modal z-index
    const modalZIndex = await page.evaluate(() => {
      const modal = document.querySelector('#product-details-modal');
      return modal ? window.getComputedStyle(modal).zIndex : 'not found';
    });
    console.log('Modal z-index:', modalZIndex);
    
    // Check products z-index
    const productZIndex = await page.evaluate(() => {
      const product = document.querySelector('.product-card');
      return product ? window.getComputedStyle(product).zIndex : 'not found';
    });
    console.log('Product z-index:', productZIndex);
    
    // Check hero video state
    const heroVideoVisible = await page.locator('.hero-video').isVisible();
    console.log('Hero video visible:', heroVideoVisible);
    
    const heroVideoPosition = await page.evaluate(() => {
      const video = document.querySelector('.hero-video');
      return video ? window.getComputedStyle(video).position : 'not found';
    });
    console.log('Hero video position:', heroVideoPosition);
    
    const heroVideoZIndex = await page.evaluate(() => {
      const video = document.querySelector('.hero-video');
      return video ? window.getComputedStyle(video).zIndex : 'not found';
    });
    console.log('Hero video z-index:', heroVideoZIndex);
    
    const heroVideoDisplay = await page.evaluate(() => {
      const video = document.querySelector('.hero-video');
      return video ? window.getComputedStyle(video).display : 'not found';
    });
    console.log('Hero video display:', heroVideoDisplay);
    
    // Check hero section state
    const heroSectionPosition = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      return hero ? window.getComputedStyle(hero).position : 'not found';
    });
    console.log('Hero section position:', heroSectionPosition);
    
    const heroSectionZIndex = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      return hero ? window.getComputedStyle(hero).zIndex : 'not found';
    });
    console.log('Hero section z-index:', heroSectionZIndex);
    
    // Check if hero is covering the viewport
    const heroCoversViewport = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      if (!hero) return false;
      const rect = hero.getBoundingClientRect();
      return rect.top <= 0 && rect.left <= 0 && rect.right >= window.innerWidth && rect.bottom >= window.innerHeight;
    });
    console.log('Hero covers viewport:', heroCoversViewport);
    
    // Check scroll position
    const scrollY = await page.evaluate(() => window.scrollY);
    const scrollX = await page.evaluate(() => window.scrollX);
    console.log('Scroll Y:', scrollY);
    console.log('Scroll X:', scrollX);
    
    const bodyScrollTop = await page.evaluate(() => document.body.scrollTop);
    console.log('Body scrollTop:', bodyScrollTop);
    
    // Check hero bounding rect
    const heroRect = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      if (!hero) return null;
      const rect = hero.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    });
    console.log('Hero rect:', heroRect);
    
    // Check viewport dimensions
    const viewportSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    console.log('Viewport size:', viewportSize);
    
    // Check if products section is visible
    const productsSectionVisible = await page.locator('#products').isVisible();
    console.log('Products section visible:', productsSectionVisible);
    
    const productsSectionRect = await page.evaluate(() => {
      const products = document.querySelector('#products');
      if (!products) return null;
      const rect = products.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    });
    console.log('Products section rect:', productsSectionRect);
    
    // Check modal content size and position
    const modalContentRect = await page.evaluate(() => {
      const content = document.querySelector('.product-details-content');
      if (!content) return null;
      const rect = content.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    });
    console.log('Modal content rect:', modalContentRect);
    
    // Check modal overlay size and position
    const modalOverlayRect = await page.evaluate(() => {
      const overlay = document.querySelector('.product-details-overlay');
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    });
    console.log('Modal overlay rect:', modalOverlayRect);
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: 'modal-open-debug.png', fullPage: true });
    console.log('Screenshot saved as modal-open-debug.png');
    
    // Close modal
    await page.click('.product-details-close');
    await page.waitForSelector('#product-details-modal:not(.active)', { timeout: 5000 });
    
    // Check if products are visible after closing
    const isVisibleAfterClose = await firstProductAfter.isVisible();
    console.log('First product visible after close:', isVisibleAfterClose);
  });
});
