# Task 8: Add Confirmation Modals to farmer.html

## Files
- Modify: `frontend/farmer.html` (add after edit-product-modal)

## Interfaces
- Consumes: Existing modal structure
- Produces: Three new confirmation modals

## Steps

### Step 1: Add harvest confirmation modal

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

### Step 2: Add convert inventory confirmation modal

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

### Step 3: Add disable product confirmation modal

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

### Step 4: Commit

```bash
git add frontend/farmer.html
git commit -m "feat: add confirmation modals for harvest, convert, and disable actions"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
