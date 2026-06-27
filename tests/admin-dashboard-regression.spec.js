const { test, expect } = require('@playwright/test');

test.describe('Admin Dashboard Regression Test', () => {
  test('Admin dashboard access via API token', async ({ page, context }) => {
    // Authenticate as Super Admin via API
    const response = await context.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'scy@linth',
        password: 'etitsmwa'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    const authToken = data.token;
    const userData = data.user;
    
    // Navigate to admin page
    await page.goto('http://localhost:3000/admin.html');
    
    // Set token in localStorage
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: authToken, user: userData });
    
    // Reload to apply authentication
    await page.reload();
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Check if we're on admin dashboard (not redirected)
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Check for admin dashboard elements
    const hasDashboard = await page.locator('text=Dashboard, text=Overview').count() > 0;
    console.log('Has dashboard elements:', hasDashboard);
    
    expect(currentUrl).toContain('admin.html');
  });
});
