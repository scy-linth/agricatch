-- Resize users name/shop columns to 40 characters and widen full_name to fit the combined names.
-- Run this against existing databases that were created with the older 50/100-char widths.

-- Truncate existing values that exceed the new limit before altering columns
UPDATE users
SET
    shop_name = LEFT(shop_name, 40),
    first_name = LEFT(first_name, 40),
    middle_name = LEFT(middle_name, 40),
    last_name = LEFT(last_name, 40);

-- Resize columns to the new 40-character limit
ALTER TABLE users
ALTER COLUMN shop_name TYPE VARCHAR(40),
ALTER COLUMN first_name TYPE VARCHAR(40),
ALTER COLUMN middle_name TYPE VARCHAR(40),
ALTER COLUMN last_name TYPE VARCHAR(40);

-- Widen full_name so it can hold the combined first + middle + last names (up to 130 chars)
ALTER TABLE users
ALTER COLUMN full_name TYPE VARCHAR(130);
