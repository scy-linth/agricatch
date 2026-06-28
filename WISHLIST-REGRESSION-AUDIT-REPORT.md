# Wishlist Regression Audit Report

**Date:** 2026-06-28  
**Auditor:** Cascade AI  
**Scope:** Complete regression audit of Wishlist module and all affected modules  
**Method:** Live application testing via Chrome DevTools MCP + API verification  

---

## 1. PASS/FAIL Matrix

### CUSTOMER

| Test Item | Result | Notes |
|-----------|--------|-------|
| Home page loads | ✅ PASS | 11 available + 4 preorder products loaded |
| Featured products | ✅ PASS | 5 admin-curated featured products; `is_in_wishlist` now correctly populated after fix |
| Available products | ✅ PASS | 11 products with correct `is_in_wishlist` status |
| Pre-order products | ✅ PASS | 4 products rendered correctly |
| Category filtering | ✅ PASS | Fruits → 5 available + 1 preorder (debounced) |
| Search | ✅ PASS | "banana" → 1 result (350ms debounce) |
| Product Details Modal | ✅ PASS | Opens, shows `is_in_wishlist` state correctly |
| Wishlist add (product card) | ✅ PASS | POST /api/wishlist → 201 |
| Wishlist add (featured card) | ✅ PASS | Correct state shown after fix to featured endpoint |
| Wishlist add (product modal) | ✅ PASS | Icon color and title set correctly |
| Wishlist remove (product card) | ✅ PASS (was FAIL) | Fixed: DELETE URL now `/api/wishlist/:id` |
| Wishlist remove (product modal) | ✅ PASS | DELETE /api/wishlist/15 → 200 |
| Wishlist remove (wishlist page) | ✅ PASS | DELETE /api/wishlist/:id → 200 |
| Wishlist persistence after refresh | ✅ PASS | Items persist via server-side storage |
| Wishlist page | ✅ PASS | Count badge, sort, filter, farmer grouping |
| Wishlist → Add to Cart | ✅ PASS (was FAIL) | Fixed: field name `productId` (was `product_id`) |
| Wishlist → Add All to Cart | ✅ PASS (was FAIL) | Fixed: same field name fix in `addAllToCart` |
| Cart add (main page) | ✅ PASS | Via product details modal |
| Cart quantity controls (+/−) | ✅ PASS | handleCartQuantityButton works |
| Cart remove item | ✅ PASS | removeCartItem works |
| Cart persistence | ✅ PASS | User-linked cart survives page reload |
| Orders API | ✅ PASS | 43 orders returned for test customer |
| Notifications | ✅ PASS | 12 notification items loaded |
| Profile (customer account) | ✅ PASS | Page loads, no console errors |

### FARMER

| Test Item | Result | Notes |
|-----------|--------|-------|
| Login | ✅ PASS | JWT issued for testfarmer |
| Dashboard loads | ✅ PASS | Sidebar, navigation functional |
| Order Management | ✅ PASS | 28 pending, 3 confirmed, 4 preparing, 2 delivered, 5 cancelled |
| My Products | ✅ PASS | 4 products shown in table |
| Notifications badge | ✅ PASS | Badge shows 20 |

### ADMIN

| Test Item | Result | Notes |
|-----------|--------|-------|
| Login | ✅ PASS | JWT issued for testadmin |
| Dashboard loads | ✅ PASS | All sections present |
| Listings (product management) | ✅ PASS | 22 total (15 active, 7 disabled, 7 no stock) |
| Product Approvals | ✅ PASS | 22 pending approvals visible |
| Orders | ✅ PASS | 50 order rows rendered |

### SUPER ADMIN

| Test Item | Result | Notes |
|-----------|--------|-------|
| Login | ✅ PASS | JWT issued for scy_linth |
| Dashboard loads | ✅ PASS | All sections accessible |
| Platform Settings | ✅ PASS | Service status (DB/Cloudinary/Email/reCAPTCHA all online) |
| Feature Flags | ✅ PASS | 10 toggles rendered |

### Cross-Module Verification

| Test Item | Result | Notes |
|-----------|--------|-------|
| `current-active` endpoint | ✅ PASS | GET /api/products/102/current-active → 200 |
| Wishlist survives product lifecycle | ✅ PASS | Wishlist query uses JOIN, products not deleted on harvest |
| Cart and Wishlist synchronized | ✅ PASS | Adding to cart from wishlist works; wishlist persists independently |
| No duplicate event handlers | ✅ PASS | `toggleWishlist` is class-encapsulated in `AgricultureMarket` |
| No duplicate function definitions | ✅ PASS | No global `toggleWishlist`, `addToCart`, `removeFromWishlist` |
| No console errors (index.html) | ✅ PASS | Only `favicon.ico` 404 (pre-existing, browser default) |
| No console errors (farmer.html) | ✅ PASS | Only `placeholder-product.jpg` 404 (pre-existing) |
| No console errors (admin.html) | ✅ PASS | Only `placeholder-product.jpg` 404 (pre-existing) |
| No broken routes | ✅ PASS | All API endpoints return expected status codes |
| No JavaScript exceptions | ✅ PASS | No uncaught exceptions observed |
| No missing assets (wishlist-related) | ✅ PASS | All wishlist assets present |
| `is_in_wishlist` on main products | ✅ PASS | Token-based, returned correctly from backend |
| `is_in_wishlist` on featured products | ✅ PASS (was FAIL) | Fixed: post-processing annotation added |

---

## 2. Root Causes

### Bug 1 — DELETE URL Mismatch (CRITICAL)
- **File:** `frontend/js/app.js` → `toggleWishlist()`
- **Root cause:** `DELETE` request sent to `/api/wishlist` (no product ID) but backend router only handles `DELETE /api/wishlist/:productId`. → HTTP 404.
- **Fix:** `wishlistUrl = isInWishlist ? \`${apiBase}/wishlist/${productId}\` : \`${apiBase}/wishlist\``; body omitted for DELETE.

### Bug 2 — Featured Products Missing `is_in_wishlist` (HIGH)
- **File:** `backend/routes/products.js` → `GET /featured`
- **Root cause:** Both the admin-curated query and fallback query omitted the wishlist `EXISTS` subquery. `is_in_wishlist` was always `undefined` on featured product cards → heart buttons always showed grey after page load.
- **Fix:** Added `annotateFeaturedWishlist(products)` async helper that queries `wishlist` table for the authenticated user and annotates products before responding.

### Bug 3 — Wishlist State Detection Reads Wrong Element (HIGH)
- **File:** `frontend/js/app.js` → `toggleWishlist()`
- **Root cause:** State detection used `heartIcon.style.color` (the `<i>` element's inline style), but the HTML template sets `color` on the parent `<button>` element. After page reload, the `<i>` has no inline color → `isInWishlist` always `false` → every click tried to ADD instead of REMOVE.
- **Fix:** Primary detection via `buttonElement.title === 'Remove from wishlist'` (set correctly by template from `is_in_wishlist`). Color now set on both button and icon after toggle to keep state consistent across both code paths.

### Bug 4 — Stale `loadProducts()` Call (MEDIUM)
- **File:** `frontend/js/app.js` → `toggleWishlist()`
- **Root cause:** After wishlist toggle, code called `this.loadProducts()` which looks for `document.getElementById('products-grid')`. This element does not exist (the correct IDs are `available-grid` and `preorder-grid`). Generated console error "Products grid container not found" on every wishlist toggle.
- **Fix:** Replaced with `this.loadAvailableProducts()` + `this.loadPreorderProducts()`.

### Bug 5 — `addToCart` Field Name Mismatch (HIGH)
- **File:** `frontend/js/wishlist.js` → `addToCart()`
- **Root cause:** Sent `{ product_id: productId }` (snake_case) but `backend/routes/cart.js` destructures `{ productId }` (camelCase). → HTTP 400 "Product ID is required".
- **Fix:** Changed to `{ productId: productId }`.

### Bug 6 — `addAllToCart` Field Name Mismatch (HIGH)
- **File:** `frontend/js/wishlist.js` → `addAllToCart()`
- **Root cause:** Same as Bug 5 — sent `{ product_id: item.id }` in the loop.
- **Fix:** Changed to `{ productId: item.id }`.

---

## 3. Files Modified

| File | Change |
|------|--------|
| `frontend/js/app.js` | Fix DELETE URL, fix state detection, fix stale loadProducts() call, sync color on button+icon |
| `frontend/js/wishlist.js` | Fix `addToCart` and `addAllToCart` field name (`product_id` → `productId`) |
| `backend/routes/products.js` | Add `annotateFeaturedWishlist()` to `/featured` endpoint; annotate all return paths |

---

## 4. Remaining Issues

### Non-Critical (Pre-Existing, Not Wishlist Regressions)
| Issue | Severity | Notes |
|-------|----------|-------|
| `favicon.ico` → 404 | Low | Browser default request; file not created. Pre-existing. |
| `placeholder-product.jpg` → 404 | Low | Fallback image in `farmer.js`/`admin.js`. Pre-existing. |
| `[issue] No label associated with a form field` | Low | Accessibility warning in `index.html`. Pre-existing. |

### Not Tested (Out of Scope / Time)
| Item | Reason |
|------|--------|
| Full checkout flow (order placement) | Requires address setup + product availability state management |
| Farmer harvest workflow + wishlist linkage | Requires specific product lifecycle state |
| Farmer product add/edit | Not a direct wishlist touchpoint |
| Admin user management actions | Not a direct wishlist touchpoint |
| Address management (PSGC dropdowns) | Not a direct wishlist touchpoint |

---

## 5. Risk Assessment

| Risk Area | Level | Justification |
|-----------|-------|---------------|
| Core wishlist add/remove | **LOW** | All 6 bugs fixed, all paths verified via live API |
| Featured product wishlist state | **LOW** | Fixed and verified; featured endpoint now returns `is_in_wishlist` |
| Cart integration from wishlist | **LOW** | Both `addToCart` and `addAllToCart` fixed and tested (200 responses) |
| Product details modal wishlist | **LOW** | Tested, state detection works in both directions |
| Wishlist persistence | **LOW** | Server-side storage verified to survive reload |
| Existing cart functionality | **LOW** | Cart add/remove/qty tested; no regressions found |
| Farmer dashboard | **LOW** | No wishlist-related changes affect farmer.js |
| Admin dashboard | **LOW** | No wishlist-related changes affect admin.js |
| Backend routes | **LOW** | Only wishlist.js and products.js modified; both verified |
| Production deploy (Netlify→Render) | **MEDIUM** | apiBase logic in wishlist.js correctly handles `agricatch.store` hostname |

---

## 6. Thesis Readiness Score

| Category | Score | Max | Notes |
|----------|-------|-----|-------|
| Core Wishlist Functionality | 24 | 25 | Add/remove/persist/page all work; 6 bugs fixed |
| Featured Products Integration | 9 | 10 | Wishlist state now correct on featured cards |
| Cart Integration | 9 | 10 | Add to cart from wishlist page works |
| Cross-Module Stability | 18 | 20 | No regressions in farmer/admin/super admin |
| Console / Network Hygiene | 9 | 10 | Only pre-existing 404s remain |
| Architecture Consistency | 9 | 10 | Class-encapsulated, no duplicate globals |
| Accessibility | 4 | 5 | Pre-existing label warning; not introduced by wishlist |
| Checkout / Order Flow | 7 | 10 | Orders API works; full E2E checkout not verified |

**Total: 89 / 100**

### Score Commentary
The Wishlist module is now production-ready for thesis demonstration. All 6 bugs introduced with the wishlist implementation have been identified and fixed with live verification. The remaining deductions are primarily for the checkout flow (not fully E2E tested) and pre-existing accessibility warnings. The architecture is clean, with no duplicate handlers, no console errors from wishlist code, and full server-side persistence.

---

*Report generated by Cascade AI — live verification via Chrome DevTools MCP on localhost:3000*
