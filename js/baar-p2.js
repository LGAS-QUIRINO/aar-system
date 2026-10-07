// BAAR Part 08 · Part II – Observations and Recommendations, in the form of the issued Balligui BAAR:
// a "PART II – OBSERVATIONS AND RECOMMENDATIONS" page, then OBSERVATIONS AND RECOMMENDATIONS with two sections,
// A. FINANCIAL AUDIT and B. OTHER FINANCIAL RELATED ISSUES. Each Final AOM: its title in italics with the amount,
// the observation numbered 1., 2., … (bold), its paragraphs numbered 2.1, 2.2, …, the recommendation with a., b.,
// then Management's Comment/s and, when there is one, the Auditor's Rejoinder. Times New Roman 12, Letter size.
import { loadScript } from './wp.js';
import { ST, findingParas, fillText, paraHTML, DOC_CSS } from './aom.js';
import { aomAmount, titleAmount, titleHasAmount, topicVars } from './aom.js';
import { IAR_CSS } from './baar-iar.js';

const P = (runs, o = {}) => ({ kind: 'p', runs: typeof runs === 'string' ? [{ t: runs }] : runs, ...o });
const BL = () => ({ kind: 'p', runs: [], blank: true });
export const P2_SECTIONS = [['A', 'FINANCIAL AUDIT'], ['B', 'OTHER FINANCIAL RELATED ISSUES']];

export { titleAmount } from './aom.js';

// Paragraph indents (twips): the observation number at the margin, text at 0.35"; paragraphs numbered at 0.25", text at 0.75".
const TOPIC = { left: 504, hanging: 504 }, BODY = { left: 1080, hanging: 576 }, SUBB = { left: 1440, hanging: 576 };

// The Final AOMs in Part II order: Section A then B, each by AOM number.
export function p2List(ctx) {
  const finals = ctx.aoms.filter((a) => a.data.status === ST.FINAL);
  const by = (s) => finals.filter((a) => (a.data.section || 'B') === s).sort((a, b) => ctx.nums[a.id].n - ctx.nums[b.id].n);
  return { A: by('A'), B: by('B'), notFinal: ctx.aoms.filter((a) => a.data.status !== ST.FINAL) };
}

/** Part II as paragraphs: { paras, checks, count }. */
export function buildP2(ctx) {
  const L = p2List(ctx);
  const paras = [P('OBSERVATIONS AND RECOMMENDATIONS', { bold: true, align: 'center', keep: true }), BL()];
  let k = 0;
  const checks = [];
  P2_SECTIONS.forEach(([s, name]) => {
    const list = L[s];
    if (!list.length) return;
    paras.push(P([{ t: `${s}.` }, { t: '\t' }, { t: name }], { bold: true, sec: true, keep: true, ind: TOPIC }), BL());
    list.forEach((a) => {
      k++;
      const vars = ctx.varsFor(a);
      const amt = aomAmount(a.data);
      const title = fillText(a.data.title || '', topicVars(vars)) + (amt !== null && amt !== undefined && a.data.titleShow !== false && !titleHasAmount(a.data.title) ? ` - ${titleAmount(amt)}` : '');
      paras.push(P(title, { italic: true, keep: true }), BL());
      // The AOM's own paragraphs, without its "AOM No." and title lines, numbered as in Balligui.
      const body = findingParas(a.data, { vars, num: `${k}.` }).slice(4);   // without the AOM No., its blank line, the title and the blank line after it
      let j = 0;
      body.forEach((p) => {
        if (p.kind !== 'p' || p.blank) { paras.push(p); return; }
        const ind = p.ind || {};
        if (p.label === `${k}.`) { paras.push({ ...p, ind: TOPIC, keep: true }); return; }
        if (p.label || p.italic) { paras.push(p); return; }   // a., b. items, a) sub-headings and quoted provisions stay as in the AOM
        j++;
        paras.push({ ...p, label: `${k}.${j}`, ind: ind.left > 1000 && ind.left < 1600 && ind.left !== 993 ? SUBB : BODY, keep: !!p.bold });
      });
      paras.push(BL());
      const m = a.data.mgmt || {};
      paras.push(P("Management's Comment/s:", { bold: true, keep: true, ind: { left: BODY.left - BODY.hanging } }), BL());
      const cm = String(m.comment || '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (cm.length) cm.forEach((x, i) => { j++; paras.push(P(x, { align: 'both', label: `${k}.${j}`, ind: BODY })); if (i < cm.length - 1) paras.push(BL()); });
      else { paras.push(P([{ t: '[Not yet received]', missing: 'COMMENT' }], { ind: BODY })); checks.push({ st: 'warn', t: `${k}. ${fillText(a.data.title || '', vars)}: management's comment not yet entered` }); }
      const rj = String(m.rejoinder || '').trim();
      if (!m.noRejoinder && rj) {
        paras.push(BL(), P("Auditor's Rejoinder:", { bold: true, keep: true, ind: { left: BODY.left - BODY.hanging } }), BL());
        rj.split('\n').map((x) => x.trim()).filter(Boolean).forEach((x, i, arr) => { j++; paras.push(P(x, { align: 'both', label: `${k}.${j}`, ind: BODY })); if (i < arr.length - 1) paras.push(BL()); });
      } else if (cm.length && !m.noRejoinder) checks.push({ st: 'warn', t: `${k}. ${fillText(a.data.title || '', vars)}: rejoinder not yet decided` });
      paras.push(BL(), BL());
    });
  });
  if (!k) checks.unshift({ st: 'wait', t: 'Runs once the AOMs are Final' });
  else {
    checks.unshift({ st: 'ok', t: `${k} Final AOM${k > 1 ? 's' : ''}: ${L.A.length} under A. Financial Audit, ${L.B.length} under B. Other Financial Related Issues` });
    if (L.notFinal.length) checks.push({ st: 'warn', t: `${L.notFinal.length} AOM${L.notFinal.length > 1 ? 's are' : ' is'} not yet Final and not included` });
    if (!checks.some((c) => c.st === 'warn')) checks.push({ st: 'ok', t: 'Every observation has its management comment and rejoinder decision' });
  }
  return { paras, checks, count: k, list: L };
}

/* ── Pages ── */
export const P2_CSS = `${DOC_CSS}${IAR_CSS}
.p2 p{margin:0}
.p2 .lbl{font-weight:inherit}
`;
// Splits Part II into Letter pages (9" of text each), keeping a heading with what follows.
export function paginateP2(paras, box) {
  box.innerHTML = '';
  box.className = 'aom-doc p2';
  box.style.cssText = 'position:absolute;left:-9999px;top:0;width:6in;visibility:hidden';
  const hs = paras.map((p) => { const w = document.createElement('div'); w.innerHTML = paraHTML(p, false); box.appendChild(w); return w.offsetHeight; });
  const pages = [[]]; let h = 0; const max = 9 * 96;
  const runH = (i) => { let s = 0, j = i; while (j < paras.length) { s += hs[j]; if (!paras[j].keep && !paras[j].blank) break; j++; } return s; };
  paras.forEach((p, i) => {
    const prev = paras[i - 1], inRun = i > 0 && prev && (prev.keep || (prev.blank && paras[i - 2] && paras[i - 2].keep));
    const need = inRun ? hs[i] : p.keep ? runH(i) : hs[i];
    if (h + need > max && pages[pages.length - 1].length && !inRun) { pages.push([]); h = 0; }
    if (h === 0 && p.blank && pages.length > 1) return;
    pages[pages.length - 1].push(p); h += hs[i];
  });
  box.innerHTML = '';
  return pages;
}
export function p2PagesHTML(pages, start, mark = false) {
  const div = `<div class="bpage"><div class="p1"><div>PART II – OBSERVATIONS AND</div><div style="margin-top:-.3in">RECOMMENDATIONS</div></div></div>`;
  return [div, ...pages.map((ps, i) => `<div class="bpage"><div class="aom-doc p2">${ps.map((p) => paraHTML(p, mark)).join('')}</div>${start ? `<div class="pno">${start + i}</div>` : ''}</div>`)];
}
export function p2Print(pages, start) {
  return { css: `${P2_CSS} @page p2 { size: 8.5in 11in; margin: 0; } .pg-p2 { page: p2; }`, html: p2PagesHTML(pages, start).map((x) => `<div class="pg pg-p2">${x}</div>`).join('') };
}
export const p2FileName = (audit, lgu, mun) => `${String(lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_${String(mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_08_Part_II_Observations_and_Recommendations`;

/* ── Word: the Part II page, then the observations with page numbers ── */
export async function p2Sections(doc, start) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, PageNumber, Tab } = D;
  const F = 'Times New Roman';
  const isNum = (s) => /^\(?-?₱?\s*-?[\d,]+(\.\d+)?%?\)?$/.test(String(s).trim());
  const al = (a) => ({ both: AlignmentType.JUSTIFIED, center: AlignmentType.CENTER, right: AlignmentType.RIGHT }[a] || AlignmentType.LEFT);
  const run = (r, p) => (r.t === '\t' ? new TextRun({ children: [new Tab()], font: F, size: 24 }) : new TextRun({ text: r.t, bold: !!(p.bold || r.b), italics: !!p.italic, font: F, size: 24 }));
  const para = (p) => {
    if (p.blank) return new Paragraph({ children: [new TextRun({ text: '', font: F, size: 24 })] });
    const kids = [];
    if (p.label) kids.push(new TextRun({ text: p.label, bold: !!p.bold, italics: !!p.italic, font: F, size: 24 }), new TextRun({ children: [new Tab()], font: F }));
    (p.runs || []).forEach((r) => { if (!r.missing) kids.push(run(r, p)); });
    const ind = p.ind || {};
    return new Paragraph({ children: kids, keepNext: !!p.keep, alignment: al(p.align), indent: { left: ind.left || 0, right: ind.right || 0, hanging: ind.hanging || undefined }, spacing: { after: 0, line: 240 } });
  };
  const cellP = (t, o = {}) => new Paragraph({ alignment: o.al || AlignmentType.LEFT, spacing: { after: 0 }, children: [new TextRun({ text: String(t || ''), bold: !!o.b, font: F, size: 22 })] });
  const table = (t) => new Table({ width: { size: 9360 - 1440 - (t.left || 0), type: WidthType.DXA }, indent: t.left ? { size: t.left, type: WidthType.DXA } : undefined,
    rows: (t.rows || []).map((r, i) => { const tot = i > 0 && (/total/i.test(r.join(' ')) || /^CY \d{4}$/.test(String(r[0] ?? '').trim())); return new TableRow({ tableHeader: i === 0, cantSplit: true, children: r.map((c) => new TableCell({ children: [cellP(c, { b: i === 0 || tot, al: i === 0 ? AlignmentType.CENTER : isNum(c) ? AlignmentType.RIGHT : AlignmentType.LEFT })] })) }); }) });
  const margin = { top: 1440, right: 1440, bottom: 1440, left: 2160, header: 0, footer: 720 };
  const size = { width: 12240, height: 15840 };
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: F, size: 22 })] })] });
  return [
    { properties: { page: { size, margin } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 4600 }, children: [new TextRun({ text: 'PART II – OBSERVATIONS AND', bold: true, font: F, size: 48 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'RECOMMENDATIONS', bold: true, font: F, size: 48 })] })] },
    { properties: { page: { size, margin, pageNumbers: start ? { start } : undefined } }, footers: start ? { default: footer } : undefined,
      children: doc.paras.map((p) => (p.kind === 'table' ? table(p) : para(p))) }
  ];
}
