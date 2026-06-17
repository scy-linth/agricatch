# Shop Address Auto-Fill for Product Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fill product location from shop address in add/edit product modals (Shopee/Lazada style)

**Architecture:** Read shop profile address from `currentShopProfile` in farmer.js, auto-populate product location fields on modal open, preserve existing product locations on edit, allow override via PSGC overlay modal.

**Tech Stack:** JavaScript (farmer.js), HTML (farmer.html), PSGC address utility (window.PSGC)

---

## File Structure

**Files to modify:**
- `frontend/farmer.html` - Update add product modal location field to readonly
- `frontend/js/farmer.js` - Add auto-fill logic in `openAddProductModal()` and `loadEditProductModal()`

**No new files created.**

---

### Task 1: Update Add Product Modal Location Field to Readonly

**Files:**
- Modify: `frontend/farmer.html:930-934`

- [ ] **Step 1: Change product-location input to readonly and update placeholder/hint**

Find the product-location form-group in add-product-modal (around line 930-934) and replace it with:

```html
<div class="form-group">
    <label for="product-location">Farm / Pick-up Location</label>
    <input type="text" id="product-location" class="form-control form-control-sm" placeholder="Auto-filled from shop address" readonly>
    <small class="field-hint">Location is automatically set to your shop address. Contact admin to change shop location.</small>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: make add product location readonly with shop address hint"
```

---

### Task 2: Auto-Fill Shop Address in Add Product Modal

**Files:**
- Modify: `frontend/js/farmer.js` - `openAddProductModal()` method

- [ ] **Step 1: Locate openAddProductModal method in farmer.js**

Search for `openAddProductModal()` method. It should be around line 3270-3290 based on codebase structure.

- [ ] **Step 2: Add shop address auto-fill logic at the start of the method**

Add this code at the beginning of `openAddProductModal()` after the modal show logic:

```javascript
// Auto-fill location from shop address
const shopLocation = this.currentShopProfile?.location || '';
const locationInput = document.getElementById('product-location');
if (locationInput) {
    locationInput.value = shopLocation;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: auto-fill add product location from shop address"
```

---

### Task 3: Auto-Populate Edit Product Address from Shop Address

**Files:**
- Modify: `frontend/js/farmer.js` - `loadEditProductModal()` method

- [ ] **Step 1: Locate loadEditProductModal method in farmer.js**

Search for `loadEditProductModal()` method. It should be around line 3620-3690 based on codebase structure.

- [ ] **Step 2: Find the location population logic**

Look for the section that populates PSGC address fields. It should have code like:
```javascript
const location = product.location || '';
const zoneEl = document.getElementById('edit-product-location-zone');
```

- [ ] **Step 3: Update location fallback to use shop address**

Replace the location assignment line with:

```javascript
const productLocation = product.location || '';
const shopLocation = this.currentShopProfile?.location || '';
const location = productLocation || shopLocation;
```

- [ ] **Step 4: Ensure display field is populated**

The display field population should already exist (added in previous PSGC integration). Verify this line exists and uses the `location` variable:

```javascript
const displayEl = document.getElementById('edit-product-location-display');
if (displayEl) displayEl.value = location;
```

If it doesn't exist, add it before the PSGC parsing logic.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: auto-populate edit product address from shop address"
```

---

### Task 4: Test Shop Address Auto-Fill

**Files:**
- Test: Manual browser testing

- [ ] **Step 1: Start the application**

Run the development server and log in as a farmer user.

- [ ] **Step 2: Test add product modal**

1. Click "Add Product" button
2. Verify the location field is readonly
3. Verify the location field shows the shop address from the farmer's profile
4. Verify the placeholder says "Auto-filled from shop address"
5. Verify the hint text mentions contacting admin to change shop location

- [ ] **Step 3: Test edit product modal with existing location**

1. Find a product that already has a custom location
2. Click "Edit" on that product
3. Verify the display field shows the product's existing location (not shop address)
4. Verify the PSGC dropdowns are populated from the product's location

- [ ] **Step 4: Test edit product modal without location**

1. Find a product with no location set (or create one)
2. Click "Edit" on that product
3. Verify the display field shows the shop address
4. Verify the PSGC dropdowns are populated from the shop address

- [ ] **Step 5: Test address override**

1. In edit product modal, click "Set Location" button
2. Verify the address overlay modal opens
3. Change the address using PSGC dropdowns
4. Click "Confirm Address"
5. Verify the display field updates with the new address
6. Save the product
7. Re-open edit modal and verify the custom address is preserved

- [ ] **Step 6: Edge case - shop profile with no location**

1. Update shop profile to have no location (via admin or database)
2. Refresh the page
3. Click "Add Product"
4. Verify the location field is empty (no crash)
5. Click "Edit" on a product with no location
6. Verify the display field is empty (no crash)

---

## Self-Review

**Spec coverage:**
- ✅ Add product modal readonly field - Task 1
- ✅ Auto-fill from shop address in add modal - Task 2
- ✅ Auto-populate from shop address in edit modal - Task 3
- ✅ Preserve existing product location - Task 3 (uses productLocation first)
- ✅ Allow override via PSGC overlay - Already implemented, Task 4 tests it
- ✅ Edge case: shop profile with no location - Task 4

**Placeholder scan:**
- No placeholders found
- All code blocks are complete
- All file paths are exact
- All commands are complete

**Type consistency:**
- `currentShopProfile` used consistently
- `product.location` used consistently
- Element IDs match HTML: `product-location`, `edit-product-location-display`
