# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin_navigation.spec.js >> Admin Sidebar Navigation >> Dashboard navigation
- Location: tests\admin_navigation.spec.js:61:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 21
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - button "Toggle sidebar" [ref=e4] [cursor=pointer]:
        - generic [ref=e5]: 
      - link "AgriCatch AgriCatch" [ref=e6] [cursor=pointer]:
        - /url: /
        - img "AgriCatch" [ref=e7]
        - generic [ref=e8]: AgriCatch
    - navigation [ref=e9]:
      - list [ref=e10]:
        - listitem: 
        - listitem [ref=e11]:
          - link "" [ref=e12] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e13]: 
        - listitem [ref=e14]:
          - link "" [ref=e15] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e16]: 
        - listitem [ref=e17]:
          - link "S Staff" [ref=e18] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e20]: S
            - generic [ref=e21]: Staff
          - text:    
  - complementary [ref=e22]:
    - list [ref=e23]:
      - listitem [ref=e24]: Overview
      - listitem [ref=e25]:
        - link " Dashboard" [active] [ref=e26] [cursor=pointer]:
          - /url: "#overview"
          - generic [ref=e27]: 
          - generic [ref=e28]: Dashboard
      - listitem [ref=e29]: Commerce
      - listitem [ref=e30]:
        - link " Orders" [ref=e31] [cursor=pointer]:
          - /url: "#orders"
          - generic [ref=e32]: 
          - generic [ref=e33]: Orders
      - listitem [ref=e34]:
        - link " Listings" [ref=e35] [cursor=pointer]:
          - /url: "#products"
          - generic [ref=e36]: 
          - generic [ref=e37]: Listings
      - listitem [ref=e38]: Catalog
      - listitem [ref=e39]:
        - link " Product Management " [ref=e40] [cursor=pointer]:
          - /url: "#"
          - generic [ref=e41]: 
          - generic [ref=e42]: Product Management
          - generic [ref=e43]: 
        - text:   
      - listitem [ref=e44]: Product Approvals
      - listitem [ref=e45]:
        - link " Pending Approvals" [ref=e46] [cursor=pointer]:
          - /url: "#product-approvals"
          - generic [ref=e47]: 
          - generic [ref=e48]: Pending Approvals
      - listitem [ref=e49]: People
      - listitem [ref=e50]:
        - link " Customers" [ref=e51] [cursor=pointer]:
          - /url: "#users"
          - generic [ref=e52]: 
          - generic [ref=e53]: Customers
      - listitem [ref=e54]:
        - link " Farmers" [ref=e55] [cursor=pointer]:
          - /url: "#farmers"
          - generic [ref=e56]: 
          - generic [ref=e57]: Farmers
      - listitem [ref=e58]:
        - link " Staff" [ref=e59] [cursor=pointer]:
          - /url: "#staff"
          - generic [ref=e60]: 
          - generic [ref=e61]: Staff
      - text: 
      - listitem [ref=e62]: Communication
      - listitem [ref=e63]:
        - link " Chat & Support" [ref=e64] [cursor=pointer]:
          - /url: "#chat"
          - generic [ref=e65]: 
          - generic [ref=e66]: Chat & Support
      - listitem [ref=e67]:
        - link " Notifications" [ref=e68] [cursor=pointer]:
          - /url: "#notifications"
          - generic [ref=e69]: 
          - generic [ref=e70]: Notifications
      - listitem [ref=e71]: Security
      - text:       
  - main [ref=e72]:
    - generic [ref=e73]:
      - heading "Dashboard Overview" [level=1] [ref=e74]
      - navigation [ref=e75]:
        - list [ref=e76]:
          - listitem [ref=e77]:
            - link "Home" [ref=e78] [cursor=pointer]:
              - /url: /
          - listitem [ref=e79]: / Dashboard
    - generic [ref=e80]:
      - generic [ref=e81]:
        - generic [ref=e83]:
          - link "" [ref=e85] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e86]: 
          - generic [ref=e87]:
            - heading "Sales | Today" [level=5] [ref=e88]
            - generic [ref=e89]:
              - generic [ref=e91]: 
              - generic [ref=e92]:
                - heading "0" [level=6] [ref=e93]
                - text: +0% vs prev today
            - text: 
        - generic [ref=e95]:
          - link "" [ref=e97] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e98]: 
          - generic [ref=e99]:
            - heading "Revenue | Today" [level=5] [ref=e100]
            - generic [ref=e101]:
              - generic [ref=e103]: 
              - generic [ref=e104]:
                - heading "₱0.00" [level=6] [ref=e105]
                - text: +0% vs prev today
            - text: 
        - generic [ref=e107]:
          - link "" [ref=e109] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e110]: 
          - generic [ref=e111]:
            - heading "Customers | Today" [level=5] [ref=e112]
            - generic [ref=e113]:
              - generic [ref=e115]: 
              - generic [ref=e116]:
                - heading "0" [level=6] [ref=e117]
                - text: +0% vs prev today
            - text: 
        - generic [ref=e119]:
          - link "" [ref=e121] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e122]: 
          - generic [ref=e123]:
            - heading "Farmers | Today" [level=5] [ref=e124]
            - generic [ref=e125]:
              - generic [ref=e127]: 
              - generic [ref=e128]:
                - heading "0" [level=6] [ref=e129]
                - text: +0% vs prev today
            - text: 
      - generic [ref=e130]:
        - generic [ref=e132]:
          - link "" [ref=e134] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e135]: 
          - generic [ref=e136]:
            - heading "Reports | Today" [level=5] [ref=e137]
            - img [ref=e140]:
              - generic [ref=e143]:
                - generic "₱10" [ref=e144]
                - generic "₱9" [ref=e145]
                - generic "₱8" [ref=e146]
                - generic "₱7" [ref=e147]
                - generic "₱6" [ref=e148]
                - generic "₱5" [ref=e149]
                - generic "₱4" [ref=e150]
                - generic "₱3" [ref=e151]
                - generic "₱2" [ref=e152]
                - generic "₱1" [ref=e153]
                - generic "₱0" [ref=e154]
              - generic [ref=e160]:
                - generic "10" [ref=e161]
                - generic "9" [ref=e162]
                - generic "8" [ref=e163]
                - generic "7" [ref=e164]
                - generic "6" [ref=e165]
                - generic "5" [ref=e166]
                - generic "4" [ref=e167]
                - generic "3" [ref=e168]
                - generic "2" [ref=e169]
                - generic "1" [ref=e170]
                - generic "0" [ref=e171]
        - generic [ref=e173]:
          - link "" [ref=e175] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e176]: 
          - generic [ref=e177]:
            - heading "Recent Activity | Today" [level=5] [ref=e178]
            - generic [ref=e179]:
              - generic [ref=e180]: Show
              - combobox [ref=e181]:
                - option "5" [selected]
                - option "10"
                - option "20"
              - generic [ref=e182]: entries
            - generic [ref=e183]:
              - generic [ref=e184]:
                - generic [ref=e185]: 
                - generic [ref=e186]:
                  - generic [ref=e187]: "Catalog Name Delete (product_name_catalog #87)"
                  - generic [ref=e188]:
                    - generic [ref=e189]: scy_linth
                    - generic [ref=e190]: Jun 8 · 02:23 PM
              - generic [ref=e191]:
                - generic [ref=e192]: 
                - generic [ref=e193]:
                  - generic [ref=e194]: "Catalog Name Delete (product_name_catalog #91)"
                  - generic [ref=e195]:
                    - generic [ref=e196]: scy_linth
                    - generic [ref=e197]: Jun 8 · 02:23 PM
              - generic [ref=e198]:
                - generic [ref=e199]: 
                - generic [ref=e200]:
                  - generic [ref=e201]: "Catalog Name Delete (product_name_catalog #71)"
                  - generic [ref=e202]:
                    - generic [ref=e203]: scy_linth
                    - generic [ref=e204]: Jun 8 · 02:20 PM
              - generic [ref=e205]:
                - generic [ref=e206]: 
                - generic [ref=e207]:
                  - generic [ref=e208]: "Catalog Name Delete (product_name_catalog #80)"
                  - generic [ref=e209]:
                    - generic [ref=e210]: scy_linth
                    - generic [ref=e211]: Jun 8 · 02:20 PM
              - generic [ref=e212]:
                - generic [ref=e213]: 
                - generic [ref=e214]:
                  - generic [ref=e215]: "Catalog Name Delete (product_name_catalog #78)"
                  - generic [ref=e216]:
                    - generic [ref=e217]: scy_linth
                    - generic [ref=e218]: Jun 8 · 02:20 PM
            - generic [ref=e219]:
              - generic [ref=e220]: Showing 1–5 of 16
              - generic [ref=e221]:
                - button "‹" [disabled]
                - button "1" [ref=e222] [cursor=pointer]
                - button "2" [ref=e223] [cursor=pointer]
                - button "3" [ref=e224] [cursor=pointer]
                - button "4" [ref=e225] [cursor=pointer]
                - button "›" [ref=e226] [cursor=pointer]
      - generic [ref=e227]:
        - generic [ref=e229]:
          - link "" [ref=e231] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e232]: 
          - generic [ref=e233]:
            - heading "Recent Sales | Today" [level=5] [ref=e234]
            - generic [ref=e235]:
              - generic [ref=e236]: Show
              - combobox [ref=e237]:
                - option "5" [selected]
                - option "10"
                - option "25"
                - option "50"
              - generic [ref=e238]: entries
            - table [ref=e239]:
              - rowgroup [ref=e240]:
                - row "# Customer Product Price Status" [ref=e241]:
                  - columnheader "#" [ref=e242]
                  - columnheader "Customer" [ref=e243]
                  - columnheader "Product" [ref=e244]
                  - columnheader "Price" [ref=e245]
                  - columnheader "Status" [ref=e246]
              - rowgroup [ref=e247]:
                - row "No recent sales" [ref=e248]:
                  - cell "No recent sales" [ref=e249]
            - generic [ref=e251]: Showing 1–0 of 0
        - generic [ref=e253]:
          - link "" [ref=e255] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e256]: 
          - generic [ref=e257]:
            - heading "Top Farmers | Today" [level=5] [ref=e258]
            - generic [ref=e259]:
              - generic [ref=e260]: Show
              - combobox [ref=e261]:
                - option "5" [selected]
                - option "10"
                - option "25"
              - generic [ref=e262]: entries
            - table [ref=e263]:
              - rowgroup [ref=e264]:
                - row "Farmer Revenue" [ref=e265]:
                  - columnheader "Farmer" [ref=e266]
                  - columnheader "Revenue" [ref=e267]
              - rowgroup [ref=e268]:
                - row "No data for this period" [ref=e269]:
                  - cell "No data for this period" [ref=e270]
            - generic [ref=e272]: Showing 1–0 of 0
      - generic [ref=e275]:
        - link "" [ref=e277] [cursor=pointer]:
          - /url: "#"
          - generic [ref=e278]: 
        - generic [ref=e279]:
          - heading "Top Selling Products | Today" [level=5] [ref=e280]
          - generic [ref=e281]:
            - generic [ref=e282]: Show
            - combobox [ref=e283]:
              - option "5" [selected]
              - option "10"
              - option "25"
            - generic [ref=e284]: entries
          - table [ref=e285]:
            - rowgroup [ref=e286]:
              - row "Preview Product Price Sold Revenue" [ref=e287]:
                - columnheader "Preview" [ref=e288]
                - columnheader "Product" [ref=e289]
                - columnheader "Price" [ref=e290]
                - columnheader "Sold" [ref=e291]
                - columnheader "Revenue" [ref=e292]
            - rowgroup [ref=e293]:
              - row "No data for this period" [ref=e294]:
                - cell "No data for this period" [ref=e295]
          - generic [ref=e297]: Showing 1–0 of 0
    - text:                                                           
  - text:    
  - text:                
  - text:   
  - img
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
  22  |     await page.goto('http://localhost:3000/admin.html');
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
> 43  |     expect(activeSections).toBe(1);
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
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
  123 |     // Verify users table is present
  124 |     await expect(page.locator('#users-tbody')).toBeVisible();
  125 |   });
  126 | 
  127 |   test('Farmers navigation', async ({ page }) => {
  128 |     await testSidebarLink(page, 'farmers', 'a[data-section="farmers"]', 'Farmer Management');
  129 |     
  130 |     // Verify farmers table is present
  131 |     await expect(page.locator('#farmers-tbody')).toBeVisible();
  132 |   });
  133 | 
  134 |   test('Chat & Support navigation', async ({ page }) => {
  135 |     await testSidebarLink(page, 'chat', 'a[data-section="chat"]', 'Chat & Support');
  136 |     
  137 |     // Verify chat interface is present
  138 |     await expect(page.locator('#admin-chat-drawer')).toBeVisible();
  139 |   });
  140 | 
  141 |   test('Notifications navigation', async ({ page }) => {
  142 |     await testSidebarLink(page, 'notifications', 'a[data-section="notifications"]', 'Notifications');
  143 |     
```