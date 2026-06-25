# Task 7: Add Tabbed Management Section to Edit Product Modal

## Files
- Modify: `frontend/farmer.html` (after edit product fields, before modal footer)

## Interfaces
- Consumes: Existing edit-product-form structure
- Produces: Tabbed management section with Available Now and Pre-orders tabs

## Steps

### Step 1: Add management tabs section to edit-product-form

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

### Step 2: Commit

```bash
git add frontend/farmer.html
git commit -m "feat: add tabbed management section to edit product modal"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
