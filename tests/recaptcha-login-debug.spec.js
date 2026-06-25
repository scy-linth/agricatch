const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      process.env[key] = valueParts.join('=');
    }
  });
}

test('debug reCAPTCHA login flow', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Click login button
  await page.click('#login-btn');
  await expect(page.locator('#auth-modal')).toBeVisible();

  // Fill login form with valid credentials
  await page.fill('#auth-email', 'customer@test.com');
  await page.fill('#auth-password', 'password123');

  // Check if reCAPTCHA element exists
  const recaptchaElement = page.locator('#auth-recaptcha');
  const recaptchaExists = await recaptchaElement.count() > 0;
  console.log('reCAPTCHA element exists:', recaptchaExists);

  if (recaptchaExists) {
    // Check if reCAPTCHA is rendered
    const recaptchaChildren = await recaptchaElement.evaluate(el => el.children.length);
    console.log('reCAPTCHA children count:', recaptchaChildren);

    if (recaptchaChildren > 0) {
      // reCAPTCHA is present - we need to handle it
      // For now, let's try to get the widget ID and check response
      const recaptchaResponse = await page.evaluate(() => {
        if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
          return window.grecaptcha.getResponse();
        }
        return null;
      });
      console.log('Initial reCAPTCHA response:', recaptchaResponse);

      // Try to find and click the reCAPTCHA checkbox
      // Note: This is difficult to automate as it's in an iframe
      console.log('reCAPTCHA is present - manual completion may be needed');
    } else {
      console.log('reCAPTCHA element exists but not rendered');
    }
  } else {
    console.log('reCAPTCHA element does not exist - skipping validation');
  }

  // Listen for console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.text().includes('DEBUG') || msg.text().includes('recaptcha')) {
      console.log('Browser console:', msg.type(), msg.text());
    }
  });

  // Listen for network requests
  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('/auth/login')) {
      const postData = request.postData();
      console.log('Login request:', {
        url: request.url(),
        hasRecaptcha: postData && postData.includes('g-recaptcha-response'),
        postDataLength: postData?.length
      });
      apiRequests.push({ url: request.url(), postData });
    }
  });

  // Try login multiple times to reproduce the issue
  for (let i = 1; i <= 3; i++) {
    console.log(`\n=== Login attempt ${i} ===`);
    
    // Click login button
    const loginBtn = page.locator('#auth-submit-btn');
    await expect(loginBtn).toBeVisible();
    
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/auth/login'));
    await loginBtn.click();
    
    const response = await responsePromise;
    const responseData = await response.json().catch(() => ({ message: 'Could not parse JSON' }));
    
    console.log(`Attempt ${i} response:`, {
      status: response.status(),
      message: responseData.message,
      hasToken: !!responseData.token
    });

    // Wait a bit between attempts
    await page.waitForTimeout(2000);

    // If login succeeded, break
    if (response.ok() && responseData.token) {
      console.log('Login succeeded on attempt', i);
      break;
    }

    // If modal is closed, reopen it
    const modalVisible = await page.locator('#auth-modal').isVisible();
    if (!modalVisible) {
      await page.click('#login-btn');
      await expect(page.locator('#auth-modal')).toBeVisible();
      await page.fill('#auth-email', 'customer@test.com');
      await page.fill('#auth-password', 'password123');
    }
  }

  console.log('\n=== Console messages with DEBUG ===');
  consoleMessages.filter(m => m.text.includes('DEBUG')).forEach(m => {
    console.log(m.type, m.text);
  });

  console.log('\n=== API requests ===');
  apiRequests.forEach(req => {
    console.log(req.url, req.postData?.substring(0, 100));
  });
});
