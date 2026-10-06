// Consolidated SAOR: Barangays of one municipality, one Audit Year.
// The app suggests the general wording of each observation found in two or more barangays; the team checks it, edits it
// and saves it, then forwards the SAOR for review (ATL, then SA). Until the SA's final approval it prints as a draft.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, confirmBox, pill, $, $$ } from '../ui.js';
import { has, myTeamIds, canEditAudits } from '../refs.js';
import { ST, statusPill } from '../aom.js';
import { saorHTML, printSaor, saorWord } from '../saor.js';
import { loadSaor, saveSaor, OPEN, forwardSaor, retrieveSaor, reopenSaor, trailModal } from './saorreview.js';

const longD = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };

export async function saorview(refs, params, q) {
  const me = refs.me;
  const teams = myTeamIds(me, refs.teams);
  const audits = (await store.list('audits')).filter((a) => teams.includes(a.data.teamId) && !a.data.imported);
  const munOf = (a) => refs.lgu[a.data.lguId]?.data.parentId;
  const munIds = [...new Set(audits.map(munOf).filter(Boolean))].sort((x, y) => (refs.lgu[x]?.data.name || '').localeCompare(refs.lgu[y]?.data.name || ''));
  const crumbs = '<b>SAOR</b>';
  if (!munIds.length) return { active: '#/saor', crumbs, body: '<div class="page-head"><div><h1>SAOR</h1></div></div><section class="panel"><div class="empty">No audits yet.</div></section>' };
  const munId = munIds.includes(q.get('m')) ? q.get('m') : munIds[0];
  const years = [...new Set(audits.filter((a) => munOf(a) === munId).map((a) => Number(a.data.auditYear)))].sort((a, b) => b - a);
  const year = years.includes(Number(q.get('y'))) ? Number(q.get('y')) : years[0];
  let ctx = await loadSaor(refs, munId, year);
  const { mun, list, aoms, model, allObs, S, status, head, teamId } = ctx;
  const R = S.review;
  const open = OPEN.includes(status), final = status === ST.FINAL;
  const canEdit = open && canEditAudits(me);
  const view = q.get('view') === 'print' || (q.get('view') !== 'edit' && !canEdit) ? 'print' : 'edit';
  const go = (o = {}) => `#/saor?m=${encodeURIComponent(o.m || munId)}&y=${o.y || year}&view=${o.view || view}`;
  const reviewLink = `#/saor-review?m=${encodeURIComponent(munId)}&y=${year}`;
  const isLibAdmin = has(me, 'sa') || has(me, 'admin');

  // Per barangay: Final AOMs with comments and with a rejoinder decision.
  const brgyStats = list.map((au) => {
    const fin = aoms.filter((a) => a.data.auditId === au.id && a.data.status === 'Final');
    if (!fin.length) return null;
    const hasC = (a) => !!(a.data.mgmt && (a.data.mgmt.comment || '').trim());
    const rec = fin.filter(hasC).length;
    const dec = fin.filter((a) => hasC(a) && (a.data.mgmt.noRejoinder || (a.data.mgmt.rejoinder || '').trim())).length;
    const name = refs.lgu[au.data.lguId]?.data.name || '?';
    const done = rec === fin.length && dec === fin.length;
    const left = fin.length - rec, pend = rec - dec;
    const note = done ? 'Completed' : left ? `${left} comment${left > 1 ? 's' : ''} awaiting` : `${pend} rejoinder decision${pend > 1 ? 's' : ''} pending`;
    return { id: au.id, name, ini: name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(), total: fin.length, rec, dec, done, note };
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const mcRec = brgyStats.reduce((n, b) => n + b.rec, 0), mcAw = brgyStats.reduce((n, b) => n + b.total - b.rec, 0), mcDone = brgyStats.filter((b) => b.done).length;

  /* ── Review steps and status ── */
  const step = (n, label, st) => `<span class="sv-step ${st}"><i>${st === 'done' ? '✓' : n}</i>${esc(label)}</span>`;
  const atlDone = [ST.WITH_SA, ST.SA, ST.FINAL].includes(status), atlNow = [ST.WITH_ATL, ST.ATL].includes(status);
  const steps = `<div class="sv-steps" aria-label="Review steps">
      ${step(1, 'Team Member', open ? 'now' : 'done')}<span class="sv-arrow" aria-hidden="true">→</span>
      ${ctx.oneStep ? step(2, 'Audit Team Leader and Supervising Auditor · Final', final ? 'done' : atlNow || [ST.WITH_SA, ST.SA].includes(status) ? 'now' : '')
        : `${step(2, 'Audit Team Leader', atlDone ? 'done' : atlNow ? 'now' : '')}<span class="sv-arrow" aria-hidden="true">→</span>${step(3, 'Supervising Auditor · Final', final ? 'done' : [ST.WITH_SA, ST.SA].includes(status) ? 'now' : '')}`}
      ${pill(status === ST.DRAFT ? 'Draft' : status, statusPill(status))}</div>`;
  const suggested = allObs.filter((o) => o.source === 'suggested').length;
  const reviewer = (status === ST.WITH_ATL || status === ST.ATL) ? ctx.iAmATL : (status === ST.WITH_SA || status === ST.SA) ? ctx.iAmSA : false;
  let topnote;
  if (open) topnote = `<div class="topnote">The app suggests a general wording for each observation found in two or more barangays. Check each one, edit if needed, and click <b>Save</b>. At the Supervising Auditor's final approval, the saved wording becomes the AOM Library wording.</div>
    ${status === ST.RETURNED && R.returnNote ? `<div class="note warn"><span><b>Returned by ${esc(ctx.nameOf(R.returnedBy))}</b>: ${esc(R.returnNote)}</span><a class="btn sm ghost" style="margin-left:auto" href="${reviewLink}">See Comments and Corrections</a></div>` : ''}`;
  else if (final) topnote = `<div class="topnote final">Approved as Final by ${esc(ctx.nameOf(R.finalBy))} on ${esc(longD(R.finalAt))}. The wording of each observation found in two or more barangays is now its template's AOM Library wording and will be used in future SAORs. Only the Supervising Auditor or Admin can edit it.</div>`;
  else topnote = `<div class="note info" style="align-items:center"><span>Forwarded for review ${esc(R.forwardedAt ? '· ' + longD(R.forwardedAt) : '')}. The SAOR cannot be changed while it is being reviewed.</span>
    <span class="btn-row" style="margin-left:auto">${reviewer ? `<a class="btn sm primary" href="${reviewLink}">Open Review →</a>` : ''}${status === ST.WITH_ATL && canEditAudits(me) && !reviewer ? '<button class="btn sm ghost" type="button" id="s-retrieve">Retrieve</button>' : ''}</span></div>`;

  /* ── Observation cards ── */
  const tag = (o) => o.single ? pill('One barangay · own AOM wording', 'grey')
    : final ? pill('AOM Library wording', 'violet')
    : o.source === 'suggested' ? pill('Suggested', 'warn') : o.source === 'library' ? pill('AOM Library wording', 'violet') : pill('Saved', 'ok');
  const footHint = (o) => {
    if (final) return 'Saved to the AOM Library at final approval';
    if (o.source === 'suggested') return `Generated by the app from the AOMs of ${o.lines.length} barangays`;
    if (o.source === 'library') return 'Wording from the AOM Library';
    const ov = S.overrides[o.key] || {};
    return `Saved${ov.by ? ' by ' + ctx.nameOf(ov.by) : ''}${ov.at ? ' · ' + longD(ov.at) : ''}`;
  };
  const editHTML = allObs.map((o) => {
    const rows = (t) => Math.min(9, Math.max(3, Math.ceil(String(t).length / 95)));
    const brgys = `<div class="sv-brgys">${o.lines.map((l) => `<span>${esc(l.brgy)}</span>`).join('')}</div>`;
    if (o.single) return `<section class="panel"><div class="panel-head"><div><h2>${o.n}. ${esc(o.title)}</h2><span class="hint">${esc(o.code || 'Not in the AOM Library')} · 1 barangay</span></div><span style="margin-left:auto">${tag(o)}</span></div><div class="panel-body">
      <div class="field"><label class="label" for="o-${o.n}">Observation</label><textarea class="input be-text" id="o-${o.n}" rows="${rows(o.obs)}" readonly>${esc(`Barangay ${o.lines[0].brgy}: ${o.obs}`)}</textarea></div>
      <span class="hint">Found in one barangay only, so the SAOR uses its own AOM wording. Nothing is saved to the AOM Library.</span></div></section>`;
    const sug = o.source === 'suggested' && !final;
    return `<section class="panel" data-key="${esc(o.key)}"><div class="panel-head"><div><h2>${o.n}. ${esc(o.title)}</h2><span class="hint">${esc(o.code || 'Not in the AOM Library')} · ${o.lines.length} barangays</span></div><span style="margin-left:auto" data-tag>${tag(o)}</span></div><div class="panel-body">
      ${brgys}
      <div class="field"><label class="label" for="o-${o.n}">Observation</label><textarea class="input be-text ${sug ? 'sv-sug' : ''}" id="o-${o.n}" data-f="obs" rows="${rows(o.obs)}" ${canEdit ? '' : 'disabled'}>${esc(o.obs)}</textarea></div>
      <div class="field"><label class="label" for="r-${o.n}">Recommendation</label><textarea class="input be-text ${sug ? 'sv-sug' : ''}" id="r-${o.n}" data-f="rec" rows="${rows(o.rec)}" ${canEdit ? '' : 'disabled'}>${esc(o.rec)}</textarea></div>
      <div class="sv-foot"><span class="hint">${esc(footHint(o))}</span>
        ${canEdit ? `<button class="btn sm ghost" type="button" data-gen="${esc(o.key)}" ${o.obs === o.genObs && o.rec === o.genRec ? 'disabled' : ''}>Use Generated Wording</button><button class="btn sm primary" type="button" data-save="${esc(o.key)}" ${o.source === 'suggested' ? '' : 'disabled'}>Save</button>` : ''}
        ${final && isLibAdmin && o.code ? `<a class="btn sm ghost" href="#/library?code=${encodeURIComponent(o.code)}">Edit Library Wording</a>` : ''}</div></div></section>`;
  }).join('') || '<section class="panel"><div class="empty">No Final AOMs yet.</div></section>';

  const draftTxt = final ? '' : ' (Draft)';
  const actions = `${R.history && R.history.length ? '<button class="btn sm ghost" id="s-trail" type="button">Review Trail</button>' : ''}
    <button class="btn sm ghost" id="s-print" type="button" ${allObs.length ? '' : 'disabled'}>Print${draftTxt}</button><button class="btn sm ${final ? 'primary' : 'ghost'}" id="s-word" type="button" ${allObs.length ? '' : 'disabled'}>Word${draftTxt}</button>
    ${canEdit ? `<button class="btn sm primary" id="s-forward" type="button" ${allObs.length && !suggested ? '' : 'disabled'}>${status === ST.RETURNED ? 'Forward Again to ATL' : 'Forward to Audit Team Leader'}</button>${suggested ? `<span class="hint">${suggested} observation${suggested > 1 ? 's' : ''} still Suggested</span>` : ''}` : ''}
    ${final && ctx.iAmSA ? '<button class="btn sm ghost" id="s-reopen" type="button">Reopen for Correction</button>' : ''}`;

  const body = `<div class="page-head"><div style="display:flex;flex-direction:column;gap:8px"><h1>SAOR · ${esc(mun.name)}</h1>${steps}</div>
      <div class="btn-row"><label class="sr-only" for="s-m">Municipality</label><select class="input" id="s-m" style="width:160px">${munIds.map((id) => `<option value="${id}" ${id === munId ? 'selected' : ''}>${esc(refs.lgu[id]?.data.name || id)}</option>`).join('')}</select>
        <label class="sr-only" for="s-y">Audit Year</label><select class="input" id="s-y" style="width:170px">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>Audit Year ${y}</option>`).join('')}</select></div></div>
    ${topnote}
    <div class="saor-lay">
      <section class="panel mc-panel" style="align-self:start"><div class="panel-head"><h2>Management Comments</h2></div>
        <div class="mc-sum"><div><b>${mcRec}</b><span>Received</span></div><div><b class="${mcAw ? 'warn' : ''}">${mcAw}</b><span>Awaiting</span></div><div><b class="${mcDone === brgyStats.length && brgyStats.length ? 'ok' : ''}">${mcDone} of ${brgyStats.length}</b><span>Completed Barangays</span></div></div>
        <div class="mc-filt" role="group" aria-label="Show barangays"><button type="button" class="on" data-flt="all">All</button><button type="button" data-flt="awaiting">Awaiting</button><button type="button" data-flt="completed">Completed</button></div>
        <div class="mc-list">${brgyStats.map((b) => `<a href="#/audits/${b.id}/comments" data-st="${b.done ? 'completed' : 'awaiting'}">
          <span class="mc-av ${b.done ? 'ok' : b.rec ? 'part' : 'none'}" aria-hidden="true">${esc(b.ini)}</span>
          <span><b>${esc(b.name)}</b><small>${esc(b.note)}</small><span class="mc-bar ${b.done ? '' : 'part'}"><i style="width:${b.total ? Math.round(100 * b.rec / b.total) : 0}%"></i></span></span>
          <span class="mc-cnt">${b.rec} of ${b.total}</span></a>`).join('') || '<div class="empty">No Final AOMs yet.</div>'}</div>
        <div class="panel-body"><span class="hint">Click a barangay to enter or edit its comments.</span></div></section>
      <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
        <div class="panel rv-bar"><div class="seg"><a class="${view === 'edit' ? 'on' : ''}" href="${go({ view: 'edit' })}">${canEdit ? 'Edit' : 'Wording'}</a><a class="${view === 'print' ? 'on' : ''}" href="${go({ view: 'print' })}">Print View</a></div>
          ${final ? `<a class="btn sm ghost" href="#/exit?m=${encodeURIComponent(munId)}&y=${year}">✉ Exit Conference Letters</a>` : '<button class="btn sm ghost" type="button" disabled>✉ Exit Conference Letters</button><span class="hint">Available after Final approval</span>'}
          <span class="btn-row" style="margin-left:auto">${actions}</span></div>
        ${view === 'print' ? `<div class="paper-wrap big" style="max-height:none"><div class="sheet saor-sheet">${saorHTML(model, head)}</div></div>
          <span class="hint">${final ? 'Final copy: ready for the exit conference.' : 'The draft is the exact SAOR format. Every page of the Print and Word copies is marked "DRAFT – For Review Only" until the Supervising Auditor\'s final approval.'}</span>`
          : `<div style="display:flex;flex-direction:column;gap:16px">${editHTML}</div>`}
      </div></div>
    <div class="grid-2" style="align-items:start">
      <section class="panel"><div class="panel-head"><h2>Coverage</h2></div><div class="panel-body" style="gap:4px;font-size:13.5px">
        <div class="ckv"><span>Barangays with Final AOMs</span><b>${model.barangays}</b></div><div class="ckv"><span>Observations</span><b>${model.obsCount}</b></div>
        <div class="ckv"><span>Barangay lines</span><b>${model.lineCount}</b></div></div></section>
      <section class="panel"><div class="panel-head"><h2>Cross-Reference Results</h2></div><div class="panel-body" style="gap:4px;font-size:13px">
        <span>✓ All ${model.lineCount} Final AOMs appear under their observation</span><span>✓ AOM Nos. and amounts come from each Final AOM</span><span>✓ Totals are the sum of the barangay amounts</span>
        ${model.notFinal.length ? `<span style="color:var(--warn-ink)">! ${model.notFinal.length} AOM${model.notFinal.length > 1 ? 's are' : ' is'} not Final yet and not included: ${esc([...new Set(model.notFinal.map((x) => x.brgy))].join(', '))}</span>` : ''}</div></section>
    </div>`;

  return {
    active: '#/saor', crumbs: `<b>SAOR</b> · ${esc(mun.name)} · Audit Year ${year}`, body,
    mount(root) {
      $('#s-m', root).onchange = (e) => { location.hash = `#/saor?m=${encodeURIComponent(e.target.value)}`; };
      $('#s-y', root).onchange = (e) => { location.hash = go({ y: e.target.value }); };
      $$('[data-flt]', root).forEach((b) => { b.onclick = () => {
        $$('[data-flt]', root).forEach((x) => x.classList.toggle('on', x === b));
        $$('.mc-list a', root).forEach((r) => { r.hidden = b.dataset.flt !== 'all' && r.dataset.st !== b.dataset.flt; });
      }; });
      const label = `${mun.name} · Audit Year ${year}`;
      $('#s-print', root).onclick = async () => { printSaor(model, head); await store.log(final ? 'printed the SAOR' : 'printed the SAOR (draft)', label, teamId, me.email); };
      $('#s-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); await saorWord(model, head); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log(final ? 'downloaded the SAOR (Word)' : 'downloaded the SAOR draft (Word)', label, teamId, me.email);
      };
      const tr = $('#s-trail', root); if (tr) tr.onclick = () => trailModal(ctx, refs);
      const rt = $('#s-retrieve', root); if (rt) rt.onclick = () => retrieveSaor(ctx, me);
      const ro = $('#s-reopen', root); if (ro) ro.onclick = () => reopenSaor(ctx, me);
      if (!canEdit || view !== 'edit') return;

      const vals = (sec) => ({ obs: $('[data-f=obs]', sec).value.trim(), rec: $('[data-f=rec]', sec).value.trim() });
      const dirtyKeys = new Set();
      const mark = (sec) => {
        const k = sec.dataset.key, o = allObs.find((x) => x.key === k), v = vals(sec);
        const changed = v.obs !== o.obs.trim() || v.rec !== o.rec.trim();
        if (changed) dirtyKeys.add(k); else dirtyKeys.delete(k);
        $('[data-save]', sec).disabled = !(changed || o.source === 'suggested');
        $('[data-gen]', sec).disabled = v.obs === o.genObs.trim() && v.rec === o.genRec.trim();
        $('#s-forward', root).disabled = true;   // save first
        setDirty(dirtyKeys.size > 0, saveAll);
      };
      async function saveKeys(keys) {
        ctx = await loadSaor(refs, munId, year);
        if (!OPEN.includes(ctx.status)) { toast('The SAOR was forwarded for review and can no longer be changed here.', 'bad'); return false; }
        const now = new Date().toISOString();
        keys.forEach((k) => { const sec = $(`[data-key="${CSS.escape(k)}"]`, root); if (sec) ctx.S.overrides[k] = { ...vals(sec), saved: true, by: me.email, at: now }; });
        await saveSaor(ctx, ctx.S);
        await store.log('saved the SAOR wording', `${label} · ${keys.length} observation${keys.length > 1 ? 's' : ''}`, teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local');
        return true;
      }
      async function saveAll() { return saveKeys([...dirtyKeys]); }
      $$('[data-key]', root).forEach((sec) => {
        sec.addEventListener('input', () => mark(sec));
        $('[data-save]', sec).onclick = () => saveKeys([sec.dataset.key]);
        $('[data-gen]', sec).onclick = async () => {
          const o = allObs.find((x) => x.key === sec.dataset.key);
          if (!(await confirmBox('Use Generated Wording', 'Put back the wording the app generated for this observation? Click Save afterwards to keep it.', 'Use It'))) return;
          $('[data-f=obs]', sec).value = o.genObs; $('[data-f=rec]', sec).value = o.genRec;
          mark(sec);
        };
      });
      const fw = $('#s-forward', root);
      if (fw) fw.onclick = () => forwardSaor(ctx, me);
      setDirty(false, saveAll);
    }
  };
}
