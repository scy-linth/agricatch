# Farmer Product Management Audit

**Date:** 2026-06-25
**Scope:** Farmer Product Management experience after hybrid pre-order implementation
**Focus:** Workflow clarity, inventory clarity, pre-order management clarity, harvest management clarity, thesis readiness

---

## Critical Fix Before Defense

### 1. Missing Harvest and Convert Buttons in Pre-order Products Table

**Location:** `frontend/js/farmer.js` lines 6224-6226

**Issue:** The pre-order products table only displays an "Edit" button, but the JavaScript has event handlers for `.btn-action-harvest` and `.btn-action-convert` buttons (lines 1489-1508) that don't exist in the rendered HTML. Farmers cannot harvest or convert pre-order inventory from the table view.

**Impact:** Critical workflow gap - farmers cannot perform the core pre-order management actions (harvesting and converting) from the main product list. They must edit each product individually to access the "Harvested Now" button, which is inefficient and unclear.

**Current Code:**
```javascript
// Line 6224-6226 - only Edit button rendered
<td class="col-actions">
    <button class="btn btn-sm btn-outline-primary btn-action-edit" data-product-id="${product.id}">Edit</button>
</td>
```

**Expected Code:**
```javascript
<td class="col-actions">
    <button class="btn btn-sm btn-outline-primary btn-action-edit" data-product-id="${product.id}">Edit</button>
    <button class="btn btn-sm btn-success btn-action-harvest" data-product-id="${product.id}" title="Harvest Now">Harvest</button>
    <button class="btn btn-sm btn-warning btn-action-convert" data-product-id="${product.id}" title="Convert Remaining Inventory">Convert</button>
</td>
```

**Fix:** Add Harvest and Convert buttons to the pre-order products table actions column.

---

### 2. Missing "Convert Inventory" Button in Edit Product Form

**Location:** `frontend/farmer.html` line 2722, `frontend/js/farmer.js` line 1431

**Issue:** The edit product form has `edit-harvest-now-btn` (line 2722) and the JavaScript has an event listener for `edit-convert-inventory-btn` (line 1431), but this button doesn't exist in the HTML. Farmers cannot convert remaining pre-order inventory from the edit form.

**Impact:** Farmers can only harvest pre-orders but cannot convert remaining inventory to regular stock from the edit form. The convert workflow is incomplete.

**Current Code:**
```html
<!-- Line 2722 - only Harvested Now button -->
<button type="button" id="edit-harvest-now-btn" class="btn btn-sm btn-success" style="display:none;">Harvested Now</button>
```

**Expected Code:**
```html
<button type="button" id="edit-harvest-now-btn" class="btn btn-sm btn-success" style="display:none;">Harvested Now</button>
<button type="button" id="edit-convert-inventory-btn" class="btn btn-sm btn-warning" style="display:none;">Convert Remaining Inventory</button>
```

**Fix:** Add the missing "Convert Remaining Inventory" button to the edit product form.

---

## Important Improvements

### 3. No Clear Indication of Harvest-Ready Status in Pre-order Table

**Location:** `frontend/js/farmer.js` lines 6247-6258

**Issue:** The `getPreorderStatusBadge` function shows "Harvest Ready" badge when the availability date has passed, but there's no visual cue in the table to highlight these products that need immediate attention. Farmers must manually check dates.

**Impact:** Farmers may miss harvest-ready products, leading to delayed fulfillment and customer dissatisfaction.

**Current Code:**
```javascript
// Line 6254-6255 - Harvest Ready badge exists but not highlighted
if (product.preorder_availability_date && new Date(product.preorder_availability_date) <= new Date()) {
    return '<span class="badge bg-success">Harvest Ready</span>';
}
```

**Suggested Improvement:** Add a visual indicator (row highlight, icon, or distinct badge styling) for harvest-ready products to make them immediately visible.

---

### 4. Missing Inventory Visibility in Pre-order Table

**Location:** `frontend/js/farmer.js` lines 6216-6221

**Issue:** The pre-order table shows "Reserved: X / Y" with a progress bar, but doesn't show the actual harvest quantity that will become available. Farmers don't know how much stock they'll have after harvesting.

**Impact:** Farmers cannot plan inventory allocation or fulfillment without knowing the harvest quantity.

**Current Code:**
```javascript
// Line 6218 - shows reservation progress but not harvest quantity
<div class="small">Reserved: ${this.fmtNumber(product.reserved_quantity)} / ${this.fmtNumber(product.max_preorder_quantity)}</div>
```

**Suggested Improvement:** Add a field showing "Harvest Quantity: X" (the reserved quantity that will become stock) to help farmers plan.

---

### 5. Unclear Harvest vs Convert Workflow Distinction

**Location:** `frontend/farmer.html` lines 2731-2765

**Issue:** The harvest confirmation modal says "transfer harvested inventory into Available Now stock" and the convert modal says "convert all remaining pre-order inventory into Available Now stock". The distinction between these two actions is unclear to farmers.

**Impact:** Farmers may not understand when to use harvest vs convert, leading to incorrect workflow choices.

**Current Modal Text:**
- Harvest: "This action will transfer harvested inventory into Available Now stock and make it available for immediate purchase."
- Convert: "Convert all remaining pre-order inventory into Available Now stock?"

**Suggested Improvement:** Clarify the distinction:
- Harvest: "Transfer reserved pre-order inventory (fulfilled reservations) into Available Now stock for immediate sale."
- Convert: "Transfer ALL remaining pre-order capacity (including unreserved) into Available Now stock."

---

### 6. Missing Pre-order Status Filter Options

**Location:** `frontend/farmer.html` lines 1373-1380

**Issue:** The pre-order status filter only has basic options. It doesn't include "Harvest Ready" as a filter option, making it difficult for farmers to find products that need immediate attention.

**Impact:** Farmers cannot efficiently filter for harvest-ready products, requiring manual date checking.

**Current Code:**
```html
<!-- Line 1373-1380 - basic status filter -->
<select id="preorder-status-filter" class="form-select form-select-sm">
    <option value="">All Statuses</option>
    <option value="active">Active</option>
    <option value="disabled">Disabled</option>
</select>
```

**Suggested Improvement:** Add "Harvest Ready" option to the pre-order status filter.

---

## Optional Polish

### 7. Product Type Selection Could Be More Intuitive

**Location:** `frontend/farmer.html` lines 2510-2527

**Issue:** The product type selection uses cards with icons ("Available Now" vs "Pre-orders"), but the distinction could be clearer with better descriptions or examples.

**Impact:** Minor - farmers may need to think about which type to choose, but the current design is functional.

**Suggested Improvement:** Add brief examples or use cases under each card (e.g., "Use for products ready for immediate sale" vs "Use for future harvests").

---

### 8. Pre-order Progress Bar Could Show Remaining Capacity

**Location:** `frontend/js/farmer.js` lines 6218-6221

**Issue:** The progress bar shows reservation progress but doesn't indicate remaining capacity numerically.

**Impact:** Minor - farmers can calculate remaining capacity, but showing it directly would be more convenient.

**Current Code:**
```javascript
// Line 6218-6221 - shows progress but not remaining
<div class="small">Reserved: ${this.fmtNumber(product.reserved_quantity)} / ${this.fmtNumber(product.max_preorder_quantity)}</div>
<div class="progress" style="height:4px;margin-top:2px;">
    <div class="progress-bar bg-purple" style="width:${progressPercent}%"></div>
</div>
```

**Suggested Improvement:** Add "Remaining: X" text below the progress bar for quick reference.

---

### 9. KPI Cards Could Show Pre-order Metrics

**Location:** `frontend/farmer.html` lines 1281-1294

**Issue:** The pre-order KPI cards show "Pending Harvest" and "Reserved Max Reached" counts, but could show additional metrics like total reservations, average reservation rate, or harvest-ready count.

**Impact:** Minor - current KPIs are useful but could provide more insight.

**Suggested Improvement:** Add additional KPIs for pre-order performance metrics.

---

### 10. Harvest Confirmation Modal Could Show Quantity

**Location:** `frontend/farmer.html` lines 2731-2747

**Issue:** The harvest confirmation modal doesn't show how much inventory will be transferred. Farmers must trust the system without verification.

**Impact:** Minor - the action is clear but showing the quantity would provide confidence.

**Suggested Improvement:** Add "X units will be transferred to Available Now stock" to the modal body.

---

## Summary

**Critical Issues (2):**
1. Missing Harvest and Convert buttons in pre-order products table
2. Missing Convert Inventory button in edit product form

**Important Issues (4):**
3. No clear indication of harvest-ready status
4. Missing inventory visibility in pre-order table
5. Unclear harvest vs convert workflow distinction
6. Missing pre-order status filter options

**Optional Polish (4):**
7. Product type selection could be more intuitive
8. Pre-order progress bar could show remaining capacity
9. KPI cards could show pre-order metrics
10. Harvest confirmation modal could show quantity

**Overall Assessment:** The farmer product management system has solid infrastructure (tabs, forms, modals, backend endpoints) but has critical UI gaps that prevent farmers from performing core pre-order management workflows. The missing buttons are the highest priority for thesis readiness.
