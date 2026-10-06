// BAAR Part 09 · Part III – Status of Implementation of Prior Years' Audit Recommendations, in the form of the issued
// Balligui BAAR: a "PART III" page, then the title, the opening sentence and a table of five columns (Reference,
// Observations and Recommendations, Status of Implementation, Management Action, Reason for Partial/Non-Implementation).
// Each recommendation is counted separately and numbered 1, 2, 3, … across the table; an observation's recommendations
// sit under it with no line between them. Times New Roman 12, Letter size.
// The list comes from the prior year's Part II (Word file) the first year, and from the app itself after that.
import { loadScript } from './wp.js';
import { ST, fillText, topicVars } from './aom.js';
import { IAR_CSS } from './baar-iar.js';

export const P3_STATUS = { full: 'Fully Implemented', not: 'Not Implemented' };
const uid = () => 'r' + Math.random().toString(36).slice(2, 10);
// "We recommend" becomes "We recommended", as in the issued BAAR.
export const past = (t) => String(t || '').trim().replace(/^We\s+recommend(?!ed)\b/i, 'We recommended');

/* ── Reading the prior year's Part II (Word file) ── */
// Paragraphs of the body (not those inside tables): text, bold, italic and list level.
async function docxParas(file) {
  const X = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const zip = X.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const e = X.CFB.find(zip, '/word/document.xml');
  if (!e) throw new Error('This is not a Word file (.docx).');
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(e.content), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const body = xml.getElementsByTagNameNS(W, 'body')[0];
  const on = (rPr, tag) => { const x = rPr && rPr.getElementsByTagNameNS(W, tag)[0]; return !!x && !/^(0|false|off)$/.test(x.getAttributeNS(W, 'val') || x.getAttribute('w:val') || ''); };
  const out = [];
  Array.from(body.getElementsByTagNameNS(W, 'p')).forEach((p) => {
    for (let a = p.parentNode; a && a !== body; a = a.parentNode) if (a.localName === 'tbl') return;
    let text = '', bold = false, ital = false;
    Array.from(p.getElementsByTagNameNS(W, 'r')).forEach((r) => {
      let t = '';
      Array.from(r.childNodes).forEach((c) => { if (c.localName === 't') t += c.textContent; else if (c.localName === 'tab') t += ' '; });
      if (!t) return;
      text += t;
      if (t.trim()) { const rPr = r.getElementsByTagNameNS(W, 'rPr')[0]; if (on(rPr, 'b')) bold = true; if (on(rPr, 'i')) ital = true; }
    });
    const at = (tag) => { const x = p.getElementsByTagNameNS(W, tag)[0]; return x ? x.getAttributeNS(W, 'val') || x.getAttribute('w:val') : null; };
    const lv = at('ilvl');
    out.push({ t: text.replace(/\s+/g, ' ').trim(), bold, ital, ilvl: lv === null ? null : Number(lv), numId: at('numId') });
  });
  return out;
}
const SEC = /^(?:[A-C]\.\s*)?(FAVORABLE OBSERVATIONS?|FINANCIAL AUDIT|OTHER FINANCIAL RELATED ISSUES)$/i;
/**
 * Reads a Part II Word file: { year, recs }. Favorable observations are left out (they carry no recommendation).
 * Each "We recommend…" paragraph, or each item under "We recommend that Management:", is one recommendation.
 */
export async function readPart2(file) {
  const ps = await docxParas(file);
  const recs = [];
  const years = {};
  let started = false, sec = '', mode = 'title', title = '', obs = null, n = 0, colonItem = null;
  ps.forEach((p) => {
    const t = p.t;
    if (!t) return;
    (t.match(/December 31, (20\d\d)/g) || []).forEach((m) => { const y = m.slice(-4); years[y] = (years[y] || 0) + 1; });
    if (!started) { if (/^OBSERVATIONS AND RECOMMENDATIONS$/i.test(t) && p.bold) started = true; return; }
    const s = SEC.exec(t);
    if (s && p.bold) { sec = /FAVORABLE/i.test(s[1]) ? 'fav' : 'x'; mode = 'title'; return; }
    if (sec === 'fav') return;
    if (/^(Management['’]?s?\s+Comments?(\/s)?|Auditor['’]?s\s+Rejoinder)\s*:?$/i.test(t)) { mode = 'title'; return; }
    if (mode === 'title' && p.ital && !p.bold) { title = t; mode = 'obs'; return; }
    if ((mode === 'obs' || mode === 'title') && p.bold) { obs = { no: ++n, title, text: t, lead: '' }; mode = 'body'; return; }
    if (!obs || !p.bold) return;
    if (mode === 'body' && !/^We\s+recommend/i.test(t)) return;   // bold sub-headings in the body
    if (mode === 'body') {
      mode = 'recs'; colonItem = null;
      if (/:\s*$/.test(t)) { obs.lead = past(t); return; }
    }
    // Sub-items of an item that ends with ":" (a deeper or a different list) stay with that item.
    if (colonItem && (p.ilvl === null || colonItem.ilvl === null || p.ilvl > colonItem.ilvl || p.numId !== colonItem.numId)) { colonItem.rec.text += '\n' + t; return; }
    const rec = { id: uid(), obsNo: obs.no, title: obs.title, obs: obs.text, lead: obs.lead, text: past(t), status: '', action: '', reason: '', src: 'import' };
    recs.push(rec);
    colonItem = /:\s*$/.test(t) ? { rec, ilvl: p.ilvl, numId: p.numId } : null;
  });
  const year = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
  return { year: year ? Number(year[0]) : null, recs };
}

/* ── Carried over from the previous BAAR in the app ── */
// prev: the previous audit's context (loadAudit) and its BAAR record data. The recommendations of its Final AOMs,
// in Part II order, after those of its own Part III that were still Not Implemented.
export function carryOver(prev, prevB) {
  const year = Number(prev.audit.periodTo);
  const out = [];
  ((prevB && prevB.p3 && prevB.p3.recs) || []).filter((r) => r.status === 'not')
    .forEach((r) => out.push({ ...r, id: uid(), status: '', action: '', reason: '', src: 'carried' }));
  const finals = prev.aoms.filter((a) => a.data.status === ST.FINAL);
  const by = (s) => finals.filter((a) => ((a.data.section || 'B') === 'A') === (s === 'A')).sort((a, b) => prev.nums[a.id].n - prev.nums[b.id].n);
  const sorted = [...by('A'), ...by('B')];
  sorted.forEach((a, i) => {
    const vars = prev.varsFor(a);
    const blocks = a.data.blocks || [];
    const topic = blocks.find((b) => b.type === 'topic');
    const r = blocks.find((b) => b.type === 'recommendation') || {};
    const items = (r.items || []).filter((x) => String(x || '').trim());
    const base = { year, obsNo: i + 1, title: fillText(a.data.title || '', topicVars(vars)), obs: fillText(topic ? topic.text : '', topicVars(vars)), status: '', action: '', reason: '', src: 'app' };
    if (items.length) items.forEach((x) => out.push({ ...base, id: uid(), lead: past(r.lead || 'We recommend that Management:'), text: fillText(x, vars) }));
    else if (String(r.text || '').trim()) out.push({ ...base, id: uid(), lead: '', text: past(fillText(r.text, vars)) });
  });
  return out;
}

/* ── The part ── */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export const words = (n) => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n));
const pct = (a, b) => `${Math.round((a / b) * 100)}%`;
const yearsText = (ys) => { const l = ys.map((y) => `CY ${y}`); return l.length < 2 ? l[0] || '' : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`; };

/** Part III: { rows (numbered), counts, opening, checks, years }. p3: the saved { recs, year }. */
export function buildP3(p3) {
  const recs = (p3 && p3.recs) || [];
  const rows = recs.map((r, i) => ({ ...r, n: i + 1, year: r.year || p3.year || '' }));
  const full = rows.filter((r) => r.status === 'full').length, not = rows.filter((r) => r.status === 'not').length;
  const none = rows.length - full - not, total = rows.length;
  const years = [...new Set(rows.map((r) => r.year).filter(Boolean))].sort();
  let opening = '';
  if (total) {
    const parts = [];
    if (full) parts.push(`${words(full)} (${full}) or ${pct(full, total)} ${full === 1 ? 'was' : 'were'} fully implemented`);
    if (not) parts.push(`${words(not)} (${not}) or ${pct(not, total)} ${not === 1 ? 'was' : 'were'} not implemented`);
    if (none) parts.push(`${words(none)} (${none}) [no status yet]`);
    opening = `Of the ${words(total)} (${total}) audit recommendation${total === 1 ? '' : 's'} embodied in the ${yearsText(years)} Barangay Annual Audit Report${years.length > 1 ? 's' : ''}, ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]}, as shown below:`;
  }
  const checks = [];
  if (!total) checks.push({ st: 'wait', t: 'Runs once the prior year’s recommendations are in' });
  else {
    checks.push(none ? { st: 'warn', t: `${none} of ${total} ha${none === 1 ? 's' : 've'} no status yet` } : { st: 'ok', t: `All ${total} have a status` });
    const noReason = rows.filter((r) => r.status === 'not' && !String(r.reason || '').trim()).length;
    if (noReason) checks.push({ st: 'warn', t: `${noReason} Not Implemented ha${noReason === 1 ? 's' : 've'} no reason yet` });
    if (!rows.some((r) => r.year)) checks.push({ st: 'warn', t: 'The year of the prior BAAR is not set' });
  }
  return { rows, counts: { full, not, none, total }, opening, checks, years };
}

/* ── Pages ── */
const W_IN = [0.95, 1.5, 1.25, 1.2, 1.1];   // inches; the issued BAAR's widths fitted to 6"
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lines = (t) => String(t || '').split('\n').filter((x) => x.trim()).map((x) => `<p>${escH(x)}</p>`).join('');
export const P3_CSS = `${IAR_CSS}
.p3d{font-family:'Times New Roman',Tinos,Times,serif;font-size:12pt;line-height:1.15;color:#000}
.p3d p{margin:0}
.p3d .ttl{font-weight:700;text-align:center;font-size:12pt}
.p3d .open{text-align:justify;text-indent:.5in;margin:12pt 0}
.p3t{border-collapse:collapse;width:6in;table-layout:fixed}
.p3t th,.p3t td{border:1px solid #000;padding:3pt 4pt;vertical-align:top;text-align:left}
.p3t th{text-align:center;vertical-align:middle;font-weight:700;padding:8pt 3pt;font-size:11pt}
.p3t th.sm{font-size:8pt}
.p3t td.ref{text-align:center}
.p3t td.ob{font-weight:700;text-align:justify}
.p3t td.j{text-align:justify}
.p3t tr.r td{border-top:0}
.p3t td{overflow-wrap:break-word}
.p3t tbody tr:first-child td{border-top:1px solid #000}
.p3t tbody tr:last-child td{border-bottom:1px solid #000}
.p3t tr.o td{border-bottom:0}
.p3t tr.r.more td{border-bottom:0}
.p3t td .lead{margin-bottom:6pt}
.p3t td .rc{padding-left:.25in;text-indent:-.25in;text-align:justify}
.p3t td .rc p{text-indent:0}
`;
const colgroup = `<colgroup>${W_IN.map((w) => `<col style="width:${w}in">`).join('')}</colgroup>`;
const THEAD = `<thead><tr><th>Reference</th><th>Observations and Recommendations</th><th>Status of Implementation</th><th>Management Action</th><th class="sm">Reason for Partial/Non – Implementation</th></tr></thead>`;
// Table rows: for each observation, a row with the reference and the observation, then a row for each recommendation.
function rowsHTML(d) {
  const out = [];
  d.rows.forEach((r, i) => {
    const prev = d.rows[i - 1], next = d.rows[i + 1];
    const same = (a, b) => a && b && a.year === b.year && a.obsNo === b.obsNo;
    if (!same(prev, r)) out.push({ obs: true, html: `<tr class="o"><td class="ref"><p>BAAR CY ${escH(r.year)}</p><p>Observation No. ${escH(r.obsNo)}</p></td><td class="ob">${lines(r.obs)}</td><td></td><td></td><td></td></tr>` });
    const lead = !same(prev, r) && r.lead ? `<p class="lead">${escH(r.lead)}</p>` : '';
    const [t0, ...rest] = String(r.text || '').split('\n');
    out.push({ obs: false, html: `<tr class="r${same(r, next) ? ' more' : ''}"><td></td><td class="j">${lead}<div class="rc">${escH(r.n)}.&nbsp;&nbsp;${escH(t0)}${rest.filter((x) => x.trim()).map((x) => `<p>${escH(x)}</p>`).join('')}</div></td><td>${escH(P3_STATUS[r.status] || '')}</td><td class="j">${lines(r.action)}</td><td class="j">${lines(r.reason)}</td></tr>` });
  });
  return out;
}
const head = (d) => `<p class="ttl">STATUS OF IMPLEMENTATION OF PRIOR YEARS’ AUDIT</p><p class="ttl">RECOMMENDATIONS</p><p class="open">${escH(d.opening)}</p>`;
// Splits the table into Letter pages (9" of text each), keeping an observation with its first recommendation.
export function paginateP3(d, box) {
  box.className = 'p3d';
  box.style.cssText = 'position:absolute;left:-9999px;top:0;width:6in;visibility:hidden';
  const rs = rowsHTML(d);
  box.innerHTML = `<div id="p3h">${head(d)}</div><table class="p3t">${colgroup}${THEAD}<tbody>${rs.map((x) => x.html).join('')}</tbody></table>`;
  const hH = box.querySelector('#p3h').offsetHeight + box.querySelector('thead').offsetHeight;
  const hs = Array.from(box.querySelectorAll('tbody tr')).map((tr) => tr.offsetHeight);
  box.innerHTML = '';
  const max = 9 * 96, pages = [[]];
  let h = hH;
  rs.forEach((x, i) => {
    const need = x.obs && rs[i + 1] ? hs[i] + hs[i + 1] : hs[i];
    if (h + need > max && pages[pages.length - 1].length) { pages.push([]); h = 0; }
    pages[pages.length - 1].push(x); h += hs[i];
  });
  return pages;
}
export function p3PagesHTML(d, pages, start) {
  const div = `<div class="bpage"><div class="p1"><div>PART III – STATUS OF PRIOR</div><div style="margin-top:-.3in">YEARS’ AUDIT RECOMMENDATIONS</div></div></div>`;
  return [div, ...pages.map((rs, i) => `<div class="bpage"><div class="p3d">${i ? '' : head(d)}<table class="p3t">${colgroup}${i ? '' : THEAD}<tbody>${rs.map((x) => x.html).join('')}</tbody></table></div>${start ? `<div class="pno">${start + i}</div>` : ''}</div>`)];
}
export function p3Print(d, pages, start) {
  return { css: `${P3_CSS} @page p3 { size: 8.5in 11in; margin: 0; } .pg-p3 { page: p3; }`, html: p3PagesHTML(d, pages, start).map((x) => `<div class="pg pg-p3">${x}</div>`).join('') };
}
export const p3FileName = (audit, lgu, mun) => `${String(lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_${String(mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_09_Part_III_Status_of_PY_Recommendations`;

/* ── Word: the Part III page, then the table with page numbers ── */
export async function p3Sections(d, start) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, PageNumber, BorderStyle, VerticalAlign } = D;
  const F = 'Times New Roman';
  const R = (t, o = {}) => new TextRun({ text: String(t ?? ''), bold: !!o.b, font: F, size: o.size || 24 });
  const P = (t, o = {}) => new Paragraph({ alignment: o.al || AlignmentType.LEFT, keepNext: !!o.keep, spacing: { after: o.after || 0 }, indent: o.ind, children: [R(t, o)] });
  const ps = (t, o = {}) => { const l = String(t || '').split('\n').filter((x) => x.trim()); return l.length ? l.map((x) => P(x, o)) : [P('')]; };
  const W = W_IN.map((w) => Math.round(w * 1440));
  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const cell = (kids, i, bd, o = {}) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, children: kids, borders: bd, verticalAlign: o.va, margins: { top: 40, bottom: 40, left: 60, right: 60 } });
  const rows = [new TableRow({ cantSplit: true, children: ['Reference', 'Observations and Recommendations', 'Status of Implementation', 'Management Action', 'Reason for Partial/Non – Implementation']
    .map((h, i) => cell([P(h, { b: true, al: AlignmentType.CENTER, size: i === 4 ? 16 : 22 })], i, undefined, { va: VerticalAlign.CENTER })) })];
  const J = AlignmentType.JUSTIFIED;
  d.rows.forEach((r, i) => {
    const prev = d.rows[i - 1], next = d.rows[i + 1];
    const same = (a, b) => a && b && a.year === b.year && a.obsNo === b.obsNo;
    if (!same(prev, r)) {
      const bd = { bottom: NONE };
      // The observation (topic sentence) row is never split: if it does not fit, it starts on the next page.
      rows.push(new TableRow({ cantSplit: true, children: [cell([P(`BAAR CY ${r.year}`, { al: AlignmentType.CENTER, keep: true }), P(`Observation No. ${r.obsNo}`, { al: AlignmentType.CENTER, keep: true })], 0, bd),
        cell(ps(r.obs, { b: true, al: J }), 1, bd), cell([P('')], 2, bd), cell([P('')], 3, bd), cell([P('')], 4, bd)] }));
    }
    const bd = same(r, next) ? { top: NONE, bottom: NONE } : { top: NONE };
    const [t0, ...rest] = String(r.text || '').split('\n');
    const recKids = [];
    if (!same(prev, r) && r.lead) recKids.push(P(r.lead, { al: J, after: 120 }));
    recKids.push(new Paragraph({ alignment: J, indent: { left: 360, hanging: 360 }, children: [R(`${r.n}.\t${t0}`)], tabStops: [{ type: 'left', position: 360 }] }));
    rest.filter((x) => x.trim()).forEach((x) => recKids.push(P(x, { al: J, ind: { left: 360 } })));
    rows.push(new TableRow({ children: [cell([P('')], 0, bd), cell(recKids, 1, bd), cell([P(P3_STATUS[r.status] || '')], 2, bd), cell(ps(r.action, { al: J }), 3, bd), cell(ps(r.reason, { al: J }), 4, bd)] }));
  });
  const margin = { top: 1440, right: 1440, bottom: 1440, left: 2160, header: 0, footer: 720 };
  const size = { width: 12240, height: 15840 };
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: F, size: 22 })] })] });
  return [
    { properties: { page: { size, margin } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 4600 }, children: [R('PART III – STATUS OF PRIOR', { b: true, size: 48 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [R('YEARS’ AUDIT RECOMMENDATIONS', { b: true, size: 48 })] })] },
    { properties: { page: { size, margin, pageNumbers: start ? { start } : undefined } }, footers: start ? { default: footer } : undefined,
      children: [P('STATUS OF IMPLEMENTATION OF PRIOR YEARS’ AUDIT', { b: true, al: AlignmentType.CENTER }), P('RECOMMENDATIONS', { b: true, al: AlignmentType.CENTER, after: 240 }),
        new Paragraph({ alignment: J, indent: { firstLine: 720 }, spacing: { after: 240 }, children: [R(d.opening)] }),
        new Table({ width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, rows })] }
  ];
}
