# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin_navigation.spec.js >> Admin Sidebar Navigation >> Catalog submenu - Catalog Requests navigation
- Location: tests\admin_navigation.spec.js:103:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/admin.html
Call log:
  - navigating to "http://localhost:3000/admin.html", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * Playwright test: Admin Sidebar Navigation Verification
  3   |  * Tests each sidebar navigation item, section loading, modals, buttons, and API endpoints
  4   |  */
  5   | const { test, expect } = require('@playwright/test');
  6   | const { getAdminToken } = require('./auth-helper');
  7   | 
  8   | let authToken;
  9   | let adminUser;
  10  | 
  11  | test.beforeAll(async () => {
  12  |   // Generate a valid admin JWT token by querying the database
  13  |   const result = await getAdminToken();
  14  |   authToken = result.token;
  15  |   adminUser = result.user;
  16  |   console.log(`Authenticated as admin: ${adminUser.email} (${adminUser.role})`);
  17  | });
  18  | 
  19  | test.describe('Admin Sidebar Navigation', () => {
  20  |   test.beforeEach(async ({ page }) => {
  21  |     // Inject token and navigate to admin dashboard
> 22  |     await page.goto('http://localhost:3000/admin.html');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/admin.html
  23  |     await page.evaluate((token) => {
  24  |       localStorage.setItem('token', token);
  25  |     }, authToken);
  26  |     // Reload so admin.js picks up the token
  27  |     await page.reload();
  28  |     // Wait for dashboard overview to be active
  29  |     await page.waitForSelector('#overview.active', { timeout: 10000 });
  30  |   });
  31  | 
  32  |   // Helper function to test a sidebar navigation item
  33  |   async function testSidebarLink(page, sectionId, linkSelector, expectedTitle) {
  34  |     // Click the sidebar link
  35  |     await page.click(linkSelector);
  36  |     
  37  |     // Verify the section becomes active
  38  |     await expect(page.locator(`#${sectionId}`)).toHaveClass(/active/);
  39  |     
  40  |     // Verify other sections are not active
  41  |     const allSections = page.locator('.admin-section-card');
  42  |     const activeSections = await allSections.filter({ hasClass: 'active' }).count();
  43  |     expect(activeSections).toBe(1);
  44  |     
  45  |     // Verify page title is updated
  46  |     const pageTitle = await page.locator('.page-title').textContent();
  47  |     expect(pageTitle).toContain(expectedTitle);
  48  |     
  49  |     // Wait for spinner to resolve (if present) or content to load
  50  |     await page.waitForTimeout(2000);
  51  |     
  52  |     // Check for spinner - if present, wait for it to disappear
  53  |     const spinner = page.locator(`#${sectionId} .spinner-border`);
  54  |     if (await spinner.count() > 0) {
  55  |       await page.waitForSelector(`#${sectionId} .spinner-border`, { state: 'hidden', timeout: 10000 });
  56  |     }
  57  |     
  58  |     return true;
  59  |   }
  60  | 
  61  |   test('Dashboard navigation', async ({ page }) => {
  62  |     await testSidebarLink(page, 'overview', 'a[data-section="overview"]', 'Dashboard Overview');
  63  |     
  64  |     // Verify KPI cards are present
  65  |     await expect(page.locator('.info-card')).toHaveCount({ min: 4 });
  66  |   });
  67  | 
  68  |   test('Orders navigation', async ({ page }) => {
  69  |     await testSidebarLink(page, 'orders', 'a[data-section="orders"]', 'Order Management');
  70  |     
  71  |     // Verify orders table is present
  72  |     await expect(page.locator('#orders-tbody')).toBeVisible();
  73  |   });
  74  | 
  75  |   test('Listings (Products) navigation', async ({ page }) => {
  76  |     await testSidebarLink(page, 'products', 'a[data-section="products"]', 'Listings');
  77  |     
  78  |     // Verify products table is present
  79  |     await expect(page.locator('#products-tbody')).toBeVisible();
  80  |   });
  81  | 
  82  |   test('Catalog submenu - Products navigation', async ({ page }) => {
  83  |     // First expand the catalog submenu
  84  |     await page.click('a[data-bs-target="#nav-catalog"]');
  85  |     await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
  86  |     
  87  |     await testSidebarLink(page, 'catalog-products', 'a[data-section="catalog-products"]', 'Product Catalog');
  88  |     
  89  |     // Verify catalog products table is present
  90  |     await expect(page.locator('#catalog-names-tbody')).toBeVisible();
  91  |   });
  92  | 
  93  |   test('Catalog submenu - Categories navigation', async ({ page }) => {
  94  |     await page.click('a[data-bs-target="#nav-catalog"]');
  95  |     await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
  96  |     
  97  |     await testSidebarLink(page, 'categories', 'a[data-section="categories"]', 'Category Management');
  98  |     
  99  |     // Verify categories table is present
  100 |     await expect(page.locator('#categories-tbody')).toBeVisible();
  101 |   });
  102 | 
  103 |   test('Catalog submenu - Catalog Requests navigation', async ({ page }) => {
  104 |     await page.click('a[data-bs-target="#nav-catalog"]');
  105 |     await page.waitForSelector('#nav-catalog.show', { timeout: 5000 });
  106 |     
  107 |     await testSidebarLink(page, 'category-requests', 'a[data-section="category-requests"]', 'Product Catalog Requests');
  108 |     
  109 |     // Verify category requests table is present
  110 |     await expect(page.locator('#category-requests-tbody')).toBeVisible();
  111 |   });
  112 | 
  113 |   test('Pending Approvals navigation', async ({ page }) => {
  114 |     await testSidebarLink(page, 'product-approvals', 'a[data-section="product-approvals"]', 'Pending Approvals');
  115 |     
  116 |     // Verify product approvals table is present
  117 |     await expect(page.locator('#product-approvals-tbody')).toBeVisible();
  118 |   });
  119 | 
  120 |   test('Customers navigation', async ({ page }) => {
  121 |     await testSidebarLink(page, 'users', 'a[data-section="users"]', 'Customer Management');
  122 |     
```