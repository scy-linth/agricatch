const { test, expect } = require('@playwright/test');

/**
 * GUEST ROLE UI & INTERACTION REGRESSION AUDIT
 * 
 * Audit Scope:
 * - Buttons: Missing actions, wrong actions, disabled incorrectly, duplicate buttons
 * - Tables: Missing columns, wrong badges, wrong status, missing information, alignment issues
 * - Modals: Missing fields, missing labels, missing details, missing validation, wrong buttons
 * - Cards: Missing information, wrong badges, wrong spacing, empty state, loading state
 * - Sections: Missing headers, wrong titles, inconsistent labels
 * - Timeline: Verify every order status appears correctly
 * - Notifications: Verify every major action has appropriate notification
 * - Chat: Verify all expected actions are accessible
 * - Forms: Validation, required fields, placeholders, character counters, error messages, success messages
 * - Responsive: Desktop, Tablet, Mobile
 */

test.describe('Guest Role UI Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure guest state
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');
  });

  test('GUEST-001: Landing page header elements', async ({ page }) => {
    const issues = [];

    // Check logo
    const logo = page.locator('.logo-link');
    if (!(await logo.isVisible())) {
      issues.push('Logo not visible');
    }

    // Check navigation links
    const navLinks = ['Home', 'Featured', 'Products', 'About', 'Contact'];
    for (const linkText of navLinks) {
      const link = page.getByRole('link', { name: linkText });
      if (!(await link.isVisible())) {
        issues.push(`Navigation link "${linkText}" not visible`);
      }
    }

    // Check login/register buttons
    const loginBtn = page.locator('#login-btn');
    const registerBtn = page.locator('#register-btn');
    
    if (!(await loginBtn.isVisible())) {
      issues.push('Login button not visible');
    }
    if (!(await registerBtn.isVisible())) {
      issues.push('Register button not visible');
    }

    // Check button states
    if (await loginBtn.isDisabled()) {
      issues.push('Login button incorrectly disabled for guest');
    }
    if (await registerBtn.isDisabled()) {
      issues.push('Register button incorrectly disabled for guest');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-001 Issues:', issues);
    }
  });

  test('GUEST-002: Hero section elements', async ({ page }) => {
    const issues = [];

    // Check hero title
    const heroTitle = page.locator('.hero-content h2');
    if (!(await heroTitle.isVisible())) {
      issues.push('Hero title not visible');
    }

    // Check hero buttons
    const shopNowBtn = page.locator('#shop-now-btn');
    const browsePreordersBtn = page.locator('#browse-preorders-btn');

    if (!(await shopNowBtn.isVisible())) {
      issues.push('Shop Now button not visible');
    }
    if (!(await browsePreordersBtn.isVisible())) {
      issues.push('Browse Preorders button not visible');
    }

    // Check button actions
    if (await shopNowBtn.isDisabled()) {
      issues.push('Shop Now button incorrectly disabled');
    }
    if (await browsePreordersBtn.isDisabled()) {
      issues.push('Browse Preorders button incorrectly disabled');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-002 Issues:', issues);
    }
  });

  test('GUEST-003: Product cards in available section', async ({ page }) => {
    const issues = [];
    await page.waitForTimeout(2000); // Wait for products to load

    // Check if available section exists
    const availableSection = page.locator('#available-now');
    if (!(await availableSection.isVisible())) {
      issues.push('Available Now section not visible');
    }

    // Check product grid
    const productGrid = page.locator('#available-grid');
    if (!(await productGrid.isVisible())) {
      issues.push('Available products grid not visible');
    }

    // Check refresh button
    const refreshBtn = page.locator('#refresh-available-btn');
    if (!(await refreshBtn.isVisible())) {
      issues.push('Refresh available products button not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-003 Issues:', issues);
    }
  });

  test('GUEST-004: Product cards in preorder section', async ({ page }) => {
    const issues = [];
    await page.waitForTimeout(2000);

    // Check preorder section
    const preorderSection = page.locator('#preorder');
    if (!(await preorderSection.isVisible())) {
      issues.push('Preorder section not visible');
    }

    // Check preorder grid
    const preorderGrid = page.locator('#preorder-grid');
    if (!(await preorderGrid.isVisible())) {
      issues.push('Preorder products grid not visible');
    }

    // Check refresh button
    const refreshBtn = page.locator('#refresh-preorder-btn');
    if (!(await refreshBtn.isVisible())) {
      issues.push('Refresh preorder products button not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-004 Issues:', issues);
    }
  });

  test('GUEST-005: Featured section carousel', async ({ page }) => {
    const issues = [];
    await page.waitForTimeout(2000);

    // Check featured section
    const featuredSection = page.locator('#featured');
    if (!(await featuredSection.isVisible())) {
      issues.push('Featured section not visible');
    }

    // Check featured grid
    const featuredGrid = page.locator('#featured-grid');
    if (!(await featuredGrid.isVisible())) {
      issues.push('Featured products grid not visible');
    }

    // Check carousel dots
    const carouselDots = page.locator('#featured-dots');
    if (!(await carouselDots.isVisible())) {
      issues.push('Carousel dots not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-005 Issues:', issues);
    }
  });

  test('GUEST-006: Marketplace filter section', async ({ page }) => {
    const issues = [];

    // Check marketplace filter section
    const filterSection = page.locator('#marketplace-filter');
    if (!(await filterSection.isVisible())) {
      issues.push('Marketplace filter section not visible');
    }

    // Check search input
    const searchInput = page.locator('#global-search-input');
    if (!(await searchInput.isVisible())) {
      issues.push('Global search input not visible');
    }

    // Check category tabs
    const categoryTabs = page.locator('#global-category-tabs');
    if (!(await categoryTabs.isVisible())) {
      issues.push('Global category tabs not visible');
    }

    // Check sort select
    const sortSelect = page.locator('#global-sort-select');
    if (!(await sortSelect.isVisible())) {
      issues.push('Global sort select not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-006 Issues:', issues);
    }
  });

  test('GUEST-007: Product details modal', async ({ page }) => {
    const issues = [];
    await page.waitForTimeout(2000);

    // Try to open product details modal by clicking a product
    const firstProduct = page.locator('#available-grid .product-card').first();
    const count = await firstProduct.count();
    
    if (count > 0) {
      await firstProduct.click();
      await page.waitForTimeout(500);

      // Check modal visibility
      const modal = page.locator('#product-details-modal');
      if (!(await modal.isVisible())) {
        issues.push('Product details modal not visible after clicking product');
      } else {
        // Check modal elements
        const modalTitle = page.locator('#product-details-name');
        const modalPrice = page.locator('#product-details-price');
        const modalImage = page.locator('#product-details-image');
        const addCartBtn = page.locator('#product-details-add-cart');

        if (!(await modalTitle.isVisible())) {
          issues.push('Product details modal name not visible');
        }
        if (!(await modalPrice.isVisible())) {
          issues.push('Product details modal price not visible');
        }
        if (!(await modalImage.isVisible())) {
          issues.push('Product details modal image not visible');
        }
        if (!(await addCartBtn.isVisible())) {
          issues.push('Product details modal add to cart button not visible');
        }

        // Check quantity controls
        const decreaseBtn = page.locator('#product-details-decrease');
        const increaseBtn = page.locator('#product-details-increase');
        const quantityInput = page.locator('#product-details-quantity');

        if (!(await decreaseBtn.isVisible())) {
          issues.push('Product details modal decrease quantity button not visible');
        }
        if (!(await increaseBtn.isVisible())) {
          issues.push('Product details modal increase quantity button not visible');
        }
        if (!(await quantityInput.isVisible())) {
          issues.push('Product details modal quantity input not visible');
        }

        // Close modal
        const closeBtn = page.locator('#close-product-details');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          issues.push('Product details modal close button not visible');
        }
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-007 Issues:', issues);
    }
  });

  test('GUEST-008: Auth modal - Login mode', async ({ page }) => {
    const issues = [];

    // Click login button
    const loginBtn = page.locator('#login-btn');
    await loginBtn.click();
    await page.waitForTimeout(500);

    // Check auth modal
    const authModal = page.locator('#auth-modal');
    if (!(await authModal.isVisible())) {
      issues.push('Auth modal not visible after clicking login');
    } else {
      // Check login fields
      const emailInput = page.locator('#auth-email');
      const passwordInput = page.locator('#auth-password');
      const closeBtn = page.locator('#auth-close-btn');

      if (!(await emailInput.isVisible())) {
        issues.push('Auth modal email input not visible');
      }
      if (!(await passwordInput.isVisible())) {
        issues.push('Auth modal password input not visible');
      }
      if (!(await closeBtn.isVisible())) {
        issues.push('Auth modal close button not visible');
      }

      // Check password toggle
      const passwordToggle = page.locator('#toggle-login-password');
      if (!(await passwordToggle.isVisible())) {
        issues.push('Auth modal password toggle not visible');
      }

      // Check forgot password link
      const forgotLink = page.locator('#forgot-password-link');
      if (!(await forgotLink.isVisible())) {
        issues.push('Auth modal forgot password link not visible');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-008 Issues:', issues);
    }
  });

  test('GUEST-009: Auth modal - Register mode', async ({ page }) => {
    const issues = [];

    // Click register button
    const registerBtn = page.locator('#register-btn');
    await registerBtn.click();
    await page.waitForTimeout(500);

    // Check auth modal
    const authModal = page.locator('#auth-modal');
    if (!(await authModal.isVisible())) {
      issues.push('Auth modal not visible after clicking register');
    } else {
      // Check registration progress steps
      const progressSteps = page.locator('.progress-step');
      const stepCount = await progressSteps.count();
      if (stepCount !== 4) {
        issues.push(`Registration progress steps count is ${stepCount}, expected 4`);
      }

      // Check step 1 elements
      const emailInput = page.locator('#auth-email-register');
      const nextBtn = page.locator('#register-next-1');

      if (!(await emailInput.isVisible())) {
        issues.push('Registration email input not visible');
      }
      if (!(await nextBtn.isVisible())) {
        issues.push('Registration next button not visible');
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-009 Issues:', issues);
    }
  });

  test('GUEST-010: Cart sidebar', async ({ page }) => {
    const issues = [];

    // Cart should not be visible for guest initially
    const cartSidebar = page.locator('#cart-sidebar');
    if (await cartSidebar.isVisible()) {
      issues.push('Cart sidebar should not be visible for guest initially');
    }

    // Check cart overlay
    const cartOverlay = page.locator('#cart-overlay');
    if (await cartOverlay.isVisible()) {
      issues.push('Cart overlay should not be visible for guest initially');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-010 Issues:', issues);
    }
  });

  test('GUEST-011: Guest-specific hidden elements', async ({ page }) => {
    const issues = [];

    // These should NOT be visible for guest
    const hiddenElements = [
      '#my-orders-li',
      '#customer-messages',
      '#customer-notifications',
      '#user-profile',
      '#back-to-admin-btn'
    ];

    for (const selector of hiddenElements) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        issues.push(`Element ${selector} should be hidden for guest but is visible`);
      }
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-011 Issues:', issues);
    }
  });

  test('GUEST-012: Responsive design - Mobile', async ({ page }) => {
    const issues = [];

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Check mobile menu toggle
    const mobileMenuToggle = page.locator('#mobile-menu-toggle');
    if (!(await mobileMenuToggle.isVisible())) {
      issues.push('Mobile menu toggle not visible on mobile');
    }

    // Check navigation is hidden on mobile
    const nav = page.locator('#main-nav');
    if (await nav.isVisible()) {
      issues.push('Main navigation should be hidden on mobile initially');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-012 Issues:', issues);
    }
  });

  test('GUEST-013: Responsive design - Tablet', async ({ page }) => {
    const issues = [];

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // Check mobile menu toggle
    const mobileMenuToggle = page.locator('#mobile-menu-toggle');
    if (!(await mobileMenuToggle.isVisible())) {
      issues.push('Mobile menu toggle not visible on tablet');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-013 Issues:', issues);
    }
  });

  test('GUEST-014: Responsive design - Desktop', async ({ page }) => {
    const issues = [];

    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Check navigation is visible on desktop
    const nav = page.locator('#main-nav');
    if (!(await nav.isVisible())) {
      issues.push('Main navigation not visible on desktop');
    }

    // Check mobile menu toggle is hidden on desktop
    const mobileMenuToggle = page.locator('#mobile-menu-toggle');
    if (await mobileMenuToggle.isVisible()) {
      issues.push('Mobile menu toggle should be hidden on desktop');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-014 Issues:', issues);
    }
  });

  test('GUEST-015: Loading screen', async ({ page }) => {
    const issues = [];

    // Reload page to see loading screen
    await page.reload();
    
    // Check loading screen exists
    const loadingScreen = page.locator('#loading-screen');
    const isVisible = await loadingScreen.isVisible();
    
    if (!isVisible) {
      // Loading screen might have disappeared too quickly, check if it exists in DOM
      const exists = await loadingScreen.count();
      if (exists === 0) {
        issues.push('Loading screen element not found in DOM');
      }
    }

    // Wait for loading to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check loading screen is hidden after load
    if (await loadingScreen.isVisible()) {
      issues.push('Loading screen still visible after page load');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-015 Issues:', issues);
    }
  });

  test('GUEST-016: Footer and contact section', async ({ page }) => {
    const issues = [];

    // Check contact section
    const contactSection = page.locator('#contact');
    if (!(await contactSection.isVisible())) {
      issues.push('Contact section not visible');
    }

    // Check about section
    const aboutSection = page.locator('#about');
    if (!(await aboutSection.isVisible())) {
      issues.push('About section not visible');
    }

    if (issues.length > 0) {
      test.fail();
      console.error('GUEST-016 Issues:', issues);
    }
  });
});
