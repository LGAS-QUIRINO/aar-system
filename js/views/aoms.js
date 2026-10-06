// Screen 4 · AOM Drafts: edit each AOM, see it as printed, run the checks, forward for review.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, guard, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { loadAudit, stepsBar, advanceStage } from '../auditctx.js';
import { blocksHTML, wireBlocks } from '../blockeditor.js';
import { clone, checks, findingParas, paraHTML, ST, statusPill, SECTIONS, numberingCheck, fillText, ensureIds, stampEdits, openComments, answered, snapshot } from '../aom.js';
import { aomNo, aomRange, nice, timeAgo, initials } from '../format.js';
import { mountReview, reviewCounts, when } from '../reviewpane.js';
import { aomTrail, includedLine, printTrail, trailWord } from '../reviewtrail.js';

export function aomPreviewHTML(ctx, a, data, i) {
  const n = ctx.nums[a.id]?.n || 1;
  const paras = findingParas({ ...data, _id: a.id }, { vars: ctx.varsFor({ data }), num: (i + 1) + '.', aomNoText: aomNo(ctx.audit.auditYear, n, ctx.audit.periodFrom, ctx.audit.periodTo), annexLetters: {} });
  return `<div class="paper-wrap"><div class="aom-doc sheet">${paras.map((p) => paraHTML(p, true)).join('')}</div></div>`;
}

export function checksHTML(list) {
  const icon = { ok: '✓', bad: '!', warn: '!', wait: '○' };
  return list.map((c) => `<div class="chk ${c.st}"><span class="ic" aria-hidden="true">${icon[c.st]}</span><span>${esc(c.t)}</span></div>`).join('');
}

export function commentsHTML(a, refs, canResolve) {
  const cs = a.data.comments || [];
  if (!cs.length) return '<div class="hint">No comments.</div>';
  const who = (e) => nice(refs.users.find((u) => u.data.email === e)?.data.name || e);
  return cs.map((c, i) => `<div class="cmt ${c.resolved ? 'resolved' : ''}"><div><b>${esc(who(c.by))}</b> <small class="hint">· ${esc(timeAgo(c.at))}${c.quote ? ' · on “' + esc(c.quote.slice(0, 60)) + '”' : ''}</small></div>
    <div>${esc(c.text)}</div>${(c.replies || []).map((r) => `<div style="margin-left:8px;padding-left:8px;border-left:2px solid #C9D6E5"><b>${esc(who(r.by))}</b> <small class="hint">· ${esc(timeAgo(r.at))}</small><br>${esc(r.text)}</div>`).join('')}
    ${c.resolved ? '<small class="hint">Resolved</small>' : canResolve ? `<button class="btn sm ghost" data-resolve="${i}">Resolve</button>` : ''}</div>`).join('');
}

export async function aoms(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/drafts', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found on this device.</div>' };
  const list = ctx.aoms;
  if (!list.length) {
    return { active: '#/drafts', crumbs: `<a href="#/audits">My Audit</a> / <b>${esc(ctx.title)}</b>`, body: `${stepsBar(ctx, 'AOM Review')}<section class="panel"><div class="empty">No findings yet. <a class="btn primary" href="#/audits/${ctx.rec.id}/findings">Go to Findings</a></div></section>` };
  }
  const cur = list.find((a) => a.id === q.get('aom')) || list[0];
  const idx = list.indexOf(cur);
  const editable = ctx.canEdit(cur);
  ensureIds(cur.data);
  const state = { aom: clone(cur.data) };
  const vars = ctx.varsFor(cur);
  const allChecks = (a, d) => checks(d, ctx.varsFor({ data: d }), ctx.audit);
  const N = ctx.nums;
  const nc = numberingCheck(N);
  const first = N[list[0].id].n, last = Math.max(...Object.values(N).map((x) => x.n));
  const draftLike = (a) => [ST.DRAFT, ST.RETURNED].includes(a.data.status || ST.DRAFT);
  const sendable = list.filter(draftLike);
  const s = cur.data.status || ST.DRAFT;
  const reviewerName = ctx.oneStep ? 'Reviewer' : 'ATL';

  const leftHTML = () => list.map((a, i) => {
    const bad = allChecks(a, a.id === cur.id ? state.aom : a.data).some((c) => c.st === 'bad');
    const open = a.data.status === ST.RETURNED ? openComments(a.data, refs.me.email).length : 0;
    return `<a class="t-row click ${a.id === cur.id ? 'sel' : ''}" href="#/audits/${ctx.rec.id}/aoms?aom=${a.id}" style="grid-template-columns:10px 1fr;text-decoration:none;color:inherit;padding:10px 14px">
      <span class="dot" style="background:${bad ? '#C2410C' : '#2F7D4F'}" title="${bad ? 'Needs fixing' : 'Draft Results all clear'}"></span>
      <span><span class="mono" style="font-size:12px">AOM No. ${esc(aomNo(ctx.audit.auditYear, N[a.id].n, ctx.audit.periodFrom, ctx.audit.periodTo))}</span><br> ${pill(a.data.status || 'Draft', statusPill(a.data.status || 'Draft'))}${open ? ' ' + pill(open + ' open', 'warn') : ''}<br><b>${esc(fillText(a.data.title, ctx.varsFor(a)))}</b></span></a>`;
  }).join('');

  const flowNote = s === ST.RETURNED ? `<div class="note warn">Returned by ${esc(nice(refs.users.find((u) => u.data.email === cur.data.returnedBy)?.data.name || ''))}: ${esc(cur.data.returnNote || 'see comments')}</div>`
    : s === ST.WITH_ATL ? `<div class="note info">Forwarded to the ${esc(reviewerName)} ${esc(timeAgo(cur.data.forwardedAt))}. Not opened yet, so you can still retrieve it.</div>`
      : s === ST.FINAL ? '<div class="note ok">Final. The AOM number is locked. Only the Supervising Auditor can reopen it.</div>'
        : !draftLike(cur) ? `<div class="note info">${esc(s)}. You can view it while it is being reviewed.</div>` : '';

  // Review View (Word-style corrections and comments) once the AOM has been forwarded at least once.
  const forwarded = !!cur.data.submitted;
  const view = q.get('view') || (s === ST.RETURNED ? 'review' : 'edit');
  const isReview = forwarded && view === 'review';
  const vlink = (v) => `#/audits/${ctx.rec.id}/aoms?aom=${cur.id}&view=${v}`;
  const toggle = forwarded ? `<div class="seg" role="group" aria-label="View"><a class="${isReview ? 'on' : ''}" href="${vlink('review')}">Review View</a><a class="${isReview ? '' : 'on'}" href="${vlink('edit')}">Edit Text</a></div>` : '';
  const aomNoText = aomNo(ctx.audit.auditYear, N[cur.id].n, ctx.audit.periodFrom, ctx.audit.periodTo);
  const userName = (e) => nice(refs.users.find((u) => u.data.email === e)?.data.name || e || '');
  const countPills = (d) => { const c = reviewCounts(clone(d)); return `${c.corrections ? pill(c.corrections + ' correction' + (c.corrections > 1 ? 's' : ''), 'grey') : ''} ${c.comments ? pill(`${c.comments} comment${c.comments > 1 ? 's' : ''} · ${c.answered} answered or resolved`, 'grey') : ''}`; };
  const prevA = list[idx - 1], nextA = list[idx + 1];
  const aomLink = (a) => `#/audits/${ctx.rec.id}/aoms?aom=${a.id}&view=${a.data.submitted ? 'review' : 'edit'}`;
  const reviewBody = `${stepsBar(ctx, 'AOM Review')}
    <div class="rv-banner" ${s === ST.RETURNED ? '' : 'style="background:#fff;border-color:var(--line)"'}>${pill(s, statusPill(s))}<h1>AOM No. ${esc(aomNoText)} · ${esc(fillText(cur.data.title, vars))}</h1>
      <span id="rv-counts" style="margin-left:auto;display:flex;gap:6px">${countPills(cur.data)}</span>
      ${s === ST.RETURNED ? `<div class="msg">Returned by <b>${esc(userName(cur.data.returnedBy))}</b> · ${esc(when(cur.data.returnedAt))}${cur.data.returnNote ? ': “' + esc(cur.data.returnNote) + '”' : ''}</div>`
        : `<div class="msg" style="color:var(--muted)">${esc(s)}. You can read the corrections and comments while it is being reviewed.</div>`}</div>
    <div class="panel rv-bar">${toggle}<div class="rv-nav" id="rv-nav"></div>
      <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="a-trail" type="button">Review Trail</button>${prevA ? `<a class="btn sm ghost" href="${aomLink(prevA)}">‹ Previous AOM</a>` : ''}<span class="hint">AOM ${idx + 1} of ${list.length}</span>${nextA ? `<a class="btn sm ghost" href="${aomLink(nextA)}">Next AOM ›</a>` : ''}</span></div>
    <div id="rv-host"></div>
    ${s === ST.RETURNED && editable ? `<div class="panel rv-foot"><div id="rv-block" style="max-width:260px"></div>
      <textarea class="input" id="rv-note" aria-label="Note to the ${esc(reviewerName)}" placeholder="Note to the ${esc(reviewerName)} (optional), e.g. Kept the amount, see my reply on the topic sentence.">${esc(cur.data.forwardNoteDraft || '')}</textarea>
      <button class="btn ghost" id="rv-save">Save</button><button class="btn success" id="rv-fwd">Forward Again to ${esc(reviewerName)}</button></div>` : ''}`;

  const body = isReview ? reviewBody : `${stepsBar(ctx, 'AOM Review')}
    <div class="page-head"><div><h1>Barangay ${esc(ctx.lgu.name)} AOMs</h1><p>${list.length} AOM${list.length > 1 ? 's' : ''} · ${esc(first === last ? aomNo(ctx.audit.auditYear, first, ctx.audit.periodFrom, ctx.audit.periodTo) : aomRange(ctx.audit.auditYear, first, last, ctx.audit.periodFrom, ctx.audit.periodTo))} ${nc.ok ? '' : '· <b style="color:var(--bad-ink)">Numbering has gaps or duplicates</b>'}</p></div>
      <div class="btn-row"><a class="btn ghost" href="#/audits/${ctx.rec.id}/findings">Findings</a><a class="btn ghost" href="#/audits/${ctx.rec.id}/print">Print / Word</a>${list.some((a) => a.data.status === ST.FINAL) ? `<a class="btn ghost" href="#/audits/${ctx.rec.id}/comments">Management Comments</a>` : ''}<button class="btn primary" id="a-trail" type="button">Review Trail</button></div></div>
    <div class="split-3 ed">
      <section class="panel" style="align-self:start"><div class="panel-head"><h2>AOMs</h2></div>${leftHTML()}</section>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        ${toggle ? `<div class="panel rv-bar">${toggle}<span class="hint">Review View shows the reviewer's corrections and comments.</span></div>` : ''}
        <section class="panel"><div class="panel-head"><div><span class="label">AOM No.</span><div class="mono" style="font-size:18px;font-weight:600">${esc(aomNo(ctx.audit.auditYear, N[cur.id].n, ctx.audit.periodFrom, ctx.audit.periodTo))}${N[cur.id].locked ? ' 🔒' : ''}</div>
            <span class="hint">${esc(cur.data.poolCode || 'Not in Library')}${cur.data.poolVersion ? ' Version ' + cur.data.poolVersion : ''} · Part II ${esc(SECTIONS[cur.data.section] || '')}</span></div>
            <div style="display:flex;gap:6px">${pill(s, statusPill(s))}${pill(cur.data.mode || 'Standard', cur.data.mode === 'Modified' ? 'warn' : 'grey')}</div></div>
          <div class="panel-body">${flowNote}
            <div class="field"><label class="label" for="a-title">Finding Title</label><input class="input strong" id="a-title" value="${esc(state.aom.title)}" ${editable ? '' : 'disabled'}><span class="hint">Add the amount if needed, e.g. "Unliquidated Cash Advances – ₱[TOTAL_UNLIQ_CA]".</span></div>
            <div id="a-blocks">${blocksHTML(state.aom, { editable, tables: (state.aom.wpData || {}).tables || {} })}</div></div></section>
        <div class="panel savebar">
          <span class="save-state saved"><span class="d"></span>All Changes Saved</span>
          <div class="btn-row" style="margin-left:auto;flex-wrap:wrap">
            <a class="btn ghost" href="#/audits/${ctx.rec.id}/print?draft=1">Print Draft</a>
            ${editable && draftLike(cur) ? `<button class="btn primary" id="a-save">Save</button>
              <button class="btn success" id="a-fwd">Forward This AOM to ${esc(reviewerName)}</button>
              ${sendable.length > 1 ? `<button class="btn ghost" id="a-fwd-all">Forward All ${sendable.length} as Batch →</button>` : ''}` : editable ? '<button class="btn primary" id="a-save">Save</button>' : ''}
            ${s === ST.WITH_ATL && (ctx.isMember) ? '<button class="btn ghost" id="a-retrieve">Retrieve</button>' : ''}
          </div></div>
      </div>
      <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <section class="panel"><div class="panel-head"><h2>Draft Results</h2></div><div class="panel-body" id="a-checks" style="gap:8px">${checksHTML(allChecks(cur, state.aom))}</div></section>
        <section class="panel"><div class="panel-head"><h2>Print View</h2></div><div class="panel-body" id="a-prev" style="padding:12px">${aomPreviewHTML(ctx, cur, state.aom, idx)}</div></section>
        <section class="panel"><div class="panel-head"><h2>Comments</h2></div><div class="panel-body" style="gap:10px">${commentsHTML(cur, refs, false)}</div></section>
      </aside></div>`;

  return {
    active: '#/drafts', crumbs: `<a href="#/audits">My Audit</a> / <a href="#/audits/${ctx.rec.id}/setup">${esc(ctx.title)}</a> / <b>AOM Drafts</b>`, body,
    mount(root) {
      const tr = $('#a-trail', root);
      if (tr) tr.onclick = () => reviewTrailDialog(ctx, refs, list, N, cur.id);
      if (isReview) {
        const canAct = editable && s === ST.RETURNED;
        const foot = (d) => {
          const n = openComments(d, refs.me.email).length;
          const bl = $('#rv-block', root), fw = $('#rv-fwd', root);
          if (bl) bl.innerHTML = n ? `<div class="blocked"><b>${n} comment${n > 1 ? 's' : ''} not yet answered</b><br>Reply to ${n > 1 ? 'each' : 'it'} or mark ${n > 1 ? 'them' : 'it'} resolved before forwarding.</div>` : '<div class="hint">All comments answered or resolved.</div>';
          if (fw) fw.disabled = !!n;
          $('#rv-counts', root).innerHTML = countPills(d);
        };
        const pane = mountReview($('#rv-host', root), { rec: cur, vars, me: refs.me, users: refs.users, canAct, heading: 'AOM No. ' + aomNoText, navEl: $('#rv-nav', root), onChange: foot });
        foot(cur.data);
        const note = $('#rv-note', root);
        const saveNote = async () => {
          await pane.flush();
          const fresh = await store.get('aoms', cur.id); const d = ensureIds(clone(fresh.data));
          d.forwardNoteDraft = note ? note.value.trim() : '';
          await store.save('aoms', cur.id, d, { silent: true }); cur.data = d; setDirty(false); return true;
        };
        if (note) note.oninput = () => setDirty(true, saveNote);
        const sb = $('#rv-save', root); if (sb) sb.onclick = async () => { await saveNote(); toast('Saved.', 'ok'); };
        const fb = $('#rv-fwd', root);
        if (fb) fb.onclick = async () => {
          await saveNote();
          const fresh = await store.get('aoms', cur.id);
          state.aom = ensureIds(clone(fresh.data));
          const n = openComments(state.aom, refs.me.email).length;
          if (n) { toast(`Answer or mark resolved ${n} comment${n > 1 ? 's' : ''} first.`, 'bad'); foot(state.aom); return; }
          await forward([cur], note ? note.value.trim() : '');
        };
        return;
      }
      if (!editable && s !== ST.WITH_ATL) return;
      const host = $('#a-blocks', root);
      const refresh = () => {
        $('#a-prev', root).innerHTML = aomPreviewHTML(ctx, cur, state.aom, idx);
        $('#a-checks', root).innerHTML = checksHTML(allChecks(cur, state.aom));
      };
      let t = null;
      const changed = (redraw) => {
        if (redraw) host.innerHTML = blocksHTML(state.aom, { editable, tables: (state.aom.wpData || {}).tables || {} });
        setDirty(true, save); clearTimeout(t); t = setTimeout(refresh, 250);
      };
      if (editable) {
        wireBlocks(host, state, changed);
        $('#a-title', root).oninput = (e) => { state.aom.title = e.target.value; changed(false); };
      }
      async function save() {
        if (!state.aom.title.trim()) { toast('Enter the finding title.', 'bad'); return false; }
        stampEdits(cur.data, state.aom, refs.me.email);
        await store.save('aoms', cur.id, state.aom);
        cur.data = clone(state.aom);
        setDirty(false); toast('Saved.', 'ok'); return true;
      }
      async function forward(recs, note = '') {
        if (guard.dirty && !(await save())) return;
        const blocked = recs.filter((a) => openComments(a.id === cur.id ? state.aom : a.data, refs.me.email).length);
        if (blocked.length) { toast(`Answer or mark resolved every comment first: ${blocked.map((a) => fillText(a.data.title, ctx.varsFor(a))).join(', ')}. Open Review View to reply.`, 'bad'); return; }
        const problems = recs.filter((a) => allChecks(a, a.id === cur.id ? state.aom : a.data).some((c) => c.st === 'bad'));
        // Every placeholder must have its value (and every table its data) before an AOM goes for review.
        if (problems.length) { toast(`Fill in the missing values or tables first: ${problems.map((a) => fillText(a.data.title, ctx.varsFor(a))).join(', ')}. See Draft Results.`, 'bad'); return; }
        if (!(await confirmBox('Forward for Review', `Forward ${recs.length} AOM${recs.length > 1 ? 's' : ''} to ${esc(nice(ctx.atl ? ctx.atl.name : 'the reviewer'))}? You can retrieve ${recs.length > 1 ? 'them' : 'it'} until the review starts.`, 'Forward', 'success'))) return;
        const now = new Date().toISOString();
        for (const a of recs) {
          const d = a.id === cur.id ? clone(state.aom) : clone(a.data);
          ensureIds(d);
          const again = d.status === ST.RETURNED;
          d.status = ST.WITH_ATL; d.forwardedAt = now; d.forwardedBy = refs.me.email;
          // The reviewer compares against what they returned, so they see exactly what the member changed since.
          d.submitted = d.returnedVersion ? clone(d.returnedVersion) : { title: d.title, blocks: clone(d.blocks) };
          delete d.returnedVersion;
          stampEdits(d, d, refs.me.email, { prune: true });
          const n = a.id === cur.id ? (note || d.forwardNoteDraft || '') : (d.forwardNoteDraft || '');
          d.forwardNote = n; delete d.forwardNoteDraft;
          d.history = [...(d.history || []), { at: now, by: refs.me.email, action: (again ? 'Forwarded again after corrections' : 'Forwarded for review') + (n ? ': ' + n : '') }];
          snapshot(d, again ? 'Member revision, forwarded again' : 'Draft forwarded for review', refs.me.email);
          await store.save('aoms', a.id, d, { silent: true });
        }
        await advanceStage(ctx, 'AOM Review');
        await store.log('forwarded AOMs for review', `${ctx.lgu.name} · ${recs.length}`, ctx.teamId, refs.me.email);
        setDirty(false); emitChange('local'); toast(`Forwarded ${recs.length} AOM${recs.length > 1 ? 's' : ''}.`, 'ok');
      }
      const sv = $('#a-save', root); if (sv) sv.onclick = save;
      const f1 = $('#a-fwd', root); if (f1) f1.onclick = () => forward([cur]);
      const fa = $('#a-fwd-all', root); if (fa) fa.onclick = () => forward(sendable);
      const rt = $('#a-retrieve', root);
      if (rt) rt.onclick = async () => {
        const fresh = await store.get('aoms', cur.id);
        if (fresh.data.status !== ST.WITH_ATL) { toast('The review has already started. It can no longer be retrieved.', 'bad'); emitChange('local'); return; }
        const d = clone(fresh.data); d.status = ST.DRAFT; d.history = [...(d.history || []), { at: new Date().toISOString(), by: refs.me.email, action: 'Retrieved by member' }];
        await store.save('aoms', cur.id, d); toast('Retrieved. You can edit it again.', 'ok');
      };
      setDirty(false, editable ? save : null);
      void modal; void $$;
    }
  };
}

// Review Trail: tick the AOMs to include (all ticked to start), then Print or Word (Track Changes).
async function reviewTrailDialog(ctx, refs, list, N, curId) {
  const no = (a) => aomNo(ctx.audit.auditYear, N[a.id].n, ctx.audit.periodFrom, ctx.audit.periodTo);
  const nameOf = (e) => (e ? nice(refs.users.find((u) => u.data.email === e)?.data.name || e) : '');
  const sorted = list.slice().sort((a, b) => N[a.id].n - N[b.id].n);
  let action = null;
  const r = await modal({
    title: 'Review Trail · Barangay ' + ctx.lgu.name, wide: true,
    body: `<label class="check"><input type="checkbox" id="rt-all" checked><b>Select all</b></label>
      <div style="display:flex;flex-direction:column;gap:2px;max-height:46vh;overflow:auto;border:1px solid var(--line-2);border-radius:8px;padding:6px 10px">${sorted.map((a) => `<label class="check"><input type="checkbox" name="rt" value="${a.id}" checked><span><span class="mono" style="font-size:12px">AOM No. ${esc(no(a))}</span> · ${esc(fillText(a.data.title, ctx.varsFor(a)))}</span></label>`).join('')}</div>
      <span class="hint">Includes the history, every round of corrections with initials, the comments and replies, and the final text. Marked "REVIEW TRAIL – Not for Issuance". The first page states which AOMs are included.</span>`,
    onOpen: (bg) => {
      const all = $('#rt-all', bg), boxes = $$('input[name=rt]', bg);
      all.onchange = () => boxes.forEach((b) => { b.checked = all.checked; });
      boxes.forEach((b) => { b.onchange = () => { all.checked = boxes.every((x) => x.checked); }; });
    },
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null },
      { label: 'Print', cls: 'ghost', value: 'print', check: (bg) => { action = $$('input[name=rt]:checked', bg).map((x) => x.value); if (!action.length) toast('Tick at least one AOM.', 'warn'); return action.length > 0; } },
      { label: 'Word (Track Changes)', cls: 'primary', value: 'word', check: (bg) => { action = $$('input[name=rt]:checked', bg).map((x) => x.value); if (!action.length) toast('Tick at least one AOM.', 'warn'); return action.length > 0; } }]
  });
  if (!r || !action) return;
  const fresh = await Promise.all(sorted.filter((a) => action.includes(a.id)).map((a) => store.get('aoms', a.id)));
  const trails = fresh.filter(Boolean).map((a) => aomTrail(a, { no: no(a), vars: ctx.varsFor(a), nameOf }));
  const place = `Barangay ${ctx.lgu.name}, ${ctx.mun.name || ''}, Quirino`;
  const file = { title: 'AOM Review Trail · ' + ctx.lgu.name, place, included: includedLine(trails, list.length), trails,
    footer: `Barangay ${ctx.lgu.name} · AOM Review Trail`, fileName: `${String(ctx.lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_AOM_Review_Trail` };
  if (r === 'print') printTrail(file);
  else { try { toast('Preparing the Word file…'); await trailWord(file); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; } }
  await store.log(r === 'print' ? 'printed the AOM review trail' : 'downloaded the AOM review trail (Word)', `${ctx.lgu.name} · ${trails.length} AOM${trails.length > 1 ? 's' : ''}`, ctx.teamId, refs.me.email);
  void curId;
}
