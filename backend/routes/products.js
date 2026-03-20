const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');
const { productUpload } = require('../middleware/upload');
const { deleteFileIfExists, resolvePublicPath } = require('../utils/fileUtils');
const { broadcastEvent } = require('../utils/realtime');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
  } catch (error) {
    return null;
  }
};

const FISHERY_KEYWORDS_PATTERN = '(fishery|seafood|fish|tilapia|tuna|prawn|shrimp|crab|lobster|salmon|sardine|mackerel)';
function containsFisheryKeywords(text) {
  return new RegExp(FISHERY_KEYWORDS_PATTERN, 'i').test(String(text || ''));
}

function normalizeDescription(value) {
  if (typeof value === 'undefined' || value === null) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  return cleaned;
}

const NON_EXPIRED_PRODUCT_SQL = `(p.expiry_date IS NULL OR p.expiry_date >= CURRENT_DATE)`;
const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;
const FEATURED_CATEGORY_GROUPS = [
  'Vegetables',
  'Fruits',
  'Meat & Poultry',
  'Rice, Grains & Staples'
];
const DEFAULT_PRODUCT_CATALOG = {
  'Vegetables': [
    'Pechay', 'Kangkong', 'Mustasa', 'Letsugas', 'Malunggay', 'Talong', 'Kamatis', 'Ampalaya', 'Okra', 'Kalabasa',
    'Sayote', 'Upo', 'Patola', 'Patatas', 'Kamote', 'Gabi', 'Labanos', 'Karot', 'Sibuyas', 'Bawang', 'Luya', 'Siling labuyo'
  ],
  'Fruits': [
    'Saging', 'Mangga', 'Papaya', 'Pinya', 'Pakwan', 'Melon', 'Bayabas', 'Rambutan', 'Lanzones', 'Santol',
    'Chico', 'Calamansi', 'Dalandan'
  ],
  'Meat & Poultry': [
    'Baboy - Liempo', 'Baboy - Kasim', 'Baboy - Pigue', 'Baboy - Tadyang', 'Baboy - Atay', 'Baboy - Bituka',
    'Baka - Brisket', 'Baka - Bulalo', 'Baka - Tadyang', 'Baka - Atay', 'Baka - Goto',
    'Manok - Buong manok', 'Manok - Pakpak', 'Manok - Paa', 'Manok - Hita', 'Manok - Dibdib', 'Manok - Atay', 'Manok - Balunbalunan',
    'Itik - Buong itik', 'Itik - Atay'
  ],
  'Rice, Grains & Staples': [
    'Regular na bigas', 'Well-milled na bigas', 'Brown rice', 'Malagkit na bigas', 'Mais', 'Munggo', 'Mani'
  ]
};
const SUGGESTED_PRICE_BASELINE = {
  'kamatis (tomato)': { lowest: 65, average: 75 },
  'talong (eggplant)': { lowest: 70, average: 82 },
  'bawang (garlic)': { lowest: 145, average: 165 },
  'luya (ginger)': { lowest: 115, average: 130 },
  'well-milled rice': { lowest: 52, average: 58 },
  'brown rice': { lowest: 56, average: 62 },
  'native chicken eggs': { lowest: 10, average: 12 },
  'fresh calamansi': { lowest: 95, average: 110 }
};

const isAllowedFarmCategoryId = async (categoryId) => {
  if (typeof categoryId === 'undefined' || categoryId === null || categoryId === '') return false;
  try {
    const result = await pool.query('SELECT name, type FROM categories WHERE id = $1', [categoryId]);
    if (result.rows.length === 0) return false;

    const name = String(result.rows[0].name || '').trim();
    const type = String(result.rows[0].type || '').trim().toLowerCase();

    // Farm-only system: explicitly block fishery categories
    if (type === 'fishery') return false;
    if (/fishery|seafood|fish/i.test(name)) return false;

    return true;
  } catch (_) {
    return false;
  }
};

const ensureProductCatalogSchema = async () => {
  await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS type VARCHAR(50)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_name_catalog (
      id SERIAL PRIMARY KEY,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      name VARCHAR(120) UNIQUE NOT NULL,
      source VARCHAR(30) DEFAULT 'system',
      is_approved BOOLEAN DEFAULT true,
      requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_name_requests (
      id SERIAL PRIMARY KEY,
      category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
      requested_category_name VARCHAR(120),
      name VARCHAR(120) NOT NULL,
      notes TEXT,
      requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'pending',
      review_notes TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE product_name_requests ADD COLUMN IF NOT EXISTS requested_category_name VARCHAR(120)`);

  for (const groupName of FEATURED_CATEGORY_GROUPS) {
    await pool.query(
      `INSERT INTO categories (name, description, type)
       VALUES ($1, $2, 'agricultural')
       ON CONFLICT (name) DO UPDATE SET
         description = EXCLUDED.description,
         type = COALESCE(categories.type, EXCLUDED.type)`,
      [groupName, `${groupName} category`]
    );
  }

  const categoryRows = await pool.query(
    `SELECT id, name FROM categories WHERE name = ANY($1::text[])`,
    [FEATURED_CATEGORY_GROUPS]
  );
  const categoryMap = new Map(categoryRows.rows.map((row) => [row.name, row.id]));

  for (const [groupName, names] of Object.entries(DEFAULT_PRODUCT_CATALOG)) {
    const categoryId = categoryMap.get(groupName);
    if (!categoryId) continue;
    for (const itemName of names) {
      await pool.query(
        `INSERT INTO product_name_catalog (category_id, name, source, is_approved)
         VALUES ($1, $2, 'system', true)
         ON CONFLICT (name) DO NOTHING`,
        [categoryId, itemName]
      );
    }
  }
};

// Get farm categories for product forms and featured filters
router.get('/categories', async (_req, res) => {
  try {
    await ensureProductCatalogSchema();
    const result = await pool.query(
      `SELECT id, name
       FROM categories
       WHERE COALESCE(LOWER(type), 'agricultural') <> 'fishery'
         AND name NOT ILIKE '%fish%'
         AND name NOT ILIKE '%seafood%'
       ORDER BY name ASC`
    );

    const categoriesByLabel = new Map();
    for (const row of result.rows) {
      const rawName = String(row.name || '').trim();
      let label = '';
      if (/^vegetables$/i.test(rawName)) label = 'Vegetables';
      else if (/^fruits$/i.test(rawName)) label = 'Fruits';
      else if (/^meat\s*&\s*poultry$/i.test(rawName)) label = 'Meat & Poultry';
      else if (/^rice$/i.test(rawName) || /^rice,\s*grains\s*&\s*staples$/i.test(rawName) || /^grains?$/i.test(rawName)) label = 'Rice';
      if (!label) continue;
      if (!categoriesByLabel.has(label)) {
        categoriesByLabel.set(label, { id: row.id, name: label });
      }
    }

    const ordered = ['Vegetables', 'Fruits', 'Meat & Poultry', 'Rice']
      .map((label) => categoriesByLabel.get(label))
      .filter(Boolean);

    return res.json({ categories: ordered });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ message: 'Server error fetching categories' });
  }
});

// Farmer custom product-name request (requires staff approval)
router.post('/category-requests', async (req, res) => {
  try {
    const decoded = getUserFromToken(req);
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid or expired token' });

    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);
    const role = roleResult.rows[0]?.role;
    if (role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can request custom product names' });
    }

    const name = String(req.body?.name || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const requestedCategoryName = String(req.body?.requested_category_name || '').trim();
    const parsedCategoryId = Number(req.body?.category_id);
    const categoryId = Number.isFinite(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : 0;

    if (!name) return res.status(400).json({ message: 'Product name is required' });
    if (!categoryId && !requestedCategoryName) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (requestedCategoryName.length > 120) {
      return res.status(400).json({ message: 'Requested category is too long (max 120 chars)' });
    }
    if (name.length > 120) return res.status(400).json({ message: 'Product name is too long (max 120 chars)' });

    await ensureProductCatalogSchema();

    let validCategoryId = null;
    if (categoryId) {
      const categoryResult = await pool.query(
        `SELECT id FROM categories WHERE id = $1 AND (COALESCE(LOWER(type), 'agricultural') <> 'fishery')`,
        [categoryId]
      );
      if (!categoryResult.rows.length) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      validCategoryId = categoryId;
    }

    const catalogCheck = await pool.query(
      `SELECT id FROM product_name_catalog WHERE LOWER(name) = LOWER($1) AND is_approved = true LIMIT 1`,
      [name]
    );
    if (catalogCheck.rows.length) {
      return res.status(409).json({ message: 'This product name is already in the approved catalog' });
    }

    const existingPending = await pool.query(
      `SELECT id FROM product_name_requests
       WHERE requested_by = $1 AND LOWER(name) = LOWER($2) AND status = 'pending'
       LIMIT 1`,
      [decoded.id, name]
    );
    if (existingPending.rows.length) {
      return res.status(409).json({ message: 'You already have a pending request for this product name' });
    }

    const inserted = await pool.query(
      `INSERT INTO product_name_requests (category_id, requested_category_name, name, notes, requested_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, category_id, requested_category_name, name, notes, status, created_at`,
      [validCategoryId, requestedCategoryName || null, name, notes || null, decoded.id]
    );

    return res.status(201).json({
      message: 'Request submitted. Staff will review and approve it.',
      request: inserted.rows[0]
    });
  } catch (error) {
    console.error('Create category request error:', error);
    return res.status(500).json({ message: 'Server error creating request' });
  }
});

const getMyCategoryRequestsHandler = async (req, res) => {
  try {
    const decoded = getUserFromToken(req);
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid or expired token' });
    const userId = decoded.id;

    const result = await pool.query(
      `SELECT r.id, r.category_id, r.requested_category_name, c.name as category_name, r.name, r.notes, r.status, r.review_notes, r.reviewed_at, r.created_at
       FROM product_name_requests r
       LEFT JOIN categories c ON r.category_id = c.id
       WHERE r.requested_by = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get my category requests error:', error.message);
    return res.status(500).json({ message: 'Server error fetching requests' });
  }
};

// Get current farmer's product name requests (history)
router.get('/category-requests/mine', getMyCategoryRequestsHandler);
router.get('/requests/mine', getMyCategoryRequestsHandler);

// Get all products with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'latest' } = req.query;
    const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const limitNumber = Math.min(Math.max(Number.parseInt(req.query.limit || '12', 10), 1), 48);
    const offset = (pageNumber - 1) * limitNumber;
    const user = getUserFromToken(req);
    const userId = user?.id;

    const normalizedSort = String(sort || 'latest').trim().toLowerCase();
    const orderByMap = {
      latest: 'p.created_at DESC',
      harvest_date: 'p.harvest_date DESC NULLS LAST, p.created_at DESC',
      expiry_date: 'p.expiry_date ASC NULLS LAST, p.created_at DESC',
      expiration_date: 'p.expiry_date ASC NULLS LAST, p.created_at DESC',
      ratings: 'average_rating DESC, total_reviews DESC, p.created_at DESC',
      top_sales: 'p.sales_count DESC, p.created_at DESC',
      price_low_high: 'p.price ASC, p.created_at DESC',
      price_high_low: 'p.price DESC, p.created_at DESC'
    };
    const orderByClause = orderByMap[normalizedSort] || orderByMap.latest;

    // Build query parts
    const baseFrom = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.is_available = true
        AND ${NON_EXPIRED_PRODUCT_SQL}
        AND (
          c.id IS NULL
          OR (COALESCE(LOWER(c.type), 'agricultural') <> 'fishery'
              AND c.name NOT ILIKE '%fish%'
              AND c.name NOT ILIKE '%seafood%')
        )
        AND (
          p.name !~* '${FISHERY_KEYWORDS_PATTERN}'
          AND (p.description IS NULL OR p.description !~* '${FISHERY_KEYWORDS_PATTERN}')
        )
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
              COALESCE(u.average_rating, 0) as farmer_average_rating,
              COALESCE(u.total_reviews, 0) as farmer_total_reviews,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
             (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews${wishlistSelect}
    `;

    let whereClause = '';
    let countWhereClause = '';
    let countParamIdx = 1;
    
    // Add category filter
    if (category) {
      const normalizedCategory = String(category).trim().toLowerCase();
      if (normalizedCategory === 'rice') {
        whereClause += ` AND (c.name = ANY($${paramIndex}::text[]))`;
        params.push(['Rice', 'Rice, Grains & Staples', 'Grains']);
        paramIndex++;

        countWhereClause += ` AND (c.name = ANY($${countParamIdx}::text[]))`;
        countParams.push(['Rice', 'Rice, Grains & Staples', 'Grains']);
        countParamIdx++;
      } else {
        whereClause += ` AND c.name = $${paramIndex}`;
        params.push(category);
        paramIndex++;

        countWhereClause += ` AND c.name = $${countParamIdx}`;
        countParams.push(category);
        countParamIdx++;
      }
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
    let query = selectClause + baseFrom + whereClause + ` ORDER BY ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNumber, offset);
    
    let countQuery = `SELECT COUNT(*) ${baseFrom}${countWhereClause}`;

    const [productsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    const totalProducts = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalProducts / limitNumber);

    res.json({
      products: productsResult.rows,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalProducts,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error fetching products', error: error.message });
  }
});

// Product name catalog (wet market / agriculture only)
router.get('/catalog/names', async (_req, res) => {
  try {
    await ensureProductCatalogSchema();
    const categoryId = Number(_req.query?.category_id || 0) || null;

    const result = await pool.query(
      `SELECT c.name
       FROM product_name_catalog c
       WHERE c.is_approved = true
         AND ($1::int IS NULL OR c.category_id = $1)
       ORDER BY c.name ASC`,
      [categoryId]
    );

    const names = result.rows.map((row) => row.name).filter(Boolean);
    return res.json({ names });
  } catch (error) {
    console.error('Catalog names error:', error);
    return res.status(500).json({ message: 'Server error fetching catalog names' });
  }
});

// Suggested pricing based on system-wide delivered sales history
router.get('/pricing/suggestion', async (req, res) => {
  try {
    const rawName = String(req.query.name || '').trim();
    const categoryId = req.query.category_id;

    if (!rawName) {
      return res.status(400).json({ message: 'name is required' });
    }

    const baseName = rawName.split('(')[0].trim();

    const runSuggestionQuery = async (opts = { withCategory: false }) => {
      const params = [rawName, baseName ? `${baseName}%` : rawName];
      let whereCategory = '';
      if (opts.withCategory && categoryId) {
        params.push(Number(categoryId));
        whereCategory = ` AND p.category_id = $${params.length}`;
      }

      const result = await pool.query(
        `
          SELECT
            MIN(p.price)::numeric(10,2) AS lowest_price,
            AVG(p.price)::numeric(10,2) AS average_price,
            COUNT(*)::int AS sample_count
          FROM orders o
          JOIN products p ON p.id = o.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE o.status = 'delivered'
            AND (
              c.id IS NULL
              OR (COALESCE(LOWER(c.type), 'agricultural') <> 'fishery'
                  AND c.name NOT ILIKE '%fish%'
                  AND c.name NOT ILIKE '%seafood%')
            )
            AND (
              p.name !~* '${FISHERY_KEYWORDS_PATTERN}'
              AND (p.description IS NULL OR p.description !~* '${FISHERY_KEYWORDS_PATTERN}')
            )
            AND (
              p.name ILIKE $1
              OR p.name ILIKE $2
            )
            ${whereCategory}
        `,
        params
      );

      return result.rows?.[0] || {};
    };

    // First try category-scoped suggestion (if category is selected), then
    // fall back to system-wide history if no delivered samples exist in that category.
    let row = await runSuggestionQuery({ withCategory: !!categoryId });
    if (categoryId && Number(row.sample_count || 0) <= 0) {
      row = await runSuggestionQuery({ withCategory: false });
    }

    const normalizedKey = rawName.toLowerCase();
    const fallback = SUGGESTED_PRICE_BASELINE[normalizedKey] || null;
    const hasSample = Number(row.sample_count || 0) > 0;

    return res.json({
      name: rawName,
      suggested_lowest_price: hasSample
        ? (row.lowest_price ? Number(row.lowest_price) : null)
        : (fallback ? fallback.lowest : null),
      average_price: hasSample
        ? (row.average_price ? Number(row.average_price) : null)
        : (fallback ? fallback.average : null),
      sample_count: Number(row.sample_count || 0),
      is_baseline_estimate: !hasSample && !!fallback
    });
  } catch (error) {
    console.error('Pricing suggestion error:', error);
    return res.status(500).json({ message: 'Server error fetching pricing suggestion' });
  }
});

// Best-selling low-price products for landing section
router.get('/featured', async (req, res) => {
  try {
    await ensureProductCatalogSchema();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '6', 10), 1), 12);
    const category = String(req.query.category || '').trim();

    let categoryFilterSql = '';
    const params = [limit];
    if (category) {
      params.push(category);
      categoryFilterSql = ` AND c.name = $${params.length}`;
    }

    const result = await pool.query(
      `
        SELECT p.*, u.full_name AS farmer_name,
               COALESCE(u.average_rating, 0) as farmer_average_rating,
               COALESCE(u.total_reviews, 0) as farmer_total_reviews,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) AS average_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS total_reviews
        FROM products p
        LEFT JOIN users u ON u.id = p.farmer_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_available = true
          AND p.stock_quantity > 0
          AND COALESCE(p.sales_count, 0) > 0
          AND ${NON_EXPIRED_PRODUCT_SQL}
          AND (
            c.id IS NULL
            OR (COALESCE(LOWER(c.type), 'agricultural') <> 'fishery'
                AND c.name NOT ILIKE '%fish%'
                AND c.name NOT ILIKE '%seafood%')
          )
          AND (
            p.name !~* '${FISHERY_KEYWORDS_PATTERN}'
            AND (p.description IS NULL OR p.description !~* '${FISHERY_KEYWORDS_PATTERN}')
          )
          ${categoryFilterSql}
        ORDER BY p.price ASC, p.sales_count DESC, p.created_at DESC
        LIMIT $1
      `,
      params
    );

    if (result.rows.length > 0) {
      return res.json({ products: result.rows });
    }

    return res.json({
      products: [
        { id: null, name: 'Kamatis (tomato)', price: 65, unit: 'kg', sales_count: 38, farmer_name: 'Mendoza Farm', image_url: '/images/logo.png' },
        { id: null, name: 'Talong (eggplant)', price: 70, unit: 'kg', sales_count: 35, farmer_name: 'Santos Growers', image_url: '/images/logo.png' },
        { id: null, name: 'Bawang (garlic)', price: 150, unit: 'kg', sales_count: 30, farmer_name: 'Ilocos Agro', image_url: '/images/logo.png' },
        { id: null, name: 'Brown rice', price: 58, unit: 'kg', sales_count: 52, farmer_name: 'Nueva Ecija Rice Hub', image_url: '/images/logo.png' },
        { id: null, name: 'Luya (ginger)', price: 120, unit: 'kg', sales_count: 24, farmer_name: 'Bukidnon Fresh', image_url: '/images/logo.png' },
        { id: null, name: 'Native chicken eggs', price: 11, unit: 'pieces', sales_count: 58, farmer_name: 'San Jose Poultry', image_url: '/images/logo.png' }
      ]
    });
  } catch (error) {
    console.error('Featured products error:', error);
    return res.status(500).json({ message: 'Server error fetching featured products' });
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
             COALESCE(u.average_rating, 0) as farmer_average_rating,
             COALESCE(u.total_reviews, 0) as farmer_total_reviews,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
             (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews,
             ${userId ? `EXISTS (SELECT 1 FROM wishlist w WHERE w.user_id = $2 AND w.product_id = p.id)` : 'false'} as is_in_wishlist
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.id = $1
        AND p.is_available = true
        AND ${NON_EXPIRED_PRODUCT_SQL}
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

// Similar products from other farmer shops for product details modal
router.get('/:id/similar-sellers', async (req, res) => {
  try {
    const { id } = req.params;

    const targetRes = await pool.query(
      `SELECT id, name, category_id, farmer_id FROM products WHERE id = $1`,
      [id]
    );

    if (targetRes.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const target = targetRes.rows[0];

    const similarRes = await pool.query(
      `
        SELECT p.id, p.name, p.price, p.unit, p.stock_quantity, p.sales_count, p.image_url,
               p.farmer_id, u.full_name AS farmer_name,
               COALESCE(u.average_rating, 0) as farmer_average_rating,
               COALESCE(u.total_reviews, 0) as farmer_total_reviews,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) AS average_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS total_reviews
        FROM products p
        LEFT JOIN users u ON u.id = p.farmer_id
        WHERE p.id <> $1
          AND p.farmer_id <> $2
          AND p.is_available = true
          AND p.stock_quantity > 0
          AND ${NON_EXPIRED_PRODUCT_SQL}
          AND (
            LOWER(p.name) = LOWER($3)
            OR p.name ILIKE $4
          )
          AND ($5::int IS NULL OR p.category_id = $5)
        ORDER BY p.price ASC, p.sales_count DESC
        LIMIT 3
      `,
      [id, target.farmer_id, target.name, `${String(target.name || '').split('(')[0].trim()}%`, target.category_id || null]
    );

    const rows = similarRes.rows || [];
    const lowestPrice = rows.length ? Math.min(...rows.map(r => Number(r.price) || 0)) : null;
    const highestSales = rows.length ? Math.max(...rows.map(r => Number(r.sales_count) || 0)) : null;

    const similar = rows.map((item) => {
      const badges = [];
      if (lowestPrice !== null && Number(item.price) === Number(lowestPrice)) badges.push('Lowest Price');
      if (highestSales !== null && Number(item.sales_count) === Number(highestSales) && highestSales > 0) badges.push('Best Selling');
      if (Number(item.average_rating || 0) >= 4.5) badges.push('Top Rated');
      return { ...item, badges };
    });

    if (similar.length > 0) {
      return res.json({ similar });
    }

    const farmersResult = await pool.query(
      `
        SELECT id, full_name,
               COALESCE(average_rating, 0) AS farmer_average_rating,
               COALESCE(total_reviews, 0) AS farmer_total_reviews
        FROM users
        WHERE role = 'farmer'
          AND id <> $1
        ORDER BY id ASC
        LIMIT 3
      `,
      [target.farmer_id]
    );

    if (!farmersResult.rows.length) {
      return res.json({ similar: [] });
    }

    const templates = [
      { price: 64, stock: 23, sales: 31 },
      { price: 68, stock: 20, sales: 22 },
      { price: 72, stock: 17, sales: 19 }
    ];

    const ensuredProducts = [];
    for (let index = 0; index < farmersResult.rows.length; index++) {
      const farmer = farmersResult.rows[index];
      const tpl = templates[index] || templates[templates.length - 1];

      const existing = await pool.query(
        `
          SELECT p.id, p.name, p.price, p.unit, p.stock_quantity, p.sales_count, p.image_url, p.farmer_id
          FROM products p
          WHERE p.farmer_id = $1
            AND LOWER(p.name) = LOWER($2)
            AND p.is_available = true
            AND ${NON_EXPIRED_PRODUCT_SQL}
          ORDER BY p.created_at DESC
          LIMIT 1
        `,
        [farmer.id, target.name]
      );

      let productRow = existing.rows[0];
      if (!productRow) {
        const inserted = await pool.query(
          `
            INSERT INTO products (
              name, description, price, category_id, farmer_id, stock_quantity,
              unit, image_url, sales_count, is_available
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING id, name, price, unit, stock_quantity, sales_count, image_url, farmer_id
          `,
          [
            target.name,
            'Placeholder listing created for prototype similar-shop preview.',
            tpl.price,
            target.category_id,
            farmer.id,
            tpl.stock,
            'kg',
            '/images/logo.png',
            tpl.sales
          ]
        );
        productRow = inserted.rows[0];
      }

      ensuredProducts.push({
        ...productRow,
        farmer_name: farmer.full_name,
        farmer_average_rating: Number(farmer.farmer_average_rating || 0),
        farmer_total_reviews: Number(farmer.farmer_total_reviews || 0),
        average_rating: Number(farmer.farmer_average_rating || 0),
        total_reviews: Number(farmer.farmer_total_reviews || 0)
      });
    }

    const ensuredLowestPrice = ensuredProducts.length ? Math.min(...ensuredProducts.map(r => Number(r.price) || 0)) : null;
    const ensuredHighestSales = ensuredProducts.length ? Math.max(...ensuredProducts.map(r => Number(r.sales_count) || 0)) : null;

    const fallbackWithBadges = ensuredProducts.map((item) => {
      const badges = [];
      if (ensuredLowestPrice !== null && Number(item.price) === Number(ensuredLowestPrice)) badges.push('Lowest Price');
      if (ensuredHighestSales !== null && Number(item.sales_count) === Number(ensuredHighestSales) && ensuredHighestSales > 0) badges.push('Best Selling');
      if (Number(item.average_rating || 0) >= 4.5) badges.push('Top Rated');
      return { ...item, badges };
    });

    return res.json({ similar: fallbackWithBadges });
  } catch (error) {
    console.error('Similar sellers error:', error);
    return res.status(500).json({ message: 'Server error fetching similar sellers' });
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

    const normalizedDescription = normalizeDescription(description);

    if (normalizedDescription && normalizedDescription.length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
      return res.status(400).json({ message: `Description must be ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters or less.` });
    }

    // Farm-only system: block fishery items even if category is wrong
    if (containsFisheryKeywords(name) || containsFisheryKeywords(normalizedDescription)) {
      return res.status(400).json({ message: 'Fishery/seafood items are not allowed in this system.' });
    }

    // Farm-only system: block fishery categories
    if (!(await isAllowedFarmCategoryId(category_id))) {
      return res.status(400).json({ message: 'Invalid category. Fishery categories are not allowed.' });
    }

    // Determine image URL: prefer explicit `image_url`, otherwise upload file to Cloudinary
    let imageUrl = null;
    if (image_url && String(image_url).trim() !== '') {
      imageUrl = image_url;
    } else if (req.file && req.file.path) {
      try {
        const uploaded = await cloudinary.uploader.upload(req.file.path, {
          folder: 'products',
          use_filename: true,
          unique_filename: false,
          resource_type: 'image',
          transformation: [
            { width: 1200, crop: 'limit', quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        imageUrl = uploaded.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        return res.status(500).json({ message: 'Image upload failed' });
      } finally {
        deleteFileIfExists(req.file.path);
      }
    }

    // Auto-populate location with shop address if not provided
    let productLocation = location;
    if (!productLocation || productLocation.trim() === '') {
      const farmerResult = await pool.query('SELECT address FROM users WHERE id = $1', [decoded.id]);
      productLocation = farmerResult.rows[0]?.address || null;
    }

    // Normalize optional date fields: treat empty strings as NULL
    const harvestDateValue = (harvest_date && String(harvest_date).trim() !== '') ? harvest_date : null;
    const expiryDateValue = (expiry_date && String(expiry_date).trim() !== '') ? expiry_date : null;

    const result = await pool.query(`
      INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity,
                           unit, image_url, location, harvest_date, expiry_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, normalizedDescription, price, category_id, decoded.id, stock_quantity,
         unit, imageUrl, productLocation, harvestDateValue, expiryDateValue]);

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
    const nextDescription = typeof description === 'undefined' ? current.description : normalizeDescription(description);
    const nextPrice = typeof price === 'undefined' ? current.price : price;
    const nextCategoryId = typeof category_id === 'undefined' ? current.category_id : category_id;
    const nextStockQuantity = typeof stock_quantity === 'undefined' ? current.stock_quantity : stock_quantity;
    const nextUnit = typeof unit === 'undefined' ? current.unit : unit;
    const nextLocation = typeof location === 'undefined' ? current.location : location;
    const nextHarvestDate = (typeof harvest_date === 'undefined') ? current.harvest_date : (String(harvest_date).trim() === '' ? null : harvest_date);
    const nextExpiryDate = (typeof expiry_date === 'undefined') ? current.expiry_date : (String(expiry_date).trim() === '' ? null : expiry_date);
    const nextIsAvailable = typeof is_available === 'undefined' ? current.is_available : is_available;

    if (nextDescription && String(nextDescription).length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
      return res.status(400).json({ message: `Description must be ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters or less.` });
    }

    // Farm-only system: block fishery items even if category is wrong
    if (containsFisheryKeywords(nextName) || containsFisheryKeywords(nextDescription)) {
      return res.status(400).json({ message: 'Fishery/seafood items are not allowed in this system.' });
    }

    // Farm-only system: block fishery categories
    if (!(await isAllowedFarmCategoryId(nextCategoryId))) {
      return res.status(400).json({ message: 'Invalid category. Fishery categories are not allowed.' });
    }

    // Determine image URL: prefer explicit `image_url`, otherwise upload file to Cloudinary, otherwise keep current
    let imageUrl = current.image_url;
    if (typeof image_url !== 'undefined' && image_url !== null && String(image_url).trim() !== '') {
      imageUrl = image_url;
    } else if (req.file && req.file.path) {
      try {
        const uploaded = await cloudinary.uploader.upload(req.file.path, {
          folder: 'products',
          use_filename: true,
          unique_filename: false,
          resource_type: 'image',
          transformation: [
            { width: 1200, crop: 'limit', quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        imageUrl = uploaded.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        return res.status(500).json({ message: 'Image upload failed' });
      } finally {
        deleteFileIfExists(req.file.path);
      }
    }

    // If a new file was uploaded and an old image exists on disk, delete the old file
    if (req.file && current.image_url) {
      try {
        const oldPath = resolvePublicPath(current.image_url);
        if (oldPath) deleteFileIfExists(oldPath);
      } catch (e) {
        console.warn('Failed to delete old product image:', e.message || e);
      }
    }

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