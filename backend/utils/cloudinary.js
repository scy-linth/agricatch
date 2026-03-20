// Cloudinary configuration for backend
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwv7lhgvm',
  api_key: process.env.CLOUDINARY_API_KEY || '939952877662233',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'Q0b0NBx8dZkYA7tuFGXcpm_3h7Q',
});

module.exports = cloudinary;
