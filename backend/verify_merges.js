const ExcelJS = require('exceljs');
const path = require('path');

const reportsDir = path.join(__dirname, '..', 'tests', 'test-results');
const files = ['Admin_Dashboard', 'Admin_Orders', 'Admin_Users', 'Farmer_Dashboard', 'Farmer_Orders'];

async function main() {
  for (const f of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(reportsDir, `${f}_Report.xlsx`));
    const ws = wb.worksheets[0];
    const lastRow = ws.rowCount;
    console.log(`--- ${f} ---`);
    console.log(`Row count: ${lastRow}, Col count: ${ws.columnCount}`);
    console.log('All merge keys:', Object.keys(ws._merges || {}));
    // Show footer cells
    for (let r = lastRow - 2; r <= lastRow; r++) {
      const row = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const v = ws.getCell(r, c).value;
        row.push(v === null ? 'null' : (v === '' ? '""' : v.toString().substring(0, 30)));
      }
      console.log(`Row ${r}:`, row.join(' | '));
    }
  }
}

main();
