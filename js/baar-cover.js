// BAAR Part 02 · Cover. Fills in by itself from Audit Setup; the period wording comes from Report Wording.
// One layout feeds the Print View, the printout and the Word file. Letter size, as the issued BAAR covers.
import { loadScript } from './wp.js';
import { upper } from './format.js';
import { periodWords } from './baar-transmittal.js';

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

export function printCover(c, title) {
  const css = `${COVER_CSS} @page { size: 8.5in 11in; margin: 1in 1in .79in 1in; } body { margin: 0; }`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title)}</title><base href="${location.href.split('#')[0]}"><style>${css}</style></head><body>${coverHTML(c)}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  const imgs = [...f.contentDocument.images];
  Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => setTimeout(go, 100));
}

export async function coverWord(c) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = D;
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const seal = await load('img/cover-seal.png'), name = await load('img/cover-name.png');
  const T = (t, size, o = {}) => new TextRun({ text: t, font: o.font || 'Arial', size, bold: o.b !== false });
  const P = (kids, before = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: Math.round(before * 1440), after: 0 }, children: kids });
  const children = [];
  if (seal) children.push(P([new ImageRun({ type: 'png', data: seal, transformation: { width: Math.round(1.6 * 96), height: Math.round(1.5 * 96) } })]));
  if (name) children.push(P([new ImageRun({ type: 'png', data: name, transformation: { width: Math.round(3.49 * 96), height: Math.round(0.91 * 96) } })]));
  children.push(P([T(c.title, 52)], GAP.title), P([T(c.on, 40)], GAP.on), P([T(c.brgy, 52)], GAP.brgy), P([T(c.mun, 52)]),
    P([T(c.period, 36, { font: 'Times New Roman', b: false })], GAP.period));
  const doc = new Document({ creator: 'Annual Audit Report System', title: 'BAAR Cover', styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1134, left: 1440, header: 0, footer: 0 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = c.fileName + '.docx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
