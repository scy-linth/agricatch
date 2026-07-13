# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: real-world-simulation.spec.js >> Real World Simulation - Access Control & Abuse Testing >> CART - Add Regular and Preorder Products
- Location: tests\real-world-simulation.spec.js:87:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_RESET at http://localhost:3000/index.html
Call log:
  - navigating to "http://localhost:3000/index.html", waiting until "load"

```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | // REAL WORLD USER SIMULATION AND ABUSE TEST
  4   | // This test performs actual browser interactions with realistic data
  5   | 
  6   | test.describe('Real World Simulation - Access Control & Abuse Testing', () => {
  7   |   let page;
  8   |   const screenshotDir = 'test-results/simulation-screenshots';
  9   |   const evidenceDir = 'test-results/simulation-evidence';
  10  | 
  11  |   test.beforeAll(async ({ browser }) => {
  12  |     const fs = require('fs');
  13  |     if (!fs.existsSync(screenshotDir)) {
  14  |       fs.mkdirSync(screenshotDir, { recursive: true });
  15  |     }
  16  |     if (!fs.existsSync(evidenceDir)) {
  17  |       fs.mkdirSync(evidenceDir, { recursive: true });
  18  |     }
  19  |   });
  20  | 
  21  |   test.beforeEach(async ({ browser }) => {
  22  |     page = await browser.newPage();
  23  |     // Clear localStorage before each test
> 24  |     await page.goto('http://localhost:3000/index.html');
      |                ^ Error: page.goto: net::ERR_CONNECTION_RESET at http://localhost:3000/index.html
  25  |     await page.evaluate(() => localStorage.clear());
  26  |   });
  27  | 
  28  |   test.afterEach(async () => {
  29  |     await page.close();
  30  |   });
  31  | 
  32  |   // ============================================
  33  |   // GUEST ACCESS CONTROL TESTING
  34  |   // ============================================
  35  |   test('GUEST - Direct Access to Protected Pages', async () => {
  36  |     console.log('\n=== GUEST ACCESS CONTROL TESTING ===');
  37  |     
  38  |     const protectedPages = [
  39  |       { url: '/checkout.html', name: 'Checkout' },
  40  |       { url: '/orders.html', name: 'Orders' },
  41  |       { url: '/customer-account.html', name: 'Customer Account' },
  42  |       { url: '/farmer.html', name: 'Farmer Dashboard' },
  43  |       { url: '/admin.html', name: 'Admin Dashboard' },
  44  |       { url: '/notifications.html', name: 'Notifications' },
  45  |       { url: '/chat.html', name: 'Chat' }
  46  |     ];
  47  | 
  48  |     const accessResults = [];
  49  | 
  50  |     for (const pageInfo of protectedPages) {
  51  |       console.log(`Testing: ${pageInfo.name}`);
  52  |       await page.goto(`http://localhost:3000${pageInfo.url}`);
  53  |       await page.waitForTimeout(2000);
  54  |       
  55  |       const screenshotName = `guest-access-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`;
  56  |       await page.screenshot({ path: `${screenshotDir}/${screenshotName}`, fullPage: true });
  57  |       
  58  |       // Check if redirected to login or shows error
  59  |       const currentUrl = page.url();
  60  |       const hasLoginModal = await page.locator('#loginModal, .login-modal, [data-modal="login"]').count() > 0;
  61  |       const hasLoginPrompt = await page.locator('.login-prompt, .guest-login-prompt').count() > 0;
  62  |       
  63  |       const isProtected = currentUrl.includes('login') || hasLoginModal || hasLoginPrompt;
  64  |       accessResults.push({
  65  |         page: pageInfo.name,
  66  |         url: pageInfo.url,
  67  |         isProtected: isProtected,
  68  |         currentUrl: currentUrl,
  69  |         hasLoginModal: hasLoginModal,
  70  |         hasLoginPrompt: hasLoginPrompt
  71  |       });
  72  |       
  73  |       console.log(`  - Protected: ${isProtected ? 'YES' : 'NO'}`);
  74  |     }
  75  | 
  76  |     // Save evidence
  77  |     const fs = require('fs');
  78  |     fs.writeFileSync(
  79  |       `${evidenceDir}/guest-access-control.json`,
  80  |       JSON.stringify(accessResults, null, 2)
  81  |     );
  82  |   });
  83  | 
  84  |   // ============================================
  85  |   // CART FUNCTIONALITY TESTING
  86  |   // ============================================
  87  |   test('CART - Add Regular and Preorder Products', async () => {
  88  |     console.log('\n=== CART FUNCTIONALITY TESTING ===');
  89  |     
  90  |     await page.goto('http://localhost:3000/index.html');
  91  |     await page.waitForLoadState('networkidle');
  92  |     await page.screenshot({ path: `${screenshotDir}/cart-01-landing.png`, fullPage: true });
  93  | 
  94  |     // Find and click on first product
  95  |     const productCards = page.locator('.product-card, .card');
  96  |     const cardCount = await productCards.count();
  97  |     console.log(`Found ${cardCount} product cards`);
  98  | 
  99  |     if (cardCount > 0) {
  100 |       // Click first product
  101 |       await productCards.first().click();
  102 |       await page.waitForTimeout(2000);
  103 |       await page.screenshot({ path: `${screenshotDir}/cart-02-product-details.png`, fullPage: true });
  104 | 
  105 |       // Check for preorder indicator
  106 |       const preorderIndicator = page.locator('.preorder-badge, [data-preorder="true"], .preorder-indicator');
  107 |       const isPreorder = await preorderIndicator.count() > 0;
  108 |       console.log(`Product is preorder: ${isPreorder ? 'YES' : 'NO'}`);
  109 | 
  110 |       // Try to add to cart
  111 |       const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn, [data-action="add-to-cart"]');
  112 |       if (await addToCartBtn.count() > 0) {
  113 |         await addToCartBtn.first().click();
  114 |         await page.waitForTimeout(2000);
  115 |         
  116 |         // Check for toast/notification
  117 |         const toast = page.locator('.toast, .notification, [role="alert"]');
  118 |         const toastVisible = await toast.count() > 0;
  119 |         console.log(`Toast visible: ${toastVisible ? 'YES' : 'NO'}`);
  120 |         
  121 |         await page.screenshot({ path: `${screenshotDir}/cart-03-after-add-to-cart.png`, fullPage: true });
  122 |       }
  123 | 
  124 |       // Check cart count
```