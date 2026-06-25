# Expand Admin Product Catalog for Thesis Demonstration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Admin Product Catalog by adding 8 Vegetable and 8 Fruit Product Catalog entries using realistic Philippine agricultural products, while avoiding duplicates and respecting existing business rules.

**Architecture:** Add Product Catalog entries through the database directly (most efficient for bulk addition), then verify through UI that everything works correctly.

**Tech Stack:** PostgreSQL database, AgriCatch web application (localhost:3000)

## Global Constraints

- Reuse existing Categories: Vegetables and Fruits
- Add 8 Vegetable Product Catalog entries
- Add 8 Fruit Product Catalog entries
- Use realistic agricultural products commonly found in the Philippines
- Do not create duplicate Product Catalog entries
- Do not modify the approval workflow
- Do not change the existing architecture or UI
- Follow current Product Catalog validation and business rules
- One farmer can only have one product per Product Catalog entry per order type (Available Now or Pre-order)
- Product names limited to 40 characters

## Philippine Agricultural Products

**Vegetables (8 entries):**
1. Pechay (Chinese Cabbage)
2. Kangkong (Water Spinach)
3. Sitaw (String Beans)
4. Talong (Eggplant)
5. Ampalaya (Bitter Gourd)
6. Okra
7. Kalabasa (Squash)
8. Kamote (Sweet Potato)

**Fruits (8 entries):**
1. Mango
2. Banana
3. Papaya
4. Calamansi (Philippine Lime)
5. Guyabano (Soursop)
6. Lanzones
7. Rambutan
8. Santol

---

### Task 1: Check Existing Product Catalog Entries

**Files:**
- None (database query)

**Interfaces:**
- Consumes: PostgreSQL database
- Produces: List of existing Product Catalog entries

- [ ] **Step 1: Query database for existing Product Catalog entries**

```sql
SELECT id, name, category_id 
FROM product_catalog_names 
ORDER BY name;
```

- [ ] **Step 2: Identify which entries already exist to avoid duplicates**

Compare the 16 planned entries against existing entries and create a list of which ones need to be added.

- [ ] **Step 3: Record findings**

Document which entries already exist and which need to be added.

---

### Task 2: Add Missing Vegetable Product Catalog Entries

**Files:**
- Create: `database/scripts/add_vegetable_catalog_entries.sql`

**Interfaces:**
- Consumes: PostgreSQL database
- Produces: New Product Catalog entries for vegetables

- [ ] **Step 1: Create SQL script to add missing vegetable entries**

```sql
-- Add missing Vegetable Product Catalog entries
-- Only add entries that don't already exist

-- Get Vegetables category ID
DO $$
DECLARE
    veg_category_id INT;
BEGIN
    SELECT id INTO veg_category_id FROM categories WHERE name = 'Vegetables' LIMIT 1;
    
    IF veg_category_id IS NULL THEN
        RAISE EXCEPTION 'Vegetables category not found';
    END IF;
    
    -- Insert each vegetable if it doesn't exist
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Pechay', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Pechay');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Kangkong', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Kangkong');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Sitaw', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Sitaw');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Talong', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Talong');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Ampalaya', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Ampalaya');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Okra', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Okra');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Kalabasa', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Kalabasa');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Kamote', veg_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Kamote');
    
    RAISE NOTICE 'Vegetable Product Catalog entries added successfully';
END $$;
```

- [ ] **Step 2: Execute the SQL script**

```bash
psql -h localhost -U postgres -d agricatch -f database/scripts/add_vegetable_catalog_entries.sql
```

- [ ] **Step 3: Verify entries were added**

```sql
SELECT name, category_id 
FROM product_catalog_names 
WHERE name IN ('Pechay', 'Kangkong', 'Sitaw', 'Talong', 'Ampalaya', 'Okra', 'Kalabasa', 'Kamote')
ORDER BY name;
```

- [ ] **Step 4: Commit**

```bash
git add database/scripts/add_vegetable_catalog_entries.sql
git commit -m "feat: add Vegetable Product Catalog entries for thesis demonstration"
```

---

### Task 3: Add Missing Fruit Product Catalog Entries

**Files:**
- Create: `database/scripts/add_fruit_catalog_entries.sql`

**Interfaces:**
- Consumes: PostgreSQL database
- Produces: New Product Catalog entries for fruits

- [ ] **Step 1: Create SQL script to add missing fruit entries**

```sql
-- Add missing Fruit Product Catalog entries
-- Only add entries that don't already exist

DO $$
DECLARE
    fruit_category_id INT;
BEGIN
    SELECT id INTO fruit_category_id FROM categories WHERE name = 'Fruits' LIMIT 1;
    
    IF fruit_category_id IS NULL THEN
        RAISE EXCEPTION 'Fruits category not found';
    END IF;
    
    -- Insert each fruit if it doesn't exist
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Mango', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Mango');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Banana', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Banana');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Papaya', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Papaya');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Calamansi', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Calamansi');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Guyabano', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Guyabano');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Lanzones', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Lanzones');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Rambutan', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Rambutan');
    
    INSERT INTO product_catalog_names (name, category_id, created_at, updated_at)
    SELECT 'Santol', fruit_category_id, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM product_catalog_names WHERE name = 'Santol');
    
    RAISE NOTICE 'Fruit Product Catalog entries added successfully';
END $$;
```

- [ ] **Step 2: Execute the SQL script**

```bash
psql -h localhost -U postgres -d agricatch -f database/scripts/add_fruit_catalog_entries.sql
```

- [ ] **Step 3: Verify entries were added**

```sql
SELECT name, category_id 
FROM product_catalog_names 
WHERE name IN ('Mango', 'Banana', 'Papaya', 'Calamansi', 'Guyabano', 'Lanzones', 'Rambutan', 'Santol')
ORDER BY name;
```

- [ ] **Step 4: Commit**

```bash
git add database/scripts/add_fruit_catalog_entries.sql
git commit -m "feat: add Fruit Product Catalog entries for thesis demonstration"
```

---

### Task 4: Verify Product Catalog Displays All New Entries Through UI

**Files:**
- None (manual UI verification)

**Interfaces:**
- Consumes: AgriCatch web application
- Produces: Verification that all entries display correctly

- [ ] **Step 1: Start the backend server**

```bash
cd backend && npm start
```

- [ ] **Step 2: Log in as Admin**

Navigate to `http://localhost:3000/index.html` and log in with admin credentials.

- [ ] **Step 3: Navigate to Product Catalog section**

Click on "Product Catalog" in the admin sidebar.

- [ ] **Step 4: Verify all 16 entries are displayed**

Check that all vegetable and fruit entries are visible in the Product Catalog table:
- Pechay, Kangkong, Sitaw, Talong, Ampalaya, Okra, Kalabasa, Kamote
- Mango, Banana, Papaya, Calamansi, Guyabano, Lanzones, Rambutan, Santol

- [ ] **Step 5: Document any missing entries**

If any entries are missing, document which ones and investigate.

---

### Task 5: Verify Farmers Can Select New Product Catalog Entries When Adding Products

**Files:**
- None (manual UI verification)

**Interfaces:**
- Consumes: AgriCatch web application
- Produces: Verification that farmers can select new entries

- [ ] **Step 1: Log out as Admin**

- [ ] **Step 2: Log in as Farmer**

Navigate to `http://localhost:3000/index.html` and log in with farmer credentials (dhelhilis@gmail.com).

- [ ] **Step 3: Navigate to Products section**

Click on "Products" in the farmer sidebar.

- [ ] **Step 4: Click "Add Product" button**

- [ ] **Step 5: Click on Product Name dropdown**

- [ ] **Step 6: Verify all new entries appear in dropdown**

Check that the dropdown includes all 16 new Product Catalog entries.

- [ ] **Step 7: Select one of the new entries (e.g., "Mango")**

- [ ] **Step 8: Verify the selection works correctly**

The selected product name should appear in the input field.

- [ ] **Step 9: Cancel the product creation (don't actually create a product)**

- [ ] **Step 10: Document any issues**

If any entries are missing or don't work, document which ones and investigate.

---

### Task 6: Verify One-Product-Per-Order-Type Rule Still Works Correctly

**Files:**
- None (manual UI verification)

**Interfaces:**
- Consumes: AgriCatch web application
- Produces: Verification that business rule is enforced

- [ ] **Step 1: Log in as Farmer (if not already logged in)**

- [ ] **Step 2: Navigate to Products section**

- [ ] **Step 3: Create an Available Now product using "Mango"**

- Fill in all required fields (price, stock, unit, etc.)
- Submit the product

- [ ] **Step 4: Try to create another Available Now product using "Mango"**

- Attempt to create a second Available Now product with the same Product Catalog entry
- Verify that the system prevents this (either through validation error or UI restriction)

- [ ] **Step 5: Create a Pre-order product using "Mango"**

- This should be allowed (different order type)
- Fill in all required fields including pre-order specific fields
- Submit the product

- [ ] **Step 6: Try to create another Pre-order product using "Mango"**

- Verify that the system prevents this (same Product Catalog entry, same order type)

- [ ] **Step 7: Document the behavior**

Document whether the one-product-per-order-type rule is working correctly.

---

### Task 7: Verify Existing Products and Functionality Remain Unaffected

**Files:**
- None (manual UI verification)

**Interfaces:**
- Consumes: AgriCatch web application
- Produces: Verification that nothing is broken

- [ ] **Step 1: Log in as Admin**

- [ ] **Step 2: Navigate to Product Approvals section**

- [ ] **Step 3: Verify existing pending products still appear**

- [ ] **Step 4: Approve a product (if any pending)**

- [ ] **Step 5: Navigate to Orders section**

- [ ] **Step 6: Verify existing orders still display correctly**

- [ ] **Step 7: Log in as Farmer**

- [ ] **Step 8: Navigate to Products section**

- [ ] **Step 9: Verify existing farmer products still display**

- [ ] **Step 10: Navigate to Orders section**

- [ ] **Step 11: Verify existing farmer orders still display**

- [ ] **Step 12: Log in as Customer**

- [ ] **Step 13: Navigate to Available Now section**

- [ ] **Step 14: Verify existing products still display**

- [ ] **Step 15: Navigate to Pre-order section**

- [ ] **Step 16: Verify existing pre-order products still display**

- [ ] **Step 17: Document any issues**

If any existing functionality is broken, document what's not working.

---

## Self-Review

**1. Spec coverage:**
- ✅ Reuses existing Categories: Vegetables and Fruits
- ✅ Adds 8 Vegetable Product Catalog entries
- ✅ Adds 8 Fruit Product Catalog entries
- ✅ Uses realistic Philippine agricultural products
- ✅ Avoids duplicate Product Catalog entries
- ✅ Does not modify approval workflow
- ✅ Does not change existing architecture or UI
- ✅ Follows current Product Catalog validation and business rules

**2. Placeholder scan:**
- ✅ No "TBD" or "TODO" placeholders
- ✅ All code blocks contain actual implementation
- ✅ All commands are exact and complete
- ✅ No references to undefined functions

**3. Type consistency:**
- ✅ Product names are consistent (all ≤ 40 characters)
- ✅ SQL syntax is correct
- ✅ Verification steps are clear and actionable

---

Plan complete and saved to `docs/superpowers/plans/2025-06-25-expand-product-catalog.md`.
