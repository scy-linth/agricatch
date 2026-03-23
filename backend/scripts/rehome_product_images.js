#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('../utils/cloudinary');
const { pool } = require('../utils/db');

const args = process.argv.slice(2);
const doConfirm = args.includes('--confirm');
const exportArg = args.find((arg) => arg.startsWith('--export='));
const idRangeArg = args.find((arg) => arg.startsWith('--id-range='));

const exportPath = exportArg ? exportArg.split('=').slice(1).join('=').trim() : '';

const parseIdRange = () => {
  if (!idRangeArg) return null;
  const value = idRangeArg.split('=').slice(1).join('=').trim();
  const [minRaw, maxRaw] = value.split(':');
  const min = Number.parseInt(minRaw, 10);
  const max = Number.parseInt(maxRaw, 10);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) {
    throw new Error('Invalid --id-range value. Use --id-range=min:max.');
  }
  return { min, max };
};

const extractCloudinaryPublicId = (url) => {
  if (!url) return null;
  const value = String(url).trim();
  const match = value.match(
    /^https:\/\/res\.cloudinary\.com\/[^\/]+\/(?:image|video)\/upload\/(?:[^\/]+\/)*?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/
  );
  return match && match[1] ? match[1] : null;
};

const csvEscape = (value) => {
  const text = String(value == null ? '' : value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const writeCsv = (rows, outputFile) => {
  if (!outputFile) return null;
  const absPath = path.isAbsolute(outputFile) ? outputFile : path.join(process.cwd(), outputFile);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  const header = ['product_id', 'name', 'from_public_id', 'to_public_id', 'status'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      csvEscape(row.product_id),
      csvEscape(row.name),
      csvEscape(row.from_public_id),
      csvEscape(row.to_public_id),
      csvEscape(row.status)
    ].join(','));
  }
  fs.writeFileSync(absPath, `${lines.join('\n')}\n`, 'utf8');
  return absPath;
};

async function loadProducts(range) {
  if (range) {
    const result = await pool.query(
      `SELECT id, name, image_url, cloudinary_public_id
       FROM products
       WHERE id BETWEEN $1 AND $2
       ORDER BY id ASC`,
      [range.min, range.max]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT id, name, image_url, cloudinary_public_id
     FROM products
     ORDER BY id ASC`
  );
  return result.rows;
}

async function main() {
  cloudinary.assertConfigured();
  const range = parseIdRange();

  console.log('Mode:', doConfirm ? 'confirm (rehome + DB update)' : 'dry-run (report only)');
  if (range) {
    console.log(`Scope: product ids ${range.min} to ${range.max}`);
  } else {
    console.log('Scope: all products');
  }

  const products = await loadProducts(range);
  console.log('Products loaded:', products.length);

  let skippedNoImage = 0;
  let alreadyArranged = 0;
  let candidates = 0;
  let migrated = 0;
  let errors = 0;

  const rows = [];

  for (const product of products) {
    const currentPublicId = product.cloudinary_public_id || extractCloudinaryPublicId(product.image_url);
    if (!currentPublicId) {
      skippedNoImage += 1;
      rows.push({
        product_id: product.id,
        name: product.name,
        from_public_id: '',
        to_public_id: '',
        status: 'skipped:no_public_id'
      });
      continue;
    }

    const targetPublicId = cloudinary.publicIdForProduct(product.id, product.name, 'primary');
    if (currentPublicId === targetPublicId) {
      alreadyArranged += 1;
      rows.push({
        product_id: product.id,
        name: product.name,
        from_public_id: currentPublicId,
        to_public_id: targetPublicId,
        status: 'already_arranged'
      });
      continue;
    }

    candidates += 1;

    if (!doConfirm) {
      rows.push({
        product_id: product.id,
        name: product.name,
        from_public_id: currentPublicId,
        to_public_id: targetPublicId,
        status: 'would_migrate'
      });
      continue;
    }

    try {
      const renamed = await cloudinary.uploader.rename(currentPublicId, targetPublicId, {
        resource_type: 'image',
        overwrite: true,
        invalidate: true
      });

      const nextPublicId = renamed.public_id || targetPublicId;
      const nextImageUrl = renamed.secure_url || cloudinary.url(nextPublicId, { secure: true });

      await pool.query(
        `UPDATE products
         SET image_url = $1,
             cloudinary_public_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [nextImageUrl, nextPublicId, product.id]
      );

      migrated += 1;
      rows.push({
        product_id: product.id,
        name: product.name,
        from_public_id: currentPublicId,
        to_public_id: nextPublicId,
        status: 'migrated'
      });
    } catch (error) {
      errors += 1;
      rows.push({
        product_id: product.id,
        name: product.name,
        from_public_id: currentPublicId,
        to_public_id: targetPublicId,
        status: `error:${String(error && (error.message || error))}`
      });
    }
  }

  console.log('Skipped (no public_id):', skippedNoImage);
  console.log('Already arranged:', alreadyArranged);
  console.log('Candidates:', candidates);
  console.log(doConfirm ? 'Migrated:' : 'Would migrate:', doConfirm ? migrated : candidates);
  console.log('Errors:', errors);

  if (exportPath) {
    const written = writeCsv(rows, exportPath);
    console.log('CSV report written:', written);
  }

  if (!doConfirm) {
    console.log('Dry-run complete. Re-run with --confirm to migrate existing product images.');
  } else {
    console.log('Migration run complete.');
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Script error:', error && (error.message || error));
    try { await pool.end(); } catch (_) {}
    process.exit(2);
  });
