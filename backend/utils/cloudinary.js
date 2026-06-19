// Cloudinary configuration and upload helpers.
const cloudinary = require('cloudinary').v2;

// Cloudinary SDK automatically parses CLOUDINARY_URL from environment
// Only call config() if using individual env vars
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

const slugify = (value) => {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'item';
};

const manilaTimestamp = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}`;
};

const publicIdForCategorizedProduct = ({ categoryName, productName, userId, extension = 'jpeg' } = {}) => {
  const categoryPart = slugify(categoryName || 'uncategorized');
  const productPart = slugify(productName || 'product');
  const userPart = String(userId || 'unknown').trim();
  const ext = slugify(extension || 'jpeg').replace(/-/g, '') || 'jpeg';
  return `agricatch/${categoryPart}/${productPart}/${userPart}-${manilaTimestamp()}.${ext}`;
};

const publicIdForProduct = (productId, productName, role = 'primary') => {
  const idPart = String(productId || 'unknown').trim();
  const namePart = slugify(productName || 'product');
  if (role === 'primary') {
    return `agricatch/products/${idPart}/${namePart}`;
  }
  return `agricatch/products/${idPart}/gallery/${namePart}-${manilaTimestamp()}`;
};

const publicIdForUserPhoto = (userId, kind = 'avatar') => {
  const safeKind = slugify(kind || 'avatar');
  return `agricatch/users/${String(userId || 'unknown').trim()}/${safeKind}-${manilaTimestamp()}`;
};

const publicIdForVerificationDocument = (userId) => {
  const userPart = String(userId || 'unknown').trim();
  // Use consistent public_id per farmer for overwrite (no timestamp)
  return `agricatch/verification/${userPart}/document`;
};

const publicIdForPaymentProof = (farmerId) => {
  const farmerPart = String(farmerId || 'unknown').trim();
  // Use timestamp for unique proofs per submission
  return `agricatch/payment-proofs/${farmerPart}/${manilaTimestamp()}`;
};

// uploadFile(localPath, options)
// Supported options mirror Cloudinary uploader options. Most common keys:
// - folder: target folder path in Cloudinary
// - public_id: deterministic asset identifier
// - overwrite: replace existing asset at public_id when true
// - resource_type: usually "image" for product/shop assets
// - tags: string[] for governance and cleanup filters
const uploadFile = async (localPath, options = {}) => {
  const uploadOptions = {
    resource_type: 'image',
    ...options
  };
  return cloudinary.uploader.upload(localPath, uploadOptions);
};

const getMissingCloudinaryEnv = () => {
  // Accept either CLOUDINARY_URL or individual env vars
  if (String(process.env.CLOUDINARY_URL || '').trim()) {
    return [];
  }
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  return required.filter((key) => !String(process.env[key] || '').trim());
};

const assertConfigured = () => {
  const missing = getMissingCloudinaryEnv();
  if (!missing.length) return;
  throw new Error(`Missing Cloudinary env vars: ${missing.join(', ')}`);
};

cloudinary.slugify = slugify;
cloudinary.manilaTimestamp = manilaTimestamp;
cloudinary.publicIdForCategorizedProduct = publicIdForCategorizedProduct;
cloudinary.publicIdForProduct = publicIdForProduct;
cloudinary.publicIdForUserPhoto = publicIdForUserPhoto;
cloudinary.publicIdForVerificationDocument = publicIdForVerificationDocument;
cloudinary.publicIdForPaymentProof = publicIdForPaymentProof;
cloudinary.uploadFile = uploadFile;
cloudinary.getMissingCloudinaryEnv = getMissingCloudinaryEnv;
cloudinary.assertConfigured = assertConfigured;

module.exports = cloudinary;
