# AgriCatch Staff Dashboard — NiceAdmin Migration Plan
> Phase 1: Staff Dashboard (`admin.html`) Only  
> Date: May 25, 2026  
> Status: IN PROGRESS

---

## PHASE SCOPE

**Rebuild:** `frontend/admin.html` + create `frontend/css/agricatch-admin.css`  
**Freeze:** `admin.js`, `admin-charts.js`, `chat.js`, `format.js`, `psgc.js`, all backend files, `superadmin.html`, `superadmin.js`  
**Template source:** `D:\Codings\AgriCatch\NiceAdmin\`

---

## 1. EXECUTIVE MIGRATION OVERVIEW

Full UI rebuild of the AgriCatch Staff Dashboard using the NiceAdmin Bootstrap 5 design system. This is NOT a reskin — the entire HTML/CSS shell is replaced while keeping every line of `admin.js`, `admin-charts.js`, and all backend integrations completely untouched.

After migration the staff dashboard must be functionally identical: every CRUD operation, fetch call, auth flow, role check, chart, toast, modal, panel, SSE event, and inline `onclick` must work exactly as before.

---

## 2. ARCHITECTURE CHANGE

### FROM (Current)
- `body.admin-theme` → `div.admin-layout` → `aside.admin-sidebar` + `main.admin-main`
- Custom CSS variables in `admin.css`
- No Bootstrap dependency

### TO (Target)
- `body` with `toggle-sidebar` class behavior (NiceAdmin pattern)
- `header#header.header.fixed-top` — topbar
- `aside#admin-sidebar.sidebar` — left navigation (keep `id="admin-sidebar"` for admin.js)
- `main#main.main` — all content
- `NiceAdmin/assets/css/style.css` as base stylesheet
- `frontend/css/agricatch-admin.css` for AgriCatch-specific overrides

---

## 3. VENDOR ASSET STRATEGY

Reference NiceAdmin vendor files. Load in this order in `<head>`:
1. `NiceAdmin/assets/vendor/bootstrap/css/bootstrap.min.css`
2. `NiceAdmin/assets/vendor/bootstrap-icons/bootstrap-icons.css`
3. `NiceAdmin/assets/vendor/boxicons/css/boxicons.min.css`
4. Font Awesome CDN (keep — admin.js renders `fas fa-*` icons inline)
5. `NiceAdmin/assets/css/style.css`
6. `frontend/css/agricatch-admin.css` (AgriCatch overrides — loaded LAST)

Load at bottom of `<body>`:
1. `NiceAdmin/assets/vendor/bootstrap/js/bootstrap.bundle.min.js`
2. `NiceAdmin/assets/vendor/chart.js/chart.umd.js` (or equivalent)
3. `NiceAdmin/assets/js/main.js`
4. `frontend/js/format.js`
5. `frontend/js/psgc.js`
6. `frontend/js/admin-charts.js`
7. `frontend/js/chat.js`
8. `frontend/js/admin.js`

---

## 4. CSS ORGANIZATION STRATEGY

**`agricatch-admin.css` must define:**

### Brand tokens
- `--agricatch-primary: #2d7a3a`
- Override NiceAdmin's `#4154f1` primary for buttons/links/active states

### JavaScript-injected classes (MUST exist — admin.js writes these into innerHTML)
- `.status-pill.pending`, `.status-pill.preparing`, `.status-pill.delivered`, `.status-pill.completed`, `.status-pill.cancelled`
- `.badge-role-super_admin`, `.badge-disabled`, `.badge-active`
- `.toggle-switch`, `.toggle-slider`
- `.btn-small`, `.btn-ghost-primary`, `.btn-ghost-danger`
- `.action-btns`
- `.panel-header`, `.panel-section`, `.panel-item`, `.panel-placeholder`
- `.filter-select`

### Layout classes used by admin.js
- `.admin-section-card` — sections; admin.js queries `querySelectorAll('.admin-section-card')` to remove `.active`
- `.admin-section-card.active` — visible state
- `.admin-detail-panel` — slide-over panels
- `.admin-detail-panel.active` — visible state
- `.admin-chat-drawer` — chat drawer
- `.admin-chat-drawer.active` — visible state
- `.admin-modal-backdrop` — modal wrapper; visibility via `.open` class
- `.admin-modal-backdrop.open` — visible state
- `.admin-modal`, `.admin-modal.modal-sm`, `.admin-modal.modal-lg`
- `.pagination` — pagination container
- `.admin-toast-stack` — toast container (fixed position)
- `.admin-float-chat-btn`, `#admin-chat-unread`

### Section-specific layout
- `.categories-grid`, `.categories-col`, `.categories-col-header`
- `.admin-tabs`, `.admin-tab`, `.admin-tab.active`, `.tab-count`

### Welcome banner (hidden role sentinel)
- `.admin-welcome-banner` — must exist; used by `updateWelcomeBanner()`

---

## 5. REQUIRED PRESERVED IDs — COMPLETE LIST

### Layout / Navigation
| ID | Used by |
|---|---|
| `admin-sidebar` | `setupEventListeners()` — toggles `.open` for mobile |
| `admin-sidebar-overlay` | `setupEventListeners()` — click to close sidebar |
| `admin-mobile-menu-toggle` | `setupEventListeners()` — click handler |
| `visit-site-btn` | `updateWelcomeBanner()`, `setupEventListeners()` |
| `logout-btn` | `setupEventListeners()` |

### Header / Topbar
| ID | Used by |
|---|---|
| `user-name` | `checkAdminAuth()` — sets textContent |
| `user-email` | `checkAdminAuth()` — sets textContent |
| `admin-search-toggle` | `setupEventListeners()` — click focuses search |
| `admin-search-input` | `applySearch()`, `showSection()` |
| `order-filters` | `showSection()` — toggles display:flex/none |
| `order-status-filter` | `applyOrderFilters()` |
| `order-price-filter` | `applyOrderFilters()` |
| `order-sort-filter` | `applyOrderFilters()` |

### KPI Cards
| ID | Used by |
|---|---|
| `total-users` | `loadDashboardStats()` |
| `total-products` | `loadDashboardStats()` |
| `total-orders` | `loadDashboardStats()` |
| `total-revenue` | `loadDashboardStats()` |

### Chart Canvases
| ID | Used by |
|---|---|
| `admin-chart-orders-status` | `admin-charts.js` — Chart.js doughnut |
| `admin-chart-revenue-trend` | `admin-charts.js` — Chart.js line |

### Section Elements (querySelectorAll('.admin-section-card'))
| ID | Section |
|---|---|
| `orders` | Orders Management |
| `users` | Customer Management |
| `products` | Product Management |
| `farmers` | Farmer Management |
| `categories` | Category Management |
| `logs` | Audit Logs |

### Table Bodies
| ID | Populated by |
|---|---|
| `orders-tbody` | `renderOrders()` |
| `users-tbody` | `renderUsers()` |
| `products-tbody` | `renderProducts()` |
| `farmers-pending-tbody` | `renderFarmers()` |
| `farmers-all-tbody` | `renderFarmers()` |
| `categories-tbody` | `renderCategories()` |
| `category-requests-tbody` | `renderCategoryRequests()` |
| `catalog-names-tbody` | `renderCatalogNames()` |
| `logs-tbody` | `renderAuditLogs()` |

### Pagination Containers
| ID | Used by |
|---|---|
| `orders-pagination` | `renderPagination()` |
| `users-pagination` | `renderPagination()` |
| `products-pagination` | `renderPagination()` |
| `farmers-pagination` | `renderPagination()` |

### Farmers Tab System
| ID / Attr | Used by |
|---|---|
| `farmers-pending-count` | farmer load method — sets textContent |
| `farmers-pending-panel` | tab click handler — toggles display |
| `farmers-all-panel` | tab click handler — toggles display |
| `data-farmers-tab="pending"` | `init()` delegated click listener |
| `data-farmers-tab="all"` | `init()` delegated click listener |

### Category Section
| ID | Used by |
|---|---|
| `new-category-name` | `createCategory()` |
| `new-category-description` | `createCategory()` |
| `create-category-btn` | `setupEventListeners()` |
| `catalog-category-select` | `addCatalogName()`, `renderCategories()` |
| `new-catalog-name` | `addCatalogName()` |
| `add-catalog-name-btn` | `setupEventListeners()` |

### Audit Log Filters
| ID | Used by |
|---|---|
| `logs-actor-filter` | `loadAuditLogs()` |
| `logs-action-filter` | `loadAuditLogs()` |
| `logs-entity-filter` | `loadAuditLogs()` |
| `logs-refresh-btn` | `setupEventListeners()` |

### Customers
| ID | Used by |
|---|---|
| `open-create-user-modal` | `setupEventListeners()` |

### Slide-over Panels
| ID | Used by |
|---|---|
| `order-detail-panel` | `openOrderDetails()` — adds `.active`; SSE checks `.active` |
| `order-detail-content` | `openOrderDetails()` — writes innerHTML |
| `close-order-panel` | `setupEventListeners()` |
| `category-detail-panel` | `openCategoryRequestPanel()` — adds `.active` |
| `category-detail-content` | `openCategoryRequestPanel()` — writes innerHTML |
| `close-category-panel` | `setupEventListeners()` |

### Chat System
| ID | Used by |
|---|---|
| `admin-chat-drawer` | `toggleChatDrawer()` — toggles `.active` |
| `close-chat-drawer` | `setupEventListeners()` |
| `admin-float-chat-btn` | `setupEventListeners()` |
| `admin-chat-unread` | `startUnreadPolling()` |
| `conversation-list` | `chat.js` |
| `chat-header` | `chat.js` |
| `chat-header-title` | `chat.js` |
| `chat-header-subtitle` | `chat.js` |
| `chat-messages` | `chat.js` |
| `chat-form` | `chat.js` |
| `chat-input` | `chat.js` |

### Toast / Confirm
| ID | Used by |
|---|---|
| `admin-toast-stack` | `showToast()` — appends toast elements |
| `admin-confirm-modal` | `adminConfirm()` |
| `confirm-title` | `adminConfirm()` |
| `confirm-message` | `adminConfirm()` |
| `confirm-icon` | `adminConfirm()` |
| `confirm-cancel-btn` | `adminConfirm()` |
| `confirm-ok-btn` | `adminConfirm()` |

### Edit User Modal
| ID | Used by |
|---|---|
| `edit-user-modal` | `openUserEdit()` — adds `.open`; `closeModal()` removes `.open` |
| `edit-user-form` | `setupEventListeners()` — submit → `submitUserEdit()` |
| `edit-user-id` | `openUserEdit()` |
| `edit-user-firstname` | `openUserEdit()` |
| `edit-user-middlename` | `openUserEdit()` |
| `edit-user-lastname` | `openUserEdit()` |
| `edit-user-fullname` | `openUserEdit()` |
| `edit-user-username` | `openUserEdit()` |
| `edit-user-email` | `openUserEdit()` |
| `edit-user-password` | `openUserEdit()` |
| `edit-user-pw-toggle` | `openUserEdit()` |
| `edit-user-phone` | `openUserEdit()` |
| `edit-user-zone` | `openUserEdit()`, `_editUserZoneChange()` |
| `edit-user-province` | `openUserEdit()`, `_editUserProvinceChange()` |
| `edit-user-city` | `openUserEdit()`, `_editUserCityChange()` |
| `edit-user-barangay` | `openUserEdit()` |
| `edit-user-street` | `openUserEdit()` |
| `edit-user-address-preview` | `openUserEdit()` |

### Create User Modal
| ID | Used by |
|---|---|
| `create-user-modal` | `openCreateUserModal()` — adds `.open` |
| `create-user-form` | `setupEventListeners()` — submit → `submitUserCreate()` |
| `create-user-role` | `openCreateUserModal()` |
| `create-user-password` | `openCreateUserModal()` |
| `create-user-pw-toggle` | `setupEventListeners()` |

### Edit Product Modal
| ID | Used by |
|---|---|
| `edit-product-form` | `setupEventListeners()` — submit → `submitProductEdit()` |
| `edit-product-description` | `init()` — char counter |
| `edit-product-description-count` | `init()` — char counter |
| `edit-product-image` | `init()` — live preview |
| `edit-product-image-preview` | `init()` — live preview |

### data-* Attributes (MUST be preserved)
| Attribute | Used by |
|---|---|
| `data-section="orders/users/products/categories/farmers/logs"` | `setupNavigation()` queries `[data-section]` |
| `data-close-modal="[id]"` | `setupEventListeners()` queries `[data-close-modal]` |
| `data-farmers-tab="pending/all"` | `init()` delegated listener |

### CSS Classes Used by admin.js Queries
| Class | Used by |
|---|---|
| `.sidebar-link` | `setupNavigation()`, `setupEventListeners()` |
| `.sidebar-link[data-section]` | `setupNavigation()` |
| `.admin-section-card` | `showSection()` — querySelectorAll |
| `.page-title` | `showSection()` — querySelector |
| `.admin-section-card.active` | SSE handler checks this |

---

## 6. NICEDMIN COMPONENT MAPPING

| AgriCatch Element | NiceAdmin Component | Reference File |
|---|---|---|
| Topbar | `header#header.fixed-top` | `NiceAdmin/index.html` |
| Sidebar | `aside#admin-sidebar.sidebar` | `NiceAdmin/index.html` |
| KPI Cards | `.card.info-card` | `NiceAdmin/index.html` |
| Charts | `.card` + `<canvas>` | `NiceAdmin/charts-chartjs.html` |
| Tables | `.table.table-bordered.table-hover` | `NiceAdmin/tables-general.html` |
| Modals | `.modal-dialog .modal-content` (CSS-shown via `.open`) | `NiceAdmin/components-modal.html` |
| Chat Drawer | Offcanvas-style — `#admin-chat-drawer.admin-chat-drawer` toggled via `.active` CSS | Custom |
| Slide-over Panels | Same offcanvas-style pattern | Custom |
| Toasts | Custom — injected by admin.js into `#admin-toast-stack` | Custom |
| Tabs (Farmers) | `data-farmers-tab` buttons — NOT Bootstrap tabs (admin.js controls display) | Custom |
| Pagination | `#[x]-pagination` divs — injected by admin.js | Custom |
| Badges | Bootstrap `.badge` + custom `.status-pill` | `NiceAdmin/components-badges.html` |
| Form layouts | Bootstrap grid `row col-md-*` | `NiceAdmin/forms-layouts.html` |

---

## 7. MODAL STRATEGY

All modals use `.open` class (not Bootstrap's `data-bs-toggle`) because `admin.js` is frozen.

```
admin.js calls: modal.classList.add('open')      → shows modal
admin.js calls: modal.classList.remove('open')   → hides modal
```

In `agricatch-admin.css`:
```
.admin-modal-backdrop { display: none; position: fixed; inset: 0; z-index: 9000; ... }
.admin-modal-backdrop.open { display: flex; align-items: center; justify-content: center; }
```

Modals to build:
1. `#admin-confirm-modal` — small confirm dialog
2. `#edit-user-modal` — large user edit form
3. `#create-user-modal` — medium user create form
4. Edit product modal (find exact ID from admin.html)

---

## 8. IMPLEMENTATION STEPS

### Step A — Read remaining admin.html modals
Read lines 700–end of `frontend/admin.html` to capture create-user-modal, edit-product-modal exact IDs and form structure.

### Step B — Create `frontend/css/agricatch-admin.css`
Full AgriCatch override layer. See Section 4 above for requirements.

### Step C — Rebuild `frontend/admin.html`
Structure:
```
<head>
  [vendor CSS links in order]
  [agricatch-admin.css last]
</head>
<body>
  <!-- ══ HEADER ══ -->
  <header id="header" class="header fixed-top d-flex align-items-center">
    [logo + toggle-sidebar-btn + id="admin-mobile-menu-toggle"]
    [search bar with id="admin-search-input" and id="admin-search-toggle"]
    [order-filters with selects]
    [header-nav: chat icon → admin-float-chat-btn wired, profile dropdown with user-name/user-email]
  </header>

  <!-- ══ SIDEBAR ══ -->
  <aside id="admin-sidebar" class="sidebar">
    [brand block with logo]
    <ul class="sidebar-nav" id="sidebar-nav">
      [visit-site-btn]
      <li class="nav-heading">Operations</li>
      [Orders link — sidebar-link data-section="orders"]
      [Customers link — sidebar-link data-section="users"]
      [Products link — sidebar-link data-section="products"]
      <li class="nav-heading">Catalog</li>
      [Categories link — sidebar-link data-section="categories"]
      [Farmers link — sidebar-link data-section="farmers"]
      <li class="nav-heading">System</li>
      [Audit Logs link — sidebar-link data-section="logs"]
      [logout-btn]
    </ul>
  </aside>

  <!-- ══ MAIN CONTENT ══ -->
  <main id="main" class="main">
    <!-- Role sentinel (hidden) -->
    <div class="admin-welcome-banner" style="display:none" aria-hidden="true">...</div>

    <!-- Page title + breadcrumb -->
    <div class="pagetitle">
      <h1 class="page-title">Orders Management</h1>
      <nav><ol class="breadcrumb">...</ol></nav>
    </div>

    <!-- KPI Cards row -->
    <div class="row"> [4 info-cards] </div>

    <!-- Charts row -->
    <div class="row"> [2 chart cards] </div>

    <!-- Section cards (only .active is shown) -->
    <section id="orders" class="admin-section-card active"> ... </section>
    <section id="users" class="admin-section-card"> ... </section>
    <section id="products" class="admin-section-card"> ... </section>
    <section id="farmers" class="admin-section-card"> ... </section>
    <section id="categories" class="admin-section-card"> ... </section>
    <section id="logs" class="admin-section-card"> ... </section>
  </main>

  <!-- ══ SLIDE-OVER PANELS ══ -->
  <aside id="order-detail-panel" class="admin-detail-panel"> ... </aside>
  <aside id="category-detail-panel" class="admin-detail-panel"> ... </aside>

  <!-- ══ CHAT DRAWER ══ -->
  <div id="admin-chat-drawer" class="admin-chat-drawer"> ... </div>

  <!-- ══ FLOAT CHAT BUTTON ══ -->
  <button id="admin-float-chat-btn" ...></button>

  <!-- ══ TOAST STACK ══ -->
  <div id="admin-toast-stack" class="admin-toast-stack"></div>

  <!-- ══ MODALS ══ -->
  [admin-confirm-modal]
  [edit-user-modal]
  [create-user-modal]
  [edit-product-modal]

  <!-- ══ SCRIPTS ══ -->
  [bootstrap.bundle.min.js]
  [chart.js]
  [main.js]
  [format.js]
  [psgc.js]
  [admin-charts.js]
  [chat.js]
  [admin.js]
</body>
```

---

## 9. TESTING CHECKLIST

### Auth
- [ ] No token → redirect `/?login=1`
- [ ] Customer role → redirect `/`
- [ ] Farmer role → redirect `/farmer.html?denied=admin`
- [ ] Staff role → dashboard shows
- [ ] `#user-name` / `#user-email` populate
- [ ] Role recovery overlay works
- [ ] Logout clears token and redirects

### Navigation
- [ ] Each sidebar link shows correct section
- [ ] Active sidebar link highlighted
- [ ] `.page-title` updates on navigation
- [ ] `order-filters` visible only on Orders
- [ ] Search placeholder updates per section
- [ ] `localStorage.adminActiveSection` restored on load
- [ ] Mobile sidebar closes on link click

### KPI Cards
- [ ] All 4 numbers load from `/api/admin/stats`
- [ ] Currency formatting correct on revenue

### Charts
- [ ] Doughnut chart renders
- [ ] Line chart renders
- [ ] Both update on SSE `order.updated`

### Orders
- [ ] Table populates
- [ ] All 3 filters work
- [ ] Search works
- [ ] "View" opens slide-over panel
- [ ] Order detail shows customer / items / farmers
- [ ] Status update saves via `/api/admin/orders/:id/status`
- [ ] Disable/Enable works
- [ ] "Chat" in order detail opens drawer for correct farmer
- [ ] Panel closes
- [ ] Pagination works
- [ ] SSE `order.updated` refreshes table

### Customers
- [ ] Table populates
- [ ] Create User modal opens / submits
- [ ] Edit User modal populates / submits
- [ ] Name auto-fill works
- [ ] PSGC dropdowns cascade
- [ ] Address preview updates
- [ ] Password show/hide works in both modals
- [ ] Role dropdown inline update works
- [ ] Farmer verification toggle works
- [ ] Disable/Enable respects role rules
- [ ] Super Admin badge shown / no edit options

### Products
- [ ] Table populates
- [ ] Edit modal opens / submits
- [ ] Char counter works
- [ ] Image preview works
- [ ] Admin Disable/Enable works

### Farmers
- [ ] Default to Pending tab
- [ ] Pending count badge shows
- [ ] Tab switching shows/hides panels
- [ ] Farmer actions work

### Categories
- [ ] All panels load on first visit (lazy)
- [ ] Category list populates
- [ ] Add / Edit / Enable / Disable / Delete all work
- [ ] Confirm dialog shows for Delete
- [ ] Pending requests list populates
- [ ] Review panel opens / Approve / Decline / Save work
- [ ] Catalog names populate
- [ ] Add / Edit catalog name works
- [ ] `catalog-category-select` populated from categories

### Audit Logs
- [ ] Loads lazily on first section visit
- [ ] Filters work
- [ ] Refresh button reloads
- [ ] SSE `admin.audit` reloads when section active

### Chat
- [ ] Drawer opens / closes
- [ ] Conversation list loads
- [ ] Send message works
- [ ] Unread badge shows/hides
- [ ] SSE `chat.message` refreshes unread count

### Toasts / Confirm
- [ ] Success / error / warning toasts appear and auto-dismiss
- [ ] Confirm modal appears / Cancel works / Confirm works

### Responsive
- [ ] Correct at 1920px / 1440px / 1280px / 1024px
- [ ] Sidebar collapses at 768px
- [ ] Tables scroll horizontally at mobile
- [ ] Modals scrollable at mobile
- [ ] Chat drawer full-width at mobile

---

## 10. DEPLOYMENT VALIDATION

- [ ] All vendor CSS/JS 200 OK in production
- [ ] Bootstrap JS bundle loads
- [ ] Font Awesome loads
- [ ] Chart.js loads
- [ ] Script load order correct (format.js → psgc.js → admin-charts.js → chat.js → admin.js)
- [ ] `window.adminDashboard` instantiates without error
- [ ] Zero JS console errors on load
- [ ] SSE connection establishes
- [ ] All 6 sections show data after login
- [ ] NiceAdmin sidebar toggle does not conflict with admin.js mobile toggle
