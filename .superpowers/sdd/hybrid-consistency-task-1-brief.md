# Task 1 Brief: Fix Customer Orders Page Title

## Task Description

Fix the customer orders page title from "My Preorders" to "My Orders" to accurately reflect that the page displays both regular orders and pre-orders.

## Files to Modify

- `frontend/orders.html` (lines 6, 500, 510-511, 594, 601)

## Changes Required

1. **Line 6**: Change page title from "My Preorders — AgriCatch" to "My Orders — AgriCatch"
2. **Line 500**: Change breadcrumb from "My Preorders" to "My Orders"
3. **Lines 510-511**: Change section title from "My Preorders" to "My Orders" and subtitle from "Track and manage your preorders." to "Track and manage your orders."
4. **Line 594**: Change modal title from "Cancel Preorder" to "Cancel Order"
5. **Line 601**: Change placeholder from "Tell us why you are cancelling this preorder..." to "Tell us why you are cancelling this order..."

## Context

The customer orders page (`frontend/orders.html`) currently uses "My Preorders" as the title, but the page actually displays all orders (both regular and pre-orders) with tabs for "All", "Active", "Delivered", and "Cancelled". This creates confusion for customers about whether the page shows only pre-orders or all orders.

## Acceptance Criteria

- Page title updated to "My Orders"
- Breadcrumb updated to "My Orders"
- Section title and subtitle updated to "My Orders" and "Track and manage your orders."
- Cancel order modal title updated to "Cancel Order"
- Cancel order modal placeholder updated to "Tell us why you are cancelling this order..."
- No other functionality affected
- Changes are text-only, no logic changes

## Testing

Manually verify in browser:
- Open orders.html
- Confirm page title shows "My Orders"
- Confirm breadcrumb shows "My Orders"
- Confirm section header shows "My Orders"
- Confirm cancel modal shows "Cancel Order"
