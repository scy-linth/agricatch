const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, '..', 'tests', 'test-results');
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

function parseMergeRange(range) {
  const parts = range.split(':');
  const start = parts[0].match(/([A-Z]+)(\d+)/);
  if (!start) return null;
  const endMatch = parts[1] ? parts[1].match(/([A-Z]+)(\d+)/) : start;
  const colToNum = (col) => {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num;
  };
  return {
    top: parseInt(start[2]),
    left: colToNum(start[1]),
    bottom: parseInt(endMatch[2]),
    right: colToNum(endMatch[1])
  };
}

async function renderFile(fileName) {
  const filePath = path.join(reportsDir, fileName);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const maxCol = ws.columnCount;
  const maxRow = ws.rowCount;

  const colWidths = [];
  for (let c = 1; c <= maxCol; c++) {
    const col = ws.getColumn(c);
    colWidths.push(col.width ? col.width * 7 : 100);
  }

  // Build merge map
  const mergeMap = {};
  const skipCells = new Set();
  if (ws._merges) {
    for (const mergeKey of Object.keys(ws._merges)) {
      const range = ws._merges[mergeKey];
      const m = range && range.model ? range.model : null;
      if (!m) continue;
      const width = (m.right - m.left + 1);
      const height = (m.bottom - m.top + 1);
      mergeMap[`${m.top},${m.left}`] = { colspan: width, rowspan: height };
      for (let r = m.top; r <= m.bottom; r++) {
        for (let c = m.left; c <= m.right; c++) {
          if (r !== m.top || c !== m.left) {
            skipCells.add(`${r},${c}`);
          }
        }
      }
    }
  }

  // Images
  const images = ws.getImages();
  const imageMap = {};
  for (const img of images) {
    const media = wb.media[img.imageId];
    if (media) {
      const ext = media.extension || 'png';
      const base64 = media.buffer.toString('base64');
      const dataUrl = `data:image/${ext};base64,${base64}`;
      const tl = img.range.tl;
      const row = Math.floor(tl.row) + 1;
      const col = Math.floor(tl.col) + 1;
      const width = img.range.ext ? `${img.range.ext.width}px` : '150px';
      const height = img.range.ext ? `${img.range.ext.height}px` : 'auto';
      imageMap[`${row},${col}`] = `<img src="${dataUrl}" style="width:${width};height:${height};display:block;margin:0 auto;" />`;
    }
  }

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; margin: 20px; background: #fff; }
    table { border-collapse: collapse; table-layout: fixed; width: auto; }
    td { padding: 4px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-sizing: border-box; }
    img { max-width: 100%; display: block; margin: 0 auto; }
    .logo-cell { text-align: center !important; vertical-align: middle; }
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
      if (skipCells.has(`${r},${c}`)) continue;

      const cell = ws.getCell(r, c);
      const value = cell.value;
      const style = cellStyle(cell);
      const width = `width:${colWidths[c - 1]}px`;
      const merge = mergeMap[`${r},${c}`];
      const colspan = merge ? `colspan="${merge.colspan}"` : '';
      const rowspan = merge ? `rowspan="${merge.rowspan}"` : '';
      const imgKey = `${r},${c}`;
      let display = '';
      if (imageMap[imgKey]) {
        display = imageMap[imgKey];
      } else {
        display = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value).replace(/</g, '&lt;'));
      }
      const cellClass = imageMap[imgKey] ? 'logo-cell' : '';
      html += `      <td class="${cellClass}" ${colspan} ${rowspan} style="${style};${width}">${display}</td>\n`;
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
