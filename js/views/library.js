// AOM Library: the team's library of AOM templates.
import { store, newId, emitChange } from '../store.js';
import { esc, toast, setDirty, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { has } from '../refs.js';
import { blocksHTML, wireBlocks, diffHTML } from '../blockeditor.js';
import { clone, placeholders, moneyPlaceholders, autoAmountVar, SECTIONS, SETUP_VAR_NAMES, blockPlain, diffWords } from '../aom.js';
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
// Choices for "Amount in the Title": automatic, each amount placeholder in the wording, or none.
// Automatic shows the amount it picks; the list then offers only the other amounts. A template pinned to the same
// amount Automatic picks shows as Automatic (it prints the same).
function tvarOptions(d) {
  const auto = autoAmountVar(d);
  const sel = d.titleVar && d.titleVar !== auto ? d.titleVar : '';
  const names = moneyPlaceholders(d).filter((n) => n !== auto);
  if (sel && sel !== 'NONE' && !names.includes(sel)) names.push(sel);
  d = { ...d, titleVar: sel };
  return `<option value="" ${sel ? '' : 'selected'}>Automatic: ${auto ? '[' + esc(auto) + ']' : 'none'}</option>`
    + names.map((n) => `<option value="${esc(n)}" ${d.titleVar === n ? 'selected' : ''}>[${esc(n)}]</option>`).join('')
    + `<option value="NONE" ${d.titleVar === 'NONE' ? 'selected' : ''}>No Amount</option>`;
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
        ${rec.data.status === 'Superseded' ? `<div class="note info" style="align-items:center"><span>This is an older version. Only the Active version is offered on the Findings screen.</span>
          ${canManage ? '<span style="margin-left:auto;display:flex;align-items:center;gap:10px"><span class="hint">Use this version again</span><button class="btn sm primary" id="p-again">Use Again</button></span>' : ''}</div>` : ''}
        ${rec.data.status === 'Retired' ? '<div class="note warn">Retired. It is no longer offered on the Findings screen. AOMs that used it keep their text. Its code is never given to a new template.</div>' : ''}
        <div class="grid-2">
          <div class="field"><label class="label" for="p-title">Finding Title</label><input class="input" id="p-title" value="${esc(rec.data.title)}" ${editable ? '' : 'disabled'}></div>
          <div class="field"><label class="label" for="p-area">Audit Area</label><input class="input" id="p-area" value="${esc(rec.data.area || '')}" ${editable ? '' : 'disabled'}></div>
          <div class="field"><label class="label" for="p-sec">Default Part II Section</label><select class="input" id="p-sec" ${editable ? '' : 'disabled'}>${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}" ${rec.data.section === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label class="label" for="p-wp">Working Paper</label><input class="input" id="p-wp" value="${esc(rec.data.wp || '')}" placeholder="e.g. WP-CA01, or blank if none" ${editable ? '' : 'disabled'}></div>
          <div class="field"><label class="label" for="p-tvar">AOM Amount</label><select class="input" id="p-tvar" ${editable ? '' : 'disabled'}>${tvarOptions(state.aom)}</select><span class="hint">Used in the SAOR and BAAR.</span></div>
          <div class="field" id="p-tshow-f"><div class="lr-row"><span class="label">Show in the Title</span><div class="seg" role="group" aria-label="Show the AOM Amount after the Finding Title" id="p-tshow">${['Yes', 'No'].map((x) => `<button type="button" data-tshow="${x}" class="${(rec.data.titleShow !== false) === (x === 'Yes') ? 'on' : ''}" ${editable ? '' : 'disabled'}>${x}</button>`).join('')}</div></div></div>
        </div>
        <div class="field"><label class="label" for="p-saor">SAOR Wording (General)</label><textarea class="input be-text" id="p-saor" rows="3" ${editable ? '' : 'disabled'} placeholder="The observation as written in the consolidated SAOR, for any number of barangays">${esc(rec.data.saor || '')}</textarea></div>
        <div class="field"><label class="label" for="p-saorrec">SAOR Recommendation</label><textarea class="input be-text" id="p-saorrec" rows="3" ${editable ? '' : 'disabled'} placeholder="Leave blank to use the AOM recommendation">${esc(rec.data.saorRec || '')}</textarea><span class="hint">Leave blank to use the AOM recommendation in the SAOR.</span></div>
        <div class="field"><span class="label">Placeholders Found</span><div id="p-ph" class="hint"></div></div>
      </div></section>
    <section class="panel"><div class="panel-head"><h2>AOM Wording</h2><span class="hint">Edited the same way as an AOM draft. Put ** before and after words to print them in bold, e.g. **draw journal vouchers**.</span></div><div class="panel-body" id="p-blocks">${blocksHTML(state.aom, { editable })}</div></section>
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
      let tshow = rec.data.titleShow !== false;
      // Show in the Title applies only when the AOM has an amount.
      const tshowVis = () => { const tv = $('#p-tvar', root), f = $('#p-tshow-f', root); if (!tv || !f) return; const none = tv.value === 'NONE' || (tv.value === '' && /none$/.test(tv.options[tv.selectedIndex]?.text || '')); f.style.display = none ? 'none' : ''; };
      const ph = () => { const tv = $('#p-tvar', root); if (tv && editable) { const cur = tv.value; tv.innerHTML = tvarOptions({ ...state.aom, titleVar: cur }); } tshowVis(); const p = placeholders(state.aom); $('#p-ph', root).innerHTML = p.length ? p.map((n) => `<span class="pill ${SETUP_VAR_NAMES.includes(n) ? 'ok' : 'grey'}">${esc(n)} · ${/^TABLE\d+_(ITEMS|COUNT)$/.test(n) ? 'from the table' : SETUP_VAR_NAMES.includes(n) ? 'from Setup' : 'from WP'}</span>`).join(' ') : 'None'; };
      ph();
      const vbtn = $('#p-variant', root), rbtn = $('#p-retire', root), again = $('#p-again', root);
      if (vbtn) vbtn.onclick = () => makeVariant(rec, groups, refs);
      if (rbtn) rbtn.onclick = async () => {
        if (!(await confirmBox('Retire Template', `${esc(rec.data.code)} will no longer be offered on the Findings screen. AOMs that used it keep their text.`, 'Retire'))) return;
        setDirty(false);
        await store.save('aom_library', rec.id, { ...rec.data, status: 'Retired', retiredBy: refs.me.email, retiredAt: new Date().toISOString() });
        await store.log('retired an AOM Library template', `${rec.data.code} · Version ${rec.data.version}`, '', refs.me.email);
        toast('Retired.', 'ok');
      };
      if (again) again.onclick = async () => {
        const top = Math.max(...g.versions.map((v) => v.data.version));
        if (!(await confirmBox('Use Again', `Make the wording of Version ${rec.data.version} the Active one again? It is saved as Version ${top + 1}, and the current Active version becomes an older version. AOMs already written are not changed.`, 'Use Again', 'success'))) return;
        await saveActiveVersion(g, { ...clone(rec.data), note: `Version ${rec.data.version} wording used again` }, refs);
        toast(`${rec.data.code} Version ${top + 1} is now Active.`, 'ok');
        location.hash = go(g.code, `obs-${g.code}-v${top + 1}`);
      };
      if (!editable) return;
      const dirty = () => setDirty(true, () => save(false));
      ['#p-title', '#p-area', '#p-sec', '#p-wp', '#p-tvar', '#p-saor', '#p-saorrec'].forEach((s) => { $(s, root).addEventListener('input', dirty); $(s, root).addEventListener('change', dirty); });
      $('#p-tvar', root).addEventListener('change', tshowVis);
      $$('[data-tshow]', root).forEach((b) => { b.onclick = () => { tshow = b.dataset.tshow === 'Yes'; $$('[data-tshow]', root).forEach((x) => x.classList.toggle('on', x === b)); dirty(); }; });
      const host = $('#p-blocks', root);
      wireBlocks(host, state, (redraw) => { if (redraw) host.innerHTML = blocksHTML(state.aom, { editable }); ph(); dirty(); });
      const collect = () => ({ ...state.aom, title: $('#p-title', root).value.trim(), area: $('#p-area', root).value.trim(), section: $('#p-sec', root).value, wp: $('#p-wp', root).value.trim(), saor: $('#p-saor', root).value.trim(), saorRec: $('#p-saorrec', root).value.trim(), titleVar: $('#p-tvar', root).value, titleShow: tshow });
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

// Save d as the next version of group g and make it the only Active one.
export async function saveActiveVersion(g, d, refs) {
  const top = Math.max(...g.versions.map((v) => v.data.version));
  const now = new Date().toISOString();
  const rec = { ...d, code: g.code, version: top + 1, status: 'Active', approvedBy: refs.me.email, approvedAt: now };
  delete rec.retiredBy; delete rec.retiredAt;
  for (const v of g.versions) if (v.data.status === 'Active') await store.save('aom_library', v.id, { ...v.data, status: 'Superseded' }, { silent: true });
  await store.save('aom_library', `obs-${g.code}-v${top + 1}`, rec, { silent: true });
  await store.log('updated an AOM Library template', `${g.code} · Version ${top + 1} · ${rec.note || ''}`, '', refs.me.email);
  emitChange('local');
  return rec;
}

// Turn a Final AOM back into template wording: values typed from the working paper or Setup become [PLACEHOLDERS] again.
export function toTemplate(aom, vars) {
  const pairs = Object.entries(vars || {}).filter(([, v]) => v && String(v).length >= 4)
    .sort((a, b) => String(b[1]).length - String(a[1]).length || (SETUP_VAR_NAMES.includes(a[0]) ? 1 : 0) - (SETUP_VAR_NAMES.includes(b[0]) ? 1 : 0));
  const swaps = new Map();
  const conv = (t) => {
    let out = String(t || '');
    const seen = new Set();
    for (const [name, val] of pairs) {
      if (seen.has(val)) continue;
      for (const v of String(val).startsWith('₱') ? [val, val.slice(1)] : [val]) {
        const ph = v.startsWith('₱') ? `₱[${name}]` : `[${name}]`;   // the Library writes amounts as ₱[NAME]
        if (v.length >= 4 && out.includes(v)) { out = out.split(v).join(ph); swaps.set(`${v} → ${ph}`, 1); seen.add(val); }
      }
    }
    return out;
  };
  const blocks = (aom.blocks || []).map((b) => {
    const x = clone(b); delete x.id;
    if (x.text !== undefined) x.text = conv(x.text);
    if (x.lead !== undefined) x.lead = conv(x.lead);
    if (x.items) x.items = x.items.map(conv);
    if (x.caption !== undefined) x.caption = conv(x.caption);
    return x;
  });
  const title = conv(aom.title);
  const all = [title, ...blocks.map(blockPlain)].join('\n');
  const leftover = [...new Set(all.match(/₱\s?\d[\d,]*(\.\d+)?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g) || [])];
  return { title, blocks, swaps: [...swaps.keys()], leftover };
}

// Carry a wording change from the AOM template into the SAOR wording: the same words removed or added, found by the
// words just before the change. Changes that have no match in the SAOR wording are simply skipped.
export function carryOver(target, oldText, newText) {
  let out = String(target || '');
  if (!out || oldText === newText) return out;
  // Join changes split only by spaces into one change, so "and COA Circular No. 97-002" is one insertion.
  const raw = diffWords(oldText, newText), segs = [];
  raw.forEach((sg, i) => {
    const prev = segs[segs.length - 1], next = raw[i + 1];
    if (sg.op === '=' && /^\s+$/.test(sg.t) && prev && prev.op !== '=' && next && next.op !== '=') { segs.push({ op: '-', t: sg.t }, { op: '+', t: sg.t }); return; }
    segs.push({ ...sg });
  });
  for (let i = segs.length - 1; i > 0; i--) if (segs[i].op === segs[i - 1].op && segs[i].op !== '=') { segs[i - 1].t += segs[i].t; segs.splice(i, 1); }
  let ctx = '';
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.op === '=') { ctx += s.t; continue; }
    let del = '', ins = '';
    while (i < segs.length && segs[i].op !== '=') { if (segs[i].op === '-') del += segs[i].t; else ins += segs[i].t; i++; }
    i--;
    const tail = (ctx.match(/(\S+\s+){0,3}\S+\s*$/) || [''])[0];
    if (del.trim()) {
      const find = tail + del;
      if (tail.trim() && out.includes(find)) out = out.replace(find, tail + ins);
      else if (del.trim().length >= 12 && out.split(del).length === 2) out = out.replace(del, ins);
    } else if (ins.trim() && tail.trim().length >= 8 && out.split(tail).length === 2) {
      out = out.replace(tail, tail + ins);
    }
    ctx += ins;
  }
  return out;
}

// SA or Admin, from a Final AOM: apply its corrections to the Library template as the next version.
export async function updateFromAom(refs, aomRec, vars, label) {
  const code = aomRec.data.poolCode;
  const g = (await poolGroups()).find((x) => x.code === code);
  if (!g || !g.active) { toast(`${code} has no Active version in the Library (it may be retired).`, 'bad'); return; }
  const act = g.active.data;
  const t = toTemplate(aomRec.data, vars);
  const same = t.title === act.title && t.blocks.length === (act.blocks || []).length && t.blocks.every((b, i) => blockPlain(b) === blockPlain(act.blocks[i]) && b.type === act.blocks[i].type);
  const top = Math.max(...g.versions.map((v) => v.data.version));
  const fromOld = aomRec.data.poolVersion && aomRec.data.poolVersion !== act.version;
  const body = `${same ? '<div class="note ok">This AOM has the same wording as the Library template. Nothing to update.</div>'
    : `<div class="note info"><span>${esc(code)} Version ${act.version} → <b>Version ${top + 1}</b>. Red = removed from the template, green = added. AOMs already written are not changed. Only new AOMs use the new wording.</span></div>`}
    ${fromOld ? `<div class="note warn">This AOM was written from Version ${esc(aomRec.data.poolVersion)}. The Library is now at Version ${act.version}, so this compares with Version ${act.version}.</div>` : ''}
    ${t.swaps.length ? `<div class="field"><span class="label">Values changed back to placeholders</span><div class="hint">${t.swaps.map(esc).join('<br>')}</div></div>` : ''}
    ${t.leftover.length ? `<div class="note warn"><span>Still typed as numbers: <b>${t.leftover.map(esc).join(', ')}</b>. If these should come from the working paper, edit the template after updating and change them to placeholders.</span></div>` : ''}
    ${same ? '' : `<div style="max-height:52vh;overflow:auto;display:flex;flex-direction:column;gap:10px">${diffHTML({ title: act.title, blocks: act.blocks }, { title: t.title, blocks: t.blocks })}</div>`}`;
  // The SAOR wording gets the same correction automatically; it can still be edited here.
  // Compare block by block (and the title), so long templates are compared word by word.
  const pairs = [[act.title, t.title], ...(t.blocks || []).map((b, i) => [blockPlain((act.blocks || [])[i] || {}), blockPlain(b)])];
  let saorNew = act.saor || '', recNew = act.saorRec || '';
  pairs.forEach(([o, n]) => { if (o !== n) { saorNew = carryOver(saorNew, o, n); recNew = carryOver(recNew, o, n); } });
  const saorBox = same ? '' : `<div class="grid-2" style="align-items:start">
      <div class="field"><label class="label" for="u-saor">SAOR Wording · updated automatically, you can still edit</label><textarea class="input be-text" id="u-saor" rows="5">${esc(saorNew)}</textarea></div>
      <div class="field"><label class="label" for="u-saorrec">SAOR Recommendation</label><textarea class="input be-text" id="u-saorrec" rows="5" placeholder="Blank: the SAOR uses the AOM recommendation">${esc(recNew)}</textarea></div></div>`;
  let saorVals = null;
  const r = await modal({ title: `Update ${code}`, wide: true, body: body + saorBox,
    buttons: same ? [{ label: 'Close', cls: 'ghost', value: null }] : [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Update', cls: 'primary', value: 'ok', check: (bg) => { saorVals = { saor: $('#u-saor', bg).value.trim(), saorRec: $('#u-saorrec', bg).value.trim() }; return true; } }] });
  if (r !== 'ok') return;
  const saved = await saveActiveVersion(g, { ...clone(act), title: t.title, blocks: t.blocks, ...(saorVals || {}), note: `Corrections from ${label}`, fromAom: aomRec.id }, refs);
  const fresh = await store.get('aoms', aomRec.id);
  if (fresh) await store.save('aoms', aomRec.id, { ...fresh.data, libraryUpdate: { code, version: saved.version, at: saved.approvedAt, by: refs.me.email } });
  toast(`${code} Version ${saved.version} is now Active.`, 'ok');
}

// SA or Admin, from a Final AOM: save its wording as a new Variant beside the template (the template itself is not changed).
// For wordings that are both right but fit different cases — e.g. one account in the paragraph vs. several accounts in a table.
export async function variantFromAom(refs, aomRec, vars, label) {
  const code0 = aomRec.data.poolCode;
  const groups = await poolGroups();
  const g = groups.find((x) => x.code === code0);
  const act = g && (g.active || g.latest);
  if (!act) { toast(`${code0} is not in the Library.`, 'bad'); return; }
  const a = act.data;
  const base = a.variantOf || code0;
  const n = groups.filter((x) => x.code.startsWith(base + '-M')).length + 1;
  const code = `${base}-M${n}`;
  const t = toTemplate(aomRec.data, vars);
  const same = t.title === a.title && t.blocks.length === (a.blocks || []).length && t.blocks.every((b, i) => blockPlain(b) === blockPlain(a.blocks[i]) && b.type === a.blocks[i].type);
  const pairs = [[a.title, t.title], ...(t.blocks || []).map((b, i) => [blockPlain((a.blocks || [])[i] || {}), blockPlain(b)])];
  let saorNew = a.saor || '', recNew = a.saorRec || '';
  pairs.forEach(([o, nw]) => { if (o !== nw) { saorNew = carryOver(saorNew, o, nw); recNew = carryOver(recNew, o, nw); } });
  const body = `${same ? `<div class="note warn"><span>This AOM has the same wording as ${esc(code0)}. A variant is only needed when the wording is different.</span></div>` : ''}
    <div class="note info"><span>New template <b>${esc(code)}</b>, a Variant of ${esc(base)}, from ${esc(label)}. ${esc(code0)} stays as it is. Red = not in ${esc(code0)}'s wording, green = new in the variant.</span></div>
    <div class="field"><label class="label" for="v-title">Title of the variant · say when to use it</label><input class="input" id="v-title" value="${esc(t.title === a.title ? t.title + ' (Variant)' : t.title)}"></div>
    ${t.swaps.length ? `<div class="field"><span class="label">Values changed back to placeholders</span><div class="hint">${t.swaps.map(esc).join('<br>')}</div></div>` : ''}
    ${t.leftover.length ? `<div class="note warn"><span>Still typed as numbers: <b>${t.leftover.map(esc).join(', ')}</b>. Change them to placeholders in the Library before you approve the variant.</span></div>` : ''}
    ${same ? '' : `<div style="max-height:44vh;overflow:auto;display:flex;flex-direction:column;gap:10px">${diffHTML({ title: a.title, blocks: a.blocks }, { title: t.title, blocks: t.blocks })}</div>`}
    <div class="grid-2" style="align-items:start;margin-top:10px">
      <div class="field"><label class="label" for="v-saor">SAOR Wording · carried over, you can edit</label><textarea class="input be-text" id="v-saor" rows="4">${esc(saorNew)}</textarea></div>
      <div class="field"><label class="label" for="v-saorrec">SAOR Recommendation</label><textarea class="input be-text" id="v-saorrec" rows="4" placeholder="Blank: the SAOR uses the AOM recommendation">${esc(recNew)}</textarea></div></div>
    <p class="hint" style="margin:8px 0 0">It is saved as a Draft and opens in the AOM Library: check the title and the placeholders (and the table columns), then Approve it. Once Active, it is offered on the Findings screen beside ${esc(base)}.</p>`;
  let vals = null;
  const r = await modal({ title: `Save as Variant · ${code}`, wide: true, body,
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Save as Variant', cls: 'primary', value: 'ok', check: (bg) => {
      vals = { title: $('#v-title', bg).value.trim(), saor: $('#v-saor', bg).value.trim(), saorRec: $('#v-saorrec', bg).value.trim() };
      if (!vals.title) { toast('Type the title of the variant.', 'bad'); return false; } return true; } }] });
  if (r !== 'ok') return;
  const d = { ...clone(a), code, version: 1, status: 'Draft', variantOf: base, title: vals.title, blocks: t.blocks, saor: vals.saor, saorRec: vals.saorRec,
    note: `Variant of ${base}, from ${label}`, fromAom: aomRec.id };
  delete d.approvedAt; delete d.approvedBy; delete d.retiredAt; delete d.retiredBy;
  await store.save('aom_library', `obs-${code}-v1`, d, { silent: true });
  await store.log('saved an AOM as a Library variant', `${code} · Variant of ${base} · ${label}`, '', refs.me.email);
  const fresh = await store.get('aoms', aomRec.id);
  if (fresh) await store.save('aoms', aomRec.id, { ...fresh.data, libraryVariant: { code, at: new Date().toISOString(), by: refs.me.email } });
  emitChange('local');
  toast(`${code} saved as a Draft variant. Check it, then Approve.`, 'ok');
  location.hash = `#/library?code=${encodeURIComponent(code)}`;
}
