// Consolidated SAOR: Barangays of one municipality, one Audit Year. Anyone on the team edits and prints.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, confirmBox, pill, $, $$ } from '../ui.js';
import { myTeamIds } from '../refs.js';
import { setupVars, formatVar, SETUP_VAR_NAMES, clone } from '../aom.js';
import { poolGroups } from './library.js';
import { buildSaor, saorHTML, printSaor, saorWord } from '../saor.js';

export async function saorview(refs, params, q) {
  const me = refs.me;
  const teams = myTeamIds(me, refs.teams);
  const audits = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported);
  const munOf = (a) => refs.lgu[a.data.lguId]?.data.parentId;
  const munIds = [...new Set(audits.map(munOf).filter(Boolean))].sort((x, y) => (refs.lgu[x]?.data.name || '').localeCompare(refs.lgu[y]?.data.name || ''));
  const crumbs = '<b>SAOR</b>';
  if (!munIds.length) return { active: '#/saor', crumbs, body: '<div class="page-head"><div><h1>SAOR</h1></div></div><section class="panel"><div class="empty">No audits yet.</div></section>' };
  const munId = munIds.includes(q.get('m')) ? q.get('m') : munIds[0];
  const mun = refs.lgu[munId].data;
  const years = [...new Set(audits.filter((a) => munOf(a) === munId).map((a) => Number(a.data.auditYear)))].sort((a, b) => b - a);
  const year = years.includes(Number(q.get('y'))) ? Number(q.get('y')) : years[0];
  const view = q.get('view') === 'edit' ? 'edit' : 'print';
  const list = audits.filter((a) => munOf(a) === munId && Number(a.data.auditYear) === year);
  const teamId = list[0]?.data.teamId || teams[0];
  const team = refs.team[teamId]?.data || {};
  const aoms = (await store.list('aoms')).filter((a) => list.some((x) => x.id === a.data.auditId));
  const templates = {};
  (await poolGroups()).forEach((g) => { if (g.active) templates[g.code] = g.active.data; });
  const sid = `saor-${munId}-${year}`;
  const srec = await store.get('letters', sid);
  const overrides = (srec && !srec.deleted && srec.data.overrides) || {};
  const varsOf = (au) => (a) => {
    const v = {};
    const wp = a.data.wpData;
    if (wp && wp.vars) Object.entries(wp.vars).forEach(([k, x]) => { v[k] = formatVar(k, x.raw); });
    const base = setupVars(au.data, refs.lgu[au.data.lguId]?.data, mun);
    SETUP_VAR_NAMES.forEach((k) => { if (base[k]) v[k] = base[k]; });
    return v;
  };
  const model = buildSaor({ audits: list.map((au) => ({ rec: au, lgu: refs.lgu[au.data.lguId]?.data.name || '?', vars: varsOf(au) })), aoms, templates, overrides });
  const head = { mun: mun.name, year, officeCode: team.officeCode || '' };
  const go = (o = {}) => `#/saor?m=${encodeURIComponent(o.m || munId)}&y=${o.y || year}${(o.view || view) === 'edit' ? '&view=edit' : ''}`;
  const allObs = model.sections.flatMap((s) => s.obs);
  const brgyLinks = [...new Map(allObs.flatMap((o) => o.lines).map((l) => [l.auditId, l.brgy])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const editHTML = allObs.map((o) => `<section class="panel" data-key="${esc(o.key)}"><div class="panel-head"><div><h2>${o.n}. ${esc(o.title)}</h2><span class="hint">${esc(o.code || 'Not in the AOM Library')} · ${o.lines.length} barangay${o.lines.length > 1 ? 's' : ''}</span></div>
      ${o.edited ? '<span class="pill violet" style="margin-left:auto">Edited in this SAOR</span>' : ''}</div><div class="panel-body">
      <div class="field"><label class="label" for="o-${o.n}">Observation</label><textarea class="input be-text" id="o-${o.n}" data-f="obs" rows="4">${esc(o.obs)}</textarea></div>
      <div class="field"><label class="label" for="r-${o.n}">Recommendation</label><textarea class="input be-text" id="r-${o.n}" data-f="rec" rows="4">${esc(o.rec)}</textarea></div>
      <div style="display:flex;gap:8px;align-items:center"><span class="hint">An edit here stays in this SAOR only. The AOM Library is not changed.</span>
        <button class="btn sm ghost" style="margin-left:auto" data-reset="${esc(o.key)}" ${o.edited ? '' : 'disabled'}>Reset to Library Wording</button></div></div></section>`).join('')
    || '<section class="panel"><div class="empty">No Final AOMs yet.</div></section>';

  const body = `<div class="page-head"><div><h1>SAOR · ${esc(mun.name)}</h1></div>
      <div class="btn-row"><label class="sr-only" for="s-m">Municipality</label><select class="input" id="s-m" style="width:160px">${munIds.map((id) => `<option value="${id}" ${id === munId ? 'selected' : ''}>${esc(refs.lgu[id]?.data.name || id)}</option>`).join('')}</select>
        <label class="sr-only" for="s-y">Audit Year</label><select class="input" id="s-y" style="width:170px">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>Audit Year ${y}</option>`).join('')}</select></div></div>
    <div class="panel rv-bar"><div class="seg"><a class="${view === 'print' ? 'on' : ''}" href="${go({ view: 'print' })}">Print View</a><a class="${view === 'edit' ? 'on' : ''}" href="${go({ view: 'edit' })}">Edit</a></div>
      <a class="btn sm ghost" href="#/exit?m=${encodeURIComponent(munId)}&y=${year}">✉ Exit Conference Letters</a>
      <span class="btn-row" style="margin-left:auto">${view === 'edit' ? '<button class="btn primary" id="s-save" type="button">Save</button>' : ''}<button class="btn ghost" id="s-print" type="button" ${allObs.length ? '' : 'disabled'}>Print</button><button class="btn primary" id="s-word" type="button" ${allObs.length ? '' : 'disabled'}>Word</button></span></div>
    ${view === 'print' ? `<div class="paper-wrap big" style="max-height:none"><div class="sheet saor-sheet">${saorHTML(model, head)}</div></div>` : `<div style="display:flex;flex-direction:column;gap:16px">${editHTML}</div>`}
    <div class="grid-3" style="align-items:start">
      <section class="panel"><div class="panel-head"><h2>Coverage</h2></div><div class="panel-body" style="gap:4px;font-size:13.5px">
        <div class="ckv"><span>Barangays with Final AOMs</span><b>${model.barangays}</b></div><div class="ckv"><span>Observations</span><b>${model.obsCount}</b></div>
        <div class="ckv"><span>Barangay lines</span><b>${model.lineCount}</b></div><div class="ckv"><span>Management comments received</span><b>${model.received}</b></div>
        <div class="ckv" style="color:${model.awaiting ? 'var(--warn-ink)' : 'inherit'}"><span>Awaiting comment</span><b>${model.awaiting}</b></div></div></section>
      <section class="panel"><div class="panel-head"><h2>Checks</h2></div><div class="panel-body" style="gap:4px;font-size:13px">
        <span>✓ All ${model.lineCount} Final AOMs appear under their observation</span><span>✓ AOM Nos. and amounts come from each Final AOM</span><span>✓ Totals are the sum of the barangay amounts</span>
        ${model.notFinal.length ? `<span style="color:var(--warn-ink)">! ${model.notFinal.length} AOM${model.notFinal.length > 1 ? 's are' : ' is'} not Final yet and not included: ${esc([...new Set(model.notFinal.map((x) => x.brgy))].join(', '))}</span>` : ''}</div></section>
      <section class="panel"><div class="panel-head"><h2>Management Comments</h2></div><div class="panel-body" style="gap:6px">
        <span class="hint">Entered per barangay; they fill in here by themselves.</span>
        ${brgyLinks.map(([id, name]) => `<a href="#/audits/${id}/comments" style="font-size:13.5px">${esc(name)}</a>`).join('') || '<span class="hint">None yet.</span>'}</div></section>
    </div>`;

  return {
    active: '#/saor', crumbs: `<b>SAOR</b> · ${esc(mun.name)} · Audit Year ${year}`, body,
    mount(root) {
      $('#s-m', root).onchange = (e) => { location.hash = `#/saor?m=${encodeURIComponent(e.target.value)}`; };
      $('#s-y', root).onchange = (e) => { location.hash = go({ y: e.target.value }); };
      const pr = $('#s-print', root), wd = $('#s-word', root);
      if (pr) pr.onclick = async () => { printSaor(model, head); await store.log('printed the SAOR', `${mun.name} · Audit Year ${year}`, teamId, me.email); };
      if (wd) wd.onclick = async () => {
        try { toast('Preparing the Word file…'); await saorWord(model, head); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the SAOR (Word)', `${mun.name} · Audit Year ${year}`, teamId, me.email);
      };
      if (view !== 'edit') return;
      const ov = clone(overrides);
      async function save() {
        $$('[data-key]', root).forEach((sec) => {
          const k = sec.dataset.key, o = allObs.find((x) => x.key === k);
          const obs = $('[data-f=obs]', sec).value.trim(), rec = $('[data-f=rec]', sec).value.trim();
          if (obs === o.libObs.trim() && rec === o.libRec.trim()) delete ov[k];
          else ov[k] = { obs, rec, by: me.email, at: new Date().toISOString() };
        });
        await store.save('letters', sid, { type: 'saor', teamId, munId, auditYear: year, overrides: ov }, { silent: true });
        await store.log('edited the SAOR', `${mun.name} · Audit Year ${year}`, teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      $('#s-save', root).onclick = save;
      root.addEventListener('input', (e) => { if (e.target.closest('[data-key]')) setDirty(true, save); });
      $$('[data-reset]', root).forEach((b) => { b.onclick = async () => {
        const k = b.dataset.reset;
        if (!(await confirmBox('Reset to Library Wording', 'Put back the AOM Library wording for this observation? Your edit here is removed.', 'Reset'))) return;
        delete ov[k];
        await store.save('letters', sid, { type: 'saor', teamId, munId, auditYear: year, overrides: ov }, { silent: true });
        setDirty(false); emitChange('local');
      }; });
      setDirty(false, save);
      void pill;
    }
  };
}
