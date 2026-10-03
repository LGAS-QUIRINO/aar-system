// Admin · LGU Master List
import { store, emitChange } from '../store.js';
import { esc, modal, toast, pill, confirmBox, setDirty, $, $$ } from '../ui.js';
import { OFFICIAL_BARANGAYS, slug } from '../seed.js';
import { FUND_NAMES, periodPhrase } from '../format.js';

export async function lgus(refs, params, q) {
  const isAdmin = (refs.me.roles || []).includes('admin');
  const muns = refs.lgus.filter((l) => l.data.kind === 'municipality').sort((a, b) => a.data.name.localeCompare(b.data.name));
  const munId = q.get('m') || 'lgu-maddela';
  const mun = refs.lgu[munId];
  const brgys = refs.lgus.filter((l) => l.data.kind === 'barangay' && l.data.parentId === munId).sort((a, b) => a.data.name.localeCompare(b.data.name));
  const selId = q.get('b') || brgys[0]?.id;
  const sel = refs.lgu[selId];
  const audits = await store.list('audits');
  const lastAudit = (id) => audits.filter((a) => a.data.lguId === id).sort((a, b) => b.data.auditYear - a.data.auditYear)[0];
  const fundText = (f) => (f || []).map((x) => x === 'BDRRMF' ? '5% BDRRMF' : x).join(' · ');
  const STANDARD_FUNDS = [{ code: 'GF', name: FUND_NAMES.GF }, { code: 'BDRRMF', name: FUND_NAMES.BDRRMF }];
  const fundList = (d) => [...STANDARD_FUNDS, ...(d.customFunds || [])];
  const cols = 'grid-template-columns: 76px minmax(110px,1fr) 112px 54px';
  const go = (m, b) => `#/lgus?m=${encodeURIComponent(m)}${b ? '&b=' + encodeURIComponent(b) : ''}`;
  const dis = isAdmin ? '' : 'disabled';

  const body = `<div class="page-head"><div><h1>LGU Master List</h1><p>Province of Quirino. Names here are used on every document, so they are only edited here.</p></div>
      ${isAdmin ? '<div class="btn-row"><button class="btn ghost" id="official">Add Barangays from Official List</button><button class="btn primary" id="add-brgy">+ Add Barangay</button></div>' : ''}</div>
    <div class="split-3">
      <section class="panel" style="align-self:start"><div class="panel-head"><h2>Province of Quirino</h2></div>
        ${muns.map((m) => { const n = refs.lgus.filter((l) => l.data.parentId === m.id && l.data.kind === 'barangay').length; return `<a class="t-row click ${m.id === munId ? 'sel' : ''}" href="${go(m.id)}" style="grid-template-columns:1fr auto;text-decoration:none;color:inherit">
          <span><b>${esc(m.data.name)}</b><br><small style="color:var(--muted)">${esc(refs.team[m.data.teamId]?.data.name || '')}</small></span>
          <span>${n ? pill(n + ' Barangays', 'ok') : pill('Not Loaded', 'grey')}</span></a>`; }).join('')}
      </section>
      <section class="panel" style="min-width:0"><div class="panel-head"><h2>Municipality of ${esc(mun?.data.name || '')} · ${brgys.length} Barangays</h2></div>
        <div class="panel-body" style="padding:12px 20px"><label class="sr-only" for="find">Search Barangays</label><input class="input" id="find" placeholder="Search Barangays"></div>
        <div class="t-head" style="${cols}"><span>ID</span><span>Barangay</span><span>Funds</span><span>Last</span></div>
        <div id="blist">${brgys.length ? brgys.map((b) => `<a class="t-row click ${b.id === selId ? 'sel' : ''}" data-name="${esc(b.data.name.toLowerCase())}" href="${go(munId, b.id)}" style="${cols};text-decoration:none;color:inherit">
          <span class="mono" style="font-size:12px">${esc(b.data.code || '')}</span><span><b>${esc(b.data.name)}</b> ${b.data.active ? '' : pill('Inactive', 'grey')}</span><span style="font-size:12px">${esc(fundText(b.data.funds))}</span><span>${esc(lastAudit(b.id)?.data.auditYear || '–')}</span></a>`).join('')
          : `<div class="empty">No barangays yet for ${esc(mun?.data.name || '')}.${isAdmin ? ' Use <b>Add Barangays from Official List</b> or <b>+ Add Barangay</b>.' : ''}</div>`}</div>
      </section>
      <div style="display:flex;flex-direction:column;gap:20px">
      ${mun ? `<section class="panel" id="m-panel"><div class="panel-head"><h2>Municipality of ${esc(mun.data.name)}</h2></div><div class="panel-body">
        <div class="grid-2"><div class="field"><label class="label" for="m-abc">ABC President</label><input class="input" id="m-abc" value="${esc(mun.data.abcPresident || '')}" placeholder="e.g. Hon. Juan A. Dela Cruz" ${dis}></div>
          <div class="field"><label class="label" for="m-sal">Salutation</label><select class="input" id="m-sal" ${dis}><option ${mun.data.abcSalutation !== 'Dear Madam:' ? 'selected' : ''}>Dear Sir:</option><option ${mun.data.abcSalutation === 'Dear Madam:' ? 'selected' : ''}>Dear Madam:</option></select></div></div>
        <span class="hint">Used on the Exit Conference invitation letter. Type it once here.</span>
        ${isAdmin ? '<div class="btn-row"><button class="btn primary" id="m-save">Save</button></div>' : ''}</div></section>` : ''}
      ${sel ? `<section class="panel"><div class="panel-head"><h2>Barangay ${esc(sel.data.name)}</h2></div><div class="panel-body">
        <div class="field"><label class="label" for="b-name">Official Name</label><input class="input strong" id="b-name" value="${esc(sel.data.name)}" ${dis}></div>
        <div class="grid-2"><div class="field"><span class="label">Municipality</span><div class="input" style="display:flex;align-items:center">${esc(mun.data.name)}</div></div>
        <div class="field"><label class="label" for="b-team">Audit Team</label><select class="input" id="b-team" ${dis}>${refs.teams.map((t) => `<option value="${t.id}" ${t.id === sel.data.teamId ? 'selected' : ''}>${esc(t.data.name)}</option>`).join('')}</select></div></div>
        <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label">Funds</legend>
          <div id="b-funds">${fundList(sel.data).map((f) => `<label class="check"><input type="checkbox" name="fund" value="${esc(f.code)}" ${(sel.data.funds || []).includes(f.code) ? 'checked' : ''} ${dis}>${esc(f.name)}${f.code !== 'GF' && f.code !== 'BDRRMF' ? ` <span class="hint">(${esc(f.code)})</span>` : ''}</label>`).join('')}</div>
          ${isAdmin ? '<div><button type="button" class="btn sm dashed" id="b-addfund">+ Add Fund</button></div><span class="hint">Untick a fund the Barangay no longer uses. Funds are never deleted, so past audits keep them.</span>' : ''}</fieldset>
        <label class="check"><input type="checkbox" id="b-active" ${sel.data.active ? 'checked' : ''} ${dis}>Active (inactive Barangays are hidden from New Audit)</label>
        <div class="field"><span class="label">Audit History</span>${audits.filter((a) => a.data.lguId === sel.id).sort((a, b) => b.data.auditYear - a.data.auditYear)
          .map((a) => `<small>${esc(a.data.auditYear)} · ${esc(periodPhrase(a.data.periodFrom, a.data.periodTo))} · ${esc(a.data.imported ? 'Earlier Record' : a.data.status || 'In Progress')}</small>`).join('') || '<small class="hint">Earlier audits appear here once entered</small>'}</div>
        ${isAdmin ? '<div class="btn-row"><span class="save-state saved"><span class="d"></span>All Changes Saved</span><button class="btn primary" id="b-save" style="margin-left:auto">Save</button></div>' : ''}
      </div></section>` : ''}
      <section class="panel"><div class="panel-head"><h2>Good to Know</h2></div><div class="panel-body" style="font-size:13px;line-height:1.5;gap:8px">
        <span>• Renaming a Barangay keeps issued documents unchanged.</span><span>• Barangays are never deleted, only marked inactive, so history stays.</span></div></section>
      </div></div>`;

  async function addMany(names) {
    let n = brgys.length;
    for (const name of names) {
      n += 1;
      await store.save('lgus', `brgy-${slug(mun.data.name)}-${slug(name)}`, { kind: 'barangay', name, parentId: munId, teamId: mun.data.teamId, active: true, code: 'BRGY-' + String(n).padStart(3, '0'), funds: ['GF', 'BDRRMF'], lastOfficials: null }, { silent: true });
    }
    if (!mun.data.loaded) await store.save('lgus', munId, { ...mun.data, loaded: true }, { silent: true });
    await store.log('added barangays', `${names.length} · ${mun.data.name}`, '', refs.me.email);
    emitChange('local');
  }

  return {
    active: '#/lgus', crumbs: '<b>LGU Master List</b>', body,
    mount(root) {
      $('#find', root).oninput = (e) => { const v = e.target.value.trim().toLowerCase(); $$('#blist [data-name]', root).forEach((r) => { r.style.display = r.dataset.name.includes(v) ? '' : 'none'; }); };
      if (!isAdmin) return;
      const ms = $('#m-save', root);
      if (ms) {
        const saveMun = async () => {
          await store.save('lgus', munId, { ...mun.data, abcPresident: $('#m-abc', root).value.trim(), abcSalutation: $('#m-sal', root).value });
          await store.log('edited a municipality', mun.data.name + ' · ABC President', '', refs.me.email);
          setDirty(false); toast('Saved.', 'ok'); return true;
        };
        ms.onclick = saveMun;
        $('#m-panel', root).addEventListener('input', () => setDirty(true, saveMun));
        $('#m-panel', root).addEventListener('change', () => setDirty(true, saveMun));
      }
      $('#official', root).onclick = async () => {
        const list = OFFICIAL_BARANGAYS[munId];
        if (!list) { await modal({ title: 'Official List', body: `<p style="margin:0">The official Barangay list for ${esc(mun.data.name)} is not built in yet. Add its Barangays one at a time with <b>+ Add Barangay</b>, or ask for the list to be added.</p>` }); return; }
        const have = new Set(brgys.map((b) => b.data.name.toLowerCase()));
        const missing = list.filter((n) => !have.has(n.toLowerCase()));
        if (!missing.length) { toast(`All ${list.length} Barangays of ${mun.data.name} are already in the list.`, 'ok'); return; }
        if (await confirmBox('Add Barangays from Official List', `Add ${missing.length} Barangay${missing.length > 1 ? 's' : ''} of ${esc(mun.data.name)}: ${esc(missing.join(', '))}?`, 'Add')) await addMany(missing);
      };
      $('#add-brgy', root).onclick = async () => {
        const r = await modal({
          title: 'Add Barangay · ' + mun.data.name,
          body: '<div class="field"><label class="label" for="nb">Official Name</label><input class="input" id="nb" placeholder="e.g. San Pedro"></div>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Add', cls: 'primary', value: 'add', check: (bg) => { const v = $('#nb', bg).value.trim(); if (!v) return false; if (brgys.some((b) => b.data.name.toLowerCase() === v.toLowerCase())) { toast('That Barangay is already listed.', 'bad'); return false; } lgus.nb = v; return true; } }]
        });
        if (r === 'add') await addMany([lgus.nb]);
      };
      const sv = $('#b-save', root);
      if (sv) {
        const save = async () => {
          const name = $('#b-name', root).value.trim();
          if (!name) { toast('Enter the official name.', 'bad'); return false; }
          const funds = $$('input[name=fund]:checked', root).map((x) => x.value);
          await store.save('lgus', sel.id, { ...sel.data, customFunds: lgus.customFunds || sel.data.customFunds || [], name, teamId: $('#b-team', root).value, funds, active: $('#b-active', root).checked });
          lgus.customFunds = null;
          await store.log('edited a barangay', name, '', refs.me.email);
          setDirty(false); toast('Saved.', 'ok'); return true;
        };
        sv.onclick = save;
        lgus.customFunds = null;
        const af = $('#b-addfund', root);
        if (af) af.onclick = async () => {
          const r = await modal({
            title: 'Add Fund · Barangay ' + sel.data.name,
            body: `<div class="field"><label class="label" for="nf-name">Fund Name</label><input class="input" id="nf-name" placeholder="e.g. Trust Fund"></div>
              <div class="field"><label class="label" for="nf-code">Short Code (optional)</label><input class="input" id="nf-code" placeholder="e.g. TF" style="text-transform:uppercase"></div>
              <span class="hint">It is added for this Barangay only. Click Save afterwards to keep it.</span>`,
            buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Add Fund', cls: 'primary', value: 'ok', check: (bg) => {
              const name = $('#nf-name', bg).value.trim();
              if (!name) { toast('Enter the fund name.', 'bad'); return false; }
              const code = ($('#nf-code', bg).value.trim() || name.split(/\s+/).filter((w) => /^[A-Za-z0-9%]/.test(w)).map((w) => w[0]).join('')).toUpperCase().replace(/[^A-Z0-9%]/g, '');
              const all = [...STANDARD_FUNDS, ...(lgus.customFunds || sel.data.customFunds || [])];
              if (all.some((f) => f.code === code || f.name.toLowerCase() === name.toLowerCase())) { toast('That fund is already listed.', 'bad'); return false; }
              lgus.newFund = { code, name }; return true;
            } }]
          });
          if (r !== 'ok') return;
          lgus.customFunds = [...(lgus.customFunds || sel.data.customFunds || []), lgus.newFund];
          const box = $('#b-funds', root);
          box.insertAdjacentHTML('beforeend', `<label class="check"><input type="checkbox" name="fund" value="${esc(lgus.newFund.code)}" checked>${esc(lgus.newFund.name)} <span class="hint">(${esc(lgus.newFund.code)})</span></label>`);
          setDirty(true, save);
        };
        const notMun = (e) => !e.target.closest('#m-panel');
        root.querySelector('.split-3 > div:last-child').addEventListener('input', (e) => { if (notMun(e)) setDirty(true, save); });
        root.querySelector('.split-3 > div:last-child').addEventListener('change', (e) => { if (notMun(e)) setDirty(true, save); });
        setDirty(false, save);
      }
    }
  };
}
