// AOM Library: the team's library of AOM templates.
import { store, newId, emitChange } from '../store.js';
import { esc, toast, setDirty, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { has } from '../refs.js';
import { blocksHTML, wireBlocks } from '../blockeditor.js';
import { clone, placeholders, SECTIONS, SETUP_VAR_NAMES } from '../aom.js';
import { POOL_SEED } from '../library-seed.js';
import { nice, longDate } from '../format.js';

const STATUS_KIND = { Active: 'ok', Draft: 'grey', Proposed: 'warn', Superseded: 'grey', Retired: 'grey' };

// Group pool records by template code. Each group: { code, active, latest, versions[] }
export async function poolGroups() {
  const all = await store.list('aom_library');
  const by = {};
  all.forEach((r) => { (by[r.data.code] = by[r.data.code] || []).push(r); });
  return Object.entries(by).map(([code, versions]) => {
    versions.sort((a, b) => b.data.version - a.data.version);
    return { code, versions, active: versions.find((v) => v.data.status === 'Active'), latest: versions[0] };
  }).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}
export async function activeTemplates(entity = 'barangay') {
  return (await poolGroups()).filter((g) => g.active && (g.active.data.entityTypes || ['barangay']).includes(entity)).map((g) => ({ id: g.active.id, ...g.active.data }));
}

export async function pool(refs, params, q) {
  const canManage = has(refs.me, 'admin') || has(refs.me, 'sa');
  const groups = await poolGroups();
  const selCode = q.get('code') || groups[0]?.code;
  const g = groups.find((x) => x.code === selCode);
  const vid = q.get('v');
  const rec = g ? (g.versions.find((v) => v.id === vid) || g.latest) : null;
  const usage = (await store.list('aoms')).reduce((m, a) => { m[a.data.poolCode] = (m[a.data.poolCode] || 0) + 1; return m; }, {});
  const userName = (email) => nice(refs.users.find((u) => u.data.email === email)?.data.name || email || '');
  const state = rec ? { aom: clone(rec.data) } : null;
  const editable = canManage && rec && ['Draft', 'Proposed', 'Active'].includes(rec.data.status) && rec.id === g.latest.id;
  const go = (code, v) => `#/library?code=${encodeURIComponent(code)}${v ? '&v=' + encodeURIComponent(v) : ''}`;
  const q0 = (q.get('find') || '').toLowerCase();

  const listHTML = groups.filter((x) => !q0 || (x.code + ' ' + x.latest.data.title + ' ' + (x.latest.data.area || '')).toLowerCase().includes(q0)).map((x) => {
    const d = x.latest.data; const st = x.active && x.latest !== x.active ? 'Proposed' : d.status;
    return `<a class="t-row click ${x.code === selCode ? 'sel' : ''}" href="${go(x.code)}" style="grid-template-columns:1fr auto;text-decoration:none;color:inherit">
      <span><span class="mono" style="font-size:12px;color:var(--muted)">${esc(x.code)}</span><br><b>${esc(d.title)}</b>${d.variantOf ? '<br><small class="hint">Variant of ' + esc(d.variantOf) + '</small>' : ''}</span>
      <span>${pill(st, STATUS_KIND[st])}</span></a>`;
  }).join('');

  const detail = rec ? `
    <section class="panel"><div class="panel-head"><div><h2>${esc(rec.data.code)} · Version ${rec.data.version}</h2><span class="hint">${esc(rec.data.title)}</span></div>${pill(rec.data.status, STATUS_KIND[rec.data.status])}</div>
      <div class="panel-body">
        ${rec.data.status === 'Active' && editable ? '<div class="note info">Editing an Active template creates the next version as a Draft. This version stays in use until the new one is approved.</div>' : ''}
        ${!canManage ? '<div class="note info">Only the Supervising Auditor or the Admin can change templates. You can use any Active template on the Findings screen.</div>' : ''}
        <div class="grid-2">
          <div class="field"><label class="label" for="p-title">Finding Title</label><input class="input" id="p-title" value="${esc(rec.data.title)}" ${editable ? '' : 'disabled'}></div>
          <div class="field"><label class="label" for="p-area">Audit Area</label><input class="input" id="p-area" value="${esc(rec.data.area || '')}" ${editable ? '' : 'disabled'}></div>
          <div class="field"><label class="label" for="p-sec">Default Part II Section</label><select class="input" id="p-sec" ${editable ? '' : 'disabled'}>${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}" ${rec.data.section === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label class="label" for="p-wp">Working Paper</label><input class="input" id="p-wp" value="${esc(rec.data.wp || '')}" placeholder="e.g. WP-CA01, or blank if none" ${editable ? '' : 'disabled'}></div>
        </div>
        <div class="field"><label class="label" for="p-saor">SAOR Wording (General, Plural)</label><textarea class="input be-text" id="p-saor" rows="2" ${editable ? '' : 'disabled'} placeholder="Used in the consolidated SAOR (Phase 3)">${esc(rec.data.saor || '')}</textarea></div>
        <div class="field"><span class="label">Placeholders Found</span><div id="p-ph" class="hint"></div></div>
      </div></section>
    <section class="panel"><div class="panel-head"><h2>AOM Wording</h2><span class="hint">Edited the same way as an AOM draft</span></div><div class="panel-body" id="p-blocks">${blocksHTML(state.aom, { editable })}</div></section>
    ${editable ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
      <div class="btn-row" style="margin-left:auto"><button class="btn ghost" id="p-save">Save Draft</button><button class="btn success" id="p-approve">Approve and Make Active</button></div></div>` : ''}
    <section class="panel"><div class="panel-head"><h2>Version History</h2>${canManage && rec.data.status === 'Active' && !editable ? '' : ''}</div>
      ${g.versions.map((v) => `<a class="t-row click ${v.id === rec.id ? 'sel' : ''}" href="${go(g.code, v.id)}" style="grid-template-columns:1fr auto;text-decoration:none;color:inherit">
        <span><b>Version ${v.data.version}</b> · ${esc(v.data.note || '')}<br><small class="hint">${v.data.approvedAt ? 'Approved by ' + esc(userName(v.data.approvedBy)) + ' · ' + esc(longDate(v.data.approvedAt.slice(0, 10))) : 'Saved by ' + esc(userName(v.updatedBy))}</small></span>
        ${pill(v.data.status, STATUS_KIND[v.data.status])}</a>`).join('')}
      <div class="panel-body"><span class="hint">Used in ${usage[g.code] || 0} AOM${usage[g.code] === 1 ? '' : 's'}.</span>
      ${canManage && rec.data.status === 'Active' ? '<div class="btn-row"><button class="btn sm ghost" id="p-variant">+ Make a Variant</button><button class="btn sm ghost" id="p-retire">Retire Template</button></div>' : ''}</div>
    </section>` : '<section class="panel"><div class="empty">No templates yet.</div></section>';

  const body = `<div class="page-head"><div><h1>AOM Library</h1><p>The team's library of AOM templates. Only Active templates appear when selecting findings.</p></div>
      <div class="btn-row"><button class="btn ghost" disabled title="Comes in Phase 5">Import Issued AOMs (Word)</button>${canManage ? '<button class="btn primary" id="p-new">+ New Template</button>' : ''}</div></div>
    ${!groups.length && canManage ? `<div class="note warn" style="align-items:center">The Library is empty. <button class="btn sm primary" id="p-seed" style="margin-left:auto">Load the ${POOL_SEED.length} Templates from Your Workbook</button></div>` : ''}
    <div class="split" style="grid-template-columns:340px minmax(0,1fr)">
      <section class="panel" style="align-self:start"><div class="panel-head"><h2>Templates · ${groups.length}</h2></div>
        <div class="panel-body" style="padding:12px 16px"><input class="input" id="p-find" placeholder="Search templates" value="${esc(q.get('find') || '')}" aria-label="Search templates"></div>
        ${listHTML || '<div class="empty">Nothing found.</div>'}</section>
      <div style="display:flex;flex-direction:column;gap:20px;min-width:0">${detail}</div></div>`;

  return {
    active: '#/library', crumbs: '<b>AOM Library</b>', body,
    mount(root) {
      const f = $('#p-find', root);
      f.onchange = () => { location.hash = '#/library?' + (selCode ? 'code=' + encodeURIComponent(selCode) + '&' : '') + 'find=' + encodeURIComponent(f.value); };
      const seed = $('#p-seed', root);
      if (seed) seed.onclick = async () => {
        for (const t of POOL_SEED) {
          await store.save('aom_library', 'obs-' + t.code + '-v1', { ...clone(t), version: 1, status: 'Active', note: 'From the Barangay Audit System workbook', approvedBy: refs.me.email, approvedAt: new Date().toISOString() }, { silent: true });
        }
        await store.log('loaded the AOM Library templates', POOL_SEED.length + ' templates', '', refs.me.email);
        emitChange('local'); toast('Templates loaded.', 'ok');
      };
      const nw = $('#p-new', root);
      if (nw) nw.onclick = async () => {
        const nums = groups.map((x) => Number((/^(?:OBS|FND|POOL)-(\d+)$/.exec(x.code) || [])[1] || 0));
        const code = 'OBS-' + String(Math.max(0, ...nums) + 1).padStart(3, '0');
        const r = await modal({ title: 'New Template', body: `<div class="field"><label class="label" for="nt">Finding Title</label><input class="input" id="nt"></div><span class="hint">Code: ${code}. It starts as a Draft.</span>`,
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Create', cls: 'primary', value: 'ok', check: (bg) => { pool.nt = $('#nt', bg).value.trim(); return !!pool.nt; } }] });
        if (r !== 'ok') return;
        await store.save('aom_library', `obs-${code}-v1`, { code, version: 1, status: 'Draft', title: pool.nt, area: '', section: 'B', wp: '', entityTypes: ['barangay'], saor: '', note: 'New template',
          blocks: [{ type: 'topic', text: '' }, { type: 'criteria', lead: '', text: '', quoted: true }, { type: 'condition', text: '' }, { type: 'effect', text: '' }, { type: 'recommendation', lead: '', items: [], text: 'We recommend that Management ' }] });
        location.hash = go(code);
      };
      if (!rec) return;
      const ph = () => { const p = placeholders(state.aom); $('#p-ph', root).innerHTML = p.length ? p.map((n) => `<span class="pill ${SETUP_VAR_NAMES.includes(n) ? 'ok' : 'grey'}">${esc(n)} · ${SETUP_VAR_NAMES.includes(n) ? 'from Setup' : 'from WP'}</span>`).join(' ') : 'None'; };
      ph();
      if (!editable) {
        const vbtn = $('#p-variant', root), rbtn = $('#p-retire', root);
        if (vbtn) vbtn.onclick = () => makeVariant(rec, groups, refs);
        if (rbtn) rbtn.onclick = async () => { if (await confirmBox('Retire Template', `${esc(rec.data.code)} will no longer be offered on the Findings screen. AOMs that used it keep their text.`, 'Retire')) { await store.save('aom_library', rec.id, { ...rec.data, status: 'Retired' }); toast('Retired.', 'ok'); } };
        return;
      }
      const dirty = () => setDirty(true, () => save(false));
      ['#p-title', '#p-area', '#p-sec', '#p-wp', '#p-saor'].forEach((s) => { $(s, root).addEventListener('input', dirty); $(s, root).addEventListener('change', dirty); });
      const host = $('#p-blocks', root);
      wireBlocks(host, state, (redraw) => { if (redraw) host.innerHTML = blocksHTML(state.aom, { editable }); ph(); dirty(); });
      const collect = () => ({ ...state.aom, title: $('#p-title', root).value.trim(), area: $('#p-area', root).value.trim(), section: $('#p-sec', root).value, wp: $('#p-wp', root).value.trim(), saor: $('#p-saor', root).value.trim() });
      async function save(approve) {
        const d = collect();
        if (!d.title) { toast('Enter the finding title.', 'bad'); return false; }
        let id = rec.id;
        if (rec.data.status === 'Active') {   // editing an Active version → next version
          d.version = rec.data.version + 1; d.status = approve ? 'Active' : 'Draft'; d.note = approve ? 'Updated and approved' : 'Edited, waiting for approval';
          delete d.approvedAt; delete d.approvedBy;
          id = `obs-${d.code}-v${d.version}`;
        } else d.status = approve ? 'Active' : rec.data.status;
        if (approve) {
          d.approvedBy = refs.me.email; d.approvedAt = new Date().toISOString();
          for (const v of g.versions) if (v.data.status === 'Active' && v.id !== id) await store.save('aom_library', v.id, { ...v.data, status: 'Superseded' }, { silent: true });
        }
        await store.save('aom_library', id, d, { silent: true });
        await store.log(approve ? 'approved an AOM Library template' : 'saved an AOM Library template', `${d.code} · Version ${d.version}`, '', refs.me.email);
        setDirty(false); emitChange('local');
        toast(approve ? `${d.code} Version ${d.version} is now Active.` : 'Draft saved.', 'ok');
        if (id !== rec.id) location.hash = go(d.code, id);
        return true;
      }
      $('#p-save', root).onclick = () => save(false);
      $('#p-approve', root).onclick = async () => { if (await confirmBox('Approve Template', 'Make this version Active? It will be offered on the Findings screen from now on.', 'Approve', 'success')) save(true); };
      setDirty(false, () => save(false));
    }
  };
}

async function makeVariant(rec, groups, refs) {
  const base = rec.data.code;
  const n = groups.filter((x) => x.code.startsWith(base + '-M')).length + 1;
  const code = `${base}-M${n}`;
  const d = { ...clone(rec.data), code, version: 1, status: 'Draft', variantOf: base, title: rec.data.title + ' (Variant)', note: 'Variant of ' + base };
  delete d.approvedAt; delete d.approvedBy;
  await store.save('aom_library', `obs-${code}-v1`, d);
  location.hash = `#/library?code=${encodeURIComponent(code)}`;
  toast(`${code} created as a Draft.`, 'ok');
  void refs;
}
