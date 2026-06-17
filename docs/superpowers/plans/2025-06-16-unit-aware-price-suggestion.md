# Unit-Aware Price Suggestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix suggested price to consider unit (kg vs pieces) so farmers get accurate price recommendations based on their selected unit type.

**Architecture:** 
- Backend: Add `unit` parameter to `/pricing/suggestion` API endpoint and filter SQL query by unit
- Frontend: Pass unit parameter from `updatePriceSuggestion()` and add unit dropdown change listener to trigger recalculation
- This ensures price suggestions are unit-specific (e.g., Pakwan at ₱20/kg vs ₱50/piece)

**Tech Stack:** Node.js/Express backend, PostgreSQL, vanilla JavaScript frontend

---

## File Structure

- **Modify:** `backend/routes/products.js` — Add unit parameter handling to pricing suggestion endpoint
- **Modify:** `frontend/js/farmer.js` — Pass unit in API call and add unit change listener
- **No new files** — This is a targeted bug fix to existing code

---

### Task 1: Backend - Add unit parameter to pricing suggestion API

**Files:**
- Modify: `backend/routes/products.js:544-621`

- [ ] **Step 1: Extract unit from query parameters**

```javascript
const rawName = String(req.query.name || '').trim();
const categoryId = req.query.category_id;
const unit = req.query.unit; // NEW: extract unit parameter
```

- [ ] **Step 2: Add unit filter to SQL query in runSuggestionQuery function**

```javascript
const runSuggestionQuery = async (opts = { withCategory: false, withUnit: false }) => {
  const params = [rawName, baseName ? `${baseName}%` : rawName];
  let whereCategory = '';
  let whereUnit = '';
  
  if (opts.withCategory && categoryId) {
    params.push(Number(categoryId));
    whereCategory = ` AND p.category_id = $${params.length}`;
  }
  
  // NEW: Add unit filter
  if (opts.withUnit && unit) {
    params.push(unit);
    whereUnit = ` AND p.unit = $${params.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        MIN(p.price)::numeric(10,2) AS lowest_price,
        AVG(p.price)::numeric(10,2) AS average_price,
        COUNT(*)::int AS sample_count
      FROM orders o
      JOIN products p ON p.id = o.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.status = 'delivered'
        AND (
          c.id IS NULL
          OR (COALESCE(LOWER(c.type), 'agricultural') <> 'fishery'
              AND c.name NOT ILIKE '%fish%'
              AND c.name NOT ILIKE '%seafood%')
        )
        AND (
          p.name !~* '${FISHERY_KEYWORDS_PATTERN}'
          AND (p.description IS NULL OR p.description !~* '${FISHERY_KEYWORDS_PATTERN}')
        )
        AND (
          p.name ILIKE $1
          OR p.name ILIKE $2
        )
        ${whereCategory}
        ${whereUnit}
    `,
    params
  );

  return result.rows?.[0] || {};
};
```

- [ ] **Step 3: Update query execution to include unit filter**

```javascript
// First try category+unit-scoped suggestion, then fall back to unit-only, then system-wide
let row = await runSuggestionQuery({ withCategory: !!categoryId, withUnit: !!unit });
if (categoryId && Number(row.sample_count || 0) <= 0) {
  row = await runSuggestionQuery({ withCategory: false, withUnit: !!unit });
}
if (unit && Number(row.sample_count || 0) <= 0) {
  row = await runSuggestionQuery({ withCategory: false, withUnit: false });
}
```

- [ ] **Step 4: Return unit in API response for debugging**

```javascript
return res.json({
  name: rawName,
  unit: unit || null, // NEW: include unit in response
  suggested_lowest_price: hasSample
    ? (row.lowest_price ? Number(row.lowest_price) : null)
    : (fallback ? fallback.lowest : null),
  average_price: hasSample
    ? (row.average_price ? Number(row.average_price) : null)
    : (fallback ? fallback.average : null),
  sample_count: Number(row.sample_count || 0),
  is_baseline_estimate: !hasSample && !!fallback
});
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/products.js
git commit -m "fix: add unit filter to pricing suggestion API"
```

---

### Task 2: Frontend - Pass unit parameter from updatePriceSuggestion

**Files:**
- Modify: `frontend/js/farmer.js:1477-1520`

- [ ] **Step 1: Extract unit value from form**

```javascript
async updatePriceSuggestion(mode = 'add') {
  const isEdit = mode === 'edit';
  const nameInput = document.getElementById(isEdit ? 'edit-product-name' : 'product-name');
  const categoryInput = document.getElementById(isEdit ? 'edit-product-category' : 'product-category');
  const unitInput = document.getElementById(isEdit ? 'edit-product-unit' : 'product-unit'); // NEW
  const priceInput = document.getElementById(isEdit ? 'edit-product-price' : 'product-price');
  const hint = document.getElementById(isEdit ? 'edit-product-price-suggestion' : 'product-price-suggestion');

  if (!nameInput || !hint) return;

  const name = String(nameInput.value || '').trim();
  const categoryId = String(categoryInput?.value || '').trim();
  const unit = String(unitInput?.value || '').trim(); // NEW
  if (!name) {
    hint.textContent = 'Suggested lowest price: —';
    return;
  }
```

- [ ] **Step 2: Add unit to API request parameters**

```javascript
try {
  hint.textContent = 'Suggested lowest price: checking...';
  const params = new URLSearchParams({ name });
  if (categoryId) params.set('category_id', categoryId);
  if (unit) params.set('unit', unit); // NEW

  const response = await fetch(`${this.apiBase}/products/pricing/suggestion?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${this.token}` }
  });
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "fix: pass unit parameter to pricing suggestion API"
```

---

### Task 3: Frontend - Add unit change listener to trigger price recalculation

**Files:**
- Modify: `frontend/js/farmer.js:1383-1433`

- [ ] **Step 1: Add unit dropdown elements to setupProductSuggestionListeners**

```javascript
setupProductSuggestionListeners() {
  const addName = document.getElementById('product-name');
  const editName = document.getElementById('edit-product-name');
  const addCategory = document.getElementById('product-category');
  const editCategory = document.getElementById('edit-product-category');
  const addUnit = document.getElementById('product-unit'); // NEW
  const editUnit = document.getElementById('edit-product-unit'); // NEW
```

- [ ] **Step 2: Add change listeners for unit dropdowns**

```javascript
if (addUnit) {
  addUnit.addEventListener('change', () => this.updatePriceSuggestion('add'));
}
if (editUnit) {
  editUnit.addEventListener('change', () => this.updatePriceSuggestion('edit'));
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "fix: add unit change listener to trigger price recalculation"
```

---

### Task 4: Test the end-to-end flow

**Files:**
- No file changes (manual testing)

- [ ] **Step 1: Start backend server**

```bash
cd backend
npm start
```

Expected: Server starts on configured port (default 3000 or from env)

- [ ] **Step 2: Open farmer dashboard in browser**

Navigate to: `http://localhost:3000/farmer.html` (or your dev URL)

- [ ] **Step 3: Test add product modal**

1. Click "Add Product" button
2. Select a category (e.g., Fruits)
3. Select product name from dropdown (e.g., Pakwan)
4. Verify "Suggested lowest price" appears
5. Change unit from "kg" to "pieces"
6. Verify suggested price updates to a different value (or shows "—" if no pieces data exists)

- [ ] **Step 4: Test edit product modal**

1. Click edit button on an existing product
2. Verify suggested price appears based on current unit
3. Change unit dropdown
4. Verify suggested price updates accordingly

- [ ] **Step 5: Test API directly with curl**

```bash
# Test with unit parameter
curl "http://localhost:3000/api/products/pricing/suggestion?name=pakwan&unit=kg"

# Test without unit parameter (fallback behavior)
curl "http://localhost:3000/api/products/pricing/suggestion?name=pakwan"
```

Expected: Both return valid JSON, with unit-specific filtering when unit is provided

---

## Self-Review

**1. Spec coverage:**
- ✅ Backend unit filter added to SQL query
- ✅ Frontend passes unit parameter
- ✅ Unit change triggers recalculation
- ⏸️ SUGGESTED_PRICE_BASELINE unit context (P2 - deferred)
- ⏸️ Edit modal auto-fill skip (P2 - deferred)

**2. Placeholder scan:** No placeholders found — all code is complete.

**3. Type consistency:**
- `unit` parameter used consistently across backend and frontend
- SQL parameter indexing correct ($3, $4, etc.)
- Frontend element IDs match HTML (`product-unit`, `edit-product-unit`)

---

## Future Enhancements (P2 - Not in this plan)

1. Add unit context to `SUGGESTED_PRICE_BASELINE` in backend for better fallback accuracy
2. Skip auto-fill in edit modal when price already exists to avoid overwriting user's saved price
3. Add unit conversion hints (e.g., "1 kg ≈ 2-3 pieces" for certain products)
