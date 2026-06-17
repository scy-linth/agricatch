# Order Management Redesign - Card-Based Layout

## Overview
Rebuild the order management section in `frontend/farmer.html` with a modern card-based layout, replacing the current table/list approach. This improves visual scanning, mobile responsiveness, and overall UX for farmers managing customer orders.

## Design System
- Bootstrap 5.3.3
- Bootstrap Icons
- agricatch-admin.css (existing)
- Page-scoped CSS in `<style>` block for new components
- Primary color: `#2d7a3a` (green)
- Secondary colors: Status-based (pending: orange, confirmed: blue, preparing: purple, out_for_delivery: cyan, delivered: green, cancelled: red)

## Section Structure

### 1. Section Header
- Keep existing hero section with "Order Management" title
- Add subtle gradient background matching products section
- Add "Export Orders" button alongside Refresh
- Icons: `bi-bag-check` for section icon

### 2. Search & Filter Bar
- Horizontal layout with search input on left
- Date range filter dropdown (Today, This Week, This Month, Custom)
- Status filter dropdown (All, Pending, Confirmed, Preparing, Out for Delivery, Delivered, Cancelled)
- Modern input styling with focus states
- Bootstrap Icons: `bi-search`, `bi-calendar`, `bi-funnel`

### 3. Tab Navigation
- Keep existing status tabs with IDs: `pending-orders-tab`, `confirmed-orders-tab`, `preparing-orders-tab`, `out_for_delivery-orders-tab`, `delivered-orders-tab`, `cancelled-orders-tab`
- Pill-shaped buttons with rounded corners
- Active state: filled with primary color, white text
- Inactive state: outlined, muted text
- Count badges: red background, white text, hidden when zero
- IDs for counts: `pending-orders-count`, `confirmed-orders-count`, etc.
- Smooth CSS transitions on hover and active states

### 4. Order Cards (Grid Layout)
- Responsive grid using Bootstrap grid system:
  - Mobile (<576px): 1 column
  - Tablet (576px-992px): 2 columns
  - Desktop (>992px): 3 columns
- Container ID: `orders-grid`

#### Card Structure
Each order card contains:

**Header:**
- Order ID (small, muted text, top-left)
- Order date (small, muted text, top-right)
- Status badge (top-right, pill-shaped, color-coded)

**Product Section:**
- Thumbnail image (left, 60x60px, rounded corners)
- Product name (bold, left-aligned)
- Quantity (small, muted, right-aligned)

**Customer Section:**
- Customer name (medium weight)
- Location preview (small, muted, truncated with ellipsis)

**Pricing Section:**
- Unit price (small, muted)
- Total price (highlighted, larger, bold)

**Actions Section:**
- Status-dependent action buttons:
  - Pending: "Confirm Order" (primary), "Cancel" (danger)
  - Confirmed: "Start Preparing" (primary)
  - Preparing: "Mark as Out for Delivery" (primary)
  - Out for Delivery: "Mark as Delivered" (primary)
  - Delivered: "View Details" (secondary)
  - Cancelled: "View Details" (secondary)

#### Card Styling
- White background
- Subtle box-shadow: `0 2px 8px rgba(0,0,0,0.08)`
- Rounded corners: 12px
- Padding: 1rem
- Hover effect: slight lift (transform translateY -2px), increased shadow
- Border: 1px solid `#e2e8f0`
- Transition: all 0.2s ease

#### Status Colors
- Pending: `#f59e0b` (orange)
- Confirmed: `#3b82f6` (blue)
- Preparing: `#8b5cf6` (purple)
- Out for Delivery: `#06b6d4` (cyan)
- Delivered: `#22c55e` (green)
- Cancelled: `#ef4444` (red)

### 5. Empty States
- Custom empty state for each tab
- Icon: `bi-inbox` or status-specific icon
- Helpful text: "No pending orders - great job!" (varies by status)
- Call-to-action button where relevant (e.g., "View All Orders" when filtered tab is empty)
- Centered in grid area with light gray background

### 6. Pagination
- Keep existing pagination pattern from other sections
- ID: `orders-pagination`
- Bootstrap-style pagination with rounded buttons
- Previous/Next buttons with icons
- Page number buttons

## CSS Classes (New)

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

## JavaScript Integration

### Existing IDs to Preserve
- Tab buttons: `pending-orders-tab`, `confirmed-orders-tab`, `preparing-orders-tab`, `out_for_delivery-orders-tab`, `delivered-orders-tab`, `cancelled-orders-tab`
- Count badges: `pending-orders-count`, `confirmed-orders-count`, etc.
- Search input: `orders-search-input`
- Search button: `orders-search-btn`
- Refresh button: `orders-refresh-btn`, `refresh-orders-btn`
- Empty state: `orders-search-empty`

### New IDs to Add
- Orders grid container: `orders-grid`
- Pagination: `orders-pagination`
- Export button: `orders-export-btn`

### farmer.js Changes Required
- Update `renderOrders()` method to render cards instead of table rows
- Update order rendering logic to use card HTML structure
- Ensure status badge colors match CSS classes
- Add export functionality (optional, can be added later)

## Implementation Notes
- Use existing Bootstrap 5.3.3 classes where possible
- Follow the pattern established in the products section (card grid)
- Ensure all existing functionality (search, filter, pagination, status changes) continues to work
- Test responsive behavior on mobile, tablet, and desktop
- Maintain accessibility with proper ARIA labels and keyboard navigation
