# Hybrid Pre-order System Design

**Date:** 2025-06-20  
**Project:** AgriCatch  
**Status:** Draft  

## Overview

Add a hybrid pre-order system to AgriCatch that allows farmers to sell products before they are harvested, while maintaining the existing immediate ordering system for products with available stock. This enables farmers to secure demand before harvest and reduces food waste through demand-based harvesting.

**Key Features:**
- Products can be marked as pre-order with an availability date
- Customers can reserve products before they're available
- Hybrid stock management (available stock + reserved quantities)
- Cash on delivery for both regular and pre-orders
- Farmers convert pre-orders to stock when harvest is ready

## Data Model Changes

### Products Table

Add the following fields to the existing `products` table:

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_availability_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_preorder_quantity INTEGER;
```

**Field Descriptions:**
- `is_preorder`: Marks product as having pre-order capability
- `preorder_availability_date`: When pre-ordered products become available for delivery
- `reserved_quantity`: Quantity reserved by pre-orders (not deducted from actual stock)
- `max_preorder_quantity`: Optional cap on total pre-orders allowed

### Orders Table

Add the following field to the existing `orders` table:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
```

**Field Description:**
- `is_preorder`: Tracks whether the order was placed as a pre-order

### Validation Rules

1. If `is_preorder = true`, then `preorder_availability_date` is required
2. If `is_preorder = true`, `stock_quantity` can be 0 (no stock yet)
3. Pre-orders increment `reserved_quantity`, not `stock_quantity`
4. `expiry_date` must be >= `preorder_availability_date` when both are set
5. `reserved_quantity + new_quantity <= max_preorder_quantity` (if max is set)

## API Changes

### Product Endpoints

#### POST /api/products
**Add to request body:**
- `is_preorder` (boolean, optional)
- `preorder_availability_date` (date, required if is_preorder=true)
- `max_preorder_quantity` (integer, optional)

**Validation:**
- If `is_preorder=true`, `preorder_availability_date` is required
- If `preorder_availability_date` is set, validate against `expiry_date`

#### PUT /api/products/:id
**Allow updating:**
- All pre-order fields
- Can toggle `is_preorder` on/off

#### GET /api/products
**Add query parameter:**
- `?preorder=true` - Return only pre-order products
- `?preorder=false` - Return only regular products
- No parameter - Return all products (existing behavior)

**Response changes:**
- Include pre-order fields in product objects

#### GET /api/products/:id
**Response changes:**
- Include pre-order fields in product object

### Order Endpoints

#### POST /api/orders
**Logic changes:**
```javascript
if (product.is_preorder) {
  // Pre-order flow
  if (reserved_quantity + quantity > max_preorder_quantity) {
    return error("Pre-order limit exceeded");
  }
  // Increment reserved_quantity, not stock_quantity
  reserved_quantity += quantity;
  order.is_preorder = true;
  // Validate delivery_date >= preorder_availability_date
  if (delivery_date < preorder_availability_date) {
    return error("Delivery date must be after availability date");
  }
} else {
  // Regular order flow (existing)
  if (quantity > stock_quantity) {
    return error("Not enough stock");
  }
  stock_quantity -= quantity;
  order.is_preorder = false;
}
```

**Additional validation:**
- Cannot mix pre-order and regular products in same order
- Pre-order delivery date must be >= `preorder_availability_date`

#### GET /api/orders
**Response changes:**
- Include `is_preorder` field in order objects

#### GET /api/orders/:id
**Response changes:**
- Include `is_preorder` field in order object

### New Farmer Endpoint

#### POST /api/products/:id/convert-preorders
**Purpose:** Convert reserved pre-orders to actual stock when harvest is ready

**Logic:**
```javascript
// Move reserved_quantity to stock_quantity
stock_quantity += reserved_quantity;
reserved_quantity = 0;

// Update pre-order orders to allow processing
// Orders proceed through normal workflow:
// pending → confirmed → preparing → out_for_delivery → delivered
```

**Request body:**
- `harvest_quantity` (integer, optional) - Actual harvested quantity
- If provided, validate `harvest_quantity >= reserved_quantity`

**Response:**
- Success message with converted quantities
- List of affected order IDs

## UI Changes

### Product Listing (index.html)

**Add to product cards:**
- Badge: "Pre-order" or "Available Now"
- For pre-orders: "Available: [date]" text
- For pre-orders: "Reserved: X / Y" progress bar (if max_preorder_quantity set)

**Add filter controls:**
- Filter toggle: "All Products" / "Available Now" / "Pre-order Only"
- Update product listing API call with `?preorder=` parameter

**Button changes:**
- Pre-order products: "Reserve" button instead of "Add to Cart"
- Regular products: "Add to Cart" (existing behavior)

### Product Detail Page (product.html)

**Add pre-order banner:**
- If pre-order: Show "Pre-order - Available on [date]" banner at top
- Show "Reserved: X / Y" progress bar
- Display expected delivery timeline

**Delivery date picker:**
- Enforce minimum date = `preorder_availability_date`
- Show validation error if date is too early

**Button text:**
- Pre-order: "Pre-order Now"
- Regular: "Add to Cart"

### Farmer Product Form (farmer.html)

**Add to product form:**
- Checkbox: "Enable pre-order for this product"
- If checked, show:
  - Date picker: "Availability date"
  - Number input: "Maximum pre-order quantity" (optional)
  - Display current "Reserved quantity" vs "Max" stats

**Product list display:**
- Show pre-order badge
- Show reserved quantity
- Show availability date for pre-orders

### Customer Orders Page (orders.html)

**Add to order items:**
- "Pre-order" badge for pre-order items
- For pre-orders: "Expected availability: [date]" text
- Status timeline shows "Pre-order placed" as starting point

**Order status display:**
- Pre-order orders show "Pre-order placed" instead of just "Pending"
- Timeline: Pre-order placed → Confirmed → Preparing → Out for delivery → Delivered

### Farmer Orders Page (farmer.html)

**Add separate tabs:**
- "Regular Orders" tab (existing orders)
- "Pre-orders" tab (is_preorder=true orders)

**Pre-orders tab:**
- Show "Convert to stock" button when harvest is ready
- Display reservation counts per product
- Show availability date for each pre-order

**Convert pre-orders action:**
- Button triggers POST /api/products/:id/convert-preorders
- Show success message with converted quantities
- Refresh order list

## Order Workflow

### Regular Order Flow (Existing)

1. Customer adds product to cart
2. Customer checks out with delivery address and date
3. Order created with `is_preorder=false`
4. Stock deducted immediately from `stock_quantity`
5. Farmer processes order through normal workflow
6. Order status: pending → confirmed → preparing → out_for_delivery → delivered

### Pre-order Flow (New)

1. Customer clicks "Pre-order" on product
2. Customer checks out with delivery address and date
3. System validates:
   - `reserved_quantity + quantity <= max_preorder_quantity`
   - `delivery_date >= preorder_availability_date`
4. Order created with `is_preorder=true`
5. `reserved_quantity` incremented (not `stock_quantity`)
6. Order stays in "pending" until `preorder_availability_date`
7. When harvest ready:
   - Farmer clicks "Convert pre-orders to stock"
   - System moves `reserved_quantity` to `stock_quantity`
   - Orders proceed through normal workflow
8. Order status: pending → confirmed → preparing → out_for_delivery → delivered

### Hybrid Stock Scenario

**Example:** Farmer has 50kg tomatoes now, will harvest 100kg in 2 weeks

- Product state: `stock_quantity = 50`, `reserved_quantity = 0`, `is_preorder = true`
- Customer orders 10kg now → `stock_quantity = 40` (regular order)
- Customer pre-orders 20kg for future → `reserved_quantity = 20` (pre-order)
- When harvest arrives: farmer adds 100kg to stock
- After conversion: `stock_quantity = 140`, `reserved_quantity = 0`
- Pre-orders convert to regular orders and get fulfilled

### Cancellation Rules

**Pre-orders:**
- Can be cancelled before `preorder_availability_date`
- Cancellation decrements `reserved_quantity`
- Customer receives notification

**After availability date:**
- Same cancellation rules as regular orders
- Follow existing status transition matrix

## Validation Rules Summary

### Product Creation/Update
- If `is_preorder=true`, `preorder_availability_date` is required
- `expiry_date >= preorder_availability_date` when both are set
- `max_preorder_quantity` must be positive if provided

### Order Creation
- Pre-order delivery date must be >= `preorder_availability_date`
- `reserved_quantity + quantity <= max_preorder_quantity` (if max set)
- Cannot mix pre-order and regular items in same order
- Regular orders: `quantity <= stock_quantity` (existing)

### Pre-order Conversion
- `harvest_quantity >= reserved_quantity` (if provided)
- Only farmer who owns product can convert
- Product must have `is_preorder=true`

## Implementation Considerations

### Database Migration
- Create migration file: `database/migrations/add_preorder_fields.sql`
- Add ALTER TABLE statements for products and orders
- Set default values for existing records
- Test migration on development database first

### Backward Compatibility
- Existing products default to `is_preorder=false`
- Existing orders default to `is_preorder=false`
- API endpoints remain backward compatible (new fields optional)
- Frontend gracefully handles missing pre-order fields

### Testing Strategy
- Unit tests for reservation logic
- Integration tests for order creation flow
- End-to-end tests for pre-order conversion
- Edge cases: max limits, date validation, cancellation

### Performance Considerations
- Add index on `is_preorder` column for filtering
- Add index on `preorder_availability_date` for date-based queries
- Cache product listing results with pre-order filters

### Error Handling
- Clear error messages for pre-order limit exceeded
- Validation errors for invalid delivery dates
- Notification system for conversion events
- Graceful handling of harvest quantity mismatches

## Success Criteria

1. Farmers can create products with pre-order capability
2. Customers can place pre-orders with future availability dates
3. Stock is reserved but not deducted until conversion
4. Farmers can convert pre-orders to stock when harvest is ready
5. Orders proceed through normal workflow after conversion
6. Validation prevents invalid pre-order scenarios
7. UI clearly distinguishes pre-order from regular products
8. System handles hybrid stock (available + reserved) correctly

## Future Enhancements (Out of Scope for Thesis)

- Partial pre-order fulfillment (if harvest is less than expected)
- Pre-order notifications when product becomes available
- Pre-order discounts or pricing tiers
- Group/batch pre-order functionality
- Pre-order analytics for farmers
