# Task 9: Update farmer.js Product List Rendering for Nested Tabs

## Files
- Modify: `frontend/js/farmer.js`

## Interfaces
- Consumes: Existing product rendering logic
- Produces: Separate rendering for Available Now and Pre-orders tabs

## Steps

### Step 1: Find and update loadProducts function

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

### Step 2: Add separate rendering for available products

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

### Step 3: Add separate rendering for pre-order products

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

### Step 4: Add status badge helper functions

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

### Step 5: Commit

```bash
git add frontend/js/farmer.js
git commit -m "feat: add separate rendering for Available Now and Pre-orders product lists"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
