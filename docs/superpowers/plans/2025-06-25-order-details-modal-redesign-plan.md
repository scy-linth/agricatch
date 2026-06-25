# Order Details Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the order details modal in `frontend/farmer.html` with a polished, agricultural-themed two-column layout that improves visual design, information hierarchy, UX, and mobile responsiveness.

**Architecture:** Keep the existing modal shell (`#order-details-modal`) and replace its inner markup with a two-column grid. Refactor `openOrderModal()` in `frontend/js/farmer.js` to generate the new content. Add scoped CSS in `frontend/farmer.html` for the agricultural theme, grid layout, and responsive behavior.

**Tech Stack:** HTML5, CSS3 (Bootstrap 5.3.3), vanilla JavaScript, Bootstrap Icons.

## Global Constraints
- Do not use git commands at any point in the implementation.
- Work only in the existing files: `frontend/farmer.html` and `frontend/js/farmer.js`.
- Maintain existing data source: `this.lastOrdersById`.
- Preserve existing action button generation via `this.getOrderActionButtons()`.
- Keep existing modal open/close mechanics (`#order-details-modal` with `.open` class).
- Use only existing utility methods (`this.escapeHtml`, `this.fmtCurrency`, `this.fmtNumber`, `this.getOrderStatusBadge`).
- No new dependencies or external libraries.
- Colors: primary green `#2d7a3a`, light green `#e8f5e9`, dark green `#1a2e1e`.

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/farmer.html` | Modal HTML shell and scoped CSS for the new two-column layout. |
| `frontend/js/farmer.js` | Refactor `openOrderModal()` to render the new modal content. |

## Task 1: Update Modal HTML and CSS in farmer.html

**Files:**
- Modify: `frontend/farmer.html:2947-2958`

**Interfaces:**
- Consumes: `#order-details-modal`, `.modal-content`, `.modal-header`, `#order-details-body`
- Produces: New modal inner structure with `.order-details-layout`, `.order-product-card`, `.order-info-card`, `.order-timeline`, and CSS for the layout.

**Steps:**

- [ ] **Step 1: Replace the order-details-modal HTML**

  Replace the existing `#order-details-modal` block with the new markup.

  ```html
  <!-- MODAL: ORDER DETAILS -->
  <div id="order-details-modal" class="modal">
      <div class="modal-content order-details-modal-content">
          <div class="modal-header order-details-modal-header">
              <h3><i class="bi bi-bag-check me-2 text-white"></i>Order #<span id="order-details-id" class="order-details-id">—</span></h3>
              <button class="close-btn order-details-close-btn" id="close-order-details-modal" aria-label="Close"><i class="bi bi-x-lg"></i></button>
          </div>
          <div id="order-details-body" class="order-details-body">
              <div class="order-details-loading">
                  <div class="order-skeleton order-skeleton-image"></div>
                  <div class="order-skeleton order-skeleton-title"></div>
                  <div class="order-skeleton order-skeleton-line"></div>
                  <div class="order-skeleton order-skeleton-line"></div>
              </div>
          </div>
          <div id="order-details-error" class="order-error-state" style="display:none;">
              <i class="bi bi-exclamation-circle"></i>
              <div class="fw-semibold">Unable to load order details</div>
              <p class="small">Please try refreshing orders.</p>
          </div>
      </div>
  </div>
  ```

- [ ] **Step 2: Add scoped CSS for the order details modal**

  Add the following CSS inside the existing `<style>` block in `frontend/farmer.html` (place near the existing `.modal` CSS).

  ```css
  /* Order Details Modal - Agricultural Theme */
  .order-details-modal-content {
      max-width: 800px;
      width: 95%;
      max-height: 90vh;
      border: 2px solid #2d7a3a;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
  }
  .order-details-modal-header {
      background: linear-gradient(135deg, #2d7a3a 0%, #1e5a2e 100%);
      color: #fff;
      border-bottom: none;
  }
  .order-details-modal-header h3 {
      color: #fff;
      font-size: 1.15rem;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
  }
  .order-details-modal-header .order-card-status {
      font-size: 0.75rem;
      padding: 0.35rem 0.75rem;
      border-radius: 50px;
      text-transform: capitalize;
      font-weight: 600;
      margin-left: auto;
      margin-right: 0.5rem;
  }
  .order-details-close-btn {
      color: #fff;
      background: transparent;
      border: none;
      font-size: 1.25rem;
      opacity: 0.9;
      transition: opacity 0.2s;
  }
  .order-details-close-btn:hover {
      opacity: 1;
      color: #fff;
  }
  .order-details-id {
      font-weight: 700;
  }
  .order-details-body {
      padding: 1.25rem;
      overflow-y: auto;
      max-height: calc(90vh - 58px);
      background: linear-gradient(180deg, #fff 0%, #f8fcf8 100%);
  }
  .order-details-layout {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 1.25rem;
  }
  .order-product-card,
  .order-info-card {
      background: #fff;
      border: 1px solid #e8f5e9;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
  }
  .order-product-card {
      background: #f0f7f0;
      border-color: #d4e8d4;
  }
  .order-card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #2d7a3a;
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
  }
  .order-card-header i {
      font-size: 1rem;
  }
  .order-product-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 0.75rem;
      background: #e8f5e9;
  }
  .order-product-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1a2e1e;
      margin-bottom: 0.25rem;
  }
  .order-product-category {
      display: inline-block;
      background: #2d7a3a;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 50px;
      margin-bottom: 0.75rem;
  }
  .order-price-row {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
  }
  .order-unit-price {
      font-size: 1.25rem;
      font-weight: 700;
      color: #2d7a3a;
  }
  .order-quantity {
      font-size: 0.9rem;
      color: #64748b;
  }
  .order-total-price {
      font-size: 1.4rem;
      font-weight: 800;
      color: #2d7a3a;
      margin-left: auto;
  }
  .order-product-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      font-size: 0.85rem;
  }
  .order-meta-item {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      color: #475569;
  }
  .order-meta-item i {
      color: #2d7a3a;
      margin-top: 0.15rem;
      font-size: 0.85rem;
  }
  .order-info-row {
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
  }
  .order-info-row:last-child {
      margin-bottom: 0;
  }
  .order-info-label {
      color: #64748b;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.1rem;
  }
  .order-info-value {
      color: #1a2e1e;
      font-weight: 500;
      word-break: break-word;
  }
  .order-verified-badge {
      color: #2d7a3a;
      margin-left: 0.25rem;
  }
  .order-timeline {
      position: relative;
      padding-left: 1.25rem;
  }
  .order-timeline::before {
      content: '';
      position: absolute;
      left: 0.35rem;
      top: 0.25rem;
      bottom: 0.25rem;
      width: 2px;
      background: #e8f5e9;
  }
  .order-timeline-item {
      position: relative;
      margin-bottom: 0.75rem;
  }
  .order-timeline-item:last-child {
      margin-bottom: 0;
  }
  .order-timeline-dot {
      position: absolute;
      left: -1.05rem;
      top: 0.25rem;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #cbd5e1;
      border: 2px solid #fff;
      box-shadow: 0 0 0 2px #e8f5e9;
  }
  .order-timeline-item.active .order-timeline-dot {
      background: #2d7a3a;
      box-shadow: 0 0 0 2px #2d7a3a;
  }
  .order-timeline-item.completed .order-timeline-dot {
      background: #2d7a3a;
  }
  .order-timeline-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #1a2e1e;
      margin-bottom: 0.05rem;
  }
  .order-timeline-time {
      font-size: 0.75rem;
      color: #64748b;
  }
  .order-actions .order-card-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
  }
  .order-actions .order-card-actions .btn {
      width: 100%;
      justify-content: center;
  }
  .order-skeleton {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: orderSkeletonShimmer 1.5s infinite;
      border-radius: 4px;
  }
  @keyframes orderSkeletonShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
  }
  .order-details-loading {
      padding: 1rem;
  }
  .order-skeleton-image {
      width: 100%;
      height: 200px;
      margin-bottom: 1rem;
  }
  .order-skeleton-title {
      width: 70%;
      height: 1.5rem;
      margin-bottom: 0.75rem;
  }
  .order-skeleton-line {
      width: 100%;
      height: 0.875rem;
      margin-bottom: 0.5rem;
  }
  .order-skeleton-line:nth-child(3) { width: 85%; }
  .order-skeleton-line:nth-child(4) { width: 60%; }
  .order-error-state {
      text-align: center;
      padding: 2rem;
      color: #64748b;
      display: none;
  }
  .order-error-state i {
      font-size: 2rem;
      color: #ef4444;
      margin-bottom: 0.75rem;
  }
  .order-empty-state {
      text-align: center;
      padding: 1.5rem;
      color: #64748b;
      font-size: 0.9rem;
  }
  /* Mobile responsive */
  @media (max-width: 767.98px) {
      .order-details-modal-content {
          max-width: 600px;
          width: 95%;
          max-height: 95vh;
      }
      .order-details-body {
          max-height: calc(95vh - 58px);
          padding: 1rem;
      }
      .order-details-layout {
          grid-template-columns: 1fr;
          gap: 1rem;
      }
      .order-product-image {
          height: 150px;
      }
      .order-product-meta {
          grid-template-columns: 1fr;
      }
      .order-price-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
      }
      .order-total-price {
          margin-left: 0;
      }
  }
  ```

**Verification:**
- Open `frontend/farmer.html` and search for `#order-details-modal`. Confirm the new markup and CSS are present.
- Verify no Bootstrap classes are broken and that the CSS selectors do not conflict with existing modal styles.

## Task 2: Refactor openOrderModal in farmer.js

**Files:**
- Modify: `frontend/js/farmer.js:8779-8872`

**Interfaces:**
- Consumes: `order` object from `this.lastOrdersById`, `this.getOrderStatusBadge()`, `this.getOrderActionButtons()`, `this.escapeHtml()`, `this.fmtCurrency()`, `this.fmtNumber()`
- Produces: Updated HTML string inside `#order-details-body`, modal opened with `.open` class.

**Steps:**

- [ ] **Step 1: Replace the openOrderModal function body**

  Replace the existing `openOrderModal(orderId)` function (lines 8779-8872) with the new implementation.

  ```javascript
  openOrderModal(orderId) {
      const order = this.lastOrdersById.get(Number(orderId));
      if (!order) {
          this.showMessage('Order details not loaded yet. Please refresh orders.', 'error');
          return;
      }

      const modal = document.getElementById('order-details-modal');
      const body = document.getElementById('order-details-body');
      if (!modal || !body) return;

      const item = (order.items && order.items[0]) || order;
      const currentStatus = item.status || order.status || 'pending';

      // Update header with order ID and status badge
      const headerId = document.getElementById('order-details-id');
      const header = document.querySelector('.order-details-modal-header');
      if (headerId) headerId.textContent = order.id;
      if (header) {
          const existingBadge = header.querySelector('.order-card-status');
          if (existingBadge) existingBadge.remove();
          const badge = document.createElement('span');
          badge.innerHTML = this.getOrderStatusBadge(currentStatus);
          header.appendChild(badge);
      }
      let productImage = item.image_url || order.product_image || '/images/logo.png';
      if (productImage && !productImage.startsWith('http') && !productImage.startsWith('/')) {
          productImage = '/' + productImage;
      }
      if (!productImage || productImage === 'null' || productImage === 'undefined') {
          productImage = '/images/logo.png';
      }
      const productName = item.product_name || order.product_name || 'Product';
      const productCategory = item.category_name || order.category_name || 'Uncategorized';
      const productUnit = item.unit || order.unit || 'kg';
      const quantity = item.quantity || order.quantity || 1;
      const price = Number(String(item.price || order.price || 0).replace(/[^\d.-]/g, '')) || 0;
      const totalAmount = Number(String(item.total_amount || order.total_amount || 0).replace(/[^\d.-]/g, '')) || 0;
      const customerName = String(order.customer_name || '—').trim();
      const customerEmail = String(order.customer_email || '—').trim();
      const customerPhone = String(order.customer_phone || '—').trim();
      const customerVerified = order.customer_is_verified === true;
      const deliveryAddress = String(order.delivery_address || '').trim();
      const specialInstructions = String(order.special_instructions || '').trim();
      const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified';
      const orderDate = order.created_at ? new Date(order.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const harvestDate = item.harvest_date || order.harvest_date || '';
      const expiryDate = item.expiry_date || order.expiry_date || '';
      const productLocation = String(item.location || order.location || '').trim();
      const customerRating = Number(order.customer_average_rating || 0);
      const customerReviewCount = Number(order.customer_total_ratings || 0);

      const productMeta = [];
      if (harvestDate) {
          const harvestDateObj = new Date(harvestDate);
          if (!Number.isNaN(harvestDateObj.getTime())) {
              productMeta.push(`
                  <div class="order-meta-item">
                      <i class="bi bi-calendar-check"></i>
                      <div>
                          <div class="order-info-label">Harvest Date</div>
                          <div class="order-info-value">${this.escapeHtml(harvestDateObj.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }))}</div>
                      </div>
                  </div>
              `);
          }
      }
      if (expiryDate) {
          const expiryDateObj = new Date(expiryDate);
          if (!Number.isNaN(expiryDateObj.getTime())) {
              productMeta.push(`
                  <div class="order-meta-item">
                      <i class="bi bi-clock-history"></i>
                      <div>
                          <div class="order-info-label">Best Before</div>
                          <div class="order-info-value">${this.escapeHtml(expiryDateObj.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }))}</div>
                      </div>
                  </div>
              `);
          }
      }
      if (productLocation) {
          productMeta.push(`
              <div class="order-meta-item">
                  <i class="bi bi-geo-alt"></i>
                  <div>
                      <div class="order-info-label">Location</div>
                      <div class="order-info-value">${this.escapeHtml(productLocation)}</div>
                  </div>
              </div>
          `);
      }
      productMeta.push(`
          <div class="order-meta-item">
              <i class="bi bi-box-seam"></i>
              <div>
                  <div class="order-info-label">Quantity</div>
                  <div class="order-info-value">${this.fmtNumber(quantity)} ${this.escapeHtml(productUnit)}</div>
              </div>
          </div>
      `);

      const customerRatingHtml = customerRating > 0 ? `
          <div class="order-info-row">
              <div class="order-info-label">Customer Rating</div>
              <div class="order-info-value">
                  <span class="text-warning">${'★'.repeat(Math.round(customerRating))}${'☆'.repeat(5 - Math.round(customerRating))}</span>
                  <span class="small text-muted">(${this.fmtNumber(customerReviewCount)})</span>
              </div>
          </div>
      ` : '';

      const statusSteps = this.buildOrderStatusTimeline(order, currentStatus);
      const timelineHtml = statusSteps.map((step) => `
          <div class="order-timeline-item ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}">
              <div class="order-timeline-dot"></div>
              <div class="order-timeline-title">${this.escapeHtml(step.title)}</div>
              <div class="order-timeline-time">${this.escapeHtml(step.time)}</div>
          </div>
      `).join('');

      body.innerHTML = `
          <div class="order-details-layout">
              <div class="order-details-left">
                  <div class="order-product-card">
                      <div class="order-card-header">
                          <i class="bi bi-basket"></i> Product
                      </div>
                      <img src="${this.escapeAttr(productImage)}" class="order-product-image" alt="${this.escapeAttr(productName)}" onerror="this.style.display='none'">
                      <div class="order-product-name">${this.escapeHtml(productName)}</div>
                      <span class="order-product-category">${this.escapeHtml(productCategory)}</span>
                      <div class="order-price-row">
                          <span class="order-unit-price">${this.fmtCurrency(price)}</span>
                          <span class="order-quantity">× ${this.fmtNumber(quantity)}</span>
                          <span class="order-total-price">${this.fmtCurrency(totalAmount)}</span>
                      </div>
                      <div class="order-product-meta">
                          ${productMeta.join('')}
                      </div>
                  </div>
              </div>
              <div class="order-details-right">
                  <div class="order-info-card">
                      <div class="order-card-header">
                          <i class="bi bi-person-circle"></i> Customer
                      </div>
                      <div class="order-info-row">
                          <div class="order-info-label">Name</div>
                          <div class="order-info-value">
                              ${this.escapeHtml(customerName)}
                              ${customerVerified ? '<i class="bi bi-check-circle-fill order-verified-badge" title="Verified Customer"></i>' : ''}
                          </div>
                      </div>
                      <div class="order-info-row">
                          <div class="order-info-label">Phone</div>
                          <div class="order-info-value">
                              ${customerPhone !== '—' ? `<a href="tel:${this.escapeHtml(customerPhone.replace(/\s/g, ''))}">${this.escapeHtml(customerPhone)}</a>` : this.escapeHtml(customerPhone)}
                          </div>
                      </div>
                      <div class="order-info-row">
                          <div class="order-info-label">Email</div>
                          <div class="order-info-value">
                              ${customerEmail !== '—' ? `<a href="mailto:${this.escapeHtml(customerEmail)}">${this.escapeHtml(customerEmail)}</a>` : this.escapeHtml(customerEmail)}
                          </div>
                      </div>
                      ${customerRatingHtml}
                  </div>
                  <div class="order-info-card">
                      <div class="order-card-header">
                          <i class="bi bi-truck"></i> Delivery
                      </div>
                      <div class="order-info-row">
                          <div class="order-info-label">Address</div>
                          <div class="order-info-value">${this.escapeHtml(deliveryAddress || 'Not specified')}</div>
                      </div>
                      <div class="order-info-row">
                          <div class="order-info-label">Delivery Date</div>
                          <div class="order-info-value">${this.escapeHtml(deliveryDate)}</div>
                      </div>
                      ${specialInstructions ? `
                      <div class="order-info-row">
                          <div class="order-info-label">Special Instructions</div>
                          <div class="order-info-value fst-italic text-muted">${this.escapeHtml(specialInstructions)}</div>
                      </div>
                      ` : ''}
                  </div>
                  <div class="order-info-card">
                      <div class="order-card-header">
                          <i class="bi bi-clock-history"></i> Status Timeline
                      </div>
                      <div class="order-timeline">
                          ${timelineHtml}
                      </div>
                  </div>
                  <div class="order-info-card order-actions">
                      <div class="order-card-header">
                          <i class="bi bi-gear"></i> Actions
                      </div>
                      <div class="order-card-actions">
                          ${this.getOrderActionButtons({ id: order.id, status: currentStatus })}
                      </div>
                  </div>
              </div>
          </div>
      `;

      modal.classList.add('open');
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');
  }

  closeOrderDetailsModal() {
      const modal = document.getElementById('order-details-modal');
      if (modal) modal.classList.remove('open');
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
  }
  ```

- [ ] **Step 2: Update close handlers in farmer.js**

  Find the existing close handlers around `frontend/js/farmer.js:1672-1682` and replace them with handlers that call the new `closeOrderDetailsModal()` method.

  ```javascript
  // Order details modal close button
  document.getElementById('close-order-details-modal')?.addEventListener('click', () => {
      this.closeOrderDetailsModal();
  });

  // Close modal on backdrop click
  document.getElementById('order-details-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'order-details-modal') {
          this.closeOrderDetailsModal();
      }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
          const modal = document.getElementById('order-details-modal');
          if (modal && modal.classList.contains('open')) {
              this.closeOrderDetailsModal();
          }
      }
  });
  ```

- [ ] **Step 3: Add the helper method buildOrderStatusTimeline**

  Add the new helper method right after `closeOrderDetailsModal()` (before `getStatusColor()`). This method generates the status timeline steps.

  ```javascript
  buildOrderStatusTimeline(order, currentStatus) {
      const statusOrder = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
      const orderDate = order.created_at ? new Date(order.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const scheduledDate = order.scheduled_delivery_date ? new Date(order.scheduled_delivery_date).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
      const deliveredDate = order.delivered_at ? new Date(order.delivered_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

      // Map order statuses to timeline steps
      let steps = [];
      if (currentStatus === 'preorder_reserved') {
          steps = [
              { title: 'Order Placed', time: orderDate, status: 'pending' },
              { title: 'Pre-order Reserved', time: 'Reserved for pre-order', status: 'preorder_reserved' }
          ];
      } else if (currentStatus === 'scheduled') {
          steps = [
              { title: 'Order Placed', time: orderDate, status: 'pending' },
              { title: 'Confirmed', time: 'Waiting for confirmation', status: 'confirmed' },
              { title: 'Scheduled', time: scheduledDate || 'Delivery scheduled', status: 'scheduled' }
          ];
      } else {
          steps = [
              { title: 'Order Placed', time: orderDate, status: 'pending' },
              { title: 'Confirmed', time: 'Waiting for confirmation', status: 'confirmed' },
              { title: 'Preparing', time: 'Getting ready for delivery', status: 'preparing' },
              { title: 'Out for Delivery', time: scheduledDate || 'Scheduled', status: 'out_for_delivery' },
              { title: 'Delivered', time: deliveredDate || 'Pending', status: 'delivered' }
          ];
      }

      const currentIndex = statusOrder.indexOf(currentStatus);
      return steps.map((step, index) => {
          const stepIndex = statusOrder.indexOf(step.status);
          const isActive = step.status === currentStatus;
          // For special statuses (preorder_reserved, scheduled) not in statusOrder,
          // use position within the custom steps array to determine completion
          const isCompleted = (currentIndex >= 0 && stepIndex < currentIndex && currentStatus !== 'cancelled') ||
                              (currentIndex === -1 && index < steps.findIndex(s => s.status === currentStatus) && currentStatus !== 'cancelled');
          let time = step.time;
          if (isCompleted) {
              if (step.status === 'confirmed' && order.confirmed_at) time = new Date(order.confirmed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              if (step.status === 'preparing' && order.prepared_at) time = new Date(order.prepared_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              if (step.status === 'out_for_delivery' && order.out_for_delivery_at) time = new Date(order.out_for_delivery_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          }
          if (currentStatus === 'cancelled') {
              if (step.status === 'pending') return { title: 'Order Placed', time: orderDate, completed: true, active: false };
              if (step.status === 'confirmed') return { title: 'Order Cancelled', time: order.cancelled_at ? new Date(order.cancelled_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Cancelled', completed: false, active: true };
              return { title: step.title, time: '—', completed: false, active: false };
          }
          return { title: step.title, time, completed: isCompleted, active: isActive };
      });
  }
  ```

**Verification:**
- Save the file and run a syntax check in the browser console or with `node -c frontend/js/farmer.js` (if Node.js available).
- Open the farmer dashboard in a browser, navigate to an order card, click it, and verify the new modal layout appears.
- Confirm that customer phone/email are clickable, the status timeline shows correctly, and action buttons work.
- Confirm that clicking the close button, backdrop, or pressing Escape closes the modal and removes the body scroll lock.
- Confirm the status badge in the header uses the correct status color (not white/green).

## Task 3: Verification and Edge Cases

**Files:**
- Test: manual in browser

**Steps:**

- [ ] **Step 1: Verify the modal works for each order status**
  - Open orders in statuses: pending, confirmed, preparing, out_for_delivery, delivered, cancelled
  - Confirm the timeline and action buttons match each status
  - Check that cancelled orders show "Order Placed" and "Order Cancelled" only

- [ ] **Step 2: Verify mobile responsiveness**
  - Open browser DevTools and set viewport width to 375px
  - Confirm the modal is 95% width, the two-column grid collapses to one column, and the product image is 150px tall
  - Scroll through the modal and confirm all content is readable

- [ ] **Step 3: Verify missing data handling**
  - Open an order with minimal data (no customer email/phone, no delivery address, no harvest/expiry dates)
  - Confirm the modal still renders with fallback values ('—', 'Not specified') and no JavaScript errors

- [ ] **Step 4: Verify action buttons still function**
  - Click each action button in the modal and confirm the existing handlers (confirm, prepare, schedule delivery, deliver, cancel, rate customer) still work
  - Confirm clicking outside the modal or the close button closes it

- [ ] **Step 5: Verify search and card click still work**
  - Confirm the order management search still works (button click or Enter key)
  - Confirm clicking order cards still opens the modal
  - Confirm clicking action buttons inside the order card does not open the modal

**Success Criteria:**
- Modal displays product as hero, customer/delivery/status/action cards on the right
- Agricultural theme is consistent (green gradients, icons)
- Mobile view stacks into single column
- No console errors when opening or closing the modal
- All action buttons remain functional
- Missing data is handled gracefully
