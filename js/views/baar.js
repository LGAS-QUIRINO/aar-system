// BAAR Reports: the list of Barangay BAARs, and each BAAR's parts (01 to 10), built in order.
// Part 01 · Transmittal Letters can be printed as soon as its own details are filled in, before the rest of the BAAR is done.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, confirmBox, pill, $, $$ } from '../ui.js';
import { has, myTeamIds } from '../refs.js';
import { loadAudit, stepsBar } from '../auditctx.js';
import { ST, clone } from '../aom.js';
import { periodPhrase, longDate, nice } from '../format.js';
import { TR_STANDARD, TR_KEYS, OPINIONS, OPINION_STANDARD, periodEnded, pbSalutation, punongBarangay, buildTransmittal, docHTML, paginate, printTransmittal, transmittalWord } from '../baar-transmittal.js';

export const PARTS = [
  ['01', 'Transmittal Letters'], ['02', 'Cover'], ['03', 'Table of Contents'], ['04', "Independent Auditor's Report"], ['05', "Management's Responsibility"],
  ['06', 'Audited FS'], ['07', 'Notes to FS'], ['08', 'Part II'], ['09', 'Part III'], ['10', 'Part IV Annexes']
];
const recId = (auditId) => `baar-${auditId}`;
const stdId = (teamId) => `std-baartr-${teamId}`;

// What Part 01 still needs before it is ready to print.
export function trMissing(b) {
  const t = (b && b.tr) || {}, op = b && b.opinion, s = (t.opSent && t.opSent[op]) || {};
  const miss = [];
  if (!op) miss.push('opinion');
  else if (!(s.sa || '').trim() || !(s.atl || '').trim()) miss.push('opinion sentence');
  if (!t.confDate) miss.push('exit conference date');
  if (!t.atlDate || !t.saDate) miss.push('letter dates');
  if (!(t.pbName || '').trim()) miss.push('Punong Barangay');
  return miss;
}

/* ── BAAR Reports list ── */
export async function baarList(refs, params, q) {
  const me = refs.me;
  const teams = myTeamIds(me, refs.teams);
  const audits = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported);
  const munOf = (a) => refs.lgu[a.data.lguId]?.data.parentId;
  const munIds = [...new Set(audits.map(munOf).filter(Boolean))].sort((x, y) => (refs.lgu[x]?.data.name || '').localeCompare(refs.lgu[y]?.data.name || ''));
  const crumbs = '<b>BAAR Reports</b>';
  if (!munIds.length) return { active: '#/baar', crumbs, body: '<div class="page-head"><div><h1>BAAR Reports</h1></div></div><section class="panel"><div class="empty">No audits yet. Start an audit from My Audit first.</div></section>' };
  const munId = munIds.includes(q.get('m')) ? q.get('m') : munIds[0];
  const years = [...new Set(audits.filter((a) => munOf(a) === munId).map((a) => Number(a.data.auditYear)))].sort((a, b) => b - a);
  const year = years.includes(Number(q.get('y'))) ? Number(q.get('y')) : years[0];
  const list = audits.filter((a) => munOf(a) === munId && Number(a.data.auditYear) === year)
    .sort((a, b) => (refs.lgu[a.data.lguId]?.data.name || '').localeCompare(refs.lgu[b.data.lguId]?.data.name || ''));
  const aoms = await store.list('aoms');
  const recs = Object.fromEntries((await store.list('letters')).filter((l) => l.data.type === 'baar').map((l) => [l.data.auditId, l.data]));
  const cols = 'grid-template-columns: minmax(150px,1.3fr) minmax(170px,1.3fr) minmax(120px,1fr) minmax(140px,1fr) 90px';
  const rows = list.map((a) => {
    const xs = aoms.filter((x) => x.data.auditId === a.id), fin = xs.filter((x) => x.data.status === ST.FINAL).length;
    const miss = trMissing(recs[a.id]);
    const p01 = !recs[a.id] ? pill('Not Started', 'grey') : miss.length ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok');
    return `<div class="t-row click" style="${cols}" data-go="#/baar/${a.id}" tabindex="0" role="link"><span><b>${esc(refs.lgu[a.data.lguId]?.data.name || '?')}</b></span>
      <span>${esc(periodPhrase(a.data.periodFrom, a.data.periodTo))}</span>
      <span>${xs.length ? `${fin} of ${xs.length} Final` : '<span class="hint">No AOMs yet</span>'}</span><span>${p01}</span>
      <span style="text-align:right"><a class="btn sm" href="#/baar/${a.id}">Open</a></span></div>`;
  }).join('');
  const body = `<div class="page-head"><div><h1>BAAR Reports</h1><p>One BAAR per barangay, built part by part in order. Click a barangay to open its BAAR.</p></div>
      <div class="btn-row"><label class="sr-only" for="b-m">Municipality</label><select class="input" id="b-m" style="width:170px">${munIds.map((id) => `<option value="${id}" ${id === munId ? 'selected' : ''}>${esc(refs.lgu[id]?.data.name || id)}</option>`).join('')}</select>
        <label class="sr-only" for="b-y">Audit Year</label><select class="input" id="b-y" style="width:170px">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>Audit Year ${y}</option>`).join('')}</select></div></div>
    <section class="panel"><div class="t-head" style="${cols}"><span>Barangay</span><span>Period</span><span>AOMs</span><span>01 · Transmittal</span><span></span></div>
      ${rows || '<div class="empty">No audits for this year.</div>'}</section>`;
  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      $('#b-m', root).onchange = (e) => { location.hash = `#/baar?m=${encodeURIComponent(e.target.value)}`; };
      $('#b-y', root).onchange = (e) => { location.hash = `#/baar?m=${encodeURIComponent(munId)}&y=${e.target.value}`; };
    }
  };
}

/* ── One BAAR · Part 01 Transmittal Letters ── */
export async function baar(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/baar', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found.</div>' };
  const me = refs.me;
  const { audit, lgu, mun, team, atl, sa } = ctx;
  const canEdit = myTeamIds(me, refs.teams).includes(ctx.teamId);
  const canStd = has(me, 'sa') || has(me, 'admin');
  const rec = await store.get('letters', recId(ctx.rec.id));
  const stdRec = await store.get('letters', stdId(ctx.teamId));
  const std = stdRec && !stdRec.deleted ? stdRec.data : {};
  const standard = { ...TR_STANDARD, ...(std.wording || {}) };
  const stdOp = Object.fromEntries(OPINIONS.map((o) => [o, { ...OPINION_STANDARD[o], ...((std.opSent || {})[o] || {}) }]));
  // The exit conference date from the Exit Conference letter that lists this barangay.
  const exitL = (await store.list('letters')).find((l) => l.data.type === 'exit' && (l.data.auditIds || []).includes(ctx.rec.id) && l.data.confDate);
  const pb = punongBarangay(audit);
  const B = rec && !rec.deleted ? clone(rec.data) : { type: 'baar', auditId: ctx.rec.id, teamId: ctx.teamId, opinion: '', tr: {} };
  const T = B.tr = B.tr || {};
  TR_KEYS.forEach((k) => { if (T[k] === undefined) T[k] = standard[k]; });
  if (T.confDate === undefined) T.confDate = exitL ? exitL.data.confDate : '';
  if (T.pbName === undefined) T.pbName = [pb.title, pb.name].filter(Boolean).join(' ');
  if (T.pbPos === undefined) T.pbPos = pb.pos;
  if (T.salutation === undefined) T.salutation = pbSalutation(pb.name);
  T.opSent = Object.fromEntries(OPINIONS.map((o) => [o, { ...stdOp[o], ...((T.opSent || {})[o] || {}) }]));
  const isNew = !rec || rec.deleted;

  const parts = `<div class="bparts">${PARTS.map(([n, t]) => n === '01'
    ? `<span class="bpart on"><b>${n}</b> ${esc(t)} <span id="b-p01">${pill('', 'grey')}</span></span>`
    : `<span class="bpart later" title="Built after Part ${String(Number(n) - 1).padStart(2, '0')}"><b>${n}</b> ${esc(t)}</span>`).join('')}</div>`;
  const ta = (id, label, rows = 3) => `<div class="field"><label class="label" for="b-${id}">${label}</label><textarea class="input be-text" id="b-${id}" rows="${rows}">${esc(T[id])}</textarea></div>`;
  const dis = canEdit ? '' : 'disabled';

  const form = `
    <section class="panel"><div class="panel-head"><h2>Report Details</h2></div><div class="panel-body">
      <div class="lr-row"><span class="label" style="margin:0;white-space:nowrap">Auditor's Opinion</span>
        <div class="seg bop" role="group" aria-label="Auditor's Opinion">${OPINIONS.map((o) => `<button type="button" data-op="${o}" class="${B.opinion === o ? 'on' : ''}" aria-pressed="${B.opinion === o}" ${dis}>${o}</button>`).join('')}</div></div>
      <div class="field"><label class="label" for="b-ops">Opinion Sentence · Letter to the Punong Barangay</label><textarea class="input be-text" id="b-ops" rows="3" ${dis}></textarea></div>
      <div class="field"><label class="label" for="b-opa">Opinion Sentence · Letter to the SA</label><textarea class="input be-text" id="b-opa" rows="2" ${dis}></textarea></div>
      <span class="hint" id="b-ophint"></span>
      <div class="field"><span class="label">Period in the Letters</span><div class="bval">${esc(periodEnded(audit.periodFrom, audit.periodTo))}</div>
        <span class="hint">From the audit period in Setup. One year reads "for the year ended…", three years "for the three-year period ended…".</span></div>
      <div class="field"><label class="label" for="b-cd">Exit Conference Date</label><input class="input" type="date" id="b-cd" value="${esc(T.confDate || '')}" ${dis}>
        <span class="hint">${exitL ? `From Exit Conference Letter ${exitL.data.n}. You can change it.` : 'No Exit Conference letter lists this barangay yet. Type the date.'}</span></div>
    </div></section>
    <section class="panel"><div class="panel-head"><h2>Letter Dates</h2></div><div class="panel-body">
      <div class="grid-2">
        <div class="field"><label class="label" for="b-atld">ATL to SA</label><input class="input" type="date" id="b-atld" value="${esc(T.atlDate || '')}" ${dis}></div>
        <div class="field"><label class="label" for="b-sad">SA to Punong Barangay</label><input class="input" type="date" id="b-sad" value="${esc(T.saDate || '')}" ${dis}></div>
      </div><span class="hint">Any date. Past dates are allowed.</span><div id="b-datewarn"></div></div></section>
    <section class="panel"><div class="panel-head"><h2>Addressed To</h2><a class="btn sm ghost" style="margin-left:auto" href="#/audits/${ctx.rec.id}/setup">Edit in Setup</a></div><div class="panel-body">
      <div class="grid-2">
        <div class="field"><label class="label" for="b-pb">Punong Barangay</label><input class="input" id="b-pb" value="${esc(T.pbName)}" ${dis}></div>
        <div class="field"><label class="label" for="b-sal">Salutation</label><input class="input" id="b-sal" value="${esc(T.salutation)}" ${dis}></div>
      </div><span class="hint">From the officials in Audit Setup. The salutation uses the surname. A change here applies to this BAAR only.</span></div></section>
    <section class="panel"><div class="panel-head"><h2>Wording</h2><span class="btn-row" style="margin-left:auto">${canStd && canEdit ? '<button class="btn sm ghost" id="b-std" type="button">Save as Standard</button>' : ''}${canEdit ? '<button class="btn sm ghost" id="b-reset" type="button">Reset to Standard</button>' : ''}</span></div><div class="panel-body">
      <div class="seg" role="tablist" aria-label="Which letter"><button type="button" class="on" data-wl="sa">Letter to Punong Barangay</button><button type="button" data-wl="atl">Letter to SA</button></div>
      <fieldset class="bw" data-w="sa" ${dis}>
        ${ta('sa1', 'Paragraph 1', 4)}${ta('sa2', 'Paragraph 2', 4)}${ta('sa3', 'Paragraph 3', 3)}
        <span class="hint">Paragraph 4 is the opinion sentence, under Report Details.</span>
        ${ta('sa5', 'Paragraph 5', 3)}${ta('sa6', 'Paragraph 6 · update the GAA section and R.A. number each year', 5)}${ta('sa7', 'Paragraph 7', 2)}
        ${ta('cc', 'Copy furnished (one per line)', 5)}</fieldset>
      <fieldset class="bw" data-w="atl" hidden ${dis}>
        ${ta('atlAddr', "SA's Address (one line each)", 2)}
        <div class="field"><label class="label" for="b-atlSal">Salutation</label><input class="input" id="b-atlSal" value="${esc(T.atlSal)}"></div>
        ${ta('atl1', 'Paragraph 1', 4)}${ta('atl2', 'Paragraph 2', 4)}${ta('atl3', 'Paragraph 3', 5)}${ta('atl4', 'Paragraph 4', 2)}
        <span class="hint">Paragraph 5 is the opinion sentence, under Report Details.</span>
        ${ta('atl6', 'Paragraph 6', 2)}</fieldset>
      <span class="hint">These fill in by themselves: <b>[BARANGAY]</b> ${esc(lgu.name)}, ${esc(mun.name)}, Quirino · <b>[MUN]</b> ${esc(mun.name)}, Quirino · <b>[PERIOD]</b> ${esc(periodEnded(audit.periodFrom, audit.periodTo))} · <b>[CONF_DATE]</b> the exit conference date.
        Signatories: the Supervising Auditor signs the letter to the Punong Barangay, the Audit Team Leader signs the letter to the SA, with their position and designation from Users. Spaces are left blank for wet signatures.</span>
    </div></section>
    ${canEdit ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span>
      <div class="btn-row" style="margin-left:auto"><button class="btn primary" id="b-save" type="button">Save</button></div></div>` : ''}`;

  const crumbs = `<a href="#/baar">BAAR Reports</a> / <a href="#/audits/${ctx.rec.id}/aoms">${esc(ctx.title)}</a> / <b>01 · Transmittal Letters</b>`;
  const body = `${stepsBar(ctx, 'BAAR')}
    <div class="page-head"><div><h1>BAAR · Barangay ${esc(lgu.name)}</h1><p>${esc(mun.name)}, Quirino · ${esc(periodPhrase(audit.periodFrom, audit.periodTo))}</p></div></div>
    <section class="panel" style="padding:10px 12px">${parts}</section>
    <div class="xcols bcols"><div class="xform">${form}</div>
      <div class="xprev"><div class="panel" style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:var(--navy)">Print View</b><span class="hint">Letter 8.5" × 11"</span>
        <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" id="b-print" type="button">Print</button><button class="btn sm primary" id="b-word" type="button">Word</button></span></div>
        <div class="seg" role="tablist" aria-label="Document" id="b-which"><button type="button" class="on" data-d="">All Three</button><button type="button" data-d="sa">SA to Punong Barangay</button><button type="button" data-d="atl">ATL to SA</button><button type="button" data-d="aapsi">AAPSI Form</button></div>
        <div class="paper-wrap big" id="b-paper"></div></div></div>`;

  return {
    active: '#/baar', crumbs, body,
    mount(root) {
      const v = (id) => { const el = $(id, root); return el ? el.value : ''; };
      let op = B.opinion || '';
      let which = '';
      const opBox = { sa: $('#b-ops', root), atl: $('#b-opa', root) };
      const showOp = () => {
        const s = T.opSent[op] || { sa: '', atl: '' };
        opBox.sa.value = op ? s.sa : ''; opBox.atl.value = op ? s.atl : '';
        opBox.sa.disabled = opBox.atl.disabled = !op || !canEdit;
        $('#b-ophint', root).textContent = !op ? 'Choose the opinion first.'
          : (s.sa || '').trim() && (s.atl || '').trim() ? `Each opinion keeps its own sentences. [BARANGAY] and [PERIOD] fill in by themselves.`
          : `Type the ${op} sentences the first time. ${canStd ? 'Click Save as Standard to keep them for every BAAR.' : 'Your SA can save them as standard.'}`;
      };
      const keepOp = () => { if (op) T.opSent[op] = { sa: opBox.sa.value, atl: opBox.atl.value }; };
      const collect = () => {
        keepOp();
        const t = { ...T };
        TR_KEYS.forEach((k) => { const el = $('#b-' + k, root); if (el) t[k] = el.value; });
        t.confDate = v('#b-cd'); t.atlDate = v('#b-atld'); t.saDate = v('#b-sad'); t.pbName = v('#b-pb').trim(); t.salutation = v('#b-sal').trim();
        t.opSent = clone(T.opSent);
        return { ...B, opinion: op, tr: t };
      };
      let measure = document.getElementById('b-measure');
      if (!measure) { measure = document.createElement('div'); measure.id = 'b-measure'; document.body.appendChild(measure); }
      measure.className = 'aom-doc bl'; measure.style.cssText = 'position:absolute;left:-9999px;top:0;width:6in;visibility:hidden';
      const docOf = (d) => buildTransmittal({ t: { ...d.tr, opinion: d.opinion }, audit, lgu, mun, team, atl, sa });
      const draw = () => {
        if (!document.body.contains(root)) return;
        const d = collect(), doc = docOf(d);
        const docs = which ? doc.docs.filter((x) => x.key === which) : doc.docs;
        $('#b-paper', root).innerHTML = docs.map((x) => {
          const pages = paginate(x, measure);
          return `<div class="doc-label">${esc(x.title)}${pages.length > 1 ? ` (${pages.length} pages)` : ''}</div>` +
            pages.map((items) => `<div class="sheet bsheet"><div class="aom-doc bl">${docHTML({ items })}</div></div>`).join('');
        }).join('');
        const miss = trMissing(d);
        $('#b-p01', root).innerHTML = miss.length ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok');
        $('#b-p01', root).title = miss.length ? 'Still needed: ' + miss.join(', ') : '';
        const t = d.tr, w = [];
        if (t.atlDate && t.saDate && t.saDate < t.atlDate) w.push('The letter to the Punong Barangay is dated before the letter to the SA.');
        if (t.confDate && ((t.atlDate && t.atlDate < t.confDate) || (t.saDate && t.saDate < t.confDate))) w.push('A letter is dated before the exit conference.');
        $('#b-datewarn', root).innerHTML = w.length ? `<div class="note warn">${w.map(esc).join(' ')} Please check the dates.</div>` : '';
      };
      async function save() {
        const d = collect();
        await store.save('letters', recId(ctx.rec.id), d, { silent: true });
        Object.assign(B, clone(d)); Object.assign(T, d.tr);
        await store.log('saved the BAAR transmittal letters', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      const changed = () => { if (!canEdit) return; setDirty(true, save); draw(); };
      root.querySelector('.xform').addEventListener('input', changed);
      root.querySelector('.xform').addEventListener('change', changed);
      $$('[data-op]', root).forEach((b) => { b.onclick = () => {
        keepOp(); op = b.dataset.op;
        $$('[data-op]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        showOp(); changed();
      }; });
      $$('[data-wl]', root).forEach((b) => { b.onclick = () => {
        $$('[data-wl]', root).forEach((x) => x.classList.toggle('on', x === b));
        $$('.bw', root).forEach((f) => { f.hidden = f.dataset.w !== b.dataset.wl; });
      }; });
      $$('#b-which [data-d]', root).forEach((b) => { b.onclick = () => {
        which = b.dataset.d; $$('#b-which [data-d]', root).forEach((x) => x.classList.toggle('on', x === b)); draw();
      }; });
      const save1 = $('#b-save', root); if (save1) save1.onclick = save;
      const reset = $('#b-reset', root);
      if (reset) reset.onclick = () => {
        TR_KEYS.forEach((k) => { const el = $('#b-' + k, root); if (el) el.value = standard[k]; });
        if (op) { T.opSent[op] = clone(stdOp[op]); showOp(); }
        changed(); toast('Standard wording put back. Click Save to keep it.', 'ok');
      };
      const stdBtn = $('#b-std', root);
      if (stdBtn) stdBtn.onclick = async () => {
        if (!(await confirmBox('Save as Standard', 'Use this wording, the Copy furnished lines and the opinion sentences for every new BAAR transmittal from now on? BAARs already started keep their own wording.', 'Save as Standard', 'success'))) return;
        const d = collect();
        const wording = Object.fromEntries(TR_KEYS.map((k) => [k, d.tr[k]]));
        const opSent = Object.fromEntries(OPINIONS.map((o) => [o, (d.tr.opSent[o] && ((d.tr.opSent[o].sa || '').trim() || (d.tr.opSent[o].atl || '').trim())) ? d.tr.opSent[o] : stdOp[o]]));
        await store.save('letters', stdId(ctx.teamId), { type: 'standard', kind: 'baar-tr', teamId: ctx.teamId, wording, opSent, savedBy: me.email, savedAt: new Date().toISOString() }, { silent: true });
        await store.log('saved the standard BAAR transmittal wording', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        Object.assign(standard, wording); Object.assign(stdOp, clone(opSent));
        toast('Saved as the standard wording for new BAARs.', 'ok');
      };
      $('#b-print', root).onclick = async () => {
        const d = collect(); printTransmittal(docOf(d), which, `BAAR ${audit.auditYear} · ${lgu.name} · 01 Transmittal Letters`);
        await store.log('printed the BAAR transmittal letters', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      $('#b-word', root).onclick = async () => {
        const d = collect();
        try { toast('Preparing the Word file…'); await transmittalWord(docOf(d), which); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the BAAR transmittal letters (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      showOp();
      draw();
      setDirty(false, save);
      void isNew; void longDate; void nice;
    }
  };
}
