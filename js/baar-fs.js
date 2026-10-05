// BAAR Part 06 · Audited Financial Statements: the five statements as printed pages and as Word sections.
// Statements follow the Balligui form (Times New Roman, Note column, current and prior year); the Statement of
// Comparison of Budget and Actual Amounts follows the newer Manual format. Letter size; page numbers continue the BAAR.
import { loadScript } from './wp.js';
import { upper } from './format.js';
import { money, scbaaLine, SCBAA_NOTE } from './fs.js';

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SUP = ['', '¹', '²', '³', '⁴', '⁵'];
const amt = (v) => (v === null || v === undefined ? '' : money(v));

export const FS_CSS = `
.fsp{position:relative;width:8.5in;height:11in;padding:.8in 1in .9in 1.25in;box-sizing:border-box;overflow:hidden;background:#fff;color:#000}
.fsp .pno{position:absolute;left:1.25in;right:1in;bottom:.5in;text-align:center;font:11pt 'Times New Roman',Tinos,serif}
.fsd{font-family:'Times New Roman',Tinos,Times,serif;font-size:11pt;line-height:1.3}
.fsd .hd{text-align:center;margin-bottom:.25in}.fsd .hd b{display:block}
.fsd table{width:100%;border-collapse:collapse;table-layout:fixed}
.fsd td{padding:1.5pt 0;vertical-align:bottom}
.fsd .nt{width:.45in;text-align:center}.fsd .py{width:.18in;text-align:left}.fsd .a{width:1.2in;text-align:right;white-space:nowrap}.fsd .gp{width:.14in}
.fsd tr.yr td{font-weight:700;padding-bottom:5pt}.fsd tr.yr td.a{text-align:right}
.fsd tr.ch td{font-weight:700;text-align:center;padding-bottom:2pt}
.fsd tr.h td.t{font-weight:700;padding-top:6pt}.fsd tr.h.plain td.t{font-weight:400}
.fsd tr.sub td.t{font-weight:700;font-style:italic;padding-top:4pt}.fsd tr.sub2 td.t{font-style:italic}
.fsd tr.tot td,.fsd tr.grand td,.fsd tr.grand1 td{font-weight:700}
.fsd tr.tot td.a,.fsd tr.grand1 td.a{border-top:1px solid #000}
.fsd tr.grand td.a{border-top:1px solid #000;border-bottom:3px double #000}
.fsd tr.blank td{height:6pt;padding:0}
.fsd .i1{padding-left:.25in}.fsd .i2{padding-left:.5in}
.fsd .see{text-align:center;margin-top:.3in}
.fsd.sm{font-size:10pt;line-height:1.18}.fsd.sm td{padding:.8pt 0}.fsd.sm .hd{margin-bottom:.15in}.fsd.sm .see{margin-top:.2in}
.ba{font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;line-height:1.25}
.ba .hd{text-align:center;margin-bottom:.2in;font-size:10pt}.ba .hd .ln{display:inline-block;min-width:3.6in;border-bottom:1px solid #000}.ba .hd i{display:block;font-size:9pt}
.ba table{width:100%;border-collapse:collapse;table-layout:fixed}
.ba th{font-weight:700;text-align:center;vertical-align:bottom;padding:0 2pt 6pt}
.ba td{padding:1.5pt 2pt;vertical-align:top}
.ba td.a{text-align:right;white-space:nowrap}
.ba tr.h td{font-weight:700;padding-top:3pt}
.ba td.i{padding-left:.3in}
.ba .fn{margin-top:.25in}.ba .fnl{margin-top:.2in;border-top:1px solid #000;width:2.4in;padding-top:2pt}
`;
const escHead = (lgu, mun) => `Barangay ${lgu.name}, ${mun.name}, Quirino`;

// One Balligui-form statement as a page.
export function stmtHTML(s, { lgu, mun, page }) {
  const showNote = !!s.note;
  const row = (r) => {
    if (r.k === 'blank') return `<tr class="blank"><td colspan="${showNote ? 7 : 6}"></td></tr>`;
    const ind = r.ind === 2 ? 'i2' : r.ind === 1 ? 'i1' : '';
    const cells = r.v ? r.v.map((x, i) => `<td class="py">${r.cur && x !== null && x !== undefined ? '₱' : ''}</td><td class="a">${amt(x)}</td>${i === 0 ? '<td class="gp"></td>' : ''}`).join('')
      : '<td class="py"></td><td class="a"></td><td class="gp"></td><td class="py"></td><td class="a"></td>';
    return `<tr class="${r.k}${r.plain ? ' plain' : ''}"><td class="t ${ind}">${escH(r.t)}</td>${showNote ? `<td class="nt">${r.note || ''}</td>` : ''}${cells}</tr>`;
  };
  const yr = `<tr class="yr"><td></td>${showNote ? '<td class="nt">Note</td>' : ''}<td class="py"></td><td class="a">${s.cols[0]}</td><td class="gp"></td><td class="py"></td><td class="a">${s.cols[1]}</td></tr>`;
  const ch = s.colHead ? `<tr class="ch"><td></td><td colspan="5">${escH(s.colHead)}</td></tr>` : '';
  return `<div class="fsp"><div class="fsd${s.key === 'scf' || s.rows.length > 32 ? ' sm' : ''}"><div class="hd"><b>Republic of the Philippines</b><b>${escH(escHead(lgu, mun))}</b><b>${escH(s.title)}</b>${escH(s.period)}<br>${escH(s.cmp)}</div>
    <table><colgroup><col>${showNote ? '<col class="nt">' : ''}<col class="py"><col class="a"><col class="gp"><col class="py"><col class="a"></colgroup><tbody>${ch}${yr}${s.rows.map(row).join('')}</tbody></table>
    <div class="see">(See accompanying Notes to Financial Statements)</div></div>${page ? `<div class="pno">${page}</div>` : ''}</div>`;
}

/* ── SCBAA: pages ── */
const linesOf = (t, w = 30) => Math.max(1, Math.ceil(String(t).length / w));
// Splits the printed rows into pages (about 44 lines a page; the note and footnotes need room on the last page).
export function scbaaPages(rows) {
  const pages = []; let cur = [], used = 0;
  const CAP = 44;
  rows.forEach((r) => {
    const n = linesOf(r.h || r.t);
    if (used + n > CAP && cur.length) { pages.push(cur); cur = []; used = 0; }
    cur.push(r); used += n;
  });
  if (used > CAP - 7 && cur.length) { pages.push(cur); cur = []; }
  pages.push(cur);
  return pages.filter((p, i) => p.length || i === pages.length - 1);
}
export function scbaaHTML({ rows, data, y, lgu, mun, start }) {
  const pages = scbaaPages(rows);
  const fns = [...new Set(rows.filter((r) => r.fn).map((r) => r.fn))].sort();
  const head = `<tr><th style="width:2.15in"></th><th>Original Budget</th><th>Adjustments</th><th>Final Budget</th><th>Actual on comparable basis</th><th>Performance Difference</th></tr>`;
  return pages.map((p, pi) => {
    const body = p.map((r) => {
      if (r.h) return `<tr class="h"><td colspan="6">${escH(r.h)}</td></tr>`;
      const x = scbaaLine(r, data);
      return `<tr><td class="i">${escH(r.t)}${r.fn ? SUP[r.fn] : ''}</td><td class="a">${money(x.ob, { dash: '' })}</td><td class="a">${money(x.adj, { dash: '' })}</td><td class="a">${money(x.fin, { dash: '' })}</td><td class="a">${money(x.act, { dash: '' })}</td><td class="a">${money(x.diff, { dash: '' })}</td></tr>`;
    }).join('');
    const last = pi === pages.length - 1;
    const hd = pi === 0 ? `<div class="hd"><b>Republic of the Philippines</b><br><span class="ln">${escH(escHead(lgu, mun))}</span><i>(Barangay, City/Municipality, Province)</i><b>Statement of Comparison of Budget and Actual Amounts</b><br>For the Year Ended December 31, ${y}</div>` : '';
    const foot = last ? `<div class="fn">${escH(SCBAA_NOTE)}</div>${fns.length ? `<div class="fnl">${fns.map((n) => `${SUP[n]} details presented in the Notes to the FS`).join('<br>')}</div>` : ''}` : '';
    return `<div class="fsp"><div class="ba">${hd}<table><colgroup><col style="width:2.15in"><col><col><col><col><col></colgroup><thead>${head}</thead><tbody>${body}</tbody></table>${foot}</div>${start ? `<div class="pno">${start + pi}</div>` : ''}</div>`;
  });
}

// All of Part 06 as pages. fs: { stmts: [sfperf, sfpos, scne, scf], scbaa: { rows, data }, y, lgu, mun, pages: { sfperf, … } }
export function fsPagesHTML(fs) {
  const out = fs.stmts.map((s) => stmtHTML(s, { lgu: fs.lgu, mun: fs.mun, page: fs.pages[s.key] }));
  return out.concat(scbaaHTML({ ...fs.scbaa, y: fs.y, lgu: fs.lgu, mun: fs.mun, start: fs.pages.scbaa }));
}
export function fsPrint(fs) {
  return { css: `${FS_CSS} @page fs { size: 8.5in 11in; margin: 0; } .pg-fs { page: fs; }`, html: fsPagesHTML(fs).map((x) => `<div class="pg pg-fs">${x}</div>`).join('') };
}
export const fsFileName = (audit, lgu, mun) => `${upper(lgu.name).replace(/[^A-Z0-9]+/g, '')}_${upper(mun.name).replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_06_Audited_Financial_Statements`;

/* ── Word ── */
export async function fsSections(fs) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, VerticalAlign, Footer, PageNumber } = D;
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const nb = { top: none, bottom: none, left: none, right: none };
  const single = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const dbl = { style: BorderStyle.DOUBLE, size: 6, color: '000000' };
  let base = 22;
  const T = (t, o = {}) => new TextRun({ text: t, font: o.font || 'Times New Roman', size: o.size || base, bold: !!o.b, italics: !!o.i });
  const footer = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 22 })] })] });
  const page = (start, children) => ({ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1152, right: 1440, bottom: 1296, left: 1800, header: 0, footer: 720 }, pageNumbers: start ? { start } : undefined } },
    footers: start ? { default: footer() } : undefined, children });
  const out = [];
  // Balligui-form statements: 6.25" wide → label, note, peso, amount, gap, peso, amount
  fs.stmts.forEach((s) => {
    base = s.key === 'scf' || s.rows.length > 32 ? 20 : 22;
    const note = !!s.note;
    const W = note ? [4840, 560, 220, 1500, 160, 220, 1500] : [5400, 220, 1500, 160, 220, 1500];   // 9,000 = 6.25"
    const cell = (kids, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { ...nb, ...(o.b || {}) }, verticalAlign: VerticalAlign.BOTTOM, columnSpan: o.span, margins: { top: base === 20 ? 0 : 15, bottom: base === 20 ? 0 : 15, left: 0, right: 0 },
      children: [new Paragraph({ alignment: o.al || AlignmentType.LEFT, indent: o.ind ? { left: o.ind } : undefined, spacing: { before: 0, after: 0, line: base === 20 ? 216 : 240 }, children: kids })] });
    const rows = [];
    if (s.colHead) rows.push(new TableRow({ children: [cell([], W[0]), cell([T(s.colHead, { b: true })], W.slice(1).reduce((a, b) => a + b, 0), { span: W.length - 1, al: AlignmentType.CENTER })] }));
    const yrCells = [cell([], W[0])]; if (note) yrCells.push(cell([T('Note', { b: true })], W[1], { al: AlignmentType.CENTER }));
    const o = note ? 1 : 0;
    yrCells.push(cell([], W[1 + o]), cell([T(String(s.cols[0]), { b: true })], W[2 + o], { al: AlignmentType.RIGHT }), cell([], W[3 + o]), cell([], W[4 + o]), cell([T(String(s.cols[1]), { b: true })], W[5 + o], { al: AlignmentType.RIGHT }));
    rows.push(new TableRow({ children: yrCells }));
    s.rows.forEach((r) => {
      if (r.k === 'blank') { rows.push(new TableRow({ height: { value: 120, rule: 'exact' }, children: W.map((w) => cell([], w)) })); return; }
      const bold = ['tot', 'grand', 'grand1'].includes(r.k) || (r.k === 'h' && !r.plain) || r.k === 'sub';
      const ital = r.k === 'sub' || r.k === 'sub2';
      const ind = r.ind === 2 ? 720 : r.ind === 1 ? 360 : 0;
      const bd = r.k === 'grand' ? { top: single, bottom: dbl } : r.k === 'tot' || r.k === 'grand1' ? { top: single } : {};
      const cs = [cell([T(r.t, { b: bold, i: ital })], W[0], { ind })];
      if (note) cs.push(cell([T(r.note ? String(r.note) : '')], W[1], { al: AlignmentType.CENTER }));
      const v = r.v || [null, null];
      v.forEach((x, i) => {
        const has = x !== null && x !== undefined && r.v;
        cs.push(cell([T(r.cur && has ? '₱' : '', { b: bold })], W[1 + o + i * 3]));
        cs.push(cell([T(has ? money(x) : '', { b: bold })], W[2 + o + i * 3], { al: AlignmentType.RIGHT, b: has ? bd : {} }));
        if (i === 0) cs.push(cell([], W[3 + o]));
      });
      rows.push(new TableRow({ cantSplit: true, children: cs }));
    });
    const children = [
      ...['Republic of the Philippines', escHead(fs.lgu, fs.mun), s.title].map((t) => new Paragraph({ alignment: AlignmentType.CENTER, children: [T(t, { b: true })] })),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [T(s.period)] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [T(s.cmp)] }),
      new Table({ width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, borders: { ...nb, insideHorizontal: none, insideVertical: none }, rows }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [T('(See accompanying Notes to Financial Statements)')] })
    ];
    out.push(page(fs.pages[s.key], children));
  });
  base = 22;
  // SCBAA (Manual format), Arial 8.5
  const A = (t, o = {}) => T(t, { ...o, font: 'Arial', size: o.size || 17 });
  const W = [2900, 1220, 1220, 1220, 1220, 1220];
  const c2 = (kids, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: nb, verticalAlign: o.v || VerticalAlign.TOP, columnSpan: o.span, margins: { top: 15, bottom: 15, left: 40, right: 40 },
    children: [new Paragraph({ alignment: o.al || AlignmentType.LEFT, indent: o.ind ? { left: o.ind } : undefined, children: kids })] });
  const { rows: brows, data } = fs.scbaa;
  const head = new TableRow({ tableHeader: true, children: [c2([], W[0]), ...['Original Budget', 'Adjustments', 'Final Budget', 'Actual on comparable basis', 'Performance Difference'].map((t, i) => c2([A(t, { b: true })], W[i + 1], { al: AlignmentType.CENTER, v: VerticalAlign.BOTTOM }))] });
  const trs = [head, ...brows.map((r) => {
    if (r.h) return new TableRow({ cantSplit: true, children: [c2([A(r.h, { b: true })], W.reduce((a, b) => a + b, 0), { span: 6 })] });
    const x = scbaaLine(r, data);
    return new TableRow({ cantSplit: true, children: [c2([A(r.t + (r.fn ? SUP[r.fn] : ''))], W[0], { ind: 420 }), ...[x.ob, x.adj, x.fin, x.act, x.diff].map((v, i) => c2([A(money(v, { dash: '' }))], W[i + 1], { al: AlignmentType.RIGHT }))] });
  })];
  const fns = [...new Set(brows.filter((r) => r.fn).map((r) => r.fn))].sort();
  out.push(page(fs.pages.scbaa, [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [A('Republic of the Philippines', { b: true, size: 20 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: escHead(fs.lgu, fs.mun), font: 'Arial', size: 20, underline: {} })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [A('(Barangay, City/Municipality, Province)', { i: true, size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [A('Statement of Comparison of Budget and Actual Amounts', { b: true, size: 20 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [A(`For the Year Ended December 31, ${fs.y}`, { size: 20 })] }),
    new Table({ width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, borders: { ...nb, insideHorizontal: none, insideVertical: none }, rows: trs }),
    new Paragraph({ spacing: { before: 300 }, children: [A(SCBAA_NOTE)] }),
    ...(fns.length ? [new Paragraph({ spacing: { before: 240 }, border: { top: single }, children: [] }), ...fns.map((n) => new Paragraph({ children: [A(`${SUP[n]} details presented in the Notes to the FS`)] }))] : [])
  ]));
  return out;
}
