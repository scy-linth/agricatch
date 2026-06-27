const { test, expect } = require('@playwright/test');

test.describe('Customer Login Regression Test', () => {
  test('Backend API login verification', async ({ context }) => {
    // Verify backend API login works
    const response = await context.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'testcustomer@test.com',
        password: 'Test123456'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    console.log('✓ Backend API login successful');
    console.log('User:', data.user);
    console.log('Token received:', !!data.token);
  });

  test('Customer authentication via API - Bypass modal for testing', async ({ page, context }) => {
    // Get token via API
    const response = await context.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'testcustomer@test.com',
        password: 'Test123456'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Navigate to main page
    await page.goto('http://localhost:3000/index.html');
    
    // Set token and user data in localStorage
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: data.token, user: data.user });
    
    // Reload page to apply authentication
    await page.reload();
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Verify customer is logged in
    const isLoggedIn = await page.locator('button:has-text("Logout"), button:has-text("My Account")').count() > 0;
    expect(isLoggedIn).toBeTruthy();
    
    console.log('✓ Customer authenticated via API for testing');
  });
});
