import { auditRows, auditTable } from './dashboard.js';
import { has } from '../refs.js';

export async function audits(refs, params, q) {
  const rows = await auditRows(refs);
  const years = [...new Set(rows.map((r) => r.rec.data.auditYear))].sort().reverse();
  const yr = q.get('year') || '';
  const shown = yr ? rows.filter((r) => String(r.rec.data.auditYear) === yr) : rows;
  const canCreate = has(refs.me, 'member') || has(refs.me, 'atl') || has(refs.me, 'sa') || has(refs.me, 'staff');
  return {
    active: '#/audits', crumbs: '<b>My Audit</b>',
    body: `<div class="page-head"><div><h1>My Audit</h1><p>Every Barangay audit you can see. Click a row to open it.</p></div>
      <div class="btn-row"><label class="sr-only" for="yr">Audit Year</label>
        <select class="input" id="yr" style="width:160px"><option value="">All Audit Years</option>${years.map((y) => `<option ${String(y) === yr ? 'selected' : ''}>${y}</option>`).join('')}</select>
        ${canCreate ? '<a class="btn primary" href="#/audits/new">+ New Audit</a>' : ''}</div></div>
      <section class="panel">${auditTable(shown, refs)}</section>`,
    mount(root) { root.querySelector('#yr').onchange = (e) => { location.hash = '#/audits' + (e.target.value ? '?year=' + e.target.value : ''); }; }
  };
}
