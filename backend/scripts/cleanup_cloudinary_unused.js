#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('../utils/cloudinary');
const { pool } = require('../utils/db');

const args = process.argv.slice(2);
const doConfirm = args.includes('--confirm');
const limitPerPage = 500;
const prefixArg = args.find((arg) => arg.startsWith('--prefix='));
const exportArg = args.find((arg) => arg.startsWith('--export='));
const prefix = prefixArg ? prefixArg.split('=').slice(1).join('=').trim() : '';
const exportPath = exportArg ? exportArg.split('=').slice(1).join('=').trim() : '';

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
  if (!outputPath) return null;
  const absPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  const header = ['public_id', 'bytes', 'url', 'status'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      csvEscape(row.public_id),
      csvEscape(row.bytes),
      csvEscape(row.url),
      csvEscape(row.status)
    ].join(','));
  }

  fs.writeFileSync(absPath, `${lines.join('\n')}\n`, 'utf8');
  return absPath;
};

async function loadUsedPublicIds() {
  const res = await pool.query('SELECT cloudinary_public_id, image_url FROM products');
  const set = new Set();
  for (const row of res.rows) {
    if (row.cloudinary_public_id) set.add(String(row.cloudinary_public_id));
    const fromUrl = extractCloudinaryPublicId(row.image_url);
    if (fromUrl) set.add(String(fromUrl));
  }
  return set;
}

async function listAllCloudinaryResources() {
  const results = [];
  let nextCursor = undefined;
  do {
    const opts = { resource_type: 'image', type: 'upload', max_results: limitPerPage };
    if (nextCursor) opts.next_cursor = nextCursor;
    if (prefix) opts.prefix = prefix;
    const resp = await cloudinary.api.resources(opts);
    if (resp && Array.isArray(resp.resources)) {
      results.push(...resp.resources.map(r => ({ public_id: r.public_id, url: r.secure_url, bytes: r.bytes })));
    }
    nextCursor = resp.next_cursor;
  } while (nextCursor);
  return results;
}

async function main() {
  cloudinary.assertConfigured();

  console.log('Mode:', doConfirm ? 'confirm (delete)' : 'dry-run (report only)');
  if (prefix) console.log('Cloudinary prefix filter:', prefix);

  console.log('Loading used Cloudinary public IDs from database...');
  const used = await loadUsedPublicIds();
  console.log('Found', used.size, 'used public IDs in products table.');

  console.log('Listing Cloudinary image resources (this may take a while)...');
  const all = await listAllCloudinaryResources();
  console.log('Total Cloudinary images found:', all.length);

  const unused = all.filter(r => !used.has(r.public_id));
  console.log('Unused images (not referenced by products):', unused.length);

  if (unused.length === 0) {
    console.log('Nothing to delete. Exiting.');
    process.exit(0);
  }

  // Show a sample of unused images
  console.log('\nSample unused images:');
  unused.slice(0, 20).forEach((u, i) => console.log(`${i + 1}. ${u.public_id} (${u.bytes} bytes) ${u.url}`));

  if (exportPath) {
    const reportRows = unused.map((u) => ({
      public_id: u.public_id,
      bytes: u.bytes,
      url: u.url,
      status: doConfirm ? 'candidate_for_delete' : 'unused_dry_run'
    }));
    const written = writeCsv(reportRows, exportPath);
    console.log('CSV report written:', written);
  }

  if (!doConfirm) {
    console.log('\nDry-run: no deletions performed. Re-run with --confirm to delete unused images.');
    process.exit(0);
  }

  console.log('Proceeding to delete unused images...');
  const deletionRows = [];
  for (const u of unused) {
    try {
      const resp = await cloudinary.uploader.destroy(u.public_id, { resource_type: 'image' });
      console.log('Deleted', u.public_id, '=>', resp.result || resp);
      deletionRows.push({ public_id: u.public_id, bytes: u.bytes, url: u.url, status: String(resp.result || 'ok') });
    } catch (err) {
      console.warn('Failed to delete', u.public_id, err && (err.message || err));
      deletionRows.push({ public_id: u.public_id, bytes: u.bytes, url: u.url, status: `error:${err && (err.message || err)}` });
    }
  }

  if (exportPath) {
    const written = writeCsv(deletionRows, exportPath);
    console.log('Deletion CSV written:', written);
  }

  console.log('Deletion run complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Script error:', err && (err.message || err));
  process.exit(2);
});
