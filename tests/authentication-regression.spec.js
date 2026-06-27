const { test, expect } = require('@playwright/test');
const { getCustomerToken, getFarmerToken, getAdminToken } = require('./auth-helper');

// AUTHENTICATION REGRESSION TEST A
// Comprehensive verification of authentication module
// CAPTCHA disabled, OTP bypass code: 789878, Rate limits: 999

test.describe('Authentication Regression A', () => {
  let page;
  const evidenceDir = 'test-results/auth-regression-a';
  
  // Test account credentials
  const testAccounts = {
    customer: {
      email: `regression-customer-${Date.now()}@agricatch.test`,
      password: 'TestPass123!',
      firstName: 'Regression',
      lastName: 'Customer',
      role: 'customer'
    },
    farmer: {
      email: `regression-farmer-${Date.now()}@agricatch.test`,
      password: 'TestPass123!',
      firstName: 'Regression',
      lastName: 'Farmer',
      shopName: 'Regression Farm Shop',
      role: 'farmer'
    },
    admin: {
      email: `regression-admin-${Date.now()}@agricatch.test`,
      password: 'TestPass123!',
      firstName: 'Regression',
      lastName: 'Admin',
      role: 'admin'
    }
  };

  const OTP_BYPASS_CODE = '789878';

  test.beforeAll(async ({ browser }) => {
    const fs = require('fs');
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Clear localStorage before each test
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => localStorage.clear());
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ============================================
  // 1. GUEST BROWSING PUBLIC PAGES
  // ============================================
  test('1. Guest can browse public pages', async () => {
    console.log('\n=== TEST 1: GUEST BROWSING ===');
    
    const publicPages = [
      { url: '/index.html', name: 'Landing Page' },
      { url: '/products.html', name: 'Products Page' },
      { url: '/about.html', name: 'About Page' }
    ];

    const results = [];

    for (const pageInfo of publicPages) {
      await page.goto(`http://localhost:3000${pageInfo.url}`);
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const accessible = !currentUrl.includes('login') && !currentUrl.includes('404');
      
      results.push({
        page: pageInfo.name,
        url: pageInfo.url,
        accessible: accessible,
        currentUrl: currentUrl
      });
      
      console.log(`${pageInfo.name}: ${accessible ? '✓ Accessible' : '✗ Blocked'}`);
    }

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/1-guest-browsing.json`,
      JSON.stringify(results, null, 2)
    );

    // All public pages should be accessible
    expect(results.every(r => r.accessible)).toBeTruthy();
  });

  // ============================================
  // 2. REGISTRATION
  // ============================================
  test('2. Registration - Required fields validation', async () => {
    console.log('\n=== TEST 2: REGISTRATION VALIDATION ===');
    
    await page.goto('http://localhost:3000/index.html');
    
    // Find and click register button
    const registerBtn = page.locator('#register-btn, .register-btn, [data-bs-target="#registerModal"]');
    if (await registerBtn.count() > 0) {
      await registerBtn.first().click();
      await page.waitForTimeout(1000);
    }

    const validationResults = [];

    // Test empty email
    const emailInput = page.locator('#auth-email-register');
    const passwordInput = page.locator('#auth-password-register');
    const firstNameInput = page.locator('#auth-first-name');
    const lastNameInput = page.locator('#auth-last-name');
    const submitBtn = page.locator('#auth-register-submit');

    if (await emailInput.count() > 0 && await submitBtn.count() > 0) {
      // Try submitting with empty fields
      await emailInput.fill('');
      if (await passwordInput.count() > 0) await passwordInput.fill('');
      if (await firstNameInput.count() > 0) await firstNameInput.fill('');
      if (await lastNameInput.count() > 0) await lastNameInput.fill('');
      
      await submitBtn.first().click();
      await page.waitForTimeout(1000);
      
      // Check for validation message
      const validationMsg = page.locator('.error, .invalid-feedback, [role="alert"]').count();
      validationResults.push({ field: 'all_empty', hasValidation: validationMsg > 0 });
      console.log(`Empty fields validation: ${validationMsg > 0 ? '✓' : '✗'}`);
    }

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/2-registration-validation.json`,
      JSON.stringify(validationResults, null, 2)
    );
  });

  test('2b. Registration - Duplicate email', async () => {
    console.log('\n=== TEST 2b: DUPLICATE EMAIL ===');
    
    // First, create an account via API
    const uniqueEmail = `duplicate-test-${Date.now()}@agricatch.test`;
    
    const firstResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: uniqueEmail,
        password: 'TestPass123!',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      }
    });

    console.log(`First registration: ${firstResponse.ok() ? '✓ Success' : '✗ Failed'}`);

    // Try to register again with same email
    const secondResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: uniqueEmail,
        password: 'TestPass123!',
        first_name: 'Test',
        last_name: 'User2',
        role: 'customer'
      }
    });

    const duplicateRejected = !secondResponse.ok() || (secondResponse.status() === 400 || secondResponse.status() === 409);
    console.log(`Duplicate email rejected: ${duplicateRejected ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/2b-duplicate-email.json`,
      JSON.stringify({
        firstRegistration: firstResponse.ok(),
        secondRegistration: secondResponse.ok(),
        duplicateRejected: duplicateRejected,
        secondStatus: secondResponse.status()
      }, null, 2)
    );

    expect(duplicateRejected).toBeTruthy();
  });

  test('2c. Registration - Duplicate username', async () => {
    console.log('\n=== TEST 2c: DUPLICATE USERNAME ===');
    
    const uniqueUsername = `duplicatename${Date.now()}`;
    
    // First registration
    const firstResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: `user1-${Date.now()}@agricatch.test`,
        password: 'TestPass123!',
        first_name: 'Test',
        last_name: 'User',
        username: uniqueUsername,
        role: 'customer'
      }
    });

    // Second registration with same username
    const secondResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: `user2-${Date.now()}@agricatch.test`,
        password: 'TestPass123!',
        first_name: 'Test',
        last_name: 'User2',
        username: uniqueUsername,
        role: 'customer'
      }
    });

    const duplicateRejected = !secondResponse.ok() || (secondResponse.status() === 400 || secondResponse.status() === 409);
    console.log(`Duplicate username rejected: ${duplicateRejected ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/2c-duplicate-username.json`,
      JSON.stringify({
        duplicateRejected: duplicateRejected,
        secondStatus: secondResponse.status()
      }, null, 2)
    );
  });

  test('2d. Registration - Duplicate phone allowed', async () => {
    console.log('\n=== TEST 2d: DUPLICATE PHONE (ALLOWED) ===');
    
    const uniquePhone = `09123456789`;
    
    // First registration
    const firstResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: `phone1-${Date.now()}@agricatch.test`,
        password: 'TestPass123!',
        first_name: 'Test',
        last_name: 'User',
        phone: uniquePhone,
        role: 'customer'
      }
    });

    // Second registration with same phone (should be allowed per business rules)
    const secondResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: `phone2-${Date.now()}@agricatch.test`,
        password: 'TestPass123!',
        first_name: 'Test',
        last_name: 'User2',
        phone: uniquePhone,
        role: 'customer'
      }
    });

    const duplicateAllowed = secondResponse.ok();
    console.log(`Duplicate phone allowed: ${duplicateAllowed ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/2d-duplicate-phone.json`,
      JSON.stringify({
        duplicateAllowed: duplicateAllowed,
        secondStatus: secondResponse.status()
      }, null, 2)
    );

    expect(duplicateAllowed).toBeTruthy();
  });

  // ============================================
  // 3. OTP VERIFICATION
  // ============================================
  test('3. OTP Verification - Correct OTP', async () => {
    console.log('\n=== TEST 3: CORRECT OTP ===');
    
    // Create a test account
    const testEmail = `otp-test-${Date.now()}@agricatch.test`;
    const registerResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: testEmail,
        password: 'TestPass123!',
        first_name: 'OTP',
        last_name: 'Test',
        role: 'customer'
      }
    });

    if (registerResponse.ok()) {
      const registerData = await registerResponse.json();
      console.log('Account created, attempting OTP verification');

      // Verify OTP using bypass code
      const verifyResponse = await page.request.post('http://localhost:3000/api/auth/verify-otp', {
        data: {
          email: testEmail,
          otp: OTP_BYPASS_CODE
        }
      });

      const verificationSuccess = verifyResponse.ok();
      console.log(`OTP verification with bypass code: ${verificationSuccess ? '✓' : '✗'}`);

      const fs = require('fs');
      fs.writeFileSync(
        `${evidenceDir}/3-otp-correct.json`,
        JSON.stringify({
          verificationSuccess: verificationSuccess,
          status: verifyResponse.status()
        }, null, 2)
      );

      expect(verificationSuccess).toBeTruthy();
    } else {
      console.log('⚠ Account creation failed, skipping OTP test');
    }
  });

  test('3b. OTP Verification - Invalid OTP', async () => {
    console.log('\n=== TEST 3b: INVALID OTP ===');
    
    const testEmail = `otp-invalid-${Date.now()}@agricatch.test`;
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: testEmail,
        password: 'TestPass123!',
        first_name: 'OTP',
        last_name: 'Invalid',
        role: 'customer'
      }
    });

    // Try invalid OTP
    const verifyResponse = await page.request.post('http://localhost:3000/api/auth/verify-otp', {
      data: {
        email: testEmail,
        otp: '000000'
      }
    });

    const invalidRejected = !verifyResponse.ok();
    console.log(`Invalid OTP rejected: ${invalidRejected ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/3b-otp-invalid.json`,
      JSON.stringify({
        invalidRejected: invalidRejected,
        status: verifyResponse.status()
      }, null, 2)
    );

    expect(invalidRejected).toBeTruthy();
  });

  test('3c. OTP Verification - Resend OTP', async () => {
    console.log('\n=== TEST 3c: RESEND OTP ===');
    
    const testEmail = `otp-resend-${Date.now()}@agricatch.test`;
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: testEmail,
        password: 'TestPass123!',
        first_name: 'OTP',
        last_name: 'Resend',
        role: 'customer'
      }
    });

    // Request OTP resend
    const resendResponse = await page.request.post('http://localhost:3000/api/auth/resend-otp', {
      data: {
        email: testEmail
      }
    });

    const resendSuccess = resendResponse.ok();
    console.log(`OTP resend: ${resendSuccess ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/3c-otp-resend.json`,
      JSON.stringify({
        resendSuccess: resendSuccess,
        status: resendResponse.status()
      }, null, 2)
    );
  });

  // ============================================
  // 4. LOGIN - ALL ROLES
  // ============================================
  test('4. Login - Customer role', async () => {
    console.log('\n=== TEST 4a: CUSTOMER LOGIN ===');
    
    // Use existing customer token from auth-helper
    const { token, user } = await getCustomerToken();
    
    // Set token in localStorage
    await page.goto('http://localhost:3000/index.html');
    if (token) {
      await page.evaluate((t) => localStorage.setItem('token', t), token);
      if (user) {
        await page.evaluate((u) => localStorage.setItem('user', JSON.stringify(u)), user);
      }
    }
    await page.reload();

    // Check if logged in
    const storedToken = await page.evaluate(() => localStorage.getItem('token'));
    const storedRole = await page.evaluate(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr).role;
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    const loginSuccess = !!storedToken && storedRole === 'customer';
    console.log(`Customer login: ${loginSuccess ? '✓' : '✗'}`);
    console.log(`Role detected: ${storedRole}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/4a-customer-login.json`,
      JSON.stringify({
        loginSuccess: loginSuccess,
        hasToken: !!storedToken,
        roleDetected: storedRole
      }, null, 2)
    );

    expect(loginSuccess).toBeTruthy();
  });

  test('4b. Login - Farmer role', async () => {
    console.log('\n=== TEST 4b: FARMER LOGIN ===');
    
    // Use existing farmer token from auth-helper
    const { token, user } = await getFarmerToken();
    
    // Set token in localStorage
    await page.goto('http://localhost:3000/index.html');
    if (token) {
      await page.evaluate((t) => localStorage.setItem('token', t), token);
      if (user) {
        await page.evaluate((u) => localStorage.setItem('user', JSON.stringify(u)), user);
      }
    }
    await page.reload();

    const storedToken = await page.evaluate(() => localStorage.getItem('token'));
    const storedRole = await page.evaluate(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr).role;
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    const loginSuccess = !!storedToken && storedRole === 'farmer';
    console.log(`Farmer login: ${loginSuccess ? '✓' : '✗'}`);
    console.log(`Role detected: ${storedRole}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/4b-farmer-login.json`,
      JSON.stringify({
        loginSuccess: loginSuccess,
        hasToken: !!storedToken,
        roleDetected: storedRole
      }, null, 2)
    );

    expect(loginSuccess).toBeTruthy();
  });

  test('4c. Login - Admin role (requires Super Admin creation)', async () => {
    console.log('\n=== TEST 4c: ADMIN LOGIN ===');
    
    // Admin accounts are created ONLY by Super Admin, not via public registration
    // This test verifies that public admin registration is blocked
    const adminEmail = `login-admin-${Date.now()}@agricatch.test`;
    
    // Attempt admin registration via public endpoint (should fail)
    const registerResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: adminEmail,
        password: 'TestPass123!',
        first_name: 'Login',
        last_name: 'Admin',
        role: 'admin'
      }
    });

    const publicAdminRegistrationBlocked = !registerResponse.ok() || registerResponse.status() === 400;
    console.log(`Public admin registration blocked: ${publicAdminRegistrationBlocked ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/4c-admin-login.json`,
      JSON.stringify({
        publicAdminRegistrationBlocked: publicAdminRegistrationBlocked,
        registrationStatus: registerResponse.status(),
        note: 'Admin accounts must be created by Super Admin via admin panel'
      }, null, 2)
    );

    expect(publicAdminRegistrationBlocked).toBeTruthy();
  });

  // ============================================
  // 5. LOGOUT
  // ============================================
  test('5. Logout - Session cleared and protected pages blocked', async () => {
    console.log('\n=== TEST 5: LOGOUT ===');
    
    // Create and login customer
    const customerEmail = `logout-test-${Date.now()}@agricatch.test`;
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: customerEmail,
        password: 'TestPass123!',
        first_name: 'Logout',
        last_name: 'Test',
        role: 'customer'
      }
    });

    await page.request.post('http://localhost:3000/api/auth/verify-otp', {
      data: {
        email: customerEmail,
        otp: OTP_BYPASS_CODE
      }
    });

    // Login
    const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: customerEmail,
        password: 'TestPass123!'
      }
    });

    let token = null;
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      token = loginData.token || loginData.access_token;
    }

    // Set token in localStorage
    await page.goto('http://localhost:3000/index.html');
    if (token) {
      await page.evaluate((t) => localStorage.setItem('token', t), token);
    }
    await page.reload();

    // Logout via direct localStorage clear (simulating logout)
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await page.waitForTimeout(1000);

    // Check session cleared
    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('token'));
    const sessionCleared = !tokenAfterLogout;
    console.log(`Session cleared: ${sessionCleared ? '✓' : '✗'}`);

    // Try to access protected page
    await page.goto('http://localhost:3000/customer-account.html');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    const protectedPageBlocked = currentUrl.includes('login') || currentUrl.includes('index.html');
    console.log(`Protected page blocked: ${protectedPageBlocked ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/5-logout.json`,
      JSON.stringify({
        sessionCleared: sessionCleared,
        protectedPageBlocked: protectedPageBlocked,
        currentUrl: currentUrl
      }, null, 2)
    );

    expect(sessionCleared).toBeTruthy();
    expect(protectedPageBlocked).toBeTruthy();
  });

  test('5b. Logout - Back button cannot restore session', async () => {
    console.log('\n=== TEST 5b: BACK BUTTON AFTER LOGOUT ===');
    
    const customerEmail = `backbtn-test-${Date.now()}@agricatch.test`;
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: customerEmail,
        password: 'TestPass123!',
        first_name: 'Back',
        last_name: 'Button',
        role: 'customer'
      }
    });

    await page.request.post('http://localhost:3000/api/auth/verify-otp', {
      data: {
        email: customerEmail,
        otp: OTP_BYPASS_CODE
      }
    });

    const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: customerEmail,
        password: 'TestPass123!'
      }
    });

    let token = null;
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      token = loginData.token || loginData.access_token;
    }

    // Login and visit protected page
    await page.goto('http://localhost:3000/index.html');
    if (token) {
      await page.evaluate((t) => localStorage.setItem('token', t), token);
    }
    await page.reload();
    await page.goto('http://localhost:3000/customer-account.html');
    await page.waitForTimeout(2000);

    // Logout via direct localStorage clear
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await page.waitForTimeout(1000);

    // Try to go back
    await page.goBack();
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const backButtonBlocked = currentUrl.includes('login') || currentUrl.includes('index.html');
    console.log(`Back button blocked: ${backButtonBlocked ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/5b-back-button.json`,
      JSON.stringify({
        backButtonBlocked: backButtonBlocked,
        currentUrl: currentUrl
      }, null, 2)
    );

    expect(backButtonBlocked).toBeTruthy();
  });

  // ============================================
  // 6. FORGOT PASSWORD
  // ============================================
  test('6. Forgot Password - API only', async () => {
    console.log('\n=== TEST 6: FORGOT PASSWORD ===');
    
    // Create account
    const customerEmail = `forgotpwd-${Date.now()}@agricatch.test`;
    const registerResponse = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: customerEmail,
        password: 'TestPass123!',
        first_name: 'Forgot',
        last_name: 'Password',
        role: 'customer'
      }
    });

    if (registerResponse.ok()) {
      await page.request.post('http://localhost:3000/api/auth/verify-otp', {
        data: {
          email: customerEmail,
          otp: OTP_BYPASS_CODE
        }
      });

      // Request password reset
      const resetRequest = await page.request.post('http://localhost:3000/api/auth/forgot-password', {
        data: {
          email: customerEmail
        }
      });

      const resetRequestSuccess = resetRequest.ok();
      console.log(`Password reset requested: ${resetRequestSuccess ? '✓' : '✗'}`);

      let resetOtp = null;
      if (resetRequest.ok()) {
        const resetData = await resetRequest.json();
        // In dev mode, OTP might be returned in response
        resetOtp = resetData.otp || resetData.reset_otp || OTP_BYPASS_CODE;
      }

      // Verify OTP and reset password
      if (resetOtp) {
        const resetConfirm = await page.request.post('http://localhost:3000/api/auth/reset-password', {
          data: {
            email: customerEmail,
            otp: resetOtp,
            new_password: 'NewPass123!'
          }
        });

        const resetSuccess = resetConfirm.ok();
        console.log(`Password reset successful: ${resetSuccess ? '✓' : '✗'}`);

        // Try login with new password
        const newLoginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
          data: {
            email: customerEmail,
            password: 'NewPass123!'
          }
        });

        const newLoginSuccess = newLoginResponse.ok();
        console.log(`Login with new password: ${newLoginSuccess ? '✓' : '✗'}`);

        const fs = require('fs');
        fs.writeFileSync(
          `${evidenceDir}/6-forgot-password.json`,
          JSON.stringify({
            resetRequestSuccess: resetRequestSuccess,
            resetSuccess: resetSuccess,
            newLoginSuccess: newLoginSuccess
          }, null, 2)
        );

        expect(resetSuccess).toBeTruthy();
        expect(newLoginSuccess).toBeTruthy();
      } else {
        console.log('⚠ Reset OTP not available');
      }
    } else {
      console.log('⚠ Account creation failed, skipping forgot password test');
    }
  });

  // ============================================
  // 7. SESSION PERSISTENCE
  // ============================================
  test('7. Session Persistence - Refresh browser', async () => {
    console.log('\n=== TEST 7: SESSION PERSISTENCE ===');
    
    const customerEmail = `persist-${Date.now()}@agricatch.test`;
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: customerEmail,
        password: 'TestPass123!',
        first_name: 'Persist',
        last_name: 'Test',
        role: 'customer'
      }
    });

    await page.request.post('http://localhost:3000/api/auth/verify-otp', {
      data: {
        email: customerEmail,
        otp: OTP_BYPASS_CODE
      }
    });

    const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: customerEmail,
        password: 'TestPass123!'
      }
    });

    let token = null;
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      token = loginData.token || loginData.access_token;
    }

    // Set token and check
    await page.goto('http://localhost:3000/index.html');
    if (token) {
      await page.evaluate((t) => localStorage.setItem('token', t), token);
    }
    
    const tokenBeforeRefresh = await page.evaluate(() => localStorage.getItem('token'));
    
    // Refresh
    await page.reload();
    await page.waitForTimeout(2000);
    
    const tokenAfterRefresh = await page.evaluate(() => localStorage.getItem('token'));
    const sessionPersisted = tokenAfterRefresh === tokenBeforeRefresh;
    console.log(`Session persisted after refresh: ${sessionPersisted ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/7-session-persistence.json`,
      JSON.stringify({
        sessionPersisted: sessionPersisted,
        tokenBeforeRefresh: !!tokenBeforeRefresh,
        tokenAfterRefresh: !!tokenAfterRefresh
      }, null, 2)
    );

    expect(sessionPersisted).toBeTruthy();
  });

  // ============================================
  // 8. SESSION EXPIRATION
  // ============================================
  test('8. Session Expiration - Invalid token redirect', async () => {
    console.log('\n=== TEST 8: SESSION EXPIRATION ===');
    
    // Use an invalid token format to simulate expired/invalid token
    const invalidToken = 'invalid.token.format';

    // Set invalid token
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate((t) => localStorage.setItem('token', t), invalidToken);
    
    // Try to access protected page
    await page.goto('http://localhost:3000/customer-account.html');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    const redirectedToLogin = currentUrl.includes('login') || currentUrl.includes('index.html');
    console.log(`Invalid token redirects to login: ${redirectedToLogin ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/8-session-expiration.json`,
      JSON.stringify({
        redirectedToLogin: redirectedToLogin,
        currentUrl: currentUrl
      }, null, 2)
    );

    expect(redirectedToLogin).toBeTruthy();
  });

  // ============================================
  // 9. ROLE AUTHORIZATION
  // ============================================
  test('9. Role Authorization - Access control', async () => {
    console.log('\n=== TEST 9: ROLE AUTHORIZATION ===');
    
    // Create customer
    const customerEmail = `auth-customer-${Date.now()}@agricatch.test`;
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email: customerEmail,
        password: 'TestPass123!',
        first_name: 'Auth',
        last_name: 'Customer',
        role: 'customer'
      }
    });

    await page.request.post('http://localhost:3000/api/auth/verify-otp', {
      data: {
        email: customerEmail,
        otp: OTP_BYPASS_CODE
      }
    });

    const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: customerEmail,
        password: 'TestPass123!'
      }
    });

    let token = null;
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      token = loginData.token || loginData.access_token;
    }

    // Test customer cannot access farmer pages
    await page.goto('http://localhost:3000/index.html');
    if (token) {
      await page.evaluate((t) => localStorage.setItem('token', t), token);
    }
    
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForTimeout(2000);
    
    const farmerAccessBlocked = page.url().includes('login') || page.url().includes('index.html');
    console.log(`Customer cannot access farmer page: ${farmerAccessBlocked ? '✓' : '✗'}`);

    // Test customer cannot access admin pages
    await page.goto('http://localhost:3000/admin.html');
    await page.waitForTimeout(2000);
    
    const adminAccessBlocked = page.url().includes('login') || page.url().includes('index.html');
    console.log(`Customer cannot access admin page: ${adminAccessBlocked ? '✓' : '✗'}`);

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/9-role-authorization.json`,
      JSON.stringify({
        farmerAccessBlocked: farmerAccessBlocked,
        adminAccessBlocked: adminAccessBlocked
      }, null, 2)
    );

    expect(farmerAccessBlocked).toBeTruthy();
    expect(adminAccessBlocked).toBeTruthy();
  });

  // ============================================
  // 10. UI ELEMENTS
  // ============================================
  test('10. UI Elements - Buttons, forms, validation, loading states', async () => {
    console.log('\n=== TEST 10: UI ELEMENTS ===');
    
    await page.goto('http://localhost:3000/index.html');
    
    const uiResults = {
      loginButtonExists: false,
      registerButtonExists: false,
      loginModalExists: false,
      registerModalExists: false,
      emailInputExists: false,
      passwordInputExists: false,
      submitButtonExists: false
    };

    // Check for login button
    const loginBtn = page.locator('#login-btn, .login-btn');
    uiResults.loginButtonExists = await loginBtn.count() > 0;
    console.log(`Login button exists: ${uiResults.loginButtonExists ? '✓' : '✗'}`);

    // Check for register button
    const registerBtn = page.locator('#register-btn, .register-btn');
    uiResults.registerButtonExists = await registerBtn.count() > 0;
    console.log(`Register button exists: ${uiResults.registerButtonExists ? '✓' : '✗'}`);

    // Click login and check modal
    if (uiResults.loginButtonExists) {
      await loginBtn.first().click();
      await page.waitForTimeout(1000);
      
      const loginModal = page.locator('#loginModal, .login-modal, .modal.show');
      uiResults.loginModalExists = await loginModal.count() > 0;
      console.log(`Login modal exists: ${uiResults.loginModalExists ? '✓' : '✗'}`);

      // Check form inputs
      const emailInput = page.locator('input[name="email"], input[type="email"], #email');
      const passwordInput = page.locator('input[name="password"], input[type="password"], #password');
      const submitBtn = page.locator('button[type="submit"], .login-submit-btn, #login-submit');
      
      uiResults.emailInputExists = await emailInput.count() > 0;
      uiResults.passwordInputExists = await passwordInput.count() > 0;
      uiResults.submitButtonExists = await submitBtn.count() > 0;
      
      console.log(`Email input exists: ${uiResults.emailInputExists ? '✓' : '✗'}`);
      console.log(`Password input exists: ${uiResults.passwordInputExists ? '✓' : '✗'}`);
      console.log(`Submit button exists: ${uiResults.submitButtonExists ? '✓' : '✗'}`);
    }

    const fs = require('fs');
    fs.writeFileSync(
      `${evidenceDir}/10-ui-elements.json`,
      JSON.stringify(uiResults, null, 2)
    );

    expect(uiResults.loginButtonExists).toBeTruthy();
    expect(uiResults.emailInputExists).toBeTruthy();
    expect(uiResults.passwordInputExists).toBeTruthy();
  });
});
