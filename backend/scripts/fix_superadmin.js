/**
 * fix_superadmin.js
 * - Removes any duplicate scy@linth rows (keeps only the one with role=super_admin or lowest id)
 * - Writes a fresh bcrypt hash for 'etitsmwa' into both password and password_hash
 * - Confirms the result
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../utils/db');

const ADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'scy@linth';
const ADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'etitsmwa';

(async function () {
  try {
    // 1. Find all rows for this email/username
    const all = await pool.query(
      "SELECT id, email, username, role FROM users WHERE email = $1 OR username = 'scy_linth' ORDER BY id ASC",
      [ADMIN_EMAIL]
    );
    console.log(`Found ${all.rows.length} row(s) for ${ADMIN_EMAIL}:`, all.rows);

    if (all.rows.length === 0) {
      console.error('No superadmin row found. Run create_superadmin.js first.');
      process.exit(2);
    }

    // 2. Determine the canonical row (prefer super_admin role, else lowest id)
    const canonical = all.rows.find(r => r.role === 'super_admin') || all.rows[0];
    console.log('Canonical row id:', canonical.id);

    // 3. Delete all other duplicate rows
    const duplicates = all.rows.filter(r => r.id !== canonical.id);
    for (const dup of duplicates) {
      await pool.query('DELETE FROM users WHERE id = $1', [dup.id]);
      console.log(`Deleted duplicate row id=${dup.id}`);
    }

    // 4. Write a fresh bcrypt hash
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.query(
      `UPDATE users
         SET password = $1,
             password_hash = $2,
             role = 'super_admin',
             is_disabled = false,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [ADMIN_PASSWORD, hash, canonical.id]
    );
    console.log('Password updated. Verifying...');

    // 5. Verify
    const verify = await pool.query(
      'SELECT id, email, username, role, password, password_hash, is_disabled FROM users WHERE id = $1',
      [canonical.id]
    );
    const row = verify.rows[0];
    const matches = await bcrypt.compare(ADMIN_PASSWORD, row.password_hash);
    console.log('Verification:', {
      id: row.id, email: row.email, username: row.username, role: row.role,
      password_plaintext: row.password,
      hash_prefix: row.password_hash.slice(0, 20) + '...',
      bcrypt_matches: matches,
      is_disabled: row.is_disabled
    });

    if (!matches) {
      console.error('ERROR: bcrypt verify failed after update!');
      process.exit(3);
    }
    console.log('SUCCESS: superadmin row is clean and password verified.');
  } catch (e) {
    console.error('ERROR:', e.message || e);
    process.exit(4);
  } finally {
    await pool.end();
  }
})();
