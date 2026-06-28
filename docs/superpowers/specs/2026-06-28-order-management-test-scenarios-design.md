# AgriCatch Order Management Test Scenarios — Comprehensive Design

## Overview

This document defines all testable scenarios for the AgriCatch order lifecycle: from cart → checkout → order creation → farmer status progression → delivery → cancellation, including the hybrid pre-order workflow.

---

## System Architecture (Source of Truth)

### Order Statuses
```
pending, preorder_reserved, confirmed, preparing, scheduled, out_for_delivery, delivered, completed, cancelled
```

### Transition Matrix (from `backend/utils/orderTransitions.js`)
| Current Status | Allowed Next Statuses |
|---|---|
| pending | confirmed, cancelled |
| preorder_reserved | confirmed, cancelled |
| confirmed | preparing, cancelled |
| preparing | scheduled, cancelled |
| scheduled | out_for_delivery, cancelled |
| out_for_delivery | delivered, cancelled |
| delivered | completed |
| completed | (terminal) |
| cancelled | (terminal) |

### Cancellation Rules by Role
| Role | Can Cancel From |
|---|---|
| customer | pending, preorder_reserved |
| farmer | pending, confirmed, preparing |
| admin / super_admin | any status except delivered, completed, cancelled |

### Key Endpoints
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/orders` | POST | customer | Create orders from cart |
| `/api/orders` | GET | customer | List own orders |
| `/api/orders/farmer/:farmerId` | GET | farmer/admin | List farmer orders |
| `/api/orders/:orderId/items/:orderItemId/status` | PUT | farmer/admin | Update order status |
| `/api/orders/:id/status` | PUT | farmer/admin | Alternative status update |
| `/api/orders/:id/cancel` | PUT | customer | Customer cancels own order |
| `/api/orders/:id/cancel-farmer` | PUT | farmer | Farmer cancels order |
| `/api/orders/:id/delivery-date` | PUT | farmer/admin | Set/reschedule delivery date |
| `/api/products/:id/convert-preorders` | POST | farmer | Harvest conversion (pre-order → confirmed) |
| `/api/products/:id/harvest-lifecycle` | POST | farmer | Complete harvest + optionally create available product |

### Inventory Business Logic (from `backend/utils/orderBusinessLogic.js`)
- **Regular order created**: `stock_quantity -= quantity` (atomic)
- **Pre-order created**: `reserved_quantity += quantity` (atomic)
- **Regular order cancelled**: `stock_quantity += quantity` (restored)
- **Pre-order cancelled (not converted)**: `reserved_quantity -= quantity` (released)
- **Pre-order cancelled (already converted)**: `stock_quantity += preorder_fulfilled_quantity` (restored from fulfilled)
- **Order delivered**: `products.sales_count += quantity`, `users.total_sales += quantity`, `users.total_revenue += total_amount`

---

## Test Scenario Groups

### GROUP A: Regular Order — Happy Path (Customer + Farmer)

#### A1: Complete Regular Order Lifecycle
**Story:** A customer adds an available product to cart, checks out, and the farmer progresses the order through all statuses to delivery.

**Steps:**
1. Customer adds available product (stock > 0) to cart
2. Customer goes to checkout, fills recipient info (firstname, lastname, phone)
3. Customer submits checkout → `POST /api/orders`
4. **Verify**: Order created with status `pending`, `delivery_date = null`, `is_preorder = false`
5. **Verify**: Product `stock_quantity` decreased by order quantity
6. **Verify**: Cart cleared
7. **Verify**: Farmer receives notification "New Order Received"
8. Farmer confirms order → `PUT /api/orders/:id/items/:id/status` with `status: confirmed`
9. **Verify**: Order status = `confirmed`
10. Farmer starts preparing → `status: preparing`
11. Farmer schedules delivery → `PUT /api/orders/:id/delivery-date` with future date
12. **Verify**: Order status = `scheduled`, `delivery_date` set
13. Farmer marks out for delivery → `status: out_for_delivery`
14. Farmer marks delivered → `status: delivered`
15. **Verify**: `delivered_at` timestamp set
16. **Verify**: `products.sales_count` incremented by quantity
17. **Verify**: Farmer `total_sales` and `total_revenue` updated
18. **Verify**: Customer receives notification at each status change
19. Customer can rate product within 1 month of delivery

**Expected:** Full lifecycle completes without errors.

---

#### A2: Multiple Regular Products in One Checkout
**Story:** A customer has 3 different available products from 2 different farmers in their cart and checks out.

**Steps:**
1. Add Product A (Farmer 1) to cart
2. Add Product B (Farmer 1) to cart
3. Add Product C (Farmer 2) to cart
4. Checkout all at once
5. **Verify**: 3 separate orders created (per-item order system)
6. **Verify**: Each order has correct product_id, quantity, price
7. **Verify**: Both farmers receive notifications
8. **Verify**: All 3 products' stock decreased correctly
9. **Verify**: Cart fully cleared

**Expected:** Each cart item becomes a separate order with correct farmer attribution.

---

### GROUP B: Pre-Order — Happy Path (Hybrid Workflow)

#### B1: Complete Pre-Order Lifecycle (Harvest YES path)
**Story:** A customer pre-orders a product. The farmer harvests, converts pre-orders to confirmed, and progresses to delivery.

**Steps:**
1. Customer adds pre-order product (`is_preorder = true`) to cart
2. Customer checks out
3. **Verify**: Order created with status `preorder_reserved`, `is_preorder = true`
4. **Verify**: Product `reserved_quantity` increased by order quantity
5. **Verify**: `stock_quantity` NOT changed (pre-order doesn't touch stock)
6. Farmer triggers harvest lifecycle → `POST /api/products/:id/harvest-lifecycle` with `make_available: true`
7. **Verify**: Pre-orders converted → order status changes to `confirmed`
8. **Verify**: `preorder_converted_at` set, `preorder_fulfilled_quantity` set
9. **Verify**: `preorder_reserved_quantity` reduced on order
10. **Verify**: Available product created or stock transferred to linked product
11. Farmer progresses: confirmed → preparing → scheduled → out_for_delivery → delivered
12. **Verify**: Statistics updated on delivery

**Expected:** Pre-order flows through reservation → harvest conversion → normal delivery path.

---

#### B2: Pre-Order with Partial Harvest Allocation
**Story:** Farmer harvests less quantity than total reserved. Some orders get fully allocated, others partially.

**Steps:**
1. Customer 1 pre-orders 10 units
2. Customer 2 pre-orders 10 units
3. Farmer harvests only 15 units
4. **Verify**: FIFO allocation — Customer 1's order fully allocated (10 units), status → `confirmed`
5. **Verify**: Customer 2's order partially allocated (5 units), status → `confirmed`
6. **Verify**: Customer 2's `preorder_reserved_quantity` = 5 (remaining)
7. Farmer harvests again with 5 more units
8. **Verify**: Customer 2's remaining reservation fully allocated

**Expected:** FIFO allocation works correctly with partial harvests.

---

#### B3: Pre-Order Harvest NO Path (Harvest Only, No Available Product)
**Story:** Farmer completes harvest but chooses NOT to create an available product.

**Steps:**
1. Customer pre-orders 5 units
2. Farmer triggers harvest lifecycle with `make_available: false`
3. **Verify**: Pre-orders converted to confirmed
4. **Verify**: Product marked as harvested, no longer appears in marketplace
5. **Verify**: No available product created
6. Farmer progresses order to delivery normally

**Expected:** Harvest-only path converts pre-orders without creating a new available product.

---

#### B4: Mixed Cart — Regular + Pre-Order Products
**Story:** Customer has both available and pre-order products in cart and checks out together.

**Steps:**
1. Add available Product A (stock 10) to cart, qty 2
2. Add pre-order Product B to cart, qty 3
3. Checkout
4. **Verify**: Two orders created:
   - Order 1: Product A, status `pending`, stock decreased by 2
   - Order 2: Product B, status `preorder_reserved`, reserved_quantity increased by 3
5. **Verify**: Both orders visible in customer's order list
6. **Verify**: Farmer can progress Order 1 normally; Order 2 waits for harvest

**Expected:** Mixed cart creates separate orders with correct initial statuses.

---

### GROUP C: Customer Cancellation

#### C1: Customer Cancels Pending Regular Order
**Story:** Customer cancels a regular order while it's still pending.

**Steps:**
1. Customer places regular order (status `pending`)
2. Customer cancels via `PUT /api/orders/:id/cancel` with reason
3. **Verify**: Order status = `cancelled`, `cancelled_by = 'customer'`
4. **Verify**: `cancellation_reason` stored
5. **Verify**: `cancelled_at` timestamp set
6. **Verify**: Product `stock_quantity` restored (increased by order quantity)
7. **Verify**: Customer receives cancellation notification
8. **Verify**: Farmer receives "Order Cancelled by Customer" notification

**Expected:** Inventory restored, both parties notified.

---

#### C2: Customer Cancels Pre-Order Reservation (Not Converted)
**Story:** Customer cancels a pre-order before harvest conversion.

**Steps:**
1. Customer places pre-order (status `preorder_reserved`)
2. Customer cancels
3. **Verify**: Order status = `cancelled`
4. **Verify**: Product `reserved_quantity` decreased by order quantity
5. **Verify**: `stock_quantity` NOT changed (was never deducted)
6. **Verify**: Both parties notified

**Expected:** Reservation released, stock untouched.

---

#### C3: Customer Cannot Cancel After Confirmation
**Story:** Customer tries to cancel an order that has been confirmed by the farmer.

**Steps:**
1. Order is in `confirmed` status (farmer already confirmed)
2. Customer attempts `PUT /api/orders/:id/cancel`
3. **Verify**: API returns 400 with message "Customer cannot cancel orders in confirmed status"
4. **Verify**: Order status unchanged

**Expected:** Cancellation blocked by transition matrix (customer can only cancel pending + preorder_reserved).

---

#### C4: Customer Cannot Cancel Delivered Order
**Story:** Customer tries to cancel a delivered order.

**Steps:**
1. Order is in `delivered` status
2. Customer attempts cancel
3. **Verify**: API returns 400, cancellation blocked

**Expected:** No cancellation allowed for delivered orders.

---

#### C5: Customer Cannot Cancel Already Cancelled Order
**Story:** Customer tries to cancel an already-cancelled order.

**Steps:**
1. Order is already `cancelled`
2. Customer attempts cancel again
3. **Verify**: API returns 400 with "Cannot change status from cancelled"

**Expected:** Double cancellation prevented.

---

### GROUP D: Farmer Cancellation

#### D1: Farmer Cancels Pending Order
**Story:** Farmer cancels a pending order from their dashboard.

**Steps:**
1. Order is `pending`
2. Farmer cancels via `PUT /api/orders/:id/cancel-farmer` with reason
3. **Verify**: Order status = `cancelled`, `cancelled_by = 'farmer'`
4. **Verify**: `cancellation_reason` stored
5. **Verify**: Product `stock_quantity` restored
6. **Verify**: Customer receives "Order cancelled by farmer" notification

**Expected:** Farmer cancellation works, inventory restored, customer notified.

---

#### D2: Farmer Cancels Confirmed Order
**Story:** Farmer cancels after confirming an order.

**Steps:**
1. Order is `confirmed`
2. Farmer cancels
3. **Verify**: Order cancelled, `cancelled_by = 'farmer'`
4. **Verify**: Inventory restored

**Expected:** Farmer can cancel from confirmed status (per transition matrix).

---

#### D3: Farmer Cancels Preparing Order
**Story:** Farmer cancels while preparing the order.

**Steps:**
1. Order is `preparing`
2. Farmer cancels
3. **Verify**: Order cancelled, inventory restored

**Expected:** Farmer can cancel from preparing status.

---

#### D4: Farmer Cannot Cancel Scheduled or Later Status
**Story:** Farmer tries to cancel an order that's already scheduled for delivery.

**Steps:**
1. Order is `scheduled`
2. Farmer attempts cancel via `PUT /api/orders/:id/cancel-farmer`
3. **Verify**: API returns 400 — "Farmer cannot cancel orders in scheduled status"
4. **Verify**: Order unchanged

**Expected:** Farmer cancellation blocked for scheduled/out_for_delivery/delivered.

---

#### D5: Farmer Cancels Pre-Order (Converted)
**Story:** Farmer cancels a pre-order that has already been harvest-converted.

**Steps:**
1. Pre-order is `confirmed` (already converted, `preorder_converted_at` set)
2. Farmer cancels
3. **Verify**: Order cancelled
4. **Verify**: `stock_quantity` restored by `preorder_fulfilled_quantity` (not reserved_quantity)
5. **Verify**: `preorder_fulfilled_quantity` reset to 0

**Expected:** Converted pre-order cancellation restores stock from fulfilled quantity.

---

### GROUP E: Admin Cancellation

#### E1: Admin Cancels Any Active Order
**Story:** Admin cancels an order in any non-terminal status.

**Steps:**
1. Order is `out_for_delivery`
2. Admin cancels via `PUT /api/orders/:id/status` with `status: cancelled`
3. **Verify**: Order cancelled, `cancelled_by = 'farmer'` (default in status update endpoint)
4. **Verify**: Inventory restored

**Expected:** Admin can cancel from any status except delivered/completed/cancelled.

---

#### E2: Admin Bulk Cancel — Product Disabled
**Story:** Admin disables a product, which triggers bulk cancellation of all active orders for that product.

**Steps:**
1. Product has 3 active orders: pending, confirmed, out_for_delivery
2. Admin disables the product (via `cancelOrdersForProducts`)
3. **Verify**: All 3 orders cancelled with `cancelled_by = 'admin'`
4. **Verify**: Each order's inventory restored appropriately
5. **Verify**: Each customer notified

**Expected:** Bulk cancellation handles all order types correctly.

---

#### E3: Admin Bulk Cancel — Farmer Disabled
**Story:** Admin disables a farmer account, cancelling all their active orders.

**Steps:**
1. Farmer has orders across multiple products and statuses
2. Admin disables farmer account
3. **Verify**: All non-delivered, non-cancelled orders cancelled
4. **Verify**: Products marked `is_admin_disabled = true`
5. **Verify**: All affected customers notified
6. **Verify**: Inventory restored per order type

**Expected:** Farmer disable cascades to product disable + order cancellation.

---

#### E4: Admin Bulk Cancel — Customer Disabled
**Story:** Admin disables a customer account, cancelling all their active orders.

**Steps:**
1. Customer has orders from multiple farmers
2. Admin disables customer account
3. **Verify**: All non-delivered, non-cancelled orders cancelled
4. **Verify**: Each farmer notified
5. **Verify**: Inventory restored

**Expected:** Customer disable cancels all their active orders.

---

### GROUP F: Delivery Date Scheduling

#### F1: Farmer Sets Delivery Date on Preparing Order
**Story:** Farmer schedules delivery for an order in preparing status.

**Steps:**
1. Order is `preparing`
2. Farmer sets delivery date → `PUT /api/orders/:id/delivery-date` with future date
3. **Verify**: Order status = `scheduled`, `delivery_date` set
4. **Verify**: Customer receives "Delivery Scheduled" notification

**Expected:** Delivery date set, status auto-changes to scheduled.

---

#### F2: Farmer Reschedules Delivery
**Story:** Farmer reschedules an already-scheduled delivery.

**Steps:**
1. Order is `scheduled` with existing delivery_date
2. Farmer sets new delivery date with `reschedule_reason`
3. **Verify**: `delivery_date` updated
4. **Verify**: `reschedule_reason` stored
5. **Verify**: Customer receives "Delivery Rescheduled" notification with reason

**Expected:** Reschedule requires reason, updates date, notifies customer.

---

#### F3: Cannot Schedule Delivery for Pre-Order Before Harvest Conversion
**Story:** Farmer tries to schedule delivery for a pre-order that hasn't been harvest-converted.

**Steps:**
1. Order is `preorder_reserved`, `preorder_converted_at = null`
2. Farmer attempts to set delivery date
3. **Verify**: API returns 400 — "Cannot schedule delivery for pre-order before harvest conversion"

**Expected:** Pre-order must be converted before scheduling.

---

#### F4: Cannot Set Past Delivery Date
**Story:** Farmer tries to set a delivery date in the past.

**Steps:**
1. Order is `preparing`
2. Farmer sets delivery date to yesterday
3. **Verify**: API returns 400 — "Delivery date cannot be in the past"

**Expected:** Past dates rejected.

---

#### F5: Reschedule Without Reason Fails
**Story:** Farmer tries to reschedule without providing a reason.

**Steps:**
1. Order is `scheduled`
2. Farmer sets new date but no `reschedule_reason`
3. **Verify**: API returns 400 — "Reason for rescheduling is required"

**Expected:** Reschedule requires reason.

---

### GROUP G: Edge Cases & Error Scenarios

#### G1: Checkout with Empty Cart
**Steps:**
1. Customer has empty cart
2. Submits checkout
3. **Verify**: API returns 400 — "Cart is empty"

---

#### G2: Checkout with Unavailable Product
**Story:** Product was available when added to cart but became unavailable before checkout.

**Steps:**
1. Add product to cart
2. Farmer/admin disables product or it expires
3. Customer checks out
4. **Verify**: API returns 400 with unavailable_items list
5. **Verify**: No orders created, no stock changes

---

#### G3: Checkout with Insufficient Stock
**Story:** Product stock was reduced (by another order) below cart quantity before checkout.

**Steps:**
1. Product has 5 stock, customer has qty 3 in cart
2. Another customer orders 4 units (stock now 1)
3. Customer checks out
4. **Verify**: Atomic stock check fails, API returns 400 — "Not enough stock for [product name]"

---

#### G4: Pre-Order Limit Exceeded
**Story:** Customer tries to pre-order more than the max_preorder_quantity.

**Steps:**
1. Pre-order product has `max_preorder_quantity = 10`, `reserved_quantity = 8`
2. Customer adds qty 5 to cart and checks out
3. **Verify**: API returns 400 — "Pre-order limit exceeded"

---

#### G5: Super Admin Cannot Place Orders
**Steps:**
1. Super admin tries to checkout
2. **Verify**: API returns 403 — "Super admin cannot place orders"

---

#### G6: Invalid Status Transition
**Story:** Farmer tries to skip statuses (e.g., pending directly to delivered).

**Steps:**
1. Order is `pending`
2. Farmer attempts `PUT /api/orders/:id/items/:id/status` with `status: delivered`
3. **Verify**: API returns 400 — "Invalid status transition: Cannot change from pending to delivered"

---

#### G7: Cancelled Order Cannot Be Updated
**Steps:**
1. Order is `cancelled`
2. Farmer attempts to update status to `confirmed`
3. **Verify**: API returns 400 — "Cancelled orders cannot be updated"

---

#### G8: Delivered Order Cannot Be Updated
**Steps:**
1. Order is `delivered`
2. Farmer attempts to update status
3. **Verify**: API returns 400 — "Delivered orders cannot be updated"

---

#### G9: Reservations Disabled Product Blocks New Pre-Orders
**Story:** Product has `reservations_disabled = true` due to harvest delay (7+ days overdue).

**Steps:**
1. Product is pre-order with overdue harvest date, `reservations_disabled = true`
2. Customer tries to checkout
3. **Verify**: API returns 400 — "Product is not accepting new pre-order reservations due to harvest delay"

---

#### G10: Double Cancel Race Condition
**Story:** Customer and farmer try to cancel the same order simultaneously.

**Steps:**
1. Order is `pending`
2. Customer cancels via `/api/orders/:id/cancel`
3. Farmer cancels via `/api/orders/:id/cancel-farmer` at the same time
4. **Verify**: Only one cancellation succeeds; the other gets "already cancelled" error
5. **Verify**: Inventory restored only once (idempotent guards in `restoreInventoryOnCancel`)

---

### GROUP H: Real-Time Sync & Notifications

#### H1: Customer Sees Order Status Update in Real-Time
**Steps:**
1. Customer has orders.html open
2. Farmer updates order status
3. **Verify**: `order.updated` SSE event fires
4. **Verify**: Customer's orders list auto-refreshes
5. **Verify**: Order moves to correct status tab

---

#### H2: Farmer Sees New Order in Real-Time
**Steps:**
1. Farmer has farmer.html open
2. Customer places order
3. **Verify**: Farmer receives notification
4. **Verify**: Order appears in pending tab without manual refresh

---

#### H3: Notification Polling Does Not Reset Pagination
**Story:** Farmer is viewing notifications section; polling should skip to avoid resetting pagination.

**Steps:**
1. Farmer is on notifications section, page 2
2. 10-second poll interval triggers
3. **Verify**: Polling skips (activeSection === 'notifications')
4. **Verify**: Pagination preserved

---

### GROUP I: Post-Delivery Actions

#### I1: Customer Rates Delivered Product
**Steps:**
1. Order is `delivered`, `delivered_at` within 1 month
2. Customer opens rating modal
3. Customer submits 5-star rating with comment
4. **Verify**: Review created successfully
5. **Verify**: Customer can update rating later

---

#### I2: Rating Window Expires After 1 Month
**Steps:**
1. Order delivered 35 days ago
2. Customer tries to rate
3. **Verify**: "Rating Closed" button shown, disabled
4. **Verify**: API returns eligibility = false

---

#### I3: Customer Reorders Delivered Product
**Steps:**
1. Order is `delivered`
2. Customer clicks "Reorder"
3. **Verify**: Product added back to cart with same quantity
4. **Verify**: Toast shows "added to your cart"

---

### GROUP J: Admin Order Management

#### J1: Admin Updates Order Status
**Steps:**
1. Admin updates order from `pending` to `confirmed`
2. **Verify**: Status updated, customer notified
3. **Verify**: Admin can transition any valid status

---

#### J2: Admin Cannot Cancel Delivered Order
**Steps:**
1. Order is `delivered`
2. Admin attempts `PUT /api/orders/:id/status` with `status: cancelled`
3. **Verify**: API returns 400 — "Delivered orders cannot be cancelled"

---

## Test Execution Priority

| Priority | Group | Reason |
|---|---|---|
| P0 | A1, C1, D1 | Core happy paths — must always work |
| P0 | B1, B4 | Pre-order happy path + mixed cart |
| P1 | C2, C3, D2-D5 | Cancellation edge cases |
| P1 | F1-F3 | Delivery date scheduling |
| P1 | E1-E2 | Admin cancellation |
| P2 | G1-G10 | Edge cases and error handling |
| P2 | H1-H3 | Real-time sync |
| P2 | I1-I3 | Post-delivery actions |
| P3 | J1-J2 | Admin-specific operations |

---

## Test Accounts (from project memory)

| Role | Email | Password |
|---|---|---|
| Farmer | dhelhilis@gmail.com | password123 |
| Customer | (use test accounts from `backend/scripts/check_all_test_accounts_with_superadmin.js`) | |
| Admin | (use test accounts) | |

---

## Key Files Referenced

- `backend/routes/orders.js` — Order CRUD, status updates, cancellation, delivery date
- `backend/routes/products.js` — Pre-order conversion, harvest lifecycle
- `backend/routes/admin.js` — Admin bulk cancellation, user disable
- `backend/utils/orderTransitions.js` — Transition matrix (single source of truth)
- `backend/utils/orderBusinessLogic.js` — Inventory restore, statistics update
- `frontend/js/checkout.js` — Checkout flow, cart validation
- `frontend/js/orders.js` — Customer order list, cancel UI, rating
- `frontend/js/farmer.js` — Farmer order management, status buttons, delivery scheduling
