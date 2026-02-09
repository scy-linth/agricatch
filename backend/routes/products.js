const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { productUpload } = require('../middleware/upload');
const { deleteFileIfExists, resolvePublicPath } = require('../utils/fileUtils');
const { broadcastEvent } = require('../utils/realtime');

const router = express.Router();
const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agriculture_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: pgSsl,
});

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
  } catch (error) {
    return null;
  }
};

// Get all products with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;
    const user = getUserFromToken(req);
    const userId = user?.id;

    // Build query parts
    const baseFrom = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.is_available = true
    `;
    
    const params = [];
    const countParams = [];
    let paramIndex = 1;

    // Build SELECT clause with wishlist check
    let wishlistSelect = ', false as is_in_wishlist';
    if (userId) {
      wishlistSelect = `, EXISTS (SELECT 1 FROM wishlist w WHERE w.user_id = $${paramIndex} AND w.product_id = p.id) as is_in_wishlist`;
      params.push(userId);
      paramIndex++;
    }

    let selectClause = `
      SELECT p.*, c.name as category_name, u.full_name as farmer_name, p.location as farm_location,
             COALESCE(u.is_verified, false) as farmer_verified,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
             (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews${wishlistSelect}
    `;

    let whereClause = '';
    let countWhereClause = '';
    let countParamIdx = 1;
    
    // Add category filter
    if (category) {
      whereClause += ` AND c.name = $${paramIndex}`;
      params.push(category);
      paramIndex++;
      
      countWhereClause += ` AND c.name = $${countParamIdx}`;
      countParams.push(category);
      countParamIdx++;
    }

    // Add search filter
    if (search) {
      const searchTerm = `%${search}%`;
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(searchTerm);
      paramIndex++;
      
      countWhereClause += ` AND (p.name ILIKE $${countParamIdx} OR p.description ILIKE $${countParamIdx})`;
      countParams.push(searchTerm);
      countParamIdx++;
    }

    // Build final queries
    let query = selectClause + baseFrom + whereClause + ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    let countQuery = `SELECT COUNT(*) ${baseFrom}${countWhereClause}`;

    const [productsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    const totalProducts = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalProducts / limit);

    res.json({
      products: productsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProducts,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error fetching products', error: error.message });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUserFromToken(req);
    const userId = user?.id;

    const result = await pool.query(`
      SELECT p.*, c.name as category_name, u.full_name as farmer_name, u.phone as farmer_phone,
             COALESCE(p.location, u.address) as farm_location, u.email as farmer_email,
             COALESCE(u.is_verified, false) as farmer_verified,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
             (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews,
             ${userId ? `EXISTS (SELECT 1 FROM wishlist w WHERE w.user_id = $2 AND w.product_id = p.id)` : 'false'} as is_in_wishlist
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.id = $1 AND p.is_available = true
    `, userId ? [id, userId] : [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ product: result.rows[0] });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Server error fetching product' });
  }
});

// Get products by farmer (for farmer dashboard)
router.get('/farmer/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;

    const result = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.farmer_id = $1
      ORDER BY p.created_at DESC
    `, [farmerId]);

    res.json({ products: result.rows });

  } catch (error) {
    console.error('Get farmer products error:', error);
    res.status(500).json({ message: 'Server error fetching farmer products' });
  }
});

// Add new product (for farmers)
router.post('/', productUpload.single('image'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

    // Check if user is a farmer
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows[0].role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can add products' });
    }

    const {
      name,
      description,
      price,
      category_id,
      stock_quantity,
      unit,
      image_url,
      location,
      harvest_date,
      expiry_date
    } = req.body;

    // Always use the Cloudinary URL from the request body
    let imageUrl = image_url || null;

    // Auto-populate location with shop address if not provided
    let productLocation = location;
    if (!productLocation || productLocation.trim() === '') {
      const farmerResult = await pool.query('SELECT address FROM users WHERE id = $1', [decoded.id]);
      productLocation = farmerResult.rows[0]?.address || null;
    }

    const result = await pool.query(`
      INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity,
                           unit, image_url, location, harvest_date, expiry_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, description, price, category_id, decoded.id, stock_quantity,
         unit, imageUrl, productLocation, harvest_date, expiry_date]);

    broadcastEvent('product.updated', {
      action: 'product.create',
      product_id: Number(result.rows[0].id),
      farmer_id: Number(decoded.id)
    });

    res.status(201).json({
      message: 'Product added successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ message: 'Server error adding product' });
  }
});

// Update product (for farmers)
router.put('/:id', productUpload.single('image'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    const { id } = req.params;

    // Check if product belongs to the farmer
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const current = productResult.rows[0];

    if (Number(current.farmer_id) !== Number(decoded.id)) {
      return res.status(403).json({ message: 'You can only update your own products' });
    }

    const {
      name,
      description,
      price,
      category_id,
      stock_quantity,
      unit,
      image_url,
      location,
      harvest_date,
      expiry_date,
      is_available
    } = req.body;

    const nextName = typeof name === 'undefined' ? current.name : name;
    const nextDescription = typeof description === 'undefined' ? current.description : description;
    const nextPrice = typeof price === 'undefined' ? current.price : price;
    const nextCategoryId = typeof category_id === 'undefined' ? current.category_id : category_id;
    const nextStockQuantity = typeof stock_quantity === 'undefined' ? current.stock_quantity : stock_quantity;
    const nextUnit = typeof unit === 'undefined' ? current.unit : unit;
    const nextLocation = typeof location === 'undefined' ? current.location : location;
    const nextHarvestDate = typeof harvest_date === 'undefined' ? current.harvest_date : harvest_date;
    const nextExpiryDate = typeof expiry_date === 'undefined' ? current.expiry_date : expiry_date;
    const nextIsAvailable = typeof is_available === 'undefined' ? current.is_available : is_available;

    // Always use the Cloudinary URL from the request body
    let imageUrl = typeof image_url === 'undefined' ? current.image_url : image_url;

    await pool.query(`
      UPDATE products SET
        name = $1, description = $2, price = $3, category_id = $4,
        stock_quantity = $5, unit = $6, image_url = $7, location = $8,
        harvest_date = $9, expiry_date = $10, is_available = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
    `, [nextName, nextDescription, nextPrice, nextCategoryId, nextStockQuantity, nextUnit,
         imageUrl, nextLocation, nextHarvestDate, nextExpiryDate, nextIsAvailable, id]);

    broadcastEvent('product.updated', {
      action: 'product.update',
      product_id: Number(id),
      farmer_id: Number(decoded.id)
    });

    res.json({ message: 'Product updated successfully' });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

// Delete product (for farmers)
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    const { id } = req.params;

    // Check if product belongs to the farmer
    const productResult = await pool.query('SELECT farmer_id, image_url FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (Number(productResult.rows[0].farmer_id) !== Number(decoded.id)) {
      return res.status(403).json({ message: 'You can only delete your own products' });
    }

    // Check if product has active orders (not delivered or cancelled)
    const activeOrdersCheck = await pool.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE product_id = $1 AND status NOT IN ('delivered', 'cancelled')`,
      [id]
    );
    
    if (parseInt(activeOrdersCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete product because it has active orders. Please cancel or complete all orders first.' 
      });
    }

    // Delete related records first to avoid foreign key constraint errors
    try {
      // Delete from cart
      await pool.query('DELETE FROM cart WHERE product_id = $1', [id]);
      // Delete from wishlist
      await pool.query('DELETE FROM wishlist WHERE product_id = $1', [id]);
      // Delete from reviews
      await pool.query('DELETE FROM reviews WHERE product_id = $1', [id]);
      // Delete from notifications
      await pool.query('DELETE FROM notifications WHERE product_id = $1', [id]);
      // Note: We keep orders and order_items as historical records
      // They can reference a deleted product (product_id will remain but product won't exist)
      
      // Delete the product
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
    } catch (deleteError) {
      console.error('Delete product error:', deleteError);
      // If foreign key constraint error, provide helpful message
      if (deleteError.code === '23503') {
        return res.status(400).json({ 
          message: 'Cannot delete product due to existing related records. Please contact support.' 
        });
      }
      throw deleteError;
    }

    const oldPath = resolvePublicPath(productResult.rows[0].image_url);
    if (oldPath) {
      deleteFileIfExists(oldPath);
    }

    broadcastEvent('product.updated', {
      action: 'product.delete',
      product_id: Number(id),
      farmer_id: Number(decoded.id)
    });

    res.json({ message: 'Product deleted successfully' });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

module.exports = router;