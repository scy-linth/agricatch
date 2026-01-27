const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

const { productUpload, bannerUpload, avatarUpload } = require('../middleware/upload');
const fs = require('fs');
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
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'products',
      use_filename: true,
      unique_filename: false,
      resource_type: 'image',
    });
    // Optionally, delete local file after upload
    // fs.unlinkSync(req.file.path);
    res.json({ imageUrl: result.secure_url });
  } catch (err) {
    res.status(500).json({ message: 'Cloudinary upload failed', error: err.message });
  }
});

router.post('/shop-banner', ensureAuth, bannerUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }
  const imageUrl = `/images/uploads/shops/banners/${req.file.filename}`;
  res.json({ imageUrl });
});

router.post('/shop-avatar', ensureAuth, avatarUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }
  const imageUrl = `/images/uploads/shops/avatars/${req.file.filename}`;
  res.json({ imageUrl });
});

module.exports = router;
