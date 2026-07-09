/**
 * Export Service
 *
 * Shared service for Excel exports.
 * Provides:
 *   - Reusable filtered order query (used by GET /admin/orders and /admin/orders/export.xlsx)
 *   - Reusable filtered farmer order query (used by GET /api/farmers/me/orders/export.xlsx)
 *   - Reusable filtered admin users query (used by GET /api/admin/users/export.xlsx)
 *   - Excel workbook generation matching the Admin Dashboard export style
 *
 * This keeps route handlers thin and avoids duplicating SQL / business logic.
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/* --------------------------------------------------------------------------
   Branding / styling constants (same palette as the Dashboard export)
   -------------------------------------------------------------------------- */
const AGRICATCH_GREEN = '2E7D32';
const LIGHT_GREEN = 'E8F5E9';
const DARK_GREEN = '1B5E20';
const HEADER_WHITE = 'FFFFFF';
const LABEL_BG = 'F5F5F5';
const FOOTER_TEXT = '666666';

/* --------------------------------------------------------------------------
   Formatting helpers
   -------------------------------------------------------------------------- */
function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  const d = value ? new Date(value) : new Date();
  return d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' });
}

function formatStatus(status, isDisabled = false) {
  if (isDisabled) return 'Disabled';
  if (!status) return 'N/A';
  const map = {
    preorder_reserved: 'Pre-order Reserved',
    out_for_delivery: 'Out for Delivery',
    cash_on_delivery: 'Cash on Delivery'
  };
  if (map[status]) return map[status];
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPaymentMethod(method) {
  if (!method) return '—';
  const map = {
    cash_on_delivery: 'Cash on Delivery',
    credit_card: 'Credit Card',
    bank_transfer: 'Bank Transfer',
    online_payment: 'Online Payment'
  };
  if (map[method]) return map[method];
  return method
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortLabel(sort) {
  const map = {
    date_desc: 'Newest first',
    date_asc: 'Oldest first',
    total_desc: 'Highest total',
    total_asc: 'Lowest total',
    id_desc: 'Order ID (desc)',
    id_asc: 'Order ID (asc)',
    customer_asc: 'Customer (A-Z)',
    customer_desc: 'Customer (Z-A)',
    status_asc: 'Status (A-Z)',
    status_desc: 'Status (Z-A)'
  };
  return map[sort] || 'Newest first';
}

/* --------------------------------------------------------------------------
   SQL helpers
   -------------------------------------------------------------------------- */
const ALLOWED_SORTS = {
  date_desc: 'o.created_at DESC',
  date_asc: 'o.created_at ASC',
  total_desc: 'o.total_amount DESC',
  total_asc: 'o.total_amount ASC',
  id_desc: 'o.id DESC',
  id_asc: 'o.id ASC',
  customer_asc: 'LOWER(COALESCE(u.full_name, u.username)) ASC',
  customer_desc: 'LOWER(COALESCE(u.full_name, u.username)) DESC',
  status_asc: 'o.status ASC',
  status_desc: 'o.status DESC'
};

function getSortSql(sort) {
  return ALLOWED_SORTS[sort] || ALLOWED_SORTS.date_desc;
}

function buildWhereClause(options) {
  const { search, status, dateFrom, dateTo, minTotal, maxTotal } = options;
  const whereParts = [];
  const whereValues = [];
  let idx = 1;

  if (search) {
    whereParts.push(`(
      u.username ILIKE $${idx}
      OR u.full_name ILIKE $${idx}
      OR u.email ILIKE $${idx}
      OR CAST(o.id AS TEXT) ILIKE $${idx}
      OR p.name ILIKE $${idx}
    )`);
    whereValues.push(`%${search}%`);
    idx++;
  }

  if (status) {
    whereParts.push(`o.status = $${idx++}`);
    whereValues.push(status);
  }

  if (dateFrom) {
    whereParts.push(`o.created_at >= $${idx++}::date`);
    whereValues.push(dateFrom);
  }

  if (dateTo) {
    whereParts.push(`o.created_at < ($${idx++}::date + interval '1 day')`);
    whereValues.push(dateTo);
  }

  if (Number.isFinite(minTotal)) {
    whereParts.push(`o.total_amount >= $${idx++}`);
    whereValues.push(minTotal);
  }

  if (Number.isFinite(maxTotal)) {
    whereParts.push(`o.total_amount <= $${idx++}`);
    whereValues.push(maxTotal);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  return { whereSql, whereValues };
}

/**
 * Fetch admin orders with the same filter logic used by the Orders page.
 */
async function getAdminOrders(pool, options = {}) {
  const {
    search,
    status,
    dateFrom,
    dateTo,
    minTotal,
    maxTotal,
    sort,
    page = 1,
    limit = 50,
    includeCount = true
  } = options;

  const { whereSql, whereValues } = buildWhereClause({ search, status, dateFrom, dateTo, minTotal, maxTotal });

  let total = 0;
  if (includeCount) {
    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN users f ON p.farmer_id = f.id
       ${whereSql}`,
      whereValues
    );
    total = totalRes.rows[0]?.count || 0;
  }

  const orderBySql = getSortSql(sort);
  const params = [...whereValues];

  let sql = `
    SELECT
      o.*,
      u.username AS customer_username,
      u.email AS customer_email,
      u.full_name AS customer_name,
      p.name AS product_name,
      p.image_url AS product_image,
      p.is_preorder,
      p.preorder_availability_date,
      p.reserved_quantity,
      p.max_preorder_quantity,
      p.harvest_date,
      f.full_name AS farmer_name,
      f.shop_name AS farmer_shop_name,
      f.username AS farmer_username
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN users f ON p.farmer_id = f.id
    ${whereSql}
    ORDER BY ${orderBySql}
  `;

  if (Number.isFinite(limit) && limit > 0) {
    const offset = Math.max(0, ((Number(page) || 1) - 1) * limit);
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const result = await pool.query(sql, params);
  return { orders: result.rows, total, page, limit };
}

/**
 * Fetch farmer orders with the same filter logic used by the Farmer Orders page.
 */
async function getFarmerOrders(pool, farmerId, options = {}) {
  const {
    status,
    dateFrom,
    dateTo,
    sort,
    page = 1,
    limit = 50,
    includeCount = true
  } = options;

  const whereParts = [];
  const whereValues = [farmerId];
  let idx = 2;

  // Always filter by farmer's products
  whereParts.push(`(p.farmer_id = $1 OR p.farmer_id IS NULL)`);
  whereParts.push(`COALESCE(o.is_disabled, false) = false`);

  if (status) {
    whereParts.push(`o.status = $${idx++}`);
    whereValues.push(status);
  }

  if (dateFrom) {
    whereParts.push(`o.created_at >= $${idx++}::date`);
    whereValues.push(dateFrom);
  }

  if (dateTo) {
    whereParts.push(`o.created_at < ($${idx++}::date + interval '1 day')`);
    whereValues.push(dateTo);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  let total = 0;
  if (includeCount) {
    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       ${whereSql}`,
      whereValues
    );
    total = totalRes.rows[0]?.count || 0;
  }

  const orderBySql = getSortSql(sort);
  const params = [...whereValues];

  let sql = `
    SELECT
      o.*,
      u.full_name AS customer_name,
      u.username AS customer_username,
      u.email AS customer_email,
      p.name AS product_name,
      p.unit,
      p.image_url AS product_image,
      p.is_preorder,
      p.preorder_availability_date
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN users u ON o.user_id = u.id
    ${whereSql}
    ORDER BY ${orderBySql}
  `;

  if (Number.isFinite(limit) && limit > 0) {
    const offset = Math.max(0, ((Number(page) || 1) - 1) * limit);
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const result = await pool.query(sql, params);
  return { orders: result.rows, total, page, limit };
}

/**
 * Fetch admin users with the same filter logic used by the Admin Users page.
 */
async function getAdminUsers(pool, options = {}) {
  const {
    search,
    role,
    status,
    verification,
    page = 1,
    limit = 50,
    includeCount = true,
    userRole = 'admin' // Role of the requesting user (admin or super_admin)
  } = options;

  // Get available columns from users table
  const userColumns = await getTableColumns(pool, 'users');
  const hasUserColumn = (column) => userColumns.has(column);

  const whereParts = [];
  const whereValues = [];
  let idx = 1;

  const allowedRoles = userRole === 'super_admin'
    ? ['customer', 'farmer', 'admin', 'super_admin']
    : ['customer', 'farmer'];

  if (search) {
    const searchClauses = ['username', 'email', 'full_name']
      .filter(hasUserColumn)
      .map((column) => `${column} ILIKE $${idx}`);
    if (hasUserColumn('first_name')) searchClauses.push(`COALESCE(first_name, '') ILIKE $${idx}`);
    if (hasUserColumn('last_name')) searchClauses.push(`COALESCE(last_name, '') ILIKE $${idx}`);
    if (searchClauses.length) {
      whereParts.push(`(${searchClauses.join(' OR ')})`);
      whereValues.push(`%${search}%`);
      idx++;
    }
  }

  if (role) {
    if (!allowedRoles.includes(role)) {
      throw new Error('Invalid or unauthorized role filter');
    }
    whereParts.push(`role = $${idx++}`);
    whereValues.push(role);
  } else if (userRole !== 'super_admin') {
    whereParts.push(`role <> $${idx++}`);
    whereValues.push('super_admin');
  }

  if (status === 'active') {
    whereParts.push(`COALESCE(is_disabled, false) = false`);
  } else if (status === 'disabled' || status === 'suspended') {
    whereParts.push(`COALESCE(is_disabled, false) = true`);
  }

  if (verification === 'verified') {
    whereParts.push(`COALESCE(is_verified, false) = true`);
  } else if (verification === 'unverified' || verification === 'pending') {
    whereParts.push(`COALESCE(is_verified, false) = false`);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  let total = 0;
  if (includeCount) {
    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM users ${whereSql}`,
      whereValues
    );
    total = totalRes.rows[0]?.count || 0;
  }

  const selectFields = [
    'id',
    'username',
    'email',
    'full_name',
    'role',
    'created_at',
    'first_name',
    'middle_name',
    'last_name',
    'phone',
    'address',
    'is_verified',
    'is_disabled',
    'disabled_at',
    'disabled_reason',
    'disable_type',
    'is_debug_account',
    'shop_name'
  ].filter(hasUserColumn);

  const params = [...whereValues];
  let sql = `SELECT ${selectFields.join(', ')} FROM users ${whereSql} ORDER BY created_at DESC`;

  if (Number.isFinite(limit) && limit > 0) {
    const offset = Math.max(0, ((Number(page) || 1) - 1) * limit);
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const result = await pool.query(sql, params);
  return { users: result.rows, total, page, limit };
}

/**
 * Get table columns helper (reused from admin.js)
 */
async function getTableColumns(pool, tableName) {
  const key = String(tableName || '').trim().toLowerCase();
  if (!key) return new Set();
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [key]
  );
  return new Set((res.rows || []).map((row) => String(row.column_name || '').toLowerCase()));
}

/**
 * Compute the Order Summary cards from a set of rows.
 */
function computeOrderSummary(rows) {
  let totalRevenue = 0;
  let deliveredOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;

  for (const row of rows) {
    const isDisabled = !!row.is_disabled;
    const effectiveStatus = isDisabled ? 'disabled' : row.status;

    if (effectiveStatus !== 'cancelled' && effectiveStatus !== 'disabled') {
      totalRevenue += Number(row.total_amount) || 0;
    }

    if (effectiveStatus === 'delivered') deliveredOrders++;
    if (effectiveStatus === 'pending') pendingOrders++;
    if (effectiveStatus === 'cancelled') cancelledOrders++;
  }

  return {
    totalOrders: rows.length,
    totalRevenue,
    deliveredOrders,
    pendingOrders,
    cancelledOrders
  };
}

/**
 * Compute the Farmer Order Summary cards from a set of rows.
 * Includes total items sold (quantity from delivered orders).
 */
function computeFarmerOrderSummary(rows) {
  let totalRevenue = 0;
  let deliveredOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  let totalItemsSold = 0;

  for (const row of rows) {
    const isDisabled = !!row.is_disabled;
    const effectiveStatus = isDisabled ? 'disabled' : row.status;

    if (effectiveStatus === 'delivered') {
      totalRevenue += Number(row.total_amount) || 0;
      totalItemsSold += Number(row.quantity) || 0;
      deliveredOrders++;
    } else if (effectiveStatus === 'pending') {
      pendingOrders++;
    } else if (effectiveStatus === 'cancelled') {
      cancelledOrders++;
    }
  }

  return {
    totalOrders: rows.length,
    totalRevenue,
    deliveredOrders,
    pendingOrders,
    cancelledOrders,
    totalItemsSold
  };
}

/**
 * Compute the User Summary cards from a set of rows.
 */
function computeUserSummary(rows) {
  let totalUsers = rows.length;
  let activeUsers = 0;
  let inactiveUsers = 0;
  let customers = 0;
  let farmers = 0;
  let admins = 0;

  for (const row of rows) {
    const isDisabled = !!row.is_disabled;
    if (isDisabled) {
      inactiveUsers++;
    } else {
      activeUsers++;
    }

    if (row.role === 'customer') customers++;
    if (row.role === 'farmer') farmers++;
    if (row.role === 'admin' || row.role === 'super_admin') admins++;
  }

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    customers,
    farmers,
    admins
  };
}

/* --------------------------------------------------------------------------
   Excel workbook builder
   -------------------------------------------------------------------------- */
function addLogo(Workbook, ws) {
  const logoPath = path.join(__dirname, '../../frontend/images/resendlogo.png');
  let logoId = null;
  let logoNaturalWidth = 0;
  let logoNaturalHeight = 0;

  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoId = Workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    if (logoBuffer && logoBuffer.length >= 24 && logoBuffer.toString('ascii', 1, 4) === 'PNG') {
      logoNaturalWidth = logoBuffer.readUInt32BE(16);
      logoNaturalHeight = logoBuffer.readUInt32BE(20);
    }
  }

  const targetLogoWidth = 150;
  const targetLogoHeight = logoNaturalWidth
    ? Math.round(targetLogoWidth * (logoNaturalHeight / logoNaturalWidth))
    : 50;

  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { col: 1, row: 0 },
      ext: { width: targetLogoWidth, height: targetLogoHeight }
    });
  }

  return { logoId, targetLogoHeight };
}

function buildFilterDescription(options) {
  const { status, search, minTotal, maxTotal, dateFrom, dateTo, sort } = options;
  const parts = [];

  if (status) parts.push(`Status: ${formatStatus(status)}`);
  if (search) parts.push(`Search: "${search}"`);
  if (Number.isFinite(minTotal) || Number.isFinite(maxTotal)) {
    if (Number.isFinite(minTotal) && Number.isFinite(maxTotal)) {
      parts.push(`Price: ${formatCurrency(minTotal)} - ${formatCurrency(maxTotal)}`);
    } else if (Number.isFinite(minTotal)) {
      parts.push(`Price: ≥ ${formatCurrency(minTotal)}`);
    } else {
      parts.push(`Price: ≤ ${formatCurrency(maxTotal)}`);
    }
  }
  if (sort) parts.push(`Sort: ${sortLabel(sort)}`);

  return parts.length ? parts.join(' | ') : '—';
}

function buildDateRangeDescription(dateFrom, dateTo) {
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
  if (dateFrom) return `From ${dateFrom}`;
  if (dateTo) return `Until ${dateTo}`;
  return 'All dates';
}

function applyHeaderInfoStyling(ws, startRow, endRow, colEnd) {
  for (let row = startRow; row <= endRow; row++) {
    const labelCell = ws.getCell(row, 1);
    labelCell.font = { bold: true, size: 11 };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LABEL_BG } };
    labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    const valueCell = ws.getCell(row, 2);
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    valueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    ws.mergeCells(row, 2, row, colEnd);
  }
}

function applySectionHeader(ws, cellRef, range, colEnd) {
  const cell = ws.getCell(cellRef);
  cell.font = { bold: true, size: 14, color: { argb: AGRICATCH_GREEN } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(range);
}

function applyTableHeaderStyle(ws, row, colStart, colCount) {
  for (let col = colStart; col <= colStart + colCount - 1; col++) {
    const cell = ws.getCell(row, col);
    cell.font = { bold: true, size: 12, color: { argb: HEADER_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AGRICATCH_GREEN } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  }
}

function applyTableDataStyle(ws, startRow, endRow, colStart, colCount, alignmentFn) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = colStart; col <= colStart + colCount - 1; col++) {
      const cell = ws.getCell(row, col);
      cell.font = { size: 11 };
      cell.alignment = { horizontal: alignmentFn ? alignmentFn(col) : 'left', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      if (row % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
      }
    }
  }
}

async function buildAdminOrdersExcel(pool, options, user) {
  const {
    search,
    status,
    dateFrom,
    dateTo,
    minTotal,
    maxTotal,
    sort
  } = options;

  // Fetch all filtered rows (no pagination)
  const { orders: rows } = await getAdminOrders(pool, {
    search,
    status,
    dateFrom,
    dateTo,
    minTotal,
    maxTotal,
    sort,
    page: 1,
    limit: 0,
    includeCount: false
  });

  const summary = computeOrderSummary(rows);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Orders Report');

  const generatedAt = formatDateTime();
  const generatedBy = {
    name: user?.full_name || 'N/A',
    email: user?.email || 'N/A',
    phone: user?.phone || 'N/A',
    role: user?.role === 'super_admin' ? 'Super Admin' : (user?.role === 'admin' ? 'Administrator' : (user?.role || 'N/A'))
  };

  const filterDescription = buildFilterDescription({ status, search, minTotal, maxTotal, dateFrom, dateTo, sort });
  const dateRangeDescription = buildDateRangeDescription(dateFrom, dateTo);
  const COL_COUNT = 11;

  // Header block
  let row = 0;

  row = ws.addRow([]).number; // spacer row that will contain the logo
  const { targetLogoHeight } = addLogo(workbook, ws);
  ws.getRow(1).height = Math.max(15, targetLogoHeight * 0.75);
  row = ws.addRow([]).number; // spacer
  row = ws.addRow(['Admin Orders Report']).number; // title
  row = ws.addRow([]).number; // spacer

  const titleCell = ws.getCell(row - 1, 1);
  titleCell.font = { bold: true, size: 20, color: { argb: DARK_GREEN } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row - 1, 1, row - 1, COL_COUNT);

  row = ws.addRow(['Report Information']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:K${row}`, COL_COUNT);

  const infoStartRow = row + 1;
  row = ws.addRow(['Generated Date & Time:', generatedAt]).number;
  row = ws.addRow(['Selected Filters:', filterDescription]).number;
  row = ws.addRow(['Date Range:', dateRangeDescription]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, infoStartRow, row - 1, COL_COUNT);

  row = ws.addRow(['Generated By']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:K${row}`, COL_COUNT);

  const generatedByStartRow = row + 1;
  row = ws.addRow(['Name:', generatedBy.name]).number;
  row = ws.addRow(['Email:', generatedBy.email]).number;
  row = ws.addRow(['Phone:', generatedBy.phone]).number;
  row = ws.addRow(['Role:', generatedBy.role]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, generatedByStartRow, row - 1, COL_COUNT);

  // Summary block
  const SUMMARY_COLS = 5;
  row = ws.addRow(['Summary']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:E${row}`, SUMMARY_COLS);

  row = ws.addRow([]).number;
  const summaryHeaderRow = ws.addRow([
    'Total Orders',
    'Total Revenue',
    'Delivered Orders',
    'Pending Orders',
    'Cancelled Orders'
  ]).number;
  const summaryDataRow = ws.addRow([
    summary.totalOrders,
    formatCurrency(summary.totalRevenue),
    summary.deliveredOrders,
    summary.pendingOrders,
    summary.cancelledOrders
  ]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, summaryHeaderRow, 1, SUMMARY_COLS);
  applyTableDataStyle(ws, summaryDataRow, summaryDataRow, 1, SUMMARY_COLS, (col) => {
    if (col === 2) return 'right'; // Total Revenue
    return 'center';
  });

  // Orders table block
  row = ws.addRow(['Orders']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:K${row}`, COL_COUNT);

  const orderHeaders = [
    'Order ID',
    'Customer Name',
    'Farmer Name',
    'Product Name',
    'Quantity',
    'Unit Price',
    'Order Total',
    'Order Status',
    'Payment Method',
    'Order Date',
    'Delivery Date'
  ];
  const orderHeaderRow = ws.addRow(orderHeaders).number;

  const orderDataStartRow = orderHeaderRow + 1;
  for (const data of rows) {
    const farmerName = data.farmer_name || data.farmer_shop_name || data.farmer_username || '—';
    const customerName = data.customer_name || data.customer_username || data.customer_email || '—';
    row = ws.addRow([
      data.id,
      customerName,
      farmerName,
      data.product_name || '—',
      data.quantity,
      formatCurrency(data.price),
      formatCurrency(data.total_amount),
      formatStatus(data.status, data.is_disabled),
      formatPaymentMethod(data.payment_method),
      formatDate(data.created_at),
      formatDate(data.delivery_date)
    ]).number;
  }
  const orderDataEndRow = row;
  row = ws.addRow([]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, orderHeaderRow, 1, COL_COUNT);
  applyTableDataStyle(ws, orderDataStartRow, orderDataEndRow, 1, COL_COUNT, (col) => {
    switch (col) {
      case 1: return 'center'; // Order ID
      case 5: return 'center'; // Quantity
      case 6: return 'right';  // Unit Price
      case 7: return 'right';  // Order Total
      case 8: return 'center'; // Order Status
      case 10: // Order Date
      case 11: // Delivery Date
        return 'left';
      default:
        return 'left';
    }
  });

  // Footer
  const footerRow1 = ws.addRow(['']).number;
  ws.mergeCells(footerRow1, 1, footerRow1, COL_COUNT);
  const cell1 = ws.getCell(footerRow1, 1);
  cell1.value = 'Generated by AgriCatch Platform';
  cell1.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell1.alignment = { horizontal: 'center' };

  const footerRow2 = ws.addRow(['']).number;
  ws.mergeCells(footerRow2, 1, footerRow2, COL_COUNT);
  const cell2 = ws.getCell(footerRow2, 1);
  cell2.value = 'Copyright © 2026 AgriCatch. All rights reserved.';
  cell2.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell2.alignment = { horizontal: 'center' };

  // Column widths
  ws.getColumn(1).width = 12;  // Order ID
  ws.getColumn(2).width = 25;  // Customer Name
  ws.getColumn(3).width = 25;  // Farmer Name
  ws.getColumn(4).width = 30;  // Product Name
  ws.getColumn(5).width = 12;  // Quantity
  ws.getColumn(6).width = 15;  // Unit Price
  ws.getColumn(7).width = 15;  // Order Total
  ws.getColumn(8).width = 18;  // Order Status
  ws.getColumn(9).width = 20;  // Payment Method
  ws.getColumn(10).width = 18; // Order Date
  ws.getColumn(11).width = 18; // Delivery Date

  // Generate filename
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `Admin_Orders_Report_${dateStr}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
}

async function buildFarmerOrdersExcel(pool, farmerId, options, user) {
  const {
    status,
    dateFrom,
    dateTo,
    sort
  } = options;

  // Fetch all filtered rows (no pagination)
  const { orders: rows } = await getFarmerOrders(pool, farmerId, {
    status,
    dateFrom,
    dateTo,
    sort,
    page: 1,
    limit: 0,
    includeCount: false
  });

  const summary = computeFarmerOrderSummary(rows);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Orders Report');

  const generatedAt = formatDateTime();
  const generatedBy = {
    name: user?.full_name || 'N/A',
    email: user?.email || 'N/A',
    phone: user?.phone || 'N/A',
    role: 'Farmer'
  };

  const filterDescription = buildFilterDescription({ status, dateFrom, dateTo, sort });
  const dateRangeDescription = buildDateRangeDescription(dateFrom, dateTo);
  const COL_COUNT = 10; // Fewer columns for farmer orders (no farmer name)

  // Header block
  let row = 0;

  row = ws.addRow([]).number; // spacer row that will contain the logo
  const { targetLogoHeight } = addLogo(workbook, ws);
  ws.getRow(1).height = Math.max(15, targetLogoHeight * 0.75);
  row = ws.addRow([]).number; // spacer
  row = ws.addRow(['Farmer Orders Report']).number; // title
  row = ws.addRow([]).number; // spacer

  const titleCell = ws.getCell(row - 1, 1);
  titleCell.font = { bold: true, size: 20, color: { argb: DARK_GREEN } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row - 1, 1, row - 1, COL_COUNT);

  row = ws.addRow(['Report Information']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:J${row}`, COL_COUNT);

  const infoStartRow = row + 1;
  row = ws.addRow(['Generated Date & Time:', generatedAt]).number;
  row = ws.addRow(['Selected Filters:', filterDescription]).number;
  row = ws.addRow(['Date Range:', dateRangeDescription]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, infoStartRow, row - 1, COL_COUNT);

  row = ws.addRow(['Generated By']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:J${row}`, COL_COUNT);

  const generatedByStartRow = row + 1;
  row = ws.addRow(['Name:', generatedBy.name]).number;
  row = ws.addRow(['Email:', generatedBy.email]).number;
  row = ws.addRow(['Phone:', generatedBy.phone]).number;
  row = ws.addRow(['Role:', generatedBy.role]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, generatedByStartRow, row - 1, COL_COUNT);

  // Summary block
  const SUMMARY_COLS = 6;
  row = ws.addRow(['Summary']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:F${row}`, SUMMARY_COLS);

  row = ws.addRow([]).number;
  const summaryHeaderRow = ws.addRow([
    'Total Orders',
    'Total Items Sold',
    'Total Revenue',
    'Delivered Orders',
    'Pending Orders',
    'Cancelled Orders'
  ]).number;
  const summaryDataRow = ws.addRow([
    summary.totalOrders,
    summary.totalItemsSold,
    formatCurrency(summary.totalRevenue),
    summary.deliveredOrders,
    summary.pendingOrders,
    summary.cancelledOrders
  ]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, summaryHeaderRow, 1, SUMMARY_COLS);
  applyTableDataStyle(ws, summaryDataRow, summaryDataRow, 1, SUMMARY_COLS, (col) => {
    if (col === 3) return 'right'; // Total Revenue
    return 'center';
  });

  // Orders table block
  row = ws.addRow(['Orders']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:J${row}`, COL_COUNT);

  const orderHeaders = [
    'Order ID',
    'Customer Name',
    'Product Name',
    'Quantity',
    'Unit Price',
    'Order Total',
    'Order Status',
    'Payment Method',
    'Order Date',
    'Delivery Date'
  ];
  const orderHeaderRow = ws.addRow(orderHeaders).number;

  const orderDataStartRow = orderHeaderRow + 1;
  for (const data of rows) {
    const customerName = data.customer_name || data.customer_username || data.customer_email || '—';
    row = ws.addRow([
      data.id,
      customerName,
      data.product_name || '—',
      data.quantity,
      formatCurrency(data.price),
      formatCurrency(data.total_amount),
      formatStatus(data.status, data.is_disabled),
      formatPaymentMethod(data.payment_method),
      formatDate(data.created_at),
      formatDate(data.delivery_date)
    ]).number;
  }
  const orderDataEndRow = row;
  row = ws.addRow([]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, orderHeaderRow, 1, COL_COUNT);
  applyTableDataStyle(ws, orderDataStartRow, orderDataEndRow, 1, COL_COUNT, (col) => {
    switch (col) {
      case 1: return 'center'; // Order ID
      case 4: return 'center'; // Quantity
      case 5: return 'right';  // Unit Price
      case 6: return 'right';  // Order Total
      case 7: return 'center'; // Order Status
      case 9: // Order Date
      case 10: // Delivery Date
        return 'left';
      default:
        return 'left';
    }
  });

  // Footer
  const footerRow1 = ws.addRow(['']).number;
  ws.mergeCells(footerRow1, 1, footerRow1, COL_COUNT);
  const cell1 = ws.getCell(footerRow1, 1);
  cell1.value = 'Generated by AgriCatch Platform';
  cell1.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell1.alignment = { horizontal: 'center' };

  const footerRow2 = ws.addRow(['']).number;
  ws.mergeCells(footerRow2, 1, footerRow2, COL_COUNT);
  const cell2 = ws.getCell(footerRow2, 1);
  cell2.value = 'Copyright © 2026 AgriCatch. All rights reserved.';
  cell2.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell2.alignment = { horizontal: 'center' };

  // Column widths
  ws.getColumn(1).width = 12;  // Order ID
  ws.getColumn(2).width = 25;  // Customer Name
  ws.getColumn(3).width = 30;  // Product Name
  ws.getColumn(4).width = 12;  // Quantity
  ws.getColumn(5).width = 15;  // Unit Price
  ws.getColumn(6).width = 15;  // Order Total
  ws.getColumn(7).width = 18;  // Order Status
  ws.getColumn(8).width = 20;  // Payment Method
  ws.getColumn(9).width = 18;  // Order Date
  ws.getColumn(10).width = 18; // Delivery Date

  // Generate filename
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `Farmer_Orders_Report_${dateStr}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
}

async function buildAdminUsersExcel(pool, options, user) {
  const {
    search,
    role,
    status,
    verification
  } = options;

  // Fetch all filtered rows (no pagination)
  const { users: rows } = await getAdminUsers(pool, {
    search,
    role,
    status,
    verification,
    page: 1,
    limit: 0,
    includeCount: false,
    userRole: user.role
  });

  const summary = computeUserSummary(rows);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Users Report');

  const generatedAt = formatDateTime();
  const generatedBy = {
    name: user?.full_name || 'N/A',
    email: user?.email || 'N/A',
    phone: user?.phone || 'N/A',
    role: user?.role || 'admin'
  };

  const filterDescription = buildUserFilterDescription({ search, role, status, verification });
  const COL_COUNT = 8; // User ID, Full Name, Role, Email, Phone, Status, Registration Date, Last Login

  // Determine report title based on role filter
  let reportTitle = 'All Users Report';
  if (role === 'customer') reportTitle = 'Customer Report';
  if (role === 'farmer') reportTitle = 'Farmer Report';
  if (role === 'admin' || role === 'super_admin') reportTitle = 'Admin Report';

  // Header block
  let row = 0;

  row = ws.addRow([]).number; // spacer row that will contain the logo
  const { targetLogoHeight } = addLogo(workbook, ws);
  ws.getRow(1).height = Math.max(15, targetLogoHeight * 0.75);
  row = ws.addRow([]).number; // spacer
  row = ws.addRow([reportTitle]).number; // title
  row = ws.addRow([]).number; // spacer

  const titleCell = ws.getCell(row - 1, 1);
  titleCell.font = { bold: true, size: 20, color: { argb: DARK_GREEN } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row - 1, 1, row - 1, COL_COUNT);

  row = ws.addRow(['Report Information']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:H${row}`, COL_COUNT);

  const infoStartRow = row + 1;
  row = ws.addRow(['Generated Date & Time:', generatedAt]).number;
  row = ws.addRow(['Selected Filters:', filterDescription]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, infoStartRow, row - 1, COL_COUNT);

  row = ws.addRow(['Generated By']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:H${row}`, COL_COUNT);

  const generatedByStartRow = row + 1;
  row = ws.addRow(['Name:', generatedBy.name]).number;
  row = ws.addRow(['Email:', generatedBy.email]).number;
  row = ws.addRow(['Phone:', generatedBy.phone]).number;
  row = ws.addRow(['Role:', generatedBy.role]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, generatedByStartRow, row - 1, COL_COUNT);

  // Summary block
  const SUMMARY_COLS = 6;
  row = ws.addRow(['Summary']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:F${row}`, SUMMARY_COLS);

  row = ws.addRow([]).number;
  const summaryHeaderRow = ws.addRow([
    'Total Users',
    'Active Users',
    'Inactive Users',
    'Customers',
    'Farmers',
    'Admins'
  ]).number;
  const summaryDataRow = ws.addRow([
    summary.totalUsers,
    summary.activeUsers,
    summary.inactiveUsers,
    summary.customers,
    summary.farmers,
    summary.admins
  ]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, summaryHeaderRow, 1, SUMMARY_COLS);
  applyTableDataStyle(ws, summaryDataRow, summaryDataRow, 1, SUMMARY_COLS, () => 'center');

  // Users table block
  row = ws.addRow(['Users']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:H${row}`, COL_COUNT);

  const userHeaders = [
    'User ID',
    'Full Name',
    'Role',
    'Email',
    'Phone',
    'Status',
    'Registration Date',
    'Last Login'
  ];
  const userHeaderRow = ws.addRow(userHeaders).number;

  const userDataStartRow = userHeaderRow + 1;
  for (const data of rows) {
    const fullName = data.full_name || `${data.first_name || ''} ${data.middle_name || ''} ${data.last_name || ''}`.trim() || data.username || '—';
    row = ws.addRow([
      data.id,
      fullName,
      data.role,
      data.email || '—',
      data.phone || '—',
      formatUserStatus(data.is_disabled, data.disable_type),
      formatDate(data.created_at),
      'N/A' // Last login not available in current schema
    ]).number;
  }
  const userDataEndRow = row;
  row = ws.addRow([]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, userHeaderRow, 1, COL_COUNT);
  applyTableDataStyle(ws, userDataStartRow, userDataEndRow, 1, COL_COUNT, (col) => {
    switch (col) {
      case 1: return 'center'; // User ID
      case 3: return 'center'; // Role
      case 6: return 'center'; // Status
      case 7: // Registration Date
      case 8: // Last Login
        return 'left';
      default:
        return 'left';
    }
  });

  // Footer
  const footerRow1 = ws.addRow(['']).number;
  ws.mergeCells(footerRow1, 1, footerRow1, COL_COUNT);
  const cell1 = ws.getCell(footerRow1, 1);
  cell1.value = 'Generated by AgriCatch Platform';
  cell1.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell1.alignment = { horizontal: 'center' };

  const footerRow2 = ws.addRow(['']).number;
  ws.mergeCells(footerRow2, 1, footerRow2, COL_COUNT);
  const cell2 = ws.getCell(footerRow2, 1);
  cell2.value = 'Copyright © 2026 AgriCatch. All rights reserved.';
  cell2.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell2.alignment = { horizontal: 'center' };

  // Column widths
  ws.getColumn(1).width = 12;  // User ID
  ws.getColumn(2).width = 30;  // Full Name
  ws.getColumn(3).width = 15;  // Role
  ws.getColumn(4).width = 30;  // Email
  ws.getColumn(5).width = 18;  // Phone
  ws.getColumn(6).width = 15;  // Status
  ws.getColumn(7).width = 20;  // Registration Date
  ws.getColumn(8).width = 20;  // Last Login

  // Generate filename
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  let filename = 'Admin_All_Users_Report_YYYY-MM-DD.xlsx';
  if (role === 'customer') filename = 'Admin_Customers_Report_YYYY-MM-DD.xlsx';
  if (role === 'farmer') filename = 'Admin_Farmers_Report_YYYY-MM-DD.xlsx';
  if (role === 'admin' || role === 'super_admin') filename = 'Admin_Admins_Report_YYYY-MM-DD.xlsx';
  filename = filename.replace('YYYY-MM-DD', dateStr);

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
}

function buildUserFilterDescription({ search, role, status, verification }) {
  const parts = [];
  if (search) parts.push(`Search: "${search}"`);
  if (role) parts.push(`Role: ${role}`);
  if (status) parts.push(`Status: ${status}`);
  if (verification) parts.push(`Verification: ${verification}`);
  return parts.length ? parts.join(', ') : 'None';
}

function formatUserStatus(isDisabled, disableType) {
  if (isDisabled) {
    return disableType === 'suspended' ? 'Suspended' : 'Disabled';
  }
  return 'Active';
}

async function buildAdminUsersExcel(pool, options, user) {
  const {
    search,
    role,
    status,
    verification
  } = options;

  // Fetch all filtered rows (no pagination)
  const { users: rows } = await getAdminUsers(pool, {
    search,
    role,
    status,
    verification,
    page: 1,
    limit: 0,
    includeCount: false,
    userRole: user.role
  });

  const summary = computeUserSummary(rows);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Users Report');

  const generatedAt = formatDateTime();
  const generatedBy = {
    name: user?.full_name || 'N/A',
    email: user?.email || 'N/A',
    phone: user?.phone || 'N/A',
    role: user?.role || 'admin'
  };

  const filterDescription = buildUserFilterDescription({ search, role, status, verification });
  const COL_COUNT = 8; // User ID, Full Name, Role, Email, Phone, Status, Registration Date, Last Login

  // Determine report title based on role filter
  let reportTitle = 'All Users Report';
  if (role === 'customer') reportTitle = 'Customer Report';
  if (role === 'farmer') reportTitle = 'Farmer Report';
  if (role === 'admin' || role === 'super_admin') reportTitle = 'Admin Report';

  // Header block
  let row = 0;

  row = ws.addRow([]).number; // spacer row that will contain the logo
  const { targetLogoHeight } = addLogo(workbook, ws);
  ws.getRow(1).height = Math.max(15, targetLogoHeight * 0.75);
  row = ws.addRow([]).number; // spacer
  row = ws.addRow([reportTitle]).number; // title
  row = ws.addRow([]).number; // spacer

  const titleCell = ws.getCell(row - 1, 1);
  titleCell.font = { bold: true, size: 20, color: { argb: DARK_GREEN } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(row - 1, 1, row - 1, COL_COUNT);

  row = ws.addRow(['Report Information']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:H${row}`, COL_COUNT);

  const infoStartRow = row + 1;
  row = ws.addRow(['Generated Date & Time:', generatedAt]).number;
  row = ws.addRow(['Selected Filters:', filterDescription]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, infoStartRow, row - 1, COL_COUNT);

  row = ws.addRow(['Generated By']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:H${row}`, COL_COUNT);

  const generatedByStartRow = row + 1;
  row = ws.addRow(['Name:', generatedBy.name]).number;
  row = ws.addRow(['Email:', generatedBy.email]).number;
  row = ws.addRow(['Phone:', generatedBy.phone]).number;
  row = ws.addRow(['Role:', generatedBy.role]).number;
  row = ws.addRow([]).number;
  applyHeaderInfoStyling(ws, generatedByStartRow, row - 1, COL_COUNT);

  // Summary block
  const SUMMARY_COLS = 6;
  row = ws.addRow(['Summary']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:F${row}`, SUMMARY_COLS);

  row = ws.addRow([]).number;
  const summaryHeaderRow = ws.addRow([
    'Total Users',
    'Active Users',
    'Inactive Users',
    'Customers',
    'Farmers',
    'Admins'
  ]).number;
  const summaryDataRow = ws.addRow([
    summary.totalUsers,
    summary.activeUsers,
    summary.inactiveUsers,
    summary.customers,
    summary.farmers,
    summary.admins
  ]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, summaryHeaderRow, 1, SUMMARY_COLS);
  applyTableDataStyle(ws, summaryDataRow, summaryDataRow, 1, SUMMARY_COLS, () => 'center');

  // Users table block
  row = ws.addRow(['Users']).number;
  applySectionHeader(ws, `A${row}`, `A${row}:H${row}`, COL_COUNT);

  const userHeaders = [
    'User ID',
    'Full Name',
    'Role',
    'Email',
    'Phone',
    'Status',
    'Registration Date',
    'Last Login'
  ];
  const userHeaderRow = ws.addRow(userHeaders).number;

  const userDataStartRow = userHeaderRow + 1;
  for (const data of rows) {
    const fullName = data.full_name || `${data.first_name || ''} ${data.middle_name || ''} ${data.last_name || ''}`.trim() || data.username || '—';
    row = ws.addRow([
      data.id,
      fullName,
      data.role,
      data.email || '—',
      data.phone || '—',
      formatUserStatus(data.is_disabled, data.disable_type),
      formatDate(data.created_at),
      'N/A' // Last login not available in current schema
    ]).number;
  }
  const userDataEndRow = row;
  row = ws.addRow([]).number;
  row = ws.addRow([]).number;

  applyTableHeaderStyle(ws, userHeaderRow, 1, COL_COUNT);
  applyTableDataStyle(ws, userDataStartRow, userDataEndRow, 1, COL_COUNT, (col) => {
    switch (col) {
      case 1: return 'center'; // User ID
      case 3: return 'center'; // Role
      case 6: return 'center'; // Status
      case 7: // Registration Date
      case 8: // Last Login
        return 'left';
      default:
        return 'left';
    }
  });

  // Footer
  const footerRow1 = ws.addRow(['']).number;
  ws.mergeCells(footerRow1, 1, footerRow1, COL_COUNT);
  const cell1 = ws.getCell(footerRow1, 1);
  cell1.value = 'Generated by AgriCatch Platform';
  cell1.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell1.alignment = { horizontal: 'center' };

  const footerRow2 = ws.addRow(['']).number;
  ws.mergeCells(footerRow2, 1, footerRow2, COL_COUNT);
  const cell2 = ws.getCell(footerRow2, 1);
  cell2.value = 'Copyright © 2026 AgriCatch. All rights reserved.';
  cell2.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
  cell2.alignment = { horizontal: 'center' };

  // Column widths
  ws.getColumn(1).width = 12;  // User ID
  ws.getColumn(2).width = 30;  // Full Name
  ws.getColumn(3).width = 15;  // Role
  ws.getColumn(4).width = 30;  // Email
  ws.getColumn(5).width = 18;  // Phone
  ws.getColumn(6).width = 15;  // Status
  ws.getColumn(7).width = 20;  // Registration Date
  ws.getColumn(8).width = 20;  // Last Login

  // Generate filename
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  let filename = 'Admin_All_Users_Report_YYYY-MM-DD.xlsx';
  if (role === 'customer') filename = 'Admin_Customers_Report_YYYY-MM-DD.xlsx';
  if (role === 'farmer') filename = 'Admin_Farmers_Report_YYYY-MM-DD.xlsx';
  if (role === 'admin' || role === 'super_admin') filename = 'Admin_Admins_Report_YYYY-MM-DD.xlsx';
  filename = filename.replace('YYYY-MM-DD', dateStr);

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
}

module.exports = {
  getAdminOrders,
  getFarmerOrders,
  getAdminUsers,
  buildAdminOrdersExcel,
  buildFarmerOrdersExcel,
  buildAdminUsersExcel,
  computeOrderSummary,
  computeFarmerOrderSummary,
  computeUserSummary
};
