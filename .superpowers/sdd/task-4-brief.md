# Task 4: Remove Preorder Checkbox from Add Product Modal

## Files
- Modify: `frontend/farmer.html` (lines 2454-2470)

## Interfaces
- Consumes: Existing add-product-modal structure
- Produces: Removed checkbox and preorder fields section

## Steps

### Step 1: Remove is-preorder checkbox and preorder-fields section

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

### Step 2: Commit

```bash
git add frontend/farmer.html
git commit -m "refactor: remove preorder checkbox from add product modal"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
