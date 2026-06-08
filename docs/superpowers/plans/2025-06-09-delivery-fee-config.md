# Configurable Delivery Fee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make delivery fee configurable via platform settings, allowing super_admin to set it to 0 to disable it from checkout

**Architecture:** Add delivery_fee to platform_settings table, create public API endpoint for fetching, cache in localStorage on frontend, conditionally show/hide in checkout

**Tech Stack:** Node.js/Express backend, PostgreSQL database, vanilla JavaScript frontend, localStorage caching

---

## File Structure

### Backend
- `backend/routes/settings.js` - NEW: Public settings endpoint (no auth required)
- `backend/server.js` - MODIFY: Register new settings route
- `database/migrations/add_delivery_fee_setting.sql` - NEW: Insert initial delivery_fee value

### Frontend
- `frontend/admin.html` - MODIFY: Add delivery_fee input to platform settings form
- `frontend/js/admin.js` - MODIFY: Handle delivery_fee in save/load platform settings, add refresh cache button
- `frontend/js/app.js` - MODIFY: Fetch and cache delivery_fee, conditionally show/hide in checkout

---

### Task 1: Create public settings API endpoint

**Files:**
- Create: `backend/routes/settings.js`
- Modify: `backend/server.js:879-883`

- [ ] **Step 1: Create the settings route file**

```javascript
const express = require('express');
const { pool } = require('../utils/db');

const router = express.Router();

// ── GET /api/settings/delivery-fee ─────────────────────────────────────────────
// Public endpoint - no authentication required
// Returns the delivery fee value from platform_settings
router.get('/delivery-fee', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'delivery_fee'`
    );
    
    if (result.rows.length === 0) {
      // Return default if not set
      return res.json({ delivery_fee: 35 });
    }
    
    const value = parseFloat(result.rows[0].value);
    // Treat null/invalid as 0 (no delivery fee)
    const deliveryFee = isNaN(value) ? 0 : value;
    
    res.json({ delivery_fee: deliveryFee });
  } catch (err) {
    console.error('Error fetching delivery fee:', err);
    // Fallback to default on error
    res.json({ delivery_fee: 35 });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register the settings route in server.js**

Find the section where routes are registered (around line 879) and add:

```javascript
try {
  app.use('/api/settings', require('./routes/settings'));
  console.log('✓ Settings route loaded successfully');
} catch (error) {
  console.error('✗ Settings route failed to load:', error.message);
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/settings.js backend/server.js
git commit -m "feat: add public settings API endpoint for delivery fee"
```

---

### Task 2: Add database migration for delivery_fee

**Files:**
- Create: `database/migrations/add_delivery_fee_setting.sql`

- [ ] **Step 1: Create migration script**

```sql
-- Add delivery_fee to platform_settings if not exists
-- Default value: 35

INSERT INTO platform_settings (key, value, updated_at)
VALUES ('delivery_fee', '35', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Run migration**

```bash
cd backend
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`INSERT INTO platform_settings (key, value, updated_at) VALUES ('delivery_fee', '35', CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING\`)
  .then(() => { console.log('✓ Migration completed'); pool.end(); })
  .catch(err => { console.error('✗ Migration failed:', err.message); pool.end(); process.exit(1); });
"
```

Expected: "✓ Migration completed"

- [ ] **Step 3: Commit**

```bash
git add database/migrations/add_delivery_fee_setting.sql
git commit -m "feat: add delivery_fee to platform_settings table"
```

---

### Task 3: Add delivery_fee input to admin platform settings form

**Files:**
- Modify: `frontend/admin.html:1615-1651`

- [ ] **Step 1: Find the platform-settings section and add delivery_fee input**

Locate the platform-settings section (around line 1615). Find the settings-form div and add the delivery_fee field. The exact location depends on current structure - add it as a new form group:

```html
<div class="mb-3">
  <label for="setting-delivery_fee" class="form-label">Delivery Fee (₱)</label>
  <input type="number" id="setting-delivery_fee" class="form-control platform-setting-input" 
         name="delivery_fee" min="0" step="1" value="35">
  <div class="form-text text-muted">Set to 0 to disable delivery fee - it will not appear in checkout</div>
</div>
```

- [ ] **Step 2: Add Refresh Settings button in platform settings**

In the platform-settings section, find the save button area and add a refresh button:

```html
<button type="button" class="btn btn-outline-secondary me-2" id="refresh-settings-btn">
  <i class="bi bi-arrow-clockwise"></i> Refresh Cache
</button>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/admin.html
git commit -m "feat: add delivery_fee input and refresh button to platform settings"
```

---

### Task 4: Handle delivery_fee in admin.js save/load

**Files:**
- Modify: `frontend/js/admin.js:2601-2620` (renderPlatformSettings)
- Modify: `frontend/js/admin.js:2622-2650` (savePlatformSettings)
- Modify: `frontend/js/admin.js:736-741` (loadPlatformSettings trigger)

- [ ] **Step 1: Add refresh cache button handler in loadPlatformSettings**

After the existing loadPlatformSettings() call (around line 740), add the button handler:

```javascript
document.getElementById('refresh-settings-btn')?.addEventListener('click', () => {
  localStorage.removeItem('cached_delivery_fee');
  localStorage.removeItem('cached_delivery_fee_timestamp');
  this.showMessage('Settings cache cleared. Refreshing...', 'info');
  setTimeout(() => location.reload(), 1000);
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/admin.js
git commit -m "feat: add refresh cache handler to admin platform settings"
```

---

### Task 5: Add cache management functions to app.js

**Files:**
- Modify: `frontend/js/app.js` (add near the top of the App class)

- [ ] **Step 1: Add cache management functions**

Find the App class constructor or early in the class, add these methods:

```javascript
// Cache management for delivery fee
getCachedDeliveryFee() {
  const cached = localStorage.getItem('cached_delivery_fee');
  const timestamp = localStorage.getItem('cached_delivery_fee_timestamp');
  
  if (!cached || !timestamp) return null;
  
  const cacheAge = Date.now() - parseInt(timestamp);
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour
  
  if (cacheAge > CACHE_TTL) {
    // Cache expired
    localStorage.removeItem('cached_delivery_fee');
    localStorage.removeItem('cached_delivery_fee_timestamp');
    return null;
  }
  
  return parseFloat(cached);
}

setCachedDeliveryFee(value) {
  localStorage.setItem('cached_delivery_fee', value.toString());
  localStorage.setItem('cached_delivery_fee_timestamp', Date.now().toString());
}

async fetchDeliveryFee() {
  try {
    const response = await fetch(`${this.apiBase}/settings/delivery-fee`);
    if (response.ok) {
      const data = await response.json();
      this.setCachedDeliveryFee(data.delivery_fee);
      return data.delivery_fee;
    }
  } catch (error) {
    console.error('Error fetching delivery fee:', error);
  }
  // Fallback to cached or default
  return this.getCachedDeliveryFee() || 35;
}

getDeliveryFee() {
  const cached = this.getCachedDeliveryFee();
  if (cached !== null) return cached;
  
  // Fetch async and return default in the meantime
  this.fetchDeliveryFee();
  return 35;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/app.js
git commit -m "feat: add delivery fee cache management functions to app.js"
```

---

### Task 6: Modify checkout logic to use delivery fee

**Files:**
- Modify: `frontend/js/app.js:5102-5104` (checkout calculation)

- [ ] **Step 1: Replace hardcoded DELIVERY_FEE with dynamic value**

Find the checkout calculation section (around line 5102-5104) and replace:

```javascript
const subtotal = parseFloat(data.summary.subtotal) || 0;
const deliveryFee = this.getDeliveryFee();
const grandTotal = subtotal + (deliveryFee > 0 ? deliveryFee : 0);
```

- [ ] **Step 2: Update checkout UI to conditionally show delivery fee**

Find where delivery fee is displayed in checkout (search for "Delivery Fee" in app.js). Replace the display logic:

```javascript
if (checkoutDeliveryFee) {
  if (deliveryFee > 0) {
    checkoutDeliveryFee.style.display = 'block';
    checkoutDeliveryFee.textContent = this.fmtNumber(deliveryFee, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    checkoutDeliveryFee.style.display = 'none';
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/app.js
git commit -m "feat: use dynamic delivery fee in checkout with conditional display"
```

---

### Task 7: Initialize delivery fee fetch on app load

**Files:**
- Modify: `frontend/js/app.js` (in constructor or init method)

- [ ] **Step 1: Add delivery fee fetch to app initialization**

Find the App class constructor or init() method and add:

```javascript
// Fetch delivery fee on app load
this.fetchDeliveryFee();
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/app.js
git commit -m "feat: initialize delivery fee fetch on app load"
```

---

### Task 8: Test the implementation

**Files:**
- Test: Manual testing

- [ ] **Step 1: Test public API endpoint**

Run: `curl http://localhost:3000/api/settings/delivery-fee`
Expected: `{"delivery_fee":35}`

- [ ] **Step 2: Test admin platform settings with delivery_fee**

1. Login as super_admin
2. Navigate to Platform Settings
3. Verify delivery_fee input exists with value 35
4. Change to 0 and click Save All
5. Verify success message

- [ ] **Step 3: Test checkout with delivery_fee = 35**

1. Add items to cart
2. Go to checkout
3. Verify "Delivery Fee: ₱35.00" is shown
4. Verify grand total includes delivery fee

- [ ] **Step 4: Test checkout with delivery_fee = 0**

1. In admin, set delivery_fee to 0
2. Click Refresh Cache
3. Go to customer checkout
4. Verify "Delivery Fee" line item is hidden
5. Verify grand total = subtotal only

- [ ] **Step 5: Test cache refresh**

1. Set delivery_fee to 50 in admin
2. Click Refresh Cache
3. Reload customer page
4. Verify checkout shows ₱50

- [ ] **Step 6: Test API failure fallback**

1. Temporarily break the API endpoint (comment out in settings.js)
2. Restart server
3. Load customer page
4. Verify checkout still works with default 35

- [ ] **Step 7: Commit final changes if any adjustments needed**

```bash
git add .
git commit -m "test: verified delivery fee configuration implementation"
```

---

## Self-Review Results

**Spec coverage:**
- ✓ Add delivery_fee to platform_settings table (Task 2)
- ✓ Migration script with initial value 35 (Task 2)
- ✓ Public API endpoint GET /api/settings/delivery-fee (Task 1)
- ✓ Admin platform settings form with delivery_fee input (Task 3)
- ✓ Explanatory message "Set to 0 to disable delivery fee" (Task 3)
- ✓ Cache management in localStorage (Task 5)
- ✓ Conditional display in checkout (Task 6)
- ✓ Refresh cache button (Task 3, Task 4)
- ✓ Error handling with fallback to 35 (Task 1, Task 5)
- ✓ Validation (min="0" in HTML input)
- ✓ Super_admin only access (existing platform-settings section)

**Placeholder scan:** None found - all code blocks complete

**Type consistency:** All variable names consistent (deliveryFee, delivery_fee, cached_delivery_fee)
