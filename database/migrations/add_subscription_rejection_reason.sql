-- Add rejection_reason column to farmer_subscriptions table
-- This stores the reason provided by admin when rejecting a subscription

ALTER TABLE farmer_subscriptions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN farmer_subscriptions.rejection_reason IS 'Reason provided by admin when rejecting a subscription';
