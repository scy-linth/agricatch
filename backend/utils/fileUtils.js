const fs = require('fs');
const path = require('path');

const deleteFileIfExists = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('File delete error:', error.message);
  }
};

const resolvePublicPath = (urlPath) => {
  if (!urlPath || !urlPath.startsWith('/images/uploads/')) return null;
  // Uploads are stored under /frontend so they can be served as static assets.
  return path.join(__dirname, '..', '..', 'frontend', urlPath);
};

module.exports = {
  deleteFileIfExists,
  resolvePublicPath
};
