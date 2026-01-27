

const multer = require('multer');
const path = require('path');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Only JPG, JPEG, PNG, and WEBP files are allowed'), false);
  }
  cb(null, true);
};

<<<<<<< HEAD
const productUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});
const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename ? filename.split('.')[0] : undefined,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    ).end(buffer);
  });
};
>>>>>>> b3ab180 (cloudinary image by copilot)

module.exports = {
  productUpload,
  bannerUpload,
  avatarUpload,
  fileFilter,
  uploadToCloudinary
};
