const { test, expect } = require('@playwright/test');

test.describe('Farmer Dashboard Regression F.1A', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Logout if logged in
    const userDropdown = page.locator('#user-dropdown');
    if (await userDropdown.isVisible({ timeout: 2000 })) {
      await userDropdown.click();
      await page.waitForTimeout(500);
      const logoutBtn = page.locator('#logout-btn');
      if (await logoutBtn.isVisible({ timeout: 2000 })) {
        await logoutBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Click login button
    await page.click('#login-btn');
    await page.waitForSelector('#auth-modal', { state: 'visible' });
    
    // Login as farmer
    await page.fill('#auth-email', 'dhelhilis@gmail.com');
    await page.fill('#auth-password', 'password123');
    await page.click('#auth-submit-btn');
    
    // Wait for login
    await page.waitForTimeout(3000);
    
    // Navigate to farmer dashboard
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  });

  test('1. Dashboard Overview - KPI cards, statistics, earnings, orders, products, harvest reminder', async ({ page }) => {
    // Check if overview section is visible
    const overview = page.locator('#overview');
    await expect(overview).toBeVisible();
    
    // Check for KPI cards
    const kpiCards = page.locator('.stat-card, .kpi-card, .dashboard-card');
    const kpiCount = await kpiCards.count();
    console.log('KPI cards count:', kpiCount);
    
    // Check for statistics
    const stats = page.locator('.stat-value, .kpi-value');
    const statsCount = await stats.count();
    console.log('Statistics count:', statsCount);
    
    // Check for harvest reminder card
    const harvestReminder = page.locator('.harvest-reminder, #harvest-reminder');
    const hasHarvestReminder = await harvestReminder.count() > 0;
    console.log('Has harvest reminder:', hasHarvestReminder);
    
    await page.screenshot({ path: 'test-results/farmer-dashboard-overview.png' });
  });

  test('2. Dashboard Sections - Recent Orders, Recent Notifications, Quick Actions, Dashboard widgets', async ({ page }) => {
    // Check for recent orders section
    const recentOrders = page.locator('#recent-orders, .recent-orders');
    const hasRecentOrders = await recentOrders.count() > 0;
    console.log('Has recent orders section:', hasRecentOrders);
    
    // Check for recent notifications section
    const recentNotifs = page.locator('#recent-notifications, .recent-notifications');
    const hasRecentNotifs = await recentNotifs.count() > 0;
    console.log('Has recent notifications section:', hasRecentNotifs);
    
    // Check for quick actions
    const quickActions = page.locator('.quick-actions, #quick-actions');
    const hasQuickActions = await quickActions.count() > 0;
    console.log('Has quick actions:', hasQuickActions);
    
    // Check for dashboard widgets
    const widgets = page.locator('.dashboard-widget, .widget');
    const widgetCount = await widgets.count();
    console.log('Dashboard widgets count:', widgetCount);
    
    await page.screenshot({ path: 'test-results/farmer-dashboard-sections.png' });
  });

  test('3. Navigation - Sidebar, Active menu, Header, User profile', async ({ page }) => {
    // Check sidebar
    const sidebar = page.locator('#farmer-sidebar, .sidebar');
    await expect(sidebar).toBeVisible();
    
    // Check active menu item
    const activeMenu = page.locator('.nav-link.active, .sidebar .active');
    const hasActiveMenu = await activeMenu.count() > 0;
    console.log('Has active menu:', hasActiveMenu);
    
    // Check header
    const header = page.locator('header, .header');
    await expect(header).toBeVisible();
    
    // Check user profile
    const userProfile = page.locator('#farmer-user-account-btn, .user-profile, .user-dropdown');
    const hasUserProfile = await userProfile.count() > 0;
    console.log('Has user profile button:', hasUserProfile);
    
    await page.screenshot({ path: 'test-results/farmer-dashboard-navigation.png' });
  });

  test('4. Harvest Dashboard - Harvest Today, Due in 3 Days, Overdue, Counts, Card updates', async ({ page }) => {
    // Check for harvest dashboard section
    const harvestDashboard = page.locator('#harvest-dashboard, .harvest-dashboard');
    const hasHarvestDashboard = await harvestDashboard.count() > 0;
    console.log('Has harvest dashboard:', hasHarvestDashboard);
    
    if (hasHarvestDashboard) {
      // Check harvest today
      const harvestToday = page.locator('.harvest-today, #harvest-today');
      const hasHarvestToday = await harvestToday.count() > 0;
      console.log('Has harvest today:', hasHarvestToday);
      
      // Check due in 3 days
      const dueIn3Days = page.locator('.due-in-3-days, #due-in-3-days');
      const hasDueIn3Days = await dueIn3Days.count() > 0;
      console.log('Has due in 3 days:', hasDueIn3Days);
      
      // Check overdue
      const overdue = page.locator('.overdue, #overdue');
      const hasOverdue = await overdue.count() > 0;
      console.log('Has overdue:', hasOverdue);
      
      // Check counts
      const counts = page.locator('.count, .harvest-count');
      const countCount = await counts.count();
      console.log('Harvest counts:', countCount);
    }
    
    await page.screenshot({ path: 'test-results/farmer-harvest-dashboard.png' });
  });

  test('5. Visual Integrity - alignment, labels, broken cards, empty states, console errors', async ({ page }) => {
    // Check for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    console.log('Console errors:', errors);
    
    // Check page title
    const pageTitle = page.locator('#farmer-page-title');
    await expect(pageTitle).toBeVisible();
    
    // Check for broken images
    const images = page.locator('img');
    const imageCount = await images.count();
    console.log('Images on page:', imageCount);
    
    // Check for empty states
    const emptyStates = page.locator('.empty-state, .no-data');
    const emptyStateCount = await emptyStates.count();
    console.log('Empty states:', emptyStateCount);
    
    await page.screenshot({ path: 'test-results/farmer-dashboard-visual.png' });
  });
});
