// BAAR review and Final, the same as the AOM review trail: the member forwards the BAAR, the ATL and then the SA review it.
// Each part (and each annex) has its own decision: approve, or return to the member; only the returned parts go back.
// The BAAR is Final only when the SA has approved every part. Corrections are tracked with initials, comments sit in
// the margin, and the Review Trail prints or goes to Word with real Track Changes.
// Parts built from other screens (Cover, Table of Contents, Audited FS, Part II) can be commented on, not corrected here.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, guard, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { has, myTeamIds } from '../refs.js';
import { loadAudit, stepsBar, advanceStage } from '../auditctx.js';
import { ST, statusPill, clone, ensureIds, snapshot } from '../aom.js';
import { mountReview, when } from '../reviewpane.js';
import { aomTrail, printTrail, trailWord } from '../reviewtrail.js';
import { nice, timeAgo, periodPhrase } from '../format.js';
import { TR_KEYS } from '../baar-transmittal.js';
import { IAR_KEYS } from '../baar-iar.js';
import { KM, PPE_CLS } from '../baar-notes.js';
import { annexLetter } from '../baar-annex.js';
import { PARTS, loadTransmittal, completeBAAR } from './baar.js';

const recId = (auditId) => `baar-${auditId}`;
const OPEN = [ST.DRAFT, ST.RETURNED];
const CORRECT = new Set(['01', '04', '05', '07', '09']);
const getP = (o, path) => path.split('.').reduce((x, k) => (x === null || x === undefined ? undefined : x[k]), o);
const setP = (o, path, v) => { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach((k) => { if (x[k] === undefined || x[k] === null) x[k] = {}; x = x[k]; }); x[ks[ks.length - 1]] = v; };

/* ── What is reviewed ── */
// Parts 01 to 09 (Part III only when it has recommendations), and each annex of Part IV on its own.
export function reviewItems(B) {
  const out = [];
  PARTS.forEach(([n, t]) => {
    if (n === '10') { (B.annexes || []).forEach((an, i) => out.push({ key: `10:${an.id}`, n, name: `Annex ${annexLetter(i)} · ${an.title}`, short: `Annex ${annexLetter(i)}`, fields: true, ai: i })); return; }
    if (n === '09' && !((B.p3 && B.p3.recs) || []).length) return;
    out.push({ key: n, n, name: `Part ${n} · ${t}`, short: n, fields: CORRECT.has(n) });
  });
  return out;
}
export const itemSt = (B, key) => ((B.review || {}).items || {})[key] || { status: ST.DRAFT };
// A part under review or Final cannot be changed on its own screen.
export function partLocked(B, n) {
  const keys = n === '10' ? (B.annexes || []).map((an) => `10:${an.id}`) : [n];
  return keys.some((k) => !OPEN.includes(itemSt(B, k).status));
}
export function reviewSummary(B) {
  const items = reviewItems(B), sts = items.map((i) => itemSt(B, i.key).status);
  const c = (s) => sts.filter((x) => x === s).length;
  return { items, total: items.length, final: c(ST.FINAL), atl: c(ST.WITH_ATL) + c(ST.ATL), sa: c(ST.WITH_SA) + c(ST.SA), returned: c(ST.RETURNED), draft: c(ST.DRAFT),
    allFinal: items.length > 0 && sts.every((s) => s === ST.FINAL), started: sts.some((s) => s !== ST.DRAFT) || !!(B.review && B.review.forwardedAt) };
}

/* ── The wording a reviewer can correct, as labelled boxes ── */
const TRL = { sa1: 'Letter to the Punong Barangay · Paragraph 1', sa2: 'Letter to the Punong Barangay · Paragraph 2', sa3: 'Letter to the Punong Barangay · Paragraph 3', sa5: 'Letter to the Punong Barangay · Paragraph 5', sa6: 'Letter to the Punong Barangay · Paragraph 6', sa7: 'Letter to the Punong Barangay · Paragraph 7', cc: 'Letter to the Punong Barangay · Copy Furnished',
  atlAddr: 'Letter to the SA · Address', atlSal: 'Letter to the SA · Salutation', atl1: 'Letter to the SA · Paragraph 1', atl2: 'Letter to the SA · Paragraph 2', atl3: 'Letter to the SA · Paragraph 3', atl4: 'Letter to the SA · Paragraph 4', atl6: 'Letter to the SA · Paragraph 6' };
const IARL = { open: 'Opening Paragraph', basesIntro: 'Bases · Introduction', conducted: 'We Conducted Our Audit…', kam: 'Key Audit Matters', mgmt: 'Responsibilities of Management and Those Charged with Governance', aud: 'Auditor’s Responsibilities' };
const PPEF = { ca: 'Additions', cd: 'Disposals', ct: 'Transfers/Adjustments', dd: 'Depreciation · Disposals', dt: 'Depreciation · Transfers/Adjustments', pa: 'Additions', pd: 'Disposals', pt: 'Transfers/Adjustments' };
export function fieldsOf(item, B, audit) {
  const f = (path, label) => ({ id: path, type: 'field', label, text: String(getP(B, path) ?? '') });
  const y = Number(audit.periodTo), yp = y - 1;
  if (item.ai !== undefined) return [f(`annexes.${item.ai}.title`, 'Title')];
  switch (item.n) {
    case '01': return [...TR_KEYS.filter((k) => TRL[k]).map((k) => f(`tr.${k}`, TRL[k])), f('tr.salutation', 'Letter to the Punong Barangay · Salutation')];
    case '04': return IAR_KEYS.map((k) => f(`iar.${k}`, IARL[k] || k));
    case '05': return [f('smr.text', 'Statement')];
    case '07': {
      const N = B.notes || {}, out = [];
      KM.forEach(([k, label]) => { out.push(f(`notes.km.${k}.cy`, `Key Management · ${label} · CY ${y}`), f(`notes.km.${k}.py`, `Key Management · ${label} · CY ${yp}`)); });
      out.push(f('notes.inv.rec', 'Inventories recognized during the period'), f('notes.inv.wd', 'Inventories · write-down recognized as an expense'));
      PPE_CLS.forEach(([k, label]) => Object.keys(PPEF).forEach((x) => { if (String(((N.ppe || {})[k] || {})[x] ?? '').trim()) out.push(f(`notes.ppe.${k}.${x}`, `PPE · ${label} · ${PPEF[x]} · CY ${/^p/.test(x) ? yp : y}`)); }));
      return out;
    }
    case '09': return ((B.p3 && B.p3.recs) || []).flatMap((r, i) => [f(`p3.recs.${i}.action`, `Rec. ${i + 1} · Management Action`), f(`p3.recs.${i}.reason`, `Rec. ${i + 1} · Reason for Non-Implementation`)]);
    default: return [];
  }
}
// The text of a part as printed, one block per paragraph or table row, so words can be selected and commented on.
const BLK = /^(P|DIV|H[1-6]|LI|UL|OL|TABLE|TBODY|THEAD|TR|SECTION)$/;
export function textBlocks(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const out = [];
  const push = (t) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t && (!out.length || out[out.length - 1].text !== t)) out.push({ id: 'g' + out.length, type: 'text', text: t }); };
  const walk = (el) => {
    Array.from(el.children).forEach((c) => {
      if (/^(STYLE|SCRIPT|IMG)$/.test(c.tagName) || c.classList.contains('pno')) return;
      if (c.tagName === 'TR') { push(Array.from(c.children).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join('  |  ')); return; }
      if (Array.from(c.children).some((x) => BLK.test(x.tagName))) walk(c);
      else if (BLK.test(c.tagName)) push(c.textContent);
    });
  };
  walk(doc.body);
  return out;
}
const annexRows = (an) => (an.rows || []).map((r, i) => ({ id: 'r' + i, type: 'text', text: r.filter((c) => String(c ?? '').trim()).join('  |  ') })).filter((b) => b.text);

/** One part as a reviewable document (the shape the review pane and the trail use). */
function itemDoc(B, item, audit, viewBlocks = []) {
  const s = itemSt(B, item.key);
  const fb = item.fields ? fieldsOf(item, B, audit) : [];
  return ensureIds({ title: item.name, status: s.status, blocks: [...fb, ...viewBlocks],
    submitted: s.submitted ? { title: item.name, blocks: [...(s.submitted.blocks || []).filter((b) => b.type === 'field'), ...viewBlocks] } : null,
    comments: clone(s.comments || []), editedBy: clone(s.editedBy || {}), history: clone(s.history || []), versions: clone(s.versions || []),
    returnNote: s.returnNote, forwardedAt: s.forwardedAt, forwardedBy: s.forwardedBy });
}

/* ── Saving ── */
// A sheet cell holds at most 50,000 characters, so each part's review (its rounds, comments and corrections) is kept in a
// record of its own; the BAAR record keeps only each part's status.
const HEAVY = ['submitted', 'versions', 'comments', 'editedBy', 'history'];
const hid = (ctx, key) => `baarrv-${ctx.rec.id}-${String(key).replace(/[^A-Za-z0-9]+/g, '-')}`;
const lastHeavy = {};
// Each round keeps only the boxes that changed since the round before (the rest are read back from it).
const packV = (vs) => { const prev = {}; return (vs || []).map((v) => ({ ...v, blocks: (v.blocks || []).map((b) => { const same = prev[b.id] === b.text; prev[b.id] = b.text; return same ? { id: b.id, same: 1 } : b; }) })); };
const unpackV = (vs) => { const prev = {}; return (vs || []).map((v) => ({ ...v, blocks: (v.blocks || []).map((b) => { const x = b.same ? { ...prev[b.id] } : b; prev[b.id] = x; return x; }) })); };   // what was last read or saved for each part, so unchanged parts are not saved again
// The latest BAAR record, with the standard wording filled in where nothing is saved yet (as the part screens show it),
// and each part's review read back in.
async function freshB(ctx) {
  const B = clone((await loadTransmittal(ctx)).B);
  const items = (B.review && B.review.items) || {};
  await Promise.all(Object.keys(items).map(async (k) => {
    const r = await store.get('letters', hid(ctx, k));
    const h = r && !r.deleted ? r.data.review || {} : {};
    HEAVY.forEach((f) => { if (h[f] !== undefined) items[k][f] = f === 'versions' ? unpackV(h[f]) : h[f]; });
    lastHeavy[hid(ctx, k)] = JSON.stringify(Object.fromEntries(HEAVY.map((f) => [f, items[k][f]])));
  }));
  return B;
}
// A BAAR saved before the reviews were kept apart: move them out so the record fits a sheet cell again.
export async function slimReview(ctx, B) {
  const items = (B && B.review && B.review.items) || {};
  if (!Object.values(items).some((x) => HEAVY.some((f) => x[f] !== undefined))) return false;
  await saveB(ctx, await freshB(ctx));
  return true;
}
async function saveB(ctx, B0) {
  const B = clone(B0);
  const items = (B.review && B.review.items) || {};
  for (const k of Object.keys(items)) {
    const h = Object.fromEntries(HEAVY.map((f) => [f, f === 'versions' ? packV(items[k][f]) : items[k][f]]));
    const json = JSON.stringify(Object.fromEntries(HEAVY.map((f) => [f, items[k][f]]))), id = hid(ctx, k);
    if (lastHeavy[id] !== json) { await store.save('letters', id, { type: 'baar-review-part', auditId: ctx.rec.id, teamId: ctx.teamId, key: k, review: h }, { silent: true }); lastHeavy[id] = json; }
    HEAVY.forEach((f) => { delete items[k][f]; });
  }
  await store.save('letters', recId(ctx.rec.id), B, { silent: true });
}
const putItem = (B, key, patch) => { B.review = B.review || { items: {}, history: [] }; B.review.items = B.review.items || {}; B.review.items[key] = { ...(B.review.items[key] || { status: ST.DRAFT }), ...patch }; };
const logB = (B, by, action) => { B.review = B.review || { items: {}, history: [] }; B.review.history = [...(B.review.history || []), { at: new Date().toISOString(), by, action }]; };
const fieldSnap = (item, B, audit) => (item.fields ? fieldsOf(item, B, audit) : []);
function snapItem(B, item, audit, step, email, patch = {}) {
  const s = clone(itemSt(B, item.key));
  const d = { title: item.name, blocks: fieldSnap(item, B, audit), editedBy: s.editedBy || {}, versions: s.versions || [] };
  snapshot(d, step, email);
  putItem(B, item.key, { versions: d.versions, ...patch });
}

/* ── The strip on the BAAR screens: status, Forward, Retrieve, Open Review ── */
export function reviewStrip(ctx, B) {
  const S = reviewSummary(B);
  if (!S.total) return '';
  const id = ctx.rec.id;
  if (S.allFinal) return `<div class="panel brv-strip ok"><span><b>✓ Final · Locked</b> · approved by the SA${B.review.finalAt ? ' on ' + esc(new Date(B.review.finalAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })) : ''}. Every part is locked.</span><a class="btn sm primary" href="#/baar-final/${id}">Open Final BAAR</a></div>`;
  const parts = [];
  if (S.final) parts.push(`${S.final} approved by the SA`);
  if (S.sa) parts.push(`${S.sa} with the SA`);
  if (S.atl) parts.push(`${S.atl} with the ATL`);
  if (S.returned) parts.push(`${S.returned} returned to you`);
  if (S.draft && S.started) parts.push(`${S.draft} not yet forwarded`);
  const ret = S.items.filter((i) => itemSt(B, i.key).status === ST.RETURNED);
  const canRetrieve = S.items.some((i) => itemSt(B, i.key).status === ST.WITH_ATL) && !S.items.some((i) => [ST.ATL].includes(itemSt(B, i.key).status));
  const toSend = S.draft + S.returned;
  return `<div class="panel brv-strip"><span>${S.started ? `<b>Review</b> · ${esc(parts.join(' · '))}` : '<b>Review</b> · not yet forwarded. Forward the BAAR to the ATL when the parts are ready.'}
      ${ret.length ? `<br><span class="warn-t">Returned: ${ret.map((i) => esc(i.short === i.n ? 'Part ' + i.n : i.short) + (itemSt(B, i.key).returnNote ? ' (“' + esc(itemSt(B, i.key).returnNote) + '”)' : '')).join(' · ')}</span>` : ''}</span>
    <span class="btn-row">${S.started ? `<a class="btn sm ghost" href="#/baar-review/${id}">Open Review</a>` : ''}${canRetrieve ? '<button class="btn sm ghost" type="button" id="brv-retrieve">Retrieve</button>' : ''}
      ${toSend ? `<button class="btn sm primary" type="button" id="brv-forward">${S.started ? `Forward ${toSend} Part${toSend > 1 ? 's' : ''} to ATL →` : 'Forward BAAR to ATL →'}</button>` : ''}</span></div>`;
}
export function wireReviewStrip(root, ctx, me) {
  const fw = $('#brv-forward', root), rt = $('#brv-retrieve', root);
  if (fw) fw.onclick = async () => {
    const B = await freshB(ctx);
    const items = reviewItems(B).filter((i) => OPEN.includes(itemSt(B, i.key).status));
    const st = ctx.st || {};
    let note = '';
    const r = await modal({ title: 'Forward BAAR to ATL', wide: true,
      body: `<p style="margin:0 0 8px">These parts go to the ATL. Parts already approved stay approved.</p>
        <table class="pgt"><tbody>${items.map((i) => `<tr><td style="width:60%">${esc(i.name)}</td><td style="text-align:right">${i.ai === undefined ? st[i.n] || '' : ''}${itemSt(B, i.key).status === ST.RETURNED ? ' ' + pill('Returned', 'warn') : ''}</td></tr>`).join('')}</tbody></table>
        <div class="field" style="margin-top:10px"><label class="label" for="brv-note">Note to the ATL (optional)</label><textarea class="input be-text" id="brv-note" rows="3"></textarea></div>
        <span class="hint">You can retrieve it until the ATL opens it.</span>`,
      buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Forward to ATL', cls: 'primary', value: 'ok', check: (bg) => { note = $('#brv-note', bg).value.trim(); return true; } }] });
    if (r !== 'ok') return;
    const now = new Date().toISOString();
    items.forEach((i) => {
      const wasRet = itemSt(B, i.key).status === ST.RETURNED;
      snapItem(B, i, ctx.audit, wasRet ? 'Corrected by the member and forwarded again' : 'Forwarded for review', me.email);
      const s = itemSt(B, i.key);
      putItem(B, i.key, { status: ST.WITH_ATL, submitted: { title: i.name, blocks: fieldSnap(i, B, ctx.audit) }, forwardedAt: now, forwardedBy: me.email, returnNote: '',
        history: [...(s.history || []), { at: now, by: me.email, action: wasRet ? 'Forwarded again to the ATL' : 'Forwarded to the ATL' }] });
    });
    B.review.forwardedAt = now; B.review.forwardedBy = me.email; B.review.note = note;
    logB(B, me.email, `Forwarded ${items.length} part${items.length > 1 ? 's' : ''} to the ATL`);
    await saveB(ctx, B);
    await store.log('forwarded the BAAR for review', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
    toast('Forwarded to the ATL.', 'ok'); emitChange('local');
  };
  if (rt) rt.onclick = async () => {
    if (!(await confirmBox('Retrieve BAAR', 'Take back the parts the ATL has not opened yet? You can forward them again later.', 'Retrieve'))) return;
    const B = await freshB(ctx);
    const now = new Date().toISOString();
    reviewItems(B).filter((i) => itemSt(B, i.key).status === ST.WITH_ATL).forEach((i) => { const s = itemSt(B, i.key); putItem(B, i.key, { status: ST.DRAFT, history: [...(s.history || []), { at: now, by: me.email, action: 'Retrieved by the member' }] }); });
    logB(B, me.email, 'Retrieved by the member');
    await saveB(ctx, B); toast('Retrieved.', 'ok'); emitChange('local');
  };
}

/* ── For My Review: BAARs waiting for this person ── */
export async function baarQueue(refs) {
  const me = refs.me;
  if (!has(me, 'atl') && !has(me, 'sa')) return [];
  const teams = myTeamIds(me, refs.teams);
  return (await store.list('letters')).filter((l) => !l.deleted && l.data.type === 'baar' && teams.includes(l.data.teamId) && l.data.review).map((l) => {
    const t = refs.team[l.data.teamId]?.data || {};
    const items = Object.values(l.data.review.items || {});
    const mine = items.filter((s) => ((s.status === ST.WITH_ATL || s.status === ST.ATL) && t.atlUserId === me.id) || ((s.status === ST.WITH_SA || s.status === ST.SA) && t.saUserId === me.id)).length;
    return { auditId: l.data.auditId, count: mine, review: l.data.review };
  }).filter((x) => x.count);
}

/* ── The review screen ── */
export async function baarReview(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/review', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found.</div>' };
  const me = refs.me;
  const iAmATL = ctx.team.atlUserId === me.id, iAmSA = ctx.team.saUserId === me.id;
  const isMember = myTeamIds(me, refs.teams).includes(ctx.teamId);
  let L = await loadTransmittal(ctx);
  let B = L.B;
  const items = reviewItems(B);
  if (!items.length || !reviewSummary(B).started) return { active: '#/review', crumbs: `<a href="#/review">For My Review</a> / <b>${esc(ctx.title)} · BAAR</b>`, body: '<section class="panel"><div class="empty">This BAAR has not been forwarded for review.</div></section>' };
  // Opening the review starts it: the member can no longer retrieve what is waiting for this person.
  const opening = items.filter((i) => (itemSt(B, i.key).status === ST.WITH_ATL && iAmATL) || (itemSt(B, i.key).status === ST.WITH_SA && iAmSA));
  if (opening.length) {
    const fresh = await freshB(ctx), now = new Date().toISOString();
    opening.forEach((i) => { const s = itemSt(fresh, i.key); const atl = s.status === ST.WITH_ATL;
      putItem(fresh, i.key, { status: atl ? ST.ATL : ST.SA, history: [...(s.history || []), { at: now, by: me.email, action: atl ? 'ATL opened for review' : 'SA opened for review' }] }); });
    fresh.review.openedAt = now; fresh.review.openedBy = me.email;
    await saveB(ctx, fresh);
    L = await loadTransmittal(ctx); B = L.B;
  }
  B = await freshB(ctx);
  const mineNow = (i) => { const s = itemSt(B, i.key).status; return (s === ST.ATL && iAmATL) || (s === ST.SA && iAmSA); };
  let cur = items.find((i) => i.key === q.get('part')) || items.find(mineNow) || items.find((i) => itemSt(B, i.key).status === ST.RETURNED) || items[0];
  const idx = items.indexOf(cur);
  const s = itemSt(B, cur.key).status;
  const reviewing = mineNow(cur);
  const memberTurn = isMember && s === ST.RETURNED && !iAmATL && !iAmSA;
  const willFinal = iAmSA || ctx.oneStep;
  const view = q.get('view') === 'edit' && cur.fields ? 'edit' : q.get('view') === 'page' ? 'page' : 'review';
  const link = (key, v) => `#/baar-review/${ctx.rec.id}?part=${encodeURIComponent(key)}${v ? '&view=' + v : ''}`;
  const S = reviewSummary(B);
  const fwdBy = nice(refs.users.find((u) => u.data.email === B.review.forwardedBy)?.data.name || '');
  const nameOf = (e) => (e ? nice(refs.users.find((u) => u.data.email === e)?.data.name || e) : '');
  const pending = items.filter((i) => i.key !== cur.key && mineNow(i));
  const chip = (i) => { const x = itemSt(B, i.key).status; const cls = x === ST.FINAL ? 'ok' : x === ST.RETURNED ? 'warn' : (x === ST.WITH_SA || x === ST.SA) && !iAmSA ? 'ok' : 'grey';
    return `<a class="brv-chip ${cls} ${i.key === cur.key ? 'on' : ''}" href="${link(i.key, view === 'edit' && !i.fields ? 'review' : view)}" title="${esc(i.name)} · ${esc(x)}">${esc(i.short)}${x === ST.FINAL || (cls === 'ok' && x !== ST.FINAL) ? ' ✓' : x === ST.RETURNED ? ' ↩' : ''}</a>`; };
  const vars = {};   // the wording as typed, with its [PLACEHOLDERS], the same as in Correct Text
  const head = `${stepsBar(ctx, 'BAAR')}
    <div class="page-head"><div><h1>Barangay ${esc(ctx.lgu.name)} · BAAR CY ${esc(ctx.audit.periodTo)}</h1>
      <p>Forwarded by ${esc(fwdBy)} · ${esc(timeAgo(B.review.forwardedAt))}${B.review.openedAt ? ' · Review started ' + esc(timeAgo(B.review.openedAt)) + ' (the member can no longer retrieve it)' : ''}</p></div>
      <div class="btn-row">${pill(S.allFinal ? 'Final' : s, statusPill(S.allFinal ? ST.FINAL : s))}</div></div>
    ${B.review.note && !S.allFinal ? `<div class="note info"><span><b>Note from ${esc(fwdBy)}</b> · ${esc(when(B.review.forwardedAt))}: ${esc(B.review.note)}</span></div>` : ''}
    ${itemSt(B, cur.key).returnNote && s === ST.RETURNED ? `<div class="note warn"><span><b>Returned</b>: ${esc(itemSt(B, cur.key).returnNote)}</span></div>` : ''}
    <div class="panel rv-bar">
      <a class="btn sm ghost" href="${idx > 0 ? link(items[idx - 1].key, view === 'edit' ? '' : view) : '#'}" ${idx > 0 ? '' : 'aria-disabled="true" style="pointer-events:none;opacity:.4"'} aria-label="Previous part">‹</a>
      <b>${idx + 1} of ${items.length} · ${esc(cur.name)}</b>
      <a class="btn sm ghost" href="${idx < items.length - 1 ? link(items[idx + 1].key, view === 'edit' ? '' : view) : '#'}" ${idx < items.length - 1 ? '' : 'aria-disabled="true" style="pointer-events:none;opacity:.4"'} aria-label="Next part">›</a>
      <div class="seg" style="margin-left:8px"><a class="${view === 'review' ? 'on' : ''}" href="${link(cur.key, 'review')}">Review View</a>${cur.fields ? `<a class="${view === 'edit' ? 'on' : ''}" href="${link(cur.key, 'edit')}">Correct Text</a>` : ''}<a class="${view === 'page' ? 'on' : ''}" href="${link(cur.key, 'page')}">Page View</a></div>
      ${view === 'review' ? '<div class="rv-nav" id="rv-nav"></div>' : ''}
      <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" type="button" id="brv-trail">Review Trail</button><button class="btn sm ghost" type="button" id="brv-draft">Print Draft</button></span></div>
    <div class="brv-chips">${items.map(chip).join('')}</div>`;
  const sidePanels = () => `
    <section class="panel"><div class="panel-head"><h2>Part Results</h2></div><div class="panel-body" style="gap:8px">
      <span class="ck"><span class="ck-ok">✓ ${esc(cur.name)}</span>${cur.fields ? '' : '<span class="ck-info">• Built from other screens: comment here, correct it where it comes from</span>'}</span>
      ${reviewing ? '<label class="check"><input type="checkbox" id="brv-pgok">I checked the page numbering</label>' : ''}</div></section>
    ${reviewing ? `<section class="panel"><div class="panel-head"><h2>Decision on This Part</h2></div><div class="panel-body">
      <button class="btn success" id="brv-approve">${willFinal ? 'Approve This Part' : 'Approve and Forward to SA'}</button>
      <button class="btn ghost" id="brv-return">Return to Member</button>
      <span class="hint">${S.final} of ${S.total} approved by the SA · ${S.returned} returned · ${pending.length} others waiting for you</span>
      ${pending.length ? `<button class="btn primary" id="brv-all">${willFinal ? 'Approve Remaining Parts' : 'Approve Remaining and Forward to SA'} →</button>` : ''}
      ${willFinal ? '<span class="hint">The BAAR becomes Final when the SA has approved every part.</span>' : ''}</div></section>`
      : `<section class="panel"><div class="panel-head"><h2>Status of This Part</h2></div><div class="panel-body"><span>${pill(s, statusPill(s))}</span>
        ${memberTurn ? `<span class="hint">Fix it on the part’s own screen, then forward it again from the BAAR.</span><a class="btn sm ghost" href="#/baar/${ctx.rec.id}?p=${cur.n}">Open Part ${esc(cur.n)}</a>` : ''}</div></section>`}`;
  let body;
  if (view === 'review') body = `${head}${reviewing ? '<div class="note info"><span>Select words in the part to comment on them, like in Word. To change the wording, use <b>Correct Text</b>; your changes show here in red and green with your initials.</span></div>' : ''}
    <div id="rv-host"></div><div class="grid-3" style="align-items:start">${sidePanels()}</div>`;
  else if (view === 'edit') body = `${head}<div class="split" style="grid-template-columns:minmax(0,1fr) 380px">
      <section class="panel" style="min-width:0"><div class="panel-head"><h2>Wording of ${esc(cur.short === cur.n ? 'Part ' + cur.n : cur.short)}</h2></div><div class="panel-body" id="brv-fields">
        ${reviewing ? '<div class="note info">Click into any box to correct it. Your changes are marked with your initials and shown in the Review View.</div>' : ''}
        ${fieldsOf(cur, B, ctx.audit).map((f) => `<div class="field"><label class="label" for="f-${esc(f.id)}">${esc(f.label)}${itemSt(B, cur.key).editedBy?.[f.id] ? ' ' + pill(nice(nameOf(itemSt(B, cur.key).editedBy[f.id])).split(' ').map((w) => w[0]).join('') + ' edited', 'ok') : ''}</label>
          <textarea class="input be-text" id="f-${esc(f.id)}" data-path="${esc(f.id)}" rows="${Math.min(10, Math.max(2, Math.ceil(f.text.length / 90)))}" ${reviewing ? '' : 'disabled'}>${esc(f.text)}</textarea></div>`).join('') || '<div class="empty">Nothing to correct in this part.</div>'}
        ${reviewing ? '<div style="display:flex;align-items:center;gap:12px;border-top:1px solid var(--line-2);padding-top:12px"><span class="save-state saved"><span class="d"></span>All Changes Saved</span><button class="btn primary" id="brv-save" style="margin-left:auto">Save Corrections</button></div>' : ''}</div></section>
      <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">${sidePanels()}</aside></div>`;
  else body = `${head}<div class="split" style="grid-template-columns:minmax(0,1fr) 380px"><section class="panel" style="min-width:0;padding:0"><iframe id="brv-page" title="${esc(cur.name)} as printed" style="width:100%;height:calc(100vh - 230px);min-height:600px;border:0;border-radius:12px;background:#D5DCE3"></iframe></section>
    <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">${sidePanels()}</aside></div>`;

  return {
    active: '#/review', crumbs: `<a href="#/review">For My Review</a> / <b>${esc(ctx.title)} · BAAR</b>`, body,
    async mount(root) {
      const doc = await completeBAAR(ctx, L);
      const prints = doc.prints();
      // The text shown for selecting and commenting: the part's wording boxes, or its printed text.
      const viewBlocks = () => (cur.ai !== undefined ? annexRows((B.annexes || [])[cur.ai] || {}) : cur.fields ? [] : textBlocks((prints[cur.n] || {}).html || ''));
      const vb = viewBlocks();
      $('#brv-trail', root).onclick = async () => {
        const r = await modal({ title: 'Review Trail · BAAR', body: '<p style="margin:0">Every part: the history, each round of corrections with initials, the comments and replies, and the final wording. Marked "REVIEW TRAIL – Not for Issuance".</p>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Print', cls: 'ghost', value: 'print' }, { label: 'Word (Track Changes)', cls: 'primary', value: 'word' }] });
        if (!r) return;
        await trailFile(ctx, refs, r);
      };
      $('#brv-draft', root).onclick = () => doc.print(`BAAR ${ctx.audit.auditYear} · ${ctx.lgu.name} · Draft for Review`);
      if (view === 'page') {
        const p = prints[cur.n];
        const f = $('#brv-page', root);
        f.srcdoc = p ? `<!doctype html><html><head><meta charset="utf-8"><style>${p.css} body{margin:0;background:#D5DCE3;padding:16px 0} .pg{margin:0 auto 16px;width:8.5in;box-shadow:0 2px 10px rgba(20,40,63,.18);background:#fff} @media print{body{background:#fff}}</style></head><body>${p.html}</body></html>`
          : '<p style="font:14px sans-serif;padding:20px">Nothing to show.</p>';
      }
      let pane = null, saveEdits = null;
      if (view === 'review') {
        const rec = { id: 'baar:' + ctx.rec.id + ':' + cur.key, data: itemDoc(B, cur, ctx.audit, vb) };
        pane = mountReview($('#rv-host', root), { rec, vars, me, users: refs.users, canAct: reviewing || memberTurn, heading: cur.name, navEl: $('#rv-nav', root), noun: 'part', readOnlyTitle: true,
          load: async () => { const Bx = await freshB(ctx); return { data: itemDoc(Bx, cur, ctx.audit, vb) }; },
          save: async (d) => {
            const Bx = await freshB(ctx);
            // Words put back with "Restore Original" go back into the BAAR itself.
            (d.blocks || []).filter((b) => b.type === 'field').forEach((b) => { if (String(getP(Bx, b.id) ?? '') !== b.text) setP(Bx, b.id, b.text); });
            putItem(Bx, cur.key, { comments: d.comments, editedBy: d.editedBy, history: d.history });
            await saveB(ctx, Bx); B = Bx;
          } });
      }
      if (view === 'edit' && reviewing) {
        const save = async () => {
          const Bx = await freshB(ctx), s0 = itemSt(Bx, cur.key), e = { ...(s0.editedBy || {}) };
          $$('[data-path]', root).forEach((t) => { const p = t.dataset.path; if (String(getP(Bx, p) ?? '') !== t.value) { setP(Bx, p, t.value); e[p] = me.email; } });
          // A box put back to the forwarded wording is no longer a correction.
          ((s0.submitted && s0.submitted.blocks) || []).forEach((b) => { if (String(getP(Bx, b.id) ?? '') === b.text) delete e[b.id]; });
          putItem(Bx, cur.key, { editedBy: e });
          await saveB(ctx, Bx); B = Bx;
          setDirty(false); toast('Corrections saved.', 'ok'); return true;
        };
        $('#brv-fields', root).addEventListener('input', () => setDirty(true, save));
        $('#brv-save', root).onclick = save;
        saveEdits = save;
        setDirty(false, save);
      }
      if (!reviewing) return;
      async function settle() {
        if (pane) await pane.flush();
        if (saveEdits && guard.dirty) await saveEdits();
        return freshB(ctx);
      }
      const pgOk = () => { if (!$('#brv-pgok', root).checked) { toast('Tick "I checked the page numbering" first.', 'warn'); return false; } return true; };
      const approve = (Bx, i) => {
        const now = new Date().toISOString(), s0 = itemSt(Bx, i.key);
        if (willFinal) {
          snapItem(Bx, i, ctx.audit, iAmSA ? 'SA review, approved' : 'Review, approved', me.email);
          putItem(Bx, i.key, { status: ST.FINAL, finalAt: now, finalBy: me.email, history: [...(s0.history || []), { at: now, by: me.email, action: 'Approved by the SA' }] });
        } else {
          snapItem(Bx, i, ctx.audit, 'ATL review, approved and forwarded to the SA', me.email);
          putItem(Bx, i.key, { status: ST.WITH_SA, atlApprovedAt: now, atlApprovedBy: me.email, history: [...(s0.history || []), { at: now, by: me.email, action: 'Approved by the ATL and forwarded to the SA' }] });
        }
      };
      async function finish(Bx) {
        if (reviewSummary(Bx).allFinal && !(Bx.review.finalAt)) {
          Bx.review.finalAt = new Date().toISOString(); Bx.review.finalBy = me.email;
          logB(Bx, me.email, 'BAAR approved as Final');
          await saveB(ctx, Bx);
          await advanceStage(ctx, 'Final');
          await store.log('approved the BAAR as Final', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
          toast('Every part is approved. The BAAR is Final.', 'ok');
          location.hash = `#/baar-final/${ctx.rec.id}`;
          return true;
        }
        return false;
      }
      $('#brv-approve', root).onclick = async () => {
        if (!pgOk()) return;
        const Bx = await settle();
        approve(Bx, cur);
        await saveB(ctx, Bx);
        await store.log(willFinal ? 'approved a BAAR part' : 'approved a BAAR part and forwarded it to the SA', `${ctx.lgu.name} · ${cur.name}`, ctx.teamId, me.email);
        setDirty(false);
        if (await finish(Bx)) return;
        toast(willFinal ? 'Part approved.' : 'Approved and forwarded to the Supervising Auditor.', 'ok');
        const next = items.find((i) => i.key !== cur.key && mineNow(i));
        emitChange('local');
        if (next) location.hash = link(next.key, view === 'edit' && !next.fields ? 'review' : view);
      };
      $('#brv-return', root).onclick = async () => {
        let note = '';
        const r = await modal({ title: 'Return to Member', body: '<div class="field"><label class="label" for="rn">What should the member fix?</label><textarea class="input be-text" id="rn" rows="3"></textarea></div><span class="hint">Only this part goes back. Your comments and corrections stay with it.</span>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Return', cls: 'primary', value: 'ok', check: (bg) => { note = $('#rn', bg).value.trim(); if (!note) toast('Write a short note.', 'warn'); return !!note; } }] });
        if (r !== 'ok') return;
        const Bx = await settle(), now = new Date().toISOString(), s0 = itemSt(Bx, cur.key);
        snapItem(Bx, cur, ctx.audit, (s === ST.SA ? 'SA' : 'ATL') + ' review, returned to member', me.email);
        putItem(Bx, cur.key, { status: ST.RETURNED, returnNote: note, returnedBy: me.email, returnedAt: now, history: [...(s0.history || []), { at: now, by: me.email, action: 'Returned to member: ' + note }] });
        logB(Bx, me.email, `${cur.name} returned to the member`);
        await saveB(ctx, Bx);
        await store.log('returned a BAAR part', `${ctx.lgu.name} · ${cur.name}`, ctx.teamId, me.email);
        setDirty(false); toast('Returned to the member.', 'ok'); emitChange('local');
      };
      const all = $('#brv-all', root);
      if (all) all.onclick = async () => {
        if (!pgOk()) return;
        if (!(await confirmBox('Approve Remaining', `Approve this part and the ${pending.length} other${pending.length > 1 ? 's' : ''} waiting for you${willFinal ? '' : ' and forward them to the SA'}? Open each one first if you have not reviewed it.`, 'Approve', 'success'))) return;
        const Bx = await settle();
        [cur, ...pending].forEach((i) => approve(Bx, i));
        await saveB(ctx, Bx);
        await store.log(willFinal ? 'approved BAAR parts' : 'approved BAAR parts and forwarded them to the SA', `${ctx.lgu.name} · ${pending.length + 1}`, ctx.teamId, me.email);
        setDirty(false);
        if (await finish(Bx)) return;
        emitChange('local'); toast('Done.', 'ok');
      };
    }
  };
}

/* ── Review Trail (printout or Word with Track Changes), every part ── */
async function trailFile(ctx, refs, how) {
  const B = await freshB(ctx);
  const nameOf = (e) => (e ? nice(refs.users.find((u) => u.data.email === e)?.data.name || e) : '');
  const vars = {};   // the wording as typed, with its [PLACEHOLDERS], the same as in Correct Text
  const trails = reviewItems(B).map((i) => aomTrail({ data: itemDoc(B, i, ctx.audit, []) }, { no: i.short, head: i.name, finalHead: i.name, vars, nameOf, finalBlocks: i.fields ? fieldsOf(i, B, ctx.audit) : [] }));
  const file = { heading: 'BAAR REVIEW TRAIL', title: 'BAAR Review Trail · ' + ctx.lgu.name, place: `Barangay ${ctx.lgu.name}, ${ctx.mun.name || ''}, Quirino · BAAR CY ${ctx.audit.periodTo}`,
    included: `Included: all ${trails.length} parts${(B.annexes || []).length ? ' and annexes' : ''}`, trails,
    footer: `Barangay ${ctx.lgu.name} · BAAR Review Trail`, fileName: `${String(ctx.lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${ctx.audit.auditYear}_Review_Trail` };
  if (how === 'print') printTrail(file);
  else { try { toast('Preparing the Word file…'); await trailWord(file); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; } }
  await store.log(how === 'print' ? 'printed the BAAR review trail' : 'downloaded the BAAR review trail (Word)', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, refs.me.email);
}

/* ── Final ── */
export async function baarFinal(refs, params) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/baar', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found.</div>' };
  const me = refs.me;
  const L = await loadTransmittal(ctx), B = L.B;
  const S = reviewSummary(B);
  const R = B.review || {};
  const nameOf = (e) => (e ? nice(refs.users.find((u) => u.data.email === e)?.data.name || e) : '');
  const iAmSA = ctx.team.saUserId === me.id;
  const stamp = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  const atlAt = Object.values(R.items || {}).map((x) => x.atlApprovedAt).filter(Boolean).sort().pop();
  const atlBy = Object.values(R.items || {}).find((x) => x.atlApprovedAt === atlAt)?.atlApprovedBy;
  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>Final</b>`;
  const head = `${stepsBar(ctx, 'Final')}
    <div class="page-head"><div><h1>Final BAAR · Barangay ${esc(ctx.lgu.name)}</h1><p>${esc(ctx.mun.name)}, Quirino · ${esc(periodPhrase(ctx.audit.periodFrom, ctx.audit.periodTo))}</p></div>
      <div class="btn-row">${S.allFinal ? pill('Final · Locked', 'ok') : pill('Not Yet Final', 'warn')}</div></div>`;
  if (!S.allFinal) return { active: '#/baar', crumbs, body: `${head}<section class="panel"><div class="panel-body"><span>The BAAR becomes Final when the SA has approved every part: <b>${S.final} of ${S.total}</b> approved so far.</span>
      <span class="btn-row"><a class="btn sm ghost" href="#/baar/${ctx.rec.id}">Back to the BAAR</a>${S.started ? `<a class="btn sm primary" href="#/baar-review/${ctx.rec.id}">Open Review</a>` : ''}</span></div></section>` };
  const parts = reviewItems(B).filter((i) => i.ai === undefined).map((i) => i.n);
  const body = `${head}
    <div class="split" style="grid-template-columns:minmax(0,1fr) 420px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <section class="panel"><div class="panel-head"><h2>Final BAAR</h2></div><div class="panel-body">
          <table class="pgt"><tbody>
            <tr><td style="width:180px">Approved as Final</td><td>${esc(stamp(R.finalAt))} by ${esc(nameOf(R.finalBy))} (SA)</td></tr>
            ${atlAt ? `<tr><td>ATL approval</td><td>${esc(stamp(atlAt))} by ${esc(nameOf(atlBy))} (ATL)</td></tr>` : ''}
            <tr><td>Parts</td><td>${esc(parts[0])} to ${esc(parts[parts.length - 1])}${(B.annexes || []).length ? ` · Part IV with ${(B.annexes || []).length} annex${(B.annexes || []).length > 1 ? 'es' : ''}` : ' · Part IV left out (no annexes)'}</td></tr></tbody></table>
          <div class="btn-row" style="border-top:1px solid var(--line-2);padding-top:12px"><button class="btn" type="button" id="fn-print">Print Final BAAR</button><button class="btn primary" type="button" id="fn-word">Final BAAR · Word</button></div>
          <span class="hint">Every part is locked. Each part can still be printed on its own from BAAR Reports.</span></div></section>
        <section class="panel"><div class="panel-head"><h2>Review Trail</h2><span class="hint">For the audit file</span></div><div class="panel-body">
          <table class="pgt"><tbody>${(R.history || []).map((h) => `<tr><td style="width:180px">${esc(stamp(h.at))}</td><td>${esc(h.action)} · ${esc(nameOf(h.by))}</td></tr>`).join('')}</tbody></table>
          <div class="btn-row" style="border-top:1px solid var(--line-2);padding-top:12px"><button class="btn ghost" type="button" id="fn-tprint">Print Review Trail</button><button class="btn ghost" type="button" id="fn-tword">Review Trail · Word (Track Changes)</button></div></div></section></div>
      <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <section class="panel"><div class="panel-head"><h2>Reopen</h2></div><div class="panel-body">
          <span style="line-height:1.5">Only the SA can reopen a Final BAAR for correction, like a Final AOM. It goes back to SA review; approve it again when done. The trail keeps both versions.</span>
          ${iAmSA ? '<button class="btn ghost" type="button" id="fn-reopen">Reopen for Correction</button>' : ''}</div></section></aside></div>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      const fileName = `${String(ctx.lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_${String(ctx.mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${ctx.audit.auditYear}_Final`;
      $('#fn-print', root).onclick = async () => { (await completeBAAR(ctx, L)).print(`BAAR ${ctx.audit.auditYear} · ${ctx.lgu.name} · Final`); await store.log('printed the Final BAAR', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email); };
      $('#fn-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); await (await completeBAAR(ctx, L)).word(fileName); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the Final BAAR (Word)', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
      };
      $('#fn-tprint', root).onclick = () => trailFile(ctx, refs, 'print');
      $('#fn-tword', root).onclick = () => trailFile(ctx, refs, 'word');
      const ro = $('#fn-reopen', root);
      if (ro) ro.onclick = async () => {
        if (!(await confirmBox('Reopen Final BAAR', 'Reopen the BAAR for correction? Every part goes back to SA review. Approve them again when done.', 'Reopen'))) return;
        const Bx = await freshB(ctx), now = new Date().toISOString();
        reviewItems(Bx).forEach((i) => { const s0 = itemSt(Bx, i.key); putItem(Bx, i.key, { status: ST.SA, history: [...(s0.history || []), { at: now, by: me.email, action: 'Reopened by the SA' }] }); });
        Bx.review.finalAt = null; Bx.review.finalBy = null;
        logB(Bx, me.email, 'Reopened by the SA');
        await saveB(ctx, Bx);
        ctx.audit.stage = 'BAAR'; await store.save('audits', ctx.rec.id, ctx.audit, { silent: true });
        await store.log('reopened the Final BAAR', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
        toast('Reopened.', 'ok'); location.hash = `#/baar-review/${ctx.rec.id}`;
      };
    }
  };
}
