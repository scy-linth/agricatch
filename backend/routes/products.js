const express = require('express');
const jwt = require('jsonwebtoken');
const { productUpload } = require('../middleware/upload');
const { deleteFileIfExists, resolvePublicPath } = require('../utils/fileUtils');
const { broadcastEvent } = require('../utils/realtime');
const cloudinary = require('../utils/cloudinary');
const { pool } = require('../utils/db');

const router = express.Router();

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
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

const extractCloudinaryPublicId = (url) => {
  if (!url) return null;
  const value = String(url).trim();
  const match = value.match(
    /^https:\/\/res\.cloudinary\.com\/[^\/]+\/(?:image|video)\/upload\/(?:[^\/]+\/)*?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/
  );
  return match && match[1] ? match[1] : null;
};

const categorizedProductPublicId = ({ categoryName, productName, userId }) => {
  return cloudinary.publicIdForCategorizedProduct({
    categoryName,
    productName,
    userId,
    extension: 'jpeg'
  });
};

const categorizedProductPublicIdPrefix = ({ categoryName, productName, userId }) => {
  return `agricatch/${cloudinary.slugify(categoryName || 'uncategorized')}/${cloudinary.slugify(productName || 'product')}/${String(userId || 'unknown').trim()}-`;
};

const loadCategoryNameById = async (categoryId) => {
  const id = Number.parseInt(categoryId, 10);
  if (!Number.isFinite(id) || id <= 0) return 'uncategorized';
  const result = await pool.query('SELECT name FROM categories WHERE id = $1 LIMIT 1', [id]);
  return String(result.rows?.[0]?.name || 'uncategorized').trim() || 'uncategorized';
};

const cloudinaryUrlForPublicId = (publicId) => {
  try {
    return cloudinary.url(publicId, { secure: true });
  } catch (_) {
    return null;
  }
};

const rehomeProductImageToCategorizedId = async ({
  categoryName,
  productName,
  userId,
  imagePublicId,
  imageUrl
}) => {
  const sourcePublicId = imagePublicId || extractCloudinaryPublicId(imageUrl);
  if (!sourcePublicId) {
    return { imagePublicId, imageUrl, changed: false };
  }

  const targetPrefix = categorizedProductPublicIdPrefix({ categoryName, productName, userId });
  if (sourcePublicId.startsWith(targetPrefix)) {
    return { imagePublicId: sourcePublicId, imageUrl, changed: false };
  }

  const targetPublicId = categorizedProductPublicId({ categoryName, productName, userId });
  if (!targetPublicId || sourcePublicId === targetPublicId) {
    return { imagePublicId: sourcePublicId, imageUrl, changed: false };
  }

  try {
    const renamed = await cloudinary.uploader.rename(sourcePublicId, targetPublicId, {
      resource_type: 'image',
      overwrite: true,
      invalidate: true
    });
    return {
      imagePublicId: renamed.public_id || targetPublicId,
      imageUrl: renamed.secure_url || cloudinaryUrlForPublicId(targetPublicId) || imageUrl,
      changed: true
    };
  } catch (err) {
    const message = String(err && (err.message || err));
    const isMissingSource = /not found|404/i.test(message);
    if (isMissingSource) {
      try {
        const existing = await cloudinary.api.resource(targetPublicId, { resource_type: 'image' });
        return {
          imagePublicId: targetPublicId,
          imageUrl: existing.secure_url || cloudinaryUrlForPublicId(targetPublicId) || imageUrl,
          changed: imagePublicId !== targetPublicId
        };
      } catch (_) {
        // Fall through and keep existing DB values if neither source nor target is available.
      }
    }
    console.warn('Failed to rehome product image to categorized public_id:', sourcePublicId, '->', targetPublicId, message);
    return { imagePublicId: sourcePublicId, imageUrl, changed: false };
  }
};

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
    const result = await pool.query('SELECT name, type, is_disabled FROM categories WHERE id = $1', [categoryId]);
    if (result.rows.length === 0) return false;

    const name = String(result.rows[0].name || '').trim();
    const type = String(result.rows[0].type || '').trim().toLowerCase();
    const isDisabled = !!result.rows[0].is_disabled;

    if (isDisabled) return false;

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
  await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false`);

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
  await pool.query(`ALTER TABLE product_name_catalog ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false`);

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

  // NOTE: Auto-creation of default categories disabled to prevent reappearing categories
  // after admin deletion. Categories should be managed manually through the admin panel.
  // Original code that auto-created FEATURED_CATEGORY_GROUPS has been removed.
};

// Get farm categories for product forms and featured filters
router.get('/categories', async (_req, res) => {
  try {
    await ensureProductCatalogSchema();
    const result = await pool.query(
      `SELECT id, name
       FROM categories
       WHERE COALESCE(LOWER(type), 'agricultural') <> 'fishery'
         AND COALESCE(is_disabled, false) = false
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
    return res.status(500).json({
      message: 'Server error fetching categories',
      debug: String(error?.message || error)
    });
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

    if (requestedCategoryName) {
      const existingCategory = await pool.query(
        'SELECT id, is_disabled FROM categories WHERE LOWER(name) = $1 LIMIT 1',
        [requestedCategoryName.toLowerCase()]
      );
      if (existingCategory.rows.length) {
        return res.status(409).json({
          message: existingCategory.rows[0].is_disabled
            ? 'Category already exists but is disabled. Please contact support.'
            : 'Category already exists. Please select it instead.'
        });
      }
    }

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
        AND COALESCE(p.is_admin_disabled, false) = false
        AND COALESCE(u.is_disabled, false) = false
        AND ${NON_EXPIRED_PRODUCT_SQL}
        AND (
          c.id IS NULL
          OR (COALESCE(c.is_disabled, false) = false
              AND COALESCE(LOWER(c.type), 'agricultural') <> 'fishery'
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
    return res.status(500).json({
      message: 'Server error fetching catalog names',
      debug: String(error?.message || error)
    });
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
               COALESCE(s.sold_qty, 0)::int AS sold_qty,
               COALESCE(u.average_rating, 0) as farmer_average_rating,
               COALESCE(u.total_reviews, 0) as farmer_total_reviews,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) AS average_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS total_reviews
        FROM products p
        LEFT JOIN users u ON u.id = p.farmer_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN (
          SELECT product_id, COALESCE(SUM(quantity), 0)::int AS sold_qty
          FROM orders
          WHERE status = 'delivered'
          GROUP BY product_id
        ) s ON s.product_id = p.id
        WHERE p.is_available = true
          AND COALESCE(p.is_admin_disabled, false) = false
          AND COALESCE(u.is_disabled, false) = false
          AND p.stock_quantity > 0
          AND COALESCE(s.sold_qty, 0) > 0
          AND ${NON_EXPIRED_PRODUCT_SQL}
          AND (
            c.id IS NULL
            OR (COALESCE(c.is_disabled, false) = false
                AND COALESCE(LOWER(c.type), 'agricultural') <> 'fishery'
                AND c.name NOT ILIKE '%fish%'
                AND c.name NOT ILIKE '%seafood%')
          )
          AND (
            p.name !~* '${FISHERY_KEYWORDS_PATTERN}'
            AND (p.description IS NULL OR p.description !~* '${FISHERY_KEYWORDS_PATTERN}')
          )
          ${categoryFilterSql}
        ORDER BY p.price ASC, COALESCE(s.sold_qty, 0) DESC, p.created_at DESC
        LIMIT $1
      `,
      params
    );

    if (result.rows.length > 0) {
      return res.json({ products: result.rows });
    }

    return res.json({ products: [] });
  } catch (error) {
    console.error('Featured products error:', error);
    return res.status(500).json({
      message: 'Server error fetching featured products',
      debug: String(error?.message || error)
    });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUserFromToken(req);
    const userId = user?.id;

    const availabilityFilter = `p.is_available = true
      AND COALESCE(p.is_admin_disabled, false) = false
      AND COALESCE(u.is_disabled, false) = false
      AND ${NON_EXPIRED_PRODUCT_SQL}`;

    let whereClause = 'WHERE p.id = $1';
    const params = [id];

    if (userId === -1) {
      // Super admin can view all products
    } else if (userId) {
      const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      const role = roleResult.rows[0]?.role;
      if (role === 'staff' || role === 'super_admin') {
        // Staff can view all products
      } else if (role === 'farmer') {
        whereClause += ` AND (p.farmer_id = $2 OR (${availabilityFilter}))`;
        params.push(userId);
      } else {
        whereClause += ` AND ${availabilityFilter}`;
      }
    } else {
      whereClause += ` AND ${availabilityFilter}`;
    }

    const result = await pool.query(`
      SELECT p.*, c.name as category_name, u.full_name as farmer_name,
             COALESCE(p.location, u.address) as farm_location,
             COALESCE(u.is_verified, false) as farmer_verified,
             COALESCE(u.average_rating, 0) as farmer_average_rating,
             COALESCE(u.total_reviews, 0) as farmer_total_reviews,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
            (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews,
            p.cloudinary_public_id as cloudinary_public_id,
             ${userId ? `EXISTS (SELECT 1 FROM wishlist w WHERE w.user_id = $${params.length + 1} AND w.product_id = p.id)` : 'false'} as is_in_wishlist
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      ${whereClause}
    `, userId ? [...params, userId] : params);

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
               COALESCE(s.sold_qty, 0)::int AS sold_qty,
               p.farmer_id, u.full_name AS farmer_name,
               COALESCE(u.average_rating, 0) as farmer_average_rating,
               COALESCE(u.total_reviews, 0) as farmer_total_reviews,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) AS average_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS total_reviews
        FROM products p
        LEFT JOIN users u ON u.id = p.farmer_id
        LEFT JOIN (
          SELECT product_id, COALESCE(SUM(quantity), 0)::int AS sold_qty
          FROM orders
          WHERE status = 'delivered'
          GROUP BY product_id
        ) s ON s.product_id = p.id
        WHERE p.id <> $1
          AND p.farmer_id <> $2
          AND p.is_available = true
          AND COALESCE(p.is_admin_disabled, false) = false
          AND COALESCE(u.is_disabled, false) = false
          AND p.stock_quantity > 0
          AND ${NON_EXPIRED_PRODUCT_SQL}
          AND (
            LOWER(p.name) = LOWER($3)
            OR p.name ILIKE $4
          )
          AND ($5::int IS NULL OR p.category_id = $5)
        ORDER BY p.price ASC, COALESCE(s.sold_qty, 0) DESC
        LIMIT 3
      `,
      [id, target.farmer_id, target.name, `${String(target.name || '').split('(')[0].trim()}%`, target.category_id || null]
    );

    const rows = similarRes.rows || [];
    const lowestPrice = rows.length ? Math.min(...rows.map(r => Number(r.price) || 0)) : null;
    const highestSales = rows.length ? Math.max(...rows.map(r => Number(r.sold_qty) || 0)) : null;

    const similar = rows.map((item) => {
      const badges = [];
      if (lowestPrice !== null && Number(item.price) === Number(lowestPrice)) badges.push('Lowest Price');
      if (highestSales !== null && Number(item.sold_qty) === Number(highestSales) && highestSales > 0) badges.push('Best Selling');
      if (Number(item.average_rating || 0) >= 4.5) badges.push('Top Rated');
      return { ...item, badges };
    });

    return res.json({ similar });
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
    res.status(500).json({
      message: 'Server error fetching farmer products',
      debug: String(error?.message || error)
    });
  }
});

// Add new product (for farmers)
router.post('/', productUpload.single('image'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

    await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255)');
    await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'approved\'');

    // Determine image URL/public id: prefer explicit image_url, but any uploaded file is always sent to Cloudinary.
    let imageUrl = null;
    let imagePublicId = null;
    if (image_url && String(image_url).trim() !== '') {
      imageUrl = String(image_url).trim();
      imagePublicId = req.body?.cloudinary_public_id || extractCloudinaryPublicId(imageUrl) || null;
    }

    if (req.file && req.file.path) {
      try {
        const uploaded = await cloudinary.uploadFile(req.file.path, {
          folder: 'agricatch/products/tmp',
          resource_type: 'image',
          transformation: [
            { width: 1200, crop: 'limit', quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        imageUrl = uploaded.secure_url;
        imagePublicId = uploaded.public_id;
      } catch (uploadErr) {
        deleteFileIfExists(req.file.path);
        return res.status(500).json({ message: 'Cloudinary upload failed' });
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
                           unit, image_url, location, harvest_date, expiry_date, cloudinary_public_id, is_available, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [name, normalizedDescription, price, category_id, decoded.id, stock_quantity,
         unit, imageUrl, productLocation, harvestDateValue, expiryDateValue, imagePublicId, false, 'pending']);

    let createdProduct = result.rows[0];

    // Ensure newly created products use categorized Cloudinary IDs.
    if (createdProduct && (createdProduct.cloudinary_public_id || createdProduct.image_url)) {
      const categoryName = await loadCategoryNameById(createdProduct.category_id);
      const moved = await rehomeProductImageToCategorizedId({
        categoryName,
        productName: createdProduct.name,
        userId: decoded.id,
        imagePublicId: createdProduct.cloudinary_public_id,
        imageUrl: createdProduct.image_url
      });

      if (moved.changed && moved.imagePublicId) {
        const refreshed = await pool.query(
          `UPDATE products
           SET image_url = $1,
               cloudinary_public_id = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [moved.imageUrl || createdProduct.image_url, moved.imagePublicId, createdProduct.id]
        );
        createdProduct = refreshed.rows[0] || createdProduct;
      }
    }

    broadcastEvent('product.updated', {
      action: 'product.create',
      product_id: Number(createdProduct.id),
      farmer_id: Number(decoded.id)
    });

    res.status(201).json({
      message: 'Product added successfully',
      product: createdProduct
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.params;

    // Check if product belongs to the farmer
    // Ensure products table has cloudinary_public_id column
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255)");
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

    // Determine image URL: use explicit cloud URL if provided, otherwise keep current.
    // If a new file is uploaded, it is always uploaded to Cloudinary.
    let imageUrl = current.image_url;
    let imagePublicId = current.cloudinary_public_id || extractCloudinaryPublicId(current.image_url) || null;

    // Keep track of the current and incoming Cloudinary public IDs so we can
    // remove the previous Cloudinary asset when the farmer explicitly sets
    // a different Cloudinary-hosted image (to avoid orphaned assets).
    const oldPublicId = current.cloudinary_public_id || extractCloudinaryPublicId(current.image_url) || null;
    let newPublicId = imagePublicId;
    const resolvedCategoryName = await loadCategoryNameById(nextCategoryId);
    const targetPublicId = categorizedProductPublicId({
      categoryName: resolvedCategoryName,
      productName: nextName,
      userId: decoded.id
    });

    if (typeof image_url !== 'undefined' && image_url !== null && String(image_url).trim() !== '') {
      imageUrl = String(image_url).trim();
      newPublicId = req.body?.cloudinary_public_id || extractCloudinaryPublicId(imageUrl) || null;
      imagePublicId = newPublicId;

      // If replacing a Cloudinary-hosted image with a different Cloudinary asset,
      // attempt to destroy the old one. Non-fatal: log warnings but do not block update.
      if (oldPublicId && newPublicId && oldPublicId !== newPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
        } catch (destroyErr) {
          console.warn('Failed to destroy previous Cloudinary asset:', oldPublicId, destroyErr && (destroyErr.message || destroyErr));
        }
      }

      // If the previous image was stored locally, try to remove that file as well.
      try {
        const oldPath = resolvePublicPath(current.image_url);
        if (oldPath) deleteFileIfExists(oldPath);
      } catch (e) {
        console.warn('Failed to delete old product image:', e.message || e);
      }

      // Normalize explicit Cloudinary replacements to the required agricatch/category/product path.
      if (imagePublicId) {
        const moved = await rehomeProductImageToCategorizedId({
          categoryName: resolvedCategoryName,
          productName: nextName,
          userId: decoded.id,
          imagePublicId,
          imageUrl
        });
        if (moved.imagePublicId) {
          imagePublicId = moved.imagePublicId;
          imageUrl = moved.imageUrl || imageUrl;
        }
      }
    }

    if (req.file && req.file.path) {
      let uploaded;
      try {
        uploaded = await cloudinary.uploadFile(req.file.path, {
          public_id: targetPublicId,
          overwrite: true,
          invalidate: true,
          tags: [
            'app:agricatch',
            'entity:product',
            `entity_id:${id}`,
            `category:${cloudinary.slugify(resolvedCategoryName)}`,
            'role:primary'
          ],
          resource_type: 'image',
          transformation: [
            { width: 1200, crop: 'limit', quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
      } catch (uploadErr) {
        deleteFileIfExists(req.file.path);
        return res.status(500).json({ message: 'Cloudinary upload failed' });
      } finally {
        deleteFileIfExists(req.file.path);
      }

      imageUrl = uploaded.secure_url;
      imagePublicId = uploaded.public_id;

      if (oldPublicId && oldPublicId !== imagePublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
        } catch (destroyErr) {
          console.warn('Failed to destroy previous Cloudinary asset:', oldPublicId, destroyErr && (destroyErr.message || destroyErr));
        }
      }

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
        cloudinary_public_id = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
    `, [nextName, nextDescription, nextPrice, nextCategoryId, nextStockQuantity, nextUnit,
         imageUrl, nextLocation, nextHarvestDate, nextExpiryDate, nextIsAvailable, imagePublicId, id]);

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

// Delete product (for farmers) - hard delete
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.params;

    // Check if product belongs to the farmer
    const productResult = await pool.query('SELECT farmer_id, image_url, cloudinary_public_id FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (Number(productResult.rows[0].farmer_id) !== Number(decoded.id)) {
      return res.status(403).json({ message: 'You can only delete your own products' });
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

    const imageUrl = productResult.rows[0].image_url;
    const cloudPublicId = productResult.rows[0].cloudinary_public_id;
    const oldPath = resolvePublicPath(imageUrl);
    if (oldPath) {
      deleteFileIfExists(oldPath);
    }

    // If the image is hosted on Cloudinary, attempt to remove it there as well.
    try {
      const publicIdToDelete = cloudPublicId || (imageUrl && /^https:\/\/res\.cloudinary\.com\//.test(String(imageUrl)) && (String(imageUrl).match(/^https:\/\/res\.cloudinary\.com\/[^\/]+\/(?:image|video)\/upload\/(?:[^\/]+\/)*?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/) || [])[1]);
      if (publicIdToDelete) {
        try {
          await cloudinary.uploader.destroy(publicIdToDelete, { resource_type: 'image' });
        } catch (cloudErr) {
          console.warn('Cloudinary deletion failed for', publicIdToDelete, cloudErr && (cloudErr.message || cloudErr));
        }
      }
    } catch (e) {
      console.warn('Cloudinary deletion check failed:', e && (e.message || e));
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