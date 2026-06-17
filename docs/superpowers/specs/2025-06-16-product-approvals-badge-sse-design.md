# Product Approvals Badge SSE-Based Real-Time Updates

## Overview
Implement real-time badge counter updates for product approvals using existing SSE (Server-Sent Events) infrastructure. The badge shows pending product count and clears when the admin views the Product Approvals section.

## Current State
- Badge only updates when user clicks "Product Approvals" section
- SSE infrastructure exists for real-time updates (`setupRealtime()`)
- Approve/reject endpoints already broadcast `admin.audit` events
- No initial badge load on page initialization

## Design

### Architecture
Leverage existing SSE infrastructure in `setupRealtime()`. Add event listener for `admin.audit` events with `product.approve` and `product.reject` actions. When these events fire, refresh the pending product count and update the badge immediately.

**Components to modify:**
- `frontend/js/admin.js` - Add SSE event listener, initial badge load, mark-as-read logic
- `backend/routes/admin.js` - No changes needed (already broadcasts events)

### Data Flow
1. **Initial load:** On page init, fetch pending product count and update badge
2. **Mark as read:** When user navigates to Product Approvals section, clear badge (set to 0)
3. **Real-time update:** When SSE receives `admin.audit` event with `product.approve` or `product.reject` action:
   - Fetch updated pending count
   - Update badge with new count
   - Badge reappears if count > 0

### Badge Behavior

**Initial state:**
- Badge shows total pending product count on page load
- Badge hides if count is 0

**Mark as read:**
- When user clicks "Product Approvals" section, badge clears (sets to 0)
- This happens in the navigation handler when switching to product-approvals section

**Real-time updates:**
- When `product.approve` or `product.reject` SSE events fire, refresh the badge count
- If new pending products exist after an action, badge reappears with updated count
- This handles the case where an admin approves some but not all pending products

**Edge cases:**
- If admin is on product approvals page and approves all products, badge stays cleared
- If admin is on another page and new pending products come in, badge shows count
- If admin navigates away and back to product approvals, badge clears again

### Implementation Details

**New function: `loadProductApprovalsBadge()`**
- Fetches pending product count from `/admin/products?status=pending&limit=1`
- Updates badge element with count
- Hides badge if count is 0

**SSE event listener:**
- Add listener for `admin.audit` events in `setupRealtime()`
- Filter for actions: `product.approve`, `product.reject`
- Call `loadProductApprovalsBadge()` on matching events

**Initial load:**
- Call `loadProductApprovalsBadge()` in `init()` after `startUnreadPolling()`

**Mark as read:**
- In navigation handler for product-approvals section, set badge to 0 and hide it
- This happens when user clicks the sidebar menu item

### Error Handling
- If SSE connection fails, badge won't update (same as current behavior)
- If badge fetch fails, log error but don't break UI
- Badge gracefully handles missing elements

### Testing
- Verify badge shows count on page load
- Verify badge updates immediately after approve/reject action
- Verify badge clears when viewing Product Approvals section
- Verify badge reappears if new pending products come in
- Verify badge hides when count is 0
- Verify badge doesn't break if SSE connection fails

## Success Criteria
- Badge shows pending count on page load
- Badge updates in real-time when products are approved/rejected
- Badge clears when admin views Product Approvals section
- Badge reappears if new pending products exist after actions
- No UI errors if SSE or API calls fail
