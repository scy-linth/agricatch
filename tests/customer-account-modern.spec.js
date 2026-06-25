const { test, expect } = require('@playwright/test');

test.describe('Customer Account Modern Design', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to customer account page
    await page.goto('/customer-account.html');
    // Wait for loading screen to disappear
    await page.waitForSelector('#admin-loading-screen', { state: 'hidden', timeout: 10000 }).catch(() => {});
  });

  test('should have AC hero sections with icons', async ({ page }) => {
    // Check hero sections exist
    const heroSections = await page.locator('.ac-section-hero').count();
    expect(heroSections).toBeGreaterThan(0);

    // Check specific hero sections
    await expect(page.locator('#profile-overview .ac-section-hero')).toBeVisible();
    await expect(page.locator('#profile-edit .ac-section-hero')).toBeVisible();
    await expect(page.locator('#profile-password .ac-section-hero')).toBeVisible();
    await expect(page.locator('#profile-verification .ac-section-hero')).toBeVisible();
    await expect(page.locator('#support-tickets .ac-section-hero')).toBeVisible();

    // Check icons in hero sections
    await expect(page.locator('#profile-overview .ac-section-hero__icon')).toBeVisible();
    await expect(page.locator('#profile-edit .ac-section-hero__icon')).toBeVisible();
    await expect(page.locator('#profile-password .ac-section-hero__icon')).toBeVisible();
    await expect(page.locator('#profile-verification .ac-section-hero__icon')).toBeVisible();
    await expect(page.locator('#support-tickets .ac-section-hero__icon')).toBeVisible();
  });

  test('should not have pagetitle div', async ({ page }) => {
    const pagetitle = page.locator('.pagetitle');
    const count = await pagetitle.count();
    expect(count).toBe(0);
  });

  test('should have support chat section', async ({ page }) => {
    // Check support-ticket-chat section exists
    await expect(page.locator('#support-ticket-chat')).toBeVisible();
    
    // Check chat drawer structure
    await expect(page.locator('#support-chat-drawer')).toBeVisible();
    await expect(page.locator('.chat-sidebar-panel')).toBeVisible();
    await expect(page.locator('.chat-main-panel')).toBeVisible();
    
    // Check chat elements
    await expect(page.locator('#support-chat-conversation-list')).toBeVisible();
    await expect(page.locator('#support-chat-messages')).toBeVisible();
    await expect(page.locator('#support-chat-form')).toBeVisible();
    await expect(page.locator('#support-chat-input')).toBeVisible();
    await expect(page.locator('#support-chat-char-counter')).toBeVisible();
    
    // Check search and pagination
    await expect(page.locator('#support-chat-search-input')).toBeVisible();
    await expect(page.locator('#support-chat-pagination')).toBeVisible();
  });

  test('should have unread message counter badges', async ({ page }) => {
    // Check dropdown badge
    const dropdownBadge = page.locator('#support-tickets-dropdown-badge');
    await expect(dropdownBadge).toBeVisible();
    
    // Check sidebar badge
    const sidebarBadge = page.locator('#support-tickets-sidebar-badge');
    await expect(sidebarBadge).toBeVisible();
  });

  test('should have save buttons with spinner elements', async ({ page }) => {
    // Check save profile button
    const saveProfileBtn = page.locator('#save-profile-btn');
    await expect(saveProfileBtn).toBeVisible();
    await expect(saveProfileBtn.locator('.spinner-border')).toBeVisible();
    await expect(saveProfileBtn.locator('.btn-text')).toBeVisible();

    // Check change password button
    const changePasswordBtn = page.locator('#change-password-submit-btn');
    await expect(changePasswordBtn).toBeVisible();
    await expect(changePasswordBtn.locator('.spinner-border')).toBeVisible();
    await expect(changePasswordBtn.locator('.btn-text')).toBeVisible();

    // Check verification submit button
    const verifyBtn = page.locator('#submit-verification-btn');
    await expect(verifyBtn).toBeVisible();
    await expect(verifyBtn.locator('.spinner-border')).toBeVisible();
    await expect(verifyBtn.locator('.btn-text')).toBeVisible();

    // Check create ticket button
    const createTicketBtn = page.locator('#submit-ticket-btn');
    await expect(createTicketBtn).toBeVisible();
    await expect(createTicketBtn.locator('.spinner-border')).toBeVisible();
    await expect(createTicketBtn.locator('.btn-text')).toBeVisible();
  });

  test('should have toast container', async ({ page }) => {
    const toastContainer = page.locator('#toast-container');
    await expect(toastContainer).toBeVisible();
  });

  test('should have modern dropdown menu styling', async ({ page }) => {
    // Check profile dropdown
    const profileDropdown = page.locator('.dropdown-menu.profile');
    await expect(profileDropdown).toBeVisible();
    
    // Verify dropdown has modern styling classes
    const dropdown = await profileDropdown.first();
    const classes = await dropdown.getAttribute('class');
    expect(classes).toContain('dropdown-menu');
    expect(classes).toContain('profile');
  });

  test('should navigate between sections', async ({ page }) => {
    // Click on Edit Profile in sidebar
    await page.click('a[data-section="profile-edit"]');
    await expect(page.locator('#profile-edit')).toHaveClass(/active/);
    await expect(page.locator('#profile-overview')).not.toHaveClass(/active/);

    // Click on Support Tickets
    await page.click('a[data-section="support-tickets"]');
    await expect(page.locator('#support-tickets')).toHaveClass(/active/);
    await expect(page.locator('#profile-edit')).not.toHaveClass(/active/);

    // Click on My Profile
    await page.click('a[data-section="profile-overview"]');
    await expect(page.locator('#profile-overview')).toHaveClass(/active/);
    await expect(page.locator('#support-tickets')).not.toHaveClass(/active/);
  });

  test('should have hero titles with correct text', async ({ page }) => {
    // Check hero titles
    await expect(page.locator('#profile-overview .ac-section-hero__title')).toHaveText('My Profile');
    await expect(page.locator('#profile-edit .ac-section-hero__title')).toHaveText('Edit Profile');
    await expect(page.locator('#profile-password .ac-section-hero__title')).toHaveText('Change Password');
    await expect(page.locator('#profile-verification .ac-section-hero__title')).toHaveText('Account Verification');
    await expect(page.locator('#support-tickets .ac-section-hero__title')).toHaveText('Support Tickets');
    await expect(page.locator('#support-ticket-chat .ac-section-hero__title')).toHaveText('Support Chat');
  });

  test('should have hero subtitles', async ({ page }) => {
    // Check hero subtitles exist
    await expect(page.locator('#profile-overview .ac-section-hero__sub')).toBeVisible();
    await expect(page.locator('#profile-edit .ac-section-hero__sub')).toBeVisible();
    await expect(page.locator('#profile-password .ac-section-hero__sub')).toBeVisible();
    await expect(page.locator('#profile-verification .ac-section-hero__sub')).toBeVisible();
    await expect(page.locator('#support-tickets .ac-section-hero__sub')).toBeVisible();
    await expect(page.locator('#support-ticket-chat .ac-section-hero__sub')).toBeVisible();
  });

  test('should have support-ticket-chat.js loaded', async ({ page }) => {
    // Check if supportTicketChat is available globally
    const hasSupportChat = await page.evaluate(() => {
      return typeof window.supportTicketChat !== 'undefined';
    });
    expect(hasSupportChat).toBe(true);
  });
});
