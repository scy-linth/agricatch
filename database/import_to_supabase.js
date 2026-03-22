const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string' || token.split('.').length < 2) return null;
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function resolveSupabaseTargetUrl() {
  const explicitUrl = process.env.SUPABASE_DB_URL || process.env.TARGET_DATABASE_URL;
  if (explicitUrl) return explicitUrl;

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const payload = decodeJwtPayload(serviceRole);
  const projectRef = process.env.SUPABASE_PROJECT_REF || payload?.ref || '';
  const dbUser = process.env.SUPABASE_DB_USER || 'postgres';
  const dbName = process.env.SUPABASE_DB_NAME || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || '';
  const dbHost = process.env.SUPABASE_DB_HOST || (projectRef ? `db.${projectRef}.supabase.co` : '');
  const dbPort = Number(process.env.SUPABASE_DB_PORT || 5432);

  if (!dbHost || !dbPassword) return '';

  const encodedUser = encodeURIComponent(dbUser);
  const encodedPassword = encodeURIComponent(dbPassword);
  const encodedDb = encodeURIComponent(dbName);
  return `postgresql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${encodedDb}?sslmode=require`;
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function buildPlaceholders(rowCount, columnCount, offset = 0) {
  const rows = [];
  for (let r = 0; r < rowCount; r += 1) {
    const cols = [];
    for (let c = 0; c < columnCount; c += 1) {
      cols.push(`$${offset + r * columnCount + c + 1}`);
    }
    rows.push(`(${cols.join(', ')})`);
  }
  return rows.join(', ');
}

async function getPublicTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return result.rows.map((r) => r.table_name);
}

async function getTableColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `,
    [tableName]
  );
  return result.rows.map((r) => r.column_name);
}

async function truncateTables(client, tables) {
  if (!tables.length) return;
  const tableList = tables.map((t) => `${quoteIdent('public')}.${quoteIdent(t)}`).join(', ');
  await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
}

async function copyTableData(source, target, tableName, chunkSize = 500) {
  const sourceColumns = await getTableColumns(source, tableName);
  const targetColumns = await getTableColumns(target, tableName);
  const targetSet = new Set(targetColumns);
  const columns = sourceColumns.filter((c) => targetSet.has(c));
  if (!columns.length) return 0;

  const selectCols = columns.map(quoteIdent).join(', ');
  const sourceRows = await source.query(`SELECT ${selectCols} FROM ${quoteIdent('public')}.${quoteIdent(tableName)};`);
  if (!sourceRows.rows.length) return 0;

  const quotedCols = columns.map(quoteIdent).join(', ');
  let inserted = 0;

  for (let i = 0; i < sourceRows.rows.length; i += chunkSize) {
    const chunk = sourceRows.rows.slice(i, i + chunkSize);
    const values = [];

    for (const row of chunk) {
      for (const col of columns) {
        values.push(row[col]);
      }
    }

    const sql = `
      INSERT INTO ${quoteIdent('public')}.${quoteIdent(tableName)} (${quotedCols})
      VALUES ${buildPlaceholders(chunk.length, columns.length)};
    `;

    await target.query(sql, values);
    inserted += chunk.length;
  }

  return inserted;
}

async function resetSequences(client) {
  const seqResult = await client.query(`
    SELECT
      table_name,
      column_name,
      pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default LIKE 'nextval%';
  `);

  for (const row of seqResult.rows) {
    if (!row.sequence_name) continue;

    const table = `${quoteIdent('public')}.${quoteIdent(row.table_name)}`;
    const column = quoteIdent(row.column_name);

    await client.query(`
      SELECT setval(
        $1,
        COALESCE((SELECT MAX(${column}) FROM ${table}), 1),
        (SELECT COUNT(*) > 0 FROM ${table})
      );
    `, [row.sequence_name]);
  }
}

async function main() {
  const sourceConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'agricatch',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: String(process.env.DB_HOST || '').includes('render.com') ? { rejectUnauthorized: false } : false,
  };

  const targetUrl = resolveSupabaseTargetUrl();
  if (!targetUrl) {
    console.error('Missing target connection details for Supabase.');
    console.error('Set SUPABASE_DB_URL, or set SUPABASE_DB_PASSWORD plus (optional) SUPABASE_DB_HOST/SUPABASE_PROJECT_REF.');
    process.exit(1);
  }

  const source = new Client(sourceConfig);
  const target = new Client({
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false },
  });

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const copyOrder = [
    'categories',
    'users',
    'products',
    'cart',
    'orders',
    'order_items',
    'reviews',
    'wishlist',
    'notifications',
    'conversations',
    'messages',
    'user_addresses',
    'otps',
    'password_resets',
  ];

  try {
    console.log('Connecting to source and target databases...');
    await source.connect();
    await target.connect();

    console.log('Applying schema on Supabase target...');
    await target.query(schemaSql);

    const existingTargetTables = await getPublicTables(target);
    const tablesToCopy = copyOrder.filter((table) => existingTargetTables.includes(table));

    console.log('Truncating target tables before import...');
    await truncateTables(target, tablesToCopy);

    console.log('Copying data table-by-table...');
    for (const table of tablesToCopy) {
      const inserted = await copyTableData(source, target, table);
      console.log(`- ${table}: ${inserted} row(s)`);
    }

    console.log('Resetting serial sequences...');
    await resetSequences(target);

    console.log('Supabase import complete.');
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main();
