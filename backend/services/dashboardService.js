/**
 * Dashboard Service
 * 
 * Shared service for dashboard KPI calculations.
 * Provides a single source of truth for dashboard data used by:
 * - Dashboard APIs
 * - Excel Export endpoints
 * 
 * This eliminates duplicate SQL queries and KPI calculations.
 */

const getPeriodFilter = (period, alias = 'o', useSimpleTimeRef = false) => {
  // Use same time reference as farmer metrics: delivered orders use updated_at (delivery date)
  // For tables without status field (like users), use simple created_at reference
  const timeRef = useSimpleTimeRef 
    ? (alias ? `${alias}.created_at` : 'created_at')
    : (alias ? `CASE WHEN ${alias}.status = 'delivered' THEN COALESCE(${alias}.updated_at, ${alias}.created_at) ELSE ${alias}.created_at END` : `CASE WHEN status = 'delivered' THEN COALESCE(updated_at, created_at) ELSE created_at END`);
  switch (period) {
    case 'today':    return `DATE(${timeRef}) = CURRENT_DATE`;
    case 'week':     return `${timeRef} >= DATE_TRUNC('week', CURRENT_DATE)`;
    case 'month':    return `${timeRef} >= DATE_TRUNC('month', CURRENT_DATE)`;
    case 'year':     return `${timeRef} >= DATE_TRUNC('year', CURRENT_DATE)`;
    default:         return '1=1'; // all time
  }
};

const getPrevPeriodFilter = (period, alias = 'o', useSimpleTimeRef = false) => {
  // Use same time reference as farmer metrics: delivered orders use updated_at (delivery date)
  // For tables without status field (like users), use simple created_at reference
  const timeRef = useSimpleTimeRef 
    ? (alias ? `${alias}.created_at` : 'created_at')
    : (alias ? `CASE WHEN ${alias}.status = 'delivered' THEN COALESCE(${alias}.updated_at, ${alias}.created_at) ELSE ${alias}.created_at END` : `CASE WHEN status = 'delivered' THEN COALESCE(updated_at, created_at) ELSE created_at END`);
  switch (period) {
    case 'today':  return `DATE(${timeRef}) = CURRENT_DATE - INTERVAL '1 day'`;
    case 'week':   return `${timeRef} >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND ${timeRef} < DATE_TRUNC('week', CURRENT_DATE)`;
    case 'month':  return `${timeRef} >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND ${timeRef} < DATE_TRUNC('month', CURRENT_DATE)`;
    case 'year':   return `${timeRef} >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' AND ${timeRef} < DATE_TRUNC('year', CURRENT_DATE)`;
    default:       return '1=0';
  }
};

const calcChange = (curr, prev) => {
  const c = parseFloat(curr) || 0;
  const p = parseFloat(prev) || 0;
  if (p === 0) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 100);
};

/**
 * Get Admin Dashboard Statistics
 * 
 * @param {Object} pool - Database connection pool
 * @param {string} period - Time period: 'today', 'week', 'month', 'year', 'all'
 * @returns {Promise<Object>} Dashboard statistics with KPIs and percentage changes
 */
async function getAdminDashboardStats(pool, period = 'all') {
  const periodFilter = getPeriodFilter(period, 'o');
  const prevFilter   = getPrevPeriodFilter(period, 'o');
  const userPeriodFilter = getPeriodFilter(period, 'u', true);
  const userPrevFilter   = getPrevPeriodFilter(period, 'u', true);

  const [salesRes, prevSalesRes, revenueRes, prevRevenueRes, custRes, prevCustRes, farmerRes, prevFarmerRes, harvestRes, prevHarvestRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS count FROM orders o WHERE ${periodFilter} AND o.status != 'cancelled'`),
    pool.query(`SELECT COUNT(*) AS count FROM orders o WHERE ${prevFilter} AND o.status != 'cancelled'`),
    pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS total FROM orders o WHERE ${periodFilter} AND o.status NOT IN ('cancelled','disabled')`),
    pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS total FROM orders o WHERE ${prevFilter} AND o.status NOT IN ('cancelled','disabled')`),
    pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'customer' AND ${userPeriodFilter}`),
    pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'customer' AND ${userPrevFilter}`),
    pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'farmer' AND ${userPeriodFilter}`),
    pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'farmer' AND ${userPrevFilter}`),
    pool.query(`SELECT COUNT(*) AS count FROM products p WHERE p.is_available = true AND p.harvest_date IS NOT NULL AND p.harvest_date < CURRENT_DATE`),
    pool.query(`SELECT COUNT(*) AS count FROM products p WHERE p.is_available = true AND p.harvest_date IS NOT NULL AND p.harvest_date < CURRENT_DATE`),
  ]);

  const sales   = parseInt(salesRes.rows[0].count);
  const prevSales = parseInt(prevSalesRes.rows[0].count);
  const revenue = parseFloat(revenueRes.rows[0].total);
  const prevRevenue = parseFloat(prevRevenueRes.rows[0].total);
  const customers = parseInt(custRes.rows[0].count);
  const prevCustomers = parseInt(prevCustRes.rows[0].count);
  const farmers = parseInt(farmerRes.rows[0].count);
  const prevFarmers = parseInt(prevFarmerRes.rows[0].count);
  const harvestAttention = parseInt(harvestRes.rows[0].count);
  const prevHarvestAttention = parseInt(prevHarvestRes.rows[0].count);

  return {
    stats: {
      sales,   salesChange: calcChange(sales, prevSales),
      revenue, revenueChange: calcChange(revenue, prevRevenue),
      customers, customersChange: calcChange(customers, prevCustomers),
      farmers, farmersChange: calcChange(farmers, prevFarmers),
      harvest_attention: harvestAttention, harvest_attentionChange: calcChange(harvestAttention, prevHarvestAttention),
    }
  };
}

/**
 * Get Farmer Dashboard Metrics
 * 
 * @param {Object} pool - Database connection pool
 * @param {number} farmerId - Farmer user ID
 * @param {Object} options - Query options
 * @param {string} options.from - Start date (YYYY-MM-DD)
 * @param {string} options.to - End date (YYYY-MM-DD)
 * @param {number} options.rangeDays - Number of days for range
 * @param {string} options.tier - Farmer tier ('premium' or 'free')
 * @returns {Promise<Object>} Farmer dashboard metrics
 */
async function getFarmerDashboardMetrics(pool, farmerId, options = {}) {
  const { from, to, rangeDays, tier } = options;
  
  const hasCustom = !!(from && to);
  let isAllTime = !hasCustom && rangeDays === null;

  // Free tier: max 30 days, no custom ranges, no all-time
  if (tier !== 'premium') {
    if (hasCustom || isAllTime) {
      throw new Error('Custom date ranges and all-time analytics are a Premium feature. Upgrade to Premium for advanced analytics.');
    }
    if (rangeDays > 30) rangeDays = 30;
    isAllTime = false;
  }

  if (hasCustom) {
    const fromDt = new Date(`${from}T00:00:00Z`);
    const toDt = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(fromDt.getTime()) || Number.isNaN(toDt.getTime())) {
      throw new Error('Invalid from/to dates');
    }
    if (fromDt.getTime() > toDt.getTime()) {
      throw new Error('From date must be before To date');
    }
    const daysSpan = Math.floor((toDt.getTime() - fromDt.getTime()) / 86400000) + 1;
    if (daysSpan > 366) {
      throw new Error('Date range too large (max 366 days)');
    }
  }

  const timeRef = `CASE WHEN o.status = 'delivered' THEN COALESCE(o.updated_at, o.created_at) ELSE o.created_at END`;
  const dateSelect = isAllTime ? `DATE_TRUNC('month', ${timeRef})::date` : `DATE(${timeRef})`;

  let rangeWhere = '';
  let paramsRange = [];
  if (hasCustom) {
    rangeWhere = `AND ${timeRef} >= $2::date AND ${timeRef} < ($3::date + INTERVAL '1 day')`;
    paramsRange = [farmerId, from, to];
  } else if (isAllTime) {
    rangeWhere = '';
    paramsRange = [farmerId];
  } else {
    rangeWhere = `
      AND ${timeRef} >= (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
      AND ${timeRef} < (CURRENT_DATE + INTERVAL '1 day')
    `;
    paramsRange = [farmerId, Number(rangeDays || 30)];
  }

  let prevRangeWhere = '';
  let paramsPrevRange = [];
  if (!hasCustom && !isAllTime) {
    prevRangeWhere = `
      AND ${timeRef} >= (CURRENT_DATE - (((($2::int) * 2) - 1) * INTERVAL '1 day'))
      AND ${timeRef} < (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
    `;
    paramsPrevRange = [farmerId, Number(rangeDays || 30)];
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
  // For products, we use created_at directly (no timeRef like orders)
  const productDateSelect = isAllTime
    ? `DATE_TRUNC('month', p.created_at)::date`
    : `DATE(p.created_at)`;

  let productWhere = '';
  let productParams = [farmerId];
  if (hasCustom) {
    productWhere = `AND p.created_at >= $2::date AND p.created_at < ($3::date + INTERVAL '1 day')`;
    productParams = [farmerId, from, to];
  } else if (isAllTime) {
    productWhere = '';
    productParams = [farmerId];
  } else {
    productWhere = `
      AND p.created_at >= (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
      AND p.created_at < (CURRENT_DATE + INTERVAL '1 day')
    `;
    productParams = [farmerId, Number(rangeDays || 30)];
  }

  const productsByDayResult = await pool.query(`
    SELECT TO_CHAR(${productDateSelect}, 'YYYY-MM-DD') AS day,
           COUNT(DISTINCT p.id)::int AS products
    FROM products p
    WHERE p.farmer_id = $1
      AND p.is_available = true
      ${productWhere}
    GROUP BY ${productDateSelect}
    ORDER BY ${productDateSelect} ASC
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
           p.image_url AS product_image,
           p.price,
           COALESCE(SUM(o.quantity), 0)::int AS sold_qty,
           COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE p.farmer_id = $1
      ${rangeWhere}
      AND o.status = 'delivered'
    GROUP BY p.id, p.name, p.image_url, p.price
    ORDER BY sold_qty DESC, revenue DESC
    LIMIT 5
  `, paramsRange);

  // Recent orders (for Overview list)
  const recentOrdersResult = await pool.query(`
    SELECT o.id,
           o.status,
           o.price,
           o.quantity,
           o.total_amount,
           o.created_at,
           u.full_name AS customer_name,
           p.name AS product_name,
           p.image_url AS product_image
    FROM orders o
    JOIN products p ON o.product_id = p.id
    LEFT JOIN users u ON o.user_id = u.id
    WHERE p.farmer_id = $1
      ${rangeWhere}
    ORDER BY o.created_at DESC
    LIMIT 8
  `, paramsRange);

  const calcPercentChange = (curr, prev) => {
    const c = parseFloat(curr) || 0;
    const p = parseFloat(prev) || 0;
    if (p === 0) return c > 0 ? 100 : 0;
    return Math.round(((c - p) / p) * 100);
  };

  let ordersChange = 0;
  let soldChange = 0;
  let revenueChange = 0;
  if (!hasCustom && !isAllTime) {
    const [currentTotalsResult, previousTotalsResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE o.status != 'cancelled')::int AS orders,
          COALESCE(SUM(o.quantity) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS sold,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.farmer_id = $1
          ${rangeWhere}
      `, paramsRange),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE o.status != 'cancelled')::int AS orders,
          COALESCE(SUM(o.quantity) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS sold,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.farmer_id = $1
          ${prevRangeWhere}
      `, paramsPrevRange)
    ]);

    const currentTotals = currentTotalsResult.rows[0] || {};
    const previousTotals = previousTotalsResult.rows[0] || {};
    ordersChange = calcPercentChange(currentTotals.orders, previousTotals.orders);
    soldChange = calcPercentChange(currentTotals.sold, previousTotals.sold);
    revenueChange = calcPercentChange(currentTotals.revenue, previousTotals.revenue);
  }

  return {
    range: hasCustom ? 'custom' : (isAllTime ? 'all' : 'days'),
    rangeDays: (hasCustom || isAllTime) ? null : Number(rangeDays || 30),
    from: hasCustom ? from : null,
    to: hasCustom ? to : null,
    ordersChange,
    soldChange,
    revenueChange,
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
      id: r.product_id,
      product_name: r.product_name,
      product_image: r.product_image,
      price: Number(r.price) || 0,
      sold_qty: Number(r.sold_qty) || 0,
      revenue: Number(r.revenue) || 0
    })),
    recentOrders: recentOrdersResult.rows.map(r => ({
      id: r.id,
      status: r.status,
      price: Number(r.price) || 0,
      quantity: Number(r.quantity) || 1,
      total_amount: Number(r.total_amount) || 0,
      created_at: r.created_at,
      customer_name: r.customer_name,
      product_name: r.product_name,
      product_image: r.product_image
    }))
  };
}

/**
 * Get Farmer Export Data (simplified for Excel export)
 * 
 * @param {Object} pool - Database connection pool
 * @param {number} farmerId - Farmer user ID
 * @param {Object} options - Query options
 * @param {string} options.from - Start date (YYYY-MM-DD)
 * @param {string} options.to - End date (YYYY-MM-DD)
 * @param {number} options.rangeDays - Number of days for range
 * @returns {Promise<Object>} Farmer export data with summary, sales, status, products, orders
 */
async function getFarmerExportData(pool, farmerId, options = {}) {
  const { from, to, rangeDays } = options;
  
  const hasCustom = !!(from && to);
  const isAllTime = !hasCustom && rangeDays === null;

  const timeRef = `CASE WHEN o.status = 'delivered' THEN COALESCE(o.updated_at, o.created_at) ELSE o.created_at END`;
  const dateSelect = isAllTime ? `DATE_TRUNC('month', ${timeRef})::date` : `DATE(${timeRef})`;

  let rangeWhere = '';
  let paramsRange = [];
  if (hasCustom) {
    rangeWhere = `AND ${timeRef} >= $2::date AND ${timeRef} < ($3::date + INTERVAL '1 day')`;
    paramsRange = [farmerId, from, to];
  } else if (isAllTime) {
    rangeWhere = '';
    paramsRange = [farmerId];
  } else {
    rangeWhere = `
      AND ${timeRef} >= (CURRENT_DATE - (($2::int - 1) * INTERVAL '1 day'))
      AND ${timeRef} < (CURRENT_DATE + INTERVAL '1 day')
    `;
    paramsRange = [farmerId, Number(rangeDays || 30)];
  }

  // Summary totals
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

  // Sales by day
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

  // Orders by status
  const byStatus = await pool.query(`
    SELECT o.status, COUNT(*)::int AS count
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE p.farmer_id = $1
      ${rangeWhere}
    GROUP BY o.status
    ORDER BY o.status ASC
  `, paramsRange);

  // Top products
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

  // Recent orders
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

  return {
    summary: summary.rows[0] || { total_orders: 0, total_sold: 0, total_revenue: 0 },
    revenue: revenue.rows,
    byStatus: byStatus.rows,
    topProducts: topProducts.rows,
    recentOrders: recentOrders.rows,
    hasCustom,
    isAllTime,
    rangeDays
  };
}

module.exports = {
  getAdminDashboardStats,
  getFarmerDashboardMetrics,
  getFarmerExportData,
  getPeriodFilter,
  getPrevPeriodFilter,
  calcChange
};
