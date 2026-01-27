require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testCloudinary() {
  try {
    console.log('Testing Cloudinary connection...');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('API Key:', process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set');
    console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set');

    // Test upload a small test image (base64 encoded 1x1 pixel PNG)
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const result = await cloudinary.uploader.upload(testImage, {
      folder: 'test',
      public_id: 'test-upload',
      resource_type: 'auto'
    });

    console.log('✅ Cloudinary test successful!');
    console.log('Uploaded URL:', result.secure_url);
    console.log('Public ID:', result.public_id);

    // Clean up test image
    await cloudinary.uploader.destroy('test/test-upload');
    console.log('✅ Test image cleaned up');

  } catch (error) {
    console.error('❌ Cloudinary test failed:', error.message);
    if (error.http_code) {
      console.error('HTTP Code:', error.http_code);
    }
  }
}

testCloudinary();
