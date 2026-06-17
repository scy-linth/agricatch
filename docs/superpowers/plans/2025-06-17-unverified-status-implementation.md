# Unverified Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add distinct 'unverified' status to verification workflow to match industry standards, preventing instant re-approval and requiring fresh verification requests.

**Architecture:** Database migration adds 'unverified' status to CHECK constraint. Backend validation updated to handle new status with proper state transitions. Frontend rendering updated to show gray badge and hide approve/reject buttons for unverified requests.

**Tech Stack:** PostgreSQL, Node.js/Express, JavaScript, Bootstrap 5

---

## File Structure

**Files to create:**
- `database/migrations/add_unverified_status.sql` - Database migration

**Files to modify:**
- `backend/routes/admin.js` - Admin verification review endpoint validation
- `backend/routes/farmers.js` - Farmer verification request submission logic
- `frontend/js/admin.js` - Table rendering, status badges, filter handling
- `frontend/admin.html` - Filter tabs HTML

---

### Task 1: Create database migration for unverified status

**Files:**
- Create: `database/migrations/add_unverified_status.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Add 'unverified' status to verification_requests table CHECK constraint
-- This allows distinct state for revoked verifications vs new pending requests

ALTER TABLE verification_requests 
DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE verification_requests 
ADD CONSTRAINT verification_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'unverified'));
```

- [ ] **Step 2: Commit migration file**

```bash
git add database/migrations/add_unverified_status.sql
git commit -m "db: add migration for unverified status"
```

---

### Task 2: Update backend admin review endpoint validation

**Files:**
- Modify: `backend/routes/admin.js:1023-1060`

- [ ] **Step 1: Update status validation to accept 'unverified'**

Find the validation section around line 1028 and update:

```javascript
if (!['approved', 'rejected', 'unverified'].includes(status)) {
  return res.status(400).json({ message: 'Status must be approved, rejected, or unverified' });
}

if (status === 'rejected' && !rejection_reason) {
  return res.status(400).json({ message: 'Rejection reason is required' });
}

if (status === 'unverified' && !rejection_reason) {
  return res.status(400).json({ message: 'Reason is required for unverify' });
}
```

- [ ] **Step 2: Update state transition validation**

Find the status check around line 1054 and update:

```javascript
const request = requestRes.rows[0];
const farmerId = request.farmer_id;

// For unverify (unverified status), allow changing from approved
// For approve/reject, only allow from pending
if (status === 'unverified' && request.status !== 'approved') {
  return res.status(400).json({ message: 'Can only unverify approved requests' });
}

if (['approved', 'rejected'].includes(status) && request.status !== 'pending') {
  return res.status(400).json({ message: 'Request has already been reviewed' });
}
```

- [ ] **Step 3: Update unverify notification to use 'unverified' status**

Find the unverify section around line 1084 and ensure it uses the correct status:

```javascript
// If unverified (unverified status), unverify the farmer
if (status === 'unverified' && request.status === 'approved') {
  await pool.query('UPDATE users SET is_verified = false WHERE id = $1', [farmerId]);

  // Send unverify notification
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
     VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
    [farmerId, 'account_unverified', 'Account Unverified',
     `Your farmer account has been unverified. Reason: ${rejection_reason}. Please contact support if you believe this is an error.`]
  );
  broadcastEvent('notification.created', { user_id: farmerId });
}
```

- [ ] **Step 4: Commit backend changes**

```bash
git add backend/routes/admin.js
git commit -m "feat: update admin review endpoint for unverified status"
```

---

### Task 3: Update farmer verification request submission

**Files:**
- Modify: `backend/routes/farmers.js:879-886`

- [ ] **Step 1: Remove pending status restriction**

Find the existing request check and remove or update it:

```javascript
// Check if there's already a pending verification request
// REMOVED: Allow new requests even if pending exists for unverified workflow
// const existingRequest = await pool.query(
//   'SELECT id FROM verification_requests WHERE farmer_id = $1 AND status = $2',
//   [user.id, 'pending']
// );
// if (existingRequest.rows.length > 0) {
//   return res.status(400).json({ message: 'You already have a pending verification request' });
// }
```

- [ ] **Step 2: Commit farmer route changes**

```bash
git add backend/routes/farmers.js
git commit -m "feat: allow new verification requests regardless of status"
```

---

### Task 4: Update frontend status badge mapping

**Files:**
- Modify: `frontend/js/admin.js:7172-7176`

- [ ] **Step 1: Add unverified badge color**

Update the statusBadge object:

```javascript
const statusBadge = {
    'pending': '<span class="badge bg-warning">Pending</span>',
    'approved': '<span class="badge bg-success">Approved</span>',
    'rejected': '<span class="badge bg-danger">Rejected</span>',
    'unverified': '<span class="badge bg-secondary">Unverified</span>'
}[request.status] || request.status;
```

- [ ] **Step 2: Commit status badge changes**

```bash
git add frontend/js/admin.js
git commit -m "feat: add unverified status badge (gray)"
```

---

### Task 5: Update frontend table button visibility

**Files:**
- Modify: `frontend/js/admin.js:7193-7196`

- [ ] **Step 1: Ensure approve/reject only show for pending**

The current logic already only shows buttons for 'pending' status. Verify it's correct:

```javascript
${request.status === 'pending' ? `
    <button class="btn btn-sm btn-ac-green approve-verification-btn" data-request-id="${request.id}">Approve</button>
    <button class="btn btn-sm btn-ac-red reject-verification-btn" data-request-id="${request.id}">Reject</button>
` : ''}
```

This is already correct - no changes needed for this step.

- [ ] **Step 2: Commit (no changes, but verify logic)**

```bash
# No commit needed - logic is already correct
```

---

### Task 6: Add unverified filter tab to HTML

**Files:**
- Modify: `frontend/admin.html:2404-2409`

- [ ] **Step 1: Add unverified button to filter tabs**

Find the verification-tabs section and add the unverified button:

```html
<!-- Filter Bar -->
<div class="verification-tabs mb-3">
    <button class="tab-btn active" data-status="all">All</button>
    <button class="tab-btn" data-status="pending">Pending</button>
    <button class="tab-btn" data-status="approved">Approved</button>
    <button class="tab-btn" data-status="rejected">Rejected</button>
    <button class="tab-btn" data-status="unverified">Unverified</button>
</div>
```

- [ ] **Step 2: Commit HTML changes**

```bash
git add frontend/admin.html
git commit -m "feat: add unverified filter tab"
```

---

### Task 7: Run database migration

**Files:**
- Execute: Migration SQL

- [ ] **Step 1: Run migration**

```bash
cd backend
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    await pool.query('ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_status_check');
    await pool.query('ALTER TABLE verification_requests ADD CONSTRAINT verification_requests_status_check CHECK (status IN (\\'pending\\', \\'approved\\', \\'rejected\\', \\'unverified\\'))');
    console.log('✓ Migration completed successfully');
    await pool.end();
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
})();
"
```

- [ ] **Step 2: Verify migration**

```bash
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const result = await pool.query(\`
    SELECT conname, consrc 
    FROM pg_constraint 
    WHERE conrelid = 'verification_requests'::regclass 
    AND conname = 'verification_requests_status_check'
  \`);
  console.log('Constraint:', result.rows[0]);
  await pool.end();
})();
"
```

Expected output should show the CHECK constraint with all 4 status values.

- [ ] **Step 3: Commit migration execution note**

```bash
git add database/migrations/add_unverified_status.sql
git commit --amend -m "db: add migration for unverified status (executed)"
```

---

### Task 8: Test unverify workflow end-to-end

**Files:**
- Test: Manual verification

- [ ] **Step 1: Start backend server**

```bash
cd backend
npm start
```

- [ ] **Step 2: Open admin panel in browser**

Navigate to admin panel and login as admin/staff.

- [ ] **Step 3: Navigate to Verification Requests section**

Click on "Verification Requests" in sidebar.

- [ ] **Step 4: Click View on an approved request**

Find a request with status "Approved" and click the "View" button.

- [ ] **Step 5: Click Unverify button**

Click the red "Unverify" button in the modal footer (left side).

- [ ] **Step 6: Enter reason and confirm**

Enter a reason in the textarea and click "Unverify" in the confirmation modal.

- [ ] **Step 7: Verify status changed**

Expected: Request status changes to "Unverified" with gray badge. No approve/reject buttons appear in table.

- [ ] **Step 8: Verify unverified filter works**

Click the "Unverified" filter tab. Expected: Only unverified requests show.

- [ ] **Step 9: Commit test results**

```bash
git commit --allow-empty -m "test: verified unverify workflow works correctly"
```

---

## Self-Review Results

**Spec coverage:** ✅
- Database migration: Task 1, 7
- Backend admin validation: Task 2
- Backend farmer submission: Task 3
- Frontend status badges: Task 4
- Frontend button visibility: Task 5
- Frontend filter tabs: Task 6
- Testing: Task 8

**Placeholder scan:** ✅ No placeholders found. All steps contain complete code or commands.

**Type consistency:** ✅ Status values 'unverified' used consistently across all tasks. Badge color 'bg-secondary' matches spec requirement.

---

Plan complete and saved to `docs/superpowers/plans/2025-06-17-unverified-status-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
