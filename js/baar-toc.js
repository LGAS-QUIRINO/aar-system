// BAAR Part 03 · Table of Contents. Page numbers come from the parts of the BAAR (nothing is typed).
// A part not built yet has no page number. Part IV lists only the annexes added in Part 10; none → Part IV is left out.
import { loadScript } from './wp.js';
import { upper } from './format.js';
import { periodWords } from './baar-transmittal.js';
import { saveDocx, printPages } from './baar-doc.js';

/**
 * info: { audit, lgu, mun, pw, pages: { key: page }, annexes: [{ title, ref }] }
 * Returns { rows: [{ k: 'part'|'item', text, sub: [lines], page, pageHead }], fileName }.
 */
export function buildToc({ audit, lgu, mun, pw, pages = {}, annexes = [] }) {
  const y = Number(audit.periodTo);
  const year = periodWords(pw, y, y, 'cover');                     // "For the Year Ended December 31, 2025"
  const cmp = `(With Comparative Figures for CY ${y - 1})`;
  const pg = (k) => (pages[k] === undefined || pages[k] === null ? '' : String(pages[k]));
  const rows = [
    { k: 'part', text: 'PART I – Audited Financial Statements', pageHead: true },
    { k: 'item', text: 'Independent Auditor’s Report', page: pg('iar') },
    { k: 'item', text: 'Statement of Management’s Responsibility for Financial Statements', page: pg('smr') },
    { k: 'item', text: 'Statement of Financial Performance', sub: [year, cmp], page: pg('sfperf') },
    { k: 'item', text: `Statement of Financial Position as at December 31, ${y}`, sub: [cmp], page: pg('sfpos') },
    { k: 'item', text: 'Consolidated Statement of Changes in Net Assets/Equity', sub: [year, cmp], page: pg('scne') },
    { k: 'item', text: 'Statement of Cash Flows', sub: [year, cmp], page: pg('scf') },
    ...(pages.scbaa === null ? [] : [{ k: 'item', text: 'Statement of Comparison of Budget and Actual Amounts', page: pg('scbaa') }]),
    { k: 'item', text: 'Notes to Financial Statements', page: pg('notes') },
    { k: 'part', text: 'PART II – Observations and Recommendations', page: pg('p2') },
    { k: 'part', text: 'PART III – Status of Implementation of Prior Years’ Audit Recommendations' },
    { k: 'item', text: 'Status of Implementation of Prior Years’ Audit Recommendations', page: pg('p3') }
  ];
  if (annexes.length) {
    rows.push({ k: 'part', text: 'PART IV – Annexes' });
    annexes.forEach((a) => rows.push({ k: 'item', text: a.title, page: a.ref }));
  }
  // Group the bullet items under their part, with a blank line between parts (as in the issued BAAR).
  return { rows, missing: rows.filter((r) => r.page === '').length,
    fileName: `${upper(lgu.name).replace(/[^A-Z0-9]+/g, '')}_${upper(mun.name).replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_03_Table_of_Contents` };
}

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const TOC_CSS = `
.toc{font-family:'Times New Roman',Tinos,Times,serif;font-size:12pt;line-height:1.15;color:#000}
.toc h3{text-align:center;font-size:14pt;font-weight:700;margin:0 0 .45in}
.toc .r{display:grid;grid-template-columns:1fr .7in;align-items:end}
.toc .r .pn{text-align:center}
.toc .pt .pn{font-weight:400}.toc .pt .pn.ph{font-weight:700}
.toc .pt{font-weight:700;margin-top:14pt}
.toc .pt:first-of-type{margin-top:0}
.toc .it{padding-left:.5in;position:relative}
.toc .it::before{content:'•';position:absolute;left:.2in}
.toc .first{margin-top:8pt}
`;
export function tocHTML(t) {
  let out = '<div class="toc"><h3>TABLE OF CONTENTS</h3>', prev = '';
  t.rows.forEach((r) => {
    if (r.k === 'part') out += `<div class="r pt"><span>${escH(r.text)}</span><span class="pn${r.pageHead ? ' ph' : ''}">${r.pageHead ? 'Page' : escH(r.page || '')}</span></div>`;
    else out += `<div class="r it${prev === 'part' ? ' first' : ''}"><span>${escH(r.text)}${(r.sub || []).map((x) => '<br>' + escH(x)).join('')}</span><span class="pn">${escH(r.page)}</span></div>`;
    prev = r.k;
  });
  return out + '</div>';
}
export function tocPrint(t) {
  return { css: `${TOC_CSS} @page toc { size: 8.5in 11in; margin: 1in 1in 1in 1.2in; } .pg-toc { page: toc; }`, html: `<div class="pg pg-toc">${tocHTML(t)}</div>` };
}
export function printToc(t, title) { const p = tocPrint(t); printPages(p.css, p.html, title); }

export async function tocSections(t) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, VerticalAlign } = D;
  const R = (x, b) => new TextRun({ text: x, font: 'Times New Roman', size: 24, bold: !!b });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const nb = { top: none, bottom: none, left: none, right: none };
  const W = [8064, 1008];                                           // 6.3" text width: text and page columns
  const cell = (kids, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: nb, verticalAlign: VerticalAlign.BOTTOM, children: kids,
    margins: { top: o.top || 0, bottom: 0, left: 0, right: 0 } });
  const rows = []; let prev = '';
  t.rows.forEach((r) => {
    const top = r.k === 'part' ? (prev ? 280 : 0) : prev === 'part' ? 160 : 0;
    if (r.k === 'part') {
      rows.push(new TableRow({ children: [cell([new Paragraph({ children: [R(r.text, true)] })], W[0], { top }), cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [R(r.pageHead ? 'Page' : r.page || '', !!r.pageHead)] })], W[1], { top })] }));
    } else {
      const lines = [r.text, ...(r.sub || [])];
      const paras = lines.map((x, i) => new Paragraph({ indent: { left: 720, hanging: i === 0 ? 360 : 0 }, tabStops: [{ type: 'left', position: 720 }], children: [R(i === 0 ? '•\t' + x : x)] }));
      rows.push(new TableRow({ children: [cell(paras, W[0], { top }), cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [R(r.page || '')] })], W[1], { top })] }));
    }
    prev = r.k;
  });
  const children = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 640 }, children: [new TextRun({ text: 'TABLE OF CONTENTS', font: 'Times New Roman', size: 28, bold: true })] }),
    new Table({ width: { size: W[0] + W[1], type: WidthType.DXA }, columnWidths: W, borders: { ...nb, insideHorizontal: none, insideVertical: none }, rows })];
  return [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1728, header: 0, footer: 0 } } }, children }];
}
export async function tocWord(t) { await saveDocx(await tocSections(t), t.fileName, 'BAAR Table of Contents'); }
