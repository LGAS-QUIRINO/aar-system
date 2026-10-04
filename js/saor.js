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
.saor-doc .lh2{position:relative;text-align:center;line-height:0;margin-top:.1in}
.saor-doc .lh2 .seal{position:absolute;mix-blend-mode:multiply}
.saor-doc .rule{border-bottom:3px solid #000;padding-bottom:3pt;position:relative;margin-top:6pt}
.saor-doc .rule::after{content:'';position:absolute;left:0;right:0;bottom:-5px;border-bottom:1px solid #000}
.saor-t{border-collapse:collapse;width:100%;margin-top:10pt;table-layout:fixed}
.saor-t th,.saor-t td{border:1px solid #000;padding:3pt 5pt;vertical-align:top;text-align:left}
.saor-t th{text-align:center;font-weight:700}
.saor-t td.ref{white-space:normal}
.saor-t tr.sec td{font-weight:700;background:#F2F2F2}
.saor-t tr.tot td{font-weight:700}
.saor-t .amt{float:right;padding-left:6pt}
.saor-wm{position:absolute;top:38%;left:0;right:0;text-align:center;font:700 90pt Arial,sans-serif;color:rgba(0,0,0,.06);transform:rotate(-20deg);pointer-events:none}
`;
export function saorHTML(m, head) {
  const one = (o) => { const l = o.lines[0]; return `<tr><td class="ref">${escH(l.ref)}</td><td><b>${o.n}.</b> <b>Barangay ${escH(l.brgy)}:</b> ${br(o.obs)}</td><td>${br(o.rec)}</td><td>${br(l.comment)}</td><td>${br(l.rejoinder)}</td></tr>`; };
  const rows = m.sections.map((s) => `<tr class="sec"><td colspan="5">${escH(s.code)}. ${escH(s.title.toUpperCase())}</td></tr>` + s.obs.map((o) => o.single ? one(o) : `
    <tr><td></td><td><b>${o.n}.</b> ${br(o.obs)}</td><td>${br(o.rec)}</td><td></td><td></td></tr>
    ${o.lines.map((l) => `<tr><td class="ref">${escH(l.ref)}</td><td>${escH(l.brgy)}${l.amount !== null ? `<span class="amt">${escH(peso(l.amount))}</span>` : ''}</td><td></td><td>${br(l.comment)}</td><td>${br(l.rejoinder)}</td></tr>`).join('')}
    ${o.money ? `<tr class="tot"><td></td><td>Total · ${o.lines.length} Barangay${o.lines.length > 1 ? 's' : ''}<span class="amt">${escH(peso(o.total))}</span></td><td></td><td></td><td></td></tr>` : ''}`).join('')).join('');
  return `<div class="saor-doc"><div class="saor-wm">CONFIDENTIAL</div>
    <div class="lh2"><img class="seal" src="img/lh-seal.jpg" alt="Commission on Audit seal" style="width:1in;height:1in;left:${head.sealLeft || 3.05}in;top:-.14in"><img class="name" src="img/lh-name.jpg" alt="Republic of the Philippines, Commission on Audit" style="width:2.8in;height:.405in"></div>
    <p class="c b">REGIONAL OFFICE NO. II</p><p class="c">PROVINCE OF QUIRINO</p><p class="c">PROVINCIAL SATELLITE AUDITING OFFICE</p><p class="c" style="font-size:9pt">Capitol Hills, Cabarroguis, Quirino</p>
    <p class="c b rule">Office of the Auditor – Audit Team ${escH(head.officeCode || '')}</p>
    <p class="c b" style="margin-top:12pt;text-decoration:underline">SUMMARY OF AUDIT OBSERVATIONS AND RECOMMENDATIONS</p>
    <p class="c" style="font-style:italic">Barangays of ${escH(head.mun)}, Quirino</p><p class="c" style="font-style:italic">For Audit Year ${escH(head.year)}</p>
    <table class="saor-t"><colgroup><col style="width:15%"><col style="width:29%"><col style="width:24%"><col style="width:18%"><col style="width:14%"></colgroup>
      <thead><tr><th>Reference No.</th><th>Observations</th><th>Recommendations</th><th>Management Comments</th><th>Auditor's Rejoinder</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:16pt">No Final AOMs yet.</td></tr>'}</tbody></table></div>`;
}
export function printSaor(m, head) {
  const css = `${SAOR_CSS}
    @page{size:13in 8.5in;margin:.75in .75in .8in .75in;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9pt 'Times New Roman'}}
    body{margin:0}.saor-wm{position:fixed;top:40%}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>SAOR · ${escH(head.mun)} · Audit Year ${escH(head.year)}</title><base href="${location.href.split('#')[0]}"><style>${css}</style></head><body>${saorHTML(m, { ...head, sealLeft: 3.95 })}</body></html>`;
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
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, Header, PageNumber, PageOrientation, BorderStyle, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, ShadingType } = D;
  const FONT = 'Times New Roman', EMU = 914400;
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const seal = await load('img/lh-seal.jpg'), name = await load('img/lh-name.jpg');
  const R = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 21, bold: !!o.b, italics: !!o.i, underline: o.u ? {} : undefined });
  const C = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [R(t, o)], border: o.rule ? { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 24, color: '000000', space: 4 } } : undefined });
  const lines = (t, o = {}) => String(t || '').split('\n').map((x) => new Paragraph({ spacing: { after: 0 }, alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [R(x, o)] }));
  const W = [2484, 4802, 3974, 2981, 2319];   // 16560 twips: 13" folio landscape less .75" margins, split 15/29/24/18/14%
  const cell = (kids, i, o = {}) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, children: kids.length ? kids : [new Paragraph({ children: [] })], columnSpan: o.span, shading: o.shade ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined });
  const amtPara = (brgy, amt, b) => new Paragraph({ spacing: { after: 0 }, tabStops: [{ type: 'right', position: W[1] - 200 }], children: [R(brgy, { b }), ...(amt !== null ? [new TextRun({ text: '\t' + peso(amt), font: FONT, size: 21, bold: !!b })] : [])] });
  const rows = [new TableRow({ tableHeader: true, children: ['Reference No.', 'Observations', 'Recommendations', 'Management Comments', "Auditor's Rejoinder"].map((h, i) => cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [R(h, { b: true })] })], i)) })];
  m.sections.forEach((s) => {
    rows.push(new TableRow({ children: [new TableCell({ columnSpan: 5, shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' }, children: [new Paragraph({ children: [R(`${s.code}. ${s.title.toUpperCase()}`, { b: true })] })] })] }));
    s.obs.forEach((o) => {
      if (o.single) {
        const l = o.lines[0];
        rows.push(new TableRow({ children: [cell([new Paragraph({ children: [R(l.ref)] })], 0),
          cell([new Paragraph({ spacing: { after: 0 }, children: [R(o.n + '. ', { b: true }), R(`Barangay ${l.brgy}: `, { b: true }), R(o.obs.split('\n')[0])] }), ...lines(o.obs.split('\n').slice(1).join('\n'))], 1),
          cell(lines(o.rec), 2), cell(l.comment ? lines(l.comment) : [], 3), cell(l.rejoinder ? lines(l.rejoinder) : [], 4)] }));
        return;
      }
      rows.push(new TableRow({ children: [cell([], 0), cell([new Paragraph({ spacing: { after: 0 }, children: [R(o.n + '. ', { b: true }), R(o.obs.split('\n')[0])] }), ...lines(o.obs.split('\n').slice(1).join('\n'))].filter(Boolean), 1), cell(lines(o.rec), 2), cell([], 3), cell([], 4)] }));
      o.lines.forEach((l) => rows.push(new TableRow({ children: [cell([new Paragraph({ children: [R(l.ref)] })], 0), cell([amtPara(l.brgy, l.amount)], 1), cell([], 2), cell(l.comment ? lines(l.comment) : [], 3), cell(l.rejoinder ? lines(l.rejoinder) : [], 4)] })));
      if (o.money) rows.push(new TableRow({ children: [cell([], 0), cell([amtPara(`Total · ${o.lines.length} Barangay${o.lines.length > 1 ? 's' : ''}`, o.total, true)], 1), cell([], 2), cell([], 3), cell([], 4)] }));
    });
  });
  const lh = [];
  if (seal) lh.push(new ImageRun({ type: 'jpg', data: seal, transformation: { width: 96, height: 96 }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: Math.round(3.6 * EMU) }, verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(-0.14 * EMU) }, wrap: { type: TextWrappingType.NONE }, allowOverlap: true, behindDocument: true } }));
  if (name) lh.push(new ImageRun({ type: 'jpg', data: name, transformation: { width: Math.round(2.8 * 96), height: Math.round(0.405 * 96) } }));
  const children = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 0 }, children: lh }),
    C('REGIONAL OFFICE NO. II', { b: true }), C('PROVINCE OF QUIRINO'), C('PROVINCIAL SATELLITE AUDITING OFFICE'), C('Capitol Hills, Cabarroguis, Quirino', { size: 18 }),
    C(''), C('Office of the Auditor – Audit Team ' + (head.officeCode || ''), { b: true, rule: true }), C(''),
    C('SUMMARY OF AUDIT OBSERVATIONS AND RECOMMENDATIONS', { b: true, u: true }), C(`Barangays of ${head.mun}, Quirino`, { i: true }), C(`For Audit Year ${head.year}`, { i: true }), C(''),
    new Table({ width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, rows })];
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
