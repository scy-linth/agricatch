# Farmer Subscription Tier System Design

## Overview
Add free and premium subscription tiers for farmers. Cash-only payment via offline GCash → upload receipt proof → admin approves/rejects. Premium price and discount rates adjustable via superadmin settings. Renewal/extension allowed anytime—new duration stacks on top of existing expiry.

## Tier Matrix (Option A: Verification is a hard gate to selling)

| Feature | Unverified Free | Verified Free | Premium |
|---------|-----------------|---------------|---------|
| **Can sell products** | **No — blocked at creation** | **Yes — max 10** | **Yes — unlimited** |
| Custom product names | No | No | Yes |
| Product listing limit | 0 | 10 | Unlimited |
| Search ranking | Lowest | Medium (`is_verified`) | **Highest (`active premium`)** |
| Product approval queue | N/A | Standard | **Priority** |
| Sales analytics | None | **Basic KPI numbers only** | **Full charts + trends + insights** |
| Featured/priority badge | None | "Verified" checkmark | **"Premium Partner" gem** |
| Buyer chat | No | Yes | Yes + badge |
| Receipt upload for custom names | N/A | N/A | Premium request flow |

## Benefit Enforcement Points (Exact Code Locations)

### 1. Product Creation — `backend/routes/products.js:985-1022`

**Current:** Unverified farmers can list up to 10 products.
**New:** Unverified = fully blocked. Free verified = 10 max. Premium = unlimited.

```javascript
const tier = await getFarmerTier(decoded.id);
const isVerified = userResult.rows[0].is_verified;

if (!isVerified) {
  return res.status(403).json({ 
    message: 'Unverified farmers cannot list products. Please verify your account first.' 
  });
}

if (tier === 'free') {
  const count = await getFarmerProductCount(decoded.id);
  if (count >= 10) {
    return res.status(403).json({ 
      message: 'Free tier limit: 10 products max. Upgrade to Premium for unlimited listings.' 
    });
  }
}
```

### 2. Search Ranking — `backend/routes/products.js:419-426`

**Current:** All sorts prepend `COALESCE(u.is_verified, false) DESC`.
**New:** Add `farmer_subscriptions` JOIN and tier-weighted sort:

```sql
COALESCE(
  CASE 
    WHEN s.status = 'active' AND s.expires_at > now() THEN 2  -- Premium
    WHEN u.is_verified = true THEN 1                          -- Verified Free
    ELSE 0
  END, 0
) DESC,
```

### 3. Custom Product Names — `backend/routes/products.js:255-260`

**Current:** `!isVerified` → block.
**New:** Premium only.

```javascript
const tier = await getFarmerTier(decoded.id);
if (tier !== 'premium') {
  return res.status(403).json({ message: 'Custom product names are a Premium feature.' });
}
```

### 4. Analytics Dashboard — `frontend/js/farmer.js:3641-3792`

**Current:** `!isVerified` → hide charts, show "verified farmers only" message.
**New:** Three-tier check:

```javascript
const tier = this.subscriptionData?.status === 'active' ? 'premium' : 
             (isVerified ? 'free' : 'unverified');

if (tier === 'unverified') {
  // No analytics, show "verify your account" banner
} else if (tier === 'free') {
  // Basic KPI cards only, hide charts
  this.renderBasicMetricsOnly();
} else {
  // Premium = full charts + insights
  this.loadFarmerReportsChart(...);
  this.renderOverviewCharts(...);
}
```

### 5. Product Limit Warning — `frontend/js/farmer.js:3540-3556`

**Current:** Warning at 8/10 for unverified farmers.
**New:** Warning at 8/10 for **free verified** farmers.

```javascript
if (tier === 'free') {
  const count = this.myProductsCache.length;
  if (count >= 8) {
    // "You have X/10 products. Upgrade to Premium for unlimited."
  }
}
```

### 6. Unverified Banners — `frontend/js/farmer.js:6616-6620` & `6812-6817`

**Current:** "Submit verification request to unlock unlimited products and advanced analytics."
**New:** "Submit verification request to start selling. Upgrade to Premium for unlimited products and advanced analytics."

### 7. Admin Notification Text — `backend/routes/admin.js:935-955`

**Current:** "You now have access to all features including unlimited products, priority approval, custom product name requests, and advanced analytics."
**New (verification):** "Your account is verified. You can now list up to 10 products and access basic seller tools."
**New (premium approval):** "Your Premium subscription is active. You now have unlimited products, priority approval, custom product names, and advanced analytics."

## Database Changes

### `farmer_subscriptions` (new table)
```sql
CREATE TABLE farmer_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id uuid REFERENCES farmers(id) ON DELETE CASCADE,
    tier text NOT NULL CHECK (tier IN ('free','premium')),
    status text NOT NULL CHECK (status IN ('pending','active','expired','rejected')),
    plan_duration_months integer NOT NULL CHECK (plan_duration_months IN (1,3,6)),
    payment_proof_url text,
    payment_method text,
    amount_paid numeric(10,2),
    approved_by uuid REFERENCES users(id),
    approved_at timestamptz,
    starts_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

### `platform_settings` (existing table, new keys)
Superadmin-editable keys (seeded with defaults):
- `premium_monthly_price` → "299"
- `premium_3month_discount_pct` → "10"
- `premium_6month_discount_pct` → "20"

### `payment_accounts` (new table) — Multiple GCash/Bank accounts
Superadmin can add multiple payment accounts. Farmers choose which one to pay when upgrading.

```sql
CREATE TABLE payment_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,           -- e.g. "AgriCatch Inc."
    account_number text NOT NULL, -- e.g. "0917 123 4567"
    type text NOT NULL CHECK (type IN ('gcash', 'bank_transfer')),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

## Pricing Formulas

| Duration | Formula | Example @ ₱299/mo |
|----------|---------|-------------------|
| 1 month | `price × 1` | ₱299 |
| 3 months | `price × 3 × (1 - discount_3m/100)` | ₱807 (10% off) |
| 6 months | `price × 6 × (1 - discount_6m/100)` | ₱1,435 (20% off) |

## Renewal / Extension Logic

When admin approves a subscription request:
```sql
-- If active: add to existing expiry
-- If expired: start from now
UPDATE farmer_subscriptions
SET status = 'active',
    starts_at = CASE WHEN status = 'active' THEN starts_at ELSE now() END,
    expires_at = GREATEST(expires_at, now()) + interval 'N months',
    approved_by = $adminId,
    approved_at = now()
WHERE id = $id;
```

Example:
- Current expires Dec 31, 2026. Adds 6 months → new expiry June 30, 2027.
- Current expired Dec 31, 2025. `GREATEST(Dec 31 2025, now()) = now()` → starts from today.

## Backend Changes

### `backend/routes/subscriptions.js` (new)
- `GET /api/subscriptions/settings` — public, returns prices + active payment accounts
- `GET /api/farmers/me/subscription` — auth, returns current tier, expiry, pending status
- `POST /api/farmers/me/subscription/request` — auth + upload, creates pending row with `plan_duration_months` and selected `payment_account_id`

### `backend/routes/admin.js` (modify)
- `GET /api/admin/subscriptions?status=pending|active|expired|rejected` — admin/super_admin
- `PUT /api/admin/subscriptions/:id/approve` — admin/super_admin, uses GREATEST logic
- `PUT /api/admin/subscriptions/:id/reject` — admin/super_admin

### `backend/routes/payment-accounts.js` (new) — Admin only
- `GET /api/admin/payment-accounts` — super_admin only, list all accounts
- `POST /api/admin/payment-accounts` — super_admin only, create account
- `PUT /api/admin/payment-accounts/:id` — super_admin only, update account
- `DELETE /api/admin/payment-accounts/:id` — super_admin only, delete account

### `backend/routes/products.js` (modify)
- Before insert: check farmer's active subscription tier + product count
- Free tier: max 10 products
- Featured tag: only if active premium

### `backend/scripts/expire_subscriptions.js` (new)
- Daily cron: `UPDATE farmer_subscriptions SET status='expired' WHERE expires_at < now() AND status='active'`

## Frontend Changes

### `frontend/farmer.html`
- New **Subscription** card in sidebar/dashboard
- If Free: "Go Premium" button
- If Active Premium: shows expiry date, "Extend Subscription" button, "Premium Partner" badge
- If Pending: "Payment under review" badge
- If Expired: "Premium expired — renew to restore features"

### Upgrade/Extend Modal
- Duration radio: 1 month / 3 months / 6 months
- Computed total amount (fetched from settings)
- **Payment account dropdown**: lists all active `payment_accounts` (name + number + type)
- Farmer selects which GCash/Bank account to send payment to
- File input for receipt screenshot
- If extending: shows "Current expiry: Dec 31, 2026 → New expiry: June 30, 2027"

### Premium Badge
Katabi ng `header-verified-icon` (`frontend/farmer.html:494`):
```html
<i id="header-premium-icon" class="bi bi-gem text-warning" style="display:none"
   data-bs-toggle="tooltip" title="Premium Partner"></i>
```

### `frontend/admin.html`
- New **Subscription Requests** section
- Table: farmer name, date, duration, amount, proof thumbnail, Approve/Reject
- **Payment Accounts card** (super_admin only): add/edit/delete multiple GCash/Bank accounts
- Settings card (super_admin only): price, 3m/6m discount %

## User Flow

```
Farmer → Click "Go Premium" or "Extend Subscription"
    ↓
Modal fetches settings → shows active payment accounts (GCash/Bank) + computed price
    ↓
Select payment account from dropdown (e.g. GCash Account 1, GCash Account 2)
    ↓
Select duration (1/3/6 months) → see computed total + new expiry preview
    ↓
Pay offline to selected account → Upload receipt screenshot
    ↓
POST /api/farmers/me/subscription/request (pending, with selected payment_account_id)
    ↓
Admin sees request → View proof → Approve / Reject
    ↓
Approve: GREATEST(existing_expiry, now()) + N months
    ↓
Farmer sees updated expiry + premium badge
    ↓
Nightly cron: expired subscriptions flipped to 'expired'
```

## Testing

- Migration smoke test
- Settings API read/update
- Request/approve/reject workflow
- Renewal: active + extension computes correct new expiry
- Renewal: expired + extension starts from now
- Product limit enforcement (free=10, premium=unlimited)
- Expiry cron script
- Frontend badge rendering + tooltip
- Frontend computed price + expiry preview
