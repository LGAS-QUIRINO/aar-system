// SAOR review and Final, the same as the AOM review trail: the member forwards the SAOR, the ATL and then the SA review it.
// The general wording the app suggests is a draft: the team saves each observation, the ATL and SA correct and approve,
// and at the SA's final approval the wording of each observation becomes that template's AOM Library wording.
// Until then the SAOR prints and goes to Word marked "DRAFT – For Review Only" and is not for the exit conference.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, guard, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { has, myTeamIds } from '../refs.js';
import { ST, statusPill, clone, ensureIds, snapshot, setupVars, formatVar, SETUP_VAR_NAMES } from '../aom.js';
import { mountReview, when } from '../reviewpane.js';
import { aomTrail, printTrail, trailWord } from '../reviewtrail.js';
import { nice, timeAgo } from '../format.js';
import { poolGroups, saveActiveVersion } from './library.js';
import { buildSaor, saorHTML, printSaor, saorWord, SAOR_CSS } from '../saor.js';

export const OPEN = [ST.DRAFT, ST.RETURNED];
export const saorId = (munId, year) => `saor-${munId}-${year}`;
const heavyId = (munId, year) => `saorrv-${munId}-${year}`;
const HEAVY = ['submitted', 'versions', 'comments', 'editedBy', 'history'];
const packV = (vs) => { const prev = {}; return (vs || []).map((v) => ({ ...v, blocks: (v.blocks || []).map((b) => { const same = prev[b.id] === b.text; prev[b.id] = b.text; return same ? { id: b.id, same: 1 } : b; }) })); };
const unpackV = (vs) => { const prev = {}; return (vs || []).map((v) => ({ ...v, blocks: (v.blocks || []).map((b) => { const x = b.same ? { ...prev[b.id] } : b; prev[b.id] = x; return x; }) })); };

/* ── Loading and saving ── */
// One SAOR (one municipality, one Audit Year): its saved wording, its review status, and everything the screens show.
export async function loadSaor(refs, munId, year) {
  const me = refs.me;
  const teams = myTeamIds(me, refs.teams);
  const munOf = (a) => refs.lgu[a.data.lguId]?.data.parentId;
  const list = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported && munOf(a) === munId && Number(a.data.auditYear) === Number(year));
  const mun = refs.lgu[munId]?.data || { name: '' };
  const teamId = list[0]?.data.teamId || teams[0];
  const team = refs.team[teamId]?.data || {};
  const aoms = (await store.list('aoms')).filter((a) => list.some((x) => x.id === a.data.auditId));
  const groups = await poolGroups();
  const templates = {};
  groups.forEach((g) => { if (g.active) templates[g.code] = g.active.data; });
  const srec = await store.get('letters', saorId(munId, year));
  const S = srec && !srec.deleted ? clone(srec.data) : { type: 'saor', teamId, munId, auditYear: Number(year), overrides: {} };
  S.overrides = S.overrides || {};
  S.review = S.review || { status: ST.DRAFT };
  const h = await store.get('letters', heavyId(munId, year));
  const H = h && !h.deleted ? h.data.review || {} : {};
  HEAVY.forEach((f) => { S.review[f] = f === 'versions' ? unpackV(H[f]) : H[f]; });
  const varsOf = (au) => (a) => {
    const v = {};
    const wp = a.data.wpData;
    if (wp && wp.vars) Object.entries(wp.vars).forEach(([k, x]) => { v[k] = formatVar(k, x.raw); });
    const base = setupVars(au.data, refs.lgu[au.data.lguId]?.data, mun);
    SETUP_VAR_NAMES.forEach((k) => { if (base[k]) v[k] = base[k]; });
    return v;
  };
  const model = buildSaor({ audits: list.map((au) => ({ rec: au, lgu: refs.lgu[au.data.lguId]?.data.name || '?', vars: varsOf(au) })), aoms, templates, overrides: S.overrides });
  const allObs = model.sections.flatMap((s) => s.obs);
  const status = S.review.status || ST.DRAFT;
  const ctx = { munId, year: Number(year), mun, list, aoms, teamId, team, groups, templates, S, model, allObs, status,
    oneStep: !!(team.atlUserId && team.atlUserId === team.saUserId),
    iAmATL: !!team.atlUserId && team.atlUserId === me.id, iAmSA: !!team.saUserId && team.saUserId === me.id,
    head: { mun: mun.name, year: Number(year), officeCode: team.officeCode || '', draft: status !== ST.FINAL },
    label: `${mun.name} · Audit Year ${year}`,
    nameOf: (e) => (e ? nice(refs.users.find((u) => u.data.email === e)?.data.name || e) : '') };
  return ctx;
}
// Save the SAOR: the wording and status in one record, the review rounds and comments in another (a sheet cell holds 50,000 characters).
export async function saveSaor(ctx, S0) {
  const S = clone(S0);
  const H = Object.fromEntries(HEAVY.map((f) => [f, f === 'versions' ? packV(S.review[f]) : S.review[f]]));
  HEAVY.forEach((f) => { delete S.review[f]; });
  await store.save('letters', heavyId(ctx.munId, ctx.year), { type: 'saor-review', teamId: ctx.teamId, munId: ctx.munId, auditYear: ctx.year, review: H }, { silent: true });
  await store.save('letters', saorId(ctx.munId, ctx.year), { ...S, type: 'saor', teamId: ctx.teamId, munId: ctx.munId, auditYear: ctx.year }, { silent: true });
}
export const histPush = (S, by, action) => { S.review.history = [...(S.review.history || []), { at: new Date().toISOString(), by, action }]; };

/* ── The wording that is reviewed: Observation and Recommendation of each observation in two or more barangays ── */
export function reviewBlocks(ctx) {
  return ctx.allObs.filter((o) => !o.single).flatMap((o) => [
    { id: `${o.key}|obs`, type: 'field', label: `${o.n}. ${o.title} · Observation`, text: o.obs },
    { id: `${o.key}|rec`, type: 'field', label: `${o.n}. ${o.title} · Recommendation`, text: o.rec }]);
}
function reviewDoc(ctx) {
  const R = ctx.S.review;
  return ensureIds({ title: `SAOR · ${ctx.label}`, status: R.status || ST.DRAFT, blocks: reviewBlocks(ctx), submitted: R.submitted || null,
    comments: clone(R.comments || []), editedBy: clone(R.editedBy || {}), history: clone(R.history || []), versions: clone(R.versions || []),
    returnNote: R.returnNote, forwardedAt: R.forwardedAt, forwardedBy: R.forwardedBy });
}
function snap(ctx, S, step, email) {
  const d = { title: `SAOR · ${ctx.label}`, blocks: reviewBlocks(ctx), editedBy: S.review.editedBy || {}, versions: S.review.versions || [] };
  snapshot(d, step, email);
  S.review.versions = d.versions;
}
// Put corrected wording back into the SAOR (one block = the Observation or the Recommendation of one observation).
export function applyBlock(ctx, S, id, text, email) {
  const [key, f] = id.split('|');
  const o = ctx.allObs.find((x) => x.key === key);
  if (!o) return;
  const ov = { obs: o.obs, rec: o.rec, ...(S.overrides[key] || {}) };
  ov[f] = text; ov.by = email; ov.at = new Date().toISOString();
  S.overrides[key] = ov;
}

/* ── Forward, retrieve, reopen (from the SAOR screen) ── */
export async function forwardSaor(ctx, me) {
  let note = '';
  const r = await modal({ title: 'Forward SAOR to ATL',
    body: `<p style="margin:0 0 8px">The SAOR of ${esc(ctx.label)} goes to the Audit Team Leader for review. It cannot be changed while it is being reviewed.</p>
      <div class="field"><label class="label" for="sv-note">Note to the ATL (optional)</label><textarea class="input be-text" id="sv-note" rows="3"></textarea></div>
      <span class="hint">You can retrieve it until the ATL opens it.</span>`,
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Forward to ATL', cls: 'primary', value: 'ok', check: (bg) => { note = $('#sv-note', bg).value.trim(); return true; } }] });
  if (r !== 'ok') return false;
  const S = ctx.S, now = new Date().toISOString(), again = S.review.status === ST.RETURNED;
  snap(ctx, S, again ? 'Corrected by the member and forwarded again' : 'Forwarded for review', me.email);
  S.review.submitted = { title: `SAOR · ${ctx.label}`, blocks: reviewBlocks(ctx) };
  Object.assign(S.review, { status: ST.WITH_ATL, forwardedAt: now, forwardedBy: me.email, note, returnNote: '', openedAt: null });
  histPush(S, me.email, again ? 'Forwarded again to the ATL' : 'Forwarded to the ATL');
  await saveSaor(ctx, S);
  await store.log('forwarded the SAOR for review', ctx.label, ctx.teamId, me.email);
  toast('Forwarded to the ATL.', 'ok'); emitChange('local');
  return true;
}
export async function retrieveSaor(ctx, me) {
  if (!(await confirmBox('Retrieve SAOR', 'Take back the SAOR? The ATL has not opened it yet. You can forward it again later.', 'Retrieve'))) return;
  const S = ctx.S;
  S.review.status = ST.DRAFT;
  histPush(S, me.email, 'Retrieved by the member');
  await saveSaor(ctx, S);
  toast('Retrieved.', 'ok'); emitChange('local');
}
export async function reopenSaor(ctx, me) {
  if (!(await confirmBox('Reopen Final SAOR', 'Reopen the SAOR for correction? It goes back to SA review and prints as a draft again. Approve it again when done. The trail keeps both versions.', 'Reopen'))) return;
  const S = ctx.S;
  Object.assign(S.review, { status: ST.SA, finalAt: null, finalBy: null });
  histPush(S, me.email, 'Reopened by the SA');
  await saveSaor(ctx, S);
  await store.log('reopened the Final SAOR', ctx.label, ctx.teamId, me.email);
  toast('Reopened.', 'ok'); location.hash = `#/saor-review?m=${encodeURIComponent(ctx.munId)}&y=${ctx.year}`;
}

/* ── Review Trail (printout or Word with Track Changes) ── */
export async function saorTrail(ctx, refs, how) {
  const doc = reviewDoc(ctx);
  const t = aomTrail({ data: doc }, { no: 'SAOR', head: `SAOR · ${ctx.label}`, finalHead: 'SAOR', vars: {}, nameOf: ctx.nameOf, finalBlocks: reviewBlocks(ctx) });
  const file = { heading: 'SAOR REVIEW TRAIL', title: 'SAOR Review Trail · ' + ctx.label, place: `Barangays of ${ctx.mun.name}, Quirino · Audit Year ${ctx.year}`,
    included: `Included: the general wording of ${ctx.allObs.filter((o) => !o.single).length} observation${ctx.allObs.filter((o) => !o.single).length === 1 ? '' : 's'} found in two or more barangays`, trails: [t],
    footer: `${ctx.mun.name} · SAOR Review Trail`, fileName: `${String(ctx.mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_SAOR_${ctx.year}_Review_Trail` };
  if (how === 'print') printTrail(file);
  else { try { toast('Preparing the Word file…'); await trailWord(file); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; } }
  await store.log(how === 'print' ? 'printed the SAOR review trail' : 'downloaded the SAOR review trail (Word)', ctx.label, ctx.teamId, refs.me.email);
}
export async function trailModal(ctx, refs) {
  const r = await modal({ title: 'Review Trail · SAOR', body: '<p style="margin:0">The history, each round of corrections with initials, the comments and replies, and the final wording. Marked "REVIEW TRAIL – Not for Issuance".</p>',
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Print', cls: 'ghost', value: 'print' }, { label: 'Word (Track Changes)', cls: 'primary', value: 'word' }] });
  if (r) await saorTrail(ctx, refs, r);
}

/* ── At the SA's final approval: the wording of each observation becomes its template's AOM Library wording ── */
async function saveToLibrary(ctx, refs) {
  const done = [];
  for (const o of ctx.allObs) {
    if (o.single || !o.code) continue;
    const g = ctx.groups.find((x) => x.code === o.code);
    if (!g || !g.active) continue;
    const a = g.active.data;
    if ((a.saor || '').trim() === o.obs.trim() && (a.saorRec || '').trim() === o.rec.trim()) continue;
    await saveActiveVersion(g, { ...clone(a), saor: o.obs.trim(), saorRec: o.rec.trim(), note: `SAOR wording approved as Final · ${ctx.label}` }, refs);
    done.push(o.code);
  }
  return done;
}

/* ── For My Review: SAORs waiting for this person ── */
export async function saorQueue(refs) {
  const me = refs.me;
  if (!has(me, 'atl') && !has(me, 'sa')) return [];
  const teams = myTeamIds(me, refs.teams);
  return (await store.list('letters')).filter((l) => !l.deleted && l.data.type === 'saor' && teams.includes(l.data.teamId) && l.data.review).filter((l) => {
    const t = refs.team[l.data.teamId]?.data || {}, s = l.data.review.status;
    return ((s === ST.WITH_ATL || s === ST.ATL) && t.atlUserId === me.id) || ((s === ST.WITH_SA || s === ST.SA) && t.saUserId === me.id);
  }).map((l) => ({ munId: l.data.munId, year: l.data.auditYear, review: l.data.review }));
}

/* ── The review screen ── */
export async function saorReview(refs, params, q) {
  const me = refs.me;
  const munId = q.get('m'), year = Number(q.get('y'));
  const crumbs = (t) => `<a href="#/review">For My Review</a> / <b>${esc(t)}</b>`;
  if (!munId || !year || !refs.lgu[munId]) return { active: '#/review', crumbs: crumbs('SAOR'), body: '<div class="note bad">This SAOR was not found.</div>' };
  let ctx = await loadSaor(refs, munId, year);
  const go = (v) => `#/saor-review?m=${encodeURIComponent(munId)}&y=${year}${v ? '&view=' + v : ''}`;
  if (OPEN.includes(ctx.status) && !(ctx.S.review.history || []).length) return { active: '#/review', crumbs: crumbs('SAOR · ' + ctx.label), body: '<section class="panel"><div class="empty">This SAOR has not been forwarded for review.</div></section>' };
  // Opening the review starts it: the member can no longer retrieve it.
  if ((ctx.status === ST.WITH_ATL && ctx.iAmATL) || (ctx.status === ST.WITH_SA && ctx.iAmSA)) {
    const atl = ctx.status === ST.WITH_ATL, now = new Date().toISOString();
    Object.assign(ctx.S.review, { status: atl ? ST.ATL : ST.SA, openedAt: now, openedBy: me.email });
    histPush(ctx.S, me.email, atl ? 'ATL opened for review' : 'SA opened for review');
    await saveSaor(ctx, ctx.S);
    ctx = await loadSaor(refs, munId, year);
  }
  const s = ctx.status, R = ctx.S.review;
  const reviewing = (s === ST.ATL && ctx.iAmATL) || (s === ST.SA && ctx.iAmSA);
  const willFinal = ctx.iAmSA || ctx.oneStep;
  const blocks = reviewBlocks(ctx);
  const view = q.get('view') === 'edit' ? 'edit' : q.get('view') === 'page' ? 'page' : 'review';
  const fwdBy = ctx.nameOf(R.forwardedBy);
  const head = `<div class="page-head"><div><h1>SAOR · ${esc(ctx.mun.name)}</h1>
      <p>Audit Year ${esc(year)} · Forwarded by ${esc(fwdBy)} · ${esc(timeAgo(R.forwardedAt))}${R.openedAt && s !== ST.FINAL ? ' · Review started ' + esc(timeAgo(R.openedAt)) + ' (the member can no longer retrieve it)' : ''}</p></div>
      <div class="btn-row">${pill(s, statusPill(s))}</div></div>
    ${R.note && s !== ST.FINAL ? `<div class="note info"><span><b>Note from ${esc(fwdBy)}</b> · ${esc(when(R.forwardedAt))}: ${esc(R.note)}</span></div>` : ''}
    <div class="panel rv-bar">
      <div class="seg"><a class="${view === 'review' ? 'on' : ''}" href="${go('review')}">Review View</a><a class="${view === 'edit' ? 'on' : ''}" href="${go('edit')}">Correct Text</a><a class="${view === 'page' ? 'on' : ''}" href="${go('page')}">Print View</a></div>
      ${view === 'review' ? '<div class="rv-nav" id="rv-nav"></div>' : ''}
      <span class="btn-row" style="margin-left:auto"><a class="btn sm ghost" href="#/saor?m=${encodeURIComponent(munId)}&y=${year}">Open SAOR</a><button class="btn sm ghost" type="button" id="sr-trail">Review Trail</button><button class="btn sm ghost" type="button" id="sr-print">Print${s === ST.FINAL ? '' : ' (Draft)'}</button><button class="btn sm ghost" type="button" id="sr-word">Word${s === ST.FINAL ? '' : ' (Draft)'}</button></span></div>`;
  const side = reviewing ? `<section class="panel"><div class="panel-head"><h2>Decision on the SAOR</h2></div><div class="panel-body">
      <button class="btn success" id="sr-approve">${willFinal ? 'Approve as Final' : 'Approve and Forward to SA'}</button>
      <button class="btn ghost" id="sr-return">Return to Member</button>
      ${willFinal ? '<span class="hint">At final approval, the wording of each observation becomes its template\'s AOM Library wording, and the SAOR prints without the DRAFT mark.</span>' : ''}</div></section>`
    : `<section class="panel"><div class="panel-head"><h2>Status</h2></div><div class="panel-body"><span>${pill(s, statusPill(s))}</span>
      <span class="hint">${s === ST.RETURNED ? 'Returned to the member.' : s === ST.FINAL ? 'Approved as Final.' : 'Waiting for the reviewer.'}</span></div></section>`;
  let body;
  if (!blocks.length) body = `${head}<section class="panel"><div class="empty">No observation is found in two or more barangays, so there is no general wording to review. Use Print View to check the SAOR.</div></section><div class="grid-3" style="align-items:start">${side}</div>`;
  else if (view === 'review') body = `${head}${reviewing ? '<div class="note info"><span>Select words to comment on them, like in Word. To change the wording, use <b>Correct Text</b>; your changes show here in red and green with your initials.</span></div>' : ''}
    <div id="rv-host"></div><div class="grid-3" style="align-items:start">${side}</div>`;
  else if (view === 'edit') body = `${head}<div class="split" style="grid-template-columns:minmax(0,1fr) 360px">
      <section class="panel" style="min-width:0"><div class="panel-head"><h2>General Wording</h2></div><div class="panel-body" id="sr-fields">
        ${reviewing ? '<div class="note info">Click into any box to correct it. Your changes are marked with your initials and shown in the Review View.</div>' : ''}
        ${blocks.map((b) => `<div class="field"><label class="label" for="f-${esc(b.id)}">${esc(b.label)}${(R.editedBy || {})[b.id] ? ' ' + pill(ctx.nameOf(R.editedBy[b.id]).split(' ').map((w) => w[0]).join('') + ' edited', 'ok') : ''}</label>
          <textarea class="input be-text" id="f-${esc(b.id)}" data-bid="${esc(b.id)}" rows="${Math.min(10, Math.max(3, Math.ceil(b.text.length / 90)))}" ${reviewing ? '' : 'disabled'}>${esc(b.text)}</textarea></div>`).join('')}
        ${reviewing ? '<div style="display:flex;align-items:center;gap:12px;border-top:1px solid var(--line-2);padding-top:12px"><button class="btn primary" id="sr-save" style="margin-left:auto">Save Corrections</button></div>' : ''}</div></section>
      <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">${side}</aside></div>`;
  else body = `${head}<div class="split" style="grid-template-columns:minmax(0,1fr) 360px"><section class="panel" style="min-width:0;overflow:auto"><div class="paper-wrap big" style="max-height:none"><div class="sheet saor-sheet">${saorHTML(ctx.model, ctx.head)}</div></div></section>
    <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">${side}</aside></div>`;

  return {
    active: '#/review', crumbs: crumbs('SAOR · ' + ctx.label), body,
    mount(root) {
      void SAOR_CSS;
      $('#sr-trail', root).onclick = () => trailModal(ctx, refs);
      $('#sr-print', root).onclick = () => printSaor(ctx.model, ctx.head);
      $('#sr-word', root).onclick = async () => { try { toast('Preparing the Word file…'); await saorWord(ctx.model, ctx.head); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); } };
      let pane = null, saveEdits = null;
      if (view === 'review' && blocks.length) {
        const rec = { id: `saor:${munId}:${year}`, data: reviewDoc(ctx) };
        pane = mountReview($('#rv-host', root), { rec, vars: {}, me, users: refs.users, canAct: reviewing, heading: `SAOR · ${ctx.label}`, navEl: $('#rv-nav', root), noun: 'SAOR', readOnlyTitle: true,
          load: async () => { ctx = await loadSaor(refs, munId, year); return { data: reviewDoc(ctx) }; },
          save: async (d) => {
            ctx = await loadSaor(refs, munId, year);
            const cur = Object.fromEntries(reviewBlocks(ctx).map((b) => [b.id, b.text]));
            // Words put back with "Restore Original" go back into the SAOR itself.
            (d.blocks || []).forEach((b) => { if (cur[b.id] !== undefined && cur[b.id] !== b.text) applyBlock(ctx, ctx.S, b.id, b.text, me.email); });
            Object.assign(ctx.S.review, { comments: d.comments, editedBy: d.editedBy, history: d.history });
            await saveSaor(ctx, ctx.S);
          } });
      }
      if (view === 'edit' && reviewing) {
        const save = async () => {
          ctx = await loadSaor(refs, munId, year);
          const S = ctx.S, e = { ...(S.review.editedBy || {}) };
          const cur = Object.fromEntries(reviewBlocks(ctx).map((b) => [b.id, b.text]));
          $$('[data-bid]', root).forEach((t) => { const id = t.dataset.bid; if (cur[id] !== undefined && cur[id] !== t.value) { applyBlock(ctx, S, id, t.value, me.email); e[id] = me.email; } });
          // A box put back to the forwarded wording is no longer a correction.
          ((S.review.submitted && S.review.submitted.blocks) || []).forEach((b) => { const t = $(`[data-bid="${CSS.escape(b.id)}"]`, root); if (t && t.value === b.text) delete e[b.id]; });
          S.review.editedBy = e;
          await saveSaor(ctx, S);
          setDirty(false); toast('Corrections saved.', 'ok'); return true;
        };
        $('#sr-fields', root).addEventListener('input', () => setDirty(true, save));
        $('#sr-save', root).onclick = save;
        saveEdits = save;
        setDirty(false, save);
      }
      if (!reviewing) return;
      async function settle() {
        if (pane) await pane.flush();
        if (saveEdits && guard.dirty) await saveEdits();
        return loadSaor(refs, munId, year);
      }
      $('#sr-approve', root).onclick = async () => {
        if (willFinal && !(await confirmBox('Approve as Final', 'Approve the SAOR as Final? The wording of each observation becomes its template\'s AOM Library wording, and the SAOR prints without the DRAFT mark.', 'Approve', 'success'))) return;
        ctx = await settle();
        const S = ctx.S, now = new Date().toISOString();
        if (willFinal) {
          const codes = await saveToLibrary(ctx, refs);
          snap(ctx, S, ctx.iAmSA ? 'SA review, approved as Final' : 'Review, approved as Final', me.email);
          Object.assign(S.review, { status: ST.FINAL, finalAt: now, finalBy: me.email, libSaved: codes });
          histPush(S, me.email, 'Approved as Final by the SA' + (codes.length ? ` · AOM Library wording saved for ${codes.join(', ')}` : ''));
          await saveSaor(ctx, S);
          await store.log('approved the SAOR as Final', ctx.label, ctx.teamId, me.email);
          setDirty(false); toast('The SAOR is Final.', 'ok');
          location.hash = `#/saor?m=${encodeURIComponent(munId)}&y=${year}`;
        } else {
          snap(ctx, S, 'ATL review, approved and forwarded to the SA', me.email);
          Object.assign(S.review, { status: ST.WITH_SA, atlApprovedAt: now, atlApprovedBy: me.email, openedAt: null });
          histPush(S, me.email, 'Approved by the ATL and forwarded to the SA');
          await saveSaor(ctx, S);
          await store.log('approved the SAOR and forwarded it to the SA', ctx.label, ctx.teamId, me.email);
          setDirty(false); toast('Approved and forwarded to the Supervising Auditor.', 'ok');
          location.hash = '#/review';
        }
      };
      $('#sr-return', root).onclick = async () => {
        let note = '';
        const r = await modal({ title: 'Return to Member', body: '<div class="field"><label class="label" for="rn">What should the member fix?</label><textarea class="input be-text" id="rn" rows="3"></textarea></div><span class="hint">Your comments and corrections stay with the SAOR.</span>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Return', cls: 'primary', value: 'ok', check: (bg) => { note = $('#rn', bg).value.trim(); if (!note) toast('Write a short note.', 'warn'); return !!note; } }] });
        if (r !== 'ok') return;
        ctx = await settle();
        const S = ctx.S, now = new Date().toISOString();
        snap(ctx, S, (s === ST.SA ? 'SA' : 'ATL') + ' review, returned to member', me.email);
        Object.assign(S.review, { status: ST.RETURNED, returnNote: note, returnedBy: me.email, returnedAt: now });
        histPush(S, me.email, 'Returned to member: ' + note);
        await saveSaor(ctx, S);
        await store.log('returned the SAOR', ctx.label, ctx.teamId, me.email);
        setDirty(false); toast('Returned to the member.', 'ok'); location.hash = '#/review';
      };
    }
  };
}
