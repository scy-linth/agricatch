# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-buttons.spec.js >> Admin Table Buttons >> Categories table Edit button should be clickable
- Location: tests\table-buttons.spec.js:96:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#categories-tbody .category-edit-btn').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('#categories-tbody .category-edit-btn').first()

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
      - link " Catalog " [expanded]:
        - /url: "#"
      - list:
        - listitem:
          - link " Products Catalog":
            - /url: "#catalog-products"
        - listitem:
          - link " Category Management":
            - /url: "#categories"
        - listitem:
          - link " Product Name Requests":
            - /url: "#category-requests"
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
  - heading "Category Management" [level=1]
  - navigation:
    - list:
      - listitem:
        - link "Home":
          - /url: /
      - listitem: / Category
  - heading "Categories  Add Category" [level=5]:
    - text: Categories
    - button " Add Category"
  - text: Status
  - combobox:
    - option "All" [selected]
    - option "Active"
    - option "Disabled"
  - text: Search
  - textbox "Category name…"
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
      - row "ID NAME DESCRIPTION STATUS ACTIONS":
        - columnheader "ID":
          - button "ID"
        - columnheader "NAME":
          - button "NAME"
        - columnheader "DESCRIPTION":
          - button "DESCRIPTION"
        - columnheader "STATUS":
          - button "STATUS"
        - columnheader "ACTIONS"
    - rowgroup:
      - row "1190 Agricultural Products Fresh vegetables, fruits, grains, and other farm products Active Edit":
        - cell "1190"
        - cell "Agricultural Products"
        - cell "Fresh vegetables, fruits, grains, and other farm products"
        - cell "Active"
        - cell "Edit":
          - button "Edit"
      - row "3 Fruits Fruits category Active Edit":
        - cell "3"
        - cell "Fruits"
        - cell "Fruits category"
        - cell "Active"
        - cell "Edit":
          - button "Edit"
      - row "4 Meat & Poultry Meat & Poultry category Active Edit":
        - cell "4"
        - cell "Meat & Poultry"
        - cell "Meat & Poultry category"
        - cell "Active"
        - cell "Edit":
          - button "Edit"
      - row "5 Rice, Grains & Staples Rice, Grains & Staples category Active Edit":
        - cell "5"
        - cell "Rice, Grains & Staples"
        - cell "Rice, Grains & Staples category"
        - cell "Active"
        - cell "Edit":
          - button "Edit"
      - row "2 Vegetables Vegetables category Active Edit":
        - cell "2"
        - cell "Vegetables"
        - cell "Vegetables category"
        - cell "Active"
        - cell "Edit":
          - button "Edit"
  - text: Showing 1–5 of 5
- img
```

# Test source

```ts
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
> 113 |     await expect(editButton).toBeVisible();
      |                              ^ Error: expect(locator).toBeVisible() failed
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