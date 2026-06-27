-- Add 'harvested' status to products status column for Harvest lifecycle implementation
-- This status is used when a Pre-order product is harvested but the farmer chooses NOT to make it available

-- Update the status column to allow 'harvested' value
-- Note: This is a text column, so no ALTER TYPE is needed - just ensure the application handles this value

-- Add a comment to document the purpose
COMMENT ON COLUMN products.status IS 'Product status: pending, approved, rejected, harvested. Harvested status indicates a Pre-order product that has been harvested but is not available for selling (historical record only).';
