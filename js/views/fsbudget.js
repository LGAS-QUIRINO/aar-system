// Financial Statements · Budget tab: where the budget amounts come from (Annual Budget / Supplemental, the RAO, or
// neither), the RAO as read, matching the items to the rows of the Statement of Comparison of Budget and Actual Amounts,
// the statutory allocations, and the entry grid. Files are read on this device; only the values are kept.
import { store, emitChange } from '../store.js';
import { esc, toast, modal, confirmBox, pill, $, $$ } from '../ui.js';
import { fsId, loadFsRec, scbaaNotSubmitted, SCBAA, scbaaLine, money, cents, parseAmt, shown, interChoice, isCombined } from '../fs.js';
import { LINE } from '../coa.js';
import { readRao, readBudget, defaultCol, raoFlags, placeOf, autoLayer, memKey, statRowOf, raoMapId } from '../rao.js';
import { afsScreen, checkHTML } from './baarfs.js';

export async function loadMem(lguId) { const r = await store.get('letters', raoMapId(lguId)); return r && !r.deleted ? (r.data.map || {}) : {}; }
const scbOf = (F) => (F.rec && F.rec.scbaa) || { rows: {} };
const SRC_NAME = { ab: 'Annual Budget', sb: 'Supplemental Budget' };

/* ── Statutory allocations ── */
export const STAT = [
  { k: 'bdrrmf', t: '5% BDRRMF', rate: 5, base: 'reg', row: '5% LDRRMF' },
  { k: 'sk', t: '10% SK', rate: 10, base: 'reg', row: '10% SK allocation' },
  { k: 'df', t: '20% Development Fund', rate: 20, base: 'nta', row: '20% Development Fund' },
  { k: 'eld', t: '1% Elderly and Disabled', rate: 1, base: 'reg', row: '1% for the Elderly and Disabled' },
  { k: 'bcpc', t: '1% BCPC', rate: 1, base: 'nta', row: '1% Barangay Council for the Protection of Children' }
];
const BASE_NAME = { reg: 'Income from regular sources', nta: 'Share from National Tax Allotment (IRA/NTA)' };
const MG_OPEN = new Set();   // the groups of Match the items left open (kept while the screen redraws)
const ntaRow = SCBAA.find((r) => r.t === 'Share from Internal Revenue Collections');
// The subsidy the General Fund gave: Combined (to the 5% BDRRMF) and Transfer (to the 10% SK Fund).
function subsidies(F) {
  const out = { bdrrmf: null, sk: null };
  const s = F.figY.st && (F.figY.st.GF || F.figY.st.ALL); if (!s) return out;
  s.rows.forEach(({ r, acct: a, c }) => {
    if (!a || !LINE[a.line] || a.line !== 'tr_to' || !interChoice(r, a)) return;
    const v = c.dr - c.cr, k = isCombined(r, a) ? 'bdrrmf' : 'sk';
    out[k] = (out[k] || 0) + v;
  });
  return out;
}
// { k, t, rate, baseKind, base (centavos|null), req, book, from, diff }
export function statRows(F, scb) {
  const st = scb.stat || {};
  const baseOf = (kind) => { const v = st[kind]; if (v !== undefined && v !== '') return cents(v); if (kind === 'nta' && ntaRow) { const l = scbaaLine(ntaRow, scb); return l.ob || null; } return null; };
  const sub = subsidies(F);
  return STAT.map((x) => {
    const kind = (st.use && st.use[x.k]) || x.base, base = baseOf(kind);
    const req = base === null ? null : Math.round((base * x.rate) / 100);
    let book = null, from = '';
    if ((x.k === 'bdrrmf' || x.k === 'sk') && sub[x.k] !== null) { book = sub[x.k]; from = 'Subsidy in the General Fund trial balance'; }
    else { const row = SCBAA.find((r) => r.t === x.row); const l = row ? scbaaLine(row, scb) : null; if (l && l.typed) { book = l.fin; from = 'Final budget in the statement'; } }
    return { ...x, kind, base, req, book, from, diff: req !== null && book !== null ? book - req : null };
  });
}

/* ── What the budget shows that may be a finding (for Possible Findings) ── */
export function budgetFlags(F) {
  const scb = scbOf(F), out = [];
  if (scbaaNotSubmitted(F.rec)) out.push({ id: 'noscbaa', rule: 'noscbaa', t: 'Statement of Comparison of Budget and Actual Amounts not submitted by management', d: 'Answered No on the Budget tab', amt: null });
  if (scb.none) out.push({ id: 'nobudget', rule: 'nobudget', t: 'No Annual Budget at the Audit Team', d: 'Ticked on the Budget tab', amt: null });
  raoFlags(scb.rao).forEach((f) => {
    if (f.kind === 'total') out.push({ id: `rao-total-${f.sheet}`, rule: 'rao', t: `RAO ${f.sheet}: the TOTAL COMMITMENT column (₱${money(f.commit, { dash: '0.00' })}) is ₱${money(Math.abs(f.diff))} ${f.diff > 0 ? 'less' : 'more'} than the items added up (₱${money(f.sum)})`, amt: Math.abs(f.diff) });
    else out.push({ id: `rao-${f.sheet}-${f.label}`, rule: 'rao', t: `RAO ${f.sheet} · ${f.label}: ${f.kind === 'noap' ? `no appropriation, obligations ₱${money(f.exp)}` : `obligations more than the appropriation by ₱${money(f.over)}`}`, amt: f.kind === 'noap' ? f.exp : f.over });
  });
  statRows(F, scb).forEach((x) => { if (x.diff !== null && x.diff < 0) out.push({ id: `stat-${x.k}`, rule: 'statutory', t: `${x.t}: ₱${money(-x.diff)} less than required (${x.rate}% of ₱${money(x.base)} = ₱${money(x.req)}; ${x.from.toLowerCase()} ₱${money(x.book, { dash: '0.00' })})`, amt: -x.diff }); });
  return out;
}

/* ── The tab ── */
export async function budgetTab({ F, ctx, me, q, base, canEdit: can0 }) {
  const scb = scbOf(F);
  const mem = await loadMem(F.lguId);
  const canEdit = !!can0 && !F.confirmed;
  const dis = canEdit ? '' : 'disabled';
  const rao = scb.rao;
  const flags = raoFlags(rao);
  // sources box
  const fileLine = (src) => { const b = scb[src]; return b ? `<div class="lr-row" style="justify-content:flex-start;gap:6px;margin:6px 0"><span>📄 <b>${esc(b.name)}</b> · ${esc(b.sheet)} · ${b.rows.length} items · column “${esc(b.colHead)}”</span>${canEdit ? `<button class="reset" type="button" data-rmsrc="${src}">Remove</button>` : ''}</div>` : ''; };
  const srcHTML = `<section class="panel" data-transient><div class="panel-head"><h2>Where the amounts come from</h2></div><div class="panel-body">
    <div class="srcbox">
      <div><h3>Annual Budget / Supplemental</h3><p class="hint" style="margin:0 0 6px">Original Budget and Adjustments, for revenue and expenses.</p>${fileLine('ab')}${fileLine('sb')}
        ${canEdit ? `<div class="btn-row"><label class="btn sm primary" for="b-abf">Import Annual Budget</label><label class="btn sm ghost" for="b-sbf">Import Supplemental</label></div><input type="file" id="b-abf" accept=".xlsx,.xls,.xlsm" hidden><input type="file" id="b-sbf" accept=".xlsx,.xls,.xlsm" hidden>` : ''}
        <p class="hint" style="margin:6px 0 0">Or type the amounts in the statement below.</p></div>
      <div><h3>RAO · Registry of Appropriations and Obligations</h3><p class="hint" style="margin:0 0 6px">Appropriations and obligations (Actual) for the expenses. No revenue.</p>
        ${rao ? `<div style="margin:6px 0">📄 <b>${esc(rao.name)}</b> · ${rao.sheets.length} sheets${rao.fileYear ? ` · ${rao.fileYear}` : ''}</div>` : ''}
        ${canEdit ? `<div class="btn-row"><label class="btn sm ${rao ? 'ghost' : 'primary'}" for="b-raof">${rao ? 'Replace' : 'Import RAO Excel'}</label>${rao ? '<button class="btn sm ghost" type="button" data-rmsrc="rao">Remove</button>' : ''}</div><input type="file" id="b-raof" accept=".xlsx,.xls,.xlsm" hidden>` : ''}</div>
      <div><h3>Not available</h3><p class="hint" style="margin:0 0 6px">Tick when the Annual Budget is not at the Audit Team. It is recorded in the Results and becomes a Possible Finding.</p>
        <label class="check" style="min-height:0"><input type="checkbox" id="b-none" ${scb.none ? 'checked' : ''} ${dis}>No Annual Budget at the Audit Team</label></div>
    </div>
    <div class="tbm-row" style="margin-top:10px"><span class="label">Management submitted the Statement of Comparison of Budget and Actual Amounts?</span><div class="seg" role="group" aria-label="SCBAA submitted by management">${[['yes', 'Yes'], ['no', 'No']].map(([k, l]) => `<button type="button" data-scg="${k}" class="${(scbaaNotSubmitted(F.rec) ? 'no' : 'yes') === k ? 'on' : ''}" ${dis}>${l}</button>`).join('')}</div></div>
    ${scbaaNotSubmitted(F.rec) ? '<div class="note warn" style="display:block;font-weight:400"><b>Not submitted.</b> The SCBAA is left out of the audited financial statements (Part 06, the print and Word, the page numbers and the Table of Contents) and is a Possible Finding on the Results tab. The amounts on this tab are still used for the RAO and statutory allocation checks.</div>' : ''}
    <div class="lr-row" style="margin-top:8px"><span class="hint">Revenue is not in the RAO, so it comes from the Annual Budget or is typed. A file is read here and not uploaded; only the amounts are kept.</span>
      <span><label class="btn sm ghost" for="b-pdf">View a PDF beside the entry</label><input type="file" id="b-pdf" accept=".pdf" hidden></span></div></div></section>`;
  // the RAO as read
  let raoHTML = '';
  if (rao) {
    const yearNote = rao.fileYear && rao.fileYear !== F.y ? `<div class="note warn" style="display:block;font-weight:400">The file is for <b>${rao.fileYear}</b>, but this Statement of Comparison of Budget and Actual Amounts is for <b>CY ${F.y}</b>. Import the CY ${F.y} RAO, or remove this one.</div>` : '';
    const goes = (s) => {
      const st = statRowOf(s.name); if (st) return `→ ${esc(st.t)}`;
      const n = s.items.length, placed = s.items.filter((x) => { const p = placeOf(scb, mem, 'rao', s.name, x.label); return p.k && p.how !== 'suggested'; }).length;
      return `<a href="${base}&s=budget&m=${encodeURIComponent('rao:' + s.name)}">${n} item${n > 1 ? 's' : ''} · ${placed === n ? '✓ all placed' : `${placed} placed`}</a>`;
    };
    raoHTML = `${yearNote}<section class="panel"><div class="panel-head"><h2>RAO read from your file</h2><span class="hint" style="margin-left:8px">${esc(rao.name)}</span></div><div class="panel-body">
      <table class="pf raot"><thead><tr><th>Sheet</th><th class="n">Appropriations C.Y.</th><th class="n">Continuing (C.R.O)</th><th class="n">Obligations</th><th class="n">Balance</th><th>Goes to</th></tr></thead><tbody>
      ${rao.sheets.map((s) => s.ok ? `<tr><td><b>${esc(s.name)}</b></td><td class="n">${money(cents(s.total.ap))}</td><td class="n">${money(cents(s.total.cro))}</td><td class="n">${money(cents(s.total.exp))}</td><td class="n">${money(cents(s.total.ap) + cents(s.total.cro) - cents(s.total.exp))}</td><td>${goes(s)}</td></tr>`
        : `<tr><td><b>${esc(s.name)}</b></td><td colspan="4" class="hint">Could not be read: ${esc(s.reason)}</td><td>${pill('Type or skip', 'grey')}</td></tr>`).join('')}</tbody></table>
      <p class="hint" style="margin:8px 0 0">Each sheet's APPROPRIATIONS, C.R.O, EXPENDITURES (obligations) and BALANCE rows are read; each column is one item. Original Budget = current-year plus continuing appropriations; Actual = obligations.</p></div></section>`;
  }
  // matching the items
  const srcs = [];
  if (rao) rao.sheets.filter((s) => s.ok && !statRowOf(s.name)).forEach((s) => srcs.push({ id: 'rao:' + s.name, label: s.name, src: 'rao', sheet: s.name, items: s.items.map((x) => ({ label: x.label, group: x.group, a: cents(x.ap) + cents(x.cro), b: cents(x.exp) })) }));
  ['ab', 'sb'].forEach((k) => { if (scb[k]) srcs.push({ id: k, label: SRC_NAME[k], src: k, sheet: scb[k].sheet, items: scb[k].rows.map((x) => ({ label: x.label, a: cents(x.amt) })) }); });
  let matchHTML = '';
  const cur = srcs.find((x) => x.id === q.get('m')) || srcs[0];
  if (cur) {
    const opts = (sel) => {
      let html = `<option value="">Choose…</option><option value="skip" ${sel === 'skip' ? 'selected' : ''}>Leave out</option>`, open = false;
      SCBAA.forEach((r) => {
        if (r.h) { if (open) html += '</optgroup>'; html += `<optgroup label="${esc(r.h)}">`; open = true; return; }
        html += `<option value="${r.k}" ${r.k === sel ? 'selected' : ''}>${esc(r.t)}</option>`;
      });
      return html + (open ? '</optgroup>' : '');
    };
    const rows = cur.items.map((x, i) => ({ ...x, i, p: placeOf(scb, mem, cur.src, cur.sheet, x.label) }));
    const placed = rows.filter((x) => x.p.k && x.p.how !== 'suggested').length, sugg = rows.filter((x) => x.p.how === 'suggested').length;
    const how = (p) => !p.k ? pill('Choose', 'grey') : p.how === 'suggested' ? pill('Suggested', 'warn') : p.k === 'skip' ? pill('Left out', 'grey') : pill(p.how === 'chosen' ? '✓ Chosen' : p.how === 'remembered' ? '✓ Remembered' : '✓ By name', 'ok');
    // Accordion: items to place first (open), then one group per section of the statement, then the items left out.
    const secOf = {}; let h = '';
    SCBAA.forEach((r) => { if (r.h) h = r.h; else secOf[r.k] = h; });
    const todo = (x) => !x.p.k || x.p.how === 'suggested';
    const gmap = new Map([['todo', { key: 'todo', name: 'To place', rows: [] }], ...[...new Set(Object.values(secOf))].map((n) => [n, { key: n, name: n, rows: [] }]), ['skip', { key: 'skip', name: 'Left out', rows: [], left: true }]]);
    rows.forEach((x) => gmap.get(todo(x) ? 'todo' : x.p.k === 'skip' ? 'skip' : secOf[x.p.k] || 'todo').rows.push(x));
    const groups = [...gmap.values()].filter((g) => g.rows.length).map((g) => ({ ...g, todo: g.key === 'todo' ? g.rows.length : 0, open: g.key === 'todo' || MG_OPEN.has(`${cur.id}|${g.key}`) }));
    matchHTML = `<section class="panel" id="b-match" data-transient><div class="panel-head"><h2>Match the items</h2><span class="hint" style="margin-left:8px">${placed} of ${rows.length} placed</span>
        ${canEdit && sugg ? `<button class="btn sm ghost" type="button" id="b-sugg" style="margin-left:auto">Use the ${sugg} suggestion${sugg > 1 ? 's' : ''}</button>` : ''}</div><div class="panel-body">
      <div class="tabs2">${srcs.map((x) => `<a class="t ${x === cur ? 'on' : ''}" href="${base}&s=budget&m=${encodeURIComponent(x.id)}">${esc(x.label)}</a>`).join('')}</div>
      ${groups.length > 1 ? '<div class="lr-row" style="justify-content:flex-end;margin:6px 0 2px"><button class="reset" type="button" data-mg-all="1">Open all</button><button class="reset" type="button" data-mg-all="0">Close all</button></div>' : ''}
      ${groups.map((g) => `<details class="mgrp" data-mg="${esc(g.key)}" ${g.open ? 'open' : ''}><summary><b>${esc(g.name)}</b><span class="hint">${g.rows.length} item${g.rows.length > 1 ? 's' : ''} · ₱${money(g.rows.reduce((n, x) => n + (x.a || 0), 0), { dash: '0.00' })}</span>${g.todo ? pill(`${g.todo} to place`, 'warn') : pill(g.left ? 'Left out' : '✓ Placed', g.left ? 'grey' : 'ok')}</summary>
      <table class="pf"><colgroup><col><col style="width:130px"><col style="width:130px"><col style="width:300px"><col style="width:110px"></colgroup>
        <thead><tr><th>Item in the ${cur.src === 'rao' ? 'RAO' : esc(SRC_NAME[cur.src])}</th><th class="n">${cur.src === 'rao' ? 'Appropriation' : 'Amount'}</th><th class="n">${cur.src === 'rao' ? 'Obligations' : ''}</th><th>Row of the statement</th><th></th></tr></thead><tbody>
        ${g.rows.map((x) => `<tr><td>${esc(x.label)}${x.group && x.group !== x.label ? `<div class="hint">${esc(x.group)}</div>` : ''}</td><td class="n">${money(x.a, { dash: '-' })}</td><td class="n">${x.b === undefined ? '' : money(x.b, { dash: '-' })}</td>
          <td><select class="sel" style="width:100%" data-place="${x.i}" aria-label="Row for ${esc(x.label)}" ${dis}>${opts(x.p.k)}</select></td><td>${how(x.p)}</td></tr>`).join('')}</tbody></table></details>`).join('')}
      <p class="hint" style="margin:8px 0 0">Matched by name; your choices are remembered for Barangay ${esc(ctx.lgu.name)}, so next year's file matches by itself. Items going to the same row are added together.${cur.src === 'rao' ? ' The statutory sheets (20%, 5%, 1%) go to their row as a whole.' : ''}</p></div></section>`;
  }
  // statutory allocations
  const sr = statRows(F, scb);
  const st = scb.stat || {};
  const statHTML = `<section class="panel" data-transient><div class="panel-head"><h2>Statutory Allocations</h2></div><div class="panel-body">
    <div class="grid-2">${['reg', 'nta'].map((k) => `<div class="field"><label class="label" for="st-${k}">${esc(BASE_NAME[k])}</label><input class="input amt" id="st-${k}" data-stbase="${k}" value="${esc(st[k] ?? '')}" ${k === 'nta' && ntaRow && scbaaLine(ntaRow, scb).ob ? `placeholder="${esc(shown(scbaaLine(ntaRow, scb).ob / 100))} (from the budget)"` : 'placeholder="type the base"'} ${dis}></div>`).join('')}</div>
    <table class="pf"><thead><tr><th>Allocation</th><th>Base</th><th class="n">Required</th><th class="n">In the books</th><th></th></tr></thead><tbody>
    ${sr.map((x) => `<tr><td><b>${esc(x.t)}</b></td><td><select class="sel" data-stuse="${x.k}" ${dis}>${['reg', 'nta'].map((k) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${k === 'reg' ? 'Regular income' : 'NTA share'}</option>`).join('')}</select></td>
      <td class="n">${x.req === null ? '<span class="hint">needs the base</span>' : money(x.req)}</td><td class="n">${x.book === null ? '<span class="hint">not found</span>' : money(x.book, { dash: '0.00' })}${x.from ? `<div class="hint">${esc(x.from)}</div>` : ''}</td>
      <td>${x.diff === null ? '' : x.diff === 0 ? pill('✓', 'ok') : x.diff < 0 ? pill(`₱${money(-x.diff)} less`, 'warn') : pill(`₱${money(x.diff)} more`, 'grey')}</td></tr>`).join('')}</tbody></table>
    <p class="hint" style="margin:8px 0 0">Type the base once (from the Annual Budget). The 5% BDRRMF and the 10% SK are compared with the Subsidy rows of the General Fund trial balance; the others with the final budget in the statement. A shortfall goes to Possible Findings.</p></div></section>`;
  const sideHTML = `<section class="panel"><div class="panel-head"><h2>From the Budget · Possible Findings</h2></div><div class="panel-body ck">${checkHTML(budgetFlags(F).map((f) => ({ st: 'warn', t: f.t })))
    || '<span class="hint">Nothing so far. Flags show here when the RAO or the allocations need a look.</span>'}<p class="hint" style="margin:6px 0 0">They go to Possible Findings on the Results tab.</p></div></section>`;
  void flags;
  const v = afsScreen({ F, ctx, me, q, base, canEdit: can0, mode: 'budget', extra: { top: srcHTML + raoHTML + matchHTML, mid: statHTML, side: sideHTML } });
  return {
    body: v.body,
    mount(root) {
      v.mount(root);
      const mid = cur ? cur.id : '';
      root.querySelectorAll('details.mgrp').forEach((d) => d.addEventListener('toggle', () => { const k = `${mid}|${d.dataset.mg}`; if (d.open) MG_OPEN.add(k); else MG_OPEN.delete(k); }));
      root.querySelectorAll('[data-mg-all]').forEach((b) => b.addEventListener('click', () => root.querySelectorAll('details.mgrp').forEach((d) => { d.open = b.dataset.mgAll === '1'; })));
      const { lgu } = ctx;
      const saveScb = async (patch, what, memPatch) => {
        const rec = (await loadFsRec(F.lguId, F.y)) || { type: 'fs', teamId: ctx.teamId, lguId: F.lguId, year: F.y, auditId: ctx.rec.id };
        const s2 = { rows: {}, ...(rec.scbaa || {}), ...patch };
        Object.keys(s2).forEach((k) => { if (s2[k] === undefined) delete s2[k]; });
        let m2 = mem;
        if (memPatch) {
          m2 = { ...mem, ...memPatch };
          await store.save('letters', raoMapId(F.lguId), { type: 'raomap', teamId: ctx.teamId, lguId: F.lguId, map: m2 }, { silent: true });
        }
        s2.auto = autoLayer(s2, m2);
        await store.save('letters', fsId(F.lguId, F.y), { ...rec, scbaa: s2, savedAt: new Date().toISOString() }, { silent: true });
        if (what) await store.log(what, `${lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
        emitChange('local');
      };
      const stamp = () => ({ at: new Date().toISOString(), by: me.email, byName: me.name });
      const raoIn = $('#b-raof', root);
      if (raoIn) raoIn.onchange = async () => {
        const f = raoIn.files[0]; raoIn.value = ''; if (!f) return;
        try {
          const got = await readRao(f);
          await saveScb({ rao: { name: f.name, ...stamp(), fileYear: got.fileYear, sheets: got.sheets } }, 'imported the RAO for the budget');
          toast(`RAO read: ${got.sheets.filter((s) => s.ok).length} of ${got.sheets.length} sheets.${got.fileYear && got.fileYear !== F.y ? ` The file is for ${got.fileYear}.` : ''}`, got.fileYear && got.fileYear !== F.y ? 'bad' : 'ok');
        } catch (e) { toast(e.message, 'bad'); }
      };
      const budIn = (src) => async (el) => {
        const f = el.files[0]; el.value = ''; if (!f) return;
        let got; try { got = await readBudget(f); } catch (e) { toast(e.message, 'bad'); return; }
        let sh = got.sheets[0], col = defaultCol(sh, F.y);
        if (got.sheets.length > 1 || sh.cols.length > 1) {
          const colOpts = (s, sel) => s.cols.map((c) => `<option value="${c.c}" ${c.c === sel ? 'selected' : ''}>${esc(c.head)} · ${c.n} amounts</option>`).join('');
          const ok = await modal({ title: `${SRC_NAME[src]} · which amounts`, body: `<p class="hint" style="margin:0 0 8px">Choose the sheet and the column with the ${src === 'ab' ? 'budget for' : 'supplemental amounts of'} CY ${F.y}.</p>
              <div class="field"><label class="label" for="bi-sh">Sheet</label><select class="input" id="bi-sh">${got.sheets.map((s, i) => `<option value="${i}">${esc(s.name)} · ${s.rows.length} rows</option>`).join('')}</select></div>
              <div class="field"><label class="label" for="bi-col">Column</label><select class="input" id="bi-col">${colOpts(sh, col)}</select></div>`,
            onOpen: (bg) => { $('#bi-sh', bg).onchange = () => { const s = got.sheets[+$('#bi-sh', bg).value]; $('#bi-col', bg).innerHTML = colOpts(s, defaultCol(s, F.y)); }; },
            buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Use These Amounts', cls: 'primary', value: 'ok', check: (bg) => { sh = got.sheets[+$('#bi-sh', bg).value]; col = +$('#bi-col', bg).value; return true; } }] });
          if (!ok) return;
        }
        const rows = sh.rows.filter((r) => r.vals[col] !== undefined).map((r) => ({ label: r.label, amt: r.vals[col] }));
        await saveScb({ [src]: { name: f.name, ...stamp(), sheet: sh.name, col, colHead: (sh.cols.find((c) => c.c === col) || {}).head || '', rows } }, `imported the ${SRC_NAME[src]} for the budget`);
        toast(`${rows.length} items read. Check where they go under Match the items.`, 'ok');
        location.hash = `${base}&s=budget&m=${src}`;
      };
      const ab = $('#b-abf', root); if (ab) ab.onchange = () => budIn('ab')(ab);
      const sb = $('#b-sbf', root); if (sb) sb.onchange = () => budIn('sb')(sb);
      $$('[data-rmsrc]', root).forEach((b) => { b.onclick = async () => {
        const k = b.dataset.rmsrc, name = k === 'rao' ? 'RAO' : SRC_NAME[k];
        if (!(await confirmBox(`Remove ${name}`, `Remove the amounts read from the ${name}? Amounts typed in the statement stay.`, 'Remove'))) return;
        const map = { ...(scb.map || {}) }; Object.keys(map).forEach((x) => { if (x.startsWith(k + '|')) delete map[x]; });
        await saveScb({ [k]: undefined, map }, `removed the ${name} from the budget`);
      }; });
      $$('[data-scg]', root).forEach((b) => { b.onclick = () => { const no = b.dataset.scg === 'no'; if (no === scbaaNotSubmitted(F.rec)) return;
        saveScb({ notSubmitted: no || undefined }, no ? 'recorded: SCBAA not submitted by management' : 'recorded: SCBAA submitted by management'); }; });
      const nb = $('#b-none', root); if (nb) nb.onchange = () => saveScb({ none: nb.checked || undefined }, nb.checked ? 'recorded: no Annual Budget at the Audit Team' : 'cleared: no Annual Budget at the Audit Team');
      if (cur) {
        const place = async (pairs) => {
          const map = { ...(scb.map || {}) }, memP = {};
          pairs.forEach(([x, k]) => { const key = `${cur.src}|${cur.sheet}|${x.label}`; if (k) { map[key] = k; memP[memKey(cur.src, cur.sheet, x.label)] = k; } else delete map[key]; });
          await saveScb({ map }, '', memP);
        };
        $$('[data-place]', root).forEach((el) => { el.onchange = () => place([[cur.items[+el.dataset.place], el.value]]); });
        const sg = $('#b-sugg', root);
        if (sg) sg.onclick = () => place(cur.items.map((x) => [x, placeOf(scb, mem, cur.src, cur.sheet, x.label)]).filter(([, p]) => p.how === 'suggested').map(([x, p]) => [x, p.k]));
      }
      $$('[data-stbase]', root).forEach((el) => { el.onchange = () => {
        const n = parseAmt(el.value); if (n !== null && isNaN(n)) { toast('Type an amount like 6,339,975.80.', 'bad'); return; }
        saveScb({ stat: { ...(scb.stat || {}), [el.dataset.stbase]: el.value.trim() } }, '');
      }; });
      $$('[data-stuse]', root).forEach((el) => { el.onchange = () => { const s = scb.stat || {}; saveScb({ stat: { ...s, use: { ...(s.use || {}), [el.dataset.stuse]: el.value } } }, ''); }; });
      const pdf = $('#b-pdf', root);
      if (pdf) pdf.onchange = () => {
        const f = pdf.files[0]; pdf.value = ''; if (!f) return;
        const old = document.getElementById('pdfside'); if (old) { URL.revokeObjectURL(old.dataset.url); old.remove(); }
        const url = URL.createObjectURL(f);
        const d = document.createElement('div');
        d.id = 'pdfside'; d.className = 'pdfside'; d.dataset.url = url;
        d.innerHTML = `<div class="bar"><b>${esc(f.name)}</b><span class="hint">on this device only</span><button class="btn sm ghost" type="button">Close</button></div><iframe title="${esc(f.name)}" src="${url}"></iframe>`;
        d.querySelector('button').onclick = () => { URL.revokeObjectURL(url); d.remove(); document.body.classList.remove('has-pdfside'); };
        document.body.appendChild(d); document.body.classList.add('has-pdfside');
      };
    }
  };
}
