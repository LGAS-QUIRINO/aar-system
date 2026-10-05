// Reading a trial balance from the bookkeeper's Excel file, or from rows pasted from Excel.
// Finds the ACCOUNT TITLE · ACCOUNT CODE · DEBIT · CREDIT columns (any order), the heading lines above them,
// and the GRAND TOTALS line. Amounts are kept exactly as stored in the file (with all their decimals).
import { loadScript } from './wp.js';
import { parseAmt } from './fs.js';

const CODE = /^\d-\d{2}-\d{2}-\d{3}/;
const txt = (c) => (c ? String(c.w !== undefined ? c.w : c.v !== undefined ? c.v : '').trim() : '');
const num = (c) => {
  if (!c || c.v === undefined || c.v === null || c.v === '') return null;
  if (typeof c.v === 'number') return c.v;
  const n = parseAmt(c.v);
  return n === null || isNaN(n) ? null : n;
};

export async function readTbFile(file) {
  if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) throw new Error('Choose the Excel file of the trial balance (.xlsx or .xls).');
  const XLSX = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellNF: true, cellText: true, bookVBA: false });
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) continue;
    const rg = XLSX.utils.decode_range(ws['!ref']);
    const at = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    let head = null;
    for (let r = rg.s.r; r <= Math.min(rg.e.r, rg.s.r + 40) && !head; r++) {
      const cols = {};
      for (let c = rg.s.c; c <= rg.e.c; c++) {
        const t = txt(at(r, c)).toUpperCase().replace(/\s+/g, ' ');
        if (!t) continue;
        if (/CODE/.test(t) && cols.code === undefined) cols.code = c;
        else if (/^DEBIT/.test(t) && cols.dr === undefined) cols.dr = c;
        else if (/^CREDIT/.test(t) && cols.cr === undefined) cols.cr = c;
        else if (/(ACCOUNT|PARTICULARS)/.test(t) && cols.title === undefined) cols.title = c;
      }
      if (['code', 'dr', 'cr', 'title'].every((k) => cols[k] !== undefined)) head = { r, ...cols };
    }
    if (!head) continue;
    const heading = [];
    for (let r = rg.s.r; r < head.r; r++) {
      const line = [];
      for (let c = rg.s.c; c <= rg.e.c; c++) { const t = txt(at(r, c)); if (t) line.push(t); }
      if (line.length) heading.push(line.join(' ').replace(/\s+/g, ' '));
    }
    const rows = []; let totals = null;
    for (let r = head.r + 1; r <= rg.e.r; r++) {
      const title = txt(at(r, head.title)).replace(/\s+/g, ' ').trim(), code = txt(at(r, head.code)).replace(/\s+/g, '');
      const dr = num(at(r, head.dr)), cr = num(at(r, head.cr));
      if (/^(GRAND\s+)?TOTALS?\b/i.test(title) || (!code && /TOTAL/i.test(title))) { totals = { dr: dr || 0, cr: cr || 0 }; break; }
      if (!code && !title) continue;
      if (!code && dr === null && cr === null) continue;          // a section label
      rows.push({ code, title, dr, cr });
    }
    if (!rows.length) continue;
    return { sheet: name, heading, rows, totals };
  }
  throw new Error('No trial balance found in this file. The sheet needs the columns ACCOUNT TITLE, ACCOUNT CODE, DEBIT and CREDIT.');
}

// Rows pasted from Excel: each line has an account code, a title and the debit and credit amounts (tab between columns).
export function readTbPaste(text) {
  const rows = [];
  String(text || '').split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const cells = line.split('\t').map((x) => x.trim());
    const ci = cells.findIndex((x) => CODE.test(x));
    if (ci < 0) return;
    const nums = [];
    let title = '';
    cells.forEach((x, i) => {
      if (i === ci) return;
      const n = parseAmt(x);
      if (x === '' || x === '-') nums.push(null);
      else if (n !== null && !isNaN(n) && /^[\s₱P(,.\-\d)]+$/.test(x)) nums.push(n);
      else if (!title) title = x;
    });
    const tail = nums.slice(-2);
    while (tail.length < 2) tail.unshift(null);
    rows.push({ code: cells[ci], title, dr: tail[0], cr: tail[1] });
  });
  if (!rows.length) throw new Error('No rows with an account code were found. Copy the four columns (title, code, debit, credit) from Excel and paste them here.');
  return { sheet: '', heading: [], rows, totals: null };
}
