const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { productUpload, bannerUpload, avatarUpload } = require('../middleware/upload');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

const ensureAuth = (req, res, next) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.user = user;
  next();
};

router.post('/product-image', ensureAuth, productUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.buffer, {
      folder: 'products',
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      resource_type: 'auto'
    });
    res.json({ imageUrl: result.secure_url });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

router.post('/shop-banner', ensureAuth, bannerUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.buffer, {
      folder: 'shops/banners',
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      resource_type: 'auto'
    });
    res.json({ imageUrl: result.secure_url });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

router.post('/shop-avatar', ensureAuth, avatarUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.buffer, {
      folder: 'shops/avatars',
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      resource_type: 'auto'
    });
    res.json({ imageUrl: result.secure_url });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

module.exports = router;
