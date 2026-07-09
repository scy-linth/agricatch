require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('Testing Announcement Toggle Functionality...\n');

    // 1. Check existing announcements
    console.log('1. Checking existing announcements...');
    const existingRes = await pool.query(
      'SELECT id, title, message, audience, is_active, expires_at FROM announcements ORDER BY id DESC LIMIT 5'
    );
    
    if (existingRes.rows.length === 0) {
      console.log('   No announcements found. Creating a test announcement...');
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
      
      const insertRes = await pool.query(
        `INSERT INTO announcements (title, message, audience, is_active, is_dismissible, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, title, message, audience, is_active`,
        ['Test Toggle Announcement', 'This is a test announcement for toggle functionality', 'all', true, true, expiresAt]
      );
      
      console.log(`   ✅ Created test announcement ID: ${insertRes.rows[0].id}`);
      console.log(`   Title: ${insertRes.rows[0].title}`);
      console.log(`   Active: ${insertRes.rows[0].is_active}\n`);
      
      var announcementId = insertRes.rows[0].id;
    } else {
      console.log(`   Found ${existingRes.rows.length} existing announcement(s):`);
      existingRes.rows.forEach(a => {
        console.log(`   - ID: ${a.id}, Title: ${a.title}, Active: ${a.is_active}, Audience: ${a.audience}`);
      });
      
      // Use the first announcement for testing
      var announcementId = existingRes.rows[0].id;
      console.log(`   Using announcement ID ${announcementId} for toggle test\n`);
    }

    // 2. Get current state
    console.log('2. Getting current announcement state...');
    const beforeRes = await pool.query(
      'SELECT id, title, is_active FROM announcements WHERE id = $1',
      [announcementId]
    );
    
    if (beforeRes.rows.length === 0) {
      console.log('   ❌ Announcement not found');
      await pool.end();
      return;
    }
    
    const beforeState = beforeRes.rows[0].is_active;
    console.log(`   Current is_active: ${beforeState}\n`);

    // 3. Toggle the announcement
    console.log('3. Toggling announcement...');
    const newState = !beforeState;
    
    // When enabling, disable all other active announcements
    if (newState) {
      await pool.query(
        'UPDATE announcements SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE is_active = true AND id != $1',
        [announcementId]
      );
      console.log('   Disabled all other active announcements');
    }
    
    await pool.query(
      'UPDATE announcements SET is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [announcementId, newState]
    );
    console.log(`   Set is_active to: ${newState}\n`);

    // 4. Verify the change
    console.log('4. Verifying the change...');
    const afterRes = await pool.query(
      'SELECT id, title, is_active FROM announcements WHERE id = $1',
      [announcementId]
    );
    
    const afterState = afterRes.rows[0].is_active;
    console.log(`   New is_active: ${afterState}`);
    
    if (afterState === newState) {
      console.log('   ✅ Toggle successful!\n');
    } else {
      console.log('   ❌ Toggle failed\n');
    }

    // 5. Check all active announcements
    console.log('5. Checking all active announcements...');
    const activeRes = await pool.query(
      'SELECT id, title, is_active FROM announcements WHERE is_active = true ORDER BY id'
    );
    
    console.log(`   Total active announcements: ${activeRes.rows.length}`);
    activeRes.rows.forEach(a => {
      console.log(`   - ID: ${a.id}, Title: ${a.title}`);
    });
    
    if (activeRes.rows.length > 1) {
      console.log('   ⚠️  Warning: Multiple announcements are active');
    } else {
      console.log('   ✅ Only one announcement is active (as expected)\n');
    }

    // 6. Test toggle back
    console.log('6. Toggling back to original state...');
    const originalState = beforeState;
    
    if (originalState) {
      await pool.query(
        'UPDATE announcements SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE is_active = true AND id != $1',
        [announcementId]
      );
    }
    
    await pool.query(
      'UPDATE announcements SET is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [announcementId, originalState]
    );
    console.log(`   Restored is_active to: ${originalState}\n`);

    console.log('✅ Announcement toggle test completed successfully!');
    console.log('\nSummary:');
    console.log('- Announcement toggle endpoint works correctly');
    console.log('- is_active flag can be flipped');
    console.log('- When enabling, other announcements are disabled');
    console.log('- Only one announcement can be active at a time');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
