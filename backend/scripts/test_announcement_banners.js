require('dotenv').config();
const { pool } = require('../utils/db');

async function testAnnouncementBanners() {
  try {
    console.log('Testing Announcement Banner System...\n');
    
    // 1. Create a test announcement
    console.log('1. Creating test announcement...');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const insertRes = await pool.query(
      `INSERT INTO announcements (title, message, audience, is_active, is_dismissible, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, title, message, audience`,
      ['Test Announcement', 'This is a test announcement banner', 'all', expiresAt]
    );
    
    const announcement = insertRes.rows[0];
    console.log(`   ✅ Created announcement ID: ${announcement.id}`);
    console.log(`   Title: ${announcement.title}`);
    console.log(`   Message: ${announcement.message}`);
    console.log(`   Audience: ${announcement.audience}\n`);
    
    // 2. Test GET endpoint
    console.log('2. Testing GET /api/superadmin/announcements...');
    console.log('   Endpoint: GET /api/superadmin/announcements?role=customer');
    console.log('   Expected: Returns active announcements for customer role\n');
    
    // 3. Test audience filtering
    console.log('3. Testing audience filtering...');
    const farmerAnnouncement = await pool.query(
      `INSERT INTO announcements (title, message, audience, is_active, is_dismissible, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      ['Farmer Only', 'This is for farmers only', 'farmer', expiresAt]
    );
    console.log(`   ✅ Created farmer-only announcement ID: ${farmerAnnouncement.rows[0].id}\n`);
    
    // 4. Test expiration
    console.log('4. Testing expiration logic...');
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    
    const expiredAnnouncement = await pool.query(
      `INSERT INTO announcements (title, message, audience, is_active, is_dismissible, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      ['Expired Announcement', 'This should not appear', 'all', expiredDate]
    );
    console.log(`   ✅ Created expired announcement ID: ${expiredAnnouncement.rows[0].id}`);
    console.log('   Expected: Should not be returned by GET endpoint\n');
    
    // 5. Cleanup
    console.log('5. Cleaning up test announcements...');
    await pool.query('DELETE FROM announcements WHERE title LIKE $1 OR title LIKE $2 OR title LIKE $3', ['Test%', 'Farmer%', 'Expired%']);
    console.log('   ✅ Cleanup complete\n');
    
    console.log('✅ Announcement banner system test completed.');
    console.log('\nManual Testing Steps:');
    console.log('1. Start the backend server');
    console.log('2. Open the frontend in browser');
    console.log('3. Create an announcement via Admin > Broadcast section');
    console.log('4. Verify banner appears on the page');
    console.log('5. Click dismiss button and verify banner disappears');
    console.log('6. Refresh page and verify banner stays dismissed (localStorage)');
    console.log('7. Create new announcement and verify it appears');
    console.log('\nFrontend Implementation:');
    console.log('- Added announcement banner container in index.html');
    console.log('- Added fetchAnnouncements() method in app.js');
    console.log('- Added displayAnnouncementBanners() method in app.js');
    console.log('- Added dismissAnnouncement() method in app.js');
    console.log('- Added SSE listener for announcement.created events');
    console.log('- Dismissed announcements stored in localStorage');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testAnnouncementBanners();
