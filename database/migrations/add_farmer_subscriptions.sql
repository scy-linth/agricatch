-- Farmer subscription tiers: free (default) vs premium
-- Includes payment_accounts table for multiple GCash/bank accounts

-- Step 1: Create payment_accounts table first (referenced by farmer_subscriptions)
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

-- Step 2: Create farmer_subscriptions table
-- Renewal stacks on top of existing expiry via GREATEST logic in approve endpoint
-- Note: farmer_id references users table (users.id is integer, not uuid)
CREATE TABLE IF NOT EXISTS farmer_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id integer REFERENCES users(id) ON DELETE CASCADE,
    tier text NOT NULL CHECK (tier IN ('free', 'premium')),
    status text NOT NULL CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
    plan_duration_months integer NOT NULL CHECK (plan_duration_months IN (1, 3, 6)),
    payment_proof_url text,
    payment_account_id uuid REFERENCES payment_accounts(id) ON DELETE SET NULL,
    payment_method text,
    amount_paid numeric(10,2),
    approved_by integer REFERENCES users(id),
    approved_at timestamptz,
    starts_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_farmer_subscriptions_farmer_id ON farmer_subscriptions(farmer_id);
CREATE INDEX idx_farmer_subscriptions_status ON farmer_subscriptions(status);

-- Step 3: Seed platform_settings keys for subscription pricing
-- GCash details now live in payment_accounts table
INSERT INTO platform_settings (key, value) VALUES
    ('premium_monthly_price', '299'),
    ('premium_3month_discount_pct', '10'),
    ('premium_6month_discount_pct', '20')
ON CONFLICT (key) DO NOTHING;

-- Step 4: Backfill existing farmers (users with role='farmer') with free tier entries
DO $$
BEGIN
    INSERT INTO farmer_subscriptions (farmer_id, tier, status, plan_duration_months, starts_at, expires_at)
    SELECT u.id, 'free', 'active', 1, CURRENT_TIMESTAMP, '2099-12-31'::timestamptz
    FROM users u
    WHERE u.role = 'farmer'
    AND NOT EXISTS (
        SELECT 1 FROM farmer_subscriptions fs WHERE fs.farmer_id = u.id
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill failed (might be due to missing role column): %', SQLERRM;
END $$;
