# Phone Number Uniqueness Implementation Report

**Date:** July 9, 2026  
**Project:** AgriCatch  
**Feature:** Phone Number Uniqueness Across All User Accounts

---

## Executive Summary

Phone number uniqueness has been successfully implemented across the AgriCatch system. The implementation includes:

- **Database:** Added UNIQUE constraint on the `phone` column in the `users` table
- **Backend:** Implemented phone uniqueness validation in all user creation and update endpoints
- **Frontend:** Added client-side phone uniqueness checking before form submission
- **Data Integrity:** Resolved existing duplicate phone numbers before applying the constraint

---

## Database Changes

### Schema Modification

**File:** `database/migrations/add_phone_unique_constraint.sql`

Added a partial unique index on the `phone` column:

```sql
CREATE UNIQUE INDEX idx_users_phone_unique 
ON users(phone) 
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone != '—';
```

**Rationale:** Partial unique index allows NULL values and empty strings, following PostgreSQL best practices for nullable unique constraints.

### Duplicate Resolution

**Script:** `backend/scripts/check_duplicate_phones.js`

**Results:** Found 1 duplicate phone number:
- Phone: `9879789789` (4 occurrences)
- Users affected: IDs 92, 93, 94, 156

**Script:** `backend/scripts/resolve_duplicate_phones.js`

**Resolution Strategy:** Keep the oldest user with each phone number, clear phone from newer users.

**Outcome:**
- Kept: User ID 92 (username: aaa, created: Jun 24, 2026)
- Cleared phone from: Users 93, 94, 156
- Verification passed: No duplicate phone numbers remain

**Script:** `backend/scripts/apply_phone_unique_constraint.js`

**Result:** UNIQUE constraint successfully applied.

---

## Backend Changes

### 1. Authentication Routes (`backend/routes/auth.js`)

#### New Endpoint: Phone Uniqueness Check

**Endpoint:** `POST /api/auth/check-phone`

**Purpose:** Public endpoint for frontend to check phone number availability before submission.

**Implementation:**
```javascript
router.post('/check-phone', async (req, res) => {
  const { phone, userId } = req.body;
  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }
  const phoneDigits = String(phone).replace(/\D/g, '');
  if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
    return res.status(400).json({ message: 'Invalid phone number format' });
  }
  let query = 'SELECT id FROM users WHERE phone = $1';
  const params = [phoneDigits];
  if (userId) {
    query += ' AND id <> $2';
    params.push(userId);
  }
  const phoneExists = await pool.query(query, params);
  if (phoneExists.rows.length > 0) {
    return res.status(409).json({ message: 'This phone number is already registered.' });
  }
  res.json({ available: true });
});
```

**Parameters:**
- `phone` (required): 10-digit phone number starting with 9
- `userId` (optional): User ID to exclude from uniqueness check (for profile editing)

**Usage:**
- **Registration:** Call without `userId` to check if phone is available
- **Profile Update:** Call with current user's `userId` to allow user to keep their own phone
- **Admin Edit User:** Call with edited user's `userId` to allow user to keep their own phone

#### Registration Endpoint (`POST /register`)

**Change:** Added phone uniqueness validation before user creation.

**Implementation:**
```javascript
if (phone) {
  const phoneDigits = String(phone).replace(/\D/g, '');
  if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
    return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
  }
  
  // Check phone number uniqueness
  const phoneExists = await pool.query(
    'SELECT id FROM users WHERE phone = $1',
    [phoneDigits]
  );
  if (phoneExists.rows.length > 0) {
    return res.status(409).json({ message: 'This phone number is already registered.' });
  }
}
```

#### Profile Update Endpoint (`PUT /profile`)

**Change:** Added phone uniqueness validation allowing current user to keep their own phone.

**Implementation:**
```javascript
if (typeof phone !== 'undefined' && hasColumn('phone')) {
  const nextPhone = String(phone || '').trim();
  if (nextPhone) {
    const phoneDigits = nextPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
      return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
    }
    // Check phone uniqueness (allow current user to keep their own phone)
    const phoneExists = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND id <> $2',
      [phoneDigits, decoded.id]
    );
    if (phoneExists.rows.length > 0) {
      return res.status(409).json({ message: 'This phone number is already registered.' });
    }
  }
  push('phone', nextPhone || null);
}
```

### 2. Admin Routes (`backend/routes/admin.js`)

#### Create User Endpoint (`POST /users`)

**Change:** Added phone uniqueness validation before user creation.

**Implementation:**
```javascript
// Check phone number uniqueness
if (normalized.phone) {
  const phoneDigits = normalized.phone.replace(/\D/g, '');
  const phoneExists = await pool.query(
    'SELECT id FROM users WHERE phone = $1',
    [phoneDigits]
  );
  if (phoneExists.rows.length) {
    return res.status(409).json({ message: 'This phone number is already registered.' });
  }
}
```

#### Edit User Endpoint (`PUT /users/:id`)

**Change:** Added phone uniqueness validation allowing target user to keep their own phone.

**Implementation:**
```javascript
if (phone !== undefined) {
  if (phone) {
    const phoneDigits = String(phone).replace(/\D/g, '');
    if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
      return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
    }
    // Check phone uniqueness (allow target user to keep their own phone)
    const phoneExists = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND id <> $2',
      [phoneDigits, targetUserId]
    );
    if (phoneExists.rows.length > 0) {
      return res.status(409).json({ message: 'This phone number is already registered.' });
    }
  }
  updates.push(`phone = $${paramIndex}`);
  values.push(phone);
  paramIndex++;
}
```

### 3. Super Admin Routes (`backend/routes/superadmin.js`)

#### Create User Endpoint (`POST /users`)

**Change:** Added phone uniqueness validation before user creation.

**Implementation:**
```javascript
// Check phone number uniqueness if provided
const phone = String(req.body.phone || '').trim();
if (phone) {
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneExists = await pool.query(
    'SELECT id FROM users WHERE phone = $1',
    [phoneDigits]
  );
  if (phoneExists.rows.length) {
    return res.status(409).json({ message: 'This phone number is already registered.' });
  }
}
```

#### Edit User Endpoint (`PUT /users/:id`)

**Change:** Added phone uniqueness validation allowing target user to keep their own phone.

**Implementation:**
```javascript
if (typeof phone !== 'undefined') {
  if (phone) {
    const phoneDigits = String(phone).replace(/\D/g, '');
    if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
      return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
    }
    // Check phone uniqueness (allow target user to keep their own phone)
    const phoneExists = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND id <> $2',
      [phoneDigits, targetId]
    );
    if (phoneExists.rows.length > 0) {
      return res.status(409).json({ message: 'This phone number is already registered.' });
    }
  }
  push('phone', phone || null);
}
```

### 4. Farmer Routes (`backend/routes/farmers.js`)

#### Profile Update Endpoint (`PUT /profile`)

**Change:** Added phone field handling and uniqueness validation.

**Implementation:**
```javascript
const { shop_name, shop_description, shop_banner_url, shop_avatar_url, full_name, address, phone } = body;

// ... existing validation ...

if (phone !== undefined && phone !== null && phone !== '') {
  const phoneDigits = String(phone).replace(/\D/g, '');
  if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
    return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
  }
  // Check phone uniqueness (allow current farmer to keep their own phone)
  const phoneExists = await pool.query(
    'SELECT id FROM users WHERE phone = $1 AND id <> $2',
    [phoneDigits, user.id]
  );
  if (phoneExists.rows.length > 0) {
    return res.status(409).json({ message: 'This phone number is already registered.' });
  }
  updates.push(`phone = $${paramIndex}`);
  values.push(phoneDigits);
  paramIndex++;
}
```

---

## Frontend Changes

### 1. Landing Page (`frontend/js/app.js`)

#### Registration Form

**Change:** Added phone uniqueness check before form submission.

**Implementation:**
```javascript
// Check phone uniqueness before submission
try {
  const phoneCheckResponse = await fetch('/api/auth/check-phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneDigits })
  });
  if (phoneCheckResponse.status === 409) {
    this.setButtonLoading('register-submit-btn', false);
    this.showMessage('This phone number is already registered.', 'error');
    document.getElementById('auth-phone').focus();
    return;
  }
} catch (phoneCheckError) {
  // If phone check fails, continue with registration (backend will validate)
  console.warn('Phone uniqueness check failed, continuing with registration');
}
```

### 2. Customer Account (`frontend/js/customer-account.js`)

#### Profile Update Form

**Change:** Added phone uniqueness check before form submission with userId parameter.

**Implementation:**
```javascript
// Check phone uniqueness before submission
try {
  const phoneCheckResponse = await fetch('/api/auth/check-phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneDigits, userId: this.user?.id })
  });
  if (phoneCheckResponse.status === 409) {
    this.showToast('This phone number is already registered.', 'error');
    return;
  }
} catch (phoneCheckError) {
  // If phone check fails, continue with profile update (backend will validate)
  console.warn('Phone uniqueness check failed, continuing with profile update');
}
```

### 3. Farmer Dashboard (`frontend/js/farmer.js`)

#### Profile Update Form

**Change:** Added phone uniqueness check before form submission with userId parameter.

**Implementation:**
```javascript
// Check phone uniqueness before submission
if (phoneDigits) {
  try {
    const phoneCheckResponse = await fetch('/api/auth/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneDigits, userId: this.user?.id })
    });
    if (phoneCheckResponse.status === 409) {
      this.showMessage('This phone number is already registered.', 'error');
      return;
    }
  } catch (phoneCheckError) {
    // If phone check fails, continue with profile update (backend will validate)
    console.warn('Phone uniqueness check failed, continuing with profile update');
  }
}
```

### 4. Admin Dashboard (`frontend/js/admin.js`)

#### Edit User Form

**Change:** Added phone uniqueness check before form submission with userId parameter.

**Implementation:**
```javascript
// Check phone uniqueness before submission
if (phoneDigits) {
  try {
    const phoneCheckResponse = await fetch('/api/auth/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneDigits, userId: userId })
    });
    if (phoneCheckResponse.status === 409) {
      this.showMessage('This phone number is already registered.', 'error');
      return;
    }
  } catch (phoneCheckError) {
    // If phone check fails, continue with user update (backend will validate)
    console.warn('Phone uniqueness check failed, continuing with user update');
  }
}
```

#### Create User Form

**Change:** Added phone uniqueness check before form submission (no userId for new users).

**Implementation:**
```javascript
// Check phone uniqueness before submission
if (phoneDigits) {
  try {
    const phoneCheckResponse = await fetch('/api/auth/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneDigits })
    });
    if (phoneCheckResponse.status === 409) {
      this.showMessage('This phone number is already registered.', 'error');
      return;
    }
  } catch (phoneCheckError) {
    // If phone check fails, continue with user creation (backend will validate)
    console.warn('Phone uniqueness check failed, continuing with user creation');
  }
}
```

#### Super Admin User Form

**Change:** Added phone uniqueness check before form submission with userId parameter for editing, null for creation.

**Implementation:**
```javascript
// Check phone uniqueness before submission
if (phoneDigits) {
  try {
    const phoneCheckResponse = await fetch('/api/auth/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneDigits, userId: userId || null })
    });
    if (phoneCheckResponse.status === 409) {
      this.showMessage('This phone number is already registered.', 'error');
      return;
    }
  } catch (phoneCheckError) {
    // If phone check fails, continue with user creation/edit (backend will validate)
    console.warn('Phone uniqueness check failed, continuing with user operation');
  }
}
```

---

## HTTP Status Codes

### 409 Conflict

Used when a phone number is already registered by another user.

**Response Format:**
```json
{
  "message": "This phone number is already registered."
}
```

---

## Error Messages

### Frontend Display

**Message:** "This phone number is already registered."

**Display Locations:**
- Registration form (app.js)
- Customer profile update (customer-account.js)
- Farmer profile update (farmer.js)
- Admin create user (admin.js)
- Admin edit user (admin.js)
- Super admin create/edit user (admin.js)

### Backend Response

**Message:** "This phone number is already registered."

**Endpoints:**
- POST /api/auth/check-phone
- POST /api/auth/register
- PUT /api/auth/profile
- POST /api/admin/users
- PUT /api/admin/users/:id
- POST /api/superadmin/users
- PUT /api/superadmin/users/:id
- PUT /api/farmers/profile

---

## Validation Rules

### Phone Format Validation (Unchanged)

- **Format:** 10 digits starting with 9
- **Pattern:** `^9[0-9]{9}$`
- **Example:** 9123456789
- **Input Format:** 9XX XXX XXXX (with spaces for display)

### Phone Uniqueness Validation (New)

- **Scope:** All user accounts across the system
- **Update Exception:** Users can keep their own phone number during profile updates
- **Database Constraint:** Partial unique index on non-null, non-empty phone numbers

---

## Files Modified

### Database
- `database/migrations/add_phone_unique_constraint.sql` (new)
- `backend/scripts/check_duplicate_phones.js` (new)
- `backend/scripts/resolve_duplicate_phones.js` (new)
- `backend/scripts/apply_phone_unique_constraint.js` (new)

### Backend Routes
- `backend/routes/auth.js`
- `backend/routes/admin.js`
- `backend/routes/superadmin.js`
- `backend/routes/farmers.js`

### Frontend JavaScript
- `frontend/js/app.js`
- `frontend/js/customer-account.js`
- `frontend/js/farmer.js`
- `frontend/js/admin.js`

---

## Testing Recommendations

### 1. Registration Flow
- Attempt to register with a phone number already in use
- Verify error message: "This phone number is already registered."
- Verify HTTP 409 response from backend

### 2. Profile Update Flow
- Update profile with own phone number (should succeed)
- Update profile with another user's phone number (should fail with 409)
- Verify error message displays correctly

### 3. Admin User Management
- Create user with duplicate phone number (should fail with 409)
- Edit user to use another user's phone number (should fail with 409)
- Edit user to keep their own phone number (should succeed)

### 4. Super Admin User Management
- Create user with duplicate phone number (should fail with 409)
- Edit user to use another user's phone number (should fail with 409)
- Edit user to keep their own phone number (should succeed)

### 5. Farmer Profile Update
- Update farmer profile with own phone number (should succeed)
- Update farmer profile with another user's phone number (should fail with 409)

---

## Rollback Plan

If rollback is required:

### Database Rollback
```sql
DROP INDEX IF EXISTS idx_users_phone_unique;
```

### Backend Rollback
Remove phone uniqueness validation from:
- `backend/routes/auth.js` (lines 367-374, 1040-1047)
- `backend/routes/admin.js` (lines 721-731, 1044-1051)
- `backend/routes/superadmin.js` (lines 466-477, 563-579)
- `backend/routes/farmers.js` (lines 862-878)

### Frontend Rollback
Remove phone uniqueness checks from:
- `frontend/js/app.js` (lines 4901-4917)
- `frontend/js/customer-account.js` (lines 546-560)
- `frontend/js/farmer.js` (lines 5344-5360)
- `frontend/js/admin.js` (lines 9945-9961, 10023-10039, 10143-10159)

---

## Notes

- **Existing Phone Format Validation:** No changes to phone format validation, placeholders, maxlength, minlength, pattern, input formatting, or UI behavior as requested.
- **Data Integrity:** Existing duplicate phone numbers were resolved before applying the constraint. No valid data was lost.
- **Backward Compatibility:** The implementation is backward compatible. Existing users can keep their phone numbers.
- **Frontend Fallback:** If the phone uniqueness check fails on the frontend, the backend validation will still catch duplicates.
- **Performance:** The partial unique index is efficient and only applies to non-null, non-empty phone numbers.

---

## Summary

Phone number uniqueness has been successfully implemented across the AgriCatch system with:

- **Database constraint** ensuring uniqueness at the data level
- **Backend validation** preventing duplicate phone numbers in all user creation/update flows
- **Frontend validation** providing immediate user feedback before form submission
- **Data integrity** maintained through duplicate resolution before constraint application
- **User experience** preserved with no changes to existing phone format validation or UI behavior

The implementation follows the project's engineering principles of correctness, stability, maintainability, and security.
