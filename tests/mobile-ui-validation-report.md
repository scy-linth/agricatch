# AgriCatch Mobile UI Validation Report

**Date:** 2026-07-16  
**Tool:** Playwright (Chromium, headless)  
**Viewports tested:** 320x568, 360x800, 375x812, 390x844, 414x896, 430x932, and desktop 1280x720 (for comparison)  
**Screenshots folder:** `tests/mobile-ui-validation-screenshots/`  
**Raw data:** `tests/mobile-ui-validation-report.json`

## Executive summary

The public/marketing pages (`index.html`, `product.html`, `farmers.html`, `404.html`) and the authentication-dependent customer pages (`checkout.html`, `orders.html`, `wishlist.html`, `chat.html`, `notifications.html`, `request-product.html`, `customer-account.html`, `clear_cache.html`, `clear_ui_orders.html`) were rendered, captured, and measured. No horizontal overflow, cut-off inputs, clipped dropdowns, broken tables, or overflowing modals were detected on those pages except for the `404.html` decorative image, which overflows the viewport on the smallest screens.

The dashboard/portal pages (`admin.html`, `farmer.html`, `admin-backup.html`) require a valid backend JWT and an active `/api/auth/profile` session. With the available test credentials not working in the local backend and without modifying application code, Playwright could not retain the authenticated document context long enough to run DOM-level checks; the execution context was destroyed by a client-side navigation (likely an auth redirect). Full-page screenshots were still captured for manual review.

## Per-page findings

---

### PAGE: `404.html`

**STATUS:** FAIL  
**Desktop Impact:** The 404 page is clean on desktop (no horizontal scroll, no overflowing elements).  
**Issue Found:** The decorative 404 image (`7486754.png`) is rendered at 400 px wide on mobile viewports because `.error-404 img` sets `max-width: 400px`, overriding Bootstrap's `.img-fluid` (`max-width: 100%`). At 320x568 the element is 400 px wide while the viewport is 320 px, producing a 40 px horizontal overflow. The same image overflows at 360x800 (20 px), 375x812 (13 px), and 390x844 (5 px); it is safe at 414x896 and up.  
**Severity:** Medium  
**Screenshot(s):**
- `tests/mobile-ui-validation-screenshots/404-320x568.png`
- `tests/mobile-ui-validation-screenshots/404-360x800.png`
- `tests/mobile-ui-validation-screenshots/404-375x812.png`
- `tests/mobile-ui-validation-screenshots/404-390x844.png`
- `tests/mobile-ui-validation-screenshots/404-desktop.png`  
**Recommended Fix:** Change `.error-404 img` in `frontend/404.html` to use `max-width: 100%; height: auto;` (or remove the `max-width: 400px` rule and rely on the `.img-fluid` utility). This preserves the desktop layout while making the image scale down on phones.

---

### PAGE: `index.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None. A floating cart button is present in the bottom-right corner but stays inside the viewport and does not cause overflow.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/index-*.png`  
**Recommended Fix:** None.

---

### PAGE: `product.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/product-*.png`  
**Recommended Fix:** None.

---

### PAGE: `farmers.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/farmers-*.png`  
**Recommended Fix:** None.

---

### PAGE: `checkout.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/checkout-*.png`  
**Recommended Fix:** None.

---

### PAGE: `orders.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/orders-*.png`  
**Recommended Fix:** None.

---

### PAGE: `wishlist.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/wishlist-*.png`  
**Recommended Fix:** None.

---

### PAGE: `chat.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None. A floating action button is present but stays within the viewport.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/chat-*.png`  
**Recommended Fix:** None.

---

### PAGE: `notifications.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/notifications-*.png`  
**Recommended Fix:** None.

---

### PAGE: `request-product.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/request-product-*.png`  
**Recommended Fix:** None.

---

### PAGE: `customer-account.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected at any viewport, including desktop.  
**Issue Found:** None. A floating action button is present but stays within the viewport.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/customer-account-*.png`  
**Recommended Fix:** None.

---

### PAGE: `clear_cache.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/clear_cache-*.png`  
**Recommended Fix:** None.

---

### PAGE: `clear_ui_orders.html`

**STATUS:** PASS  
**Desktop Impact:** No horizontal scroll or overflowing elements detected.  
**Issue Found:** None.  
**Severity:** None  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/clear_ui_orders-*.png`  
**Recommended Fix:** None.

---

### PAGE: `admin.html`

**STATUS:** UNABLE TO VALIDATE  
**Desktop Impact:** DOM-level checks could not be completed. A full-page screenshot was still captured for each viewport for manual review.  
**Issue Found:** Playwright's `page.evaluate` failed with "Execution context was destroyed, most likely because of a navigation". This happens because `admin.html`/`admin.js` performs a client-side auth/session check and navigates away when the token/session is rejected.  
**Severity:** N/A  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/admin-*.png`  
**Recommended Fix:** Re-run this validation with a valid backend JWT (or disable auth checks in a dedicated test environment) so the dashboard shell can be rendered and measured. No frontend code change is recommended based on this finding alone.

---

### PAGE: `farmer.html`

**STATUS:** UNABLE TO VALIDATE  
**Desktop Impact:** DOM-level checks could not be completed. Full-page screenshots were captured for manual review.  
**Issue Found:** Same as `admin.html`: the page's auth/session logic caused a navigation that destroyed the execution context before DOM checks could run.  
**Severity:** N/A  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/farmer-*.png`  
**Recommended Fix:** Re-run with a valid farmer JWT against the backend so the farmer dashboard can be validated. No frontend code change is recommended based on this finding alone.

---

### PAGE: `admin-backup.html`

**STATUS:** UNABLE TO VALIDATE  
**Desktop Impact:** DOM-level checks could not be completed. Full-page screenshots were captured for manual review.  
**Issue Found:** Same auth/navigation issue prevented the validation script from measuring the rendered layout.  
**Severity:** N/A  
**Screenshot(s):** `tests/mobile-ui-validation-screenshots/admin-backup-*.png`  
**Recommended Fix:** Re-run with valid admin credentials or in a test environment with auth checks disabled.

---

## Methodology notes

- The frontend was served from `http://localhost:8080` (Python `http.server`).
- Pages requiring authentication were seeded with a synthetically generated JWT in `localStorage` so the client-side `<head>` auth guard would not immediately redirect. The token was intentionally unsigned (`alg: none`) and contained only a `role` claim.
- Dashboard pages (`admin.html`, `farmer.html`, `admin-backup.html`) additionally call the backend `auth/profile` endpoint. Because no valid backend session was available, the application navigated away during `window.onload`/script execution, making it impossible to run DOM-level checks without modifying the app or mocking the API.
- Each viewport received a full-page screenshot and a programmatic check for horizontal scrolling, overflowing elements/images/inputs, tables requiring horizontal scroll, modals exceeding the screen, sidebar/navbar issues, footer overlap, clipped dropdowns, and floating buttons.

## Recommendation summary

1. **Fix `404.html` image overflow** — the only genuine mobile regression found in this run.
2. **Re-validate `admin.html`, `farmer.html`, and `admin-backup.html`** under an authenticated backend session so dashboard-specific mobile issues (tables, modals, sidebars) can be measured.
3. Keep monitoring the floating cart/chat buttons on `index.html`, `customer-account.html`, and `chat.html`; they are currently positioned inside the viewport, but content overlap should be manually confirmed from the screenshots.
