const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createStorage = (baseDir, withDateFolder = false) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      let dest = baseDir;
      if (withDateFolder) {
        const dateFolder = new Date().toISOString().split('T')[0];
        dest = path.join(baseDir, dateFolder);
      }
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, uniqueName);
    }
  });
};

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Only JPG, JPEG, PNG, and WEBP files are allowed'), false);
  }
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(new Error('File content does not match an allowed image type'), false);
  }
  cb(null, true);
};

// Static assets now live under /frontend (Netlify publish folder).
// Keep uploads inside that folder so they are served at /images/uploads/...
const productStorage = createStorage(path.join(__dirname, '..', '..', 'frontend', 'images', 'uploads', 'products'), true);
const bannerStorage = createStorage(path.join(__dirname, '..', '..', 'frontend', 'images', 'uploads', 'shops', 'banners'));
const avatarStorage = createStorage(path.join(__dirname, '..', '..', 'frontend', 'images', 'uploads', 'shops', 'avatars'));

const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

const paymentProofStorage = createStorage(path.join(__dirname, '..', '..', 'frontend', 'images', 'uploads', 'payment-proofs'), true);

const paymentProofUpload = multer({
  storage: paymentProofStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

module.exports = {
  productUpload,
  bannerUpload,
  avatarUpload,
  paymentProofUpload,
  fileFilter
};
