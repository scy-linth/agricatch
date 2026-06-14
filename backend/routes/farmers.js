const express = require('express');
const { pool } = require('../utils/db');

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

// Public: get farmers listing
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.email, u.phone,
             u.address as location, COALESCE(u.is_verified, false) as is_verified,
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
      SELECT u.id, u.username, u.full_name, u.email, u.phone, u.address as location, u.is_verified,
             u.shop_description, u.shop_banner_url, u.shop_avatar_url, u.created_at,
             -- Aggregate: total orders (all statuses) for farmer's products
             (SELECT COUNT(*) FROM orders o JOIN products p ON o.product_id = p.id WHERE p.farmer_id = u.id)::int AS total_sales,
             -- Aggregate: total revenue from delivered orders
             COALESCE((SELECT SUM(o.total_amount) FROM orders o JOIN products p ON o.product_id = p.id WHERE p.farmer_id = u.id AND o.status = 'delivered'), 0)::numeric AS total_revenue,
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

// Farmer: overview metrics (charts-ready)
router.get('/me/metrics', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const from = parseIsoDateOnly(req.query.from);
    const to = parseIsoDateOnly(req.query.to);
    const hasCustom = !!(from && to);

    const rangeDays = parseRangeDays(req.query.rangeDays || req.query.range || '30');
    const isAllTime = !hasCustom && rangeDays === null;

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

    // Use delivery date for delivered rows, and created_at for non-delivered rows.
    // This keeps the delivered sales trend aligned with when orders were actually delivered.
    const timeRef = `CASE WHEN o.status = 'delivered' THEN COALESCE(o.delivered_at, o.updated_at, o.created_at) ELSE o.created_at END`;

    const dateSelect = isAllTime
      ? `DATE_TRUNC('month', ${timeRef})::date`
      : `DATE(${timeRef})`;

    let rangeWhere = '';
    let paramsRange = [];
    if (hasCustom) {
      rangeWhere = `AND ${timeRef} >= $2::date AND ${timeRef} < ($3::date + INTERVAL '1 day')`;
      paramsRange = [user.id, from, to];
    } else if (isAllTime) {
      rangeWhere = '';
      paramsRange = [user.id];
    } else {
      rangeWhere = `
        AND ${timeRef} >= (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
        AND ${timeRef} < (CURRENT_DATE + INTERVAL '1 day')
      `;
      paramsRange = [user.id, Number(rangeDays || 30)];
    }

    // Revenue by day (delivered orders only)
    const revenueByDayResult = await pool.query(`
      SELECT TO_CHAR(${dateSelect}, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND o.status = 'delivered'
      GROUP BY ${dateSelect}
      ORDER BY ${dateSelect} ASC
    `, paramsRange);

    // Orders by day (all non-cancelled orders)
    const ordersByDayResult = await pool.query(`
      SELECT TO_CHAR(${dateSelect}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS orders
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND o.status != 'cancelled'
      GROUP BY ${dateSelect}
      ORDER BY ${dateSelect} ASC
    `, paramsRange);

    // Items sold by day (delivered orders only)
    const itemsSoldByDayResult = await pool.query(`
      SELECT TO_CHAR(${dateSelect}, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o.quantity), 0)::int AS items_sold
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND o.status = 'delivered'
      GROUP BY ${dateSelect}
      ORDER BY ${dateSelect} ASC
    `, paramsRange);

    // Products by day (available products)
    let productWhere = '';
    let productParams = [user.id];
    if (hasCustom) {
      productWhere = `AND p.created_at >= $2::date AND p.created_at < ($3::date + INTERVAL '1 day')`;
      productParams = [user.id, from, to];
    } else if (isAllTime) {
      productWhere = '';
      productParams = [user.id];
    } else {
      productWhere = `
        AND p.created_at >= (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
        AND p.created_at < (CURRENT_DATE + INTERVAL '1 day')
      `;
      productParams = [user.id, Number(rangeDays || 30)];
    }

    const productsByDayResult = await pool.query(`
      SELECT TO_CHAR(${dateSelect}, 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT p.id)::int AS products
      FROM products p
      WHERE p.farmer_id = $1
        AND p.is_available = true
        AND p.status = 'approved'
        ${productWhere}
      GROUP BY ${dateSelect}
      ORDER BY ${dateSelect} ASC
    `, productParams);

    // Orders by status (all statuses)
    const ordersByStatusResult = await pool.query(`
      SELECT o.status, COUNT(*)::int AS count
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
      GROUP BY o.status
    `, paramsRange);

    const ordersByStatus = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0
    };
    for (const row of ordersByStatusResult.rows) {
      if (row?.status && Object.prototype.hasOwnProperty.call(ordersByStatus, row.status)) {
        ordersByStatus[row.status] = Number(row.count) || 0;
      }
    }

    // Top products by delivered quantity (and revenue)
    const topProductsResult = await pool.query(`
      SELECT p.id AS product_id,
             p.name AS product_name,
             p.image AS product_image,
             COALESCE(SUM(o.quantity), 0)::int AS sold_qty,
             COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
        AND o.status = 'delivered'
      GROUP BY p.id, p.name, p.image
      ORDER BY sold_qty DESC, revenue DESC
      LIMIT 5
    `, paramsRange);

    // Recent orders (for Overview list)
    const recentOrdersResult = await pool.query(`
      SELECT o.id,
             o.status,
             o.total_amount,
             o.created_at,
             u.full_name AS customer_name,
             p.name AS product_name,
             p.image AS product_image
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
      ORDER BY o.created_at DESC
      LIMIT 8
    `, paramsRange);

    res.json({
      range: hasCustom ? 'custom' : (isAllTime ? 'all' : 'days'),
      rangeDays: (hasCustom || isAllTime) ? null : Number(rangeDays || 30),
      from: hasCustom ? from : null,
      to: hasCustom ? to : null,
      revenueByDay: revenueByDayResult.rows.map(r => ({
        date: r.day,
        revenue: Number(r.revenue) || 0
      })),
      ordersByDay: ordersByDayResult.rows.map(r => ({
        date: r.day,
        orders: Number(r.orders) || 0
      })),
      itemsSoldByDay: itemsSoldByDayResult.rows.map(r => ({
        date: r.day,
        items_sold: Number(r.items_sold) || 0
      })),
      productsByDay: productsByDayResult.rows.map(r => ({
        date: r.day,
        products: Number(r.products) || 0
      })),
      ordersByStatus,
      topProducts: topProductsResult.rows.map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
        product_image: r.product_image,
        sold_qty: Number(r.sold_qty) || 0,
        revenue: Number(r.revenue) || 0
      })),
      recentOrders: recentOrdersResult.rows.map(r => ({
        id: r.id,
        status: r.status,
        total_amount: Number(r.total_amount) || 0,
        created_at: r.created_at,
        customer_name: r.customer_name,
        product_name: r.product_name,
        product_image: r.product_image
      }))
    });
  } catch (error) {
    console.error('Get farmer metrics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: export overview metrics as CSV
router.get('/me/metrics/export.csv', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

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

    const timeRef = `CASE WHEN o.status = 'delivered' THEN COALESCE(o.delivered_at, o.updated_at, o.created_at) ELSE o.created_at END`;
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
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END), 0)::int AS total_sold,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0)::numeric AS total_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
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
      GROUP BY ${dateSelect}
      ORDER BY ${dateSelect} ASC
    `, paramsRange);

    const byStatus = await pool.query(`
      SELECT o.status, COUNT(*)::int AS count
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = $1
        ${rangeWhere}
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

    lines.push(isAllTime ? 'Sales By Month' : 'Sales By Day');
    lines.push('Date,Sales');
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

    lines.push('Top Products (Delivered)');
    lines.push('Product,Sold Qty,Sales');
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

// Farmer: update shop profile
router.put('/profile', async (req, res) => {
  try {
    const user = await requireFarmer(req, res);
    if (!user) return;

    const body = req.body || {};
    const { shop_description, shop_banner_url, shop_avatar_url, full_name, address } = body;
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

module.exports = router;
