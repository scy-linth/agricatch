# Orders Search UI Consistency Design

## Overview
Rebuild the orders search feature in farmer.html to match the search button pattern used in admin.html for UI consistency.

## Current State
**farmer.html orders search:**
- Autocomplete-style search with custom dropdown (`#orders-search-dropdown`)
- Input field with placeholder "Order ID, product name, or customer..."
- No search button - search triggers on input/change
- Custom CSS for dropdown options

**admin.html search pattern:**
- Input field + green search button in Bootstrap input-group
- Button: green (#41bf5b), white text, no border, rounded corners (8px)
- Search icon, min-width 80px
- Refresh button alongside search
- Search triggers on button click

## Design

### Changes to farmer.html

**Remove:**
- Custom dropdown `#orders-search-dropdown`
- Associated CSS: `.orders-search-wrap`, `.orders-search-option`, etc.

**Replace with:**
- Bootstrap input-group with search input and search button
- Green search button matching admin.html pattern
- Keep refresh button

**New HTML structure:**
```html
<div class="input-group input-group-sm flex-grow-1">
    <input type="text" id="orders-search-input" class="form-control me-2" 
           placeholder="Order ID, product name, or customer…">
    <button id="orders-search-btn" class="btn btn-primary" type="button" 
            style="min-width: 80px; background: #41bf5b; border: none; color: white; border-radius: 8px;">
        <i class="bi bi-search me-1"></i>Search
    </button>
</div>
<button id="orders-refresh-btn" class="btn btn-outline-secondary btn-sm" type="button" 
        aria-label="Refresh orders">
    <i class="bi bi-arrow-clockwise"></i>
</button>
```

### Changes to farmer.js

**Remove:**
- `renderOrdersSearchDropdown()` method
- `applyOrdersSearch()` dropdown logic
- Dropdown event listeners (click on options)

**Update:**
- Add click handler for `orders-search-btn`
- Search triggers on button click instead of input/change
- Keep existing `applyOrdersSearch()` logic for filtering orders

**New event handler:**
```javascript
document.getElementById('orders-search-btn')?.addEventListener('click', () => {
    this.applyOrdersSearch();
});
```

### CSS Cleanup

Remove from farmer.html `<style>` block:
- `.orders-search-wrap`
- `#orders-search-dropdown`
- `.orders-search-option`
- `.orders-search-option .title`
- `.orders-search-option .meta`

## Success Criteria
- Orders search uses green search button matching admin.html
- Search triggers on button click
- Refresh button still works
- No autocomplete dropdown
- UI consistent with admin dashboard
