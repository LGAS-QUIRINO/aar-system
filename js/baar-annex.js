// BAAR Part 10 · Part IV – Annexes. Blank unless annexes are added: with none, Part IV is left out of the BAAR and
// its Table of Contents. Each annex is a schedule (title and table) in the form of the issued Balligui annexes:
// "Barangay X, Municipality, Quirino" and the title on top, the table with its year groups, sub-totals and grand total.
// Annexes are lettered A, B, C… in order; each one's pages are numbered A-1, A-2, … Times New Roman, Letter size.
import { loadScript } from './wp.js';
import { IAR_CSS } from './baar-iar.js';

export const annexLetter = (i) => String.fromCharCode(65 + i);
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const blank = (c) => String(c ?? '').trim() === '';
const AMT_HEAD = /amount|total|balance|₱|php|cost|value/i;
const isNum = (s) => /^\(?-?₱?\s*[\d,]+(\.\d+)?\)?$/.test(String(s ?? '').trim());
const num = (s) => { const t = String(s ?? '').trim(); const v = Number(t.replace(/[₱,\s()]/g, '')); return /^\(.*\)$/.test(t) ? -v : v; };
const money = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Reading an Excel sheet ── */
export async function excelSheets(file) {
  const X = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
  const pad = (n) => String(n).padStart(2, '0');
  return wb.SheetNames.filter((n) => !(wb.Workbook && (wb.Workbook.Sheets || []).find((s) => s.name === n && s.Hidden))).map((name) => {
    const raw = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    const rows = raw.map((r) => r.map((c) => (c instanceof Date ? `${pad(c.getMonth() + 1)}/${pad(c.getDate())}/${c.getFullYear()}` : typeof c === 'number' ? String(Math.round(c * 100) / 100) : String(c ?? '').trim())));
    return { name, rows: cleanRows(rows) };
  }).filter((s) => s.rows.length);
}
// Drops empty rows and columns, and the title lines above the table's heading row (the heading is printed by the app).
export function cleanRows(rows) {
  let r = rows.map((x) => x.map((c) => String(c ?? '').trim())).filter((x) => x.some((c) => !blank(c)));
  const h = r.findIndex((x) => x.filter((c) => !blank(c)).length >= 2);
  if (h > 0) r = r.slice(h);
  const w = Math.max(0, ...r.map((x) => x.length));
  const keep = [...Array(w).keys()].filter((j) => r.some((x) => !blank(x[j])));
  return r.map((x) => keep.map((j) => x[j] ?? ''));
}

/* ── Rows as printed ── */
// Each row: { kind: 'head' | 'group' | 'total' | 'row', cells, amt: [column is an amount] }.
function shape(an) {
  const rows = an.rows || [];
  if (!rows.length) return { cols: 0, out: [] };
  const head = rows[0], cols = head.length;
  const amt = head.map((h, j) => AMT_HEAD.test(h) || (rows.slice(1).some((r) => !blank(r[j])) && rows.slice(1).every((r) => blank(r[j]) || isNum(r[j])) && !/no\.?$|number|code/i.test(h)));
  const out = [{ kind: 'head', cells: head }];
  rows.slice(1).forEach((r) => {
    const filled = r.map((c, j) => (!blank(c) ? j : -1)).filter((j) => j >= 0);
    const tot = r.some((c) => /\b(sub-?\s*total|grand\s*total|grandtotal|total)\b/i.test(c));
    if (!tot && filled.length === 1 && !amt[filled[0]]) out.push({ kind: 'group', cells: [r[filled[0]]] });
    else out.push({ kind: tot ? 'total' : 'row', cells: r.map((c, j) => (amt[j] && isNum(c) ? (tot ? '₱' : '') + money(num(c)) : c)) });
  });
  // Column widths (fractions of the table) from the longest text in each column.
  const body = out.filter((x) => x.kind === 'row' || x.kind === 'total');
  const len = head.map((h, j) => Math.min(45, Math.max(6, ...String(h).split(/\s+/).map((w) => w.length + 1), ...body.map((x) => String(x.cells[j] ?? '').length + (amt[j] ? 2 : 1)))) + (Math.max(0, ...body.map((x) => String(x.cells[j] ?? '').length)) <= 12 ? 3 : 0));
  const sum = len.reduce((a, b) => a + b, 0);
  return { cols, amt, out, frac: len.map((l) => l / sum) };
}
const rowHTML = (s, x) => {
  if (x.kind === 'head') return `<tr class="h">${x.cells.map((c) => `<th>${escH(c)}</th>`).join('')}</tr>`;
  if (x.kind === 'group') return `<tr class="g"><td colspan="${s.cols}">${escH(x.cells[0])}</td></tr>`;
  return `<tr class="${x.kind === 'total' ? 't' : ''}">${x.cells.map((c, j) => `<td class="${s.amt[j] ? 'a' : ''}">${escH(c)}</td>`).join('')}</tr>`;
};

export const ANNEX_CSS = `${IAR_CSS}
.anx{font-family:'Times New Roman',Tinos,Times,serif;font-size:11pt;line-height:1.2;color:#000}
.anx p{margin:0}
.anx .hd{text-align:center;font-weight:700;font-size:12pt}
.anx .hd2{text-align:center;font-weight:700;font-size:12pt;margin-bottom:12pt}
.anx .ttl{text-align:left;font-weight:700;margin-bottom:8pt}
.anxt{border-collapse:collapse;width:6in;table-layout:fixed}
.anxt th,.anxt td{border:1px solid #000;padding:3pt 5pt;vertical-align:top;text-align:left;overflow-wrap:break-word}
.anxt th{text-align:center;font-weight:700;background:#F2F2F2}
.anxt td.a{text-align:right;white-space:nowrap}
.anxt tr.g td{font-weight:700}
.anxt tr.t td{font-weight:700}
.bpage .pno.ax{font-weight:400}
`;
const top = (an, i, ctx, cont) => `<p class="hd">Barangay ${escH(ctx.lgu)}, ${escH(ctx.mun)}, Quirino</p><p class="hd2">${escH(an.title)}${cont ? ' (continued)' : ''}</p>`;
const cg = (s) => `<colgroup>${(s.frac || []).map((f) => `<col style="width:${(f * 100).toFixed(1)}%">`).join('')}</colgroup>`;
// One annex on Letter pages (9" of text each); the table's heading row is repeated on each page.
export function paginateAnnex(an, i, ctx, box) {
  const s = shape(an);
  box.className = 'anx';
  box.style.cssText = 'position:absolute;left:-9999px;top:0;width:6in;visibility:hidden';
  box.innerHTML = `<div id="ah">${top(an, i, ctx)}</div><table class="anxt">${cg(s)}<tbody>${s.out.map((x) => rowHTML(s, x)).join('')}</tbody></table>`;
  const hH = box.querySelector('#ah').offsetHeight;
  const hs = Array.from(box.querySelectorAll('tbody tr')).map((tr) => tr.offsetHeight);
  box.innerHTML = '';
  const max = 9 * 96, headH = hs[0] || 0, pages = [[]];
  let h = hH + headH;
  s.out.slice(1).forEach((x, k) => {
    const need = hs[k + 1] + (x.kind === 'group' && hs[k + 2] ? hs[k + 2] : 0);
    if (h + need > max && pages[pages.length - 1].length) { pages.push([]); h = hH + headH; }
    pages[pages.length - 1].push(x); h += hs[k + 1];
  });
  return { s, pages };
}
export function annexPagesHTML(list, ctx, box) {
  if (!list.length) return [];
  const out = [`<div class="bpage"><div class="p1"><div>PART IV – ANNEXES</div></div></div>`];
  list.forEach((an, i) => {
    const { s, pages } = paginateAnnex(an, i, ctx, box);
    pages.forEach((rs, p) => out.push(`<div class="bpage"><div class="anx">${top(an, i, ctx, p > 0)}<table class="anxt">${cg(s)}<tbody>${rowHTML(s, s.out[0])}${rs.map((x) => rowHTML(s, x)).join('')}</tbody></table></div><div class="pno ax">${annexLetter(i)}-${p + 1}</div></div>`));
  });
  return out;
}
export function annexPrint(list, ctx, box) {
  return { css: `${ANNEX_CSS} @page anx { size: 8.5in 11in; margin: 0; } .pg-anx { page: anx; }`, html: annexPagesHTML(list, ctx, box).map((x) => `<div class="pg pg-anx">${x}</div>`).join('') };
}
// For the Table of Contents: each annex's title and its first page (A-1, B-1, …).
export const annexToc = (list) => (list || []).map((an, i) => ({ title: an.title, ref: `${annexLetter(i)}-1` }));
export const annexFileName = (audit, lgu, mun) => `${String(lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_${String(mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_10_Part_IV_Annexes`;

/* ── Word: the Part IV page, then one section per annex numbered A-1, A-2, … ── */
export async function annexSections(list, ctx) {
  if (!list.length) return [];
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, PageNumber, ShadingType } = D;
  const F = 'Times New Roman';
  const R = (t, o = {}) => new TextRun({ text: String(t ?? ''), bold: !!o.b, font: F, size: o.size || 22 });
  const P = (t, o = {}) => new Paragraph({ alignment: o.al || AlignmentType.LEFT, spacing: { after: o.after || 0 }, children: [R(t, o)] });
  const margin = { top: 1440, right: 1440, bottom: 1440, left: 2160, header: 0, footer: 720 };
  const size = { width: 12240, height: 15840 };
  const secs = [{ properties: { page: { size, margin } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 5200 }, children: [R('PART IV – ANNEXES', { b: true, size: 48 })] })] }];
  list.forEach((an, i) => {
    const s = shape(an);
    const total = 8640, ws = (s.frac || []).map((f) => Math.round(f * total));
    const cell = (c, o = {}, j = 0) => new TableCell({ width: { size: o.span ? total : ws[j], type: WidthType.DXA }, columnSpan: o.span, shading: o.shade ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined, margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ alignment: o.al || AlignmentType.LEFT, children: [R(c, { b: o.b })] })] });
    const rows = s.out.map((x) => {
      if (x.kind === 'head') return new TableRow({ tableHeader: true, cantSplit: true, children: x.cells.map((c, j) => cell(c, { b: true, al: AlignmentType.CENTER, shade: true }, j)) });
      if (x.kind === 'group') return new TableRow({ cantSplit: true, children: [cell(x.cells[0], { b: true, span: s.cols })] });
      return new TableRow({ cantSplit: true, children: x.cells.map((c, j) => cell(c, { b: x.kind === 'total', al: s.amt[j] ? AlignmentType.RIGHT : AlignmentType.LEFT }, j)) });
    });
    const L = annexLetter(i);
    secs.push({ properties: { page: { size, margin, pageNumbers: { start: 1 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [`${L}-`, PageNumber.CURRENT], font: F, size: 22 })] })] }) },
      children: [P(`Barangay ${ctx.lgu}, ${ctx.mun}, Quirino`, { b: true, al: AlignmentType.CENTER, size: 24 }), P(an.title, { b: true, al: AlignmentType.CENTER, size: 24, after: 240 }),
        new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: ws, rows })] });
  });
  return secs;
}
