// Screen 3 · Findings and Working Papers
import { store, newId, emitChange } from '../store.js';
import { esc, toast, setDirty, modal, confirmBox, pill, $, $$ } from '../ui.js';
import { loadAudit, stepsBar, advanceStage } from '../auditctx.js';
import { activeTemplates } from './library.js';
import { fromTemplate, blankAom, clone, numberAoms, numberingCheck, placeholders, SECTIONS, SETUP_VAR_NAMES, ST, formatVar, statusPill } from '../aom.js';
import { aomNo, aomRange, nice, timeAgo } from '../format.js';
import { readWorkingPaper } from '../wp.js';

export async function findings(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/audits', crumbs: '<a href="#/audits">My Audit</a> / <b>Not Found</b>', body: '<div class="note bad">This audit was not found on this device.</div>' };
  const { audit } = ctx;
  const templates = await activeTemplates('barangay');
  const allAoms = await store.list('aoms');

  // Working list (saved on Save only)
  const items = ctx.aoms.map((a) => ({ id: a.id, data: clone(a.data), orig: JSON.stringify(a.data) }));
  const removed = [];
  let sel = q.get('sel') || items[0]?.id || null;
  const lockedOrSent = (it) => !!it.data.number || ![ST.DRAFT, ST.RETURNED].includes(it.data.status || ST.DRAFT);
  const canEdit = ctx.isMember || ctx.atl?.id === refs.me.id || ctx.sa?.id === refs.me.id;

  const nums = () => numberAoms(items.map((it, i) => ({ id: it.id, data: { ...it.data, seq: i + 1 } })));
  const wpState = (it) => {
    const d = it.data;
    const need = (d.blocks || []).some((b) => b.type === 'table') || placeholders(d).some((n) => !SETUP_VAR_NAMES.includes(n));
    if (!need && !d.wp) return { k: 'none', t: 'No WP Needed' };
    if (!d.wpData) return { k: 'missing', t: d.wp ? `Import ${d.wp}` : 'Import WP' };
    const v = ctx.varsFor({ data: d });
    const miss = placeholders(d).filter((n) => v[n] === undefined);
    const missT = (d.blocks || []).filter((b) => b.type === 'table' && !d.wpData.tables[b.n]);
    if (miss.length || missT.length) return { k: 'warn', t: `${miss.length + missT.length} Missing Value${miss.length + missT.length > 1 ? 's' : ''}` };
    return { k: 'ok', t: `${d.wp || 'WP'} Imported` };
  };

  function selectedHTML() {
    const N = nums();
    const chk = numberingCheck(N);
    const first = items.length ? N[items[0].id].n : 0, last = items.length ? Math.max(...Object.values(N).map((x) => x.n)) : 0;
    const cols = 'grid-template-columns: 58px 92px minmax(150px,1fr) 150px 150px 30px';
    return `<div class="panel-head"><div><h2>Selected Findings · ${items.length}</h2><span class="hint">The order here is the AOM numbering. Use the arrows to reorder; numbers adjust automatically.</span></div>
        ${items.length ? `<span class="mono" style="font-weight:600">${esc(first === last ? aomNo(audit.auditYear, first, audit.periodFrom, audit.periodTo) : aomRange(audit.auditYear, first, last, audit.periodFrom, audit.periodTo))}</span>${chk.ok ? pill('No Gaps', 'ok') : pill('Check Numbering', 'bad')}` : ''}</div>
      ${items.length ? `<div class="t-head" style="${cols}"><span>Order</span><span>AOM No.</span><span>Finding</span><span>Part II Section</span><span>Working Paper</span><span></span></div>` : ''}
      ${items.map((it, i) => {
        const d = it.data; const w = wpState(it); const n = N[it.id];
        const lock = lockedOrSent(it);
        return `<div class="t-row click ${it.id === sel ? 'sel' : ''}" style="${cols}" data-sel="${it.id}">
          <span style="display:flex;gap:2px">${canEdit && !lock ? `<button class="x sm" data-mv="-1" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button><button class="x sm" data-mv="1" data-i="${i}" aria-label="Move down" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>` : '<span class="hint">🔒</span>'}</span>
          <span class="mono" style="font-size:13px">${esc(audit.auditYear)}-${String(n.n).padStart(3, '0')}${n.locked ? ' 🔒' : '<br><small class="hint">provisional</small>'}</span>
          <span><b>${esc(d.title)}</b><br><small class="hint">${esc(d.poolCode || 'Not in Library')}${d.poolVersion ? ' · version ' + d.poolVersion : ''} · ${esc(d.mode || 'Standard')}</small> ${d.status && d.status !== ST.DRAFT ? pill(d.status, statusPill(d.status)) : ''}</span>
          <span><select class="input" style="height:36px" data-sec="${i}" aria-label="Part II Section" ${canEdit && !lock ? '' : 'disabled'}>${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}" ${d.section === k ? 'selected' : ''}>${v}</option>`).join('')}</select></span>
          <span>${w.k === 'ok' ? pill('✓ ' + w.t, 'ok') : w.k === 'none' ? pill(w.t, 'grey') : w.k === 'warn' ? pill(w.t, 'warn') : `<button class="btn sm ghost" data-imp="${it.id}">${esc(w.t)}</button>`}</span>
          <span>${canEdit && !lock ? `<button class="x sm" data-rm="${i}" aria-label="Remove ${esc(d.title)}" title="Remove">✕</button>` : ''}</span></div>`;
      }).join('') || '<div class="empty">No findings yet. Click <b>+ Add</b> on a template from the AOM Library.</div>'}`;
  }

  function wpPanelHTML() {
    const it = items.find((x) => x.id === sel);
    if (!it) return '';
    const d = it.data, wp = d.wpData;
    const v = ctx.varsFor({ data: d });
    const ph = placeholders(d);
    const missing = ph.filter((n) => v[n] === undefined);
    const tablesNeeded = (d.blocks || []).filter((b) => b.type === 'table').map((b) => b.n);
    return `<div class="panel-head"><div><h2>Working Paper · ${esc(d.title)}</h2><span class="hint">${esc(d.wp || 'No working paper ID in the template')}</span></div>
        ${canEdit && !lockedOrSent(it) ? `<label class="btn ${wp ? 'ghost' : 'primary'}" for="wp-file">${wp ? 'Re-import Revised WP' : 'Import Working Paper'}</label><input type="file" id="wp-file" accept=".xlsx,.xlsm,.xls" class="sr-only">` : ''}</div>
      <div class="panel-body">
        ${wp ? `<div class="note info">Imported: <b>${esc(wp.file)}</b> · By ${esc(nice(refs.users.find((u) => u.data.email === wp.by)?.data.name || wp.by))} · ${esc(timeAgo(wp.at))}. The file stays on your computer; only the values below are saved.</div>`
          : '<div class="note info">Choose the Excel working paper. The app reads the VARIABLE / VALUE list and the sheets named "AOM Table 1", "AOM Table 2", and so on. The file itself is not uploaded.</div>'}
        <div class="grid-2">
          <div><span class="label">Placeholders · ${ph.length - missing.length} of ${ph.length} Filled</span>
            <div class="kv">${ph.map((n) => `<div><span class="mono">${esc(n)}</span><span>${v[n] !== undefined ? esc(v[n]) + (SETUP_VAR_NAMES.includes(n) ? ' <small class="hint">(from Setup)</small>' : '') : '<b style="color:var(--bad-ink)">No value</b>'}</span></div>`).join('') || '<span class="hint">None</span>'}</div></div>
          <div><span class="label">Tables · ${tablesNeeded.length} Needed</span>
            <div class="kv">${tablesNeeded.map((n) => { const t = wp && wp.tables[n]; return `<div><span>AOM Table ${n}</span><span>${t ? `✓ ${t.rows[0].length} columns · ${t.rows.length - 1} rows` : '<b style="color:var(--bad-ink)">Not found</b>'}</span></div>`; }).join('') || '<span class="hint">None</span>'}</div>
            ${wp && Object.keys(wp.vars || {}).length ? `<details style="margin-top:8px"><summary class="hint">All ${Object.keys(wp.vars).length} variables in the file</summary><div class="kv">${Object.entries(wp.vars).map(([k, x]) => `<div><span class="mono">${esc(k)}</span><span>${esc(formatVar(k, x.raw))}</span></div>`).join('')}</div></details>` : ''}</div>
        </div>
        ${missing.length ? `<div class="note warn">${missing.length} placeholder${missing.length > 1 ? 's have' : ' has'} no value: ${missing.map((m) => '[' + esc(m) + ']').join(', ')}. Add ${missing.length > 1 ? 'them' : 'it'} to the working paper and re-import, or remove the sentence in the AOM draft (for example Year 3 sentences when the audit covers only 2 years).</div>` : ph.length ? '<div class="note ok">All placeholders in the AOM template are filled</div>' : ''}
      </div>`;
  }

  const groups = {};
  templates.forEach((t) => { (groups[t.area || 'Other'] = groups[t.area || 'Other'] || []).push(t); });
  const usedCodes = () => new Set(items.map((it) => it.data.poolCode));
  const poolHTML = (find = '') => {
    const used = usedCodes();
    const f = find.toLowerCase();
    return Object.entries(groups).map(([areaName, list]) => {
      const L = list.filter((t) => !f || (t.code + ' ' + t.title + ' ' + areaName).toLowerCase().includes(f));
      return L.length ? `<div class="pool-g"><div class="label" style="padding:10px 16px 4px">${esc(areaName)}</div>${L.map((t) => `<div class="t-row" style="grid-template-columns:1fr auto;padding:10px 16px">
        <span><b>${esc(t.title)}</b><br><small class="hint">${esc(t.code)}${t.wp ? ' · ' + esc(t.wp) : ''}</small></span>
        ${used.has(t.code) ? pill('✓ Added', 'ok') : canEdit ? `<button class="btn sm ghost" data-add="${esc(t.code)}">+ Add</button>` : ''}</div>`).join('')}</div>` : '';
    }).join('') || '<div class="empty">No Active templates. Ask the Supervising Auditor or Admin to load them in AOM Library.</div>';
  };

  const body = `${stepsBar(ctx, 'Findings and AOMs')}
    <div class="page-head"><div><h1>Barangay ${esc(ctx.lgu.name)} · Findings</h1><p>${esc(ctx.mun.name)}, Quirino · Audit Year ${esc(audit.auditYear)} · Period ${esc(ctx.title.split(' · ')[1])}</p></div></div>
    <div class="split" style="grid-template-columns:360px minmax(0,1fr)">
      <section class="panel" style="align-self:start"><div class="panel-head"><div><h2>AOM Library</h2><span class="hint">Only templates for Barangays are listed.</span></div></div>
        <div class="panel-body" style="padding:12px 16px"><input class="input" id="f-find" placeholder="Search the AOM Library" aria-label="Search the AOM Library"></div>
        <div id="f-pool">${poolHTML()}</div>
        ${canEdit ? `<div class="panel-body" style="border-top:1px solid var(--line-2)"><span class="label">Finding not in the Library?</span>
          <button class="btn dashed" id="f-new">+ New Finding (Not in Library)</button><button class="btn ghost" id="f-existing">Start from an Existing AOM</button></div>` : ''}
      </section>
      <div style="display:flex;flex-direction:column;gap:20px;min-width:0">
        <section class="panel" id="f-sel">${selectedHTML()}</section>
        <section class="panel" id="f-wp">${wpPanelHTML()}</section>
        ${canEdit ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
          <div class="btn-row" style="margin-left:auto"><button class="btn primary" id="f-save">Save</button><button class="btn ghost" id="f-open">Save and Open AOM Drafts →</button></div></div>` : ''}
      </div></div>`;

  return {
    active: '#/audits', crumbs: `<a href="#/audits">My Audit</a> / <a href="#/audits/${ctx.rec.id}/setup">${esc(ctx.title)}</a> / <b>Findings</b>`, body,
    mount(root) {
      const redraw = () => { $('#f-sel', root).innerHTML = selectedHTML(); $('#f-wp', root).innerHTML = wpPanelHTML(); $('#f-pool', root).innerHTML = poolHTML($('#f-find', root).value); wireWp(); };
      const dirty = () => { setDirty(true, save); redraw(); };
      $('#f-find', root).oninput = (e) => { $('#f-pool', root).innerHTML = poolHTML(e.target.value); };
      const addItem = (data) => {
        const id = newId('aom');
        items.push({ id, data: { ...data, auditId: ctx.rec.id, teamId: audit.teamId, lguId: audit.lguId, status: ST.DRAFT, wpData: null, comments: [], history: [{ at: new Date().toISOString(), by: refs.me.email, action: 'Added to findings' }] }, orig: '' });
        sel = id; dirty();
      };
      root.addEventListener('click', async (e) => {
        const add = e.target.closest('[data-add]');
        if (add) { const t = templates.find((x) => x.code === add.dataset.add); addItem(fromTemplate(t)); return; }
        const mv = e.target.closest('[data-mv]');
        if (mv) {
          e.stopPropagation();
          const i = +mv.dataset.i, j = i + Number(mv.dataset.mv);
          if (j < 0 || j >= items.length || lockedOrSent(items[j])) return;
          [items[i], items[j]] = [items[j], items[i]]; dirty(); return;
        }
        const rm = e.target.closest('[data-rm]');
        if (rm) {
          e.stopPropagation();
          const it = items[+rm.dataset.rm];
          if (!(await confirmBox('Remove Finding', `Remove "${esc(it.data.title)}" from this audit? Its draft text and imported values are removed too.`, 'Remove'))) return;
          items.splice(+rm.dataset.rm, 1); if (it.orig) removed.push(it);
          if (sel === it.id) sel = items[0]?.id || null; dirty(); return;
        }
        const imp = e.target.closest('[data-imp]');
        if (imp) { e.stopPropagation(); sel = imp.dataset.imp; redraw(); const f = $('#wp-file', root); if (f) f.click(); return; }
        const row = e.target.closest('[data-sel]');
        if (row && !e.target.closest('select,button')) { sel = row.dataset.sel; $('#f-sel', root).innerHTML = selectedHTML(); $('#f-wp', root).innerHTML = wpPanelHTML(); wireWp(); }
      });
      root.addEventListener('change', (e) => {
        const s = e.target.closest('[data-sec]');
        if (s) { items[+s.dataset.sec].data.section = s.value; dirty(); }
      });
      const nb = $('#f-new', root); if (nb) nb.onclick = () => addItem(blankAom());
      const ex = $('#f-existing', root);
      if (ex) ex.onclick = async () => {
        const others = allAoms.filter((a) => a.data.auditId !== ctx.rec.id).map((a) => ({ a, lgu: refs.lgu[a.data.lguId]?.data.name || '', yr: a.data.auditId }))
          .sort((x, y) => x.lgu.localeCompare(y.lgu));
        if (!others.length) { toast('No AOMs from other Barangays yet.', 'warn'); return; }
        const r = await modal({
          title: 'Start from an Existing AOM', wide: true,
          body: `<p style="margin:0">Copies the wording of another Barangay's AOM. It is tagged <b>Modified</b>. Amounts and tables are not copied.</p>
            <input class="input" id="ex-find" placeholder="Search by title or Barangay">
            <div id="ex-list" style="max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:8px">${others.map((o) => `<label class="t-row click" style="grid-template-columns:24px 1fr;padding:10px 14px" data-txt="${esc((o.a.data.title + ' ' + o.lgu).toLowerCase())}"><input type="radio" name="ex" value="${o.a.id}"><span><b>${esc(o.a.data.title)}</b><br><small class="hint">${esc(o.lgu)} · ${esc(o.a.data.status || 'Draft')} · ${esc(o.a.data.poolCode || 'Not in Library')}</small></span></label>`).join('')}</div>`,
          onOpen: (bg) => { $('#ex-find', bg).oninput = (ev) => $$('#ex-list [data-txt]', bg).forEach((l) => { l.style.display = l.dataset.txt.includes(ev.target.value.toLowerCase()) ? '' : 'none'; }); },
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Use This AOM', cls: 'primary', value: 'ok', check: (bg) => { findings.ex = (bg.querySelector('input[name=ex]:checked') || {}).value; return !!findings.ex; } }]
        });
        if (r !== 'ok') return;
        const src = allAoms.find((a) => a.id === findings.ex).data;
        addItem({ poolCode: src.poolCode, poolVersion: src.poolVersion, mode: 'Modified', copiedFrom: findings.ex, title: src.title, section: src.section, area: src.area, wp: src.wp, blocks: clone(src.blocks) });
      };
      function wireWp() {
        const f = $('#wp-file', root);
        if (!f) return;
        f.onchange = async () => {
          const file = f.files[0]; if (!file) return;
          const it = items.find((x) => x.id === sel);
          try {
            toast('Reading ' + file.name + '…');
            const wp = await readWorkingPaper(file);
            it.data.wpData = { file: wp.file, at: new Date().toISOString(), by: refs.me.email, vars: wp.vars, tables: wp.tables };
            const nv = Object.keys(wp.vars).length, nt = Object.keys(wp.tables).length;
            toast(`Found ${nv} variable${nv === 1 ? '' : 's'} and ${nt} table${nt === 1 ? '' : 's'}. Click Save to keep them.`, nv || nt ? 'ok' : 'warn');
            dirty();
          } catch (err) { toast('Could not read the file: ' + err.message, 'bad'); }
        };
      }
      wireWp();
      async function save() {
        const N = nums();
        let i = 0;
        for (const it of items) {
          i++;
          it.data.seq = i;
          if (!it.data.memberId) it.data.memberId = audit.memberId || refs.me.id;
          const s = JSON.stringify(it.data);
          if (s !== it.orig) { await store.save('aoms', it.id, it.data, { silent: true }); it.orig = s; }
        }
        for (const it of removed.splice(0)) await store.save('aoms', it.id, it.data, { deleted: true, silent: true });
        if (items.length) await advanceStage(ctx, 'Findings and AOMs');
        await store.log('saved the findings', `${ctx.lgu.name} · ${items.length} AOM${items.length === 1 ? '' : 's'}`, audit.teamId, refs.me.email);
        setDirty(false); emitChange('local'); toast('Saved.', 'ok');
        void N;
        return true;
      }
      const sv = $('#f-save', root); if (sv) sv.onclick = save;
      const op = $('#f-open', root); if (op) op.onclick = async () => { if (await save()) location.hash = `#/audits/${ctx.rec.id}/aoms`; };
      setDirty(false, save);
    }
  };
}
