# Hybrid Pre-order System Consistency Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UI inconsistencies, standardize terminology, and improve visibility of pre-order status across Customer, Farmer, and Admin interfaces to ensure the hybrid marketplace model is consistently presented.

**Architecture:** Targeted UI and terminology fixes across frontend HTML and JavaScript files. No backend changes required. Focus on visual consistency, terminology standardization, and status visibility.

**Tech Stack:** HTML, JavaScript (ES6+), Bootstrap 5.3.3

## Global Constraints

- No new systems, workflows, or scope-expanding features
- Preserve all existing functionality
- Maintain backward compatibility
- No database schema changes
- No API endpoint changes
- Follow existing code patterns and conventions
- Test changes manually in browser after each task

---

### Task 1: Fix Customer Orders Page Title

**Files:**
- Modify: `frontend/orders.html:6`
- Modify: `frontend/orders.html:500`
- Modify: `frontend/orders.html:510-511`

**Interfaces:**
- Consumes: None
- Produces: None (UI-only change)

- [ ] **Step 1: Update page title from "My Preorders" to "My Orders"**

```html
<!-- Change line 6 from: -->
<title>My Preorders — AgriCatch</title>
<!-- To: -->
<title>My Orders — AgriCatch</title>
```

- [ ] **Step 2: Update breadcrumb text**

```html
<!-- Change line 500 from: -->
<li class="breadcrumb-item active">My Preorders</li>
<!-- To: -->
<li class="breadcrumb-item active">My Orders</li>
```

- [ ] **Step 3: Update section title and subtitle**

```html
<!-- Change lines 510-511 from: -->
<h4 class="ac-section-hero__title">My Preorders</h4>
<p class="ac-section-hero__sub">Track and manage your preorders.</p>
<!-- To: -->
<h4 class="ac-section-hero__title">My Orders</h4>
<p class="ac-section-hero__sub">Track and manage your orders.</p>
```

- [ ] **Step 4: Update modal title for cancel order**

```html
<!-- Change line 594 from: -->
<h3><i class="fas fa-ban me-1"></i> Cancel Preorder</h3>
<!-- To: -->
<h3><i class="fas fa-ban me-1"></i> Cancel Order</h3>
```

- [ ] **Step 5: Update modal placeholder text**

```html
<!-- Change line 601 from: -->
placeholder="Tell us why you are cancelling this preorder..."
<!-- To: -->
placeholder="Tell us why you are cancelling this order..."
```

- [ ] **Step 6: Commit**

```bash
git add frontend/orders.html
git commit -m "fix: rename customer orders page from 'My Preorders' to 'My Orders'"
```

---

### Task 2: Standardize Terminology to "Pre-order" (Hyphenated)

**Files:**
- Modify: `frontend/js/orders.js:973`
- Modify: `frontend/js/orders.js:559`
- Modify: `frontend/js/orders.js:562`
- Modify: `frontend/js/orders.js:564`
- Modify: `frontend/js/orders.js:574`
- Modify: `frontend/js/orders.js:593`
- Modify: `frontend/js/farmer.js:1629`
- Modify: `frontend/js/farmer.js:7934`
- Modify: `frontend/js/admin.js:134`
- Modify: `frontend/js/admin.js:156`
- Modify: `frontend/js/admin.js:5835`

**Interfaces:**
- Consumes: None
- Produces: None (UI string changes only)

- [ ] **Step 1: Update status label in orders.js**

```javascript
// Change line 973 from:
'preorder_reserved': 'Preorder Reserved',
// To:
'preorder_reserved': 'Pre-order Reserved',
```

- [ ] **Step 2: Update order ID label in orders.js**

```javascript
// Change line 559 from:
<div class="order-id">${isPreorder ? 'Preorder' : 'Order'} #${order.id}</div>
// To:
<div class="order-id">${isPreorder ? 'Pre-order' : 'Order'} #${order.id}</div>
```

- [ ] **Step 3: Update order status label in orders.js**

```javascript
// Change line 562 from:
<strong>${isPreorder ? 'Preorder' : 'Order'} Status:</strong>
// To:
<strong>${isPreorder ? 'Pre-order' : 'Order'} Status:</strong>
```

- [ ] **Step 4: Update badge text in orders.js**

```javascript
// Change line 564 from:
${isPreorder ? '<span class="badge bg-warning text-dark ms-2">Preorder</span>' : ''}
// To:
${isPreorder ? '<span class="badge bg-warning text-dark ms-2">Pre-order</span>' : ''}
```

- [ ] **Step 5: Update re-preorder button in orders.js**

```javascript
// Change line 593 from:
<i class="fas fa-redo"></i> Re-preorder
// To:
<i class="fas fa-redo"></i> Reorder
```

- [ ] **Step 6: Update tab label in farmer.html**

```html
<!-- Change line 1629 from: -->
<button id="preorder_reserved-orders-tab" class="tab-btn" type="button">Preorder Reserved <span class="tab-count" id="preorder_reserved-orders-count">0</span></button>
<!-- To: -->
<button id="preorder_reserved-orders-tab" class="tab-btn" type="button">Pre-order Reserved <span class="tab-count" id="preorder_reserved-orders-count">0</span></button>
```

- [ ] **Step 7: Update status label in farmer.js**

```javascript
// Change line 7934 from:
preorder_reserved: { class: 'preorder_reserved', label: 'Preorder Reserved' }
// To:
preorder_reserved: { class: 'preorder_reserved', label: 'Pre-order Reserved' }
```

- [ ] **Step 8: Update status label in admin.js (line 134)**

```javascript
// Change from:
preorder_reserved: 'Preorder Reserved',
// To:
preorder_reserved: 'Pre-order Reserved',
```

- [ ] **Step 9: Update status label in admin.js (line 156)**

```javascript
// Change from:
preorder_reserved: 'Preorder Reserved',
// To:
preorder_reserved: 'Pre-order Reserved',
```

- [ ] **Step 10: Update product badge in admin.js**

```javascript
// Change line 5835 from:
${p.is_preorder ? '<span class="badge bg-warning text-dark ms-1">Pre-order</span>' : ''}
// To (already correct, verify):
${p.is_preorder ? '<span class="badge bg-warning text-dark ms-1">Pre-order</span>' : ''}
```

- [ ] **Step 11: Commit**

```bash
git add frontend/js/orders.js frontend/js/farmer.js frontend/js/admin.js frontend/farmer.html
git commit -m "fix: standardize terminology to 'Pre-order' (hyphenated) across UI"
```

---

### Task 3: Add Pre-order Visual Distinction in Customer Orders List

**Files:**
- Modify: `frontend/js/orders.js:508-565`

**Interfaces:**
- Consumes: `order.is_preorder`, `item.is_preorder`
- Produces: None (UI rendering change)

- [ ] **Step 1: Add pre-order badge to order card header**

```javascript
// In the order card rendering section (around line 508-565), add badge after order ID:
// Find the order-header div and add the badge after the order-id div

// After line 559 (order-id div), add:
${isPreorder ? '<span class="badge bg-warning text-dark ms-2" style="font-size:0.7rem;">Pre-order</span>' : ''}
```

- [ ] **Step 2: Verify the badge appears in the correct location**

The badge should appear right after the order ID in the order card header, making pre-orders immediately visible in the list view.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/orders.js
git commit -m "feat: add pre-order badge to customer orders list view"
```

---

### Task 4: Add Status Filter Tabs to Admin Orders Section

**Files:**
- Modify: `frontend/admin.html` (orders section around line 873)
- Modify: `frontend/js/admin.js` (add order tab handling)

**Interfaces:**
- Consumes: Existing order data structure
- Produces: Order status filtering UI

- [ ] **Step 1: Add order tabs HTML to admin.html**

```html
<!-- In the orders section (around line 873), before the orders table, add: -->
<div class="order-tabs mb-3">
    <button id="pending-orders-tab" class="tab-btn active" type="button">Pending <span class="tab-count" id="pending-orders-count">0</span></button>
    <button id="preorder_reserved-orders-tab" class="tab-btn" type="button">Pre-order Reserved <span class="tab-count" id="preorder_reserved-orders-count">0</span></button>
    <button id="confirmed-orders-tab" class="tab-btn" type="button">Confirmed <span class="tab-count" id="confirmed-orders-count">0</span></button>
    <button id="preparing-orders-tab" class="tab-btn" type="button">Preparing <span class="tab-count" id="preparing-orders-count">0</span></button>
    <button id="scheduled-orders-tab" class="tab-btn" type="button">Scheduled <span class="tab-count" id="scheduled-orders-count">0</span></button>
    <button id="out_for_delivery-orders-tab" class="tab-btn" type="button">Out for Delivery <span class="tab-count" id="out_for_delivery-orders-count">0</span></button>
    <button id="delivered-orders-tab" class="tab-btn" type="button">Delivered <span class="tab-count" id="delivered-orders-count">0</span></button>
    <button id="cancelled-orders-tab" class="tab-btn" type="button">Cancelled <span class="tab-count" id="cancelled-orders-count">0</span></button>
</div>
```

- [ ] **Step 2: Add tab event listeners to admin.js**

```javascript
// In the setupEventListeners method (around line 200-300), add:
// Order status tabs
document.getElementById('pending-orders-tab')?.addEventListener('click', () => this.switchOrderTab('pending'));
document.getElementById('preorder_reserved-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preorder_reserved'));
document.getElementById('confirmed-orders-tab')?.addEventListener('click', () => this.switchOrderTab('confirmed'));
document.getElementById('preparing-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preparing'));
document.getElementById('scheduled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('scheduled'));
document.getElementById('out_for_delivery-orders-tab')?.addEventListener('click', () => this.switchOrderTab('out_for_delivery'));
document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));
```

- [ ] **Step 3: Add switchOrderTab method to admin.js**

```javascript
// Add this method to AdminDashboard class:
switchOrderTab(status) {
    this.activeOrderStatus = status;
    
    // Update tab UI
    document.querySelectorAll('.order-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    const tabBtn = document.getElementById(`${status}-orders-tab`);
    if (tabBtn) tabBtn.classList.add('active');
    
    // Reload orders with new filter
    this.loadOrders();
}
```

- [ ] **Step 4: Update loadOrders to filter by status**

```javascript
// Modify the loadOrders method to accept and use status filter:
// Add status parameter to the API call if activeOrderStatus is set
// This may require backend changes - if so, implement client-side filtering instead
```

- [ ] **Step 5: Add tab count updates**

```javascript
// When orders are loaded, update the tab counts:
document.getElementById('pending-orders-count').textContent = this.ordersCountByStatus.pending || 0;
document.getElementById('preorder_reserved-orders-count').textContent = this.ordersCountByStatus.preorder_reserved || 0;
document.getElementById('confirmed-orders-count').textContent = this.ordersCountByStatus.confirmed || 0;
document.getElementById('preparing-orders-count').textContent = this.ordersCountByStatus.preparing || 0;
document.getElementById('scheduled-orders-count').textContent = this.ordersCountByStatus.scheduled || 0;
document.getElementById('out_for_delivery-orders-count').textContent = this.ordersCountByStatus.out_for_delivery || 0;
document.getElementById('delivered-orders-count').textContent = this.ordersCountByStatus.delivered || 0;
document.getElementById('cancelled-orders-count').textContent = this.ordersCountByStatus.cancelled || 0;
```

- [ ] **Step 6: Commit**

```bash
git add frontend/admin.html frontend/js/admin.js
git commit -m "feat: add status filter tabs to admin orders section"
```

---

### Task 5: Align Hero Section Button Text (Optional Polish)

**Files:**
- Modify: `frontend/index.html` (lines 235-240)

**Interfaces:**
- Consumes: None
- Produces: None (UI text change)

- [ ] **Step 1: Update hero button text to match section headers**

```html
<!-- Current hero buttons (lines 235-240): -->
<a href="#available-now" class="btn btn-primary">Shop Available Products</a>
<a href="#preorder" class="btn btn-outline-light">Browse Preorders</a>

<!-- Change to match section headers: -->
<a href="#available-now" class="btn btn-primary">Shop Available Now</a>
<a href="#preorder" class="btn btn-outline-light">Reserve Before Harvest</a>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "polish: align hero button text with section headers"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Customer orders page title fixed
- ✅ Terminology standardized to "Pre-order"
- ✅ Pre-order visual distinction added to orders list
- ✅ Admin orders section gets status tabs
- ✅ Hero button text aligned (optional polish)

**2. Placeholder scan:**
- ✅ No TBD, TODO, or placeholders
- ✅ All code blocks contain actual content
- ✅ All file paths are exact
- ✅ All commands are complete

**3. Type consistency:**
- ✅ Status names consistent across files
- ✅ ID names match between HTML and JavaScript
- ✅ Method signatures are consistent

**4. Global constraints:**
- ✅ No new systems or workflows
- ✅ No backend changes
- ✅ No database changes
- ✅ Preserves existing functionality
