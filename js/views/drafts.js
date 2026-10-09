// AOM Drafts: every audit's AOMs, with what needs action.
import { store } from '../store.js';
import { esc, pill } from '../ui.js';
import { myTeamIds, has } from '../refs.js';
import { ST, statusPill } from '../aom.js';

export async function drafts(refs) {
  const teams = myTeamIds(refs.me, refs.teams);
  const audits = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported);
  const mineOnly = has(refs.me, 'member') && !has(refs.me, 'atl') && !has(refs.me, 'sa');
  const aoms = await store.list('aoms');
  const rows = audits.filter((a) => !mineOnly || a.data.memberId === refs.me.id || aoms.some((x) => x.data.auditId === a.id && x.data.memberId === refs.me.id)).map((a) => {
    const list = aoms.filter((x) => x.data.auditId === a.id);
    const c = (st) => list.filter((x) => (x.data.status || ST.DRAFT) === st).length;
    return { a, list, draft: c(ST.DRAFT), ret: c(ST.RETURNED), rev: list.length - c(ST.DRAFT) - c(ST.RETURNED) - c(ST.FINAL), fin: c(ST.FINAL), lgu: refs.lgu[a.data.lguId]?.data.name || '?' };
  }).sort((x, y) => (y.ret - x.ret) || x.lgu.localeCompare(y.lgu));
  const cols = 'grid-template-columns:minmax(160px,1fr) repeat(4, 110px) 170px';
  return {
    active: '#/drafts', crumbs: '<b>AOM Drafts</b>',
    body: `<div class="page-head"><div><h1>AOM Drafts</h1><p>AOMs by Barangay. Returned AOMs are listed first.</p></div></div>
      <section class="panel"><div class="t-head" style="${cols}"><span>Barangay</span><span>Draft</span><span>Returned</span><span>In Review</span><span>Final</span><span></span></div>
      ${rows.map((r) => `<div class="t-row" style="${cols}"><span><b>${esc(r.lgu)}</b><br><small class="hint">Audit Year ${esc(r.a.data.auditYear)}</small></span>
        <span>${r.draft || '–'}</span><span>${r.ret ? pill(r.ret + ' Returned', 'warn') : '–'}</span><span>${r.rev || '–'}</span><span>${r.fin ? pill(r.fin + ' Final', 'ok') : '–'}</span>
        <span>${r.list.length ? `<a class="btn sm primary" href="#/audits/${r.a.id}/aoms">Open AOMs →</a>` : `<a class="btn sm ghost" href="#/audits/${r.a.id}/findings">Select Findings →</a>`}</span></div>`).join('') || '<div class="empty">No audits yet.</div>'}</section>`
  };
}
void statusPill;
