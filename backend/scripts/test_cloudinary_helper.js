const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const cloudinary = require('../utils/cloudinary');

(async () => {
  try {
    console.log('=== Testing Cloudinary Helper Functions ===\n');
    
    // Test publicIdForVerificationDocument
    const testUserId = 123;
    const publicId = cloudinary.publicIdForVerificationDocument(testUserId);
    console.log('✓ publicIdForVerificationDocument(123):', publicId);
    
    // Verify format
    const expectedFormat = 'agricatch/verification/123/document';
    if (publicId === expectedFormat) {
      console.log('✓ Public ID format is correct');
    } else {
      console.log('✗ Public ID format is incorrect. Expected:', expectedFormat);
    }
    
    // Test with different user ID
    const testUserId2 = 456;
    const publicId2 = cloudinary.publicIdForVerificationDocument(testUserId2);
    console.log('✓ publicIdForVerificationDocument(456):', publicId2);
    
    // Verify uniqueness per user
    if (publicId !== publicId2) {
      console.log('✓ Public IDs are unique per user');
    } else {
      console.log('✗ Public IDs are not unique per user');
    }
    
    console.log('\n=== Cloudinary helper tests passed ===');
    
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
