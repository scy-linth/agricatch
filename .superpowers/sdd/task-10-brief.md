# Task 10: Update farmer.js Form Handling for Tabbed Management

## Files
- Modify: `frontend/js/farmer.js`

## Interfaces
- Consumes: Existing form handling logic
- Produces: Updated form submission to handle tabbed management fields

## Steps

### Step 1: Update add product form submission

Find the add product form submission handler and update it to handle the new tabbed management fields:

```javascript
// In the add product form submit handler
const formData = new FormData(form);

// Handle tabbed management fields
const activeTab = document.querySelector('#add-management-tabs .nav-link.active');
const isPreorderTab = activeTab && activeTab.getAttribute('data-bs-target') === '#add-preorders-tab';

if (isPreorderTab) {
    // Pre-order tab is active
    formData.append('max_preorder_quantity', document.getElementById('add-max-preorder-quantity').value);
    formData.append('preorder_availability_date', document.getElementById('add-preorder-availability-date').value);
    formData.append('reservation_cutoff_date', document.getElementById('add-reservation-cutoff-date').value || '');
    formData.append('stock_quantity', '0'); // No stock for pre-orders
    formData.append('price', '0'); // No price for pre-orders
} else {
    // Available Now tab is active
    formData.append('stock_quantity', document.getElementById('add-stock-quantity').value);
    formData.append('price', document.getElementById('add-price').value);
    formData.append('harvest_date', document.getElementById('add-harvest-date').value || '');
    formData.append('expiry_date', document.getElementById('add-expiry-date').value || '');
    formData.append('max_preorder_quantity', '0');
    formData.append('preorder_availability_date', '');
}
```

### Step 2: Update edit product form submission

Find the edit product form submission handler and update it similarly:

```javascript
// In the edit product form submit handler
const formData = new FormData(form);

// Handle tabbed management fields
const activeTab = document.querySelector('#edit-management-tabs .nav-link.active');
const isPreorderTab = activeTab && activeTab.getAttribute('data-bs-target') === '#edit-preorders-tab';

if (isPreorderTab) {
    // Pre-order tab is active
    formData.append('max_preorder_quantity', document.getElementById('edit-max-preorder-quantity').value);
    formData.append('preorder_availability_date', document.getElementById('edit-preorder-availability-date').value);
    formData.append('reservation_cutoff_date', document.getElementById('edit-reservation-cutoff-date').value || '');
} else {
    // Available Now tab is active
    formData.append('stock_quantity', document.getElementById('edit-stock-quantity').value);
    formData.append('price', document.getElementById('edit-price').value);
    formData.append('harvest_date', document.getElementById('edit-harvest-date').value || '');
    formData.append('expiry_date', document.getElementById('edit-expiry-date').value || '');
}
```

### Step 3: Update edit product form population

Find the function that populates the edit product form and update it to populate the new fields and set the correct active tab:

```javascript
// In the edit product form population function
// Populate Available Now tab fields
document.getElementById('edit-stock-quantity').value = product.stock_quantity || 0;
document.getElementById('edit-price').value = product.price || 0;
document.getElementById('edit-harvest-date').value = product.harvest_date || '';
document.getElementById('edit-expiry-date').value = product.expiry_date || '';

// Populate Pre-orders tab fields
document.getElementById('edit-max-preorder_quantity').value = product.max_preorder_quantity || 0;
document.getElementById('edit-preorder-availability-date').value = product.preorder_availability_date || '';
document.getElementById('edit-reservation-cutoff-date').value = product.reservation_cutoff_date || '';

// Update reservation summary
document.getElementById('edit-reserved-count').textContent = `${product.reserved_quantity || 0} / ${product.max_preorder_quantity || 0}`;
const progressPercent = product.max_preorder_quantity > 0 
    ? (product.reserved_quantity / product.max_preorder_quantity) * 100 
    : 0;
document.getElementById('edit-reservation-progress').style.width = `${progressPercent}%`;
document.getElementById('edit-available-slots').textContent = `Available Slots: ${product.max_preorder_quantity - (product.reserved_quantity || 0)}`;

// Set active tab based on whether product has pre-order settings
const hasPreorder = product.max_preorder_quantity > 0;
if (hasPreorder) {
    // Activate Pre-orders tab
    document.querySelector('#edit-management-tabs button[data-bs-target="#edit-preorders-tab"]').click();
} else {
    // Activate Available Now tab
    document.querySelector('#edit-management-tabs button[data-bs-target="#edit-available-now-tab"]').click();
}
```

### Step 4: Commit

```bash
git add frontend/js/farmer.js
git commit -m "feat: update form handling for tabbed management in add/edit product"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
