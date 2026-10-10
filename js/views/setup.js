// Screen 2 · Audit Setup
import { store, newId } from '../store.js';
import { N1_WORKFORCE } from '../baar-notes.js';
import { esc, toast, setDirty, guard, modal, confirmBox, pill, $, $$ } from '../ui.js';
import { ST } from '../aom.js';
import { has, myTeamIds, canEditSetup } from '../refs.js';
import { aomRange, aomNo, periodYears, longDate, fullName, upper, nice } from '../format.js';

const TITLES = ['Hon.', 'Mr.', 'Ms.', 'Mrs.', 'Atty.', 'Engr.', 'Dr.', ''];
const ROLES = ['For', 'Attention', 'Not on AOM'];
const DEFAULT_OFFICIALS = [
  { title: 'Hon.', name: '', pos: 'Punong Barangay', acting: false, role: 'For' },
  { title: 'Ms.', name: '', pos: 'Municipal Accountant', acting: false, role: 'Attention' },
  { title: 'Ms.', name: '', pos: 'Barangay Bookkeeper', acting: false, role: 'Attention' },
  { title: 'Ms.', name: '', pos: 'Barangay Treasurer', acting: false, role: 'Attention' }
];
const DEFAULT_KAGAWADS = [1, 2, 3, 4, 5, 6, 7].map(() => ({ name: '', pos: 'Barangay Kagawad' })).concat([{ name: '', pos: 'SK Chairperson' }]);
const clone = (x) => JSON.parse(JSON.stringify(x));
const posText = (o) => (o.acting ? 'Acting ' : '') + (o.pos || '');

export async function setup(refs, params) {
  const year = new Date().getFullYear();
  const isNew = !params.id;
  const rec = isNew ? null : await store.get('audits', params.id);
  if (!isNew && (!rec || rec.deleted)) return { active: '#/audits', crumbs: '<a href="#/audits">My Audit</a> / <b>Not Found</b>', body: '<div class="note bad">This audit was not found on this device. Try Sync Now.</div>' };

  const allAudits = await store.list('audits');
  const teamIds = myTeamIds(refs.me, refs.teams);
  const editable = canEditSetup(refs.me) && (!rec || teamIds.includes(rec.data.teamId));
  const muns = refs.lgus.filter((l) => l.data.kind === 'municipality' && teamIds.includes(l.data.teamId)).sort((a, b) => a.data.name.localeCompare(b.data.name));
  const brgysOf = (munId) => refs.lgus.filter((l) => l.data.kind === 'barangay' && l.data.parentId === munId && (l.data.active || (rec && rec.data.lguId === l.id))).sort((a, b) => a.data.name.localeCompare(b.data.name));

  const s = rec ? clone(rec.data) : {
    lguId: '', teamId: '', auditYear: year, periodFrom: year - 2, periodTo: year - 1, aomDate: new Date().toISOString().slice(0, 10),
    officials: clone(DEFAULT_OFFICIALS), kagawads: clone(DEFAULT_KAGAWADS), memberId: has(refs.me, 'member') ? refs.me.id : '', status: 'In Progress', stage: 'Setup'
  };
  let munId = s.lguId ? refs.lgu[s.lguId]?.data.parentId : (muns.find((m) => m.data.loaded) || muns[0])?.id || '';
  let base = null;           // officials of the previous audit, to show what changed

  // Only fill blank accountant names on new audits; never overwrite manual entries.
  const applyMunicipalAccountant = () => {
    const name = String(refs.lgu[munId]?.data.municipalAccountant || '').trim();
    if (!name || !isNew) return;
    const accountant = s.officials.find(o => /^Municipal Accountant$/i.test(String(o.pos || '').trim()));
    if (accountant && !String(accountant.name || '').trim()) accountant.name = name;
  };
  const prevAudit = (lguId) => allAudits.filter((a) => a.data.lguId === lguId && Number(a.data.auditYear) < Number(s.auditYear) && a.id !== params.id)
    .sort((a, b) => b.data.auditYear - a.data.auditYear)[0];
  const duplicate = () => allAudits.find((a) => a.id !== params.id && a.data.lguId === s.lguId && Number(a.data.auditYear) === Number(s.auditYear) && !a.data.imported);
  const teamOf = () => refs.team[refs.lgu[s.lguId]?.data.teamId || refs.lgu[munId]?.data.teamId];
  const userName = (id) => refs.user[id] ? refs.user[id].data : null;
  if (s.lguId) { const p = prevAudit(s.lguId); base = p ? p.data : null; }

  const yearOpts = (sel, from, to) => { let o = ''; for (let y = to; y >= from; y--) o += `<option value="${y}" ${Number(sel) === y ? 'selected' : ''}>CY ${y}</option>`; return o; };
  const ch = (i, k) => base && base.officials && base.officials[i] && String(base.officials[i][k] ?? '') !== String(s.officials[i][k] ?? '') ? 'changed' : '';
  const chK = (i) => base && base.kagawads && base.kagawads[i] && base.kagawads[i].name !== s.kagawads[i].name ? 'changed' : '';
  const dis = editable ? '' : 'disabled';
  // The period locks once any AOM of this audit is Final (AOM numbers carry the period). The SA or Admin can unlock it with a reason.
  const finalAom = rec ? (await store.list('aoms')).filter((a) => a.data.auditId === rec.id && a.data.status === ST.FINAL).sort((a, b) => (a.data.number || 0) - (b.data.number || 0))[0] : null;
  const periodLocked = !!finalAom;
  const canUnlock = has(refs.me, 'sa') || has(refs.me, 'admin');
  // Once a saved audit has its Team Member, only the SA or Admin changes it (Change Auditor), and not after the audit is Final.
  const auditFinal = !!rec && (rec.data.status === 'Final' || rec.data.stage === 'Final');
  const locked = !!rec && !!rec.data.memberId;
  const canChangeAuditor = canUnlock && !auditFinal;
  const pdis = periodLocked ? 'disabled' : dis;

  function officialsRows() {
    return s.officials.map((o, i) => `<div class="t-row off-row">
      <select class="input ${ch(i, 'title')}" style="grid-area:title" data-o="${i}" data-k="title" aria-label="Title" ${dis}>${TITLES.map((t) => `<option ${o.title === t ? 'selected' : ''} value="${t}">${t || '–'}</option>`).join('')}</select>
      <input class="input ${ch(i, 'name')}" style="grid-area:name" data-o="${i}" data-k="name" value="${esc(o.name)}" aria-label="Full Name" ${dis}>
      ${editable ? `<button class="x" style="grid-area:del" data-del="${i}" aria-label="Remove ${esc(o.pos || 'official')}" title="Remove">×</button>` : ''}
      <label class="check" style="grid-area:act" title="Acting / OIC"><input type="checkbox" data-o="${i}" data-k="acting" ${o.acting ? 'checked' : ''} ${dis}>Acting</label>
      <input class="input ${ch(i, 'pos')}" style="grid-area:pos" data-o="${i}" data-k="pos" value="${esc(o.pos)}" placeholder="Position" aria-label="Position" ${dis}>
      <select class="input ${ch(i, 'role')}" style="grid-area:role" data-o="${i}" data-k="role" aria-label="AOM Role" ${dis}>${ROLES.map((r) => `<option ${o.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
    </div>`).join('');
  }

  function preview() {
    const lgu = refs.lgu[s.lguId], mun = refs.lgu[munId];
    const team = teamOf();
    const forO = s.officials.filter((o) => o.role === 'For');
    const att = s.officials.filter((o) => o.role === 'Attention');
    const addr = lgu ? `${upper(lgu.data.name)}, ${upper(mun?.data.name)}, QUIRINO` : 'BARANGAY, MUNICIPALITY, QUIRINO';
    const nm = (o) => esc(o.name ? fullName(o) : (o.title ? upper(o.title) + ' ' : '') + '__________');
    return `<div class="paper">
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:2px">
        <img src="img/coa-logo.png" alt="" style="width:46px;height:46px">
        <div style="text-align:center;line-height:1.25;font-size:11px">Republic of the Philippines<br><b style="font-size:12.5px">COMMISSION ON AUDIT</b><br>Regional Office No. II<br>Province of Quirino<br>Provincial Satellite Auditing Office<br>Capitol Hills, Cabarroguis, Quirino</div>
      </div>
      <div class="office">Office of the Auditor${team && team.data.officeCode ? ' – Audit Team ' + esc(team.data.officeCode) : ''}</div>
      <div class="rule"></div>
      <div class="num"><span>AOM No. ${esc(aomRange(s.auditYear, 1, null, s.periodFrom, s.periodTo))}</span><span>Date:&nbsp;&nbsp;${esc(longDate(s.aomDate) || '__________')}</span></div>
      <div class="title">AUDIT OBSERVATION MEMORANDUM</div>
      ${(forO.length ? forO : [{ title: '', name: '', pos: 'Punong Barangay' }]).map((o) => `<div class="blk"><strong>${nm(o)}</strong><span>${esc(posText(o))}</span><span>${esc(addr)}</span></div>`).join('<br>')}
      ${att.length ? `<div class="att"><span>Attention:</span><div class="att-list">${att.map((o) => `<div class="blk"><strong>${nm(o)}</strong><span>${esc(posText(o))}</span></div>`).join('')}</div></div>` : ''}
    </div>`;
  }

  function facts() {
    const dup = s.lguId && duplicate();
    const bad = Number(s.periodFrom) > Number(s.periodTo);
    const lgu = refs.lgu[s.lguId];
    return `<div class="grid-2">
        <div class="field"><span class="label">AOM Number Format</span><div class="input" style="display:flex;align-items:center" aria-live="polite"><span class="mono">${esc(s.auditYear)}-001 (${esc(periodYears(s.periodFrom, s.periodTo))})</span></div></div>
        <div class="field"><span class="label">Audited FS</span><div class="input" style="display:flex;align-items:center">CY ${esc(s.periodTo)}, with CY ${esc(s.periodTo - 1)} Comparative</div></div></div>
      ${bad ? '<div class="note bad">Period Covered From must not be later than Period Covered To.</div>'
        : dup ? `<div class="note bad">${esc(lgu.data.name)} already has a ${esc(s.auditYear)} audit. Open that one instead.</div>`
          : lgu ? `<div class="note ok">No other ${esc(s.auditYear)} audit exists for ${esc(lgu.data.name)}</div>` : ''}`;
  }

  function teamPanel() {
    const team = teamOf();
    const members = refs.users.filter((u) => (u.data.teamIds || []).includes(team?.id) && (u.data.roles || []).includes('member') && u.data.status !== 'disabled');
    const atl = team && userName(team.data.atlUserId), sa = team && userName(team.data.saUserId);
    const line = (u, fallback) => u ? `<b>${esc(nice(u.name))}</b><span class="hint">${esc([u.position, u.designation].filter(Boolean).join(' · '))}</span>` : `<span class="hint">${fallback}</span>`;
    return `<div class="grid-3">
      ${locked ? `<div class="field"><span class="label">Team Member</span>${line(userName(s.memberId), 'Not assigned')}
        ${canChangeAuditor ? '<div><button class="btn sm ghost" type="button" id="chg-aud">Change Auditor</button></div>' : ''}</div>`
      : `<div class="field"><label class="label" for="member">Team Member</label>
        <select class="input" id="member" ${dis}><option value="">Choose…</option>${members.map((u) => `<option value="${u.id}" ${s.memberId === u.id ? 'selected' : ''}>${esc(nice(u.data.name))}</option>`).join('')}</select></div>`}
      <div class="field"><span class="label">Audit Team Leader</span>${line(atl, 'Not assigned yet (Users & Roles)')}</div>
      <div class="field"><span class="label">Supervising Auditor</span>${line(sa, 'Not assigned yet (Users & Roles)')}</div></div>
      ${locked ? '<div class="hint">Only the Supervising Auditor or Admin can change the auditor of an audit that is not yet Final.</div>' : ''}
      <div class="hint">Filled automatically from Users &amp; Roles${team ? ' for ' + esc(team.data.name) : ''}.${atl && sa && team.data.atlUserId === team.data.saUserId ? ' One-step review: the same person is Audit Team Leader and Supervising Auditor.' : ''}</div>`;
  }

  const title = rec ? `${refs.lgu[rec.data.lguId]?.data.name || ''} · ${rec.data.auditYear}` : 'New Audit';
  const body = `
    <div class="page-head"><div><h1>Audit Setup</h1><p>Choose the Barangay and period, then confirm the officials.</p></div></div>
    <div class="topnote">Names entered here print on every AOM, the SAOR and the BAAR. Type them in normal letters (e.g. Juan A. Cruz); AOMs print them in capitals. Highlighted fields changed from the previous audit.</div>
    ${editable ? '' : '<div class="note info">You can view this setup but not change it.</div>'}
    <div class="split preview"><div style="display:flex;flex-direction:column;gap:20px;min-width:0">
      <section class="panel"><div class="panel-head"><div class="step-title"><span class="step-num">1</span><h2>Entity</h2></div></div><div class="panel-body">
        <div class="grid-3">
          <div class="field"><span class="label">Province</span><div class="input" style="display:flex;align-items:center">Quirino</div></div>
          <div class="field"><label class="label" for="mun">Municipality</label><select class="input" id="mun" ${rec ? 'disabled' : dis}>${muns.map((m) => `<option value="${m.id}" ${m.id === munId ? 'selected' : ''} ${m.data.loaded ? '' : 'disabled'}>${esc(m.data.name)}${m.data.loaded ? '' : ' (not loaded yet)'}</option>`).join('')}</select><span class="hint">Only LGUs assigned to your team are listed</span></div>
          <div class="field"><label class="label" for="brgy">Barangay</label><select class="input strong" id="brgy" ${rec ? 'disabled' : dis}></select><span class="hint" id="brgy-hint"></span></div>
        </div></div></section>
      <section class="panel"><div class="panel-head"><div class="step-title"><span class="step-num">2</span><h2>Audit Year and Period</h2></div>${periodLocked ? `<span id="p-lockpill" style="margin-left:auto">${pill('🔒 Locked', 'grey')}</span>` : ''}</div><div class="panel-body">
        <div class="grid-4">
          <div class="field"><label class="label" for="ay">Audit Year</label><select class="input" id="ay" ${pdis}>${[year + 1, year, year - 1].map((y) => `<option ${Number(s.auditYear) === y ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
          <div class="field"><label class="label" for="pf">Period Covered From</label><select class="input" id="pf" ${pdis}>${yearOpts(s.periodFrom, year - 8, year)}</select></div>
          <div class="field"><label class="label" for="pt">Period Covered To</label><select class="input" id="pt" ${pdis}>${yearOpts(s.periodTo, year - 8, year)}</select></div>
          <div class="field"><label class="label" for="ad">AOM Date</label><input type="date" class="input" id="ad" value="${esc(s.aomDate)}" ${dis}></div>
        </div>${periodLocked ? `<div id="p-lock"><div class="note warn" style="margin:0;display:block">Locked because AOM No. ${esc(aomNo(s.auditYear, finalAom.data.number || 1, s.periodFrom, s.periodTo))} is Final, so the Audit Year and the period are locked. Only the SA or Admin can unlock them.</div>
          ${canUnlock && editable ? '<div class="lr-row" style="margin-top:8px"><span></span><button class="btn sm" type="button" id="p-unlock">Unlock</button></div>' : ''}</div>` : ''}<div class="tbm-row"><span class="label">Trial Balance Used</span><div class="seg" role="group" aria-label="Trial Balance Used">${[['fund', 'Per Fund'], ['consolidated', 'Consolidated (All Funds)']].map(([k, l]) => `<button type="button" data-tbm="${k}" class="${(s.tbMode || 'fund') === k ? 'on' : ''}" ${dis}>${l}</button>`).join('')}</div></div><div id="facts">${facts()}</div></div></section>
      <section class="panel"><div class="panel-head"><div class="step-title"><span class="step-num">3</span><h2>Officials for the AOM</h2></div><span class="hint" id="carry"></span></div>
        <div class="t-head off-row"><span style="grid-area:title">Title</span><span style="grid-area:name">Full Name · Position</span><span style="grid-area:role">AOM Role</span></div>
        <div id="officials">${officialsRows()}</div>
        ${editable ? '<div class="panel-body" style="padding-top:12px"><div><button class="btn dashed sm" id="add-off">+ Add Official</button></div></div>' : ''}
      </section>
      <section class="panel"><div class="panel-head"><div class="step-title"><span class="step-num">4</span><h2>Sangguniang Barangay Members</h2></div><span class="hint">For the General Information in the Notes to Financial Statements</span></div>
        <div class="panel-body"><div class="grid-2" id="kagawads">${s.kagawads.map((k, i) => `<div class="field"><label class="label" for="kg${i}">${i + 1}. ${esc(k.pos)}</label><input class="input ${chK(i)}" id="kg${i}" data-kg="${i}" value="${esc(k.name)}" ${dis}></div>`).join('')}</div>
          <div class="grid-2" id="ninfo" style="margin-top:14px;border-top:1px solid var(--line-2);padding-top:14px">
            <div class="field"><label class="label" for="ni-loc">Location of the Barangay</label><input class="input" id="ni-loc" data-ni="loc" value="${esc((s.notesInfo || {}).loc || '')}" placeholder="e.g. Western part of Maddela" ${dis}></div>
            <div class="field"><label class="label" for="ni-issued">Date the Financial Statements Were Issued</label><input type="date" class="input" id="ni-issued" data-ni="issued" value="${esc((s.notesInfo || {}).issued || '')}" ${dis}></div>
            <div class="field" style="grid-column:1 / -1"><label class="label" for="ni-wf">Workforce, after the Elective Officials</label><input class="input" id="ni-wf" data-ni="workforce" value="${esc((s.notesInfo || {}).workforce ?? N1_WORKFORCE)}" ${dis}></div>
          </div></div></section>
      <section class="panel"><div class="panel-head"><div class="step-title"><span class="step-num">5</span><h2>Audit Team</h2></div></div><div class="panel-body" id="teampanel">${teamPanel()}</div></section>
      ${editable ? `<div class="panel" style="padding:14px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;bottom:12px;z-index:5">
        <span class="save-state saved"><span class="d"></span>All Changes Saved</span>
        <div class="btn-row" style="margin-left:auto"><button class="btn primary" id="save">Save</button>
        <button class="btn ghost" id="save-go">Save and Continue to Financial Statements →</button></div></div>` : ''}
    </div>
    <aside class="sticky" style="display:flex;flex-direction:column;gap:10px;align-self:start"><h2 style="font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Live Preview · AOM Header</h2><div id="preview">${preview()}</div></aside></div>`;

  return {
    active: '#/audits',
    crumbs: `<a href="#/audits">My Audit</a> / <b>${esc(title)}</b>`,
    body,
    mount(root) {
      const dirty = () => { setDirty(true, save); refresh(); };
      const refresh = () => { $('#preview', root).innerHTML = preview(); $('#facts', root).innerHTML = facts(); };
      const fillBrgys = () => {
        const list = brgysOf(munId);
        const sel = $('#brgy', root);
        sel.innerHTML = `<option value="">Choose a Barangay…</option>` + list.map((b) => `<option value="${b.id}" ${b.id === s.lguId ? 'selected' : ''}>${esc(b.data.name)}</option>`).join('');
        $('#brgy-hint', root).textContent = `${list.length} Barangays of ${refs.lgu[munId]?.data.name || ''}, from the Master List`;
      };
      const carryNote = () => {
        const p = s.lguId && prevAudit(s.lguId);
        $('#carry', root).textContent = p ? `Carried Over from ${refs.lgu[s.lguId].data.name}'s ${p.data.auditYear} Audit · Edit Only What Changed` : s.lguId ? 'No previous audit on record · Type the officials once' : '';
      };
      const redrawOfficials = () => { $('#officials', root).innerHTML = officialsRows(); };
      fillBrgys(); carryNote();

      $('#mun', root).onchange = (e) => { munId = e.target.value; s.lguId = ''; fillBrgys(); carryNote(); dirty(); };
      $('#brgy', root).onchange = (e) => {
        s.lguId = e.target.value;
        const p = s.lguId && prevAudit(s.lguId);
        base = p ? p.data : null;
        if (isNew && p) { s.officials = clone(p.data.officials || DEFAULT_OFFICIALS); s.kagawads = clone(p.data.kagawads || DEFAULT_KAGAWADS); s.notesInfo = { loc: (p.data.notesInfo || {}).loc || '', workforce: (p.data.notesInfo || {}).workforce ?? N1_WORKFORCE, issued: '' }; }
        else if (isNew) { s.officials = clone(DEFAULT_OFFICIALS); s.kagawads = clone(DEFAULT_KAGAWADS); }
        applyMunicipalAccountant();
        s.teamId = refs.lgu[s.lguId]?.data.teamId || '';
        redrawOfficials();
        $$('[data-ni]', root).forEach((el) => { el.value = el.dataset.ni === 'workforce' ? ((s.notesInfo || {}).workforce ?? N1_WORKFORCE) : ((s.notesInfo || {})[el.dataset.ni] || ''); });
        $$('[data-kg]', root).forEach((el) => { const i = +el.dataset.kg; el.value = s.kagawads[i].name; el.classList.toggle('changed', !!chK(i)); });
        $('#teampanel', root).innerHTML = teamPanel(); wireMember();
        carryNote(); dirty();
      };
      const num = (id, k) => { const el = $(id, root); if (el) el.onchange = () => { s[k] = Number(el.value); dirty(); }; };
      num('#ay', 'auditYear'); num('#pf', 'periodFrom'); num('#pt', 'periodTo');
      const ad = $('#ad', root); if (ad) ad.oninput = () => { s.aomDate = ad.value; dirty(); };

      const offBox = $('#officials', root);
      const onOff = (e) => {
        const el = e.target; if (!el.dataset.o) return;
        const i = +el.dataset.o, k = el.dataset.k;
        s.officials[i][k] = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type !== 'checkbox') el.classList.toggle('changed', !!ch(i, k));
        dirty();
      };
      offBox.addEventListener('input', onOff); offBox.addEventListener('change', onOff);
      offBox.addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (!b) return; s.officials.splice(+b.dataset.del, 1); redrawOfficials(); dirty(); });
      const add = $('#add-off', root); if (add) add.onclick = () => { s.officials.push({ title: 'Mr.', name: '', pos: '', acting: false, role: 'Attention' }); redrawOfficials(); dirty(); offBox.querySelector(`[data-o="${s.officials.length - 1}"][data-k="name"]`).focus(); };
      $('#ninfo', root).addEventListener('input', (e) => { const k = e.target.dataset.ni; if (!k) return; s.notesInfo = { ...(s.notesInfo || {}), [k]: e.target.value }; dirty(); });
      $('#kagawads', root).addEventListener('input', (e) => { const i = e.target.dataset.kg; if (i === undefined) return; s.kagawads[+i].name = e.target.value; e.target.classList.toggle('changed', !!chK(+i)); dirty(); });
      const wireMember = () => {
        const m = $('#member', root); if (m) m.onchange = () => { s.memberId = m.value; dirty(); };
        const c = $('#chg-aud', root); if (c) c.onclick = changeAuditor;
      };
      async function changeAuditor() {
        const team = teamOf();
        const members = refs.users.filter((u) => (u.data.teamIds || []).includes(team?.id) && (u.data.roles || []).includes('member') && u.data.status !== 'disabled' && u.id !== s.memberId);
        const finals = (await store.list('aoms')).filter((a) => a.data.auditId === rec.id && a.data.status === ST.FINAL).length;
        const old = userName(s.memberId);
        let pick = '', oo = '';
        const r = await modal({ title: 'Change Auditor · ' + (refs.lgu[s.lguId]?.data.name || ''),
          body: `<div class="grid-2"><div class="field"><label class="label" for="ca-new">New Team Member</label><select class="input" id="ca-new"><option value="">Choose…</option>${members.map((u) => `<option value="${u.id}">${esc(nice(u.data.name))}</option>`).join('')}</select></div>
            <div class="field"><label class="label" for="ca-oo">Office Order No. (optional)</label><input class="input" id="ca-oo"></div></div>
            <div class="note info" style="display:block;line-height:1.5">From now on, the new Team Member works on this audit, and their name goes on the documents not yet issued, such as the BAAR.${finals ? ` The ${finals} Final AOM${finals > 1 ? 's keep' : ' keeps'} ${esc(nice(old ? old.name : ''))}'s name.` : ''}</div>`,
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Change Auditor', cls: 'primary', value: 'ok', check: (bg) => { pick = $('#ca-new', bg).value; oo = $('#ca-oo', bg).value.trim(); if (!pick) toast('Choose the new Team Member.', 'warn'); return !!pick; } }] });
        if (r !== 'ok') return;
        if (guard.dirty && !(await save())) return;
        const cur = await store.get('audits', rec.id);
        await store.save('audits', rec.id, { ...cur.data, memberId: pick }, { silent: true });
        // Work not yet approved moves with the audit; Final AOMs keep who wrote them.
        for (const a of (await store.list('aoms')).filter((x) => x.data.auditId === rec.id && x.data.memberId === s.memberId && [ST.DRAFT, ST.RETURNED].includes(x.data.status || ST.DRAFT))) await store.save('aoms', a.id, { ...a.data, memberId: pick }, { silent: true });
        await store.log('changed the auditor', `${refs.lgu[s.lguId]?.data.name || ''} · ${s.auditYear} · ${nice(old ? old.name : '')} → ${nice(refs.user[pick]?.data.name || '')}${oo ? ' · Office Order No. ' + oo : ''}`, s.teamId, refs.me.email);
        s.memberId = pick;
        toast('Auditor changed.', 'ok');
        $('#teampanel', root).innerHTML = teamPanel(); wireMember();
      }
      wireMember();
      // Trial Balance Used: per fund, or one consolidated trial balance for all funds. Parts 06 and 07 use the consolidated amounts either way.
      $$('[data-tbm]', root).forEach((b) => { b.onclick = async () => {
        const k = b.dataset.tbm;
        if ((s.tbMode || 'fund') === k) return;
        if (rec) {
          const yr = Number(s.periodTo);
          const has = (await store.list('letters')).some((l) => l.data.type === 'tb' && l.data.lguId === s.lguId && Number(l.data.year) === yr && (l.data.rows || []).length);
          if (has && !(await confirmBox('Change Trial Balance Used', `A trial balance for CY ${yr} is already entered ${(s.tbMode || 'fund') === 'fund' ? 'per fund' : 'as consolidated'}. It stays saved but is not used while this is set to ${k === 'fund' ? 'Per Fund' : 'Consolidated (All Funds)'}. Change it?`, 'Change'))) return;
        }
        s.tbMode = k;
        $$('[data-tbm]', root).forEach((x) => x.classList.toggle('on', x === b));
        dirty();
      }; });

      async function save() {
        if (!s.lguId) { toast('Choose a Barangay first.', 'bad'); return false; }
        if (Number(s.periodFrom) > Number(s.periodTo)) { toast('Check the period: From is later than To.', 'bad'); return false; }
        if (duplicate()) { toast('This Barangay already has an audit for ' + s.auditYear + '.', 'bad'); return false; }
        if (Number(s.periodTo) >= Number(s.auditYear)) toast('Note: the period ends in the Audit Year itself. Check if that is intended.', 'warn');
        s.teamId = refs.lgu[s.lguId].data.teamId;
        s.officials = s.officials.map((o) => ({ ...o, name: String(o.name || '').trim(), pos: String(o.pos || '').trim() }));
        s.kagawads = s.kagawads.map((k) => ({ ...k, name: String(k.name || '').trim() }));
        const id = rec ? rec.id : newId('audit');
        if (!rec) { s.createdBy = refs.me.id; s.createdAt = new Date().toISOString(); }
        await store.save('audits', id, s);
        await store.log(rec ? 'updated the audit setup' : 'created an audit', `${refs.lgu[s.lguId].data.name} · ${s.auditYear}`, s.teamId, refs.me.email);
        setDirty(false);
        toast(navigator.onLine ? 'Saved.' : 'Saved on this device. It will sync when you are back online.', 'ok');
        if (!rec) { guard.dirty = false; location.hash = `#/audits/${id}/setup`; }
        return true;
      }
      const sv = $('#save', root); if (sv) sv.onclick = save;
      const sg = $('#save-go', root);
      if (sg) sg.onclick = async () => {
        const isNewAudit = !rec;
        if (!(await save())) return;
        const id = isNewAudit ? location.hash.split('/')[2] : rec.id;
        guard.dirty = false; location.hash = `#/audits/${id}/fs`;   // the next step after Setup
      };
      const ul = $('#p-unlock', root);
      if (ul) ul.onclick = async () => {
        const v = await modal({ title: 'Unlock Audit Year and Period',
          body: `<p style="margin:0 0 12px;font-size:14px;line-height:1.5">Changing the Audit Year or the period changes the AOM numbers, the SAOR, the Exit Conference letter, the transmittal letters and the cover of this barangay. Unlock anyway?</p>
            <div class="field"><label class="label" for="ul-r">Reason (kept in the audit log)</label><input class="input" id="ul-r" placeholder="e.g. Period was entered wrongly"></div>`,
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Unlock', cls: 'primary', value: 'ok', check: (bg) => { const r = $('#ul-r', bg).value.trim(); if (!r) { toast('Please give the reason.', 'bad'); return false; } ul.dataset.reason = r; return true; } }] });
        if (v !== 'ok') return;
        await store.log('unlocked the audit year and period', `${refs.lgu[s.lguId]?.data.name || ''} · ${s.auditYear} · Reason: ${ul.dataset.reason}`, s.teamId, refs.me.email);
        $('#ay', root).disabled = false; $('#pf', root).disabled = false; $('#pt', root).disabled = false;
        $('#p-lock', root).innerHTML = '<div class="note info" style="margin:0;display:block">Unlocked. They lock again when you Save.</div>';
        const lp = $('#p-lockpill', root); if (lp) lp.innerHTML = pill('Unlocked', 'warn');
        toast('Unlocked. They lock again when you Save.', 'ok');
      };
      setDirty(false, save);
    }
  };
}
