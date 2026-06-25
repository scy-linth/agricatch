# Landing Page UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the AgriCatch landing page UI/UX with a featured carousel, unified global marketplace filter, section renames, preorder orange theme, and 4-column product grid — without touching backend, DB, or any existing functionality.

**Architecture:** All changes are frontend-only (HTML structure, CSS styles, JS logic). The global filter consolidates per-section search/sort/category into one shared state that drives both available and preorder product loads. The featured carousel replaces the static grid with a vanilla-JS slide engine.

**Tech Stack:** Vanilla JS (class-based), Bootstrap 5.3.3, Bootstrap Icons, Font Awesome, custom CSS in `styles.css`

## Global Constraints

- Preserve all existing API calls, event handlers, auth flows, modals, cart logic.
- Categories loaded from `/api/products/categories` — never hardcoded.
- Always include "All" as first category option.
- No fishery references anywhere.
- Agricultural marketplace only.

---

## Affected Files

| File | Role |
|---|---|
| `frontend/index.html` | HTML structure changes (hero, featured, filter section, section renames) |
| `frontend/js/app.js` | Logic changes (carousel, global filter state & listeners, section renames in render) |
| `frontend/css/styles.css` | Style changes (carousel, global filter bar, preorder orange theme, 4-col grid, spacing) |

---

## Task 1: Hero — Two CTA Buttons

**Files:**
- Modify: `frontend/index.html:234-236`
- Modify: `frontend/js/app.js:1614-1621`
- Modify: `frontend/css/styles.css` (hero-buttons section)

- [ ] **Step 1:** In `index.html`, replace the single `#shop-now-btn` button with two buttons inside `.hero-buttons`:
  ```html
  <button id="shop-now-btn" class="btn btn-hero-primary btn-large">
      <i class="fas fa-store me-2"></i>Shop Available Products
  </button>
  <button id="browse-preorders-btn" class="btn btn-hero-outline btn-large">
      <i class="bi bi-calendar-check me-2"></i>Browse Preorders
  </button>
  ```

- [ ] **Step 2:** In `app.js`, update the shop-now listener and add browse-preorders listener:
  ```js
  const shopNowBtn = document.getElementById('shop-now-btn');
  if (shopNowBtn) {
      shopNowBtn.addEventListener('click', () => {
          this.scrollToSection('#available-now');
      });
  }
  const browsePreordersBtn = document.getElementById('browse-preorders-btn');
  if (browsePreordersBtn) {
      browsePreordersBtn.addEventListener('click', () => {
          this.scrollToSection('#preorder');
      });
  }
  ```

- [ ] **Step 3:** In `styles.css`, add `.btn-hero-outline` style for the preorder CTA (white outline on hero background):
  ```css
  .hero-buttons .btn-hero-outline {
      background: transparent;
      color: var(--white);
      border: 2px solid var(--white);
      position: relative; overflow: hidden;
  }
  .hero-buttons .btn-hero-outline:hover {
      background: rgba(255,255,255,0.15);
      color: var(--white);
      box-shadow: 0 8px 20px rgba(255,255,255,0.2);
  }
  ```

---

## Task 2: Featured Products → Carousel

**Files:**
- Modify: `frontend/index.html:241-250` (featured section structure)
- Modify: `frontend/js/app.js:4956-5079` (`loadFeaturedProducts`)
- Modify: `frontend/css/styles.css` (add carousel styles, update `#featured-grid`)

- [ ] **Step 1:** In `index.html`, replace the featured section's inner HTML:
  ```html
  <section id="featured" class="products featured-section">
      <div class="container">
          <div class="products-header">
              <h2 class="section-title">🔥 Best Selling This Week</h2>
          </div>
          <div class="featured-carousel-wrapper" id="featured-carousel-wrapper">
              <button class="carousel-arrow carousel-arrow-prev" id="featured-prev" aria-label="Previous">
                  <i class="fas fa-chevron-left"></i>
              </button>
              <div class="featured-carousel-viewport">
                  <div class="featured-carousel-track" id="featured-grid">
                      <!-- Cards injected by loadFeaturedProducts() -->
                  </div>
              </div>
              <button class="carousel-arrow carousel-arrow-next" id="featured-next" aria-label="Next">
                  <i class="fas fa-chevron-right"></i>
              </button>
          </div>
          <div class="carousel-dots" id="featured-dots"></div>
      </div>
  </section>
  ```

- [ ] **Step 2:** In `app.js`, update `loadFeaturedProducts()`:
  - Change `limit: '6'` → `limit: '8'`
  - Render each product as a `.featured-slide` div containing the existing card HTML, plus add a "View Product" button
  - After rendering, call `this.initFeaturedCarousel(featured.length)`

- [ ] **Step 3:** Add `initFeaturedCarousel(totalSlides)` method to the class:
  ```js
  initFeaturedCarousel(total) {
      const track = document.getElementById('featured-grid');
      const dots = document.getElementById('featured-dots');
      const prevBtn = document.getElementById('featured-prev');
      const nextBtn = document.getElementById('featured-next');
      if (!track || !dots) return;

      let current = 0;
      let autoTimer = null;

      const getVisible = () => window.innerWidth >= 992 ? 3 : window.innerWidth >= 576 ? 2 : 1;

      const totalPages = () => Math.ceil(total / getVisible());

      const goTo = (index) => {
          const pages = totalPages();
          current = ((index % pages) + pages) % pages;
          const pct = current * (100 / getVisible());
          track.style.transform = `translateX(-${pct}%)`;
          dots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === current));
      };

      const buildDots = () => {
          dots.innerHTML = '';
          for (let i = 0; i < totalPages(); i++) {
              const d = document.createElement('button');
              d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
              d.setAttribute('aria-label', `Slide ${i + 1}`);
              d.addEventListener('click', () => { goTo(i); resetAuto(); });
              dots.appendChild(d);
          }
      };

      const resetAuto = () => {
          clearInterval(autoTimer);
          autoTimer = setInterval(() => goTo(current + 1), 5000);
      };

      buildDots();
      prevBtn?.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
      nextBtn?.addEventListener('click', () => { goTo(current + 1); resetAuto(); });

      const wrapper = document.getElementById('featured-carousel-wrapper');
      wrapper?.addEventListener('mouseenter', () => clearInterval(autoTimer));
      wrapper?.addEventListener('mouseleave', () => resetAuto());

      window.addEventListener('resize', () => { buildDots(); goTo(0); });

      resetAuto();
  }
  ```

- [ ] **Step 4:** In `styles.css`, add carousel styles:
  ```css
  .featured-carousel-wrapper { position: relative; display: flex; align-items: center; gap: 0.5rem; }
  .featured-carousel-viewport { overflow: hidden; flex: 1; }
  .featured-carousel-track { display: flex; transition: transform 0.5s ease; gap: 0; }
  .featured-slide { min-width: calc(100% / 3); padding: 0 0.75rem; box-sizing: border-box; }
  @media (max-width: 991px) { .featured-slide { min-width: calc(100% / 2); } }
  @media (max-width: 575px) { .featured-slide { min-width: 100%; } }
  .carousel-arrow { background: white; border: 1px solid #e2e8f0; border-radius: 50%; width: 40px; height: 40px; ... }
  .carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 1.5rem; }
  .carousel-dot { width: 10px; height: 10px; border-radius: 50%; background: #d1d5db; border: none; cursor: pointer; transition: background 0.3s; }
  .carousel-dot.active { background: var(--primary-color); transform: scale(1.2); }
  ```

---

## Task 3: Global Marketplace Filter

**Files:**
- Modify: `frontend/index.html` (add filter section, remove per-section filters)
- Modify: `frontend/js/app.js` (global filter state, listeners, category tabs, load functions)
- Modify: `frontend/css/styles.css` (global filter bar styles)

- [ ] **Step 1:** In `index.html`, add a new `#marketplace-filter` section between `#featured` and `#available-now`:
  ```html
  <section id="marketplace-filter" class="marketplace-filter-section">
      <div class="container">
          <div class="marketplace-filter-header">
              <h2 class="marketplace-filter-title">Browse Marketplace</h2>
              <p class="marketplace-filter-subtitle">Browse fresh agricultural products directly from local farmers.</p>
          </div>
          <div class="marketplace-filter-bar">
              <div class="mf-search-wrap">
                  <i class="fas fa-search mf-search-icon"></i>
                  <input type="text" id="global-search-input" class="mf-search-input" placeholder="Search products...">
              </div>
              <div class="mf-categories-wrap">
                  <div class="mf-category-tabs" id="global-category-tabs"></div>
              </div>
              <div class="mf-sort-wrap">
                  <label class="mf-sort-label">Sort by:</label>
                  <select id="global-sort-select" class="mf-sort-select">
                      <option value="latest">Latest</option>
                      <option value="top_sales">Top Sales</option>
                      <option value="price_low_high">Price: Low to High</option>
                      <option value="price_high_low">Price: High to Low</option>
                  </select>
              </div>
          </div>
      </div>
  </section>
  ```

- [ ] **Step 2:** In `index.html`, strip out the `products-filters-row` divs from both `#available-now` and `#preorder` sections (keep only the section title and `products-grid`). Keep the `#refresh-available-btn` and `#refresh-preorder-btn` as small icon buttons next to each section title.

- [ ] **Step 3:** In `app.js` constructor, add global filter state:
  ```js
  this.globalFilters = { search: '', sort: 'latest', category: '' };
  ```

- [ ] **Step 4:** In `app.js`, add a `setupGlobalFilterListeners()` method called from `setupEventListeners()`:
  ```js
  setupGlobalFilterListeners() {
      const searchInput = document.getElementById('global-search-input');
      if (searchInput) {
          let debounce;
          searchInput.addEventListener('input', (e) => {
              clearTimeout(debounce);
              debounce = setTimeout(() => {
                  this.globalFilters.search = e.target.value;
                  this.loadAvailableProducts();
                  this.loadPreorderProducts();
              }, 350);
          });
      }
      const sortSelect = document.getElementById('global-sort-select');
      if (sortSelect) {
          sortSelect.addEventListener('change', (e) => {
              this.globalFilters.sort = e.target.value;
              this.loadAvailableProducts();
              this.loadPreorderProducts();
          });
      }
  }
  ```

- [ ] **Step 5:** Update `renderProductCategoryTabs()` to support `section = 'global'`:
  - Map `'global'` → `'global-category-tabs'` container ID
  - On click for global tabs: update `this.globalFilters.category`, reload both sections

- [ ] **Step 6:** Update `loadProductCategories()` to call `renderProductCategoryTabs(categories, 'global')` (in addition to or replacing the per-section calls, since per-section tabs are removed from HTML).

- [ ] **Step 7:** Update `loadAvailableProducts()` and `loadPreorderProducts()` to read from `this.globalFilters` instead of `this.availableFilters` / `this.preorderFilters` for `search`, `sort`, `category`. Keep `page` per-section.

- [ ] **Step 8:** Update refresh buttons to reset `globalFilters` and clear the global search input + sort select:
  ```js
  refreshAvailableBtn.addEventListener('click', () => {
      this.globalFilters = { search: '', sort: 'latest', category: '' };
      document.getElementById('global-search-input').value = '';
      document.getElementById('global-sort-select').value = 'latest';
      // reset active category tab
      this.loadAvailableProducts();
      this.loadPreorderProducts();
  });
  ```

- [ ] **Step 9:** Add CSS for marketplace filter section:
  ```css
  .marketplace-filter-section { background: #f8fafc; padding: 2.5rem 0; border-top: 1px solid #e2e8f0; }
  .marketplace-filter-title { font-size: 1.75rem; font-weight: 700; text-align: center; margin-bottom: 0.5rem; }
  .marketplace-filter-subtitle { text-align: center; color: var(--gray); margin-bottom: 1.5rem; }
  .marketplace-filter-bar { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
  .mf-search-wrap { position: relative; flex: 0 0 220px; }
  .mf-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--gray); }
  .mf-search-input { width: 100%; padding: 0.55rem 0.75rem 0.55rem 2.25rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; }
  .mf-categories-wrap { flex: 1; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .mf-sort-wrap { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
  .mf-sort-select { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.9rem; }
  ```

---

## Task 4: Section Renames

**Files:**
- Modify: `frontend/index.html:253-255` (available section title)
- Modify: `frontend/index.html:293-296` (preorder section title)

- [ ] **Step 1:** Change `<h2 class="section-title">Available Now</h2>` → `<h2 class="section-title">🌾 Fresh Products Ready for Delivery</h2>`

- [ ] **Step 2:** Change `<h2 class="section-title">Preorder</h2>` → `<h2 class="section-title preorder-title">📅 Reserve Before Harvest</h2>`

- [ ] **Step 3:** Add preorder subtitle below the heading in the `#preorder` products-header:
  ```html
  <p class="preorder-subtitle">Secure products before they are harvested.</p>
  ```

---

## Task 5: Preorder Orange Theme + HARVEST SOON Badge

**Files:**
- Modify: `frontend/css/styles.css` (preorder section theme)
- Modify: `frontend/js/app.js:5120` (badge text and color)
- Modify: `frontend/js/app.js:5169` (button class)

- [ ] **Step 1:** In `styles.css`, add preorder section orange theme:
  ```css
  #preorder { background: #fffbf0; border-top: 3px solid #F59E0B; }
  #preorder .section-title { color: #92400E; }
  #preorder .preorder-subtitle { color: #78350F; text-align: center; margin-top: -1.5rem; margin-bottom: 1.5rem; }
  #preorder .add-to-cart-btn { background: #F59E0B; border-color: #F59E0B; color: white; }
  #preorder .add-to-cart-btn:hover { background: #D97706; border-color: #D97706; }
  #preorder .add-to-cart-btn:not(:disabled):hover { box-shadow: 0 4px 12px rgba(245,158,11,0.4); }
  ```

- [ ] **Step 2:** In `renderProducts()` (`app.js`), change the preorder badge:
  - Current: `'<span class="badge bg-warning text-dark mb-2">PREORDER</span>'`
  - New: `'<span class="badge harvest-soon-badge mb-2">HARVEST SOON</span>'`

- [ ] **Step 3:** Add `.harvest-soon-badge` CSS:
  ```css
  .harvest-soon-badge { background: #F59E0B; color: white; font-weight: 700; letter-spacing: 0.03em; }
  ```

- [ ] **Step 4:** Make expected harvest date more visually prominent in `renderProducts()`:
  - Current: plain muted small text
  - New: styled with orange icon and slightly larger font:
  ```html
  <div class="harvest-date-display"><i class="bi bi-calendar-check-fill me-1"></i>Expected Harvest: <strong>DATE</strong></div>
  ```
  Plus CSS:
  ```css
  .harvest-date-display { color: #D97706; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; }
  ```

---

## Task 6: Product Grid — 4 Columns

**Files:**
- Modify: `frontend/css/styles.css:2672-2688` (`.products-grid`)

- [ ] **Step 1:** Change desktop grid from 3 to 4 columns:
  ```css
  .products-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr); /* was repeat(3, 1fr) */
      gap: 1.5rem; /* was 2rem - slightly tighter for 4 cols */
  }
  @media (max-width: 1200px) {
      .products-grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 992px) {
      .products-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 576px) {
      .products-grid { grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
  }
  ```

---

## Task 7: Spacing

**Files:**
- Modify: `frontend/css/styles.css` (`.products`, section separators)

- [ ] **Step 1:** Ensure standard section padding is 64px (4rem):
  ```css
  .products { padding: 4rem 0; } /* 64px — no change needed, already correct */
  .featured-section { padding: 4rem 0; }
  .marketplace-filter-section { padding: 2.5rem 0; }
  ```

- [ ] **Step 2:** Add 80px separation between available and preorder:
  ```css
  #available-now { padding-bottom: 4rem; }
  #preorder { margin-top: 1rem; padding-top: 4rem; } /* Total gap ~80px */
  ```

- [ ] **Step 3:** Reduce `.section-title` bottom margin from `3rem` to `1.5rem` to cut excessive whitespace:
  ```css
  .section-title { margin-bottom: 1.5rem; } /* was 3rem */
  ```

---

## Risk Register

| Risk | Mitigation |
|---|---|
| `renderProductCategoryTabs` called for removed `available-category-tabs` / `preorder-category-tabs` | Silent no-op (container not found check already exists) |
| `syncSortControls()` references removed `#available-sort-options` / `#preorder-sort-options` | DOM query returns empty NodeList — no error, no side effects |
| Carousel resize handler rebuilds dots — current slide resets to 0 | Acceptable UX trade-off; debounce resize if needed |
| 4-col grid may make cards too narrow on 13" laptops (~1280px) | Use `minmax(200px, 1fr)` as fallback |
| Global filter reset also clears preorder-specific sort (harvest date) | Acceptable — spec explicitly requests global sort |
