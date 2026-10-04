// BAAR Part 04 · Independent Auditor's Report, with the "PART I · AUDITED FINANCIAL STATEMENTS" page before it.
// One layout feeds the Print View, the printout and the Word file. Letter size, 1.5" left margin (as the issued BAARs).
// The report is page 1 of the BAAR; its first page shows no number, the next pages do.
import { loadScript } from './wp.js';
import { longDate, upper } from './format.js';
import { DOC_CSS } from './aom.js';
import { saveDocx } from './baar-doc.js';

// [BARANGAY] "Cabaruan, Maddela, Quirino" · [YEAR] the year of the financial statements (the "To" year).
export const IAR_STANDARD = {
  open: 'We have audited the financial statements of the Barangay [BARANGAY], which comprise the statement of financial position as at December 31, [YEAR], and the statement of financial performance, statement of changes in net assets/equity, statement of cash flows and statement of comparison of budget and actual amounts for the year then ended, and notes to the financial statements, including a summary of significant accounting policies.',
  basesIntro: 'As discussed in Part II – Observations and Recommendations portion of this Report, the balances in the Financial Statements of the affected accounts were unreliable due to the following:',
  conducted: 'We conducted our audit in accordance with International Standards of Supreme Audit Institutions (ISSAIs). Our responsibilities under those standards are further described in the Auditor’s Responsibilities for the Audit of the Financial Statements section of our report. We are independent of the agency in accordance with the ethical requirements that are relevant to our audit of the financial statements, and we have fulfilled our other ethical responsibilities in accordance with these requirements. We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.',
  kam: 'Except for the matter described in the Bases for Qualified Opinion section, we have determined that there are no other key audit matters to communicate in our report.',
  mgmt1: 'Management is responsible for the preparation and fair presentation of the financial statements in accordance with IPSAS, and for such internal control as management determines is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.',
  mgmt2: 'Those charged with governance are responsible for overseeing the BLGU’s financial reporting process.',
  aud: 'Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor’s report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with ISSAIs will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.'
};
export const IAR_KEYS = Object.keys(IAR_STANDARD);
// The opinion paragraph, one per opinion. Qualified is from the issued BAARs; the others are typed the first time.
export const IAR_OPINION_STANDARD = {
  Unmodified: '',
  Qualified: 'In our opinion, except for the effects of the matters described in the Bases for Qualified Opinion section of our report, the accompanying financial statements present fairly, in all material respects, the financial position of the Barangay [BARANGAY] as at December 31, [YEAR], and its financial performance, its cash flows and its comparison of budget and actual amount for the year then ended in accordance with International Public Sector Accounting Standards (IPSASs).',
  Adverse: '',
  Disclaimer: ''
};
export const OPINION_HEAD = { Unmodified: 'Opinion', Qualified: 'Qualified Opinion', Adverse: 'Adverse Opinion', Disclaimer: 'Disclaimer of Opinion' };
export const BASES_HEAD = { Unmodified: '', Qualified: 'Bases for Qualified Opinion', Adverse: 'Bases for Adverse Opinion', Disclaimer: 'Bases for Disclaimer of Opinion' };
// Phrases printed in italics wherever they appear, as in the issued report.
const ITALIC = ['Bases for Qualified Opinion', 'Bases for Adverse Opinion', 'Bases for Disclaimer of Opinion', 'Auditor’s Responsibilities for the Audit of the Financial Statements'];

const blank = '__________';
/**
 * info: { iar (saved Part 04 data), opinion, audit, lgu, mun, atl, pb (title/name), bases: [{ text }] (ticked, in order) }
 * Returns { part1: items, items, fileName }.
 */
export function buildIar(info) {
  const { iar: I, opinion, audit, lgu, mun, atl, pb, bases } = info;
  const brgy = `${lgu.name}, ${mun.name}, Quirino`;
  const fill = (s) => String(s || '').replace(/\[BARANGAY\]/g, brgy).replace(/\[YEAR\]/g, String(audit.periodTo));
  const P = (s, o = {}) => (String(s || '').trim() ? [{ k: 'p', t: fill(s), al: 'j', ...o }, { k: 'bl' }] : []);
  const H = (s) => [{ k: 'p', t: s, b: true, keep: true }, { k: 'bl', keep: true }];
  const items = [{ k: 'lh' }, { k: 'bl' }, { k: 'p', t: 'INDEPENDENT AUDITOR’S REPORT', b: true, al: 'c' }, { k: 'bl' }, { k: 'bl' },
    { k: 'p', t: upper([pb.title, pb.name].filter(Boolean).join(' ')) || blank, b: true }, { k: 'p', t: `Barangay ${lgu.name}` }, { k: 'p', t: `Municipality of ${mun.name}` }, { k: 'p', t: 'Province of Quirino' }, { k: 'bl' }, { k: 'bl' },
    ...H(OPINION_HEAD[opinion] || 'Opinion'), ...P(I.open), ...P((I.opSent || {})[opinion] || '[Opinion paragraph: type it under Opinion]')];
  if (opinion && opinion !== 'Unmodified') {
    items.push(...H(BASES_HEAD[opinion]), ...P(I.basesIntro));
    bases.forEach((b, i) => {
      const t = fill(b.text).trim().replace(/[.;,\s]+$/, '');
      items.push({ k: 'li', n: i + 1, t: t + (i === bases.length - 1 ? '.' : i === bases.length - 2 ? '; and' : ';') }, { k: 'bl' });
    });
  }
  items.push(...P(I.conducted), ...H('Key Audit Matters'), ...P(I.kam),
    ...H('Responsibilities of Management and Those Charged with Governance for the Financial Statements'), ...P(I.mgmt1), ...P(I.mgmt2),
    ...H('Auditor’s Responsibilities for the Audit of the Financial Statements'), ...P(I.aud), { k: 'bl' });
  // The signature block stays together on one page.
  const sig = [{ k: 'p', t: 'COMMISSION ON AUDIT', b: true }, { k: 'bl' }, { k: 'p', t: 'By:' }, { k: 'bl' }, { k: 'bl' }, { k: 'p', t: upper(atl ? atl.name : '') || blank, b: true }];
  if (atl && atl.position) sig.push({ k: 'p', t: atl.position });
  if (atl && atl.designation) sig.push({ k: 'p', t: atl.designation });
  sig.push({ k: 'p', t: I.date ? longDate(I.date) : blank });
  items.push(...sig.map((x, i) => ({ ...x, keep: i < sig.length - 1 })));
  const part1 = [{ k: 'p1', t: 'PART I' }, { k: 'p1', t: 'AUDITED FINANCIAL STATEMENTS' }];
  return { part1, items, fileName: `${upper(lgu.name).replace(/[^A-Z0-9]+/g, '')}_${upper(mun.name).replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_04_Independent_Auditors_Report` };
}

/* ── Screen and print ── */
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const italics = (s) => ITALIC.reduce((h, ph) => h.split(escH(ph)).join(`<i>${escH(ph)}</i>`), escH(s));
export const IAR_CSS = `
.ia p{margin:0;min-height:1em}
.ia .c{text-align:center}.ia .j{text-align:justify}.ia .b{font-weight:700}
.ia .lh{text-align:center;line-height:0;margin-top:-.28in}
.ia .lh img{width:4in;height:1.2in}
.ia .li{display:grid;grid-template-columns:.25in 1fr;text-align:justify}
.ia .keep{break-inside:avoid;page-break-inside:avoid}
.p1{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:'Times New Roman',Tinos,Times,serif;font-weight:700;font-size:24pt;gap:.35in;color:#000}
.bpage{position:relative;width:8.5in;height:11in;padding:1in 1in 1in 1.5in;box-sizing:border-box;overflow:hidden;background:#fff}
.bpage .pno{position:absolute;left:1.5in;right:1in;bottom:.5in;text-align:center;font:11pt 'Times New Roman',Tinos,serif}
`;
export function itemHTML(it) {
  if (it.k === 'lh') return '<div class="lh"><img src="img/lh-central.png" alt="Republic of the Philippines, Commission on Audit, Commonwealth Avenue, Quezon City"></div>';
  if (it.k === 'bl') return '<p>&nbsp;</p>';
  if (it.k === 'li') return `<div class="li"><span>${it.n}.</span><span>${italics(it.t)}</span></div>`;
  const cls = [it.al === 'c' ? 'c' : it.al === 'j' ? 'j' : '', it.b ? 'b' : ''].join(' ').trim();
  return `<p class="${cls}">${it.b ? escH(it.t) : italics(it.t)}</p>`;
}
// Splits the report into Letter pages (9" of text each), keeping marked lines with the line after them.
export function paginateIar(items, box) {
  box.innerHTML = '';
  const hs = items.map((it) => { const w = document.createElement('div'); w.innerHTML = itemHTML(it); box.appendChild(w); return w.offsetHeight; });
  const pages = [[]]; let h = 0; const max = 9 * 96;
  const runH = (i) => { let s = 0, j = i; while (j < items.length) { s += hs[j]; if (!items[j].keep) break; j++; } return s; };
  items.forEach((it, i) => {
    const inRun = i > 0 && items[i - 1].keep;
    const need = inRun ? hs[i] : it.keep ? runH(i) : hs[i];
    if (h + need > max && pages[pages.length - 1].length && !inRun) { pages.push([]); h = 0; }
    if (h === 0 && it.k === 'bl' && pages.length > 1) return;
    pages[pages.length - 1].push(it); h += hs[i];
  });
  box.innerHTML = '';
  return pages;
}
// The pages as shown and printed. startPage: the BAAR page number of the report's first page (1).
export function iarPagesHTML(r, pages, startPage = 1) {
  const p1 = `<div class="bpage"><div class="p1">${r.part1.map((x) => `<div>${escH(x.t)}</div>`).join('')}</div></div>`;
  return [p1, ...pages.map((items, i) => `<div class="bpage"><div class="aom-doc ia">${items.map(itemHTML).join('')}</div>${i ? `<div class="pno">${startPage + i}</div>` : ''}</div>`)];
}
export function iarPrint(r, pages, startPage = 1) {
  return { css: `${DOC_CSS}${IAR_CSS} @page iar { size: 8.5in 11in; margin: 0; } .pg-iar { page: iar; }`, html: iarPagesHTML(r, pages, startPage).map((x) => `<div class="pg pg-iar">${x}</div>`).join('') };
}

/* ── Word: the Part I page, then the report with page numbers from page 2 ── */
export async function iarSections(r, startPage = 1) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, ImageRun, AlignmentType, Footer, PageNumber, TabStopType } = D;
  const F = 'Times New Roman';
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const lh = await load('img/lh-central.png');
  const runs = (t, b) => {
    const out = []; let s = String(t || '');
    if (b) return [new TextRun({ text: s, font: F, size: 24, bold: true })];   // headings are never in italics
    while (s) {
      const hits = ITALIC.map((ph) => [s.indexOf(ph), ph]).filter(([i]) => i >= 0).sort((a, c) => a[0] - c[0]);
      if (!hits.length) { out.push(new TextRun({ text: s, font: F, size: 24, bold: !!b })); break; }
      const [i, ph] = hits[0];
      if (i) out.push(new TextRun({ text: s.slice(0, i), font: F, size: 24, bold: !!b }));
      out.push(new TextRun({ text: ph, font: F, size: 24, bold: !!b, italics: true }));
      s = s.slice(i + ph.length);
    }
    return out;
  };
  const al = (a) => ({ c: AlignmentType.CENTER, j: AlignmentType.JUSTIFIED }[a] || AlignmentType.LEFT);
  const children = r.items.map((it) => {
    if (it.k === 'lh') return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: lh ? [new ImageRun({ type: 'png', data: lh, transformation: { width: 4 * 96, height: 1.2 * 96 } })] : [] });
    if (it.k === 'bl') return new Paragraph({ spacing: { after: 0 }, keepNext: !!it.keep, children: [] });
    if (it.k === 'li') return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 0 }, indent: { left: 360, hanging: 360 }, tabStops: [{ type: TabStopType.LEFT, position: 360 }], children: runs(`${it.n}.\t${it.t}`) });
    return new Paragraph({ alignment: al(it.al), spacing: { after: 0 }, keepNext: !!it.keep, keepLines: !!it.keep, children: runs(it.t, it.b) });
  });
  const page = { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 2160, header: 720, footer: 720 } };
  const p1 = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 4600, after: 480 }, children: [new TextRun({ text: r.part1[0].t, font: F, size: 48, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.part1[1].t, font: F, size: 48, bold: true })] })];
  const num = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: F, size: 22 })] })] });
  return [{ properties: { page }, children: p1 },
    { properties: { page: { ...page, pageNumbers: { start: startPage } }, titlePage: true }, footers: { default: num, first: new Footer({ children: [new Paragraph({ children: [] })] }) }, children }];
}
export async function iarWord(r) { await saveDocx(await iarSections(r), r.fileName, 'BAAR Independent Auditor’s Report'); }
