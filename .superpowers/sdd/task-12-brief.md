# Task 12: Add Event Listeners for New Actions in farmer.js

## Files
- Modify: `frontend/js/farmer.js`

## Interfaces
- Consumes: HTML elements from Task 8 (confirmation modals) and Task 7 (action buttons)
- Produces: Event listeners for harvest, convert, disable actions and confirmation modals

## Steps

### Step 1: Add event listeners for confirmation modal buttons

Add event listeners in the event listener setup section (around line 1289):

```javascript
// Harvest confirmation modal
document.getElementById('close-harvest-confirm-modal')?.addEventListener('click', () => {
    document.getElementById('harvest-confirm-modal').classList.remove('open');
});
document.getElementById('cancel-harvest-btn')?.addEventListener('click', () => {
    document.getElementById('harvest-confirm-modal').classList.remove('open');
});
document.getElementById('confirm-harvest-btn')?.addEventListener('click', () => {
    const productId = document.getElementById('confirm-harvest-btn').dataset.productId;
    if (productId) {
        this.handleHarvestPreorder(productId);
    }
    document.getElementById('harvest-confirm-modal').classList.remove('open');
});

// Convert confirmation modal
document.getElementById('close-convert-confirm-modal')?.addEventListener('click', () => {
    document.getElementById('convert-confirm-modal').classList.remove('open');
});
document.getElementById('cancel-convert-btn')?.addEventListener('click', () => {
    document.getElementById('convert-confirm-modal').classList.remove('open');
});
document.getElementById('confirm-convert-btn')?.addEventListener('click', () => {
    const productId = document.getElementById('confirm-convert-btn').dataset.productId;
    if (productId) {
        this.handleConvertPreorder(productId);
    }
    document.getElementById('convert-confirm-modal').classList.remove('open');
});

// Disable confirmation modal
document.getElementById('close-disable-confirm-modal')?.addEventListener('click', () => {
    document.getElementById('disable-confirm-modal').classList.remove('open');
});
document.getElementById('cancel-disable-btn')?.addEventListener('click', () => {
    document.getElementById('disable-confirm-modal').classList.remove('open');
});
document.getElementById('confirm-disable-btn')?.addEventListener('click', () => {
    const productId = document.getElementById('confirm-disable-btn').dataset.productId;
    if (productId) {
        this.handleDisableProduct(productId);
    }
    document.getElementById('disable-confirm-modal').classList.remove('open');
});
```

### Step 2: Add event listeners for action buttons in product list

Add event listeners for the new action buttons (delegated event listener on product table):

```javascript
// Event delegation for product action buttons
document.addEventListener('click', (e) => {
    // Harvest button
    const harvestBtn = e.target.closest('.btn-action-harvest');
    if (harvestBtn) {
        const productId = harvestBtn.dataset.productId;
        if (productId) {
            document.getElementById('confirm-harvest-btn').dataset.productId = productId;
            document.getElementById('harvest-confirm-modal').classList.add('open');
        }
        return;
    }

    // Convert button
    const convertBtn = e.target.closest('.btn-action-convert');
    if (convertBtn) {
        const productId = convertBtn.dataset.productId;
        if (productId) {
            document.getElementById('confirm-convert-btn').dataset.productId = productId;
            document.getElementById('convert-confirm-modal').classList.add('open');
        }
        return;
    }

    // Disable button
    const disableBtn = e.target.closest('.btn-action-disable');
    if (disableBtn) {
        const productId = disableBtn.dataset.productId;
        if (productId) {
            document.getElementById('confirm-disable-btn').dataset.productId = productId;
            document.getElementById('disable-confirm-modal').classList.add('open');
        }
        return;
    }
});
```

### Step 3: Add event listeners for edit modal action buttons

Add event listeners for the edit modal action buttons:

```javascript
// Edit modal action buttons
document.getElementById('edit-harvest-now-btn')?.addEventListener('click', () => {
    const productId = document.getElementById('edit-product-id').value;
    if (productId) {
        document.getElementById('confirm-harvest-btn').dataset.productId = productId;
        document.getElementById('harvest-confirm-modal').classList.add('open');
    }
});

document.getElementById('edit-convert-inventory-btn')?.addEventListener('click', () => {
    const productId = document.getElementById('edit-product-id').value;
    if (productId) {
        document.getElementById('confirm-convert-btn').dataset.productId = productId;
        document.getElementById('convert-confirm-modal').classList.add('open');
    }
});

document.getElementById('edit-disable-product-btn')?.addEventListener('click', () => {
    const productId = document.getElementById('edit-product-id').value;
    if (productId) {
        document.getElementById('confirm-disable-btn').dataset.productId = productId;
        document.getElementById('disable-confirm-modal').classList.add('open');
    }
});

document.getElementById('edit-disable-product-preorder-btn')?.addEventListener('click', () => {
    const productId = document.getElementById('edit-product-id').value;
    if (productId) {
        document.getElementById('confirm-disable-btn').dataset.productId = productId;
        document.getElementById('disable-confirm-modal').classList.add('open');
    }
});
```

### Step 4: Commit

```bash
git add frontend/js/farmer.js
git commit -m "feat: add event listeners for harvest, convert, and disable actions"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
