const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { productUpload } = require('../middleware/upload');
const { deleteFileIfExists, resolvePublicPath } = require('../utils/fileUtils');
const { broadcastEvent } = require('../utils/realtime');
const cloudinary = require('../utils/cloudinary');
const { pool, getPlatformSetting } = require('../utils/db');
const { getFeatureFlag } = require('../middleware/featureFlags');
const activityLogger = require('../services/activityLogger');

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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

// ── Tier helpers for subscription system ────────────────────────────────────
async function getFarmerTier(farmerId) {
  const subRes = await pool.query(
    `SELECT tier, status, expires_at FROM farmer_subscriptions
     WHERE farmer_id = $1 AND status = 'active' ORDER BY expires_at DESC LIMIT 1`, [farmerId]
  );
  if (subRes.rows.length === 0 || new Date(subRes.rows[0].expires_at) < new Date()) return 'free';
  return subRes.rows[0].tier;
}

async function getFarmerProductCount(userId) {
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM products WHERE farmer_id = $1 AND status IN ($2, $3) AND is_admin_disabled = false`,
    [userId, 'approved', 'pending']
  );
  return parseInt(countRes.rows[0].count, 10);
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
  productId,
  imagePublicId,
  imageUrl
}) => {
  const sourcePublicId = imagePublicId || extractCloudinaryPublicId(imageUrl);
  if (!sourcePublicId) {
    return { imagePublicId, imageUrl, changed: false };
  }

  const targetPublicId = `agricatch/${cloudinary.slugify(categoryName || 'uncategorized')}/${cloudinary.slugify(productName || 'product')}/${productId}.jpeg`;
  if (sourcePublicId === targetPublicId) {
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

// Farmer custom product-name request (requires admin approval)
router.post('/category-requests', async (req, res) => {
  try {
    const decoded = getUserFromToken(req);
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid or expired token' });

    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);
    const role = roleResult.rows[0]?.role;

    if (role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can request custom product names' });
    }

    // Check verification status from verification_requests table
    let isVerified = false;
    try {
      const verifResult = await pool.query(
        'SELECT status FROM verification_requests WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 1',
        [decoded.id]
      );
      isVerified = verifResult.rows.length > 0 && verifResult.rows[0].status === 'approved';
    } catch (verifError) {
      console.error('Error checking verification status:', verifError);
      // If verification_requests table doesn't exist or query fails, fall back to checking users.is_verified
      const userVerifResult = await pool.query('SELECT is_verified FROM users WHERE id = $1', [decoded.id]);
      isVerified = userVerifResult.rows[0]?.is_verified === true;
    }

    // getFarmerTier now uses user_id directly (farmers table doesn't exist)
    const tier = await getFarmerTier(decoded.id);
    if (tier !== 'premium') {
      return res.status(403).json({ message: 'Custom product names are a Premium feature.' });
    }

    const name = String(req.body?.name || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const requestedCategoryName = String(req.body?.requested_category_name || '').trim();
    const parsedCategoryId = Number(req.body?.category_id);
    const categoryId = Number.isFinite(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : 0;

    if (!name) return res.status(400).json({ message: 'Product name is required' });
    // Category is now optional - admin will determine it
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

    // Allow resubmission if previous request was rejected - only check for pending requests
    // Rejected requests can be resubmitted with the same name

    const inserted = await pool.query(
      `INSERT INTO product_name_requests (category_id, requested_category_name, name, notes, requested_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, category_id, requested_category_name, name, notes, status, created_at`,
      [validCategoryId, requestedCategoryName || null, name, notes || null, decoded.id]
    );

    return res.status(201).json({
      message: 'Request submitted. Admin will review and approve it.',
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

    // Get catalog requests (product name requests) - for modal display
    const catalogRequestsResult = await pool.query(
      `SELECT r.id, r.category_id, r.requested_category_name, c.name as category_name, r.name, r.notes, r.status, r.review_notes, r.reviewed_at, r.created_at
       FROM product_name_requests r
       LEFT JOIN categories c ON r.category_id = c.id
       WHERE r.requested_by = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return res.json({ requests: catalogRequestsResult.rows });
  } catch (error) {
    console.error('Get my category requests error:', error.message);
    return res.status(500).json({ message: 'Server error fetching requests' });
  }
};

// Get pending/rejected products for Approval tab
const getMyProductRequestsHandler = async (req, res) => {
  try {
    const decoded = getUserFromToken(req);
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid or expired token' });
    const userId = decoded.id;

    // Get farmer_id from users table
    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) return res.status(404).json({ message: 'User not found' });
    
    const farmerId = userResult.rows[0].id;

    // Get pending/rejected products (farmer's own products awaiting approval)
    const pendingProductsResult = await pool.query(
      `SELECT p.id, p.category_id, c.name as category_name, p.name, p.description as notes, p.status, p.rejection_reason as review_notes, p.updated_at as reviewed_at, p.created_at,
       'product_request' as request_type
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.farmer_id = $1
        AND p.status IN ('pending', 'rejected')
      ORDER BY p.created_at DESC`,
      [farmerId]
    );

    return res.json({ requests: pendingProductsResult.rows });
  } catch (error) {
    console.error('Get my product requests error:', error.message);
    return res.status(500).json({ message: 'Server error fetching product requests' });
  }
};

// Get current farmer's product name requests (history) - for modal
router.get('/category-requests/mine', getMyCategoryRequestsHandler);
router.get('/requests/mine', getMyCategoryRequestsHandler);

// Get pending/rejected products for Approval tab
router.get('/product-requests/mine', getMyProductRequestsHandler);

// Get all products with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'latest', preorder } = req.query;
    const pageNumber = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const limitNumber = Math.min(Math.max(Number.parseInt(req.query.limit || '12', 10), 1), 48);
    const offset = (pageNumber - 1) * limitNumber;
    const user = getUserFromToken(req);
    const userId = user?.id;

    const normalizedSort = String(sort || 'latest').trim().toLowerCase();
    const orderByMap = {
      latest: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, p.created_at DESC',
      harvest_date: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, p.harvest_date DESC NULLS LAST, p.created_at DESC',
      expiry_date: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, p.expiry_date ASC NULLS LAST, p.created_at DESC',
      expiration_date: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, p.expiry_date ASC NULLS LAST, p.created_at DESC',
      ratings: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, average_rating DESC, total_reviews DESC, p.created_at DESC',
      top_sales: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, p.sales_count DESC, p.created_at DESC',
      price_low_high: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, p.price ASC, p.created_at DESC',
      price_high_low: 'COALESCE(fs.tier = \'premium\' AND fs.status = \'active\', false) DESC, COALESCE(u.is_verified, false) DESC, p.price DESC, p.created_at DESC'
    };
    const orderByClause = orderByMap[normalizedSort] || orderByMap.latest;

    // Build query parts
    const baseFrom = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      LEFT JOIN farmer_subscriptions fs ON fs.farmer_id = u.id AND fs.status = 'active' AND fs.expires_at > CURRENT_TIMESTAMP
      LEFT JOIN (
        SELECT product_id, COALESCE(SUM(quantity), 0)::int AS sold_qty
        FROM orders
        WHERE status = 'delivered'
        GROUP BY product_id
      ) s ON s.product_id = p.id
      WHERE p.is_available = true
        AND COALESCE(p.is_admin_disabled, false) = false
        AND COALESCE(u.is_disabled, false) = false
        AND p.status = 'approved'
        AND ${NON_EXPIRED_PRODUCT_SQL}
        AND (p.is_preorder = false OR p.is_preorder = true) -- Allow pre-order products
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
      SELECT p.*, c.name as category_name, COALESCE(u.shop_name, u.full_name) as farmer_name, p.location as farm_location,
             p.city, p.province,
             COALESCE(u.is_verified, false) as farmer_verified,
             COALESCE(fs.tier = 'premium' AND fs.status = 'active', false) as farmer_premium,
              COALESCE(u.average_rating, 0) as farmer_average_rating,
              COALESCE(u.total_reviews, 0) as farmer_total_reviews,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
             (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews,
             COALESCE(s.sold_qty, 0)::int AS sold_qty,
             p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity${wishlistSelect}
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

    // Add pre-order filter
    if (preorder !== undefined) {
      if (preorder === 'true') {
        whereClause += ` AND p.is_preorder = true`;
        countWhereClause += ` AND p.is_preorder = true`;
      } else if (preorder === 'false') {
        whereClause += ` AND p.is_preorder = false`;
        countWhereClause += ` AND p.is_preorder = false`;
      }
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
      `SELECT c.name, COALESCE(c.default_unit, 'kg') AS default_unit
       FROM product_name_catalog c
       WHERE c.is_approved = true
         AND COALESCE(c.is_disabled, false) = false
         AND ($1::int IS NULL OR c.category_id = $1)
       ORDER BY c.name ASC`,
      [categoryId]
    );

    const names = result.rows.map((row) => ({ name: row.name, default_unit: row.default_unit })).filter(Boolean);
    return res.json({ names });
  } catch (error) {
    console.error('Catalog names error:', error);
    return res.status(500).json({
      message: 'Server error fetching catalog names',
      debug: String(error?.message || error)
    });
  }
});

// Get previous product values for auto-fill
router.get('/previous-values', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user || user.role !== 'farmer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, is_preorder } = req.query;
    if (!name) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    const isPreorder = is_preorder === 'true' || is_preorder === true;

    // Get latest product from this farmer with same name and selling type
    // Exclude harvested products (they are historical records)
    const result = await pool.query(
      `SELECT description, image_url, price, location, city, province,
              expiry_date, max_preorder_quantity, preorder_availability_date
       FROM products
       WHERE farmer_id = $1
         AND LOWER(name) = LOWER($2)
         AND is_preorder = $3
         AND is_admin_disabled = false
         AND status != 'harvested'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, name, isPreorder]
    );

    if (result.rows.length === 0) {
      return res.json({ values: null });
    }

    const product = result.rows[0];
    return res.json({
      values: {
        description: product.description,
        image_url: product.image_url,
        price: product.price,
        location: product.location,
        city: product.city,
        province: product.province,
        expiry_date: product.expiry_date,
        max_preorder_quantity: product.max_preorder_quantity,
        preorder_availability_date: product.preorder_availability_date
      }
    });
  } catch (error) {
    console.error('Get previous values error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Suggested pricing based on system-wide delivered sales history
router.get('/pricing/suggestion', async (req, res) => {
  try {
    const rawName = String(req.query.name || '').trim();
    const categoryId = req.query.category_id;
    const unit = req.query.unit;

    if (!rawName) {
      return res.status(400).json({ message: 'name is required' });
    }

    const baseName = rawName.split('(')[0].trim();

    const runSuggestionQuery = async (opts = { withCategory: false, withUnit: false }) => {
      const params = [rawName, baseName ? `${baseName}%` : rawName];
      let whereCategory = '';
      let whereUnit = '';
      if (opts.withCategory && categoryId) {
        params.push(Number(categoryId));
        whereCategory = ` AND p.category_id = $${params.length}`;
      }
      if (opts.withUnit && unit) {
        params.push(unit);
        whereUnit = ` AND p.unit = $${params.length}`;
      }

      const result = await pool.query(
        `
          SELECT
            MIN(p.price)::numeric(10,2) AS lowest_price,
            AVG(p.price)::numeric(10,2) AS average_price,
            COUNT(DISTINCT o.user_id)::int AS sample_count
          FROM orders o
          JOIN products p ON p.id = o.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE o.status = 'delivered'
            AND o.delivered_at >= NOW() - INTERVAL '60 days'
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
            ${whereUnit}
        `,
        params
      );

      return result.rows?.[0] || {};
    };

    // First try category+unit-scoped suggestion, then fall back to category-only, then unit-only, then system-wide
    const MIN_SAMPLE_COUNT = 5;
    let row = await runSuggestionQuery({ withCategory: !!categoryId, withUnit: !!unit });
    if (categoryId && Number(row.sample_count || 0) < MIN_SAMPLE_COUNT) {
      row = await runSuggestionQuery({ withCategory: false, withUnit: !!unit });
    }
    if (unit && Number(row.sample_count || 0) < MIN_SAMPLE_COUNT) {
      row = await runSuggestionQuery({ withCategory: false, withUnit: false });
    }

    const normalizedKey = rawName.toLowerCase();
    const fallback = SUGGESTED_PRICE_BASELINE[normalizedKey] || null;
    const hasSample = Number(row.sample_count || 0) >= MIN_SAMPLE_COUNT;

    // Check if admin has set an average price for this product in the catalog (by category + unit)
    let adminSetPrice = null;
    try {
      const catalogResult = await pool.query(
        `SELECT admin_set_average_price FROM product_name_catalog WHERE LOWER(name) = LOWER($1)${categoryId ? ' AND category_id = $2' : ''}${unit ? ' AND default_unit = $3' : ''} LIMIT 1`,
        categoryId && unit ? [rawName, Number(categoryId), unit] : (categoryId ? [rawName, Number(categoryId)] : (unit ? [rawName, unit] : [rawName]))
      );
      if (catalogResult.rows.length > 0 && catalogResult.rows[0].admin_set_average_price !== null) {
        adminSetPrice = Number(catalogResult.rows[0].admin_set_average_price);
      }
    } catch (catalogError) {
      console.error('Error fetching admin-set price from catalog:', catalogError);
    }

    // Priority: admin-set price > real data > baseline
    const finalAveragePrice = adminSetPrice !== null
      ? adminSetPrice
      : (hasSample
          ? (row.average_price ? Number(row.average_price) : null)
          : (fallback ? fallback.average : null));

    const finalLowestPrice = adminSetPrice !== null
      ? null // Admin only sets average, not lowest
      : (hasSample
          ? (row.lowest_price ? Number(row.lowest_price) : null)
          : (fallback ? fallback.lowest : null));

    return res.json({
      name: rawName,
      unit: unit || null,
      suggested_lowest_price: finalLowestPrice,
      average_price: finalAveragePrice,
      sample_count: Number(row.sample_count || 0),
      is_baseline_estimate: !hasSample && !!fallback && adminSetPrice === null,
      is_admin_set: adminSetPrice !== null,
      admin_set_average_price: adminSetPrice
    });
  } catch (error) {
    console.error('Pricing suggestion error:', error);
    return res.status(500).json({ message: 'Server error fetching pricing suggestion' });
  }
});

// Best-selling low-price products for landing section
// Now uses featured_products table for admin-curated featured products
router.get('/featured', async (req, res) => {
  try {
    await ensureProductCatalogSchema();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '6', 10), 1), 12);
    const category = String(req.query.category || '').trim();
    const featuredUser = getUserFromToken(req);
    const featuredUserId = featuredUser?.id || null;

    let categoryFilterSql = '';
    const params = [limit];
    if (category) {
      params.push(category);
      categoryFilterSql = ` AND c.name = $${params.length}`;
    }

    // First try to get admin-curated featured products
    const featuredResult = await pool.query(
      `SELECT p.*, COALESCE(u.shop_name, u.full_name) AS farmer_name,
              p.city, p.province,
              COALESCE(u.is_verified, false) as farmer_verified,
              COALESCE(fs.tier = 'premium' AND fs.status = 'active', false) as farmer_premium,
              COALESCE(u.average_rating, 0) as farmer_average_rating,
              COALESCE(u.total_reviews, 0) as farmer_total_reviews,
              (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) AS average_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS total_reviews,
              p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity,
              fp.position
       FROM featured_products fp
       JOIN products p ON fp.product_id = p.id
       JOIN users u ON u.id = p.farmer_id
       LEFT JOIN farmer_subscriptions fs ON fs.farmer_id = u.id AND fs.status = 'active' AND fs.expires_at > CURRENT_TIMESTAMP
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE fp.is_active = true
         AND (fp.expires_at IS NULL OR fp.expires_at > CURRENT_TIMESTAMP)
         AND p.is_available = true
         AND COALESCE(p.is_admin_disabled, false) = false
         AND COALESCE(u.is_disabled, false) = false
         AND p.status = 'approved'
         AND (p.stock_quantity > 0 OR p.is_preorder = true) -- Allow pre-order products with 0 stock
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
       ORDER BY fp.position ASC, fp.featured_at DESC
       LIMIT $1`,
      params
    );

    const annotateFeaturedWishlist = async (products) => {
      if (!featuredUserId || !products.length) {
        products.forEach(p => { p.is_in_wishlist = false; });
        return products;
      }
      const ids = products.map(p => p.id);
      const wRes = await pool.query(
        'SELECT product_id FROM wishlist WHERE user_id = $1 AND product_id = ANY($2)',
        [featuredUserId, ids]
      );
      const inWishlist = new Set(wRes.rows.map(r => r.product_id));
      products.forEach(p => { p.is_in_wishlist = inWishlist.has(p.id); });
      return products;
    };

    // If we have enough featured products, return them
    if (featuredResult.rows.length >= limit) {
      return res.json({ products: await annotateFeaturedWishlist(featuredResult.rows) });
    }

    // Otherwise, fallback to best-selling low-price products to fill the remaining slots
    const remainingLimit = limit - featuredResult.rows.length;
    const fallbackResult = await pool.query(
      `
        SELECT p.*, COALESCE(u.shop_name, u.full_name) AS farmer_name,
               p.city, p.province,
               COALESCE(u.is_verified, false) as farmer_verified,
               COALESCE(fs.tier = 'premium' AND fs.status = 'active', false) as farmer_premium,
               COALESCE(s.sold_qty, 0)::int AS sold_qty,
               COALESCE(u.average_rating, 0) as farmer_average_rating,
               COALESCE(u.total_reviews, 0) as farmer_total_reviews,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) AS average_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS total_reviews,
               NULL as position
        FROM products p
        LEFT JOIN users u ON u.id = p.farmer_id
        LEFT JOIN farmer_subscriptions fs ON fs.farmer_id = u.id AND fs.status = 'active' AND fs.expires_at > CURRENT_TIMESTAMP
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
          AND p.status = 'approved'
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
          AND p.id NOT IN (SELECT product_id FROM featured_products WHERE is_active = true)
        ORDER BY p.price ASC, COALESCE(s.sold_qty, 0) DESC, p.created_at DESC
        LIMIT $1
      `,
      [remainingLimit]
    );

    // Combine featured and fallback products
    const combinedProducts = [...featuredResult.rows, ...fallbackResult.rows];
    
    if (combinedProducts.length > 0) {
      return res.json({ products: await annotateFeaturedWishlist(combinedProducts) });
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
      AND p.status = 'approved'
      AND ${NON_EXPIRED_PRODUCT_SQL}`;

    let whereClause = 'WHERE p.id = $1';
    const params = [id];

    if (userId === -1) {
      // Super admin can view all products
    } else if (userId) {
      const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      const role = roleResult.rows[0]?.role;
      if (role === 'admin' || role === 'super_admin') {
        // Admin can view all products
      } else if (role === 'farmer') {
        // Farmers can view their own products (including rejected) and available products from others
        whereClause += ` AND (p.farmer_id = $2 OR (${availabilityFilter}))`;
        params.push(userId);
      } else {
        whereClause += ` AND ${availabilityFilter}`;
      }
    } else {
      whereClause += ` AND ${availabilityFilter}`;
    }

    const result = await pool.query(`
      SELECT p.*, c.name as category_name, COALESCE(u.shop_name, u.full_name) as farmer_name,
             COALESCE(p.location, u.address) as farm_location,
             p.city, p.province,
             COALESCE(u.is_verified, false) as farmer_verified,
             COALESCE(u.average_rating, 0) as farmer_average_rating,
             COALESCE(u.total_reviews, 0) as farmer_total_reviews,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
            (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews,
            p.cloudinary_public_id as cloudinary_public_id,
            COALESCE(s.sold_qty, 0)::int AS sold_qty,
            p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity,
             ${userId ? `EXISTS (SELECT 1 FROM wishlist w WHERE w.user_id = $${params.length + 1} AND w.product_id = p.id)` : 'false'} as is_in_wishlist
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      LEFT JOIN (
        SELECT product_id, COALESCE(SUM(quantity), 0)::int AS sold_qty
        FROM orders
        WHERE status = 'delivered'
        GROUP BY product_id
      ) s ON s.product_id = p.id
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

// Get current active product for a given product ID (for View Product feature in orders)
// This handles the Product Lifecycle: if the original product is no longer available,
// it returns the linked active product (e.g., after Harvest YES created a new Available product)
router.get('/:id/current-active', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = Number(id);

    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Get the original product
    const originalRes = await pool.query(
      `SELECT id, name, farmer_id, is_available, is_admin_disabled, status, linked_product_id, is_preorder, expiry_date
       FROM products WHERE id = $1`,
      [productId]
    );

    if (originalRes.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const original = originalRes.rows[0];

    // Check if original product is still active and available
    const isOriginalActive = original.is_available === true
      && original.is_admin_disabled === false
      && original.status === 'approved'
      && (original.expiry_date === null || original.expiry_date >= new Date());

    if (isOriginalActive) {
      // Case 1: Original product is still active
      return res.json({ currentProductId: original.id, isOriginal: true });
    }

    // Case 2: Check for linked active product
    if (original.linked_product_id) {
      const linkedRes = await pool.query(
        `SELECT id, name, farmer_id, is_available, is_admin_disabled, status, is_preorder, expiry_date
         FROM products WHERE id = $1`,
        [original.linked_product_id]
      );

      if (linkedRes.rows.length > 0) {
        const linked = linkedRes.rows[0];
        const isLinkedActive = linked.is_available === true
          && linked.is_admin_disabled === false
          && linked.status === 'approved'
          && (linked.expiry_date === null || linked.expiry_date >= new Date());

        if (isLinkedActive) {
          // Case 2: Linked product is active
          return res.json({ currentProductId: linked.id, isOriginal: false });
        }
      }
    }

    // Case 3: No active product available
    return res.json({ currentProductId: null, isOriginal: false });

  } catch (error) {
    console.error('Get current active product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Similar products from other farmer shops for product details modal
router.get('/:id/similar-sellers', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_preorder } = req.query;

    const targetRes = await pool.query(
      `SELECT id, name, category_id, farmer_id FROM products WHERE id = $1`,
      [id]
    );

    if (targetRes.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const target = targetRes.rows[0];

    // Build is_preorder filter if provided
    let preorderFilter = '';
    const queryParams = [id, target.farmer_id, target.name, `${String(target.name || '').split('(')[0].trim()}%`, target.category_id || null];
    let paramIndex = 6;

    if (is_preorder !== undefined) {
      if (is_preorder === 'true') {
        preorderFilter = `AND p.is_preorder = true`;
      } else if (is_preorder === 'false') {
        preorderFilter = `AND p.is_preorder = false AND p.stock_quantity > 0`;
      }
    }

    const similarRes = await pool.query(
      `
        SELECT p.id, p.name, p.price, p.unit, p.stock_quantity, p.sales_count, p.image_url,
               COALESCE(s.sold_qty, 0)::int AS sold_qty,
               p.farmer_id, u.full_name AS farmer_name,
               COALESCE(u.average_rating, 0) as farmer_average_rating,
               COALESCE(u.total_reviews, 0) as farmer_total_reviews,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) AS average_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS total_reviews,
               p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity
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
          AND p.status = 'approved'
          AND (p.stock_quantity > 0 OR p.is_preorder = true)
          AND ${NON_EXPIRED_PRODUCT_SQL}
          ${preorderFilter}
          AND (
            LOWER(p.name) = LOWER($3)
            OR p.name ILIKE $4
          )
          AND ($5::int IS NULL OR p.category_id = $5)
        ORDER BY p.price ASC, COALESCE(s.sold_qty, 0) DESC
        LIMIT 3
      `,
      queryParams
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

// Resubmit a rejected product for approval
router.post('/:id/resubmit', async (req, res) => {
  try {
    const { id } = req.params;
    const decoded = getUserFromToken(req);
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid or expired token' });

    // Get the product
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (!productResult.rows.length) return res.status(404).json({ message: 'Product not found' });

    const product = productResult.rows[0];

    // Check if user owns this product
    if (product.farmer_id !== decoded.id) {
      return res.status(403).json({ message: 'You can only resubmit your own products' });
    }

    // Check if product is rejected
    if (product.status !== 'rejected') {
      return res.status(400).json({ message: 'Only rejected products can be resubmitted' });
    }

    // Reset status to pending and clear rejection reason
    await pool.query(
      'UPDATE products SET status = $1, rejection_reason = NULL, updated_at = NOW() WHERE id = $2',
      ['pending', id]
    );

    res.json({ message: 'Product resubmitted for approval' });

  } catch (error) {
    console.error('Resubmit product error:', error);
    res.status(500).json({ message: 'Server error resubmitting product' });
  }
});

// Get products by farmer (for farmer dashboard)
// Only returns approved products (available or disabled) - pending/rejected are shown in My Requests tab
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
router.post('/', multer().none(), async (req, res) => {
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

    // Check verification status from verification_requests table
    let isVerified = false;
    try {
      const verifResult = await pool.query(
        'SELECT status FROM verification_requests WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 1',
        [decoded.id]
      );
      isVerified = verifResult.rows.length > 0 && verifResult.rows[0].status === 'approved';
    } catch (verifError) {
      // If verification_requests table doesn't exist or query fails, fall back to checking users.is_verified
      const userVerifResult = await pool.query('SELECT is_verified FROM users WHERE id = $1', [decoded.id]);
      isVerified = userVerifResult.rows[0]?.is_verified === true;
    }

    // getFarmerTier now uses user_id directly (farmers table doesn't exist)
    const tier = await getFarmerTier(decoded.id);

    // Unverified farmers cannot sell at all
    if (!isVerified) {
      return res.status(403).json({ message: 'Please verify your account before adding products.' });
    }

    // Free verified: max products per farmer (configurable via platform_settings)
    if (tier === 'free') {
      const maxProducts = parseInt(await getPlatformSetting('max_products_per_farmer', '10'), 10);
      const count = await getFarmerProductCount(decoded.id);
      if (count >= maxProducts) {
        try {
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
             VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
            [decoded.id, 'product_limit_reached', 'Product Limit Reached',
             `You have reached the maximum of ${maxProducts} products. Upgrade to Premium for unlimited listings.`]
          );
          broadcastEvent('notification.created', { user_id: decoded.id });
        } catch (notifErr) {
          console.error('Failed to send product limit notification:', notifErr);
        }
        return res.status(403).json({
          message: `Free tier limit: ${maxProducts} active products max. Upgrade to Premium for unlimited listings.`,
          current_count: count,
          limit: maxProducts
        });
      }
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
      city,
      province,
      harvest_date,
      expiry_date,
      is_preorder,
      preorder_availability_date,
      max_preorder_quantity
    } = req.body;

    // Normalize boolean values from FormData strings
    const isPreorderValue = is_preorder === true || is_preorder === 'true' || is_preorder === '1';

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

    // Validate pre-order fields
    if (isPreorderValue === true && !preorder_availability_date) {
      return res.status(400).json({ message: 'preorder_availability_date is required when is_preorder is true' });
    }

    if (max_preorder_quantity !== undefined && max_preorder_quantity !== null && max_preorder_quantity <= 0) {
      return res.status(400).json({ message: 'max_preorder_quantity must be positive' });
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

    // Auto-populate location with shop address if not provided
    let productLocation = location;
    if (!productLocation || productLocation.trim() === '') {
      const farmerResult = await pool.query('SELECT address FROM users WHERE id = $1', [decoded.id]);
      productLocation = farmerResult.rows[0]?.address || null;
    }

    // Normalize optional date fields: treat empty strings as NULL
    const harvestDateValue = (harvest_date && String(harvest_date).trim() !== '') ? harvest_date : null;
    const expiryDateValue = (expiry_date && String(expiry_date).trim() !== '') ? expiry_date : null;
    const preorderAvailabilityDateValue = (preorder_availability_date && String(preorder_availability_date).trim() !== '') ? preorder_availability_date : null;

    // Validate pre-order date relationship
    if (preorderAvailabilityDateValue && expiryDateValue) {
      const availabilityDate = new Date(preorderAvailabilityDateValue);
      const expiryDate = new Date(expiryDateValue);
      if (expiryDate < availabilityDate) {
        return res.status(400).json({ message: 'expiry_date must be after preorder_availability_date' });
      }
    }

    // Normalize city and province: treat empty strings as NULL
    const cityValue = (city && String(city).trim() !== '') ? city : null;
    const provinceValue = (province && String(province).trim() !== '') ? province : null;

    // Ensure linked_product_id column exists
    await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS linked_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL');

    // CHECK FOR REJECTED PRODUCTS: Suggest editing instead of creating duplicate
    const rejectedCheck = await pool.query(
      `SELECT id, name, status, rejection_reason FROM products 
       WHERE farmer_id = $1 
         AND LOWER(name) = LOWER($2)
         AND category_id = $3
         AND status = 'rejected'
       LIMIT 1`,
      [decoded.id, name, category_id]
    );

    if (rejectedCheck.rows.length > 0) {
      const rejected = rejectedCheck.rows[0];
      return res.status(409).json({ 
        message: `You have a rejected product named "${rejected.name}" in this category. Would you like to edit and resubmit it instead?`,
        suggestion: 'edit_rejected',
        existing_product_id: rejected.id,
        existing_product_name: rejected.name,
        rejection_reason: rejected.rejection_reason
      });
    }

    // DUPLICATE PREVENTION: Prevent Available+Available and Pre-order+Pre-order for same farmer and product catalog item
    const duplicateCheck = await pool.query(
      `SELECT id, is_preorder FROM products 
       WHERE farmer_id = $1 
         AND LOWER(name) = LOWER($2)
         AND category_id = $3
         AND is_admin_disabled = false
       LIMIT 1`,
      [decoded.id, name, category_id]
    );

    if (duplicateCheck.rows.length > 0) {
      const existing = duplicateCheck.rows[0];
      const existingIsPreorder = existing.is_preorder === true || existing.is_preorder === 't' || existing.is_preorder === 'true' || existing.is_preorder === 1 || existing.is_preorder === '1';
      
      // Prevent Available + Available
      if (!isPreorderValue && !existingIsPreorder) {
        return res.status(409).json({ 
          message: 'You already have an Available product with this name and category. You can edit the existing product instead of creating a duplicate.',
          existing_product_id: existing.id
        });
      }
      
      // Prevent Pre-order + Pre-order
      if (isPreorderValue && existingIsPreorder) {
        return res.status(409).json({ 
          message: 'You already have a Pre-order product with this name and category. You can edit the existing product instead of creating a duplicate.',
          existing_product_id: existing.id
        });
      }
    }

    // PRODUCT LINKING: Automatically link Available and Pre-order products
    let linkedProductId = null;
    if (duplicateCheck.rows.length > 0) {
      const existing = duplicateCheck.rows[0];
      const existingIsPreorder = existing.is_preorder === true || existing.is_preorder === 't' || existing.is_preorder === 'true' || existing.is_preorder === 1 || existing.is_preorder === '1';
      
      // Link if creating Available and existing is Pre-order, or vice versa
      if (isPreorderValue !== existingIsPreorder) {
        linkedProductId = existing.id;
      }
    }

    // Check if product approval is required via feature flag
    const requireApproval = await getFeatureFlag('require_product_approval');
    const initialStatus = requireApproval ? 'pending' : 'approved';
    const initialIsAvailable = requireApproval ? false : true;

    const result = await pool.query(`
      INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity,
                           unit, image_url, location, city, province, harvest_date, expiry_date, cloudinary_public_id, is_available, status,
                           is_preorder, preorder_availability_date, reserved_quantity, max_preorder_quantity, linked_product_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [name, normalizedDescription, price, category_id, decoded.id, stock_quantity,
         unit || 'kg', imageUrl, productLocation, cityValue, provinceValue, harvestDateValue, expiryDateValue, imagePublicId, initialIsAvailable, initialStatus,
         isPreorderValue || false,
         preorderAvailabilityDateValue || null,
         0, // reserved_quantity always starts at 0
         max_preorder_quantity || null,
         linkedProductId]);

    let createdProduct = result.rows[0];

    broadcastEvent('product.updated', {
      action: 'product.create',
      product_id: Number(createdProduct.id),
      farmer_id: Number(decoded.id)
    });

    // Log product creation to activity logger (async, non-blocking)
    activityLogger.logAddProduct(
      decoded.id,
      decoded.role,
      req.sessionID,
      createdProduct.id,
      createdProduct.name,
      {},
      getClientIp(req),
      req.headers['user-agent'],
      generateRequestId(),
      req.headers['referer'] || req.originalUrl
    );

    // Send notification to admin about new product submission (only if approval is required)
    if (requireApproval) {
      try {
        const adminResult = await pool.query(
          "SELECT id FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1"
        );
        if (adminResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
            [adminResult.rows[0].id, 'new_product_submitted', 'New Product Submitted', `A new product "${name}" has been submitted for approval.`, createdProduct.id]
          );
          broadcastEvent('notification.created', { user_id: adminResult.rows[0].id });
        }
      } catch (adminErr) {
        console.error('Failed to send new product notification to admin:', adminErr);
      }
    }

    res.status(201).json({
      message: 'Product added successfully',
      product: createdProduct
    });

  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ message: 'Server error adding product' });
  }
});

// Update harvest date (dedicated endpoint for harvest reminder system)
router.put('/:id/harvest-date', async (req, res) => {
  const client = await pool.connect();
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      client.release();
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.params;
    const { harvest_date, reason } = req.body;

    if (!harvest_date) {
      client.release();
      return res.status(400).json({ message: 'harvest_date is required' });
    }
    if (!reason || String(reason).trim() === '') {
      client.release();
      return res.status(400).json({ message: 'reason is required' });
    }

    await client.query('BEGIN');

    // Get product and verify ownership
    const productResult = await client.query('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = productResult.rows[0];
    if (Number(product.farmer_id) !== Number(decoded.id)) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ message: 'You can only update your own products' });
    }

    // Business rule: Cannot change harvest date if any order has progressed beyond confirmed
    const orderCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE product_id = $1
        AND status NOT IN ('pending', 'cancelled')
        AND preorder_reserved_quantity > 0
    `, [id]);

    if (parseInt(orderCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ 
        message: 'Cannot change harvest date: product has active orders in progress' 
      });
    }

    // Ensure harvest tracking columns exist
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_adjustment_count INTEGER DEFAULT 0");
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS last_harvest_adjustment_at TIMESTAMP");
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_overdue_days INTEGER DEFAULT 0");
    await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS reservations_disabled BOOLEAN DEFAULT false");

    const oldHarvestDate = product.harvest_date;
    const newHarvestDate = String(harvest_date).trim() === '' ? null : harvest_date;

    // Update harvest date and tracking fields
    await client.query(`
      UPDATE products
      SET harvest_date = $1,
          harvest_adjustment_count = harvest_adjustment_count + 1,
          last_harvest_adjustment_at = CURRENT_TIMESTAMP,
          harvest_overdue_days = 0,
          reservations_disabled = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newHarvestDate, id]);

    // Collect SSE broadcast targets (send after COMMIT)
    const sseBroadcastTargets = [];

    // Notify customers with active preorder reservations
    if (oldHarvestDate !== newHarvestDate) {
      const reservationResult = await client.query(`
        SELECT DISTINCT o.user_id
        FROM orders o
        WHERE o.product_id = $1
          AND o.preorder_reserved_quantity > 0
          AND o.status IN ('pending', 'confirmed')
      `, [id]);

      for (const row of reservationResult.rows) {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
          VALUES ($1, 'harvest_date_changed', 'Expected Harvest Date Adjusted', $2, $3, false, CURRENT_TIMESTAMP)
        `, [
          row.user_id,
          `Expected harvest date for "${product.name}" has been adjusted from ${oldHarvestDate || 'not set'} to ${newHarvestDate || 'not set'}. Reason: ${reason}`,
          id
        ]);
        sseBroadcastTargets.push({ user_id: row.user_id });
      }
    }

    // Admin monitoring: Notify if adjustment count exceeds 3
    const adjustmentCount = (product.harvest_adjustment_count || 0) + 1;
    if (adjustmentCount > 3) {
      const adminResult = await client.query(
        "SELECT id FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1"
      );
      if (adminResult.rows.length > 0) {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
          VALUES ($1, 'harvest_adjustment_alert', 'Harvest Adjustment Alert', $2, $3, false, CURRENT_TIMESTAMP)
        `, [
          adminResult.rows[0].id,
          `Product "${product.name}" (ID: ${id}) has been adjusted ${adjustmentCount} times. Current reason: ${reason}`,
          id
        ]);
        sseBroadcastTargets.push({ user_id: adminResult.rows[0].id });
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    client.release();

    // Send SSE broadcasts after successful COMMIT
    for (const target of sseBroadcastTargets) {
      try {
        broadcastEvent('notification.created', { user_id: target.user_id });
      } catch (sseErr) {
        console.error('Failed to send SSE broadcast:', sseErr);
        // Log only, do not fail the request
      }
    }

    res.json({ 
      message: 'Harvest date updated successfully',
      old_harvest_date: oldHarvestDate,
      new_harvest_date: newHarvestDate,
      adjustment_count: adjustmentCount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Update harvest date error:', error);
    res.status(500).json({ message: 'Server error updating harvest date' });
  }
});

// Update product (for farmers)
router.put('/:id', multer().none(), async (req, res) => {
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
      city,
      province,
      harvest_date,
      expiry_date,
      is_available,
      is_preorder,
      preorder_availability_date,
      max_preorder_quantity
    } = req.body;

    const nextName = typeof name === 'undefined' ? current.name : name;
    const nextDescription = typeof description === 'undefined' ? current.description : normalizeDescription(description);
    const nextPrice = typeof price === 'undefined' ? current.price : price;
    const nextCategoryId = typeof category_id === 'undefined' ? current.category_id : category_id;
    const nextStockQuantity = typeof stock_quantity === 'undefined' ? current.stock_quantity : stock_quantity;
    const nextUnit = typeof unit === 'undefined' ? current.unit : unit;
    const nextLocation = typeof location === 'undefined' ? current.location : location;
    const nextCity = typeof city === 'undefined' ? current.city : (String(city).trim() === '' ? null : city);
    const nextProvince = typeof province === 'undefined' ? current.province : (String(province).trim() === '' ? null : province);
    const nextHarvestDate = (typeof harvest_date === 'undefined') ? current.harvest_date : (String(harvest_date).trim() === '' ? null : harvest_date);
    const nextExpiryDate = (typeof expiry_date === 'undefined') ? current.expiry_date : (String(expiry_date).trim() === '' ? null : expiry_date);
    const nextIsAvailable = typeof is_available === 'undefined' ? current.is_available : is_available;
    // Normalize boolean values from FormData strings
    const nextIsPreorder = typeof is_preorder === 'undefined' ? current.is_preorder : (is_preorder === true || is_preorder === 'true' || is_preorder === '1');
    const nextPreorderAvailabilityDate = (typeof preorder_availability_date === 'undefined') ? current.preorder_availability_date : (String(preorder_availability_date).trim() === '' ? null : preorder_availability_date);
    const nextMaxPreorderQuantity = typeof max_preorder_quantity === 'undefined' ? current.max_preorder_quantity : max_preorder_quantity;

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

    // Validate pre-order fields
    if (nextIsPreorder === true && !nextPreorderAvailabilityDate) {
      return res.status(400).json({ message: 'preorder_availability_date is required when is_preorder is true' });
    }

    if (nextPreorderAvailabilityDate && nextExpiryDate) {
      const availabilityDate = new Date(nextPreorderAvailabilityDate);
      const expiryDate = new Date(nextExpiryDate);
      if (expiryDate < availabilityDate) {
        return res.status(400).json({ message: 'expiry_date must be after preorder_availability_date' });
      }
    }

    if (nextMaxPreorderQuantity !== undefined && nextMaxPreorderQuantity !== null && nextMaxPreorderQuantity <= 0) {
      return res.status(400).json({ message: 'max_preorder_quantity must be positive' });
    }

    // Block unsafe preorder edits when active preorders exist
    if (current.reserved_quantity > 0) {
      // Cannot disable preorder when there are active reservations
      if (current.is_preorder === true && nextIsPreorder === false) {
        return res.status(400).json({ message: 'Cannot disable pre-order status while there are active pre-order reservations' });
      }
      // Cannot reduce max_preorder_quantity below already reserved
      if (nextMaxPreorderQuantity !== null && Number(nextMaxPreorderQuantity) < Number(current.reserved_quantity)) {
        return res.status(400).json({ message: `Cannot reduce max pre-order quantity (${nextMaxPreorderQuantity}) below already reserved quantity (${current.reserved_quantity})` });
      }
      // Cannot remove preorder_availability_date when there are active reservations
      if (current.is_preorder === true && nextIsPreorder === true && nextPreorderAvailabilityDate === null) {
        return res.status(400).json({ message: 'Cannot remove pre-order availability date while there are active pre-order reservations' });
      }
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
    const targetPublicId = `agricatch/${cloudinary.slugify(resolvedCategoryName)}/${cloudinary.slugify(nextName)}/${id}.jpeg`;

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

    }

    // If product was rejected, reset status to pending for resubmission
    // Note: is_available is already set in the main query, so we don't include it here
    const statusReset = current.status === 'rejected' ? ', status = \'pending\', is_admin_disabled = false, rejection_reason = NULL' : '';

    await pool.query(`
      UPDATE products SET
        name = $1, description = $2, price = $3, category_id = $4,
        stock_quantity = $5, unit = $6, image_url = $7, location = $8,
        city = $9, province = $10,
        harvest_date = $11, expiry_date = $12, is_available = $13,
        cloudinary_public_id = $14, is_preorder = $15, preorder_availability_date = $16, max_preorder_quantity = $17${statusReset},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
    `, [nextName, nextDescription, nextPrice, nextCategoryId, nextStockQuantity, nextUnit,
         imageUrl, nextLocation, nextCity, nextProvince, nextHarvestDate, nextExpiryDate, nextIsAvailable, imagePublicId,
         nextIsPreorder, nextPreorderAvailabilityDate, nextMaxPreorderQuantity, id]);

    // Check if product went from out of stock to in stock and notify wishlist customers
    const wasOutOfStock = Number(current.stock_quantity || 0) === 0;
    const isNowInStock = Number(nextStockQuantity) > 0;
    if (wasOutOfStock && isNowInStock) {
      try {
        const wishlistResult = await pool.query(
          'SELECT user_id FROM wishlist WHERE product_id = $1',
          [id]
        );
        for (const row of wishlistResult.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
            [row.user_id, 'product_back_in_stock', 'Product Back in Stock', `"${nextName}" is back in stock!`, id]
          );
          broadcastEvent('notification.created', { user_id: row.user_id });
        }
      } catch (wishlistErr) {
        console.error('Failed to send back in stock notifications:', wishlistErr);
      }
    }

    // Check if price changed and notify wishlist customers
    const oldPrice = Number(current.price || 0);
    const newPrice = Number(nextPrice || 0);
    if (oldPrice !== newPrice && oldPrice > 0) {
      try {
        const wishlistResult = await pool.query(
          'SELECT user_id FROM wishlist WHERE product_id = $1',
          [id]
        );
        const priceChange = newPrice > oldPrice ? 'increased' : 'decreased';
        const priceDiff = Math.abs(newPrice - oldPrice).toFixed(2);
        for (const row of wishlistResult.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
            [row.user_id, 'price_changed', 'Price Changed', `"${nextName}" price ${priceChange} by ₱${priceDiff}. New price: ₱${newPrice.toFixed(2)}`, id]
          );
          broadcastEvent('notification.created', { user_id: row.user_id });
        }
      } catch (priceErr) {
        console.error('Failed to send price change notifications:', priceErr);
      }
    }

    broadcastEvent('product.updated', {
      action: 'product.update',
      product_id: Number(id),
      farmer_id: Number(decoded.id)
    });

    // Log product update to activity logger (async, non-blocking)
    activityLogger.logEditProduct(
      decoded.id,
      decoded.role,
      req.sessionID,
      id,
      nextName,
      {},
      getClientIp(req),
      req.headers['user-agent'],
      req.headers['referer'] || req.originalUrl,
      generateRequestId()
    );

    res.json({ message: 'Product updated successfully' });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

// Convert pre-orders to stock when harvest is ready
router.post('/:id/convert-preorders', async (req, res) => {
  try {
    const productId = req.params.id;
    const { harvest_quantity } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Parse and validate harvest_quantity
    const harvestQuantity = Number.parseInt(harvest_quantity, 10);
    if (!Number.isInteger(harvestQuantity) || harvestQuantity <= 0) {
      return res.status(400).json({ message: 'Harvest quantity is required and must be a positive integer' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get product details with row lock to prevent concurrent modifications
      const productResult = await client.query(
        'SELECT farmer_id, is_preorder, reserved_quantity, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ message: 'Product not found' });
      }

      const product = productResult.rows[0];

      // Verify user is the farmer
      if (Number(product.farmer_id) !== Number(decoded.id)) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(403).json({ message: 'You can only convert pre-orders for your own products' });
      }

      if (!product.is_preorder) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ message: 'This product is not a pre-order product' });
      }

      if (product.reserved_quantity === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ message: 'No pre-orders to convert' });
      }

      // Calculate allocation and surplus
      // Support partial harvest: harvest may be less than reserved
      const allocatedQuantity = Math.min(harvestQuantity, product.reserved_quantity);
      const surplusQuantity = Math.max(harvestQuantity - product.reserved_quantity, 0);
      const shortageQuantity = Math.max(product.reserved_quantity - harvestQuantity, 0);

      // Update product: add surplus to stock (treat null as 0), reduce reserved by allocated amount
      // Also reset harvest tracking fields and enable reservations again
      await client.query(`
        UPDATE products
        SET stock_quantity = COALESCE(stock_quantity, 0) + $1,
            reserved_quantity = reserved_quantity - $2,
            harvest_overdue_days = 0,
            reservations_disabled = false
        WHERE id = $3
      `, [surplusQuantity, allocatedQuantity, productId]);

      // Get updated stock for response
      const updatedProduct = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [productId]
      );
      const newStock = updatedProduct.rows[0].stock_quantity;

      // Get active pre-order orders (not cancelled or delivered) ordered by creation date for FIFO allocation
      const orderResult = await client.query(`
        SELECT id, quantity, preorder_reserved_quantity FROM orders
        WHERE product_id = $1
          AND is_preorder = true
          AND status NOT IN ('cancelled', 'delivered')
        ORDER BY created_at ASC
      `, [productId]);

      // FIFO allocation: allocate harvest quantity to orders in order of creation
      let remainingToAllocate = allocatedQuantity;
      const fullyAllocatedOrderIds = [];
      const partiallyAllocatedOrders = [];

      for (const order of orderResult.rows) {
        if (remainingToAllocate <= 0) break;

        // Allocate against the remaining reservation for this order, not the original quantity.
        // This prevents double-allocating orders that were already fulfilled in a previous harvest.
        const orderRemaining = order.preorder_reserved_quantity;
        const allocateToOrder = Math.min(remainingToAllocate, orderRemaining);

        if (allocateToOrder > 0) {
          await client.query(`
            UPDATE orders
            SET preorder_converted_at = CURRENT_TIMESTAMP,
                preorder_fulfilled_quantity = COALESCE(preorder_fulfilled_quantity, 0) + $1,
                preorder_reserved_quantity = preorder_reserved_quantity - $1,
                status = 'confirmed'
            WHERE id = $2
          `, [allocateToOrder, order.id]);
          
          remainingToAllocate -= allocateToOrder;
          
          if (allocateToOrder === orderRemaining) {
            fullyAllocatedOrderIds.push(order.id);
          } else {
            partiallyAllocatedOrders.push({ id: order.id, allocated: allocateToOrder, total: orderRemaining });
          }

          // Notify customer that pre-order is confirmed and ready for delivery scheduling
          try {
            await client.query(`
              INSERT INTO notifications (user_id, type, title, message, order_id, product_id, is_read, created_at)
              SELECT user_id, 'order_update', 'Pre-order Confirmed', 
                     'Your pre-order #' || id || ' has been harvested and confirmed. The farmer will schedule delivery soon.',
                     id, product_id, false, CURRENT_TIMESTAMP
              FROM orders WHERE id = $1
            `, [order.id]);
            broadcastEvent('notification.created', { order_id: order.id });
          } catch (notifErr) {
            console.error('Failed to send pre-order confirmation notification:', notifErr);
          }
        }
      }

      const affectedOrderIds = [...fullyAllocatedOrderIds, ...partiallyAllocatedOrders.map(o => o.id)];

      await client.query('COMMIT');

      // Broadcast real-time order updates
      for (const orderId of affectedOrderIds) {
        try {
          broadcastEvent('order.updated', {
            order_id: orderId,
            product_id: Number(productId),
            farmer_id: Number(decoded.id),
            new_status: 'confirmed',
            old_status: 'preorder_reserved'
          });
        } catch (broadcastErr) {
          console.error('Failed to broadcast order update:', broadcastErr);
        }
      }

      res.json({
        message: 'Pre-orders converted to stock successfully',
        harvest_quantity: harvestQuantity,
        allocated_quantity: allocatedQuantity,
        surplus_quantity: surplusQuantity,
        shortage_quantity: shortageQuantity,
        new_stock_quantity: newStock,
        affected_orders: affectedOrderIds,
        fully_allocated: fullyAllocatedOrderIds.length,
        partially_allocated: partiallyAllocatedOrders.length
      });

    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
      }
      console.error('Convert pre-orders error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Server error converting pre-orders' });
      }
      // Don't re-throw - we've handled the error
    } finally {
      if (client) {
        client.release();
      }
    }

  } catch (error) {
    console.error('Convert pre-orders outer error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error converting pre-orders' });
    }
  }
});

// Harvest lifecycle: Complete harvest and optionally create Available product
router.post('/:id/harvest-lifecycle', async (req, res) => {
  try {
    console.log('[HARVEST LIFECYCLE] Starting harvest lifecycle');
    const productId = req.params.id;
    const { harvest_quantity, make_available } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    console.log('[HARVEST LIFECYCLE] Request params:', { productId, harvest_quantity, make_available });

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[HARVEST LIFECYCLE] Decoded user ID:', decoded.id);

    // Parse and validate harvest_quantity
    const harvestQuantity = Number.parseInt(harvest_quantity, 10);
    if (!Number.isInteger(harvestQuantity) || harvestQuantity <= 0) {
      return res.status(400).json({ message: 'Harvest quantity is required and must be a positive integer' });
    }

    // Validate make_available boolean
    const makeAvailable = make_available === true || make_available === 'true' || make_available === '1';
    console.log('[HARVEST LIFECYCLE] makeAvailable:', makeAvailable);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('[HARVEST LIFECYCLE] Transaction started');

      // Get product details with row lock
      const productResult = await client.query(
        'SELECT id, farmer_id, is_preorder, reserved_quantity, stock_quantity, name, description, price, category_id, unit, image_url, cloudinary_public_id, location, city, province, linked_product_id, status FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (productResult.rows.length === 0) {
        console.log('[HARVEST LIFECYCLE] Product not found');
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ message: 'Product not found' });
      }

      const product = productResult.rows[0];
      console.log('[HARVEST LIFECYCLE] Product found:', { id: product.id, name: product.name, farmer_id: product.farmer_id, is_preorder: product.is_preorder });

      // Verify user is the farmer
      if (Number(product.farmer_id) !== Number(decoded.id)) {
        console.log('[HARVEST LIFECYCLE] Farmer ID mismatch');
        await client.query('ROLLBACK');
        client.release();
        return res.status(403).json({ message: 'You can only harvest your own products' });
      }

      if (!product.is_preorder) {
        console.log('[HARVEST LIFECYCLE] Product is not a pre-order');
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ message: 'This product is not a pre-order product' });
      }

      // Ensure linked_product_id column exists
      console.log('[HARVEST LIFECYCLE] Ensuring linked_product_id column exists');
      await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS linked_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL');

      if (makeAvailable) {
        // YES PATH: Create Available product or transfer to existing linked Available product
        
        // Check if there's already a linked Available product
        let availableProductId = null;
        if (product.linked_product_id) {
          const linkedCheck = await client.query(
            'SELECT id, stock_quantity, is_preorder FROM products WHERE id = $1',
            [product.linked_product_id]
          );
          if (linkedCheck.rows.length > 0 && !linkedCheck.rows[0].is_preorder) {
            availableProductId = linkedCheck.rows[0].id;
          }
        }

        // Harvest conversion products are always approved.
        // No additional product approval is required.
        const initialStatus = 'approved';

        if (availableProductId) {
          // Transfer stock to existing linked Available product
          const currentStock = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1',
            [availableProductId]
          );
          const newStock = (currentStock.rows[0].stock_quantity || 0) + harvestQuantity;
          
          await client.query(
            'UPDATE products SET stock_quantity = $1, is_available = true, status = COALESCE(status, \'approved\') WHERE id = $2',
            [newStock, availableProductId]
          );

          // Mark the pre-order as harvested (historical record)
          await client.query(
            'UPDATE products SET status = \'harvested\', is_available = false, stock_quantity = 0, reserved_quantity = 0 WHERE id = $1',
            [productId]
          );

          // Notify customers who wishlisted the original pre-order product
          try {
            const wishlistResult = await client.query(
              'SELECT user_id FROM wishlist WHERE product_id = $1',
              [productId]
            );
            
            for (const row of wishlistResult.rows) {
              // Prevent duplicate notifications for the same availability event
              const existingNotif = await client.query(
                `SELECT id FROM notifications 
                 WHERE user_id = $1 AND type = 'product_available' AND product_id = $2 
                 AND created_at > NOW() - INTERVAL '1 hour'`,
                [row.user_id, availableProductId]
              );
              
              if (existingNotif.rows.length === 0) {
                await client.query(
                  `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
                   VALUES ($1, 'product_available', 'Product Available Again', 
                           $2, $3, false, CURRENT_TIMESTAMP)`,
                  [
                    row.user_id,
                    `"${product.name}" is now available again!`,
                    availableProductId
                  ]
                );
              }
            }
          } catch (wishlistErr) {
            console.error('Failed to send wishlist notifications:', wishlistErr);
            // Don't fail the harvest if notification fails
          }

          await client.query('COMMIT');
          client.release();

          return res.json({
            message: 'Harvest completed. Stock transferred to linked Available product.',
            harvest_quantity: harvestQuantity,
            available_product_id: availableProductId,
            new_stock_quantity: newStock,
            action: 'transferred'
          });
        } else {
          // Create new Available product
          const newProductResult = await client.query(`
            INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity,
                                 unit, image_url, location, city, province, cloudinary_public_id, is_available, status,
                                 is_preorder, preorder_availability_date, reserved_quantity, max_preorder_quantity, linked_product_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
          `, [
            product.name,
            product.description,
            product.price,
            product.category_id,
            product.farmer_id,
            harvestQuantity,
            product.unit,
            product.image_url,
            product.location,
            product.city,
            product.province,
            product.cloudinary_public_id,
            true, // is_available
            initialStatus,
            false, // is_preorder
            null, // preorder_availability_date
            0, // reserved_quantity
            null, // max_preorder_quantity
            productId // linked_product_id
          ]);

          const newAvailableProduct = newProductResult.rows[0];

          // Update the pre-order to link to the new Available product and mark as harvested
          await client.query(
            'UPDATE products SET linked_product_id = $1, status = \'harvested\', is_available = false, stock_quantity = 0, reserved_quantity = 0 WHERE id = $2',
            [newAvailableProduct.id, productId]
          );

          // Notify customers who wishlisted the original pre-order product
          try {
            const wishlistResult = await client.query(
              'SELECT user_id FROM wishlist WHERE product_id = $1',
              [productId]
            );
            
            for (const row of wishlistResult.rows) {
              // Prevent duplicate notifications for the same availability event
              const existingNotif = await client.query(
                `SELECT id FROM notifications 
                 WHERE user_id = $1 AND type = 'product_available' AND product_id = $2 
                 AND created_at > NOW() - INTERVAL '1 hour'`,
                [row.user_id, newAvailableProduct.id]
              );
              
              if (existingNotif.rows.length === 0) {
                await client.query(
                  `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
                   VALUES ($1, 'product_available', 'Product Available Again', 
                           $2, $3, false, CURRENT_TIMESTAMP)`,
                  [
                    row.user_id,
                    `"${product.name}" is now available again!`,
                    newAvailableProduct.id
                  ]
                );
              }
            }
          } catch (wishlistErr) {
            console.error('Failed to send wishlist notifications:', wishlistErr);
            // Don't fail the harvest if notification fails
          }

          await client.query('COMMIT');
          client.release();

          return res.json({
            message: 'Harvest completed. New Available product created automatically.',
            harvest_quantity: harvestQuantity,
            available_product_id: newAvailableProduct.id,
            available_product: newAvailableProduct,
            action: 'created'
          });
        }
      } else {
        // NO PATH: Mark as harvested without creating Available product
        await client.query(
          'UPDATE products SET status = \'harvested\', is_available = false, stock_quantity = 0, reserved_quantity = 0 WHERE id = $1',
          [productId]
        );

        await client.query('COMMIT');
        client.release();

        return res.json({
          message: 'Harvest completed. Product marked as harvested and will no longer appear in the marketplace.',
          harvest_quantity: harvestQuantity,
          action: 'harvested_only'
        });
      }

    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
        client.release();
      }
      console.error('Harvest lifecycle error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Server error processing harvest lifecycle' });
      }
    }
  } catch (error) {
    console.error('Harvest lifecycle outer error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error processing harvest lifecycle' });
    }
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

    // Get wishlist customers before deleting (to notify them after)
    let wishlistCustomers = [];
    try {
      const wishlistResult = await pool.query('SELECT user_id FROM wishlist WHERE product_id = $1', [id]);
      wishlistCustomers = wishlistResult.rows;
    } catch (e) {
      console.warn('Could not get wishlist customers:', e.message);
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

    // Notify wishlist customers that product is no longer available
    for (const row of wishlistCustomers) {
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
          [row.user_id, 'product_removed', 'Product Removed', 'A product in your wishlist has been removed by the farmer and is no longer available.']
        );
        broadcastEvent('notification.created', { user_id: row.user_id });
      } catch (notifErr) {
        console.error('Failed to send wishlist removal notification:', notifErr);
      }
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

    // Log product deletion to activity logger (async, non-blocking)
    activityLogger.logDeleteProduct(
      decoded.id,
      decoded.role,
      req.sessionID,
      id,
      imageUrl || 'Product',
      {},
      getClientIp(req),
      req.headers['user-agent'],
      generateRequestId(),
      req.headers['referer'] || req.originalUrl
    );

    res.json({ message: 'Product deleted successfully' });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

module.exports = router;