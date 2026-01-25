const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const { productUpload, bannerUpload, avatarUpload } = require('../middleware/upload');

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

router.post('/product-image', ensureAuth, productUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image is required' });
  }
  const imageUrl = `/images/uploads/products/${path.basename(path.dirname(req.file.path))}/${req.file.filename}`;
  res.json({ imageUrl });
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
