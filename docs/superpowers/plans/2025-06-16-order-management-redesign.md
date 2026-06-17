# Order Management Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the order management section in farmer.html with a modern card-based layout, replacing the current table/list approach.

**Architecture:** Replace existing table-based order list with responsive card grid. Add new CSS classes for card styling. Update farmer.js renderOrders() method to generate card HTML instead of table rows. Preserve all existing functionality (search, filter, pagination, status changes).

**Tech Stack:** Bootstrap 5.3.3, Bootstrap Icons, existing agricatch-admin.css, page-scoped CSS in farmer.html

---

## File Structure

**Files to modify:**
- `frontend/farmer.html` - Replace orders section HTML (lines ~716-800), add CSS to `<style>` block
- `frontend/js/farmer.js` - Update renderOrders() method to render cards instead of table rows

---

### Task 1: Add CSS classes to farmer.html style block

**Files:**
- Modify: `frontend/farmer.html` - Add to `<style>` block (after line ~125)

- [ ] **Step 1: Add order grid CSS**

```css
/* Order Grid */
.orders-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
}
@media (min-width: 576px) {
  .orders-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 992px) {
  .orders-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

- [ ] **Step 2: Add order card CSS**

```css
/* Order Card */
.order-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: all 0.2s ease;
}
.order-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
```

- [ ] **Step 3: Add order card header CSS**

```css
/* Order Card Header */
.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.order-card-id {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}
.order-card-date {
  font-size: 0.75rem;
  color: #6b7280;
}
.order-card-status {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-weight: 600;
  text-transform: uppercase;
}
```

- [ ] **Step 4: Add order card product section CSS**

```css
/* Order Card Product */
.order-card-product {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.order-card-product-img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.order-card-product-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: #1a2e1e;
  flex: 1;
}
.order-card-product-qty {
  font-size: 0.75rem;
  color: #6b7280;
}
```

- [ ] **Step 5: Add order card customer section CSS**

```css
/* Order Card Customer */
.order-card-customer {
  margin-bottom: 0.75rem;
}
.order-card-customer-name {
  font-weight: 500;
  font-size: 0.875rem;
  color: #1a2e1e;
}
.order-card-customer-location {
  font-size: 0.75rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 6: Add order card pricing section CSS**

```css
/* Order Card Pricing */
.order-card-pricing {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 8px;
}
.order-card-unit-price {
  font-size: 0.75rem;
  color: #6b7280;
}
.order-card-total {
  font-size: 1rem;
  font-weight: 700;
  color: #2d7a3a;
}
```

- [ ] **Step 7: Add order card actions CSS**

```css
/* Order Card Actions */
.order-card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.order-card-actions .btn {
  flex: 1;
  min-width: 120px;
  font-size: 0.8rem;
  padding: 0.4rem 0.75rem;
}
```

- [ ] **Step 8: Add empty state CSS**

```css
/* Empty State */
.orders-empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
}
.orders-empty-state-icon {
  font-size: 3rem;
  color: #cbd5e1;
  margin-bottom: 1rem;
}
.orders-empty-state-text {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 9: Add status color classes**

```css
/* Status Colors */
.order-card-status.pending { background: #fef3c7; color: #d97706; }
.order-card-status.confirmed { background: #dbeafe; color: #2563eb; }
.order-card-status.preparing { background: #ede9fe; color: #7c3aed; }
.order-card-status.out_for_delivery { background: #cffafe; color: #0891b2; }
.order-card-status.delivered { background: #dcfce7; color: #16a34a; }
.order-card-status.cancelled { background: #fee2e2; color: #dc2626; }
```

- [ ] **Step 10: Commit CSS changes**

```bash
git add frontend/farmer.html
git commit -m "style: add CSS classes for order card layout"
```

---

### Task 2: Replace orders section HTML in farmer.html

**Files:**
- Modify: `frontend/farmer.html` - Replace orders section (starting at line ~716)

- [ ] **Step 1: Replace section header**

Find the existing orders section header (around line 718-729) and replace with:

```html
<section id="orders" class="admin-section-card">
    <div class="ac-section-hero ac-section-hero--primary mb-4">
        <div class="ac-section-hero__icon"><i class="bi bi-bag-check"></i></div>
        <div class="ac-section-hero__body">
            <h4 class="ac-section-hero__title">Order Management</h4>
            <p class="ac-section-hero__sub">View and manage customer orders for your products.</p>
        </div>
        <div class="ac-section-hero__actions">
            <button id="refresh-orders-btn" class="btn btn-outline-secondary btn-sm" type="button">
                <i class="bi bi-arrow-clockwise me-1"></i>Refresh
            </button>
            <button id="orders-export-btn" class="btn btn-outline-secondary btn-sm" type="button">
                <i class="bi bi-download me-1"></i>Export
            </button>
        </div>
    </div>
```

- [ ] **Step 2: Replace search and filter bar**

Replace the existing search bar (around line 730-748) with:

```html
    <div class="card">
        <div class="card-body">
            <div class="row g-2 mb-3">
                <div class="col-md-4 col-sm-6">
                    <label class="form-label small fw-semibold mb-1">Search</label>
                    <div class="input-group input-group-sm">
                        <input type="text" id="orders-search-input" class="form-control" 
                               placeholder="Order ID, product name, or customer…">
                        <button id="orders-search-btn" class="btn btn-ac-green" type="button">
                            <i class="bi bi-search"></i>
                        </button>
                    </div>
                </div>
                <div class="col-md-3 col-sm-6">
                    <label class="form-label small fw-semibold mb-1">Date Range</label>
                    <select id="orders-date-filter" class="form-select form-select-sm">
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>
                <div class="col-md-3 col-sm-6">
                    <label class="form-label small fw-semibold mb-1">Status</label>
                    <select id="orders-status-filter" class="form-select form-select-sm">
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>
```

- [ ] **Step 3: Replace tab navigation**

Replace the existing order tabs (around line 753-762) with:

```html
            <div class="order-tabs">
                <button id="pending-orders-tab" class="tab-btn active" type="button">Pending <span class="tab-count" id="pending-orders-count">0</span></button>
                <button id="confirmed-orders-tab" class="tab-btn" type="button">Confirmed <span class="tab-count" id="confirmed-orders-count">0</span></button>
                <button id="preparing-orders-tab" class="tab-btn" type="button">Preparing <span class="tab-count" id="preparing-orders-count">0</span></button>
                <button id="out_for_delivery-orders-tab" class="tab-btn" type="button">Out for Delivery <span class="tab-count" id="out_for_delivery-orders-count">0</span></button>
                <button id="delivered-orders-tab" class="tab-btn" type="button">Delivered <span class="tab-count" id="delivered-orders-count">0</span></button>
                <button id="cancelled-orders-tab" class="tab-btn" type="button">Cancelled <span class="tab-count" id="cancelled-orders-count">0</span></button>
            </div>
```

- [ ] **Step 4: Replace orders list with grid container**

Replace the existing orders list container (around line 763-779) with:

```html
            <div id="orders-grid" class="orders-grid">
                <div class="orders-empty-state">
                    <i class="bi bi-inbox orders-empty-state-icon"></i>
                    <p class="orders-empty-state-text">Loading orders...</p>
                </div>
            </div>
            <div id="orders-pagination" class="pagination-container mt-3"></div>
        </div>
    </div>
</section>
```

- [ ] **Step 5: Commit HTML changes**

```bash
git add frontend/farmer.html
git commit -m "feat: replace orders section with card grid layout"
```

---

### Task 3: Update farmer.js renderOrders() method to render cards

**Files:**
- Modify: `frontend/js/farmer.js` - Find and update renderOrders() method

- [ ] **Step 1: Locate renderOrders() method**

Search for `renderOrders` method in farmer.js (around line ~1800-1900). Read the current implementation to understand the data structure.

- [ ] **Step 2: Create helper function for status badge HTML**

Add this helper function inside the FarmerDashboard class:

```javascript
getOrderStatusBadge(status) {
    const statusMap = {
        pending: { class: 'pending', label: 'Pending' },
        confirmed: { class: 'confirmed', label: 'Confirmed' },
        preparing: { class: 'preparing', label: 'Preparing' },
        out_for_delivery: { class: 'out_for_delivery', label: 'Out for Delivery' },
        delivered: { class: 'delivered', label: 'Delivered' },
        cancelled: { class: 'cancelled', label: 'Cancelled' }
    };
    const config = statusMap[status] || { class: 'pending', label: status };
    return `<span class="order-card-status ${config.class}">${config.label}</span>`;
}
```

- [ ] **Step 3: Create helper function for action buttons**

Add this helper function inside the FarmerDashboard class:

```javascript
getOrderActionButtons(order) {
    const status = order.status;
    const orderId = order.id;
    
    if (status === 'pending') {
        return `
            <button class="btn btn-sm btn-success order-confirm-btn" data-order-id="${orderId}">
                <i class="bi bi-check-lg me-1"></i>Confirm
            </button>
            <button class="btn btn-sm btn-danger order-cancel-btn" data-order-id="${orderId}">
                <i class="bi bi-x-lg me-1"></i>Cancel
            </button>
        `;
    } else if (status === 'confirmed') {
        return `
            <button class="btn btn-sm btn-primary order-prepare-btn" data-order-id="${orderId}">
                <i class="bi bi-box-seam me-1"></i>Start Preparing
            </button>
        `;
    } else if (status === 'preparing') {
        return `
            <button class="btn btn-sm btn-info order-ship-btn" data-order-id="${orderId}">
                <i class="bi bi-truck me-1"></i>Mark as Out for Delivery
            </button>
        `;
    } else if (status === 'out_for_delivery') {
        return `
            <button class="btn btn-sm btn-success order-deliver-btn" data-order-id="${orderId}">
                <i class="bi bi-check-circle me-1"></i>Mark as Delivered
            </button>
        `;
    } else {
        return `
            <button class="btn btn-sm btn-secondary order-view-btn" data-order-id="${orderId}">
                <i class="bi bi-eye me-1"></i>View Details
            </button>
        `;
    }
}
```

- [ ] **Step 4: Update renderOrders() to generate card HTML**

Replace the table row generation in renderOrders() with card generation. The method should:

1. Clear the orders-grid container
2. If no orders, show empty state
3. For each order, generate card HTML using this template:

```javascript
const cardHtml = `
    <div class="order-card" data-order-id="${order.id}">
        <div class="order-card-header">
            <div>
                <div class="order-card-id">#${order.id}</div>
                <div class="order-card-date">${order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</div>
            </div>
            ${this.getOrderStatusBadge(order.status)}
        </div>
        <div class="order-card-product">
            <img src="${order.product_image || '/frontend/images/placeholder.jpg'}" 
                 alt="${order.product_name}" class="order-card-product-img">
            <div>
                <div class="order-card-product-name">${this.escapeHtml(order.product_name || '—')}</div>
                <div class="order-card-product-qty">Qty: ${order.quantity || 1}</div>
            </div>
        </div>
        <div class="order-card-customer">
            <div class="order-card-customer-name">${this.escapeHtml(order.customer_name || '—')}</div>
            <div class="order-card-customer-location">${this.escapeHtml(order.customer_location || '—')}</div>
        </div>
        <div class="order-card-pricing">
            <div class="order-card-unit-price">₱${this.fmtCurrency(order.price)} / unit</div>
            <div class="order-card-total">₱${this.fmtCurrency(order.total)}</div>
        </div>
        <div class="order-card-actions">
            ${this.getOrderActionButtons(order)}
        </div>
    </div>
`;
```

4. Append all cards to the grid container
5. Update pagination

- [ ] **Step 5: Update empty state handling**

When there are no orders for the current filter/tab, show:

```javascript
const emptyHtml = `
    <div class="orders-empty-state">
        <i class="bi bi-inbox orders-empty-state-icon"></i>
        <p class="orders-empty-state-text">No ${currentStatus} orders found</p>
    </div>
`;
```

- [ ] **Step 6: Commit JavaScript changes**

```bash
git add frontend/js/farmer.js
git commit -m "feat: update renderOrders() to use card layout"
```

---

### Task 4: Update event listeners for new action buttons

**Files:**
- Modify: `frontend/js/farmer.js` - Update event delegation in setupSidebarNavigation() or similar

- [ ] **Step 1: Add event listeners for order action buttons**

In the event delegation section (around line 69-80 in constructor or similar), add handlers for the new button classes:

```javascript
} else if (btn.matches('.order-confirm-btn')) {
    this.updateOrderStatus(Number(btn.dataset.orderId), 'confirmed');
} else if (btn.matches('.order-cancel-btn')) {
    this.updateOrderStatus(Number(btn.dataset.orderId), 'cancelled');
} else if (btn.matches('.order-prepare-btn')) {
    this.updateOrderStatus(Number(btn.dataset.orderId), 'preparing');
} else if (btn.matches('.order-ship-btn')) {
    this.updateOrderStatus(Number(btn.dataset.orderId), 'out_for_delivery');
} else if (btn.matches('.order-deliver-btn')) {
    this.updateOrderStatus(Number(btn.dataset.orderId), 'delivered');
} else if (btn.matches('.order-view-btn')) {
    this.openOrderDetails(Number(btn.dataset.orderId));
```

- [ ] **Step 2: Commit event listener changes**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add event listeners for order card action buttons"
```

---

### Task 5: Test responsive behavior

**Files:**
- No file changes - manual testing

- [ ] **Step 1: Test mobile view (<576px)**

Open farmer.html in browser, resize to mobile width. Verify:
- Orders grid shows 1 column
- Cards stack vertically
- All content is readable
- Action buttons are tappable

- [ ] **Step 2: Test tablet view (576px-992px)**

Resize to tablet width. Verify:
- Orders grid shows 2 columns
- Cards are properly spaced
- Layout is balanced

- [ ] **Step 3: Test desktop view (>992px)**

Resize to desktop width. Verify:
- Orders grid shows 3 columns
- Cards utilize horizontal space efficiently
- Hover effects work on cards

- [ ] **Step 4: Test tab switching**

Click each status tab. Verify:
- Correct orders display for each status
- Count badges update correctly
- Empty states show when no orders for a status

- [ ] **Step 5: Test search functionality**

Type in search input. Verify:
- Results filter correctly
- Empty state shows when no matches
- Clear search resets view

---

### Task 6: Final verification and cleanup

**Files:**
- Modify: `frontend/farmer.html`, `frontend/js/farmer.js`

- [ ] **Step 1: Verify all existing functionality still works**

Test:
- Order status changes via action buttons
- Pagination
- Search
- Tab navigation
- Refresh button

- [ ] **Step 2: Check for console errors**

Open browser dev tools, check for any JavaScript errors when:
- Loading orders page
- Switching tabs
- Clicking action buttons
- Searching

- [ ] **Step 3: Verify accessibility**

Check:
- All buttons have proper labels
- Keyboard navigation works
- Screen reader announces status badges
- Color contrast is sufficient

- [ ] **Step 4: Final commit**

```bash
git add frontend/farmer.html frontend/js/farmer.js
git commit -m "feat: complete order management card-based redesign"
```

---

## Self-Review

**Spec coverage:**
- Section header redesign ✓ (Task 2, Step 1)
- Search & filter bar ✓ (Task 2, Step 2)
- Tab navigation modernization ✓ (Task 2, Step 3)
- Order cards (grid layout) ✓ (Task 2, Step 4, Task 3)
- Empty states ✓ (Task 3, Step 5)
- Pagination ✓ (Task 3, Step 4)
- CSS classes ✓ (Task 1)
- JavaScript integration ✓ (Task 3, Task 4)

**Placeholder scan:** No placeholders found. All code is complete.

**Type consistency:** Status values match between CSS classes, helper functions, and action buttons. Order data structure is consistent throughout.
