// ATL and SA review: correct the text (changes are tracked), comment, approve or return.
import { store, emitChange } from '../store.js';
import { mountReview, reviewCounts, when } from '../reviewpane.js';
import { updateFromAom } from './library.js';
import { esc, toast, setDirty, guard, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { loadAudit, advanceStage } from '../auditctx.js';
import { blocksHTML, wireBlocks, diffHTML } from '../blockeditor.js';
import { clone, checks, ST, statusPill, numberingCheck, fillText, ensureIds, stampEdits, snapshot } from '../aom.js';
import { aomNo, aomRange, nice, timeAgo, initials } from '../format.js';
import { has, myTeamIds } from '../refs.js';
import { aomPreviewHTML, checksHTML, commentsHTML } from './aoms.js';

const sel = { text: '', wired: false };

// AOMs waiting for this person, grouped by audit.
export async function reviewQueue(refs) {
  const me = refs.me;
  if (!has(me, 'atl') && !has(me, 'sa')) return [];
  const teams = myTeamIds(me, refs.teams);
  const aoms = (await store.list('aoms')).filter((a) => teams.includes(a.data.teamId));
  const mine = aoms.filter((a) => {
    const t = refs.team[a.data.teamId]?.data || {};
    const s = a.data.status;
    return ((s === ST.WITH_ATL || s === ST.ATL) && t.atlUserId === me.id) || ((s === ST.WITH_SA || s === ST.SA) && t.saUserId === me.id);
  });
  const by = {};
  mine.forEach((a) => { (by[a.data.auditId] = by[a.data.auditId] || []).push(a); });
  return Object.entries(by).map(([auditId, list]) => ({ auditId, list }));
}

export async function reviewList(refs) {
  const q = await reviewQueue(refs);
  const audits = await Promise.all(q.map((x) => store.get('audits', x.auditId)));
  const finals = (await store.list('aoms')).filter((a) => a.data.status === ST.FINAL && refs.team[a.data.teamId]?.data.saUserId === refs.me.id);
  const rows = q.map((x, i) => {
    const au = audits[i]?.data; if (!au) return '';
    const lgu = refs.lgu[au.lguId]?.data.name || '?';
    const by = refs.users.find((u) => u.data.email === x.list[0].data.forwardedBy)?.data.name;
    return `<a class="t-row click" href="#/review/${x.auditId}" style="grid-template-columns:minmax(160px,1fr) 120px 1fr 140px;text-decoration:none;color:inherit">
      <span><b>${esc(lgu)}</b><br><small class="hint">Audit Year ${esc(au.auditYear)}</small></span><span>${x.list.length} AOM${x.list.length > 1 ? 's' : ''}</span>
      <span>Forwarded by ${esc(nice(by || ''))}<br><small class="hint">${esc(timeAgo(x.list[0].data.forwardedAt))}</small></span><span><span class="btn sm primary">Review →</span></span></a>`;
  }).join('');
  return {
    active: '#/review', crumbs: '<b>For My Review</b>',
    body: `<div class="page-head"><div><h1>For My Review</h1><p>AOMs forwarded to you. Opening an AOM starts the review, and the member can no longer retrieve it.</p></div></div>
      <section class="panel">${rows || '<div class="empty">Nothing waiting for your review.</div>'}</section>
      ${has(refs.me, 'sa') && finals.length ? `<section class="panel"><div class="panel-head"><h2>Final AOMs · ${finals.length}</h2><span class="hint">Open one to reopen it if a correction is needed.</span></div>
        ${[...new Set(finals.map((a) => a.data.auditId))].map((id) => `<a class="t-row click" href="#/review/${id}" style="grid-template-columns:1fr auto;text-decoration:none;color:inherit"><span>${esc(refs.lgu[finals.find((a) => a.data.auditId === id).data.lguId]?.data.name || '')}</span><span class="hint">${finals.filter((a) => a.data.auditId === id).length} Final</span></a>`).join('')}</section>` : ''}`
  };
}

export async function review(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/review', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found.</div>' };
  const me = refs.me;
  const iAmATL = ctx.team.atlUserId === me.id, iAmSA = ctx.team.saUserId === me.id;
  const mineNow = (a) => ((a.data.status === ST.WITH_ATL || a.data.status === ST.ATL) && iAmATL) || ((a.data.status === ST.WITH_SA || a.data.status === ST.SA) && iAmSA) || (a.data.status === ST.FINAL && iAmSA);
  const list = ctx.aoms.filter((a) => mineNow(a) || [ST.WITH_ATL, ST.ATL, ST.WITH_SA, ST.SA, ST.FINAL].includes(a.data.status));
  if (!list.length) return { active: '#/review', crumbs: '<a href="#/review">For My Review</a> / <b>' + esc(ctx.title) + '</b>', body: '<section class="panel"><div class="empty">No AOMs of this Barangay are in review.</div></section>' };
  let cur = list.find((a) => a.id === q.get('aom')) || list.find(mineNow) || list[0];
  const i = list.indexOf(cur);
  const view = ['edit', 'page'].includes(q.get('view')) ? q.get('view') : 'review';
  ensureIds(cur.data);

  // Opening an AOM starts the review.
  const s0 = cur.data.status;
  if ((s0 === ST.WITH_ATL && iAmATL) || (s0 === ST.WITH_SA && iAmSA)) {
    const d = clone(cur.data);
    d.status = s0 === ST.WITH_ATL ? ST.ATL : ST.SA;
    d.history = [...(d.history || []), { at: new Date().toISOString(), by: me.email, action: s0 === ST.WITH_ATL ? 'ATL opened for review' : 'SA opened for review' }];
    d.reviewOpenedAt = new Date().toISOString(); d.reviewOpenedBy = me.email;
    await store.save('aoms', cur.id, d, { silent: true });
    cur = { ...cur, data: d };
  }
  const s = cur.data.status;
  const reviewing = (s === ST.ATL && iAmATL) || (s === ST.SA && iAmSA);
  const editable = reviewing;
  const state = { aom: clone(cur.data) };
  const myIni = initials(me.name);
  void myIni;
  // Initials on each block someone changed during review (by block position, for the editor).
  const ini = () => {
    const e = state.aom.editedBy || {}; const out = {};
    state.aom.blocks.forEach((b, bi) => { const w = e[b.id]; if (w) out[bi] = w.includes('@') ? initials(refs.users.find((u) => u.data.email === w)?.data.name || w) : w; });
    return out;
  };
  const rc = reviewCounts(clone(cur.data));
  const canManage = has(me, 'sa') || has(me, 'admin');
  const N = ctx.nums;
  const nc = numberingCheck(N);
  const first = N[ctx.aoms[0].id].n, last = Math.max(...Object.values(N).map((x) => x.n));
  const range = first === last ? aomNo(ctx.audit.auditYear, first, ctx.audit.periodFrom, ctx.audit.periodTo) : aomRange(ctx.audit.auditYear, first, last, ctx.audit.periodFrom, ctx.audit.periodTo);
  const fwdBy = nice(refs.users.find((u) => u.data.email === cur.data.forwardedBy)?.data.name || '');
  const willFinal = iAmSA || ctx.oneStep;
  const pendingMine = list.filter((a) => a.id !== cur.id && ((a.data.status === ST.ATL || a.data.status === ST.WITH_ATL) && iAmATL || (a.data.status === ST.SA || a.data.status === ST.WITH_SA) && iAmSA));
  const counts = { approved: list.filter((a) => (iAmATL && !iAmSA ? [ST.WITH_SA, ST.SA, ST.FINAL] : [ST.FINAL]).includes(a.data.status)).length };
  const link = (id, v) => `#/review/${ctx.rec.id}?aom=${id}${v ? '&view=' + v : ''}`;

  const aomNoText = aomNo(ctx.audit.auditYear, N[cur.id].n, ctx.audit.periodFrom, ctx.audit.periodTo);
  const head = `<div class="page-head"><div><h1>Barangay ${esc(ctx.lgu.name)} · AOM Nos. ${esc(range)}</h1>
      <p>Forwarded by ${esc(fwdBy)} · ${esc(timeAgo(cur.data.forwardedAt))}${cur.data.reviewOpenedAt ? ' · Review started ' + esc(timeAgo(cur.data.reviewOpenedAt)) + ' (the member can no longer retrieve it)' : ''}</p></div>
      <div class="btn-row">${pill(s, statusPill(s))}</div></div>
    ${cur.data.forwardNote && s !== ST.FINAL ? `<div class="note info"><span><b>Note from ${esc(fwdBy)}</b> · ${esc(when(cur.data.forwardedAt))}: ${esc(cur.data.forwardNote)}</span></div>` : ''}
    <div class="panel rv-bar">
      <a class="btn sm ghost" href="${i > 0 ? link(list[i - 1].id, view) : '#'}" ${i > 0 ? '' : 'aria-disabled="true" style="pointer-events:none;opacity:.4"'} aria-label="Previous AOM">‹</a>
      <b>AOM ${i + 1} of ${list.length}</b>
      <a class="btn sm ghost" href="${i < list.length - 1 ? link(list[i + 1].id, view) : '#'}" ${i < list.length - 1 ? '' : 'aria-disabled="true" style="pointer-events:none;opacity:.4"'} aria-label="Next AOM">›</a>
      <div class="seg" style="margin-left:8px"><a class="${view === 'review' ? 'on' : ''}" href="${link(cur.id, 'review')}">Review View</a><a class="${view === 'edit' ? 'on' : ''}" href="${link(cur.id, 'edit')}">Correct Text</a><a class="${view === 'page' ? 'on' : ''}" href="${link(cur.id, 'page')}">Print View</a></div>
      ${view === 'review' ? '<div class="rv-nav" id="rv-nav"></div>' : ''}
      <a class="btn sm ghost" style="margin-left:auto" href="#/audits/${ctx.rec.id}/print?draft=1">Print Draft</a></div>`;
  const body = view === 'review' ? `${head}
    <div class="panel" style="padding:10px 16px;flex-direction:row;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="mono" style="font-weight:600">${esc(aomNoText)}</span> · <b>${esc(fillText(cur.data.title, ctx.varsFor(cur)))}</b>
      <span class="hint">${esc(cur.data.poolCode || 'Not in Library')} · ${esc(cur.data.mode || 'Standard')}</span>
      <span style="margin-left:auto;display:flex;gap:6px" id="rv-counts">${rc.corrections ? pill(rc.corrections + ' correction' + (rc.corrections > 1 ? 's' : ''), 'grey') : ''}${rc.comments ? pill(rc.comments + ' comment' + (rc.comments > 1 ? 's' : ''), 'grey') : ''}</span></div>
    ${reviewing ? '<div class="note info"><span>Select words in the AOM to comment on them, like in Word. To change the wording, use <b>Correct Text</b>; your changes show here in red and green with your initials.</span></div>' : ''}
    <div id="rv-host"></div>
    <div class="grid-3" style="align-items:start">${sidePanels()}</div>` : `${head}
    <div class="split" style="grid-template-columns:minmax(0,1fr) 380px">
      <section class="panel" style="min-width:0"><div class="panel-head"><div><span class="mono" style="font-weight:600">${esc(aomNo(ctx.audit.auditYear, N[cur.id].n, ctx.audit.periodFrom, ctx.audit.periodTo))}</span> · <b>${esc(fillText(cur.data.title, ctx.varsFor(cur)))}</b><br><span class="hint">${esc(cur.data.poolCode || 'Not in Library')} · ${esc(cur.data.mode || 'Standard')}</span></div></div>
        <div class="panel-body" id="r-main">
          ${view === 'page' ? aomPreviewHTML(ctx, cur, state.aom, i)
            : `${editable ? '<div class="note info">Click into any block to correct it. Your changes are marked with your initials and shown in Draft vs. Corrected.</div>' : ''}
                <div class="field"><label class="label" for="r-title">Finding Title</label><input class="input strong" id="r-title" value="${esc(state.aom.title)}" ${editable ? '' : 'disabled'}></div>
                <div id="r-blocks">${blocksHTML(state.aom, { editable, tables: (state.aom.wpData || {}).tables || {}, initials: ini() })}</div>`}
        </div>
        ${editable ? '<div class="panel-body" style="border-top:1px solid var(--line-2);flex-direction:row;align-items:center"><span class="save-state saved"><span class="d"></span>All Changes Saved</span><button class="btn primary" id="r-save" style="margin-left:auto">Save Corrections</button></div>' : ''}
      </section>
      <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">${sidePanels(true)}</aside></div>`;

  function sidePanels(withComments) {
    return `
        <section class="panel"><div class="panel-head"><h2>AOM Number Check</h2></div><div class="panel-body" style="gap:8px">
          ${checksHTML([
            { st: 'ok', t: 'Format: AOM No. ' + aomNo(ctx.audit.auditYear, N[cur.id].n, ctx.audit.periodFrom, ctx.audit.periodTo) },
            nc.ok ? { st: 'ok', t: `Sequential: ${first === last ? 'AOM No. ' + aomNo(ctx.audit.auditYear, first, ctx.audit.periodFrom, ctx.audit.periodTo) : 'AOM Nos. ' + aomRange(ctx.audit.auditYear, first, last, ctx.audit.periodFrom, ctx.audit.periodTo)}, no gaps or duplicates` } : { st: 'bad', t: `Gaps ${nc.gaps.join(', ') || 'none'} · duplicates ${nc.dup.join(', ') || 'none'}` },
            { st: 'ok', t: 'Period matches the Audit Setup' }, { st: 'ok', t: 'Header and footer ranges match' }])}
          ${reviewing ? '<label class="check"><input type="checkbox" id="r-numok">I checked the AOM numbering</label>' : ''}</div></section>
        <section class="panel"><div class="panel-head"><h2>Draft Results</h2></div><div class="panel-body" style="gap:8px">${checksHTML(checks(state.aom, ctx.varsFor({ data: state.aom }), ctx.audit))}</div></section>
        ${reviewing ? `<section class="panel"><div class="panel-head"><h2>Changes to This AOM</h2></div><div class="panel-body">
          <label class="check"><input type="radio" name="r-mode" value="minor" ${cur.data.mode !== 'Modified' ? 'checked' : ''}>Minor (rewording only)</label>
          <label class="check"><input type="radio" name="r-mode" value="major" ${cur.data.mode === 'Modified' ? 'checked' : ''}>Modified (Major): condition, cause, effect or recommendation changed substantially</label></div></section>` : ''}
        ${withComments ? `<section class="panel"><div class="panel-head"><h2>Comments · ${(cur.data.comments || []).length}</h2><a class="hint" href="${link(cur.id, 'review')}">Reply in Review View</a></div><div class="panel-body" style="gap:10px" id="r-cmts">${commentsHTML(cur, refs, reviewing)}
          ${reviewing ? `<textarea class="input be-text" id="r-cmt" rows="2" placeholder="Select text in the AOM first to quote it, then type your comment"></textarea><button class="btn sm ghost" id="r-addcmt">Add Comment</button>` : ''}</div></section>` : ''}
        ${reviewing ? `<section class="panel"><div class="panel-head"><h2>Decision on This AOM</h2></div><div class="panel-body">
          <button class="btn success" id="r-approve">${willFinal ? 'Approve as Final' : 'Approve and Forward to SA'}</button>
          <button class="btn ghost" id="r-return">Return to Member</button>
          <span class="hint">Batch: ${counts.approved} approved · ${list.filter((a) => a.data.status === ST.RETURNED).length} returned · ${pendingMine.length} others waiting for you</span>
          ${pendingMine.length ? `<button class="btn primary" id="r-all">${willFinal ? 'Approve Remaining as Final' : 'Approve Remaining and Forward to SA'} →</button>` : ''}</div></section>`
          : s === ST.FINAL && iAmSA ? `<section class="panel"><div class="panel-head"><h2>Final</h2></div><div class="panel-body"><span class="hint">Locked as AOM No. ${esc(aomNo(ctx.audit.auditYear, N[cur.id].n, ctx.audit.periodFrom, ctx.audit.periodTo))}.</span><button class="btn ghost" id="r-reopen">Reopen for Correction</button></div></section>` : ''}
        ${s === ST.FINAL && canManage && cur.data.poolCode ? `<section class="panel"><div class="panel-head"><h2>AOM Library</h2><span class="hint mono">${esc(cur.data.poolCode)}</span></div><div class="panel-body">
          <div style="display:flex;align-items:center;gap:12px"><button class="btn primary" id="r-lib">Update</button><span class="hint">Apply corrections to Library</span></div>
          ${cur.data.libraryUpdate ? `<span class="hint">Library updated to Version ${esc(cur.data.libraryUpdate.version)} · ${esc(when(cur.data.libraryUpdate.at))}</span>` : ''}</div></section>` : ''}`;
  }

  return {
    active: '#/review', crumbs: `<a href="#/review">For My Review</a> / <b>${esc(ctx.title)}</b>`, body,
    mount(root) {
      const reopen = $('#r-reopen', root);
      if (reopen) reopen.onclick = async () => {
        if (!(await confirmBox('Reopen Final AOM', 'Reopen this AOM for correction? It keeps its number. Approve it again when done.', 'Reopen'))) return;
        const d = clone(cur.data); d.status = ST.SA; d.history = [...(d.history || []), { at: new Date().toISOString(), by: me.email, action: 'Reopened by SA' }];
        await store.save('aoms', cur.id, d); toast('Reopened.', 'ok');
      };
      const lib = $('#r-lib', root);
      if (lib) lib.onclick = () => updateFromAom(refs, cur, ctx.varsFor(cur), 'AOM No. ' + aomNoText + ' · ' + ctx.lgu.name);
      let pane = null;
      if (view === 'review') {
        pane = mountReview($('#rv-host', root), { rec: cur, vars: ctx.varsFor(cur), me, users: refs.users, canAct: reviewing, heading: 'AOM No. ' + aomNoText, navEl: $('#rv-nav', root),
          onChange: (d) => { const c = reviewCounts(clone(d)); $('#rv-counts', root).innerHTML = (c.corrections ? pill(c.corrections + ' correction' + (c.corrections > 1 ? 's' : ''), 'grey') : '') + (c.comments ? pill(c.comments + ' comment' + (c.comments > 1 ? 's' : ''), 'grey') : ''); } });
      }
      if (!reviewing) return;
      sel.text = '';
      if (!sel.wired) {
        sel.wired = true;
        document.addEventListener('selectionchange', () => {
          const t = String(window.getSelection() || '').trim();
          const el = document.activeElement;
          const ta = el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && el.closest('#r-main') ? el.value.slice(el.selectionStart, el.selectionEnd).trim() : '';
          if (t || ta) sel.text = (ta || t).slice(0, 200);
        });
      }
      const host = $('#r-blocks', root);
      async function save() {
        stampEdits(cur.data, state.aom, me.email);
        await store.save('aoms', cur.id, state.aom);
        cur.data = clone(state.aom);
        setDirty(false); toast('Corrections saved.', 'ok'); return true;
      }
      if (host) {
        wireBlocks(host, state, (redraw) => { if (redraw) host.innerHTML = blocksHTML(state.aom, { editable, tables: (state.aom.wpData || {}).tables || {}, initials: ini() }); setDirty(true, save); });
        $('#r-title', root).oninput = (e) => { state.aom.title = e.target.value; setDirty(true, save); };
      }
      const sv = $('#r-save', root); if (sv) sv.onclick = save;
      $$('input[name=r-mode]', root).forEach((r) => { r.onchange = () => { state.aom.mode = r.value === 'major' ? 'Modified' : (cur.data.poolCode ? (cur.data.mode === 'New' ? 'New' : 'Standard') : 'New'); setDirty(true, save); }; });
      const newComment = (t) => ({ id: 'c' + Date.now().toString(36), at: new Date().toISOString(), by: me.email, text: t, quote: sel.text, replies: [], resolved: false });
      const addc = $('#r-addcmt', root);
      if (addc) addc.onclick = async () => {
        const t = $('#r-cmt', root).value.trim();
        if (!t) { toast('Type the comment first.', 'warn'); return; }
        state.aom.comments = [...(state.aom.comments || []), newComment(t)];
        await save(); emitChange('local');
      };
      const rc2 = $('#r-cmts', root);
      if (rc2) rc2.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-resolve]'); if (!b) return;
        Object.assign(state.aom.comments[+b.dataset.resolve], { resolved: true, resolvedBy: me.email, resolvedAt: new Date().toISOString() }); await save(); emitChange('local');
      });
      // Before a decision: keep anything still typed (comment box, replies), save corrections, then work on the latest copy.
      async function settle() {
        if (pane) await pane.flush();
        const box = $('#r-cmt', root);
        if (box && box.value.trim()) { state.aom.comments = [...(state.aom.comments || []), newComment(box.value.trim())]; box.value = ''; setDirty(true, save); }
        if (guard.dirty) await save();
        const fresh = await store.get('aoms', cur.id);
        state.aom = ensureIds(clone(fresh.data));
      }
      const numOk = () => { if (!$('#r-numok', root).checked) { toast('Tick "I checked the AOM numbering" first.', 'warn'); return false; } return true; };
      const approveOne = (d, id) => {
        const now = new Date().toISOString();
        if (willFinal) {
          d.status = ST.FINAL; d.number = N[id].n; d.finalAt = now; d.finalBy = me.email;
          d.history = [...(d.history || []), { at: now, by: me.email, action: `Approved as Final · AOM No. ${aomNo(ctx.audit.auditYear, N[id].n, ctx.audit.periodFrom, ctx.audit.periodTo)} locked` }];
          snapshot(d, iAmSA ? 'SA review, approved as Final' : 'Review, approved as Final', me.email);
        } else {
          d.status = ST.WITH_SA; d.atlApprovedAt = now; d.atlApprovedBy = me.email;
          d.history = [...(d.history || []), { at: now, by: me.email, action: 'Approved by ATL and forwarded to SA' }];
          snapshot(d, 'ATL review, approved and forwarded to the SA', me.email);
        }
        return d;
      };
      $('#r-approve', root).onclick = async () => {
        if (!numOk()) return;
        await settle();
        const d = approveOne(clone(state.aom), cur.id);
        await store.save('aoms', cur.id, d, { silent: true });
        await store.log(willFinal ? 'approved an AOM as Final' : 'approved an AOM and forwarded it to the SA', `${ctx.lgu.name} · ${cur.data.title}`, ctx.teamId, me.email);
        await finishIfAllFinal();
        setDirty(false); toast(willFinal ? 'Approved as Final. The number is locked.' : 'Approved and forwarded to the Supervising Auditor.', 'ok');
        const next = list.find((a) => a.id !== cur.id && mineNow(a) && a.data.status !== ST.FINAL);
        emitChange('local');
        if (next) location.hash = link(next.id, view);
      };
      $('#r-return', root).onclick = async () => {
        const r = await modal({ title: 'Return to Member', body: '<div class="field"><label class="label" for="rn">What should the member fix?</label><textarea class="input be-text" id="rn" rows="3"></textarea></div><span class="hint">Your comments and corrections stay attached to the AOM. The member sees them in Review View.</span>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Return', cls: 'primary', value: 'ok', check: (bg) => { review.rn = $('#rn', bg).value.trim(); if (!review.rn) toast('Write a short note.', 'warn'); return !!review.rn; } }] });
        if (r !== 'ok') return;
        await settle();
        const d = clone(state.aom); const now = new Date().toISOString();
        d.status = ST.RETURNED; d.returnNote = review.rn; d.returnedBy = me.email; d.returnedAt = now;
        d.returnedVersion = { title: d.title, blocks: clone(d.blocks) };
        snapshot(d, (s === ST.SA ? 'SA' : 'ATL') + ' review, returned to member', me.email);
        d.history = [...(d.history || []), { at: now, by: me.email, action: 'Returned to member: ' + review.rn }];
        await store.save('aoms', cur.id, d);
        await store.log('returned an AOM', `${ctx.lgu.name} · ${cur.data.title}`, ctx.teamId, me.email);
        toast('Returned to the member.', 'ok');
      };
      const all = $('#r-all', root);
      if (all) all.onclick = async () => {
        if (!numOk()) return;
        if (!(await confirmBox('Approve Remaining', `Approve this AOM and the ${pendingMine.length} other${pendingMine.length > 1 ? 's' : ''} waiting for you${willFinal ? ' as Final' : ' and forward them to the SA'}? Open each one first if you have not reviewed it.`, 'Approve All', 'success'))) return;
        await settle();
        for (const a of [cur, ...pendingMine]) {
          const d = approveOne(clone(a.id === cur.id ? state.aom : a.data), a.id);
          await store.save('aoms', a.id, d, { silent: true });
        }
        await store.log(willFinal ? 'approved AOMs as Final' : 'approved AOMs and forwarded them to the SA', `${ctx.lgu.name} · ${pendingMine.length + 1}`, ctx.teamId, me.email);
        await finishIfAllFinal();
        setDirty(false); emitChange('local'); toast('Done.', 'ok');
      };
      async function finishIfAllFinal() {
        const now = (await store.list('aoms')).filter((a) => a.data.auditId === ctx.rec.id);
        if (now.length && now.every((a) => a.data.status === ST.FINAL)) await advanceStage(ctx, 'SAOR and Exit Conference');
      }
      setDirty(false, save);
    }
  };
}
