const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function resolveDuplicatePhones() {
  try {
    console.log('Resolving duplicate phone numbers in users table...\n');

    // Find all phone numbers that appear more than once
    const duplicateQuery = `
      SELECT phone, COUNT(*) as count
      FROM users
      WHERE phone IS NOT NULL AND phone != '' AND phone != '—'
      GROUP BY phone
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const result = await pool.query(duplicateQuery);

    if (result.rows.length === 0) {
      console.log('✓ No duplicate phone numbers found. Safe to add UNIQUE constraint.');
      return;
    }

    console.log(`Found ${result.rows.length} phone number(s) with duplicates.\n`);
    console.log('STRATEGY: Keep the oldest user with each phone number, clear phone from others.\n');

    for (const row of result.rows) {
      console.log(`Processing phone: ${row.phone} (${row.count} occurrences)`);

      // Get all users with this phone number, ordered by creation date
      const usersQuery = `
        SELECT id, username, email, full_name, role, phone, created_at
        FROM users
        WHERE phone = $1
        ORDER BY created_at ASC
      `;
      const usersResult = await pool.query(usersQuery, [row.phone]);

      const users = usersResult.rows;
      const keepUser = users[0]; // Keep the oldest user
      const clearUsers = users.slice(1); // Clear phone from newer users

      console.log(`  Keeping: ID ${keepUser.id} (${keepUser.username}) - created ${keepUser.created_at}`);
      
      for (const user of clearUsers) {
        console.log(`  Clearing phone from: ID ${user.id} (${user.username}) - created ${user.created_at}`);
        
        await pool.query(
          'UPDATE users SET phone = NULL WHERE id = $1',
          [user.id]
        );
      }
      console.log('');
    }

    console.log('✓ Duplicate phone numbers resolved.\n');

    // Verify no duplicates remain
    const verifyResult = await pool.query(`
      SELECT phone, COUNT(*) as count
      FROM users
      WHERE phone IS NOT NULL AND phone != '' AND phone != '—'
      GROUP BY phone
      HAVING COUNT(*) > 1
    `);

    if (verifyResult.rows.length === 0) {
      console.log('✓ Verification passed: No duplicate phone numbers remain.');
      console.log('✓ Safe to apply UNIQUE constraint now.');
    } else {
      console.log('⚠ Verification failed: Duplicates still exist.');
    }

  } catch (error) {
    console.error('Error resolving duplicate phones:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the resolution
resolveDuplicatePhones();
