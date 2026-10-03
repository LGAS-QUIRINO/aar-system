// Exit Conference invitation letter (Barangay): one letter to the ABC President covering several barangays.
// One layout feeds the Print View on screen, the printout and the Word file.
import { loadScript } from './wp.js';
import { periodPhrase, longDate, upper, nice } from './format.js';
import { DOC_CSS } from './aom.js';

// The team's standard wording. [PERIOD], [CONF_DATE], [TIME] and [VENUE] fill in by themselves.
export const EXIT_STANDARD = {
  p1: 'We are pleased to inform you that we are now finalizing the results of our regular audit on the accounts of the following barangays [PERIOD]:',
  p2: 'As a matter of policy and to discuss the management comments and actions taken by the agency on the Audit Observations and Recommendations already issued, we would like to request your presence for an Exit Conference on [CONF_DATE], [TIME] at the [VENUE].',
  p3: 'With the end of conducting an efficient and orderly Exit Conference, we request the attendance of the Barangay Captain, Barangay Treasurer and the Barangay Councilor designated as Chairman- Committee on Appropriation of the abovementioned barangays.',
  cc: 'The Municipal Mayor\nThe Municipal Accountant'
};
export const WORDING_KEYS = ['p1', 'p2', 'p3', 'cc'];

export const weekday = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { weekday: 'long' }); };
const blank = '__________';

// Barangays grouped by audit period. brgys: [{ name, from, to }]. Same period → one group without a heading.
export function brgyGroups(brgys) {
  const by = {};
  brgys.forEach((b) => { const k = `${b.from}|${b.to}`; (by[k] = by[k] || { from: Number(b.from), to: Number(b.to), names: [] }).names.push(b.name); });
  const groups = Object.values(by).sort((a, b) => b.from - a.from || b.to - a.to);
  groups.forEach((g) => g.names.sort((a, b) => a.localeCompare(b, 'en')));
  const total = brgys.length;
  let n = 0;
  return groups.map((g) => ({
    head: groups.length > 1 ? periodPhrase(g.from, g.to, true).replace(/^f/, 'F') + ':' : '',
    items: g.names.map((name) => { n++; return { n, text: name + (n === total ? '' : n === total - 1 ? '; and' : ';') }; }),
    from: g.from, to: g.to
  }));
}

/**
 * info: { letter (data), brgys [{name, from, to}], mun (data), team (data), atl, sa }
 * Returns { items, cc[], cols, fileName } — items are the letter body in order.
 */
export function buildExitLetter(info) {
  const { letter: L, brgys, mun, team, atl, sa } = info;
  const groups = brgyGroups(brgys);
  const mixed = groups.length > 1;
  const one = groups[0];
  const fill = (t) => String(t || '')
    .replace(/\s*\[PERIOD\]/g, mixed || !one ? '' : ' ' + periodPhrase(one.from, one.to, true))
    .replace(/\[CONF_DATE\]/g, L.confDate ? `${weekday(L.confDate)}, ${longDate(L.confDate)}` : blank)
    .replace(/\[TIME\]/g, L.time || blank)
    .replace(/\[VENUE\]/g, L.venue || blank);
  const munName = mun ? mun.name : '';
  const items = [];
  items.push({ k: 'lh' });
  items.push({ k: 'p', t: 'REGIONAL OFFICE NO. II', b: true, al: 'c' });
  items.push({ k: 'p', t: 'PROVINCE OF QUIRINO', al: 'c' });
  items.push({ k: 'p', t: 'PROVINCIAL SATELLITE AUDITING OFFICE', al: 'c' });
  items.push({ k: 'p', t: 'Capitol Hills, Cabarroguis, Quirino', al: 'c', size: 18 });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: 'Office of the Auditor' + (team && team.officeCode ? ' – Audit Team ' + team.officeCode : ''), b: true, al: 'c', rule: true });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: L.letterDate ? longDate(L.letterDate) : blank });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: upper(L.addrName) || blank, b: true });
  items.push({ k: 'p', t: L.addrPos || 'ABC President' });
  items.push({ k: 'p', t: `Municipal Government of ${munName}` });
  items.push({ k: 'p', t: `${munName}, Quirino` });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: L.salutation || 'Dear Sir:' });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: fill(L.p1), al: 'j' });
  items.push({ k: 'bl' });
  const cols = brgys.length > 10 ? 2 : 1;
  items.push({ k: 'list', groups, cols });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: fill(L.p2), al: 'j' });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: fill(L.p3), al: 'j' });
  items.push({ k: 'bl' });
  items.push({ k: 'p', t: 'Your usual cooperation is highly appreciated. Thank you.' });
  items.push({ k: 'bl' });
  // Signatories as on the AOM: the ATL signs, the SA notes (only the SA when one person holds both).
  const title = (u, fallback) => (u && (u.designation || u.position)) || fallback;
  const oneStep = atl && sa && atl.id === sa.id;
  items.push({ k: 'p', t: 'Very truly yours,' });
  items.push({ k: 'bl' }, { k: 'bl' });
  const first = oneStep ? sa : atl;
  items.push({ k: 'p', t: upper(first ? first.name : '') || blank, b: true });
  items.push({ k: 'p', t: title(first, oneStep ? 'Supervising Auditor' : 'Audit Team Leader') });
  if (!oneStep && sa) {
    items.push({ k: 'bl' });
    items.push({ k: 'p', t: 'Noted by:' });
    items.push({ k: 'bl' }, { k: 'bl' });
    items.push({ k: 'p', t: upper(sa.name), b: true });
    items.push({ k: 'p', t: title(sa, 'Supervising Auditor') });
  }
  const cc = String(L.cc || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const fileName = `${upper(munName).replace(/[^A-Z0-9]+/g, '')}_Exit_Conference_Invitation_Letter_${L.n || 1}`;
  return { items, cc, cols, groups, fileName };
}

/* ── Screen and print ── */
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const EXIT_CSS = `
.xl p{margin:0;min-height:1em}
.xl .c{text-align:center}.xl .j{text-align:justify}.xl .b{font-weight:700}
.xl .ls{border-collapse:collapse;margin-left:.9in}
.xl .ls td{padding:0 .25in 0 0;vertical-align:top}
.xl .ls .no{display:inline-block;width:.35in}
.xl .ls .gh td{padding-top:0}
.xl .gh-p{margin-left:.5in}
.xl .cc{display:grid;grid-template-columns:.5in 1fr}
`;
function listHTML(it) {
  return it.groups.map((g, gi) => {
    const head = g.head ? `${gi ? '<p>&nbsp;</p>' : ''}<p class="gh-p">${escH(g.head)}</p>` : '';
    const rows = [];
    if (it.cols === 2) {
      const half = Math.ceil(g.items.length / 2);
      for (let r = 0; r < half; r++) rows.push([g.items[r], g.items[r + half]]);
    } else g.items.forEach((x) => rows.push([x]));
    const cell = (x) => `<td>${x ? `<span class="no">${x.n}.</span>${escH(x.text)}` : ''}</td>`;
    return `${head}<table class="ls">${rows.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}</table>`;
  }).join('');
}
export function exitBodyHTML(d) {
  return d.items.map((it) => {
    if (it.k === 'lh') return '<div class="lh2"><img class="seal" src="img/lh-seal.jpg" alt="Commission on Audit seal" style="width:1.1in;height:1.1in;left:.53in;top:-.16in"><img class="name" src="img/lh-name.jpg" alt="Republic of the Philippines, Commission on Audit" style="width:3in;height:.434in"></div>';
    if (it.k === 'bl') return '<p>&nbsp;</p>';
    if (it.k === 'list') return listHTML(it);
    const cls = [it.al === 'c' ? 'c' : it.al === 'j' ? 'j' : '', it.b ? 'b' : '', it.rule ? 'rule-below' : ''].join(' ');
    return `<p class="${cls}"${it.size ? ` style="font-size:${it.size / 2}pt"` : ''}>${escH(it.t)}</p>`;
  }).join('');
}
export const ccHTML = (d) => d.cc.length ? `<div class="cc"><span>Cc:</span><span>${d.cc.map(escH).join('<br>')}</span></div>` : '';

export function printExit(d, title) {
  const css = `${DOC_CSS}${EXIT_CSS}
    @page { size: 8.5in 13in; margin: 1in 1in .62in 1in; }
    body { margin: 0; }
    .ccfoot { position: fixed; left: 0; bottom: 0; font: 12pt 'Times New Roman', serif; }`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title)}</title><base href="${location.href.split('#')[0]}"><style>${css}</style></head>
    <body><div class="aom-doc xl">${exitBodyHTML(d)}</div><div class="aom-doc xl ccfoot">${ccHTML(d)}</div></body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  const img = f.contentDocument.querySelector('img');
  if (img && !img.complete) img.onload = img.onerror = go; else setTimeout(go, 200);
}

/* ── Word ── */
export async function exitWord(d) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, BorderStyle, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, TabStopType } = D;
  const FONT = 'Times New Roman', EMU = 914400;
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const seal = await load('img/lh-seal.jpg'), name = await load('img/lh-name.jpg');
  const R = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 24, bold: !!o.b });
  const al = (a) => ({ c: AlignmentType.CENTER, j: AlignmentType.JUSTIFIED }[a] || AlignmentType.LEFT);
  const P = (t, o = {}) => new Paragraph({ alignment: al(o.al), spacing: { after: 0, line: 240 }, indent: o.ind,
    border: o.rule ? { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 24, color: '000000', space: 4 } } : undefined, children: [R(t, o)] });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noB = { top: none, bottom: none, left: none, right: none };
  const children = [];
  d.items.forEach((it) => {
    if (it.k === 'lh') {
      const kids = [];
      if (seal) kids.push(new ImageRun({ type: 'jpg', data: seal, transformation: { width: Math.round(1.1 * 96), height: Math.round(1.1 * 96) },
        floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: Math.round(0.53 * EMU) }, verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(-0.16 * EMU) }, wrap: { type: TextWrappingType.NONE }, allowOverlap: true, behindDocument: true } }));
      if (name) kids.push(new ImageRun({ type: 'jpg', data: name, transformation: { width: Math.round(3.0 * 96), height: Math.round(0.434 * 96) } }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 230, after: 0 }, children: kids }));
    } else if (it.k === 'bl') children.push(P(''));
    else if (it.k === 'list') {
      const colW = it.cols === 2 ? 3400 : 5000;
      it.groups.forEach((g, gi) => {
        if (g.head) { if (gi) children.push(P('')); children.push(P(g.head, { ind: { left: 720 } })); }
        const rows = [];
        if (it.cols === 2) { const half = Math.ceil(g.items.length / 2); for (let r = 0; r < half; r++) rows.push([g.items[r], g.items[r + half]]); }
        else g.items.forEach((x) => rows.push([x]));
        const cell = (x) => new TableCell({ width: { size: colW, type: WidthType.DXA }, borders: noB,
          children: [new Paragraph({ spacing: { after: 0 }, tabStops: [{ type: TabStopType.LEFT, position: 500 }], indent: { left: 500, hanging: 500 }, children: x ? [R(`${x.n}.\t${x.text}`)] : [R('')] })] });
        children.push(new Table({ width: { size: colW * it.cols, type: WidthType.DXA }, columnWidths: Array(it.cols).fill(colW), indent: { size: 1300, type: WidthType.DXA },
          borders: { ...noB, insideHorizontal: none, insideVertical: none }, rows: rows.map((r) => new TableRow({ children: r.map(cell) })) }));
      });
    } else children.push(P(it.t, it));
  });
  // Cc sits at the bottom of the page, in the footer area.
  const foot = new Footer({ children: d.cc.length ? [
    new Paragraph({ spacing: { after: 0 }, tabStops: [{ type: TabStopType.LEFT, position: 720 }], children: [R('Cc:\t' + d.cc[0])] }),
    ...d.cc.slice(1).map((c) => new Paragraph({ spacing: { after: 0 }, indent: { left: 720 }, children: [R(c)] })),
    new Paragraph({ spacing: { after: 0 }, children: [R('')] })] : [new Paragraph({ children: [] })] });
  const doc = new Document({ creator: 'Annual Audit Report System', title: 'Exit Conference Invitation', styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 18720 }, margin: { top: 1440, right: 1440, bottom: 1930, left: 1440, header: 720, footer: 720 } } }, footers: { default: foot }, children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = d.fileName + '.docx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export { nice };
