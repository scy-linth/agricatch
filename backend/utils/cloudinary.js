// Cloudinary configuration for backend
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dwv7lhgvm',
  api_key: '939952877662233',
  api_secret: 'Q0b0NBx8dZkYA7tuFGXcpm_3h7Q',
});

module.exports = cloudinary;
