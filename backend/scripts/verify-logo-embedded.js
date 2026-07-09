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

async function inspectImages(filePath, fileName) {
  console.log(`\n=== Inspecting ${fileName} for embedded images ===`);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log(`Worksheet count: ${workbook.worksheets.length}`);
  
  // Check workbook for images
  const images = workbook.model.media || [];
  console.log(`Total media items in workbook: ${images.length}`);
  
  if (images.length > 0) {
    console.log('Images found in workbook:');
    images.forEach((img, index) => {
      console.log(`  Image ${index + 1}:`);
      console.log(`    Type: ${img.type || 'unknown'}`);
      console.log(`    Extension: ${img.extension || 'unknown'}`);
      console.log(`    Buffer size: ${img.buffer ? img.buffer.length : 0} bytes`);
    });
  } else {
    console.log('❌ NO images found in workbook');
  }
  
  // Check worksheet for image references
  const worksheet = workbook.worksheets[0];
  const imagesInWorksheet = worksheet.getImages ? worksheet.getImages() : [];
  console.log(`Image references in worksheet: ${imagesInWorksheet.length}`);
  
  if (imagesInWorksheet.length > 0) {
    imagesInWorksheet.forEach((img, index) => {
      console.log(`  Worksheet image ${index + 1}:`);
      console.log(`    Image ID: ${img.imageId}`);
      if (img.range && img.range.tl && img.range.br) {
        console.log(`    Range: tl:${img.range.tl.col},${img.range.tl.row} br:${img.range.br.col},${img.range.br.row}`);
      } else {
        console.log(`    Range: (range data not available)`);
      }
    });
  }
  
  return {
    workbookImages: images.length,
    worksheetImages: imagesInWorksheet.length,
    hasImages: images.length > 0 && imagesInWorksheet.length > 0
  };
}

async function main() {
  const downloadDir = path.join(__dirname, '..', '..', 'test-downloads');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  console.log('=== Generating Fresh Exports for Logo Verification ===\n');

  // Farmer Export
  console.log('1. Generating Farmer Export...');
  const farmerLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'dhelhilis@gmail.com',
    password: 'password123'
  });

  if (farmerLogin.status !== 200) {
    console.log('❌ FAIL: Farmer login failed');
    return;
  }

  const farmerToken = farmerLogin.data.token;
  const farmerExport = await makeRequest('GET', '/api/farmers/me/metrics/export.xlsx?rangeDays=30', null, farmerToken, true);

  const farmerPath = path.join(downloadDir, 'Farmer_Logo_Test.xlsx');
  fs.writeFileSync(farmerPath, farmerExport.data);
  console.log(`✅ Farmer export saved: ${farmerPath}`);
  console.log(`File size: ${farmerExport.data.length} bytes`);

  // Admin Export
  console.log('\n2. Generating Admin Export...');
  const adminLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'admin',
    password: 'adminadmin'
  });

  if (adminLogin.status !== 200) {
    console.log('❌ FAIL: Admin login failed');
    return;
  }

  const adminToken = adminLogin.data.token;
  const adminExport = await makeRequest('GET', '/api/admin/dashboard/export.xlsx?period=month', null, adminToken, true);

  const adminPath = path.join(downloadDir, 'Admin_Logo_Test.xlsx');
  fs.writeFileSync(adminPath, adminExport.data);
  console.log(`✅ Admin export saved: ${adminPath}`);
  console.log(`File size: ${adminExport.data.length} bytes`);

  // Inspect images
  const farmerResults = await inspectImages(farmerPath, 'Farmer Report');
  const adminResults = await inspectImages(adminPath, 'Admin Report');

  console.log('\n=== SUMMARY ===');
  console.log(`Farmer Report has embedded images: ${farmerResults.hasImages ? '✅ YES' : '❌ NO'}`);
  console.log(`Admin Report has embedded images: ${adminResults.hasImages ? '✅ YES' : '❌ NO'}`);

  if (!farmerResults.hasImages || !adminResults.hasImages) {
    console.log('\n❌ LOGO EMBEDDING ISSUE CONFIRMED');
    console.log('Logo code is present but images are not being embedded in the generated files.');
  }
}

main().catch(console.error);
