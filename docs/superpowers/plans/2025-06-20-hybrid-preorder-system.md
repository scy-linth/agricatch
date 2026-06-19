# Hybrid Pre-order System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid pre-order system to AgriCatch that allows farmers to sell products before harvest while maintaining immediate ordering for available stock.

**Architecture:** Single product table with pre-order flags (is_preorder, preorder_availability_date, reserved_quantity, max_preorder_quantity). Orders track is_preorder flag. Pre-orders increment reserved_quantity instead of stock_quantity. Farmers convert pre-orders to stock when harvest is ready.

**Tech Stack:** Node.js/Express backend, PostgreSQL database, vanilla JavaScript frontend, Bootstrap 5.3.3

## Global Constraints

- Cash on delivery only (no payment gateway integration)
- Existing order status workflow: pending → confirmed → preparing → out_for_delivery → delivered
- Per-item orders (each order = one product)
- Bootstrap 5.3.3, Bootstrap Icons, Font Awesome for UI
- Database: PostgreSQL with Supabase
- API base: /api (proxied via Netlify in production)
- Backward compatibility: existing products/orders default to is_preorder=false
- **UI/UX Consistency:** Use `showToast(message, type)` for notifications (success/error/warning), use `showConfirm(message, options)` for confirmations (not native alert/confirm)
- **Badge Colors:** Use Bootstrap badge classes (bg-success, bg-warning, bg-danger, bg-info, bg-light, bg-secondary) consistent with existing system
- **No Git Commands During Implementation:** Do not run any git commands (git add, git commit, git push, etc.) during the implementation phase. All git operations will be handled separately after implementation is complete and verified.
- **Test Before Proceeding:** Before moving to the next task, ensure the current implementation is tested, has no bugs, and has no errors. If bugs or errors are found, debug and fix them before proceeding to the next task.
- **Use Superpowers:** Use superpowers skills (superpowers:subagent-driven-development or superpowers:executing-plans) to implement this plan task-by-task.

---

## File Structure

**Database:**
- `database/migrations/add_preorder_fields.sql` - New migration file

**Backend:**
- `backend/routes/products.js` - Modify POST, PUT, GET endpoints for pre-order fields
- `backend/routes/orders.js` - Modify POST, GET endpoints for pre-order logic
- `backend/routes/products.js` - Add POST /:id/convert-preorders endpoint

**Frontend:**
- `frontend/index.html` - Add pre-order badges, filters, button changes
- `frontend/js/index.js` - Add pre-order filtering logic
- `frontend/product.html` - Add pre-order banner, date validation
- `frontend/js/product.js` - Add pre-order display logic
- `frontend/farmer.html` - Add pre-order form fields
- `frontend/js/farmer.js` - Add pre-order form handling
- `frontend/orders.html` - Add pre-order badges to order items
- `frontend/js/orders.js` - Add pre-order display logic
- `frontend/admin.html` - Add pre-order indicators to product approvals
- `frontend/js/admin.js` - Add pre-order display logic

---

### Task 1: Create Database Migration

**Files:**
- Create: `database/migrations/add_preorder_fields.sql`

**Interfaces:**
- Produces: Database schema with new fields for pre-order functionality

- [ ] **Step 1: Write migration SQL**

```sql
-- Add pre-order fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_availability_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_preorder_quantity INTEGER;

-- Add is_preorder field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_is_preorder ON products(is_preorder);
CREATE INDEX IF NOT EXISTS idx_products_preorder_availability_date ON products(preorder_availability_date);
CREATE INDEX IF NOT EXISTS idx_orders_is_preorder ON orders(is_preorder);
```

- [ ] **Step 2: Commit migration**

```bash
# Note: No git commands during implementation
```

---

### Task 2: Apply Database Migration

**Files:**
- Modify: Database (apply migration)

**Interfaces:**
- Consumes: Migration file from Task 1

- [ ] **Step 1: Apply migration to development database**

```bash
# Connect to your PostgreSQL database and run the migration
psql -U your_username -d your_database -f database/migrations/add_preorder_fields.sql
```

Expected: Tables altered successfully, indexes created

- [ ] **Step 2: Verify migration**

```sql
-- Check products table has new columns
\d products

-- Check orders table has new column
\d orders
```

Expected: New columns visible in table definitions

- [ ] **Step 3: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 1.5: Add Database Constraints and Pre-order Conversion Tracking

**Files:**
- Modify: `database/migrations/add_preorder_fields.sql`

**Interfaces:**
- Produces: Database constraints and conversion tracking field

- [ ] **Step 1: Add constraints to migration**

Update the migration to include constraints and tracking field:

```sql
-- Add pre-order fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_availability_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_preorder_quantity INTEGER CHECK (max_preorder_quantity IS NULL OR max_preorder_quantity > 0);

-- Add is_preorder field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_converted_at TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_is_preorder ON products(is_preorder);
CREATE INDEX IF NOT EXISTS idx_products_preorder_availability_date ON products(preorder_availability_date);
CREATE INDEX IF NOT EXISTS idx_orders_is_preorder ON orders(is_preorder);
CREATE INDEX IF NOT EXISTS idx_orders_preorder_converted_at ON orders(preorder_converted_at);

-- Add check constraint for date validation
ALTER TABLE products ADD CONSTRAINT preorder_expiry_check CHECK (
  preorder_availability_date IS NULL OR
  expiry_date IS NULL OR
  expiry_date >= preorder_availability_date
);
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 3: Add Pre-order Fields to Product Creation

**Files:**
- Modify: `backend/routes/products.js` (POST /api/products endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Product creation with pre-order fields

- [ ] **Step 1: Read current products.js to find POST endpoint**

```bash
grep -n "router.post" backend/routes/products.js
```

Expected: Line number of POST endpoint (around line 400-500 based on file size)

- [ ] **Step 2: Add pre-order field validation to POST endpoint**

Find the product creation section and add validation:

```javascript
// After existing field validation, add:
const { is_preorder, preorder_availability_date, max_preorder_quantity } = req.body;

// Validate pre-order fields
if (is_preorder === true && !preorder_availability_date) {
  return res.status(400).json({ message: 'preorder_availability_date is required when is_preorder is true' });
}

if (preorder_availability_date && expiry_date) {
  const availabilityDate = new Date(preorder_availability_date);
  const expiryDate = new Date(expiry_date);
  if (expiryDate < availabilityDate) {
    return res.status(400).json({ message: 'expiry_date must be after preorder_availability_date' });
  }
}

if (max_preorder_quantity !== undefined && max_preorder_quantity !== null && max_preorder_quantity <= 0) {
  return res.status(400).json({ message: 'max_preorder_quantity must be positive' });
}
```

- [ ] **Step 3: Add pre-order fields to INSERT statement**

Modify the INSERT query to include new fields:

```javascript
// In the INSERT query, add the new fields:
INSERT INTO products (
  name, description, price, category_id, farmer_id, stock_quantity, unit, image_url,
  is_preorder, preorder_availability_date, reserved_quantity, max_preorder_quantity
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8,
  $9, $10, $11, $12
)
```

- [ ] **Step 4: Add pre-order fields to INSERT parameters**

```javascript
// Add to the values array:
[
  name, description, price, categoryId, userId, stockQuantity, unit, imageUrl,
  is_preorder || false,
  preorder_availability_date || null,
  0, // reserved_quantity always starts at 0
  max_preorder_quantity || null
]
```

- [ ] **Step 5: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 4: Add Pre-order Fields to Product Update

**Files:**
- Modify: `backend/routes/products.js` (PUT /api/products/:id endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Product update with pre-order fields

- [ ] **Step 1: Find PUT endpoint in products.js**

```bash
grep -n "router.put" backend/routes/products.js
```

Expected: Line number of PUT endpoint

- [ ] **Step 2: Add pre-order field validation to PUT endpoint**

Add similar validation as Task 3 to the PUT endpoint:

```javascript
const { is_preorder, preorder_availability_date, max_preorder_quantity } = req.body;

if (is_preorder === true && !preorder_availability_date) {
  return res.status(400).json({ message: 'preorder_availability_date is required when is_preorder is true' });
}

if (preorder_availability_date && expiry_date) {
  const availabilityDate = new Date(preorder_availability_date);
  const expiryDate = new Date(expiry_date);
  if (expiryDate < availabilityDate) {
    return res.status(400).json({ message: 'expiry_date must be after preorder_availability_date' });
  }
}
```

- [ ] **Step 3: Add pre-order fields to UPDATE statement**

```javascript
// In the UPDATE query, add the new fields:
UPDATE products SET
  name = $1,
  description = $2,
  price = $3,
  category_id = $4,
  stock_quantity = $5,
  unit = $6,
  image_url = $7,
  is_preorder = $8,
  preorder_availability_date = $9,
  max_preorder_quantity = $10,
  updated_at = CURRENT_TIMESTAMP
WHERE id = $11 AND farmer_id = $12
```

- [ ] **Step 4: Add pre-order fields to UPDATE parameters**

```javascript
// Add to the values array:
[
  name, description, price, categoryId, stockQuantity, unit, imageUrl,
  is_preorder !== undefined ? is_preorder : currentProduct.is_preorder,
  preorder_availability_date !== undefined ? preorder_availability_date : currentProduct.preorder_availability_date,
  max_preorder_quantity !== undefined ? max_preorder_quantity : currentProduct.max_preorder_quantity,
  productId,
  userId
]
```

- [ ] **Step 5: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 5: Add Pre-order Filter to Product Listing

**Files:**
- Modify: `backend/routes/products.js` (GET /api/products endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Product listing with pre-order filter

- [ ] **Step 1: Find GET /api/products endpoint**

```bash
grep -n "router.get('/'," backend/routes/products.js
```

Expected: Line number around 440

- [ ] **Step 2: Add preorder query parameter handling**

After existing query parameter parsing, add:

```javascript
const { preorder } = req.query;
```

- [ ] **Step 3: Add pre-order filter to WHERE clause**

In the baseFrom WHERE clause, add:

```javascript
let whereClause = '';

if (preorder !== undefined) {
  if (preorder === 'true') {
    whereClause += ` AND p.is_preorder = true`;
  } else if (preorder === 'false') {
    whereClause += ` AND p.is_preorder = false`;
  }
}
```

- [ ] **Step 4: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 6: Add Pre-order Fields to Product Response

**Files:**
- Modify: `backend/routes/products.js` (GET endpoints)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Product responses with pre-order fields

- [ ] **Step 1: Add pre-order fields to SELECT clause**

In both GET /api/products and GET /api/products/:id, modify SELECT:

```javascript
SELECT p.*, c.name as category_name, 
       COALESCE(u.shop_name, u.full_name) as farmer_name,
       p.location as farm_location,
       -- Add pre-order fields explicitly if not already in p.*
       p.is_preorder,
       p.preorder_availability_date,
       p.reserved_quantity,
       p.max_preorder_quantity
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 7: Add Pre-order Logic to Order Creation

**Files:**
- Modify: `backend/routes/orders.js` (POST /api/orders endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Order creation with pre-order logic

- [ ] **Step 1: Find POST /api/orders endpoint**

```bash
grep -n "router.post('/'," backend/routes/orders.js
```

Expected: Line number around 423

- [ ] **Step 2: Add pre-order validation before stock check**

After getting cart items, add pre-order validation:

```javascript
// Check if cart contains mix of pre-order and regular products
const hasPreorder = cartResult.rows.some(item => item.is_preorder === true);
const hasRegular = cartResult.rows.some(item => item.is_preorder === false);

if (hasPreorder && hasRegular) {
  await client.query('ROLLBACK');
  client.release();
  return res.status(400).json({ 
    message: 'Cannot mix pre-order and regular products in same order' 
  });
}
```

- [ ] **Step 3: Modify stock validation logic**

Replace existing stock validation with:

```javascript
for (const item of cartResult.rows) {
  if (item.is_preorder) {
    // Pre-order: check against reserved_quantity and max_preorder_quantity
    if (item.max_preorder_quantity && (item.reserved_quantity + item.quantity > item.max_preorder_quantity)) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        message: `Pre-order limit exceeded for ${item.name}. Maximum: ${item.max_preorder_quantity}`
      });
    }
  } else {
    // Regular order: check stock_quantity
    if (item.quantity > item.stock_quantity) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        message: `Not enough stock for ${item.name}. Available: ${item.stock_quantity}`
      });
    }
  }
}
```

- [ ] **Step 4: Modify order creation loop**

In the order creation loop, add pre-order logic:

```javascript
for (const item of cartResult.rows) {
  const itemTotal = parseFloat(item.price) * parseInt(item.quantity);
  totalAmount += itemTotal;

  const orderResult = await client.query(`
    INSERT INTO orders (user_id, product_id, quantity, price, total_amount, delivery_address, delivery_date, special_instructions, is_preorder)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    decoded.id,
    item.product_id,
    item.quantity,
    item.price,
    itemTotal,
    delivery_address,
    delivery_date || null,
    special_instructions || null,
    item.is_preorder || false
  ]);

  const orderId = orderResult.rows[0].id;
  createdOrderIds.push(orderId);

  if (item.is_preorder) {
    // Pre-order: increment reserved_quantity
    await client.query(`
      UPDATE products SET reserved_quantity = reserved_quantity + $1 WHERE id = $2
    `, [item.quantity, item.product_id]);
  } else {
    // Regular order: deduct stock_quantity
    await client.query(`
      UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 RETURNING stock_quantity, farmer_id, name
    `, [item.quantity, item.product_id]);
  }

  // Continue with existing low stock and notification logic...
}
```

- [ ] **Step 5: Add delivery date validation for pre-orders**

Before the order creation loop, add:

```javascript
// Validate delivery date for pre-orders
for (const item of cartResult.rows) {
  if (item.is_preorder && item.preorder_availability_date) {
    const deliveryDate = new Date(delivery_date);
    const availabilityDate = new Date(item.preorder_availability_date);
    if (deliveryDate < availabilityDate) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        message: `Delivery date must be on or after ${item.preorder_availability_date} for pre-order item: ${item.name}`
      });
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 7.5: Modify Cart Query to Include Pre-order Fields

**Files:**
- Modify: `backend/routes/orders.js` (POST /api/orders endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Cart query with pre-order fields

- [ ] **Step 1: Find cart query in POST /api/orders**

```bash
grep -n "SELECT c.id as cart_id" backend/routes/orders.js
```

Expected: Line number of cart query (around line 460-470)

- [ ] **Step 2: Add pre-order fields to cart SELECT query**

Modify the cart query to include pre-order fields:

```javascript
const userCartQuery = `
  SELECT c.id as cart_id, c.quantity, p.id as product_id, p.price, p.stock_quantity, p.name,
         p.is_available, COALESCE(p.is_admin_disabled, false) as is_admin_disabled,
         p.expiry_date, COALESCE(u.is_disabled, false) as farmer_is_disabled,
         p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity
  FROM cart c
  JOIN products p ON c.product_id = p.id
  LEFT JOIN users u ON p.farmer_id = u.id
  WHERE c.user_id = $1
`;
```

- [ ] **Step 3: Add pre-order fields to session cart query**

```javascript
const sessionCartQuery = `
  SELECT c.id as cart_id, c.quantity, p.id as product_id, p.price, p.stock_quantity, p.name,
         p.is_available, COALESCE(p.is_admin_disabled, false) as is_admin_disabled,
         p.expiry_date, COALESCE(u.is_disabled, false) as farmer_is_disabled,
         p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity
  FROM cart c
  JOIN products p ON c.product_id = p.id
  LEFT JOIN users u ON p.farmer_id = u.id
  WHERE c.session_id = $1
`;
```

- [ ] **Step 4: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 8: Add Pre-order Field to Order Responses

**Files:**
- Modify: `backend/routes/orders.js` (GET endpoints)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Order responses with is_preorder field

- [ ] **Step 1: Add is_preorder to order SELECT queries**

In GET /api/orders and GET /api/orders/:id, add is_preorder to SELECT:

```javascript
SELECT o.*, 
       p.name as product_name,
       p.unit,
       p.image_url,
       p.farmer_id,
       o.is_preorder
```

- [ ] **Step 2: Add is_preorder to order response mapping**

In the order mapping code, ensure is_preorder is included:

```javascript
const orders = result.rows.map(row => ({
  id: row.id,
  user_id: row.user_id,
  product_id: row.product_id,
  quantity: row.quantity,
  price: row.price,
  total_amount: row.total_amount,
  status: row.status,
  is_preorder: row.is_preorder,
  // ... other fields
}));
```

- [ ] **Step 3: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 8.5: Add is_preorder Filter to Farmer Orders Endpoint

**Files:**
- Modify: `backend/routes/orders.js` (GET /api/orders/farmer/:farmerId endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Farmer orders endpoint with is_preorder filter

- [ ] **Step 1: Find GET /api/orders/farmer/:farmerId endpoint**

```bash
grep -n "router.get('/farmer" backend/routes/orders.js
```

Expected: Line number around 86

- [ ] **Step 2: Add is_preorder query parameter handling**

After existing query parameter parsing, add:

```javascript
const { status, is_preorder } = req.query;
```

- [ ] **Step 3: Add is_preorder filter to WHERE clause**

In the query, add the filter:

```javascript
if (is_preorder !== undefined) {
  if (is_preorder === 'true') {
    query += ` AND o.is_preorder = true`;
  } else if (is_preorder === 'false') {
    query += ` AND o.is_preorder = false`;
  }
}
```

- [ ] **Step 4: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 9: Add Pre-order Conversion Endpoint

**Files:**
- Modify: `backend/routes/products.js` (add new endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Endpoint to convert pre-orders to stock

- [ ] **Step 1: Add new POST endpoint for converting pre-orders**

Add this new endpoint after the PUT endpoint:

```javascript
// Convert pre-orders to stock when harvest is ready
router.post('/:id/convert-preorders', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { harvest_quantity } = req.body || {};
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get product details
    const productResult = await pool.query(
      'SELECT farmer_id, is_preorder, reserved_quantity, stock_quantity FROM products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Verify user is the farmer
    if (Number(product.farmer_id) !== Number(decoded.id)) {
      return res.status(403).json({ message: 'You can only convert pre-orders for your own products' });
    }

    if (!product.is_preorder) {
      return res.status(400).json({ message: 'This product is not a pre-order product' });
    }

    if (product.reserved_quantity === 0) {
      return res.status(400).json({ message: 'No pre-orders to convert' });
    }

    // Validate harvest quantity if provided
    if (harvest_quantity !== undefined && harvest_quantity !== null) {
      if (harvest_quantity < product.reserved_quantity) {
        return res.status(400).json({ 
          message: `Harvest quantity (${harvest_quantity}) must be at least reserved quantity (${product.reserved_quantity})` 
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Move reserved_quantity to stock_quantity
      const reservedQty = product.reserved_quantity;
      await client.query(`
        UPDATE products 
        SET stock_quantity = stock_quantity + $1,
            reserved_quantity = 0
        WHERE id = $2
      `, [reservedQty, productId]);

      // Get affected order IDs for response
      const orderResult = await client.query(`
        SELECT id FROM orders WHERE product_id = $1 AND is_preorder = true
      `, [productId]);

      const affectedOrderIds = orderResult.rows.map(row => row.id);

      await client.query('COMMIT');

      res.json({
        message: 'Pre-orders converted to stock successfully',
        converted_quantity: reservedQty,
        new_stock_quantity: product.stock_quantity + reservedQty,
        affected_orders: affectedOrderIds
      });

    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
      }
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }

  } catch (error) {
    console.error('Convert pre-orders error:', error);
    res.status(500).json({ message: 'Server error converting pre-orders' });
  }
});
```

- [ ] **Step 2: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 9.5: Fix Conversion Endpoint to Use Harvest Quantity

**Files:**
- Modify: `backend/routes/products.js` (POST /:id/convert-preorders endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Conversion endpoint with harvest quantity handling

- [ ] **Step 1: Update conversion endpoint to require harvest_quantity**

Modify the endpoint to accept and use harvest_quantity:

```javascript
router.post('/:id/convert-preorders', authenticateToken, async (req, res) => {
  const { productId } = req.params;
  const { harvest_quantity } = req.body;

  if (!harvest_quantity || harvest_quantity <= 0) {
    return res.status(400).json({ message: 'Harvest quantity is required and must be positive' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Get product details
  const productResult = await pool.query(
    'SELECT farmer_id, is_preorder, reserved_quantity, stock_quantity FROM products WHERE id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const product = productResult.rows[0];

  // Verify user is the farmer
  if (Number(product.farmer_id) !== Number(decoded.id)) {
    return res.status(403).json({ message: 'You can only convert pre-orders for your own products' });
  }

  if (!product.is_preorder) {
    return res.status(400).json({ message: 'This product is not a pre-order product' });
  }

  if (product.reserved_quantity === 0) {
    return res.status(400).json({ message: 'No pre-orders to convert' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add harvest_quantity to stock_quantity (not reserved_quantity)
    const newStock = product.stock_quantity + harvest_quantity;
    await client.query(`
      UPDATE products
      SET stock_quantity = $1,
          reserved_quantity = 0
      WHERE id = $2
    `, [newStock, productId]);

    // Get affected order IDs for response
    const orderResult = await client.query(`
      SELECT id FROM orders WHERE product_id = $1 AND is_preorder = true
    `, [productId]);

    const affectedOrderIds = orderResult.rows.map(row => row.id);

    await client.query('COMMIT');

    res.json({
      message: 'Pre-orders converted to stock successfully',
      harvest_quantity: harvest_quantity,
      new_stock_quantity: newStock,
      converted_preorders: product.reserved_quantity,
      affected_orders: affectedOrderIds
    });

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
});
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 9.6: Fix Conversion Endpoint Route Param and Active Order Filter

**Files:**
- Modify: `backend/routes/products.js` (POST /:id/convert-preorders endpoint)

**Interfaces:**
- Consumes: Database schema from Task 1.5
- Produces: Fixed conversion endpoint with route param and active order filtering

- [ ] **Step 1: Fix route param and add active order filtering**

Update the conversion endpoint to fix the route param and filter only active pre-orders:

```javascript
router.post('/:id/convert-preorders', authenticateToken, async (req, res) => {
  const productId = req.params.id; // Fix: use req.params.id, not req.params.productId
  const { harvest_quantity } = req.body;

  if (!harvest_quantity || harvest_quantity <= 0) {
    return res.status(400).json({ message: 'Harvest quantity is required and must be positive' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Get product details
  const productResult = await pool.query(
    'SELECT farmer_id, is_preorder, reserved_quantity, stock_quantity FROM products WHERE id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const product = productResult.rows[0];

  // Verify user is the farmer
  if (Number(product.farmer_id) !== Number(decoded.id)) {
    return res.status(403).json({ message: 'You can only convert pre-orders for your own products' });
  }

  if (!product.is_preorder) {
    return res.status(400).json({ message: 'This product is not a pre-order product' });
  }

  if (product.reserved_quantity === 0) {
    return res.status(400).json({ message: 'No pre-orders to convert' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add harvest_quantity to stock_quantity (not reserved_quantity)
    const newStock = product.stock_quantity + harvest_quantity;
    await client.query(`
      UPDATE products
      SET stock_quantity = $1,
          reserved_quantity = 0
      WHERE id = $2
    `, [newStock, productId]);

    // Get active pre-order order IDs (not cancelled or delivered)
    const orderResult = await client.query(`
      SELECT id FROM orders
      WHERE product_id = $1
        AND is_preorder = true
        AND status NOT IN ('cancelled', 'delivered')
    `, [productId]);

    const affectedOrderIds = orderResult.rows.map(row => row.id);

    // Update active pre-order orders with conversion timestamp
    if (affectedOrderIds.length > 0) {
      await client.query(`
        UPDATE orders
        SET preorder_converted_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1)
      `, [affectedOrderIds]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Pre-orders converted to stock successfully',
      harvest_quantity: harvest_quantity,
      new_stock_quantity: newStock,
      converted_preorders: product.reserved_quantity,
      affected_orders: affectedOrderIds
    });

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
});
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 10: Add Pre-order Badges to Product Listing

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/js/index.js`

**Interfaces:**
- Consumes: API with pre-order fields from Task 6
- Produces: Product cards with pre-order badges

- [ ] **Step 1: Add pre-order badge HTML to product card template**

In the product card HTML, add badge:

```html
<div class="product-card">
  <img src="${imgSrc}" alt="${safeName}" class="product-image">
  <div class="product-info">
    ${product.is_preorder ? '<span class="badge bg-warning text-dark">Pre-order</span>' : '<span class="badge bg-success">Available Now</span>'}
    <!-- rest of product card -->
  </div>
</div>
```

- [ ] **Step 2: Add availability date display for pre-orders**

```html
${product.is_preorder && product.preorder_availability_date ? `<div class="text-muted small">Available: ${product.preorder_availability_date}</div>` : ''}
```

- [ ] **Step 3: Add reserved quantity progress bar for pre-orders**

```html
${product.is_preorder && product.max_preorder_quantity ? `
  <div class="progress mt-2" style="height: 6px;">
    <div class="progress-bar" role="progressbar" style="width: ${(product.reserved_quantity / product.max_preorder_quantity) * 100}%"></div>
  </div>
  <div class="text-muted small">Reserved: ${product.reserved_quantity} / ${product.max_preorder_quantity}</div>
` : ''}
```

- [ ] **Step 4: Change button text for pre-orders**

```html
<button class="btn ${product.is_preorder ? 'btn-warning' : 'btn-primary'}">
  ${product.is_preorder ? 'Reserve' : 'Add to Cart'}
</button>
```

- [ ] **Step 5: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 11: Add Pre-order Filter to Product Listing

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/js/index.js`

**Interfaces:**
- Consumes: API with preorder filter from Task 5
- Produces: Product listing with filter controls

- [ ] **Step 1: Add filter controls to index.html**

Add before product grid:

```html
<div class="mb-3">
  <div class="btn-group" role="group">
    <button type="button" class="btn btn-outline-primary active" data-filter="all">All Products</button>
    <button type="button" class="btn btn-outline-primary" data-filter="false">Available Now</button>
    <button type="button" class="btn btn-outline-primary" data-filter="true">Pre-order Only</button>
  </div>
</div>
```

- [ ] **Step 2: Add filter click handler in index.js**

```javascript
document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', (e) => {
    // Update active state
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    // Update API call with filter
    const filter = e.target.dataset.filter;
    loadProducts(filter);
  });
});

function loadProducts(preorderFilter = null) {
  let url = '/api/products';
  if (preorderFilter !== null) {
    url += `?is_preorder=${preorderFilter}`; // Use is_preorder for consistency
  }
  // ... existing fetch logic
}
```

- [ ] **Step 3: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 12: Add Pre-order Banner to Product Detail Page

**Files:**
- Modify: `frontend/product.html`
- Modify: `frontend/js/product.js`

**Interfaces:**
- Consumes: API with pre-order fields from Task 6
- Produces: Product detail with pre-order banner

- [ ] **Step 1: Add pre-order banner to product.html**

Add at top of product detail:

```html
${product.is_preorder ? `
  <div class="alert alert-warning">
    <strong>Pre-order</strong> - Available on ${product.preorder_availability_date || 'TBD'}
  </div>
` : ''}
```

- [ ] **Step 2: Add reserved quantity display**

```html
${product.is_preorder && product.max_preorder_quantity ? `
  <div class="mb-3">
    <div class="progress" style="height: 20px;">
      <div class="progress-bar" role="progressbar" style="width: ${(product.reserved_quantity / product.max_preorder_quantity) * 100}%">
        ${product.reserved_quantity} / ${product.max_preorder_quantity} reserved
      </div>
    </div>
  </div>
` : ''}
```

- [ ] **Step 3: Change button text**

```html
<button class="btn ${product.is_preorder ? 'btn-warning' : 'btn-primary'}">
  ${product.is_preorder ? 'Pre-order Now' : 'Add to Cart'}
</button>
```

- [ ] **Step 4: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 13: Add Delivery Date Validation for Pre-orders

**Files:**
- Modify: `frontend/js/product.js`

**Interfaces:**
- Consumes: Product data with pre-order fields
- Produces: Delivery date validation

- [ ] **Step 1: Add minimum date to delivery date picker**

In renderProduct function, after loading product:

```javascript
if (product.is_preorder && product.preorder_availability_date) {
  const deliveryDateInput = document.getElementById('delivery_date');
  if (deliveryDateInput) {
    deliveryDateInput.min = product.preorder_availability_date;
  }
}
```

- [ ] **Step 2: Add validation on date change**

```javascript
const deliveryDateInput = document.getElementById('delivery_date');
if (deliveryDateInput) {
  deliveryDateInput.addEventListener('change', (e) => {
    if (product.is_preorder && product.preorder_availability_date) {
      const selectedDate = new Date(e.target.value);
      const availabilityDate = new Date(product.preorder_availability_date);
      if (selectedDate < availabilityDate) {
        showToast(`Delivery date must be on or after ${product.preorder_availability_date}`, 'error');
        e.target.value = product.preorder_availability_date;
      }
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 14: Add Pre-order Fields to Farmer Product Form

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: API with pre-order fields
- Produces: Farmer form with pre-order controls

- [ ] **Step 1: Add pre-order checkbox to product form**

In the add/edit product form modal:

```html
<div class="form-check mb-3">
  <input class="form-check-input" type="checkbox" id="is_preorder" name="is_preorder">
  <label class="form-check-label" for="is_preorder">
    Enable pre-order for this product
  </label>
</div>

<div id="preorder-fields" style="display: none;">
  <div class="mb-3">
    <label for="preorder_availability_date" class="form-label">Availability Date</label>
    <input type="date" class="form-control" id="preorder_availability_date" name="preorder_availability_date">
  </div>
  <div class="mb-3">
    <label for="max_preorder_quantity" class="form-label">Maximum Pre-order Quantity (optional)</label>
    <input type="number" class="form-control" id="max_preorder_quantity" name="max_preorder_quantity" min="1">
  </div>
</div>
```

- [ ] **Step 2: Add toggle logic in farmer.js**

```javascript
const isPreorderCheckbox = document.getElementById('is_preorder');
const preorderFields = document.getElementById('preorder-fields');

if (isPreorderCheckbox) {
  isPreorderCheckbox.addEventListener('change', (e) => {
    preorderFields.style.display = e.target.checked ? 'block' : 'none';
  });
}
```

- [ ] **Step 3: Add pre-order fields to form submission**

In the form submit handler, include pre-order fields:

```javascript
const formData = {
  // ... existing fields
  is_preorder: document.getElementById('is_preorder').checked,
  preorder_availability_date: document.getElementById('preorder_availability_date').value || null,
  max_preorder_quantity: document.getElementById('max_preorder_quantity').value ? parseInt(document.getElementById('max_preorder_quantity').value) : null
};
```

- [ ] **Step 4: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 15: Add Pre-order Display to Farmer Product List

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: API with pre-order fields
- Produces: Product list with pre-order indicators

- [ ] **Step 1: Add pre-order badge to product list**

In the product list table:

```html
${product.is_preorder ? '<span class="badge bg-warning">Pre-order</span>' : ''}
```

- [ ] **Step 2: Add reserved quantity display**

```html
${product.is_preorder ? `<small>Reserved: ${product.reserved_quantity}</small>` : ''}
```

- [ ] **Step 3: Add availability date display**

```html
${product.is_preorder && product.preorder_availability_date ? `<small>Available: ${product.preorder_availability_date}</small>` : ''}
```

- [ ] **Step 4: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 16: Add Pre-order Badges to Customer Orders

**Files:**
- Modify: `frontend/orders.html`
- Modify: `frontend/js/orders.js`

**Interfaces:**
- Consumes: API with is_preorder field from Task 8
- Produces: Order list with pre-order badges

- [ ] **Step 1: Add pre-order badge to order items**

In the order item display:

```html
${order.is_preorder ? '<span class="badge bg-warning">Pre-order</span>' : ''}
```

- [ ] **Step 2: Add expected availability date for pre-orders**

```html
${order.is_preorder && product.preorder_availability_date ? `<small>Expected availability: ${product.preorder_availability_date}</small>` : ''}
```

- [ ] **Step 3: Update status display for pre-orders**

```html
${order.is_preorder && order.status === 'pending' ? 'Pre-order placed' : order.status}
```

- [ ] **Step 4: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 17: Add Pre-order Tab to Farmer Orders

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: API with is_preorder field from Task 8
- Produces: Farmer orders with pre-order tab

- [ ] **Step 1: Add pre-orders tab to orders section**

In the orders tabs, use the existing `.order-tabs` pattern:

```html
<div class="order-tabs">
  <button class="tab-btn active" data-tab="regular">Regular Orders</button>
  <button class="tab-btn" data-tab="preorder">Pre-orders</button>
</div>
```

- [ ] **Step 2: Add tab switching logic in farmer.js**

```javascript
document.querySelectorAll('[data-tab]').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const tabType = e.target.dataset.tab;
    
    // Update active state
    document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    
    // Load orders with filter
    loadOrders(tabType === 'preorder' ? true : false);
  });
});

function loadOrders(isPreorder = null) {
  let url = `/api/orders/farmer/${farmerId}`;
  if (isPreorder !== null) {
    url += `?is_preorder=${isPreorder}`;
  }
  // ... existing fetch logic
}
```

- [ ] **Step 3: Add convert button for pre-orders**

In the pre-orders tab, add button for each product:

```html
<button class="btn btn-sm btn-success" onclick="convertPreorders(${product.id})">
  Convert to Stock
</button>
```

- [ ] **Step 4: Add convert function in farmer.js**

```javascript
async function convertPreorders(productId) {
  if (!await showConfirm('Convert all pre-orders for this product to stock?', { title: 'Convert Pre-orders', okLabel: 'Convert' })) {
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}/convert-preorders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (response.ok) {
      const data = await response.json();
      showToast(`Converted ${data.converted_quantity} pre-orders to stock`, 'success');
      loadOrders(true); // Reload pre-orders
    } else {
      const error = await response.json();
      showToast(`Error: ${error.message}`, 'error');
    }
  } catch (error) {
    console.error('Convert pre-orders error:', error);
    showToast('Error converting pre-orders', 'error');
  }
}
```

- [ ] **Step 5: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 17.5: Add Pre-order Management Panel

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: API with pre-order fields from Task 6
- Produces: Dedicated pre-order management panel grouped by product

- [ ] **Step 1: Add pre-order management section to farmer.html**

Add new section after orders section:

```html
<section id="preorders" class="admin-section-card" style="display:none;">
  <h2>Pre-order Management</h2>
  <p class="text-muted">Manage your pre-orders and convert them to stock when harvest is ready.</p>

  <div id="preorders-list" class="orders-list">
    <!-- Pre-order products will be loaded here -->
  </div>
</section>
```

- [ ] **Step 2: Add loadPreorders method to FarmerDashboard class**

Add as methods to the FarmerDashboard class, not standalone functions:

```javascript
async loadPreorders() {
  try {
    const response = await fetch(`${this.apiBase}/products?farmer_id=${this.userId}&is_preorder=true`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const products = data.products || [];
      this.renderPreorders(products);
    } else {
      this.showMessage('Failed to load pre-orders', 'error');
    }
  } catch (error) {
    console.error('Load pre-orders error:', error);
    this.showMessage('Error loading pre-orders', 'error');
  }
}

renderPreorders(products) {
  const container = document.getElementById('preorders-list');
  if (!container) return;

  if (!products.length) {
    container.innerHTML = '<div class="empty-state">No pre-order products found</div>';
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="order-card">
      <div class="order-header">
        <div class="order-head-left">
          <div class="order-id">${this.escapeHtml(product.name)}</div>
          <span class="badge bg-warning">Pre-order</span>
        </div>
        <div class="order-status-line">
          <strong>Reserved:</strong> ${product.reserved_quantity || 0} / ${product.max_preorder_quantity || '∞'}
        </div>
      </div>
      <div class="order-item">
        <div class="order-item-info">
          <div class="order-item-meta">
            <strong>Availability Date:</strong> ${product.preorder_availability_date || 'Not set'}
          </div>
          <div class="order-item-meta">
            <strong>Current Stock:</strong> ${product.stock_quantity || 0}
          </div>
        </div>
        <div class="order-item-side">
          ${product.reserved_quantity > 0 ? `
            <button class="btn btn-sm btn-success" data-action="convert-preorder" data-product-id="${product.id}" data-product-name="${this.escapeHtml(product.name)}" data-reserved-qty="${product.reserved_quantity}">
              Convert to Stock
            </button>
          ` : `
            <button class="btn btn-sm btn-secondary" disabled>No pre-orders to convert</button>
          `}
        </div>
      </div>
    </div>
  `).join('');
}
```

- [ ] **Step 3: Add convert modal to farmer.html**

```html
<div id="convert-preorder-modal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3>Convert Pre-orders to Stock</h3>
      <button class="close-btn" onclick="closeConvertModal()">&times;</button>
    </div>
    <div class="modal-body">
      <p>Convert pre-orders for <strong id="convert-product-name">Product</strong></p>
      <p class="text-muted">Reserved quantity: <span id="convert-reserved-qty">0</span></p>
      <div class="mb-3">
        <label for="harvest-quantity" class="form-label">Harvest Quantity</label>
        <input type="number" class="form-control" id="harvest-quantity" min="1" required>
        <small class="text-muted">Enter the actual quantity harvested</small>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeConvertModal()">Cancel</button>
      <button class="btn btn-success" onclick="submitConvert()">Convert</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add convert modal methods to FarmerDashboard class**

Add as methods to the FarmerDashboard class:

```javascript
openConvertModal(productId, productName, reservedQty) {
  this.currentConvertProductId = productId;
  document.getElementById('convert-product-name').textContent = productName;
  document.getElementById('convert-reserved-qty').textContent = reservedQty;
  document.getElementById('harvest-quantity').value = '';
  document.getElementById('convert-preorder-modal').classList.add('open');
}

closeConvertModal() {
  document.getElementById('convert-preorder-modal').classList.remove('open');
  this.currentConvertProductId = null;
}

async submitConvert() {
  const harvestQty = parseInt(document.getElementById('harvest-quantity').value);
  if (!harvestQty || harvestQty <= 0) {
    this.showMessage('Please enter a valid harvest quantity', 'error');
    return;
  }

  try {
    const response = await fetch(`${this.apiBase}/products/${this.currentConvertProductId}/convert-preorders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ harvest_quantity: harvestQty })
    });

    if (response.ok) {
      const data = await response.json();
      this.showMessage(`Converted ${data.converted_preorders} pre-orders to stock`, 'success');
      this.closeConvertModal();
      this.loadPreorders();
    } else {
      const error = await response.json();
      this.showMessage(`Error: ${error.message}`, 'error');
    }
  } catch (error) {
    console.error('Convert error:', error);
    this.showMessage('Error converting pre-orders', 'error');
  }
}
```

- [ ] **Step 5: Add event delegation for convert button**

Add to the existing event delegation in setupEventListeners:

```javascript
// Convert pre-order button
if (action === 'convert-preorder') {
  const productId = Number(btn.getAttribute('data-product-id'));
  const productName = btn.getAttribute('data-product-name');
  const reservedQty = Number(btn.getAttribute('data-reserved-qty'));
  this.openConvertModal(productId, productName, reservedQty);
}
```

- [ ] **Step 6: Fix modal onclick handlers to use class methods**

Update modal buttons to use class methods:

```html
<div class="modal-footer">
  <button class="btn btn-secondary" onclick="window.farmerApp.closeConvertModal()">Cancel</button>
  <button class="btn btn-success" onclick="window.farmerApp.submitConvert()">Convert</button>
</div>
```

- [ ] **Step 7: Add showSection integration for pre-orders**

In the showSection method, add:

```javascript
if (section === 'preorders') {
  this.loadPreorders();
}
```

- [ ] **Step 8: Add navigation link to pre-orders section**

In the sidebar navigation, add:

```html
<a href="#preorders" class="nav-link" data-section="preorders">
  <i class="fas fa-calendar-check"></i>
  <span>Pre-orders</span>
</a>
```

- [ ] **Step 6: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 18: Update Order Cancellation for Pre-orders

**Files:**
- Modify: `backend/routes/orders.js` (cancellation logic)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Order cancellation with reserved quantity handling

- [ ] **Step 1: Find order cancellation logic**

```bash
grep -n "cancelled" backend/routes/orders.js
```

Expected: Line numbers for status update to cancelled

- [ ] **Step 2: Add reserved quantity restoration for pre-orders**

In the cancellation logic, add:

```javascript
if (status === 'cancelled' && order.status !== 'cancelled') {
  if (order.is_preorder) {
    // Pre-order: decrement reserved_quantity (not increment)
    await client.query(`
      UPDATE products SET reserved_quantity = GREATEST(reserved_quantity - $1, 0) WHERE id = $2
    `, [order.quantity, order.product_id]);
  } else {
    // Regular order: restore stock_quantity
    await client.query(`
      UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2
    `, [order.quantity, order.product_id]);
  }
}
```

- [ ] **Step 3: Add cancellation date validation for pre-orders**

Add validation to prevent pre-order cancellation after availability date:

```javascript
if (status === 'cancelled' && order.status !== 'cancelled') {
  if (order.is_preorder && order.preorder_availability_date) {
    const availabilityDate = new Date(order.preorder_availability_date);
    const currentDate = new Date();
    if (currentDate >= availabilityDate) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        message: 'Pre-orders cannot be cancelled after the availability date'
      });
    }
  }

  if (order.is_preorder) {
    // Pre-order: decrement reserved_quantity (not increment)
    await client.query(`
      UPDATE products SET reserved_quantity = GREATEST(reserved_quantity - $1, 0) WHERE id = $2
    `, [order.quantity, order.product_id]);

    // Send cancellation notification to customer
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
      VALUES ($1, 'order_cancelled', 'Pre-order Cancelled', 'Your pre-order has been cancelled successfully', false, CURRENT_TIMESTAMP)
    `, [order.user_id]);
  } else {
    // Regular order: restore stock_quantity
    await client.query(`
      UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2
    `, [order.quantity, order.product_id]);
  }
}
```

- [ ] **Step 4: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 18.6: Add Cancellation Notification for Farmer

**Files:**
- Modify: `backend/routes/orders.js` (cancellation logic)

**Interfaces:**
- Consumes: Database schema from Task 1.5
- Produces: Notification to farmer when customer cancels pre-order

- [ ] **Step 1: Add notification to farmer when customer cancels pre-order**

In the cancellation logic, after sending notification to customer, add notification to farmer:

```javascript
if (order.is_preorder) {
  // Pre-order: decrement reserved_quantity (not increment)
  await client.query(`
    UPDATE products SET reserved_quantity = GREATEST(reserved_quantity - $1, 0) WHERE id = $2
  `, [order.quantity, order.product_id]);

  // Send cancellation notification to customer
  await client.query(`
    INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
    VALUES ($1, 'order_cancelled', 'Pre-order Cancelled', 'Your pre-order has been cancelled successfully', false, CURRENT_TIMESTAMP)
  `, [order.user_id]);

  // Send cancellation notification to farmer
  await client.query(`
    INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
    VALUES ($1, 'preorder_cancelled', 'Pre-order Cancelled', 'A customer has cancelled their pre-order', false, CURRENT_TIMESTAMP)
  `, [product.farmer_id]);
} else {
  // Regular order: restore stock_quantity
  await client.query(`
    UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2
  `, [order.quantity, order.product_id]);
}
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 18.7: Add Conversion Notification for Customers

**Files:**
- Modify: `backend/routes/products.js` (POST /:id/convert-preorders endpoint)

**Interfaces:**
- Consumes: Database schema from Task 1.5
- Produces: Notification when pre-orders are converted to stock

- [ ] **Step 1: Add notification insertion after conversion**

After updating orders with preorder_converted_at, add notification for affected customers:

```javascript
// Update active pre-order orders with conversion timestamp
if (affectedOrderIds.length > 0) {
  await client.query(`
    UPDATE orders
    SET preorder_converted_at = CURRENT_TIMESTAMP
    WHERE id = ANY($1)
  `, [affectedOrderIds]);

  // Send conversion notifications to affected customers
  const customerIds = await client.query(`
    SELECT DISTINCT user_id FROM orders WHERE id = ANY($1)
  `, [affectedOrderIds]);

  for (const row of customerIds.rows) {
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
      VALUES ($1, 'preorder_converted', 'Pre-order Available', 'Your pre-order is now available for delivery', false, CURRENT_TIMESTAMP)
    `, [row.user_id]);
  }
}
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 18.7: Add Pre-order Placement Notification for Farmers

**Files:**
- Modify: `backend/routes/orders.js` (POST /api/orders endpoint)

**Interfaces:**
- Consumes: Database schema from Task 1.5
- Produces: Notification when farmer receives a pre-order

- [ ] **Step 1: Add notification insertion after pre-order creation**

After creating a pre-order order, add notification for the farmer:

```javascript
if (product.is_preorder) {
  // ... existing pre-order logic

  // Send pre-order placement notification to farmer
  await client.query(`
    INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
    VALUES ($1, 'preorder_placed', 'New Pre-order', 'You have received a new pre-order for your product', false, CURRENT_TIMESTAMP)
  `, [product.farmer_id]);
}
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 16.5: Update Order Status Display for Pre-orders

**Files:**
- Modify: `frontend/orders.html`
- Modify: `frontend/js/orders.js`

**Interfaces:**
- Consumes: API with is_preorder field from Task 8
- Produces: Order status display showing "Pre-order placed"

- [ ] **Step 1: Modify status display logic in orders.js**

In the renderOrdersByStatus method, update status display for pre-orders:

```javascript
const statusText = order.is_preorder && order.status === 'pending'
  ? 'Pre-order placed'
  : order.status.charAt(0).toUpperCase() + order.status.slice(1);
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 16.6: Update Timeline for Pre-orders

**Files:**
- Modify: `frontend/orders.html`
- Modify: `frontend/js/orders.js`

**Interfaces:**
- Consumes: API with is_preorder field from Task 8
- Produces: Timeline showing pre-order starting point

- [ ] **Step 1: Modify timeline rendering in orders.js**

In the timeline rendering logic, add pre-order starting point:

```javascript
const timelineSteps = order.is_preorder
  ? ['Pre-order placed', 'Confirmed', 'Preparing', 'Out for delivery', 'Delivered']
  : ['Pending', 'Confirmed', 'Preparing', 'Out for delivery', 'Delivered'];
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 20.8: Add Pre-order Fields to Product Request Endpoint

**Files:**
- Modify: `backend/routes/products.js` (GET /api/products/product-requests/mine endpoint)

**Interfaces:**
- Produces: Product request response with pre-order fields

- [ ] **Step 1: Add pre-order fields to product request query**

Update the SELECT clause to include pre-order fields:

```javascript
const pendingProductsResult = await pool.query(
  `SELECT p.id, p.category_id, c.name as category_name, p.name, p.description as notes, p.status, p.rejection_reason as review_notes, p.updated_at as reviewed_at, p.created_at,
       p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity,
       'product_request' as request_type
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.farmer_id = $1
        AND p.status IN ('pending', 'rejected')
      ORDER BY p.created_at DESC`,
  [farmerId]
);
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 7.6: Add Transaction Safety with Row Locking for Pre-order Creation

**Files:**
- Modify: `backend/routes/orders.js` (POST /api/orders endpoint)

**Interfaces:**
- Consumes: Database schema from Task 2
- Produces: Race-condition-safe pre-order creation

- [ ] **Step 1: Wrap pre-order creation in transaction with row locking**

In the order creation logic, wrap pre-order validation and update in a transaction:

```javascript
if (product.is_preorder) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock product row for update to prevent race conditions
    const lockedProduct = await client.query(
      'SELECT id, reserved_quantity, max_preorder_quantity FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );

    if (lockedProduct.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'Product not found' });
    }

    const p = lockedProduct.rows[0];

    // Validate max pre-order quantity
    if (p.max_preorder_quantity && p.reserved_quantity + quantity > p.max_preorder_quantity) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ message: 'Pre-order limit exceeded' });
    }

    // Increment reserved_quantity
    await client.query(
      'UPDATE products SET reserved_quantity = reserved_quantity + $1 WHERE id = $2',
      [quantity, productId]
    );

    await client.query('COMMIT');
    client.release();
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
      client.release();
    }
    throw error;
  }
}
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 18.5: Add Pre-order Fields to Edit Product Form

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: API with pre-order fields from Task 6
- Produces: Edit product form with pre-order fields pre-filled

- [ ] **Step 1: Add pre-order fields to edit product modal**

In the edit product modal, add the same pre-order fields as Task 14:

```html
<div class="form-check mb-3">
  <input class="form-check-input" type="checkbox" id="edit_is_preorder" name="is_preorder">
  <label class="form-check-label" for="edit_is_preorder">
    Enable pre-order for this product
  </label>
</div>

<div id="edit_preorder_fields" style="display: none;">
  <div class="mb-3">
    <label for="edit_preorder_availability_date" class="form-label">Availability Date</label>
    <input type="date" class="form-control" id="edit_preorder_availability_date" name="edit_preorder_availability_date">
  </div>
  <div class="mb-3">
    <label for="edit_max_preorder_quantity" class="form-label">Maximum Pre-order Quantity (optional)</label>
    <input type="number" class="form-control" id="edit_max_preorder_quantity" name="edit_max_preorder_quantity" min="1">
  </div>
</div>
```

- [ ] **Step 2: Add toggle logic for edit form**

```javascript
const editIsPreorderCheckbox = document.getElementById('edit_is_preorder');
const editPreorderFields = document.getElementById('edit_preorder_fields');

if (editIsPreorderCheckbox) {
  editIsPreorderCheckbox.addEventListener('change', (e) => {
    editPreorderFields.style.display = e.target.checked ? 'block' : 'none';
  });
}
```

- [ ] **Step 3: Pre-fill pre-order fields when editing**

In the edit product function, pre-fill the fields:

```javascript
if (product.is_preorder) {
  document.getElementById('edit_is_preorder').checked = true;
  document.getElementById('edit_preorder_fields').style.display = 'block';
  if (product.preorder_availability_date) {
    document.getElementById('edit_preorder_availability_date').value = product.preorder_availability_date;
  }
  if (product.max_preorder_quantity) {
    document.getElementById('edit_max_preorder_quantity').value = product.max_preorder_quantity;
  }
}
```

- [ ] **Step 4: Add pre-order fields to edit form submission**

```javascript
const formData = {
  // ... existing fields
  is_preorder: document.getElementById('edit_is_preorder').checked,
  preorder_availability_date: document.getElementById('edit_preorder_availability_date').value || null,
  max_preorder_quantity: document.getElementById('edit_max_preorder_quantity').value ? parseInt(document.getElementById('edit_max_preorder_quantity').value) : null
};
```

- [ ] **Step 5: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 19: Test Pre-order Flow End-to-End

**Files:**
- Test: Manual testing

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified pre-order functionality

- [ ] **Step 1: Test product creation with pre-order**

1. Login as farmer
2. Create new product with is_preorder=true
3. Set preorder_availability_date to future date
4. Set max_preorder_quantity
5. Verify product shows in list with "Pre-order" badge

- [ ] **Step 2: Test pre-order placement**

1. Login as customer
2. Find pre-order product
3. Click "Reserve" button
4. Set delivery date >= availability date
5. Place order
6. Verify order shows with "Pre-order" badge
7. Verify reserved_quantity incremented

- [ ] **Step 3: Test pre-order conversion**

1. Login as farmer
2. Go to Pre-orders tab
3. Click "Convert to Stock"
4. Verify reserved_quantity reset to 0
5. Verify stock_quantity increased
6. Verify order can now be processed

- [ ] **Step 4: Test pre-order cancellation**

1. Cancel a pre-order before availability date
2. Verify reserved_quantity decremented
3. Verify notification sent

- [ ] **Step 5: Test validation**

1. Try to mix pre-order and regular in same order (should fail)
2. Try delivery date before availability date (should fail)
3. Try exceeding max_preorder_quantity (should fail)

- [ ] **Step 6: Commit test notes**

```bash
# Note: No git commands during implementation
```

---

### Task 19.5: Test Hybrid Stock Scenario

**Files:**
- Test: Manual testing

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified hybrid stock functionality

- [ ] **Step 1: Create product with both stock and pre-order**

1. Login as farmer
2. Create product with stock_quantity = 50, is_preorder = true
3. Set preorder_availability_date to future date
4. Set max_preorder_quantity = 100
5. Verify product shows both stock and pre-order capability

- [ ] **Step 2: Place regular order for available stock**

1. Login as customer
2. Order 10kg of the product (regular order)
3. Verify stock_quantity decreased to 40
4. Verify reserved_quantity still 0

- [ ] **Step 3: Place pre-order for future stock**

1. Login as different customer
2. Pre-order 20kg of the same product
3. Verify reserved_quantity increased to 20
4. Verify stock_quantity still 40

- [ ] **Step 4: Convert pre-orders to stock**

1. Login as farmer
2. Add 100kg to stock (simulate harvest)
3. Click "Convert to Stock"
4. Verify reserved_quantity reset to 0
5. Verify stock_quantity increased to 140 (40 + 100)

- [ ] **Step 5: Verify both orders can be fulfilled**

1. Process regular order (should work immediately)
2. Process pre-order (should work after conversion)
3. Verify both orders complete successfully

- [ ] **Step 6: Commit hybrid stock test notes**

```bash
# Note: No git commands during implementation
```

---

### Task 20: Add Pre-order Indicators to Admin Product Approvals

**Files:**
- Modify: `frontend/admin.html`
- Modify: `frontend/js/admin.js`

**Interfaces:**
- Consumes: API with pre-order fields from Task 6
- Produces: Admin product approvals with pre-order indicators

- [ ] **Step 1: Add pre-order badge to product approval list**

In the product approvals table:

```html
${product.is_preorder ? '<span class="badge bg-warning">Pre-order</span>' : ''}
```

- [ ] **Step 2: Add availability date display for pre-orders**

```html
${product.is_preorder && product.preorder_availability_date ? `<small>Available: ${product.preorder_availability_date}</small>` : ''}
```

- [ ] **Step 3: Add max pre-order quantity display**

```html
${product.is_preorder && product.max_preorder_quantity ? `<small>Max pre-orders: ${product.max_preorder_quantity}</small>` : ''}
```

- [ ] **Step 4: Commit**

```bash
# Note: No git commands during implementation
```

---

### Task 20.5: Add Pre-order Filter to Customer Orders

**Files:**
- Modify: `frontend/orders.html`
- Modify: `frontend/js/orders.js`
- Modify: `backend/routes/orders.js` (GET /api/orders endpoint)

**Interfaces:**
- Consumes: API with is_preorder field from Task 8
- Produces: Customer orders with pre-order filter

- [ ] **Step 1: Add pre-order filter to customer orders**

In the orders section, add filter using scoped class to avoid conflict with existing status tabs:

```html
<div class="preorder-filter-tabs mb-3">
  <button class="tab-btn active" data-preorder-tab="all">All Orders</button>
  <button class="tab-btn" data-preorder-tab="preorder">Pre-orders</button>
  <button class="tab-btn" data-preorder-tab="regular">Regular Orders</button>
</div>
```

- [ ] **Step 2: Add currentOrderType state and tab switching logic in orders.js**

Add state and use scoped selector to avoid conflict with existing status tabs:

```javascript
// Add to constructor
this.currentOrderType = 'all'; // 'all', 'preorder', 'regular'

// Add tab switching logic
document.querySelectorAll('[data-preorder-tab]').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const tabType = e.target.dataset.preorderTab;

    // Update active state
    document.querySelectorAll('[data-preorder-tab]').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');

    // Update state
    this.currentOrderType = tabType;

    // Re-render current status with new type filter
    this.renderOrdersByStatus(this.currentStatus);
  });
});

// Modify renderOrdersByStatus to apply type filter
renderOrdersByStatus(status) {
  const orders = this.ordersByStatus[status] || [];
  const container = document.getElementById(`${status}-orders-list`);
  if (!container) return;

  // Apply type filter
  let filtered = orders;
  if (this.currentOrderType === 'preorder') {
    filtered = orders.filter(o => o.is_preorder === true);
  } else if (this.currentOrderType === 'regular') {
    filtered = orders.filter(o => o.is_preorder === false);
  }

  // Apply search + date filters
  const q = this.searchQuery || '';
  const fromMs = this.dateFrom ? new Date(this.dateFrom).getTime() : 0;
  const toMs = this.dateTo ? new Date(this.dateTo + 'T23:59:59').getTime() : Infinity;
  filtered = filtered.filter((order) => {
    const item = (order.items && order.items[0]) || order;
    const matchesSearch = !q
      || String(order.id || '').includes(q)
      || String(item.product_name || '').toLowerCase().includes(q);
    const orderDate = new Date(order.created_at).getTime();
    const matchesDate = (!fromMs || orderDate >= fromMs) && orderDate <= toMs;
    return matchesSearch && matchesDate;
  });

  // ... rest of existing render logic
}
```

- [ ] **Step 3: Add is_preorder filter to user orders endpoint**

Modify `backend/routes/orders.js` GET /api/orders to handle is_preorder filter:

```javascript
const { status, is_preorder } = req.query;

if (is_preorder !== undefined) {
  if (is_preorder === 'true') {
    query += ` AND o.is_preorder = true`;
  } else if (is_preorder === 'false') {
    query += ` AND o.is_preorder = false`;
  }
}
```

- [ ] **Step 4: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 20.6: Add Scoped Filter Tab Styles

**Files:**
- Modify: `frontend/orders.html` (add CSS in <style> block)

**Interfaces:**
- Produces: Scoped styles for pre-order filter tabs

- [ ] **Step 1: Add CSS for scoped filter tabs**

Add to the style block in orders.html:

```css
.preorder-filter-tabs {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.preorder-filter-tabs .tab-btn {
  padding: 0.35rem 0.7rem;
  border-radius: 8px;
  border: 1px solid var(--ac-border, #e2e8f0);
  background: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--ac-text-muted, #6b7e72);
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.preorder-filter-tabs .tab-btn.active {
  background: var(--ac-primary, #2d7a3a);
  color: #fff;
  border-color: var(--ac-primary, #2d7a3a);
}
```

- [ ] **Step 2: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 20.7: Preserve Status Tabs in Farmer Orders with Type Filter

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Produces: Farmer orders with both status tabs and scoped type filter

- [ ] **Step 1: Add scoped type filter to farmer orders**

Add above existing status tabs in farmer.html:

```html
<div class="preorder-filter-tabs mb-3">
  <button class="tab-btn active" data-farmer-preorder-tab="all">All Types</button>
  <button class="tab-btn" data-farmer-preorder-tab="preorder">Pre-orders</button>
  <button class="tab-btn" data-farmer-preorder-tab="regular">Regular Orders</button>
</div>
```

- [ ] **Step 2: Add currentOrderType state and tab switching in farmer.js**

Add to constructor and setupEventListeners:

```javascript
// Add to constructor
this.currentOrderType = 'all'; // 'all', 'preorder', 'regular'

// Add tab switching logic
document.querySelectorAll('[data-farmer-preorder-tab]').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const tabType = e.target.dataset.farmerPreorderTab;

    // Update active state
    document.querySelectorAll('[data-farmer-preorder-tab]').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');

    // Update state
    this.currentOrderType = tabType;

    // Reload orders with current status
    this.loadMyOrders(this.activeOrderStatus);
  });
});
```

- [ ] **Step 3: Modify loadMyOrders to apply type filter**

Add type filter to the API call:

```javascript
async loadMyOrders(status = null) {
  // ... existing code

  let url = `${this.apiBase}/orders/farmer/${this.userId}`;
  const params = [];

  if (status) {
    params.push(`status=${status}`);
  }

  if (this.currentOrderType === 'preorder') {
    params.push('is_preorder=true');
  } else if (this.currentOrderType === 'regular') {
    params.push('is_preorder=false');
  }

  if (params.length > 0) {
    url += '?' + params.join('&');
  }

  // ... existing fetch logic
}
```

- [ ] **Step 4: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

### Task 21: Final Agentic QA, Playwright, Smoke Tests, Debugger Pass, Cleanup

**Files:**
- Create: `tests/preorder-smoke-test.spec.js` (temporary)
- Modify: All files from previous tasks

**Interfaces:**
- Consumes: Complete implementation from Tasks 1-20.7
- Produces: Verified, bug-free implementation with cleanup

- [ ] **Step 1: Run backend smoke tests**

Test all pre-order API endpoints:

```bash
# Start backend
npm run dev

# In another terminal, test endpoints
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $FARMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Pre-order","is_preorder":true,"preorder_availability_date":"2025-07-01","max_preorder_quantity":50}'

curl -X GET "http://localhost:3000/api/products?is_preorder=true"

curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":5,"delivery_date":"2025-07-01"}'

curl -X POST http://localhost:3000/api/products/1/convert-preorders \
  -H "Authorization: Bearer $FARMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"harvest_quantity":100}'
```

Expected: All endpoints return 200 with correct data

- [ ] **Step 2: Create Playwright smoke test**

Create temporary test file:

```javascript
import { test, expect } from '@playwright/test';

test('Pre-order smoke test', async ({ page }) => {
  // Login as farmer
  await page.goto('http://localhost:3000/farmer.html');
  await page.fill('input[name="email"]', 'farmer@test.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/farmer.html');

  // Create pre-order product
  await page.click('[data-section="products"]');
  await page.click('#add-product-btn');
  await page.fill('#product-name', 'Smoke Test Pre-order');
  await page.fill('#product-price', '100');
  await page.fill('#stock-quantity', '0');
  await page.check('#is_preorder');
  await page.fill('#preorder_availability_date', '2025-07-01');
  await page.fill('#max_preorder_quantity', '50');
  await page.click('#submit-product-btn');
  await expect(page.locator('.toast-success')).toBeVisible();

  // Verify pre-order panel loads
  await page.click('[data-section="preorders"]');
  await expect(page.locator('#preorders-list')).toContainText('Smoke Test Pre-order');

  // Login as customer
  await page.goto('http://localhost:3000/index.html');
  await page.click('[data-section="login"]');
  await page.fill('input[name="email"]', 'customer@test.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Verify pre-order badge visible
  await expect(page.locator('.badge.bg-warning').first()).toBeVisible();

  // Place pre-order
  await page.click('[data-action="add-to-cart"]');
  await page.click('[data-section="cart"]');
  await page.click('#checkout-btn');
  await page.fill('#delivery-date', '2025-07-01');
  await page.click('#place-order-btn');
  await expect(page.locator('.toast-success')).toBeVisible();

  // Verify customer orders filter
  await page.goto('http://localhost:3000/orders.html');
  await page.click('[data-preorder-tab="preorder"]');
  await expect(page.locator('.order-card').first()).toBeVisible();
});
```

- [ ] **Step 3: Run Playwright smoke test**

```bash
npx playwright test tests/preorder-smoke-test.spec.js
```

Expected: All tests pass

- [ ] **Step 4: Run static checks**

```bash
# Check for native alerts/confirms
grep -r "alert(" frontend/ --include="*.js" --include="*.html"
grep -r "confirm(" frontend/ --include="*.js" --include="*.html"

# Check for unscoped tab handlers
grep -r "data-tab" frontend/ --include="*.js" --include="*.html"

# Check for unescaped onclick
grep -r "onclick.*product.name" frontend/ --include="*.html"
```

Expected: No native alerts/confirms, scoped selectors only, no unescaped inline handlers

- [ ] **Step 5: Run debugger pass**

Check backend logs for errors:

```bash
# Check for SQL errors
grep -i "error" backend/logs/*.log

# Check for unhandled exceptions
grep -i "unhandled" backend/logs/*.log

# Check for validation errors
grep -i "validation" backend/logs/*.log
```

Expected: No errors, no unhandled exceptions

- [ ] **Step 6: Delete temporary smoke test**

```bash
rm tests/preorder-smoke-test.spec.js
```

- [ ] **Step 7: Note: No git commands during implementation**

*(Git operations will be handled separately after implementation is complete and verified)*

---

## Self-Review

**Spec coverage:**
- Database migration: Task 1-2 ✓
- Database constraints and conversion tracking: Task 1.5 ✓
- Product endpoints (POST, PUT, GET): Task 3-6 ✓
- Order endpoints (POST, GET): Task 7-8 ✓
- Cart query with pre-order fields: Task 7.5 ✓
- Transaction safety with row locking: Task 7.6 ✓
- Farmer orders filter: Task 8.5 ✓
- User orders filter: Task 20.5 ✓
- Convert-preorders endpoint: Task 9 ✓
- Convert endpoint fix (harvest quantity): Task 9.5 ✓
- Convert endpoint route param and active order filter: Task 9.6 ✓
- Product listing UI: Task 10-11 ✓
- Product detail UI: Task 12-13 ✓
- Farmer product form UI (add): Task 14-15 ✓
- Farmer product form UI (edit): Task 18.5 ✓
- Customer orders UI: Task 16 ✓
- Customer orders filter (scoped with state): Task 20.5 ✓
- Scoped filter styles: Task 20.6 ✓
- Farmer orders UI: Task 17 ✓
- Pre-order management panel (class methods): Task 17.5 ✓
- Farmer orders type filter (scoped): Task 20.7 ✓
- Order cancellation with date validation and decrement: Task 18 ✓
- Cancellation notification (customer): Task 18 ✓
- Cancellation notification (farmer): Task 18.6 ✓
- Conversion notification (customer): Task 18.7 ✓
- Pre-order placement notification (farmer): Task 18.8 ✓
- Order status display for pre-orders: Task 16.5 ✓
- Timeline for pre-orders: Task 16.6 ✓
- Product request endpoint with pre-order fields: Task 20.8 ✓
- Testing: Task 19 ✓
- Hybrid stock testing: Task 19.5 ✓
- Admin product approvals UI: Task 20 ✓
- Final Agentic QA, Playwright, smoke tests, debugger pass, cleanup: Task 21 ✓

**Placeholder scan:** No placeholders found. All steps contain complete code.

**Type consistency:** Field names consistent across tasks (is_preorder, preorder_availability_date, reserved_quantity, max_preorder_quantity).

---

Plan complete and saved to `docs/superpowers/plans/2025-06-20-hybrid-preorder-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
