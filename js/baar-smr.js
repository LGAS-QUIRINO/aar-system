// BAAR Part 05 · Statement of Management Responsibility for Financial Statements.
// The signed copy from the barangay is uploaded as a PDF; its pages get the BAAR page number at the bottom.
// Before it comes back, the blank statement is printed for the officials to sign by hand.
import { loadScript } from './wp.js';
import { upper } from './format.js';
import { saveDocx } from './baar-doc.js';

// [BARANGAY_CAPS] "CABARUAN" · [MUN] "Maddela, Quirino" · [YEAR] the year of the financial statements.
export const SMR_STANDARD = {
  text: 'The management of Barangay [BARANGAY_CAPS], [MUN] is responsible for all information and representations contained in the accompanying Statement of Financial Position, Statement of Cash Flows, Statement of Comparison of Budget and Actual Amounts, Statement of Net Assets/Equity and Notes to Financial Statements as of December 31, [YEAR] and the related Statement of Financial Performance for the year then ended.\n\nIn this regard, management maintains a system of accounting and reporting which provides for the necessary internal controls to ensure that transactions are properly authorized and recorded, assets are safeguarded against unauthorized use or disposition and liabilities are recognized.',
  acct: 'Municipal Accountant', pb: 'Barangay Captain', treas: 'Barangay Treasurer'
};
export const SMR_KEYS = Object.keys(SMR_STANDARD);

// The three signatories from the officials in Audit Setup.
export function smrSigners(audit) {
  const offs = audit.officials || [];
  const find = (re) => offs.find((o) => re.test(o.pos || ''));
  const n = (o) => (o ? upper(o.name || '') : '');
  return { acct: n(find(/municipal accountant/i)), pb: n(find(/punong barangay/i) || offs.find((o) => o.role === 'For')), treas: n(find(/treasurer/i)) };
}

export function buildSmr({ s, audit, lgu, mun }) {
  const fill = (x) => String(x || '').replace(/\[BARANGAY_CAPS\]/g, upper(lgu.name)).replace(/\[MUN\]/g, `${mun.name}, Quirino`).replace(/\[YEAR\]/g, String(audit.periodTo));
  const paras = String(s.text || '').split(/\n\s*\n/).map((x) => fill(x.replace(/\s*\n\s*/g, ' ').trim())).filter(Boolean);
  const sg = smrSigners(audit);
  return { head: ['Republic of the Philippines', `${mun.name}, Quirino`, `BARANGAY ${upper(lgu.name)}`, '-o0o-'], paras,
    signers: [{ name: sg.acct, title: s.acct }, { name: sg.pb, title: s.pb }, { name: sg.treas, title: s.treas }],
    fileName: `${upper(lgu.name).replace(/[^A-Z0-9]+/g, '')}_${upper(mun.name).replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_05_Management_Responsibility` };
}

const escH = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const SMR_CSS = `
.smr{font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000}
.smr .hd{text-align:center;font-family:Calibri,Carlito,Arial,sans-serif;font-size:11pt;line-height:1.25}
.smr .hd b{font-weight:700}
.smr h4{text-align:center;font-size:12pt;font-weight:700;margin:.4in 0 .45in;line-height:1.25}
.smr p{text-indent:.5in;line-height:2;text-align:justify;margin:0 0 .25in}
.smr .sg{display:grid;grid-template-columns:1fr 1fr;row-gap:.6in;margin-top:.8in;text-align:center}
.smr .sg div{display:flex;flex-direction:column;align-items:center}
.smr .sg b{font-style:italic;border-top:1px solid #000;padding-top:2pt;min-width:2.4in;font-size:11pt}
.smr .sg span{font-size:11pt}
.smr .sg .mid{grid-column:1 / span 2}
.bpage{position:relative;width:8.5in;height:11in;box-sizing:border-box;overflow:hidden;background:#fff}
.bpage .pno{position:absolute;right:1in;bottom:.5in;text-align:center;font:11pt 'Times New Roman',Tinos,serif;color:#000}
.scan{position:relative;width:8.5in;height:11in;background:#fff;overflow:hidden}
.scan img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.scan .pno{position:absolute;left:0;right:0;bottom:.45in;text-align:center;font:11pt 'Times New Roman',Tinos,serif;color:#000}
`;
export function smrHTML(r) {
  return `<div class="smr"><div class="hd">${r.head.map((x, i) => (i === 2 ? `<b>${escH(x)}</b>` : escH(x))).join('<br>')}</div>
    <h4>STATEMENT OF MANAGEMENT RESPONSIBILITY<br>FOR FINANCIAL STATEMENTS</h4>${r.paras.map((x) => `<p>${escH(x)}</p>`).join('')}
    <div class="sg">${r.signers.map((x, i) => `<div class="${i === 2 ? 'mid' : ''}"><b>${escH(x.name) || '&nbsp;'}</b><span>${escH(x.title)}</span></div>`).join('')}</div></div>`;
}
// The blank statement as one printed page; page: the BAAR page number to show (none when printed for signing).
export const smrPageHTML = (r, page) => `<div class="bpage" style="padding:1in"><div class="aom-doc">${smrHTML(r)}</div>${page ? `<div class="pno" style="left:1in">${page}</div>` : ''}</div>`;
// The uploaded signed copy, page by page, with the BAAR page numbers.
export const scanPagesHTML = (imgs, start) => imgs.map((p, i) => `<div class="scan"><img src="${p.src}" alt="Signed statement, page ${i + 1}">${start ? `<div class="pno">${start + i}</div>` : ''}</div>`);

export function smrPrint({ r, imgs, start }) {
  const pages = imgs && imgs.length ? scanPagesHTML(imgs, start) : [smrPageHTML(r, start)];
  return { css: `${SMR_CSS} @page smr { size: 8.5in 11in; margin: 0; } .pg-smr { page: smr; }`, html: pages.map((x) => `<div class="pg pg-smr">${x}</div>`).join('') };
}

export async function smrSections({ r, imgs, start }) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, ImageRun, AlignmentType, Footer, PageNumber, Table, TableRow, TableCell, WidthType, BorderStyle } = D;
  const pnFooter = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 22 })] })] });
  if (imgs && imgs.length) {
    // Each signed page fills the sheet; the BAAR page number is in the footer.
    const children = imgs.map((p, i) => {
      const scale = Math.min(8.5 / p.wIn, 10.6 / p.hIn);
      const data = Uint8Array.from(atob(p.src.split(',')[1]), (c) => c.charCodeAt(0));
      return new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: i > 0, spacing: { after: 0 }, children: [new ImageRun({ type: 'jpg', data, transformation: { width: Math.round(p.wIn * scale * 96), height: Math.round(p.hIn * scale * 96) } })] });
    });
    return [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 0, right: 0, bottom: 360, left: 0, header: 0, footer: 300 }, pageNumbers: start ? { start } : undefined } }, footers: start ? { default: pnFooter() } : undefined, children }];
  }
  const A = (t, o = {}) => new TextRun({ text: t, font: o.font || 'Arial', size: o.size || 24, bold: !!o.b, italics: !!o.i });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const line = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const sig = (x) => [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: line }, spacing: { after: 0 }, children: [A(x.name || ' ', { b: true, i: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [A(x.title, { size: 22 })] })];
  const cell = (kids, w) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none }, margins: { left: 300, right: 300 }, children: kids });
  const children = [
    ...r.head.map((x, i) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [A(x, { font: 'Calibri', size: 22, b: i === 2 })] })),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 560, after: 0 }, children: [A('STATEMENT OF MANAGEMENT RESPONSIBILITY', { b: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 640 }, children: [A('FOR FINANCIAL STATEMENTS', { b: true })] }),
    ...r.paras.map((x) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 720 }, spacing: { line: 480, after: 360 }, children: [A(x)] })),
    new Paragraph({ spacing: { before: 800 }, children: [] }),
    new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows: [new TableRow({ children: [cell(sig(r.signers[0]), 4680), cell(sig(r.signers[1]), 4680)] })] }),
    new Paragraph({ spacing: { before: 700 }, children: [] }),
    new Table({ width: { size: 4680, type: WidthType.DXA }, columnWidths: [4680], alignment: AlignmentType.CENTER, borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows: [new TableRow({ children: [cell(sig(r.signers[2]), 4680)] })] })
  ];
  return [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 }, pageNumbers: start ? { start } : undefined } }, footers: start ? { default: pnFooter() } : undefined, children }];
}
export async function smrWord(args, fileName) { await saveDocx(await smrSections(args), fileName, 'Statement of Management Responsibility'); }
