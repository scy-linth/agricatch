# Task 1: Add Backend API Endpoint for Harvest Pre-order

## Files
- Modify: `backend/routes/farmers.js`

## Interfaces
- Consumes: Express router, PostgreSQL pool, authentication middleware
- Produces: `POST /api/farmers/products/:id/harvest-preorder` endpoint

## Steps

### Step 1: Add harvest-preorder endpoint to farmers.js

Add this endpoint after the existing product update endpoints:

```javascript
// Harvest pre-order inventory (transfer to available stock)
router.post('/products/:id/harvest-preorder', authenticateToken, requireRole('farmer'), async (req, res) => {
  try {
    const farmerId = req.user.id;
    const productId = parseInt(req.params.id);

    // Verify product belongs to farmer
    const productCheck = await pool.query(
      'SELECT id, farmer_id, stock_quantity, reserved_quantity FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (productCheck.rows[0].farmer_id !== farmerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const product = productCheck.rows[0];

    // Transfer reserved quantity to stock quantity
    const updatedStock = product.stock_quantity + product.reserved_quantity;
    
    await pool.query(
      'UPDATE products SET stock_quantity = $1, reserved_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [updatedStock, productId]
    );

    res.json({ 
      success: true, 
      message: 'Pre-order inventory harvested successfully',
      new_stock_quantity: updatedStock
    });
  } catch (error) {
    console.error('Error harvesting pre-order:', error);
    res.status(500).json({ error: 'Failed to harvest pre-order inventory' });
  }
});
```

### Step 2: Test endpoint manually

Run: Start backend server and test with curl/Postman
```bash
curl -X POST http://localhost:3000/api/farmers/products/1/harvest-preorder \
  -H "Authorization: Bearer <farmer_jwt_token>"
```
Expected: Success response with updated stock quantity

### Step 3: Commit

```bash
git add backend/routes/farmers.js
git commit -m "feat: add harvest-preorder endpoint to transfer pre-order inventory to available stock"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
