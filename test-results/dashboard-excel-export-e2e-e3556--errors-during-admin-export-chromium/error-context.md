# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-excel-export-e2e.spec.js >> Dashboard Excel Export E2E Verification >> Console and Server Error Checks >> 2. Check for browser console errors during admin export
- Location: tests\dashboard-excel-export-e2e.spec.js:383:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8888/index.html
Call log:
  - navigating to "http://localhost:8888/index.html", waiting until "load"

```

# Test source

```ts
  292 |       });
  293 |       
  294 |       // Click export button 5 times rapidly
  295 |       for (let i = 0; i < 5; i++) {
  296 |         await exportBtn.click();
  297 |         await page.waitForTimeout(500);
  298 |       }
  299 |       
  300 |       await page.waitForTimeout(2000);
  301 |       console.log('Console errors after rapid clicks:', errors);
  302 |       expect(errors.length).toBe(0);
  303 |       
  304 |       console.log('✓ PASS: No errors from rapid repeated export clicks');
  305 |     });
  306 |   });
  307 | 
  308 |   test.describe('Security Tests', () => {
  309 |     test('1. Unauthorized users cannot access farmer export endpoint', async ({ context }) => {
  310 |       // Try to access export endpoint without authentication
  311 |       const response = await context.request.get('http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=30');
  312 |       
  313 |       expect(response.status()).toBe(401);
  314 |       console.log('✓ PASS: Unauthorized access to farmer export endpoint returns 401');
  315 |     });
  316 | 
  317 |     test('2. Unauthorized users cannot access admin export endpoint', async ({ context }) => {
  318 |       // Try to access export endpoint without authentication
  319 |       const response = await context.request.get('http://localhost:3000/api/admin/dashboard/export.xlsx?period=month');
  320 |       
  321 |       expect(response.status()).toBe(401);
  322 |       console.log('✓ PASS: Unauthorized access to admin export endpoint returns 401');
  323 |     });
  324 | 
  325 |     test('3. Non-premium farmer cannot export', async ({ page, context }) => {
  326 |       // First, login as a non-premium farmer via API
  327 |       const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
  328 |         data: {
  329 |           email: 'dhelhilis@gmail.com',
  330 |           password: 'password123'
  331 |         }
  332 |       });
  333 |       
  334 |       const loginData = await loginResponse.json();
  335 |       const token = loginData.token;
  336 |       
  337 |       // Try to access export endpoint
  338 |       const exportResponse = await context.request.get('http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=30', {
  339 |         headers: {
  340 |           'Authorization': `Bearer ${token}`
  341 |         }
  342 |       });
  343 |       
  344 |       // Since dhelhilis@gmail.com is premium, this should succeed
  345 |       // For a true non-premium test, we'd need a non-premium farmer account
  346 |       console.log('Note: dhelhilis@gmail.com is a premium farmer account');
  347 |       console.log('Response status:', exportResponse.status());
  348 |     });
  349 |   });
  350 | 
  351 |   test.describe('Console and Server Error Checks', () => {
  352 |     test('1. Check for browser console errors during farmer export', async ({ page }) => {
  353 |       const errors = [];
  354 |       page.on('console', msg => {
  355 |         if (msg.type() === 'error') {
  356 |           errors.push(msg.text());
  357 |         }
  358 |       });
  359 |       
  360 |       // Login as farmer
  361 |       await page.goto('http://localhost:8888/index.html');
  362 |       await page.click('#login-btn');
  363 |       await page.waitForSelector('#auth-modal', { state: 'visible' });
  364 |       await page.fill('#auth-email', 'dhelhilis@gmail.com');
  365 |       await page.fill('#auth-password', 'password123');
  366 |       await page.click('#auth-submit-btn');
  367 |       await page.waitForTimeout(3000);
  368 |       
  369 |       // Navigate to dashboard
  370 |       await page.goto('http://localhost:8888/farmer.html');
  371 |       await page.waitForTimeout(3000);
  372 |       
  373 |       // Perform export
  374 |       const exportBtn = page.locator('#export-dashboard-btn');
  375 |       await exportBtn.click();
  376 |       await page.waitForTimeout(3000);
  377 |       
  378 |       console.log('Console errors during farmer export:', errors);
  379 |       expect(errors.length).toBe(0);
  380 |       console.log('✓ PASS: No browser console errors during farmer export');
  381 |     });
  382 | 
  383 |     test('2. Check for browser console errors during admin export', async ({ page }) => {
  384 |       const errors = [];
  385 |       page.on('console', msg => {
  386 |         if (msg.type() === 'error') {
  387 |           errors.push(msg.text());
  388 |         }
  389 |       });
  390 |       
  391 |       // Login as admin
> 392 |       await page.goto('http://localhost:8888/index.html');
      |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8888/index.html
  393 |       await page.click('#login-btn');
  394 |       await page.waitForSelector('#auth-modal', { state: 'visible' });
  395 |       await page.fill('#auth-email', 'admin');
  396 |       await page.fill('#auth-password', 'adminadmin');
  397 |       await page.click('#auth-submit-btn');
  398 |       await page.waitForTimeout(3000);
  399 |       
  400 |       // Navigate to dashboard
  401 |       await page.goto('http://localhost:8888/admin.html');
  402 |       await page.waitForTimeout(3000);
  403 |       
  404 |       // Perform export
  405 |       const exportBtn = page.locator('#export-dashboard-btn');
  406 |       await exportBtn.click();
  407 |       await page.waitForTimeout(3000);
  408 |       
  409 |       console.log('Console errors during admin export:', errors);
  410 |       expect(errors.length).toBe(0);
  411 |       console.log('✓ PASS: No browser console errors during admin export');
  412 |     });
  413 | 
  414 |     test('3. Check for server errors during farmer export', async ({ page, context }) => {
  415 |       // Login as farmer via API
  416 |       const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
  417 |         data: {
  418 |           email: 'dhelhilis@gmail.com',
  419 |           password: 'password123'
  420 |         }
  421 |       });
  422 |       
  423 |       const loginData = await loginResponse.json();
  424 |       const token = loginData.token;
  425 |       
  426 |       // Call export endpoint
  427 |       const exportResponse = await context.request.get('http://localhost:3000/api/farmers/me/metrics/export.xlsx?rangeDays=30', {
  428 |         headers: {
  429 |           'Authorization': `Bearer ${token}`
  430 |         }
  431 |       });
  432 |       
  433 |       expect(exportResponse.status()).toBe(200);
  434 |       console.log('✓ PASS: No server errors during farmer export');
  435 |     });
  436 | 
  437 |     test('4. Check for server errors during admin export', async ({ page, context }) => {
  438 |       // Login as admin via API
  439 |       const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
  440 |         data: {
  441 |           email: 'admin',
  442 |           password: 'adminadmin'
  443 |         }
  444 |       });
  445 |       
  446 |       const loginData = await loginResponse.json();
  447 |       const token = loginData.token;
  448 |       
  449 |       // Call export endpoint
  450 |       const exportResponse = await context.request.get('http://localhost:3000/api/admin/dashboard/export.xlsx?period=month', {
  451 |         headers: {
  452 |           'Authorization': `Bearer ${token}`
  453 |         }
  454 |       });
  455 |       
  456 |       expect(exportResponse.status()).toBe(200);
  457 |       console.log('✓ PASS: No server errors during admin export');
  458 |     });
  459 |   });
  460 | });
  461 | 
```