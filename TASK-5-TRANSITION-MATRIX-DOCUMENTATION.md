# Order Transition Matrix Documentation

## Overview

This document describes the canonical Order Transition Matrix implemented in `backend/utils/orderTransitions.js`. This module serves as the single source of truth for all order status transitions across Customer, Farmer, and Admin roles.

## Supported Statuses

The following order statuses are supported in the system:

- **pending** - Initial state for regular orders
- **accepted** - Alternative initial state (reserved for future use)
- **preorder_reserved** - Initial state for pre-order reservations
- **confirmed** - Order confirmed by farmer
- **preparing** - Order is being prepared
- **scheduled** - Delivery date scheduled
- **out_for_delivery** - Order is out for delivery
- **delivered** - Order has been delivered
- **completed** - Order is complete (terminal state)
- **cancelled** - Order has been cancelled (terminal state)

## Transition Matrix

### Forward Transitions

| From Status | Allowed Transitions |
|-------------|---------------------|
| pending | confirmed, cancelled |
| accepted | confirmed, cancelled |
| preorder_reserved | confirmed, cancelled |
| confirmed | preparing, cancelled |
| preparing | scheduled, cancelled |
| scheduled | out_for_delivery, cancelled |
| out_for_delivery | delivered, cancelled |
| delivered | completed |
| completed | *(terminal - no transitions)* |
| cancelled | *(terminal - no transitions)* |

### Workflow Diagrams

**Regular Order Workflow:**
```
pending → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
          ↓           ↓           ↓           ↓              ↓
        cancelled   cancelled   cancelled   cancelled      cancelled
```

**Pre-order Workflow:**
```
preorder_reserved → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
                  ↓           ↓           ↓              ↓
                cancelled   cancelled   cancelled      cancelled
```

## Role-Based Cancellation Rules

Each role has different permissions for cancelling orders:

| Role | Can Cancel From These Statuses |
|------|-------------------------------|
| **customer** | pending, preorder_reserved |
| **farmer** | pending, confirmed, preparing |
| **admin** | pending, accepted, preorder_reserved, confirmed, preparing, scheduled, out_for_delivery |
| **super_admin** | pending, accepted, preorder_reserved, confirmed, preparing, scheduled, out_for_delivery |

**Note:** No role can cancel orders that are already delivered, completed, or cancelled.

## Key Business Rules

### Customer Cancellation
- Customers can only cancel orders in `pending` or `preorder_reserved` status
- Once an order is confirmed, customers cannot cancel it
- This protects farmers who have already begun preparing orders

### Farmer Cancellation
- Farmers can cancel orders in `pending`, `confirmed`, or `preparing` status
- Farmers cannot cancel orders that are already scheduled or out for delivery
- This prevents cancellation when delivery logistics are in progress

### Admin/Super Admin Cancellation
- Admins have broad cancellation permissions
- Can cancel orders up to `out_for_delivery` status
- Cannot cancel delivered or completed orders
- This allows admins to handle exceptional cases while protecting completed transactions

### Pre-order Workflow
- Pre-orders start in `preorder_reserved` status
- Must transition to `confirmed` before proceeding to preparation
- Cannot skip the confirmation step
- This ensures farmers explicitly accept pre-order reservations

### Delivered to Completed
- Orders can transition from `delivered` to `completed`
- This is a one-way transition (completed is terminal)
- Allows for post-delivery processing and finalization

## Implementation Details

### Module Location
`backend/utils/orderTransitions.js`

### Key Functions

#### `validateTransition(currentStatus, newStatus, role)`
Validates whether a status transition is allowed for a given role.

**Parameters:**
- `currentStatus` (string) - Current order status
- `newStatus` (string) - Target status
- `role` (string) - User role (customer, farmer, admin, super_admin)

**Returns:**
- `{ valid: boolean, message: string }` - Validation result

#### `getAllowedTransitions(currentStatus, role)`
Returns all allowed next statuses for a given current status and role.

**Parameters:**
- `currentStatus` (string) - Current order status
- `role` (string) - User role

**Returns:**
- `string[]` - Array of allowed next statuses

#### `isTerminalStatus(status)`
Checks if a status is terminal (no outgoing transitions).

**Parameters:**
- `status` (string) - Order status

**Returns:**
- `boolean` - True if terminal

#### `getValidStatuses()`
Returns all valid order statuses.

**Returns:**
- `string[]` - Array of valid status strings

#### `getCancellationRules(role)`
Returns the cancellation rules for a specific role.

**Parameters:**
- `role` (string) - User role

**Returns:**
- `string[]` - Array of statuses from which the role can cancel

## Usage Examples

### Validating a Transition

```javascript
const { validateTransition } = require('../utils/orderTransitions');

// Customer trying to cancel a pending order
const validation = validateTransition('pending', 'cancelled', 'customer');
if (validation.valid) {
  // Allow cancellation
} else {
  // Block with error message
  console.error(validation.message);
}
```

### Getting Allowed Transitions

```javascript
const { getAllowedTransitions } = require('../utils/orderTransitions');

// Get all statuses a farmer can transition to from confirmed
const allowed = getAllowedTransitions('confirmed', 'farmer');
// Returns: ['preparing', 'cancelled']
```

## Integration Points

The transition matrix is used in the following route files:

1. **backend/routes/orders.js**
   - Shared status update endpoint (`PUT /:orderId/items/:orderItemId/status`)
   - Customer cancel endpoint (`PUT /:id/cancel`)
   - Farmer cancel endpoint (`PUT /:id/cancel-farmer`)

2. **backend/routes/admin.js**
   - Admin status update endpoint (`PUT /orders/:id/status`)

## Testing

A comprehensive regression test suite is available at:
`backend/scripts/test_order_transitions.js`

Run tests with:
```bash
node backend/scripts/test_order_transitions.js
```

The test suite validates:
- All status values are recognized
- Terminal states cannot transition
- Valid forward transitions are allowed
- Invalid forward transitions are blocked
- Role-based cancellation rules
- Specific business rules (customer, farmer, admin permissions)
- Pre-order workflow
- Delivered to completed transition

## Version History

- **v1.0** (Task 5) - Initial implementation of unified transition matrix
  - Created single source of truth for order transitions
  - Consolidated duplicated validation logic from orders.js, farmers.js, and admin.js
  - Implemented role-based cancellation rules
  - Added comprehensive regression test suite
  - 100% test pass rate (154/154 tests)
