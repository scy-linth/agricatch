#!/usr/bin/env node
/**
 * Clean placeholder / demo product rows from the products table.
 * Usage:
 *   node clean_placeholder_products.js --dry-run    # list candidates only
 *   node clean_placeholder_products.js --confirm    # perform backup + deletion
 */
const { pool } = require('../utils/db');

async function findCandidates() {
  const res = await pool.query(`
    SELECT p.*,
           COALESCE(s.sold_qty, 0)::int AS delivered_qty,
           (SELECT COUNT(*) FROM orders o WHERE o.product_id = p.id AND o.status = 'delivered') AS delivered_count
    FROM products p
    LEFT JOIN (
      SELECT product_id, COALESCE(SUM(quantity), 0)::int AS sold_qty
      FROM orders
      WHERE status = 'delivered'
      GROUP BY product_id
    ) s ON s.product_id = p.id
    WHERE (
      -- explicit marker heuristics
      LOWER(p.name) LIKE '%placeholder%'
      OR LOWER(p.name) LIKE '%demo%'
      OR LOWER(p.description) LIKE '%placeholder%'
      OR LOWER(p.description) LIKE '%prototype%'
      OR LOWER(p.description) LIKE '%demo%'
    )
    OR (
      -- sales_count exists but no delivered orders -> suspicious
      COALESCE(p.sales_count, 0) > 0
      AND COALESCE(s.sold_qty, 0) = 0
    )
    LIMIT 1000
  `);
  return res.rows || [];
}

async function backupAndDelete(ids, options = { noBackup: false }) {
  if (!ids.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!options.noBackup) {
      // create backup table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS products_placeholder_backup (
          id INTEGER PRIMARY KEY,
          data JSONB,
          backed_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    for (const id of ids) {
      const r = await client.query('SELECT * FROM products WHERE id = $1', [id]);
      if (r.rows.length === 0) continue;
      if (!options.noBackup) {
        await client.query('INSERT INTO products_placeholder_backup (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, backed_up_at = CURRENT_TIMESTAMP', [id, r.rows[0]]);
      }
      await client.query('DELETE FROM products WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run') || !argv.includes('--confirm');

  try {
    const candidates = await findCandidates();
    if (!candidates.length) {
      console.log('No placeholder/demo product candidates found.');
      process.exit(0);
    }

    console.log(`Found ${candidates.length} candidate products:`);
    for (const p of candidates) {
      console.log(`- id=${p.id} name=${p.name || '<no-name>'} sales_count=${p.sales_count || 0} delivered_qty=${p.delivered_qty || 0}`);
    }

    if (dryRun) {
      console.log('\nDry-run mode: no changes made. Re-run with --confirm to remove these rows.');
      process.exit(0);
    }

    const ids = candidates.map(c => c.id);
      const noBackup = argv.includes('--no-backup');
      if (noBackup) {
        console.log('\nDeleting candidate products WITHOUT backup (per --no-backup)');
      } else {
        console.log('\nBacking up and deleting candidate products...');
      }
      await backupAndDelete(ids, { noBackup });
      console.log(noBackup ? 'Deletion complete (no backup).' : 'Backup and deletion complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err && (err.message || err));
    process.exit(1);
  }
}

main();
