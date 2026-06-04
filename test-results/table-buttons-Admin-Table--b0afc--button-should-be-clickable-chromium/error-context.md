# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-buttons.spec.js >> Admin Table Buttons >> Users table View button should be clickable
- Location: tests\table-buttons.spec.js:5:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#users-tbody .customer-view-btn').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('#users-tbody .customer-view-btn').first()

```

```yaml
- banner:
  - button "Toggle sidebar": 
  - link "AgriCatch AgriCatch":
    - /url: /
    - img "AgriCatch"
    - text: AgriCatch
  - navigation:
    - list:
      - listitem:
        - link "":
          - /url: "#"
      - listitem:
        - link "":
          - /url: "#"
      - listitem
      - listitem:
        - link "Profile staff":
          - /url: "#"
          - img "Profile"
          - text: staff
- complementary:
  - list:
    - listitem: Overview
    - listitem:
      - link " Dashboard":
        - /url: "#overview"
    - listitem: Commerce
    - listitem:
      - link " Orders":
        - /url: "#orders"
    - listitem:
      - link " Listings":
        - /url: "#products"
    - listitem: Catalog
    - listitem:
      - link " Catalog ":
        - /url: "#"
    - listitem: Users
    - listitem:
      - link " Customers":
        - /url: "#users"
    - listitem:
      - link " Farmers":
        - /url: "#farmers"
    - listitem: System
    - listitem:
      - link " Audit Logs":
        - /url: "#logs"
    - listitem:
      - link " Notifications":
        - /url: "#notifications"
    - listitem:
      - link " Chat & Support":
        - /url: "#chat"
    - listitem:
      - link " My Profile":
        - /url: "#profile"
- main:
  - heading "Customer Management" [level=1]
  - navigation:
    - list:
      - listitem:
        - link "Home":
          - /url: /
      - listitem: / Customers
  - heading "Customers  Create User" [level=5]:
    - text: Customers
    - button " Create User"
  - text: Status
  - combobox:
    - option "Any status" [selected]
    - option "Active"
    - option "Suspended"
    - option "Banned"
  - text: Search
  - textbox "Name, username or email…"
  - button " Search"
  - button ""
  - text: Show
  - combobox:
    - option "10"
    - option "25"
    - option "50" [selected]
    - option "100"
  - text: entries
  - table:
    - rowgroup:
      - row "ID FULL NAME USERNAME EMAIL RATING STATUS JOINED ACTIONS":
        - columnheader "ID":
          - button "ID"
        - columnheader "FULL NAME":
          - button "FULL NAME"
        - columnheader "USERNAME":
          - button "USERNAME"
        - columnheader "EMAIL":
          - button "EMAIL"
        - columnheader "RATING":
          - button "RATING"
        - columnheader "STATUS":
          - button "STATUS"
        - columnheader "JOINED":
          - button "JOINED"
        - columnheader "ACTIONS"
    - rowgroup:
      - row "26 asd ff a wqeqweq gfgdfgd@asd.d — Active 5/22/2026 View":
        - cell "26"
        - cell "asd ff a"
        - cell "wqeqweq"
        - cell "gfgdfgd@asd.d"
        - cell "—"
        - cell "Active"
        - cell "5/22/2026"
        - cell "View":
          - button "View"
      - row "25 ddaa a ss adasd adasdasd@asda.cas — Disabled 5/22/2026 View":
        - cell "25"
        - cell "ddaa a ss"
        - cell "adasd"
        - cell "adasdasd@asda.cas"
        - cell "—"
        - cell "Disabled"
        - cell "5/22/2026"
        - cell "View":
          - button "View"
      - row "24 Daniella Pleta ellyaish ella.pleta21@gmail.com — Active 5/20/2026 View":
        - cell "24"
        - cell "Daniella Pleta"
        - cell "ellyaish"
        - cell "ella.pleta21@gmail.com"
        - cell "—"
        - cell "Active"
        - cell "5/20/2026"
        - cell "View":
          - button "View"
      - row "23 biankik telan biankik biancatelan3145@gmail.com — Active 5/5/2026 View":
        - cell "23"
        - cell "biankik telan"
        - cell "biankik"
        - cell "biancatelan3145@gmail.com"
        - cell "—"
        - cell "Active"
        - cell "5/5/2026"
        - cell "View":
          - button "View"
      - row "21 QAtester QAtester ferrancojade99@gmail.com — Active 3/29/2026 View":
        - cell "21"
        - cell "QAtester"
        - cell "QAtester"
        - cell "ferrancojade99@gmail.com"
        - cell "—"
        - cell "Active"
        - cell "3/29/2026"
        - cell "View":
          - button "View"
      - row "19 natoy trial ianamata666@gmail.com — Active 3/20/2026 View":
        - cell "19"
        - cell "natoy"
        - cell "trial"
        - cell "ianamata666@gmail.com"
        - cell "—"
        - cell "Active"
        - cell "3/20/2026"
        - cell "View":
          - button "View"
  - text: Showing 1–6 of 6
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
> 24  |     await expect(viewButton).toBeVisible();
      |                              ^ Error: expect(locator).toBeVisible() failed
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
```