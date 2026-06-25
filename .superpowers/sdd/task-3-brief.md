# Task 3: Update Product List HTML with Nested Tabs

## Files
- Modify: `frontend/farmer.html` (lines 1294-1378)

## Interfaces
- Consumes: Existing products section structure
- Produces: Nested tab structure for Available Now and Pre-orders

## Steps

### Step 1: Replace products tabs with nested tabs

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

### Step 2: Replace My Products tab content with nested tabs

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

### Step 2: Commit

```bash
git add frontend/farmer.html
git commit -m "feat: add nested tabs for Available Now and Pre-orders in product list"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
