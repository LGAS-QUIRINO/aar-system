// BAAR Reports: the list of Barangay BAARs, and each BAAR's parts (01 to 10), built in order.
// Part 01 · Transmittal Letters can be printed as soon as its own details are filled in, before the rest of the BAAR is done.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { has, myTeamIds } from '../refs.js';
import { loadAudit, stepsBar } from '../auditctx.js';
import { ST, clone } from '../aom.js';
import { periodPhrase, longDate, nice } from '../format.js';
import { loadGaa, loadPeriodWording, openReportWording, canEditWording } from './reportwording.js';
import { buildCover, coverHTML, printCover, coverWord, coverPrint, coverSections } from '../baar-cover.js';
import { buildToc, tocHTML, printToc, tocWord, tocPrint, tocSections } from '../baar-toc.js';
import { printPages, saveDocx } from '../baar-doc.js';
import { IAR_STANDARD, IAR_KEYS, mergeMgmt, IAR_OPINION_STANDARD, BASES_HEAD, buildIar, iarPagesHTML, paginateIar, iarPrint, iarSections } from '../baar-iar.js';
import { fillText, blockPlain, SECTIONS } from '../aom.js';
import { SMR_STANDARD, SMR_KEYS, smrSigners, buildSmr, smrPageHTML, scanPagesHTML, smrPrint, smrSections } from '../baar-smr.js';
import { uploadPdf, getPdf, renderPdf, removeFile, openPdf } from '../files.js';
import { aomNo } from '../format.js';
import { loadFS, fsPart, fsPill, fsDoc, fsPageCount } from './baarfs.js';
import { fsPrint, fsSections } from '../baar-fs.js';
import { buildNotes, notesPagesHTML, notesPageCount, notesPrint, notesSections, notesFileName, NOTES_CSS, KM, ppeSchedule, sanggunian } from '../baar-notes.js';
import { aomAmount, peso } from '../saor.js';
import { gaaFor, gaaComplete, gaaText, TYPED_GAA, TR_STANDARD, TR_KEYS, OPINIONS, OPINION_STANDARD, periodEnded, pbSalutation, punongBarangay, buildTransmittal, docHTML, paginate, printTransmittal, transmittalWord, transmittalPrint, transmittalSections } from '../baar-transmittal.js';

export const PARTS = [
  ['01', 'Transmittal Letters'], ['02', 'Cover'], ['03', 'Table of Contents'], ['04', "Independent Auditor's Report"], ['05', "Management's Responsibility"],
  ['06', 'Audited FS'], ['07', 'Notes to FS'], ['08', 'Part II'], ['09', 'Part III'], ['10', 'Part IV Annexes']
];
const recId = (auditId) => `baar-${auditId}`;
const stdId = (teamId) => `std-baartr-${teamId}`;
const iarStdId = (teamId) => `std-baariar-${teamId}`;
const smrStdId = (teamId) => `std-baarsmr-${teamId}`;

const BUILT = ['01', '02', '03', '04', '05', '06', '07'];
// The parts strip. st: the status pill of each built part, e.g. { '01': html, '03': html }; each sits in #b-pNN so a screen can update it.
function partsStrip(auditId, active, st = {}) {
  return `<div class="bparts">${PARTS.map(([n, t]) => {
    const pillHTML = BUILT.includes(n) ? `<span id="b-p${n}">${n === '02' ? pill('Ready to Print', 'ok') : st[n] || ''}</span>` : '';
    if (n === active) return `<span class="bpart on"><b>${n}</b> ${esc(t)} ${pillHTML}</span>`;
    if (BUILT.includes(n)) return `<a class="bpart link" href="#/baar/${auditId}?p=${n}"><b>${n}</b> ${esc(t)} ${pillHTML}</a>`;
    return `<span class="bpart later" title="Built after Part ${String(Number(n) - 1).padStart(2, '0')}"><b>${n}</b> ${esc(t)}</span>`;
  }).join('')}</div>`;
}
const p01Pill = (miss) => (miss.length ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok'));

// The Final AOMs of the audit as possible bases: Section A (Financial Audit) ticked unless changed; text from the AOM's own observation.
function basesList(ctx, I) {
  return ctx.aoms.filter((a) => a.data.status === ST.FINAL).sort((a, b) => ctx.nums[a.id].n - ctx.nums[b.id].n).map((a) => {
    const v = ctx.varsFor(a), sv = I.bases[a.id] || {};
    const own = fillText(blockPlain((a.data.blocks || []).find((b) => b.type === 'topic') || {}), v).trim().replace(/[.;\s]+$/, '');
    const amt = aomAmount(a.data);
    return { id: a.id, sec: a.data.section || 'B', no: aomNo(ctx.audit.auditYear, ctx.nums[a.id].n, ctx.audit.periodFrom, ctx.audit.periodTo),
      title: fillText(a.data.title || '', v), amount: amt, own, on: sv.on !== undefined ? !!sv.on : (a.data.section || 'B') === 'A', text: sv.text !== undefined ? sv.text : own };
  });
}
// What Part 04 still needs before it is ready to print.
function iarMissing(op, I, list) {
  const m = [];
  if (!op) m.push('opinion');
  else if (!String((I.opSent || {})[op] || '').trim()) m.push('opinion paragraph');
  if (op && op !== 'Unmodified' && !list.some((b) => b.on)) m.push('at least one basis');
  if (!I.date) m.push('report date');
  return m;
}
const p04Pill = (m) => (m.length ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok'));
const p05Pill = (S) => (S && S.file ? pill('Uploaded', 'ok') : pill('Awaiting Signed Copy', 'warn'));

// What Part 01 still needs before it is ready to print.
export function trMissing(b, gaa, year) {
  const t = (b && b.tr) || {}, op = b && b.opinion, s = (t.opSent && t.opSent[op]) || {};
  const miss = [];
  if (!op) miss.push('opinion');
  else if (!(s.sa || '').trim() || !(s.atl || '').trim()) miss.push('opinion sentence');
  if (!t.confDate) miss.push('exit conference date');
  if (!t.atlDate || !t.saDate) miss.push('letter dates');
  if (!(t.pbName || '').trim()) miss.push('Punong Barangay');
  if (gaa && /\[GAA\]/.test(t.sa6 === undefined ? '[GAA]' : t.sa6) && !gaaComplete(gaaFor(gaa, year))) miss.push(`GAA for FY ${year}`);
  return miss;
}

/* ── BAAR Reports list ── */
export async function baarList(refs, params, q) {
  const me = refs.me;
  const teams = myTeamIds(me, refs.teams);
  const audits = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported);
  const munOf = (a) => refs.lgu[a.data.lguId]?.data.parentId;
  const munIds = [...new Set(audits.map(munOf).filter(Boolean))].sort((x, y) => (refs.lgu[x]?.data.name || '').localeCompare(refs.lgu[y]?.data.name || ''));
  const crumbs = '<b>BAAR Reports</b>';
  if (!munIds.length) return { active: '#/baar', crumbs, body: '<div class="page-head"><div><h1>BAAR Reports</h1></div></div><section class="panel"><div class="empty">No audits yet. Start an audit from My Audit first.</div></section>' };
  const munId = munIds.includes(q.get('m')) ? q.get('m') : munIds[0];
  const years = [...new Set(audits.filter((a) => munOf(a) === munId).map((a) => Number(a.data.auditYear)))].sort((a, b) => b - a);
  const year = years.includes(Number(q.get('y'))) ? Number(q.get('y')) : years[0];
  const list = audits.filter((a) => munOf(a) === munId && Number(a.data.auditYear) === year)
    .sort((a, b) => (refs.lgu[a.data.lguId]?.data.name || '').localeCompare(refs.lgu[b.data.lguId]?.data.name || ''));
  const aoms = await store.list('aoms');
  const recs = Object.fromEntries((await store.list('letters')).filter((l) => l.data.type === 'baar').map((l) => [l.data.auditId, l.data]));
  const gaa = await loadGaa();
  const cols = 'grid-template-columns: minmax(150px,1.3fr) minmax(170px,1.3fr) minmax(120px,1fr) minmax(140px,1fr) 90px';
  const rows = list.map((a) => {
    const xs = aoms.filter((x) => x.data.auditId === a.id), fin = xs.filter((x) => x.data.status === ST.FINAL).length;
    const miss = trMissing(recs[a.id], gaa, a.data.periodTo);
    const p01 = !recs[a.id] ? pill('Not Started', 'grey') : miss.length ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok');
    return `<div class="t-row click" style="${cols}" data-go="#/baar/${a.id}" tabindex="0" role="link"><span><b>${esc(refs.lgu[a.data.lguId]?.data.name || '?')}</b></span>
      <span>${esc(periodPhrase(a.data.periodFrom, a.data.periodTo))}</span>
      <span>${xs.length ? `${fin} of ${xs.length} Final` : '<span class="hint">No AOMs yet</span>'}</span><span>${p01}</span>
      <span style="text-align:right"><a class="btn sm" href="#/baar/${a.id}">Open</a></span></div>`;
  }).join('');
  const body = `<div class="page-head"><div><h1>BAAR Reports</h1><p>One BAAR per barangay, built part by part in order. Click a barangay to open its BAAR.</p></div>
      <div class="btn-row"><label class="sr-only" for="b-m">Municipality</label><select class="input" id="b-m" style="width:170px">${munIds.map((id) => `<option value="${id}" ${id === munId ? 'selected' : ''}>${esc(refs.lgu[id]?.data.name || id)}</option>`).join('')}</select>
        <label class="sr-only" for="b-y">Audit Year</label><select class="input" id="b-y" style="width:170px">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>Audit Year ${y}</option>`).join('')}</select>
        ${canEditWording(me) ? '<button class="btn" id="b-rw" type="button">Report Wording</button>' : ''}</div></div>
    <section class="panel"><div class="t-head" style="${cols}"><span>Barangay</span><span>Period</span><span>AOMs</span><span>01 · Transmittal</span><span></span></div>
      ${rows || '<div class="empty">No audits for this year.</div>'}</section>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      $('#b-m', root).onchange = (e) => { location.hash = `#/baar?m=${encodeURIComponent(e.target.value)}`; };
      $('#b-y', root).onchange = (e) => { location.hash = `#/baar?m=${encodeURIComponent(munId)}&y=${e.target.value}`; };
      const rw = $('#b-rw', root);
      if (rw) rw.onclick = async () => { const r = await openReportWording({ me, tab: 'period', year: Math.max(...list.map((a) => Number(a.data.periodTo)), year - 1), teamId: list[0]?.data.teamId || '' }); if (r) emitChange('local'); };
    }
  };
}

// Everything Part 01 needs: the saved BAAR record with the standard wording filled in where nothing is saved yet.
async function loadTransmittal(ctx) {
  const { audit } = ctx;
  const rec = await store.get('letters', recId(ctx.rec.id));
  const stdRec = await store.get('letters', stdId(ctx.teamId));
  const std = stdRec && !stdRec.deleted ? stdRec.data : {};
  const standard = { ...TR_STANDARD, ...(std.wording || {}) };
  const stdOp = Object.fromEntries(OPINIONS.map((o) => [o, { ...OPINION_STANDARD[o], ...((std.opSent || {})[o] || {}) }]));
  // The exit conference date from the Exit Conference letter that lists this barangay.
  const exitL = (await store.list('letters')).find((l) => l.data.type === 'exit' && (l.data.auditIds || []).includes(ctx.rec.id) && l.data.confDate);
  const pb = punongBarangay(audit);
  const B = rec && !rec.deleted ? clone(rec.data) : { type: 'baar', auditId: ctx.rec.id, teamId: ctx.teamId, opinion: '', tr: {} };
  const T = B.tr = B.tr || {};
  TR_KEYS.forEach((k) => { if (T[k] === undefined) T[k] = standard[k]; });
  if (T.confDate === undefined) T.confDate = exitL ? exitL.data.confDate : '';
  if (T.pbName === undefined) T.pbName = [pb.title, pb.name].filter(Boolean).join(' ');
  if (T.pbPos === undefined) T.pbPos = pb.pos;
  if (T.salutation === undefined) T.salutation = pbSalutation(pb.name);
  T.opSent = Object.fromEntries(OPINIONS.map((o) => [o, { ...stdOp[o], ...((T.opSent || {})[o] || {}) }]));
  // Part 04 · Independent Auditor's Report: standard wording filled in where nothing is saved yet.
  const iStdRec = await store.get('letters', iarStdId(ctx.teamId));
  const iStd = iStdRec && !iStdRec.deleted ? iStdRec.data : {};
  const iStandard = { ...IAR_STANDARD, ...(mergeMgmt({ ...(iStd.wording || {}) })) };
  const iStdOp = { ...IAR_OPINION_STANDARD, ...(iStd.opSent || {}) };
  const I = B.iar = mergeMgmt(B.iar || {});
  IAR_KEYS.forEach((k) => { if (I[k] === undefined) I[k] = iStandard[k]; });
  I.opSent = { ...iStdOp, ...(I.opSent || {}) };
  I.bases = I.bases || {};
  if (I.date === undefined) I.date = '';
  // Part 05 · Statement of Management Responsibility.
  const sStdRec = await store.get('letters', smrStdId(ctx.teamId));
  const sStandard = { ...SMR_STANDARD, ...(sStdRec && !sStdRec.deleted ? sStdRec.data.wording || {} : {}) };
  const S = B.smr = B.smr || {};
  SMR_KEYS.forEach((k) => { if (S[k] === undefined) S[k] = sStandard[k]; });
  return { rec, standard, stdOp, exitL, B, T, I, iStandard, iStdOp, S, sStandard, isNew: !rec || rec.deleted, gaa: await loadGaa(), pw: await loadPeriodWording(), FS: await loadFS(ctx) };
}

// Page numbers of the numbered parts: the Independent Auditor's Report is page 1; each later part follows the one before.
function baarPages(ctx, L) {
  const iarN = paginateIar(iarOf(ctx, L).items, measureBox()).length;
  const smr = 1 + iarN;
  const smrN = L.S && L.S.file ? L.S.file.pages || 1 : 1;
  const s = smr + smrN;
  const notes = s + fsPageCount(L.FS);
  return { iar: 1, smr, sfperf: s, sfpos: s + 1, scne: s + 2, scf: s + 3, scbaa: s + 4, notes, next: notes + notesPageCount(notesOf(ctx, L)) };
}
// Part 07 · Notes to Financial Statements, from the confirmed trial balances and the details typed in Part 07.
const notesOf = (ctx, L, N) => buildNotes(L.FS, N || L.B.notes || {}, { lgu: ctx.lgu, mun: ctx.mun, audit: ctx.audit });
function notesPill(F, doc) {
  if (!F.figY.any) return pill('Not Started', 'grey');
  if (!F.confirmed) return pill('Not Confirmed', 'warn');
  return doc.checks.some((c) => c.st === 'warn' || c.st === 'wait') ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok');
}
// The signed copy's pages as pictures (or null when none is uploaded yet).
async function smrImages(S) {
  if (!S || !S.file) return null;
  return renderPdf(await getPdf(S.file.fileId), S.file.fileId);
}
// Annexes added in Part 10 (not built yet).
function baarAnnexes() { return []; }

// The complete BAAR: every built part, in order, for one printout or one Word file.
async function completeBAAR(ctx) {
  const { audit, lgu, mun, team, atl, sa } = ctx;
  const L = await loadTransmittal(ctx);
  const tr = buildTransmittal({ t: { ...L.B.tr, opinion: L.B.opinion }, audit, lgu, mun, team, atl, sa, gaa: gaaFor(L.gaa, audit.periodTo), pw: L.pw });
  const cv = buildCover({ audit, lgu, mun, pw: L.pw });
  const pages = baarPages(ctx, L);
  const toc = buildToc({ audit, lgu, mun, pw: L.pw, pages, annexes: baarAnnexes() });
  const ia = iarOf(ctx, L);
  const sm = { r: buildSmr({ s: L.S, audit, lgu, mun }), imgs: await smrImages(L.S).catch(() => null), start: pages.smr };
  const fd = fsDoc(L.FS, pages.sfperf);
  const nd = notesOf(ctx, L);
  const fileName = `${String(lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_${String(mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_Complete`;
  return {
    print() { const ps = [transmittalPrint(tr), coverPrint(cv), tocPrint(toc), iarPrint(ia, paginateIar(ia.items, measureBox())), smrPrint(sm), fsPrint(fd), notesPrint(nd, pages.notes)]; printPages(ps.map((x) => x.css).join('\n'), ps.map((x) => x.html).join(''), `BAAR ${audit.auditYear} · ${lgu.name} · Complete`); },
    async word() { await saveDocx([...(await transmittalSections(tr)), ...(await coverSections(cv)), ...(await tocSections(toc)), ...(await iarSections(ia)), ...(await smrSections(sm)), ...(await fsSections(fd)), ...(await notesSections(nd, pages.notes))], fileName, 'BAAR'); }
  };
}
// The Independent Auditor's Report built from the saved BAAR record.
function iarOf(ctx, L) {
  const bases = basesList(ctx, L.I).filter((b) => b.on);
  return buildIar({ iar: L.I, opinion: L.B.opinion, audit: ctx.audit, lgu: ctx.lgu, mun: ctx.mun, atl: ctx.atl, pb: { title: '', name: L.T.pbName }, bases });
}
// A hidden box used to measure lines when laying out pages.
function measureBox() {
  let m = document.getElementById('b-measure-ia');
  if (!m) { m = document.createElement('div'); m.id = 'b-measure-ia'; document.body.appendChild(m); }
  m.className = 'aom-doc ia'; m.style.cssText = 'position:absolute;left:-9999px;top:0;width:6in;visibility:hidden';
  return m;
}
// Page heading shared by the parts, with the complete BAAR buttons.
function baarHead(ctx) {
  const { audit, lgu, mun } = ctx;
  return `${stepsBar(ctx, 'BAAR')}
    <div class="page-head"><div><h1>BAAR · Barangay ${esc(lgu.name)}</h1><p>${esc(mun.name)}, Quirino · ${esc(periodPhrase(audit.periodFrom, audit.periodTo))}</p></div>
      <div class="btn-row"><button class="btn" type="button" id="all-print">Print Complete BAAR</button><button class="btn primary" type="button" id="all-word">Complete BAAR · Word</button></div></div>`;
}
function wireComplete(root, ctx, me) {
  const p = $('#all-print', root), w = $('#all-word', root);
  if (p) p.onclick = async () => { (await completeBAAR(ctx)).print(); await store.log('printed the complete BAAR', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email); };
  if (w) w.onclick = async () => {
    try { toast('Preparing the Word file…'); await (await completeBAAR(ctx)).word(); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
    await store.log('downloaded the complete BAAR (Word)', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
  };
}

/* ── One BAAR · Part 01 Transmittal Letters ── */
export async function baar(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/baar', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found.</div>' };
  const me = refs.me;
  const { audit, lgu, mun, team, atl, sa } = ctx;
  const canEdit = myTeamIds(me, refs.teams).includes(ctx.teamId);
  const canStd = has(me, 'sa') || has(me, 'admin');
  const L = await loadTransmittal(ctx);
  const { rec, standard, stdOp, exitL, B, T, isNew } = L;
  let { gaa, pw } = L;
  const gaaYear = Number(audit.periodTo);
  const st = {
    '01': isNew ? pill('Not Started', 'grey') : p01Pill(trMissing(B, gaa, gaaYear)),
    '03': pill('In Progress', 'warn'),
    '04': p04Pill(iarMissing(B.opinion, L.I, basesList(ctx, L.I))),
    '05': p05Pill(L.S),
    '06': fsPill(L.FS),
    '07': notesPill(L.FS, notesOf(ctx, L))
  };
  if (q.get('p') === '02') return coverPart({ ctx, me, pw, st });
  if (q.get('p') === '03') return tocPart({ ctx, me, pw, st, L });
  if (q.get('p') === '04') return iarPart({ ctx, me, refs, L, st });
  if (q.get('p') === '05') return smrPart({ ctx, me, refs, L, st });
  if (q.get('p') === '07') return notesPart({ ctx, me, refs, L, st });
  if (q.get('p') === '06') {
    return fsPart({ ctx, me, L, q, canEdit, start: baarPages(ctx, L).sfperf, head: baarHead(ctx), strip: partsStrip(ctx.rec.id, '06', st), wireComplete: (root) => wireComplete(root, ctx, me) });
  }

  const parts = partsStrip(ctx.rec.id, '01', { ...st, '01': '' });
  const ta = (id, label, rows = 3) => `<div class="field"><label class="label" for="b-${id}">${label}</label><textarea class="input be-text" id="b-${id}" rows="${rows}">${esc(T[id])}</textarea></div>`;
  const dis = canEdit ? '' : 'disabled';

  const form = `
    <section class="panel"><div class="panel-head"><h2>Report Details</h2></div><div class="panel-body">
      <div class="lr-row"><span class="label" style="margin:0;white-space:nowrap">Auditor's Opinion</span>
        <div class="seg bop" role="group" aria-label="Auditor's Opinion">${OPINIONS.map((o) => `<button type="button" data-op="${o}" class="${B.opinion === o ? 'on' : ''}" aria-pressed="${B.opinion === o}" ${dis}>${o}</button>`).join('')}</div></div>
      <div class="field"><label class="label" for="b-ops">Opinion Sentence · Letter to the Punong Barangay</label><textarea class="input be-text" id="b-ops" rows="3" ${dis}></textarea></div>
      <div class="field"><label class="label" for="b-opa">Opinion Sentence · Letter to the SA</label><textarea class="input be-text" id="b-opa" rows="2" ${dis}></textarea></div>
      <span class="hint" id="b-ophint"></span>
      <div class="field"><span class="label">Period in the Letters</span><div class="bval" id="b-period">${esc(periodEnded(audit.periodFrom, audit.periodTo, pw))}</div>
</div>
      <div class="field"><label class="label" for="b-cd">Exit Conference Date</label><input class="input" type="date" id="b-cd" value="${esc(T.confDate || '')}" ${dis}>
        ${exitL ? '' : '<span class="hint">No Exit Conference letter lists this barangay yet.</span>'}</div>
    </div></section>
    <section class="panel"><div class="panel-head"><h2>Letter Dates</h2></div><div class="panel-body">
      <div class="grid-2">
        <div class="field"><label class="label" for="b-atld">ATL to SA</label><input class="input" type="date" id="b-atld" value="${esc(T.atlDate || '')}" ${dis}></div>
        <div class="field"><label class="label" for="b-sad">SA to Punong Barangay</label><input class="input" type="date" id="b-sad" value="${esc(T.saDate || '')}" ${dis}></div>
      </div><div id="b-datewarn"></div></div></section>
    <section class="panel"><div class="panel-head"><h2>Addressed To</h2><a class="btn sm ghost" style="margin-left:auto" href="#/audits/${ctx.rec.id}/setup">Edit in Setup</a></div><div class="panel-body">
      <div class="grid-2">
        <div class="field"><label class="label" for="b-pb">Punong Barangay</label><input class="input" id="b-pb" value="${esc(T.pbName)}" ${dis}></div>
        <div class="field"><label class="label" for="b-sal">Salutation</label><input class="input" id="b-sal" value="${esc(T.salutation)}" ${dis}></div>
      </div></div></section>
    <section class="panel"><div class="panel-head"><h2>Wording</h2><span class="btn-row" style="margin-left:auto">${canStd && canEdit ? '<button class="btn sm ghost" id="b-std" type="button">Save as Standard</button>' : ''}${canEdit ? '<button class="btn sm ghost" id="b-reset" type="button">Reset to Standard</button>' : ''}</span></div><div class="panel-body">
      <div class="seg" role="tablist" aria-label="Which letter"><button type="button" class="on" data-wl="sa">Letter to Punong Barangay</button><button type="button" data-wl="atl">Letter to SA</button></div>
      <fieldset class="bw" data-w="sa" ${dis}>
        ${ta('sa1', 'Paragraph 1', 4)}${ta('sa2', 'Paragraph 2', 4)}${ta('sa3', 'Paragraph 3', 3)}
        <span class="hint">Paragraph 4 is the opinion sentence, under Report Details.</span>
        ${ta('sa5', 'Paragraph 5', 3)}<div class="sugg" id="b-gaa"></div>${ta('sa6', 'Paragraph 6', 5)}${ta('sa7', 'Paragraph 7', 2)}
        ${ta('cc', 'Copy furnished (one per line)', 5)}</fieldset>
      <fieldset class="bw" data-w="atl" hidden ${dis}>
        ${ta('atlAddr', "SA's Address (one line each)", 2)}
        <div class="field"><label class="label" for="b-atlSal">Salutation</label><input class="input" id="b-atlSal" value="${esc(T.atlSal)}"></div>
        ${ta('atl1', 'Paragraph 1', 4)}${ta('atl2', 'Paragraph 2', 4)}${ta('atl3', 'Paragraph 3', 5)}${ta('atl4', 'Paragraph 4', 2)}
        <span class="hint">Paragraph 5 is the opinion sentence, under Report Details.</span>
        ${ta('atl6', 'Paragraph 6', 2)}</fieldset>
    </div></section>
    ${canEdit ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
      <div class="btn-row" style="margin-left:auto"><button class="btn primary" id="b-save" type="button">Save</button></div></div>` : ''}`;

  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>01 · Transmittal Letters</b>`;
  const body = `${baarHead(ctx)}
    <section class="panel" style="padding:10px 12px">${parts}</section>
    <div class="topnote">Words in [brackets] fill in by themselves. Names come from Audit Setup and Users, and the exit conference date from the Exit Conference letter. Any date can be typed. Changes apply to this BAAR only, unless you click Save as Standard.</div>
    <div class="xcols bcols"><div class="xform">${form}</div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="b-print" type="button">Print</button><button class="btn sm primary" id="b-word" type="button">Word</button></span></div>
        <div class="seg" role="tablist" aria-label="Document" id="b-which"><button type="button" class="on" data-d="">All Three</button><button type="button" data-d="sa">SA to Punong Barangay</button><button type="button" data-d="atl">ATL to SA</button><button type="button" data-d="aapsi">AAPSI Form</button></div>
        <div class="paper-wrap big" id="b-paper"></div></div></div>`;

  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      wireComplete(root, ctx, me);
      const v = (id) => { const el = $(id, root); return el ? el.value : ''; };
      let op = B.opinion || '';
      let which = '';
      const opBox = { sa: $('#b-ops', root), atl: $('#b-opa', root) };
      const showOp = () => {
        const s = T.opSent[op] || { sa: '', atl: '' };
        opBox.sa.value = op ? s.sa : ''; opBox.atl.value = op ? s.atl : '';
        opBox.sa.disabled = opBox.atl.disabled = !op || !canEdit;
        const hint = $('#b-ophint', root);
        hint.textContent = !op ? 'Choose the opinion first.'
          : (s.sa || '').trim() && (s.atl || '').trim() ? ''
          : `Type the ${op} sentences the first time. ${canStd ? 'Click Save as Standard to keep them for every BAAR.' : 'Your SA can save them as standard.'}`;
        hint.hidden = !hint.textContent;
      };
      const keepOp = () => { if (op) T.opSent[op] = { sa: opBox.sa.value, atl: opBox.atl.value }; };
      const collect = () => {
        keepOp();
        const t = { ...T };
        TR_KEYS.forEach((k) => { const el = $('#b-' + k, root); if (el) t[k] = el.value; });
        t.confDate = v('#b-cd'); t.atlDate = v('#b-atld'); t.saDate = v('#b-sad'); t.pbName = v('#b-pb').trim(); t.salutation = v('#b-sal').trim();
        t.opSent = clone(T.opSent);
        return { ...B, opinion: op, tr: t };
      };
      let measure = document.getElementById('b-measure');
      if (!measure) { measure = document.createElement('div'); measure.id = 'b-measure'; document.body.appendChild(measure); }
      measure.className = 'aom-doc bl'; measure.style.cssText = 'position:absolute;left:-9999px;top:0;width:6in;visibility:hidden';
      const docOf = (d) => buildTransmittal({ t: { ...d.tr, opinion: d.opinion }, audit, lgu, mun, team, atl, sa, gaa: gaaFor(gaa, gaaYear), pw });
      const draw = () => {
        if (!document.body.contains(root)) return;
        const d = collect(), doc = docOf(d);
        const docs = which ? doc.docs.filter((x) => x.key === which) : doc.docs;
        $('#b-paper', root).innerHTML = docs.map((x) => {
          const pages = paginate(x, measure);
          return `<div class="doc-label">${esc(x.title)}${pages.length > 1 ? ` (${pages.length} pages)` : ''}</div>` +
            pages.map((items) => `<div class="sheet bsheet"><div class="aom-doc bl">${docHTML({ items })}</div></div>`).join('');
        }).join('');
        drawGaa(d);
        const miss = trMissing(d, gaa, gaaYear);
        $('#b-p01', root).innerHTML = p01Pill(miss);
        $('#b-p01', root).title = miss.length ? 'Still needed: ' + miss.join(', ') : '';
        const t = d.tr, w = [];
        if (t.atlDate && t.saDate && t.saDate < t.atlDate) w.push('The letter to the Punong Barangay is dated before the letter to the SA.');
        if (t.confDate && ((t.atlDate && t.atlDate < t.confDate) || (t.saDate && t.saDate < t.confDate))) w.push('A letter is dated before the exit conference.');
        $('#b-datewarn', root).innerHTML = w.length ? `<div class="note warn">${w.map(esc).join(' ')} Please check the dates.</div>` : '';
      };
      // The GAA cited in Paragraph 6.
      function drawGaa(d) {
        const box = $('#b-gaa', root); if (!box) return;
        const g = gaaFor(gaa, gaaYear), typed = TYPED_GAA.exec(d.tr.sa6 || '');
        const uses = /\[GAA\]/.test(d.tr.sa6 || '');
        let html = `<div class="lr-row"><b>GAA Cited in Paragraph 6</b>${gaaComplete(g) ? '<button class="btn sm ghost" type="button" data-gaa="open">GAA References</button>' : `<button class="btn sm primary" type="button" data-gaa="open">${g ? 'Complete' : 'Add'} GAA FY ${gaaYear}</button>`}</div>`;
        if (uses) html += gaaComplete(g) ? `<div>${esc(gaaText(g))}</div>`
          : `<div class="note bad" style="margin:0;display:block"><b>No complete GAA for Fiscal Year ${gaaYear} in the list yet.</b> Add its R.A. number and section before printing. Until then the letter prints a blank line in its place.</div>`;
        else if (typed && Number(typed[1]) !== gaaYear) html += `<div class="note warn" style="margin:0;display:block">Paragraph 6 cites <b>Fiscal Year ${esc(typed[1])}</b>, but this BAAR should cite <b>Fiscal Year ${gaaYear}</b>. ${canEdit ? '<button class="btn sm" type="button" data-gaa="use">Use [GAA] Instead</button>' : ''}</div>`;
        else html += `<div class="hint">Paragraph 6 has the GAA typed in. ${canEdit ? '<button class="btn sm ghost" type="button" data-gaa="use">Use [GAA] Instead</button>' : ''}</div>`;
        if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; }
        box.classList.toggle('bad-box', uses && !gaaComplete(g));
      }
      async function editGaa() {
        const r = await openReportWording({ me, tab: 'gaa', year: gaaYear, teamId: ctx.teamId });
        if (!r) return;
        gaa = r.gaa; pw = r.pw;
        $('#b-period', root).textContent = periodEnded(audit.periodFrom, audit.periodTo, pw);
        draw();
      }
      $('#b-gaa', root).addEventListener('click', (e) => {
        const b = e.target.closest('[data-gaa]'); if (!b) return;
        if (b.dataset.gaa === 'open') { editGaa(); return; }
        const ta = $('#b-sa6', root);
        ta.value = TYPED_GAA.test(ta.value) ? ta.value.replace(TYPED_GAA, '[GAA]') : standard.sa6;
        changed();
      });
      async function save() {
        const d = collect();
        // Part 04's saved data stays as it is (only what was saved there, not the standard wording shown).
        const cur = await store.get('letters', recId(ctx.rec.id));
        const out = { ...d, iar: cur && !cur.deleted ? cur.data.iar : undefined, smr: cur && !cur.deleted ? cur.data.smr : undefined };
        if (out.iar === undefined) delete out.iar;
        if (out.smr === undefined) delete out.smr;
        await store.save('letters', recId(ctx.rec.id), out, { silent: true });
        Object.assign(B, clone(d)); Object.assign(T, d.tr);
        await store.log('saved the BAAR transmittal letters', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      const changed = () => { if (!canEdit) return; setDirty(true, save); draw(); };
      root.querySelector('.xform').addEventListener('input', changed);
      root.querySelector('.xform').addEventListener('change', changed);
      $$('[data-op]', root).forEach((b) => { b.onclick = () => {
        keepOp(); op = b.dataset.op;
        $$('[data-op]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        showOp(); changed();
      }; });
      $$('[data-wl]', root).forEach((b) => { b.onclick = () => {
        $$('[data-wl]', root).forEach((x) => x.classList.toggle('on', x === b));
        $$('.bw', root).forEach((f) => { f.hidden = f.dataset.w !== b.dataset.wl; });
      }; });
      $$('#b-which [data-d]', root).forEach((b) => { b.onclick = () => {
        which = b.dataset.d; $$('#b-which [data-d]', root).forEach((x) => x.classList.toggle('on', x === b)); draw();
      }; });
      const save1 = $('#b-save', root); if (save1) save1.onclick = save;
      const reset = $('#b-reset', root);
      if (reset) reset.onclick = () => {
        TR_KEYS.forEach((k) => { const el = $('#b-' + k, root); if (el) el.value = standard[k]; });
        if (op) { T.opSent[op] = clone(stdOp[op]); showOp(); }
        changed(); toast('Standard wording put back. Click Save to keep it.', 'ok');
      };
      const stdBtn = $('#b-std', root);
      if (stdBtn) stdBtn.onclick = async () => {
        if (!(await confirmBox('Save as Standard', 'Use this wording, the Copy furnished lines and the opinion sentences for every new BAAR transmittal from now on? BAARs already started keep their own wording.', 'Save as Standard', 'success'))) return;
        const d = collect();
        const wording = Object.fromEntries(TR_KEYS.map((k) => [k, d.tr[k]]));
        const opSent = Object.fromEntries(OPINIONS.map((o) => [o, (d.tr.opSent[o] && ((d.tr.opSent[o].sa || '').trim() || (d.tr.opSent[o].atl || '').trim())) ? d.tr.opSent[o] : stdOp[o]]));
        await store.save('letters', stdId(ctx.teamId), { type: 'standard', kind: 'baar-tr', teamId: ctx.teamId, wording, opSent, savedBy: me.email, savedAt: new Date().toISOString() }, { silent: true });
        await store.log('saved the standard BAAR transmittal wording', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        Object.assign(standard, wording); Object.assign(stdOp, clone(opSent));
        toast('Saved as the standard wording for new BAARs.', 'ok');
      };
      $('#b-print', root).onclick = async () => {
        const d = collect(); printTransmittal(docOf(d), which, `BAAR ${audit.auditYear} · ${lgu.name} · 01 Transmittal Letters`);
        await store.log('printed the BAAR transmittal letters', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      $('#b-word', root).onclick = async () => {
        const d = collect();
        try { toast('Preparing the Word file…'); await transmittalWord(docOf(d), which); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the BAAR transmittal letters (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      showOp();
      draw();
      setDirty(false, save);
      void isNew; void longDate; void nice;
    }
  };
}

/* ── Part 02 · Cover ── */
function coverPart({ ctx, me, pw, st }) {
  const { audit, lgu, mun } = ctx;
  const c = buildCover({ audit, lgu, mun, pw });
  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>02 · Cover</b>`;
  const body = `${baarHead(ctx)}
    <section class="panel" style="padding:10px 12px">${partsStrip(ctx.rec.id, '02', st)}</section>
    <div class="topnote">The cover fills in by itself from Audit Setup. Nothing needs to be typed here.</div>
    <div class="xcols bcols"><div class="xform">
      <section class="panel"><div class="panel-head"><h2>On the Cover</h2></div><div class="panel-body">
        <div class="ro"><span>Barangay</span><b>${esc(c.brgy)}</b><span>Municipality</span><b>${esc(c.mun)}</b><span>Period</span><b>${esc(c.period)}</b></div></div></section></div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="c-print" type="button">Print</button><button class="btn sm primary" id="c-word" type="button">Word</button></span></div>
        <div class="paper-wrap big"><div class="sheet csheet">${coverHTML(c)}</div></div></div></div>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      wireComplete(root, ctx, me);
      $('#c-print', root).onclick = async () => { printCover(c, `BAAR ${audit.auditYear} · ${lgu.name} · 02 Cover`); await store.log('printed the BAAR cover', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email); };
      $('#c-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); await coverWord(c); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the BAAR cover (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
    }
  };
}

/* ── Part 03 · Table of Contents ── */
function tocPart({ ctx, me, pw, st, L }) {
  const { audit, lgu, mun } = ctx;
  const t = buildToc({ audit, lgu, mun, pw, pages: baarPages(ctx, L), annexes: baarAnnexes() });
  const status03 = t.missing ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok');
  const rows = t.rows.map((r) => r.k === 'part'
    ? `<tr class="h"><td>${esc(r.text)}${/PART IV/.test(r.text) ? ' <span class="hint" style="font-weight:400">(only the annexes added in Part 10)</span>' : ''}</td><td class="p">${r.pageHead ? '' : esc(r.page || '')}</td></tr>`
    : `<tr><td>${esc(r.text.replace(/ for Financial Statements$/, ''))}</td><td class="p">${esc(r.page)}</td></tr>`).join('');
  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>03 · Table of Contents</b>`;
  const body = `${baarHead(ctx)}
    <section class="panel" style="padding:10px 12px">${partsStrip(ctx.rec.id, '03', { ...st, '03': status03 })}</section>
    <div class="topnote">Page numbers fill in by themselves from the parts of this BAAR.</div>
    <div class="xcols bcols"><div class="xform">
      <section class="panel"><div class="panel-head"><h2>Page Numbers</h2></div><div class="panel-body" style="padding-top:6px">
        <table class="pgt"><tbody>${rows}</tbody></table>
        ${t.missing ? '<span class="hint">A part not built yet has no page number until it is built.</span>' : ''}</div></section></div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="t-print" type="button">Print</button><button class="btn sm primary" id="t-word" type="button">Word</button></span></div>
        <div class="paper-wrap big"><div class="sheet tsheet">${tocHTML(t)}</div></div></div></div>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      wireComplete(root, ctx, me);
      $('#t-print', root).onclick = async () => { printToc(t, `BAAR ${audit.auditYear} · ${lgu.name} · 03 Table of Contents`); await store.log('printed the BAAR table of contents', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email); };
      $('#t-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); await tocWord(t); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the BAAR table of contents (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
    }
  };
}

/* ── Part 04 · Independent Auditor's Report ── */
function iarPart({ ctx, me, refs, L, st }) {
  const { audit, lgu, mun } = ctx;
  const { B, I, iStandard, iStdOp } = L;
  const canEdit = myTeamIds(me, refs.teams).includes(ctx.teamId);
  const canStd = has(me, 'sa') || has(me, 'admin');
  const dis = canEdit ? '' : 'disabled';
  const list = basesList(ctx, I);
  const ta = (id, label, rows = 3) => `<div class="field"><label class="label" for="i-${id}">${label}</label><textarea class="input be-text" id="i-${id}" rows="${rows}" ${dis}>${esc(I[id])}</textarea></div>`;
  const basesHTML = list.length ? list.map((b) => `<div class="basis ${b.on ? '' : 'dim'}" data-b="${b.id}"><input type="checkbox" data-bon="${b.id}" ${b.on ? 'checked' : ''} aria-label="Include ${esc(b.no)}" ${dis}>
      <div><div class="src">AOM No. ${esc(b.no)} · ${esc(SECTIONS[b.sec] || '')} · ${esc(b.title)}${b.amount !== null ? ' · ' + esc(peso(b.amount)) : ''}</div>
      <textarea class="input be-text" data-btx="${b.id}" rows="3" ${dis}>${esc(b.text)}</textarea>
      ${canEdit ? `<button class="reset" type="button" data-bre="${b.id}" ${b.text === b.own ? 'hidden' : ''}>Back to the AOM wording</button>` : ''}</div></div>`).join('')
    : '<div class="empty">No Final AOMs yet.</div>';
  const atlLine = ctx.atl ? [nice(ctx.atl.name), ctx.atl.designation || ctx.atl.position].filter(Boolean).map((x) => esc(x)).join(' · ') : 'No Audit Team Leader in Users';
  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>04 · Independent Auditor's Report</b>`;
  const body = `${baarHead(ctx)}
    <section class="panel" style="padding:10px 12px">${partsStrip(ctx.rec.id, '04', { ...st, '04': '' })}</section>
    <div class="topnote">Words in [brackets] fill in by themselves. The opinion is the same one chosen in Part 01. Changes apply to this BAAR only, unless you click Save as Standard.</div>
    <div class="xcols bcols"><div class="xform">
      <section class="panel"><div class="panel-head"><h2>Opinion</h2></div><div class="panel-body">
        <div class="lr-row"><span class="label" style="margin:0;white-space:nowrap">Auditor's Opinion</span>
          <div class="seg bop" role="group" aria-label="Auditor's Opinion">${OPINIONS.map((o) => `<button type="button" data-op="${o}" class="${B.opinion === o ? 'on' : ''}" aria-pressed="${B.opinion === o}" ${dis}>${o}</button>`).join('')}</div></div>
        <div class="field"><label class="label" for="i-op">Opinion Paragraph</label><textarea class="input be-text" id="i-op" rows="5" ${dis}></textarea></div>
        <span class="hint" id="i-ophint"></span></div></section>
      <section class="panel" id="i-bases"><div class="panel-head"><h2 id="i-bhead"></h2><span class="pill violet" id="i-bcount" style="margin-left:auto"></span></div>
        <div class="panel-body" style="padding-top:4px">${basesHTML}</div></section>
      <section class="panel"><div class="panel-head"><h2>Report Date</h2></div><div class="panel-body"><div class="grid-2">
        <div class="field"><label class="label" for="i-date">Date of the Report</label><input class="input" type="date" id="i-date" value="${esc(I.date || '')}" ${dis}></div>
        <div class="field"><span class="label">Signed By</span><div class="bval">${atlLine}</div></div></div></div></section>
      <section class="panel"><div class="panel-head"><h2>Wording</h2><span class="btn-row" style="margin-left:auto">${canStd && canEdit ? '<button class="btn sm ghost" id="i-std" type="button">Save as Standard</button>' : ''}${canEdit ? '<button class="btn sm ghost" id="i-reset" type="button">Reset to Standard</button>' : ''}</span></div><div class="panel-body">
        ${ta('open', 'Opening Paragraph', 4)}${ta('basesIntro', 'Bases · Introduction', 2)}${ta('conducted', 'We Conducted Our Audit…', 5)}${ta('kam', 'Key Audit Matters', 3)}
        ${ta('mgmt', 'Responsibilities of Management and Those Charged with Governance', 6)}${ta('aud', 'Auditor’s Responsibilities', 6)}</div></section>
      ${canEdit ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
        <div class="btn-row" style="margin-left:auto"><button class="btn primary" id="i-save" type="button">Save</button></div></div>` : ''}</div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="i-print" type="button">Print</button><button class="btn sm primary" id="i-word" type="button">Word</button></span></div>
        <div class="paper-wrap big" id="i-paper"></div></div></div>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      wireComplete(root, ctx, me);
      let op = B.opinion || '';
      const opBox = $('#i-op', root);
      const keepOp = () => { if (op) I.opSent[op] = opBox.value; };
      const showOp = () => {
        opBox.value = op ? (I.opSent[op] || '') : ''; opBox.disabled = !op || !canEdit;
        const h = $('#i-ophint', root);
        h.textContent = !op ? 'Choose the opinion first.' : String(I.opSent[op] || '').trim() ? '' : `Type the ${op} opinion paragraph the first time. ${canStd ? 'Click Save as Standard to keep it for every BAAR.' : 'Your SA can save it as standard.'}`;
        h.hidden = !h.textContent;
        $('#i-bases', root).hidden = !op || op === 'Unmodified';
        $('#i-bhead', root).textContent = BASES_HEAD[op] || 'Bases';
      };
      const collect = () => {
        keepOp();
        const i = { ...I, opSent: { ...I.opSent }, bases: {} };
        IAR_KEYS.forEach((k) => { const el = $('#i-' + k, root); if (el) i[k] = el.value; });
        i.date = $('#i-date', root).value;
        list.forEach((b) => { const on = $(`[data-bon="${b.id}"]`, root).checked, text = $(`[data-btx="${b.id}"]`, root).value;
          i.bases[b.id] = { on, text: text === b.own ? undefined : text }; });
        return { ...B, opinion: op, iar: i };
      };
      const ia = (d) => buildIar({ iar: d.iar, opinion: d.opinion, audit, lgu, mun, atl: ctx.atl, pb: { title: '', name: L.T.pbName },
        bases: list.filter((b) => $(`[data-bon="${b.id}"]`, root).checked).map((b) => ({ text: $(`[data-btx="${b.id}"]`, root).value })) });
      const draw = () => {
        if (!document.body.contains(root)) return;
        const d = collect(), r = ia(d);
        const pages = paginateIar(r.items, measureBox());
        const html = iarPagesHTML(r, pages, 1);
        $('#i-paper', root).innerHTML = `<div class="doc-label">Part I page (not numbered)</div><div class="sheet isheet">${html[0]}</div>` +
          `<div class="doc-label">Independent Auditor's Report (page${pages.length > 1 ? 's 1–' + pages.length : ' 1'})</div>` + html.slice(1).map((x) => `<div class="sheet isheet">${x}</div>`).join('');
        const n = list.filter((b) => $(`[data-bon="${b.id}"]`, root).checked).length;
        $('#i-bcount', root).textContent = `${n} ticked`;
        $$('[data-b]', root).forEach((x) => x.classList.toggle('dim', !$(`[data-bon="${x.dataset.b}"]`, root).checked));
        list.forEach((b) => { const r1 = $(`[data-bre="${b.id}"]`, root); if (r1) r1.hidden = $(`[data-btx="${b.id}"]`, root).value === b.own; });
        const ld = { ...d.iar, bases: Object.fromEntries(list.map((b) => [b.id, { on: $(`[data-bon="${b.id}"]`, root).checked }])) };
        const miss = iarMissing(op, ld, list.map((b) => ({ on: $(`[data-bon="${b.id}"]`, root).checked })));
        $('#b-p04', root).innerHTML = p04Pill(miss); $('#b-p04', root).title = miss.length ? 'Still needed: ' + miss.join(', ') : '';
      };
      async function save() {
        const d = collect();
        const clean = { ...d.iar, bases: Object.fromEntries(Object.entries(d.iar.bases).map(([k, v]) => [k, v.text === undefined ? { on: v.on } : v])) };
        const rec = await store.get('letters', recId(ctx.rec.id));
        const base = rec && !rec.deleted ? rec.data : { type: 'baar', auditId: ctx.rec.id, teamId: ctx.teamId, tr: {} };
        await store.save('letters', recId(ctx.rec.id), { ...base, opinion: d.opinion, iar: clean }, { silent: true });   // other parts' saved data stays
        B.opinion = d.opinion; Object.assign(I, clone(clean));
        await store.log('saved the Independent Auditor’s Report', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      const changed = () => { if (!canEdit) return; setDirty(true, save); draw(); };
      root.querySelector('.xform').addEventListener('input', changed);
      root.querySelector('.xform').addEventListener('change', changed);
      $$('[data-op]', root).forEach((b) => { b.onclick = () => {
        keepOp(); op = b.dataset.op;
        $$('[data-op]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        showOp(); changed();
      }; });
      $$('[data-bre]', root).forEach((b) => { b.onclick = () => { const x = list.find((y) => y.id === b.dataset.bre); $(`[data-btx="${x.id}"]`, root).value = x.own; changed(); }; });
      const sv = $('#i-save', root); if (sv) sv.onclick = save;
      const rs = $('#i-reset', root);
      if (rs) rs.onclick = () => { IAR_KEYS.forEach((k) => { $('#i-' + k, root).value = iStandard[k]; }); if (op) { I.opSent[op] = iStdOp[op] || ''; showOp(); } changed(); toast('Standard wording put back. Click Save to keep it.', 'ok'); };
      const st = $('#i-std', root);
      if (st) st.onclick = async () => {
        if (!(await confirmBox('Save as Standard', 'Use this wording and the opinion paragraphs for every new Independent Auditor’s Report from now on? BAARs already started keep their own wording.', 'Save as Standard', 'success'))) return;
        const d = collect();
        const wording = Object.fromEntries(IAR_KEYS.map((k) => [k, d.iar[k]]));
        const opSent = Object.fromEntries(OPINIONS.map((o) => [o, String(d.iar.opSent[o] || '').trim() ? d.iar.opSent[o] : (iStdOp[o] || '')]));
        await store.save('letters', iarStdId(ctx.teamId), { type: 'standard', kind: 'baar-iar', teamId: ctx.teamId, wording, opSent, savedBy: me.email, savedAt: new Date().toISOString() }, { silent: true });
        await store.log('saved the standard Independent Auditor’s Report wording', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        Object.assign(iStandard, wording); Object.assign(iStdOp, opSent);
        toast('Saved as the standard wording for new BAARs.', 'ok');
      };
      const cur = () => { const d = collect(); return ia(d); };
      $('#i-print', root).onclick = async () => { const r = cur(); const p = iarPrint(r, paginateIar(r.items, measureBox())); printPages(p.css, p.html, `BAAR ${audit.auditYear} · ${lgu.name} · 04 Independent Auditor's Report`);
        await store.log('printed the Independent Auditor’s Report', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email); };
      $('#i-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); const r = cur(); await saveDocx(await iarSections(r), r.fileName, 'BAAR Independent Auditor’s Report'); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the Independent Auditor’s Report (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      showOp(); draw(); setDirty(false, save);
    }
  };
}

/* ── Part 05 · Statement of Management Responsibility ── */
function smrPart({ ctx, me, refs, L, st }) {
  const { audit, lgu, mun } = ctx;
  const { S, sStandard } = L;
  const canEdit = myTeamIds(me, refs.teams).includes(ctx.teamId);
  const canStd = has(me, 'sa') || has(me, 'admin');
  const dis = canEdit ? '' : 'disabled';
  const sg = smrSigners(audit);
  const pages = baarPages(ctx, L);
  const f = S.file;
  const fileBox = f
    ? `<div class="lr-row"><span><b style="color:var(--navy)">📄 ${esc(f.name)}</b><br><span class="hint">${f.pages} page${f.pages === 1 ? '' : 's'} · uploaded by ${esc(nice(f.byName || f.by || ''))} · ${esc(longDate((f.at || '').slice(0, 10)))}</span></span>
        <span class="btn-row"><button class="btn sm ghost" type="button" id="s-view">View</button>${canEdit ? '<button class="btn sm ghost" type="button" id="s-replace">Replace</button><button class="btn sm ghost" type="button" id="s-remove">Remove</button>' : ''}</span></div>`
    : `<div class="lr-row"><span class="hint">PDF only. If the barangay sends a Word file, open it in Word and choose Save as PDF first.</span>${canEdit ? '<button class="btn sm primary" type="button" id="s-upload">Upload Signed Copy</button>' : ''}</div>`;
  const ta = (id, label, rows) => `<div class="field"><label class="label" for="s-${id}">${label}</label><textarea class="input be-text" id="s-${id}" rows="${rows}" ${dis}>${esc(S[id])}</textarea></div>`;
  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>05 · Management's Responsibility</b>`;
  const body = `${baarHead(ctx)}
    <section class="panel" style="padding:10px 12px">${partsStrip(ctx.rec.id, '05', st)}</section>
    <div class="topnote">Upload the signed copy from the barangay as a PDF. Before it comes back, print the blank statement for signing. Changes apply to this BAAR only, unless you click Save as Standard.</div>
    <div class="xcols bcols"><div class="xform">
      <section class="panel"><div class="panel-head"><h2>Signed Copy</h2><span style="margin-left:auto">${st['05']}</span></div><div class="panel-body">
        ${fileBox}
        <input type="file" id="s-file" accept="application/pdf,.pdf" hidden>
        <div class="lr-row" style="border-top:1px solid var(--line-2);padding-top:10px"><span class="hint">Before the signed copy comes back:</span><button class="btn sm ghost" type="button" id="s-blank">Print Blank for Signing</button></div></div></section>
      <section class="panel"><div class="panel-head"><h2>Signatories</h2><a class="btn sm ghost" style="margin-left:auto" href="#/audits/${ctx.rec.id}/setup">Edit in Setup</a></div><div class="panel-body" style="padding-top:6px">
        <table class="pgt"><tbody>
          <tr><td style="width:45%"><b>${esc(nice(sg.acct)) || '<span class="hint">No Municipal Accountant in Setup</span>'}</b></td><td><input class="input" id="s-acct" value="${esc(S.acct)}" aria-label="Title" ${dis}></td></tr>
          <tr><td><b>${esc(nice(sg.pb)) || '<span class="hint">No Punong Barangay in Setup</span>'}</b></td><td><input class="input" id="s-pb" value="${esc(S.pb)}" aria-label="Title" ${dis}></td></tr>
          <tr><td><b>${esc(nice(sg.treas)) || '<span class="hint">No Barangay Treasurer in Setup</span>'}</b></td><td><input class="input" id="s-treas" value="${esc(S.treas)}" aria-label="Title" ${dis}></td></tr></tbody></table>
        <span class="hint">Used for the blank statement. The title under each name can be changed.</span></div></section>
      <section class="panel"><div class="panel-head"><h2>Wording</h2><span class="btn-row" style="margin-left:auto">${canStd && canEdit ? '<button class="btn sm ghost" id="s-std" type="button">Save as Standard</button>' : ''}${canEdit ? '<button class="btn sm ghost" id="s-reset" type="button">Reset to Standard</button>' : ''}</span></div><div class="panel-body">
        ${ta('text', 'Statement', 10)}</div></section>
      ${canEdit ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
        <div class="btn-row" style="margin-left:auto"><button class="btn primary" id="s-save" type="button">Save</button></div></div>` : ''}</div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="s-print" type="button">Print</button><button class="btn sm primary" id="s-word" type="button">Word</button></span></div>
        <div class="paper-wrap big" id="s-paper"></div></div></div>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      wireComplete(root, ctx, me);
      let imgs = null;
      const collect = () => { const s = { ...S }; SMR_KEYS.forEach((k) => { const el = $('#s-' + k, root); if (el) s[k] = el.value; }); return s; };
      const doc = () => buildSmr({ s: collect(), audit, lgu, mun });
      const draw = () => {
        if (!document.body.contains(root)) return;
        $('#s-paper', root).innerHTML = imgs
          ? `<div class="doc-label">Signed copy as uploaded (page${imgs.length > 1 ? 's ' + pages.smr + '–' + (pages.smr + imgs.length - 1) : ' ' + pages.smr})</div>` + scanPagesHTML(imgs, pages.smr).map((x) => `<div class="sheet isheet">${x}</div>`).join('')
          : `<div class="doc-label">Blank statement for signing${f ? '' : ' · no signed copy uploaded yet'}</div><div class="sheet isheet">${smrPageHTML(doc(), 0)}</div>`;
      };
      const saveRec = async (patch, what) => {
        const cur = await store.get('letters', recId(ctx.rec.id));
        const base = cur && !cur.deleted ? cur.data : { type: 'baar', auditId: ctx.rec.id, teamId: ctx.teamId, tr: {} };
        await store.save('letters', recId(ctx.rec.id), { ...base, smr: { ...(base.smr || {}), ...patch } }, { silent: true });
        await store.log(what, `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      async function save() {
        const s = collect(); const patch = Object.fromEntries(SMR_KEYS.map((k) => [k, s[k]]));
        await saveRec(patch, 'saved the Statement of Management Responsibility wording');
        Object.assign(S, patch); setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      const changed = () => { if (!canEdit) return; setDirty(true, save); draw(); };
      root.querySelector('.xform').addEventListener('input', (e) => { if (e.target.id !== 's-file') changed(); });
      const fileInput = $('#s-file', root);
      const pick = () => fileInput.click();
      const up = $('#s-upload', root); if (up) up.onclick = pick;
      const rp = $('#s-replace', root); if (rp) rp.onclick = pick;
      fileInput.onchange = async () => {
        const file = fileInput.files[0]; fileInput.value = ''; if (!file) return;
        try {
          toast('Uploading the signed copy…');
          const out = await uploadPdf(file, { teamId: ctx.teamId, auditId: ctx.rec.id, kind: 'smr' });
          const old = f && f.fileId;
          await saveRec({ file: { ...out, by: me.email, byName: me.name, at: new Date().toISOString() } }, old ? 'replaced the signed Statement of Management Responsibility' : 'uploaded the signed Statement of Management Responsibility');
          if (old) await removeFile(old);
          setDirty(false); toast('Signed copy uploaded.', 'ok'); emitChange('local');
        } catch (e) { toast(e.message, 'bad'); }
      };
      const rm = $('#s-remove', root);
      if (rm) rm.onclick = async () => {
        if (!(await confirmBox('Remove Signed Copy', 'Remove the uploaded signed copy from this BAAR? It goes to the Drive trash of the office account and can be restored there for 30 days.', 'Remove'))) return;
        await removeFile(f.fileId);
        await saveRec({ file: null }, 'removed the signed Statement of Management Responsibility');
        setDirty(false); toast('Signed copy removed.', 'ok'); emitChange('local');
      };
      const vw = $('#s-view', root); if (vw) vw.onclick = () => openPdf(f.fileId).catch((e) => toast(e.message, 'bad'));
      $('#s-blank', root).onclick = () => { const p = smrPrint({ r: doc(), imgs: null, start: 0 }); printPages(p.css, p.html, `${lgu.name} · Statement of Management Responsibility (for signing)`); };
      const sv = $('#s-save', root); if (sv) sv.onclick = save;
      const rs = $('#s-reset', root); if (rs) rs.onclick = () => { SMR_KEYS.forEach((k) => { $('#s-' + k, root).value = sStandard[k]; }); changed(); toast('Standard wording put back. Click Save to keep it.', 'ok'); };
      const sd = $('#s-std', root);
      if (sd) sd.onclick = async () => {
        if (!(await confirmBox('Save as Standard', 'Use this statement and these titles for every new BAAR from now on? BAARs already started keep their own wording.', 'Save as Standard', 'success'))) return;
        const s = collect(); const wording = Object.fromEntries(SMR_KEYS.map((k) => [k, s[k]]));
        await store.save('letters', smrStdId(ctx.teamId), { type: 'standard', kind: 'baar-smr', teamId: ctx.teamId, wording, savedBy: me.email, savedAt: new Date().toISOString() }, { silent: true });
        await store.log('saved the standard Statement of Management Responsibility wording', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        Object.assign(sStandard, wording); toast('Saved as the standard wording for new BAARs.', 'ok');
      };
      const args = () => ({ r: doc(), imgs, start: pages.smr });
      $('#s-print', root).onclick = async () => { const p = smrPrint(args()); printPages(p.css, p.html, `BAAR ${audit.auditYear} · ${lgu.name} · 05 Management Responsibility`); await store.log('printed the Statement of Management Responsibility', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email); };
      $('#s-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); await saveDocx(await smrSections(args()), doc().fileName, 'Statement of Management Responsibility'); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the Statement of Management Responsibility (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      draw(); setDirty(false, save);
      if (f) { $('#s-paper', root).innerHTML = '<div class="empty">Opening the signed copy…</div>'; smrImages(S).then((x) => { imgs = x; draw(); }).catch((e) => { draw(); toast(e.message, 'bad'); }); }
    }
  };
}

/* ── Part 07 · Notes to Financial Statements ── */
export function notesPart({ ctx, me, refs, L, st }) {
  const { audit, lgu, mun } = ctx;
  const F = L.FS;
  const canEdit = myTeamIds(me, refs.teams).includes(ctx.teamId);
  const dis = canEdit ? '' : 'disabled';
  const N = clone(L.B.notes || {});
  N.km = N.km || {}; N.inv = N.inv || {}; N.ppe = N.ppe || {};
  const pages = baarPages(ctx, L);
  const doc0 = notesOf(ctx, L, N);
  const y = F.y, yp = F.yp;
  const hasPs = doc0.list.some((n) => n.id === 'ps'), hasInv = doc0.list.some((n) => n.id === 'inv');
  const pbN = punongBarangay(audit), sgN = sanggunian(audit), niN = audit.notesInfo || {};
  const ppeCols = ppeSchedule(F, N.ppe);
  const v = (o, k) => esc((o || {})[k] ?? '');
  const amtIn = (path, val, label) => `<input class="input amt-in" data-n="${path}" value="${esc(val ?? '')}" aria-label="${esc(label)}" ${dis}>`;
  const kmRows = KM.map(([k, label]) => `<tr><td>${esc(label)}</td><td>${amtIn(`km.${k}.cy`, (N.km[k] || {}).cy, `${label} CY ${y}`)}</td><td>${amtIn(`km.${k}.py`, (N.km[k] || {}).py, `${label} CY ${yp}`)}</td></tr>`).join('');
  const ppeTable = (yr, fields) => `<table class="pgt nt-ppe"><thead><tr><th>CY ${yr}</th>${fields.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>
      ${ppeCols.map((c) => `<tr><td>${esc(c.label)}</td>${fields.map(([f, t]) => `<td>${amtIn(`ppe.${c.k}.${f}`, (N.ppe[c.k] || {})[f], `${c.label} ${t} ${yr}`)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>07 · Notes to FS</b>`;
  const body = `${baarHead(ctx)}
    <section class="panel" style="padding:10px 12px">${partsStrip(ctx.rec.id, '07', st)}</section>
    <div class="topnote">The notes follow Annex 40 of the Manual on the Financial Management of Barangays. The tables come from the confirmed trial balances; type only the details below.</div>
    ${F.confirmed ? '' : `<div class="note warn" style="display:block">The financial statements are not yet confirmed. <a href="#/audits/${ctx.rec.id}/fs?v=1&s=results">Go to Financial Statements</a></div>`}
    <div class="xcols bcols"><div class="xform">
      <section class="panel"><div class="panel-head"><h2>Note 1 · General Information</h2><a class="btn sm ghost" style="margin-left:auto" href="#/audits/${ctx.rec.id}/setup">Edit in Setup</a></div><div class="panel-body">
        <table class="pgt"><tbody>
          <tr><td style="width:40%">Location</td><td>${esc(niN.loc || '') || '<span class="hint">Not yet in Setup</span>'}</td></tr>
          <tr><td>Date issued</td><td>${niN.issued ? esc(longDate(niN.issued)) : '<span class="hint">Not yet in Setup</span>'}</td></tr>
          <tr><td>Headed by</td><td>${esc([pbN.title, pbN.name].filter(Boolean).join(' ')) || '<span class="hint">Not yet in Setup</span>'}</td></tr>
          <tr><td>Sanggunian</td><td>${sgN.length} member${sgN.length === 1 ? '' : 's'}</td></tr></tbody></table>
        <span class="hint">From Audit Setup, step 4.</span></div></section>
      ${hasPs ? `<section class="panel"><div class="panel-head"><h2>Remuneration of Key Management Personnel</h2></div><div class="panel-body">
        <table class="pgt nt-km"><thead><tr><th></th><th>CY ${y}</th><th>CY ${yp}</th></tr></thead><tbody>${kmRows}</tbody></table></div></section>` : ''}
      ${hasInv ? `<section class="panel"><div class="panel-head"><h2>Inventories</h2></div><div class="panel-body">
        <div class="lr-row"><label class="label" for="n-inv-rec" style="margin:0">Inventories recognized during the period</label>${amtIn('inv.rec', N.inv.rec, 'Inventories recognized').replace('class="input amt-in"', 'id="n-inv-rec" class="input amt-in"')}</div>
        <div class="lr-row"><label class="label" for="n-inv-wd" style="margin:0">Write-down recognized as an expense</label>${amtIn('inv.wd', N.inv.wd, 'Write-down').replace('class="input amt-in"', 'id="n-inv-wd" class="input amt-in"')}</div>
        <span class="hint">Leave blank to leave the sentence out.</span></div></section>` : ''}
      ${ppeCols.length ? `<section class="panel"><div class="panel-head"><h2>Property, Plant and Equipment · Movements</h2></div><div class="panel-body">
        ${ppeTable(y, [['ca', 'Additions'], ['cd', 'Disposals'], ['ct', 'Transfers/Adj']])}
        ${ppeTable(`${y} · Depreciation`, [['dd', 'Disposals'], ['dt', 'Transfers/Adj']])}
        ${ppeTable(yp, [['pa', 'Additions'], ['pd', 'Disposals'], ['pt', 'Transfers/Adj']])}
        <span class="hint">Balances and depreciation for the year come from the trial balances. The results show any amount the movements do not explain.</span></div></section>` : ''}
      <section class="panel"><div class="panel-head"><h2>Notes Results</h2></div><div class="panel-body ck" id="n-checks"></div></section>
      ${canEdit ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
        <div class="btn-row" style="margin-left:auto"><button class="btn primary" id="n-save" type="button">Save</button></div></div>` : ''}</div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b><span class="hint" id="n-pg"></span>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="n-print" type="button">Print</button><button class="btn sm primary" id="n-word" type="button">Word</button></span></div>
        <style>${NOTES_CSS}</style><div class="paper-wrap big" id="n-paper"></div></div></div>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      wireComplete(root, ctx, me);
      const setPath = (o, path, val) => { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach((k) => { x[k] = x[k] || {}; x = x[k]; }); x[ks[ks.length - 1]] = val; };
      const collect = () => { $$('[data-n]', root).forEach((el) => setPath(N, el.dataset.n, el.value.trim())); return N; };
      const draw = () => {
        if (!document.body.contains(root)) return;
        const d = notesOf(ctx, L, collect());
        const { html, land } = notesPagesHTML(d, pages.notes);
        $('#n-paper', root).innerHTML = html.map((x, i) => `<div class="sheet fsheet${i === land ? ' land' : ''}">${x}</div>`).join('');
        $('#n-pg', root).textContent = html.length ? `Pages ${pages.notes}–${pages.notes + html.length - 1}` : '';
        $('#n-checks', root).innerHTML = d.checks.map((c) => `<span class="ck-${c.st}">${c.st === 'ok' ? '✓' : c.st === 'warn' ? '!' : c.st === 'info' ? '•' : '○'} ${esc(c.t)}</span>`).join('');
        const pl = $('#b-p07', root); if (pl) pl.innerHTML = notesPill(F, d);
      };
      async function save() {
        const cur = await store.get('letters', recId(ctx.rec.id));
        const base = cur && !cur.deleted ? cur.data : { type: 'baar', auditId: ctx.rec.id, teamId: ctx.teamId, tr: {} };
        await store.save('letters', recId(ctx.rec.id), { ...base, notes: clone(collect()) }, { silent: true });
        await store.log('saved the Notes to Financial Statements', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      let timer = null;
      const changed = () => { if (!canEdit) return; setDirty(true, save); clearTimeout(timer); timer = setTimeout(draw, 150); };
      root.querySelector('.xform').addEventListener('input', changed);
      const sv = $('#n-save', root); if (sv) sv.onclick = save;
      const fileName = notesFileName(audit, lgu, mun);
      $('#n-print', root).onclick = () => { const p = notesPrint(notesOf(ctx, L, collect()), pages.notes); printPages(p.css, p.html, fileName); };
      $('#n-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); await saveDocx(await notesSections(notesOf(ctx, L, collect()), pages.notes), fileName, 'Notes to Financial Statements'); }
        catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the Notes to Financial Statements (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      draw();
    }
  };
}
