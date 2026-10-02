import { store } from '../store.js';
import { esc, pill } from '../ui.js';
import { has, myTeamIds } from '../refs.js';
import { periodPhrase, timeAgo, nice } from '../format.js';

export const STAGES = ['Setup', 'Findings and AOMs', 'AOM Review', 'SAOR and Exit Conference', 'BAAR', 'Final'];

export async function auditRows(refs) {
  const teams = myTeamIds(refs.me, refs.teams);
  const all = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported);
  const mine = has(refs.me, 'member') && !has(refs.me, 'sa') && !has(refs.me, 'atl') ? all.filter((a) => a.data.memberId === refs.me.id) : all;
  return mine.map((a) => ({ rec: a, lgu: refs.lgu[a.data.lguId], mun: refs.lgu[(refs.lgu[a.data.lguId] || {}).data?.parentId] }))
    .sort((x, y) => (y.rec.data.auditYear - x.rec.data.auditYear) || String(x.lgu?.data.name).localeCompare(String(y.lgu?.data.name)));
}

export function auditTable(rows, refs, limit) {
  const cols = 'grid-template-columns: minmax(150px,1.3fr) minmax(170px,1.3fr) minmax(120px,1fr) 110px minmax(150px,1fr)';
  if (!rows.length) return `<div class="empty">No audits yet. Click <b>New Audit</b> to set up the first Barangay.</div>`;
  return `<div class="t-head" style="${cols}"><span>Barangay</span><span>Period</span><span>Stage</span><span>Status</span><span>Next Step</span></div>
    ${rows.slice(0, limit || rows.length).map(({ rec, lgu, mun }) => {
      const d = rec.data;
      const stageIdx = Math.max(0, STAGES.indexOf(d.stage || 'Setup'));
      return `<div class="t-row click" style="${cols}" data-go="#/audits/${esc(rec.id)}/setup" tabindex="0" role="link">
        <span><b>${esc(lgu ? lgu.data.name : '?')}</b><br><small style="color:var(--muted)">${esc(mun ? mun.data.name : '')} · ${esc(d.auditYear)}</small></span>
        <span>${esc(periodPhrase(d.periodFrom, d.periodTo))}</span>
        <span><div class="steps" aria-label="Stage ${stageIdx + 1} of 6">${STAGES.map((_, i) => `<i class="${i < stageIdx ? 'done' : i === stageIdx ? 'now' : ''}"></i>`).join('')}</div><small>${esc(d.stage || 'Setup')}</small></span>
        <span>${rec.pending ? pill('On Device', 'warn') : pill(d.status || 'In Progress', d.status === 'Final' ? 'ok' : 'grey')}</span>
        <span><button class="btn sm ghost" data-go="#/audits/${esc(rec.id)}/setup">${d.stage === 'Setup' || !d.stage ? 'Finish Setup' : 'Open'} →</button></span>
      </div>`;
    }).join('')}`;
}

export async function dashboard(refs) {
  const rows = await auditRows(refs);
  const logs = (await store.list('auditlog')).sort((a, b) => String(b.data.at).localeCompare(String(a.data.at))).slice(0, 6);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const first = refs.me.nickname || nice(refs.me.name).replace(/^(Atty\.|Engr\.|Dr\.)\s+/, '').split(' ')[0];
  const year = new Date().getFullYear();
  const thisYear = rows.filter((r) => Number(r.rec.data.auditYear) === year);
  const pendingSetup = rows.filter((r) => (r.rec.data.stage || 'Setup') === 'Setup').length;
  const canCreate = has(refs.me, 'member') || has(refs.me, 'atl') || has(refs.me, 'sa');
  return {
    active: '#/dashboard', crumbs: '<b>Dashboard</b>',
    body: `<div class="page-head"><div><h1>${greet}, ${esc(first)}</h1>
        <p>Audit Year ${year} · ${thisYear.length} Barangay Audit${thisYear.length === 1 ? '' : 's'} ${has(refs.me, 'sa') || has(refs.me, 'admin') ? 'in All Teams' : 'Assigned to You'}</p></div>
        <div class="btn-row"><button class="btn ghost" disabled title="Comes in Phase 2">Import Working Paper</button>
        ${canCreate ? '<a class="btn primary" href="#/audits/new">+ New Audit</a>' : ''}</div></div>
      <div class="grid-4">
        <div class="panel kpi"><span>Barangay Audits</span><b>${thisYear.length}</b><small>Audit Year ${year}</small></div>
        <div class="panel kpi ${pendingSetup ? 'warn' : ''}"><span>Setup to Finish</span><b>${pendingSetup}</b><small>officials and period to confirm</small></div>
        <div class="panel kpi"><span>AOM Drafts</span><b>–</b><small>available in Phase 2</small></div>
        <div class="panel kpi"><span>Final BAARs</span><b>${rows.filter((r) => r.rec.data.status === 'Final').length}</b><small>of ${thisYear.length}</small></div>
      </div>
      <div class="split">
        <section class="panel"><div class="panel-head"><h2>My Barangay Audits</h2><a class="btn sm ghost" href="#/audits">View All Audits</a></div>${auditTable(rows, refs, 8)}</section>
        <section class="panel"><div class="panel-head"><h2>Recent Activity</h2></div>
          <div class="panel-body" style="gap:14px">${logs.length ? logs.map((l) => `<div><b>${esc(nice(refs.users.find((u) => u.data.email === l.data.by)?.data.name || l.data.by || 'Someone'))}</b> ${esc(l.data.action)}<br><small style="color:var(--muted)">${esc(l.data.detail || '')}${l.data.detail ? ' · ' : ''}${esc(timeAgo(l.data.at))}</small></div>`).join('') : '<div class="hint">Nothing yet.</div>'}</div></section>
      </div>`
  };
}
