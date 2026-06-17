# Orders Search UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace farmer.html orders search autocomplete with admin.html style search button for UI consistency

**Architecture:** Replace custom dropdown search with Bootstrap input-group + green search button, update farmer.js to trigger search on button click

**Tech Stack:** HTML (farmer.html), JavaScript (farmer.js), Bootstrap 5.3.3

---

## File Structure

**Files to modify:**
- `frontend/farmer.html` - Replace search HTML, remove dropdown CSS
- `frontend/js/farmer.js` - Remove dropdown logic, add button click handler

**No new files created.**

---

### Task 1: Replace Orders Search HTML in farmer.html

**Files:**
- Modify: `frontend/farmer.html:725-729`

- [ ] **Step 1: Replace orders search HTML with input-group pattern**

Find the orders-search-wrap div (around line 725-729) and replace it with:

```html
<div class="input-group input-group-sm flex-grow-1">
    <input type="text" id="orders-search-input" class="form-control me-2" 
           placeholder="Order ID, product name, or customer…">
    <button id="orders-search-btn" class="btn btn-primary" type="button" 
            style="min-width: 80px; background: #41bf5b; border: none; color: white; border-radius: 8px;">
        <i class="bi bi-search me-1"></i>Search
    </button>
</div>
```

- [ ] **Step 2: Verify refresh button exists and is correctly positioned**

The refresh button should already exist after the search input. Verify it has ID `orders-refresh-btn` and class `btn btn-outline-secondary btn-sm`.

- [ ] **Step 3: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: replace orders search with admin-style search button"
```

---

### Task 2: Remove Dropdown CSS from farmer.html

**Files:**
- Modify: `frontend/farmer.html` - `<style>` block

- [ ] **Step 1: Locate and remove dropdown-related CSS**

In the `<style>` block (around lines 95-102), remove these CSS rules:
- `.orders-search-wrap`
- `#orders-search-dropdown`
- `.orders-search-dropdown.open`
- `.orders-search-option`
- `.orders-search-option:last-child`
- `.orders-search-option:hover`
- `.orders-search-option .title`
- `.orders-search-option .meta`

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "refactor: remove orders search dropdown CSS"
```

---

### Task 3: Remove Dropdown Logic from farmer.js

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Locate renderOrdersSearchDropdown method**

Search for `renderOrdersSearchDropdown` method in farmer.js. Note its location.

- [ ] **Step 2: Delete renderOrdersSearchDropdown method**

Remove the entire `renderOrdersSearchDropdown()` method and all its code.

- [ ] **Step 3: Locate applyOrdersSearch method**

Search for `applyOrdersSearch` method. This method filters orders based on search input.

- [ ] **Step 4: Remove dropdown-related code from applyOrdersSearch**

In `applyOrdersSearch()`, remove any code that:
- Calls `renderOrdersSearchDropdown()`
- Manipulates `#orders-search-dropdown`
- Shows/hides the dropdown

Keep the core filtering logic that matches orders against search text.

- [ ] **Step 5: Remove dropdown event listeners**

Search for event listeners related to `orders-search-dropdown` or dropdown options and remove them.

- [ ] **Step 6: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "refactor: remove orders search dropdown logic"
```

---

### Task 4: Add Search Button Click Handler

**Files:**
- Modify: `frontend/js/farmer.js` - `setupEventListeners()` method

- [ ] **Step 1: Locate setupEventListeners method**

Search for `setupEventListeners()` method in farmer.js.

- [ ] **Step 2: Add click handler for orders-search-btn**

Add this event listener in the setupEventListeners method (near other order-related event listeners):

```javascript
const ordersSearchBtn = document.getElementById('orders-search-btn');
if (ordersSearchBtn) {
    ordersSearchBtn.addEventListener('click', () => this.applyOrdersSearch());
}
```

- [ ] **Step 3: Add Enter key handler for search input**

Allow pressing Enter in the search input to trigger search:

```javascript
const ordersSearchInput = document.getElementById('orders-search-input');
if (ordersSearchInput) {
    ordersSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            this.applyOrdersSearch();
        }
    });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add search button click handler for orders"
```

---

### Task 5: Test Orders Search Functionality

**Files:**
- Test: Manual browser testing

- [ ] **Step 1: Start the application**

Run the development server and log in as a farmer user.

- [ ] **Step 2: Navigate to Orders section**

Click on Orders in the sidebar to view the orders page.

- [ ] **Step 3: Verify search button is visible**

Confirm the green search button (#41bf5b) is displayed next to the search input.

- [ ] **Step 4: Test search functionality**

1. Type "test" in the search input
2. Click the Search button
3. Verify orders are filtered based on search text
4. Verify no dropdown appears

- [ ] **Step 5: Test Enter key functionality**

1. Type "test" in the search input
2. Press Enter key
3. Verify search triggers (same as clicking button)

- [ ] **Step 6: Test refresh button**

1. Click the refresh button (clockwise arrow icon)
2. Verify orders reload and search is cleared

- [ ] **Step 7: Test with empty search**

1. Clear the search input
2. Click Search button
3. Verify all orders are displayed

---

## Self-Review

**Spec coverage:**
- ✅ Replace HTML with input-group + search button - Task 1
- ✅ Remove dropdown CSS - Task 2
- ✅ Remove dropdown logic from JS - Task 3
- ✅ Add button click handler - Task 4
- ✅ Test functionality - Task 5

**Placeholder scan:**
- No placeholders found
- All code blocks are complete
- All file paths are exact
- All commands are complete

**Type consistency:**
- `orders-search-input` ID matches HTML
- `orders-search-btn` ID matches HTML
- `orders-refresh-btn` ID matches HTML
- `applyOrdersSearch()` method name consistent
