# Task 11: Add API Call Handlers for New Actions in farmer.js

## Files
- Modify: `frontend/js/farmer.js`

## Interfaces
- Consumes: Backend API endpoints from Tasks 1 and 2
- Produces: API call handler functions for harvest, convert, and disable actions

## Steps

### Step 1: Add harvest pre-order API handler

Add a function to call the harvest-preorder endpoint:

```javascript
async handleHarvestPreorder(productId) {
    try {
        const response = await fetch(`${this.apiBase}/products/${productId}/harvest-preorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            this.showMessage('Pre-order inventory harvested successfully!', 'success');
            this.loadMyProducts();
            this.loadFarmerStats();
        } else {
            this.showMessage(data.message || 'Failed to harvest pre-order inventory', 'error');
        }
    } catch (error) {
        console.error('Error harvesting pre-order:', error);
        this.showMessage('Error harvesting pre-order inventory', 'error');
    }
}
```

### Step 2: Add convert pre-order API handler

Add a function to call the convert-preorder endpoint:

```javascript
async handleConvertPreorder(productId) {
    try {
        const response = await fetch(`${this.apiBase}/products/${productId}/convert-preorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            this.showMessage('Remaining pre-order inventory converted successfully!', 'success');
            this.loadMyProducts();
            this.loadFarmerStats();
        } else {
            this.showMessage(data.message || 'Failed to convert pre-order inventory', 'error');
        }
    } catch (error) {
        console.error('Error converting pre-order:', error);
        this.showMessage('Error converting pre-order inventory', 'error');
    }
}
```

### Step 3: Add disable product API handler

Add a function to disable a product:

```javascript
async handleDisableProduct(productId) {
    try {
        const response = await fetch(`${this.apiBase}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_available: false })
        });

        const data = await response.json();

        if (response.ok) {
            this.showMessage('Product disabled successfully!', 'success');
            this.loadMyProducts();
            this.loadFarmerStats();
        } else {
            this.showMessage(data.message || 'Failed to disable product', 'error');
        }
    } catch (error) {
        console.error('Error disabling product:', error);
        this.showMessage('Error disabling product', 'error');
    }
}
```

### Step 4: Commit

```bash
git add frontend/js/farmer.js
git commit -m "feat: add API call handlers for harvest, convert, and disable actions"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
