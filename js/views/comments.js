// Management Comments and Auditor's Rejoinder, per barangay, on each Final AOM.
// Rules: a comment is needed on every Final AOM before the BAAR; "No Rejoinder" starts unticked, can only be ticked
// once a comment is entered, and records who decided and when. Blank rejoinder = not decided yet; "None" = no rejoinder.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, guard, pill, $ } from '../ui.js';
import { loadAudit, stepsBar } from '../auditctx.js';
import { ST, clone, fillText, SECTIONS } from '../aom.js';
import { aomNo, longDate, nice } from '../format.js';
import { when } from '../reviewpane.js';
import { aomAmount, peso, rejoinderText } from '../saor.js';

const SOURCES = ['Written Reply', 'Exit Conference', 'Both'];
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };   // date only, no time zone shift

export async function comments(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/audits', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found.</div>' };
  const finals = ctx.aoms.filter((a) => a.data.status === ST.FINAL).sort((a, b) => ctx.nums[a.id].n - ctx.nums[b.id].n);
  const crumbs = `<a href="#/audits">My Audit</a> / <a href="#/audits/${ctx.rec.id}/aoms">${esc(ctx.title)}</a> / <b>Management Comments</b>`;
  const head = `${stepsBar(ctx, 'SAOR and Exit Conference')}<div class="page-head"><div><h1>Barangay ${esc(ctx.lgu.name)} · Management Comments</h1></div>`;
  if (!finals.length) return { active: '#/audits', crumbs, body: `${head}</div><section class="panel"><div class="empty">No Final AOMs yet. Comments are entered once the AOMs are Final.</div></section>` };
  const no = (a) => aomNo(ctx.audit.auditYear, ctx.nums[a.id].n, ctx.audit.periodFrom, ctx.audit.periodTo);
  const has = (a) => !!(a.data.mgmt && (a.data.mgmt.comment || '').trim());
  const decided = (a) => has(a) && (a.data.mgmt.noRejoinder || (a.data.mgmt.rejoinder || '').trim());
  const recd = finals.filter(has).length, decd = finals.filter(decided).length;
  const exitMode = q.get('ec') === '1';
  const cur = finals.find((a) => a.id === q.get('aom')) || (exitMode ? finals.find((a) => !has(a)) : null) || finals[0];
  const m = { source: exitMode && !has(cur) ? 'Exit Conference' : 'Written Reply', replyDate: '', receivedDate: '', comment: '', rejoinder: '', noRejoinder: false, ...(cur.data.mgmt || {}) };
  const rcvAOM = ctx.audit.aomReceivedDate || '';
  const due = rcvAOM ? addDays(rcvAOM, 5) : '';
  const nameOf = (e) => nice(refs.users.find((u) => u.data.email === e)?.data.name || e || '');
  const link = (a, ec) => `#/audits/${ctx.rec.id}/comments?aom=${a.id}${ec ? '&ec=1' : ''}`;
  const amt = aomAmount(cur.data);

  const listHTML = finals.map((a) => `<a class="t-row click ${a.id === cur.id ? 'sel' : ''}" href="${link(a, exitMode)}" style="grid-template-columns:1fr auto;text-decoration:none;color:inherit;padding:10px 14px">
      <span><span class="mono" style="font-size:12px">AOM No. ${esc(no(a))}</span><br><b>${esc(fillText(a.data.title, ctx.varsFor(a)))}</b></span>
      <span style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">${has(a) ? pill('Received', 'ok') : pill('Awaiting', 'warn')}${has(a) && !decided(a) ? pill('Rejoinder?', 'grey') : ''}</span></a>`).join('');

  const body = `${head}<div class="btn-row">${pill(recd + ' Received', 'ok')}${pill(finals.length - recd + ' Awaiting', finals.length - recd ? 'warn' : 'grey')}</div></div>
    <div class="topnote">Every Final AOM needs a comment and a rejoinder decision before the BAAR can be finalized.</div>
    <div class="cm-cols">
      <section class="panel" style="align-self:start"><div class="panel-head"><h2>Final AOMs</h2></div>
        <div class="panel-body" style="gap:6px;padding-bottom:10px"><label class="label" for="c-rcv">AOMs Received by the Barangay</label><input class="input" type="date" id="c-rcv" value="${esc(rcvAOM)}">
          <span class="hint">${due ? 'Reply due ' + esc(longDate(due)) + ' (5 calendar days).' : 'From the Proof of Receipt. Used for the 5-day check.'}</span></div>
        ${listHTML}
        <div class="panel-body"><a class="btn ghost" href="${(() => { const f = finals.find((a) => !has(a)); return f ? link(f, true) : '#'; })()}" ${finals.some((a) => !has(a)) ? '' : 'aria-disabled="true" style="pointer-events:none;opacity:.45"'}>Enter Exit Conference Comments</a>
          <span class="hint">Opens each Awaiting AOM one after another, with the source set to Exit Conference.</span></div></section>
      <section class="panel"><div class="panel-head"><div><h2>AOM No. ${esc(no(cur))}</h2><span class="hint">${esc(fillText(cur.data.title, ctx.varsFor(cur)))} · Part II ${esc(SECTIONS[cur.data.section] || '')}</span></div></div>
        <div class="panel-body" id="c-form">
          <div class="lr-row"><span class="label" id="c-src-l" style="margin:0">Source of Comment</span><div class="seg" role="group" aria-labelledby="c-src-l">${SOURCES.map((s) => `<button type="button" class="${m.source === s ? 'on' : ''}" data-src="${s}">${s}</button>`).join('')}</div></div>
          <div class="grid-2" id="c-dates">
            <div class="field"><label class="label" for="c-rd">Reply Letter Date</label><input class="input" type="date" id="c-rd" value="${esc(m.replyDate || '')}"></div>
            <div class="field"><label class="label" for="c-rr">Received by Audit Team</label><input class="input" type="date" id="c-rr" value="${esc(m.receivedDate || '')}"><span id="c-due" class="hint"></span></div></div>
          <div class="field"><label class="label" for="c-mc">Management's Comment/s</label><textarea class="input be-text" id="c-mc" rows="6">${esc(m.comment || '')}</textarea><span class="hint">Type or paste from the reply letter, or as stated at the exit conference.</span></div>
          <div class="field"><div style="display:flex;align-items:center;gap:8px"><label class="label" for="c-rj" style="margin:0">Auditor's Rejoinder</label>
            <label class="check" style="margin-left:auto"><input type="checkbox" id="c-norj" ${m.noRejoinder ? 'checked' : ''}>No Rejoinder</label></div>
            <textarea class="input be-text" id="c-rj" rows="3" placeholder="Type the rejoinder, or tick No Rejoinder">${esc(m.rejoinder || '')}</textarea>
            <span class="hint" id="c-rjhint"></span></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;border-top:1px solid var(--line-2);padding-top:12px">
            <span class="save-state saved" style="margin-right:auto"><span class="d"></span>All Changes Saved</span>
            <button class="btn ghost" id="c-save" type="button">Save</button><button class="btn primary" id="c-next" type="button">Save and Next AOM →</button></div>
        </div></section>
      <aside style="display:flex;flex-direction:column;gap:12px;min-width:0">
        <section class="panel"><div class="panel-head"><h2>Where This Comment Appears</h2></div><div class="panel-body">
          <span class="label">SAOR · ${esc(ctx.lgu.name)} line</span>
          <table class="saor-t" style="font-family:var(--serif);font-size:11px;margin:0"><colgroup><col style="width:30%"><col style="width:22%"><col style="width:33%"><col style="width:15%"></colgroup>
            <tr><td style="white-space:normal">AOM No. ${esc(no(cur))}</td><td>${esc(ctx.lgu.name)}${amt !== null ? '<br>' + esc(peso(amt)) : ''}</td><td id="p-mc"></td><td id="p-rj"></td></tr></table>
          <span class="label" style="margin-top:6px">BAAR Part II (Phase 4)</span><div id="p-baar" style="font-family:var(--serif);font-size:12px;line-height:1.45"></div></div></section>
        <section class="panel"><div class="panel-head"><h2>Before the BAAR</h2></div><div class="panel-body" style="gap:4px;font-size:13px">
          <span>${recd === finals.length ? '✓' : '!'} ${recd} of ${finals.length} Final AOMs have comments</span>
          <span>${decd === finals.length ? '✓' : '!'} ${decd} of ${finals.length} have a rejoinder decision</span>
          ${recd < finals.length || decd < finals.length ? '' : '<span class="hint" style="color:var(--ok-ink)">Complete.</span>'}</div></section>
      </aside></div>`;

  return {
    active: '#/audits', crumbs, body,
    mount(root) {
      let src = m.source;
      const v = (id) => $(id, root).value;
      const draw = () => {
        const c = v('#c-mc').trim();
        const nr = $('#c-norj', root), rj = $('#c-rj', root);
        nr.disabled = !c; if (!c) nr.checked = false;
        rj.disabled = !c || nr.checked;
        $('#c-rjhint', root).innerHTML = !c ? 'Enter the comment first. The rejoinder decision comes after.'
          : nr.checked ? (m.noRejoinder && m.decidedBy ? `No rejoinder · decided by ${esc(nameOf(m.decidedBy))} · ${esc(when(m.decidedAt))}. Prints as "None".` : 'Prints as "None" in the SAOR.')
            : v('#c-rj').trim() ? '' : 'Not decided yet. The SAOR cell stays blank.';
        $$('#c-form [data-src]').forEach((b) => b.classList.toggle('on', b.dataset.src === src));
        $('#c-dates', root).style.display = src === 'Exit Conference' ? 'none' : '';
        const rr = v('#c-rr');
        $('#c-due', root).innerHTML = !rr || !due ? '' : rr <= due ? '<span style="color:var(--ok-ink);font-weight:600">✓ Within the 5-day period</span>' : `<span style="color:var(--warn-ink);font-weight:600">Received ${Math.round((Date.parse(rr + 'T00:00:00Z') - Date.parse(due + 'T00:00:00Z')) / 864e5)} day(s) after the 5-day period</span>`;
        $('#p-mc', root).textContent = c;
        $('#p-rj', root).textContent = rejoinderText(c ? { noRejoinder: nr.checked, rejoinder: v('#c-rj') } : null);
        $('#p-baar', root).innerHTML = c ? `<i><b>Management's Comment/s:</b></i> ${esc(c)}${!nr.checked && v('#c-rj').trim() ? `<br><br><i><b>Auditor's Rejoinder:</b></i> ${esc(v('#c-rj').trim())}` : ''}` : '<span class="hint">Appears once the comment is entered.</span>';
      };
      function $$(sel) { return [...root.querySelectorAll(sel)]; }
      async function save() {
        const fresh = await store.get('aoms', cur.id);
        const d = clone(fresh.data);
        const c = v('#c-mc').trim(), nr = $('#c-norj', root).checked && !!c;
        const prev = d.mgmt || {};
        const now = new Date().toISOString();
        d.mgmt = { source: src, replyDate: src === 'Exit Conference' ? '' : v('#c-rd'), receivedDate: src === 'Exit Conference' ? '' : v('#c-rr'), comment: c,
          rejoinder: nr ? '' : v('#c-rj').trim(), noRejoinder: nr,
          decidedBy: nr ? (prev.noRejoinder ? prev.decidedBy : refs.me.email) : (v('#c-rj').trim() ? refs.me.email : ''), decidedAt: nr ? (prev.noRejoinder ? prev.decidedAt : now) : (v('#c-rj').trim() ? now : ''),
          by: refs.me.email, at: now };
        const what = nr && !prev.noRejoinder ? ' · No Rejoinder' : '';
        d.history = [...(d.history || []), { at: now, by: refs.me.email, action: `Management comment recorded (${src})${what}` }];
        await store.save('aoms', cur.id, d, { silent: true });
        await store.log('recorded a management comment', `${ctx.lgu.name} · AOM No. ${no(cur)}`, ctx.teamId, refs.me.email);
        cur.data = d; Object.assign(m, d.mgmt);
        setDirty(false); toast('Saved.', 'ok'); return true;
      }
      $('#c-form', root).addEventListener('click', (e) => { const b = e.target.closest('[data-src]'); if (!b) return; src = b.dataset.src; setDirty(true, save); draw(); });
      $('#c-form', root).addEventListener('input', () => { setDirty(true, save); draw(); });
      $('#c-form', root).addEventListener('change', () => { setDirty(true, save); draw(); });
      $('#c-save', root).onclick = async () => { await save(); emitChange('local'); };
      $('#c-next', root).onclick = async () => {
        await save();
        const fresh = await Promise.all(finals.map((a) => store.get('aoms', a.id)));
        const idx = finals.findIndex((a) => a.id === cur.id);
        const order = [...finals.slice(idx + 1), ...finals.slice(0, idx)];
        const next = exitMode ? order.find((a) => { const f = fresh[finals.indexOf(a)]; return !(f.data.mgmt && (f.data.mgmt.comment || '').trim()); }) : order[0];
        if (next && next.id !== cur.id) location.hash = link(next, exitMode); else { toast(exitMode ? 'All AOMs now have comments.' : 'Saved.', 'ok'); emitChange('local'); }
      };
      $('#c-rcv', root).onchange = async (e) => {
        const fresh = await store.get('audits', ctx.rec.id);
        await store.save('audits', ctx.rec.id, { ...fresh.data, aomReceivedDate: e.target.value });
        toast('Saved.', 'ok');
      };
      draw();
      setDirty(false, save);
      void guard;
    }
  };
}
