#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const FISHERY_KEYWORDS_REGEX = /(fishery|seafood|fish|tilapia|tuna|prawn|shrimp|crab|lobster|salmon|sardine|mackerel)/i;

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    apply: args.has('--apply') || args.has('--yes'),
    dryRun: args.has('--dry-run') || !args.has('--apply'),
    verbose: args.has('--verbose'),
  };
}

function getPgSsl() {
  const sslEnv = String(process.env.DB_SSL || '').toLowerCase();
  if (sslEnv === 'true' || sslEnv === '1') return { rejectUnauthorized: false };
  if (String(process.env.DB_HOST || '').includes('render.com')) return { rejectUnauthorized: false };
  return false;
}

async function main() {
  const { apply, dryRun, verbose } = parseArgs(process.argv);

  const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'agricatch',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: getPgSsl(),
    connectionTimeoutMillis: 5000,
  };
  console.log(`[purge-fishery] connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} as ${dbConfig.user} (mode=${dryRun ? 'dry-run' : 'apply'})`);

  const pool = new Pool(dbConfig);

  try {
    const fisheryCats = await pool.query(
      "SELECT id, name, type FROM categories WHERE COALESCE(LOWER(type),'') = 'fishery' OR name ILIKE '%fish%' OR name ILIKE '%seafood%' ORDER BY id"
    );

    const fisheryProds = await pool.query(
      `
        SELECT p.id, p.name, p.description, p.is_available, p.category_id, c.name as category_name, COALESCE(c.type,'') as category_type
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE
          (c.id IS NOT NULL AND (COALESCE(LOWER(c.type),'') = 'fishery' OR c.name ILIKE '%fish%' OR c.name ILIKE '%seafood%'))
          OR p.name ~* '(fishery|seafood|fish|tilapia|tuna|prawn|shrimp|crab|lobster|salmon|sardine|mackerel)'
          OR (p.description IS NOT NULL AND p.description ~* '(fishery|seafood|fish|tilapia|tuna|prawn|shrimp|crab|lobster|salmon|sardine|mackerel)')
        ORDER BY p.id
      `
    );

    console.log(JSON.stringify({
      mode: dryRun ? 'dry-run' : 'apply',
      fishery_categories: fisheryCats.rowCount,
      fishery_products: fisheryProds.rowCount,
    }, null, 2));

    if (verbose) {
      if (fisheryCats.rowCount) {
        console.log('\nFishery categories:');
        for (const row of fisheryCats.rows) console.log(`- [${row.id}] ${row.name} (type=${row.type})`);
      }
      if (fisheryProds.rowCount) {
        console.log('\nFishery-like products:');
        for (const row of fisheryProds.rows) {
          const flagged = FISHERY_KEYWORDS_REGEX.test(`${row.name} ${row.description || ''}`) ? 'keyword' : 'category';
          console.log(`- [${row.id}] ${row.name} (flag=${flagged}, available=${row.is_available}, category=${row.category_name || row.category_id || 'null'})`);
        }
      }
    }

    if (!apply) {
      console.log('\nNo changes made. Re-run with --apply to disable fishery products and categories.');
      return;
    }

    // SAFETY: Non-destructive approach.
    // - Disable fishery-like products by setting is_available=false
    // - Keep categories.type unchanged (some DBs enforce a CHECK constraint)
    // - Optionally annotate/rename fishery categories so they are clearly not to be used

    if (fisheryProds.rowCount) {
      await pool.query(
        `
          UPDATE products
          SET is_available = false
          WHERE
            id IN (
              SELECT p.id
              FROM products p
              LEFT JOIN categories c ON p.category_id = c.id
              WHERE
                (c.id IS NOT NULL AND (COALESCE(LOWER(c.type),'') = 'fishery' OR c.name ILIKE '%fish%' OR c.name ILIKE '%seafood%'))
                OR p.name ~* '(fishery|seafood|fish|tilapia|tuna|prawn|shrimp|crab|lobster|salmon|sardine|mackerel)'
                OR (p.description IS NOT NULL AND p.description ~* '(fishery|seafood|fish|tilapia|tuna|prawn|shrimp|crab|lobster|salmon|sardine|mackerel)')
            )
        `
      );
    }

    if (fisheryCats.rowCount) {
      await pool.query(
        `
          UPDATE categories
          SET
            name = CASE
              WHEN name ILIKE 'DISABLED - %' THEN name
              ELSE CONCAT('DISABLED - ', name)
            END,
            description = CASE
              WHEN description ILIKE '%[DISABLED]%' THEN description
              WHEN description IS NULL OR description = '' THEN '[DISABLED]'
              ELSE CONCAT(description, ' [DISABLED]')
            END
          WHERE COALESCE(LOWER(type),'') = 'fishery' OR name ILIKE '%fish%' OR name ILIKE '%seafood%'
        `
      );
    }

    console.log('\n✅ Fishery cleanup applied (products disabled, categories annotated).');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('purge-fishery failed:', e);
  process.exit(1);
});
