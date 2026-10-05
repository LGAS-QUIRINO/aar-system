// Consolidated SAOR (Barangays of one municipality, one Audit Year), built from Final AOMs and the AOM Library.
import { loadScript } from './wp.js';
import { ST, SECTIONS, fillText, blockPlain, letterOf } from './aom.js';
import { aomNo } from './format.js';

const MONEY = /AMOUNT|BALANCE|COST|VALUE|TOTAL|BUDGET|UTILIZED|TAX|RECEIVABLE|APPROPRIATION|FUND/i;
const peso = (n) => '₱' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The AOM's amount: the first money placeholder in its topic sentence, read from the working paper.
export function aomAmount(d) {
  const topic = (d.blocks || []).find((b) => b.type === 'topic');
  const vars = (d.wpData && d.wpData.vars) || {};
  const names = [...String((topic && topic.text) || '').matchAll(/\[([A-Z0-9_]+)\]/g)].map((m) => m[1]).filter((n) => MONEY.test(n) && !/YEAR|DAYS|NO_OF|COUNT|RATE|PERCENT/.test(n));
  for (const n of names) {
    const raw = vars[n] && vars[n].raw;
    const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[₱,\s]/g, ''));
    if (raw !== undefined && raw !== '' && !isNaN(num)) return num;
  }
  return null;
}
export { peso };

// The rejoinder as printed: the text, "None" when "No Rejoinder" was ticked, or blank when not decided yet.
export const rejoinderText = (m) => (!m ? '' : m.noRejoinder ? 'None' : (m.rejoinder || '').trim());

// Recommendation of an AOM or template as plain text with a., b., c.
export function recText(blocks) {
  const r = (blocks || []).find((b) => b.type === 'recommendation');
  if (!r) return '';
  return (r.items || []).length ? [r.lead || 'We recommend that Management:', ...r.items.map((it, i) => `${letterOf(i)}. ${it}`)].join('\n') : (r.text || '');
}

/**
 * Build the SAOR.
 * input: { audits [{ rec, lgu (name), vars(aom) }], aoms (records), templates { code: activeTemplateData }, overrides { key: { obs, rec } } }
 * Returns { sections: [{ code, title, obs: [{ key, n, obs, rec, edited, lines: [...], total, money }] }], coverage, notFinal }
 */
export function buildSaor(input) {
  const { audits, aoms, templates, overrides = {} } = input;
  const byAudit = Object.fromEntries(audits.map((x) => [x.rec.id, x]));
  const finals = [], notFinal = [];
  aoms.forEach((a) => { const au = byAudit[a.data.auditId]; if (!au) return; (a.data.status === ST.FINAL ? finals : notFinal).push({ a, au }); });
  const groups = {};
  finals.forEach(({ a, au }) => {
    const key = a.data.poolCode ? 'T:' + a.data.poolCode : 'A:' + a.id;
    (groups[key] = groups[key] || { key, code: a.data.poolCode || '', items: [] }).items.push({ a, au });
  });
  const codeNum = (c) => Number((/(\d+)/.exec(c || '') || [])[1] || 9999);
  const list = Object.values(groups).map((g) => {
    const first = g.items[0].a.data;
    const tpl = g.code ? templates[g.code] : null;
    const section = first.section || (tpl && tpl.section) || 'B';
    const vars0 = g.items[0].au.vars(g.items[0].a);
    // Only one barangay has this finding: one row, its own AOM wording, with "Barangay X:" in front (approved Option A).
    const single = g.items.length === 1;
    const ownObs = fillText(blockPlain((first.blocks || []).find((b) => b.type === 'topic') || {}), vars0);
    const ownRec = fillText(recText(first.blocks), vars0);
    const libObs = single ? ownObs : tpl && (tpl.saor || '').trim() ? tpl.saor.trim() : ownObs;
    const libRec = single ? ownRec : tpl ? ((tpl.saorRec || '').trim() || recText(tpl.blocks)) : ownRec;
    const key = g.key + (single ? '#1' : '');
    const ov = overrides[key] || {};
    const lines = g.items.map(({ a, au }) => {
      const amt = aomAmount(a.data);
      const m = a.data.mgmt || null;
      return { aomId: a.id, auditId: au.rec.id, brgy: au.lgu, ref: 'AOM No. ' + aomNo(au.rec.data.auditYear, a.data.number || 0, au.rec.data.periodFrom, au.rec.data.periodTo),
        amount: amt, comment: m && (m.comment || '').trim() ? m.comment.trim() : '', rejoinder: rejoinderText(m && (m.comment || '').trim() ? m : null) };
    }).sort((x, y) => x.brgy.localeCompare(y.brgy, 'en') || x.ref.localeCompare(y.ref));
    const money = lines.some((l) => l.amount !== null);
    const total = money ? lines.reduce((s, l) => s + (l.amount || 0), 0) : null;
    return { key, single, code: g.code, section, order: g.code ? codeNum(g.code) : 10000, title: (tpl && tpl.title) || first.title,
      obs: ov.obs !== undefined ? ov.obs : libObs, rec: ov.rec !== undefined ? ov.rec : libRec, libObs, libRec, edited: ov.obs !== undefined || ov.rec !== undefined, lines, money, total };
  }).sort((x, y) => x.section.localeCompare(y.section) || x.order - y.order || x.title.localeCompare(y.title));
  let n = 0;
  list.forEach((o) => { o.n = ++n; });
  const sections = Object.keys(SECTIONS).map((code) => ({ code, title: SECTIONS[code].replace(/^[AB] · /, ''), obs: list.filter((o) => o.section === code) })).filter((s) => s.obs.length);
  const lines = list.flatMap((o) => o.lines);
  return { sections, obsCount: list.length, lineCount: lines.length, received: lines.filter((l) => l.comment).length, awaiting: lines.filter((l) => !l.comment).length,
    barangays: new Set(lines.map((l) => l.auditId)).size, notFinal: notFinal.map(({ a, au }) => ({ brgy: au.lgu, title: a.data.title })) };
}

/* ── Print View and printout ── */
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const br = (s) => escH(s).replace(/\n/g, '<br>');
export const SAOR_CSS = `
.saor-doc{font-family:'Times New Roman',Tinos,Times,serif;font-size:10.5pt;line-height:1.2;color:#000;position:relative}
.saor-doc p{margin:0}.saor-doc .c{text-align:center}.saor-doc .b{font-weight:700}
.saor-doc .lh2{position:relative;text-align:center;line-height:0;margin-top:.16in}
.saor-doc .lh2 .seal{position:absolute;mix-blend-mode:multiply;left:calc(50% - 2.72in);top:-.16in;width:1.1in;height:1.1in}
.saor-doc .lh2 ~ p{position:relative;z-index:1}
.saor-doc .rule{border-bottom:3px solid #000;padding-bottom:3pt;position:relative;margin-top:6pt}
.saor-doc .rule::after{content:'';position:absolute;left:0;right:0;bottom:-5px;border-bottom:1px solid #000}
.saor-t{border-collapse:collapse;width:100%;margin-top:10pt;table-layout:fixed}
.saor-t th,.saor-t td{border:1px solid #000;padding:.06in .08in;vertical-align:top;text-align:left}
.saor-t th{text-align:center;font-weight:700;border-bottom:2px solid #000}
.saor-t tr.in td{border-top:1px dotted #555;border-bottom:1px dotted #555}
.saor-t tr.in td.rec,.saor-t td.rec{border-top:1px solid #000}
.saor-t tr.o1.multi td:not(.rec){border-bottom:1px dotted #555}
.saor-t td.ref{white-space:normal}
.saor-t td.no{text-align:center;font-weight:700}
.saor-t td.j{text-align:justify}
.saor-t td p{margin:0 0 4pt}.saor-t td p:last-child{margin-bottom:0}
.saor-t td.ref p{margin:0}
.saor-t td p.li{padding-left:.25in;text-indent:-.25in}
.saor-t td p.li .lt{display:inline-block;width:.25in;text-indent:0}
.saor-t tr.sec td{font-weight:700;background:#F2F2F2}
.saor-t tr.tot td{font-weight:700}
.saor-t .amt{float:right;padding-left:6pt}
.saor-t tr.tot .amt{border-top:1px solid #000;border-bottom:3px double #000;line-height:1.3}
.saor-wm{position:absolute;top:38%;left:0;right:0;text-align:center;font:700 90pt Arial,sans-serif;color:rgba(0,0,0,.06);transform:rotate(-20deg);pointer-events:none}
`;
// Cell text: paragraphs with a small space between them; a./b./c. items get a hanging indent.
const paras = (t, lead = '') => String(t || '').split('\n').filter((x) => x.trim() !== '').map((x, i) => {
  const m = /^([a-z]|\d+)\.\s+(.*)$/.exec(x);
  const pre = i === 0 ? lead : '';
  return m ? `<p class="li">${pre}<span class="lt">${escH(m[1])}.</span>${escH(m[2])}</p>` : `<p>${pre}${escH(x)}</p>`;
}).join('') || (lead ? `<p>${lead}</p>` : '');
// AOM No. on two lines: "AOM No. 2026-001" / "(2024-2025)".
const refSplit = (r) => { const m = /^(.*?)\s*(\(.*\))$/.exec(String(r || '')); return m ? [m[1], m[2]] : [String(r || '')]; };
// ₱ only on the first amount of an observation and on its Total.
const firstAmt = (o) => o.lines.findIndex((l) => l.amount !== null);
const amtTxt = (n, sign) => sign ? peso(n) : peso(n).slice(1);
const refHTML = (r) => refSplit(r).map((x) => `<p>${escH(x)}</p>`).join('');
export function saorHTML(m, head) {
  const one = (o) => { const l = o.lines[0]; return `<tr><td class="no">${o.n}.</td><td class="ref">${refHTML(l.ref)}</td><td class="j">${paras(o.obs, `<b>Barangay ${escH(l.brgy)}:</b> `)}</td><td class="j">${paras(o.rec)}</td><td class="j">${paras(l.comment)}</td><td class="j">${paras(l.rejoinder)}</td></tr>`; };
  const rows = m.sections.map((s) => `<tr class="sec"><td colspan="6">${escH(s.code)}. ${escH(s.title.toUpperCase())}</td></tr>` + s.obs.map((o) => o.single ? one(o) : `
    <tr class="o1 multi"><td class="no">${o.n}.</td><td></td><td class="j">${paras(o.obs)}</td><td class="j rec" rowspan="${1 + o.lines.length + (o.money ? 1 : 0)}">${paras(o.rec)}</td><td></td><td></td></tr>
    ${o.lines.map((l, i) => `<tr class="in"><td></td><td class="ref">${refHTML(l.ref)}</td><td>${escH(l.brgy)}${l.amount !== null ? `<span class="amt">${escH(amtTxt(l.amount, firstAmt(o) === i))}</span>` : ''}</td><td class="j">${paras(l.comment)}</td><td class="j">${paras(l.rejoinder)}</td></tr>`).join('')}
    ${o.money ? `<tr class="tot in"><td></td><td></td><td>Total · ${o.lines.length} Barangay${o.lines.length > 1 ? 's' : ''}<span class="amt">${escH(peso(o.total))}</span></td><td></td><td></td></tr>` : ''}`).join('')).join('');
  return `<div class="saor-doc"><div class="saor-wm">CONFIDENTIAL</div>
    <div class="lh2"><img class="seal" src="img/lh-seal.jpg" alt="Commission on Audit seal"><img class="name" src="img/lh-name.jpg" alt="Republic of the Philippines, Commission on Audit" style="width:3in;height:.434in"></div>
    <p class="c b">REGIONAL OFFICE NO. II</p><p class="c">PROVINCE OF QUIRINO</p><p class="c">PROVINCIAL SATELLITE AUDITING OFFICE</p><p class="c" style="font-size:9pt">Capitol Hills, Cabarroguis, Quirino</p>
    <p class="c b rule">Office of the Auditor – Audit Team ${escH(head.officeCode || '')}</p>
    <p class="c b" style="margin-top:12pt;text-decoration:underline">SUMMARY OF AUDIT OBSERVATIONS AND RECOMMENDATIONS</p>
    <p class="c" style="font-style:italic">Barangays of ${escH(head.mun)}, Quirino</p><p class="c" style="font-style:italic">For Audit Year ${escH(head.year)}</p>
    <table class="saor-t"><colgroup><col style="width:4%"><col style="width:13%"><col style="width:27%"><col style="width:22.6%"><col style="width:17.8%"><col style="width:15.6%"></colgroup>
      <thead><tr><th>No.</th><th>Reference No.</th><th>Observations</th><th>Recommendations</th><th>Management Comments</th><th>Auditor's Rejoinder</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:16pt">No Final AOMs yet.</td></tr>'}</tbody></table></div>`;
}
export function printSaor(m, head) {
  const css = `${SAOR_CSS}
    @page{size:13in 8.5in;margin:.75in .75in .8in .75in;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9pt 'Times New Roman'}}
    body{margin:0}.saor-wm{position:fixed;top:40%}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>SAOR · ${escH(head.mun)} · Audit Year ${escH(head.year)}</title><base href="${location.href.split('#')[0]}"><style>${css}</style></head><body>${saorHTML(m, head)}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  const img = f.contentDocument.querySelector('img');
  if (img && !img.complete) img.onload = img.onerror = go; else setTimeout(go, 200);
}

/* ── Word (folio landscape) ── */
export async function saorWord(m, head) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, VerticalMergeType, AlignmentType, Footer, Header, PageNumber, PageOrientation, BorderStyle, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, ShadingType } = D;
  const FONT = 'Times New Roman', EMU = 914400;
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const seal = await load('img/lh-seal.jpg'), name = await load('img/lh-name.jpg');
  const R = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 21, bold: !!o.b, italics: !!o.i, underline: o.u ? {} : undefined });
  const C = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [R(t, o)], border: o.rule ? { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 24, color: '000000', space: 4 } } : undefined });
  // Justified cell text, a small space between paragraphs, hanging indent for a./b./c.
  const GAP = 80, IND = 360;
  const lines = (t, lead = []) => { const ps = String(t || '').split('\n').filter((x) => x.trim() !== '');
    if (!ps.length) return lead.length ? [new Paragraph({ spacing: { after: 0 }, children: lead })] : [];
    return ps.map((x, i) => { const mm = /^([a-z]|\d+)\.\s+(.*)$/.exec(x);
      return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: i === ps.length - 1 ? 0 : GAP }, indent: mm ? { left: IND, hanging: IND } : undefined,
        tabStops: mm ? [{ type: 'left', position: IND }] : undefined, children: [...(i === 0 ? lead : []), ...(mm ? [R(mm[1] + '.\t'), R(mm[2])] : [R(x)])] }); }); };
  const refP = (r) => refSplit(r).map((x) => new Paragraph({ spacing: { after: 0 }, children: [R(x)] }));
  const noP = (n) => [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [R(n + '.', { b: true })] })];
  const W = [650, 2160, 4500, 3750, 2950, 2550];   // 16560 twips: 13" folio landscape less .75" margins
  const DOT = { style: BorderStyle.DOTTED, size: 4, color: '555555' }, SOL = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const cell = (kids, i, o = {}) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, children: kids.length ? kids : [new Paragraph({ children: [] })], columnSpan: o.span, verticalMerge: o.vm, borders: o.bd, shading: o.shade ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined });
  const amtPara = (brgy, amt, b, sign = true) => new Paragraph({ spacing: { after: 0 }, tabStops: [{ type: 'right', position: W[2] - 240 }], children: [R(brgy, { b }), ...(amt !== null ? [new TextRun({ text: '\t' }), new TextRun({ text: amtTxt(amt, sign), font: FONT, size: 21, bold: !!b, underline: b ? { type: 'double' } : undefined })] : [])] });
  const rows = [new TableRow({ tableHeader: true, cantSplit: true, children: ['No.', 'Reference No.', 'Observations', 'Recommendations', 'Management Comments', "Auditor's Rejoinder"].map((h, i) => cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [R(h, { b: true })] })], i, { bd: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' } } })) })];
  m.sections.forEach((s) => {
    rows.push(new TableRow({ cantSplit: true, children: [new TableCell({ columnSpan: 6, shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' }, children: [new Paragraph({ children: [R(`${s.code}. ${s.title.toUpperCase()}`, { b: true })] })] })] }));
    s.obs.forEach((o) => {
      if (o.single) {
        const l = o.lines[0];
        rows.push(new TableRow({ children: [cell(noP(o.n), 0), cell(refP(l.ref), 1), cell(lines(o.obs, [R(`Barangay ${l.brgy}: `, { b: true })]), 2),
          cell(lines(o.rec), 3), cell(lines(l.comment), 4), cell(lines(l.rejoinder), 5)] }));
        return;
      }
      const fa = firstAmt(o), top = { top: DOT }, bot = { bottom: DOT }, both = { top: DOT, bottom: DOT };
      const last = o.lines.length - 1 + (o.money ? 1 : 0);   // index of the group's last inner row
      const bd = (k) => k === last ? top : both;
      const cont = (k) => cell([], 3, { vm: VerticalMergeType.CONTINUE, bd: { top: SOL } });
      rows.push(new TableRow({ children: [cell(noP(o.n), 0, { bd: bot }), cell([], 1, { bd: bot }), cell(lines(o.obs), 2, { bd: bot }), cell(lines(o.rec), 3, { vm: VerticalMergeType.RESTART }), cell([], 4, { bd: bot }), cell([], 5, { bd: bot })] }));
      o.lines.forEach((l, k) => rows.push(new TableRow({ cantSplit: true, children: [cell([], 0, { bd: bd(k) }), cell(refP(l.ref), 1, { bd: bd(k) }), cell([amtPara(l.brgy, l.amount, false, fa === k)], 2, { bd: bd(k) }), cont(k), cell(lines(l.comment), 4, { bd: bd(k) }), cell(lines(l.rejoinder), 5, { bd: bd(k) })] })));
      if (o.money) { const k = last; rows.push(new TableRow({ cantSplit: true, children: [cell([], 0, { bd: bd(k) }), cell([], 1, { bd: bd(k) }), cell([amtPara(`Total · ${o.lines.length} Barangay${o.lines.length > 1 ? 's' : ''}`, o.total, true)], 2, { bd: bd(k) }), cont(k), cell([], 4, { bd: bd(k) }), cell([], 5, { bd: bd(k) })] })); }
    });
  });
  const lh = [];
  if (seal) lh.push(new ImageRun({ type: 'jpg', data: seal, transformation: { width: Math.round(1.1 * 96), height: Math.round(1.1 * 96) }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: Math.round(3.03 * EMU) }, verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(-0.16 * EMU) }, wrap: { type: TextWrappingType.NONE }, allowOverlap: true, behindDocument: true } }));
  if (name) lh.push(new ImageRun({ type: 'jpg', data: name, transformation: { width: Math.round(3.0 * 96), height: Math.round(0.434 * 96) } }));
  const children = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 230, after: 0 }, children: lh }),
    C('REGIONAL OFFICE NO. II', { b: true }), C('PROVINCE OF QUIRINO'), C('PROVINCIAL SATELLITE AUDITING OFFICE'), C('Capitol Hills, Cabarroguis, Quirino', { size: 18 }),
    C(''), C('Office of the Auditor – Audit Team ' + (head.officeCode || ''), { b: true, rule: true }), C(''),
    C('SUMMARY OF AUDIT OBSERVATIONS AND RECOMMENDATIONS', { b: true, u: true }), C(`Barangays of ${head.mun}, Quirino`, { i: true }), C(`For Audit Year ${head.year}`, { i: true }), C(''),
    new Table({ width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, margins: { top: 80, bottom: 80, left: 115, right: 115 }, rows })];
  const doc = new Document({ creator: 'Annual Audit Report System', title: 'SAOR', styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 18720, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 500, footer: 500 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'CONFIDENTIAL', bold: true, color: 'A0A0A0', font: FONT, size: 20 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 18 })] })] }) },
      children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${String(head.mun).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_SAOR_Audit_Year_${head.year}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
