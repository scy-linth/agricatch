-- Add shop_name, first_name, middle_name, last_name columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS shop_name VARCHAR(40),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(40),
ADD COLUMN IF NOT EXISTS middle_name VARCHAR(40),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(40);

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
        WHEN (length(full_name) - length(replace(full_name, ' ', ''))) >= 2 THEN
            substring(full_name from position(' ' IN full_name) + 1 for length(full_name) - position(' ' IN full_name) - position(' ' IN reverse(full_name)) - 1)
        ELSE NULL
    END,
    shop_name = CASE
        WHEN role = 'farmer' THEN full_name
        ELSE NULL
    END
WHERE full_name IS NOT NULL;

-- Create index on shop_name for farmers
CREATE INDEX IF NOT EXISTS idx_users_shop_name ON users(shop_name) WHERE role = 'farmer';
