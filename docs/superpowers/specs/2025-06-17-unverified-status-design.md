# Industry-Standard Verification Unverify Workflow

## Overview
Implement industry-standard verification revocation workflow where unverified accounts have a distinct "unverified" status (not "pending"), require fresh verification requests, and cannot be instantly re-approved. This matches patterns used by Uber, Airbnb, Stripe, and other major platforms.

## Problem
Current unverify behavior changes status to "pending", which:
- Shows approve/reject buttons in the table (confusing UX)
- Allows instant re-approval without fresh review
- Doesn't distinguish between new applications and revocations
- Doesn't match industry standards

## Solution
Add distinct "unverified" status with proper workflow separation.

## Database Changes

### verification_requests table
- Update CHECK constraint to include 'unverified' status
- New status values: 'pending', 'approved', 'rejected', 'unverified'
- Migration SQL:
  ```sql
  ALTER TABLE verification_requests 
  DROP CONSTRAINT IF EXISTS verification_requests_status_check;
  
  ALTER TABLE verification_requests 
  ADD CONSTRAINT verification_requests_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'unverified'));
  ```

## Backend Changes

### Admin verification review endpoint
**File:** `backend/routes/admin.js`
**Endpoint:** `PUT /admin/verification-requests/:id/review`

Changes:
- Accept 'unverified' as valid status
- When status = 'unverified':
  - Set verification_requests.status = 'unverified'
  - Set users.is_verified = false
  - Store rejection_reason
  - Send 'account_unverified' notification to farmer
  - Broadcast notification event
- Validation updates:
  - 'unverified' requires rejection_reason
  - 'unverified' only allowed from 'approved' status
  - 'approved'/'rejected' only allowed from 'pending' status

### Farmer verification request submission
**File:** `backend/routes/farmers.js`
**Endpoint:** `POST /farmers/me/verification-request`

Changes:
- Remove restriction preventing new requests if status = 'pending'
- Allow new requests even if previous request is 'unverified'
- Each unverify creates a new request record (audit trail)

## Frontend Changes

### Admin verification table rendering
**File:** `frontend/js/admin.js`
**Method:** `renderVerificationRequestsTable`

Changes:
- Show Approve/Reject buttons only for 'pending' status
- Show View button for all statuses
- No action buttons for 'unverified' status
- Update statusBadge mapping:
  ```javascript
  const statusBadge = {
      'pending': '<span class="badge bg-warning">Pending</span>',
      'approved': '<span class="badge bg-success">Approved</span>',
      'rejected': '<span class="badge bg-danger">Rejected</span>',
      'unverified': '<span class="badge bg-secondary">Unverified</span>'
  }[request.status] || request.status;
  ```

### Admin Verification Details modal
**File:** `frontend/js/admin.js`
**Method:** `openVerificationDetailsModal`

Changes:
- Show Unverify button only when status = 'approved'
- Unverify button opens confirmation modal with reason input
- After successful unverify, close modal and refresh table

### Filter tabs
**File:** `frontend/admin.html` and `frontend/js/admin.js`

Changes:
- Add 'unverified' filter tab
- Update verification-tabs HTML to include unverified button
- Update loadVerificationRequests to handle 'unverified' status filter

## User Flow

1. Admin clicks "View" on approved request
2. Admin clicks "Unverify" in details modal (left side of footer)
3. Admin enters reason and confirms
4. Request status changes to 'unverified'
5. Farmer receives notification with reason
6. Farmer can immediately submit new verification request
7. New request has status 'pending' (fresh review required)
8. Admin reviews new request through standard approve/reject flow
9. Original 'unverified' request remains as audit trail

## Status Badge Colors

- Pending: `bg-warning` (yellow)
- Approved: `bg-success` (green)
- Rejected: `bg-danger` (red)
- Unverified: `bg-secondary` (gray)

## Testing

- Database migration test
- Backend endpoint tests for unverify action
- Frontend rendering tests for status badges
- Frontend button visibility tests
- End-to-end unverify workflow test
- Notification delivery test
