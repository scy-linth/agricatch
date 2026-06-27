# Order Management Architecture Audit Report

**Version:** 1.0  
**Date:** 2025-01-20  
**Scope:** Complete architecture audit of the AgriCatch Order Management module  
**Status:** Audit only — no implementation changes made  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Database Schema & Relationships](#2-database-schema--relationships)
3. [Backend API Inventory](#3-backend-api-inventory)
4. [Order Status Lifecycle & Transition Matrix](#4-order-status-lifecycle--transition-matrix)
5. [Customer Order Flow](#5-customer-order-flow)
6. [Farmer Order Flow](#6-farmer-order-flow)
7. [Admin Order Flow](#7-admin-order-flow)
8. [Pre-order vs Available Product Order Flows](#8-pre-order-vs-available-product-order-flows)
9. [Hybrid Pre-order Conversion](#9-hybrid-pre-order-conversion)
10. [Cancellation Rules](#10-cancellation-rules)
11. [Delivery Workflow](#11-delivery-workflow)
12. [Completion Rules](#12-completion-rules)
13. [Review & Rating Rules](#13-review--rating-rules)
14. [Notifications](#14-notifications)
15. [Real-time Event Broadcasting](#15-real-time-event-broadcasting)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Edge Cases, Bugs & Regression Risks](#17-edge-cases-bugs--regression-risks)
18. [Dead Code & Redundancy](#18-dead-code--redundancy)
19. [Hidden Dependencies](#19-hidden-dependencies)
20. [Missing Validation](#20-missing-validation)
21. [Recommended Improvements](#21-recommended-improvements)

---

## 1. Executive Summary

The Order Management module is a **per-item order system** where each cart item generates a separate order. The module supports two product types (regular and pre-order) with differentiated lifecycles, role-based access control (customer, farmer, admin, super_admin), transactional stock/reservation management, real-time event broadcasting, and a notification system.

### Key Findings

- **3 confirmed bugs** (customer cancel notification missing farmer_id, alternative status endpoint missing preorder_reserved/scheduled transitions, admin bulk cancel not handling preorders)
- **2 significant inconsistencies** between the primary and alternative status update endpoints
- **1 DDL-in-transaction anti-pattern** (ALTER TABLE inside BEGIN/COMMIT)
- **Missing stock restoration** in admin order status updates
- **Duplicate transition matrix** maintained in 3+ places with divergence
- **No idempotency protection** on order creation (double-submit risk)

---

## 2. Database Schema & Relationships

### 2.1 Orders Table

**File:** `database/schema.sql` + `backend/server.js` runtime table creation

```
orders
├── id (SERIAL PRIMARY KEY)
├── user_id (INTEGER REFERENCES users(id))
├── product_id (INTEGER REFERENCES products(id))
├── quantity (INTEGER)
├── price (NUMERIC)
├── total_amount (NUMERIC)
├── status (VARCHAR) — pending | preorder_reserved | confirmed | preparing | scheduled | out_for_delivery | delivered | cancelled
├── delivery_address (TEXT)
├── delivery_date (DATE)
├── special_instructions (TEXT)
├── is_preorder (BOOLEAN)
├── preorder_reserved_quantity (INTEGER)
├── preorder_fulfilled_quantity (INTEGER)
├── preorder_converted_at (TIMESTAMP)
├── cancellation_reason (TEXT)
├── cancelled_at (TIMESTAMP)
├── cancelled_by (VARCHAR) — customer | farmer | admin
├── reschedule_reason (TEXT)
├── delivered_at (TIMESTAMP)
├── is_disabled (BOOLEAN DEFAULT false)
├── disabled_at (TIMESTAMP)
├── created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
├── updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
└── Indexes: user_id, product_id, status, is_disabled
```

**Key Design Decision:** Each order represents exactly **one product/item**. There is no multi-item order aggregation. The `order_items` table exists but is vestigial — `order_item_id` is set equal to `order_id` for API compatibility.

### 2.2 Order Items Table

**File:** `database/migrations/add_order_item_status.sql`

```
order_items
├── id (SERIAL PRIMARY KEY)
├── order_id (INTEGER REFERENCES orders(id))
├── product_id (INTEGER REFERENCES products(id))
├── quantity, price, total_amount
├── status (VARCHAR) — backfilled from orders
├── tracking fields (carrier, tracking_number, etc.)
```

**Status:** Vestigial in the per-item system. The migration backfills item status from the parent order, but no runtime code actively maintains `order_items` rows. All business logic operates directly on the `orders` table.

### 2.3 Reviews Table

```
reviews
├── id (SERIAL PRIMARY KEY)
├── product_id (INTEGER REFERENCES products(id))
├── user_id (INTEGER REFERENCES users(id))
├── rating (INTEGER 1-5)
├── comment (TEXT)
├── created_at, updated_at
└── UNIQUE INDEX (product_id, user_id) — one review per product per user
```

### 2.4 Customer Ratings Table

```
customer_ratings
├── id (SERIAL PRIMARY KEY)
├── order_id (INTEGER REFERENCES orders(id))
├── farmer_id (INTEGER REFERENCES users(id))
├── customer_id (INTEGER REFERENCES users(id))
├── rating (INTEGER)
├── created_at, updated_at
└── UNIQUE (order_id, farmer_id) — one rating per order per farmer
```

### 2.5 Related Tables

- **products** — `stock_quantity`, `reserved_quantity`, `max_preorder_quantity`, `is_preorder`, `preorder_availability_date`, `harvest_date`, `reservations_disabled`, `sales_count`
- **users** — `total_sales`, `total_revenue`, `average_rating`, `total_reviews`, `customer_average_rating`, `customer_total_ratings`
- **cart** — `user_id`, `session_id`, `product_id`, `quantity`
- **notifications** — `user_id`, `type`, `title`, `message`, `order_id`, `product_id`, `is_read`

---

## 3. Backend API Inventory

### 3.1 Order Routes (`backend/routes/orders.js`)

| Method | Path | Purpose | Access |
|--------|------|---------|--------|
| GET | `/` | Get user's own orders | Customer |
| GET | `/farmer/:farmerId` | Get farmer's orders by status | Farmer (self only) |
| PUT | `/:orderId/items/:orderItemId/status` | **Primary** status update | Farmer/Admin |
| PUT | `/:id/status` | **Alternative** status update | Farmer/Admin |
| POST | `/` | Create orders from cart | Customer (not super_admin) |
| PUT | `/:id/cancel` | Customer cancel order | Customer (owner) |
| PUT | `/:id/delivery-date` | Set/reschedule delivery date | Farmer/Admin |
| PUT | `/:id/cancel-farmer` | Farmer cancel order | Farmer/Admin |

### 3.2 Admin Order Routes (`backend/routes/admin.js`)

| Method | Path | Purpose | Access |
|--------|------|---------|--------|
| GET | `/orders` | List all orders with filters | Admin/Super Admin |
| PUT | `/orders/:id/status` | Admin status update | Admin/Super Admin |
| DELETE | `/orders/:id` | Disable order (soft delete) | Admin/Super Admin |
| PUT | `/orders/:id/enable` | Re-enable disabled order | Admin/Super Admin |

### 3.3 Review Routes (`backend/routes/reviews.js`)

| Method | Path | Purpose | Access |
|--------|------|---------|--------|
| GET | `/products/:id/reviews/eligibility` | Check rating eligibility | Customer |
| GET | `/products/:id/reviews` | Get product reviews | Public |
| POST | `/products/:id/reviews` | Create review | Customer (delivered only) |
| PUT | `/reviews/:id` | Update own review | Customer (owner) |
| DELETE | `/reviews/:id` | Delete own review | Customer (owner) |
| GET | `/orders/:id/customer-rating/eligibility` | Farmer check customer rating eligibility | Farmer |
| POST | `/orders/:id/customer-rating` | Farmer rate customer | Farmer |

### 3.4 Pre-order Conversion (`backend/routes/products.js`)

| Method | Path | Purpose | Access |
|--------|------|---------|--------|
| POST | `/:id/convert-preorders` | Convert pre-order reservations to stock | Farmer (owner) |

---

## 4. Order Status Lifecycle & Transition Matrix

### 4.1 Canonical Status Flow

```
Regular:    pending → confirmed → preparing → scheduled → out_for_delivery → delivered
Pre-order:  preorder_reserved → confirmed → preparing → scheduled → out_for_delivery → delivered
Terminal:   delivered, cancelled
```

### 4.2 Transition Matrix (Primary Endpoint — `/:orderId/items/:orderItemId/status`)

```javascript
const validTransitions = {
  pending:            ['confirmed', 'cancelled'],
  preorder_reserved:  ['confirmed', 'cancelled'],
  confirmed:          ['preparing', 'cancelled'],
  preparing:          ['scheduled', 'cancelled'],
  scheduled:          ['out_for_delivery', 'cancelled'],
  out_for_delivery:   ['delivered', 'cancelled'],
  delivered:          [],
  cancelled:          []
};
```

### 4.3 Transition Matrix (Alternative Endpoint — `/:id/status`)

```javascript
const validTransitions = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['preparing', 'cancelled'],
  preparing:        ['out_for_delivery', 'cancelled'],  // ← skips 'scheduled'
  out_for_delivery: ['delivered', 'cancelled'],
  delivered:        [],
  cancelled:        []
  // ← missing 'preorder_reserved' and 'scheduled' states entirely
};
```

### 4.4 Transition Matrix (Admin Endpoint — `/admin/orders/:id/status`)

```javascript
const validTransitions = {
  pending:            ['confirmed', 'cancelled'],
  preorder_reserved:  ['confirmed', 'cancelled'],
  confirmed:          ['preparing', 'cancelled'],
  preparing:          ['scheduled', 'cancelled'],
  scheduled:          ['out_for_delivery', 'cancelled'],
  out_for_delivery:   ['delivered', 'cancelled'],
  delivered:          [],
  cancelled:          []
};
```

### 4.5 Inconsistency Summary

| State | Primary | Alternative | Admin |
|-------|---------|-------------|-------|
| `preorder_reserved` | ✅ Present | ❌ **Missing** | ✅ Present |
| `scheduled` | ✅ Present | ❌ **Missing** (preparing → out_for_delivery directly) | ✅ Present |
| Cancellation rules | Role-aware (customer vs farmer) | Basic (only blocks delivered) | Basic (only blocks delivered/cancelled) |
| Stock restoration on cancel | ✅ Idempotent, conversion-aware | ✅ Basic (preorder unaware of conversion) | ❌ **None** |
| Sales stats on delivery | ✅ Updates product + farmer | ✅ Updates product + farmer | ❌ **None** |

---

## 5. Customer Order Flow

### 5.1 Order Placement (`POST /orders`)

**File:** `backend/routes/orders.js:494-853`

1. JWT authentication required; super_admin blocked from ordering
2. Validates phone number format (10 digits starting with `9`)
3. Constructs delivery address from recipient name + phone + address fields
4. Begins database transaction
5. Fetches cart items (user_id first, falls back to session_id)
6. Filters unavailable items (disabled, expired, farmer disabled)
7. Validates all cart items have required fields
8. **Atomic stock update** per item:
   - Regular: `stock_quantity = stock_quantity - qty WHERE stock_quantity >= qty`
   - Pre-order: `reserved_quantity = reserved_quantity + qty WHERE max_preorder_quantity IS NULL OR reserved + qty <= max`
9. Pre-order reservation threshold check: blocks if `reservations_disabled = true`
10. Creates one order per cart item with appropriate initial status
11. Sends low-stock notification (threshold: 15 units) for regular products
12. Sends order_placed notification to farmer
13. Clears cart items by ID (fallback: by user_id/session_id)
14. Logs activity via `activityLogger.logPlaceOrder`
15. Commits transaction

### 5.2 Customer Order Viewing (`GET /orders`)

**File:** `backend/routes/orders.js:22-103`

- Returns all orders for the authenticated user
- Joins with products and farmer users for display info
- Formats each order with an `items[]` array (containing itself) for frontend compatibility

### 5.3 Customer Cancellation (`PUT /:id/cancel`)

**File:** `backend/routes/orders.js:1067-1191`

- Only order owner can cancel
- Cancellable statuses: `pending`, `preorder_reserved`
- Restores stock (regular) or reserved_quantity (preorder)
- Sets `cancelled_by = 'customer'`
- Sends notifications to both customer and farmer
- Logs activity via `activityLogger.logCancelOrder`

### 5.4 Customer Reorder

**File:** `frontend/js/orders.js:968-995`

- Available only for delivered orders
- Adds the product back to cart via `POST /cart` API
- Does not create a new order directly

### 5.5 Customer Frontend (`frontend/js/orders.js`)

- `OrdersPage` class manages the customer orders page
- Tabs: All, Active, Delivered, Cancelled (simplified grouping)
- Order cards show: product info, farmer name, status timeline, delivery date, preorder info
- Modals: rating modal, cancellation modal, cancellation reason viewer
- Real-time updates via SSE (EventSource)
- API fallback: tries `/api` first, falls back to `https://agricatch.onrender.com/api`

---

## 6. Farmer Order Flow

### 6.1 Farmer Order Viewing (`GET /orders/farmer/:farmerId`)

**File:** `backend/routes/orders.js:105-222`

- Farmer can only view their own orders (ID match check)
- Filters by product ownership: `p.farmer_id = $1 OR p.farmer_id IS NULL`
- Optional status filter
- Returns orders with customer info (name, rating, verification status)

### 6.2 Farmer Status Updates

**File:** `frontend/js/farmer.js:10253-10314`

- Uses the primary endpoint: `PUT /orders/:orderId/items/:orderItemId/status`
- In per-item system, `orderItemId` is set equal to `orderId`
- On success: reloads all order tabs, switches to the new status tab
- Cancellation prompts for optional reason via `prompt()`

### 6.3 Farmer Action Buttons by Status

**File:** `frontend/js/farmer.js:9676-9735`

| Status | Actions |
|--------|---------|
| pending | Confirm, Cancel |
| preorder_reserved | Confirm, Cancel |
| confirmed | Start Preparing, Schedule Delivery |
| preparing | Schedule Delivery, Cancel |
| scheduled | Reschedule Delivery, Mark as Out for Delivery |
| out_for_delivery | Mark as Delivered |
| delivered | (none) |
| cancelled | (none) |

**Note:** "Confirm" for `preorder_reserved` sends `status: 'confirmed'` via the status update endpoint. However, the primary endpoint's transition matrix allows `preorder_reserved → confirmed`, which **bypasses the harvest conversion requirement**. The harvest conversion check only exists in the delivery-date endpoint, not in the status update endpoint.

### 6.4 Farmer Delivery Scheduling

**File:** `frontend/js/farmer.js:10376-10498`

- Modal with date input (min: today)
- Reschedule mode: shows reason textarea (required, max 300 chars)
- Calls `PUT /orders/:id/delivery-date`
- On success: reloads all orders

### 6.5 Farmer Customer Rating

**File:** `frontend/js/farmer.js:10316-10374`

- Checks eligibility via `GET /orders/:id/customer-rating/eligibility`
- Only for delivered orders within 1 month
- Modal with star rating UI
- Submits via `POST /orders/:id/customer-rating`

### 6.6 Farmer Frontend (`frontend/js/farmer.js`)

- `FarmerDashboard` class (11,390 lines)
- 8 order status tabs: pending, preorder_reserved, confirmed, preparing, scheduled, out_for_delivery, delivered, cancelled
- Loads all statuses in parallel via `Promise.all`
- Stats dashboard cards per status
- Real-time updates via SSE
- Order detail panel with action buttons (event delegation)

---

## 7. Admin Order Flow

### 7.1 Admin Order Listing (`GET /admin/orders`)

**File:** `backend/routes/admin.js:1902-1962`

- Paginated (max 200 per page)
- Filters: search (username, full_name, email, order ID), status, date range, total amount range
- Returns orders with user and product details
- Uses `requireAdmin` middleware

### 7.2 Admin Status Update (`PUT /admin/orders/:id/status`)

**File:** `backend/routes/admin.js:2023-2101`

- Full transition matrix (matches primary endpoint)
- Sends notification to customer
- Writes audit log
- Broadcasts real-time events
- **Does NOT restore stock on cancellation**
- **Does NOT update sales stats on delivery**
- **Does NOT handle preorder reservation restoration**

### 7.3 Admin Order Disable/Enable

**File:** `backend/routes/admin.js:2104-2170`

- Soft delete via `is_disabled = true/false`
- Disabled orders are excluded from farmer and customer queries
- Writes audit log
- No stock/notification side effects

### 7.4 Admin Bulk Cancellation (User Disable Side Effect)

**File:** `backend/routes/admin.js:260-328`

When an admin disables a user, active orders are automatically cancelled:

- `cancelOrdersForProducts` — cancels orders for disabled products
- `cancelOrdersForFarmer` — cancels all active orders for a disabled farmer
- `cancelOrdersForCustomer` — cancels all active orders for a disabled customer

**All three functions only restore `stock_quantity`** — they do not handle preorder reservation restoration. This is a bug for preorder orders affected by admin user/product disabling.

### 7.5 Admin Frontend (`frontend/js/admin.js`)

**File:** `frontend/js/admin.js:8541-9011`

- Order management section with filters (status, search, date, amount)
- Order details modal with status update dropdown
- Disable/enable order buttons
- Real-time notification polling
- Status formatting with color coding

---

## 8. Pre-order vs Available Product Order Flows

### 8.1 Available Product Flow

```
Cart → Checkout → POST /orders
  → Atomic stock deduction (stock_quantity -= qty)
  → Order created with status = 'pending'
  → Notification to farmer
  → Cart cleared

Farmer: pending → confirmed → preparing → scheduled → out_for_delivery → delivered
  → On delivery: product.sales_count += qty, farmer.total_sales += qty, farmer.total_revenue += total
```

### 8.2 Pre-order Flow

```
Cart → Checkout → POST /orders
  → Atomic reservation increment (reserved_quantity += qty)
  → Check max_preorder_quantity limit
  → Check reservations_disabled flag
  → Order created with status = 'preorder_reserved'
  → Notification to farmer
  → Cart cleared

Farmer: Harvest ready → POST /products/:id/convert-preorders
  → FIFO allocation of harvest to reserved orders
  → Fully allocated orders: status → 'confirmed', preorder_converted_at set
  → Partially allocated: preorder_fulfilled_quantity updated, status → 'confirmed'
  → Surplus harvest added to stock_quantity
  → Notification to customer

Farmer: confirmed → preparing → scheduled → out_for_delivery → delivered
  → On delivery: same sales stats update as regular orders
```

### 8.3 Key Differences

| Aspect | Regular | Pre-order |
|--------|---------|-----------|
| Initial status | `pending` | `preorder_reserved` |
| Inventory affected | `stock_quantity` (decrement) | `reserved_quantity` (increment) |
| Limit check | `stock_quantity >= qty` | `max_preorder_quantity` (if set) |
| Harvest conversion | N/A | Required before delivery scheduling |
| Cancellation stock restore | `stock_quantity += qty` | `reserved_quantity -= qty` (if not converted) or `stock_quantity += fulfilled_qty` (if converted) |
| Reservation blocking | N/A | `reservations_disabled` flag (harvest overdue 7+ days) |

---

## 9. Hybrid Pre-order Conversion

### 9.1 Conversion Endpoint (`POST /products/:id/convert-preorders`)

**File:** `backend/routes/products.js:1809-2001`

1. Farmer-only access (ownership verified)
2. Validates `harvest_quantity` is a positive integer
3. Row-level lock on product (`SELECT ... FOR UPDATE`)
4. Calculates allocation:
   - `allocatedQuantity = min(harvest, reserved_quantity)`
   - `surplusQuantity = max(harvest - reserved_quantity, 0)`
   - `shortageQuantity = max(reserved_quantity - harvest, 0)`
5. Updates product: surplus → stock, reserved -= allocated, reset harvest tracking
6. FIFO allocation: orders sorted by `created_at ASC`
   - Allocates against remaining `preorder_reserved_quantity` per order
   - Fully allocated: `preorder_converted_at = NOW()`, `preorder_fulfilled_quantity += allocated`, `preorder_reserved_quantity -= allocated`, `status = 'confirmed'`
   - Partially allocated: same updates but order remains partially reserved
7. Sends "Pre-order Confirmed" notification to affected customers
8. Broadcasts `order.updated` events
9. Returns allocation summary

### 9.2 Partial Harvest Support

- Supports multiple harvest conversions (partial fulfillment)
- Each conversion allocates against remaining `preorder_reserved_quantity`
- Prevents double-allocation by checking remaining reservation per order

### 9.3 Hidden Dependency

The delivery-date endpoint (`PUT /:id/delivery-date`) checks `preorder_converted_at` before allowing scheduling for `preorder_reserved` status. However, the **status update endpoint** (`PUT /:orderId/items/:orderItemId/status`) allows `preorder_reserved → confirmed` without checking conversion. This means a farmer can manually confirm a pre-order without harvest conversion, bypassing the inventory allocation logic.

---

## 10. Cancellation Rules

### 10.1 Customer Cancellation (`PUT /:id/cancel`)

- **Cancellable statuses:** `pending`, `preorder_reserved`
- **Not cancellable:** `confirmed`, `preparing`, `scheduled`, `out_for_delivery`, `delivered`
- Sets `cancelled_by = 'customer'`
- Restores inventory:
  - Regular: `stock_quantity += qty`
  - Pre-order (not converted): `reserved_quantity -= qty`, `preorder_reserved_quantity -= qty`
  - Pre-order (converted): **NOT HANDLED** — only checks `is_preorder` flag, not conversion state
- Sends notifications to customer and farmer

### 10.2 Farmer Cancellation (`PUT /:id/cancel-farmer`)

- **No status restriction** — farmer can cancel any non-terminal order
- Sets `cancelled_by = 'farmer'`
- Restores inventory:
  - Regular: `stock_quantity += qty`
  - Pre-order: `reserved_quantity -= qty`, `preorder_reserved_quantity -= qty`
  - Pre-order (converted): **NOT HANDLED** — same issue as customer cancel
- Sends notification to customer only

### 10.3 Status Update Cancellation (`PUT /:orderId/items/:orderItemId/status` with status='cancelled')

- **Most sophisticated cancellation logic** — handles conversion state
- Pre-order (converted): restores `stock_quantity += preorder_fulfilled_quantity`, resets to 0
- Pre-order (not converted): releases `reserved_quantity -= preorder_reserved_quantity`, resets to 0
- Regular: `stock_quantity += qty`
- Role-aware: customers can only cancel `pending`/`confirmed`; farmers can cancel up to `preparing`
- Sets `cancelled_by = 'farmer'` (even if customer initiates via this endpoint)

### 10.4 Admin Cancellation (`PUT /admin/orders/:id/status` with status='cancelled')

- **No stock restoration at all**
- No `cancelled_by` field set
- No `cancelled_at` timestamp set
- Only updates status and sends notification

### 10.5 Admin Bulk Cancellation (User/Product Disable)

- `cancelOrdersForProducts/Farmer/Customer` — only restores `stock_quantity`
- **Does not handle preorder reservations**
- Sets `cancelled_by = 'admin'`

### 10.6 Cancellation Rules Summary

| Endpoint | Status Restriction | Preorder Conversion-Aware | Stock Restore | Reservation Restore | cancelled_by |
|----------|-------------------|--------------------------|---------------|---------------------|-------------|
| Customer cancel | pending, preorder_reserved | ❌ No | ✅ | ✅ (basic) | customer |
| Farmer cancel | None (any non-terminal) | ❌ No | ✅ | ✅ (basic) | farmer |
| Primary status update | Role-aware | ✅ Yes | ✅ | ✅ (idempotent) | farmer |
| Alt status update | Blocks delivered only | ❌ No | ✅ | ✅ (basic) | farmer |
| Admin status update | Transition matrix | ❌ N/A | ❌ None | ❌ None | Not set |
| Admin bulk cancel | N/A | ❌ No | ✅ | ❌ No | admin |

---

## 11. Delivery Workflow

### 11.1 Delivery Date Setting (`PUT /:id/delivery-date`)

**File:** `backend/routes/orders.js:1193-1350`

- Access: Farmer (owner) or Admin/Super Admin
- Validates delivery date is not in the past
- Allowed statuses: `pending`, `preorder_reserved`, `confirmed`, `preparing`, `scheduled`
- Pre-order requirement: `preorder_converted_at` must be set for `preorder_reserved` status
- Reschedule: requires reason (max 300 chars) when order is already `scheduled`
- Sets status to `scheduled` and stores delivery_date
- Sends "Delivery Scheduled" or "Delivery Rescheduled" notification
- Broadcasts `order.updated` event

### 11.2 Delivery Completion

- Triggered via status update to `delivered`
- Sets `delivered_at = CURRENT_TIMESTAMP`
- Updates `products.sales_count += quantity`
- Updates `users.total_sales += quantity` and `users.total_revenue += total_amount`
- Sends "Order update" notification

### 11.3 Frontend Delivery Scheduling

**File:** `frontend/js/farmer.js:10376-10498`

- Modal with date picker (min: today)
- Reschedule detection: checks if order already has `delivery_date` and `status === 'scheduled'`
- Reason field shown only for rescheduling
- Character count display (max 300)

---

## 12. Completion Rules

### 12.1 Order Completion

- Status `delivered` is terminal — no further transitions allowed
- `delivered_at` timestamp recorded
- Sales statistics updated (product sales_count, farmer total_sales/total_revenue)

### 12.2 Post-Delivery Actions

- **Customer:** Can rate the product (1-month window)
- **Farmer:** Can rate the customer (1-month window)
- **Customer:** Can reorder (adds product to cart)
- **Customer:** Can view delivery date and order details

---

## 13. Review & Rating Rules

### 13.1 Product Reviews (Customer → Product)

**File:** `backend/routes/reviews.js:1-384`

- **Eligibility:** User must have a delivered order for the product
- **Time window:** 1 month after delivery (editable window)
- **Uniqueness:** One review per product per user (unique index)
- **Rating range:** 1-5 stars
- **Side effects:**
  - Refreshes farmer's aggregate `average_rating` and `total_reviews`
  - Sends notification to farmer
  - Fraud detection: flags suspicious patterns (3+ reviews, 4.5+ avg, single farmer)
- **Update/Delete:** Owner only, within eligibility window

### 13.2 Customer Ratings (Farmer → Customer)

**File:** `backend/routes/reviews.js:112-158, 386-422`

- **Eligibility:** Order must be delivered, farmer must own the product
- **Time window:** 1 month after delivery
- **Uniqueness:** One rating per order per farmer
- **Side effects:**
  - Refreshes customer's `customer_average_rating` and `customer_total_ratings`

### 13.3 Review Eligibility Check

**File:** `backend/routes/reviews.js:65-110`

```sql
SELECT COALESCE(delivered_at, updated_at, created_at) AS delivered_ref
FROM orders
WHERE user_id = $1 AND product_id = $2 AND status = 'delivered'
ORDER BY delivered_ref DESC LIMIT 1
```

- Uses most recent delivered order as reference
- Falls back to `updated_at` or `created_at` if `delivered_at` is null

---

## 14. Notifications

### 14.1 Notification Types

| Type | Trigger | Recipient |
|------|---------|-----------|
| `order_placed` | New order created | Farmer |
| `order_update` | Status change, delivery scheduled | Customer |
| `order_cancelled_by_customer` | Customer cancels | Farmer |
| `order_status` | Admin status update | Customer |
| `low_stock_alert` | Stock drops below 15 | Farmer |
| `new_review` | Product review submitted | Farmer |
| `review_updated` | Product review updated | Farmer |
| `fraud_alert` | Suspicious review pattern | Admin |
| `role_changed` | User role changed | Affected user |

### 14.2 Notification Delivery

- Stored in `notifications` table
- Real-time broadcast via `broadcastEvent('notification.created', { user_id })`
- Frontend polls or uses SSE for real-time updates
- Notifications include `order_id` and/or `product_id` for deep linking

---

## 15. Real-time Event Broadcasting

### 15.1 Event Types

| Event | Payload | Purpose |
|-------|---------|---------|
| `order.updated` | `{ order_id, customer_id, farmer_ids, new_status, old_status }` | Sync order status across clients |
| `notification.created` | `{ user_id }` | Trigger notification refresh |
| `admin.audit` | `{ action, entity, entity_id, actor_admin_id }` | Admin audit trail |

### 15.2 Broadcasting Mechanism

**File:** `backend/utils/realtime.js` (referenced via `broadcastEvent`)

- Events broadcast after transaction commit
- Frontend uses SSE (EventSource) to listen for events
- Both customer (`frontend/js/orders.js`) and farmer (`frontend/js/farmer.js`) dashboards subscribe

---

## 16. Frontend Architecture

### 16.1 Customer Orders Page

**Files:** `frontend/orders.html`, `frontend/js/orders.js`

- `OrdersPage` class (1033 lines)
- Simplified tabs: All, Active, Delivered, Cancelled
- Status timeline visualization per order
- Modals: rating, cancellation, reason viewing
- SSE for real-time updates
- API base fallback: `/api` → `https://agricatch.onrender.com/api`
- Scroll position preservation via sessionStorage

### 16.2 Farmer Dashboard

**Files:** `frontend/farmer.html`, `frontend/js/farmer.js`

- `FarmerDashboard` class (11,390 lines)
- 8 order status tabs (one per status)
- Stats cards per status
- Order detail panel with action buttons
- Modals: schedule delivery, customer rating, rejection reason
- SSE for real-time updates
- Parallel loading of all order statuses

### 16.3 Admin Dashboard

**Files:** `frontend/admin.html`, `frontend/js/admin.js`

- Order management section within admin panel
- Filters: status, search, date range, amount range
- Order details modal with status update
- Disable/enable order functionality
- Real-time notification polling

---

## 17. Edge Cases, Bugs & Regression Risks

### 17.1 BUG: Customer Cancel — Missing farmer_id in Notification

**File:** `backend/routes/orders.js:1081-1086, 1170-1176`

The customer cancel endpoint's initial query does NOT select `farmer_id`:
```sql
SELECT o.status, o.product_id, p.name AS product_name
FROM orders o JOIN products p ON p.id = o.product_id
WHERE o.id = $1 AND o.user_id = $2
```

But the farmer notification uses `orderResult.rows[0].farmer_id`:
```javascript
await pool.query(
  `INSERT INTO notifications (user_id, type, ...) VALUES ($1, ...)`,
  [orderResult.rows[0].farmer_id, 'order_cancelled_by_customer', ...]
);
```

**Impact:** `farmer_id` is `undefined`, causing the INSERT to fail (NOT NULL violation) or insert with null. The farmer never receives cancellation notifications from customer-initiated cancellations.

**Severity:** High — farmer is blind to customer cancellations.

### 17.2 BUG: Alternative Status Endpoint — Missing States

**File:** `backend/routes/orders.js:855-1064`

The `/:id/status` endpoint's transition matrix is missing `preorder_reserved` and `scheduled` states. Any attempt to update a preorder_reserved or scheduled order via this endpoint will fail with "Invalid status transition."

**Impact:** If any client calls this endpoint instead of the primary `/:orderId/items/:orderItemId/status` endpoint, preorder and scheduled orders cannot be updated.

**Severity:** Medium — currently the farmer frontend uses the primary endpoint, but the alternative endpoint is a landmine for future development.

### 17.3 BUG: Admin Bulk Cancel — No Preorder Handling

**File:** `backend/routes/admin.js:260-328`

`cancelOrdersForProducts`, `cancelOrdersForFarmer`, and `cancelOrdersForCustomer` all restore only `stock_quantity`. They do not handle `reserved_quantity` for preorder orders.

**Impact:** When an admin disables a farmer or product with active preorder orders, the reserved quantities are never released. The product's `reserved_quantity` becomes permanently inflated.

**Severity:** High — data integrity issue affecting preorder inventory.

### 17.4 BUG: Admin Status Update — No Stock Restoration

**File:** `backend/routes/admin.js:2023-2101`

The admin status update endpoint does not restore stock or reservations when cancelling, nor does it update sales stats when marking as delivered.

**Impact:** Admin-initiated cancellations leave stock permanently deducted. Admin-initiated deliveries don't update sales statistics.

**Severity:** High — data integrity issue.

### 17.5 BUG: Customer/Farmer Cancel — No Conversion-Aware Restoration

**File:** `backend/routes/orders.js:1067-1191, 1352-1459`

Both the customer and farmer cancel endpoints check only `is_preorder` but do not check `preorder_converted_at`. If a preorder has been converted (harvest allocated to stock), cancelling via these endpoints decrements `reserved_quantity` (which may already be 0 after conversion) instead of restoring `stock_quantity`.

**Impact:** Double inventory loss — the converted stock is not restored, and the reservation (already 0) is decremented further (clamped by GREATEST to 0).

**Severity:** High — inventory leak for converted preorders cancelled via these endpoints.

### 17.6 RISK: DDL Inside Transaction

**File:** `backend/routes/orders.js:678`

```javascript
await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS reservations_disabled BOOLEAN DEFAULT false");
```

This DDL statement runs inside a BEGIN/COMMIT transaction during order creation. While PostgreSQL supports DDL in transactions, this is an anti-pattern:
- Adds latency to every order creation
- Can cause lock contention on high-traffic systems
- The column should be created via migration, not at runtime

**Severity:** Low (correctness) / Medium (performance)

### 17.7 RISK: No Idempotency on Order Creation

**File:** `backend/routes/orders.js:494-853`

The `POST /orders` endpoint has no idempotency key. Double-submit (network retry, double-click) can create duplicate orders and double-deduct stock.

**Severity:** Medium — mitigated by cart clearing, but race conditions exist.

### 17.8 RISK: Preorder Reserved → Confirmed Bypasses Harvest Conversion

The primary status update endpoint allows `preorder_reserved → confirmed` without checking `preorder_converted_at`. A farmer can manually confirm a preorder without running the harvest conversion, bypassing the FIFO allocation logic.

**Impact:** Preorder inventory allocation is skipped; `preorder_fulfilled_quantity` remains 0; stock may not be available for delivery.

**Severity:** Medium — business rule violation.

### 17.9 RISK: Farmer Cancel Has No Status Restriction

**File:** `backend/routes/orders.js:1352-1459`

The `/:id/cancel-farmer` endpoint has no status check — a farmer can cancel orders in any status including `scheduled` or `out_for_delivery`. The primary status update endpoint blocks cancellation of `scheduled` and `out_for_delivery` orders.

**Severity:** Medium — business rule inconsistency.

### 17.10 RISK: Farmer Orders Query Includes NULL farmer_id

**File:** `backend/routes/orders.js:160`

```sql
WHERE (p.farmer_id = $1 OR p.farmer_id IS NULL)
```

This means orders for products with no farmer (orphaned products) will appear in every farmer's order list.

**Severity:** Low — unlikely scenario but logically incorrect.

### 17.11 RISK: Notification Sent Outside Transaction (Customer Cancel)

**File:** `backend/routes/orders.js:1162-1176`

In the customer cancel endpoint, notifications are sent AFTER `client.query('COMMIT')` using `pool.query()` (not the transaction client). If the notification INSERT fails, the order is already cancelled but the customer/farmer has no notification.

**Severity:** Low — notifications are non-critical, but inconsistency with other endpoints that send notifications inside the transaction.

### 17.12 RISK: Farmer Cancel Sends No Farmer Notification

**File:** `backend/routes/orders.js:1447-1452`

The farmer cancel endpoint only sends a notification to the customer. No notification is sent to the farmer themselves (unlike customer cancel which notifies both parties).

**Severity:** Low — informational inconsistency.

---

## 18. Dead Code & Redundancy

### 18.1 Alternative Status Update Endpoint

**File:** `backend/routes/orders.js:855-1064`

The `PUT /:id/status` endpoint duplicates the primary `PUT /:orderId/items/:orderItemId/status` endpoint with less functionality. It's unclear which clients use this endpoint. The farmer frontend uses the primary endpoint.

### 18.2 Order Items Table

The `order_items` table and its migration are vestigial. No runtime code creates or updates `order_items` rows. The `items[]` array in API responses is synthesized from the order itself with `order_item_id = order_id`.

### 18.3 Comment: "Mixed order prevention removed"

**File:** `backend/routes/orders.js:612`

```javascript
// Mixed order prevention removed - regular and pre-order products can now be mixed
```

This comment references removed code. Mixed orders (regular + preorder in same checkout) are now supported.

### 18.4 Comment: "loadPreorders removed"

**File:** `frontend/js/farmer.js:9597`

```javascript
// loadPreorders removed - now using status-based loading with preorder_reserved
```

References removed function, now handled by `loadOrdersByStatus('preorder_reserved')`.

### 18.5 Duplicate Transition Matrix

The status transition matrix is defined in **4 separate locations** with divergence:
1. `backend/routes/orders.js:289-298` (primary — most complete)
2. `backend/routes/orders.js:928-935` (alternative — missing states)
3. `backend/routes/admin.js:2036-2045` (admin — matches primary)
4. Frontend validation logic (implicit in button rendering)

---

## 19. Hidden Dependencies

### 19.1 Product Approval Status

Products must have `status = 'approved'` and `is_available = true` to be orderable. The order creation checks `is_available` and `is_admin_disabled` but does NOT check `products.status`. This means products pending approval could theoretically be ordered if they have `is_available = true`.

### 19.2 Feature Flags & Platform Settings

The farmer dashboard loads feature flags and platform settings that affect order management behavior:
- `maxProductsPerFarmer` (default: 10)
- `maxProductsPerNameAvailable` (default: 1)
- `maxProductsPerNamePreorder` (default: 1)
- `lowStockThreshold` (default: 15)

### 19.3 Reservations Disabled Flag

The `reservations_disabled` column on products blocks new preorder reservations when harvest is overdue. This flag is checked during order creation but is reset during harvest conversion.

### 19.4 Harvest Overdue Days

The `harvest_overdue_days` field on products tracks how long a harvest has been overdue. This feeds into the `reservations_disabled` flag (7+ days overdue triggers disable).

### 19.5 User is_disabled Flag

Disabled users (farmers or customers) have their orders automatically cancelled by admin actions. The order creation checks `farmer_is_disabled` for cart items.

### 19.6 Activity Logger

Order placement and customer cancellation are logged via `activityLogger`. This is a hidden dependency — if the logger fails, the order still succeeds but the audit trail is incomplete.

---

## 20. Missing Validation

### 20.1 No Quantity Validation on Order Creation

The order creation endpoint does not validate that `quantity > 0`. It relies on the cart having valid quantities, but there's no explicit check.

### 20.2 No Price Integrity Check

The order creation uses `item.price` from the cart query (joined with products). If the product price was changed between adding to cart and checkout, the customer pays the old price. There's no validation that the cart price matches the current product price.

### 20.3 No Delivery Address Length Validation

The delivery address is constructed from recipient fields but has no length limit. Extremely long addresses could cause database or display issues.

### 20.4 No Rate Limiting on Order Creation

There's no rate limiting on `POST /orders`. A malicious user could spam order creation to deplete stock.

### 20.5 No Concurrent Order Prevention

Two simultaneous checkout requests from the same user could both read the same cart and create duplicate orders. The transaction isolates stock updates but doesn't prevent duplicate order creation.

### 20.6 Admin Status Update Missing Timestamps

The admin status update endpoint only does `UPDATE orders SET status = $1 WHERE id = $2`. It does not set `delivered_at`, `cancelled_at`, or `cancelled_by` based on the new status.

### 20.7 No Validation on Schedule Delivery from Confirmed Status

The delivery-date endpoint allows scheduling from `confirmed` status, which skips the `preparing` state. The status would jump from `confirmed` directly to `scheduled`. This may be intentional (flexibility) but is not documented.

---

## 21. Recommended Improvements

### 21.1 Critical (Should Fix Before Production)

1. **Fix customer cancel notification bug** — Add `p.farmer_id` to the SELECT query in `PUT /:id/cancel`
2. **Fix admin bulk cancel preorder handling** — Add `reserved_quantity` restoration to `cancelOrdersForProducts/Farmer/Customer`
3. **Fix admin status update side effects** — Add stock restoration on cancel, sales stats on deliver, timestamp fields
4. **Fix customer/farmer cancel conversion-awareness** — Check `preorder_converted_at` and restore from `stock_quantity` if converted
5. **Remove DDL from transaction** — Move `ALTER TABLE` to a migration, remove from order creation flow

### 21.2 High Priority

6. **Consolidate transition matrix** — Extract to a shared module, import in all endpoints
7. **Remove or align alternative status endpoint** — Either remove `PUT /:id/status` or align its transition matrix with the primary endpoint
8. **Add preorder conversion check to status update** — Block `preorder_reserved → confirmed` via status update unless `preorder_converted_at` is set
9. **Add status restrictions to farmer cancel** — Align with primary endpoint's cancellation rules
10. **Add idempotency to order creation** — Use idempotency key or cart version to prevent duplicate orders

### 21.3 Medium Priority

11. **Add product status check to order creation** — Verify `products.status = 'approved'` during checkout
12. **Add price integrity check** — Compare cart price with current product price, warn or update on mismatch
13. **Move notifications inside transactions** — Ensure notifications are sent within the same transaction as the status change
14. **Fix farmer orders query** — Remove `OR p.farmer_id IS NULL` condition
15. **Add rate limiting** — Protect order creation and status update endpoints

### 21.4 Low Priority

16. **Clean up order_items table** — Either remove the table or properly maintain it
17. **Remove dead comments** — Clean up "removed" comments referencing deleted code
18. **Add delivery address length validation** — Enforce reasonable max length
19. **Add quantity > 0 validation** — Explicit check in order creation
20. **Document the schedule-from-confirmed behavior** — Clarify if skipping `preparing` is intentional

---

## Appendix A: File Inventory

| File | Lines | Role |
|------|-------|------|
| `backend/routes/orders.js` | 1,461 | Primary order routes |
| `backend/routes/admin.js` | 4,564 | Admin order management |
| `backend/routes/reviews.js` | 581 | Review & rating routes |
| `backend/routes/products.js` | 2,325 | Pre-order conversion |
| `backend/server.js` | 1,291 | Runtime schema creation |
| `database/schema.sql` | ~300 | Database schema |
| `database/migrations/add_order_item_status.sql` | 40 | Order items migration |
| `frontend/js/orders.js` | 1,033 | Customer orders UI |
| `frontend/js/farmer.js` | 11,390 | Farmer dashboard UI |
| `frontend/js/admin.js` | ~9,000+ | Admin dashboard UI |
| `frontend/orders.html` | ~700 | Customer orders page |
| `frontend/farmer.html` | 3,795 | Farmer dashboard page |

---

## Appendix B: Status Transition Diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
                    ▼                                                     │
            ┌──────────────┐         ┌──────────┐                        │
            │   pending    │────────▶│ confirmed│                        │
            │              │         │          │                        │
            └──────┬───────┘         └────┬─────┘                        │
                   │                      │                              │
                   │              ┌───────▼────────┐                     │
                   │              │   preparing    │                     │
                   │              └───────┬────────┘                     │
                   │                      │                              │
                   │              ┌───────▼────────┐                     │
                   │              │   scheduled    │                     │
                   │              └───────┬────────┘                     │
                   │                      │                              │
                   │              ┌───────▼────────┐                     │
                   │              │out_for_delivery│                     │
                   │              └───────┬────────┘                     │
                   │                      │                              │
                   │              ┌───────▼────────┐                     │
                   │              │   delivered    │ (terminal)          │
                   │              └────────────────┘                     │
                   │                                               │
                   ▼                                               │
            ┌──────────────┐                                       │
            │  cancelled   │ (terminal)                             │
            └──────────────┘                                       │
                                                                    │
  ┌────────────────────┐                                           │
  │ preorder_reserved  │─── harvest conversion ──▶ confirmed ───────┘
  └────────────────────┘
```

---

**End of Report**
