const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

const router = express.Router();

// Get cart items
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const sessionId = req.query.sessionId;

    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        // Invalid token, treat as guest
      }
    }

    let query, params;
    if (userId) {
      // Logged in user
      query = `
        SELECT c.id, c.quantity, c.added_at,
               p.id as product_id, p.name, p.price, p.unit, p.image_url, p.stock_quantity,
               p.is_available, COALESCE(p.is_admin_disabled, false) as is_admin_disabled,
               p.expiry_date,
               COALESCE(f.is_disabled, false) as farmer_is_disabled,
               COALESCE(f.shop_name, f.full_name) as farmer_name, p.location as farm_location,
               CASE
                 WHEN COALESCE(p.is_admin_disabled, false) THEN false
                 WHEN COALESCE(f.is_disabled, false) THEN false
                 WHEN p.is_available = false THEN false
                 WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE THEN false
                 ELSE true
               END AS is_available_for_checkout,
               CASE
                 WHEN COALESCE(p.is_admin_disabled, false) THEN 'admin_disabled'
                 WHEN COALESCE(f.is_disabled, false) THEN 'farmer_disabled'
                 WHEN p.is_available = false THEN 'farmer_unavailable'
                 WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE THEN 'expired'
                 ELSE 'available'
               END AS availability_status
        FROM cart c
        JOIN products p ON c.product_id = p.id
        LEFT JOIN users f ON p.farmer_id = f.id
        WHERE c.user_id = $1
        ORDER BY c.added_at DESC
      `;
      params = [userId];
    } else if (sessionId) {
      // Guest user
      query = `
        SELECT c.id, c.quantity, c.added_at,
               p.id as product_id, p.name, p.price, p.unit, p.image_url, p.stock_quantity,
               p.is_available, COALESCE(p.is_admin_disabled, false) as is_admin_disabled,
               p.expiry_date,
               COALESCE(f.is_disabled, false) as farmer_is_disabled,
               COALESCE(f.shop_name, f.full_name) as farmer_name, p.location as farm_location,
               CASE
                 WHEN COALESCE(p.is_admin_disabled, false) THEN false
                 WHEN COALESCE(f.is_disabled, false) THEN false
                 WHEN p.is_available = false THEN false
                 WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE THEN false
                 ELSE true
               END AS is_available_for_checkout,
               CASE
                 WHEN COALESCE(p.is_admin_disabled, false) THEN 'admin_disabled'
                 WHEN COALESCE(f.is_disabled, false) THEN 'farmer_disabled'
                 WHEN p.is_available = false THEN 'farmer_unavailable'
                 WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE THEN 'expired'
                 ELSE 'available'
               END AS availability_status
        FROM cart c
        JOIN products p ON c.product_id = p.id
        LEFT JOIN users f ON p.farmer_id = f.id
        WHERE c.session_id = $1
        ORDER BY c.added_at DESC
      `;
      params = [sessionId];
    } else {
      return res.json({ cartItems: [] });
    }

    const result = await pool.query(query, params);

    // Calculate totals
    const cartItems = result.rows;
    const availableItems = cartItems.filter(item => item.is_available_for_checkout);
    const subtotal = availableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const unavailableCount = cartItems.filter(item => !item.is_available_for_checkout).length;

    res.json({
      cartItems,
      summary: {
        subtotal: subtotal.toFixed(2),
        itemCount: cartItems.length,
        totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        has_unavailable_items: unavailableCount > 0,
        unavailable_count: unavailableCount
      }
    });

  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error fetching cart' });
  }
});

// Add item to cart
router.post('/', async (req, res) => {
  try {
    // Dev logging: show incoming payload and minimal headers to aid debugging
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('[DEV] Add to cart request body:', req.body);
        console.debug('[DEV] Add to cart auth header present:', !!req.headers.authorization);
      } catch (e) {}
    }
    let { productId, quantity = 1 } = req.body;
    productId = parseInt(productId, 10);
    quantity = parseInt(quantity, 10) || 1;
    const token = req.headers.authorization?.split(' ')[1];
    const sessionId = req.body.sessionId;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Prevent superadmin from adding to cart
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'super_admin') {
          return res.status(403).json({ message: 'Super admin cannot add items to cart' });
        }
      } catch (e) {
        // Invalid token, continue as guest
      }
    }

    // Check if product exists and is available
    const productResult = await pool.query(
      `SELECT p.id, p.stock_quantity, p.is_available, p.expiry_date,
              COALESCE(p.is_admin_disabled, false) as is_admin_disabled,
              COALESCE(u.is_disabled, false) as farmer_is_disabled
       FROM products p
       LEFT JOIN users u ON p.farmer_id = u.id
       WHERE p.id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = productResult.rows[0];
    if (product.is_admin_disabled) {
      return res.status(400).json({ message: 'Product is not available' });
    }

    if (product.farmer_is_disabled) {
      return res.status(400).json({ message: 'Product is not available' });
    }

    if (!product.is_available) {
      return res.status(400).json({ message: 'Product is not available' });
    }

    if (product.expiry_date && new Date(product.expiry_date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Product is already expired' });
    }

    if (quantity > product.stock_quantity) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        // Invalid token, treat as guest
      }
    }

    if (userId) {
      // Logged in user - check if item already in cart
      const existingItem = await pool.query(
        'SELECT id, quantity FROM cart WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
      );

      if (existingItem.rows.length > 0) {
        // Update quantity
        const newQuantity = existingItem.rows[0].quantity + quantity;
        if (newQuantity > product.stock_quantity) {
          return res.status(400).json({ message: 'Not enough stock available' });
        }

        await pool.query(
          'UPDATE cart SET quantity = $1 WHERE id = $2',
          [newQuantity, existingItem.rows[0].id]
        );
      } else {
        // Add new item - handle possible race condition using upsert fallback
        try {
          await pool.query(
            'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)',
            [userId, productId, quantity]
          );
        } catch (err) {
          // If another request inserted the same row concurrently, update quantity instead
          if (err && err.code === '23505') {
            const existing = await pool.query('SELECT id, quantity FROM cart WHERE user_id = $1 AND product_id = $2', [userId, productId]);
            if (existing.rows.length > 0) {
              const newQuantity = existing.rows[0].quantity + quantity;
              if (newQuantity > product.stock_quantity) {
                return res.status(400).json({ message: 'Not enough stock available' });
              }
              await pool.query('UPDATE cart SET quantity = $1 WHERE id = $2', [newQuantity, existing.rows[0].id]);
            }
          } else {
            throw err;
          }
        }
      }
    } else if (sessionId) {
      // Guest user - check if item already in cart
      const existingItem = await pool.query(
        'SELECT id, quantity FROM cart WHERE session_id = $1 AND product_id = $2',
        [sessionId, productId]
      );

      if (existingItem.rows.length > 0) {
        // Update quantity
        const newQuantity = existingItem.rows[0].quantity + quantity;
        if (newQuantity > product.stock_quantity) {
          return res.status(400).json({ message: 'Not enough stock available' });
        }

        await pool.query(
          'UPDATE cart SET quantity = $1 WHERE id = $2',
          [newQuantity, existingItem.rows[0].id]
        );
      } else {
        // Add new item - handle race with upsert fallback
        try {
          await pool.query(
            'INSERT INTO cart (session_id, product_id, quantity) VALUES ($1, $2, $3)',
            [sessionId, productId, quantity]
          );
        } catch (err) {
          if (err && err.code === '23505') {
            const existing = await pool.query('SELECT id, quantity FROM cart WHERE session_id = $1 AND product_id = $2', [sessionId, productId]);
            if (existing.rows.length > 0) {
              const newQuantity = existing.rows[0].quantity + quantity;
              if (newQuantity > product.stock_quantity) {
                return res.status(400).json({ message: 'Not enough stock available' });
              }
              await pool.query('UPDATE cart SET quantity = $1 WHERE id = $2', [newQuantity, existing.rows[0].id]);
            }
          } else {
            throw err;
          }
        }
      }
    } else {
      return res.status(400).json({ message: 'Session ID required for guest users' });
    }

    res.json({ message: 'Item added to cart successfully' });

  } catch (error) {
    console.error('Add to cart error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ message: error.message || 'Server error adding item to cart', stack: error.stack });
    }
    res.status(500).json({ message: 'Server error adding item to cart' });
  }
});

// Update cart item quantity
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        // Invalid token
      }
    }

    // Check if cart item exists and belongs to user or guest session
    let cartQuery, cartParams;
    const sessionId = req.body.sessionId;

    if (userId) {
      cartQuery = `SELECT c.*, p.stock_quantity, p.is_available, p.expiry_date,
             COALESCE(p.is_admin_disabled, false) as is_admin_disabled,
             COALESCE(u.is_disabled, false) as farmer_is_disabled
           FROM cart c
           JOIN products p ON c.product_id = p.id
           LEFT JOIN users u ON p.farmer_id = u.id
           WHERE c.id = $1 AND c.user_id = $2`;
      cartParams = [id, userId];
    } else if (sessionId) {
      cartQuery = `SELECT c.*, p.stock_quantity, p.is_available, p.expiry_date,
             COALESCE(p.is_admin_disabled, false) as is_admin_disabled,
             COALESCE(u.is_disabled, false) as farmer_is_disabled
           FROM cart c
           JOIN products p ON c.product_id = p.id
           LEFT JOIN users u ON p.farmer_id = u.id
           WHERE c.id = $1 AND c.session_id = $2`;
      cartParams = [id, sessionId];
    } else {
      return res.status(401).json({ message: 'Authentication or session required' });
    }

    const cartResult = await pool.query(cartQuery, cartParams);

    if (cartResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const cartItem = cartResult.rows[0];
    if (cartItem.is_admin_disabled || cartItem.farmer_is_disabled || !cartItem.is_available) {
      return res.status(400).json({ message: 'Product is not available' });
    }

    if (cartItem.expiry_date && new Date(cartItem.expiry_date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Product is already expired' });
    }

    if (quantity > cartItem.stock_quantity) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    await pool.query('UPDATE cart SET quantity = $1 WHERE id = $2', [quantity, id]);

    res.json({ message: 'Cart item updated successfully' });

  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: 'Server error updating cart item' });
  }
});

// Remove item from cart
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    const sessionId = req.body?.sessionId;

    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        // Invalid token
      }
    }

    let cartQuery, cartParams;
    if (userId) {
      // Check if cart item belongs to user
      cartQuery = 'SELECT id FROM cart WHERE id = $1 AND user_id = $2';
      cartParams = [id, userId];
    } else if (sessionId) {
      // Check if cart item belongs to guest session
      cartQuery = 'SELECT id FROM cart WHERE id = $1 AND session_id = $2';
      cartParams = [id, sessionId];
    } else {
      return res.status(401).json({ message: 'Authentication or session required' });
    }

    const cartResult = await pool.query(cartQuery, cartParams);

    if (cartResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    await pool.query('DELETE FROM cart WHERE id = $1', [id]);

    res.json({ message: 'Item removed from cart successfully' });

  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: 'Server error removing item from cart' });
  }
});

// Clear cart
router.delete('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const sessionId = req.query.sessionId;

    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        // Invalid token
      }
    }

    if (userId) {
      await pool.query('DELETE FROM cart WHERE user_id = $1', [userId]);
    } else if (sessionId) {
      await pool.query('DELETE FROM cart WHERE session_id = $1', [sessionId]);
    } else {
      return res.status(400).json({ message: 'Authentication or session ID required' });
    }

    res.json({ message: 'Cart cleared successfully' });

  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Server error clearing cart' });
  }
});

// Migrate guest cart to user cart (when user logs in)
router.post('/migrate', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token || !sessionId) {
      return res.status(400).json({ message: 'Session ID and authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Get guest cart items
    const guestCart = await pool.query(
      'SELECT product_id, quantity FROM cart WHERE session_id = $1',
      [sessionId]
    );

    // Migrate each item
    for (const item of guestCart.rows) {
      const existingItem = await pool.query(
        'SELECT id, quantity FROM cart WHERE user_id = $1 AND product_id = $2',
        [userId, item.product_id]
      );

      if (existingItem.rows.length > 0) {
        // Update existing item quantity
        const newQuantity = existingItem.rows[0].quantity + item.quantity;
        await pool.query(
          'UPDATE cart SET quantity = $1 WHERE id = $2',
          [newQuantity, existingItem.rows[0].id]
        );
      } else {
        // Add new item
        await pool.query(
          'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)',
          [userId, item.product_id, item.quantity]
        );
      }
    }

    // Clear guest cart
    await pool.query('DELETE FROM cart WHERE session_id = $1', [sessionId]);

    res.json({ message: 'Cart migrated successfully' });

  } catch (error) {
    console.error('Migrate cart error:', error);
    res.status(500).json({ message: 'Server error migrating cart' });
  }
});

// Alias: /merge mirrors /migrate (per master-plan.md spec)
router.post('/merge', (req, res, next) => {
  req.url = '/migrate';
  router.handle(req, res, next);
});

module.exports = router;