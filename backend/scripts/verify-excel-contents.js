const http = require('http');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function makeRequest(method, path, data = null, token = null, isBinary = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3000');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = [];
      res.on('data', chunk => body.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(body);
        if (isBinary) {
          resolve({ status: res.statusCode, data: buffer, headers: res.headers });
        } else {
          try {
            const json = JSON.parse(buffer.toString());
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data: buffer.toString(), headers: res.headers });
          }
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function verifyExcelFile(buffer, expectedTitle, expectedPeriod) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  const results = {
    hasLogo: false,
    hasTitle: false,
    hasGeneratedDate: false,
    hasPeriodFilter: false,
    hasKPIs: false,
    hasFooter: false,
    details: []
  };
  
  // Check first few rows for expected content
  let rowCount = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowCount < 20) {
      const cellValue = row.getCell(1).value;
      const cellString = String(cellValue || '').toLowerCase();
      
      results.details.push(`Row ${rowNumber}: ${cellValue}`);
      
      // Check for title
      if (cellString.includes(expectedTitle.toLowerCase())) {
        results.hasTitle = true;
      }
      
      // Check for generated date
      if (cellString.includes('generated') || cellString.includes('date')) {
        results.hasGeneratedDate = true;
      }
      
      // Check for period filter
      if (cellString.includes('period') || cellString.includes('filter') || cellString.includes(expectedPeriod.toLowerCase())) {
        results.hasPeriodFilter = true;
      }
      
      // Check for KPIs
      if (cellString.includes('kpi') || cellString.includes('performance') || cellString.includes('indicator')) {
        results.hasKPIs = true;
      }
      
      // Check for footer
      if (cellString.includes('agricatch') || cellString.includes('copyright') || cellString.includes('rights')) {
        results.hasFooter = true;
      }
      
      rowCount++;
    }
  });
  
  return results;
}

async function main() {
  console.log('=== Verifying Excel File Contents ===\n');
  
  const downloadDir = path.join(__dirname, '..', '..', 'test-downloads');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  
  // Test Farmer Export
  console.log('1. Testing Farmer Export...');
  const farmerLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'dhelhilis@gmail.com',
    password: 'password123'
  });
  
  if (farmerLogin.status !== 200) {
    console.log('✗ FAIL: Farmer login failed');
    return;
  }
  
  const farmerToken = farmerLogin.data.token;
  const farmerExport = await makeRequest('GET', '/api/farmers/me/metrics/export.xlsx?rangeDays=30', null, farmerToken, true);
  
  if (farmerExport.status === 200) {
    const farmerPath = path.join(downloadDir, 'Farmer_Dashboard_Report.xlsx');
    fs.writeFileSync(farmerPath, farmerExport.data);
    console.log('✓ PASS: Farmer Excel file downloaded');
    
    const farmerVerification = await verifyExcelFile(farmerExport.data, 'Farmer Dashboard', '30 days');
    console.log('Farmer Excel Verification:');
    console.log(`  - Has Title: ${farmerVerification.hasTitle ? '✓' : '✗'}`);
    console.log(`  - Has Generated Date: ${farmerVerification.hasGeneratedDate ? '✓' : '✗'}`);
    console.log(`  - Has Period Filter: ${farmerVerification.hasPeriodFilter ? '✓' : '✗'}`);
    console.log(`  - Has KPIs: ${farmerVerification.hasKPIs ? '✓' : '✗'}`);
    console.log(`  - Has Footer: ${farmerVerification.hasFooter ? '✓' : '✗'}`);
    console.log('  Sample content:', farmerVerification.details.slice(0, 5));
  } else {
    console.log('✗ FAIL: Farmer export failed');
  }
  
  // Test Admin Export
  console.log('\n2. Testing Admin Export...');
  const adminLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'admin',
    password: 'adminadmin'
  });
  
  if (adminLogin.status !== 200) {
    console.log('✗ FAIL: Admin login failed');
    return;
  }
  
  const adminToken = adminLogin.data.token;
  const adminExport = await makeRequest('GET', '/api/admin/dashboard/export.xlsx?period=month', null, adminToken, true);
  
  if (adminExport.status === 200) {
    const adminPath = path.join(downloadDir, 'Admin_Dashboard_Report.xlsx');
    fs.writeFileSync(adminPath, adminExport.data);
    console.log('✓ PASS: Admin Excel file downloaded');
    
    const adminVerification = await verifyExcelFile(adminExport.data, 'Admin Dashboard', 'month');
    console.log('Admin Excel Verification:');
    console.log(`  - Has Title: ${adminVerification.hasTitle ? '✓' : '✗'}`);
    console.log(`  - Has Generated Date: ${adminVerification.hasGeneratedDate ? '✓' : '✗'}`);
    console.log(`  - Has Period Filter: ${adminVerification.hasPeriodFilter ? '✓' : '✗'}`);
    console.log(`  - Has KPIs: ${adminVerification.hasKPIs ? '✓' : '✗'}`);
    console.log(`  - Has Footer: ${adminVerification.hasFooter ? '✓' : '✗'}`);
    console.log('  Sample content:', adminVerification.details.slice(0, 5));
  } else {
    console.log('✗ FAIL: Admin export failed');
  }
  
  console.log('\n=== Excel Verification Complete ===');
  console.log(`Downloaded files saved to: ${downloadDir}`);
}

main().catch(console.error);
