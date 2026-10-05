// Possible Findings: what the trial balances and the budget show that may be a finding, each linked to its AOM Library
// template by the Flag Rules (Admin). Add to Findings makes a Draft AOM with the amount filled in.
import { store, newId, emitChange } from '../store.js';
import { esc, toast, modal, pill, $, $$ } from '../ui.js';
import { has } from '../refs.js';
import { nice } from '../format.js';
import { fsId, loadFsRec, money, tbState } from '../fs.js';
import { LINE, normTitle } from '../coa.js';
import { fromTemplate, blankAom, placeholders, SETUP_VAR_NAMES, ST } from '../aom.js';
import { activeTemplates } from './library.js';
import { bdrrmfCheck } from './baarfs.js';
import { budgetFlags } from './fsbudget.js';

export const RULES = [
  { k: 'advances', t: 'Unliquidated cash advances', acc: 'Advances (1-03-03 / 1-03-05)', def: 'OBS-002' },
  { k: 'receivables', t: 'Outstanding receivables', acc: 'Receivables', def: 'OBS-013' },
  { k: 'remit', t: 'Unremitted taxes and contributions', acc: 'Due to BIR, GSIS, Pag-IBIG, PhilHealth', def: 'OBS-004' },
  { k: 'adcost', t: 'Accumulated depreciation more than the cost', acc: 'Property, Plant and Equipment', def: 'OBS-003' },
  { k: 'nodep', t: 'PPE without depreciation', acc: 'Property, Plant and Equipment', def: 'OBS-003' },
  { k: 'payables', t: 'Outstanding payables', acc: 'Accounts Payable and other payables', def: '' },
  { k: 'samecode', t: 'Same code for different accounts', acc: 'The trial balance as submitted', def: '' },
  { k: 'abnormal', t: 'Abnormal balances', acc: 'All accounts', def: '' },
  { k: 'cashonhand', t: 'Cash on hand at year-end', acc: 'Cash – Local Treasury / Collecting Officers', def: '' },
  { k: 'bankrecon', t: 'Cash in bank vs. the bank reconciliation', acc: 'Cash in Bank', def: '' },
  { k: 'change', t: 'Big changes from last year', acc: 'All accounts', def: '' },
  { k: 'bdrrmf', t: 'Unutilized 5% BDRRMF not shown as Trust Liabilities – BDRRMF', acc: 'Trust Liabilities – BDRRMF', def: 'OBS-009' },
  { k: 'rao', t: 'RAO: obligations more than the appropriation, or totals that don\'t add up', acc: 'RAO', def: '' },
  { k: 'statutory', t: 'Statutory allocation less than required', acc: 'Budget and Subsidy', def: '' },
  { k: 'nobudget', t: 'No Annual Budget at the Audit Team', acc: 'Budget', def: '' }
];
export const FLAG_ID = 'flagrules';
export async function loadRules() {
  const r = await store.get('letters', FLAG_ID);
  const saved = r && !r.deleted ? r.data.rules || {} : {};
  return Object.fromEntries(RULES.map((x) => [x.k, saved[x.k] !== undefined ? saved[x.k] : x.def]));
}

/* ── The flags ── */
const contra = (a) => /accumulated|allowance|impairment/i.test(a.title);
// { id, rule, t, d, amt (centavos) | null, zero }
export function computeFlags(F) {
  const out = [];
  const Y = F.figY, P = F.figP;
  if (!Y.any) return out;
  const acc = (k) => F.chart.byKey[k];
  const list = Object.entries(Y.accts).map(([k, v]) => ({ k, v, a: acc(k) })).filter((x) => x.a);
  const sumOf = (xs) => xs.reduce((t, x) => t + x.v, 0);
  const names = (xs) => xs.map((x) => `${x.a.title} ₱${money(x.v, { dash: '0.00' })}`).join(' · ');
  const add = (rule, t, xs, amt, extra = {}) => out.push({ id: `${rule}${extra.sfx ? '-' + extra.sfx : ''}`, rule, t, d: extra.d ?? names(xs), amt, zero: amt === 0, codes: xs.map((x) => x.a.code), ...extra });
  // advances
  const adv = list.filter((x) => /^advances?\b/i.test(x.a.title) && x.v > 0);
  if (adv.length) add('advances', 'Advances not liquidated at year-end', adv, sumOf(adv));
  // receivables
  const rec = list.filter((x) => /receivable/i.test(x.a.title) && !/due from|allowance/i.test(x.a.title) && x.v > 0);
  if (rec.length) add('receivables', 'Receivables outstanding at year-end', rec, sumOf(rec));
  // unremitted
  list.filter((x) => /due to (bir|gsis|pag-?ibig|phil-?health|hdmf)/i.test(x.a.title) && x.v > 0).forEach((x) => add('remit', `${x.a.title} not remitted`, [x], x.v, { sfx: x.a.code }));
  // PPE: accumulated depreciation vs. cost, and PPE without depreciation
  const ppe = list.filter((x) => x.a.line === 'ppe');
  const base = (t) => normTitle(String(t).replace(/accumulated depreciation\s*[-–:]?\s*/i, '')).join(' ');
  const ad = {}; ppe.filter((x) => /accumulated depreciation/i.test(x.a.title)).forEach((x) => { ad[base(x.a.title)] = (ad[base(x.a.title)] || 0) + x.v; });
  ppe.filter((x) => !contra(x.a)).forEach((x) => {
    const d = ad[base(x.a.title)];
    if (d !== undefined && -d > x.v) add('adcost', `Accumulated depreciation more than the cost: ${x.a.title}`, [x], -d - x.v, { sfx: x.a.code, d: `Cost ₱${money(x.v)} · Accumulated depreciation ₱${money(-d)}` });
    if ((d === undefined || d === 0) && x.v > 0 && !/\bland\b|construction in progress|work in progress/i.test(x.a.title)) add('nodep', `No depreciation recorded: ${x.a.title}`, [x], x.v, { sfx: x.a.code });
  });
  // payables (shown even at zero, to delete)
  list.filter((x) => /payable/i.test(x.a.title) && !/due to (bir|gsis|pag|phil|hdmf)/i.test(x.a.title) && x.v >= 0).forEach((x) => add('payables', `${x.a.title} outstanding`, [x], x.v, { sfx: x.a.code }));
  // same code for different accounts (in the files as submitted)
  const byCode = {};
  F.funds.forEach((f) => { const t = F.tb[F.y][f.k]; if (!t || t.none) return; (t.rows || []).filter((r) => !r.del).forEach((r) => { const c = String(r.code || '').trim(); if (!c) return; (byCode[c] = byCode[c] || new Set()).add(normTitle(r.title).join(' ')); }); });
  const dup = Object.entries(byCode).filter(([, s]) => s.size > 1);
  if (dup.length) add('samecode', 'Same code used for different accounts', [], null, { d: dup.map(([c, s]) => `${c} (${s.size} accounts)`).join(' · ') });
  // abnormal balances
  const abn = list.filter((x) => x.v < 0 && !contra(x.a) && !['eq', 'eq_ppa'].includes(x.a.line) && LINE[x.a.line]);
  if (abn.length) add('abnormal', 'Accounts with abnormal balances', abn, null);
  // cash
  const coh = list.filter((x) => /cash\s*[-–]?\s*(local treasury|collecting officer|disbursing officer)|cash on hand|petty cash/i.test(x.a.title) && x.v > 0);
  if (coh.length) add('cashonhand', 'Cash on hand at year-end', coh, sumOf(coh));
  list.filter((x) => /cash in bank/i.test(x.a.title) && x.v > 0).forEach((x) => add('bankrecon', `${x.a.title}: compare with the bank reconciliation`, [x], x.v, { sfx: x.a.code }));
  // big changes
  if (P.any) {
    const keys = new Set([...Object.keys(Y.accts), ...Object.keys(P.accts)]);
    const big = [...keys].map((k) => ({ k, a: acc(k), v: Y.accts[k] || 0, p: P.accts[k] || 0 })).filter((x) => x.a && !/^[45]/.test(x.a.code) && Math.abs(x.v - x.p) >= 1000000 && Math.abs(x.v - x.p) >= Math.abs(x.p) * 0.5)
      .sort((x, y) => Math.abs(y.v - y.p) - Math.abs(x.v - x.p)).slice(0, 8);
    if (big.length) add('change', `Big changes from CY ${F.yp}`, big, null, { d: big.map((x) => `${x.a.title} ₱${money(x.p, { dash: '0.00' })} → ₱${money(x.v, { dash: '0.00' })}`).join(' · ') });
  }
  // BDRRMF
  bdrrmfCheck(Y).filter((c) => c.flag).forEach((c) => out.push({ id: 'bdrrmf', rule: 'bdrrmf', t: c.t, d: '', amt: Y.bdrrmf ? Y.bdrrmf.unutilized : null }));
  // budget
  budgetFlags(F).forEach((f) => out.push({ ...f, d: f.d || '' }));
  return out;
}
const AMT_PH = /TOTAL|BALANCE|AMOUNT/;
const pfOf = (F) => ({ set: {}, del: {}, ...((F.rec && F.rec.pf) || {}) });

/* ── The panel on the Results tab ── */
export async function findingsPanel({ F, ctx, me, base, canEdit }) {
  void base;
  const rules = await loadRules();
  const tpls = await activeTemplates('barangay');
  const tplOf = (code) => tpls.find((t) => t.code === code);
  const pf = pfOf(F);
  const flags = computeFlags(F);
  const inFindings = (f) => (ctx.aoms || []).find((a) => a.data.flag === f.id) || (rules[f.rule] && (ctx.aoms || []).find((a) => a.data.poolCode === rules[f.rule]));
  const live = flags.filter((f) => !pf.set[f.id] && !pf.del[f.id]);
  const aside = flags.filter((f) => pf.set[f.id]);
  const row = (f) => {
    const t = rules[f.rule] ? tplOf(rules[f.rule]) : null, done = inFindings(f);
    return `<tr><td><b>${esc(f.t)}</b>${f.d ? `<div class="hint">${esc(f.d)}</div>` : ''}</td><td class="n">${f.amt === null || f.amt === undefined ? '' : '₱' + money(f.amt, { dash: '0.00' })}</td>
      <td>${t ? `<span class="mono">${esc(t.code)}</span> · ${esc(t.title)}` : '<span class="hint">No template yet</span>'}</td>
      <td><div class="btn-row">${done ? `<a class="pill ok" href="#/audits/${ctx.rec.id}/findings?sel=${done.id}">✓ In Findings</a>`
        : canEdit ? (f.zero ? `<button class="btn sm ghost" type="button" data-pfdel="${esc(f.id)}">Delete</button><span class="hint">no balance</span>`
          : `${t ? `<button class="btn sm primary" type="button" data-pfadd="${esc(f.id)}">Add to Findings</button>` : `<button class="btn sm" type="button" data-pfadd="${esc(f.id)}">Add Blank Finding</button>`}<button class="btn sm ghost" type="button" data-pfset="${esc(f.id)}">Not a finding</button>`) : ''}</div></td></tr>`;
  };
  const body = `<section class="panel" data-transient><div class="panel-head"><h2>Possible Findings</h2><span class="hint" style="margin-left:8px">all funds combined · CY ${F.y}</span></div><div class="panel-body">
    ${!F.figY.any ? '<div class="empty">Runs once the trial balances are entered.</div>' : `<table class="pf"><colgroup><col><col style="width:110px"><col style="width:170px"><col style="width:150px"></colgroup>
      <thead><tr><th>What the trial balance and the budget show</th><th class="n">Amount</th><th>AOM Library</th><th></th></tr></thead>
      <tbody>${live.map(row).join('') || '<tr><td colspan="4"><div class="empty">Nothing flagged.</div></td></tr>'}</tbody></table>`}
    ${aside.length ? `<div style="margin-top:12px"><div class="label">Set aside · not a finding</div>${aside.map((f) => `<div class="lr-row" style="justify-content:flex-start;gap:8px;border-top:1px solid var(--line-2);padding:6px 0"><span><b>${esc(f.t)}</b>${f.amt ? ` ₱${money(f.amt)}` : ''} · “${esc(pf.set[f.id].reason)}” <span class="hint">${esc(nice(pf.set[f.id].byName || pf.set[f.id].by))}</span></span>${canEdit ? `<button class="reset" type="button" data-pfback="${esc(f.id)}">Put back</button>` : ''}</div>`).join('')}</div>` : ''}
    ${Object.keys(pf.del).length && canEdit ? `<div class="hint" style="margin-top:8px">${Object.keys(pf.del).length} with no balance deleted · <button class="reset" type="button" id="pf-undel">Put back</button></div>` : ''}
    <p class="hint" style="margin:8px 0 0">Add to Findings makes a Draft AOM from the template with the amount filled in. For a flag that is not a finding, use Not a finding and give the reason, so only undecided flags stay on the list. The templates are linked to the flags in Admin › Flag Rules${has(me, 'sa') || has(me, 'admin') ? ' (<a href="#/flags">open</a>)' : ''}.</p></div></section>`;
  return {
    body,
    mount(root) {
      const savePf = async (p2, what) => {
        const rec = (await loadFsRec(F.lguId, F.y)) || { type: 'fs', teamId: ctx.teamId, lguId: F.lguId, year: F.y, auditId: ctx.rec.id };
        await store.save('letters', fsId(F.lguId, F.y), { ...rec, pf: p2 }, { silent: true });
        if (what) await store.log(what, `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
        emitChange('local');
      };
      const byId = (id) => flags.find((f) => f.id === id);
      $$('[data-pfset]', root).forEach((b) => { b.onclick = async () => {
        const f = byId(b.dataset.pfset); let reason = '';
        const ok = await modal({ title: 'Not a finding', body: `<p style="margin:0 0 10px;font-size:14px">${esc(f.t)}</p><div class="field"><label class="label" for="pf-r">Why (for example: remitted January 5, OR No. 1234)</label><input class="input" id="pf-r"></div>`,
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Set Aside', cls: 'primary', value: 'ok', check: (bg) => { reason = $('#pf-r', bg).value.trim(); if (!reason) { toast('Please give the reason.', 'bad'); return false; } return true; } }] });
        if (!ok) return;
        await savePf({ ...pf, set: { ...pf.set, [f.id]: { reason, at: new Date().toISOString(), by: me.email, byName: me.name } } }, `set aside a possible finding (${f.t}): ${reason}`);
      }; });
      $$('[data-pfback]', root).forEach((b) => { b.onclick = async () => { const s = { ...pf.set }; delete s[b.dataset.pfback]; await savePf({ ...pf, set: s }, 'put back a possible finding'); }; });
      $$('[data-pfdel]', root).forEach((b) => { b.onclick = async () => { await savePf({ ...pf, del: { ...pf.del, [b.dataset.pfdel]: true } }, ''); }; });
      const ud = $('#pf-undel', root); if (ud) ud.onclick = () => savePf({ ...pf, del: {} }, '');
      $$('[data-pfadd]', root).forEach((b) => { b.onclick = async () => {
        const f = byId(b.dataset.pfadd); const t = rules[f.rule] ? tplOf(rules[f.rule]) : null;
        const now = new Date().toISOString();
        const data = t ? fromTemplate(t) : { ...blankAom(), title: f.t };
        const vars = {}, src = {}, tb = {};
        if (f.amt !== null && f.amt !== undefined) {
          const ph = placeholders(data).filter((n) => !SETUP_VAR_NAMES.includes(n));
          const p = ph.find((n) => AMT_PH.test(n));
          if (p) { vars[p] = { raw: f.amt / 100 }; src[p] = `Trial balance · ${f.d || f.t}`; tb[p] = { amt: f.amt, label: f.d || f.t }; }
        }
        const seq = Math.max(0, ...(ctx.aoms || []).map((a) => a.data.seq || 0)) + 1;
        const id = newId('aom');
        await store.save('aoms', id, { ...data, auditId: ctx.rec.id, teamId: ctx.teamId, lguId: F.lguId, status: ST.DRAFT, flag: f.id, flagCodes: f.codes || [],
          wpData: Object.keys(vars).length ? { file: '(filled in the app)', at: now, by: me.email, vars, tables: {}, src, tb } : null,
          comments: [], history: [{ at: now, by: me.email, action: 'Added to findings from Possible Findings' }], seq, memberId: ctx.audit.memberId || me.id }, { silent: true });
        await store.log('added a finding from Possible Findings', `${ctx.lgu.name} · ${data.title}`, ctx.teamId, me.email);
        toast(`Added to Findings as a Draft AOM: ${data.title}.`, 'ok');
        emitChange('local');
      }; });
    }
  };
}

/* ── Admin › Flag Rules ── */
export async function flagRulesView(refs) {
  const me = refs.me;
  const can = has(me, 'sa') || has(me, 'admin');
  const rules = await loadRules();
  const tpls = await activeTemplates('barangay');
  const body = `<div class="page-head"><div><h1>Flag Rules</h1><p>Which AOM Library template each Possible Finding uses</p></div></div>
    <div class="topnote">The SA or Admin links a flag to a template once; every audit then uses it on the Results tab of the Financial Statements step. A flag with no template is added as a blank finding.</div>
    <section class="panel"><div class="panel-body"><table class="pf"><thead><tr><th>Flag</th><th>Accounts</th><th style="width:380px">AOM Library</th></tr></thead><tbody>
    ${RULES.map((r) => `<tr><td><b>${esc(r.t)}</b></td><td>${esc(r.acc)}</td><td><select class="sel" style="width:100%" data-rule="${r.k}" aria-label="Template for ${esc(r.t)}" ${can ? '' : 'disabled'}>
      <option value="">— none yet —</option>${tpls.map((t) => `<option value="${esc(t.code)}" ${rules[r.k] === t.code ? 'selected' : ''}>${esc(t.code)} · ${esc(t.title)}</option>`).join('')}
      ${rules[r.k] && !tpls.some((t) => t.code === rules[r.k]) ? `<option value="${esc(rules[r.k])}" selected>${esc(rules[r.k])} (not Active in the Library)</option>` : ''}</select></td></tr>`).join('')}</tbody></table></div></section>`;
  return {
    active: '#/flags', crumbs: '<b>Flag Rules</b>', body,
    mount(root) {
      $$('[data-rule]', root).forEach((el) => { el.onchange = async () => {
        const cur = await loadRules(); cur[el.dataset.rule] = el.value;
        await store.save('letters', FLAG_ID, { type: 'flagrules', rules: cur, savedBy: me.email, savedAt: new Date().toISOString() }, { silent: true });
        await store.log('changed the Flag Rules', RULES.find((r) => r.k === el.dataset.rule).t + ' → ' + (el.value || 'none'), '', me.email);
        toast('Saved.', 'ok');
      }; });
    }
  };
}
void tbState;
