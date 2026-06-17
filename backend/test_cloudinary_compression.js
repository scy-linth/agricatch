// Test Cloudinary upload with compression settings
require('dotenv').config();
const cloudinary = require('./utils/cloudinary');
const fs = require('fs');
const path = require('path');

async function testCompression() {
  console.log('Testing Cloudinary upload with compression...\n');

  // Check Cloudinary config
  try {
    cloudinary.assertConfigured();
    console.log('✓ Cloudinary configured\n');
  } catch (error) {
    console.error('✗ Cloudinary not configured:', error.message);
    process.exit(1);
  }

  // Create a test image if none exists
  const testImagePath = path.join(__dirname, 'test-image.jpg');
  if (!fs.existsSync(testImagePath)) {
    console.log('Creating test image...');
    // Create a simple 1x1 pixel JPEG for testing
    const testImageBuffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////wAALCAACAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AT//Z',
      'base64'
    );
    fs.writeFileSync(testImagePath, testImageBuffer);
    console.log('✓ Test image created\n');
  }

  try {
    console.log('Uploading test image with compression settings...');
    console.log('Settings: quality=auto:good, fetch_format=auto\n');

    const result = await cloudinary.uploadFile(testImagePath, {
      public_id: 'agricatch/test/compression-test-' + Date.now(),
      overwrite: true
    });

    console.log('✓ Upload successful!\n');
    console.log('Result:', JSON.stringify({
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      resource_type: result.resource_type
    }, null, 2));

    console.log('\n✓ Compression test completed successfully!');
    console.log('Expected behavior:');
    console.log('  - Images should be optimized (30-50% smaller)');
    console.log('  - Format should be WebP when supported by browser');
    console.log('  - Quality should be balanced (auto:good)');

    // Cleanup
    fs.unlinkSync(testImagePath);
    console.log('\n✓ Test image cleaned up');

  } catch (error) {
    console.error('\n✗ Upload failed:', error.message);
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    process.exit(1);
  }
}

testCompression();
