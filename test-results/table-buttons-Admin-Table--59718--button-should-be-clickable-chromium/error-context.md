# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-buttons.spec.js >> Admin Table Buttons >> Products table Edit button should be clickable
- Location: tests\table-buttons.spec.js:38:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#products-tbody') to be visible

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
      - heading "Listings" [level=1] [ref=e72]
      - navigation [ref=e73]:
        - list [ref=e74]:
          - listitem [ref=e75]:
            - link "Home" [ref=e76] [cursor=pointer]:
              - /url: /
          - listitem [ref=e77]: / Listings
    - text:                    
    - generic [ref=e80]:
      - heading "Listings" [level=5] [ref=e81]
      - generic [ref=e82]:
        - generic [ref=e83]:
          - generic [ref=e84]: Category
          - combobox [ref=e85]:
            - option "All categories" [selected]
        - generic [ref=e86]:
          - generic [ref=e87]: Status
          - combobox [ref=e88]:
            - option "Any status"
            - option "Active"
            - option "Disabled"
        - generic [ref=e89]:
          - generic [ref=e90]: Search
          - generic [ref=e91]:
            - generic [ref=e92]:
              - textbox "Product name…" [ref=e93]
              - button " Search" [ref=e94] [cursor=pointer]:
                - generic [ref=e95]: 
                - text: Search
            - button "" [ref=e96] [cursor=pointer]:
              - generic [ref=e97]: 
      - generic [ref=e98]:
        - generic [ref=e99]: Show
        - combobox [ref=e100]:
          - option "10"
          - option "25"
          - option "50" [selected]
          - option "100"
        - generic [ref=e101]: entries
      - table [ref=e105]:
        - rowgroup [ref=e106]:
          - row "IMG ID PRODUCT CATEGORY PRICE STOCK FARMER STATUS DATE ADDED ACTIONS" [ref=e107]:
            - columnheader "IMG" [ref=e108]
            - columnheader "ID" [ref=e109]:
              - button "ID" [ref=e110] [cursor=pointer]
            - columnheader "PRODUCT" [ref=e111]:
              - button "PRODUCT" [ref=e112] [cursor=pointer]
            - columnheader "CATEGORY" [ref=e113]:
              - button "CATEGORY" [ref=e114] [cursor=pointer]
            - columnheader "PRICE" [ref=e115]:
              - button "PRICE" [ref=e116] [cursor=pointer]
            - columnheader "STOCK" [ref=e117]:
              - button "STOCK" [ref=e118] [cursor=pointer]
            - columnheader "FARMER" [ref=e119]:
              - button "FARMER" [ref=e120] [cursor=pointer]
            - columnheader "STATUS" [ref=e121]:
              - button "STATUS" [ref=e122] [cursor=pointer]
            - columnheader "DATE ADDED" [ref=e123]:
              - button "DATE ADDED" [ref=e124] [cursor=pointer]
            - columnheader "ACTIONS" [ref=e125]
        - rowgroup [ref=e126]:
          - row "19 Pakwan Fruits ₱121.00 15 Ma. Theressa P. Elaurza (Theressa) dhelhilis@gmail.com Available 5/2/2026 Edit" [ref=e127]:
            - cell [ref=e128]: 
            - cell "19" [ref=e129]
            - cell "Pakwan" [ref=e130]
            - cell "Fruits" [ref=e131]
            - cell "₱121.00" [ref=e132]
            - cell "15" [ref=e133]
            - cell "Ma. Theressa P. Elaurza (Theressa) dhelhilis@gmail.com" [ref=e134]:
              - generic [ref=e135]: Ma. Theressa P. Elaurza (Theressa)
              - generic [ref=e136]: dhelhilis@gmail.com
            - cell "Available" [ref=e137]
            - cell "5/2/2026" [ref=e138]
            - cell "Edit" [ref=e139]:
              - button "Edit" [ref=e140] [cursor=pointer]
          - row "18 Kangkong Vegetables ₱33.00 99 Ma. Theressa P. Elaurza (Theressa) dhelhilis@gmail.com Available 5/2/2026 Edit" [ref=e141]:
            - cell [ref=e142]: 
            - cell "18" [ref=e143]
            - cell "Kangkong" [ref=e144]
            - cell "Vegetables" [ref=e145]
            - cell "₱33.00" [ref=e146]
            - cell "99" [ref=e147]
            - cell "Ma. Theressa P. Elaurza (Theressa) dhelhilis@gmail.com" [ref=e148]:
              - generic [ref=e149]: Ma. Theressa P. Elaurza (Theressa)
              - generic [ref=e150]: dhelhilis@gmail.com
            - cell "Available" [ref=e151]
            - cell "5/2/2026" [ref=e152]
            - cell "Edit" [ref=e153]:
              - button "Edit" [ref=e154] [cursor=pointer]
          - row "17 Baboy - Atay Meat & Poultry ₱545.00 34,342 asdasd (titefarm) tite@tite.com Available 3/23/2026 Edit" [ref=e155]:
            - cell [ref=e156]: 
            - cell "17" [ref=e157]
            - cell "Baboy - Atay" [ref=e158]
            - cell "Meat & Poultry" [ref=e159]
            - cell "₱545.00" [ref=e160]
            - cell "34,342" [ref=e161]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e162]:
              - generic [ref=e163]: asdasd (titefarm)
              - generic [ref=e164]: tite@tite.com
            - cell "Available" [ref=e165]
            - cell "3/23/2026" [ref=e166]
            - cell "Edit" [ref=e167]:
              - button "Edit" [ref=e168] [cursor=pointer]
          - row "16 Baboy - Atay Meat & Poultry ₱120.00 55 asdasd (titefarm) tite@tite.com Available 3/23/2026 Edit" [ref=e169]:
            - cell [ref=e170]: 
            - cell "16" [ref=e171]
            - cell "Baboy - Atay" [ref=e172]
            - cell "Meat & Poultry" [ref=e173]
            - cell "₱120.00" [ref=e174]
            - cell "55" [ref=e175]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e176]:
              - generic [ref=e177]: asdasd (titefarm)
              - generic [ref=e178]: tite@tite.com
            - cell "Available" [ref=e179]
            - cell "3/23/2026" [ref=e180]
            - cell "Edit" [ref=e181]:
              - button "Edit" [ref=e182] [cursor=pointer]
          - row "15 Chico Fruits ₱12.00 444 asdasd (titefarm) tite@tite.com Available 3/23/2026 Edit" [ref=e183]:
            - cell [ref=e184]: 
            - cell "15" [ref=e185]
            - cell "Chico" [ref=e186]
            - cell "Fruits" [ref=e187]
            - cell "₱12.00" [ref=e188]
            - cell "444" [ref=e189]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e190]:
              - generic [ref=e191]: asdasd (titefarm)
              - generic [ref=e192]: tite@tite.com
            - cell "Available" [ref=e193]
            - cell "3/23/2026" [ref=e194]
            - cell "Edit" [ref=e195]:
              - button "Edit" [ref=e196] [cursor=pointer]
          - row "12 Brown rice Rice, Grains & Staples ₱55.00 66 Ma. Theressa P. Elaurza (Theressa) dhelhilis@gmail.com Available 3/23/2026 Edit" [ref=e197]:
            - cell [ref=e198]: 
            - cell "12" [ref=e199]
            - cell "Brown rice" [ref=e200]
            - cell "Rice, Grains & Staples" [ref=e201]
            - cell "₱55.00" [ref=e202]
            - cell "66" [ref=e203]
            - cell "Ma. Theressa P. Elaurza (Theressa) dhelhilis@gmail.com" [ref=e204]:
              - generic [ref=e205]: Ma. Theressa P. Elaurza (Theressa)
              - generic [ref=e206]: dhelhilis@gmail.com
            - cell "Available" [ref=e207]
            - cell "3/23/2026" [ref=e208]
            - cell "Edit" [ref=e209]:
              - button "Edit" [ref=e210] [cursor=pointer]
          - row "11 Kangkong Vegetables ₱8.00 432 asdasd (titefarm) tite@tite.com Available 3/23/2026 Edit" [ref=e211]:
            - cell [ref=e212]: 
            - cell "11" [ref=e213]
            - cell "Kangkong" [ref=e214]
            - cell "Vegetables" [ref=e215]
            - cell "₱8.00" [ref=e216]
            - cell "432" [ref=e217]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e218]:
              - generic [ref=e219]: asdasd (titefarm)
              - generic [ref=e220]: tite@tite.com
            - cell "Available" [ref=e221]
            - cell "3/23/2026" [ref=e222]
            - cell "Edit" [ref=e223]:
              - button "Edit" [ref=e224] [cursor=pointer]
          - row "10 Bawang Vegetables ₱6.00 2,525 asdasd (titefarm) tite@tite.com Available 3/22/2026 Edit" [ref=e225]:
            - cell [ref=e226]: 
            - cell "10" [ref=e227]
            - cell "Bawang" [ref=e228]
            - cell "Vegetables" [ref=e229]
            - cell "₱6.00" [ref=e230]
            - cell "2,525" [ref=e231]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e232]:
              - generic [ref=e233]: asdasd (titefarm)
              - generic [ref=e234]: tite@tite.com
            - cell "Available" [ref=e235]
            - cell "3/22/2026" [ref=e236]
            - cell "Edit" [ref=e237]:
              - button "Edit" [ref=e238] [cursor=pointer]
          - row "9 Bawang Vegetables ₱10.00 56,565 asdasd (titefarm) tite@tite.com Available 3/22/2026 Edit" [ref=e239]:
            - cell [ref=e240]: 
            - cell "9" [ref=e241]
            - cell "Bawang" [ref=e242]
            - cell "Vegetables" [ref=e243]
            - cell "₱10.00" [ref=e244]
            - cell "56,565" [ref=e245]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e246]:
              - generic [ref=e247]: asdasd (titefarm)
              - generic [ref=e248]: tite@tite.com
            - cell "Available" [ref=e249]
            - cell "3/22/2026" [ref=e250]
            - cell "Edit" [ref=e251]:
              - button "Edit" [ref=e252] [cursor=pointer]
          - row "8 Ampalaya Vegetables ₱7.00 3,432 asdasd (titefarm) tite@tite.com Available 3/22/2026 Edit" [ref=e253]:
            - cell [ref=e254]: 
            - cell "8" [ref=e255]
            - cell "Ampalaya" [ref=e256]
            - cell "Vegetables" [ref=e257]
            - cell "₱7.00" [ref=e258]
            - cell "3,432" [ref=e259]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e260]:
              - generic [ref=e261]: asdasd (titefarm)
              - generic [ref=e262]: tite@tite.com
            - cell "Available" [ref=e263]
            - cell "3/22/2026" [ref=e264]
            - cell "Edit" [ref=e265]:
              - button "Edit" [ref=e266] [cursor=pointer]
          - row "7 Calamansi Fruits ₱12.00 536 asdasd (titefarm) tite@tite.com Available 3/20/2026 Edit" [ref=e267]:
            - cell [ref=e268]: 
            - cell "7" [ref=e269]
            - cell "Calamansi" [ref=e270]
            - cell "Fruits" [ref=e271]
            - cell "₱12.00" [ref=e272]
            - cell "536" [ref=e273]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e274]:
              - generic [ref=e275]: asdasd (titefarm)
              - generic [ref=e276]: tite@tite.com
            - cell "Available" [ref=e277]
            - cell "3/20/2026" [ref=e278]
            - cell "Edit" [ref=e279]:
              - button "Edit" [ref=e280] [cursor=pointer]
          - row "1 Ampalaya Vegetables ₱9.00 557 asdasd (titefarm) tite@tite.com Available 3/20/2026 Edit" [ref=e281]:
            - cell [ref=e282]: 
            - cell "1" [ref=e283]
            - cell "Ampalaya" [ref=e284]
            - cell "Vegetables" [ref=e285]
            - cell "₱9.00" [ref=e286]
            - cell "557" [ref=e287]
            - cell "asdasd (titefarm) tite@tite.com" [ref=e288]:
              - generic [ref=e289]: asdasd (titefarm)
              - generic [ref=e290]: tite@tite.com
            - cell "Available" [ref=e291]
            - cell "3/20/2026" [ref=e292]
            - cell "Edit" [ref=e293]:
              - button "Edit" [ref=e294] [cursor=pointer]
      - generic [ref=e296]: Showing 1–12 of 12
    - text:                   
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
> 51  |     await page.waitForSelector('#products-tbody', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
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
  80  |     await page.waitForSelector('#orders-tbody', { timeout: 10000 });
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
```