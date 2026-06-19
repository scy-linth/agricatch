# Farmer Subscription Tier Implementation Plan (Part 1: Backend & Database)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement free/premium subscription tiers — Part 1 covers database migration, backend endpoints, and product limit enforcement.

**Tech Stack:** PostgreSQL, Node.js/Express, JavaScript

---

## File Structure (Part 1)

**Files to create:**
- `database/migrations/add_farmer_subscriptions.sql`
- `backend/routes/subscriptions.js`
- `backend/scripts/expire_subscriptions.js`

**Files to modify:**
- `backend/server.js` — Register subscriptions route
- `backend/routes/admin.js` — Admin approval endpoints
- `backend/routes/products.js` — Enforce product limit by tier
- `backend/routes/superadmin.js` — Add subscription keys to settings

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/add_farmer_subscriptions.sql`

- [ ] **Step 1: Create payment_accounts table first (referenced by farmer_subscriptions)**

```sql
CREATE TABLE IF NOT EXISTS payment_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    account_number text NOT NULL,
    type text NOT NULL CHECK (type IN ('gcash', 'bank_transfer')),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Seed default GCash account
INSERT INTO payment_accounts (name, account_number, type, is_active, sort_order) VALUES
    ('AgriCatch Inc.', '0917 123 4567', 'gcash', true, 1);
```

- [ ] **Step 2: Create farmer_subscriptions table**

```sql
-- Farmer subscription tiers: free (default) vs premium
-- Renewal stacks on top of existing expiry via GREATEST logic in approve endpoint

CREATE TABLE IF NOT EXISTS farmer_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id uuid REFERENCES farmers(id) ON DELETE CASCADE,
    tier text NOT NULL CHECK (tier IN ('free', 'premium')),
    status text NOT NULL CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
    plan_duration_months integer NOT NULL CHECK (plan_duration_months IN (1, 3, 6)),
    payment_proof_url text,
    payment_account_id uuid REFERENCES payment_accounts(id) ON DELETE SET NULL,
    payment_method text,
    amount_paid numeric(10,2),
    approved_by uuid REFERENCES users(id),
    approved_at timestamptz,
    starts_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_farmer_subscriptions_farmer_id ON farmer_subscriptions(farmer_id);
CREATE INDEX idx_farmer_subscriptions_status ON farmer_subscriptions(status);
```

- [ ] **Step 3: Seed platform_settings keys for subscription pricing**

```sql
-- Seed default subscription settings (GCash details now live in payment_accounts table)
INSERT INTO platform_settings (key, value) VALUES
    ('premium_monthly_price', '299'),
    ('premium_3month_discount_pct', '10'),
    ('premium_6month_discount_pct', '20')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 4: Backfill existing farmers with free tier**

```sql
-- Existing farmers without active subscriptions get a free tier entry
-- so the getFarmerTier() helper always returns a row
INSERT INTO farmer_subscriptions (farmer_id, tier, status, plan_duration_months, starts_at, expires_at)
SELECT f.id, 'free', 'active', 1, CURRENT_TIMESTAMP, '2099-12-31'::timestamptz
FROM farmers f
WHERE NOT EXISTS (
    SELECT 1 FROM farmer_subscriptions s WHERE s.farmer_id = f.id
)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 5: Commit migration file**

```bash
git add database/migrations/add_farmer_subscriptions.sql
git commit -m "db: add farmer_subscriptions, payment_accounts tables and subscription settings"
```

---

### Task 2: Backend — Subscription Settings & Farmer Endpoints

**Files:**
- Create: `backend/routes/subscriptions.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create subscriptions.js**

```javascript
const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// ── GET /api/subscriptions/settings ───────────────────────────────────────────
router.get('/settings', async (req, res) => {
    try {
        // Fetch pricing settings
        const keys = [
            'premium_monthly_price',
            'premium_3month_discount_pct',
            'premium_6month_discount_pct'
        ];
        const settingsResult = await pool.query(
            `SELECT key, value FROM platform_settings WHERE key = ANY($1)`,
            [keys]
        );
        const settings = {};
        for (const row of settingsResult.rows) settings[row.key] = row.value;

        // Fetch active payment accounts
        const accountsResult = await pool.query(
            `SELECT id, name, account_number, type
             FROM payment_accounts
             WHERE is_active = true
             ORDER BY sort_order ASC, created_at ASC`
        );

        const monthly = parseFloat(settings.premium_monthly_price) || 299;
        const d3 = parseFloat(settings.premium_3month_discount_pct) || 10;
        const d6 = parseFloat(settings.premium_6month_discount_pct) || 20;

        res.json({
            monthly_price: monthly,
            durations: {
                1: { months: 1, total: Math.round(monthly), discount_pct: 0 },
                3: { months: 3, total: Math.round(monthly * 3 * (1 - d3 / 100)), discount_pct: d3 },
                6: { months: 6, total: Math.round(monthly * 6 * (1 - d6 / 100)), discount_pct: d6 }
            },
            payment_accounts: accountsResult.rows
        });
    } catch (err) {
        console.error('Subscription settings error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── GET /api/farmers/me/subscription ──────────────────────────────────────────
router.get('/farmers/me/subscription', authenticateToken, async (req, res) => {
    try {
        const farmerRes = await pool.query(
            'SELECT id FROM farmers WHERE user_id = $1', [req.user.id]
        );
        if (farmerRes.rows.length === 0) {
            return res.json({ tier: 'free', status: 'free', expires_at: null });
        }
        const farmerId = farmerRes.rows[0].id;
        const subRes = await pool.query(
            `SELECT tier, status, plan_duration_months, expires_at,
                    payment_proof_url, amount_paid, created_at
             FROM farmer_subscriptions
             WHERE farmer_id = $1 AND status IN ('active', 'pending', 'expired')
             ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
                      expires_at DESC NULLS LAST, created_at DESC
             LIMIT 1`, [farmerId]
        );
        if (subRes.rows.length === 0) {
            return res.json({ tier: 'free', status: 'free', expires_at: null });
        }
        const s = subRes.rows[0];
        res.json({
            tier: s.tier, status: s.status, plan_duration_months: s.plan_duration_months,
            expires_at: s.expires_at, payment_proof_url: s.payment_proof_url,
            amount_paid: s.amount_paid, created_at: s.created_at
        });
    } catch (err) {
        console.error('Farmer subscription error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── POST /api/farmers/me/subscription/request ─────────────────────────────────
router.post('/farmers/me/subscription/request', authenticateToken, upload.single('payment_proof'), async (req, res) => {
    try {
        const months = Number(req.body.plan_duration_months);
        if (![1, 3, 6].includes(months)) {
            return res.status(400).json({ message: 'Plan duration must be 1, 3, or 6 months' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'Payment proof receipt is required' });
        }
        const farmerRes = await pool.query(
            'SELECT id FROM farmers WHERE user_id = $1', [req.user.id]
        );
        if (farmerRes.rows.length === 0) {
            return res.status(404).json({ message: 'Farmer profile not found' });
        }
        const farmerId = farmerRes.rows[0].id;
        const pendingRes = await pool.query(
            `SELECT id FROM farmer_subscriptions WHERE farmer_id = $1 AND status = 'pending'`, [farmerId]
        );
        if (pendingRes.rows.length > 0) {
            return res.status(400).json({ message: 'You already have a pending subscription request' });
        }
        const { payment_account_id, payment_method, expected_amount } = req.body;
        const proofUrl = req.file.path || req.file.secure_url || req.file.url;

        // Validate payment_account_id if provided
        if (payment_account_id) {
            const accountRes = await pool.query(
                'SELECT id FROM payment_accounts WHERE id = $1 AND is_active = true',
                [payment_account_id]
            );
            if (accountRes.rows.length === 0) {
                return res.status(400).json({ message: 'Invalid or inactive payment account selected' });
            }
        }

        await pool.query(
            `INSERT INTO farmer_subscriptions
             (farmer_id, tier, status, plan_duration_months, payment_proof_url, payment_account_id, payment_method, amount_paid)
             VALUES ($1, 'premium', 'pending', $2, $3, $4, $5, $6)`,
            [farmerId, months, proofUrl, payment_account_id || null, payment_method || 'gcash', expected_amount || null]
        );
        res.json({ message: 'Subscription request submitted. Please wait for admin approval.' });
    } catch (err) {
        console.error('Subscription request error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
```

- [ ] **Step 2: Register in server.js**

```javascript
const subscriptionRoutes = require('./routes/subscriptions');
app.use('/api/subscriptions', subscriptionRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/subscriptions.js backend/server.js
git commit -m "feat: add subscription settings and farmer request endpoints"
```

---

### Task 3: Backend — Admin Approval Endpoints

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: Add admin subscription routes**

Append to `backend/routes/admin.js`:

```javascript
// ── GET /api/admin/subscriptions ──────────────────────────────────────────────
router.get('/subscriptions', requireRole(['admin', 'super_admin']), async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const result = await pool.query(
            `SELECT s.*, f.farm_name, u.first_name, u.last_name, u.email,
                     pa.name as payment_account_name, pa.account_number as payment_account_number, pa.type as payment_account_type
             FROM farmer_subscriptions s
             JOIN farmers f ON s.farmer_id = f.id
             JOIN users u ON f.user_id = u.id
             LEFT JOIN payment_accounts pa ON pa.id = s.payment_account_id
             WHERE s.status = $1 ORDER BY s.created_at DESC`, [status]
        );
        res.json({ subscriptions: result.rows });
    } catch (err) {
        console.error('Admin subscriptions error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── PUT /api/admin/subscriptions/:id/approve ─────────────────────────────────
router.put('/subscriptions/:id/approve', requireRole(['admin', 'super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        const subRes = await pool.query(
            'SELECT * FROM farmer_subscriptions WHERE id = $1 AND status = $2',
            [id, 'pending']
        );
        if (subRes.rows.length === 0) {
            return res.status(404).json({ message: 'Pending subscription not found' });
        }
        const sub = subRes.rows[0];
        const months = sub.plan_duration_months;
        await pool.query(
            `UPDATE farmer_subscriptions
             SET status = 'active',
                 starts_at = COALESCE(starts_at, CURRENT_TIMESTAMP),
                 expires_at = GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + ($1 || ' months')::interval,
                 approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [months, adminId, id]
        );
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
             VALUES ((SELECT user_id FROM farmers WHERE id = $1), 'subscription_approved',
              'Premium Subscription Approved', $2, false, CURRENT_TIMESTAMP)`,
            [sub.farmer_id, `Your Premium subscription is active! You now have unlimited products, priority approval, custom product names, and advanced analytics.`]
        );
        broadcastEvent('notification.created', { farmer_id: sub.farmer_id });
        res.json({ message: 'Subscription approved' });
    } catch (err) {
        console.error('Subscription approve error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── PUT /api/admin/subscriptions/:id/reject ──────────────────────────────────
router.put('/subscriptions/:id/reject', requireRole(['admin', 'super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const subRes = await pool.query(
            'SELECT * FROM farmer_subscriptions WHERE id = $1 AND status = $2', [id, 'pending']
        );
        if (subRes.rows.length === 0) {
            return res.status(404).json({ message: 'Pending subscription not found' });
        }
        const sub = subRes.rows[0];
        await pool.query(
            `UPDATE farmer_subscriptions SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id]
        );
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
             VALUES ((SELECT user_id FROM farmers WHERE id = $1), 'subscription_rejected',
              'Premium Subscription Rejected', $2, false, CURRENT_TIMESTAMP)`,
            [sub.farmer_id, `Your Premium subscription request was rejected.${reason ? ' Reason: ' + reason : ''} You may submit a new request.`]
        );
        broadcastEvent('notification.created', { farmer_id: sub.farmer_id });
        res.json({ message: 'Subscription rejected' });
    } catch (err) {
        console.error('Subscription reject error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat: add admin subscription approval endpoints with renewal logic"
```

---

### Task 3b: Backend — Payment Accounts CRUD (Superadmin)

**Files:**
- Create: `backend/routes/payment-accounts.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create payment-accounts.js**

```javascript
const express = require('express');
const { pool } = require('../utils/db');
const { requireRole } = require('../middleware/requireRole');

const router = express.Router();

// ── GET /api/admin/payment-accounts ──────────────────────────────────────────
router.get('/payment-accounts', requireRole(['super_admin']), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, account_number, type, is_active, sort_order
             FROM payment_accounts
             ORDER BY sort_order ASC, created_at ASC`
        );
        res.json({ accounts: result.rows });
    } catch (err) {
        console.error('Payment accounts error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── POST /api/admin/payment-accounts ─────────────────────────────────────────
router.post('/payment-accounts', requireRole(['super_admin']), async (req, res) => {
    try {
        const { name, account_number, type, sort_order } = req.body;
        if (!name || !account_number || !type) {
            return res.status(400).json({ message: 'Name, account_number, and type are required' });
        }
        if (!['gcash', 'bank_transfer'].includes(type)) {
            return res.status(400).json({ message: 'Type must be gcash or bank_transfer' });
        }
        const result = await pool.query(
            `INSERT INTO payment_accounts (name, account_number, type, is_active, sort_order)
             VALUES ($1, $2, $3, true, $4)
             RETURNING *`,
            [name, account_number, type, sort_order || 0]
        );
        res.json({ account: result.rows[0], message: 'Payment account created' });
    } catch (err) {
        console.error('Create payment account error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── PUT /api/admin/payment-accounts/:id ──────────────────────────────────────
router.put('/payment-accounts/:id', requireRole(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, account_number, type, is_active, sort_order } = req.body;
        const result = await pool.query(
            `UPDATE payment_accounts
             SET name = COALESCE($1, name),
                 account_number = COALESCE($2, account_number),
                 type = COALESCE($3, type),
                 is_active = COALESCE($4, is_active),
                 sort_order = COALESCE($5, sort_order),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [name, account_number, type, is_active, sort_order, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payment account not found' });
        }
        res.json({ account: result.rows[0], message: 'Payment account updated' });
    } catch (err) {
        console.error('Update payment account error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── DELETE /api/admin/payment-accounts/:id ────────────────────────────────────
router.delete('/payment-accounts/:id', requireRole(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM payment_accounts WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payment account not found' });
        }
        res.json({ message: 'Payment account deleted' });
    } catch (err) {
        console.error('Delete payment account error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
```

- [ ] **Step 2: Register in server.js**

```javascript
const paymentAccountRoutes = require('./routes/payment-accounts');
app.use('/api/admin', paymentAccountRoutes);
```

**Verify no route collision:** The admin router in `backend/routes/admin.js` is also mounted at `/api/admin`. Express processes routes in registration order. Since `admin.js` is likely already mounted, add `payment-accounts.js` AFTER it so `/api/admin/payment-accounts` reaches the new router first, OR ensure no existing admin routes conflict with `/payment-accounts/*`.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/payment-accounts.js backend/server.js
git commit -m "feat: add payment accounts CRUD for superadmin"
```

---

### Task 4: Backend — Product Creation Tier Enforcement

**Files:**
- Modify: `backend/routes/products.js:985-1022`

- [ ] **Step 1: Add tier helper functions**

Add near the top of `backend/routes/products.js`:

```javascript
async function getFarmerTier(farmerId) {
    const subRes = await pool.query(
        `SELECT tier, status, expires_at FROM farmer_subscriptions
         WHERE farmer_id = $1 AND status = 'active' ORDER BY expires_at DESC LIMIT 1`, [farmerId]
    );
    if (subRes.rows.length === 0 || new Date(subRes.rows[0].expires_at) < new Date()) return 'free';
    return subRes.rows[0].tier;
}

async function getFarmerProductCount(farmerId) {
    const countRes = await pool.query(
        `SELECT COUNT(*) FROM products WHERE farmer_id = $1 AND status IN ($2, $3) AND is_disabled = false`,
        [farmerId, 'approved', 'pending']
    );
    return parseInt(countRes.rows[0].count, 10);
}
```

- [ ] **Step 2: Replace existing product creation gate**

Replace the block at `products.js:985-1022`:

```javascript
const decoded = jwt.verify(token, process.env.JWT_SECRET);
const userResult = await pool.query('SELECT role, is_verified FROM users WHERE id = $1', [decoded.id]);
if (userResult.rows[0].role !== 'farmer') {
    return res.status(403).json({ message: 'Only farmers can add products' });
}
const isVerified = userResult.rows[0].is_verified;

// Get farmer_id first (needed for all tier checks)
const farmerRes = await pool.query('SELECT id FROM farmers WHERE user_id = $1', [decoded.id]);
if (farmerRes.rows.length === 0) {
    return res.status(403).json({ message: 'Farmer profile not found. Please complete your profile first.' });
}
const farmerId = farmerRes.rows[0].id;
const tier = await getFarmerTier(farmerId);

// Unverified farmers cannot sell at all
if (!isVerified) {
    return res.status(403).json({
        message: 'Unverified farmers cannot list products. Please verify your account first.'
    });
}

// Free verified: max 10 products
if (tier === 'free') {
    const count = await getFarmerProductCount(farmerId);
    if (count >= 10) {
        return res.status(403).json({
            message: 'Free tier limit: 10 active products max. Upgrade to Premium for unlimited listings.',
            current_count: count, limit: 10
        });
    }
}
// Premium passes through unlimited
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/products.js
git commit -m "feat: enforce tier-based product creation (unverified=blocked, free=10, premium=unlimited)"
```

---

### Task 5: Backend — Custom Product Names (Premium Only)

**Files:**
- Modify: `backend/routes/products.js:255-260`

- [ ] **Step 1: Replace verification gate with tier gate**

Replace:
```javascript
if (!isVerified) {
  return res.status(403).json({ message: 'Only verified farmers can request custom product names' });
}
```

With:
```javascript
// Get farmer_id first (getFarmerTier expects farmer_id, not user_id)
const farmerRes = await pool.query('SELECT id FROM farmers WHERE user_id = $1', [decoded.id]);
if (farmerRes.rows.length === 0) {
    return res.status(403).json({ message: 'Farmer profile not found.' });
}
const farmerId = farmerRes.rows[0].id;
const tier = await getFarmerTier(farmerId);
if (tier !== 'premium') {
    return res.status(403).json({ message: 'Custom product names are a Premium feature.' });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/products.js
git commit -m "feat: custom product names now require Premium tier"
```

---

### Task 6: Backend — Search Ranking with Premium Priority

**Files:**
- Modify: `backend/routes/products.js:419-426`

- [ ] **Step 1: Update sort clauses**

Replace all `COALESCE(u.is_verified, false) DESC` in `orderByMap` with:

```sql
COALESCE(
  CASE 
    WHEN s.status = 'active' AND s.expires_at > CURRENT_TIMESTAMP THEN 2
    WHEN u.is_verified = true THEN 1
    ELSE 0
  END, 0
) DESC
```

- [ ] **Step 2: Add LEFT JOIN to farmer_subscriptions**

In each query that uses this sort, add:

```sql
LEFT JOIN farmers fm ON fm.user_id = u.id
LEFT JOIN farmer_subscriptions s ON s.farmer_id = fm.id AND s.status = 'active' AND s.expires_at > CURRENT_TIMESTAMP
```

**Note:** Replace the existing `COALESCE(u.is_verified, false) DESC` in every `orderByMap` entry with the tier-weighted `COALESCE(...)` expression above.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/products.js
git commit -m "feat: premium farmers get highest search ranking priority"
```

---

### Task 7: Backend — Update Admin Notification Text

**Files:**
- Modify: `backend/routes/admin.js:935-955`

- [ ] **Step 1: Update verification approval message**

Replace:
```javascript
'Your farmer account has been verified. You now have access to all features including unlimited products, priority approval, custom product name requests, and advanced analytics.'
```

With:
```javascript
'Your account is verified. You can now list up to 10 products and access basic seller tools. Upgrade to Premium for unlimited products, priority approval, custom names, and advanced analytics.'
```

- [ ] **Step 2: Update analytics_upgrade notification**

Replace:
```javascript
'Your account is now verified! You have access to advanced analytics including charts, trends, and insights.'
```

With:
```javascript
'Your account is verified! Basic seller tools are now available. Upgrade to Premium for advanced analytics.'
```

- [ ] **Step 3: Add subscription approval notification**

In the subscription approve endpoint (`admin.js`), the notification already says:
`Your ${months}-month Premium subscription has been approved and activated.`

Update to:
```javascript
`Your Premium subscription is active! You now have unlimited products, priority approval, custom product names, and advanced analytics.`
```

- [ ] **Step 4: Verify `broadcastEvent` is available**

Ensure `broadcastEvent` is defined/imported at the top of `backend/routes/admin.js` (it should already be there from existing SSE code). If missing:

```javascript
const { broadcastEvent } = require('../utils/events'); // or wherever it lives
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat: update admin notification text for tiered benefits"
```

---

### Task 8: Cron Script & Render Config

**Files:**
- Create: `backend/scripts/expire_subscriptions.js`
- Modify: `render.yaml` (or your deployment cron config)

- [ ] **Step 1: Create expiry script with correct dotenv path**

```javascript
const { Pool } = require('pg');
const path = require('path');

// Load .env from backend directory regardless of script location
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function expireSubscriptions() {
    try {
        const result = await pool.query(
            `UPDATE farmer_subscriptions
             SET status = 'expired', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP`
        );
        console.log(`Expired ${result.rowCount} subscription(s)`);
        // Notify expired farmers
        if (result.rowCount > 0) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
                 SELECT f.user_id, 'subscription_expired', 'Premium Subscription Expired',
                    'Your Premium subscription has expired. Renew now to restore unlimited products and advanced features.',
                    false, CURRENT_TIMESTAMP
                 FROM farmer_subscriptions s
                 JOIN farmers f ON f.id = s.farmer_id
                 WHERE s.status = 'expired'
                 AND s.updated_at > CURRENT_TIMESTAMP - interval '2 minutes'`
            );
        }
    } catch (err) {
        console.error('Expiry error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

expireSubscriptions();
```

- [ ] **Step 2: Add Render cron job**

In `render.yaml`, add under `services`:

```yaml
  - type: cron
    name: expire-subscriptions
    runtime: node
    schedule: "0 0 * * *"
    buildCommand: npm install
    startCommand: node backend/scripts/expire_subscriptions.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: agricatch-db
          property: connectionString
```

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/expire_subscriptions.js render.yaml
git commit -m "feat: add daily subscription expiry cron with notifications"
```
