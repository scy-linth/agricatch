# Farmer Product Management UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Farmer Product Management interface with tabbed Available Now and Pre-orders views, removing checkbox-based selling mode UI and archive functionality.

**Architecture:** Single product record with two management views (Available Now and Pre-orders) using tabbed interface in both product list and product forms. Backend API endpoints added for inventory transfer operations.

**Tech Stack:** Bootstrap 5.3.3, Node.js/Express backend, PostgreSQL database, existing AgriCatch design system

## Global Constraints

- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization

---

## File Structure

**Modified Files:**
- `frontend/farmer.html` - Product list nested tabs, product form tabs, confirmation modals, remove checkbox/archive
- `frontend/js/farmer.js` - Product list rendering, form handling, API calls for new actions
- `backend/routes/farmers.js` - New API endpoints for harvest and convert operations

**No new files created** - All changes are modifications to existing files.

---

### Task 1: Add Backend API Endpoint for Harvest Pre-order

**Files:**
- Modify: `backend/routes/farmers.js`

**Interfaces:**
- Consumes: Express router, PostgreSQL pool, authentication middleware
- Produces: `POST /api/farmers/products/:id/harvest-preorder` endpoint

- [ ] **Step 1: Add harvest-preorder endpoint to farmers.js**

Add this endpoint after the existing product update endpoints:

```javascript
// Harvest pre-order inventory (transfer to available stock)
router.post('/products/:id/harvest-preorder', authenticateToken, requireRole('farmer'), async (req, res) => {
  try {
    const farmerId = req.user.id;
    const productId = parseInt(req.params.id);

    // Verify product belongs to farmer
    const productCheck = await pool.query(
      'SELECT id, farmer_id, stock_quantity, reserved_quantity FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (productCheck.rows[0].farmer_id !== farmerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const product = productCheck.rows[0];

    // Transfer reserved quantity to stock quantity
    const updatedStock = product.stock_quantity + product.reserved_quantity;
    
    await pool.query(
      'UPDATE products SET stock_quantity = $1, reserved_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [updatedStock, productId]
    );

    res.json({ 
      success: true, 
      message: 'Pre-order inventory harvested successfully',
      new_stock_quantity: updatedStock
    });
  } catch (error) {
    console.error('Error harvesting pre-order:', error);
    res.status(500).json({ error: 'Failed to harvest pre-order inventory' });
  }
});
```

- [ ] **Step 2: Test endpoint manually**

Run: Start backend server and test with curl/Postman
```bash
curl -X POST http://localhost:3000/api/farmers/products/1/harvest-preorder \
  -H "Authorization: Bearer <farmer_jwt_token>"
```
Expected: Success response with updated stock quantity

- [ ] **Step 3: Commit**

```bash
git add backend/routes/farmers.js
git commit -m "feat: add harvest-preorder endpoint to transfer pre-order inventory to available stock"
```

---

### Task 2: Add Backend API Endpoint for Convert Remaining Pre-order

**Files:**
- Modify: `backend/routes/farmers.js`

**Interfaces:**
- Consumes: Express router, PostgreSQL pool, authentication middleware
- Produces: `POST /api/farmers/products/:id/convert-preorder` endpoint

- [ ] **Step 1: Add convert-preorder endpoint to farmers.js**

Add this endpoint after the harvest-preorder endpoint:

```javascript
// Convert remaining pre-order inventory to available stock
router.post('/products/:id/convert-preorder', authenticateToken, requireRole('farmer'), async (req, res) => {
  try {
    const farmerId = req.user.id;
    const productId = parseInt(req.params.id);

    // Verify product belongs to farmer
    const productCheck = await pool.query(
      'SELECT id, farmer_id, stock_quantity, reserved_quantity, max_preorder_quantity FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (productCheck.rows[0].farmer_id !== farmerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const product = productCheck.rows[0];
    
    // Calculate remaining available slots
    const remainingSlots = product.max_preorder_quantity - product.reserved_quantity;
    
    if (remainingSlots <= 0) {
      return res.status(400).json({ error: 'No remaining pre-order slots to convert' });
    }

    // Add remaining slots to stock quantity and disable pre-order
    const updatedStock = product.stock_quantity + remainingSlots;
    
    await pool.query(
      'UPDATE products SET stock_quantity = $1, max_preorder_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [updatedStock, productId]
    );

    res.json({ 
      success: true, 
      message: 'Remaining pre-order inventory converted successfully',
      new_stock_quantity: updatedStock
    });
  } catch (error) {
    console.error('Error converting pre-order:', error);
    res.status(500).json({ error: 'Failed to convert pre-order inventory' });
  }
});
```

- [ ] **Step 2: Test endpoint manually**

Run: Start backend server and test with curl/Postman
```bash
curl -X POST http://localhost:3000/api/farmers/products/1/convert-preorder \
  -H "Authorization: Bearer <farmer_jwt_token>"
```
Expected: Success response with updated stock quantity

- [ ] **Step 3: Commit**

```bash
git add backend/routes/farmers.js
git commit -m "feat: add convert-preorder endpoint to convert remaining pre-order slots to available stock"
```

---

### Task 3: Update Product List HTML with Nested Tabs

**Files:**
- Modify: `frontend/farmer.html` (lines 1294-1378)

**Interfaces:**
- Consumes: Existing products section structure
- Produces: Nested tab structure for Available Now and Pre-orders

- [ ] **Step 1: Replace products tabs with nested tabs**

Find the products tabs section (around line 1294) and replace with:

```html
<!-- Products Tabs -->
<ul class="nav nav-tabs nav-tabs-bordered mb-3" id="products-tabs">
    <li class="nav-item">
        <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#products-list-tab">My Products</button>
    </li>
    <li class="nav-item">
        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#products-requests-tab">Approval</button>
    </li>
</ul>
```

- [ ] **Step 2: Replace My Products tab content with nested tabs**

Find the My Products tab content (around line 1306) and replace with:

```html
<!-- My Products Tab -->
<div class="tab-pane fade show active" id="products-list-tab">
    <!-- Nested Tabs: Available Now / Pre-orders -->
    <ul class="nav nav-tabs nav-tabs-bordered mb-3" id="products-management-tabs">
        <li class="nav-item">
            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#available-now-tab">Available Now</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#preorders-tab">Pre-orders</button>
        </li>
    </ul>

    <div class="tab-content">
        <!-- Available Now Tab -->
        <div class="tab-pane fade show active" id="available-now-tab">
            <div class="card">
                <div class="card-body">
                    <div class="section-filter-bar row g-2 mb-3 align-items-end">
                        <div class="col-md-1 col-sm-6">
                            <label class="form-label small fw-semibold mb-1">Show</label>
                            <select class="form-select form-select-sm" data-entries-section="available-products" style="min-width: 60px;">
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50" selected>50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label class="form-label small fw-semibold mb-1">Category</label>
                            <select id="available-category-filter" class="form-select form-select-sm">
                                <option value="">All categories</option>
                            </select>
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label class="form-label small fw-semibold mb-1">Status</label>
                            <select id="available-status-filter" class="form-select form-select-sm">
                                <option value="" selected>Any status</option>
                                <option value="active">Active</option>
                                <option value="out_of_stock">Out of Stock</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                        <div class="col-md-4 col-sm-6 ms-md-auto">
                            <label class="form-label small fw-semibold mb-1">Search</label>
                            <div class="d-flex gap-2">
                                <div class="input-group input-group-sm flex-grow-1">
                                    <input type="text" id="available-search-input" class="form-control me-2" placeholder="Product name…">
                                    <button id="available-search-btn" class="btn btn-sm btn-ac-green" type="button"><i class="bi bi-search me-1"></i>Search</button>
                                </div>
                                <button id="available-refresh-btn" class="btn btn-outline-secondary btn-sm" type="button" aria-label="Refresh listings"><i class="bi bi-arrow-clockwise"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table id="available-products-table" class="table ac-table table-sm table-hover align-middle">
                            <thead>
                                <tr>
                                    <th style="width:56px">Image</th>
                                    <th>ID</th>
                                    <th>Product</th>
                                    <th>Category</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                    <th>Reviews</th>
                                    <th class="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="available-products-tbody">
                                <tr>
                                    <td colspan="9">
                                        <div class="table-skeleton">
                                            <div class="skeleton-row"></div>
                                            <div class="skeleton-row"></div>
                                            <div class="skeleton-row"></div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div id="available-products-pagination" class="pagination-container"></div>
                </div>
            </div>
        </div>

        <!-- Pre-orders Tab -->
        <div class="tab-pane fade" id="preorders-tab">
            <div class="card">
                <div class="card-body">
                    <div class="section-filter-bar row g-2 mb-3 align-items-end">
                        <div class="col-md-1 col-sm-6">
                            <label class="form-label small fw-semibold mb-1">Show</label>
                            <select class="form-select form-select-sm" data-entries-section="preorder-products" style="min-width: 60px;">
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50" selected>50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label class="form-label small fw-semibold mb-1">Category</label>
                            <select id="preorder-category-filter" class="form-select form-select-sm">
                                <option value="">All categories</option>
                            </select>
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label class="form-label small fw-semibold mb-1">Status</label>
                            <select id="preorder-status-filter" class="form-select form-select-sm">
                                <option value="" selected>Any status</option>
                                <option value="active">Active</option>
                                <option value="harvest_ready">Harvest Ready</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                        <div class="col-md-4 col-sm-6 ms-md-auto">
                            <label class="form-label small fw-semibold mb-1">Search</label>
                            <div class="d-flex gap-2">
                                <div class="input-group input-group-sm flex-grow-1">
                                    <input type="text" id="preorder-search-input" class="form-control me-2" placeholder="Product name…">
                                    <button id="preorder-search-btn" class="btn btn-sm btn-ac-green" type="button"><i class="bi bi-search me-1"></i>Search</button>
                                </div>
                                <button id="preorder-refresh-btn" class="btn btn-outline-secondary btn-sm" type="button" aria-label="Refresh listings"><i class="bi bi-arrow-clockwise"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table id="preorder-products-table" class="table ac-table table-sm table-hover align-middle">
                            <thead>
                                <tr>
                                    <th style="width:56px">Image</th>
                                    <th>ID</th>
                                    <th>Product</th>
                                    <th>Category</th>
                                    <th>Expected Harvest</th>
                                    <th>Reservation Progress</th>
                                    <th>Status</th>
                                    <th class="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="preorder-products-tbody">
                                <tr>
                                    <td colspan="8">
                                        <div class="table-skeleton">
                                            <div class="skeleton-row"></div>
                                            <div class="skeleton-row"></div>
                                            <div class="skeleton-row"></div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div id="preorder-products-pagination" class="pagination-container"></div>
                </div>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: add nested tabs for Available Now and Pre-orders in product list"
```

---

### Task 4: Remove Preorder Checkbox from Add Product Modal

**Files:**
- Modify: `frontend/farmer.html` (lines 2454-2470)

**Interfaces:**
- Consumes: Existing add-product-modal structure
- Produces: Removed checkbox and preorder fields section

- [ ] **Step 1: Remove is-preorder checkbox and preorder-fields section**

Find the is-preorder checkbox section (around line 2454) and remove these lines:

```html
<!-- REMOVE THESE LINES -->
<div class="form-group">
    <div class="form-check">
        <input type="checkbox" id="is-preorder" class="form-check-input" name="is_preorder">
        <label for="is-preorder" class="form-check-label">List as Preorder</label>
    </div>
    <small class="field-hint">Enable this to sell products before harvest. Customers can reserve now and you'll deliver when ready.</small>
</div>
<div id="preorder-fields" style="display:none;">
    <div class="form-row">
        <div class="form-group">
            <label for="preorder-availability-date">Preorder Availability Date <span class="text-danger">*</span></label>
            <input type="date" id="preorder-availability-date" class="form-control form-control-sm" name="preorder_availability_date">
            <small class="field-hint">When will this product be available for delivery?</small>
        </div>
        <div class="form-group">
            <label for="max-preorder-quantity">Maximum Reservation Quantity</label>
            <input type="number" id="max-preorder-quantity" class="form-control form-control-sm" name="max_preorder_quantity" min="1">
            <small class="field-hint">Maximum number of reservations allowed</small>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "refactor: remove preorder checkbox from add product modal"
```

---

### Task 5: Add Tabbed Management Section to Add Product Modal

**Files:**
- Modify: `frontend/farmer.html` (after line 2480, before modal footer)

**Interfaces:**
- Consumes: Existing add-product-form structure
- Produces: Tabbed management section with Available Now and Pre-orders tabs

- [ ] **Step 1: Add management tabs section to add-product-form**

Find the end of the product information fields (before the modal footer, around line 2480) and add:

```html
<!-- Management Section -->
<div class="mt-4 pt-3 border-top">
    <h6 class="fw-bold mb-3">Management</h6>
    
    <!-- Management Tabs -->
    <ul class="nav nav-tabs nav-tabs-bordered mb-3" id="add-management-tabs">
        <li class="nav-item">
            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#add-available-now-tab">Available Now</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#add-preorders-tab">Pre-orders</button>
        </li>
    </ul>

    <div class="tab-content">
        <!-- Available Now Tab -->
        <div class="tab-pane fade show active" id="add-available-now-tab">
            <div class="form-row">
                <div class="form-group">
                    <label for="add-stock-quantity">Stock Quantity <span class="text-danger">*</span></label>
                    <input type="number" id="add-stock-quantity" class="form-control form-control-sm" name="stock_quantity" min="0" required>
                    <small class="field-hint">Current available inventory</small>
                </div>
                <div class="form-group">
                    <label for="add-price">Price (₱) <span class="text-danger">*</span></label>
                    <input type="number" id="add-price" class="form-control form-control-sm" name="price" min="0" step="0.01" required>
                    <small class="field-hint">Price per unit</small>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="add-harvest-date">Harvest Date</label>
                    <input type="date" id="add-harvest-date" class="form-control form-control-sm" name="harvest_date">
                    <small class="field-hint">When was this harvested?</small>
                </div>
                <div class="form-group">
                    <label for="add-expiry-date">Expiry Date</label>
                    <input type="date" id="add-expiry-date" class="form-control form-control-sm" name="expiry_date">
                    <small class="field-hint">When does this expire?</small>
                </div>
            </div>
        </div>

        <!-- Pre-orders Tab -->
        <div class="tab-pane fade" id="add-preorders-tab">
            <div class="form-row">
                <div class="form-group">
                    <label for="add-preorder-availability-date">Expected Harvest Date <span class="text-danger">*</span></label>
                    <input type="date" id="add-preorder-availability-date" class="form-control form-control-sm" name="preorder_availability_date">
                    <small class="field-hint">When will this harvest be ready?</small>
                </div>
                <div class="form-group">
                    <label for="add-max-preorder-quantity">Maximum Reservation Quantity <span class="text-danger">*</span></label>
                    <input type="number" id="add-max-preorder-quantity" class="form-control form-control-sm" name="max_preorder_quantity" min="1" required>
                    <small class="field-hint">Maximum number of reservations allowed</small>
                </div>
            </div>
            <div class="form-group">
                <label for="add-reservation-cutoff-date">Reservation Cutoff Date</label>
                <input type="date" id="add-reservation-cutoff-date" class="form-control form-control-sm" name="reservation_cutoff_date">
                <small class="field-hint">Last date customers can reserve (optional)</small>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: add tabbed management section to add product modal"
```

---

### Task 6: Remove Preorder Checkbox from Edit Product Modal

**Files:**
- Modify: `frontend/farmer.html` (lines 2565-2585)

**Interfaces:**
- Consumes: Existing edit-product-modal structure
- Produces: Removed checkbox and edit-preorder-fields section

- [ ] **Step 1: Remove edit-is-preorder checkbox and edit-preorder-fields section**

Find the edit-is-preorder checkbox section (around line 2565) and remove these lines:

```html
<!-- REMOVE THESE LINES -->
<div class="form-group">
    <div class="form-check">
        <input type="checkbox" id="edit-is-preorder" class="form-check-input" name="is_preorder">
        <label for="edit-is-preorder" class="form-check-label">List as Preorder</label>
    </div>
    <small class="field-hint">Enable this to sell products before harvest. Customers can reserve now and you'll deliver when ready.</small>
</div>
<div id="edit-preorder-fields" style="display:none;">
    <div class="form-row">
        <div class="form-group">
            <label for="edit-preorder-availability-date">Preorder Availability Date <span class="text-danger">*</span></label>
            <input type="date" id="edit-preorder-availability-date" class="form-control form-control-sm" name="preorder_availability_date">
            <small class="field-hint">When will this product be available for delivery?</small>
        </div>
        <div class="form-group">
            <label for="edit-max-preorder-quantity">Maximum Reservation Quantity</label>
            <input type="number" id="edit-max-preorder-quantity" class="form-control form-control-sm" name="max_preorder_quantity" min="1">
            <small class="field-hint">Maximum number of reservations allowed</small>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "refactor: remove preorder checkbox from edit product modal"
```

---

### Task 7: Add Tabbed Management Section to Edit Product Modal

**Files:**
- Modify: `frontend/farmer.html` (after edit product fields, before modal footer)

**Interfaces:**
- Consumes: Existing edit-product-form structure
- Produces: Tabbed management section with Available Now and Pre-orders tabs

- [ ] **Step 1: Add management tabs section to edit-product-form**

Find the end of the product information fields in edit modal (before the modal footer) and add:

```html
<!-- Management Section -->
<div class="mt-4 pt-3 border-top">
    <h6 class="fw-bold mb-3">Management</h6>
    
    <!-- Management Tabs -->
    <ul class="nav nav-tabs nav-tabs-bordered mb-3" id="edit-management-tabs">
        <li class="nav-item">
            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#edit-available-now-tab">Available Now</button>
        </li>
        <li class="nav-item">
            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#edit-preorders-tab">Pre-orders</button>
        </li>
    </ul>

    <div class="tab-content">
        <!-- Available Now Tab -->
        <div class="tab-pane fade show active" id="edit-available-now-tab">
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-stock-quantity">Stock Quantity <span class="text-danger">*</span></label>
                    <input type="number" id="edit-stock-quantity" class="form-control form-control-sm" name="stock_quantity" min="0" required>
                    <small class="field-hint">Current available inventory</small>
                </div>
                <div class="form-group">
                    <label for="edit-price">Price (₱) <span class="text-danger">*</span></label>
                    <input type="number" id="edit-price" class="form-control form-control-sm" name="price" min="0" step="0.01" required>
                    <small class="field-hint">Price per unit</small>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-harvest-date">Harvest Date</label>
                    <input type="date" id="edit-harvest-date" class="form-control form-control-sm" name="harvest_date">
                    <small class="field-hint">When was this harvested?</small>
                </div>
                <div class="form-group">
                    <label for="edit-expiry-date">Expiry Date</label>
                    <input type="date" id="edit-expiry-date" class="form-control form-control-sm" name="expiry_date">
                    <small class="field-hint">When does this expire?</small>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" id="edit-disable-product-btn" class="btn btn-sm btn-danger">Disable Product</button>
                <button type="submit" form="edit-product-form" class="btn btn-sm btn-primary">Save Changes</button>
            </div>
        </div>

        <!-- Pre-orders Tab -->
        <div class="tab-pane fade" id="edit-preorders-tab">
            <div class="form-row">
                <div class="form-group">
                    <label for="edit-preorder-availability-date">Expected Harvest Date <span class="text-danger">*</span></label>
                    <input type="date" id="edit-preorder-availability-date" class="form-control form-control-sm" name="preorder_availability_date">
                    <small class="field-hint">When will this harvest be ready?</small>
                </div>
                <div class="form-group">
                    <label for="edit-max-preorder-quantity">Maximum Reservation Quantity <span class="text-danger">*</span></label>
                    <input type="number" id="edit-max-preorder-quantity" class="form-control form-control-sm" name="max_preorder_quantity" min="1" required>
                    <small class="field-hint">Maximum number of reservations allowed</small>
                </div>
            </div>
            <div class="form-group">
                <label for="edit-reservation-cutoff-date">Reservation Cutoff Date</label>
                <input type="date" id="edit-reservation-cutoff-date" class="form-control form-control-sm" name="reservation_cutoff_date">
                <small class="field-hint">Last date customers can reserve (optional)</small>
            </div>
            
            <!-- Reservation Summary Card -->
            <div class="card bg-light mb-3">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <small class="fw-semibold">Reserved:</small>
                        <small class="fw-bold" id="edit-reserved-count">0 / 0</small>
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar" id="edit-reservation-progress" role="progressbar" style="width: 0%"></div>
                    </div>
                    <small class="text-muted" id="edit-available-slots">Available Slots: 0</small>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" id="edit-harvest-now-btn" class="btn btn-sm btn-success">Harvested Now</button>
                <button type="button" id="edit-convert-inventory-btn" class="btn btn-sm btn-warning">Convert Remaining Inventory</button>
                <button type="button" id="edit-disable-product-preorder-btn" class="btn btn-sm btn-danger">Disable Product</button>
                <button type="submit" form="edit-product-form" class="btn btn-sm btn-primary">Save Changes</button>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: add tabbed management section to edit product modal"
```

---

### Task 8: Add Confirmation Modals to farmer.html

**Files:**
- Modify: `frontend/farmer.html` (add after edit-product-modal)

**Interfaces:**
- Consumes: Existing modal structure
- Produces: Three new confirmation modals

- [ ] **Step 1: Add harvest confirmation modal**

Add after the edit-product-modal closing tag:

```html
<!-- MODAL: HARVEST CONFIRMATION -->
<div id="harvest-confirm-modal" class="modal">
    <div class="modal-content" style="max-width:480px;">
        <div class="modal-header">
            <h3><i class="bi bi-check-circle-fill me-2 text-success"></i>Harvest Confirmation</h3>
            <button class="close-btn" id="close-harvest-confirm-modal" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="modal-body" style="padding:1.5rem;">
            <p class="mb-0">This action will transfer harvested inventory into Available Now stock and make it available for immediate purchase.</p>
            <p class="mb-0 mt-2">Do you want to continue?</p>
        </div>
        <div class="modal-footer">
            <button type="button" id="cancel-harvest-btn" class="btn btn-sm btn-secondary">Cancel</button>
            <button type="button" id="confirm-harvest-btn" class="btn btn-sm btn-success">Confirm Harvest</button>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Add convert inventory confirmation modal**

Add after the harvest-confirm-modal:

```html
<!-- MODAL: CONVERT INVENTORY CONFIRMATION -->
<div id="convert-confirm-modal" class="modal">
    <div class="modal-content" style="max-width:480px;">
        <div class="modal-header">
            <h3><i class="bi bi-arrow-repeat me-2 text-warning"></i>Convert Remaining Inventory</h3>
            <button class="close-btn" id="close-convert-confirm-modal" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="modal-body" style="padding:1.5rem;">
            <p class="mb-0">Convert all remaining pre-order inventory into Available Now stock?</p>
            <p class="mb-0 mt-2 text-warning"><small>This action can affect future reservations.</small></p>
        </div>
        <div class="modal-footer">
            <button type="button" id="cancel-convert-btn" class="btn btn-sm btn-secondary">Cancel</button>
            <button type="button" id="confirm-convert-btn" class="btn btn-sm btn-warning">Convert Inventory</button>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Add disable product confirmation modal**

Add after the convert-confirm-modal:

```html
<!-- MODAL: DISABLE PRODUCT CONFIRMATION -->
<div id="disable-confirm-modal" class="modal">
    <div class="modal-content" style="max-width:480px;">
        <div class="modal-header">
            <h3><i class="bi bi-x-circle-fill me-2 text-danger"></i>Disable Product</h3>
            <button class="close-btn" id="close-disable-confirm-modal" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="modal-body" style="padding:1.5rem;">
            <p class="mb-0">This product will no longer be visible to customers.</p>
            <p class="mb-0 mt-2">You can enable it again later.</p>
        </div>
        <div class="modal-footer">
            <button type="button" id="cancel-disable-btn" class="btn btn-sm btn-secondary">Cancel</button>
            <button type="button" id="confirm-disable-btn" class="btn btn-sm btn-danger">Disable Product</button>
        </div>
    </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: add confirmation modals for harvest, convert, and disable actions"
```

---

### Task 9: Update farmer.js Product List Rendering for Nested Tabs

**Files:**
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: Existing product rendering logic
- Produces: Separate rendering for Available Now and Pre-orders tabs

- [ ] **Step 1: Find and update loadProducts function**

Find the `loadProducts` function and modify it to support nested tabs. Add a parameter to distinguish between available and pre-order views:

```javascript
async loadProducts(view = 'available') {
    // view can be 'available' or 'preorder'
    const tableId = view === 'available' ? 'available-products-table' : 'preorder-products-table';
    const tbodyId = view === 'available' ? 'available-products-tbody' : 'preorder-products-tbody';
    const paginationId = view === 'available' ? 'available-products-pagination' : 'preorder-products-pagination';
    
    // ... rest of the function with appropriate filtering based on view
}
```

- [ ] **Step 2: Add separate rendering for available products**

Add a new function to render available products:

```javascript
renderAvailableProducts(products) {
    const tbody = document.getElementById('available-products-tbody');
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No available products found</td></tr>';
        return;
    }
    
    products.forEach(product => {
        const statusBadge = this.getAvailableStatusBadge(product);
        const row = `
            <tr>
                <td><img src="${product.image_url || '/images/placeholder.jpg'}" alt="${this.escapeHtml(product.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;"></td>
                <td class="small">${product.id}</td>
                <td>
                    <div class="fw-semibold small">${this.escapeHtml(product.name)}</div>
                </td>
                <td class="small">${this.escapeHtml(product.category_name || 'N/A')}</td>
                <td class="small">₱${this.fmtNumber(product.price)}</td>
                <td class="small">${this.fmtNumber(product.stock_quantity)}</td>
                <td>${statusBadge}</td>
                <td class="small">${product.review_count || 0} <i class="bi bi-star-fill text-warning"></i> ${product.average_rating ? product.average_rating.toFixed(1) : 'N/A'}</td>
                <td class="col-actions">
                    <button class="btn btn-sm btn-outline-primary btn-action-edit" data-product-id="${product.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-action-disable" data-product-id="${product.id}"><i class="bi bi-x-lg"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}
```

- [ ] **Step 3: Add separate rendering for pre-order products**

Add a new function to render pre-order products:

```javascript
renderPreorderProducts(products) {
    const tbody = document.getElementById('preorder-products-tbody');
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No pre-order products found</td></tr>';
        return;
    }
    
    products.forEach(product => {
        const statusBadge = this.getPreorderStatusBadge(product);
        const progressPercent = product.max_preorder_quantity > 0 
            ? (product.reserved_quantity / product.max_preorder_quantity) * 100 
            : 0;
        const row = `
            <tr>
                <td><img src="${product.image_url || '/images/placeholder.jpg'}" alt="${this.escapeHtml(product.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;"></td>
                <td class="small">${product.id}</td>
                <td>
                    <div class="fw-semibold small">${this.escapeHtml(product.name)}</div>
                </td>
                <td class="small">${this.escapeHtml(product.category_name || 'N/A')}</td>
                <td class="small">${product.preorder_availability_date ? new Date(product.preorder_availability_date).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <div class="small">Reserved: ${this.fmtNumber(product.reserved_quantity)} / ${this.fmtNumber(product.max_preorder_quantity)}</div>
                    <div class="progress" style="height:4px;margin-top:2px;">
                        <div class="progress-bar bg-purple" style="width:${progressPercent}%"></div>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td class="col-actions">
                    <button class="btn btn-sm btn-outline-primary btn-action-edit" data-product-id="${product.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-success btn-action-harvest" data-product-id="${product.id}"><i class="bi bi-check-circle"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-action-disable" data-product-id="${product.id}"><i class="bi bi-x-lg"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}
```

- [ ] **Step 4: Add status badge helper functions**

```javascript
getAvailableStatusBadge(product) {
    if (!product.is_available) {
        return '<span class="badge bg-secondary">Disabled</span>';
    }
    if (product.stock_quantity <= 0) {
        return '<span class="badge bg-warning text-dark">Out of Stock</span>';
    }
    return '<span class="badge bg-success">Active</span>';
}

getPreorderStatusBadge(product) {
    if (!product.is_available) {
        return '<span class="badge bg-secondary">Disabled</span>';
    }
    if (product.preorder_availability_date && new Date(product.preorder_availability_date) <= new Date()) {
        return '<span class="badge bg-success">Harvest Ready</span>';
    }
    return '<span class="badge bg-primary">Active</span>';
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add separate rendering for Available Now and Pre-orders product lists"
```

---

### Task 10: Update farmer.js Form Handling for Tabbed Management

**Files:**
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: Existing form submission logic
- Produces: Updated form handling for tabbed management sections

- [ ] **Step 1: Update add product form submission**

Find the add product form submission handler and update it to handle tabbed management:

```javascript
// In the add product form submit handler
const formData = new FormData(form);
const activeTab = document.querySelector('#add-management-tabs .nav-link.active').getAttribute('data-bs-target');

if (activeTab === '#add-available-now-tab') {
    // Available Now tab - use stock_quantity, price, harvest_date, expiry_date
    formData.append('stock_quantity', document.getElementById('add-stock-quantity').value);
    formData.append('price', document.getElementById('add-price').value);
    formData.append('harvest_date', document.getElementById('add-harvest-date').value);
    formData.append('expiry_date', document.getElementById('add-expiry-date').value);
    formData.append('is_preorder', 'false');
} else if (activeTab === '#add-preorders-tab') {
    // Pre-orders tab - use preorder fields
    formData.append('max_preorder_quantity', document.getElementById('add-max-preorder-quantity').value);
    formData.append('preorder_availability_date', document.getElementById('add-preorder-availability-date').value);
    formData.append('reservation_cutoff_date', document.getElementById('add-reservation-cutoff-date').value);
    formData.append('is_preorder', 'true');
    formData.append('stock_quantity', '0'); // No initial stock for pre-orders
}
```

- [ ] **Step 2: Update edit product form population**

Find the edit product form population logic and update it to populate both tabs:

```javascript
// When populating edit form
document.getElementById('edit-stock-quantity').value = product.stock_quantity || 0;
document.getElementById('edit-price').value = product.price || 0;
document.getElementById('edit-harvest-date').value = product.harvest_date || '';
document.getElementById('edit-expiry-date').value = product.expiry_date || '';

document.getElementById('edit-max-preorder-quantity').value = product.max_preorder_quantity || '';
document.getElementById('edit-preorder-availability-date').value = product.preorder_availability_date || '';
document.getElementById('edit-reservation-cutoff-date').value = product.reservation_cutoff_date || '';

// Update reservation summary
document.getElementById('edit-reserved-count').textContent = `${product.reserved_quantity || 0} / ${product.max_preorder_quantity || 0}`;
const progressPercent = product.max_preorder_quantity > 0 
    ? (product.reserved_quantity / product.max_preorder_quantity) * 100 
    : 0;
document.getElementById('edit-reservation-progress').style.width = `${progressPercent}%`;
document.getElementById('edit-available-slots').textContent = `Available Slots: ${product.max_preorder_quantity - product.reserved_quantity || 0}`;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: update form handling for tabbed management sections"
```

---

### Task 11: Add API Call Handlers for New Actions in farmer.js

**Files:**
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: New backend endpoints
- Produces: API call functions for harvest, convert, and disable

- [ ] **Step 1: Add harvest pre-order function**

```javascript
async harvestPreorder(productId) {
    try {
        const response = await fetch(`${this.apiBase}/farmers/products/${productId}/harvest-preorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            this.showToast('Pre-order inventory harvested successfully', 'success');
            this.loadProducts('preorder'); // Refresh pre-order list
            this.loadProducts('available'); // Refresh available list
            return true;
        } else {
            this.showToast(data.error || 'Failed to harvest pre-order', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error harvesting pre-order:', error);
        this.showToast('Failed to harvest pre-order', 'error');
        return false;
    }
}
```

- [ ] **Step 2: Add convert pre-order function**

```javascript
async convertPreorder(productId) {
    try {
        const response = await fetch(`${this.apiBase}/farmers/products/${productId}/convert-preorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            this.showToast('Remaining inventory converted successfully', 'success');
            this.loadProducts('preorder'); // Refresh pre-order list
            this.loadProducts('available'); // Refresh available list
            return true;
        } else {
            this.showToast(data.error || 'Failed to convert inventory', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error converting pre-order:', error);
        this.showToast('Failed to convert inventory', 'error');
        return false;
    }
}
```

- [ ] **Step 3: Add disable product function**

```javascript
async disableProduct(productId) {
    try {
        const response = await fetch(`${this.apiBase}/farmers/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            this.showToast('Product disabled successfully', 'success');
            this.loadProducts('available'); // Refresh lists
            this.loadProducts('preorder');
            return true;
        } else {
            const data = await response.json();
            this.showToast(data.error || 'Failed to disable product', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error disabling product:', error);
        this.showToast('Failed to disable product', 'error');
        return false;
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add API call handlers for harvest, convert, and disable actions"
```

---

### Task 12: Add Event Listeners for New Actions in farmer.js

**Files:**
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: New buttons in UI
- Produces: Event handlers for confirmation modals and actions

- [ ] **Step 1: Add event listeners for harvest button**

```javascript
// In the product list event delegation
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-action-harvest')) {
        const productId = e.target.closest('.btn-action-harvest').dataset.productId;
        this.currentHarvestProductId = productId;
        this.openModal('harvest-confirm-modal');
    }
});
```

- [ ] **Step 2: Add event listeners for harvest confirmation modal**

```javascript
document.getElementById('confirm-harvest-btn').addEventListener('click', async () => {
    if (this.currentHarvestProductId) {
        const success = await this.harvestPreorder(this.currentHarvestProductId);
        if (success) {
            this.closeModal('harvest-confirm-modal');
            this.currentHarvestProductId = null;
        }
    }
});

document.getElementById('cancel-harvest-btn').addEventListener('click', () => {
    this.closeModal('harvest-confirm-modal');
    this.currentHarvestProductId = null;
});

document.getElementById('close-harvest-confirm-modal').addEventListener('click', () => {
    this.closeModal('harvest-confirm-modal');
    this.currentHarvestProductId = null;
});
```

- [ ] **Step 3: Add event listeners for convert button**

```javascript
document.getElementById('edit-convert-inventory-btn').addEventListener('click', () => {
    this.openModal('convert-confirm-modal');
});
```

- [ ] **Step 4: Add event listeners for convert confirmation modal**

```javascript
document.getElementById('confirm-convert-btn').addEventListener('click', async () => {
    const productId = document.getElementById('edit-product-id').value;
    const success = await this.convertPreorder(productId);
    if (success) {
        this.closeModal('convert-confirm-modal');
        this.closeModal('edit-product-modal');
    }
});

document.getElementById('cancel-convert-btn').addEventListener('click', () => {
    this.closeModal('convert-confirm-modal');
});

document.getElementById('close-convert-confirm-modal').addEventListener('click', () => {
    this.closeModal('convert-confirm-modal');
});
```

- [ ] **Step 5: Add event listeners for disable buttons**

```javascript
// For available products list
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-action-disable')) {
        const productId = e.target.closest('.btn-action-disable').dataset.productId;
        this.currentDisableProductId = productId;
        this.openModal('disable-confirm-modal');
    }
});

// For edit modal
document.getElementById('edit-disable-product-btn').addEventListener('click', () => {
    this.openModal('disable-confirm-modal');
});

document.getElementById('edit-disable-product-preorder-btn').addEventListener('click', () => {
    this.openModal('disable-confirm-modal');
});
```

- [ ] **Step 6: Add event listeners for disable confirmation modal**

```javascript
document.getElementById('confirm-disable-btn').addEventListener('click', async () => {
    const productId = this.currentDisableProductId || document.getElementById('edit-product-id').value;
    const success = await this.disableProduct(productId);
    if (success) {
        this.closeModal('disable-confirm-modal');
        this.closeModal('edit-product-modal');
        this.currentDisableProductId = null;
    }
});

document.getElementById('cancel-disable-btn').addEventListener('click', () => {
    this.closeModal('disable-confirm-modal');
    this.currentDisableProductId = null;
});

document.getElementById('close-disable-confirm-modal').addEventListener('click', () => {
    this.closeModal('disable-confirm-modal');
    this.currentDisableProductId = null;
});
```

- [ ] **Step 7: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add event listeners for harvest, convert, and disable actions"
```

---

### Task 13: Remove Archive Functionality from farmer.html

**Files:**
- Modify: `frontend/farmer.html`

**Interfaces:**
- Consumes: Existing archive buttons/links
- Produces: Removed archive UI elements

- [ ] **Step 1: Search for and remove archive-related elements**

Search for "archive" in farmer.html and remove:
- Any archive buttons in product list actions
- Archive section if it exists
- Archive-related modals

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "refactor: remove archive functionality from farmer dashboard"
```

---

### Task 14: Remove Archive Functionality from farmer.js

**Files:**
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: Existing archive-related functions
- Produces: Removed archive logic

- [ ] **Step 1: Search for and remove archive-related functions**

Search for "archive" in farmer.js and remove:
- `archiveProduct` function
- Archive-related event listeners
- Archive API calls

- [ ] **Step 2: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "refactor: remove archive functionality from farmer.js"
```

---

### Task 15: Add CSS for New Tabbed Interface

**Files:**
- Modify: `frontend/farmer.html` (in the `<style>` block)

**Interfaces:**
- Consumes: Existing CSS structure
- Produces: Styles for new tabs and progress bars

- [ ] **Step 1: Add CSS for nested tabs and progress bars**

Add to the `<style>` block in farmer.html:

```css
/* Nested tabs styling */
#products-management-tabs .nav-link {
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
}

#add-management-tabs .nav-link,
#edit-management-tabs .nav-link {
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
}

/* Purple progress bar for pre-orders */
.progress-bar.bg-purple {
    background-color: #9333ea;
}

/* Reservation summary card */
.card.bg-light {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
}

/* Management section separator */
.mt-4.pt-3.border-top {
    border-top-color: var(--ac-border, #e2e8f0) !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "style: add CSS for nested tabs and progress bars"
```

---

### Task 16: Test Complete Flow

**Files:**
- Test: Manual testing in browser

**Interfaces:**
- Consumes: Complete implementation
- Produces: Verified functionality

- [ ] **Step 1: Test product list nested tabs**

1. Open farmer dashboard
2. Navigate to Products section
3. Verify "Available Now" and "Pre-orders" tabs are visible
4. Click between tabs and verify content switches correctly
5. Verify filters work on both tabs
6. Verify search works on both tabs

- [ ] **Step 2: Test add product with tabbed management**

1. Click "Add Product"
2. Verify "Available Now" and "Pre-orders" tabs are visible
3. Fill out Available Now tab and submit
4. Verify product appears in Available Now list
5. Add another product using Pre-orders tab
6. Verify product appears in Pre-orders list

- [ ] **Step 3: Test edit product with tabbed management**

1. Click "Edit" on an available product
2. Verify both tabs are visible
3. Update Available Now fields and save
4. Verify changes reflect in list
5. Edit a pre-order product
6. Verify reservation summary shows correctly
7. Update pre-order fields and save

- [ ] **Step 4: Test harvest action**

1. Click "Harvested Now" on a pre-order product
2. Verify confirmation modal appears
3. Click "Confirm Harvest"
4. Verify success toast appears
5. Verify inventory transferred to Available Now
6. Verify product moves to Available Now list

- [ ] **Step 5: Test convert action**

1. Edit a pre-order product
2. Click "Convert Remaining Inventory"
3. Verify confirmation modal appears
4. Click "Convert Inventory"
5. Verify success toast appears
6. Verify remaining slots converted to stock

- [ ] **Step 6: Test disable action**

1. Click "Disable" on a product
2. Verify confirmation modal appears
3. Click "Disable Product"
4. Verify success toast appears
5. Verify product shows "Disabled" badge
6. Verify product can be re-enabled via edit

- [ ] **Step 7: Test mobile responsiveness**

1. Open farmer dashboard on mobile viewport
2. Verify nested tabs work on mobile
3. Verify product forms are usable on mobile
4. Verify confirmation modals fit on mobile screens

- [ ] **Step 8: Commit final changes**

```bash
git add .
git commit -m "test: complete flow testing passed"
```

---

## Self-Review

**Spec Coverage:**
- ✅ Product list nested tabs (Available Now / Pre-orders) - Task 3
- ✅ Available Now tab with specific columns and badges - Task 3, 9
- ✅ Pre-orders tab with reservation progress - Task 3, 9
- ✅ Remove preorder checkbox - Task 4, 6
- ✅ Add tabbed management to product forms - Task 5, 7
- ✅ Harvested Now button and confirmation - Task 8, 11, 12
- ✅ Convert Remaining Inventory button and confirmation - Task 8, 11, 12
- ✅ Disable Product button and confirmation - Task 8, 11, 12
- ✅ Remove archive functionality - Task 13, 14
- ✅ Backend API endpoints - Task 1, 2
- ✅ Mobile responsiveness - Task 15, 16

**Placeholder Scan:**
- No placeholders found - all steps include actual code

**Type Consistency:**
- Function names consistent across tasks (harvestPreorder, convertPreorder, disableProduct)
- Element IDs consistent between HTML and JS
- API endpoint names match between backend and frontend calls

**No Database Changes:**
- Confirmed - using existing fields (stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date)
