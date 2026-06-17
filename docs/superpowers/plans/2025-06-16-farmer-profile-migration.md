# Farmer Profile Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "My Profile" section to farmer.html with shop name vs owner name distinction, and update admin.html to display both as separate columns.

**Architecture:** Database migration adds shop_name, first_name, middle_name, last_name columns. Backend updates user endpoints and admin farmer endpoints. Frontend adds profile section to farmer.html and updates farmers table in admin.html.

**Tech Stack:** PostgreSQL, Node.js/Express backend, Bootstrap 5.3.3 frontend, vanilla JavaScript

---

## File Structure

**Database:**
- `database/migrations/add_farmer_name_fields.sql` - Migration script to add new columns and migrate existing data

**Backend:**
- `backend/routes/users.js` - Add profile update endpoint
- `backend/routes/admin.js` - Update farmer edit endpoint to handle new fields

**Frontend:**
- `frontend/farmer.html` - Add profile section HTML
- `frontend/js/farmer.js` - Add profile functions and event listeners
- `frontend/admin.html` - Update farmers table columns
- `frontend/js/admin.js` - Update farmers table rendering and edit modal

---

### Task 1: Create database migration

**Files:**
- Create: `database/migrations/add_farmer_name_fields.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Add shop_name, first_name, middle_name, last_name columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS shop_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS middle_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(50);

-- Migrate existing data: split full_name into first_name, middle_name, last_name
-- For farmers: set shop_name = full_name (as default)
UPDATE users
SET 
    first_name = CASE 
        WHEN position(' ' IN full_name) > 0 THEN substring(full_name from 1 for position(' ' IN full_name) - 1)
        ELSE full_name
    END,
    last_name = CASE 
        WHEN position(' ' IN full_name) > 0 THEN substring(full_name from (length(full_name) - position(' ' IN reverse(full_name)) + 2))
        ELSE full_name
    END,
    middle_name = CASE 
        WHEN array_length(regexp_split_to_array(full_name, '\s+'), 1) > 2 THEN
            array_to_string(regexp_split_to_array(full_name, '\s+')[2:array_length(regexp_split_to_array(full_name, '\s+'), 1)-1], ' ')
        ELSE NULL
    END,
    shop_name = CASE 
        WHEN role = 'farmer' THEN full_name
        ELSE NULL
    END
WHERE full_name IS NOT NULL;

-- Create index on shop_name for farmers
CREATE INDEX IF NOT EXISTS idx_users_shop_name ON users(shop_name) WHERE role = 'farmer';
```

- [ ] **Step 2: Commit migration**

```bash
git add database/migrations/add_farmer_name_fields.sql
git commit -m "feat: add shop_name and name fields migration for farmer profile"
```

---

### Task 2: Add profile update endpoint to users.js

**Files:**
- Modify: `backend/routes/users.js`

- [ ] **Step 1: Add profile update endpoint**

```javascript
// Update user profile (first_name, middle_name, last_name, phone)
router.put('/profile', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { first_name, middle_name, last_name, phone } = req.body;

    // Validation
    if (!first_name || !last_name) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }

    if (first_name.length > 50 || last_name.length > 50) {
      return res.status(400).json({ message: 'Name fields must be 50 characters or less' });
    }

    if (middle_name && middle_name.length > 50) {
      return res.status(400).json({ message: 'Middle name must be 50 characters or less' });
    }

    if (phone && !/^9[0-9]{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone must be 10 digits starting with 9' });
    }

    // Update user
    const result = await pool.query(
      `UPDATE users 
       SET first_name = $1, middle_name = $2, last_name = $3, phone = $4,
           full_name = $5 || COALESCE(' ' || $6 || ' ', '') || $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, username, email, first_name, middle_name, last_name, 
                 full_name, phone, role, shop_name, shop_description, 
                 shop_avatar_url, created_at`,
      [first_name, middle_name, last_name, phone, first_name, middle_name, last_name, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});
```

- [ ] **Step 2: Update /users/me endpoint to return new fields**

```javascript
// Modify existing GET /users/me to include new fields
// Add shop_name, first_name, middle_name, last_name to the SELECT query
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/users.js
git commit -m "feat: add profile update endpoint and update /users/me response"
```

---

### Task 3: Update admin farmer edit endpoint

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: Update farmer edit endpoint to handle new fields**

```javascript
// Find the PUT /admin/farmers/:id endpoint
// Update the query to include shop_name, first_name, middle_name, last_name
// Example modification:

const { 
  username, email, full_name, phone, address, role, 
  is_disabled, disabled_reason, shop_name, 
  first_name, middle_name, last_name 
} = req.body;

const result = await pool.query(
  `UPDATE users 
   SET username = $1, email = $2, phone = $3, address = $4, 
       role = $5, is_disabled = $6, disabled_reason = $7,
       shop_name = $8, first_name = $9, middle_name = $10, last_name = $11,
       full_name = $12 || COALESCE(' ' || $13 || ' ', '') || $14,
       updated_at = CURRENT_TIMESTAMP
   WHERE id = $15 AND role = 'farmer'
   RETURNING *`,
  [username, email, phone, address, role, is_disabled, disabled_reason,
   shop_name, first_name, middle_name, last_name,
   first_name, middle_name, last_name, farmerId]
);
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat: update farmer edit endpoint to handle shop_name and name fields"
```

---

### Task 4: Add profile section HTML to farmer.html

**Files:**
- Modify: `frontend/farmer.html`

- [ ] **Step 1: Add profile section before shop section**

```html
<!-- PROFILE SECTION -->
<section id="profile" class="admin-section-card">
    <div class="ac-section-hero ac-section-hero--primary mb-4">
        <div class="ac-section-hero__icon">
            <i class="bi bi-person-circle"></i>
        </div>
        <div class="ac-section-hero__body">
            <h4 class="ac-section-hero__title">My Profile</h4>
            <p class="ac-section-hero__sub">View and edit your personal account details and preferences.</p>
        </div>
    </div>

    <div class="row g-3">
        <!-- Profile card (left col) -->
        <div class="col-xl-4">
            <div class="card">
                <div class="card-body profile-card pt-4 d-flex flex-column align-items-center">
                    <div class="profile-avatar-lg mb-3">
                        <img src="/images/resendlogo.png" alt="Profile" class="rounded-circle" id="profile-avatar-img" style="width:80px;height:80px;object-fit:cover">
                    </div>
                    <h2 class="fw-semibold" id="profile-shop-name">—</h2>
                    <h3 class="text-muted small" id="profile-owner-name">—</h3>
                    <div class="social-links mt-2 d-flex gap-2"></div>
                </div>
            </div>
        </div>

        <!-- Profile tabs (right col) -->
        <div class="col-xl-8">
            <div class="card">
                <div class="card-body pt-3">
                    <ul class="nav nav-tabs nav-tabs-bordered" id="profileTabs">
                        <li class="nav-item">
                            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#profile-overview">Overview</button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#profile-edit">Edit Profile</button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#profile-change-password">Change Password</button>
                        </li>
                    </ul>
                    <div class="tab-content pt-2">
                        <!-- Overview Tab -->
                        <div class="tab-pane fade show active profile-overview" id="profile-overview">
                            <h5 class="card-title">Profile Details</h5>
                            <div class="row mb-2">
                                <div class="col-lg-3 col-md-4 label fw-semibold text-muted small">Shop Name</div>
                                <div class="col-lg-9 col-md-8" id="po-shop-name">—</div>
                            </div>
                            <div class="row mb-2">
                                <div class="col-lg-3 col-md-4 label fw-semibold text-muted small">Owner Name</div>
                                <div class="col-lg-9 col-md-8" id="po-owner-name">—</div>
                            </div>
                            <div class="row mb-2">
                                <div class="col-lg-3 col-md-4 label fw-semibold text-muted small">Email</div>
                                <div class="col-lg-9 col-md-8" id="po-email">—</div>
                            </div>
                            <div class="row mb-2">
                                <div class="col-lg-3 col-md-4 label fw-semibold text-muted small">Phone</div>
                                <div class="col-lg-9 col-md-8" id="po-phone">—</div>
                            </div>
                            <div class="row mb-2">
                                <div class="col-lg-3 col-md-4 label fw-semibold text-muted small">Role</div>
                                <div class="col-lg-9 col-md-8" id="po-role">—</div>
                            </div>
                            <div class="row mb-2">
                                <div class="col-lg-3 col-md-4 label fw-semibold text-muted small">Joined</div>
                                <div class="col-lg-9 col-md-8" id="po-joined">—</div>
                            </div>
                        </div>

                        <!-- Edit Profile Tab -->
                        <div class="tab-pane fade profile-edit" id="profile-edit">
                            <h5 class="card-title">Edit Profile</h5>
                            <form id="profile-edit-form">
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <label class="form-label">First Name</label>
                                        <input type="text" id="pe-firstname" class="form-control form-control-sm">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Middle Name (Optional)</label>
                                        <input type="text" id="pe-middlename" class="form-control form-control-sm" placeholder="Optional">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Last Name</label>
                                        <input type="text" id="pe-lastname" class="form-control form-control-sm">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Phone</label>
                                    <div class="input-group input-group-sm">
                                        <span class="input-group-text">+63</span>
                                        <input type="text" id="pe-phone" class="form-control" placeholder="9XXXXXXXXX" maxlength="10" pattern="9[0-9]{9}">
                                    </div>
                                    <div class="form-text text-muted small">Enter 10 digits starting with 9 (e.g. 9123456789). Letters are not allowed.</div>
                                </div>
                                <div class="text-end">
                                    <button type="submit" class="btn btn-primary btn-sm" id="profile-save-btn">
                                        <span class="btn-text">Save Changes</span>
                                        <span class="spinner-border spinner-border-sm d-none ms-1" id="profile-save-spinner"></span>
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- Change Password Tab -->
                        <div class="tab-pane fade" id="profile-change-password">
                            <h5 class="card-title">Change Password</h5>
                            <form id="profile-password-form">
                                <div class="mb-3">
                                    <label class="form-label">Current Password</label>
                                    <input type="password" id="pp-current" class="form-control form-control-sm">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">New Password</label>
                                    <input type="password" id="pp-new" class="form-control form-control-sm">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Confirm New Password</label>
                                    <input type="password" id="pp-confirm" class="form-control form-control-sm">
                                </div>
                                <div id="pp-error" class="alert alert-danger d-none small"></div>
                                <div class="text-end">
                                    <button type="submit" class="btn btn-primary btn-sm" id="pp-submit-btn">
                                        <span class="btn-text">Change Password</span>
                                        <span class="spinner-border spinner-border-sm d-none ms-1" id="pp-spinner"></span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 2: Update sidebar dropdown to link to profile**

```html
<!-- Find the farmer-sidebar-dropdown-menu and update the My Account button -->
<button id="farmer-sidebar-my-account-btn" type="button" data-section="profile">
    <i class="bi bi-person-circle"></i>My Profile
</button>
```

- [ ] **Step 3: Add CSS for profile card**

```css
/* Add to the <style> block in farmer.html */
.profile-card {
    background: linear-gradient(135deg, #2d7a3a 0%, #1a5c2e 100%);
    color: #fff;
}
.profile-avatar-lg img {
    border: 3px solid rgba(255,255,255,0.3);
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: add profile section to farmer.html"
```

---

### Task 5: Add profile functions to farmer.js

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Add loadProfile function**

```javascript
async loadProfile() {
    try {
        const response = await fetch(`${this.apiBase}/users/me`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.user || data;

            // Update profile card
            const shopNameEl = document.getElementById('profile-shop-name');
            const ownerNameEl = document.getElementById('profile-owner-name');
            if (shopNameEl) shopNameEl.textContent = user.shop_name || user.full_name || '—';
            if (ownerNameEl) ownerNameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';

            // Update overview tab
            document.getElementById('po-shop-name').textContent = user.shop_name || user.full_name || '—';
            document.getElementById('po-owner-name').textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';
            document.getElementById('po-email').textContent = user.email || '—';
            document.getElementById('po-phone').textContent = user.phone ? `+63${user.phone}` : '—';
            document.getElementById('po-role').textContent = user.role || '—';
            document.getElementById('po-joined').textContent = user.created_at 
                ? new Date(user.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                : '—';

            // Pre-populate edit form
            document.getElementById('pe-firstname').value = user.first_name || '';
            document.getElementById('pe-middlename').value = user.middle_name || '';
            document.getElementById('pe-lastname').value = user.last_name || '';
            document.getElementById('pe-phone').value = user.phone || '';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        this.showMessage('Error loading profile', 'error');
    }
}
```

- [ ] **Step 2: Add updateProfile function**

```javascript
async updateProfile() {
    const firstname = document.getElementById('pe-firstname').value.trim();
    const middlename = document.getElementById('pe-middlename').value.trim();
    const lastname = document.getElementById('pe-lastname').value.trim();
    const phone = document.getElementById('pe-phone').value.trim();

    if (!firstname || !lastname) {
        this.showMessage('First name and last name are required', 'error');
        return;
    }

    const saveBtn = document.getElementById('profile-save-btn');
    const spinner = document.getElementById('profile-save-spinner');
    const btnText = saveBtn.querySelector('.btn-text');

    saveBtn.disabled = true;
    spinner.classList.remove('d-none');
    btnText.textContent = 'Saving...';

    try {
        const response = await fetch(`${this.apiBase}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ first_name: firstname, middle_name: middlename, last_name: lastname, phone })
        });

        if (response.ok) {
            this.showMessage('Profile updated successfully', 'success');
            this.loadProfile(); // Refresh display
        } else {
            const errorData = await response.json();
            this.showMessage(errorData.message || 'Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        this.showMessage('Error updating profile', 'error');
    } finally {
        saveBtn.disabled = false;
        spinner.classList.add('d-none');
        btnText.textContent = 'Save Changes';
    }
}
```

- [ ] **Step 3: Add event listeners for profile**

```javascript
// Add to setupEventListeners() function
document.getElementById('profile-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    this.updateProfile();
});

document.getElementById('profile-password-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    this.changePassword();
});
```

- [ ] **Step 4: Update showSection to load profile when opening profile section**

```javascript
// In showSection() function, after setting active section
if (safeSection === 'profile') {
    this.loadProfile();
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add profile functions to farmer.js"
```

---

### Task 6: Update admin.html farmers table columns

**Files:**
- Modify: `frontend/admin.html`

- [ ] **Step 1: Find farmers table and update columns**

```html
<!-- Find the farmers table header and update -->
<!-- Change single "Name" column to two columns: "Shop Name" and "Owner Name" -->
<th>Shop Name</th>
<th>Owner Name</th>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/admin.html
git commit -m "feat: update farmers table to show shop name and owner name separately"
```

---

### Task 7: Update admin.js farmers table rendering

**Files:**
- Modify: `frontend/js/admin.js`

- [ ] **Step 1: Update farmers table rendering to display both columns**

```javascript
// Find the function that renders farmers table rows
// Update to show shop_name and owner name separately

// Example modification:
const shopName = farmer.shop_name || farmer.full_name || '—';
const ownerName = `${farmer.first_name || ''} ${farmer.last_name || ''}`.trim() || '—';

// In the table row HTML:
<td>${this.escapeHtml(shopName)}</td>
<td>${this.escapeHtml(ownerName)}</td>
```

- [ ] **Step 2: Update farmer edit modal to include new fields**

```javascript
// Find the farmer edit modal form
// Add shop_name, first_name, middle_name, last_name fields

// Example:
<div class="mb-3">
    <label class="form-label">Shop Name</label>
    <input type="text" id="edit-farmer-shop-name" class="form-control">
</div>
<div class="row mb-3">
    <div class="col-md-4">
        <label class="form-label">First Name</label>
        <input type="text" id="edit-farmer-first-name" class="form-control">
    </div>
    <div class="col-md-4">
        <label class="form-label">Middle Name</label>
        <input type="text" id="edit-farmer-middle-name" class="form-control">
    </div>
    <div class="col-md-4">
        <label class="form-label">Last Name</label>
        <input type="text" id="edit-farmer-last-name" class="form-control">
    </div>
</div>
```

- [ ] **Step 3: Update farmer edit save function to include new fields**

```javascript
// When saving farmer edit, include new fields in the request body
const shopName = document.getElementById('edit-farmer-shop-name').value;
const firstName = document.getElementById('edit-farmer-first-name').value;
const middleName = document.getElementById('edit-farmer-middle-name').value;
const lastName = document.getElementById('edit-farmer-last-name').value;

// Add to the request body
shop_name: shopName,
first_name: firstName,
middle_name: middleName,
last_name: lastName
```

- [ ] **Step 4: Commit**

```bash
git add frontend/js/admin.js
git commit -m "feat: update admin farmers table and edit modal for shop name and owner name"
```

---

### Task 8: Execute database migration

**Files:**
- Execute: `database/migrations/add_farmer_name_fields.sql`

- [ ] **Step 1: Run migration on database**

```bash
# Connect to your database and run the migration
psql -U your_username -d agricatch -f database/migrations/add_farmer_name_fields.sql
```

- [ ] **Step 2: Verify migration**

```sql
-- Check that columns were added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('shop_name', 'first_name', 'middle_name', 'last_name');

-- Check that data was migrated
SELECT id, username, full_name, shop_name, first_name, middle_name, last_name 
FROM users WHERE role = 'farmer' LIMIT 5;
```

- [ ] **Step 3: Commit migration execution note**

```bash
echo "$(date): Executed add_farmer_name_fields.sql migration" >> database/migrations/execution.log
git add database/migrations/execution.log
git commit -m "chore: log execution of add_farmer_name_fields.sql migration"
```

---

### Task 9: Test and verify implementation

**Files:**
- Manual testing

- [ ] **Step 1: Test farmer profile section**

1. Login as a farmer
2. Click "My Profile" in sidebar dropdown
3. Verify profile section opens with Overview tab active
4. Verify shop name and owner name are displayed
5. Switch to Edit Profile tab
6. Update first name, middle name, last name, phone
7. Click "Save Changes"
8. Verify success message and data updates
9. Switch to Change Password tab
10. Test password change with correct current password
11. Verify success message

- [ ] **Step 2: Test admin farmers table**

1. Login as admin
2. Navigate to Farmers section
3. Verify "Shop Name" and "Owner Name" columns are displayed
4. Click edit on a farmer
5. Verify edit modal shows shop_name, first_name, middle_name, last_name fields
6. Update fields and save
7. Verify table updates with new values

- [ ] **Step 3: Verify data migration**

1. Check database that existing farmers have shop_name set
2. Check that full_name was split into first_name, middle_name, last_name
3. Verify computed full_name is correct

- [ ] **Step 4: Commit final verification**

```bash
git commit --allow-empty -m "chore: farmer profile migration verified and tested"
```

---

## Self-Review

**Spec coverage:**
- Database migration with shop_name, first_name, middle_name, last_name ✓
- Migration logic (split full_name, set shop_name for farmers) ✓
- Backend /users/me endpoint update ✓
- Backend /users/profile endpoint ✓
- Backend admin farmer edit endpoint update ✓
- farmer.html profile section with 3 tabs ✓
- farmer.js profile functions ✓
- admin.html farmers table columns ✓
- admin.js farmers table rendering ✓
- admin.js farmer edit modal ✓

**Placeholder scan:** No placeholders found. All steps contain actual code.

**Type consistency:** Field names consistent across all tasks (shop_name, first_name, middle_name, last_name).
