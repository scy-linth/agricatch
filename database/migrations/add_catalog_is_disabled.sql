ALTER TABLE product_name_catalog
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;
