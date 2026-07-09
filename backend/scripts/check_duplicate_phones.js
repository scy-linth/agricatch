const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function checkDuplicatePhones() {
  try {
    console.log('Checking for duplicate phone numbers in users table...\n');

    // Find all phone numbers that appear more than once
    const duplicateQuery = `
      SELECT phone, COUNT(*) as count
      FROM users
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const result = await pool.query(duplicateQuery);

    if (result.rows.length === 0) {
      console.log('✓ No duplicate phone numbers found.');
      return;
    }

    console.log(`Found ${result.rows.length} phone number(s) with duplicates:\n`);

    for (const row of result.rows) {
      console.log(`Phone: ${row.phone} (${row.count} occurrences)`);

      // Get details of users with this phone number
      const usersQuery = `
        SELECT id, username, email, full_name, role, phone, created_at
        FROM users
        WHERE phone = $1
        ORDER BY created_at ASC
      `;
      const usersResult = await pool.query(usersQuery, [row.phone]);

      console.log('  Users:');
      for (const user of usersResult.rows) {
        console.log(`    - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}, Created: ${user.created_at}`);
      }
      console.log('');
    }

    // Summary statistics
    const totalUsersWithPhone = await pool.query(
      'SELECT COUNT(*) FROM users WHERE phone IS NOT NULL AND phone != \'\''
    );
    const totalUniquePhones = await pool.query(
      'SELECT COUNT(DISTINCT phone) FROM users WHERE phone IS NOT NULL AND phone != \'\''
    );

    console.log('\nSummary:');
    console.log(`  Total users with phone numbers: ${totalUsersWithPhone.rows[0].count}`);
    console.log(`  Unique phone numbers: ${totalUniquePhones.rows[0].count}`);
    console.log(`  Duplicate phone numbers: ${result.rows.length}`);

  } catch (error) {
    console.error('Error checking duplicate phones:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDuplicatePhones();
