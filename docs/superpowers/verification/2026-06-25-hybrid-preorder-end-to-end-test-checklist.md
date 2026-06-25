# Hybrid Pre-Order System - End-to-End Test Checklist & Thesis Demonstration Guide

**Date:** 2026-06-25  
**Purpose:** Comprehensive validation of hybrid pre-order system workflows for thesis defense  
**Scope:** Customer, Farmer, and Admin end-to-end workflows  
**Status:** Ready for execution

---

## Executive Summary

This checklist validates the complete hybrid pre-order system implementation across all user roles. Each workflow is tested end-to-end with cross-role consistency checks to ensure the system is thesis-defense ready.

**System Overview:**
- **Hybrid Model:** Products can be "Available Now" (immediate stock) or "Pre-order" (future availability)
- **Key Workflows:** Customer reservation → Farmer harvest → Farmer conversion → Order fulfillment
- **Status Flow:** preorder_reserved → confirmed → preparing → scheduled → out_for_delivery → delivered
- **Validation Focus:** End-to-end workflow completion, cross-role consistency, user clarity, demonstration reliability

---

# CUSTOMER WORKFLOW CHECKLIST

## Phase 1: Product Discovery & Browsing

### 1.1 Landing Page Product Display
- [ ] **Pre-order Badge Visibility**
  - [ ] Products with `is_preorder=true` display "HARVEST SOON" badge (yellow/orange)
  - [ ] Products with `is_preorder=false` display "Available Now" badge (green)
  - [ ] Badge colors are visually distinct and accessible
  - [ ] Badge text is clear and consistent across all product cards

- [ ] **Product Card Information**
  - [ ] Pre-order products show expected availability date
  - [ ] Pre-order products show reservation progress (e.g., "Reserved: 5/20")
  - [ ] Regular products show current stock quantity
  - [ ] Price, farmer name, and ratings display correctly for both types

- [ ] **Button Text & Styling**
  - [ ] Pre-order products show "Reserve" button (yellow/warning color)
  - [ ] Regular products show "Add to Cart" button (standard color)
  - [ ] Buttons are clearly distinguishable by color and text
  - [ ] Disabled state shows "Unavailable" for out-of-stock items

### 1.2 Product Details Modal
- [ ] **Pre-order Banner**
  - [ ] Pre-order products show "Pre-order - Available on [date]" banner at top
  - [ ] Banner is visually prominent (yellow alert style)
  - [ ] Availability date is clearly formatted and readable

- [ ] **Reservation Information**
  - [ ] "Reserved: X / Y" progress bar displays correctly
  - [ ] Progress bar shows visual percentage complete
  - [ ] Max pre-order quantity is displayed if set
  - [ ] Expected delivery timeline is explained

- [ ] **Delivery Date Validation**
  - [ ] Delivery date picker enforces minimum = preorder_availability_date
  - [ ] Validation error shows if date is too early
  - [ ] Error message is clear: "Delivery date must be on or after [availability_date]"
  - [ ] Date picker is disabled or hidden for pre-orders if applicable

### 1.3 Filtering & Search
- [ ] **Product Type Filter**
  - [ ] Filter toggle: "All Products" / "Available Now" / "Pre-order Only" works
  - [ ] Filter state persists during navigation
  - [ ] Filter correctly calls API with `?preorder=` parameter
  - [ ] Filter results update product list correctly

- [ ] **Search Functionality**
  - [ ] Search returns both regular and pre-order products
  - [ ] Search results maintain pre-order badges
  - [ ] Search filters work in combination with product type filter

---

## Phase 2: Cart & Checkout

### 2.1 Add to Cart / Reserve
- [ ] **Pre-order Reserve Action**
  - [ ] Clicking "Reserve" on pre-order adds item to cart
  - [ ] Cart count updates immediately
  - [ ] Cart item shows "Pre-order" badge
  - [ ] Cart item shows availability date

- [ ] **Regular Add to Cart**
  - [ ] Clicking "Add to Cart" on regular products works normally
  - [ ] Stock validation prevents over-ordering
  - [ ] Cart item shows stock quantity

- [ ] **Mixed Cart Prevention**
  - [ ] System prevents mixing pre-order and regular items in same cart
  - [ ] Clear error message: "Cannot mix pre-order and regular products in same order"
  - [ ] User is prompted to choose which items to keep

### 2.2 Cart Review
- [ ] **Cart Item Display**
  - [ ] Pre-order items clearly marked with badge
  - [ ] Availability date shown for pre-order items
  - [ ] Regular items show stock availability
  - [ ] Total calculation is correct for both types

- [ ] **Cart Actions**
  - [ ] Quantity adjustment works for both types
  - [ ] Remove item works for both types
  - [ ] Clear cart works correctly

### 2.3 Checkout Process
- [ ] **Pre-order Checkout**
  - [ ] Delivery date picker shows minimum date = preorder_availability_date
  - [ ] Date validation prevents early delivery dates
  - [ ] Pre-order explanation text is displayed
  - [ ] Cash on delivery option is available (no payment gateway)

- [ ] **Regular Checkout**
  - [ ] Standard checkout flow works normally
  - [ ] Delivery date picker has no restrictions (beyond business rules)
  - [ ] Stock is reserved/validated at checkout

- [ ] **Order Placement**
  - [ ] Order created with `is_preorder=true` for pre-orders
  - [ ] Order created with `is_preorder=false` for regular
  - [ ] Order confirmation shows correct order type
  - [ ] Order ID is generated and displayed

---

## Phase 3: Order Management

### 3.1 Order History
- [ ] **Order List Display**
  - [ ] Pre-order orders show "Pre-order" badge on order ID
  - [ ] Order status shows "Pre-order Reserved" for new pre-orders
  - [ ] Regular orders show standard status flow
  - [ ] Availability date shown for pre-order orders

- [ ] **Order Filtering**
  - [ ] "All" tab shows both pre-order and regular orders
  - [ ] "Active" tab includes preorder_reserved status
  - [ ] "Delivered" tab shows completed orders
  - [ ] "Cancelled" tab shows cancelled orders

### 3.2 Order Details
- [ ] **Pre-order Order Details**
  - [ ] Product information shows pre-order badge
  - [ ] Availability date is displayed
  - [ ] Expected delivery timeline is shown
  - [ ] Status timeline shows "Pre-order placed" as starting point

- [ ] **Regular Order Details**
  - [ ] Standard order details display
  - [ ] Status timeline shows normal flow

### 3.3 Order Cancellation
- [ ] **Pre-order Cancellation**
  - [ ] Can cancel pre-order before availability date
  - [ ] Cancellation decrements reserved_quantity
  - [ ] Confirmation modal shows pre-order context
  - [ ] Success message confirms cancellation

- [ ] **Regular Order Cancellation**
  - [ ] Standard cancellation flow works
  - [ ] Stock is restored to product
  - [ ] Follows existing status transition rules

### 3.4 Order Ratings
- [ ] **Rating Workflow**
  - [ ] Rating workflow works for both pre-order and regular orders
  - [ ] Rating is enabled after delivery
  - [ ] Rating submission works correctly
  - [ ] Rating displays on product page

---

## Phase 4: Communication

### 4.1 Chat System
- [ ] **Farmer Chat Access**
  - [ ] Customer can initiate chat with farmer
  - [ ] Chat is accessible from product page
  - [ ] Chat is accessible from order details
  - [ ] Chat shows farmer verification status

- [ ] **Pre-order Context in Chat**
  - [ ] Chat shows product context (pre-order vs regular)
  - [ ] Availability date is visible in chat context
  - [ ] Order status is visible in chat context

---

# FARMER WORKFLOW CHECKLIST

## Phase 1: Product Creation

### 1.1 Product Type Selection
- [ ] **Product Type Cards**
  - [ ] "Available Now" selection card is visible and clickable
  - [ ] "Pre-orders" selection card is visible and clickable
  - [ ] Selection is visually clear (highlighted when selected)
  - [ ] Selection persists during form navigation

### 1.2 Pre-order Product Form
- [ ] **Pre-order Fields Display**
  - [ ] When "Pre-orders" selected, availability date field appears
  - [ ] When "Pre-orders" selected, max pre-order quantity field appears
  - [ ] Fields are clearly labeled and positioned
  - [ ] Fields hide when "Available Now" is selected

- [ ] **Field Validation**
  - [ ] Availability date is required when pre-order is selected
  - [ ] Availability date must be in the future
  - [ ] Max pre-order quantity must be positive if provided
  - [ ] Expiry date validation: must be >= availability date

- [ ] **Stock Quantity Handling**
  - [ ] Stock quantity can be 0 for pre-order products
  - [ ] Stock quantity field is not required for pre-orders
  - [ ] Validation allows 0 stock for pre-orders

### 1.3 Product Submission
- [ ] **API Integration**
  - [ ] Form submission includes is_preorder field
  - [ ] Form submission includes preorder_availability_date
  - [ ] Form submission includes max_preorder_quantity
  - [ ] Product created with correct field values

- [ ] **Success Feedback**
  - [ ] Success message confirms product creation
  - [ ] Product appears in product list immediately
  - [ ] Product shows correct type badge (Pre-order vs Available Now)

### 1.4 Regular Product Form
- [ ] **Standard Fields**
  - [ ] When "Available Now" selected, pre-order fields are hidden
  - [ ] Stock quantity is required for regular products
  - [ ] Standard validation applies
  - [ ] Product created with is_preorder=false

---

## Phase 2: Product Management

### 2.1 Product List Display
- [ ] **Available Now Tab**
  - [ ] Shows products with is_preorder=false
  - [ ] Displays stock quantity
  - [ ] Shows price and status badge
  - [ ] Standard product management actions

- [ ] **Pre-orders Tab**
  - [ ] Shows products with is_preorder=true
  - [ ] Displays expected harvest date
  - [ ] Shows reservation progress (Reserved: X / Y)
  - [ ] Shows status badge (Active, Harvest Ready, etc.)

### 2.2 Product Editing
- [ ] **Edit Form Type Detection**
  - [ ] Edit form shows/hides fields based on product type
  - [ ] Pre-order products show availability date and max quantity
  - [ ] Regular products show stock quantity
  - [ ] Type can be changed (toggle pre-order on/off)

- [ ] **Pre-order Product Edit**
  - [ ] Availability date can be updated
  - [ ] Max pre-order quantity can be updated
  - [ ] Stock quantity can be added (for hybrid scenarios)
  - [ ] Changes save correctly

- [ ] **Action Buttons**
  - [ ] "Harvest" button shown for pre-order products
  - [ ] "Convert" button shown for pre-order products
  - [ ] Buttons are positioned correctly
  - [ ] Buttons are disabled when not applicable

### 2.3 Product Visibility
- [ ] **Status Badges**
  - [ ] "Active" badge for available products
  - [ ] "Disabled" badge for disabled products
  - [ ] "Harvest Ready" badge for pre-orders ready to convert
  - [ ] "Out of Stock" badge for zero stock
  - [ ] Badge colors are consistent and accessible

---

## Phase 3: Harvest Workflow

### 3.1 Harvest Initiation
- [ ] **Harvest Button Access**
  - [ ] Harvest button is visible on pre-order products
  - [ ] Harvest button is clickable when applicable
  - [ ] Button is disabled if no reservations exist
  - [ ] Button tooltip explains action

- [ ] **Harvest Confirmation Modal**
  - [ ] Modal opens when harvest button clicked
  - [ ] Modal shows current reservation count
  - [ ] Modal asks for harvest quantity input
  - [ ] Modal shows product name and availability date

### 3.2 Harvest Execution
- [ ] **Harvest Quantity Input**
  - [ ] Harvest quantity field accepts positive numbers
  - [ ] Validation: harvest_quantity >= reserved_quantity
  - [ ] Error message if quantity is too low
  - [ ] Default value suggested (reserved_quantity)

- [ ] **API Call**
  - [ ] POST to `/products/:id/harvest-preorder`
  - [ ] Request includes harvest_quantity
  - [ ] Authentication token included
  - [ ] Error handling for API failures

- [ ] **Success Feedback**
  - [ ] Success message shows quantity harvested
  - [ ] Product status updates to "Harvest Ready"
  - [ ] Product list refreshes automatically
  - [ ] Reservation progress updates

### 3.3 Harvest State Management
- [ ] **Post-Harvest Display**
  - [ ] Product shows "Harvest Ready" status
  - [ ] Reserved quantity still shows (not yet converted)
  - [ ] Convert button becomes primary action
  - [ ] Harvest button disabled or hidden

---

## Phase 4: Convert Workflow

### 4.1 Convert Initiation
- [ ] **Convert Button Access**
  - [ ] Convert button visible on "Harvest Ready" products
  - [ ] Convert button also available in edit form
  - [ ] Button is clearly labeled
  - [ ] Button tooltip explains action

- [ ] **Convert Confirmation Modal**
  - [ ] Modal opens when convert button clicked
  - [ ] Modal shows reserved quantity to convert
  - [ ] Modal shows current stock quantity
  - [ ] Modal explains conversion action

### 4.2 Convert Execution
- [ ] **API Call**
  - [ ] POST to `/products/:id/convert-preorder`
  - [ ] Request includes harvest_quantity
  - [ ] Authentication token included
  - [ ] Error handling for API failures

- [ ] **Stock Update**
  - [ ] reserved_quantity moves to stock_quantity
  - [ ] reserved_quantity set to 0
  - [ ] stock_quantity increases by harvest_quantity
  - [ ] Database transaction is atomic

- [ ] **Order Status Update**
  - [ ] Pre-order orders get preorder_converted_at timestamp
  - [ ] Orders can proceed through normal workflow
  - [ ] Order status transitions from preorder_reserved to confirmed
  - [ ] Affected order IDs returned in response

### 4.3 Success Feedback
- [ ] **Success Message**
  - [ ] Message confirms conversion completed
  - [ ] Shows converted quantity
  - [ ] Shows new stock quantity
  - [ ] Shows number of affected orders

- [ ] **UI Update**
  - [ ] Product status changes to "Active"
  - [ ] Product moves to "Available Now" tab
  - [ ] Reservation progress shows 0 / max
  - [ ] Convert button disabled/hidden

---

## Phase 5: Order Management

### 5.1 Order List Display
- [ ] **Regular Orders Tab**
  - [ ] Shows orders with is_preorder=false
  - [ ] Standard order management actions
  - [ ] Status transition buttons
  - [ ] Batch actions available

- [ ] **Pre-orders Tab**
  - [ ] Shows orders with is_preorder=true
  - [ ] Shows preorder_reserved status
  - [ ] Shows availability date
  - [ ] Shows customer information

### 5.2 Order Status Transitions
- [ ] **Pre-order Order Flow**
  - [ ] preorder_reserved → confirmed (after conversion)
  - [ ] confirmed → preparing
  - [ ] preparing → scheduled
  - [ ] scheduled → out_for_delivery
  - [ ] out_for_delivery → delivered

- [ ] **Regular Order Flow**
  - [ ] Standard status transitions work
  - [ ] All transition buttons functional
  - [ ] Status badges update correctly

### 5.3 Order Details
- [ ] **Pre-order Order Details**
  - [ ] Shows pre-order badge
  - [ ] Shows availability date
  - [ ] Shows conversion timestamp (if converted)
  - [ ] Shows customer delivery address

- [ ] **Regular Order Details**
  - [ ] Standard order details display
  - [ ] All order information visible

---

## Phase 6: Communication

### 6.1 Chat System
- [ ] **Customer Chat Access**
  - [ ] Farmer can initiate chat with customer
  - [ ] Chat accessible from order details
  - [ ] Chat shows customer information
  - [ ] Chat shows order context

- [ ] **Pre-order Context in Chat**
  - [ ] Chat shows product type (pre-order vs regular)
  - [ ] Availability date visible if pre-order
  - [ ] Order status visible
  - [ ] Delivery information visible

---

# ADMIN WORKFLOW CHECKLIST

## Phase 1: Product Approval

### 1.1 Product Approval Queue
- [ ] **Product List Display**
  - [ ] Pending products show in approval queue
  - [ ] Pre-order badge shown for pre-order products
  - [ ] Availability date shown for pre-orders
  - [ ] Max pre-order quantity shown if set

- [ ] **Product Details Review**
  - [ ] Admin can view full product details
  - [ ] Pre-order fields visible in details
  - [ ] Farmer information shown
  - [ ] Product images accessible

### 1.2 Approval Actions
- [ ] **Approve Pre-order Product**
  - [ ] Approve button works for pre-order products
  - [ ] Product status changes to "approved"
  - [ ] Product becomes visible to customers
  - [ ] is_preorder field preserved

- [ ] **Reject Pre-order Product**
  - [ ] Reject button works for pre-order products
  - [ ] Product status changes to "rejected"
  - [ ] Product not visible to customers
  - [ ] Rejection reason can be added

- [ ] **Regular Product Approval**
  - [ ] Standard approval workflow works
  - [ ] Status transitions work correctly
  - [ ] No impact on pre-order logic

### 1.3 Product Monitoring
- [ ] **Approved Products List**
  - [ ] Pre-order products show in approved list
  - [ ] Pre-order badge visible
  - [ ] Availability date visible
  - [ ] Reservation progress visible

- [ ] **Product Filtering**
  - [ ] Filter by status (pending/approved/rejected)
  - [ ] Filter by product type (pre-order/regular)
  - [ ] Combined filters work correctly

---

## Phase 2: Order Monitoring

### 2.1 Order List Display
- [ ] **All Orders Tab**
  - [ ] Shows both pre-order and regular orders
  - [ ] Pre-order badge on order ID
  - [ ] Status badges visible
  - [ ] Customer information shown

- [ ] **Pre-order Reserved Tab**
  - [ ] Shows orders with preorder_reserved status
  - [ ] Tab is accessible to staff and super_admin
  - [ ] Shows availability date
  - [ ] Shows product information

- [ ] **Other Status Tabs**
  - [ ] Confirmed, preparing, scheduled, out_for_delivery, delivered tabs work
  - [ ] Cancelled tab works
  - [ ] All tabs show pre-order badges where applicable

### 2.2 Order Status Tracking
- [ ] **Status Transitions**
  - [ ] Admin can view all status transitions
  - [ ] preorder_reserved status included in transition matrix
  - [ ] Status colors consistent (purple for preorder_reserved)
  - [ ] Status labels standardized ("Pre-order Reserved")

- [ ] **Order Details**
  - [ ] Admin can view full order details
  - [ ] Pre-order information visible
  - [ ] Conversion timestamp visible (if converted)
  - [ ] Customer and farmer information shown

### 2.3 Order Actions
- [ ] **Status Override**
  - [ ] Admin can override order status if needed
  - [ ] Override works for pre-order orders
  - [ ] Audit trail maintained
  - [ ] Confirmation required

---

## Phase 3: System Monitoring

### 3.1 Pre-order Metrics
- [ ] **Dashboard Overview**
  - [ ] Total pre-order products count
  - [ ] Total pre-order orders count
  - [ ] Total reserved quantity
  - [ ] Conversion rate metrics

- [ ] **Farmer Performance**
  - [ ] Pre-order products per farmer
  - [ ] Conversion success rate
  - [ ] Customer satisfaction metrics

### 3.2 System Health
- [ ] **Database Integrity**
  - [ ] reserved_quantity >= 0 constraint enforced
  - [ ] max_preorder_quantity validation working
  - [ ] preorder_availability_date validation working
  - [ ] Indexes on is_preorder columns functional

- [ ] **API Performance**
  - [ ] Pre-order filter queries perform well
  - [ ] Conversion endpoint response time acceptable
  - [ ] Harvest endpoint response time acceptable
  - [ ] No database deadlocks detected

---

# CROSS-ROLE CONSISTENCY CHECKLIST

## Terminology Consistency
- [ ] **"Pre-order" vs "Preorder"**
  - [ ] All UI uses "Pre-order" (hyphenated)
  - [ ] Database field names use is_preorder (underscore)
  - [ ] API responses use is_preorder
  - [ ] Comments and documentation consistent

- [ ] **Status Labels**
  - [ ] "Pre-order Reserved" used consistently across all roles
  - [ ] "Available Now" used consistently
  - [ ] "Harvest Soon" badge consistent
  - [ ] Status colors consistent (purple for preorder_reserved)

## Data Flow Consistency
- [ ] **Product Creation to Display**
  - [ ] Farmer creates pre-order → Customer sees pre-order badge
  - [ ] Availability date flows from creation to display
  - [ ] Max quantity flows from creation to reservation limit
  - [ ] Stock quantity flows correctly for hybrid scenarios

- [ ] **Order Creation to Fulfillment**
  - [ ] Customer places pre-order → Farmer sees preorder_reserved
  - [ ] Farmer harvests → Stock updates correctly
  - [ ] Farmer converts → Orders transition to confirmed
  - [ ] Admin sees consistent status across all views

## UI/UX Consistency
- [ ] **Badge Styling**
  - [ ] Pre-order badge same color across all pages
  - [ ] Status badge colors consistent
  - [ ] Badge positioning consistent
  - [ ] Badge text consistent

- [ ] **Button Styling**
  - [ ] "Reserve" button consistent across product cards
  - [ ] "Harvest" and "Convert" buttons consistent
  - [ ] Action button colors follow system conventions
  - [ ] Disabled state consistent

- [ ] **Modal Patterns**
  - [ ] Confirmation modals follow same pattern
  - [ ] Modal styling consistent
  - [ ] Modal button placement consistent
  - [ ] Modal close behavior consistent

## Navigation Consistency
- [ ] **Section Access**
  - [ ] All roles can access their respective sections
  - [ ] Navigation menu items labeled consistently
  - [ ] Breadcrumbs work correctly
  - [ ] Back navigation works

- [ ] **Cross-Role Links**
  - [ ] Customer can view farmer profile
  - [ ] Farmer can view customer orders
  - [ ] Admin can view both farmer and customer data
  - [ ] Links open in correct context

---

# MISSING NAVIGATION PATHS CHECKLIST

## Customer Navigation
- [ ] **From Product to Order**
  - [ ] Product card → Product details → Reserve → Cart → Checkout → Order
  - [ ] Each step has clear navigation
  - [ ] Back navigation works at each step
  - [ ] Breadcrumbs show current location

- [ ] **From Order to Chat**
  - [ ] Order details → Chat with farmer
  - [ ] Chat accessible from order list
  - [ ] Chat shows order context
  - [ ] Return to order from chat works

- [ ] **From Landing to Account**
  - [ ] Landing page → Customer account
  - [ ] Account shows order history
  - [ ] Order history shows pre-order badges
  - [ ] Navigation back to landing works

## Farmer Navigation
- [ ] **From Product to Orders**
  - [ ] Product list → Order list
  - [ ] Product details → Related orders
  - [ ] Order list shows product context
  - [ ] Navigation back to products works

- [ ] **From Orders to Chat**
  - [ ] Order details → Chat with customer
  - [ ] Chat accessible from order list
  - [ ] Chat shows order context
  - [ ] Return to order from chat works

- [ ] **From Dashboard to Actions**
  - [ ] Dashboard → Product creation
  - [ ] Dashboard → Order management
  - [ ] Dashboard → Harvest/Convert actions
  - [ ] Clear action buttons on dashboard

## Admin Navigation
- [ ] **From Products to Orders**
  - [ ] Product approvals → Order monitoring
  - [ ] Product details → Related orders
  - [ ] Cross-reference navigation works
  - [ ] Back navigation works

- [ ] **From Orders to Products**
  - [ ] Order details → Product details
  - [ ] Order list → Product approvals
  - [ ] Cross-reference navigation works
  - [ ] Context maintained

---

# MISSING USER ACTIONS CHECKLIST

## Customer Actions
- [ ] **Pre-order Modification**
  - [ ] Can customer modify pre-order quantity before conversion?
  - [ ] Can customer cancel pre-order before availability date?
  - [ ] Can customer change delivery date after placement?
  - [ ] Can customer add note to pre-order?

- [ ] **Pre-order to Regular Conversion**
  - [ ] Can customer convert pre-order to regular if stock available?
  - [ ] Can customer split pre-order into multiple orders?
  - [ ] Can customer upgrade pre-order to express delivery?

## Farmer Actions
- [ ] **Partial Harvest**
  - [ ] Can farmer do partial harvest (less than reserved)?
  - [ ] How does system handle partial fulfillment?
  - [ ] Can farmer add more stock later?
  - [ ] Can farmer adjust availability date?

- [ ] **Batch Operations**
  - [ ] Can farmer harvest multiple products at once?
  - [ ] Can farmer convert multiple products at once?
  - [ ] Can farmer bulk update availability dates?
  - [ ] Can farmer bulk cancel pre-orders?

## Admin Actions
- [ ] **Override Capabilities**
  - [ ] Can admin force convert pre-orders?
  - [ ] Can admin adjust reservation limits?
  - [ ] Can admin extend availability dates?
  - [ ] Can admin cancel problematic pre-orders?

---

# CONFUSING USER FLOWS CHECKLIST

## Customer Confusion Points
- [ ] **Pre-order vs Regular Distinction**
  - [ ] Is it clear when customer is reserving vs buying?
  - [ ] Is delivery date constraint obvious?
  - [ ] Is it clear when product will be available?
  - [ ] Is it clear that payment is on delivery?

- [ ] **Cart Mixing Prevention**
  - [ ] Is error message clear when mixing types?
  - [ ] Is it obvious why items were removed?
  - [ ] Is there guidance on how to proceed?
  - [ ] Is there a way to split orders?

## Farmer Confusion Points
- [ ] **Harvest vs Convert Distinction**
  - [ ] Is it clear when to harvest vs convert?
  - [ ] Is the difference between the two actions obvious?
  - [ ] Is it clear what each action does?
  - [ ] Is the sequence of actions clear?

- [ ] **Stock Management**
  - [ ] Is it clear how stock and reservations interact?
  - [ ] Is it clear when to add stock vs harvest?
  - [ ] Is hybrid stock scenario explained?
  - [ ] Is reservation progress clear?

## Admin Confusion Points
- [ ] **Pre-order Order Status**
  - [ ] Is preorder_reserved status clear?
  - [ ] Is it clear how orders transition?
  - [ ] Is conversion timestamp meaningful?
  - [ ] Is it clear when admin action is needed?

---

# THESIS DEMONSTRATION READINESS CHECKLIST

## Demonstration Scenario 1: Customer Pre-order Journey
- [ ] **Setup**
  - [ ] Test customer account created
  - [ ] Test farmer with pre-order product created
  - [ ] Pre-order product approved by admin
  - [ ] Product has future availability date

- [ ] **Demonstration Steps**
  - [ ] Navigate to landing page
  - [ ] Show pre-order badge on product card
  - [ ] Click product to view details
  - [ ] Show pre-order banner and availability date
  - [ ] Show reservation progress
  - [ ] Click "Reserve" button
  - [ ] Show cart with pre-order item
  - [ ] Proceed to checkout
  - [ ] Show delivery date validation
  - [ ] Place order
  - [ ] Show order confirmation with pre-order status
  - [ ] Navigate to order history
  - [ ] Show pre-order order with badge

- [ ] **Key Talking Points**
  - [ ] "Pre-order allows customers to reserve future harvest"
  - [ ] "Delivery date is constrained to availability date"
  - [ ] "Order status shows Pre-order Reserved until harvest"
  - [ ] "Payment is cash on delivery, no upfront payment"

## Demonstration Scenario 2: Farmer Harvest & Convert
- [ ] **Setup**
  - [ ] Test farmer account with pre-order reservations
  - [ ] Multiple customer pre-orders for same product
  - [ ] Availability date has passed or is approaching

- [ ] **Demonstration Steps**
  - [ ] Login as farmer
  - [ ] Navigate to Products section
  - [ ] Show Pre-orders tab
  - [ ] Show product with reservations
  - [ ] Show reservation progress
  - [ ] Click "Harvest" button
  - [ ] Show harvest confirmation modal
  - [ ] Enter harvest quantity
  - [ ] Confirm harvest
  - [ ] Show success message
  - [ ] Show product status changed to "Harvest Ready"
  - [ ] Click "Convert" button
  - [ ] Show convert confirmation modal
  - [ ] Confirm conversion
  - [ ] Show success message with converted quantity
  - [ ] Show product moved to "Available Now" tab
  - [ ] Navigate to Orders section
  - [ ] Show pre-order orders transitioned to confirmed

- [ ] **Key Talking Points**
  - [ ] "Farmers can harvest when crops are ready"
  - [ ] "Harvest records actual quantity harvested"
  - [ ] "Convert moves reservations to available stock"
  - [ ] "Orders automatically transition to fulfillment flow"
  - [ ] "System ensures demand-based harvesting"

## Demonstration Scenario 3: Admin Monitoring
- [ ] **Setup**
  - [ ] Test admin account (staff or super_admin)
  - [ ] Mix of pre-order and regular products in system
  - [ ] Mix of pre-order and regular orders

- [ ] **Demonstration Steps**
  - [ ] Login as admin
  - [ ] Navigate to Product Approvals
  - [ ] Show pre-order product in pending queue
  - [ ] Show pre-order fields in product details
  - [ ] Approve pre-order product
  - [ ] Navigate to Order Monitoring
  - [ ] Show Pre-order Reserved tab
  - [ ] Show pre-order orders with badges
  - [ ] Show order status transitions
  - [ ] Navigate to Dashboard
  - [ ] Show pre-order metrics if available

- [ ] **Key Talking Points**
  - [ ] "Admins approve all products including pre-orders"
  - [ ] "Pre-order orders tracked separately for visibility"
  - [ ] "Status flow includes preorder_reserved state"
  - [ ] "System maintains full audit trail"

## Demonstration Scenario 4: End-to-End Hybrid Flow
- [ ] **Setup**
  - [ ] Product with both available stock and pre-order capacity
  - [ ] Customer 1 places regular order
  - [ ] Customer 2 places pre-order
  - [ ] Farmer harvests and converts

- [ ] **Demonstration Steps**
  - [ ] Show product with hybrid stock (50 available, 20 reserved)
  - [ ] Customer 1 buys 10 regular units (stock goes to 40)
  - [ ] Customer 2 reserves 15 pre-order units (reserved goes to 15)
  - [ ] Show product state: 40 available, 15 reserved
  - [ ] Farmer harvests 100 units
  - [ ] Show product state: 40 available, 15 reserved, 100 harvested
  - [ ] Farmer converts
  - [ ] Show product state: 140 available, 0 reserved
  - [ ] Show both orders in fulfillment flow

- [ ] **Key Talking Points**
  - [ ] "Hybrid model supports both immediate and future demand"
  - [ ] "Stock and reservations tracked separately"
  - [ ] "Farmers can plan harvest based on actual demand"
  - [ ] "System reduces food waste through demand-based harvesting"

## Demonstration Reliability
- [ ] **Environment Stability**
  - [ ] Backend server running and stable
  - [ ] Database connection stable
  - [ ] No pending migrations
  - [ ] API endpoints responding correctly

- [ ] **Test Data Cleanliness**
  - [ ] Test accounts exist and work
  - [ ] Test products are in correct states
  - [ ] Test orders are in correct states
  - [ ] No conflicting test data

- [ ] **Browser Compatibility**
  - [ ] Demonstration browser tested (Chrome/Firefox/Safari)
  - [ ] Responsive design works on projector screen
  - [ ] No console errors during demonstration
  - [ ] No network errors during demonstration

- [ ] **Fallback Plans**
  - [ ] Alternative test accounts ready
  - [ ] Alternative test products ready
  - [ ] Known workarounds for any issues
  - [ ] Quick recovery steps if something fails

---

# PONYTAIL UX/WORKFLOW OBSERVATIONS

## Efficiency Observations
- [ ] **Unnecessary Steps**
  - [ ] Are there any redundant confirmation modals?
  - [ ] Are there any extra navigation steps?
  - [ ] Are there any fields that could be auto-populated?
  - [ ] Are there any actions that could be combined?

- [ ] **Existing Pattern Reuse**
  - [ ] Does harvest/convert reuse existing modal patterns?
  - [ ] Does pre-order form reuse existing validation?
  - [ ] Does order display reuse existing components?
  - [ ] Are there any duplicated patterns that could be consolidated?

## Edge Case Handling
- [ ] **Boundary Conditions**
  - [ ] What happens if harvest_quantity < reserved_quantity?
  - [ ] What happens if availability date is in the past?
  - [ ] What happens if max_preorder_quantity is reached?
  - [ ] What happens if farmer tries to convert without harvesting?

- [ ] **Error Recovery**
  - [ ] Are error messages clear and actionable?
  - [ ] Can users recover from errors easily?
  - [ ] Are there retry mechanisms for failed operations?
  - [ ] Is state preserved on error?

## User Clarity
- [ ] **Mental Model**
  - [ ] Is the harvest vs convert distinction intuitive?
  - [ ] Is the reserved vs stock distinction clear?
  - [ ] Is the pre-order vs regular distinction obvious?
  - [ ] Do users understand when each action is appropriate?

- [ ] **Visual Feedback**
  - [ ] Are status changes immediately visible?
  - [ ] Are progress indicators clear?
  - [ ] Are success messages unambiguous?
  - [ ] Are error messages specific?

## Simplification Opportunities
- [ ] **Process Simplification**
  - [ ] Could harvest and convert be combined into one action?
  - [ ] Could pre-order status be automatically detected?
  - [ ] Could availability date be auto-suggested?
  - [ ] Could max quantity be optional with sensible default?

- [ ] **UI Simplification**
  - [ ] Are there any fields that could be hidden by default?
  - [ ] Are there any tabs that could be merged?
  - [ ] Are there any modals that could be inline?
  - [ ] Are there any tooltips that could be removed?

---

# FINAL VALIDATION CHECKLIST

## Blocking Issues (Must Fix Before Thesis)
- [ ] No critical bugs that prevent workflow completion
- [ ] No data corruption issues
- [ ] No security vulnerabilities
- [ ] No performance issues that would embarrass during demo

## High Priority Issues (Should Fix Before Thesis)
- [ ] No confusing user flows that would require explanation
- [ ] No missing navigation paths that would disrupt demo
- [ ] No inconsistent terminology that would confuse audience
- [ ] No UI bugs that would look unprofessional

## Medium Priority Issues (Nice to Fix Before Thesis)
- [ ] No minor UI inconsistencies
- [ ] No missing convenience features
- [ ] No suboptimal error messages
- [ ] No missing edge case handling

## Low Priority (Can Defer)
- [ ] Nice-to-have enhancements
- [ ] Analytics and reporting features
- [ ] Advanced user preferences
- [ ] Performance optimizations beyond requirements

---

# TEST EXECUTION LOG

## Test Date: _______________
## Tester: _______________
## Environment: _______________

### Customer Workflow Results
- Phase 1 (Discovery): ___/___ passed
- Phase 2 (Cart/Checkout): ___/___ passed
- Phase 3 (Order Management): ___/___ passed
- Phase 4 (Communication): ___/___ passed
- **Customer Total:** ___/___ passed

### Farmer Workflow Results
- Phase 1 (Product Creation): ___/___ passed
- Phase 2 (Product Management): ___/___ passed
- Phase 3 (Harvest): ___/___ passed
- Phase 4 (Convert): ___/___ passed
- Phase 5 (Order Management): ___/___ passed
- Phase 6 (Communication): ___/___ passed
- **Farmer Total:** ___/___ passed

### Admin Workflow Results
- Phase 1 (Product Approval): ___/___ passed
- Phase 2 (Order Monitoring): ___/___ passed
- Phase 3 (System Monitoring): ___/___ passed
- **Admin Total:** ___/___ passed

### Cross-Role Results
- Terminology Consistency: ___/___ passed
- Data Flow Consistency: ___/___ passed
- UI/UX Consistency: ___/___ passed
- Navigation Consistency: ___/___ passed
- **Cross-Role Total:** ___/___ passed

### Overall Results
- **Total Tests:** ___
- **Passed:** ___
- **Failed:** ___
- **Pass Rate:** ___%

### Blocking Issues Found: ___
### High Priority Issues Found: ___
### Medium Priority Issues Found: ___

### Thesis Ready: YES / NO

### Notes:
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

---

**Checklist Version:** 1.0  
**Last Updated:** 2026-06-25  
**Next Review:** After thesis defense
