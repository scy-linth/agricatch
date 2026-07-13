const express = require('express');
const ExcelJS = require('exceljs');
const { pool } = require('../utils/db');
const { broadcastEvent } = require('../utils/realtime');
const { applyUnifiedLayout, addUnifiedFooter } = require('../services/orderExportService');

const router = express.Router();

const jwt = require('jsonwebtoken');
const { deleteFileIfExists, resolvePublicPath } = require('../utils/fileUtils');

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const requireFarmer = async (req, res) => {
  const user = getUserFromToken(req);
  if (!user) {
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }

  const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
  if (userResult.rows[0]?.role !== 'farmer') {
    res.status(403).json({ message: 'Farmer access required' });
    return null;
  }

  return user;
};

const requireFarmerOrCustomer = async (req, res) => {
  const user = getUserFromToken(req);
  if (!user) {
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }

  const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
  if (!['farmer', 'customer'].includes(userResult.rows[0]?.role)) {
    res.status(403).json({ message: 'Farmer or customer access required' });
    return null;
  }

  return user;
};

async function getFarmerTier(userId) {
  try {
    const subRes = await pool.query(
      `SELECT tier, status, expires_at FROM farmer_subscriptions
       WHERE farmer_id = $1 AND status = 'active' ORDER BY expires_at DESC LIMIT 1`, [userId]
    );
    if (subRes.rows.length === 0 || new Date(subRes.rows[0].expires_at) < new Date()) return 'free';
    return subRes.rows[0].tier;
  } catch (err) {
    // Table doesn't exist yet, default to free tier
    if (err.code === '42P01') return 'free';
    throw err;
  }
}

const parseRangeDays = (range) => {
  if (range === null || range === undefined || range === '') return 30;
  const str = String(range).trim().toLowerCase();
  if (str === 'all' || str === 'alltime' || str === 'all-time') return null;
  const m = str.match(/^(\d{1,4})\s*d?$/);
  if (m) {
    const days = Number(m[1]);
    if (Number.isFinite(days) && days > 0 && days <= 365) return days;
  }
  return 30;
};

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[\r\n",]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
};

const parseIsoDateOnly = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
};

const calcPercentChange = (current, previous) => {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 100);
};

// Public: get farmers listing
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, COALESCE(u.shop_name, u.full_name) as shop_name,
             COALESCE(u.is_verified, false) as is_verified,
             u.created_at, COUNT(p.id) as product_count
      FROM users u
      LEFT JOIN products p ON p.farmer_id = u.id
      WHERE u.role = 'farmer'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({ farmers: result.rows });
  } catch (error) {
    console.error('Get farmers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: get farmer shop profile
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, COALESCE(u.shop_name, u.full_name) as shop_name, u.is_verified,
             u.shop_description, u.shop_banner_url, u.shop_avatar_url, u.created_at,
             -- Aggregate: total orders (all statuses) for farmer's products
             (SELECT COUNT(*) FROM orders o LEFT JOIN products p ON o.product_id = p.id WHERE p.farmer_id = u.id OR p.farmer_id IS NULL)::int AS total_sales,
             -- Aggregate: total revenue from delivered orders
             COALESCE((SELECT SUM(o.total_amount) FROM orders o LEFT JOIN products p ON o.product_id = p.id WHERE (p.farmer_id = u.id OR p.farmer_id IS NULL) AND o.status = 'delivered'), 0)::numeric AS total_revenue,
             -- Aggregate: average rating across this farmer's products
             COALESCE((SELECT AVG(r.rating) FROM reviews r JOIN products p2 ON r.product_id = p2.id WHERE p2.farmer_id = u.id), 0)::numeric AS average_rating,
             -- Aggregate: total reviews across this farmer's products
             (SELECT COUNT(*) FROM reviews r JOIN products p3 ON r.product_id = p3.id WHERE p3.farmer_id = u.id)::int AS total_reviews
      FROM users u
      WHERE u.id = $1 AND u.role = 'farmer'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    console.error('Get farmer profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: get dashboard stats
router.get('/me/stats', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const from = parseIsoDateOnly(req.query.from);
    const to = parseIsoDateOnly(req.query.to);
    const rangeDays = parseRangeDays(req.query.rangeDays || req.query.range || '');
    const isAllTime = rangeDays === null;
    const hasCustom = !!(from && to);

    let whereSql = '';
    let params = [user.id];

    if (hasCustom) {
      whereSql = `AND o.created_at >= $2::date AND o.created_at < ($3::date + INTERVAL '1 day')`;
      params = [user.id, from, to];
    } else if (!isAllTime) {
      // Default last 30 days only when client explicitly asks by passing rangeDays.
      // If no range param is provided, keep lifetime stats.
      const clientAskedRange = req.query.rangeDays !== undefined || req.query.range !== undefined;
      if (clientAskedRange) {
        whereSql = `
          AND o.created_at >= (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
          AND o.created_at < (CURRENT_DATE + INTERVAL '1 day')
        `;
        params = [user.id, Number(rangeDays || 30)];
      }
    }

    const totalOrdersResult = await pool.query(`
      SELECT COUNT(*)::int AS total_orders
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
      ${whereSql}
    `, params);

    const totalSoldResult = await pool.query(`
      SELECT COUNT(*)::int AS total_sold
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        AND o.status = 'delivered'
      ${whereSql}
    `, params);

    const totalRevenueResult = await pool.query(`
      SELECT COALESCE(SUM(o.total_amount), 0)::numeric AS total_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        AND o.status = 'delivered'
      ${whereSql}
    `, params);

    const unreadCustomersResult = await pool.query(`
      SELECT COUNT(DISTINCT m.sender_id)::int AS unread_customers
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.receiver_id = $1 AND m.is_read = false AND u.role = 'customer'
    `, [user.id]);

    res.json({
      total_orders: totalOrdersResult.rows[0].total_orders || 0,
      total_sold: totalSoldResult.rows[0].total_sold || 0,
      total_revenue: totalRevenueResult.rows[0].total_revenue || 0,
      unread_customers: unreadCustomersResult.rows[0].unread_customers || 0
    });
  } catch (error) {
    console.error('Get farmer stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const { getFarmerDashboardMetrics } = require('../services/dashboardService');
const { getFarmerOrders, buildFarmerOrdersExcel } = require('../services/orderExportService');

// Farmer: overview metrics (charts-ready)
router.get('/me/metrics', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const tier = await getFarmerTier(user.id);

    const from = parseIsoDateOnly(req.query.from);
    const to = parseIsoDateOnly(req.query.to);
    const hasCustom = !!(from && to);

    let rangeDays = parseRangeDays(req.query.rangeDays || req.query.range || '30');
    let isAllTime = !hasCustom && rangeDays === null;

    // Free tier: max 30 days, no custom ranges, no all-time
    if (tier !== 'premium') {
      if (hasCustom || isAllTime) {
        return res.status(403).json({ message: 'Custom date ranges and all-time analytics are a Premium feature. Upgrade to Premium for advanced analytics.' });
      }
      if (rangeDays > 30) rangeDays = 30;
      isAllTime = false;
    }

    if (hasCustom) {
      // Basic validation: from must be <= to, limit range to 366 days
      const fromDt = new Date(`${from}T00:00:00Z`);
      const toDt = new Date(`${to}T00:00:00Z`);
      if (Number.isNaN(fromDt.getTime()) || Number.isNaN(toDt.getTime())) {
        return res.status(400).json({ message: 'Invalid from/to dates' });
      }
      if (fromDt.getTime() > toDt.getTime()) {
        return res.status(400).json({ message: 'From date must be before To date' });
      }
      const daysSpan = Math.floor((toDt.getTime() - fromDt.getTime()) / 86400000) + 1;
      if (daysSpan > 366) {
        return res.status(400).json({ message: 'Date range too large (max 366 days)' });
      }
    }

    // Use shared dashboard service
    const result = await getFarmerDashboardMetrics(pool, user.id, {
      from,
      to,
      rangeDays,
      tier
    });

    res.json(result);
  } catch (error) {
    console.error('Get farmer metrics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: export orders as Excel
// GET /api/farmers/me/orders/export.xlsx?status=&dateFrom=&dateTo=&sort=
router.get('/me/orders/export.xlsx', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const tier = await getFarmerTier(user.id);
    if (tier !== 'premium') {
      return res.status(403).json({ message: 'Excel export is a Premium feature. Upgrade to Premium for advanced analytics.' });
    }

    // Fetch full user details for Generated By section
    const userDetailResult = await pool.query(
      'SELECT full_name, email, phone FROM users WHERE id = $1',
      [user.id]
    );
    const userDetails = userDetailResult.rows[0] || {};
    const fullUser = { ...user, ...userDetails };

    const status = req.query.status;
    const dateFrom = parseIsoDateOnly(req.query.dateFrom);
    const dateTo = parseIsoDateOnly(req.query.dateTo);
    const sort = req.query.sort || 'date_desc';

    // Basic date validation
    if (dateFrom && dateTo) {
      const fromDt = new Date(`${dateFrom}T00:00:00Z`);
      const toDt = new Date(`${toDt}T00:00:00Z`);
      if (Number.isNaN(fromDt.getTime()) || Number.isNaN(toDt.getTime())) {
        return res.status(400).json({ message: 'Invalid from/to dates' });
      }
      if (fromDt.getTime() > toDt.getTime()) {
        return res.status(400).json({ message: 'From date must be before To date' });
      }
    }

    // Use shared order export service
    const { buffer, filename } = await buildFarmerOrdersExcel(pool, user.id, {
      status,
      dateFrom,
      dateTo,
      sort
    }, fullUser);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Export farmer orders Excel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: time-series report (same format as admin /dashboard/report)
// GET /api/farmers/me/report?period=today|week|month|year|all
router.get('/me/report', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const period = req.query.period || 'today';

    // Use simple created_at for consistency with dashboard service
    const timeRef = `o.created_at`;

    let groupExpr, filterExpr;
    if (period === 'today') {
      groupExpr = `DATE_TRUNC('hour', ${timeRef})`;
      filterExpr = `DATE(${timeRef}) = CURRENT_DATE`;
    } else if (period === 'week') {
      groupExpr = `DATE(${timeRef})`;
      filterExpr = `${timeRef} >= DATE_TRUNC('week', CURRENT_DATE)`;
    } else if (period === 'month') {
      groupExpr = `DATE(${timeRef})`;
      filterExpr = `${timeRef} >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (period === 'year') {
      groupExpr = `DATE_TRUNC('month', ${timeRef})`;
      filterExpr = `${timeRef} >= DATE_TRUNC('year', CURRENT_DATE)`;
    } else {
      groupExpr = `DATE_TRUNC('month', ${timeRef})`;
      filterExpr = '1=1';
    }

    const sql = `
      SELECT
        ${groupExpr} AS period_label,
        COUNT(*) FILTER (WHERE o.status != 'cancelled') AS orders,
        COALESCE(SUM(o.quantity) FILTER (WHERE o.status = 'delivered'), 0) AS items_sold,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0) AS revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        AND ${filterExpr}
        AND COALESCE(o.is_disabled, false) = false
      GROUP BY ${groupExpr}
      ORDER BY ${groupExpr} ASC
    `;

    const result = await pool.query(sql, [user.id]);

    const data = result.rows.map(r => ({
      label: r.period_label,
      revenue: parseFloat(r.revenue) || 0,
      orders: parseInt(r.orders) || 0,
      items_sold: parseInt(r.items_sold) || 0,
    }));

    res.json({ data });
  } catch (err) {
    console.error('Farmer report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: export overview metrics as CSV
router.get('/me/metrics/export.csv', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const tier = await getFarmerTier(user.id);
    if (tier !== 'premium') {
      return res.status(403).json({ message: 'CSV export is a Premium feature. Upgrade to Premium for advanced analytics.' });
    }

    const from = parseIsoDateOnly(req.query.from);
    const to = parseIsoDateOnly(req.query.to);
    const hasCustom = !!(from && to);

    const rangeDays = parseRangeDays(req.query.rangeDays || req.query.range || '30');
    const isAllTime = !hasCustom && rangeDays === null;

    if (hasCustom) {
      const fromDt = new Date(`${from}T00:00:00Z`);
      const toDt = new Date(`${to}T00:00:00Z`);
      if (Number.isNaN(fromDt.getTime()) || Number.isNaN(toDt.getTime())) {
        return res.status(400).json({ message: 'Invalid from/to dates' });
      }
      if (fromDt.getTime() > toDt.getTime()) {
        return res.status(400).json({ message: 'From date must be before To date' });
      }
      const daysSpan = Math.floor((toDt.getTime() - fromDt.getTime()) / 86400000) + 1;
      if (daysSpan > 366) {
        return res.status(400).json({ message: 'Date range too large (max 366 days)' });
      }
    }

    const timeRef = `CASE WHEN o.status = 'delivered' THEN COALESCE(o.updated_at, o.created_at) ELSE o.created_at END`;
    const dateSelect = isAllTime
      ? `DATE_TRUNC('month', ${timeRef})::date`
      : `DATE(${timeRef})`;
    const rangeWhere = isAllTime
      ? ''
      : (hasCustom
        ? `AND ${timeRef} >= $2::date AND ${timeRef} < ($3::date + INTERVAL '1 day')`
        : `
          AND ${timeRef} >= (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
          AND ${timeRef} < (CURRENT_DATE + INTERVAL '1 day')
        `);

    const paramsRange = hasCustom
      ? [user.id, from, to]
      : (isAllTime ? [user.id] : [user.id, Number(rangeDays || 30)]);

    // Summary totals for the same timeframe
    const summary = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE o.status != 'cancelled')::int AS total_orders,
        COALESCE(SUM(o.quantity) FILTER (WHERE o.status = 'delivered'), 0)::int AS total_sold,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0)::numeric AS total_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND COALESCE(o.is_disabled, false) = false
    `, paramsRange);

    // Fetch blocks separately (clear + simple for CSV generation)
    const revenue = await pool.query(`
      SELECT TO_CHAR(${dateSelect}, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND o.status = 'delivered'
        AND COALESCE(o.is_disabled, false) = false
      GROUP BY ${dateSelect}
      ORDER BY ${dateSelect} ASC
    `, paramsRange);

    const byStatus = await pool.query(`
      SELECT o.status, COUNT(*)::int AS count
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND COALESCE(o.is_disabled, false) = false
      GROUP BY o.status
      ORDER BY o.status ASC
    `, paramsRange);

    const topProducts = await pool.query(`
      SELECT p.name AS product_name,
             COALESCE(SUM(o.quantity), 0)::int AS sold_qty,
             COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND o.status = 'delivered'
        AND COALESCE(o.is_disabled, false) = false
      GROUP BY p.name
      ORDER BY sold_qty DESC, revenue DESC
      LIMIT 10
    `, paramsRange);

    const recentOrders = await pool.query(`
      SELECT o.id,
             TO_CHAR(o.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
             o.status,
             o.total_amount,
             u.full_name AS customer_name,
             p.name AS product_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND COALESCE(o.is_disabled, false) = false
      ORDER BY o.created_at DESC
      LIMIT 20
    `, paramsRange);

    const lines = [];
    if (hasCustom) {
      lines.push(`Overview Report (${from} to ${to})`);
    } else {
      lines.push(isAllTime ? 'Overview Report (All time)' : `Overview Report (Last ${rangeDays} days)`);
    }
    lines.push(`Generated At,${csvEscape(new Date().toISOString())}`);
    lines.push('');

    const s = summary.rows[0] || {};
    lines.push('Summary');
    lines.push('Total Orders,Total Sold (Delivered),Total Sales (Delivered)');
    lines.push(`${csvEscape(s.total_orders || 0)},${csvEscape(s.total_sold || 0)},${csvEscape(s.total_revenue || 0)}`);
    lines.push('');

    lines.push(isAllTime ? 'Total Sales By Month' : 'Total Sales By Day');
    lines.push('Date,Total Sales');
    for (const row of revenue.rows) {
      // Prefix with a single quote so Excel will treat values as text and
      // avoid displaying "#####" when the column is too narrow or formatted
      // as a date/number. Excel strips the leading quote when displaying.
      lines.push(`${csvEscape('\'' + row.day)},${csvEscape('\'' + row.revenue)}`);
    }
    lines.push('');

    lines.push('Orders By Status');
    lines.push('Status,Count');
    for (const row of byStatus.rows) {
      lines.push(`${csvEscape(row.status)},${csvEscape(row.count)}`);
    }
    lines.push('');

    lines.push('Top Selling Products (Delivered)');
    lines.push('Product,Sold Qty,Total Sales');
    for (const row of topProducts.rows) {
      lines.push(`${csvEscape(row.product_name)},${csvEscape(row.sold_qty)},${csvEscape(row.revenue)}`);
    }
    lines.push('');

    lines.push('Recent Orders');
    lines.push('Order ID,Date,Customer,Product,Status,Total Amount');
    for (const row of recentOrders.rows) {
      // Prefix date and amount with a single quote to force Excel to treat
      // these as text values (prevents the '#####' display when width is small)
      lines.push(`${csvEscape(row.id)},${csvEscape('\'' + row.created_at)},${csvEscape(row.customer_name || '')},${csvEscape(row.product_name || '')},${csvEscape(row.status)},${csvEscape('\'' + row.total_amount)}`);
    }

    const csv = lines.join('\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const rangeTag = hasCustom ? `${from}_to_${to}` : (isAllTime ? 'all' : `${rangeDays}d`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="farmer_overview_${dateStamp}_${rangeTag}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export farmer metrics CSV error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: export overview metrics as Excel
// GET /api/farmers/me/metrics/export.xlsx?rangeDays=30|from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/me/metrics/export.xlsx', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const tier = await getFarmerTier(user.id);
    if (tier !== 'premium') {
      return res.status(403).json({ message: 'Excel export is a Premium feature. Upgrade to Premium for advanced analytics.' });
    }

    // Fetch full user details for Generated By section
    const userDetailResult = await pool.query(
      'SELECT full_name, email, phone FROM users WHERE id = $1',
      [user.id]
    );
    const userDetails = userDetailResult.rows[0] || {};
    const fullUser = { ...user, ...userDetails };

    const from = parseIsoDateOnly(req.query.from);
    const to = parseIsoDateOnly(req.query.to);
    const hasCustom = !!(from && to);

    const rangeDays = parseRangeDays(req.query.rangeDays || req.query.range || null);
    const isAllTime = !hasCustom && rangeDays === null;

    if (hasCustom) {
      const fromDt = new Date(`${from}T00:00:00Z`);
      const toDt = new Date(`${to}T00:00:00Z`);
      if (Number.isNaN(fromDt.getTime()) || Number.isNaN(toDt.getTime())) {
        return res.status(400).json({ message: 'Invalid from/to dates' });
      }
      if (fromDt.getTime() > toDt.getTime()) {
        return res.status(400).json({ message: 'From date must be before To date' });
      }
      const daysSpan = Math.floor((toDt.getTime() - fromDt.getTime()) / 86400000) + 1;
      if (daysSpan > 366) {
        return res.status(400).json({ message: 'Date range too large (max 366 days)' });
      }
    }

    // Use shared dashboard service (same as dashboard API)
    const dashboardData = await getFarmerDashboardMetrics(pool, user.id, {
      from,
      to,
      rangeDays,
      tier
    });

    // Extract data needed for Excel export from dashboard data
    // Calculate summary from aggregated data (not limited recentOrders)
    const summary = {
      total_orders: (dashboardData.ordersByDay || []).reduce((sum, day) => sum + Number(day.orders || 0), 0),
      total_sold: (dashboardData.itemsSoldByDay || []).reduce((sum, day) => sum + Number(day.items_sold || 0), 0),
      total_revenue: (dashboardData.revenueByDay || []).reduce((sum, day) => sum + Number(day.revenue || 0), 0)
    };

    const revenue = (dashboardData.revenueByDay || []).map(r => ({
      day: r.date,
      revenue: r.revenue
    }));

    const byStatus = Object.entries(dashboardData.ordersByStatus || {}).map(([status, count]) => ({
      status,
      count
    }));

    const topProducts = (dashboardData.topProducts || []).map(p => ({
      product_name: p.product_name,
      sold_qty: p.sold_qty,
      revenue: p.revenue
    }));

    const recentOrders = (dashboardData.recentOrders || []).map(o => ({
      id: o.id,
      created_at: o.created_at,
      status: o.status,
      total_amount: o.total_amount,
      customer_name: o.customer_name,
      product_name: o.product_name
    }));

    // Create Excel workbook using ExcelJS
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dashboard Report');

    // Header section
    const generatedAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' });
    let rangeLabel = '';
    if (hasCustom) {
      rangeLabel = `${from} to ${to}`;
    } else if (isAllTime) {
      rangeLabel = 'All Time';
    } else {
      rangeLabel = `Last ${rangeDays} Days`;
    }
    const generatedBy = {
      name: (fullUser && fullUser.full_name) || 'N/A',
      email: (fullUser && fullUser.email) || 'N/A',
      phone: (fullUser && fullUser.phone) || 'N/A',
      role: 'Farmer'
    };

    // Apply unified layout (logo, title, spacing)
    const COL_COUNT = 6; // Maximum columns in the report
    const { currentRow } = applyUnifiedLayout(wb, ws, 'Farmer Dashboard Report', COL_COUNT);
    let row = currentRow;

    row = ws.addRow(['Report Information']).number;
    const infoHeaderCell = ws.getCell(`A${row}`);
    infoHeaderCell.font = { bold: true, size: 14, color: { argb: '2E7D32' } };
    infoHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
    infoHeaderCell.alignment = { horizontal: 'center' };
    ws.mergeCells(`A${row}:F${row}`);

    const infoStartRow = row + 1;
    row = ws.addRow(['Report Period:', rangeLabel]).number;
    row = ws.addRow(['Generated Date & Time:', generatedAt]).number;
    row = ws.addRow([]).number;
    for (let r = infoStartRow; r <= row - 1; r++) {
      const labelCell = ws.getCell(`A${r}`);
      labelCell.font = { bold: true, size: 11 };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F5F5' } };
      labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      const valueCell = ws.getCell(`B${r}`);
      valueCell.alignment = { horizontal: 'left' };
      valueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      ws.mergeCells(`B${r}:F${r}`);
    }

    row = ws.addRow(['Generated By']).number;
    const genByHeaderCell = ws.getCell(`A${row}`);
    genByHeaderCell.font = { bold: true, size: 14, color: { argb: '2E7D32' } };
    genByHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
    genByHeaderCell.alignment = { horizontal: 'center' };
    ws.mergeCells(`A${row}:F${row}`);

    const generatedByStartRow = row + 1;
    row = ws.addRow(['Name:', generatedBy.name]).number;
    row = ws.addRow(['Email:', generatedBy.email]).number;
    row = ws.addRow(['Phone:', generatedBy.phone]).number;
    row = ws.addRow(['Role:', generatedBy.role]).number;
    row = ws.addRow([]).number;
    for (let r = generatedByStartRow; r <= row - 1; r++) {
      const labelCell = ws.getCell(`A${r}`);
      labelCell.font = { bold: true, size: 11 };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F5F5' } };
      labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      const valueCell = ws.getCell(`B${r}`);
      valueCell.alignment = { horizontal: 'left' };
      valueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      ws.mergeCells(`B${r}:F${r}`);
    }

    row = ws.addRow(['Key Performance Indicators']).number;
    const kpiHeaderCell = ws.getCell(`A${row}`);
    kpiHeaderCell.font = { bold: true, size: 14, color: { argb: '2E7D32' } };
    kpiHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
    kpiHeaderCell.alignment = { horizontal: 'center' };
    ws.mergeCells(`A${row}:F${row}`);

    row = ws.addRow([]).number;
    const kpiHeaderRow = ws.addRow(['Total Orders', 'Total Sold (Delivered)', 'Total Sales']).number;
    ws.addRow([summary.total_orders || 0, summary.total_sold || 0, `₱${(summary.total_revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]).number;
    row = ws.addRow([]).number;
    row = ws.addRow([]).number;

    // Style KPI table
    for (let col = 1; col <= 3; col++) {
      const cell = ws.getCell(kpiHeaderRow, col);
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    const kpiDataRow = kpiHeaderRow + 1;
    for (let col = 1; col <= 3; col++) {
      const cell = ws.getCell(kpiDataRow, col);
      cell.font = { size: 11 };
      cell.alignment = 'center';
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    row = ws.addRow(['Total Sales By Day']).number;
    const salesHeaderCell = ws.getCell(`A${row}`);
    salesHeaderCell.font = { bold: true, size: 14, color: { argb: '2E7D32' } };
    salesHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
    salesHeaderCell.alignment = { horizontal: 'center' };
    ws.mergeCells(`A${row}:F${row}`);

    const salesHeaderRow = ws.addRow(['Date', 'Total Sales']).number;
    let salesDataRow = salesHeaderRow + 1;
    for (const r of revenue) {
      ws.addRow([r.day, parseFloat(r.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]).number;
      salesDataRow++;
    }

    // Style sales table
    for (let col = 1; col <= 2; col++) {
      const cell = ws.getCell(salesHeaderRow, col);
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    for (let r = salesHeaderRow + 1; r <= salesDataRow - 1; r++) {
      for (let col = 1; col <= 2; col++) {
        const cell = ws.getCell(r, col);
        cell.font = { size: 11 };
        cell.alignment = col === 1 ? 'left' : 'right';
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (r % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
        }
      }
    }

    row = salesDataRow + 1;
    ws.addRow([]).number;
    row = ws.addRow(['Orders By Status']).number;
    const statusHeaderCell = ws.getCell(`A${row}`);
    statusHeaderCell.font = { bold: true, size: 14, color: { argb: '2E7D32' } };
    statusHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
    statusHeaderCell.alignment = { horizontal: 'center' };
    ws.mergeCells(`A${row}:F${row}`);

    const statusHeaderRow = ws.addRow(['Status', 'Count']).number;
    let statusDataRow = statusHeaderRow + 1;
    for (const r of byStatus) {
      ws.addRow([r.status, r.count]).number;
      statusDataRow++;
    }

    // Style status table
    for (let col = 1; col <= 2; col++) {
      const cell = ws.getCell(statusHeaderRow, col);
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    for (let r = statusHeaderRow + 1; r <= statusDataRow - 1; r++) {
      for (let col = 1; col <= 2; col++) {
        const cell = ws.getCell(r, col);
        cell.font = { size: 11 };
        cell.alignment = 'center';
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (r % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
        }
      }
    }

    row = statusDataRow + 1;
    ws.addRow([]).number;
    row = ws.addRow(['Top Selling Products (Delivered)']).number;
    const topProdHeaderCell = ws.getCell(`A${row}`);
    topProdHeaderCell.font = { bold: true, size: 14, color: { argb: '2E7D32' } };
    topProdHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
    topProdHeaderCell.alignment = { horizontal: 'center' };
    ws.mergeCells(`A${row}:F${row}`);

    const topProdHeaderRow = ws.addRow(['Product', 'Sold Qty', 'Total Sales']).number;
    let topProdDataRow = topProdHeaderRow + 1;
    for (const r of topProducts) {
      ws.addRow([r.product_name, r.sold_qty, `₱${parseFloat(r.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]).number;
      topProdDataRow++;
    }

    // Style top products table
    for (let col = 1; col <= 3; col++) {
      const cell = ws.getCell(topProdHeaderRow, col);
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    for (let r = topProdHeaderRow + 1; r <= topProdDataRow - 1; r++) {
      for (let col = 1; col <= 3; col++) {
        const cell = ws.getCell(r, col);
        cell.font = { size: 11 };
        cell.alignment = col === 1 ? 'left' : 'center';
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (r % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
        }
      }
    }

    row = topProdDataRow + 1;
    ws.addRow([]).number;
    row = ws.addRow(['Recent Orders']).number;
    const recentHeaderCell = ws.getCell(`A${row}`);
    recentHeaderCell.font = { bold: true, size: 14, color: { argb: '2E7D32' } };
    recentHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
    recentHeaderCell.alignment = { horizontal: 'center' };
    ws.mergeCells(`A${row}:F${row}`);

    const recentHeaderRow = ws.addRow(['Order ID', 'Date', 'Customer', 'Product', 'Status', 'Total Amount']).number;
    let recentDataRow = recentHeaderRow + 1;
    for (const r of recentOrders) {
      ws.addRow([
        r.id,
        r.created_at,
        r.customer_name || '',
        r.product_name || '',
        r.status,
        `₱${parseFloat(r.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]).number;
      recentDataRow++;
    }

    // Style recent orders table
    for (let col = 1; col <= 6; col++) {
      const cell = ws.getCell(recentHeaderRow, col);
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    for (let r = recentHeaderRow + 1; r <= recentDataRow - 1; r++) {
      for (let col = 1; col <= 6; col++) {
        const cell = ws.getCell(r, col);
        cell.font = { size: 11 };
        cell.alignment = col === 1 ? 'center' : 'left';
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (r % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
        }
      }
    }

    // Apply unified footer
    addUnifiedFooter(ws, 6);

    // Set column widths with auto-sizing
    ws.getColumn(1).width = 20; // A
    ws.getColumn(2).width = 20; // B
    ws.getColumn(3).width = 30; // C
    ws.getColumn(4).width = 20; // D
    ws.getColumn(5).width = 15; // E
    ws.getColumn(6).width = 20; // F

    // Generate filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const rangeTag = hasCustom ? `${from}_to_${to}` : (isAllTime ? 'all' : `${rangeDays}d`);
    const filename = `Farmer_Dashboard_Report_${dateStr}_${timeStr}.xlsx`;

    // Send Excel file
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Export farmer metrics Excel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: update shop profile
router.put('/profile', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const body = req.body || {};
    const { shop_name, shop_description, shop_banner_url, shop_avatar_url, full_name, address, phone } = body;
    const hasPersonalNameFields = ['first_name', 'middle_name', 'last_name'].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    const firstName = String(body.first_name || '').trim();
    const middleName = String(body.middle_name || '').trim();
    const lastName = String(body.last_name || '').trim();
    const recomputedFullName = hasPersonalNameFields
      ? [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
      : '';

    if (hasPersonalNameFields && (!firstName || !lastName)) {
      return res.status(400).json({ message: 'First name and last name are required when updating personal name fields' });
    }
    if (hasPersonalNameFields) {
      if (firstName.length > 40) {
        return res.status(400).json({ message: 'First name must be 40 characters or less' });
      }
      if (middleName.length > 40) {
        return res.status(400).json({ message: 'Middle name must be 40 characters or less' });
      }
      if (lastName.length > 40) {
        return res.status(400).json({ message: 'Last name must be 40 characters or less' });
      }
    }

    // Get current shop banner and avatar URLs if columns exist
    // Handle case where columns might not exist in database yet
    let currentBannerUrl = null;
    let currentAvatarUrl = null;
    try {
      const currentResult = await pool.query(
        'SELECT shop_banner_url, shop_avatar_url FROM users WHERE id = $1',
        [user.id]
      );
      if (currentResult.rows.length > 0) {
        currentBannerUrl = currentResult.rows[0].shop_banner_url;
        currentAvatarUrl = currentResult.rows[0].shop_avatar_url;
      }
    } catch (error) {
      // Columns might not exist yet - this is okay, we'll skip file deletion
      console.warn('Could not fetch current shop URLs (columns may not exist):', error.message);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (shop_name !== undefined && shop_name !== null && shop_name !== '') {
      const trimmedShopName = String(shop_name).trim();
      if (trimmedShopName.length > 40) {
        return res.status(400).json({ message: 'Shop name must be 40 characters or less' });
      }
      updates.push(`shop_name = $${paramIndex}`);
      values.push(trimmedShopName);
      paramIndex++;
    }

    if (hasPersonalNameFields && recomputedFullName) {
      updates.push(`full_name = $${paramIndex}`);
      values.push(recomputedFullName);
      paramIndex++;
    } else if (full_name !== undefined && full_name !== null && full_name !== '') {
      updates.push(`full_name = $${paramIndex}`);
      values.push(full_name);
      paramIndex++;
    }

    if (hasPersonalNameFields) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(firstName || null);
      paramIndex++;

      updates.push(`middle_name = $${paramIndex}`);
      values.push(middleName || null);
      paramIndex++;

      updates.push(`last_name = $${paramIndex}`);
      values.push(lastName || null);
      paramIndex++;
    }

    if (address !== undefined && address !== null && address !== '') {
      updates.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;
      
      // Sync product locations with new shop address
      try {
        await pool.query(
          'UPDATE products SET location = $1, updated_at = CURRENT_TIMESTAMP WHERE farmer_id = $2',
          [address, user.id]
        );
      } catch (productUpdateError) {
        console.error('Error syncing product locations:', productUpdateError);
        // Continue with user update even if product sync fails
        // The error is logged but doesn't block the shop profile update
      }
    }

    if (phone !== undefined && phone !== null && phone !== '') {
      const phoneDigits = String(phone).replace(/\D/g, '');
      if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
        return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
      }
      // Check phone uniqueness (allow current farmer to keep their own phone)
      const phoneExists = await pool.query(
        'SELECT id FROM users WHERE phone = $1 AND id <> $2',
        [phoneDigits, user.id]
      );
      if (phoneExists.rows.length > 0) {
        return res.status(409).json({ message: 'This phone number is already registered.' });
      }
      updates.push(`phone = $${paramIndex}`);
      values.push(phoneDigits);
      paramIndex++;
    }

    if (shop_description !== undefined && shop_description !== null && shop_description !== '') {
      updates.push(`shop_description = $${paramIndex}`);
      values.push(shop_description);
      paramIndex++;
    }

    if (shop_banner_url !== undefined && shop_banner_url !== null && shop_banner_url !== '') {
      updates.push(`shop_banner_url = $${paramIndex}`);
      values.push(shop_banner_url);
      paramIndex++;
    }

    if (shop_avatar_url !== undefined && shop_avatar_url !== null && shop_avatar_url !== '') {
      updates.push(`shop_avatar_url = $${paramIndex}`);
      values.push(shop_avatar_url);
      paramIndex++;
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      // Add user.id as the last parameter for WHERE clause
      // paramIndex is already correct (points to the next available parameter)
      values.push(user.id);
      
      try {
        await pool.query(`
          UPDATE users
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
        `, values);
      } catch (updateError) {
        // Check if error is due to missing columns
        if (updateError.code === '42703' && updateError.message.includes('does not exist')) {
          console.error('Database columns missing. Please run migration: database/migrations/add_shop_columns.sql');
          return res.status(500).json({ 
            message: 'Database schema is missing required columns. Please run the migration script: database/migrations/add_shop_columns.sql',
            error: process.env.NODE_ENV === 'development' ? updateError.message : undefined
          });
        }
        throw updateError; // Re-throw if it's a different error
      }
    }

    // Delete old files if URLs have changed
    if (shop_banner_url && currentBannerUrl && shop_banner_url !== currentBannerUrl) {
      const oldBannerPath = resolvePublicPath(currentBannerUrl);
      if (oldBannerPath) deleteFileIfExists(oldBannerPath);
    }
    if (shop_avatar_url && currentAvatarUrl && shop_avatar_url !== currentAvatarUrl) {
      const oldAvatarPath = resolvePublicPath(currentAvatarUrl);
      if (oldAvatarPath) deleteFileIfExists(oldAvatarPath);
    }

    res.json({ message: 'Shop profile updated successfully' });
  } catch (error) {
    console.error('Update shop profile error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Server error updating shop profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Farmer/Customer: request verification
router.post('/me/verification-request', async (req, res) => {
  try {
    const user = await requireFarmerOrCustomer(req, res);
    if (!user) return;

    const { document_url, notes } = req.body;

    // Check if user is already verified
    const userResult = await pool.query('SELECT is_verified FROM users WHERE id = $1', [user.id]);
    if (userResult.rows[0].is_verified) {
      return res.status(400).json({ message: 'Your account is already verified' });
    }

    // Create verification request
    const result = await pool.query(
      `INSERT INTO verification_requests (farmer_id, document_url, notes, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, created_at`,
      [user.id, document_url || null, notes || null]
    );

    // Notify all admins about new verification request
    try {
      const admins = await pool.query(
        "SELECT id FROM users WHERE role IN ('admin', 'super_admin')"
      );
      const roleLabel = user.role === 'farmer' ? 'Farmer' : 'User';
      for (const admin of admins.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
          [admin.id, 'verification_request', 'New Verification Request', 
           `${roleLabel} ${user.username} has requested account verification.`]
        );
        broadcastEvent('notification.created', { user_id: admin.id });
      }
    } catch (notifErr) {
      console.error('Failed to send admin notifications:', notifErr);
    }

    res.status(201).json({ 
      message: 'Verification request submitted successfully',
      request_id: result.rows[0].id,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Verification request error:', error);
    res.status(500).json({ message: 'Server error submitting verification request' });
  }
});

// Farmer/Customer: get verification request status
router.get('/me/verification-request', async (req, res) => {
  try {
    const user = await requireFarmerOrCustomer(req, res);
    if (!user) return;

    const result = await pool.query(
      `SELECT id, status, notes, rejection_reason, created_at, reviewed_at
       FROM verification_requests
       WHERE farmer_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ request: null, history: [] });
    }

    res.json({ request: result.rows[0], history: result.rows });
  } catch (error) {
    console.error('Get verification request error:', error);
    res.status(500).json({ message: 'Server error fetching verification request' });
  }
});

// Harvest pre-order inventory (transfer to available stock)
router.post('/products/:id/harvest-preorder', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const productId = parseInt(req.params.id);

    // Verify product belongs to farmer
    const productCheck = await pool.query(
      'SELECT id, farmer_id, stock_quantity, reserved_quantity FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (productCheck.rows[0].farmer_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const product = productCheck.rows[0];

    // Transfer reserved quantity to stock quantity
    const updatedStock = product.stock_quantity + product.reserved_quantity;
    
    await pool.query(
      'UPDATE products SET stock_quantity = $1, reserved_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [updatedStock, productId]
    );

    res.json({ 
      success: true, 
      message: 'Pre-order inventory harvested successfully',
      new_stock_quantity: updatedStock
    });
  } catch (error) {
    console.error('Error harvesting pre-order:', error);
    res.status(500).json({ error: 'Failed to harvest pre-order inventory' });
  }
});

// Convert remaining pre-order inventory to available stock
router.post('/products/:id/convert-preorder', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const productId = parseInt(req.params.id);

    // Verify product belongs to farmer
    const productCheck = await pool.query(
      'SELECT id, farmer_id, stock_quantity, reserved_quantity, max_preorder_quantity FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (productCheck.rows[0].farmer_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const product = productCheck.rows[0];
    
    // Calculate remaining available slots
    const remainingSlots = product.max_preorder_quantity - product.reserved_quantity;
    
    if (remainingSlots <= 0) {
      return res.status(400).json({ error: 'No remaining pre-order slots to convert' });
    }

    // Add remaining slots to stock quantity and disable pre-order
    const updatedStock = product.stock_quantity + remainingSlots;
    
    await pool.query(
      'UPDATE products SET stock_quantity = $1, max_preorder_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [updatedStock, productId]
    );

    res.json({ 
      success: true, 
      message: 'Remaining pre-order inventory converted successfully',
      new_stock_quantity: updatedStock
    });
  } catch (error) {
    console.error('Error converting pre-order:', error);
    res.status(500).json({ error: 'Failed to convert pre-order inventory' });
  }
});

module.exports = router;
