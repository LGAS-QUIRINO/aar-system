// BAAR Part 02 · Cover. Fills in by itself from Audit Setup; the period wording comes from Report Wording.
// One layout feeds the Print View, the printout and the Word file. Letter size, as the issued BAAR covers.
import { loadScript } from './wp.js';
import { upper } from './format.js';
import { periodWords } from './baar-transmittal.js';
import { saveDocx, printPages } from './baar-doc.js';

// Spacing between the lines, in inches (from the issued Balligui cover).
const GAP = { title: 0.4, on: 1.1, brgy: 0.9, period: 1.65 };

export function buildCover({ audit, lgu, mun, pw }) {
  return {
    title: 'AUDIT REPORT', on: 'on',
    brgy: `BARANGAY ${upper(lgu.name)}`, mun: `${mun.name}, Quirino`,
    period: periodWords(pw, audit.periodFrom, audit.periodTo, 'cover'),
    fileName: `${upper(lgu.name).replace(/[^A-Z0-9]+/g, '')}_${upper(mun.name).replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_02_Cover`
  };
}

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const COVER_CSS = `
.cv{text-align:center;color:#000}
.cv .cv-logo img{display:block;margin:0 auto}
.cv .cv-t{margin:0;font-family:Arial,Helvetica,sans-serif;font-weight:700;line-height:1.25}
.cv .cv-p{margin:0;font-family:'Times New Roman',Tinos,Times,serif;font-size:18pt}
`;
export function coverHTML(c) {
  return `<div class="cv">
    <div class="cv-logo"><img src="img/cover-seal.png" alt="Commission on Audit seal" style="width:1.6in;height:1.5in"><img src="img/cover-name.png" alt="Republic of the Philippines, Commission on Audit, Commonwealth Avenue, Quezon City" style="width:3.49in;height:.91in"></div>
    <p class="cv-t" style="margin-top:${GAP.title}in;font-size:26pt">${escH(c.title)}</p>
    <p class="cv-t" style="margin-top:${GAP.on}in;font-size:20pt">${escH(c.on)}</p>
    <p class="cv-t" style="margin-top:${GAP.brgy}in;font-size:26pt">${escH(c.brgy)}<br>${escH(c.mun)}</p>
    <p class="cv-p" style="margin-top:${GAP.period}in">${escH(c.period)}</p></div>`;
}

export function coverPrint(c) {
  return { css: `${COVER_CSS} @page cv { size: 8.5in 11in; margin: 1in 1in .79in 1in; } .pg-cv { page: cv; }`, html: `<div class="pg pg-cv">${coverHTML(c)}</div>` };
}
export function printCover(c, title) { const p = coverPrint(c); printPages(p.css, p.html, title); }

export async function coverSections(c) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, ImageRun, AlignmentType } = D;
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const seal = await load('img/cover-seal.png'), name = await load('img/cover-name.png');
  const T = (t, size, o = {}) => new TextRun({ text: t, font: o.font || 'Arial', size, bold: o.b !== false });
  const P = (kids, before = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: Math.round(before * 1440), after: 0 }, children: kids });
  const children = [];
  if (seal) children.push(P([new ImageRun({ type: 'png', data: seal, transformation: { width: Math.round(1.6 * 96), height: Math.round(1.5 * 96) } })]));
  if (name) children.push(P([new ImageRun({ type: 'png', data: name, transformation: { width: Math.round(3.49 * 96), height: Math.round(0.91 * 96) } })]));
  children.push(P([T(c.title, 52)], GAP.title), P([T(c.on, 40)], GAP.on), P([T(c.brgy, 52)], GAP.brgy), P([T(c.mun, 52)]),
    P([T(c.period, 36, { font: 'Times New Roman', b: false })], GAP.period));
  return [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1134, left: 1440, header: 0, footer: 0 } } }, children }];
}
export async function coverWord(c) { await saveDocx(await coverSections(c), c.fileName, 'BAAR Cover'); }
