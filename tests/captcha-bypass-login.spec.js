const { test, expect } = require('@playwright/test');

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

test('Login with CAPTCHA bypass - customer user', async ({ page }) => {
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');

  // Click login button
  await page.click('#login-btn');
  await expect(page.locator('#auth-modal')).toBeVisible();

  // Fill login form
  await page.fill('#auth-email', 'customer');
  await page.fill('#auth-password', 'customercustomer');

  // Submit login
  await page.click('#auth-submit-btn');

  // Wait for response
  const responsePromise = page.waitForResponse(resp => resp.url().includes('/auth/login'));
  const response = await responsePromise;
  const responseData = await response.json();

  console.log('Login response:', {
    status: response.status(),
    message: responseData.message,
    hasToken: !!responseData.token
  });

  // Check if login succeeded
  expect(response.ok()).toBe(true);
  expect(responseData.token).toBeTruthy();

  console.log('✓ Login successful with CAPTCHA bypass');

  // Verify user is logged in by checking for logout button or user menu
  await page.waitForTimeout(2000);
  const logoutBtn = page.locator('#logout-btn, #user-menu-btn, [data-logout]');
  const isLoggedIn = await logoutBtn.count() > 0;
  
  console.log('User logged in:', isLoggedIn);
  expect(isLoggedIn).toBe(true);
});
