/**
 * Admin Orders Export Service
 *
 * Shared service for the Admin Orders Excel export.
 * Provides:
 *   - Reusable filtered order query (used by GET /admin/orders and /admin/orders/export.xlsx)
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
  const footerRow1 = ws.addRow(['', 'Generated by AgriCatch Platform']).number;
  const footerRow2 = ws.addRow(['', 'Copyright © 2026 AgriCatch. All rights reserved.']).number;

  for (const row of [footerRow1, footerRow2]) {
    const cell = ws.getCell(row, 1);
    cell.font = { size: 10, color: { argb: FOOTER_TEXT }, italic: true };
    cell.alignment = { horizontal: 'center' };
    ws.mergeCells(row, 1, row, COL_COUNT);
  }

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

module.exports = {
  getAdminOrders,
  buildAdminOrdersExcel,
  computeOrderSummary
};
