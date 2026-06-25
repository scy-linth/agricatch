ALTER TABLE product_name_catalog
ADD COLUMN IF NOT EXISTS default_unit VARCHAR(20) DEFAULT 'kg';
