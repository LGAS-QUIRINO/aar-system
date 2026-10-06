// Review Trail: every round of corrections, with initials, comments and history, for the audit file.
// One file per barangay (or the AOMs ticked). Printout and Word (real Word Track Changes).
// Built to be reused by any reviewed document (AOM now, BAAR later): it needs versions[], history[] and comments[].
import { loadScript } from './wp.js';
import { BLOCK_LABELS, blockPlain, diffWords, fillText, ensureIds, clone, ST, topicVars } from './aom.js';
import { initials, nice } from './format.js';
import { when } from './reviewpane.js';

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stamp = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };

/**
 * One AOM's trail. a: record; info: { no (full AOM No.), vars, nameOf(email) }.
 */
export function aomTrail(a, info) {
  const d = ensureIds(clone(a.data));
  const fill = (t) => fillText(t || '', info.vars);
  const fillT = (t) => fillText(t || '', topicVars(info.vars));   // title and topic sentence: COA figures rule
  const plainOf = (b) => (b.type === 'topic' ? fillT : fill)(b.type === 'table' ? `[AOM Table ${b.n || 1}]${b.caption ? ' ' + b.caption : ''}` : blockPlain(b));
  const vs = (d.versions || []).slice();
  let legacy = false;
  // AOMs reviewed before versions were kept: show what is on record.
  if (!vs.length && d.submitted) {
    legacy = true;
    vs.push({ at: d.forwardedAt || '', by: d.forwardedBy || '', step: 'Forwarded for review', title: d.submitted.title, blocks: d.submitted.blocks, editedBy: {} });
  }
  const cur = { at: new Date().toISOString(), by: '', step: '', title: d.title, blocks: d.blocks, editedBy: d.editedBy || {} };
  const lastV = vs[vs.length - 1];
  const same = (x, y) => x && y && x.title === y.title && JSON.stringify((x.blocks || []).map(blockPlain)) === JSON.stringify((y.blocks || []).map(blockPlain));
  if (lastV && !same(lastV, cur) && d.status !== ST.FINAL) vs.push({ ...cur, step: legacy ? 'Corrections on record' : 'Changes not yet forwarded or approved', pending: true });
  else if (legacy && lastV && !same(lastV, cur)) vs.push({ ...cur, step: 'Corrections on record' });

  const rounds = [];
  for (let i = 1; i < vs.length; i++) {
    const A = vs[i - 1], B = vs[i];
    const ids = [...new Set([...(B.blocks || []).map((b) => b.id), ...(A.blocks || []).map((b) => b.id)])];
    const blocks = [];
    const tA = fillT(A.title), tB = fillT(B.title);
    if (tA !== tB) blocks.push({ label: 'Finding Title', segs: diffWords(tA, tB), who: (B.editedBy || {})._title || B.by });
    ids.forEach((id) => {
      const x = (A.blocks || []).find((b) => b.id === id), y = (B.blocks || []).find((b) => b.id === id);
      const px = x ? plainOf(x) : '', py = y ? plainOf(y) : '';
      if (px === py) return;
      blocks.push({ label: (y || x).label || BLOCK_LABELS[(y || x).type] || 'Block', segs: diffWords(px, py), who: (B.editedBy || {})[id] || B.by });
    });
    const from = A.at || '', to = B.pending ? '9999' : (B.at || '9999');
    const comments = (d.comments || []).filter((c) => (c.at || '') > from && (c.at || '') <= to);
    if (!blocks.length && !comments.length && !B.pending) continue;
    rounds.push({ step: B.step, at: B.pending ? '' : B.at, by: B.by, blocks, comments, pending: !!B.pending });
  }
  // Comments made before the first version or after the last one still belong in the trail.
  const inRounds = new Set(rounds.flatMap((r) => r.comments.map((c) => c.id)));
  const loose = (d.comments || []).filter((c) => !inRounds.has(c.id));
  if (loose.length) rounds.push({ step: 'Other comments', at: '', by: '', blocks: [], comments: loose });

  const finalParas = [];
  if (d.title) finalParas.push({ t: fillT(d.title), i: true });
  (d.blocks || []).forEach((b) => plainOf(b).split('\n').filter(Boolean).forEach((t) => finalParas.push({ t, b: b.type === 'topic' || b.type === 'recommendation' })));
  // A BAAR part names itself (info.head); its final text is the wording that can be corrected (info.finalBlocks).
  if (info.finalBlocks) { finalParas.length = 0; info.finalBlocks.forEach((b) => { if (b.label) finalParas.push({ t: b.label, b: true }); plainOf(b).split('\n').filter(Boolean).forEach((t) => finalParas.push({ t })); }); }
  return { no: info.no, title: fillT(d.title), head: info.head, finalHead: info.finalHead, status: d.status || ST.DRAFT, history: d.history || [], rounds, finalParas, legacy, nameOf: info.nameOf };
}

/* ── Printout ── */
const segHTML = (segs) => segs.map((s) => s.op === '-' ? `<del>${escH(s.t)}</del>` : s.op === '+' ? `<ins>${escH(s.t)}</ins>` : escH(s.t)).join('').replace(/\n/g, '<br>');
const TRAIL_CSS = `
body{font:12pt/1.25 'Times New Roman',Tinos,serif;color:#000;margin:0}
h1{font-size:14pt;text-align:center;margin:0}.c{text-align:center;margin:0}
h2{font-size:12.5pt;margin:0 0 4pt}.aomh{break-before:page;page-break-before:always}.aomh.first{break-before:auto;page-break-before:auto}
h3{font-size:12pt;margin:14pt 0 6pt;border-bottom:1px solid #000;padding-bottom:2pt}
h4{font-size:11pt;margin:8pt 0 3pt}
table{border-collapse:collapse;width:100%;font-size:10.5pt}td,th{border:1px solid #000;padding:2pt 5pt;vertical-align:top;text-align:left}th{text-align:center}
p{margin:0 0 7pt;text-align:justify}.lbl{font-size:9.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:6pt 0 1pt}
del{text-decoration:line-through}ins{text-decoration:underline;text-decoration-thickness:1.5px}
sup.w{font:700 7.5pt Arial,sans-serif;border:1px solid #000;border-radius:2px;padding:0 2px;vertical-align:3pt;margin-left:2px}
.key{font-size:10pt;font-style:italic;margin:6pt 0}.inc{margin:6pt 0 0;text-align:center;font-size:11pt}
.cm{border-left:2px solid #000;padding-left:8pt;margin:4pt 0 8pt;font-size:11pt}.cm .r{margin-left:14pt;margin-top:3pt}
.b{font-weight:700}.i{font-style:italic}.note{font-size:10.5pt;font-style:italic}
`;
function aomHTML(t, first) {
  const ini = (e) => initials(t.nameOf(e) || e);
  return `<h2 class="aomh ${first ? 'first' : ''}" style="margin-top:${first ? '14pt' : '0'}">${escH(t.head || `AOM No. ${t.no} · ${t.title}`)}</h2>
    <h3>History</h3><table><tr><th style="width:24%">Date and Time</th><th>Action</th><th style="width:30%">By</th></tr>
    ${t.history.map((h) => `<tr><td>${escH(stamp(h.at))}</td><td>${escH(h.action)}</td><td>${escH(t.nameOf(h.by))}${h.by ? ` (${escH(ini(h.by))})` : ''}</td></tr>`).join('')}</table>
    ${t.legacy ? '<p class="note" style="margin-top:6pt">This AOM was reviewed before the Review Trail was added, so only the corrections on record are shown, not each earlier round.</p>' : ''}
    ${t.rounds.length ? t.rounds.map((r, i) => `<h3>${r.pending || r.step === 'Other comments' ? escH(r.step) : `Round ${i + 1} · ${escH(r.step)}`}${r.at ? ' · ' + escH(stamp(r.at)) : ''}${r.by ? ' · ' + escH(t.nameOf(r.by)) : ''}</h3>
      ${r.blocks.map((b) => `<div class="lbl">${escH(b.label)}</div><p>${segHTML(b.segs)}${b.who ? `<sup class="w">${escH(ini(b.who))}</sup>` : ''}</p>`).join('') || (r.step === 'Other comments' ? '' : '<p class="note">No wording changes in this round.</p>')}
      ${r.comments.length ? `<h4>Comments</h4>${r.comments.map((c) => `<div class="cm"><span class="b">${escH(t.nameOf(c.by))}</span> · ${escH(stamp(c.at))}${c.quote ? ` · on “${escH(c.where ? c.where + ': ' : '')}${escH(c.quote)}”` : ''}<br>${escH(c.text)}
        ${(c.replies || []).map((rp) => `<div class="r"><span class="b">Reply · ${escH(t.nameOf(rp.by))}</span> · ${escH(stamp(rp.at))}<br>${escH(rp.text)}</div>`).join('')}
        ${c.resolved ? `<div class="r i">Resolved by ${escH(t.nameOf(c.resolvedBy))}${c.resolvedAt ? ' · ' + escH(stamp(c.resolvedAt)) : ''}</div>` : ''}</div>`).join('')}` : ''}`).join('')
    : '<p class="note" style="margin-top:6pt">No review rounds yet.</p>'}
    ${t.finalParas.length ? `<h3>${t.status === ST.FINAL ? 'Final Text' : 'Current Text'} · ${escH(t.finalHead || 'AOM No. ' + t.no)}</h3>` : ''}
    ${t.finalParas.map((p) => `<p class="${p.b ? 'b' : ''} ${p.i ? 'i' : ''}">${escH(p.t)}</p>`).join('')}`;
}
export function includedLine(chosen, total) {
  if (chosen.length === total) return `Included: all ${total} AOM${total > 1 ? 's' : ''}`;
  const names = chosen.map((t) => 'AOM No. ' + t.no);
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  return `Included: ${chosen.length} of ${total} AOMs: ${list}`;
}
export function printTrail(file) {
  const foot = `"Page " counter(page) " of " counter(pages) "\\A ${file.footer.replace(/"/g, '\\"')}"`;
  const css = `${TRAIL_CSS}
    @page{size:8.5in 13in;margin:1in 1in .9in 1in;
      @top-right{content:"REVIEW TRAIL – Not for Issuance";font:700 10pt 'Times New Roman';color:#777}
      @bottom-right{content:${foot};white-space:pre;font:10pt 'Times New Roman';text-align:right}}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escH(file.title)}</title><style>${css}</style></head><body>
    <h1>${escH(file.heading || 'AOM REVIEW TRAIL')}</h1><p class="c">${escH(file.place)}</p><p class="inc">${escH(file.included)}</p>
    <p class="key" style="text-align:center">Key: <del>struck through</del> = removed · <ins>underlined</ins> = added · <sup class="w">GB</sup> = initials of the person who made the change.</p>
    ${file.trails.map((t, i) => aomHTML(t, i === 0)).join('')}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 250);
  return html;
}

/* ── Word, with real Track Changes ── */
export async function trailWord(file) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Document, Packer, Paragraph, TextRun, InsertedTextRun, DeletedTextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, PageNumber } = D;
  const FONT = 'Times New Roman';
  let rid = 1;
  const T = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 24, bold: !!o.b, italics: !!o.i });
  const P = (children, o = {}) => new Paragraph({ children, alignment: o.al || AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 140 }, pageBreakBefore: !!o.pb });
  const H = (t, o = {}) => P([T(t, { b: o.b !== false, size: o.size, i: o.i })], { al: o.al || AlignmentType.LEFT, after: o.after ?? 100, pb: o.pb });
  const cellP = (t, b) => new Paragraph({ children: [T(t, { size: 20, b })] });
  const W = [2300, 4560, 2500];
  const children = [H(file.heading || 'AOM REVIEW TRAIL', { al: AlignmentType.CENTER, size: 28 }), H(file.place, { al: AlignmentType.CENTER, b: false }), H(file.included, { al: AlignmentType.CENTER, b: false, after: 160 }),
    H('In Word, open the Review tab: All Markup shows every correction with the name of the person who made it.', { al: AlignmentType.CENTER, b: false, i: true, size: 20, after: 240 })];
  file.trails.forEach((t, ti) => {
    children.push(H(t.head || `AOM No. ${t.no} · ${t.title}`, { pb: ti > 0, size: 25 }));
    children.push(H('History', { after: 80 }));
    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: W,
      rows: [new TableRow({ tableHeader: true, children: ['Date and Time', 'Action', 'By'].map((h, i) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, children: [cellP(h, true)] })) }),
        ...t.history.map((h) => new TableRow({ children: [stamp(h.at), h.action, t.nameOf(h.by)].map((c, i) => new TableCell({ width: { size: W[i], type: WidthType.DXA }, children: [cellP(c)] })) }))] }));
    if (t.legacy) children.push(H('This AOM was reviewed before the Review Trail was added, so only the corrections on record are shown.', { b: false, i: true, size: 20 }));
    t.rounds.forEach((r, i) => {
      children.push(H(`${r.pending || r.step === 'Other comments' ? r.step : `Round ${i + 1} · ${r.step}`}${r.at ? ' · ' + stamp(r.at) : ''}${r.by ? ' · ' + t.nameOf(r.by) : ''}`, { after: 80 }));
      r.blocks.forEach((b) => {
        const author = t.nameOf(b.who) || 'Reviewer', date = r.at || new Date().toISOString();
        children.push(H(b.label.toUpperCase(), { size: 18, after: 20 }));
        children.push(P(b.segs.map((s) => s.op === '+' ? new InsertedTextRun({ id: rid++, author, date, text: s.t, font: FONT, size: 24 })
          : s.op === '-' ? new DeletedTextRun({ id: rid++, author, date, text: s.t, font: FONT, size: 24 }) : T(s.t))));
      });
      r.comments.forEach((c) => {
        children.push(P([T(`${t.nameOf(c.by)} · ${stamp(c.at)}${c.quote ? ` · on “${c.quote}”` : ''}: `, { b: true, size: 22 }), T(c.text, { size: 22 })], { after: 40 }));
        (c.replies || []).forEach((rp) => children.push(P([T(`Reply · ${t.nameOf(rp.by)} · ${stamp(rp.at)}: `, { b: true, size: 22 }), T(rp.text, { size: 22 })], { after: 40 })));
        if (c.resolved) children.push(P([T(`Resolved by ${t.nameOf(c.resolvedBy)}${c.resolvedAt ? ' · ' + stamp(c.resolvedAt) : ''}`, { i: true, size: 22 })], { after: 100 }));
      });
    });
    if (t.finalParas.length) children.push(H(`${t.status === ST.FINAL ? 'Final Text' : 'Current Text'} · ${t.finalHead || 'AOM No. ' + t.no}`, { after: 80 }));
    t.finalParas.forEach((p) => children.push(P([T(p.t, { b: p.b, i: p.i })])));
  });
  const doc = new Document({ creator: 'Annual Audit Report System', title: file.title, features: { trackRevisions: true }, styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 18720 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'REVIEW TRAIL – Not for Issuance', bold: true, color: '8A8A8A', font: FONT, size: 20 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: file.footer, font: FONT, size: 20 })] })] }) },
      children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.fileName + '.docx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export { nice, when };
