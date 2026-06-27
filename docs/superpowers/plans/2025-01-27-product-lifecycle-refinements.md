# Product Lifecycle Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automatic value reuse for product creation and verify harvest workflow, historical data preservation, and terminology consistency — all while maintaining zero regression.

**Architecture:**
- Frontend: When a farmer selects a product name and selling type in the Add Product modal, automatically fetch and pre-fill the latest editable values from a previous product of the same name and same selling type. No confirmation dialog. Product Name, Category, and Unit remain immutable.
- Backend: Add a single GET endpoint `/api/products/previous-values` that returns the latest editable field values for a given product name + selling type + farmer (from JWT). The existing harvest-lifecycle endpoint and product creation endpoint remain as-is.
- Database: No schema changes required.
- Shared Reputation: **DEFERRED** — Reviews, Wishlist, Views, Sales aggregation, and Reports remain unchanged. Will be considered after the thesis if needed.

**Tech Stack:** Node.js/Express backend, PostgreSQL, Vanilla JavaScript frontend

## Finalized Architecture Decisions

1. **Automatic Value Reuse** — When a farmer creates a new product from the same Product Catalog item and same Selling Type (Available or Pre-order), the system automatically loads the latest editable values (description, image, price, location, harvest settings for pre-order, expiry for available) from the most recent product of that same name + selling type. No confirmation dialog is shown. The farmer can still edit these fields before submitting.

2. **Immutable Fields** — Product Name, Category, and Unit are always locked (read-only) in the Add Product form. These are determined by the Product Catalog selection and cannot be overridden.

3. **Historical Data Preservation** — Orders, Deliveries, Notifications, Harvest History, and Reservation History remain attached to their original product records. No data is moved or duplicated when new products are created or when harvest lifecycle transitions occur.

4. **Available and Pre-order Independence** — Available and Pre-order products are separate product records with independent Description, Images, Price, Address, Inventory, and Ratings. They are linked via `linked_product_id` but remain fully independent except for the auto-reuse of editable values on creation.

5. **Harvest YES/NO Workflow** — The existing harvest lifecycle endpoint (`POST /:id/harvest-lifecycle`) remains exactly as implemented:
   - **YES path** (`make_available = true`): Creates or transfers stock to an Available product, marks the Pre-order as `harvested`, sets `is_available = false`. The new Available product reuses values from the Pre-order product (name, description, price, category, unit, image, location, city, province, cloudinary_public_id).
   - **NO path** (`make_available = false`): Marks the Pre-order as `harvested`, sets `is_available = false`, zeroes out stock and reserved quantity.

6. **Available / Unavailable Terminology** — Product availability uses "Available" and "Unavailable" consistently. Unavailable products are hidden from the marketplace but existing orders continue. Confirmation dialogs are shown when toggling availability.

7. **linked_product_id** — Used to link Available and Pre-order products of the same name and farmer. Already implemented in the product creation endpoint and harvest lifecycle endpoint.

8. **No Redesign** — Existing working modules are not redesigned. Only additive changes (new endpoint, new frontend function, event listener additions).

9. **Product Approval Rules** — Product approval applies ONLY to image moderation:
   - **New Available/Pre-order Products**: If Product Approval is OFF, immediate availability (button = "Submit"). If ON, requires approval because new image is uploaded (button = "Submit for Approval").
   - **Edit Product**: If Product Approval is OFF, always immediate (button = "Submit"). If ON, requires approval ONLY if image was changed/replaced (button = "Submit for Approval"). If image NOT changed, immediate update (button = "Submit").
   - **Harvest Conversion**: NEVER requires approval. Available product created from Harvest is always immediately approved and available.
   - **Notifications**: Reject notifications must include rejection reason. Approval notifications may optionally include approval note (not required).
   - **Toast Messages**: Approval-specific toast messages only when product image is actually submitted for approval. Otherwise use normal success messages.

## Global Constraints

- Maintain ZERO REGRESSION — no existing functionality may break
- Do not redesign existing working modules
- Available/Unavailable terminology must be maintained
- Historical data (orders, deliveries, notifications, harvest history, reservation history) must remain on original product records
- Available and Pre-order products remain fully independent (description, images, price, address, inventory, ratings)
- Product Name, Category, and Unit remain locked (immutable) when reusing values
- Reviews, Wishlist, Views, Sales aggregation, and Reports remain unchanged
- No shared reputation implementation in this phase
- Product approval applies ONLY to image moderation — non-image changes never require approval
- Harvest conversion NEVER requires approval — Available product from Harvest is always immediately approved

---

## Task 1: Add Backend Endpoint for Previous Product Values

**Files:**
- Modify: `backend/routes/products.js` (add new GET endpoint)

**Interfaces:**
- Consumes: farmer_id (from JWT), `name` (query param), `is_preorder` (query param)
- Produces: JSON `{ values: { description, image_url, price, location, city, province, expiry_date, max_preorder_quantity, preorder_availability_date } | null }`

**Implementation details:**

The endpoint queries the `products` table for the most recent product matching:
- `farmer_id` = JWT user id
- `LOWER(name)` = `LOWER(query param name)`
- `is_preorder` = query param is_preorder (boolean)
- `is_admin_disabled = false`
- `status` NOT IN ('harvested') — exclude harvested products since those are historical records

Returns `ORDER BY created_at DESC LIMIT 1` — the latest non-harvested product of the same name and selling type.

Editable fields returned:
- `description`, `image_url`, `price`, `location`, `city`, `province`
- Available-only: `expiry_date`
- Pre-order-only: `max_preorder_quantity`, `preorder_availability_date`

Immutable fields (NOT returned, not auto-filled):
- `name`, `category_id`, `unit`

- [ ] **Step 1: Add the GET `/previous-values` endpoint to `backend/routes/products.js`**

Insert after the existing `/catalog/names` endpoint (around line 639). Use `getUserFromToken(req)` for auth (same pattern as other endpoints in the file). Verify `user.role === 'farmer'`.

- [ ] **Step 2: Verify endpoint works**

Start backend, call `GET /api/products/previous-values?name=Pechay&is_preorder=false` with a valid farmer JWT. Verify response.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/products.js
git commit -m "feat: add GET /products/previous-values endpoint for auto-fill"
```

---

## Task 2: Implement Auto-Load Previous Values in Frontend

**Files:**
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: `/api/products/previous-values` endpoint from Task 1
- Produces: Auto-filled form fields in the Add Product modal

**Implementation details:**

The Add Product form (`frontend/farmer.html:2880-3070`) has these field IDs:

**Common fields (shared between Available and Pre-order):**
- `product-price` — price input
- `product-location-display` (readonly textarea) + `product-location` (hidden input) — location
- `product-name` (readonly, immutable)
- `product-category` (readonly custom select, immutable)
- `product-unit` (readonly, immutable)

**Available-specific fields:**
- `available-description` — description textarea
- `available-image` — file input (image)
- `available-stock` — stock quantity
- `available-expiry` — best before date

**Pre-order-specific fields:**
- `preorder-description` — description textarea
- `preorder-image` — file input (image)
- `preorder-max-quantity` — reservation capacity
- `preorder-harvest-date` — expected harvest date (maps to `preorder_availability_date`)

**Trigger logic:**

Auto-load is triggered when BOTH conditions are met:
1. A product name is selected (via the product name suggestion dropdown)
2. A selling mode is selected (Available or Pre-order radio)

If the farmer changes the selling mode after selecting a product name, auto-load re-fires with the new selling type. If the farmer changes the product name after selecting a selling mode, auto-load re-fires with the new name.

**Fill logic:**

`fillAddProductForm(values, isPreorder)`:
- Fill `product-price` with `values.price`
- Fill `product-location` and `product-location-display` with `values.location`
- If Available mode: fill `available-description` with `values.description`, fill `available-expiry` with `values.expiry_date`
- If Pre-order mode: fill `preorder-description` with `values.description`, fill `preorder-max-quantity` with `values.max_preorder_quantity`, fill `preorder-harvest-date` with `values.preorder_availability_date`
- **Image handling**: The image is a file upload (`<input type="file">`), not a URL input. Previous `image_url` cannot be directly set into a file input for security reasons. Instead, show the previous image as a preview in the `available-image-preview` or `preorder-image-preview` div, and store the `image_url` in a hidden field or dataset attribute. The farmer can keep the previous image (by not selecting a new file) or upload a new one. The submit logic must check: if no new file is selected but a previous `image_url` exists, pass the `image_url` in the form data.

**Do NOT fill:**
- `product-name`, `product-category`, `product-unit` (immutable)
- `available-stock` or `preorder-max-quantity` for Available/Pre-order respectively — wait, `preorder-max-quantity` IS an editable field that should be auto-filled. `available-stock` is current inventory and should NOT be auto-filled (it's a new product with new stock).

Correction: `available-stock` should NOT be auto-filled. `preorder-max-quantity` SHOULD be auto-filled (it's a reservation capacity setting, not current inventory).

- [ ] **Step 1: Add `loadPreviousProductValues(productName, isPreorder)` method**

Async method that calls `GET /api/products/previous-values?name=...&is_preorder=...` with Authorization header. On success with non-null `values`, calls `this.fillAddProductForm(values, isPreorder)`. Silently handles errors (no user-facing error message — just console.error).

- [ ] **Step 2: Add `fillAddProductForm(values, isPreorder)` method**

Fills the form fields as described above. Handles image preview display for previous `image_url`.

- [ ] **Step 3: Modify `setupProductSuggestionListeners` to trigger auto-load on product name change**

In the existing `addName.addEventListener('change', ...)` handler, after `this.updatePriceSuggestion('add')`, add:
- Check if a selling mode is selected (`check-available-mode` or `check-preorder-mode` is checked)
- If yes, call `this.loadPreviousProductValues(addName.value, isPreorder)`

- [ ] **Step 4: Modify selling mode change handlers to trigger auto-load**

In the existing selling mode radio button change handlers (around line 2681-2685), after `this.updateSellingDetailsSection()`, add:
- Check if `product-name` has a value
- If yes, call `this.loadPreviousProductValues(productName, isPreorder)` with the appropriate `isPreorder` based on which radio was selected

- [ ] **Step 5: Modify `submitAvailableProduct` and `submitPreorderProduct` to pass previous `image_url` if no new image is selected**

In `submitAvailableProduct` (around line 867): if `available-image` has no file selected but a previous `image_url` was stored, append `image_url` to FormData.

In `submitPreorderProduct` (around line 930): same logic for `preorder-image`.

- [ ] **Step 6: Update submit button text and approval logic based on Product Approval feature flag and image change**

The existing code already updates submit button text based on `featureFlags.require_product_approval`. This needs to be refined:

**For NEW products (Add Product modal):**
- If `featureFlags.require_product_approval === true`: Button = "Submit for Approval" (because new image is always uploaded)
- If `featureFlags.require_product_approval === false`: Button = "Submit"

**For EDIT products (Edit Product modal):**
- If `featureFlags.require_product_approval === false`: Button = "Submit" (always immediate)
- If `featureFlags.require_product_approval === true`:
  - If a new image file is selected: Button = "Submit for Approval"
  - If no new image selected (reusing previous image): Button = "Submit" (immediate update, no approval needed)

**Implementation:**
- In `openAddProductModal`: Keep existing logic (button = "Submit for Approval" if approval required, else "Submit")
- In `openEditModal`: Add check for whether image file input has a new file selected. If yes and approval required, button = "Submit for Approval". Otherwise button = "Submit".
- In submit handlers: The backend already handles approval logic based on `status` field. No backend changes needed — just ensure the frontend sends the correct status or lets backend decide based on approval flag and image presence.

- [ ] **Step 7: Update toast messages to be approval-specific only when image is submitted for approval**

- If product submitted for approval (image uploaded + approval required): Show approval-specific toast with encouraging wording about image moderation
- If product submitted without approval (no image change or approval disabled): Show normal success message

- [ ] **Step 8: Verify via Browser MCP**

1. Login as farmer
2. Open Add Product modal
3. Select a category
4. Select a product name that has previous products
5. Select "Available Now" selling mode
6. Verify price, location, description, and image preview auto-fill
7. Verify Product Name, Category, Unit are still locked
8. Switch to "Pre-order" selling mode
9. Verify description, max quantity, harvest date auto-fill with pre-order previous values
10. Close modal without submitting (verification only)

- [ ] **Step 9: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: auto-load previous product values in Add Product modal"
```

---

## Task 3: Verify Harvest YES/NO Workflow (No Changes Expected)

**Files:**
- Verify: `backend/routes/products.js:1943-2128` (harvest-lifecycle endpoint)
- Verify: `frontend/js/farmer.js` (harvest modal and YES/NO handlers)

**Implementation details:**

The harvest lifecycle endpoint is already fully implemented and working:

**YES path** (`make_available = true`, lines 1999-2094):
1. Checks for existing linked Available product via `product.linked_product_id`
2. If linked product exists: transfers stock (adds `harvestQuantity` to existing product's `stock_quantity`), marks pre-order as `harvested` + `is_available = false`
3. If no linked product: creates new Available product with values copied from the pre-order product (name, description, price, category, unit, image, location, city, province, cloudinary_public_id), sets `linked_product_id` to the pre-order's id, marks pre-order as `harvested`. **CRITICAL: The new Available product is always created with `status = 'approved'` — never requires approval regardless of Product Approval feature flag.**

**NO path** (`make_available = false`, lines 2095-1110):
1. Marks pre-order as `harvested`, `is_available = false`, zeroes `stock_quantity` and `reserved_quantity`

**No changes are needed.** This task is verification-only.

- [ ] **Step 1: Verify YES path via Browser MCP**

1. Login as farmer with an existing pre-order product
2. Navigate to Products section
3. Find the pre-order product and click Harvest
4. Enter harvest quantity
5. Click YES (make available)
6. Verify new Available product appears in the Available products list
7. Verify pre-order product is marked as Harvested
8. Verify `linked_product_id` is set correctly

- [ ] **Step 2: Verify NO path via Browser MCP**

1. Create a new pre-order product (or use existing)
2. Click Harvest
3. Enter harvest quantity
4. Click NO (harvest only)
5. Verify pre-order product is marked as Harvested
6. Verify no new Available product was created

- [ ] **Step 3: Document verification results**

Record findings for the final report. No commit needed unless issues are found.

---

## Task 4: Verify Historical Data Preservation (No Changes Expected)

**Files:**
- Verify: `backend/routes/products.js`
- Verify: `backend/routes/orders.js`
- Verify: Database schema

**Implementation details:**

Historical data (Orders, Deliveries, Notifications, Harvest History, Reservation History) must remain attached to original product records. The current implementation already preserves this:

1. **Orders** — `orders.product_id` references the original product. No code moves orders to new products during harvest lifecycle.
2. **Deliveries** — Delivery records are part of orders, which stay on the original product.
3. **Notifications** — Notifications reference `product_id` of the original product. No code moves them.
4. **Harvest History** — The pre-order product with `status = 'harvested'` IS the harvest history record. It remains in the database with its original `id`.
5. **Reservation History** — Pre-order reservations (`reserved_quantity`) are zeroed on harvest, but the original product record with its `id` and `status = 'harvested'` preserves the history.

**No changes are needed.** This task is verification-only.

- [ ] **Step 1: Verify no data movement in harvest-lifecycle endpoint**

Review lines 1943-2128 of `backend/routes/products.js`. Confirm:
- No `UPDATE orders SET product_id = ...` statements
- No `UPDATE notifications SET product_id = ...` statements
- No data migration from pre-order to Available product

- [ ] **Step 2: Verify orders query in farmer dashboard still references original product**

Check `backend/routes/orders.js` farmer orders query — it should join `orders.product_id` to `products.id` without any redirect to linked products.

- [ ] **Step 3: Document verification results**

Record findings for the final report. No commit needed unless issues are found.

---

## Task 5: Verify Available/Unavailable Terminology (No Changes Expected)

**Files:**
- Verify: `frontend/farmer.html`
- Verify: `frontend/js/farmer.js`

**Implementation details:**

The system uses "Available" and "Unavailable" for product availability status:
- `is_available = true` → "Available" (visible in marketplace)
- `is_available = false` → "Unavailable" (hidden from marketplace, existing orders continue)

Confirmation dialogs are shown when toggling availability.

**No changes are needed.** This task is verification-only.

- [ ] **Step 1: Search for incorrect terminology**

Search `frontend/farmer.html` and `frontend/js/farmer.js` for "Enable" or "Disable" in product availability context. These should not appear in farmer-facing product management UI.

- [ ] **Step 2: Verify Available/Unavailable is used consistently**

Search for "Available" and "Unavailable" in farmer product management UI. Confirm:
- Product status badges show "Available" or "Unavailable"
- Toggle button text says "Make Unavailable" / "Make Available"
- Confirmation dialog text uses "Unavailable" / "Available"

- [ ] **Step 3: Document verification results**

Record findings for the final report. No commit needed unless issues are found.

---

## Task 6: Verify Product Independence (No Changes Expected)

**Files:**
- Verify: `backend/routes/products.js`
- Verify: `backend/routes/orders.js`

**Implementation details:**

Available and Pre-order products are separate `products` rows with independent:
- `description`, `image_url`, `price`, `location`, `city`, `province`
- `stock_quantity`, `reserved_quantity`, `max_preorder_quantity`
- `expiry_date`, `preorder_availability_date`
- Reviews and ratings (each product has its own reviews via `reviews.product_id`)

They are linked via `linked_product_id` but this is only used for:
1. Harvest lifecycle stock transfer (YES path transfers stock to linked Available product)
2. UI display (showing "Linked: Available/Pre-order" badge with "Open Linked Product" button)

**No changes are needed.** This task is verification-only.

- [ ] **Step 1: Verify product creation creates independent records**

Review the product creation endpoint (lines 1104-1364). Confirm:
- Each POST creates a separate `products` row
- `linked_product_id` is set but no fields are copied from the linked product
- Description, image, price, location, inventory are all independent

- [ ] **Step 2: Verify harvest lifecycle creates independent Available product**

Review the harvest YES path (lines 2043-2094). Confirm:
- New Available product gets its own `description`, `image_url`, `price`, `location` from the pre-order product (not from any other product)
- The new product is a separate row with its own `id`
- Reviews, orders, wishlist entries are not moved

- [ ] **Step 3: Document verification results**

Record findings for the final report. No commit needed unless issues are found.

---

## Task 7: Regression Testing

**Files:**
- Test: All modules via Browser MCP

**Implementation details:**

Comprehensive regression testing covering all modules affected by the changes.

- [ ] **Step 1: Test Product Creation with Auto-Load**

1. Login as farmer
2. Open Add Product modal
3. Select category, then select a product name that has previous products
4. Select "Available Now" selling mode
5. Verify price, location, description, and image preview auto-fill correctly
6. Verify Product Name, Category, Unit remain locked (readonly)
7. Change stock quantity and submit
8. Verify product created successfully
9. Open Add Product modal again, select same product name
10. Select "Pre-order" selling mode
11. Verify pre-order specific fields (max quantity, harvest date) auto-fill
12. Submit and verify product created

- [ ] **Step 2: Test Product Creation Without Previous Values**

1. Login as farmer
2. Open Add Product modal
3. Select a product name that has NO previous products
4. Select selling mode
5. Verify form fields are empty (no auto-fill)
6. Fill manually and submit
7. Verify product created successfully

- [ ] **Step 3: Test Harvest YES Path**

1. Find a pre-order product
2. Click Harvest
3. Enter quantity, click YES
4. Verify Available product created/stock transferred
5. Verify pre-order marked as Harvested
6. Verify linked_product_id set correctly

- [ ] **Step 4: Test Harvest NO Path**

1. Find a pre-order product
2. Click Harvest
3. Enter quantity, click NO
4. Verify pre-order marked as Harvested
5. Verify no Available product created

- [ ] **Step 5: Test Available/Unavailable Toggle**

1. Find an Available product
2. Click "Make Unavailable"
3. Verify confirmation dialog appears with correct text
4. Confirm
5. Verify product shows as Unavailable
6. Click "Make Available"
7. Verify confirmation dialog appears
8. Confirm
9. Verify product shows as Available

- [ ] **Step 6: Test Historical Data Preservation**

1. Find a product with orders
2. Harvest the product (YES path)
3. Verify orders still reference the original product
4. Verify no orders moved to the new Available product

- [ ] **Step 7: Test Customer Marketplace**

1. Browse products as customer
2. Verify Available products visible
3. Verify Unavailable products hidden
4. Add to cart, checkout
5. Verify order created correctly

- [ ] **Step 8: Test Admin Panel**

1. Login as admin
2. View products section
3. Verify linked badges display
4. Verify product approval workflow works
5. Test product enable/disable (admin context, not farmer)

- [ ] **Step 9: Test Product Editing**

1. Open edit modal for an Available product
2. Verify all fields editable (except name, category, unit)
3. Save changes without changing image
4. Verify changes saved immediately (no approval required)
5. Open edit modal again, change the image
6. Verify button text changes to "Submit for Approval" if Product Approval is ON
7. Submit and verify product enters Pending status
8. Login as admin, approve the product
9. Verify product becomes Available

- [ ] **Step 10: Test Product Approval Logic**

1. Test NEW product with Product Approval OFF: Submit with image, verify immediate availability
2. Test NEW product with Product Approval ON: Submit with image, verify Pending status, then approve
3. Test EDIT product with Product Approval ON, no image change: Verify immediate update
4. Test EDIT product with Product Approval ON, image change: Verify Pending status, then approve
5. Test Harvest conversion with Product Approval ON: Verify Available product created immediately approved (no approval required)
6. Verify toast messages: approval-specific only when image submitted for approval, normal success otherwise

- [ ] **Step 11: Document test results**

Record all test results for the final report.

---

## Task 8: Generate Final Verification Report

**Files:**
- Create: `PRODUCT-LIFECYCLE-REFINEMENTS-REPORT.md`

- [ ] **Step 1: Create verification report**

Document all findings from Tasks 3-7 (verification tasks) and Task 7 (regression testing).

Include:
- Summary of implemented changes (Task 1: backend endpoint, Task 2: frontend auto-load)
- Verification results for harvest workflow, historical data, terminology, product independence
- Regression test results
- Any issues found and their resolutions
- Deployment checklist

- [ ] **Step 2: Commit report**

```bash
git add PRODUCT-LIFECYCLE-REFINEMENTS-REPORT.md
git commit -m "docs: add Product Lifecycle Refinements final verification report"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Automatic value reuse without confirmation — Task 1 (backend), Task 2 (frontend)
- ✅ Immutable fields (Product Name, Category, Unit) — Task 2 (fillAddProductForm skips these)
- ✅ Historical data preservation — Task 4 (verification only, no changes needed)
- ✅ Available and Pre-order independence — Task 6 (verification only, no changes needed)
- ✅ Harvest YES/NO workflow as approved — Task 3 (verification only, no changes needed)
- ✅ Available/Unavailable terminology — Task 5 (verification only, no changes needed)
- ✅ linked_product_id for linking — already implemented, no changes
- ✅ No redesign of existing modules — only additive changes (new endpoint, new frontend methods)
- ✅ Regression testing — Task 7
- ✅ Final report — Task 8
- ✅ Shared Reputation DEFERRED — not in this plan

**2. Placeholder scan:**
- ✅ No TBD/TODO placeholders
- ✅ All field IDs verified against actual HTML
- ✅ All endpoint patterns match existing code

**3. Scope check:**
- ✅ Only 2 implementation tasks (backend endpoint + frontend auto-load)
- ✅ 4 verification-only tasks (harvest, historical data, terminology, independence)
- ✅ 1 regression testing task
- ✅ 1 report task
- ✅ Total: 8 tasks, well-scoped for a single implementation session

---

Plan complete and saved to `docs/superpowers/plans/2025-01-27-product-lifecycle-refinements.md`.

**Execution approach:** Subagent-Driven workflow with review after every completed task. Do not continue to the next task until the previous task passes regression verification.
