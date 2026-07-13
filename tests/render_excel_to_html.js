const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, 'test-results');
const files = [
  'Admin_Dashboard_Report.xlsx',
  'Admin_Orders_Report.xlsx',
  'Admin_Users_Report.xlsx',
  'Farmer_Dashboard_Report.xlsx',
  'Farmer_Orders_Report.xlsx'
];

function argbToRgba(argb, defaultAlpha = 1) {
  if (!argb) return null;
  const hex = String(argb).replace(/^#/, '');
  const a = hex.length === 8 ? parseInt(hex.slice(0, 2), 16) / 255 : defaultAlpha;
  const rgb = hex.length === 8 ? hex.slice(2) : hex;
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function cellStyle(cell) {
  const styles = [];
  if (cell.font) {
    if (cell.font.bold) styles.push('font-weight:bold');
    if (cell.font.italic) styles.push('font-style:italic');
    if (cell.font.size) styles.push(`font-size:${cell.font.size}pt`);
    if (cell.font.color && cell.font.color.argb) styles.push(`color:${argbToRgba(cell.font.color.argb)}`);
  }
  if (cell.alignment) {
    if (cell.alignment.horizontal) styles.push(`text-align:${cell.alignment.horizontal}`);
    if (cell.alignment.vertical) styles.push(`vertical-align:${cell.alignment.vertical}`);
  }
  if (cell.fill && cell.fill.type === 'pattern' && cell.fill.fgColor && cell.fill.fgColor.argb) {
    const bg = argbToRgba(cell.fill.fgColor.argb);
    if (bg) styles.push(`background-color:${bg}`);
  }
  if (cell.border) {
    const sides = ['top', 'left', 'bottom', 'right'];
    sides.forEach(side => {
      if (cell.border[side] && cell.border[side].style) {
        const color = cell.border[side].color && cell.border[side].color.argb ? argbToRgba(cell.border[side].color.argb) : 'rgba(0,0,0,0.5)';
        styles.push(`border-${side}:1px solid ${color}`);
      }
    });
  }
  return styles.join(';');
}

async function renderFile(fileName) {
  const filePath = path.join(reportsDir, fileName);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const maxCol = ws.columnCount;
  const maxRow = ws.rowCount;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; margin: 20px; background: #fff; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    td { padding: 4px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-sizing: border-box; }
    img { max-width: 150px; display: block; margin: 0 auto; }
  </style>
</head>
<body>
  <table>
`;

  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const rowHeight = row.height ? `height:${row.height}px` : '';
    html += `    <tr style="${rowHeight}">\n`;
    for (let c = 1; c <= maxCol; c++) {
      const cell = ws.getCell(r, c);
      const value = cell.value;
      const style = cellStyle(cell);
      const width = ws.getColumn(c).width ? `width:${ws.getColumn(c).width * 7}px` : '';
      const display = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value).replace(/</g, '&lt;'));
      html += `      <td style="${style};${width}">${display}</td>\n`;
    }
    html += `    </tr>\n`;
  }

  html += `  </table>\n</body>\n</html>`;

  const outHtml = path.join(reportsDir, `${path.basename(fileName, '.xlsx')}.html`);
  fs.writeFileSync(outHtml, html);
  console.log(`Rendered ${fileName} to ${outHtml}`);
}

async function main() {
  for (const file of files) {
    await renderFile(file);
  }
}

main();
