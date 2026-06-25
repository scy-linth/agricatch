# Farmer Product Management UI Redesign Design

**Date:** 2026-06-24  
**Status:** Design  
**Type:** UI/UX Redesign

## Objective

Redesign the Farmer Product Management interface to separate Available Now and Pre-orders into dedicated management tabs while maintaining a single product record architecture. This is a UI/UX redesign only; existing backend/business logic remains intact unless required for UI support.

## Design Philosophy

Available Now and Pre-orders are NOT separate products. They are two management views of the same product. Farmers should manage them separately through dedicated tabs rather than through checkboxes, filters, or complex selling mode selectors.

## Current State

### Product List Page
- Single "My Products" tab with mixed product list
- Products have "Preorder" badge if `is_preorder=true`
- Status filter shows "Active" or "Disabled"
- Archive functionality exists

### Add/Edit Product Modal
- Single form with "List as Preorder" checkbox
- When checked, shows pre-order fields in yellow highlighted section
- All fields visible at once

## New Design

### Section 1: Product List Page

Replace "My Products" tab with nested tabs: **[Available Now] [Pre-orders]**

Both tabs manage the same underlying product records (single product architecture).

#### Available Now Tab
Shows products with current inventory for immediate purchase.

**Columns:**
- Image
- ID
- Product Name
- Category
- Price
- Stock
- Status
- Reviews
- Actions

**Status Badges:**
- **Active** (green) - Product has stock and is available
- **Out of Stock** (yellow) - Product has zero stock
- **Disabled** (gray) - Product is disabled by farmer

**Actions:**
- **[Edit]** - Opens edit modal
- **[Disable]** - Shows confirmation modal to disable product

**Filters:**
- Category dropdown
- Status dropdown (Active/Out of Stock/Disabled)
- Search by product name

#### Pre-orders Tab
Shows products with pre-order configuration enabled.

**Columns:**
- Image
- ID
- Product Name
- Category
- Expected Harvest Date
- Reservation Progress
- Status
- Actions

**Reservation Progress:**
- Format: "Reserved: 35 / 100"
- Visual progress bar showing reservation percentage
- Shows "Available Slots: 65" below progress

**Status Badges:**
- **Active** (purple) - Pre-order is accepting reservations
- **Harvest Ready** (green) - Expected harvest date has passed
- **Disabled** (gray) - Product is disabled by farmer

**Actions:**
- **[Edit]** - Opens edit modal
- **[Harvested Now]** - Shows confirmation modal to transfer inventory
- **[Disable]** - Shows confirmation modal to disable product

**Filters:**
- Category dropdown
- Status dropdown (Active/Harvest Ready/Disabled)
- Search by product name

#### Removed from Product List
- Archive functionality completely
- Any mixed view of available + pre-order products
- Selling mode selector UI

### Section 2: Add/Edit Product Modal

#### Product Information Section (Shared, Always Visible)
- Product Name
- Category
- Unit
- Description
- Images

#### Management Section (Tabbed Interface)
Below Product Information, add tabbed interface:

**[Available Now] [Pre-orders]**

##### Available Now Tab
Purpose: Manage inventory currently available for purchase.

**Fields:**
- Stock Quantity
- Price
- Harvest Date
- Expiry Date

**Actions:**
- **[Save Changes]** - Saves available inventory fields
- **[Disable Product]** - Shows confirmation modal

**Do NOT show:**
- Expected Harvest Date
- Reservation Limits
- Pre-order Settings

##### Pre-orders Tab
Purpose: Manage future harvest inventory and reservations.

**Fields:**
- Expected Harvest Date
- Maximum Reservation Quantity
- Reservation Cutoff Date (if already supported by backend)

**Reservation Summary Card:**
```
Reserved: 35 / 100
Available Slots: 65
```

**Actions:**
- **[Save Changes]** - Saves pre-order configuration
- **[Harvested Now]** - Shows confirmation modal
- **[Convert Remaining Inventory]** - Shows confirmation modal
- **[Disable Product]** - Shows confirmation modal

**Do NOT show:**
- Current Stock
- Expiry Date
- Inventory Quantity fields from Available Now

#### Removed from Product Form
- "List as Preorder" checkbox
- Selling Mode selector
- Hybrid/Available/Pre-order radio buttons
- Archive functionality

### Section 3: Confirmation Modals

#### Harvested Now Confirmation
**Title:** Harvest Confirmation

**Message:**
This action will transfer harvested inventory into Available Now stock and make it available for immediate purchase.

Do you want to continue?

**Buttons:**
- **[Cancel]**
- **[Confirm Harvest]**

**Behavior:**
- Calls backend API to transfer pre-order inventory to available stock
- Updates `stock_quantity` with reserved quantity
- Resets `reserved_quantity` to 0
- Shows success toast on completion

#### Convert Remaining Inventory Confirmation
**Title:** Convert Remaining Inventory

**Message:**
Convert all remaining pre-order inventory into Available Now stock?

This action can affect future reservations.

**Buttons:**
- **[Cancel]**
- **[Convert Inventory]**

**Behavior:**
- Calls backend API to convert remaining pre-order slots to available stock
- Updates `stock_quantity` with remaining available slots
- Sets `max_preorder_quantity` to 0
- Shows success toast on completion

#### Disable Product Confirmation
**Title:** Disable Product

**Message:**
This product will no longer be visible to customers.

You can enable it again later.

**Buttons:**
- **[Cancel]**
- **[Disable Product]**

**Behavior:**
- Calls backend API to set `is_available=false`
- Shows success toast on completion
- Product can be re-enabled via Edit modal

## Backend API Requirements

### New Endpoints Needed

#### Harvest Pre-order Inventory
```
POST /api/farmers/products/:id/harvest-preorder
```
- Transfers `reserved_quantity` to `stock_quantity`
- Resets `reserved_quantity` to 0
- Optionally clears pre-order configuration

#### Convert Remaining Pre-order Inventory
```
POST /api/farmers/products/:id/convert-preorder
```
- Converts remaining available pre-order slots to `stock_quantity`
- Sets `max_preorder_quantity` to 0
- Keeps `reserved_quantity` intact

### Existing Endpoints to Use
- `POST /api/farmers/products` - Create product (no changes needed)
- `PUT /api/farmers/products/:id` - Update product (no changes needed)
- `DELETE /api/farmers/products/:id` - Disable product (use for disable action)

## Database Schema

### Existing Fields (No Changes Needed)
The products table already has the necessary fields:
- `stock_quantity` - Available inventory
- `reserved_quantity` - Pre-order reservations
- `max_preorder_quantity` - Maximum pre-order slots
- `preorder_availability_date` - Expected harvest date
- `is_preorder` - Pre-order flag (can be derived from other fields)

### No New Fields Required
The existing schema supports the new UI design without modifications.

## UI/UX Principles

### Farmer-Centric Workflow
- Farmers naturally think: "What can I sell today?" → Available Now Tab
- Farmers naturally think: "What harvests can customers reserve?" → Pre-orders Tab
- Single product record behind the scenes

### Clean Tabbed Interface
- Modern tab switching with smooth transitions
- Clear visual separation between Available Now and Pre-order management
- No checkbox-based selling mode system
- No hybrid selector UI

### Consistency with AgriCatch Design
- Matches existing Bootstrap 5.3.3 design system
- Uses existing color palette (green primary, yellow warnings, etc.)
- Maintains mobile responsiveness
- Follows existing modal and form patterns

### Professional Marketplace Appearance
- Clean seller dashboard interface
- Clear status badges with appropriate colors
- Progress indicators for reservation tracking
- Confirmation dialogs for destructive actions

## Implementation Notes

### Frontend Changes Required
1. **farmer.html**
   - Replace "My Products" tab with nested tabs [Available Now] [Pre-orders]
   - Remove "List as Preorder" checkbox from add/edit modals
   - Add tabbed management section to product forms
   - Remove archive functionality
   - Add confirmation modals for new actions

2. **farmer.js**
   - Update product list rendering to support nested tabs
   - Update add/edit form handling to support tabbed management
   - Add API calls for harvest and convert actions
   - Update status badge logic
   - Remove archive-related code

### Backend Changes Required
1. **backend/routes/farmers.js**
   - Add `POST /products/:id/harvest-preorder` endpoint
   - Add `POST /products/:id/convert-preorder` endpoint
   - Update product validation if needed

### No Database Changes Required
- Existing schema supports new UI
- No migrations needed

## Testing Considerations

### UI Testing
- Verify tab switching works smoothly
- Test form validation on both tabs
- Verify confirmation modals appear correctly
- Test mobile responsiveness

### Integration Testing
- Verify harvest action transfers inventory correctly
- Verify convert action updates inventory correctly
- Test disable action hides product from customers
- Verify re-enable functionality works

### Edge Cases
- Product with both available and pre-order inventory
- Pre-order with zero reservations
- Pre-order with all slots reserved
- Harvest date in the past vs future

## Success Criteria

1. Farmers can manage available inventory independently from pre-orders
2. No checkbox-based selling mode UI
3. Single product record architecture maintained
4. Confirmation dialogs for all inventory-affecting actions
5. Archive functionality completely removed
6. Mobile-responsive design
7. Consistent with existing AgriCatch design system
