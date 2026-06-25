const express = require('express');
const jwt = require('jsonwebtoken');

const { productUpload, bannerUpload, avatarUpload } = require('../middleware/upload');
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');

const verificationUpload = multer({
  dest: 'tmp/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'), false);
    }
  }
});
const { deleteFileIfExists } = require('../utils/fileUtils');
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

const ensureAuth = (req, res, next) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.user = user;
  next();
};

const safeRemoveLocalFile = (file) => {
  if (!file || !file.path) return;
  deleteFileIfExists(file.path);
};

const parseProductId = (req) => {
  const raw = req.body?.productId || req.body?.product_id || req.query?.productId || req.query?.product_id;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const parseProductName = (req) => {
  return String(req.body?.name || req.body?.productName || req.query?.name || req.query?.productName || 'product').trim();
};

const parseCategoryName = async (req) => {
  const directName = String(
    req.body?.categoryName || req.body?.category_name || req.query?.categoryName || req.query?.category_name || ''
  ).trim();
  if (directName) return directName;

  const rawId = req.body?.categoryId || req.body?.category_id || req.query?.categoryId || req.query?.category_id;
  const categoryId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(categoryId) || categoryId <= 0) return 'uncategorized';

  try {
    const result = await pool.query('SELECT name FROM categories WHERE id = $1 LIMIT 1', [categoryId]);
    return String(result.rows?.[0]?.name || 'uncategorized').trim() || 'uncategorized';
  } catch (_) {
    return 'uncategorized';
  }
};

router.post('/product-image', ensureAuth, productUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }

  const productId = parseProductId(req);
  const productName = parseProductName(req);
  const categoryName = await parseCategoryName(req);
  const requestedPublicId = String(req.body?.public_id || '').trim();

  try {
    const publicId = requestedPublicId
      || (productId ? `agricatch/${cloudinary.slugify(categoryName)}/${cloudinary.slugify(productName)}/${productId}.jpeg` : cloudinary.publicIdForCategorizedProduct({
        categoryName,
        productName,
        userId: req.user?.id,
        extension: 'jpeg'
      }));

    const result = await cloudinary.uploadFile(req.file.path, {
      public_id: publicId || undefined,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      tags: [
        'app:agricatch',
        'entity:product',
        productId ? `entity_id:${productId}` : 'entity_id:unknown',
        `category:${cloudinary.slugify(categoryName)}`,
        'role:primary'
      ],
      transformation: [
        { width: 1200, crop: 'limit', quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    safeRemoveLocalFile(req.file);
    res.json({ imageUrl: result.secure_url, public_id: result.public_id });
  } catch (err) {
    safeRemoveLocalFile(req.file);
    res.status(500).json({ message: 'Cloudinary upload failed', error: err.message });
  }
});

router.post('/shop-banner', ensureAuth, bannerUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }

  const requestedPublicId = String(req.body?.public_id || '').trim();

  try {
    const result = await cloudinary.uploadFile(req.file.path, {
      folder: 'agricatch/shops/banners',
      public_id: requestedPublicId || undefined,
      overwrite: Boolean(requestedPublicId),
      invalidate: Boolean(requestedPublicId),
      resource_type: 'image',
      tags: ['app:agricatch', 'entity:shop', 'role:banner'],
      transformation: [
        { width: 1600, crop: 'limit', quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    safeRemoveLocalFile(req.file);
    res.json({ imageUrl: result.secure_url, public_id: result.public_id });
  } catch (err) {
    safeRemoveLocalFile(req.file);
    res.status(500).json({ message: 'Cloudinary upload failed', error: err.message });
  }
});

router.post('/shop-avatar', ensureAuth, avatarUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }

  const requestedPublicId = String(req.body?.public_id || '').trim();

  try {
    const fallbackPublicId = cloudinary.publicIdForUserPhoto(req.user?.id, 'shop-avatar');
    const result = await cloudinary.uploadFile(req.file.path, {
      folder: 'agricatch/shops/avatars',
      public_id: requestedPublicId || fallbackPublicId,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      tags: ['app:agricatch', 'entity:shop', `entity_id:${req.user?.id || 'unknown'}`, 'role:avatar'],
      transformation: [
        { width: 400, height: 400, crop: 'limit', quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    safeRemoveLocalFile(req.file);
    res.json({ imageUrl: result.secure_url, public_id: result.public_id });
  } catch (err) {
    safeRemoveLocalFile(req.file);
    res.status(500).json({ message: 'Cloudinary upload failed', error: err.message });
  }
});

router.post('/verification-document', ensureAuth, verificationUpload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Document is required' });
  }

  try {
    const publicId = cloudinary.publicIdForVerificationDocument(req.user?.id);
    const result = await cloudinary.uploadFile(req.file.path, {
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      tags: ['app:agricatch', 'entity:verification', `entity_id:${req.user?.id || 'unknown'}`, 'role:document'],
      transformation: [
        { width: 2000, crop: 'limit', quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    safeRemoveLocalFile(req.file);
    res.json({ imageUrl: result.secure_url, public_id: result.public_id });
  } catch (err) {
    safeRemoveLocalFile(req.file);
    res.status(500).json({ message: 'Cloudinary upload failed', error: err.message });
  }
});

module.exports = router;
