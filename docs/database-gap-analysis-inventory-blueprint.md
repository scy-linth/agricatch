# DATABASE GAP ANALYSIS

This document compares the current AgriCatch database schema against the Final Inventory Blueprint and identifies missing tables, columns, constraints, and capabilities required for the new farmer-controlled order workflow.

---

# 1. Current Schema Baseline

## Existing Product Inventory Fields

The base `products` table has `stock_quantity`, but preorder fields are migration-added, not present in base schema.

```sql
-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    farmer_id INTEGER REFERENCES users(id),
    stock_quantity INTEGER DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'kg', -- kg, pieces, boxes, etc.
    image_url VARCHAR(255),
    sales_count INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    is_admin_disabled BOOLEAN DEFAULT false,
    admin_disabled_at TIMESTAMP,
    location VARCHAR(100), -- farm location
    harvest_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Preorder product fields exist through migration:

```sql
-- Add pre-order fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_availability_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_preorder_quantity INTEGER CHECK (max_preorder_quantity IS NULL OR max_preorder_quantity > 0);
```

## Existing Order Fields

The base `orders` table has order quantity, status, delivery date, cancellation fields, and timestamps.

```sql
-- Orders table (per-item orders: each order represents one product/item)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL, -- price at time of order
    total_amount DECIMAL(10, 2) NOT NULL, -- quantity * price
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, preparing, out_for_delivery, delivered, cancelled
    is_disabled BOOLEAN DEFAULT false,
    disabled_at TIMESTAMP,
    payment_method VARCHAR(20) DEFAULT 'cash_on_delivery',
    delivery_address TEXT,
    delivery_date DATE,
    estimated_delivery_date DATE,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(20),
    replacement_order_id INTEGER,
    special_instructions TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Preorder order fields exist through migration:

```sql
-- Add is_preorder field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_converted_at TIMESTAMP;

-- Add per-order preorder allocation tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_reserved_quantity INTEGER DEFAULT 0 CHECK (preorder_reserved_quantity >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_fulfilled_quantity INTEGER DEFAULT 0 CHECK (preorder_fulfilled_quantity >= 0);
```

---

# 2. Required Fields That Already Exist

## Product-Level Fields

| Field | Exists? | Source | Blueprint Role | Gap |
|---|---:|---|---|---|
| `products.stock_quantity` | Yes | `schema.sql:57` | Sellable public stock | Semantics need enforcement |
| `products.is_preorder` | Yes | `add_preorder_fields.sql:2` | Marks preorder-capable product | Exists |
| `products.reserved_quantity` | Yes | `add_preorder_fields.sql:4` | Active unconverted preorder reservations | Exists but incomplete without allocation tracking |
| `products.max_preorder_quantity` | Yes | `add_preorder_fields.sql:5` | Reservation cap | Exists |
| `products.preorder_availability_date` | Yes | `add_preorder_fields.sql:3` | Expected harvest/availability date | Exists |
| `products.status` | Yes | `add_product_status.sql:1-16` | Product approval state | Not inventory status |

## Order-Level Fields

| Field | Exists? | Source | Blueprint Role | Gap |
|---|---:|---|---|---|
| `orders.quantity` | Yes | `schema.sql:88` | Ordered quantity | Exists |
| `orders.status` | Yes | `schema.sql:91` | Order lifecycle | Too narrow in comments/current code |
| `orders.delivery_date` | Yes | `schema.sql:96` | Farmer-scheduled delivery date | Exists but lacks scheduler metadata |
| `orders.is_preorder` | Yes | `add_preorder_fields.sql:8` | Freezes order type | Exists |
| `orders.preorder_reserved_quantity` | Yes | `add_preorder_fields.sql:12` | Per-order unconverted reservation | Exists |
| `orders.preorder_fulfilled_quantity` | Yes | `add_preorder_fields.sql:13` | Intended allocated/fulfilled preorder quantity | Exists but naming/semantics are insufficient |
| `orders.preorder_converted_at` | Yes | `add_preorder_fields.sql:9` | Conversion timestamp | Insufficient for partial/multiple conversions |
| `orders.cancelled_at` | Yes | `schema.sql:98` | Cancellation timestamp | Exists |
| `orders.cancelled_by` | Yes | `schema.sql:100` | Cancellation actor role | Exists but unconstrained |

---

# 3. Required Fields That Are Missing

## Critical Missing Order Inventory Fields

| Missing Field | Needed For | Why It Is Needed |
|---|---|---|
| `orders.inventory_state` | Inventory idempotency, cancellation idempotency | Current schema cannot tell whether stock/reservation was already released, allocated, or consumed |
| `orders.stock_deducted_quantity` | Regular order idempotency | Needed to know how much stock was deducted and how much can be restored |
| `orders.preorder_allocated_quantity` | Converted preorder allocation | `preorder_fulfilled_quantity` exists, but it conflates "allocated from harvest" with "fulfilled/delivered" |
| `orders.preorder_unfulfilled_quantity` | Partial harvest fulfillment | Needed if one preorder is only partially allocated |
| `orders.inventory_released_at` | Double restoration prevention | Marks that cancellation already released inventory |
| `orders.inventory_consumed_at` | Delivered inventory finality | Distinguishes delivered consumption from simple status change |
| `orders.cancelled_by_user_id` | Cancellation audit | `cancelled_by` only stores role/string, not the actual actor |
| `orders.delivery_scheduled_at` | Farmer scheduling audit | Existing `delivery_date` stores date only |
| `orders.delivery_scheduled_by` | Farmer/admin scheduling authority | Needed to prove farmer/admin set the date, not customer |
| `orders.delivery_time_window` | Scheduling UX | Needed if delivery has time window |
| `orders.delivery_rescheduled_at` | Reschedule audit | Needed to distinguish first schedule vs reschedule |

## Critical Missing Product Inventory Fields

| Missing Field | Needed For | Why It Is Needed |
|---|---|---|
| `products.allocated_preorder_quantity` or derivable equivalent | Product-level allocation visibility | Needed to distinguish public `stock_quantity` from preorder-allocated harvest |
| `products.last_harvest_conversion_at` | Harvest audit | Needed to know latest conversion event |
| `products.total_harvested_quantity` or ledger-derived equivalent | Harvest accounting | Needed for long-term audit if multiple conversions occur |
| `products.inventory_version` or equivalent concurrency marker | Race safety | Useful for detecting stale inventory writes/quantity adjustments |

**Important:** `products.allocated_preorder_quantity` can be either stored or derived from an allocation table. The cleaner design is to derive it from allocation records, not duplicate it as a product column.

---

# 4. Missing Tables

## 1. `inventory_movements` / Inventory Ledger

**Needed for:**

- Inventory idempotency
- Auditability
- Quantity adjustment workflow
- Admin/farmer/customer cancellation audit
- Double restoration prevention

**Why current schema is insufficient:**

Current inventory changes are represented only by mutating `products.stock_quantity`, `products.reserved_quantity`, and a few order fields. There is no durable record of:

- why inventory changed
- who changed it
- whether a cancellation already restored inventory
- whether a movement was stock deduction, reservation, release, allocation, surplus, or consumption

**Features depending on it:**

- Prevention of double restoration
- Inventory audit reports
- Quantity adjustment history
- Admin accountability
- Safe cancellation workflow

---

## 2. `preorder_harvest_conversions` / Harvest Batch Table

**Needed for:**

- Partial harvest fulfillment
- Multiple harvest conversions
- Surplus calculation
- Harvest audit

**Why current schema is insufficient:**

Current schema has only `orders.preorder_converted_at` and product-level `reserved_quantity`. That cannot represent:

- multiple harvest batches
- harvest quantity per batch
- surplus per batch
- shortage per batch
- which farmer/admin performed conversion
- partial allocation across orders

**Features depending on it:**

- Final preorder conversion lifecycle
- Partial harvest scenarios
- Surplus-only public stock rule
- Farmer harvest accountability

---

## 3. `preorder_allocations` / Order Allocation Table

**Needed for:**

- Allocated preorder quantities
- Partial fulfillment
- Multiple harvest batches allocated to one order
- One harvest batch allocated to many orders

**Why current schema is insufficient:**

`orders.preorder_fulfilled_quantity` can store one number, but cannot represent allocation history.

Example it cannot model well:

```
Order A reserved 30
Harvest batch 1 allocates 10
Harvest batch 2 allocates 20
```

With only one field, you lose:

- batch source
- allocation timestamp
- allocation actor
- allocation reversals
- partial release on cancellation

**Features depending on it:**

- Partial harvest fulfillment
- Converted preorder cancellation
- Allocation priority order
- Prevention of reserved units becoming public stock

---

## 4. `order_status_history` / Order Timeline Table

**Needed for:**

- Farmer-controlled delivery workflow
- Customer-facing timeline
- Admin audit
- Cancellation idempotency support

**Why current schema is insufficient:**

`orders.status` stores only the current state. It cannot prove:

- when order became `confirmed`
- when order became `preparing`
- when order became `scheduled`
- who changed each status
- whether status was reverted or skipped

**Features depending on it:**

- Customer-facing order timeline
- Farmer workflow audit
- Admin/superadmin review
- Dispute resolution

---

## 5. `delivery_schedule_history`

**Needed for:**

- Farmer-controlled delivery scheduling
- Rescheduling audit
- Customer notifications
- Admin oversight

**Why current schema is insufficient:**

`orders.delivery_date` stores only the latest date. It cannot track:

- first scheduled date
- prior dates
- reschedule reason
- scheduling actor
- schedule timestamp
- admin override

**Features depending on it:**

- Farmer schedules deliveries
- Delivery rescheduling
- Customer-facing timeline
- Admin/superadmin audit

---

## 6. `quantity_adjustments`

This can be a standalone table or a movement type inside `inventory_movements`.

**Needed for:**

- Farmer stock edits
- Admin corrections
- Preorder capacity changes
- Audit of manual inventory changes

**Why current schema is insufficient:**

The current product update directly overwrites `stock_quantity` in `backend/routes/products.js:1490-1501`. The schema has no table explaining why the quantity changed.

**Features depending on it:**

- Quantity adjustment workflow
- Inventory audit
- Fraud/error investigation
- Production-safe admin corrections

---

# 5. Missing Constraints

## Existing Constraints

Current preorder migration has useful but incomplete constraints:

```sql
-- Add check constraint for reserved quantity <= max preorder quantity (idempotent)
DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT preorder_reserved_within_max CHECK (
    max_preorder_quantity IS NULL OR reserved_quantity <= max_preorder_quantity
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add check constraint for stock_quantity >= 0 (idempotent)
DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT stock_quantity_non_negative CHECK (
    stock_quantity >= 0
```

## Missing Constraint Categories

| Constraint | Needed For | Gap |
|---|---|---|
| `orders.quantity > 0` | Basic order integrity | Not explicit in base schema |
| `order_items.quantity > 0` | Item integrity | Not explicit in base schema |
| `orders.status IN (...)` | Lifecycle integrity | `status` is free-form `VARCHAR(20)` |
| `orders.cancelled_by IN (...)` | Actor role integrity | `cancelled_by` is free-form |
| `orders.inventory_state IN (...)` | Inventory idempotency | Field missing |
| `preorder_reserved_quantity <= quantity` | Preorder allocation integrity | Not enforced |
| `preorder_fulfilled_quantity <= quantity` | Preorder allocation integrity | Not enforced |
| `preorder_reserved_quantity + preorder_allocated_quantity <= quantity` | Partial allocation correctness | Missing because proper allocated field is missing |
| `delivery_date >= created_at::date` or business-valid equivalent | Delivery scheduling integrity | Not enforced |
| `delivery_scheduled_by IS NOT NULL when delivery_date IS NOT NULL` | Farmer-controlled delivery rule | Scheduler field missing |
| Unique idempotency key on inventory movement | Double restoration prevention | Ledger table missing |
| Allocation quantity > 0 | Allocation integrity | Allocation table missing |
| Harvest allocation cannot exceed harvest batch quantity | Overselling prevention | Harvest/allocation tables missing |
| Surplus stock equals harvest minus allocated reservations | Overselling prevention | Not representable currently |

---

# 6. Can Current Schema Support Required Workflows?

## A. Allocated Preorder Quantities

**Verdict:** Partially, but not safely.

Current field:

```sql
-- Add per-order preorder allocation tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_reserved_quantity INTEGER DEFAULT 0 CHECK (preorder_reserved_quantity >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_fulfilled_quantity INTEGER DEFAULT 0 CHECK (preorder_fulfilled_quantity >= 0);
```

**What it can support:**

- A single numeric fulfilled/allocated amount per order.

**What it cannot safely support:**

- Multiple harvest batches
- Allocation source
- Allocation priority
- Partial allocation history
- Release of allocated units back to stock on cancellation
- Distinguishing "allocated" from "delivered/fulfilled"

**Gap:** `preorder_fulfilled_quantity` should not be the sole allocation model. A dedicated allocation record is needed.

---

## B. Partial Harvest Fulfillment

**Verdict:** Not adequately supported.

**Current support:**

- `preorder_reserved_quantity`
- `preorder_fulfilled_quantity`
- `preorder_converted_at`

**Missing support:**

- Harvest batch identity
- Partial allocation status
- Per-order unfulfilled quantity
- Allocation history
- Multiple conversion events
- Shortage tracking
- Allocation priority

**Conclusion:**

The current schema can store a rough partial number, but it cannot safely represent the full partial harvest lifecycle.

---

## C. Quantity Adjustment Workflow

**Verdict:** Not supported as an auditable workflow.

**Current support:**

- `products.stock_quantity`
- `products.reserved_quantity`
- `products.max_preorder_quantity`

**Missing support:**

- Adjustment reason
- Adjustment actor
- Before/after quantity
- Adjustment type
- Related product/order/harvest batch
- Approval/override context
- Idempotency key

**Conclusion:**

The schema supports direct quantity mutation, but not a production-grade quantity adjustment workflow.

---

## D. Farmer-Controlled Delivery Scheduling

**Verdict:** Partially supported.

Current field:

```sql
    payment_method VARCHAR(20) DEFAULT 'cash_on_delivery',
    delivery_address TEXT,
    delivery_date DATE,
    estimated_delivery_date DATE,
```

**What exists:**

- `orders.delivery_date`

**What is missing:**

- `scheduled` order status is not represented in schema comments/current status model
- `delivery_scheduled_at`
- `delivery_scheduled_by`
- `delivery_time_window`
- reschedule history
- schedule source role
- schedule reason/notes

**Conclusion:**

The database can store a final date, but cannot enforce or audit farmer-controlled scheduling.

---

## E. Inventory Idempotency

**Verdict:** Not supported.

**Why:**

The schema has no durable inventory state, movement ledger, or idempotency key. It cannot tell whether:

- stock was already deducted
- stock was already restored
- reservation was already released
- preorder allocation was already released
- delivered inventory was already consumed

**Required missing concepts:**

- `inventory_state`
- `inventory_movements`
- movement uniqueness/idempotency key
- release/consume timestamps

---

## F. Cancellation Idempotency

**Verdict:** Not supported.

Current fields:

```sql
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(20),
```

**What exists:**

- Cancellation timestamp
- Cancellation reason
- Cancelled-by role/string

**What is missing:**

- Actual cancelling user id
- Cancellation inventory release marker
- Inventory release quantity
- Idempotency guard
- Separate cancellation event record
- Constraint preventing repeated inventory restoration

**Conclusion:**

Current schema can record that an order is cancelled, but not whether cancellation inventory effects have already been applied.

---

# 7. Recommended Schema Changes and Dependencies

## Change 1: Add Explicit Order Inventory State

**Needed field/concept:**

```
orders.inventory_state
```

**Why needed:**

The final blueprint requires inventory idempotency. Current `orders.status` is not enough because fulfillment status and inventory state are different.

Example:

```
status = cancelled
inventory_state = released
```

is different from:

```
status = cancelled
inventory_state = already_released
```

**Features depending on it:**

- Prevention of double restoration
- Safe cancellation
- Regular stock restoration
- Preorder reservation release
- Delivered inventory finality

---

## Change 2: Add Inventory Movement Ledger

**Needed table/concept:**

```
inventory_movements
```

**Why needed:**

Product quantity fields show the current balance, but not why the balance changed.

**Features depending on it:**

- Quantity adjustment workflow
- Double restoration prevention
- Admin audit
- Farmer audit
- Customer cancellation audit
- Production inventory reconciliation

---

## Change 3: Add Harvest Conversion Batch Records

**Needed table/concept:**

```
preorder_harvest_conversions
```

**Why needed:**

A single `preorder_converted_at` timestamp on orders cannot represent multiple harvest events.

**Features depending on it:**

- Partial harvest fulfillment
- Surplus harvest calculation
- Multiple harvest cycles
- Harvest shortage tracking
- Farmer accountability

---

## Change 4: Add Preorder Allocation Records

**Needed table/concept:**

```
preorder_allocations
```

**Why needed:**

`orders.preorder_fulfilled_quantity` is a single aggregate. It cannot show which harvest batch allocated which quantity.

**Features depending on it:**

- Allocated preorder quantities
- Partial harvest fulfillment
- Converted preorder cancellation
- Allocation priority
- Prevention of reserved units becoming public stock

---

## Change 5: Refine Existing Preorder Order Fields

**Existing field issue:**

```
preorder_fulfilled_quantity
```

The name implies customer fulfillment/delivery, but the blueprint needs harvested allocation.

**Why needed:**

The system must distinguish:

```
reserved
allocated from harvest
delivered/consumed
released back to stock
```

**Features depending on it:**

- Post-conversion cancellation
- Partial harvest display
- Delivery workflow
- Inventory finality

---

## Change 6: Add Delivery Scheduling Metadata

**Needed fields/concepts:**

```
delivery_scheduled_at
delivery_scheduled_by
delivery_time_window
delivery_schedule_status/history
```

**Why needed:**

`delivery_date` alone cannot prove farmer-controlled scheduling.

**Features depending on it:**

- Farmer-controlled delivery scheduling
- Customer timeline
- Rescheduling notifications
- Admin/superadmin audit

---

## Change 7: Add Order Status History

**Needed table/concept:**

```
order_status_history
```

**Why needed:**

Current `orders.status` only stores current state.

**Features depending on it:**

- Customer-facing timeline
- Farmer workflow trace
- Admin audit
- Dispute resolution
- Delivery scheduling timeline

---

## Change 8: Add Cancellation Event/Inventory Release Tracking

**Needed fields/concepts:**

```
cancelled_by_user_id
inventory_released_at
inventory_released_quantity
cancellation_event_id
```

or represent these through `inventory_movements`.

**Why needed:**

Current cancellation fields do not prevent repeated inventory restoration.

**Features depending on it:**

- Cancellation idempotency
- Admin cancellation
- Farmer cancellation
- Customer cancellation
- Inventory audit

---

## Change 9: Add Stronger Constraints

**Needed constraints:**

- Positive order quantity
- Positive allocation quantity
- Valid order statuses
- Valid inventory states
- Valid cancellation actors
- Preorder reserved/allocated quantities cannot exceed order quantity
- Delivery date requires scheduling actor
- Movement idempotency uniqueness

**Why needed:**

The current schema relies heavily on backend logic. Database constraints should protect core inventory invariants.

**Features depending on it:**

- Overselling prevention
- Double restoration prevention
- Data integrity under concurrent requests
- Admin/superadmin safety

---

# 8. Final Gap Matrix

| Capability | Current Schema Support | Gap Severity |
|---|---|---:|
| Regular sellable stock | Supported by `stock_quantity` | Low |
| Regular order stock deduction | Supported by fields, enforced by code | Medium |
| Regular cancellation restoration | Not idempotently supported | High |
| Preorder reservations | Supported by `reserved_quantity` and `preorder_reserved_quantity` | Medium |
| Allocated preorder quantities | Weakly supported by `preorder_fulfilled_quantity` | High |
| Partial harvest fulfillment | Not structurally supported | Critical |
| Surplus-only harvest stock | Not structurally enforced | Critical |
| Quantity adjustment workflow | Not supported | High |
| Farmer-controlled delivery date | Partially supported by `delivery_date` | High |
| Delivery rescheduling audit | Not supported | High |
| Inventory idempotency | Not supported | Critical |
| Cancellation idempotency | Not supported | Critical |
| Admin/superadmin auditability | Partial through existing admin logs, not inventory-specific | High |

---

# Final Verdict

## Current Schema Status

```
The current schema supports basic regular orders and basic preorder reservation counting.

It does not fully support the Final Inventory Blueprint.
```

## Production-Readiness for New Workflow

```
Not ready for the new farmer-controlled order workflow.
```

## Critical Database Gaps Before Workflow Redesign

1. **No inventory state**
   - Cannot prevent double restoration.

2. **No inventory ledger**
   - Cannot audit stock/reservation movements.

3. **No harvest conversion batch model**
   - Cannot safely handle partial or multiple harvests.

4. **No preorder allocation model**
   - Cannot distinguish reserved, allocated, surplus, consumed, or released units.

5. **No delivery scheduling audit fields**
   - Cannot prove farmers/admins controlled delivery scheduling.

6. **No order status history**
   - Cannot produce an authoritative customer-facing timeline.

7. **Weak constraints**
   - Core inventory invariants are not database-protected.
