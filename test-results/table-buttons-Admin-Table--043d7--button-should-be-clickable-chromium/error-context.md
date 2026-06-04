# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-buttons.spec.js >> Admin Table Buttons >> Orders table View button should be clickable
- Location: tests\table-buttons.spec.js:67:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#orders-tbody') to be visible

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
        - listitem [ref=e11]:
          - link "" [ref=e12] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e13]: 
        - listitem [ref=e14]:
          - link "" [ref=e15] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e16]: 
        - listitem: 
        - listitem [ref=e17]:
          - link "Profile staff" [ref=e18] [cursor=pointer]:
            - /url: "#"
            - img "Profile" [ref=e20]
            - generic [ref=e21]: staff
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
        - link " Catalog " [ref=e40] [cursor=pointer]:
          - /url: "#"
          - generic [ref=e41]: 
          - generic [ref=e42]: Catalog
          - generic [ref=e43]: 
        - text:   
      - listitem [ref=e44]: Users
      - listitem [ref=e45]:
        - link " Customers" [ref=e46] [cursor=pointer]:
          - /url: "#users"
          - generic [ref=e47]: 
          - generic [ref=e48]: Customers
      - listitem [ref=e49]:
        - link " Farmers" [ref=e50] [cursor=pointer]:
          - /url: "#farmers"
          - generic [ref=e51]: 
          - generic [ref=e52]: Farmers
      - listitem [ref=e53]: System
      - listitem [ref=e54]:
        - link " Audit Logs" [ref=e55] [cursor=pointer]:
          - /url: "#logs"
          - generic [ref=e56]: 
          - generic [ref=e57]: Audit Logs
      - listitem [ref=e58]:
        - link " Notifications" [ref=e59] [cursor=pointer]:
          - /url: "#notifications"
          - generic [ref=e60]: 
          - generic [ref=e61]: Notifications
      - listitem [ref=e62]:
        - link " Chat & Support" [ref=e63] [cursor=pointer]:
          - /url: "#chat"
          - generic [ref=e64]: 
          - generic [ref=e65]: Chat & Support
      - listitem [ref=e66]:
        - link " My Profile" [ref=e67] [cursor=pointer]:
          - /url: "#profile"
          - generic [ref=e68]: 
          - generic [ref=e69]: My Profile
  - main [ref=e70]:
    - generic [ref=e71]:
      - heading "Order Management" [level=1] [ref=e72]
      - navigation [ref=e73]:
        - list [ref=e74]:
          - listitem [ref=e75]:
            - link "Home" [ref=e76] [cursor=pointer]:
              - /url: /
          - listitem [ref=e77]: / Orders
    - text:               
    - generic [ref=e80]:
      - heading "Orders" [level=5] [ref=e81]:
        - generic [ref=e82]: Orders
      - generic [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e85]: Status
          - combobox [ref=e86]:
            - option "Any status" [selected]
            - option "Pending"
            - option "Confirmed"
            - option "Preparing"
            - option "Out for Delivery"
            - option "Delivered"
            - option "Cancelled"
        - generic [ref=e87]:
          - generic [ref=e88]: Price Range
          - combobox [ref=e89]:
            - option "Any price" [selected]
            - option "₱0 – ₱500"
            - option "₱500 – ₱1,500"
            - option "₱1,500 – ₱3,000"
            - option "₱3,000+"
        - generic [ref=e90]:
          - generic [ref=e91]: Sort
          - combobox [ref=e92]:
            - option "Newest first" [selected]
            - option "Oldest first"
            - option "Highest total"
            - option "Lowest total"
        - generic [ref=e93]:
          - generic [ref=e94]: Search
          - generic [ref=e95]:
            - generic [ref=e96]:
              - textbox "Order ID, customer name or email…" [ref=e97]
              - button " Search" [ref=e98] [cursor=pointer]:
                - generic [ref=e99]: 
                - text: Search
            - button "" [ref=e100] [cursor=pointer]:
              - generic [ref=e101]: 
      - generic [ref=e102]:
        - generic [ref=e103]: Show
        - combobox [ref=e104]:
          - option "10"
          - option "25"
          - option "50" [selected]
          - option "100"
        - generic [ref=e105]: entries
      - table [ref=e109]:
        - rowgroup [ref=e110]:
          - row "ORDER CUSTOMER STATUS TOTAL DATE ACTIONS" [ref=e111]:
            - columnheader "ORDER" [ref=e112]:
              - button "ORDER" [ref=e113] [cursor=pointer]
            - columnheader "CUSTOMER" [ref=e114]:
              - button "CUSTOMER" [ref=e115] [cursor=pointer]
            - columnheader "STATUS" [ref=e116]:
              - button "STATUS" [ref=e117] [cursor=pointer]
            - columnheader "TOTAL" [ref=e118]:
              - button "TOTAL" [ref=e119] [cursor=pointer]
            - columnheader "DATE" [ref=e120]:
              - button "DATE" [ref=e121] [cursor=pointer]
            - columnheader "ACTIONS" [ref=e122]
        - rowgroup [ref=e123]:
          - row "#10 natoy (trial) ianamata666@gmail.com Pending ₱9.00 5/5/2026 View" [ref=e124]:
            - cell "#10" [ref=e125]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e126]:
              - generic [ref=e127]: natoy (trial)
              - generic [ref=e128]: ianamata666@gmail.com
            - cell "Pending" [ref=e129]
            - cell "₱9.00" [ref=e130]
            - cell "5/5/2026" [ref=e131]
            - cell "View" [ref=e132]:
              - button "View" [ref=e133] [cursor=pointer]
          - row "#9 natoy (trial) ianamata666@gmail.com Delivered ₱1,200.00 5/2/2026 View" [ref=e134]:
            - cell "#9" [ref=e135]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e136]:
              - generic [ref=e137]: natoy (trial)
              - generic [ref=e138]: ianamata666@gmail.com
            - cell "Delivered" [ref=e139]
            - cell "₱1,200.00" [ref=e140]
            - cell "5/2/2026" [ref=e141]
            - cell "View" [ref=e142]:
              - button "View" [ref=e143] [cursor=pointer]
          - row "#8 natoy (trial) ianamata666@gmail.com Pending ₱110.00 3/23/2026 View" [ref=e144]:
            - cell "#8" [ref=e145]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e146]:
              - generic [ref=e147]: natoy (trial)
              - generic [ref=e148]: ianamata666@gmail.com
            - cell "Pending" [ref=e149]
            - cell "₱110.00" [ref=e150]
            - cell "3/23/2026" [ref=e151]
            - cell "View" [ref=e152]:
              - button "View" [ref=e153] [cursor=pointer]
          - row "#6 natoy (trial) ianamata666@gmail.com Confirmed ₱220.00 3/20/2026 View" [ref=e154]:
            - cell "#6" [ref=e155]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e156]:
              - generic [ref=e157]: natoy (trial)
              - generic [ref=e158]: ianamata666@gmail.com
            - cell "Confirmed" [ref=e159]
            - cell "₱220.00" [ref=e160]
            - cell "3/20/2026" [ref=e161]
            - cell "View" [ref=e162]:
              - button "View" [ref=e163] [cursor=pointer]
          - row "#7 natoy (trial) ianamata666@gmail.com Delivered ₱110.00 3/20/2026 View" [ref=e164]:
            - cell "#7" [ref=e165]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e166]:
              - generic [ref=e167]: natoy (trial)
              - generic [ref=e168]: ianamata666@gmail.com
            - cell "Delivered" [ref=e169]
            - cell "₱110.00" [ref=e170]
            - cell "3/20/2026" [ref=e171]
            - cell "View" [ref=e172]:
              - button "View" [ref=e173] [cursor=pointer]
          - row "#5 natoy (trial) ianamata666@gmail.com Preparing ₱55.00 3/20/2026 View" [ref=e174]:
            - cell "#5" [ref=e175]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e176]:
              - generic [ref=e177]: natoy (trial)
              - generic [ref=e178]: ianamata666@gmail.com
            - cell "Preparing" [ref=e179]
            - cell "₱55.00" [ref=e180]
            - cell "3/20/2026" [ref=e181]
            - cell "View" [ref=e182]:
              - button "View" [ref=e183] [cursor=pointer]
          - row "#4 natoy (trial) ianamata666@gmail.com Cancelled ₱55.00 3/20/2026 View" [ref=e184]:
            - cell "#4" [ref=e185]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e186]:
              - generic [ref=e187]: natoy (trial)
              - generic [ref=e188]: ianamata666@gmail.com
            - cell "Cancelled" [ref=e189]
            - cell "₱55.00" [ref=e190]
            - cell "3/20/2026" [ref=e191]
            - cell "View" [ref=e192]:
              - button "View" [ref=e193] [cursor=pointer]
          - row "#3 natoy (trial) ianamata666@gmail.com Delivered ₱110.00 3/20/2026 View" [ref=e194]:
            - cell "#3" [ref=e195]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e196]:
              - generic [ref=e197]: natoy (trial)
              - generic [ref=e198]: ianamata666@gmail.com
            - cell "Delivered" [ref=e199]
            - cell "₱110.00" [ref=e200]
            - cell "3/20/2026" [ref=e201]
            - cell "View" [ref=e202]:
              - button "View" [ref=e203] [cursor=pointer]
          - row "#1 natoy (trial) ianamata666@gmail.com Delivered ₱110.00 3/20/2026 View" [ref=e204]:
            - cell "#1" [ref=e205]
            - cell "natoy (trial) ianamata666@gmail.com" [ref=e206]:
              - generic [ref=e207]: natoy (trial)
              - generic [ref=e208]: ianamata666@gmail.com
            - cell "Delivered" [ref=e209]
            - cell "₱110.00" [ref=e210]
            - cell "3/20/2026" [ref=e211]
            - cell "View" [ref=e212]:
              - button "View" [ref=e213] [cursor=pointer]
      - generic [ref=e215]: Showing 1–9 of 9
    - text:                                    
  - text:    
  - text:           
  - img
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const { getAdminToken } = require('./auth-helper');
  3   | 
  4   | test.describe('Admin Table Buttons', () => {
  5   |   test('Users table View button should be clickable', async ({ page }) => {
  6   |     const { token } = await getAdminToken();
  7   |     await page.goto('/admin.html');
  8   |     await page.evaluate((authToken) => {
  9   |       localStorage.setItem('token', authToken);
  10  |     }, token);
  11  |     await page.reload();
  12  |     await page.waitForTimeout(3000);
  13  |     
  14  |     // Navigate to users section
  15  |     await page.evaluate(() => {
  16  |       const link = document.querySelector('[data-section="users"]');
  17  |       if (link) link.click();
  18  |     });
  19  |     await page.waitForSelector('#users-tbody', { timeout: 10000 });
  20  |     await page.waitForTimeout(1000);
  21  |     
  22  |     // Check if View button exists and is clickable
  23  |     const viewButton = page.locator('#users-tbody .customer-view-btn').first();
  24  |     await expect(viewButton).toBeVisible();
  25  |     await expect(viewButton).toBeEnabled();
  26  |     
  27  |     // Click the button and verify modal opens
  28  |     await viewButton.click();
  29  |     await expect(page.locator('#customer-detail-modal')).toHaveClass(/open/);
  30  |     
  31  |     // Close modal
  32  |     await page.evaluate(() => {
  33  |       const modal = document.querySelector('#customer-detail-modal');
  34  |       if (modal) modal.classList.remove('open');
  35  |     });
  36  |   });
  37  | 
  38  |   test('Products table Edit button should be clickable', async ({ page }) => {
  39  |     const { token } = await getAdminToken();
  40  |     await page.goto('/admin.html');
  41  |     await page.evaluate((authToken) => {
  42  |       localStorage.setItem('token', authToken);
  43  |     }, token);
  44  |     await page.reload();
  45  |     await page.waitForTimeout(3000);
  46  |     
  47  |     await page.evaluate(() => {
  48  |       const link = document.querySelector('[data-section="products"]');
  49  |       if (link) link.click();
  50  |     });
  51  |     await page.waitForSelector('#products-tbody', { timeout: 10000 });
  52  |     await page.waitForTimeout(1000);
  53  |     
  54  |     const editButton = page.locator('#products-tbody .product-edit-btn').first();
  55  |     await expect(editButton).toBeVisible();
  56  |     await expect(editButton).toBeEnabled();
  57  |     
  58  |     await editButton.click();
  59  |     await expect(page.locator('#product-edit-modal')).toHaveClass(/open/);
  60  |     
  61  |     await page.evaluate(() => {
  62  |       const modal = document.querySelector('#product-edit-modal');
  63  |       if (modal) modal.classList.remove('open');
  64  |     });
  65  |   });
  66  | 
  67  |   test('Orders table View button should be clickable', async ({ page }) => {
  68  |     const { token } = await getAdminToken();
  69  |     await page.goto('/admin.html');
  70  |     await page.evaluate((authToken) => {
  71  |       localStorage.setItem('token', authToken);
  72  |     }, token);
  73  |     await page.reload();
  74  |     await page.waitForTimeout(3000);
  75  |     
  76  |     await page.evaluate(() => {
  77  |       const link = document.querySelector('[data-section="orders"]');
  78  |       if (link) link.click();
  79  |     });
> 80  |     await page.waitForSelector('#orders-tbody', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  81  |     await page.waitForTimeout(1000);
  82  |     
  83  |     const viewButton = page.locator('#orders-tbody .order-view-btn').first();
  84  |     await expect(viewButton).toBeVisible();
  85  |     await expect(viewButton).toBeEnabled();
  86  |     
  87  |     await viewButton.click();
  88  |     await expect(page.locator('#order-detail-panel')).toHaveClass(/active/);
  89  |     
  90  |     await page.evaluate(() => {
  91  |       const panel = document.querySelector('#order-detail-panel');
  92  |       if (panel) panel.classList.remove('active');
  93  |     });
  94  |   });
  95  | 
  96  |   test('Categories table Edit button should be clickable', async ({ page }) => {
  97  |     const { token } = await getAdminToken();
  98  |     await page.goto('/admin.html');
  99  |     await page.evaluate((authToken) => {
  100 |       localStorage.setItem('token', authToken);
  101 |     }, token);
  102 |     await page.reload();
  103 |     await page.waitForTimeout(3000);
  104 |     
  105 |     await page.evaluate(() => {
  106 |       const link = document.querySelector('[data-section="categories"]');
  107 |       if (link) link.click();
  108 |     });
  109 |     await page.waitForSelector('#categories-tbody', { timeout: 10000 });
  110 |     await page.waitForTimeout(1000);
  111 |     
  112 |     const editButton = page.locator('#categories-tbody .category-edit-btn').first();
  113 |     await expect(editButton).toBeVisible();
  114 |     await expect(editButton).toBeEnabled();
  115 |     
  116 |     await editButton.click();
  117 |     await expect(page.locator('#category-edit-modal')).toHaveClass(/open/);
  118 |     
  119 |     await page.evaluate(() => {
  120 |       const modal = document.querySelector('#category-edit-modal');
  121 |       if (modal) modal.classList.remove('open');
  122 |     });
  123 |   });
  124 | 
  125 |   test('Catalog table Edit button should be clickable', async ({ page }) => {
  126 |     const { token } = await getAdminToken();
  127 |     await page.goto('/admin.html');
  128 |     await page.evaluate((authToken) => {
  129 |       localStorage.setItem('token', authToken);
  130 |     }, token);
  131 |     await page.reload();
  132 |     await page.waitForTimeout(3000);
  133 |     
  134 |     await page.evaluate(() => {
  135 |       const link = document.querySelector('[data-section="catalog-products"]');
  136 |       if (link) link.click();
  137 |     });
  138 |     await page.waitForSelector('#catalog-products-tbody', { timeout: 10000 });
  139 |     await page.waitForTimeout(1000);
  140 |     
  141 |     const editButton = page.locator('#catalog-products-tbody .catalog-edit-btn').first();
  142 |     await expect(editButton).toBeVisible();
  143 |     await expect(editButton).toBeEnabled();
  144 |     
  145 |     await editButton.click();
  146 |     await expect(page.locator('#catalog-edit-modal')).toHaveClass(/open/);
  147 |     
  148 |     await page.evaluate(() => {
  149 |       const modal = document.querySelector('#catalog-edit-modal');
  150 |       if (modal) modal.classList.remove('open');
  151 |     });
  152 |   });
  153 | });
  154 | 
```