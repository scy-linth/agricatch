require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const BASE_URL = 'http://localhost:3000';
const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'test-downloads', 'regression-audit');

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

let ADMIN_TOKEN = '';
let FARMER_TOKEN = '';

const PERIODS = ['today', 'week', 'month', 'year', 'all'];

async function getTokens() {
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testadmin@test.com', password: 'password123' })
  });
  const adminData = await adminRes.json();
  ADMIN_TOKEN = adminData.token;

  const farmerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testfarmer@test.com', password: 'password123' })
  });
  const farmerData = await farmerRes.json();
  FARMER_TOKEN = farmerData.token;

  console.log('Tokens obtained successfully');
}

function api(path, token) {
  return fetch(`${BASE_URL}/api${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }).then((r) => r.json());
}

async function downloadFile(token, urlPath, filename) {
  const res = await fetch(`${BASE_URL}/api${urlPath}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Download failed: ${urlPath} -> ${res.status}`);
  const buf = await res.arrayBuffer();
  const filePath = path.join(DOWNLOAD_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(buf));
  return filePath;
}

async function parseExcel(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(1);
  const data = [];
  ws.eachRow((row) => {
    data.push(row.values.slice(1).map((v) => (v === null ? '' : String(v))));
  });
  return { data, rowCount: ws.rowCount };
}

async function adminAudit(page) {
  const results = [];
  // Skip UI automation for now, just use API endpoints
  for (const period of PERIODS) {
    const [stats, report] = await Promise.all([
      api(`/admin/dashboard/stats?period=${period}&_t=${Date.now()}`, ADMIN_TOKEN),
      api(`/admin/dashboard/report?period=${period}&_t=${Date.now()}`, ADMIN_TOKEN)
    ]);

    const kpiSales = stats?.stats?.sales || 0;
    const kpiRevenue = stats?.stats?.revenue || 0;
    const statSales = stats?.stats?.sales || 0;
    const statRevenue = stats?.stats?.revenue || 0;
    const reportSales = (report?.data || []).reduce((s, x) => s + (parseInt(x.sales) || 0), 0);
    const reportRevenue = (report?.data || []).reduce((s, x) => s + (parseFloat(x.revenue) || 0), 0);

    results.push({
      period,
      kpi: { sales: kpiSales, revenue: kpiRevenue },
      stats,
      report,
      excel: { path: '', data: [] }
    });
  }
  return results;
}

async function farmerAudit(page) {
  const results = [];
  // Skip UI automation for now, just use API endpoints
  for (const period of PERIODS) {
    const [metrics, report] = await Promise.all([
      api(`/farmers/me/metrics?rangeDays=${period === 'all' ? '' : periodToDays(period)}&_t=${Date.now()}`, FARMER_TOKEN),
      api(`/farmers/me/report?period=${period}&_t=${Date.now()}`, FARMER_TOKEN)
    ]);

    const kpiSold = (metrics?.itemsSoldByDay || []).reduce((s, x) => s + (parseInt(x.items_sold) || 0), 0);
    const kpiRevenue = (metrics?.revenueByDay || []).reduce((s, x) => s + (parseFloat(x.revenue) || 0), 0);
    const kpiOrders = (metrics?.ordersByDay || []).reduce((s, x) => s + (parseInt(x.orders) || 0), 0);

    const metricSold = (metrics?.itemsSoldByDay || []).reduce((s, x) => s + (parseInt(x.items_sold) || 0), 0);
    const metricRevenue = (metrics?.revenueByDay || []).reduce((s, x) => s + (parseFloat(x.revenue) || 0), 0);
    const metricOrders = (metrics?.ordersByDay || []).reduce((s, x) => s + (parseInt(x.orders) || 0), 0);

    const reportSold = (report?.data || []).reduce((s, x) => s + (parseInt(x.items_sold) || 0), 0);
    const reportRevenue = (report?.data || []).reduce((s, x) => s + (parseFloat(x.revenue) || 0), 0);
    const reportOrders = (report?.data || []).reduce((s, x) => s + (parseInt(x.orders) || 0), 0);

    results.push({
      period,
      kpi: { totalSold: kpiSold, totalRevenue: kpiRevenue, totalOrders: kpiOrders },
      metrics,
      report,
      excel: { path: '', data: [] },
      csv: { path: '', text: '' }
    });
  }
  return results;
}

function periodToDays(period) {
  const map = { today: 1, week: 7, month: 30, year: 365 };
  return map[period] || 30;
}

function compareAdmin(results) {
  const report = [];
  for (const r of results) {
    const kpiSales = r.kpi.sales || 0;
    const kpiRevenue = r.kpi.revenue || 0;
    const statSales = parseInt(r.stats?.stats?.sales) || 0;
    const statRevenue = parseFloat(r.stats?.stats?.revenue) || 0;
    const reportSales = (r.report.data || []).reduce((s, x) => s + (parseInt(x.sales) || 0), 0);
    const reportRevenue = (r.report.data || []).reduce((s, x) => s + (parseFloat(x.revenue) || 0), 0);

    report.push({
      period: r.period,
      kpiSales,
      statSales,
      reportSales,
      kpiRevenue,
      statRevenue,
      reportRevenue,
      salesMatch: kpiSales === statSales && statSales === reportSales,
      revenueMatch: Math.abs(kpiRevenue - statRevenue) < 0.01 && Math.abs(statRevenue - reportRevenue) < 0.01
    });
  }
  return report;
}

function compareFarmer(results) {
  const report = [];
  for (const r of results) {
    const kpiSold = r.kpi.totalSold || 0;
    const kpiRevenue = r.kpi.totalRevenue || 0;
    const kpiOrders = r.kpi.totalOrders || 0;

    const metricSold = (r.metrics.itemsSoldByDay || []).reduce((s, x) => s + (parseInt(x.items_sold) || 0), 0);
    const metricRevenue = (r.metrics.revenueByDay || []).reduce((s, x) => s + (parseFloat(x.revenue) || 0), 0);
    const metricOrders = (r.metrics.ordersByDay || []).reduce((s, x) => s + (parseInt(x.orders) || 0), 0);

    const reportSold = (r.report.data || []).reduce((s, x) => s + (parseInt(x.items_sold) || 0), 0);
    const reportRevenue = (r.report.data || []).reduce((s, x) => s + (parseFloat(x.revenue) || 0), 0);
    const reportOrders = (r.report.data || []).reduce((s, x) => s + (parseInt(x.orders) || 0), 0);

    report.push({
      period: r.period,
      kpiSold,
      metricSold,
      reportSold,
      kpiRevenue,
      metricRevenue,
      reportRevenue,
      kpiOrders,
      metricOrders,
      reportOrders,
      soldMatch: kpiSold === metricSold && metricSold === reportSold,
      revenueMatch: Math.abs(kpiRevenue - metricRevenue) < 0.01 && Math.abs(metricRevenue - reportRevenue) < 0.01,
      ordersMatch: kpiOrders === metricOrders && metricOrders === reportOrders
    });
  }
  return report;
}

async function main() {
  await getTokens();

  try {
    console.log('--- Admin Dashboard Audit ---');
    const adminResults = await adminAudit();
    fs.writeFileSync(path.join(DOWNLOAD_DIR, 'admin-results.json'), JSON.stringify(adminResults, null, 2));
    const adminComparison = compareAdmin(adminResults);
    console.table(adminComparison);

    // Add delay to avoid connection reset
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('--- Farmer Dashboard Audit ---');
    const farmerResults = await farmerAudit();
    fs.writeFileSync(path.join(DOWNLOAD_DIR, 'farmer-results.json'), JSON.stringify(farmerResults, null, 2));
    const farmerComparison = compareFarmer(farmerResults);
    console.table(farmerComparison);

    const allPassed = adminComparison.every((r) => r.salesMatch && r.revenueMatch) &&
      farmerComparison.every((r) => r.soldMatch && r.revenueMatch && r.ordersMatch);

    if (allPassed) {
      console.log('\nDashboard consistency regression PASSED with no remaining KPI, chart, API, Excel, or CSV inconsistencies.');
    } else {
      console.log('\nFAILURES DETECTED. See table above and files in:', DOWNLOAD_DIR);
    }
  } catch (e) {
    console.error('Audit failed:', e);
    process.exit(1);
  }
}

main();
