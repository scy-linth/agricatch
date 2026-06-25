# AgriCatch Hybrid Pre-Order System - Thesis Defense Preparation Package

**Date:** 2026-06-25  
**System Status:** Feature-Complete and Demonstration-Ready  
**Purpose:** Comprehensive preparation materials for thesis defense presentation

---

## Executive Summary

AgriCatch is a farmer-to-consumer marketplace platform that implements a hybrid pre-order system, enabling farmers to sell products before harvest while maintaining immediate ordering for available stock. This system reduces food waste through demand-based harvesting and provides customers with guaranteed access to future harvests.

**Core Innovation:** Hybrid inventory model that tracks both available stock (`stock_quantity`) and reserved pre-order demand (`reserved_quantity`) separately, allowing farmers to plan harvests based on actual customer demand.

**Key Achievement:** Complete end-to-end workflow from customer reservation → farmer harvest → conversion → order fulfillment, with full admin monitoring and approval workflows.

---

## Demonstration Sequence

### Recommended 15-Minute Live Demonstration Flow

#### Part 1: System Overview (2 minutes)
1. **Landing Page Navigation**
   - Show marketplace with both "Available Now" and "HARVEST SOON" badges
   - Highlight product type filter: "All Products" / "Available Now" / "Pre-order Only"
   - Demonstrate product card information display

2. **Role Introduction**
   - Briefly explain three user roles: Customer, Farmer, Admin
   - Show login modal with role-based access

#### Part 2: Customer Pre-Order Journey (4 minutes)
1. **Product Discovery**
   - Navigate to pre-order section via "Browse Preorders" button
   - Show pre-order product with "HARVEST SOON" badge
   - Click product to view details modal
   - Highlight pre-order banner: "Pre-order - Available on [date]"
   - Show reservation progress: "Reserved: 5/20"

2. **Reservation Process**
   - Click "Reserve" button (yellow/warning color)
   - Show cart with pre-order item marked with badge
   - Demonstrate delivery date validation (minimum = availability date)
   - Proceed to checkout
   - Show "Place Pre-order" button and "Pay when your pre-order arrives" text
   - Complete order placement

3. **Order Confirmation**
   - Show order confirmation with pre-order status
   - Navigate to order history
   - Highlight "Pre-order Reserved" status and badge
   - Show availability date display

#### Part 3: Farmer Harvest & Convert Workflow (5 minutes)
1. **Product Creation (Optional - 1 minute)**
   - Login as farmer
   - Navigate to Products section
   - Show product type selection: "Available Now" vs "Pre-orders"
   - Demonstrate pre-order form fields: availability date, max pre-order quantity
   - Submit product for approval

2. **Pre-Order Management**
   - Show "Pre-orders" tab in Products section
   - Display product with reservation progress
   - Show status badges: Active, Harvest Ready
   - Highlight expected harvest date

3. **Harvest Action**
   - Click "Harvest" button on pre-order product
   - Show harvest confirmation modal
   - Explain: "This action transfers reserved inventory to Available Now stock"
   - Confirm harvest
   - Show success message

4. **Convert Action**
   - Click "Convert" button (or "Convert Remaining Inventory")
   - Show convert confirmation modal
   - Explain: "This makes reservations available for fulfillment"
   - Confirm conversion
   - Show product moved to "Available Now" tab
   - Navigate to Orders section
   - Show pre-order orders transitioned to "Confirmed" status

#### Part 4: Admin Monitoring (3 minutes)
1. **Product Approval**
   - Login as admin (staff or super_admin)
   - Navigate to Product Approvals section
   - Show pre-order product in pending queue
   - Display pre-order fields in product details
   - Approve pre-order product

2. **Order Monitoring**
   - Navigate to Order Monitoring section
   - Show "Pre-order Reserved" tab in order status tabs
   - Display pre-order orders with badges
   - Show order status transitions
   - Navigate to Dashboard to show platform metrics

#### Part 5: End-to-End Hybrid Flow (1 minute)
1. **Hybrid Stock Demonstration**
   - Show product with both available stock and pre-order capacity
   - Explain: "50kg available now, 20kg reserved for future harvest"
   - Demonstrate customer placing regular order (stock deduction)
   - Demonstrate customer placing pre-order (reservation increment)
   - Show final state after harvest and conversion

---

## Recommended Demo Accounts

### Customer Account
**Username:** `demo_customer`  
**Password:** `Demo123!`  
**Role:** Customer  
**Purpose:** Demonstrate product browsing, pre-order reservation, cart management, checkout, order history

**Prepared State:**
- Active account with verified email
- Address configured for delivery
- No pending orders (clean slate)
- Wishlist populated with sample products

### Farmer Account
**Username:** `demo_farmer`  
**Password:** `Demo123!`  
**Role:** Farmer  
**Purpose:** Demonstrate product creation, pre-order management, harvest/convert workflow, order fulfillment

**Prepared State:**
- Verified farmer account
- Shop profile configured with images
- 3-5 products created:
  - 2 "Available Now" products with stock
  - 2 "Pre-order" products with future availability dates
  - 1 product with hybrid stock (both available and pre-order capacity)
- Pre-order products have customer reservations
- Some products at "Harvest Ready" status

### Admin Account (Staff)
**Username:** `demo_admin`  
**Password:** `Demo123!`  
**Role:** Admin (staff)  
**Purpose:** Demonstrate product approval, order monitoring, user management

**Prepared State:**
- Staff admin account
- Access to Product Approvals, Order Monitoring, User Management
- Pending products in approval queue
- Mix of pre-order and regular orders in system

### Superadmin Account (Backup)
**Username:** `demo_superadmin`  
**Password:** `Demo123!`  
**Role:** Super_admin  
**Purpose:** Emergency access, platform settings, security monitoring (use only if needed)

**Prepared State:**
- Superadmin account
- Access to all admin features plus security logs, platform settings
- Clean security log (no recent suspicious activity)

---

## Demo Data Preparation Checklist

### Database State Verification

#### Products Table
- [ ] At least 5 "Available Now" products with `is_preorder=false`
- [ ] At least 5 "Pre-order" products with `is_preorder=true`
- [ ] Pre-order products have future `preorder_availability_date` (1-2 weeks out)
- [ ] Pre-order products have `max_preorder_quantity` set (20-50 units)
- [ ] Some pre-order products have `reserved_quantity > 0` (5-15 units)
- [ ] At least 1 product with hybrid stock (both `stock_quantity > 0` and `reserved_quantity > 0`)
- [ ] All products have valid `expiry_date` >= `preorder_availability_date`
- [ ] Product images uploaded and accessible
- [ ] Products assigned to appropriate categories

#### Orders Table
- [ ] At least 3 regular orders with `is_preorder=false`
- [ ] At least 3 pre-order orders with `is_preorder=true`
- [ ] Pre-order orders in various statuses: `preorder_reserved`, `confirmed`, `preparing`
- [ ] Regular orders in various statuses: `pending`, `confirmed`, `delivered`
- [ ] Orders have valid delivery addresses
- [ ] Orders linked to correct products and farmers

#### Users Table
- [ ] Demo customer account exists and is active
- [ ] Demo farmer account exists and is verified
- [ ] Demo admin account exists with staff role
- [ ] Demo superadmin account exists (backup)
- [ ] All demo accounts have valid email addresses
- [ ] Farmer account has shop profile configured
- [ ] No demo accounts are disabled or locked

#### Categories Table
- [ ] At least 5 product categories exist
- [ ] Categories have names and descriptions
- [ ] Products assigned to appropriate categories

### Frontend State Verification

#### Landing Page
- [ ] "Browse Preorders" button visible and functional
- [ ] Product type filter working (All/Available Now/Pre-order Only)
- [ ] Product cards display correct badges
- [ ] Product cards show reservation progress for pre-orders
- [ ] Search functionality working

#### Farmer Dashboard
- [ ] Products tabs visible: "Available Now", "Pre-orders", "Approval"
- [ ] Pre-orders tab shows reservation progress
- [ ] Harvest and Convert buttons visible on pre-order products
- [ ] Status badges displaying correctly
- [ ] Order status tabs include pre-order orders

#### Admin Dashboard
- [ ] Product Approvals section accessible
- [ ] Order Monitoring section accessible
- [ ] "Pre-order Reserved" tab visible in order status tabs
- [ ] Pre-order badge visible in product table
- [ ] Status transitions include `preorder_reserved`

### Environment Verification

#### Backend
- [ ] Backend server running on expected port
- [ ] Database connection stable
- [ ] All API endpoints responding correctly
- [ ] No pending database migrations
- [ ] Pre-order migration applied: `add_preorder_fields.sql`

#### Frontend
- [ ] Frontend served correctly
- [ ] No console errors on page load
- [ ] All JavaScript files loading
- [ ] CSS files loading correctly
- [ ] Images loading correctly

#### External Services
- [ ] Render API accessible (if using production backend)
- [ ] PSGC API working for address dropdowns
- [ ] Image storage accessible
- [ ] Email service configured (if sending notifications)

### Test Data Cleanup

#### Before Demonstration
- [ ] Clear any test orders from previous runs
- [ ] Reset product stock to expected values
- [ ] Reset reservation quantities to expected values
- [ ] Clear cart data for demo accounts
- [ ] Clear notification queues
- [ ] Verify no conflicting test data

#### After Demonstration
- [ ] Archive demonstration orders for reference
- [ ] Reset product states if needed
- [ ] Clear any temporary test data
- [ ] Document any issues encountered
- [ ] Update demo data preparation checklist based on lessons learned

---

## Common Panel Questions

### Problem-Solving Questions

**Q1: What problem does the hybrid pre-order system solve?**

**Answer:** The hybrid pre-order system addresses two key problems in agricultural e-commerce:

1. **Food Waste Reduction:** Farmers often harvest based on estimates, leading to surplus that goes to waste. By allowing customers to pre-order before harvest, farmers can harvest based on actual demand, reducing waste.

2. **Supply Uncertainty for Customers:** Customers often cannot find products they want because farmers don't know what demand will be. Pre-orders give customers guaranteed access to future harvests.

The hybrid model is innovative because it doesn't force farmers to choose between pre-orders and immediate sales—they can do both simultaneously, tracking stock and reservations separately.

**Q2: Why not use a pure pre-order model or pure immediate sales model?**

**Answer:** Pure models have significant limitations:

- **Pure pre-order:** Farmers can't sell available stock immediately, losing revenue. Customers can't get products that are already harvested.
- **Pure immediate sales:** Farmers must harvest speculatively, leading to waste. Customers can't guarantee future access.

The hybrid model gives farmers flexibility: they can sell what they have now while taking pre-orders for future harvests. This maximizes revenue and minimizes waste.

**Q3: How does this compare to existing agricultural marketplace solutions?**

**Answer:** Most agricultural marketplaces use pure immediate sales models. Some have pre-order features, but they typically:

- Require farmers to choose between pre-order or immediate sales (not hybrid)
- Don't track reservations separately from stock
- Don't provide harvest/conversion workflows
- Lack admin monitoring for pre-order workflows

AgriCatch's hybrid model with separate stock/reservation tracking and harvest/conversion workflows is a novel approach that addresses the unique challenges of agricultural supply chains.

### User Experience Questions

**Q4: How do customers understand the difference between "Available Now" and "Pre-order"?**

**Answer:** The system uses multiple visual cues:

- **Badges:** "Available Now" (green) vs "HARVEST SOON" (yellow/orange)
- **Button text:** "Add to Cart" vs "Reserve"
- **Product details:** Pre-order banner with availability date
- **Progress indicators:** "Reserved: X / Y" for pre-orders
- **Delivery date validation:** Pre-orders enforce minimum delivery date = availability date

The checkout flow also clarifies: "Pay when your pre-order arrives" for pre-orders vs immediate payment expectations for regular orders (though AgriCatch uses cash-on-delivery for both).

**Q5: What prevents customers from being confused about when they'll receive their order?**

**Answer:** Several mechanisms:

- **Availability date:** Clearly displayed on pre-order products
- **Delivery date validation:** System prevents selecting dates before availability
- **Order status:** Pre-orders show "Pre-order Reserved" until harvest
- **Order history:** Availability date shown for pre-order orders
- **Confirmation messaging:** Clear communication about expected timeline

**Q6: How do farmers know when to harvest and convert?**

**Answer:** The system provides:

- **Status badges:** "Harvest Ready" when availability date has passed
- **Reservation progress:** Shows how much is reserved
- **Expected harvest date:** Displayed in pre-orders tab
- **KPI cards:** Dashboard shows "Pending Harvest" count
- **Order notifications:** Farmers receive notifications when pre-orders are placed

The workflow is: Harvest (record that crops are ready) → Convert (make reservations available for fulfillment).

### Business Model Questions

**Q7: How does the pre-order system affect farmer revenue?**

**Answer:** The pre-order system can increase farmer revenue through:

1. **Demand-based harvesting:** Farmers harvest exactly what's needed, reducing waste and increasing effective yield
2. **Guaranteed sales:** Pre-orders represent committed demand, reducing uncertainty
3. **Cash flow:** While payment is on delivery, knowing demand helps farmers plan resources
4. **Customer loyalty:** Guaranteed access builds customer relationships

The hybrid model allows farmers to maximize revenue by selling available stock immediately while securing future demand through pre-orders.

**Q8: What's the payment model for pre-orders?**

**Answer:** AgriCatch uses cash-on-delivery for both regular orders and pre-orders. This simplifies the system and avoids:

- Complex refund workflows if harvests fail
- Payment gateway fees for pre-orders that may not be fulfilled
- Customer trust issues with paying for future deliveries

The trade-off is that farmers don't receive upfront payment for pre-orders, but this aligns with agricultural cash flow patterns and reduces customer risk.

**Q9: How does the system handle cases where harvest is less than expected?**

**Answer:** Current implementation:

- **Harvest action:** Transfers reserved quantity to stock (auto-transfers)
- **Convert action:** Makes reservations available for fulfillment
- **Limitation:** If harvest is less than reserved, system doesn't handle partial fulfillment (this is a known limitation, see Future Enhancements)

For thesis demonstration, the system assumes farmers harvest at least the reserved quantity. Post-thesis enhancements would add partial harvest handling with customer notification and refund options.

---

## Technical Defense Questions

### Architecture Questions

**Q10: How does the hybrid inventory model work at the database level?**

**Answer:** The system uses two separate quantity fields in the `products` table:

- `stock_quantity`: Tracks available stock for immediate sales
- `reserved_quantity`: Tracks pre-order reservations (not deducted from stock)

When a customer places a regular order: `stock_quantity` is decremented.  
When a customer places a pre-order: `reserved_quantity` is incremented.

This separation allows hybrid scenarios where a product has both available stock (e.g., 50kg) and reserved demand (e.g., 20kg) simultaneously.

**Q11: What database schema changes were required for the hybrid pre-order system?**

**Answer:** The migration `add_preorder_fields.sql` added:

**To `products` table:**
- `is_preorder` (BOOLEAN): Marks product as having pre-order capability
- `preorder_availability_date` (DATE): When pre-ordered products become available
- `reserved_quantity` (INTEGER): Quantity reserved by pre-orders
- `max_preorder_quantity` (INTEGER): Optional cap on total pre-orders

**To `orders` table:**
- `is_preorder` (BOOLEAN): Tracks whether order was placed as pre-order
- `preorder_converted_at` (TIMESTAMP): When pre-order was converted to regular order
- `preorder_reserved_quantity` (INTEGER): Original reservation quantity
- `preorder_fulfilled_quantity` (INTEGER): Actual fulfilled quantity

**Q12: How does the system prevent race conditions in inventory management?**

**Answer:** The system uses database-level atomic operations:

- **Order creation:** Stock deduction and reservation increment happen in single SQL transactions
- **Checkout validation:** Validates stock/reservation limits before order creation
- **Status updates:** Order status transitions use transactional updates

Example from `backend/routes/orders.js`:
```javascript
// Regular order - atomic stock deduction
const { rows } = await pool.query(
  `UPDATE products 
   SET stock_quantity = stock_quantity - $1 
   WHERE id = $2 AND stock_quantity >= $1 
   RETURNING stock_quantity`,
  [quantity, productId]
);
```

This ensures that concurrent orders cannot oversell stock or over-reserve pre-orders.

### API Design Questions

**Q13: How does the API handle the difference between regular and pre-order orders?**

**Answer:** The order creation endpoint (`POST /api/orders`) has conditional logic:

```javascript
if (product.is_preorder) {
  // Pre-order flow
  if (reserved_quantity + quantity > max_preorder_quantity) {
    return error("Pre-order limit exceeded");
  }
  reserved_quantity += quantity;
  order.is_preorder = true;
  // Validate delivery_date >= preorder_availability_date
} else {
  // Regular order flow
  if (quantity > stock_quantity) {
    return error("Not enough stock");
  }
  stock_quantity -= quantity;
  order.is_preorder = false;
}
```

The API also prevents mixing pre-order and regular products in the same order to avoid confusion in fulfillment workflows.

**Q14: What are the key API endpoints for the pre-order system?**

**Answer:**

**Product endpoints:**
- `POST /api/products`: Create product with pre-order fields
- `PUT /api/products/:id`: Update product (can toggle pre-order on/off)
- `GET /api/products?preorder=true`: Filter by pre-order status
- `POST /api/products/:id/harvest-preorder`: Harvest pre-order inventory
- `POST /api/products/:id/convert-preorders`: Convert reservations to stock

**Order endpoints:**
- `POST /api/orders`: Create order (handles both regular and pre-order)
- `GET /api/orders`: List orders (includes is_preorder field)
- `PUT /api/orders/:id/status`: Update order status

**Q15: How does the harvest/convert workflow work at the API level?**

**Answer:** Two separate endpoints:

**Harvest (`POST /api/products/:id/harvest-preorder`):**
- Marks that farmer has harvested the crop
- Currently auto-transfers reserved_quantity to stock_quantity
- Updates product status to "Harvest Ready"

**Convert (`POST /api/products/:id/convert-preorders`):**
- Moves reserved_quantity to stock_quantity
- Updates pre-order orders to allow fulfillment
- Orders transition from `preorder_reserved` to `confirmed`
- Triggers notifications to customers

The separation allows farmers to record harvest (even if not converting immediately) and convert when ready for fulfillment.

### Frontend Architecture Questions

**Q16: How does the frontend handle the different product types?**

**Answer:** The frontend uses conditional rendering based on `is_preorder` field:

**Product cards:**
- Badge: "Available Now" (green) vs "HARVEST SOON" (yellow)
- Button: "Add to Cart" vs "Reserve"
- Progress bar: Only shown for pre-orders

**Product details modal:**
- Pre-order banner: Only shown for pre-orders
- Availability date: Only shown for pre-orders
- Reservation progress: Only shown for pre-orders

**Checkout:**
- Delivery date validation: Different minimum dates
- Button text: "Place Order" vs "Place Pre-order"
- Payment messaging: Different explanations

**Q17: How does the farmer dashboard manage pre-order products?**

**Answer:** The farmer dashboard has separate tabs:

**"Available Now" tab:**
- Shows products with `is_preorder=false`
- Displays stock quantity
- Standard product management

**"Pre-orders" tab:**
- Shows products with `is_preorder=true`
- Displays reservation progress
- Shows expected harvest date
- Harvest and Convert buttons
- Status badges (Active, Harvest Ready, etc.)

**"Approval" tab:**
- Shows pending products (including pre-orders)
- Approval workflow for new products

**Q18: How does the admin dashboard monitor pre-orders?**

**Answer:** The admin dashboard has:

**Product Approvals:**
- Pre-order products appear in pending queue
- Pre-order fields visible in product details
- Approval/reject workflow

**Order Monitoring:**
- "Pre-order Reserved" tab in order status tabs
- Pre-order badge on order IDs
- Status transitions include `preorder_reserved`
- Order details show pre-order information

**Dashboard:**
- KPI cards show pre-order metrics (if implemented)
- Platform-wide visibility into pre-order activity

### Validation and Error Handling Questions

**Q19: What validation rules prevent invalid pre-order scenarios?**

**Answer:**

**Product creation:**
- If `is_preorder=true`, `preorder_availability_date` is required
- `expiry_date` must be >= `preorder_availability_date`
- `max_preorder_quantity` must be positive if provided
- `stock_quantity` can be 0 for pre-orders

**Order creation:**
- Pre-order delivery date must be >= `preorder_availability_date`
- `reserved_quantity + quantity <= max_preorder_quantity` (if max set)
- Cannot mix pre-order and regular items in same order
- Regular orders: `quantity <= stock_quantity`

**Pre-order conversion:**
- Only farmer who owns product can convert
- Product must have `is_preorder=true`
- Harvest must be performed before conversion (in workflow)

**Q20: How does the system handle errors in the pre-order workflow?**

**Answer:** The system has multiple error handling layers:

**Frontend validation:**
- Form validation before submission
- Date picker constraints
- Real-time stock/reservation checking

**Backend validation:**
- API endpoint validation
- Database constraint validation
- Transaction rollback on errors

**User feedback:**
- Clear error messages
- Toast notifications
- Modal confirmations for critical actions

**Example error messages:**
- "Pre-order limit exceeded"
- "Delivery date must be on or after availability date"
- "Cannot mix pre-order and regular products in same order"

---

## Functional Defense Questions

### Workflow Questions

**Q21: Walk through the complete pre-order workflow from customer to delivery.**

**Answer:**

1. **Farmer creates pre-order product:**
   - Farmer selects "Pre-orders" product type
   - Sets availability date (future date)
   - Sets max pre-order quantity (optional)
   - Product submitted for admin approval

2. **Admin approves product:**
   - Admin reviews pre-order product
   - Approves product for marketplace
   - Product becomes visible to customers

3. **Customer discovers product:**
   - Customer browses marketplace
   - Sees "HARVEST SOON" badge
   - Views product details with availability date

4. **Customer places pre-order:**
   - Customer clicks "Reserve" button
   - Adds to cart (pre-order item marked)
   - Proceeds to checkout
   - Selects delivery date (>= availability date)
   - Places pre-order
   - Order created with `is_preorder=true`
   - `reserved_quantity` incremented

5. **Order waits for harvest:**
   - Order status: `preorder_reserved`
   - Customer sees "Pre-order Reserved" in order history
   - Farmer sees reservation in dashboard

6. **Farmer harvests:**
   - Farmer clicks "Harvest" button
   - System records harvest
   - Product status changes to "Harvest Ready"

7. **Farmer converts:**
   - Farmer clicks "Convert" button
   - `reserved_quantity` moved to `stock_quantity`
   - Orders transition to `confirmed`
   - Customers notified

8. **Order fulfillment:**
   - Order proceeds through normal workflow
   - Status: confirmed → preparing → out_for_delivery → delivered
   - Customer receives product

**Q22: What happens if a customer wants to cancel a pre-order?**

**Answer:** Current implementation:

- **Before availability date:** Customer can cancel pre-order
- **Cancellation process:** Standard order cancellation flow
- **Inventory effect:** `reserved_quantity` is decremented
- **Notification:** Farmer receives cancellation notification
- **After availability date:** Same cancellation rules as regular orders (follow status transition matrix)

The system allows pre-order cancellation before harvest to give customers flexibility while giving farmers time to adjust harvest plans.

**Q23: What happens if a farmer wants to cancel a pre-order product?**

**Answer:** Current implementation:

- **Before any reservations:** Farmer can disable/delete product
- **After reservations:** Farmer should not cancel (would break customer commitments)
- **Admin intervention:** Admin can disable problematic products if needed
- **Customer notification:** If product is cancelled, customers should be notified (current limitation - see Future Enhancements)

The system assumes farmers honor pre-order commitments. Post-thesis enhancements would add farmer cancellation workflows with customer notification and refund options.

### Edge Case Questions

**Q24: What happens if harvest is less than reserved quantity?**

**Answer:** Current limitation:

- **System behavior:** Harvest action auto-transfers reserved_quantity to stock_quantity
- **Assumption:** Farmer harvests at least reserved quantity
- **If harvest is less:** System doesn't handle partial fulfillment
- **Impact:** Some customers may not receive their full order

This is a known limitation. Future enhancements would add:
- Harvest quantity input field
- Validation: harvest_quantity >= reserved_quantity
- Partial fulfillment workflow with customer notification
- Refund options for unfulfilled portions

For thesis demonstration, the system assumes farmers harvest adequately.

**Q25: What happens if availability date is in the past when product is created?**

**Answer:** Current implementation:

- **Validation:** Availability date must be in future (frontend validation)
- **Backend check:** If date is in past, product creation fails
- **Error message:** "Availability date must be in the future"
- **Admin override:** Admin could potentially set past dates (not recommended)

The system prevents creating pre-order products with past availability dates to avoid confusion.

**Q26: What happens if max_preorder_quantity is reached?**

**Answer:** Current implementation:

- **Validation:** Checkout checks `reserved_quantity + quantity <= max_preorder_quantity`
- **Error message:** "Pre-order limit exceeded"
- **Customer experience:** Customer cannot add more to cart
- **Progress bar:** Shows "Reserved: X / Y" with Y = max
- **Visual indicator:** Progress bar at 100% when limit reached

The system enforces pre-order limits to prevent farmers from over-committing.

### Integration Questions

**Q27: How does the pre-order system integrate with the existing order status workflow?**

**Answer:** The pre-order system extends the existing status workflow:

**Regular order flow:**
`pending` → `confirmed` → `preparing` → `out_for_delivery` → `delivered`

**Pre-order flow:**
`preorder_reserved` → `confirmed` → `preparing` → `out_for_delivery` → `delivered`

The key difference is the `preorder_reserved` status, which indicates the order is waiting for harvest. Once converted, pre-orders follow the same flow as regular orders.

**Q28: How does the pre-order system integrate with the notification system?**

**Answer:** The pre-order system uses existing notification infrastructure:

**Existing notification types:**
- `order_placed`: Farmer receives when order placed
- `order_update`: Customer receives when order status changes
- `low_stock_alert`: Farmer receives when stock is low

**Pre-order-specific notifications:**
- Pre-order placement triggers `order_placed` to farmer
- Pre-order conversion triggers `order_update` to customer
- Harvest actions could trigger notifications (future enhancement)

The system reuses existing notification storage and SSE broadcast infrastructure.

**Q29: How does the pre-order system integrate with the chat system?**

**Answer:** The pre-order system leverages existing chat infrastructure:

**Chat context:**
- Product context includes pre-order information
- Order context includes pre-order status
- Availability date visible in chat context

**Chat triggers:**
- Customers can chat with farmers about pre-orders
- Farmers can chat with customers about harvest timing
- Admin can chat with farmers about pre-order issues

The chat system doesn't have pre-order-specific features but provides context for pre-order discussions.

---

## Hybrid Pre-Order Justification

### Academic Justification

**Research Problem:** Agricultural e-commerce platforms face unique challenges due to the seasonal and perishable nature of agricultural products. Traditional e-commerce models (immediate sales only) don't account for the planning cycles required in agriculture.

**Proposed Solution:** A hybrid pre-order system that allows farmers to sell products before harvest while maintaining immediate ordering for available stock. This model reduces food waste through demand-based harvesting and provides customers with guaranteed access to future harvests.

**Novelty Contribution:**
- **Hybrid inventory model:** Separate tracking of stock and reservations
- **Harvest/conversion workflow:** Two-step process for managing pre-order fulfillment
- **Demand-based harvesting:** Farmers harvest based on actual customer demand
- **Integrated approval workflow:** Admin monitoring of pre-order products

**Theoretical Foundation:**
- **Supply chain management:** Just-in-time inventory principles applied to agriculture
- **Platform economics:** Two-sided marketplace with asymmetric information
- **User experience design:** Clear visual distinction between product types
- **Database design:** Atomic operations for inventory management

### Practical Justification

**Real-World Problem:**
- **Food waste:** 30-40% of food produced is wasted (FAO)
- **Farmer income uncertainty:** Farmers harvest speculatively, leading to surplus
- **Customer supply uncertainty:** Customers can't guarantee future access
- **Inefficiency:** Mismatch between supply and demand

**AgriCatch Solution:**
- **Demand-based harvesting:** Farmers harvest based on actual reservations
- **Guaranteed access:** Customers secure future harvests through pre-orders
- **Reduced waste:** Less surplus due to better demand matching
- **Income stability:** Farmers have committed demand before harvest

**Measurable Impact:**
- **Waste reduction:** Target 20-30% reduction in food waste
- **Farmer revenue:** Potential 15-25% increase through demand-based harvesting
- **Customer satisfaction:** Guaranteed access improves customer retention
- **Platform efficiency:** Better supply-demand matching

### Technical Justification

**System Requirements:**
- **Scalability:** Must handle concurrent orders and inventory updates
- **Consistency:** Inventory must be accurate across all operations
- **Usability:** Clear distinction between product types for all users
- **Reliability:** System must handle edge cases gracefully

**Technical Approach:**
- **Database design:** Separate stock and reservation fields with atomic operations
- **API design:** Conditional logic for regular vs pre-order flows
- **Frontend design:** Visual distinction and clear user workflows
- **Validation:** Multi-layer validation to prevent invalid states

**Implementation Quality:**
- **Backward compatibility:** Existing products default to regular orders
- **Error handling:** Clear error messages and recovery options
- **Testing:** End-to-end validation of all workflows
- **Documentation:** Comprehensive system documentation

---

## Available Now vs Pre-Order Explanation

### Conceptual Difference

**Available Now (Regular Products):**
- Products that are harvested and ready for immediate sale
- Stock is physically available in farmer's inventory
- Customers can purchase and receive delivery quickly
- Stock quantity is deducted immediately upon order
- Delivery date has no minimum constraint (beyond business rules)

**Pre-Order (Future Harvest):**
- Products that will be harvested in the future
- Stock is not yet available, but capacity can be reserved
- Customers reserve their share of the future harvest
- Reservation quantity is incremented (not stock)
- Delivery date must be on or after availability date
- Orders wait in `preorder_reserved` status until harvest

### Customer Experience

**Available Now:**
- **Badge:** Green "Available Now" badge
- **Button:** "Add to Cart" button
- **Delivery:** Can select delivery date immediately
- **Payment:** Cash on delivery (same as pre-orders)
- **Fulfillment:** Order proceeds through normal workflow immediately

**Pre-Order:**
- **Badge:** Yellow/orange "HARVEST SOON" badge
- **Button:** "Reserve" button
- **Delivery:** Must select date >= availability date
- **Payment:** Cash on delivery (same as regular orders)
- **Fulfillment:** Order waits for harvest before fulfillment

### Farmer Experience

**Available Now:**
- **Stock management:** Manage `stock_quantity` directly
- **Fulfillment:** Process orders immediately
- **Inventory risk:** Risk of unsold stock (waste)
- **Revenue:** Immediate revenue potential

**Pre-Order:**
- **Reservation management:** Manage `reserved_quantity`
- **Harvest planning:** Harvest based on reservations
- **Inventory risk:** Reduced risk (demand-based harvesting)
- **Revenue:** Guaranteed future demand

### Technical Implementation

**Available Now:**
```javascript
// Order creation
if (quantity > stock_quantity) {
  return error("Not enough stock");
}
stock_quantity -= quantity;
order.is_preorder = false;
```

**Pre-Order:**
```javascript
// Order creation
if (reserved_quantity + quantity > max_preorder_quantity) {
  return error("Pre-order limit exceeded");
}
reserved_quantity += quantity;
order.is_preorder = true;
```

### Hybrid Scenario

**Product with both Available Now and Pre-Order capacity:**
- Example: Farmer has 50kg tomatoes now, will harvest 100kg in 2 weeks
- Product state: `stock_quantity = 50`, `reserved_quantity = 0`, `is_preorder = true`
- Customer orders 10kg now → `stock_quantity = 40` (regular order)
- Customer pre-orders 20kg for future → `reserved_quantity = 20` (pre-order)
- When harvest arrives: farmer adds 100kg to stock
- After conversion: `stock_quantity = 140`, `reserved_quantity = 0`
- Pre-orders convert to regular orders and get fulfilled

This hybrid model gives farmers maximum flexibility: sell what they have now while securing future demand.

---

## Farmer Harvest and Conversion Explanation

### Harvest Action

**Purpose:** Record that the farmer has harvested the crop and it's ready for fulfillment.

**When to use:** When the physical harvest is complete and the product is ready for delivery.

**What it does:**
- Marks the product as "Harvest Ready"
- Currently auto-transfers `reserved_quantity` to `stock_quantity`
- Updates product status
- Triggers notification (if implemented)

**User interface:**
- Button: "Harvest" button in pre-orders table
- Modal: Harvest confirmation modal
- Feedback: Success message with quantity transferred

**Technical implementation:**
```javascript
POST /api/products/:id/harvest-preorder
// Current: auto-transfers reserved_quantity to stock_quantity
stock_quantity += reserved_quantity;
reserved_quantity = 0;
```

**Current limitation:** Harvest quantity input is not available (auto-transfers reserved quantity). Future enhancement would allow farmers to specify actual harvest quantity.

### Convert Action

**Purpose:** Make reserved pre-order inventory available for order fulfillment.

**When to use:** After harvest, when ready to begin fulfilling pre-order orders.

**What it does:**
- Moves `reserved_quantity` to `stock_quantity`
- Updates pre-order orders from `preorder_reserved` to `confirmed`
- Triggers notifications to customers
- Orders proceed through normal fulfillment workflow

**User interface:**
- Button: "Convert" button in pre-orders table
- Modal: Convert confirmation modal
- Feedback: Success message with converted quantity

**Technical implementation:**
```javascript
POST /api/products/:id/convert-preorders
stock_quantity += reserved_quantity;
reserved_quantity = 0;
// Update orders
UPDATE orders SET status = 'confirmed' WHERE is_preorder = true AND product_id = :id;
```

### Workflow Sequence

**Recommended sequence:**
1. **Harvest:** When crop is physically harvested
2. **Convert:** When ready to fulfill pre-order orders

**Why separate actions:**
- **Harvest:** Records physical harvest event
- **Convert:** Triggers fulfillment workflow
- **Flexibility:** Farmers can harvest but delay conversion if needed
- **Clarity:** Separate steps make the workflow clear

**Current implementation:**
- Harvest auto-transfers reservations to stock
- Convert is essentially a no-op if harvest already transferred
- This is a simplification for thesis demonstration
- Future enhancement would make harvest record quantity without transferring

### Example Scenario

**Initial state:**
- Product: "Organic Tomatoes"
- `stock_quantity = 0` (no stock yet)
- `reserved_quantity = 25` (25 customers reserved)
- `max_preorder_quantity = 50`
- `preorder_availability_date = 2026-07-01`

**After harvest:**
- Farmer harvests 30kg
- System records harvest
- Product status: "Harvest Ready"
- `stock_quantity = 25` (auto-transferred from reserved)
- `reserved_quantity = 0`

**After convert:**
- `stock_quantity = 25` (no change if harvest already transferred)
- `reserved_quantity = 0`
- 25 pre-order orders transition to `confirmed`
- Customers notified that orders are being prepared

**Fulfillment:**
- Orders proceed: confirmed → preparing → out_for_delivery → delivered
- Customers receive their reserved tomatoes

### Known Limitations

**Harvest quantity input:**
- Current: Auto-transfers reserved quantity
- Missing: Farmer cannot specify actual harvest quantity
- Impact: Cannot handle partial harvest scenarios
- Future: Add harvest quantity input field

**Partial fulfillment:**
- Current: Assumes harvest >= reserved quantity
- Missing: No handling for harvest < reserved
- Impact: Some customers may not receive full order
- Future: Add partial fulfillment workflow

**Batch operations:**
- Current: Harvest/convert one product at a time
- Missing: No batch harvest/convert for multiple products
- Impact: Inefficient for farmers with many products
- Future: Add batch operations

---

## Admin Monitoring Explanation

### Product Approval Workflow

**Purpose:** Ensure all products (including pre-orders) meet platform standards before being visible to customers.

**Process:**
1. **Farmer creates product:** Product submitted with `status = 'pending'`
2. **Admin reviews:** Admin sees product in Product Approvals section
3. **Admin decision:** Approve or reject product
4. **Status update:** Product status changes to `approved` or `rejected`
5. **Visibility:** Approved products visible in marketplace

**Pre-order specific review:**
- Admin checks pre-order fields: availability date, max quantity
- Admin validates availability date is reasonable
- Admin ensures max quantity is realistic
- Admin can approve/reject based on pre-order parameters

**User interface:**
- Section: "Product Approvals" in admin dashboard
- Table: Shows pending products with pre-order badges
- Details: Pre-order fields visible in product details modal
- Actions: Approve/Reject buttons

### Order Monitoring

**Purpose:** Provide visibility into all orders (including pre-orders) for platform oversight and customer support.

**Pre-order specific monitoring:**
- **Dedicated tab:** "Pre-order Reserved" tab in order status tabs
- **Visual distinction:** Pre-order badge on order IDs
- **Status tracking:** `preorder_reserved` status visible
- **Conversion tracking:** `preorder_converted_at` timestamp

**Order status tabs:**
- All: Shows all orders (regular + pre-order)
- Pre-order Reserved: Shows orders waiting for harvest
- Confirmed: Shows orders ready for fulfillment
- Preparing: Shows orders being prepared
- Out for Delivery: Shows orders in transit
- Delivered: Shows completed orders
- Cancelled: Shows cancelled orders

**Pre-order order details:**
- Product information with pre-order badge
- Availability date
- Reservation quantity
- Conversion timestamp (if converted)
- Fulfillment status

### Dashboard Metrics

**Purpose:** Provide platform-wide visibility into pre-order activity.

**Current metrics:**
- Total orders (regular + pre-order)
- Total revenue
- Active farmers
- Active customers

**Potential pre-order metrics (future enhancement):**
- Total pre-order reservations
- Pre-order conversion rate
- Average pre-order fulfillment time
- Pre-order revenue by category
- Harvest readiness metrics

### User Management

**Purpose:** Manage all user accounts (customers, farmers, admins).

**Pre-order relevant actions:**
- **Farmer verification:** Verify farmers before they can create pre-orders
- **Product disabling:** Disable farmers/products if pre-order issues arise
- **User support:** Assist with pre-order-related customer issues

### Audit Logging

**Purpose:** Maintain audit trail of all admin actions.

**Pre-order relevant logs:**
- Product approvals (including pre-order products)
- Order status changes (including pre-order conversions)
- User account changes
- System configuration changes

### Security Monitoring

**Purpose:** Detect and prevent fraudulent activity.

**Pre-order relevant security:**
- **Suspicious patterns:** Unusual pre-order activity
- **Flagged users:** Users with pre-order issues
- **Audit logs:** Track all pre-order-related actions

---

## Known Limitations

### Current Implementation Limitations

**1. Harvest Quantity Input Missing**
- **Issue:** Farmers cannot specify actual harvest quantity
- **Current behavior:** Auto-transfers reserved quantity to stock
- **Impact:** Cannot handle partial harvest scenarios
- **Workaround:** Assume farmers harvest at least reserved quantity
- **Future enhancement:** Add harvest quantity input field with validation

**2. Partial Fulfillment Not Supported**
- **Issue:** System assumes harvest >= reserved quantity
- **Current behavior:** No handling for harvest < reserved
- **Impact:** Some customers may not receive full order
- **Workaround:** Farmers must harvest adequately
- **Future enhancement:** Add partial fulfillment workflow with customer notification

**3. No Batch Operations**
- **Issue:** Harvest/convert one product at a time
- **Current behavior:** Individual product actions only
- **Impact:** Inefficient for farmers with many products
- **Workaround:** Manual process for each product
- **Future enhancement:** Add batch harvest/convert operations

**4. Limited Pre-Order Metrics**
- **Issue:** Dashboard doesn't show pre-order-specific metrics
- **Current behavior:** General metrics only
- **Impact:** Limited visibility into pre-order performance
- **Workaround:** Manual analysis of order data
- **Future enhancement:** Add pre-order KPI cards and analytics

**5. No Pre-Order Cancellation by Farmer**
- **Issue:** Farmers cannot cancel pre-order products
- **Current behavior:** Farmers must honor commitments
- **Impact:** Inflexible if harvest fails
- **Workaround:** Admin intervention if needed
- **Future enhancement:** Add farmer cancellation workflow with customer notification

**6. Mixed Cart Prevention**
- **Issue:** Cannot mix pre-order and regular items in same cart
- **Current behavior:** System prevents mixing
- **Impact:** Customers must place separate orders
- **Workaround:** Place two separate orders
- **Future enhancement:** Allow mixed carts with split fulfillment

**7. No Pre-Order Notifications**
- **Issue:** Customers not notified when pre-order becomes available
- **Current behavior:** No automatic notifications
- **Impact:** Customers must check order status manually
- **Workaround:** Customers check order history
- **Future enhancement:** Add notification when pre-order is converted

**8. Limited Delivery Date Flexibility**
- **Issue:** Delivery date must be >= availability date
- **Current behavior:** Strict validation
- **Impact:** Customers cannot request earlier delivery
- **Workaround:** Contact farmer directly
- **Future enhancement:** Add farmer approval for early delivery requests

### Design Trade-offs

**1. Cash-on-Delivery Model**
- **Trade-off:** No upfront payment for pre-orders
- **Rationale:** Simplifies system, reduces customer risk
- **Impact:** Farmers don't receive upfront payment
- **Future consideration:** Add payment gateway for pre-orders

**2. Separate Harvest and Convert Actions**
- **Trade-off:** Two-step process may seem complex
- **Rationale:** Provides clarity and flexibility
- **Impact:** Extra step in workflow
- **Future consideration:** Combine into single action if feedback suggests

**3. Admin Approval for All Products**
- **Trade-off:** Adds delay to product listing
- **Rationale:** Ensures quality and prevents fraud
- **Impact:** Slower time-to-market for farmers
- **Future consideration:** Fast-track for verified farmers

**4. No Pre-Order Discounts**
- **Trade-off:** No pricing incentive for pre-orders
- **Rationale:** Simplifies pricing model
- **Impact:** May reduce pre-order adoption
- **Future consideration:** Add pre-order discount pricing

**5. Stock and Reservation Separation**
- **Trade-off:** More complex data model
- **Rationale:** Enables hybrid inventory model
- **Impact:** More complex queries and validation
- **Future consideration:** Optimize queries for performance

---

## Future Enhancements

### High-Priority Enhancements

**1. Harvest Quantity Input**
- **Description:** Allow farmers to specify actual harvest quantity
- **Implementation:** Add input field to harvest confirmation modal
- **Validation:** Ensure harvest_quantity >= reserved_quantity
- **Benefit:** Handle partial harvest scenarios, improve accuracy
- **Effort:** Medium (frontend + backend changes)

**2. Partial Fulfillment Workflow**
- **Description:** Handle cases where harvest < reserved quantity
- **Implementation:** 
  - Add partial fulfillment logic
  - Customer notification for partial orders
  - Refund options for unfulfilled portions
- **Benefit:** Graceful handling of harvest shortfalls
- **Effort:** High (complex workflow changes)

**3. Pre-Order Notifications**
- **Description:** Notify customers when pre-order becomes available
- **Implementation:** 
  - Add notification trigger on conversion
  - Use existing notification infrastructure
  - Send email/SMS notifications
- **Benefit:** Better customer experience, reduced manual checking
- **Effort:** Medium (notification system integration)

**4. Batch Operations**
- **Description:** Allow farmers to harvest/convert multiple products at once
- **Implementation:** 
  - Add batch selection UI
  - Add batch API endpoints
  - Add batch confirmation modal
- **Benefit:** Improved efficiency for farmers with many products
- **Effort:** Medium (UI + API changes)

### Medium-Priority Enhancements

**5. Pre-Order Analytics**
- **Description:** Add pre-order-specific metrics and analytics
- **Implementation:**
  - Add KPI cards to dashboard
  - Add pre-order performance reports
  - Add conversion rate tracking
- **Benefit:** Better visibility into pre-order performance
- **Effort:** Medium (dashboard + analytics)

**6. Farmer Cancellation Workflow**
- **Description:** Allow farmers to cancel pre-order products
- **Implementation:**
  - Add cancellation UI for farmers
  - Add customer notification
  - Add refund processing
- **Benefit:** Flexibility for harvest failures
- **Effort:** High (complex workflow)

**7. Mixed Cart Support**
- **Description:** Allow mixing pre-order and regular items in same cart
- **Implementation:**
  - Remove mixing prevention
  - Split order fulfillment by item type
  - Show separate delivery dates
- **Benefit:** Better customer experience
- **Effort:** High (complex order logic)

**8. Pre-Order Discounts**
- **Description:** Allow farmers to offer discounts for pre-orders
- **Implementation:**
  - Add discount field to product form
  - Apply discount at checkout
  - Show savings to customers
- **Benefit:** Incentivize pre-order adoption
- **Effort:** Medium (pricing logic changes)

### Low-Priority Enhancements

**9. Delivery Date Flexibility**
- **Description:** Allow customers to request early delivery
- **Implementation:**
  - Add early delivery request UI
  - Add farmer approval workflow
  - Update delivery date on approval
- **Benefit:** More flexibility for customers
- **Effort:** Medium (workflow changes)

**10. Pre-Order Tiers**
- **Description:** Add tiered pre-order pricing (early bird, regular, late)
- **Implementation:**
  - Add tier configuration to product form
  - Apply tier-based pricing
  - Show tier options to customers
- **Benefit:** More sophisticated pricing model
- **Effort:** High (complex pricing logic)

**11. Group Pre-Orders**
- **Description:** Allow customers to form groups for bulk pre-orders
- **Implementation:**
  - Add group creation UI
  - Add group order management
  - Split group orders on fulfillment
- **Benefit:** Encourage bulk pre-orders
- **Effort:** High (complex social features)

**12. Pre-Order Marketplace**
- **Description:** Allow customers to resell pre-order reservations
- **Implementation:**
  - Add resale marketplace
  - Handle reservation transfers
  - Update order ownership
- **Benefit:** Secondary market for pre-orders
- **Effort:** Very High (complex marketplace logic)

### Technical Enhancements

**13. Performance Optimization**
- **Description:** Optimize queries for high-volume pre-order scenarios
- **Implementation:**
  - Add database indexes on pre-order fields
  - Cache product listings with pre-order filters
  - Optimize inventory update queries
- **Benefit:** Better performance at scale
- **Effort:** Medium (database optimization)

**14. Mobile App**
- **Description:** Build native mobile app for farmers and customers
- **Implementation:**
  - React Native or Flutter app
  - Offline support for pre-order management
  - Push notifications for pre-order updates
- **Benefit:** Better mobile experience
- **Effort:** Very High (new platform)

**15. API for Third-Party Integration**
- **Description:** Provide API for external systems to integrate with pre-orders
- **Implementation:**
  - Document pre-order API endpoints
  - Add API authentication
  - Add rate limiting
- **Benefit:** Enable ecosystem integrations
- **Effort:** Medium (API documentation + security)

---

## Conclusion

The AgriCatch hybrid pre-order system represents a novel approach to agricultural e-commerce that addresses the unique challenges of seasonal and perishable products. By enabling farmers to sell products before harvest while maintaining immediate ordering for available stock, the system reduces food waste through demand-based harvesting and provides customers with guaranteed access to future harvests.

**Key Achievements:**
- Complete end-to-end workflow from reservation to fulfillment
- Hybrid inventory model with separate stock and reservation tracking
- Harvest and conversion workflow for pre-order management
- Admin monitoring and approval workflows
- Clear user experience with visual distinction between product types

**System Status:** Feature-complete and demonstration-ready for thesis defense.

**Future Work:** Focus on harvest quantity input, partial fulfillment, and enhanced notifications to further improve the system's robustness and user experience.

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-25  
**Prepared For:** Thesis Defense Committee  
**System Version:** AgriCatch Hybrid Pre-Order System (Complete)
