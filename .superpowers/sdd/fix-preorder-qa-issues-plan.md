# Fix Hybrid Preorder System QA Issues

## Overview
Fix 17 QA issues found in the Hybrid Preorder System implementation, focusing on critical inventory correctness, concurrency, cancellation, conversion, API mismatches, and database integrity.

## Global Constraints
- Maintain backward compatibility with existing order/product workflows
- Do not break existing regular order/cancellation logic
- All changes must be atomic and transaction-safe
- Database migrations must be idempotent
- Frontend must handle both regular and preorder orders correctly

## Tasks

### Task 1: Fix race condition in stock/reservation updates (Critical)
**File:** `backend/routes/orders.js`
**Location:** Lines 573-644
**Description:** Replace read-then-update pattern with atomic conditional updates to prevent concurrent over-booking.
**Requirements:**
- For regular orders: Use `UPDATE products SET stock_quantity = stock_quantity - $qty WHERE id = $id AND stock_quantity >= $qty RETURNING ...`
- For preorders: Use `UPDATE products SET reserved_quantity = reserved_quantity + $qty WHERE id = $id AND (max_preorder_quantity IS NULL OR reserved_quantity + $qty <= max_preorder_quantity) RETURNING ...`
- If rowCount === 0, rollback and return appropriate error
- Keep existing transaction structure
**Test:** Verify concurrent checkout cannot exceed stock/preorder limits

### Task 2: Fix preorder cancellation to restore reservation not stock (Critical)
**File:** `backend/routes/orders.js`
**Location:** Lines 893-898, 1019-1025, 1119-1125
**Description:** When cancelling preorder orders, decrement `reserved_quantity` instead of incrementing `stock_quantity`.
**Requirements:**
- Fetch `orders.is_preorder` during cancellation
- If `is_preorder = true`: `UPDATE products SET reserved_quantity = GREATEST(reserved_quantity - quantity, 0)`
- Else: restore `stock_quantity` (existing behavior)
- Apply to all three cancellation endpoints (status update, customer cancel, farmer cancel)
**Test:** Verify cancelled preorder reduces reservation, not stock

### Task 3: Fix conversion quantity parsing and validation (Critical)
**File:** `backend/routes/products.js`
**Location:** Lines 1546-1596
**Description:** Parse `harvest_quantity` as integer and validate before use to prevent string concatenation.
**Requirements:**
- Parse: `const harvestQuantity = Number.parseInt(harvest_quantity, 10)`
- Validate: Reject if not `Number.isInteger(harvestQuantity)` or `harvestQuantity <= 0`
- Use SQL-side addition: `stock_quantity = stock_quantity + $1` instead of JS-calculated `newStock`
**Test:** Verify string "10" becomes number 10, not "510"

### Task 4: Add harvest quantity validation against reserved quantity (Critical)
**File:** `backend/routes/products.js`
**Location:** Lines 1560-1596
**Description:** Reject conversion when `harvest_quantity < reserved_quantity`.
**Requirements:**
- After reading product, check: `if (harvestQuantity < product.reserved_quantity) return 400 error`
- Error message: "Harvest quantity must be at least equal to reserved pre-order quantity"
**Test:** Verify conversion rejected when harvest < reserved

### Task 5: Add per-order preorder allocation tracking (Critical)
**File:** `backend/routes/products.js`, `database/migrations/`
**Location:** Lines 1598-1615
**Description:** Add per-order preorder tracking to support accurate cancellation/conversion lifecycle.
**Requirements:**
- Create migration to add columns:
  - `orders.preorder_reserved_quantity INTEGER DEFAULT 0`
  - `orders.preorder_fulfilled_quantity INTEGER DEFAULT 0`
- Update order creation to set `preorder_reserved_quantity = quantity` for preorders
- Update conversion to set `preorder_fulfilled_quantity = quantity` for active preorders
- Update cancellation to decrement `preorder_reserved_quantity`
**Test:** Verify per-order reservation lifecycle tracked correctly

### Task 6: Block unsafe preorder product edits (Critical)
**File:** `backend/routes/products.js`
**Location:** Lines 1333-1481
**Description:** Prevent changing preorder status when active preorders exist.
**Requirements:**
- Before update, query: `SELECT reserved_quantity FROM products WHERE id = $1`
- If `reserved_quantity > 0`:
  - Block changing `is_preorder` from true to false
  - Block reducing `max_preorder_quantity` below `reserved_quantity`
  - Block removing `preorder_availability_date`
- Return 400 error with descriptive message
**Test:** Verify cannot disable preorder with active reservations

### Task 7: Fix boolean validation for multipart/form-data (High)
**File:** `backend/routes/products.js`
**Location:** Lines 1137-1144, 1351-1366
**Description:** Normalize boolean values from FormData strings.
**Requirements:**
- Add helper: `const isPreorderValue = is_preorder === true || is_preorder === 'true' || is_preorder === '1'`
- Use `isPreorderValue` in validation
- Apply to both create and update endpoints
**Test:** Verify "true" string validates correctly

### Task 8: Fix farmer preorder tab API contract (High)
**File:** `frontend/js/farmer.js`, `backend/routes/orders.js`
**Location:** Lines 7103-7188 (frontend), 113-193 (backend)
**Description:** Fix preorder tab to use supported API and return preorder fields.
**Requirements:**
- Backend: Add `o.is_preorder`, `p.preorder_availability_date`, `o.preorder_converted_at` to farmer order query and response
- Frontend: Change `switchOrderTab('preorder')` to call `loadPreorders()` directly instead of `loadOrdersByStatus('preorder')`
- Or add backend support for `status=preorder` mapping to `is_preorder=true`
**Test:** Verify preorder tab shows preorder orders correctly

### Task 9: Add database integrity constraints (High)
**File:** `database/migrations/add_preorder_fields.sql`
**Location:** Lines 1-22
**Description:** Add missing CHECK constraints for preorder business rules.
**Requirements:**
- Add: `ALTER TABLE products ALTER COLUMN is_preorder SET NOT NULL`
- Add: `ALTER TABLE products ALTER COLUMN reserved_quantity SET NOT NULL`
- Add: `CHECK (is_preorder = false OR preorder_availability_date IS NOT NULL)`
- Add: `CHECK (max_preorder_quantity IS NULL OR reserved_quantity <= max_preorder_quantity)`
- Add: `ALTER TABLE orders ALTER COLUMN is_preorder SET NOT NULL`
- Make constraint addition idempotent using DO block
**Test:** Verify constraints enforced

### Task 10: Validate max_preorder_quantity against reserved_quantity (High)
**File:** `backend/routes/products.js`
**Location:** Lines 1364-1366
**Description:** Reject update when reducing max below already reserved.
**Requirements:**
- After validation, check: `if (nextMaxPreorderQuantity !== null && Number(nextMaxPreorderQuantity) < Number(current.reserved_quantity))`
- Return 400 error: "Cannot reduce max pre-order quantity below already reserved quantity"
**Test:** Verify cannot reduce max below reserved

### Task 11: Add delivery date validation for regular orders (Medium)
**File:** `backend/routes/orders.js`
**Location:** Lines 471-477
**Description:** Validate all orders have delivery date >= today.
**Requirements:**
- After required check, add: `const today = new Date().toISOString().split('T')[0]`
- Validate: `if (delivery_date < today) return 400 error`
- For preorders, keep existing preorder_availability_date validation as stricter check
**Test:** Verify past dates rejected for regular orders

### Task 12: Fix frontend multi-preorder date validation (Medium)
**File:** `frontend/js/checkout.js`
**Location:** Lines 609-620
**Description:** Use latest availability date across all preorder items.
**Requirements:**
- Instead of `find()`, use `reduce()` to find max `preorder_availability_date`
- Set min date to the latest availability date
**Test:** Verify multi-preorder cart uses latest date

### Task 13: Fix checkout UI messaging (Medium)
**File:** `frontend/js/checkout.js`
**Location:** Lines 741-749
**Description:** Use dynamic labels based on cart content.
**Requirements:**
- Track `hasPreorder` from cart items
- Use "Order placed successfully" for regular, "Pre-order placed successfully" for preorder
- Apply to success and error messages
**Test:** Verify correct messaging for both order types

### Task 14: Make migration idempotent (Medium)
**File:** `database/migrations/add_preorder_fields.sql`
**Location:** Lines 17-22
**Description:** Wrap constraint addition in idempotent DO block.
**Requirements:**
- Use: `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Apply to `preorder_expiry_check` constraint
**Test:** Verify migration can run multiple times

### Task 15: Fix conversion transaction ordering (Medium)
**File:** `backend/routes/products.js`
**Location:** Lines 1560-1596
**Description:** Start transaction before reading product to avoid stale data.
**Requirements:**
- Move `client = await pool.connect()` and `BEGIN` before product query
- Use `SELECT ... FOR UPDATE` on products row
- Ensure concurrent conversions/orders cannot interleave
**Test:** Verify concurrent conversion handled correctly

### Task 16: Fix date comparison timezone issues (Low/Medium)
**File:** `backend/routes/orders.js`, `frontend/js/checkout.js`
**Location:** Lines 558-570 (backend), 613-617 (frontend)
**Description:** Use date-only string comparison instead of Date objects.
**Requirements:**
- Compare `YYYY-MM-DD` strings directly for date-only fields
- Avoid timezone-sensitive `new Date()` where possible
**Test:** Verify date comparison works across timezones

### Task 17: Add stock_quantity CHECK constraint (Low/Medium)
**File:** `database/migrations/add_preorder_fields.sql`
**Location:** Lines 1-22
**Description:** Ensure stock_quantity cannot go negative.
**Requirements:**
- Add: `CHECK (stock_quantity >= 0)` if not already present
- Check existing constraint before adding
**Test:** Verify negative stock rejected

## Success Criteria
- All 17 issues fixed
- All changes tested
- No regressions in existing functionality
- Database migration idempotent
- Frontend/backend contract consistent
