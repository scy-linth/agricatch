const ExcelJS = require('exceljs');
const { applyUnifiedLayout, addUnifiedFooter } = require('./services/orderExportService');

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Dashboard Report');

  const { currentRow } = applyUnifiedLayout(wb, ws, 'Admin Dashboard Report', 5);
  let row = currentRow;

  row = ws.addRow(['Report Information']).number;
  ws.mergeCells(`A${row}:E${row}`);
  row = ws.addRow(['Report Period:', 'All']).number;
  row = ws.addRow(['Generated Date & Time:', 'test']).number;
  row = ws.addRow([]).number;

  // Add many data rows like dashboard
  for (let i = 0; i < 20; i++) {
    ws.addRow([`Data ${i}`, i, `Change ${i}%`]);
  }

  addUnifiedFooter(ws, 5);

  // Set column widths
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 30;
  ws.getColumn(4).width = 20;
  ws.getColumn(5).width = 20;

  await wb.xlsx.writeFile('test_footer2.xlsx');

  // Read back
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile('test_footer2.xlsx');
  const ws2 = wb2.worksheets[0];
  console.log('Merges:', Object.keys(ws2._merges));
  const lastRow = ws2.rowCount;
  for (let r = lastRow - 3; r <= lastRow; r++) {
    const row = [];
    for (let c = 1; c <= ws2.columnCount; c++) {
      const v = ws2.getCell(r, c).value;
      row.push(v === null ? 'null' : (v === '' ? '""' : String(v).substring(0, 40)));
    }
    console.log(`Row ${r}:`, row.join(' | '));
  }
}

main();
