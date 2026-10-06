// Admin · Users & Roles and Team Assignments
import { store, newId, emitChange } from '../store.js';
import { esc, modal, toast, pill, confirmBox, $, $$ } from '../ui.js';
import { ST } from '../aom.js';
import { ROLE_NAMES, nice, upper, longDate } from '../format.js';
import { CONFIG, DEMO } from '../config.js';

const POSITIONS = ['State Auditor V', 'State Auditor IV', 'State Auditor III', 'State Auditor II', 'State Auditor I', 'State Auditing Examiner II', 'OSA Staff', 'Job Order'];
const PERMS = [
  ['Encode setup, findings, AOM drafts', 1, 1, 1, 0], ['Forward to Audit Team Leader', 1, 0, 0, 0], ['Review, correct, return', 0, 1, 1, 0],
  ['Approve and forward to Supervising Auditor', 0, 1, 0, 0], ['Final approval, lock numbers', 0, 0, 1, 0], ['Reopen a final document', 0, 0, 1, 0],
  ['Print final copies', 1, 1, 1, 0], ['Approve AOM Library updates', 0, 0, 1, 1], ['Manage users and LGU list', 0, 0, 0, 1]
];

export async function users(refs) {
  if (!(refs.me.roles || []).includes('admin')) return { active: '#/users', crumbs: '<b>Users & Roles</b>', body: '<div class="note bad">Only the Admin can open this page.</div>' };
  const list = [...refs.users].sort((a, b) => a.data.name.localeCompare(b.data.name));
  const removedN = list.filter((u) => u.data.status === 'disabled').length;
  const showRemoved = !!users.showRemoved;
  const teamLgus = (tid) => refs.lgus.filter((l) => l.data.kind !== 'barangay' && l.data.teamId === tid).map((l) => l.data.kind === 'province' ? 'Province' : l.data.name);
  const cols = 'grid-template-columns: minmax(170px,1.5fr) minmax(130px,1.1fr) minmax(130px,1fr) 84px 56px';
  const nm = (id) => (refs.user[id] ? nice(refs.user[id].data.name) : '');

  const body = `<div class="page-head"><div><h1>Users &amp; Roles</h1><p>Each person signs in with their own Gmail. Position and designation print on AOMs and reports exactly as entered here.</p></div>
      <button class="btn primary" id="add-user">+ Add User</button></div>
    <div class="split"><div style="display:flex;flex-direction:column;gap:20px;min-width:0">
    <section class="panel"><div class="panel-head"><h2>Users · ${list.length - removedN}</h2>${removedN ? `<label class="switch" style="margin-left:auto" for="u-showrm"><input type="checkbox" id="u-showrm" ${showRemoved ? 'checked' : ''}>Show Removed Users (${removedN})</label>` : ''}</div>
      <div class="t-head" style="${cols}"><span>Name and Gmail</span><span>Position · Designation</span><span>Role · Team</span><span>Status</span><span></span></div>
      ${list.map((u) => { const d = u.data; const rm = d.status === 'disabled'; return `<div class="t-row ${rm ? 'u-removed' : ''}" style="${cols}" ${rm ? `data-removed ${showRemoved ? '' : 'hidden'}` : ''}>
        <span><b>${esc(nice(d.name))}</b><br><small class="mono" style="color:var(--muted)">${esc(d.email)}</small></span>
        <span>${esc(d.position)}${d.designation ? `<br><small style="color:var(--muted)">${esc(d.designation)}</small>` : ''}</span>
        <span style="display:flex;flex-wrap:wrap;gap:4px">${(d.roles || []).map((r) => pill(ROLE_NAMES[r] || r, r === 'admin' ? 'violet' : 'grey')).join('')}<small style="width:100%;color:var(--muted)">${(d.teamIds || []).map((t) => esc(refs.team[t]?.data.name || t)).join(', ')}</small></span>
        <span>${d.status === 'active' ? pill('● Active', 'ok') : d.status === 'disabled' ? pill('Removed', 'bad') : pill('● Invited', 'warn')}${u.pending ? '<br>' + pill('On Device', 'warn') : ''}</span>
        <span><button class="btn sm ghost" data-edit="${u.id}">Edit</button></span></div>`; }).join('')}
    </section>
    <section class="panel"><div class="panel-head"><h2>Team Assignments</h2></div>
      ${refs.teams.sort((a, b) => a.data.name.localeCompare(b.data.name)).map((t) => { const d = t.data; const same = d.atlUserId && d.atlUserId === d.saUserId; return `<div class="t-row" style="grid-template-columns: minmax(180px,1fr) minmax(220px,1.4fr) auto">
        <span><b>${esc(d.name)}</b>${d.officeCode ? ' · ' + esc(d.officeCode) : ''}<br><small style="color:var(--muted)">${esc(teamLgus(t.id).join(', '))}</small></span>
        <span>Audit Team Leader: <b>${esc(nm(d.atlUserId) || 'Not assigned')}</b><br>Supervising Auditor: <b>${same ? 'Same Person' : esc(nm(d.saUserId) || 'Not assigned')}</b><br>
          <small style="color:var(--muted)">${same ? 'One-step review while the same person holds both' : 'Normal two-step review'}</small></span>
        <span><button class="btn sm ghost" data-team="${t.id}">Change Assignment</button></span></div>`; }).join('')}
      <div class="panel-body"><span class="hint">Each change takes an effective date. Documents already issued keep the names of whoever signed them. Items waiting for review move to the new reviewer.</span></div>
    </section></div>
    <div style="display:flex;flex-direction:column;gap:20px">
    <section class="panel"><div class="panel-head"><h2>What Each Role Can Do</h2></div>
      <div class="t-head" style="grid-template-columns: 1fr repeat(4, 44px);padding:10px 14px;font-size:10.5px"><span></span><span>Team Member</span><span>Audit Team Leader</span><span>Super-vising Auditor</span><span>Admin</span></div>
      ${PERMS.map((p) => `<div class="t-row" style="grid-template-columns: 1fr repeat(4, 44px);padding:9px 14px;font-size:13px"><span>${p[0]}</span>${p.slice(1).map((v) => `<span style="text-align:center;color:${v ? 'var(--ok)' : '#B4BEC9'}" aria-label="${v ? 'Yes' : 'No'}">${v ? '✓' : '–'}</span>`).join('')}</div>`).join('')}
    </section>
    <section class="panel"><div class="panel-head"><h2>Good to Know</h2></div><div class="panel-body" style="font-size:13px;line-height:1.5;gap:8px">
      <span>• One person can hold two roles, e.g. Team Member and Admin.</span>
      <span>• Users only see the LGUs assigned to their team. Only the Supervising Auditor and Admin see all teams.</span>
      <span>• <b>Same person as Audit Team Leader and Supervising Auditor</b> (Team 1 for now): their review becomes one step. When the roles are given to two people, the normal two-step review applies again automatically.</span>
      <span>• Removing a user keeps everything they did in the history. Removed users are hidden from the list unless Show Removed Users is on.</span>
      <span>• <b>Replace With…</b> (in Edit User) hands a person's roles, teams and chosen unfinished audits to someone else.</span></div></section>
    ${CONFIG.PRACTICE || DEMO ? `<section class="panel"><div class="panel-head"><h2>Test Data · Practice Copy Only</h2></div><div class="panel-body" style="font-size:13px;line-height:1.5;gap:8px">
      <span>Clears all audit work so testing can start from the beginning: audits, AOMs, trial balances and financial statements, SAOR, exit conference letters, BAARs and their reviews.</span>
      <span>Kept: users and teams, the LGU Master List, the AOM Library, the Chart of Accounts, Flag Rules, the standard wording and the activity log.</span>
      <button class="btn ghost" type="button" id="clear-test">Clear Test Data…</button></div></section>` : ''}
    </div></div>`;

  async function editUser(id) {
    const u = id ? refs.user[id] : null;
    const d = u ? u.data : { email: '', name: '', position: 'State Auditor I', designation: '', roles: ['member'], teamIds: ['team-2'], status: 'invited' };
    const canReplace = u && id !== refs.me.id && d.status !== 'disabled';
    const neverWorked = u && id !== refs.me.id && d.status === 'invited' && !(await hasWork(u));
    let next = null;
    const res = await modal({
      onOpen: (bg) => {
        const go = (what) => { next = what; $('.x', bg).click(); };
        const rp = $('#u-replace', bg); if (rp) rp.onclick = () => go('replace');
        const dl = $('#u-delete', bg); if (dl) dl.onclick = () => go('delete');
      },
      title: u ? 'Edit User' : 'Add User',
      body: `<div class="field"><label class="label" for="u-email">Gmail</label><input class="input mono" id="u-email" type="email" value="${esc(d.email)}" placeholder="name@gmail.com"><span class="hint">The Google account this person signs in with.</span></div>
        <div class="field"><label class="label" for="u-name">Full Name (as printed)</label><input class="input" id="u-name" value="${esc(d.name)}" style="text-transform:uppercase" placeholder="ATTY. JUAN A. DELA CRUZ"></div>
        <div class="field"><label class="label" for="u-nick">Name to Greet (optional)</label><input class="input" id="u-nick" value="${esc(d.nickname || '')}" placeholder="e.g. Cess"><span class="hint">Shown only on the Dashboard greeting.</span></div>
        <div class="grid-2"><div class="field"><label class="label" for="u-pos">Position</label><input class="input" id="u-pos" list="pos-list" value="${esc(d.position)}"><datalist id="pos-list">${POSITIONS.map((p) => `<option>${p}</option>`).join('')}</datalist></div>
        <div class="field"><label class="label" for="u-des">Designation</label><input class="input" id="u-des" value="${esc(d.designation)}" placeholder="e.g. OIC-Audit Team Leader"></div></div>
        <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label">Roles</legend><div class="grid-2">${Object.entries(ROLE_NAMES).map(([k, v]) => `<label class="check"><input type="checkbox" name="role" value="${k}" ${(d.roles || []).includes(k) ? 'checked' : ''}>${v}</label>`).join('')}</div></fieldset>
        <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label">Teams</legend><div class="grid-2">${refs.teams.map((t) => `<label class="check"><input type="checkbox" name="team" value="${t.id}" ${(d.teamIds || []).includes(t.id) ? 'checked' : ''}>${esc(t.data.name)}</label>`).join('')}</div></fieldset>
        ${u ? `<div class="field"><label class="label" for="u-status">Status</label><select class="input" id="u-status">${[['invited', 'Invited (not signed in yet)'], ['active', 'Active'], ['disabled', 'Removed (history kept)']].map(([v, l]) => `<option value="${v}" ${d.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
        ${canReplace ? `<div class="u-sec"><span class="label">Replace This User</span><div class="sv-foot"><span class="hint">When someone takes over this person's work, for example after a transfer.</span><button class="btn ghost" type="button" id="u-replace">Replace With…</button></div></div>` : ''}
        ${neverWorked ? `<div class="u-danger"><span><b>${esc(nice(d.name))}</b> was invited but never signed in, and nothing in the records points to them. Deleting erases them completely.</span><button class="btn u-del" type="button" id="u-delete">Delete User</button></div>` : ''}`,
      buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, {
        label: 'Save', cls: 'primary', value: 'save',
        check: (bg) => {
          const email = $('#u-email', bg).value.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid Gmail address.', 'bad'); return false; }
          if (refs.users.some((x) => x.id !== id && x.data.email.toLowerCase() === email)) { toast('That Gmail is already registered.', 'bad'); return false; }
          if (!$('#u-name', bg).value.trim()) { toast('Enter the full name.', 'bad'); return false; }
          const roles = $$('input[name=role]:checked', bg).map((x) => x.value);
          if (!roles.length) { toast('Choose at least one role.', 'bad'); return false; }
          const status = u ? $('#u-status', bg).value : 'invited';
          if (id === refs.me.id && (!roles.includes('admin') || status === 'disabled')) { toast('You cannot remove your own Admin access.', 'bad'); return false; }
          editUser.out = { email, name: upper($('#u-name', bg).value.trim()), nickname: $('#u-nick', bg).value.trim(), position: $('#u-pos', bg).value.trim(), designation: $('#u-des', bg).value.trim(),
            roles, teamIds: $$('input[name=team]:checked', bg).map((x) => x.value), status };
          return true;
        }
      }]
    });
    if (next === 'replace') return replaceUser(id);
    if (next === 'delete') return deleteUser(id);
    if (res !== 'save') return;
    await store.save('users', id || newId('user'), editUser.out);
    await store.log(id ? 'edited a user' : 'added a user', nice(editUser.out.name), '', refs.me.email);
    toast(id ? 'User saved.' : 'User added. They can sign in with that Gmail once synced.', 'ok');
  }


  // Does anything in the records point to this person? Then their name must stay, and they cannot be deleted.
  async function hasWork(u) {
    const id = u.id, email = String(u.data.email || '').toLowerCase();
    if (refs.teams.some((t) => t.data.atlUserId === id || t.data.saUserId === id)) return true;
    if ((await store.list('auditlog')).some((l) => String(l.data.by || '').toLowerCase() === email)) return true;
    for (const table of ['audits', 'aoms', 'letters', 'aom_library']) {
      if ((await store.list(table, { withDeleted: true })).some((r) => { const j = JSON.stringify(r.data).toLowerCase(); return j.includes('"' + id.toLowerCase() + '"') || j.includes(email); })) return true;
    }
    return false;
  }
  async function deleteUser(id) {
    const u = refs.user[id];
    if (!(await confirmBox('Delete User', `Delete ${esc(nice(u.data.name))} (${esc(u.data.email)}) completely? This cannot be undone. Add them again later if needed.`, 'Delete', 'danger'))) return;
    if (await hasWork(u)) { toast('This user now has work on record, so they cannot be deleted. Set Status to Removed instead.', 'bad'); return; }
    await store.save('users', id, u.data, { deleted: true });
    await store.log('deleted a user who never signed in', `${nice(u.data.name)} · ${u.data.email}`, '', refs.me.email);
    toast('User deleted.', 'ok');
  }
  // Replace With…: the new person takes the roles, teams and team assignments; the chosen unfinished audits move to them.
  async function replaceUser(oldId) {
    const old = refs.user[oldId];
    const cands = refs.users.filter((x) => x.id !== oldId && x.data.status !== 'disabled').sort((a, b) => a.data.name.localeCompare(b.data.name));
    const audits = (await store.list('audits')).filter((a) => a.data.memberId === oldId && !a.data.imported && a.data.status !== 'Final' && a.data.stage !== 'Final');
    const aoms = await store.list('aoms');
    const finalsOf = (aid) => aoms.filter((a) => a.data.auditId === aid && a.data.status === ST.FINAL).length;
    const draftsOf = (aid) => aoms.filter((a) => a.data.auditId === aid && [ST.DRAFT, ST.RETURNED].includes(a.data.status || ST.DRAFT)).length;
    const oldName = nice(old.data.name), first = oldName.replace(/^(Atty|Engr|Dr)\.?\s+/i, '').split(' ')[0];
    let pick = '', oo = '', move = [];
    const r = await modal({ title: `Replace ${oldName}`, wide: true,
      body: `<div class="grid-2"><div class="field"><label class="label" for="rp-new">Replaced by</label><select class="input" id="rp-new"><option value="">Choose…</option>${cands.map((x) => `<option value="${x.id}">${esc(nice(x.data.name))}${x.data.position ? ' · ' + esc(x.data.position) : ''}</option>`).join('')}</select></div>
          <div class="field"><label class="label" for="rp-oo">Office Order No. (optional)</label><input class="input" id="rp-oo"></div></div>
        <div class="field"><span class="label">Roles and Teams</span><span style="font-size:13.5px">The new person gets ${esc(first)}'s roles and teams: <b>${esc((old.data.roles || []).map((x) => ROLE_NAMES[x] || x).join(', '))}</b> · <b>${esc((old.data.teamIds || []).map((t) => refs.team[t]?.data.name || t).join(', ') || 'No team')}</b>${refs.teams.some((t) => t.data.atlUserId === oldId || t.data.saUserId === oldId) ? `, and ${esc(first)}'s place as ${esc(refs.teams.filter((t) => t.data.atlUserId === oldId || t.data.saUserId === oldId).map((t) => (t.data.atlUserId === oldId && t.data.saUserId === oldId ? 'ATL and SA' : t.data.atlUserId === oldId ? 'ATL' : 'SA') + ' of ' + t.data.name).join(', '))}` : ''}.</span></div>
        <div class="field"><span class="label">Unfinished Audits · tick the ones that move to the new person</span>
          ${audits.length ? `<div class="u-move">${audits.sort((a, b) => (refs.lgu[a.data.lguId]?.data.name || '').localeCompare(refs.lgu[b.data.lguId]?.data.name || '')).map((a) => { const f = finalsOf(a.id), dr = draftsOf(a.id);
            return `<label for="rp-${a.id}"><input type="checkbox" id="rp-${a.id}" value="${a.id}" ${f ? '' : 'checked'}><span><b>${esc(refs.lgu[a.data.lguId]?.data.name || '?')}</b> · Audit Year ${esc(a.data.auditYear)}<small>${f ? `${f} AOM${f > 1 ? 's' : ''} approved as Final${dr ? ` · ${dr} draft${dr > 1 ? 's' : ''}` : ''}` : dr ? `${dr} AOM draft${dr > 1 ? 's' : ''} · no AOM approved yet` : 'No AOM approved yet'}</small></span>${f ? `<span class="pill warn">Started by ${esc(first)}</span>` : '<span class="pill grey">In Progress</span>'}</label>`; }).join('')}</div>
          <span class="hint">Nothing moves unless it is ticked. An audit ${esc(first)} already started (approved AOMs) stays with ${esc(first)} unless the office order says otherwise.</span>` : `<span class="hint">${esc(first)} has no unfinished audits.</span>`}</div>
        <div class="note info" style="display:block;line-height:1.5"><b>Stays with ${esc(first)}:</b> Final AOMs, approvals, review trails, Final BAARs and the activity log. ${esc(first)} is set to Removed (history kept) and can no longer sign in.</div>`,
      buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Replace', cls: 'primary', value: 'ok', check: (bg) => {
        pick = $('#rp-new', bg).value; oo = $('#rp-oo', bg).value.trim(); move = $$('.u-move input:checked', bg).map((x) => x.value);
        if (!pick) toast('Choose who replaces this user.', 'warn'); return !!pick; } }] });
    if (r !== 'ok') return;
    const nu = refs.user[pick];
    const roles = [...new Set([...(nu.data.roles || []), ...(old.data.roles || []).filter((x) => x !== 'admin' || (nu.data.roles || []).includes('admin'))])];
    const teamIds = [...new Set([...(nu.data.teamIds || []), ...(old.data.teamIds || [])])];
    await store.save('users', pick, { ...nu.data, roles, teamIds }, { silent: true });
    const today = new Date().toISOString().slice(0, 10);
    for (const t of refs.teams.filter((x) => x.data.atlUserId === oldId || x.data.saUserId === oldId)) {
      const atl = t.data.atlUserId === oldId ? pick : t.data.atlUserId, sa = t.data.saUserId === oldId ? pick : t.data.saUserId;
      await store.save('teams', t.id, { ...t.data, atlUserId: atl, saUserId: sa, history: [...(t.data.history || []), { atlUserId: atl, saUserId: sa, from: today, changedAt: new Date().toISOString(), by: refs.me.email }] }, { silent: true });
    }
    for (const aid of move) {
      const a = await store.get('audits', aid);
      await store.save('audits', aid, { ...a.data, memberId: pick }, { silent: true });
      for (const x of aoms.filter((y) => y.data.auditId === aid && y.data.memberId === oldId && [ST.DRAFT, ST.RETURNED].includes(y.data.status || ST.DRAFT))) await store.save('aoms', x.id, { ...x.data, memberId: pick }, { silent: true });
    }
    await store.save('users', oldId, { ...old.data, status: 'disabled', replacedBy: pick, replacedAt: new Date().toISOString() }, { silent: true });
    await store.log('replaced a user', `${oldName} → ${nice(nu.data.name)}${oo ? ' · Office Order No. ' + oo : ''}${move.length ? ` · ${move.length} unfinished audit${move.length > 1 ? 's' : ''} moved` : ''}`, '', refs.me.email);
    toast(`${oldName} is replaced by ${nice(nu.data.name)}.`, 'ok');
    emitChange('local');
  }

  async function editTeam(tid) {
    const t = refs.team[tid];
    const pick = (role, sel) => refs.users.filter((u) => (u.data.roles || []).includes(role) && u.data.status !== 'disabled')
      .map((u) => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(nice(u.data.name))}</option>`).join('');
    const hist = (t.data.history || []).slice().reverse();
    const res = await modal({
      title: 'Change Assignment · ' + t.data.name,
      body: `<div class="field"><label class="label" for="t-code">Office Code</label><input class="input" id="t-code" value="${esc(t.data.officeCode)}" placeholder="e.g. R2-02"><span class="hint">Prints as "Office of the Auditor – Audit Team R2-02".</span></div>
        <div class="grid-2"><div class="field"><label class="label" for="t-atl">Audit Team Leader</label><select class="input" id="t-atl"><option value="">Not assigned</option>${pick('atl', t.data.atlUserId)}${pick('sa', t.data.atlUserId)}</select></div>
        <div class="field"><label class="label" for="t-sa">Supervising Auditor</label><select class="input" id="t-sa"><option value="">Not assigned</option>${pick('sa', t.data.saUserId)}</select></div></div>
        <div class="field"><label class="label" for="t-date">Effective Date</label><input class="input" type="date" id="t-date" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="note info">If the same person is both, their review is one step. Documents already issued keep their signers.</div>
        ${hist.length ? `<div class="field"><span class="label">History</span>${hist.map((h) => `<small>${esc(longDate(h.from))}: ATL ${esc(nice(refs.user[h.atlUserId]?.data.name || '–'))} · SA ${esc(nice(refs.user[h.saUserId]?.data.name || '–'))}</small>`).join('')}</div>` : ''}`,
      buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, {
        label: 'Save Assignment', cls: 'primary', value: 'save',
        check: (bg) => {
          editTeam.vals = { code: $('#t-code', bg).value.trim(), atl: $('#t-atl', bg).value, sa: $('#t-sa', bg).value, date: $('#t-date', bg).value };
          if (!editTeam.vals.date) { toast('Enter the effective date.', 'bad'); return false; }
          return true;
        }
      }]
    });
    if (res !== 'save') return;
    const d = { ...t.data, officeCode: editTeam.vals.code, atlUserId: editTeam.vals.atl, saUserId: editTeam.vals.sa,
      history: [...(t.data.history || []), { atlUserId: editTeam.vals.atl, saUserId: editTeam.vals.sa, from: editTeam.vals.date, changedAt: new Date().toISOString(), by: refs.me.email }] };
    await store.save('teams', tid, d);
    await store.log('changed a team assignment', t.data.name, '', refs.me.email);
    toast('Assignment saved.', 'ok');
  }

  return {
    active: '#/users', crumbs: '<b>Users &amp; Roles</b>', body,
    mount(root) {
      $('#add-user', root).onclick = () => editUser(null);
      const sw = $('#u-showrm', root);
      if (sw) sw.onchange = () => { users.showRemoved = sw.checked; $$('[data-removed]', root).forEach((r) => { r.hidden = !sw.checked; }); };
      $$('[data-edit]', root).forEach((b) => { b.onclick = () => editUser(b.dataset.edit); });
      $$('[data-team]', root).forEach((b) => { b.onclick = () => editTeam(b.dataset.team); });
      const ct = $('#clear-test', root); if (ct) ct.onclick = () => clearTestData(refs);
    }
  };
}

/* ── Clear Test Data (Admin) ── */
// Audit work only; reference lists, the AOM Library and saved standards stay. Marked deleted, so every device drops them on sync.
const AUDIT_LETTERS = ['baar', 'baar-review-part', 'fs', 'tb', 'saor', 'saor-review', 'exit', 'raomap'];
async function clearTestData(refs) {
  if (!(CONFIG.PRACTICE || DEMO)) return;   // never on the live copy
  const audits = await store.list('audits'), aoms = await store.list('aoms');
  const letters = (await store.list('letters')).filter((l) => AUDIT_LETTERS.includes(l.data.type));
  const total = audits.length + aoms.length + letters.length;
  if (!total) { toast('There is no audit data to clear.', 'ok'); return; }
  const r = await modal({ title: 'Clear Test Data',
    body: `<p style="margin:0 0 10px;line-height:1.5">This clears <b>${audits.length} audit${audits.length === 1 ? '' : 's'}</b>, <b>${aoms.length} AOM${aoms.length === 1 ? '' : 's'}</b> and <b>${letters.length}</b> trial balance, SAOR, exit conference and BAAR record${letters.length === 1 ? '' : 's'}, on every device.</p>
      <p style="margin:0 0 10px;line-height:1.5">Users, teams, the LGU Master List, the AOM Library, the Chart of Accounts, Flag Rules, the standard wording and the activity log are kept.</p>
      <div class="field"><label class="label" for="ct-type">Type CLEAR to confirm</label><input class="input" id="ct-type" autocomplete="off"></div>`,
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Clear Test Data', cls: 'primary', value: 'ok', check: (bg) => { const ok = $('#ct-type', bg).value.trim().toUpperCase() === 'CLEAR'; if (!ok) toast('Type CLEAR to confirm.', 'warn'); return ok; } }] });
  if (r !== 'ok') return;
  toast('Clearing…');
  for (const x of letters) await store.save('letters', x.id, x.data, { deleted: true, silent: true });
  for (const x of aoms) await store.save('aoms', x.id, x.data, { deleted: true, silent: true });
  for (const x of audits) await store.save('audits', x.id, x.data, { deleted: true, silent: true });
  await store.log('cleared the test data', `${audits.length} audits · ${aoms.length} AOMs · ${letters.length} records`, '', refs.me.email);
  toast('Test data cleared. It syncs to the server and the other devices now.', 'ok');
  emitChange('local');
}
