import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const TEXT_COLS = new Set(['failureMode', 'failureEffect', 'cause', 'preventionControl', 'detectionControl', 'recommendedAction', 'processFunction', 'requirement']);
const MEDIUM_COLS = new Set(['station', 'materials', 'equipment', 'inspectionMethod']);

export function exportToExcel(data, pfmeaColumns, filename) {
  if (!data || data.length === 0) {
    throw new Error('没有可导出的数据，请先生成并确认PFMEA内容');
  }

  const headers = pfmeaColumns.map(c => c.label);

  // Build data rows matching the table exactly
  const aoa = [headers];
  for (const row of data) {
    const rowData = [];
    for (const col of pfmeaColumns) {
      let val = row[col.key];
      if (col.autoCalc && (val === undefined || val === '')) {
        const s = Number(row.severity) || 0;
        const o = Number(row.occurrence) || 0;
        const d = Number(row.detection) || 0;
        if (col.key === 'so') val = s * o;
        if (col.key === 'rpn') val = s * o * d;
      }
      rowData.push(val !== undefined && val !== '' ? val : '');
    }
    aoa.push(rowData);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths matching the table: wider for text, narrower for numbers
  ws['!cols'] = pfmeaColumns.map(c => {
    if (c.type === 'number' && !c.autoCalc) return { wch: 8 };
    if (c.autoCalc) return { wch: 10 };
    if (c.key === 'failureMode' || c.key === 'failureEffect' || c.key === 'cause') return { wch: 28 };
    if (c.key === 'preventionControl' || c.key === 'detectionControl' || c.key === 'recommendedAction') return { wch: 32 };
    if (c.key === 'processFunction' || c.key === 'requirement') return { wch: 22 };
    return { wch: Math.max(c.label.length * 2, 14) };
  });

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MP');
  XLSX.writeFile(wb, filename || `PFMEA_${formatDate()}.xlsx`);
  return filename;
}

export function exportToCsv(data, pfmeaColumns, filename) {
  if (!data || data.length === 0) {
    throw new Error('没有可导出的数据，请先生成并确认PFMEA内容');
  }

  const headers = pfmeaColumns.map(c => c.label);
  const rows = data.map(row => {
    const obj = {};
    for (const col of pfmeaColumns) {
      let val = row[col.key];
      if (col.autoCalc && (val === undefined || val === '')) {
        const s = Number(row.severity) || 0;
        const o = Number(row.occurrence) || 0;
        const d = Number(row.detection) || 0;
        if (col.key === 'so') val = s * o;
        if (col.key === 'rpn') val = s * o * d;
      }
      obj[col.label] = val !== undefined && val !== '' ? val : '';
    }
    return obj;
  });

  const csv = Papa.unparse({ fields: headers, data: rows });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `PFMEA_${formatDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

function formatDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}
