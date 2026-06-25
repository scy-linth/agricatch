# Task 2: Add Backend API Endpoint for Convert Remaining Pre-order

## Files
- Modify: `backend/routes/farmers.js`

## Interfaces
- Consumes: Express router, PostgreSQL pool, authentication middleware
- Produces: `POST /api/farmers/products/:id/convert-preorder` endpoint

## Steps

### Step 1: Add convert-preorder endpoint to farmers.js

Add this endpoint after the harvest-preorder endpoint:

```javascript
// Convert remaining pre-order inventory to available stock
router.post('/products/:id/convert-preorder', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const productId = parseInt(req.params.id);

    // Verify product belongs to farmer
    const productCheck = await pool.query(
      'SELECT id, farmer_id, stock_quantity, reserved_quantity, max_preorder_quantity FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (productCheck.rows[0].farmer_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const product = productCheck.rows[0];
    
    // Calculate remaining available slots
    const remainingSlots = product.max_preorder_quantity - product.reserved_quantity;
    
    if (remainingSlots <= 0) {
      return res.status(400).json({ error: 'No remaining pre-order slots to convert' });
    }

    // Add remaining slots to stock quantity and disable pre-order
    const updatedStock = product.stock_quantity + remainingSlots;
    
    await pool.query(
      'UPDATE products SET stock_quantity = $1, max_preorder_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [updatedStock, productId]
    );

    res.json({ 
      success: true, 
      message: 'Remaining pre-order inventory converted successfully',
      new_stock_quantity: updatedStock
    });
  } catch (error) {
    console.error('Error converting pre-order:', error);
    res.status(500).json({ error: 'Failed to convert pre-order inventory' });
  }
});
```

### Step 2: Test endpoint manually

Run: Start backend server and test with curl/Postman
```bash
curl -X POST http://localhost:3000/api/farmers/products/1/convert-preorder \
  -H "Authorization: Bearer <farmer_jwt_token>"
```
Expected: Success response with updated stock quantity

### Step 3: Commit

```bash
git add backend/routes/farmers.js
git commit -m "feat: add convert-preorder endpoint to convert remaining pre-order slots to available stock"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
