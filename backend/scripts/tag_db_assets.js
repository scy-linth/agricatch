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

const exportPath = exportArg ? exportArg.split('=').slice(1).join('=').trim() : null;

const parseIdRange = () => {
  if (!idRangeArg) return null;
  const value = idRangeArg.split('=').slice(1).join('=').trim();
  const [minRaw, maxRaw] = value.split(':');
  const min = Number.parseInt(minRaw, 10);
  const max = Number.parseInt(maxRaw, 10);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) {
    throw new Error('Invalid --id-range value. Use --id-range=min:max (positive integers).');
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

const writeCsv = (rows, outputPath) => {
  const absPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const header = ['product_id', 'public_id', 'exists', 'missing_tags', 'applied_tags', 'status'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      csvEscape(row.product_id),
      csvEscape(row.public_id),
      csvEscape(row.exists),
      csvEscape(row.missing_tags),
      csvEscape(row.applied_tags),
      csvEscape(row.status)
    ].join(','));
  }
  fs.writeFileSync(absPath, `${lines.join('\n')}\n`, 'utf8');
  return absPath;
};

async function fetchProducts(range) {
  if (range) {
    const result = await pool.query(
      `SELECT id, cloudinary_public_id, image_url
       FROM products
       WHERE id BETWEEN $1 AND $2
       ORDER BY id ASC`,
      [range.min, range.max]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT id, cloudinary_public_id, image_url
     FROM products
     ORDER BY id ASC`
  );
  return result.rows;
}

async function addMissingTags(publicId, missingTags) {
  const applied = [];
  for (const tag of missingTags) {
    await cloudinary.uploader.add_tag(tag, [publicId], { resource_type: 'image' });
    applied.push(tag);
  }
  return applied;
}

async function main() {
  cloudinary.assertConfigured();

  const range = parseIdRange();
  console.log('Mode:', doConfirm ? 'confirm (apply tags)' : 'dry-run (report only)');
  if (range) {
    console.log(`Scope: products id ${range.min} to ${range.max}`);
  } else {
    console.log('Scope: all products');
  }

  const products = await fetchProducts(range);
  console.log('Products loaded:', products.length);

  let processed = 0;
  let skipped = 0;
  let missingInCloudinary = 0;
  let changed = 0;
  let errors = 0;
  let needsUpdate = 0;

  const reportRows = [];

  for (const product of products) {
    const publicId = product.cloudinary_public_id || extractCloudinaryPublicId(product.image_url);
    if (!publicId) {
      skipped += 1;
      reportRows.push({
        product_id: product.id,
        public_id: '',
        exists: false,
        missing_tags: '',
        applied_tags: '',
        status: 'skipped:no_public_id'
      });
      continue;
    }

    processed += 1;
    const desiredTags = [
      'app:agricatch',
      'entity:product',
      `entity_id:${product.id}`,
      'migrated:true'
    ];

    try {
      const resource = await cloudinary.api.resource(publicId, { resource_type: 'image' });
      const existingTags = Array.isArray(resource.tags) ? resource.tags : [];
      const missingTags = desiredTags.filter((tag) => !existingTags.includes(tag));

      let appliedTags = [];
      if (missingTags.length) {
        needsUpdate += 1;
      }
      if (doConfirm && missingTags.length) {
        appliedTags = await addMissingTags(publicId, missingTags);
        changed += 1;
      }

      reportRows.push({
        product_id: product.id,
        public_id: publicId,
        exists: true,
        missing_tags: missingTags.join('|'),
        applied_tags: appliedTags.join('|'),
        status: missingTags.length ? (doConfirm ? 'updated' : 'would_update') : 'ok'
      });
    } catch (error) {
      const message = String(error && (error.message || error));
      const isNotFound = /not found|404/i.test(message);
      if (isNotFound) missingInCloudinary += 1;
      errors += 1;
      reportRows.push({
        product_id: product.id,
        public_id: publicId,
        exists: false,
        missing_tags: '',
        applied_tags: '',
        status: isNotFound ? 'missing_in_cloudinary' : `error:${message}`
      });
    }
  }

  console.log('Processed with public_id:', processed);
  console.log('Skipped (no public_id):', skipped);
  console.log('Missing in Cloudinary:', missingInCloudinary);
  console.log('Errors:', errors);
  console.log(doConfirm ? 'Updated resources:' : 'Resources needing updates:', doConfirm ? changed : needsUpdate);

  if (exportPath) {
    const written = writeCsv(reportRows, exportPath);
    console.log('CSV report written:', written);
  }

  if (!doConfirm) {
    console.log('Dry-run complete. Re-run with --confirm to apply tags.');
  } else {
    console.log('Confirm run complete.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script error:', error && (error.message || error));
    process.exit(2);
  });
