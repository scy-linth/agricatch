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
    const r1 = lastRow - 1;
    const r2 = lastRow;
    const v1 = ws.getCell(r1, 1).value;
    const v2 = ws.getCell(r2, 1).value;
    const merged1 = ws._merges ? Object.keys(ws._merges).some(k => k.startsWith(`A${r1}:`)) : false;
    const merged2 = ws._merges ? Object.keys(ws._merges).some(k => k.startsWith(`A${r2}:`)) : false;
    console.log(`${f}:`);
    console.log(`  row ${r1} col A = ${v1 === null ? 'null' : `"${v1}"`}, merged=${merged1}`);
    console.log(`  row ${r2} col A = ${v2 === null ? 'null' : `"${v2}"`}, merged=${merged2}`);
  }
}

main();
