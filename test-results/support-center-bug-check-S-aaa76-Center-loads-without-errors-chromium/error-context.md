# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: support-center-bug-check.spec.js >> Support Center Bug Check - Admin & Superadmin >> Admin: Support Center loads without errors
- Location: tests\support-center-bug-check.spec.js:32:3

# Error details

```
"beforeAll" hook timeout of 30000ms exceeded.
```

```
Error: page.waitForLoadState: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
          - link "A Admin" [ref=e18] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e20]: A
            - generic [ref=e21]: Admin
          - text:    
  - complementary [ref=e22]:
    - list [ref=e23]:
      - listitem [ref=e24]: Overview
      - listitem [ref=e25]:
        - link " Dashboard" [ref=e26] [cursor=pointer]:
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
        - text:  
      - listitem [ref=e44]: Requests
      - listitem [ref=e45]:
        - link " Pending Approvals" [ref=e46] [cursor=pointer]:
          - /url: "#product-approvals"
          - generic [ref=e47]: 
          - generic [ref=e48]: Pending Approvals
      - listitem [ref=e49]:
        - link " Verification Requests" [ref=e50] [cursor=pointer]:
          - /url: "#verification-requests"
          - generic [ref=e51]: 
          - generic [ref=e52]: Verification Requests
      - listitem [ref=e53]:
        - link " Catalog Requests" [ref=e54] [cursor=pointer]:
          - /url: "#category-requests"
          - generic [ref=e55]: 
          - generic [ref=e56]: Catalog Requests
      - listitem [ref=e57]:
        - link " Subscription Requests" [ref=e58] [cursor=pointer]:
          - /url: "#subscription-requests"
          - generic [ref=e59]: 
          - generic [ref=e60]: Subscription Requests
      - listitem [ref=e61]: People
      - listitem [ref=e62]:
        - link " Users " [ref=e63] [cursor=pointer]:
          - /url: "#"
          - generic [ref=e64]: 
          - generic [ref=e65]: Users
          - generic [ref=e66]: 
        - text:   
      - text: 
      - listitem [ref=e67]: Communication
      - listitem [ref=e68]:
        - link " Support Center" [ref=e69] [cursor=pointer]:
          - /url: "#chat"
          - generic [ref=e70]: 
          - generic [ref=e71]: Support Center
      - listitem [ref=e72]:
        - link " Notifications" [ref=e73] [cursor=pointer]:
          - /url: "#notifications"
          - generic [ref=e74]: 
          - generic [ref=e75]: Notifications
      - text:         
  - main [ref=e76]:
    - generic [ref=e77]:
      - heading "Dashboard Overview" [level=1] [ref=e78]
      - navigation [ref=e79]:
        - list [ref=e80]:
          - listitem [ref=e81]: Home
          - listitem [ref=e82]: / Dashboard
    - generic [ref=e83]:
      - generic [ref=e84]:
        - generic [ref=e86]:
          - link "" [ref=e88] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e89]: 
          - generic [ref=e90]:
            - heading "Sales | Today" [level=5] [ref=e91]
            - generic [ref=e92]:
              - generic [ref=e94]: 
              - generic [ref=e95]:
                - heading "0" [level=6] [ref=e96]
                - text: +0% vs prev today
            - text: 
        - generic [ref=e98]:
          - link "" [ref=e100] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e101]: 
          - generic [ref=e102]:
            - heading "Revenue | Today" [level=5] [ref=e103]
            - generic [ref=e104]:
              - generic [ref=e106]: 
              - generic [ref=e107]:
                - heading "₱0.00" [level=6] [ref=e108]
                - text: +0% vs prev today
            - text: 
        - generic [ref=e110]:
          - link "" [ref=e112] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e113]: 
          - generic [ref=e114]:
            - heading "Customers | Today" [level=5] [ref=e115]
            - generic [ref=e116]:
              - generic [ref=e118]: 
              - generic [ref=e119]:
                - heading "1" [level=6] [ref=e120]
                - text: +100% vs prev today
            - text: 
        - generic [ref=e122]:
          - link "" [ref=e124] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e125]: 
          - generic [ref=e126]:
            - heading "Farmers | Today" [level=5] [ref=e127]
            - generic [ref=e128]:
              - generic [ref=e130]: 
              - generic [ref=e131]:
                - heading "0" [level=6] [ref=e132]
                - text: +0% vs prev today
            - text: 
      - generic [ref=e133]:
        - generic [ref=e135]:
          - link "" [ref=e137] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e138]: 
          - generic [ref=e139]:
            - heading "Reports | Today" [level=5] [ref=e140]
            - generic [ref=e142]: No data available
        - generic [ref=e144]:
          - link "" [ref=e146] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e147]: 
          - generic [ref=e148]:
            - heading "Recent Activity | Today" [level=5] [ref=e149]
            - generic [ref=e150]:
              - generic [ref=e151]: Show
              - combobox [ref=e152]:
                - option "5" [selected]
                - option "10"
                - option "20"
              - generic [ref=e153]: entries
            - generic [ref=e154]:
              - generic [ref=e155]:
                - generic [ref=e156]: 
                - generic [ref=e157]:
                  - generic [ref=e158]: "Login Success (users #41)"
                  - generic [ref=e159]:
                    - generic [ref=e160]: customer
                    - generic [ref=e161]: Jun 19 · 03:20 PM
              - generic [ref=e162]:
                - generic [ref=e163]: 
                - generic [ref=e164]:
                  - generic [ref=e165]: "Verification Request Review (verification_requests #6)"
                  - generic [ref=e166]:
                    - generic [ref=e167]: scy_linth
                    - generic [ref=e168]: Jun 19 · 02:53 PM
              - generic [ref=e169]:
                - generic [ref=e170]: 
                - generic [ref=e171]:
                  - generic [ref=e172]: "Support Ticket Message Sent (support_tickets #5)"
                  - generic [ref=e173]:
                    - generic [ref=e174]: scy_linth
                    - generic [ref=e175]: Jun 19 · 02:37 PM
              - generic [ref=e176]:
                - generic [ref=e177]: 
                - generic [ref=e178]:
                  - generic [ref=e179]: "Support Ticket Message Sent (support_tickets #5)"
                  - generic [ref=e180]:
                    - generic [ref=e181]: admin
                    - generic [ref=e182]: Jun 19 · 02:33 PM
              - generic [ref=e183]:
                - generic [ref=e184]: 
                - generic [ref=e185]:
                  - generic [ref=e186]: "Support Ticket Message Sent (support_tickets #5)"
                  - generic [ref=e187]:
                    - generic [ref=e188]: scy_linth
                    - generic [ref=e189]: Jun 19 · 02:32 PM
            - generic [ref=e190]:
              - generic [ref=e191]: Showing 1–5 of 74
              - generic [ref=e192]:
                - button "‹" [disabled]
                - button "1" [ref=e193] [cursor=pointer]
                - button "2" [ref=e194] [cursor=pointer]
                - button "3" [ref=e195] [cursor=pointer]
                - button "…" [disabled]
                - button "15" [ref=e196] [cursor=pointer]
                - button "›" [ref=e197] [cursor=pointer]
      - generic [ref=e198]:
        - generic [ref=e200]:
          - link "" [ref=e202] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e203]: 
          - generic [ref=e204]:
            - heading "Recent Orders | Today" [level=5] [ref=e205]
            - generic [ref=e206]:
              - generic [ref=e207]: Show
              - combobox [ref=e208]:
                - option "5" [selected]
                - option "10"
                - option "25"
                - option "50"
              - generic [ref=e209]: entries
            - table [ref=e210]:
              - rowgroup [ref=e211]:
                - row "IMAGE Customer Product Price Sold Revenue Status" [ref=e212]:
                  - columnheader "IMAGE" [ref=e213]
                  - columnheader "Customer" [ref=e214]
                  - columnheader "Product" [ref=e215]
                  - columnheader "Price" [ref=e216]
                  - columnheader "Sold" [ref=e217]
                  - columnheader "Revenue" [ref=e218]
                  - columnheader "Status" [ref=e219]
              - rowgroup [ref=e220]:
                - row "No recent sales" [ref=e221]:
                  - cell "No recent sales" [ref=e222]
            - generic [ref=e224]: Showing 1–0 of 0
        - generic [ref=e226]:
          - link "" [ref=e228] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e229]: 
          - generic [ref=e230]:
            - heading "Top Farmers | Today" [level=5] [ref=e231]
            - generic [ref=e232]:
              - generic [ref=e233]: Show
              - combobox [ref=e234]:
                - option "5" [selected]
                - option "10"
                - option "25"
              - generic [ref=e235]: entries
            - table [ref=e236]:
              - rowgroup [ref=e237]:
                - row "Farmer Revenue" [ref=e238]:
                  - columnheader "Farmer" [ref=e239]
                  - columnheader "Revenue" [ref=e240]
              - rowgroup [ref=e241]:
                - row "No data for this period" [ref=e242]:
                  - cell "No data for this period" [ref=e243]
            - generic [ref=e245]: Showing 1–0 of 0
      - generic [ref=e248]:
        - link "" [ref=e250] [cursor=pointer]:
          - /url: "#"
          - generic [ref=e251]: 
        - generic [ref=e252]:
          - heading "Top Selling Products | Today" [level=5] [ref=e253]
          - generic [ref=e254]:
            - generic [ref=e255]: Show
            - combobox [ref=e256]:
              - option "5" [selected]
              - option "10"
              - option "25"
            - generic [ref=e257]: entries
          - table [ref=e258]:
            - rowgroup [ref=e259]:
              - row "IMAGE Product Price Sold Revenue" [ref=e260]:
                - columnheader "IMAGE" [ref=e261]
                - columnheader "Product" [ref=e262]
                - columnheader "Price" [ref=e263]
                - columnheader "Sold" [ref=e264]
                - columnheader "Revenue" [ref=e265]
            - rowgroup [ref=e266]:
              - row "No data for this period" [ref=e267]:
                - cell "No data for this period" [ref=e268]
          - generic [ref=e270]: Showing 1–0 of 0
    - text:                                                                                                         
  - text:  
  - complementary [ref=e271]:
    - generic [ref=e272]:
      - heading "Product Approval" [level=3] [ref=e273]
      - button "Close product approval details" [ref=e274] [cursor=pointer]:
        - generic [ref=e275]: 
    - generic [ref=e277]:
      - generic [ref=e278]: 
      - paragraph [ref=e279]: Select a product to review
  - text:  
  - text:                              
  - text:      
  - img
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | test.describe('Support Center Bug Check - Admin & Superadmin', () => {
  4   |   let adminPage;
  5   |   let superAdminPage;
  6   | 
  7   |   test.beforeAll(async ({ browser }) => {
  8   |     // Get admin page
  9   |     adminPage = await browser.newPage();
  10  |     await adminPage.goto('http://localhost:3000/admin.html');
  11  |     await adminPage.evaluate(() => {
  12  |       localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzgsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoic3RhZmYiLCJpYXQiOjE3ODE4Njk5NzQsImV4cCI6MTc4MTk1NjM3NH0.JFBF7T5XvSgLHCodZh_k4lmfJ1BszzAmQMYwD7yOBGc');
  13  |     });
  14  |     await adminPage.reload();
> 15  |     await adminPage.waitForLoadState('networkidle');
      |                     ^ Error: page.waitForLoadState: Target page, context or browser has been closed
  16  | 
  17  |     // Get superadmin page
  18  |     superAdminPage = await browser.newPage();
  19  |     await superAdminPage.goto('http://localhost:3000/admin.html');
  20  |     await superAdminPage.evaluate(() => {
  21  |       localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXNlcm5hbWUiOiJzY3lfbGludGgiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3ODE4NzAzMjMsImV4cCI6MTc4MTk1NjcyM30.Z9EMUsedNemkAZe5JePkUiNGMeAu2szfVZhXQWrq2Us');
  22  |     });
  23  |     await superAdminPage.reload();
  24  |     await superAdminPage.waitForLoadState('networkidle');
  25  |   });
  26  | 
  27  |   test.afterAll(async () => {
  28  |     await adminPage?.close();
  29  |     await superAdminPage?.close();
  30  |   });
  31  | 
  32  |   test('Admin: Support Center loads without errors', async () => {
  33  |     const errors = [];
  34  |     adminPage.on('pageerror', (error) => {
  35  |       errors.push(error.message);
  36  |     });
  37  | 
  38  |     // Navigate to Support Center
  39  |     await adminPage.click('a[data-section="chat"]');
  40  |     await adminPage.waitForSelector('#chat', { state: 'visible' });
  41  |     await adminPage.waitForTimeout(2000);
  42  | 
  43  |     // Check for console errors
  44  |     if (errors.length > 0) {
  45  |       console.error('Admin console errors:', errors);
  46  |     } else {
  47  |       console.log('✓ Admin: No console errors');
  48  |     }
  49  | 
  50  |     // Verify section is visible
  51  |     const chatSection = adminPage.locator('#chat');
  52  |     await expect(chatSection).toBeVisible();
  53  |     console.log('✓ Admin: Support Center section is visible');
  54  | 
  55  |     // Verify panel-conversations is visible
  56  |     const panel = adminPage.locator('#panel-conversations');
  57  |     await expect(panel).toBeVisible();
  58  |     console.log('✓ Admin: Panel conversations is visible');
  59  | 
  60  |     // Verify admin-chat-drawer is visible
  61  |     const drawer = adminPage.locator('#admin-chat-drawer');
  62  |     await expect(drawer).toBeVisible();
  63  |     console.log('✓ Admin: Chat drawer is visible');
  64  | 
  65  |     // Verify conversation list is visible
  66  |     const convList = adminPage.locator('#conversation-list');
  67  |     await expect(convList).toBeVisible();
  68  |     console.log('✓ Admin: Conversation list is visible');
  69  | 
  70  |     // Verify status tabs are visible
  71  |     const tabs = adminPage.locator('.support-status-tabs .support-status-pill');
  72  |     await expect(tabs).toHaveCount(5);
  73  |     console.log('✓ Admin: Status tabs are visible');
  74  |   });
  75  | 
  76  |   test('Superadmin: Support Center loads without errors', async () => {
  77  |     const errors = [];
  78  |     superAdminPage.on('pageerror', (error) => {
  79  |       errors.push(error.message);
  80  |     });
  81  | 
  82  |     // Navigate to Support Center
  83  |     await superAdminPage.click('a[data-section="chat"]');
  84  |     await superAdminPage.waitForSelector('#chat', { state: 'visible' });
  85  |     await superAdminPage.waitForTimeout(2000);
  86  | 
  87  |     // Check for console errors
  88  |     if (errors.length > 0) {
  89  |       console.error('Superadmin console errors:', errors);
  90  |     } else {
  91  |       console.log('✓ Superadmin: No console errors');
  92  |     }
  93  | 
  94  |     // Verify section is visible
  95  |     const chatSection = superAdminPage.locator('#chat');
  96  |     await expect(chatSection).toBeVisible();
  97  |     console.log('✓ Superadmin: Support Center section is visible');
  98  | 
  99  |     // Verify panel-conversations is visible
  100 |     const panel = superAdminPage.locator('#panel-conversations');
  101 |     await expect(panel).toBeVisible();
  102 |     console.log('✓ Superadmin: Panel conversations is visible');
  103 | 
  104 |     // Verify admin-chat-drawer is visible
  105 |     const drawer = superAdminPage.locator('#admin-chat-drawer');
  106 |     await expect(drawer).toBeVisible();
  107 |     console.log('✓ Superadmin: Chat drawer is visible');
  108 | 
  109 |     // Verify conversation list is visible
  110 |     const convList = superAdminPage.locator('#conversation-list');
  111 |     await expect(convList).toBeVisible();
  112 |     console.log('✓ Superadmin: Conversation list is visible');
  113 | 
  114 |     // Verify status tabs are visible
  115 |     const tabs = superAdminPage.locator('.support-status-tabs .support-status-pill');
```