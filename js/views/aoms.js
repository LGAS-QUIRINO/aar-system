// Screen 4 · AOM Drafts: edit each AOM, see it as printed, run the checks, forward for review.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, guard, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { loadAudit, stepsBar, advanceStage } from '../auditctx.js';
import { blocksHTML, wireBlocks } from '../blockeditor.js';
import { clone, checks, findingParas, paraHTML, ST, statusPill, SECTIONS, numberingCheck, fillText } from '../aom.js';
import { aomNo, aomRange, nice, timeAgo } from '../format.js';

export function aomPreviewHTML(ctx, a, data, i) {
  const n = ctx.nums[a.id]?.n || 1;
  const paras = findingParas({ ...data, _id: a.id }, { vars: ctx.varsFor({ data }), num: (i + 1) + '.', aomNoText: `${ctx.audit.auditYear}-${String(n).padStart(3, '0')}`, annexLetters: {} });
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
    <div>${esc(c.text)}</div>${c.resolved ? '<small class="hint">Resolved</small>' : canResolve ? `<button class="btn sm ghost" data-resolve="${i}">Resolve</button>` : ''}</div>`).join('');
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
    return `<a class="t-row click ${a.id === cur.id ? 'sel' : ''}" href="#/audits/${ctx.rec.id}/aoms?aom=${a.id}" style="grid-template-columns:10px 1fr;text-decoration:none;color:inherit;padding:10px 14px">
      <span class="dot" style="background:${bad ? '#C2410C' : '#2F7D4F'}" title="${bad ? 'Needs fixing' : 'Checks passed'}"></span>
      <span><span class="mono" style="font-size:12px">${esc(ctx.audit.auditYear)}-${String(N[a.id].n).padStart(3, '0')}</span> ${pill(a.data.status || 'Draft', statusPill(a.data.status || 'Draft'))}<br><b>${esc(fillText(a.data.title, ctx.varsFor(a)))}</b></span></a>`;
  }).join('');

  const flowNote = s === ST.RETURNED ? `<div class="note warn">Returned by ${esc(nice(refs.users.find((u) => u.data.email === cur.data.returnedBy)?.data.name || ''))}: ${esc(cur.data.returnNote || 'see comments')}</div>`
    : s === ST.WITH_ATL ? `<div class="note info">Forwarded to the ${esc(reviewerName)} ${esc(timeAgo(cur.data.forwardedAt))}. Not opened yet, so you can still retrieve it.</div>`
      : s === ST.FINAL ? '<div class="note ok">Final. The AOM number is locked. Only the Supervising Auditor can reopen it.</div>'
        : !draftLike(cur) ? `<div class="note info">${esc(s)}. You can view it while it is being reviewed.</div>` : '';

  const body = `${stepsBar(ctx, 'AOM Review')}
    <div class="page-head"><div><h1>Barangay ${esc(ctx.lgu.name)} AOMs</h1><p>${list.length} AOM${list.length > 1 ? 's' : ''} · ${esc(first === last ? aomNo(ctx.audit.auditYear, first, ctx.audit.periodFrom, ctx.audit.periodTo) : aomRange(ctx.audit.auditYear, first, last, ctx.audit.periodFrom, ctx.audit.periodTo))} ${nc.ok ? '' : '· <b style="color:var(--bad-ink)">Numbering has gaps or duplicates</b>'}</p></div>
      <div class="btn-row"><a class="btn ghost" href="#/audits/${ctx.rec.id}/findings">Findings</a><a class="btn ghost" href="#/audits/${ctx.rec.id}/print">Print / Word</a></div></div>
    <div class="split-3 ed">
      <section class="panel" style="align-self:start"><div class="panel-head"><h2>AOMs</h2></div>${leftHTML()}</section>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
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
        <section class="panel"><div class="panel-head"><h2>Checks</h2></div><div class="panel-body" id="a-checks" style="gap:8px">${checksHTML(allChecks(cur, state.aom))}</div></section>
        <section class="panel"><div class="panel-head"><h2>As Printed</h2></div><div class="panel-body" id="a-prev" style="padding:12px">${aomPreviewHTML(ctx, cur, state.aom, idx)}</div></section>
        <section class="panel"><div class="panel-head"><h2>Comments</h2></div><div class="panel-body" style="gap:10px">${commentsHTML(cur, refs, false)}</div></section>
      </aside></div>`;

  return {
    active: '#/drafts', crumbs: `<a href="#/audits">My Audit</a> / <a href="#/audits/${ctx.rec.id}/setup">${esc(ctx.title)}</a> / <b>AOM Drafts</b>`, body,
    mount(root) {
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
        await store.save('aoms', cur.id, state.aom);
        setDirty(false); toast('Saved.', 'ok'); return true;
      }
      async function forward(recs) {
        if (guard.dirty && !(await save())) return;
        const problems = recs.filter((a) => allChecks(a, a.id === cur.id ? state.aom : a.data).some((c) => c.st === 'bad'));
        if (problems.length && !(await confirmBox('Some Checks Need Fixing', `${problems.length} AOM${problems.length > 1 ? 's have' : ' has'} missing values or tables (${problems.map((a) => esc(a.data.title)).join(', ')}). Forward anyway?`, 'Forward Anyway'))) return;
        if (!problems.length && !(await confirmBox('Forward for Review', `Forward ${recs.length} AOM${recs.length > 1 ? 's' : ''} to ${esc(nice(ctx.atl ? ctx.atl.name : 'the reviewer'))}? You can retrieve ${recs.length > 1 ? 'them' : 'it'} until the review starts.`, 'Forward', 'success'))) return;
        const now = new Date().toISOString();
        for (const a of recs) {
          const d = a.id === cur.id ? clone(state.aom) : clone(a.data);
          d.status = ST.WITH_ATL; d.forwardedAt = now; d.forwardedBy = refs.me.email;
          d.submitted = { title: d.title, blocks: clone(d.blocks) };
          d.history = [...(d.history || []), { at: now, by: refs.me.email, action: 'Forwarded for review' }];
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
