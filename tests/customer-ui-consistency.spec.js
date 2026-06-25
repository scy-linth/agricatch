const { test, expect } = require('@playwright/test');

test.describe('Customer UI Consistency — Orders, Notifications, Header', () => {
    
    test('orders.html — page loads at all', async ({ page }) => {
        const response = await page.goto('http://localhost:8080/orders.html');
        console.log('Response status:', response.status());
        expect(response.status()).toBe(200);
        
        const title = await page.title();
        console.log('Page title:', title);
        expect(title).toBeTruthy();
    });
    
    test('notifications.html — page loads at all', async ({ page }) => {
        const response = await page.goto('http://localhost:8080/notifications.html');
        console.log('Response status:', response.status());
        expect(response.status()).toBe(200);
        
        const title = await page.title();
        console.log('Page title:', title);
        expect(title).toBeTruthy();
    });
    
    test('index.html — page loads at all', async ({ page }) => {
        const response = await page.goto('http://localhost:8080/');
        console.log('Response status:', response.status());
        expect(response.status()).toBe(200);
        
        const title = await page.title();
        console.log('Page title:', title);
    });
    
    test('orders.html — page loads and key elements present', async ({ page }) => {
        await page.goto('http://localhost:8080/orders.html');
        await page.waitForLoadState('networkidle');
        
        // Dump page HTML to see what's actually being served
        const bodyHTML = await page.locator('body').innerHTML();
        console.log('Body HTML contains orders-topbar:', bodyHTML.includes('orders-topbar'));
        console.log('Body HTML contains header:', bodyHTML.includes('<header'));
        
        // Capture screenshot for debugging
        await page.screenshot({ path: 'test-results/orders-page.png', fullPage: true });
        
        // Check for console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await page.waitForTimeout(1000);
        expect(errors.length).toBe(0);
        
        // Check if topbar exists in DOM (not necessarily visible)
        const topbarExists = await page.locator('.orders-topbar').count();
        console.log('Topbar element count:', topbarExists);
        expect(topbarExists).toBeGreaterThan(0);
        
        // Topbar present
        await expect(page.locator('.orders-topbar')).toBeVisible();
        await expect(page.locator('.orders-topbar .brand-name')).toHaveText('AgriCatch');
        await expect(page.locator('.orders-topbar .tagline')).toHaveText('Freshly Harvested! Pre-ordered for you!');
        
        // Back button present
        await expect(page.locator('#back-to-origin-btn')).toBeVisible();
        await expect(page.locator('#back-to-origin-btn')).toHaveAttribute('href', '/#home');
        
        // Main content area
        await expect(page.locator('#orders-main')).toBeVisible();
        
        // Page title
        await expect(page.locator('h1')).toContainText('Pre-order Management');
        
        // Order tabs present
        await expect(page.locator('#pending-orders-tab')).toBeVisible();
        await expect(page.locator('#confirmed-orders-tab')).toBeVisible();
        await expect(page.locator('#preparing-orders-tab')).toBeVisible();
        await expect(page.locator('#out_for_delivery-orders-tab')).toBeVisible();
        await expect(page.locator('#delivered-orders-tab')).toBeVisible();
        await expect(page.locator('#cancelled-orders-tab')).toBeVisible();
        
        // Tab content sections present
        await expect(page.locator('#pending-orders-section')).toBeVisible();
        await expect(page.locator('#confirmed-orders-section')).toBeVisible();
        await expect(page.locator('#preparing-orders-section')).toBeVisible();
        await expect(page.locator('#out_for_delivery-orders-section')).toBeVisible();
        await expect(page.locator('#delivered-orders-section')).toBeVisible();
        await expect(page.locator('#cancelled-orders-section')).toBeVisible();
        
        // Orders lists present
        await expect(page.locator('#pending-orders-list')).toBeVisible();
        await expect(page.locator('#confirmed-orders-list')).toBeVisible();
        await expect(page.locator('#preparing-orders-list')).toBeVisible();
        await expect(page.locator('#out_for_delivery-orders-list')).toBeVisible();
        await expect(page.locator('#delivered-orders-list')).toBeVisible();
        await expect(page.locator('#cancelled-orders-list')).toBeVisible();
        
        // Modals present (hidden by default)
        await expect(page.locator('#order-rating-modal')).toBeAttached();
        await expect(page.locator('#order-cancel-modal')).toBeAttached();
        await expect(page.locator('#order-reason-view-modal')).toBeAttached();
        
        // Modal elements
        await expect(page.locator('#order-rating-form')).toBeAttached();
        await expect(page.locator('#order-cancel-form')).toBeAttached();
        await expect(page.locator('#order-rating-product-name')).toBeAttached();
        await expect(page.locator('#order-rating-stars')).toBeAttached();
        await expect(page.locator('#order-rating-comment')).toBeAttached();
        await expect(page.locator('#order-cancel-reason-input')).toBeAttached();
        await expect(page.locator('#order-reason-view-text')).toBeAttached();
        
        // Check for Bootstrap CSS loaded
        const bootstrapLink = await page.locator('link[href*="bootstrap@5.3.3"]').count();
        expect(bootstrapLink).toBeGreaterThan(0);
        
        // Check for agricatch-admin.css loaded
        const agricatchCss = await page.locator('link[href*="agricatch-admin.css"]').count();
        expect(agricatchCss).toBeGreaterThan(0);
        
        // Check for nicemain.css loaded
        const nicemainCss = await page.locator('link[href*="nicemain.css"]').count();
        expect(nicemainCss).toBeGreaterThan(0);
        
        // Check for Bootstrap Icons
        const bootstrapIcons = await page.locator('link[href*="bootstrap-icons@1.11.3"]').count();
        expect(bootstrapIcons).toBeGreaterThan(0);
        
        // Verify topbar gradient
        const topbarBg = await page.locator('.orders-topbar').evaluate(el => {
            return window.getComputedStyle(el).background;
        });
        expect(topbarBg).toContain('gradient');
    });
    
    test('orders.html — tab switching works', async ({ page }) => {
        await page.goto('http://localhost:8080/orders.html');
        await page.waitForLoadState('networkidle');
        
        // Click confirmed tab
        await page.click('#confirmed-orders-tab');
        await expect(page.locator('#confirmed-orders-tab')).toHaveClass(/active/);
        await expect(page.locator('#pending-orders-tab')).not.toHaveClass(/active/);
        await expect(page.locator('#confirmed-orders-section')).toHaveClass(/active/);
        await expect(page.locator('#pending-orders-section')).not.toHaveClass(/active/);
        
        // Click delivered tab
        await page.click('#delivered-orders-tab');
        await expect(page.locator('#delivered-orders-tab')).toHaveClass(/active/);
        await expect(page.locator('#delivered-orders-section')).toHaveClass(/active/);
    });
    
    test('notifications.html — page loads and key elements present', async ({ page }) => {
        await page.goto('http://localhost:8080/notifications.html');
        await page.waitForLoadState('networkidle');
        
        // Check for console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await page.waitForTimeout(1000);
        expect(errors.length).toBe(0);
        
        // Topbar present
        await expect(page.locator('.notif-topbar')).toBeVisible();
        await expect(page.locator('.notif-topbar .brand-name')).toHaveText('AgriCatch');
        await expect(page.locator('.notif-topbar .tagline')).toHaveText('Freshly Harvested! Pre-ordered for you!');
        
        // Back button present
        await expect(page.locator('.back-btn')).toBeVisible();
        await expect(page.locator('.back-btn')).toHaveAttribute('href', '/#home');
        
        // Main content area
        await expect(page.locator('#notif-main')).toBeVisible();
        
        // Page title
        await expect(page.locator('h1')).toContainText('Notifications');
        
        // Section hero present
        await expect(page.locator('.ac-section-hero')).toBeVisible();
        await expect(page.locator('.ac-section-hero--primary')).toBeVisible();
        await expect(page.locator('.ac-section-hero__icon')).toBeVisible();
        await expect(page.locator('.ac-section-hero__title')).toHaveText('Notifications');
        await expect(page.locator('.ac-section-hero__sub')).toContainText('System alerts');
        
        // Mark all read button
        await expect(page.locator('#notif-mark-all-btn')).toBeVisible();
        
        // Notifications list
        await expect(page.locator('#notifications-list')).toBeVisible();
        await expect(page.locator('#notifications-empty-state')).toBeAttached();
        await expect(page.locator('#notifications-pagination')).toBeAttached();
        
        // Check for Bootstrap CSS loaded
        const bootstrapLink = await page.locator('link[href*="bootstrap@5.3.3"]').count();
        expect(bootstrapLink).toBeGreaterThan(0);
        
        // Check for agricatch-admin.css loaded
        const agricatchCss = await page.locator('link[href*="agricatch-admin.css"]').count();
        expect(agricatchCss).toBeGreaterThan(0);
        
        // Check for nicemain.css loaded
        const nicemainCss = await page.locator('link[href*="nicemain.css"]').count();
        expect(nicemainCss).toBeGreaterThan(0);
        
        // Verify topbar gradient
        const topbarBg = await page.locator('.notif-topbar').evaluate(el => {
            return window.getComputedStyle(el).background;
        });
        expect(topbarBg).toContain('gradient');
        
        // Verify section hero gradient
        const heroBg = await page.locator('.ac-section-hero--primary').evaluate(el => {
            return window.getComputedStyle(el).background;
        });
        expect(heroBg).toContain('gradient');
    });
    
    test('index.html — notification dropdown present and consistent', async ({ page }) => {
        await page.goto('http://localhost:8080/');
        await page.waitForLoadState('networkidle');
        
        // Check for console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await page.waitForTimeout(1000);
        expect(errors.length).toBe(0);
        
        // Notification dropdown present (nav-item dropdown)
        const notifDropdown = page.locator('.nav-item.dropdown');
        await expect(notifDropdown).toBeAttached();
        
        // Bell icon
        await expect(page.locator('.nav-item.dropdown .bi-bell')).toBeAttached();
        
        // Badge
        await expect(page.locator('#notif-badge')).toBeAttached();
        await expect(page.locator('#notif-count')).toBeAttached();
        
        // Dropdown menu
        await expect(page.locator('.dropdown-menu.notifications')).toBeAttached();
        await expect(page.locator('#notif-list')).toBeAttached();
        
        // Show all notifications link
        await expect(page.locator('#show-all-notifications-link')).toBeAttached();
        await expect(page.locator('#show-all-notifications-link')).toHaveAttribute('href', 'notifications.html');
        
        // Verify Bootstrap dropdown structure
        await expect(page.locator('.nav-item.dropdown .nav-link')).toHaveAttribute('data-bs-toggle', 'dropdown');
        
        // Verify dropdown menu styling
        const dropdownMenu = page.locator('.dropdown-menu.notifications');
        await expect(dropdownMenu).toHaveClass(/dropdown-menu-end/);
        await expect(dropdownMenu).toHaveClass(/dropdown-menu-arrow/);
    });
    
    test('index.html — notification dropdown opens correctly', async ({ page }) => {
        await page.goto('http://localhost:8080/');
        await page.waitForLoadState('networkidle');
        
        // Click notification bell
        await page.click('.nav-item.dropdown .nav-link');
        
        // Dropdown should be visible
        await expect(page.locator('.dropdown-menu.show')).toBeVisible();
        
        // Check dropdown content
        await expect(page.locator('.dropdown-header')).toContainText('You have');
        await expect(page.locator('#notif-count')).toBeVisible();
    });
    
    test('orders.html — responsive design check', async ({ page }) => {
        // Mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('http://localhost:8080/orders.html');
        await page.waitForLoadState('networkidle');
        
        await expect(page.locator('.orders-topbar')).toBeVisible();
        await expect(page.locator('#orders-main')).toBeVisible();
        
        // Tablet view
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('http://localhost:8080/orders.html');
        await page.waitForLoadState('networkidle');
        
        await expect(page.locator('.orders-topbar')).toBeVisible();
        await expect(page.locator('#orders-main')).toBeVisible();
        
        // Desktop view
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8080/orders.html');
        await page.waitForLoadState('networkidle');
        
        await expect(page.locator('.orders-topbar')).toBeVisible();
        await expect(page.locator('#orders-main')).toBeVisible();
    });
    
    test('notifications.html — responsive design check', async ({ page }) => {
        // Mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('http://localhost:8080/notifications.html');
        await page.waitForLoadState('networkidle');
        
        await expect(page.locator('.notif-topbar')).toBeVisible();
        await expect(page.locator('#notif-main')).toBeVisible();
        
        // Desktop view
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8080/notifications.html');
        await page.waitForLoadState('networkidle');
        
        await expect(page.locator('.notif-topbar')).toBeVisible();
        await expect(page.locator('#notif-main')).toBeVisible();
    });
    
    test('orders.html — modal visibility check', async ({ page }) => {
        await page.goto('http://localhost:8080/orders.html');
        await page.waitForLoadState('networkidle');
        
        // Modals should be hidden by default
        await expect(page.locator('#order-rating-modal')).not.toBeVisible();
        await expect(page.locator('#order-cancel-modal')).not.toBeVisible();
        await expect(page.locator('#order-reason-view-modal')).not.toBeVisible();
    });
    
    test('notifications.html — empty state check', async ({ page }) => {
        await page.goto('http://localhost:8080/notifications.html');
        await page.waitForLoadState('networkidle');
        
        // Empty state should be hidden initially (loading state shown)
        await expect(page.locator('#notifications-empty-state')).not.toBeVisible();
        
        // Wait for loading to complete
        await page.waitForTimeout(3000);
        
        // Check if empty state becomes visible (depends on API response)
        const emptyStateVisible = await page.locator('#notifications-empty-state').isVisible();
        console.log('Empty state visible:', emptyStateVisible);
    });
});
