# AgriCatch — Master Rebuild Plan

**Status**: Pre-implementation. All phases pending.
**Last Updated**: 2026-05-24

---

## SCOPE BOUNDARIES (User-Confirmed)

### EXCLUDED — Do NOT build:
- Order dispute / escalation to admin
- Moving cart to header (keep fixed floating bottom-right button)
- vs-last-period comparison in stats
- Coupon / promo code field
- New Arrivals section
- Delivery fee calculation (fixed ₱35 per order only)
- Address label field (Home / Work / Other)
- "+63" prefix change / PSGC phone validation

### FIXED VALUES:
- Delivery fee: ₱35 per order (flat, no calculation)
- Checkout delivery address (pre-filled, read-only):
  - Province: Metro Manila (NCR)
  - City: City Of Manila
  - Barangay: Sampaloc
  - Street / Building / House No.: Trabajo Market, M. Dela Fuente St.
  - Display string: "Trabajo Market, M. Dela Fuente St., Sampaloc, Manila, Metro Manila"

### RATINGS:
- Customer rates farmer (star, after delivery)
- Farmer rates customer (star, after delivery)
- No escalation, no dispute — ratings only

---

## PSGC ADDRESS SYSTEM

**Source data**: `backend/PSGC2-MASTER/`
- `provinces.json` — `{ name, region }` — 82 provinces
- `cities.json` — `{ name, region, province? }` — cities (NCR cities have no province)
- `municipalities.json` — `{ name, region, province }` — municipalities
- `tree.json` — full hierarchy including barangays

**Address field structure (all address forms in the system)**:
1. Province / NCR — dropdown (provinces + "Metro Manila (NCR)" entry)
2. City / Municipality — filtered dropdown based on province
3. Barangay — filtered dropdown based on city/municipality (from tree.json)
4. Street / Building / House No. — free text input

**NCR Handling**:
- When user selects "Metro Manila (NCR)", cities shown are the 17 NCR cities from cities.json (those with no `province` field + Pateros municipality)
- For non-NCR provinces, merge cities.json + municipalities.json filtered by `province`

**Backend PSGC API endpoints** (serve static data, no DB):
- `GET /api/psgc/provinces` — returns provinces + NCR entry
- `GET /api/psgc/cities?province=<name>` — returns cities + municipalities for that province
- `GET /api/psgc/barangays?city=<name>` — returns barangays from tree.json

**Frontend PSGC utility** — `frontend/js/psgc.js`:
- `loadProvinces(selectEl)`
- `loadCities(province, selectEl)`
- `loadBarangays(city, selectEl)`
- Cascading: province change → reload cities → clear barangays; city change → reload barangays
- Used on: addresses.html, checkout modal (read-only), My Account modal (profile address), admin user-edit modal, farmer My Account

**Affected address storage**:
- DB column `users.address` stores formatted string: "Street, Barangay, City, Province"
- DB column `orders.delivery_address` at checkout stores: "Trabajo Market, M. Dela Fuente St., Sampaloc, Manila, Metro Manila" (fixed)
- `user_addresses` table: add columns `province`, `city`, `barangay`, `street` (migration needed)

---

## FULL NAME FIELD STANDARD (All Roles, All Forms)

**New structure** — replaces the single "Full Name" field everywhere:
- **First Name** — required
- **Middle Name** — optional (placeholder: "Optional")
- **Last Name** — required

**Display format**: `First + (Middle initial if present, e.g. "M.") + Last` — or full middle name depending on context
**Storage**: separate DB columns `first_name`, `middle_name` (nullable), `last_name` — `full_name` computed as `CONCAT(first_name, ' ', COALESCE(middle_name || ' ', ''), last_name)`

### DB Migration Required
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
-- Migrate existing full_name data: first word = first_name, last word = last_name, middle = anything between
-- After migration, full_name column kept as a generated/computed display value or removed
```
Migration file: `database/migrations/add_name_fields.sql`

### Affected Forms (ALL must use the 3-field pattern)
| Form | File | Phase |
|---|---|---|
| Registration form | `frontend/index.html` | Phase 6 / auth |
| My Account modal (customer) | `frontend/index.html` | Phase 6 |
| My Account modal (farmer) | `frontend/farmer.html` | Phase 5 |
| Admin — user edit modal | `frontend/admin.html` | Phase 3 |
| Admin — user creation form (admin) | `frontend/admin.html` | Phase 3 |
| Superadmin — user creation form | `frontend/superadmin.html` | Phase 4 |
| Superadmin — user edit modal | `frontend/superadmin.html` | Phase 4 |

### Affected Backend Routes
- `POST /api/auth/register` — accept `first_name`, `middle_name`, `last_name`
- `PUT /api/auth/profile` — accept same fields
- `POST /api/admin/users` — accept same fields
- `PUT /api/admin/users/:id` — accept same fields
- `POST /api/superadmin/users` — accept same fields
- `PUT /api/superadmin/users/:id` — accept same fields
- All `GET` responses that return user objects — return all three fields + computed display name

### Confirmation Modal (user creation)
Summary modal shows:
- **First Name**: value
- **Middle Name**: value or "—"
- **Last Name**: value
- Email, Username, Role, Password (masked)



---

## PHASE 1 — Security + Backend Foundation (CRITICAL)

### Backend Security Fixes (`backend/routes/admin.js`)
1. Remove `password` from `SELECT` in `GET /users` — use explicit column list
2. Fix `PUT /users/:id` — remove `plainPw` storage, store only bcrypt hash
3. Remove JWT fallback: `process.env.JWT_SECRET || 'your-jwt-secret'` — require env var, throw on missing
4. Remove admin recovery overlay hint: `"Admin secret (default: admin123)"` from `frontend/index.html`

### New Middleware (`backend/middleware/requireRole.js`)
```js
// requireRole('super_admin') — 403 if user.role !== 'super_admin'
// requireRole('admin', 'super_admin') — allow either
// Used in admin routes to guard super_admin-only endpoints
```

### Pagination for Admin Endpoints
- `GET /api/admin/users?page=1&limit=50` — add `LIMIT/OFFSET`, return `{ users, total, page, limit }`
- `GET /api/admin/products?page=1&limit=50` — same
- `GET /api/admin/orders?page=1&limit=50` — same

### Backend: Fix `ensureCategoryAdminSchema()`
- Move the `ALTER TABLE` call to server startup (`server.js`) — run once, not per request
- Remove the per-request call in admin routes

### Backend: `tableColumnsCache` invalidation
- Add TTL: clear cache entry after 5 minutes

### Audit Log Enhancement (`backend/utils/auditLog.js`)
- Add `ip_address`, `user_agent`, `session_id` to `writeAdminAuditLog()`
- Stop extra DB query for actor info — use `req.user.email` and `req.user.full_name` directly
- Migration: `database/migrations/add_audit_log_fields.sql`

### New `backend/routes/superadmin.js`
- `GET /api/superadmin/admin` — list all admin users
- `POST /api/superadmin/users` — create any account (role: admin | farmer | customer), password manually provided, bcrypt-hashed before save, no email sent
- `PUT /api/superadmin/users/:id` — edit any user (name, email, username, role, password if provided)
- `DELETE /api/superadmin/users/:id` — disable any user
- `GET /api/superadmin/settings` — platform settings
- `PUT /api/superadmin/settings` — update settings
- `GET /api/superadmin/security-log` — security events (failed logins, role changes, password resets)
- All protected by `requireRole('super_admin')`

### Stats Caching (`backend/utils/adminCache.js`)
- In-memory cache Map with 5-minute TTL
- Used in `GET /api/admin/stats`

### PSGC Backend Routes (`backend/routes/psgc.js`)
- `GET /api/psgc/provinces`
- `GET /api/psgc/cities?province=<name>`
- `GET /api/psgc/barangays?city=<name>`
- Reads from psgc2 JSON files — no DB, cached in memory at startup

### Database Migrations (Phase 1)
- `add_audit_log_fields.sql` — `ip_address VARCHAR(45), user_agent TEXT, session_id VARCHAR(100)`
- `add_psgc_address_fields.sql` — add `province, city, barangay, street` to `user_addresses`
- `add_name_fields.sql` — add `first_name VARCHAR(100), middle_name VARCHAR(100), last_name VARCHAR(100)` to `users`; migrate existing `full_name` data

---

## PHASE 2 — New Admin/Farmer CSS Design System

**File**: `frontend/css/admin.css` (new, isolated from styles.css)

### Design Tokens
```css
--admin-sidebar-width: 260px;
--admin-topbar-height: 64px;
--admin-bg: #f4f6f9;
--admin-surface: #ffffff;
--admin-primary: #2d7a3a;   /* AgriCatch green */
--admin-accent: #1a5c78;    /* blue accent */
--admin-danger: #dc3545;
--admin-warning: #ffc107;
--admin-success: #28a745;
--admin-text: #212529;
--admin-text-secondary: #6c757d;
--admin-border: #dee2e6;
--admin-radius: 8px;
--admin-shadow: 0 1px 4px rgba(0,0,0,0.08);
```

### Components
- Sidebar: collapsible, active item highlight, section labels, badge on menu items
- Topbar: breadcrumb, search bar, notification bell, user avatar dropdown
- Data tables: sortable headers, row hover, action buttons column, pagination controls
- Stat cards: icon + metric + label, grid layout
- Modals: backdrop, slide-up animation, header + body + footer zones
- Toast notifications: top-right stack, auto-dismiss, types (success/error/warning/info)
- Loading skeletons: shimmer animation for table rows and stat cards
- Empty states: illustration + message + CTA button
- Confirmation dialogs: custom modal (NOT browser confirm())
- Form components: labeled inputs, validation errors, select dropdowns, file upload
- Tab system: horizontal tabs with active underline, optional count badge
- Pagination: prev/next + page numbers

---

## PHASE 3 — Admin Panel Rebuild (`admin.html` + `admin.js`)

### admin.html Structure
```
<body class="admin-layout">
  <aside class="admin-sidebar">  <!-- Orders, Customers, Products, Categories, Farmers, Logs -->
  <div class="admin-main">
    <header class="admin-topbar">
    <main class="admin-content">
      <!-- Section panels, each lazy-loaded -->
```

### Sections (tabs/nav items)
1. **Dashboard** — 4 stat cards + recent activity feed
2. **Orders** — table with status filter tabs, date range picker, search, pagination, CSV export
3. **Customers** — table with search, pagination, enable/disable, view orders
4. **Products** — table with category filter, status filter, search, pagination, enable/disable
5. **Categories** — list with add/edit/disable, catalog names, category requests queue
6. **Farmers** — table: unverified queue (verify/reject), all farmers, enable/disable
7. **Audit Logs** — paginated table, filter by action/entity, date range
8. **Messages** — chat with farmers/customers (SSE-based, no polling)

### admin.js Changes
- Replace `AdminDashboard` monolith with section modules: `AdminOrders`, `AdminCustomers`, `AdminProducts`, `AdminCategories`, `AdminFarmers`, `AdminLogs`
- **Remove** all `prompt()` calls — replace with inline edit modals
- **Remove** all `confirm()` calls — replace with `ConfirmDialog` component
- Lazy load each section on first tab click — not all on init
- `showToast(message, type)` replaces `showMessage()` (no inline styles)
- Event delegation instead of inline `onclick`/`onchange`
- SSE for real-time order updates + chat unread count (remove `startUnreadPolling()`)
- Pagination component for each table section
- Category request review: inline approve/reject modal with notes field

### Farmer Verification Workflow (admin side)
- Farmers tab: "Pending Verification" sub-tab shows new farmer registrations
- Admin can: Verify ✓ / Reject ✗ / View profile
- On verify: sets `is_verified = true` in users table
- On reject: sets rejection reason, notifies farmer via notification

---

## PHASE 4 — Superadmin Panel (`superadmin.html` + `superadmin.js`)

### superadmin.html Sections
1. **Overview** — System health tiles: total users, active farmers, pending verifications, orders today
2. **Admin Management** — Table of admin accounts: create, edit, disable
3. **Platform Settings** — Key-value settings: site name, maintenance mode, max upload size, etc.
4. **Security Log** — Failed login attempts, role promotions, password resets (from audit log)
5. **Feature Flags** — Toggle experimental features on/off

### User Creation — Superadmin
Form fields: Full Name, Email, Username, Password (plain text input, bcrypt-hashed on save), Role (dropdown: admin | farmer | customer)
- No email sent, no temporary password — password is set directly by superadmin
- Saved immediately to `users` table with hashed password
- Password field: show/hide toggle, minimum 8 characters validation
- **Confirmation step**: after clicking "Create Account", show a confirmation modal summarizing:
  - Full Name, Email, Username, Role (password shown as `••••••••`)
  - Two buttons: "Confirm & Save" (proceeds to save) and "Cancel" (goes back to form)
  - Account is NOT saved until "Confirm & Save" is clicked

### User Creation — Admin (LIMITED)
Same form but Role dropdown limited to: **farmer | customer** only
- Admin CANNOT create admin or super_admin accounts
- Backend enforces this: `POST /api/admin/users` rejects if `req.user.role === 'admin'` and `body.role` is `staff` or `super_admin`
- Same direct-save: bcrypt hash, no email sent
- **Same confirmation step**: summary modal before saving — Full Name, Email, Username, Role, password masked

---

## PHASE 5 — Farmer Dashboard Improvements (`farmer.html` + `farmer.js`)

### New Sections / Fixes

#### Shop Profile Tab (NEW)
- Dedicated "Shop" tab in sidebar
- Edit: shop_description, shop_banner_url (upload), shop_avatar_url (upload)
- Calls `PUT /api/farmers/profile` (already exists in backend)
- Preview: how shop looks to customers on product.html

#### Verification Status Banner (NEW)
- If `is_verified === false`: show prominent yellow banner "Your account is pending verification. You can add products but they won't be visible to customers until verified."
- If `is_disabled === true`: show red banner with reason

#### Reviews Management Tab (NEW)
- List all reviews received on farmer's products
- Columns: Customer, Product, Rating (stars), Comment, Date
- Aggregate: average rating, total reviews
- Backend: `GET /api/reviews/mine` (farmer-scoped) — may need new endpoint or use existing reviews route

#### Low Stock Alerts (enhancement to Products section)
- Products with stock ≤ 5 highlighted with orange badge "Low Stock"
- Products with stock = 0 highlighted with red badge "Out of Stock"
- Filter: "Show low stock only" checkbox in products list

#### Earnings Widget (NEW in Overview section)
- Total Revenue card (sum of delivered order totals for farmer's products)
- Breakdown table: by product, by month — from `GET /api/farmers/me/metrics`
- Uses existing `/me/metrics` endpoint (already exists in backend)

#### Admin Announcements Section (NEW)
- Small panel in Overview sidebar: "Platform Announcements"
- Reads from `GET /api/notifications?type=announcement` or a new platform_announcements table
- Shows last 5 admin-broadcast messages

#### Product Duplication (NEW)
- "Duplicate" button on each product row
- Prefills the Add Product modal with existing product data (name, category, description, unit, price)
- Farmer edits and saves as new product

#### Batch Product Actions (NEW)
- Checkbox select on product list
- "Mark as Available", "Mark as Sold Out", "Delete Selected" bulk actions bar
- Confirmation modal before batch operations

---

## PHASE 6 — Customer Experience

### `orders.html` Rebuild
- Full navigation header (logo + nav + user dropdown + notifications)
- Status tabs with count badge per tab (Pending, Confirmed, Preparing, Out for Delivery, Delivered, Cancelled)
- Order search (by product name or order ID)
- Date range filter
- Per-order: delivery tracking timeline (step progress bar: Pending → Confirmed → Preparing → Out for Delivery → Delivered)
- Re-order button on delivered orders (adds items back to cart)
- Cancel button on pending orders (with reason select)
- Rating prompt on delivered orders (already has modal, make it more prominent)

### `wishlist.html` Rebuild
- Full navigation header
- Wishlist item count in page title
- Sort / filter: by date added, by price, by category
- Price drop indicator: if product price changed since saved, show "Price updated"
- "Add to Cart" button per item
- "Add All to Cart" button (header)
- Empty state with CTA

### `addresses.html` Rebuild
- Full navigation header
- Address list: show all saved addresses with edit/delete buttons
- Each address displayed as: "Street, Barangay, City, Province"
- Default address badge
- Add/Edit form using PSGC dropdowns (Province → City → Barangay → Street text)
- No label field
- No phone field change

### `product.html` Fixes
- Review form: replace `<input type="number">` with 5-star click selector (like the one in orders.html)
- Proper navigation header (consistent with other pages)
- SEO meta tags: `og:title`, `og:description`, `og:image` populated from product data

### Checkout Modal — PSGC + Fixed Delivery
- Delivery address section: pre-filled read-only PSGC fields showing Trabajo Market address
  - Display: "Trabajo Market, M. Dela Fuente St., Sampaloc, Manila, Metro Manila"
  - Note: "All orders are delivered to Trabajo Market"
- Order summary: itemized list + subtotal + Delivery Fee: ₱35.00 + Total
- "Select from saved addresses" option hidden (since delivery is always fixed address)

### My Account Modal (index.html)
- Address field: replace `<textarea>` with PSGC cascading dropdowns (Province → City → Barangay → Street)
- Saved as formatted string in DB

### Cart Merge on Login (Guest → Auth)
- On successful login: read `guest_*` sessionId cart from API, merge into authenticated user cart
- Backend: `POST /api/cart/merge` — moves guest cart items to authenticated user

### OTP Test Display — Hide in Production
- `id="otp-test-display"` in index.html: only shown if `NODE_ENV !== 'production'`
- Backend `POST /api/otp/send`: only return OTP code in response if `NODE_ENV !== 'production'`

### Customer Notifications Page (NEW)
- Route: `/notifications.html`
- Full list of all notifications (not just a dropdown)
- Paginated, mark-as-read per item or all
- Link from notification bell dropdown: "View all notifications"

---

## PHASE 7 — PSGC Integration (Cross-cutting)

### Files to Create
- `backend/routes/psgc.js` — 3 endpoints, read psgc2 JSON files
- `frontend/js/psgc.js` — PSGC dropdown utility (loadProvinces, loadCities, loadBarangays, initAddressForm)

### Files to Modify (address forms)
- `frontend/addresses.html` — replace textarea with PSGC dropdowns
- `frontend/index.html` — My Account modal address field → PSGC dropdowns
- `frontend/index.html` — Checkout modal delivery address → read-only PSGC display
- `frontend/admin.html` — user edit modal address field → PSGC dropdowns
- `frontend/farmer.html` — My Account modal + shop profile address field → PSGC dropdowns

### Database Migration
- `database/migrations/add_psgc_address_fields.sql`:
  ```sql
  ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS province VARCHAR(100);
  ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS city VARCHAR(100);
  ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS barangay VARCHAR(100);
  ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS street TEXT;
  ```

---

## FILE STRUCTURE — New Files to Create

```
backend/
  routes/
    superadmin.js          ← NEW Phase 4
    psgc.js                ← NEW Phase 7
  middleware/
    requireRole.js         ← NEW Phase 1
  utils/
    adminCache.js          ← NEW Phase 1

frontend/
  superadmin.html          ← NEW Phase 4
  notifications.html       ← NEW Phase 6
  css/
    admin.css              ← NEW Phase 2
  js/
    superadmin.js          ← NEW Phase 4
    psgc.js                ← NEW Phase 7
    admin-charts.js        ← NEW Phase 3

database/
  migrations/
    add_audit_log_fields.sql      ← NEW Phase 1
    add_psgc_address_fields.sql   ← NEW Phase 7
    add_name_fields.sql           ← NEW Phase 1
```

---

## IMPLEMENTATION ORDER

| Phase | Description | Priority |
|---|---|---|
| 1 | Security + Backend (password, JWT, requireRole, pagination, PSGC routes, stats cache) | CRITICAL |
| 2 | New admin.css design system | HIGH |
| 3 | Admin panel rebuild (admin.html + admin.js) | HIGH |
| 4 | Superadmin panel (superadmin.html + superadmin.js) | HIGH |
| 5 | Farmer dashboard improvements | MEDIUM |
| 6 | Customer experience (orders, wishlist, addresses, product.html, notifications) | MEDIUM |
| 7 | PSGC integration (psgc.js utility + all address forms) | MEDIUM |

Phases 1 → 7 in sequence. Phase 7 (PSGC) can be done in parallel with Phase 6.

---

## KNOWN CONSTRAINTS

- All frontend is vanilla HTML/CSS/JS (no framework)
- Backend: Node.js + Express + PostgreSQL (Supabase)
- Auth: JWT in localStorage
- File uploads: Cloudinary
- Real-time: SSE via `backend/utils/realtime.js` and `broadcastEvent()`
- Charts: Chart.js 4.4.1 CDN
- Icons: FontAwesome 6.5.2 CDN
- CSS: monolithic `frontend/css/styles.css` (~8000 lines) — new admin.css is isolated
- psgc2 barangay data is in `tree.json` (nested Region→Province→City→barangays) — needs parsing at startup
