// BAAR Part 01 · Transmittal Letters: SA → Punong Barangay, ATL → SA, and the blank AAPSI Form.
// One layout feeds the Print View on screen, the printout and the Word file. Paper: Letter (8.5" × 11"), the BAAR standard.
import { loadScript } from './wp.js';
import { longDate, upper, nice, periodPhrase } from './format.js';
import { DOC_CSS } from './aom.js';

// Words that fill in by themselves: [BARANGAY] "Cabaruan, Maddela, Quirino", [MUN] "Maddela, Quirino",
// [PERIOD] "for the two-year period ended December 31, 2025", [CONF_DATE] "October 15, 2026".
export const TR_STANDARD = {
  sa1: 'We are pleased to transmit the Barangay Annual Audit Report on the Barangay [BARANGAY] [PERIOD], pursuant to Section 2, Article IX-D of the Philippine Constitution and Section 43 of Presidential Decree No. 1445, otherwise known as the Government Code of the Philippines.',
  sa2: 'The audit was conducted to: (a) ascertain the level of assurance that may be placed on management’s assertions on the financial statements; (b) determine the propriety of transactions as well as the extent of compliance with applicable laws, rules and regulations; (c) recommend agency improvement opportunities; and (d) determine the extent of implementation of prior years’ audit recommendations.',
  sa3: 'The auditing standards used in conducting the audit was in accordance with the International Standards of Supreme Audit Institutions (ISSAIs) and we believe that it provides reasonable bases for the results of audit.',
  sa5: 'The audit observations together with the recommended courses of action, which were discussed with the concerned management officials and staff during the exit conference on [CONF_DATE], are presented in detail in Part II of the report.',
  sa6: 'We request that the recommended remedial measures be immediately implemented and we will appreciate being informed of the actions taken thereon within 60 days from receipt hereof pursuant to Section 94 of the General Provisions of the General Appropriations Act of Fiscal Year 2024 (Republic Act No. 11975), using the Agency Action Plan and Status of Implementation (AAPSI) Form to be submitted to the Audit Team.',
  sa7: 'We acknowledge the support and cooperation that you and your staff extended to the Audit Team, thus facilitating the conduct of audit and submission of this report.',
  cc: 'The Municipal Mayor, [MUN]\nThe Presiding Officer, Sangguniang Bayan, [MUN]\nThe Municipal Accountant, [MUN]\nThe Chairman, Committee on Appropriations, Barangay [BARANGAY]\nThe Regional Director',
  atlAddr: 'Audit Group G-Quirino Province\nCabarroguis, Quirino',
  atlSal: 'Sir:',
  atl1: 'In compliance with Section 2, Article IX – D of the Philippine Constitution and pertinent sections of Presidential Decree No. 1445, we conducted a financial and compliance audit on the accounts and operations of the Barangay [BARANGAY] [PERIOD].',
  atl2: 'The audit was conducted to: (a) ascertain the level of assurance that may be placed on management’s assertions on the financial statements; (b) determine the propriety of transactions as well as the extent of compliance with applicable laws, rules and regulations; (c) recommend agency improvement opportunities; and (d) determine the extent of implementation of prior years’ audit recommendations.',
  atl3: 'The results of our audit are embodied in our attached report consisting of four parts: Part I – Audited Financial Statements and Part II – Audit Observations and Recommendations, Part III – Status of Implementation of Prior Years’ Audit Recommendations and Part IV – Annexes. The observations and recommendations were communicated with management through the issuance of Audit Observation Memoranda (AOMs) and management comments were incorporated in the final report, where appropriate.',
  atl4: 'Our audit was conducted in accordance with International Standards of Supreme Audit Institutions (ISSAIs) and we believe that it provides reasonable bases for our audit opinion.',
  atl6: 'We acknowledge the cooperation extended to the audit team by the officials and staff of the agency which made possible the submission of this report.'
};
export const TR_KEYS = Object.keys(TR_STANDARD);
export const OPINIONS = ['Unmodified', 'Qualified', 'Adverse', 'Disclaimer'];
// The opinion sentences, one pair per opinion: sa = in the letter to the Punong Barangay, atl = in the letter to the SA.
// Only Qualified has standard wording (from the issued BAARs); the others are typed the first time and saved as standard.
export const OPINION_STANDARD = {
  Unmodified: { sa: '', atl: '' },
  Qualified: {
    sa: 'The Auditor rendered a qualified opinion on the fairness of presentation of the financial statements of the Barangay in view of the significance of the exceptions noted in audit as stated in the Independent Auditor’s Report.',
    atl: 'We rendered a qualified opinion on the fairness of presentation of the financial statements of Barangay [BARANGAY] [PERIOD].'
  },
  Adverse: { sa: '', atl: '' },
  Disclaimer: { sa: '', atl: '' }
};

const WORDS = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// COA wording for the letters: "for the year ended December 31, 2025" / "for the two-year period ended December 31, 2025".
export function periodEnded(from, to) {
  const n = Number(to) - Number(from) + 1;
  return n <= 1 ? `for the year ended December 31, ${to}` : `for the ${WORDS[n] || n}-year period ended December 31, ${to}`;
}
// "Dear Punong Barangay Eban:" from "Myrna W. Eban" (suffixes such as Jr. or III are skipped).
export function pbSalutation(name) {
  const w = String(name || '').trim().split(/\s+/).filter((x) => x && !/^(jr|sr|ii|iii|iv|v)\.?,?$/i.test(x));
  const last = w.length ? w[w.length - 1].replace(/,$/, '') : '';
  return last ? `Dear Punong Barangay ${nice(last)}:` : 'Dear Punong Barangay:';
}
// The Punong Barangay from Audit Setup.
export function punongBarangay(audit) {
  const o = (audit.officials || []).find((x) => /punong barangay/i.test(x.pos || '')) || (audit.officials || []).find((x) => x.role === 'For') || null;
  return o ? { title: o.title || '', name: o.name || '', pos: (o.acting ? 'Acting ' : '') + (o.pos || 'Punong Barangay') } : { title: 'Hon.', name: '', pos: 'Punong Barangay' };
}

const blank = '__________';
// Marks a run of lines to stay on one page with the line after it (the signature block).
const keepTogether = (xs) => xs.map((x) => ({ ...x, keep: true }));
/**
 * info: { t (transmittal data), audit, lgu (barangay), mun, team, atl, sa }
 * Returns { docs: [{ key, title, items }], fileName }.
 */
export function buildTransmittal(info) {
  const { t, audit, lgu, mun, team, atl, sa } = info;
  const brgy = `${lgu.name}, ${mun.name}, Quirino`;
  const op = (t.opSent && t.opSent[t.opinion]) || { sa: '', atl: '' };
  const fill = (s) => String(s || '')
    .replace(/\[BARANGAY\]/g, brgy).replace(/\[MUN\]/g, `${mun.name}, Quirino`)
    .replace(/\[PERIOD\]/g, periodEnded(audit.periodFrom, audit.periodTo))
    .replace(/\[CONF_DATE\]/g, t.confDate ? longDate(t.confDate) : blank);
  const lh = (office) => [{ k: 'lh' },
    { k: 'p', t: 'REGIONAL OFFICE NO. II', b: true, al: 'c' }, { k: 'p', t: 'PROVINCE OF QUIRINO', al: 'c' },
    { k: 'p', t: 'PROVINCIAL SATELLITE AUDITING OFFICE', al: 'c' }, { k: 'p', t: 'Capitol Hills, Cabarroguis, Quirino', al: 'c', size: 18 },
    { k: 'bl' }, { k: 'p', t: office, b: true, al: 'c', rule: true }, { k: 'bl' }];
  const para = (s) => (String(s || '').trim() ? [{ k: 'p', t: fill(s), al: 'j' }, { k: 'bl' }] : []);
  const pos = (u) => (u && u.position) || '', des = (u) => (u && u.designation) || '';

  // 1 · SA to the Punong Barangay
  const d1 = [...lh('Office of the Supervising Auditor'),
    { k: 'p', t: t.saDate ? longDate(t.saDate) : blank }, { k: 'bl' },
    { k: 'p', t: upper(t.pbName) || blank, b: true }, { k: 'p', t: t.pbPos || 'Punong Barangay' }, { k: 'p', t: brgy }, { k: 'bl' },
    { k: 'p', t: t.salutation || 'Dear Punong Barangay:' }, { k: 'bl' },
    ...para(t.sa1), ...para(t.sa2), ...para(t.sa3), ...para(op.sa || '[Opinion sentence: type it under Report Details]'), ...para(t.sa5), ...para(t.sa6), ...para(t.sa7),
    ...keepTogether([{ k: 'p', t: 'Very truly yours,' }, { k: 'bl' }, { k: 'p', t: 'COMMISSION ON AUDIT', b: true }, { k: 'bl' }, { k: 'p', t: 'By:' }, { k: 'bl' }, { k: 'bl' }]),
    { k: 'p', t: upper(sa ? sa.name : '') || blank, b: true, keep: !!(pos(sa) || des(sa)) }];
  if (pos(sa)) d1.push({ k: 'p', t: pos(sa), keep: !!des(sa) });
  if (des(sa)) d1.push({ k: 'p', t: des(sa) });
  const cc = String(t.cc || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (cc.length) d1.push({ k: 'bl' }, { k: 'bl' }, { k: 'bl' }, { k: 'p', t: 'Copy furnished:', i: true }, { k: 'bl' }, ...cc.map((c) => ({ k: 'p', t: fill(c), i: true })));

  // 2 · ATL to the SA
  const d2 = [...lh('Office of the Auditor' + (team && team.officeCode ? ' – Audit Team ' + team.officeCode : '')),
    { k: 'p', t: t.atlDate ? longDate(t.atlDate) : blank }, { k: 'bl' },
    { k: 'p', t: upper(sa ? sa.name : '') || blank, b: true }];
  const saTitle = [pos(sa), des(sa)].filter(Boolean).join('/');
  if (saTitle) d2.push({ k: 'p', t: saTitle });
  String(t.atlAddr || '').split('\n').map((s) => s.trim()).filter(Boolean).forEach((s) => d2.push({ k: 'p', t: s }));
  d2.push({ k: 'bl' }, { k: 'p', t: t.atlSal || 'Sir:', b: true }, { k: 'bl' },
    ...para(t.atl1), ...para(t.atl2), ...para(t.atl3), ...para(t.atl4), ...para(op.atl || '[Opinion sentence: type it under Report Details]'), ...para(t.atl6),
    ...keepTogether([{ k: 'p', t: 'Very truly yours,' }, { k: 'bl' }, { k: 'bl' }]), { k: 'p', t: upper(atl ? atl.name : '') || blank, b: true, keep: !!(pos(atl) || des(atl)) });
  if (pos(atl)) d2.push({ k: 'p', t: pos(atl), keep: !!des(atl) });
  if (des(atl)) d2.push({ k: 'p', t: des(atl) });

  // 3 · AAPSI Form (blank template for the barangay)
  const d3 = [{ k: 'p', t: 'Republic of the Philippines', al: 'c' }, { k: 'p', t: 'Province of Quirino', al: 'c' }, { k: 'p', t: `Municipality of ${mun.name}`, al: 'c' },
    { k: 'p', t: `BARANGAY ${upper(lgu.name)}`, al: 'c' }, { k: 'bl' }, { k: 'bl' },
    { k: 'p', t: 'AGENCY ACTION PLAN and STATUS OF IMPLEMENTATION', al: 'c' }, { k: 'p', t: 'Audit Observations and Recommendations', al: 'c' },
    { k: 'p', t: periodPhrase(audit.periodFrom, audit.periodTo), al: 'c' }, { k: 'p', t: `As of ___________ ${audit.auditYear}`, al: 'c' },
    { k: 'bl' }, { k: 'aapsi', rows: 10 }, { k: 'bl' }, { k: 'bl' }, { k: 'bl' }, { k: 'p', t: 'Agency sign-off:' }, { k: 'bl' }, { k: 'bl' },
    { k: 'sign' }, { k: 'bl' }, { k: 'bl' }, { k: 'bl' }, { k: 'bl' },
    { k: 'p', t: 'Note:\tStatus of Implementation may either be (a) Fully Implemented, or (b) Partially Implemented.', size: 16 }];

  const fileName = `${upper(lgu.name).replace(/[^A-Z0-9]+/g, '')}_${upper(mun.name).replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_01_Transmittal_Letters`;
  return { docs: [{ key: 'sa', title: 'Letter to the Punong Barangay', items: d1 }, { key: 'atl', title: 'Letter to the Supervising Auditor', items: d2 }, { key: 'aapsi', title: 'AAPSI Form', items: d3 }], fileName };
}

/* ── Screen and print ── */
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const TR_CSS = `
.bl p{margin:0;min-height:1em}
.bl .c{text-align:center}.bl .j{text-align:justify}.bl .b{font-weight:700}.bl .i{font-style:italic}
.bl .lh2 .seal{left:calc(50% - 2.72in);top:-.16in;width:1.1in;height:1.1in}
.bl .aap{border-collapse:collapse;width:100%;font-size:7pt;line-height:1.1}
.bl .aap th,.bl .aap td{border:1px solid #000;padding:2pt;text-align:center;vertical-align:middle;font-weight:700}
.bl .aap td{height:.19in}
.bl .sign{display:flex;justify-content:space-between;font-size:10pt}
.bl .sign span{display:inline-block;border-top:1px solid #000;padding-top:2pt}
.bl .note{display:grid;grid-template-columns:.5in 1fr}
`;
const AAPSI_HEAD = `<thead><tr><th rowspan="3">Ref.</th><th rowspan="3">Audit Observations</th><th rowspan="3">Audit Recommendations</th><th colspan="4">Agency Action Plan</th><th rowspan="3">Status of Implementation</th><th rowspan="3">Reason for Partial/ Delay/ Non-Implementation, if applicable</th><th rowspan="3">Action Taken/ Action to be taken</th></tr>
  <tr><th rowspan="2">Action Plan</th><th rowspan="2">Person/ Dept. Responsible</th><th colspan="2">Target Implementation Date</th></tr><tr><th>From</th><th>To</th></tr></thead>`;
export function itemHTML(it) {
  if (it.k === 'lh') return '<div class="lh2"><img class="seal" src="img/lh-seal.jpg" alt="Commission on Audit seal"><img class="name" src="img/lh-name.jpg" alt="Republic of the Philippines, Commission on Audit" style="width:3in;height:.434in"></div>';
  if (it.k === 'bl') return '<p>&nbsp;</p>';
  if (it.k === 'aapsi') return `<table class="aap">${AAPSI_HEAD}<tbody>${('<tr>' + '<td></td>'.repeat(10) + '</tr>').repeat(it.rows)}</tbody></table>`;
  if (it.k === 'sign') return '<div class="sign"><span style="width:2.6in">Name and Position of Agency Officer</span><span style="width:1.2in;text-align:center">Date</span></div>';
  if (/^Note:\t/.test(it.t || '')) return `<p class="note" style="font-size:${it.size / 2}pt"><span>Note:</span><span>${escH(it.t.replace(/^Note:\t/, ''))}</span></p>`;
  const cls = [it.al === 'c' ? 'c' : it.al === 'j' ? 'j' : '', it.b ? 'b' : '', it.i ? 'i' : '', it.rule ? 'rule-below' : ''].join(' ').trim();
  return `<p class="${cls}"${it.size ? ` style="font-size:${it.size / 2}pt"` : ''}>${escH(it.t)}</p>`;
}
export const docHTML = (doc) => doc.items.map(itemHTML).join('');

// Splits one document into Letter pages for the Print View (9" of text per page, breaking between paragraphs).
export function paginate(doc, measureBox) {
  measureBox.innerHTML = '';
  const pages = [[]]; let h = 0; const max = 9 * 96;
  const hs = doc.items.map((it) => { const wrap = document.createElement('div'); wrap.innerHTML = itemHTML(it); measureBox.appendChild(wrap); return wrap.offsetHeight; });
  // Lines marked keep stay with the line after them: the whole run moves to the next page if it does not fit.
  const runH = (i) => { let s = 0, j = i; while (j < doc.items.length) { s += hs[j]; if (!doc.items[j].keep) break; j++; } return s; };
  doc.items.forEach((it, i) => {
    const inRun = i > 0 && doc.items[i - 1].keep;
    const need = inRun ? hs[i] : it.keep ? runH(i) : hs[i];
    if (h + need > max && pages[pages.length - 1].length && !inRun) { pages.push([]); h = 0; }
    if (h === 0 && it.k === 'bl' && pages.length > 1 && !it.keep) return;   // no blank line at the top of a new page
    pages[pages.length - 1].push(it); h += hs[i];
  });
  measureBox.innerHTML = '';
  return pages;
}

export function printTransmittal(d, which, title) {
  const docs = which ? d.docs.filter((x) => x.key === which) : d.docs;
  const css = `${DOC_CSS}${TR_CSS}
    @page { size: 8.5in 11in; margin: 1in 1in 1in 1.5in; }
    body { margin: 0; } .doc + .doc { break-before: page; page-break-before: always; }`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title)}</title><base href="${location.href.split('#')[0]}"><style>${css}</style></head>
    <body>${docs.map((x) => `<div class="doc aom-doc bl">${docHTML(x)}</div>`).join('')}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  const img = f.contentDocument.querySelector('img');
  if (img && !img.complete) img.onload = img.onerror = go; else setTimeout(go, 200);
}

/* ── Word: one section per document, Letter size, 1.5" left margin for binding ── */
export async function transmittalWord(d, which) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, TabStopType, VerticalAlign } = D;
  const FONT = 'Times New Roman', EMU = 914400;
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const seal = await load('img/lh-seal.jpg'), name = await load('img/lh-name.jpg');
  const R = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 24, bold: !!o.b, italics: !!o.i });
  const al = (a) => ({ c: AlignmentType.CENTER, j: AlignmentType.JUSTIFIED }[a] || AlignmentType.LEFT);
  const P = (t, o = {}) => new Paragraph({ alignment: al(o.al), spacing: { after: 0, line: 240 }, keepNext: !!o.keep,
    border: o.rule ? { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 24, color: '000000', space: 4 } } : undefined, children: [R(t, o)] });
  const W = [450, 1100, 1300, 560, 900, 700, 470, 1100, 1250, 810];   // AAPSI columns, 8640 twips (6")
  const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const cellB = { top: thin, bottom: thin, left: thin, right: thin };
  const hc = (t, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: cellB, rowSpan: o.rs, columnSpan: o.cs, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [R(t, { size: 13, b: true })] })] });
  const aapsi = (rows) => new Table({ width: { size: 8640, type: WidthType.DXA }, columnWidths: W, rows: [
    new TableRow({ tableHeader: true, children: [hc('Ref.', W[0], { rs: 3 }), hc('Audit Observations', W[1], { rs: 3 }), hc('Audit Recommendations', W[2], { rs: 3 }), hc('Agency Action Plan', W[3] + W[4] + W[5] + W[6], { cs: 4 }),
      hc('Status of Implementation', W[7], { rs: 3 }), hc('Reason for Partial/ Delay/ Non-Implementation, if applicable', W[8], { rs: 3 }), hc('Action Taken/ Action to be taken', W[9], { rs: 3 })] }),
    new TableRow({ tableHeader: true, children: [hc('Action Plan', W[3], { rs: 2 }), hc('Person/ Dept. Responsible', W[4], { rs: 2 }), hc('Target Implementation Date', W[5] + W[6], { cs: 2 })] }),
    new TableRow({ tableHeader: true, children: [hc('From', W[5]), hc('To', W[6])] }),
    ...Array.from({ length: rows }, () => new TableRow({ height: { value: 280, rule: 'atLeast' }, children: W.map((w) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: cellB, children: [new Paragraph({ children: [] })] })) }))] });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const sign = () => new Table({ width: { size: 8640, type: WidthType.DXA }, columnWidths: [3800, 3040, 1800], borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 3800, type: WidthType.DXA }, borders: { top: thin, bottom: none, left: none, right: none }, children: [new Paragraph({ children: [R('Name and Position of Agency Officer', { size: 20 })] })] }),
      new TableCell({ width: { size: 3040, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none }, children: [new Paragraph({ children: [] })] }),
      new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: { top: thin, bottom: none, left: none, right: none }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [R('Date', { size: 20 })] })] })] })] });
  const kids = (doc) => {
    const out = [];
    doc.items.forEach((it) => {
      if (it.k === 'lh') {
        const k = [];
        // The seal sits just left of the 3" name block, centered on the 6" text width (as on the AOM).
        if (seal) k.push(new ImageRun({ type: 'jpg', data: seal, transformation: { width: Math.round(1.1 * 96), height: Math.round(1.1 * 96) },
          floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: Math.round(0.28 * EMU) }, verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(-0.16 * EMU) }, wrap: { type: TextWrappingType.NONE }, allowOverlap: true, behindDocument: true } }));
        if (name) k.push(new ImageRun({ type: 'jpg', data: name, transformation: { width: Math.round(3.0 * 96), height: Math.round(0.434 * 96) } }));
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 230, after: 0 }, children: k }));
      } else if (it.k === 'bl') out.push(P('', { keep: it.keep }));
      else if (it.k === 'aapsi') out.push(aapsi(it.rows));
      else if (it.k === 'sign') out.push(sign());
      else if (/^Note:\t/.test(it.t || '')) out.push(new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 720 }], children: [R(it.t, { size: it.size })] }));
      else out.push(P(it.t, it));
    });
    return out;
  };
  const docs = which ? d.docs.filter((x) => x.key === which) : d.docs;
  const doc = new Document({ creator: 'Annual Audit Report System', title: 'BAAR Transmittal Letters', styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: docs.map((x) => ({ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 2160, header: 720, footer: 720 } } }, children: kids(x) })) });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = d.fileName + (which ? '_' + which.toUpperCase() : '') + '.docx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
