# Order Management Test Implementation Plan

## Goal
Implement comprehensive Playwright test scenarios for AgriCatch order management, covering all 10 groups (A-J) from the design spec.

## Architecture
- Primary tool: Playwright (API + UI tests)
- Pattern: API-first for setup/teardown, UI for workflow verification
- Shared helpers in `tests/helpers/order-test-helper.js`
- Each group gets its own spec file

## Tasks

### Task 1: Shared Test Helper
- Create `tests/helpers/order-test-helper.js`
- API utilities: createOrder, cancelOrder, updateStatus, setDeliveryDate, getOrderByStatus
- DB utilities: getStock, getReservedQty, verifyOrderStatus
- Auth: reuse existing `auth-helper.js` + add `loginAsCustomer`

### Task 2: Group A — Regular Order Happy Path (A1, A2)
- File: `tests/order-mgmt-a-regular-happy-path.spec.js`
- A1: Full lifecycle via API + UI verification
- A2: Multiple products, multiple farmers, per-item orders

### Task 3: Group B — Pre-Order Hybrid Workflow (B1-B4)
- File: `tests/order-mgmt-b-preorder-workflow.spec.js`
- B1: Harvest YES path
- B2: Partial harvest allocation (FIFO)
- B3: Harvest NO path
- B4: Mixed cart (regular + pre-order)

### Task 4: Group C — Customer Cancellation (C1-C5)
- File: `tests/order-mgmt-c-customer-cancel.spec.js`
- C1: Cancel pending regular → stock restored
- C2: Cancel pre-order reservation → reserved released
- C3: Cannot cancel after confirmed
- C4: Cannot cancel delivered
- C5: Cannot double-cancel

### Task 5: Group D — Farmer Cancellation (D1-D5)
- File: `tests/order-mgmt-d-farmer-cancel.spec.js`
- D1: Cancel pending
- D2: Cancel confirmed
- D3: Cancel preparing
- D4: Cannot cancel scheduled+
- D5: Cancel converted pre-order → stock from fulfilled

### Task 6: Group E — Admin Cancellation (E1-E4)
- File: `tests/order-mgmt-e-admin-cancel.spec.js`
- E1: Admin cancels any active status
- E2: Bulk cancel on product disable
- E3: Bulk cancel on farmer disable
- E4: Bulk cancel on customer disable

### Task 7: Group F — Delivery Date Scheduling (F1-F5)
- File: `tests/order-mgmt-f-delivery-scheduling.spec.js`
- F1: Set delivery date on preparing
- F2: Reschedule with reason
- F3: Cannot schedule pre-order before conversion
- F4: Cannot set past date
- F5: Reschedule without reason fails

### Task 8: Group G — Edge Cases (G1-G10)
- File: `tests/order-mgmt-g-edge-cases.spec.js`
- G1-G10: All edge case scenarios via API

### Task 9: Group H — Real-Time Sync (H1-H3)
- File: `tests/order-mgmt-h-realtime-sync.spec.js`
- H1: Customer sees status update via SSE
- H2: Farmer sees new order in real-time
- H3: Notification polling skips on notifications section

### Task 10: Group I — Post-Delivery (I1-I3) + Group J — Admin (J1-J2)
- File: `tests/order-mgmt-ij-postdelivery-admin.spec.js`
- I1: Rate delivered product
- I2: Rating window expires
- I3: Reorder
- J1: Admin updates status
- J2: Admin cannot cancel delivered

## Global Constraints
- Reuse `auth-helper.js` for token generation
- API base: `http://localhost:3000/api`
- All tests must handle missing data gracefully (skip, not fail)
- No test should leave permanent side effects (cleanup where possible)
- Follow existing test file naming conventions
