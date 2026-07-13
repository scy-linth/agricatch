# AgriCatch UI Standardization Recommendations

## Executive Summary

This document provides standardized UI/UX recommendations for the AgriCatch platform based on a comprehensive audit of export features, filtering, and sorting across Admin and Farmer modules. The goal is to ensure consistency, improve user experience, and maintain visual harmony across the application.

---

## 1. Export Button Standards

### 1.1 Placement
- **Location**: Place export buttons in the filter bar, aligned with other action buttons
- **Position**: Right-aligned within the filter bar for easy access
- **Grouping**: Group with date range filters when applicable (e.g., Orders section)

### 1.2 Styling
```css
/* Standard Export Button */
.btn-export {
  background-color: #41bf5b; /* btn-ac-green */
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s ease;
}

.btn-export:hover {
  background-color: #36a34e;
  transform: translateY(-1px);
}

.btn-export:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
  transform: none;
}
```

### 1.3 Iconography
- **Icon**: `bi-file-earmark-excel` (Bootstrap Icons)
- **Position**: Left of text with `me-1` margin
- **Size**: Standard icon size (16px)

### 1.4 Loading State
- **Loading Icon**: `bi-hourglass-split`
- **Loading Text**: "Exporting..." or "Generating..."
- **Behavior**: Disable button during export to prevent duplicate requests

### 1.5 HTML Template
```html
<button id="[module]-export-btn" class="btn btn-sm btn-ac-green" type="button">
  <i class="bi bi-file-earmark-excel me-1"></i>Export
</button>
```

---

## 2. Filter Bar Standards

### 2.1 Layout Structure
```html
<div class="section-filter-bar row g-2 mb-3 align-items-end">
  <!-- Left side: Filters -->
  <div class="col-md-auto col-sm-6">
    <label class="form-label small fw-semibold mb-1">[Filter Label]</label>
    <select id="[filter]-filter" class="form-select form-select-sm">
      <!-- Options -->
    </select>
  </div>
  
  <!-- Right side: Search and Actions -->
  <div class="col-md-4 col-sm-6 ms-md-auto">
    <label class="form-label small fw-semibold mb-1">Search</label>
    <div class="d-flex gap-2">
      <div class="input-group input-group-sm flex-grow-1">
        <input type="text" id="[module]-search-input" class="form-control me-2" placeholder="[Placeholder]">
        <button id="[module]-search-btn" class="btn btn-sm btn-ac-green" type="button">
          <i class="bi bi-search me-1"></i>Search
        </button>
      </div>
      <button id="[module]-refresh-btn" class="btn btn-outline-secondary btn-sm" type="button">
        <i class="bi bi-arrow-clockwise"></i>
      </button>
    </div>
  </div>
</div>
```

### 2.2 Date Range Filters
- **Placement**: Left side of filter bar
- **Spacing**: Date inputs separated by a dash (–) with `text-muted small` styling
- **Export Button**: Place immediately after date range when export is available

### 2.3 Status Tabs
- **Placement**: Below filter bar, above table/grid
- **Styling**: Use `.verification-tabs` or `.order-tabs` class
- **Active State**: `.tab-btn.active` with green accent
- **Badge**: Include count badge for each tab

### 2.4 Entries Per Page
- **Label**: "Show" with small, semibold styling
- **Options**: 10, 25, 50 (default), 100
- **Width**: Minimum 60px
- **Position**: Leftmost in filter bar

---

## 3. Search Bar Standards

### 3.1 Input Styling
```css
.form-control.form-control-sm {
  border-radius: 8px;
  border: 1px solid #d1d5db;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.form-control:focus {
  border-color: #41bf5b;
  box-shadow: 0 0 0 3px rgba(65, 191, 91, 0.1);
}
```

### 3.2 Search Button
- **Icon**: `bi-search` with `me-1` margin
- **Color**: `btn-ac-green` (#41bf5b)
- **Size**: `btn-sm`
- **Text**: "Search" (optional, can be icon-only)

### 3.3 Refresh Button
- **Icon**: `bi-arrow-clockwise`
- **Color**: `btn-outline-secondary`
- **Size**: `btn-sm`
- **Function**: Reset filters and reload data

### 3.4 Placeholder Text
- **Admin Orders**: "Order ID, product name, or customer…"
- **Farmer Orders**: "Order ID, product name, or customer..."
- **Users**: "Name, username or email…"
- **Products**: "Product name, category, or farmer…"

---

## 4. Status Tab Standards

### 4.1 Tab Configuration
```html
<div class="[module]-tabs mb-3">
  <button class="tab-btn active" data-status="">All <span class="tab-count" id="all-count">0</span></button>
  <button class="tab-btn" data-status="[status-1]">[Label 1] <span class="tab-count" id="[status-1]-count">0</span></button>
  <button class="tab-btn" data-status="[status-2]">[Label 2] <span class="tab-count" id="[status-2]-count">0</span></button>
</div>
```

### 4.2 Order Status Tabs (Standard)
- All
- Pre-order Reserved
- Pending
- Confirmed
- Preparing
- Out for Delivery
- Delivered
- Cancelled

### 4.3 User Status Tabs
- All
- Active
- Disabled (or Suspended/Banned for admin users)

### 4.4 Product Status Tabs
- All
- Available Now
- Pre-orders
- Approval (for farmers)

---

## 5. Sorting Standards

### 5.1 Sort Dropdown Options
```html
<select id="[module]-sort-filter" class="form-select form-select-sm">
  <option value="date_desc">Newest first</option>
  <option value="date_asc">Oldest first</option>
  <option value="total_desc">Highest total</option>
  <option value="total_asc">Lowest total</option>
  <option value="customer_asc">Customer (A-Z)</option>
  <option value="customer_desc">Customer (Z-A)</option>
</select>
```

### 5.2 Table Column Sorting
- **Implementation**: Use sortable table library
- **Visual Indicator**: Arrow icon (↑/↓) on sortable columns
- **Persistence**: Save sort state to localStorage
- **Default Sort**: Date descending (newest first)

### 5.3 Sort Integration
- Sort dropdown should sync with table column sorting
- Sort parameter should be passed to both API calls and export functions
- Export should use the same sort as displayed data

---

## 6. Excel Export Report Standards

### 6.1 Visual Consistency
- **Logo**: AgriCatch logo in header (left-aligned)
- **Title**: Bold, size 20, color DARK_GREEN (#1B5E20)
- **Colors**: 
  - AGRICATCH_GREEN: #2E7D32
  - LIGHT_GREEN: #E8F5E9
  - DARK_GREEN: #1B5E20
  - HEADER_WHITE: #FFFFFF
  - LABEL_BG: #F5F5F5
  - FOOTER_TEXT: #666666

### 6.2 Report Structure
1. **Header Block**
   - Logo
   - Report Title
   - Report Information (generated date, filters, date range)
   - Generated By (name, email, phone, role)

2. **Summary Block**
   - KPI cards (total orders, revenue, status counts)
   - 6-column layout for summary metrics

3. **Data Table**
   - Column headers with styling
   - Data rows with alternating row colors
   - Proper alignment (center for IDs, right for currency, left for text)

4. **Footer**
   - "Generated by AgriCatch Platform"
   - "Copyright © 2026 AgriCatch. All rights reserved."

### 6.3 Column Widths (Standard)
- ID columns: 12
- Name columns: 25-30
- Date columns: 18-20
- Currency columns: 15
- Status columns: 15-18

### 6.4 Filename Convention
- Admin Orders: `Admin_Orders_Report_YYYY-MM-DD.xlsx`
- Farmer Orders: `Farmer_Orders_Report_YYYY-MM-DD.xlsx`
- Admin Users: `Admin_[Role]_Report_YYYY-MM-DD.xlsx`

---

## 7. Data Formatting Standards

### 7.1 Currency
- **Format**: `₱1,234.56` (Philippine Peso)
- **Locale**: `en-PH`
- **Decimals**: 2 decimal places
- **Helper**: `formatCurrency(amount)` function

### 7.2 Dates
- **Format**: "Jan 1, 2026" (short format)
- **Locale**: `en-PH`
- **Timezone**: `Asia/Manila`
- **Helper**: `formatDate(value)` function

### 7.3 Status Labels
- **Display**: Title case with spaces (e.g., "Out for Delivery")
- **Special Cases**:
  - `preorder_reserved` → "Pre-order Reserved"
  - `out_for_delivery` → "Out for Delivery"
  - `cash_on_delivery` → "Cash on Delivery"

### 7.4 Empty Values
- **Display**: "—" (em dash) for null/undefined values
- **Consistency**: Use across all tables and exports

---

## 8. Responsiveness Standards

### 8.1 Breakpoints
- **Mobile**: < 576px
- **Tablet**: 576px - 992px
- **Desktop**: > 992px

### 8.2 Mobile Adaptations
- Filter bars: Stack vertically on mobile
- Search bar: Full width on mobile
- Status tabs: Horizontal scroll on mobile
- Tables: Enable horizontal scroll wrapper

### 8.3 Responsive Classes
```html
<!-- Filter Bar -->
<div class="col-md-auto col-sm-6"> <!-- Auto on desktop, 6/12 on tablet/mobile -->
<div class="col-md-4 col-sm-6 ms-md-auto"> <!-- 4/12 on desktop, 6/12 on tablet, auto margin on desktop -->

<!-- Search -->
<div class="input-group input-group-sm flex-grow-1"> <!-- Grows to fill space -->
```

---

## 9. Spacing and Alignment Standards

### 9.1 Vertical Spacing
- **Section spacing**: `mb-4` (1.5rem) between major sections
- **Filter bar spacing**: `mb-3` (1rem) before tabs/table
- **Card spacing**: `g-2` (0.5rem) in grid layouts

### 9.2 Horizontal Spacing
- **Button gaps**: `gap-2` (0.5rem) between buttons
- **Input groups**: `me-2` (0.5rem) margin on inputs
- **Icon spacing**: `me-1` (0.25rem) before text

### 9.3 Alignment
- **Filter labels**: Right-aligned with inputs
- **Action buttons**: Right-aligned in filter bar
- **Status tabs**: Left-aligned, full width
- **Table headers**: Left-aligned (except ID/status columns)

---

## 10. Color Standards

### 10.1 Primary Colors
- **Brand Green**: #41bf5b (btn-ac-green)
- **Dark Green**: #1B5E20 (headers, titles)
- **Light Green**: #E8F5E9 (backgrounds, accents)

### 10.2 Status Colors
- **Success**: #198754 (active, delivered, verified)
- **Warning**: #ffc107 (pending, preparing)
- **Danger**: #dc3545 (cancelled, disabled, rejected)
- **Info**: #0d6efd (scheduled, out for delivery)
- **Secondary**: #6c757d (neutral, disabled)

### 10.3 Text Colors
- **Primary**: #212529 (headings, body text)
- **Muted**: #6c757d (labels, secondary text)
- **Light**: #f8f9fa (on dark backgrounds)

---

## 11. Typography Standards

### 11.1 Font Sizes
- **Headings**: 1.25rem (h4), 1rem (h5), 0.875rem (h6)
- **Body**: 0.875rem (small), 1rem (normal)
- **Labels**: 0.875rem with `small fw-semibold`

### 11.2 Font Weights
- **Bold**: `fw-bold` (headings, emphasis)
- **Semibold**: `fw-semibold` (labels, buttons)
- **Normal**: Default (body text)

### 11.3 Font Families
- **Primary**: System font stack (San Francisco, Segoe UI, Roboto)
- **Monospace**: For code, IDs, technical data

---

## 12. Icon Standards

### 12.1 Icon Library
- **Library**: Bootstrap Icons (bi-*)
- **Size**: Standard (16px), large (24px for hero icons)

### 12.2 Common Icons
- **Export**: `bi-file-earmark-excel`
- **Search**: `bi-search`
- **Refresh**: `bi-arrow-clockwise`
- **Filter**: `bi-funnel`
- **Sort**: `bi-arrow-down-up`, `bi-arrow-up`, `bi-arrow-down`

### 12.3 Icon Placement
- **Before text**: Use `me-1` margin
- **After text**: Use `ms-1` margin
- **Standalone**: Center-aligned in containers

---

## 13. Accessibility Standards

### 13.1 ARIA Labels
- All buttons should have `aria-label` or descriptive text
- Icon-only buttons must have `aria-label`
- Form inputs should have associated labels

### 13.2 Keyboard Navigation
- Tab order should follow visual layout
- Enter key should trigger primary actions
- Escape key should close modals

### 13.3 Focus States
- All interactive elements should have visible focus states
- Focus ring: 3px outline with brand color
- Skip links for keyboard users

---

## 14. Loading States

### 14.1 Button Loading
```html
<button class="btn btn-ac-green" disabled>
  <i class="bi bi-hourglass-split me-1"></i>Loading...
</button>
```

### 14.2 Table Loading
```html
<div class="table-skeleton">
  <div class="skeleton-row"></div>
  <div class="skeleton-row"></div>
  <div class="skeleton-row"></div>
</div>
```

### 14.3 Spinner
```html
<span class="spinner-border spinner-border-sm"></span>
```

---

## 15. Error Handling

### 15.1 Error Messages
- **Style**: Red text with icon
- **Placement**: Above affected element or in toast
- **Content**: Clear, actionable error description

### 15.2 Empty States
- **Icon**: `bi-inbox` or relevant icon
- **Text**: Descriptive message (e.g., "No orders found")
- **Action**: Suggested action if applicable

---

## 16. Toast Notifications

### 16.1 Success Toast
- **Icon**: `bi-check-circle`
- **Color**: Green background
- **Duration**: 3 seconds
- **Position**: Top-right or bottom-right

### 16.2 Error Toast
- **Icon**: `bi-exclamation-circle`
- **Color**: Red background
- **Duration**: 5 seconds
- **Position**: Top-right or bottom-right

### 16.3 Info Toast
- **Icon**: `bi-info-circle`
- **Color**: Blue background
- **Duration**: 3 seconds
- **Position**: Top-right or bottom-right

---

## Implementation Priority

### High Priority
1. Export button standardization (all modules)
2. Filter bar layout consistency
3. Status tab standardization
4. Search bar consistency

### Medium Priority
5. Sort dropdown implementation
6. Excel report visual consistency
7. Responsive improvements
8. Loading state standardization

### Low Priority
9. Accessibility enhancements
10. Advanced animations
11. Custom scrollbar styling
12. Dark mode support

---

## Conclusion

These standards should be applied consistently across all modules (Admin, Farmer, Customer) to ensure a cohesive user experience. When adding new features or modules, refer to this document to maintain consistency with the existing codebase.

For questions or clarifications, consult the design team or refer to the existing implementations in:
- `admin.html` / `admin.js` (Admin module)
- `farmer.html` / `farmer.js` (Farmer module)
- `orderExportService.js` (Backend export logic)
