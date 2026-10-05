// Audit step 2 · Financial Statements. Five tabs, in the order the work is done:
//   Trial Balance · Budget · Statements · Lead Schedules · Results.
// The figures confirmed here are what the BAAR shows in Part 06 (statements) and Part 07 (Notes).
import { store, emitChange } from '../store.js';
import { esc, toast, modal, confirmBox, pill, $ } from '../ui.js';
import { has } from '../refs.js';
import { nice, longDate } from '../format.js';
import { loadAudit, stepsBar, advanceStage } from '../auditctx.js';
import { fsId, loadFsRec } from '../fs.js';
import { loadFS, inputScreen, afsScreen, afsChecks, fsDoc, checkHTML, tbResultsHTML, canConfirm, tabs, tabStatus } from './baarfs.js';
import { budgetTab } from './fsbudget.js';
import { mgmtPanel, mgmtResults } from './fsmgmt.js';
import { leadsTab } from './fsleads.js';
import { findingsPanel } from './fsflags.js';

const TABS = [['input', 'Trial Balance'], ['budget', 'Budget'], ['fs', 'Statements'], ['leads', 'Lead Schedules'], ['results', 'Results']];

export async function fsStep(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/audits', crumbs: '<a href="#/audits">My Audit</a> / <b>Not Found</b>', body: '<div class="note bad">This audit was not found on this device.</div>' };
  const me = refs.me;
  const F = await loadFS(ctx);
  const canEdit = !!(ctx.isMember || ctx.atl?.id === me.id || ctx.sa?.id === me.id || has(me, 'admin'));
  const base = `#/audits/${ctx.rec.id}/fs?v=1`;
  const s = TABS.some(([k]) => k === q.get('s')) ? q.get('s') : 'input';
  let v;
  if (s === 'input') v = inputScreen({ F, ctx, me, q, base, canEdit });
  else if (s === 'budget') v = await budgetTab({ F, ctx, me, q, base, canEdit });
  else if (s === 'fs') { const m = await mgmtPanel({ F, ctx, me, q, base, canEdit }); v = afsScreen({ F, ctx, me, q, base, canEdit, mode: 'fs', extra: { top: m.body } }); const mv = v.mount; v.mount = (root) => { mv(root); m.mount(root); }; }
  else if (s === 'leads') v = await leadsTab({ F, ctx, me, q, base, canEdit });
  else v = await resultsTab({ F, ctx, me, q, base, canEdit });
  const conf = F.rec && F.rec.confirmed;
  const tbDone = tabs(F).every((x) => tabStatus(F, x).done);
  const tabPill = (k) => k === 'input' ? (F.figY.any ? (tbDone ? '' : ' <i class="dot warn"></i>') : '') : k === 'results' && conf ? ' ✓' : '';
  const body = `${stepsBar(ctx, 'Financial Statements')}
    <div class="page-head"><div><h1>Financial Statements · Barangay ${esc(ctx.lgu.name)}</h1><p>${esc(ctx.mun.name)}, Quirino · For the Calendar Years ${F.yp} to ${F.y}</p></div>
      <div>${conf ? pill(`✓ Confirmed as Submitted · ${longDate((conf.at || '').slice(0, 10))}`, 'ok') : pill('Not yet confirmed', 'warn')}</div></div>
    <nav class="steptabs" aria-label="Financial Statements">${TABS.map(([k, t]) => `<a class="${k === s ? 'on' : ''}" href="${base}&s=${k}">${esc(t)}${tabPill(k)}</a>`).join('')}</nav>
    ${conf && s !== 'results' && s !== 'leads' ? `<div class="note ok" style="display:block">Confirmed as submitted by ${esc(nice(conf.byName || conf.by))}. Everything here is locked; the SA or Admin can reopen it on the Results tab.</div>` : ''}
    ${v.body}`;
  return {
    active: '#/audits', crumbs: `<a href="#/audits">My Audit</a> / <a href="#/audits/${ctx.rec.id}/setup">${esc(ctx.title)}</a> / <b>Financial Statements</b>`, body,
    mount(root) { v.mount(root); }
  };
}

/* ── Results ── */
async function resultsTab({ F, ctx, me, q, base, canEdit }) {
  const conf = F.rec && F.rec.confirmed;
  const pf = await findingsPanel({ F, ctx, me, q, base, canEdit });
  const doc = fsDoc(F, 0);
  const c = afsChecks(F, doc);
  const mr = mgmtResults(F);
  const ready = canConfirm(F);
  const confirmHTML = conf
    ? `<div class="note ok" style="display:block">Confirmed as submitted by ${esc(nice(conf.byName || conf.by))}, ${esc(longDate((conf.at || '').slice(0, 10)))}. The trial balances, the budget and the statements are locked for the BAAR (Parts 06 and 07).</div>
       ${has(me, 'sa') || has(me, 'admin') ? '<div class="lr-row"><span class="hint">Only the SA or Admin can reopen them, with a reason.</span><button class="btn sm ghost" type="button" id="fs-reopen">Reopen</button></div>' : '<span class="hint">Only the SA or Admin can reopen them.</span>'}`
    : `<p class="hint" style="margin:0 0 8px">When the trial balances, the budget and the statements are final, confirm them as submitted. They are then locked for the BAAR (Parts 06 and 07). Only the SA or Admin can reopen them, with a reason.</p>
       ${ready ? '' : '<p class="hint" style="margin:0 0 8px;color:var(--warn-ink)">Every fund and year must be entered, balanced and with nothing left to fix on the Trial Balance tab.</p>'}
       ${canEdit ? `<button class="btn primary" type="button" id="fs-confirm" ${ready ? '' : 'disabled'}>Confirm as Submitted</button>` : ''}`;
  const body = `<div class="xcols" style="grid-template-columns:minmax(0,1fr) 310px">
      <div class="xform">${pf.body}</div>
      <div class="xform">
        <section class="panel"><div class="panel-head"><h2>Trial Balance Results</h2></div><div class="panel-body ck">${tbResultsHTML(F)}</div></section>
        <section class="panel"><div class="panel-head"><h2>Statement Results</h2></div><div class="panel-body ck">${checkHTML([...c.out, ...mr])}</div></section>
        <section class="panel"><div class="panel-head"><h2>Confirm</h2></div><div class="panel-body">${confirmHTML}</div></section>
      </div></div>`;
  return {
    body,
    mount(root) {
      pf.mount(root);
      const { audit, lgu } = ctx;
      const cf = $('#fs-confirm', root);
      if (cf) cf.onclick = async () => {
        if (!(await confirmBox('Confirm as Submitted', `Confirm the financial statements of Barangay ${esc(lgu.name)} as submitted? The trial balances, the budget and the statements are then locked for the BAAR.`, 'Confirm', 'success'))) return;
        const cur = (await loadFsRec(F.lguId, F.y)) || { type: 'fs', teamId: ctx.teamId, lguId: F.lguId, year: F.y, auditId: ctx.rec.id };
        await store.save('letters', fsId(F.lguId, F.y), { ...cur, auditId: ctx.rec.id, confirmed: { at: new Date().toISOString(), by: me.email, byName: me.name } }, { silent: true });
        await store.log('confirmed the financial statements as submitted', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        await advanceStage(ctx, 'Financial Statements');
        toast('Confirmed. The BAAR now shows these statements.', 'ok');
        emitChange('local');
      };
      const ro = $('#fs-reopen', root);
      if (ro) ro.onclick = async () => {
        let reason = '';
        const ok = await modal({ title: 'Reopen Financial Statements', body: '<p style="margin:0 0 10px;font-size:14px;line-height:1.5">Reopening lets the trial balances, the budget and the statements be changed again; the BAAR changes with them.</p><div class="field"><label class="label" for="ro-r">Reason</label><input class="input" id="ro-r"></div>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Reopen', cls: 'primary', value: 'ok', check: (bg) => { reason = $('#ro-r', bg).value.trim(); if (!reason) { toast('Please give the reason.', 'bad'); return false; } return true; } }] });
        if (!ok) return;
        const cur = await loadFsRec(F.lguId, F.y);
        await store.save('letters', fsId(F.lguId, F.y), { ...cur, confirmed: null, reopened: [...((cur && cur.reopened) || []), { at: new Date().toISOString(), by: me.email, reason }] }, { silent: true });
        await store.log('reopened the financial statements', `${lgu.name} · ${audit.auditYear} · Reason: ${reason}`, ctx.teamId, me.email);
        emitChange('local');
      };
    }
  };
}
