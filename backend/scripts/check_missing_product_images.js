const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.cxqyqffnrmfowwaefbff:etitsmwa123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
});

async function checkMissingImages() {
  try {
    const res = await pool.query(
      `SELECT id, name, image_url, cloudinary_public_id 
       FROM products 
       WHERE image_url IS NULL 
          OR image_url = '' 
          OR image_url LIKE '%resendlogo%'
          OR image_url LIKE '%null%'
       ORDER BY id`
    );
    
    console.log('Products without proper Cloudinary images:');
    console.log('='.repeat(80));
    
    if (res.rows.length === 0) {
      console.log('✓ All products have proper image URLs');
    } else {
      res.rows.forEach(p => {
        console.log(`ID: ${p.id}`);
        console.log(`Name: ${p.name}`);
        console.log(`Image URL: ${p.image_url}`);
        console.log(`Cloudinary ID: ${p.cloudinary_public_id}`);
        console.log('-'.repeat(40));
      });
      console.log(`Total: ${res.rows.length} products missing images`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkMissingImages();
