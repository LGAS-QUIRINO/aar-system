// Exit Conference: invitation letters to the ABC President (Barangay audits), one letter per session.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, guard, confirmBox, pill, $, $$ } from '../ui.js';
import { has, myTeamIds } from '../refs.js';
import { ST, clone } from '../aom.js';
import { longDate, nice } from '../format.js';
import { EXIT_STANDARD, WORDING_KEYS, buildExitLetter, exitBodyHTML, ccHTML, printExit, exitWord, weekday } from '../exitletter.js';

const stdId = (teamId) => `std-exit-${teamId}`;

export async function exitconf(refs, params, q) {
  const me = refs.me;
  const teams = myTeamIds(me, refs.teams);
  const audits = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported);
  const aoms = await store.list('aoms');
  const letters = (await store.list('letters')).filter((l) => l.data.type === 'exit');
  const munOf = (a) => refs.lgu[a.data.lguId]?.data.parentId;
  const munIds = [...new Set(audits.map(munOf).filter(Boolean))].sort((x, y) => (refs.lgu[x]?.data.name || '').localeCompare(refs.lgu[y]?.data.name || ''));
  const crumbs = '<b>Exit Conference</b>';
  if (!munIds.length) return { active: '#/exit', crumbs, body: '<div class="page-head"><div><h1>Exit Conference</h1></div></div><section class="panel"><div class="empty">No audits yet. Start an audit from My Audit first.</div></section>' };

  const munId = munIds.includes(q.get('m')) ? q.get('m') : munIds[0];
  const mun = refs.lgu[munId].data;
  const years = [...new Set(audits.filter((a) => munOf(a) === munId).map((a) => Number(a.data.auditYear)))].sort((a, b) => b - a);
  const year = years.includes(Number(q.get('y'))) ? Number(q.get('y')) : years[0];
  const list = audits.filter((a) => munOf(a) === munId && Number(a.data.auditYear) === year)
    .sort((a, b) => (refs.lgu[a.data.lguId]?.data.name || '').localeCompare(refs.lgu[b.data.lguId]?.data.name || ''));
  const teamId = list[0]?.data.teamId || teams[0];
  const team = refs.team[teamId]?.data || {};
  const userOf = (id) => (refs.user[id] ? { id, ...refs.user[id].data } : null);
  const atl = userOf(team.atlUserId), sa = userOf(team.saUserId);
  const mine = letters.filter((l) => l.data.munId === munId && Number(l.data.auditYear) === year).sort((a, b) => a.data.n - b.data.n);
  const cur = mine.find((l) => l.id === q.get('l')) || mine[0] || null;
  const stdRec = await store.get('letters', stdId(teamId));
  const standard = { ...EXIT_STANDARD, ...(stdRec && !stdRec.deleted ? stdRec.data.wording || {} : {}) };
  const canStd = has(me, 'sa') || has(me, 'admin');
  const go = (o = {}) => `#/exit?m=${encodeURIComponent(o.m || munId)}&y=${o.y || year}${o.l ? '&l=' + encodeURIComponent(o.l) : ''}`;

  // How far each barangay's AOMs are, and which letter it is already in.
  const status = (a) => {
    const xs = aoms.filter((x) => x.data.auditId === a.id);
    const fin = xs.filter((x) => x.data.status === ST.FINAL).length;
    return { total: xs.length, fin, allFinal: xs.length > 0 && fin === xs.length };
  };
  const inLetter = (auditId, exceptId) => mine.find((l) => l.id !== exceptId && (l.data.auditIds || []).includes(auditId));
  const brgyName = (a) => refs.lgu[a.data.lguId]?.data.name || '?';

  const tabs = `<div class="xtabs" role="tablist" aria-label="Letters">${mine.map((l) => `<a class="xtab ${cur && l.id === cur.id ? 'on' : ''}" role="tab" aria-selected="${cur && l.id === cur.id}" href="${go({ l: l.id })}">
      <b>Letter ${l.data.n}</b><small>${l.data.confDate ? esc(weekday(l.data.confDate) + ', ' + longDate(l.data.confDate).replace(/, \d{4}$/, '')) : 'No date yet'} · ${(l.data.auditIds || []).length} barangay${(l.data.auditIds || []).length === 1 ? '' : 's'}</small></a>`).join('')}
    <button class="xtab add" id="x-new" type="button">+ New Letter</button></div>`;

  const L = cur ? { ...clone(cur.data) } : null;
  if (L) WORDING_KEYS.forEach((k) => { if (L[k] === undefined) L[k] = standard[k]; });

  const form = L ? `
    <section class="panel"><div class="panel-head"><h2>Barangays in This Letter</h2><span class="pill violet" id="x-count" style="margin-left:auto"></span></div>
      <div class="panel-body" style="padding-top:6px;padding-bottom:6px"><div class="xbrgy">${list.map((a) => {
        const s = status(a), other = inLetter(a.id, cur.id);
        const tag = other ? pill('In Letter ' + other.data.n, 'grey') : s.allFinal ? pill('All AOMs Final', 'ok') : s.total ? pill(`${s.fin} of ${s.total} Final`, 'warn') : pill('No AOMs yet', 'grey');
        const on = (L.auditIds || []).includes(a.id);
        return `<label class="${on ? '' : 'dim'}"><input type="checkbox" name="x-b" value="${a.id}" ${on ? 'checked' : ''}><span>${esc(brgyName(a))} <small class="hint">${esc(a.data.periodFrom === a.data.periodTo ? String(a.data.periodTo) : a.data.periodFrom + ' to ' + a.data.periodTo)}</small></span>${tag}</label>`;
      }).join('') || '<div class="empty">No audits for this year.</div>'}</div>
      <span class="hint">Barangays with all AOMs Final are ticked when a letter is made. Untick any, or tick others. More than 10 go into two columns.</span></div></section>
    <section class="panel"><div class="panel-head"><h2>Dates and Venue</h2></div><div class="panel-body">
      <div class="grid-2">
        <div class="field"><label class="label" for="x-ld">Letter Date</label><input class="input" type="date" id="x-ld" value="${esc(L.letterDate || '')}"><span class="hint">Any date. Past dates are allowed.</span></div>
        <div class="field"><label class="label" for="x-cd">Exit Conference Date</label><input class="input" type="date" id="x-cd" value="${esc(L.confDate || '')}"><span class="hint" id="x-day" style="color:var(--ok-ink);font-weight:600"></span></div>
        <div class="field"><label class="label" for="x-t">Time</label><input class="input" id="x-t" value="${esc(L.time || '')}" placeholder="e.g. 10:00 in the morning"></div>
        <div class="field"><label class="label" for="x-v">Venue</label><input class="input" id="x-v" value="${esc(L.venue || '')}" placeholder="e.g. LDRRMO Function Hall, ${esc(mun.name)}, Quirino"></div>
      </div><div id="x-datewarn"></div></div></section>
    <section class="panel"><div class="panel-head"><h2>Addressed To</h2>${has(me, 'admin') ? `<a class="btn sm ghost" style="margin-left:auto" href="#/lgus?m=${encodeURIComponent(munId)}">Edit in LGU Master List</a>` : ''}</div><div class="panel-body">
      <div class="grid-2">
        <div class="field"><label class="label" for="x-an">Name</label><input class="input" id="x-an" value="${esc(L.addrName || '')}" placeholder="e.g. Hon. Juan A. Dela Cruz"></div>
        <div class="field"><label class="label" for="x-ap">Position</label><input class="input" id="x-ap" value="${esc(L.addrPos || 'ABC President')}"></div>
        <div class="field"><label class="label" for="x-sal">Salutation</label><select class="input" id="x-sal"><option ${L.salutation !== 'Dear Madam:' ? 'selected' : ''}>Dear Sir:</option><option ${L.salutation === 'Dear Madam:' ? 'selected' : ''}>Dear Madam:</option></select></div>
      </div><span class="hint">Filled from ${esc(mun.name)} in the LGU Master List when the letter is made. A change here applies to this letter only.</span></div></section>
    <section class="panel"><div class="panel-head"><h2>Wording</h2><span class="btn-row" style="margin-left:auto">${canStd ? '<button class="btn sm ghost" id="x-std" type="button">Save as Standard</button>' : ''}<button class="btn sm ghost" id="x-reset" type="button">Reset to Standard</button></span></div><div class="panel-body">
      <div class="field"><label class="label" for="x-p1">Opening</label><textarea class="input be-text" id="x-p1" rows="3">${esc(L.p1)}</textarea></div>
      <div class="field"><label class="label" for="x-p2">Request</label><textarea class="input be-text" id="x-p2" rows="4">${esc(L.p2)}</textarea></div>
      <div class="field"><label class="label" for="x-p3">Attendees</label><textarea class="input be-text" id="x-p3" rows="3">${esc(L.p3)}</textarea></div>
      <div class="field"><label class="label" for="x-cc">Cc (one per line)</label><textarea class="input be-text" id="x-cc" rows="2">${esc(L.cc)}</textarea></div>
      <span class="hint">These fill in by themselves: <b>[PERIOD]</b> the calendar years (left out when the barangays have different periods, which are then shown as groups), <b>[CONF_DATE]</b> the day and date, <b>[TIME]</b> and <b>[VENUE]</b>.
        Signatories are the same as on the AOM, with spaces left blank for wet signatures.</span>
    </div></section>
    <div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
      <div class="btn-row" style="margin-left:auto"><button class="btn ghost" id="x-del" type="button">Delete Letter</button><button class="btn primary" id="x-save" type="button">Save</button></div></div>` : '';

  const body = `<div class="page-head"><div><h1>Exit Conference · ${esc(mun.name)}</h1></div>
      <div class="btn-row"><label class="sr-only" for="x-m">Municipality</label><select class="input" id="x-m" style="width:170px">${munIds.map((id) => `<option value="${id}" ${id === munId ? 'selected' : ''}>${esc(refs.lgu[id]?.data.name || id)}</option>`).join('')}</select>
        <label class="sr-only" for="x-y">Audit Year</label><select class="input" id="x-y" style="width:170px">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>Audit Year ${y}</option>`).join('')}</select></div></div>
    <section class="panel" style="padding:12px">${tabs}</section>
    ${cur ? `<div class="xcols"><div class="xform">${form}</div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="x-print" type="button">Print</button><button class="btn sm primary" id="x-word" type="button">Word</button></span></div>
        <div id="x-pagewarn"></div>
        <div class="paper-wrap big"><div class="sheet xsheet"><div class="aom-doc xl" id="x-doc"></div><div class="aom-doc xl xcc" id="x-cc-prev"></div></div></div></div></div>`
      : '<section class="panel"><div class="empty">No letter yet for this year. Click <b>+ New Letter</b>.</div></section>'}`;

  return {
    active: '#/exit', crumbs, body,
    mount(root) {
      $('#x-m', root).onchange = (e) => { location.hash = `#/exit?m=${encodeURIComponent(e.target.value)}`; };
      $('#x-y', root).onchange = (e) => { location.hash = go({ y: e.target.value }); };
      $('#x-new', root).onclick = async () => {
        if (guard.dirty && !(await guard.save())) return;
        const n = Math.max(0, ...mine.map((l) => l.data.n)) + 1;
        const id = `exit-${munId}-${year}-${n}-${Date.now().toString(36)}`;
        const auditIds = list.filter((a) => status(a).allFinal && !inLetter(a.id)).map((a) => a.id);
        await store.save('letters', id, { type: 'exit', teamId, munId, auditYear: year, n, auditIds, letterDate: '', confDate: '', time: '10:00 in the morning', venue: '',
          addrName: mun.abcPresident || '', addrPos: 'ABC President', salutation: mun.abcSalutation || 'Dear Sir:', ...Object.fromEntries(WORDING_KEYS.map((k) => [k, standard[k]])), createdBy: me.email, createdAt: new Date().toISOString() }, { silent: true });
        await store.log('made an exit conference letter', `${mun.name} · Letter ${n}`, teamId, me.email);
        setDirty(false); location.hash = go({ l: id });
      };
      if (!cur) return;
      const v = (id) => $(id, root).value;
      const collect = () => {
        const d = { ...L, auditIds: $$('input[name=x-b]:checked', root).map((x) => x.value), letterDate: v('#x-ld'), confDate: v('#x-cd'), time: v('#x-t').trim(), venue: v('#x-v').trim(),
          addrName: v('#x-an').trim(), addrPos: v('#x-ap').trim(), salutation: v('#x-sal'), p1: v('#x-p1'), p2: v('#x-p2'), p3: v('#x-p3'), cc: v('#x-cc') };
        return d;
      };
      const docOf = (d) => buildExitLetter({ letter: d, brgys: list.filter((a) => d.auditIds.includes(a.id)).map((a) => ({ name: brgyName(a), from: a.data.periodFrom, to: a.data.periodTo })), mun, team, atl, sa });
      const draw = () => {
        const d = collect(), doc = docOf(d);
        $('#x-doc', root).innerHTML = exitBodyHTML(doc);
        $('#x-cc-prev', root).innerHTML = ccHTML(doc);
        $('#x-count', root).textContent = `${d.auditIds.length} ticked`;
        $$('input[name=x-b]', root).forEach((c) => c.closest('label').classList.toggle('dim', !c.checked));
        $('#x-day', root).textContent = d.confDate ? weekday(d.confDate) : '';
        $('#x-datewarn', root).innerHTML = d.letterDate && d.confDate && d.confDate < d.letterDate ? '<div class="note warn">The Exit Conference date is earlier than the letter date. Please check the dates.</div>' : '';
        // Long bond 13" less 1" top and 1.34" bottom margins leaves 10.66" for the letter text.
        requestAnimationFrame(() => {
          const el = $('#x-doc', root), sheet = root.querySelector('.xsheet'); if (!el || !sheet) return;
          const over = el.offsetHeight > sheet.clientHeight * (10.66 / 13);
          $('#x-pagewarn', root).innerHTML = over ? '<div class="note warn">This letter runs to 2 pages. Shorten the wording, or move some barangays to another letter.</div>' : '';
        });
        const none = d.auditIds.length === 0;
        $('#x-print', root).disabled = $('#x-word', root).disabled = none;
      };
      async function save() {
        const d = collect();
        await store.save('letters', cur.id, d, { silent: true });
        cur.data = clone(d); Object.assign(L, d);
        await store.log('saved an exit conference letter', `${mun.name} · Letter ${d.n}`, teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      const changed = () => { setDirty(true, save); draw(); };
      root.querySelector('.xform').addEventListener('input', changed);
      root.querySelector('.xform').addEventListener('change', changed);
      $('#x-save', root).onclick = save;
      $('#x-reset', root).onclick = () => {
        $('#x-p1', root).value = standard.p1; $('#x-p2', root).value = standard.p2; $('#x-p3', root).value = standard.p3; $('#x-cc', root).value = standard.cc;
        changed(); toast('Standard wording put back. Click Save to keep it.', 'ok');
      };
      const std = $('#x-std', root);
      if (std) std.onclick = async () => {
        if (!(await confirmBox('Save as Standard', 'Use this wording and these Cc lines for every new letter from now on? Letters already made are not changed.', 'Save as Standard', 'success'))) return;
        const d = collect();
        const wording = Object.fromEntries(WORDING_KEYS.map((k) => [k, d[k]]));
        await store.save('letters', stdId(teamId), { type: 'standard', kind: 'exit', teamId, wording, savedBy: me.email, savedAt: new Date().toISOString() }, { silent: true });
        await store.log('saved the standard exit conference wording', mun.name, teamId, me.email);
        Object.assign(standard, wording);
        toast('Saved as the standard wording for new letters.', 'ok');
      };
      $('#x-del', root).onclick = async () => {
        if (!(await confirmBox('Delete Letter', `Delete Letter ${cur.data.n}? Its barangays become free for another letter.`, 'Delete'))) return;
        await store.save('letters', cur.id, cur.data, { deleted: true, silent: true });
        await store.log('deleted an exit conference letter', `${mun.name} · Letter ${cur.data.n}`, teamId, me.email);
        setDirty(false); location.hash = go();
      };
      $('#x-print', root).onclick = async () => {
        const d = collect(); printExit(docOf(d), `Exit Conference Letter ${d.n} · ${mun.name}`);
        await store.log('printed an exit conference letter', `${mun.name} · Letter ${d.n}`, teamId, me.email);
      };
      $('#x-word', root).onclick = async () => {
        const d = collect();
        try { toast('Preparing the Word file…'); await exitWord(docOf(d)); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded an exit conference letter (Word)', `${mun.name} · Letter ${d.n}`, teamId, me.email);
      };
      draw();
      setDirty(false, save);
      void nice;
    }
  };
}

