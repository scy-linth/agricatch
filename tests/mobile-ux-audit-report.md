# AgriCatch Mobile UX Audit Report

**Date:** 2026-07-16  
**Scope:** Every major page rendered in mobile viewports (320×568 and 390×844, plus desktop comparison).  
**Method:** Playwright full-page screenshots, CSS/HTML review, and computed-style metrics. No production or frontend/backend code was changed.

**Artifacts:**
- Screenshots: `tests/mobile-ui-validation-screenshots/`
- Technical layout data: `tests/mobile-ui-validation-report.json`

## How to read this report

- **Critical:** Blocks a core task or causes visible broken layout on a phone.
- **High:** Causes real usability friction (miss-taps, hard-to-read text, hard-to-reach controls).
- **Medium:** Noticeably hurts the mobile polish/feel, but the task can still be completed.
- **Low:** Minor rough edges that are easy wins.
- **Cosmetic:** Subtle visual-only improvements.

Findings that affect many pages are listed once in the **Global / Design System** section and referenced from each affected page. Page-specific findings are listed under each page.

---

## Global / Design-system findings

### G1 — Touch targets below 44×44 px on mobile

**Severity:** High  
**Affected pages:** All pages that use `styles.css`, `agricatch-polish.css`, `agricatch-admin.css`, `nicemain.css` — this is a global pattern.  
**Evidence:**
- `styles.css`: `.step-number` 40×40, `.role-box-enhanced .role-icon` 40×40, `.icon-btn` 38×38, `.notification-thumb` 38×38, product carousel nav 38×38, cart-close 38×38.
- `agricatch-admin.css`: sidebar toggle 40×40, header nav icons 38×38, notification icon 40×40, chat compose input 38 px, chat send button 38 px, product thumb 40×40.
- `nicemain.css`: back-to-top button 40×40.
- `agricatch-polish.css`: `--uni-btn-height: 38px`, `--uni-input-height: 38px`, category tab buttons 38 px tall.
- Per-page: wishlist remove button 38×38, checkout quantity buttons 32×32, checkout qty input 32 px tall, chat close button 28×28.
**Mobile impact:** Tapping these requires precision; users repeatedly miss small icon-only buttons and narrow inputs.  
**Recommended fix:** Add a mobile-only media query (e.g. `@media (max-width: 767px)`) that bumps interactive targets to `min-height: 44px` / `min-width: 44px` and increases adjacent padding. For circular icon buttons, raise to 44×44 px. Keep desktop sizes unchanged.

### G2 — Input and button heights too small on mobile

**Severity:** High  
**Affected pages:** Forms site-wide (checkout, request-product, customer-account, admin/farmer forms, auth modal, address modal).  
**Evidence:**
- `agricatch-polish.css` defines `--uni-input-height: 38px` and `--uni-btn-height: 38px`.
- `agricatch-admin.css` uses 38 px for `.chat-compose-input` and `.chat-send-btn`.
- `checkout.html` quantity input is 32 px tall.
**Mobile impact:** Hard to tap precisely; thumb users often activate adjacent controls.  
**Recommended fix:** On small screens raise form inputs and primary buttons to `min-height: 44px` (or 48 px for high-consequence actions). This can be done in the existing shared mobile media query without changing desktop.

### G3 — Very small text used for status badges and secondary labels

**Severity:** Medium  
**Affected pages:** Product grids on `index.html`, `wishlist.html`, `farmers.html`, `orders.html`, `farmer.html`.  
**Evidence:**
- Badge font-size is `0.64rem` on desktop, and drops to `0.58rem` below 576 px (`agricatch-polish.css` and `wishlist.html` inline styles). That is ~9–10 px, below the 12 px recommended minimum for body text on mobile.
- `order-card-status`, `order-details-modal-header .order-card-status`, and `farmer.html` product status badges use `0.7rem` (~11 px).
**Mobile impact:** Users with slightly reduced vision or lower-end screens cannot read status labels.  
**Recommended fix:** Set a floor of `font-size: 0.75rem` (12 px) for badges/status labels on mobile, and slightly increase padding so the badge remains easy to read.

### G4 — Cards and modals keep desktop padding on mobile

**Severity:** Low / Medium  
**Affected pages:** `checkout.html`, `orders.html`, `notifications.html`, `wishlist.html`, `farmer.html`, `admin.html`, `request-product.html`, `customer-account.html`.  
**Evidence:**
- `.co-card-body { padding: 1.5rem 1.5rem 1.5rem 1.5rem; }` (`checkout.html`).
- `#orders-main { padding: 1.5rem 1.75rem 3rem; }` (`orders.html`).
- `#notifications-main { padding: 1.5rem 1.75rem 3rem; }` (`notifications.html`).
- `.address-form-floating { padding: 1.5rem; }` (`styles.css`).
- `.modal .modal-body { padding: 1.25rem; }` and `.modal .modal-header { padding: .875rem 1.25rem; }` (`wishlist.html`, `farmer.html`, `chat.html`).
**Mobile impact:** Thick internal padding eats usable screen width on 320–390 px devices, making content feel cramped and increasing vertical scrolling.  
**Recommended fix:** Reduce card/modal-body padding to `1rem` (and modal header to `0.75rem 1rem`) below 576 px. Desktop padding stays at 1.5 rem.

### G5 — Modal/overlay close buttons are small or hard to reach

**Severity:** Medium  
**Affected pages:** Pages with modals (`index.html`, `product.html`, `customer-account.html`, `checkout.html`, `orders.html`, `wishlist.html`, `chat.html`, `notifications.html`, `farmer.html`, `admin.html`).  
**Evidence:**
- `chat.html`: `.modal .close-btn { width: 28px; height: 28px; padding: 4px; }`.
- `farmer.html`: `.product-details-close { font-size: 1.5rem; padding: 0 4px; line-height: 1; }` (no minimum hit area).
- `styles.css`: auth modal and address modal close controls rely on small icon hit areas.
**Mobile impact:** Dismissing a modal is frustrating; users may tap outside instead and trigger accidental actions.  
**Recommended fix:** Give every modal close/dismiss button a 44×44 px minimum hit area on mobile (transparent padding around the visible icon is fine).

### G6 — Sticky header always occupies 60 px, plus floating buttons sit in the bottom-right corner

**Severity:** Low  
**Affected pages:** Dashboards (`admin.html`, `farmer.html`, `admin-backup.html`, `customer-account.html`, `orders.html`, `notifications.html`, `chat.html`, `checkout.html`, `request-product.html`) and `index.html` (floating cart button).  
**Evidence:**
- Dashboard topbars are fixed 60 px (`checkout.html`, `orders.html`, `notifications.html`, `chat.html`, `farmer.html`, `customer-account.html`).
- `index.html` floating cart button is fixed `right: 22px; bottom: 22px;`.
- `styles.css` `.float-cart-btn { width: 50px; height: 50px; }` at mobile.
**Mobile impact:** The header is reasonable, but on short phones (e.g. 568 px height) the floating cart + any bottom nav can cover content. The 50×50 cart button is a good size but its bottom-right placement may cover footer links or “add to cart” content on some screens.  
**Recommended fix:** Add a safe-area padding to `body` or `main` when a floating action button is present, and consider moving the cart FAB up slightly (`bottom: 28–32px`) so it does not overlap the last list item or footer. Ensure the FAB respects `env(safe-area-inset-bottom)`.

### G7 — Off-canvas sidebars/drawers are hidden by default on mobile

**Severity:** Low  
**Affected pages:** Dashboard pages with sidebars (`admin.html`, `farmer.html`, `admin-backup.html`, `customer-account.html`).  
**Evidence:**
- `farmer.html`, `customer-account.html`: `#farmer-sidebar.sidebar { position: fixed; top: 60px; ... }` with `left: -260px` and slides in when `.open`.
- `nicemain.css`: `.sidebar { left: -300px; }` on ≤1199 px.
**Mobile impact:** This is the right pattern, but if the hamburger/toggle is small or not visually obvious, users may not know the navigation exists.  
**Recommended fix:** Increase the sidebar toggle to 44×44 px (see G1), add a visible active state, and consider a bottom tab bar for the 3–5 most-used dashboard sections on phones.

---

## Per-page findings

---

### PAGE: `index.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Hero section is very tall and pushes actionable content below the fold**
- **Severity:** Medium
- **Issue found:** `#home.hero` has `min-height: 100vh` on desktop and remains `min-height: 560px` on ≤991 px and `500px` on ≤576 px. On a 568 px tall iPhone SE this is almost the entire first screen; users must scroll before seeing products.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/index-320x568.png`
- **Recommended fix:** On mobile, set `#home.hero { min-height: auto; padding: 5rem 0 3rem; }` so the hero is sized by content, not by a fixed large height. Keep desktop `100vh`.

**Issue 2 — Hero text hierarchy is heavy for mobile**
- **Severity:** Low
- **Issue found:** Hero `h2` is `2.25rem` at ≤991 px and `1.7rem` at ≤576 px. The line `line-height: 1.08` and tight letter spacing can feel cramped. The body copy under the hero is `1rem`/`0.92rem`, which is fine.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/index-390x844.png`
- **Recommended fix:** Use `clamp()` for the hero heading so it scales smoothly (`clamp(1.7rem, 5vw, 3.15rem)`) and set `line-height: 1.15` on mobile only.

**Issue 3 — Category tab buttons are small touch targets**
- **Severity:** High
- **Issue found:** `#marketplace-filter #global-category-tabs .btn { min-height: 38px; padding: 0.48rem 0.85rem; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/index-390x844.png`
- **Recommended fix:** See **G1** — raise mobile tab buttons to `min-height: 44px` and add horizontal padding.

**Issue 4 — Product grids switch to 2 columns too aggressively**
- **Severity:** Low
- **Issue found:** `#available-grid.products-grid, #preorder-grid.products-grid` become `grid-template-columns: repeat(2, minmax(0, 1fr))` below 576 px. On 320 px each card is ~150 px wide and the product image/info ratio feels cramped.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/index-320x568.png`
- **Recommended fix:** Keep two columns only for ≥360 px; below 360 px use a single column with a larger product image and more comfortable tap targets.

**Issue 5 — Featured carousel navigation arrows are 38×38 px**
- **Severity:** Medium
- **Issue found:** `.carousel-nav { width: 38px; height: 38px; }` at mobile.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/index-390x844.png`
- **Recommended fix:** Increase carousel arrows to at least 44×44 px on mobile and add a larger invisible hit area if the visual size must stay small.

---

### PAGE: `product.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Product detail modal may be too wide on small screens**
- **Severity:** Medium
- **Issue found:** `.product-details-content { width: calc(100% - 2rem); max-width: 640px; }`. On a 320 px device this leaves 1 rem margin each side; the content area is only ~288 px wide. Long product names and prices can feel cramped.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/product-320x568.png`
- **Recommended fix:** For ≤360 px, reduce side margins to `0.5rem` and set `max-width: 100%` so the modal nearly fills the width, while keeping `border-radius` for visual polish.

**Issue 2 — Close button for product modal has no guaranteed hit area**
- **Severity:** Medium
- **Issue found:** `.product-details-close { background: none; border: none; font-size: 1.5rem; padding: 0 4px; }`. The visible area is about 24 px.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/product-390x844.png`
- **Recommended fix:** Add `min-width: 44px; min-height: 44px;` to the close control on mobile, keeping the visual icon centered.

**Issue 3 — Marketplace filter bar stacks but keeps large gaps**
- **Severity:** Low
- **Issue found:** `.marketplace-filter-bar { flex-direction: column; align-items: stretch; }` below 768 px. The change is correct, but child inputs may keep desktop `min-height: 44px` while some buttons remain 38 px, creating visual inconsistency.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/product-390x844.png`
- **Recommended fix:** When stacked, give every filter control the same 44 px height and consistent 12 px vertical spacing.

---

### PAGE: `farmers.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Farmer cards likely reuse the 2-column product-card grid**
- **Severity:** Low
- **Issue found:** The page uses the same product-grid rules as `index.html` (`agricatch-polish.css` / `styles.css`). At 320 px farmer cards can be narrow and their profile image + name may wrap awkwardly.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/farmers-320x568.png`
- **Recommended fix:** If the same 2-column grid is used, consider a single-column farmer card list below 360 px with a horizontal layout (avatar left, info right) for better readability and tap targets.

**Issue 2 — Search/filter controls may not share a consistent height**
- **Severity:** Low
- **Issue found:** Same filter-bar implementation as `product.html`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/farmers-390x844.png`
- **Recommended fix:** Unify control heights and tap areas on mobile (see G1/G2).

---

### PAGE: `customer-account.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Profile overview card stacks but may waste vertical space**
- **Severity:** Low
- **Issue found:** `.profile-overview-card { flex-direction: column; text-align: center; }` below 768 px. Centering is fine, but the avatar + large name + metadata can create a tall block before actionable content.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/customer-account-390x844.png`
- **Recommended fix:** Reduce vertical padding inside the card to `1rem` on mobile and align the avatar + primary name row horizontally when possible to save height.

**Issue 2 — Sidebar toggle and header nav icons are 38–40 px**
- **Severity:** High
- **Issue found:** Same dashboard header pattern as `farmer.html`/`admin.html`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/customer-account-320x568.png`
- **Recommended fix:** Increase mobile header controls to 44×44 px (see G1).

**Issue 3 — Address form uses 38 px inputs and the modal keeps desktop padding**
- **Severity:** Medium
- **Issue found:** `.address-form-floating .form-input { padding: 0.875rem; }` gives ~38 px height; `.address-form-floating { padding: 1.5rem; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/customer-account-390x844.png`
- **Recommended fix:** Raise inputs to `min-height: 44px` and reduce modal padding to `1rem` on mobile.

---

### PAGE: `checkout.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Quantity stepper buttons are only 32×32 px**
- **Severity:** High
- **Issue found:** `.co-qty-btn { width: 32px; height: 32px; }` and `.co-qty-remove { width: 32px; height: 32px; }`. The quantity input itself is `32px` tall and `48px` wide.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/checkout-390x844.png`
- **Recommended fix:** Increase stepper buttons to at least 40×40 px (44×44 ideal) and the quantity input to `44px` tall on mobile. This is one of the most important checkout interactions on a phone.

**Issue 2 — Card footer buttons stack vertically with the same padding**
- **Severity:** Medium
- **Issue found:** `.co-card-footer { flex-direction: column; gap: .5rem; }` below 575 px, but buttons keep desktop padding. Stacked full-width buttons need more vertical breathing room.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/checkout-320x568.png`
- **Recommended fix:** Increase `gap` to `0.75rem` on mobile and set primary action button height to `48px` for thumbs.

**Issue 3 — Order item image is 75×75 px, but the text row beside it can truncate**
- **Severity:** Low
- **Issue found:** `.co-item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`. Product names are cut off with no way to read them.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/checkout-390x844.png`
- **Recommended fix:** Allow product names to wrap to 2 lines on mobile (`-webkit-line-clamp: 2` with `display: -webkit-box`) and show the full name in a tooltip/title.

**Issue 4 — Checkout topbar tagline is 0.7rem and low contrast**
- **Severity:** Low
- **Issue found:** `.checkout-topbar .tagline { font-size: .7rem; color: rgba(255,255,255,.8); }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/checkout-390x844.png`
- **Recommended fix:** Increase tagline to at least `0.8rem` and use `rgba(255,255,255,0.95)` for better contrast.

---

### PAGE: `orders.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Order cards use small status badges and tight padding**
- **Severity:** Medium
- **Issue found:** `order-card-status` is `0.7rem`, badges have `padding: 0.25rem 0.5rem`. Combined with `.co-card-body { padding: 1.5rem; }` the card can feel cramped on a phone.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/orders-390x844.png`
- **Recommended fix:** Increase badge font-size to `0.75rem` and card body padding to `1rem` on mobile.

**Issue 2 — Order item rows use small quantity/remove controls**
- **Severity:** High
- **Issue found:** The order detail modal reuses the same 32×32 px quantity buttons and remove controls from `checkout.html`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/orders-390x844.png`
- **Recommended fix:** Apply the same 44×44 px mobile sizing to review actions.

**Issue 3 — Tab bar is not visible in the empty-state screenshots**
- **Severity:** Low
- **Issue found:** With no orders loaded the tab bar may be hidden or empty. First-time mobile users may not know how to switch between active/delivered/cancelled tabs.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/orders-320x568.png`
- **Recommended fix:** Always render the tab bar, even when empty, and use a clear empty-state message below it.

---

### PAGE: `wishlist.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Remove-from-wishlist button is 38×38 px**
- **Severity:** High
- **Issue found:** `#wishlist .remove-btn { width: 38px; height: 38px; min-height: 38px; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/wishlist-390x844.png`
- **Recommended fix:** Increase to 44×44 px and ensure the hit area extends beyond the visible icon.

**Issue 2 — Product grid switches to 2 columns, making cards short and text small**
- **Severity:** Medium
- **Issue found:** `.wishlist-grid { grid-template-columns: repeat(2, 1fr); }` below 768 px. At 320 px each card is ~150 px wide; product info uses `font-size: 0.58rem` for badges and small prices.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/wishlist-320x568.png`
- **Recommended fix:** Use a single column below 360 px, or keep two columns but increase card padding and badge font-size (see G3).

**Issue 3 — Wishlist topbar keeps desktop padding on mobile**
- **Severity:** Low
- **Issue found:** `.wishlist-topbar { padding: 0 .75rem; }` at ≤767 px is acceptable, but the overall `#wishlist` card padding may still be `1.5rem`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/wishlist-390x844.png`
- **Recommended fix:** Reduce `#wishlist` card padding to `1rem` on mobile.

---

### PAGE: `chat.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Compose bar input and send button are 38 px tall**
- **Severity:** High
- **Issue found:** `.chat-compose-input { height: 38px; }` and `.chat-send-btn { height: 38px; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/chat-390x844.png`
- **Recommended fix:** Raise both to `min-height: 44px` on mobile.

**Issue 2 — Modal close button is only 28×28 px**
- **Severity:** Medium
- **Issue found:** `.modal .close-btn { width: 28px; height: 28px; padding: 4px; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/chat-390x844.png`
- **Recommended fix:** Increase close target to 44×44 px with transparent padding.

**Issue 3 — Conversation list may show unread badge with tiny dimensions**
- **Severity:** Low
- **Issue found:** `.conversation-item .unread-badge { min-width: 28px; height: 20px; font-size: 0.85rem; }`. The height is acceptable but the badge text can feel cramped.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/chat-320x568.png`
- **Recommended fix:** Make the badge at least 22 px tall and use `font-size: 0.8rem` on mobile.

---

### PAGE: `notifications.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Notification thumbnail is 38×38 px**
- **Severity:** Low
- **Issue found:** `.notification-thumb { width: 38px; height: 38px; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/notifications-390x844.png`
- **Recommended fix:** Increase notification thumbnails to 48×48 px on mobile for better visual scanning.

**Issue 2 — Main area top padding is large relative to content density**
- **Severity:** Low
- **Issue found:** `#notifications-main { padding: 1.5rem 1.75rem 3rem; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/notifications-320x568.png`
- **Recommended fix:** Reduce to `1rem 0.75rem 2.5rem` on mobile.

---

### PAGE: `request-product.html`

**STATUS:** UX improvements needed  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Form uses shared 38 px input/button variables**
- **Severity:** High
- **Issue found:** The page uses `admin-section-card` and shared form styles; inputs/buttons are 38 px tall.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/request-product-390x844.png`
- **Recommended fix:** Apply mobile `min-height: 44px` to all inputs and buttons (see G2).

**Issue 2 — Main container is centered with 2rem vertical margin**
- **Severity:** Low
- **Issue found:** `main { max-width: 760px; margin: 2rem auto; padding: 0 1rem; }`. On a phone the `2rem` top margin plus the 60 px header pushes the form start below the fold.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/request-product-320x568.png`
- **Recommended fix:** On mobile set `margin-top: 1rem` or `margin: 1rem auto` and reduce card padding to `1rem`.

**Issue 3 — Section header uses small back/close area**
- **Severity:** Low
- **Issue found:** The header is a flex row with a close/back button; the hit area likely relies on the icon size.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/request-product-390x844.png`
- **Recommended fix:** Ensure the close/back control is 44×44 px.

---

### PAGE: `404.html`

**STATUS:** Needs mobile fix  
**Desktop Impact:** Desktop is fine.

**Issue 1 — Decorative 404 image overflows the viewport on small phones**
- **Severity:** High
- **Issue found:** `.error-404 img { max-width: 400px; }` overrides `.img-fluid`. At 320 px the image is 400 px wide, producing 40 px horizontal scroll.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/404-320x568.png`
- **Recommended fix:** Change `.error-404 img { max-width: 100%; height: auto; }`.

**Issue 2 — 404 heading is 8rem on all screen sizes**
- **Severity:** Medium
- **Issue found:** `.error-404 h1 { font-size: 8rem; }` has no mobile override. On a 320 px screen the digits are enormous and feel unbalanced.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/404-320x568.png`
- **Recommended fix:** Add `@media (max-width: 576px) { .error-404 h1 { font-size: 5rem; } }` (or `clamp(4rem, 15vw, 8rem)`).

**Issue 3 — 404 subheading and button keep desktop spacing**
- **Severity:** Low
- **Issue found:** `h2 { font-size: 2rem; }` and `padding: 2rem` on `.error-404`. The large padding wastes vertical space on short screens.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/404-390x844.png`
- **Recommended fix:** Reduce padding to `1rem` on mobile and scale the `h2` down to `1.5rem`.

---

### PAGE: `admin.html`

**STATUS:** Could not fully render authenticated UI; findings based on design-system review  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Header controls are 38–40 px (touch target issue)**
- **Severity:** High
- **Issue found:** `agricatch-admin.css`: `.admin-sidebar-toggle-btn` 40×40, `.header-nav .nav-link.nav-icon` 38×38.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/admin-320x568.png` (redirect/login state)
- **Recommended fix:** Increase to 44×44 px on mobile only.

**Issue 2 — Tables still show a desktop wrapper on small screens**
- **Severity:** Medium
- **Issue found:** `styles.css` hides `.admin-table-wrapper` below 480 px and shows `.admin-table-card`, but the breakpoint is very late (480 px). On 576–480 px horizontal scrolling may still be required.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/admin-390x844.png` (login state)
- **Recommended fix:** Switch to card layout at 768 px or below, and ensure each card row has 44 px minimum row actions.

**Issue 3 — Modal content max-width is 620px with 1.5rem body padding**
- **Severity:** Low
- **Issue found:** `.modal .modal-content { max-width: 620px; }` and `.modal .modal-body { padding: 1.25rem; }`.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/admin-desktop.png`
- **Recommended fix:** Reduce modal side margin to `0.5rem` and body padding to `1rem` below 576 px.

---

### PAGE: `farmer.html`

**STATUS:** Could not fully render authenticated UI; findings based on design-system review  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Same header/touch-target issues as admin**
- **Severity:** High
- **Issue found:** `farmer.html` uses `agricatch-admin.css`; icons and toggles are 38–40 px.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/farmer-320x568.png` (redirect/login state)
- **Recommended fix:** Apply G1/G2 mobile sizing.

**Issue 2 — Detail panel is 100% width on mobile, but close button is an icon only**
- **Severity:** Medium
- **Issue found:** `.admin-detail-panel` becomes `width: 100%` below 768 px. The `.panel-close` is positioned absolutely with no minimum hit area.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/farmer-390x844.png` (login state)
- **Recommended fix:** Ensure the panel close/dismiss area is at least 44×44 px and add a left-swipe or edge-drag gesture for closing.

**Issue 3 — Subscription tabs scroll horizontally**
- **Severity:** Low
- **Issue found:** `@media (max-width: 768px) { .subscription-tabs { overflow-x: auto; white-space: nowrap; } }`. Horizontal scroll for tabs is acceptable but not ideal.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/farmer-desktop.png`
- **Recommended fix:** Consider a vertically stacked or dropdown subscription selector on mobile to avoid hiding options.

**Issue 4 — Overview stat grid becomes 2 columns at ≤1200px**
- **Severity:** Low
- **Issue found:** `.farmer-overview-stats-inline { grid-template-columns: repeat(2, minmax(0, 1fr)); }` at ≤1200px. On a phone the stat cards may be short and the numeric labels small.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/farmer-desktop.png`
- **Recommended fix:** Below 576 px use a single-column stat stack with larger numbers and clear labels.

---

### PAGE: `admin-backup.html`

**STATUS:** Could not render authenticated UI; screenshots show login/redirect state  
**Desktop Impact:** No changes requested for desktop.

**Issue 1 — Same dashboard touch-target and padding issues**
- **Severity:** High
- **Issue found:** The backup admin page relies on the same `agricatch-admin.css` / `styles.css` patterns: 38 px header icons, 38 px inputs, and 1.25–1.5rem modal/card padding.
- **Screenshot:** `tests/mobile-ui-validation-screenshots/admin-backup-320x568.png`
- **Recommended fix:** Apply the same mobile-only touch-target and padding overrides as `admin.html` and `farmer.html`.

---

## Summary by priority

### Critical
_None of the tested pages have a critical mobile blocker, but the 404 image overflow is the closest to a broken mobile experience (reported as High)._

### High
1. **Global:** Touch targets below 44×44 px across the site (icon buttons, nav icons, carousel arrows, quantity buttons, remove buttons, chat send, close controls).
2. **Global:** Inputs and primary action buttons are 38 px tall on mobile; should be 44–48 px.
3. **404.html:** Decorative image causes horizontal overflow on 320–390 px phones.
4. **checkout.html / orders.html:** 32×32 px quantity stepper buttons are the smallest and most-used interactive elements.

### Medium
1. **Global:** Badge/status labels drop to 0.58–0.7rem (~9–11 px) on mobile.
2. **Global:** Cards and modals keep 1.5rem padding on mobile, wasting width.
3. **index.html:** Hero is very tall (500–560 px) and pushes content below the fold.
4. **index.html / wishlist.html / farmers.html:** Product/farmer grids are 2 columns on small screens, creating cramped cards.
5. **404.html:** 8rem heading is too large and unbalanced for mobile.
6. **admin.html / farmer.html / admin-backup.html:** Tables may still scroll horizontally between 480–768 px; detail panels and modals need larger close hit areas.

### Low
1. **Global:** Modal/overlay close buttons vary in size and many are under 44 px.
2. **Global:** Sticky 60 px header plus floating cart button can cover content on short phones.
3. **checkout.html:** Product name is forced to one line and truncated.
4. **checkout.html:** Topbar tagline is 0.7rem with slightly low contrast.
5. **notifications.html:** Thumbnails are 38×38 px and notification padding is large.
6. **request-product.html:** 2rem top margin pushes the form below the fold.
7. **farmer.html:** Horizontal-scroll subscription tabs and 2-column stat grid.

### Cosmetic
1. **index.html:** Hero heading could scale more smoothly with `clamp()` instead of three fixed breakpoints.
2. **Global:** Slight visual inconsistency between control heights on stacked filter bars.

---

## Recommended next steps

1. Create a single mobile-only override file or append a `@media (max-width: 767px)` block at the end of `agricatch-polish.css` and `agricatch-admin.css` to:
   - Raise `min-height` of buttons, inputs, and icon targets to `44px`.
   - Reduce card/modal padding to `1rem`.
   - Set a `font-size` floor of `0.75rem` for badges and `0.9rem` for secondary labels.
2. Fix `404.html` image and heading overflow immediately (smallest, highest-impact fix).
3. Re-run this mobile validation after any changes with the same Playwright setup to confirm horizontal overflow, touch target sizes, and visual hierarchy are resolved.
4. Re-validate `admin.html`, `farmer.html`, and `admin-backup.html` with a valid authenticated backend session so the populated dashboards can be reviewed for table/modal behavior and real mobile usability.
