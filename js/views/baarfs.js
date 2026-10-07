// BAAR Part 06 · Audited Financial Statements. Two screens:
//   FS Input: each fund's trial balance (current year and the comparative year), matched to the Chart of Accounts.
//   Audited Financial Statements: the five statements built from them, with the budget (SCBAA) and cash flow entries.
import { store, emitChange } from '../store.js';
import { esc, toast, setDirty, confirmBox, modal, pill, $, $$ } from '../ui.js';
import { has } from '../refs.js';
import { nice, longDate, aomNo } from '../format.js';
import { normTitle, rowKey, loadChart, CHART_NAME } from '../coa.js';
import { interChoice, isCombined, keyCode, zeroRow, fundsOf, ALL_FUNDS, tbId, fsId, loadTb, loadFsRec, rememberedChoices, tbState, needsFix, decSide, hasDec, headingCheck, yearFigures,
  posTotals, equityMoves, buildPerf, buildPos, buildScne, buildScf, scfVal, scfFromTb, SCF, scbaaRows, scbaaPrintRows, scbaaLine, inTb, scbaaNotSubmitted,
  money, shown, rawText, parseAmt, cents, amtText } from '../fs.js';
import { readTbFile, readTbPaste } from '../tbimport.js';
import { FS_CSS, stmtHTML, scbaaHTML, scbaaPages, fsPrint, fsSections, fsFileName } from '../baar-fs.js';
import { printPages, saveDocx } from '../baar-doc.js';
import { noteRefs } from '../baar-notes.js';
import { openAddAccount, pickAccount, canEditChart } from './coa.js';
import { acctOf as acctOfKey } from '../coa.js';
import { aomAmount, peso } from '../saor.js';
import { ST, fillText, blockPlain } from '../aom.js';

/* ───────── Data ───────── */
export async function loadFS(ctx) {
  const { audit, lgu } = ctx;
  const lguId = audit.lguId, y = Number(audit.periodTo), yp = y - 1;
  const chart = await loadChart();
  // Trial Balance Used (Setup): per fund, or one consolidated trial balance for all funds.
  const consolidated = audit.tbMode === 'consolidated';
  const perFund = fundsOf(lgu);
  const funds = consolidated ? [ALL_FUNDS] : perFund;
  const tb = { [y]: {}, [yp]: {} };
  for (const f of [...perFund, ALL_FUNDS]) for (const yr of [y, yp]) tb[yr][f.k] = await loadTb(lguId, f.k, yr);
  // The comparative year follows how it was kept: last year's per-fund trial balances stay per fund (added together in the
  // statements), and a consolidated one stays consolidated.
  const hasPer = perFund.some((f) => entered(tb[yp][f.k])), hasAll = entered(tb[yp].ALL);
  const fundsP = consolidated ? (hasAll || !hasPer ? [ALL_FUNDS] : perFund) : (hasPer || !hasAll ? perFund : [ALL_FUNDS]);
  return compute({ ctx, lguId, y, yp, chart, funds, fundsP, consolidated, tb, rec: await loadFsRec(lguId, y), recP: await loadFsRec(lguId, yp) });
}
function compute(F) {
  F.figY = yearFigures(F.tb[F.y], F.funds, F.chart);
  F.figP = yearFigures(F.tb[F.yp], F.fundsP || F.funds, F.chart);
  F.confirmed = !!(F.rec && F.rec.confirmed);
  return F;
}
const entered = (t) => !!t && (t.none || (t.rows || []).length > 0);
// The comparative year came from an earlier BAAR of this barangay (its current year there): you only check it.
const fromPrior = (F, fund) => { const t = F.tb[F.yp][fund]; return !!(t && t.kind === 'current' && t.auditId !== F.ctx.rec.id); };
const scfPriorLocked = (F) => !!(F.recP && F.recP.confirmed && F.recP.auditId !== F.ctx.rec.id);
const tabs = (F) => {
  const fp = F.fundsP || F.funds, same = fp.length === F.funds.length && fp.every((f, i) => f.k === F.funds[i].k);
  const t = (f, yr) => ({ fund: f.k, label: f.label, yr, key: `${f.k}-${yr}`, cmp: yr === F.yp });
  return same ? F.funds.flatMap((f) => [t(f, F.y), t(f, F.yp)]) : [...F.funds.map((f) => t(f, F.y)), ...fp.map((f) => t(f, F.yp))];
};
const tabLabel = (F, x) => `${x.label} · CY ${x.yr}${x.cmp ? ' Comparative (audited)' : ''}`;

// A post-closing trial balance (the heading says so, or it has no revenue or expense accounts) cannot make the statements:
// Financial Performance needs the revenue and expenses, so the pre-closing trial balance is required.
const postClosing = (F, x, t, s) => (t.rows || []).some((r) => !r.del) && (!s.revexp || headingCheck(t, F.ctx.lgu.name, x.yr).post);
function tabStatus(F, x) {
  const t = F.tb[x.yr][x.fund];
  if (!t) return { pill: pill('Not yet', 'grey'), done: false };
  if (t.none) return { pill: pill('Not kept separately', 'grey'), done: true };
  const s = tbState(t, F.chart);
  if (s.fix) return { pill: pill(`${s.fix} to fix`, 'warn'), done: false, s };
  if (!s.balanced) return { pill: pill('Not balanced', 'warn'), done: false, s };
  if (postClosing(F, x, t, s)) return { pill: pill('Post-closing · use pre-closing', 'warn'), done: false, s, post: true };
  return { pill: pill(x.cmp && fromPrior(F, x.fund) ? `✓ From CY ${F.yp} BAAR` : '✓', 'ok'), done: true, s };
}
export { tabs, tabLabel, tabStatus, entered };
export const canConfirm = (F) => tabs(F).every((x) => tabStatus(F, x).done);

// FS Input checks: { st: 'ok'|'warn'|'wait', t }
function inputChecks(F) {
  const out = [], { ctx } = F;
  tabs(F).forEach((x) => {
    const t = F.tb[x.yr][x.fund];
    if (!t || t.none) return;
    const s = tbState(t, F.chart), lab = `${x.label} ${x.yr}${x.cmp ? ' comparative' : ''}`;
    out.push(s.balanced ? { st: 'ok', t: `${lab}: debits equal credits` }
      : { st: 'warn', t: `${lab}: debits and credits are off by ₱${money(Math.abs(s.dr - s.cr))}${s.decOpen ? ' once rounded to centavos' : ''}` });
    const h = headingCheck(t, ctx.lgu.name, x.yr);
    if (h.known) {
      out.push(h.okName && h.okYear ? { st: 'ok', t: `${lab}: heading matches Barangay ${ctx.lgu.name} and ${x.yr}` }
        : { st: 'warn', t: `${lab}: the heading of the file does not show ${!h.okName ? 'Barangay ' + ctx.lgu.name : ''}${!h.okName && !h.okYear ? ' and ' : ''}${!h.okYear ? 'the year ' + x.yr : ''}` });
      if (h.post) out.push({ st: 'warn', t: `${lab}: this is a post-closing trial balance; the statements need the pre-closing one (with revenue and expenses)` });
    }
    if (!s.revexp) out.push({ st: 'warn', t: `${lab}: no revenue or expense accounts; use the pre-closing trial balance` });
    if (s.open) out.push({ st: 'warn', t: `${lab}: ${s.open} account${s.open > 1 ? 's' : ''} to check or match` });
    if (s.decOpen) out.push({ st: 'warn', t: `${lab}: ${s.decOpen} amount${s.decOpen > 1 ? 's' : ''} with more than 2 decimals to check against the books` });
  });
  // For your reference: AOM amounts vs. the account balance of all funds combined.
  const refs = aomRefs(F);
  if (refs.length) {
    if (!F.figY.all) out.push({ st: 'wait', t: 'For your reference, AOM amounts vs. the trial balance (all funds combined): runs when all funds are entered' });
    else refs.forEach((r) => out.push({ st: 'info', t: `For your reference: AOM No. ${r.no} ${peso(r.amt)} · ${r.acct.title} (all funds, CY ${F.y}) ₱${money(F.figY.accts[r.acct.key] || 0, { dash: '0.00' })}` }));
  }
  return out;
}
function interCheck(fig, F) {
  void F;
  if (!fig.all) return [{ st: 'wait', t: 'Combined funds (GF ↔ 5% BDRRMF): runs when all funds are entered' }];
  if (!fig.cancel) return [];
  const out = [];
  if (!fig.interTo && !fig.interFrom) out.push({ st: 'info', t: 'No Subsidy row is set to Combined (GF ↔ 5% BDRRMF), so nothing is cancelled out' });
  else out.push(fig.interTo === fig.interFrom ? { st: 'ok', t: `Subsidy to/from Other Funds ₱${money(fig.interTo)} agrees and cancels out in the combined statements` }
    : { st: 'warn', t: `Subsidy between the funds does not agree: to other funds ₱${money(fig.interTo, { dash: '0.00' })}, from other funds ₱${money(fig.interFrom, { dash: '0.00' })}` });
  if (fig.dueTo || fig.dueFrom) out.push(fig.dueTo === fig.dueFrom ? { st: 'ok', t: `Due to/from Other Funds ₱${money(fig.dueTo)} agrees and cancels out` }
    : { st: 'warn', t: `Due to/from Other Funds does not agree: due to ₱${money(fig.dueTo, { dash: '0.00' })}, due from ₱${money(fig.dueFrom, { dash: '0.00' })}` });
  return out;
}
// The unutilized 5% BDRRMF and Trust Liabilities – BDRRMF in the books.
export function bdrrmfCheck(fig, F) {
  const b = fig.bdrrmf;
  if (!b && F && F.consolidated) return [{ st: 'wait', t: 'Unutilized 5% BDRRMF: not possible, the trial balance is consolidated (check the BDRRMF records)' }];
  if (!b) return [{ st: 'wait', t: 'Unutilized 5% BDRRMF: runs when the 5% BDRRMF trial balance is entered' }];
  if (b.unutilized <= 0) return [{ st: 'ok', t: 'No unutilized 5% BDRRMF balance at year-end' }];
  if (!b.recorded) return [{ st: 'warn', t: `Unutilized 5% BDRRMF ₱${money(b.unutilized)} is not recorded as Trust Liabilities – BDRRMF`, flag: 'bdrrmf' }];
  return b.recorded === b.unutilized ? [{ st: 'ok', t: `Unutilized 5% BDRRMF ₱${money(b.unutilized)} is shown as Trust Liabilities – BDRRMF` }]
    : [{ st: 'warn', t: `Trust Liabilities – BDRRMF ₱${money(b.recorded)} differs from the unutilized 5% BDRRMF ₱${money(b.unutilized)}`, flag: 'bdrrmf' }];
}
// Which chart of accounts management used, counted per account of each trial balance (matched by itself, before corrections).
export function chartUsage(F) {
  const n = { manual: 0, c2015: 0, added: 0, check: 0, ver: 0 };
  [F.y].forEach((yr) => F.funds.forEach((f) => { const t = F.tb[yr][f.k]; if (!t || t.none) return; tbState(t, F.chart).rows.forEach(({ res }) => { if (res.m.st === 'ok') n[res.m.chart]++; else n[res.m.st]++; }); }));
  return n;
}
export function tbResultsHTML(F) {
  const u = chartUsage(F);
  const usage = u.manual + u.c2015 + u.added + u.check + u.ver ? `<div style="font-weight:700;color:var(--navy)">Chart of accounts used by management (CY ${F.y})</div><div>Manual ${u.manual} · COA Circular 2015-009 ${u.c2015}${u.added ? ` · Added ${u.added}` : ''} · Check ${u.check} · For verification ${u.ver}</div>` : '';
  const comb = F.funds.length > 1 ? `<div style="font-weight:700;color:var(--navy);margin-top:6px">Combined Funds</div>${checkHTML([...interCheck(F.figY, F), ...bdrrmfCheck(F.figY, F)])}`
    : F.consolidated ? `<div style="font-weight:700;color:var(--navy);margin-top:6px">Consolidated (All Funds)</div>${checkHTML(bdrrmfCheck(F.figY, F))}` : '';
  const checks = inputChecks(F).filter((c) => !/Combined funds|Subsidy|Due to\/from/.test(c.t));
  return `${usage}${comb}${checks.length ? `<div style="font-weight:700;color:var(--navy);margin-top:6px">Trial balances</div>${checkHTML(checks)}` : ''}` || '<span class="hint">Runs once a trial balance is entered.</span>';
}
// Final AOMs with an amount, and the account their wording names.
function aomRefs(F) {
  const { ctx } = F, out = [];
  (ctx.aoms || []).filter((a) => a.data.status === ST.FINAL).forEach((a) => {
    const amt = aomAmount(a.data); if (amt === null || amt === undefined) return;
    const v = ctx.varsFor(a), topic = (a.data.blocks || []).find((b) => b.type === 'topic') || {};
    const words = new Set(normTitle(`${fillText(a.data.title || '', v)} ${fillText(blockPlain(topic), v)}`));
    let best = null;
    F.chart.list.forEach((acc) => { if (acc.n.length >= 2 && acc.n.every((w) => words.has(w)) && (!best || acc.n.length > best.n.length)) best = acc; });
    if (best) out.push({ no: aomNo(ctx.audit.auditYear, ctx.nums[a.id].n, ctx.audit.periodFrom, ctx.audit.periodTo), amt, acct: best });
  });
  return out;
}

/* ───────── The statements ───────── */
// work: unsaved entries on the screen ({ scfY, scfP, scbaa }); start: the page number of the first statement.
export function fsDoc(F, start, work = {}) {
  const { ctx } = F;
  const fy = F.figY.any ? F.figY : null, fp = F.figP.any ? F.figP : null;
  const scfY = work.scfY || (F.rec && F.rec.scf) || {}, scfP = work.scfP || (F.recP && F.recP.scf) || {};
  const begY = fp ? (fp.lines.cash || 0) : scfY.beg !== undefined && scfY.beg !== '' ? cents(parseAmt(scfY.beg)) : null;
  const begP = scfP.beg !== undefined && scfP.beg !== '' ? cents(parseAmt(scfP.beg)) : null;
  const scbaa = work.scbaa || (F.rec && F.rec.scbaa) || { rows: {} };
  const allRows = scbaaRows(F.figY.accts, F.chart);
  const prows = scbaaPrintRows(allRows, scbaa);
  const noSc = scbaaNotSubmitted(F.rec);
  const nB = noSc ? 0 : scbaaPages(prows).length;
  const s = start || 0;
  const pages = s ? { sfperf: s, sfpos: s + 1, scne: s + 2, scf: s + 3, scbaa: noSc ? null : s + 4, next: s + 4 + nB } : { next: 0 };
  return {
    y: F.y, lgu: ctx.lgu, mun: ctx.mun, pages, allRows, scbaa: { rows: prows, data: scbaa }, noScbaa: noSc,
    stmts: [buildPerf(fy, fp, F.y, noteRefs(F)), buildPos(fy, fp, F.y, noteRefs(F)), buildScne(fy, fp, F.y), buildScf(scfY, scfP, fy, fp, begY, begP, F.y)],
    scfNums: { begY, begP, scfY, scfP }
  };
}
export const fsPageCount = (F) => 4 + (scbaaNotSubmitted(F.rec) ? 0 : scbaaPages(scbaaPrintRows(scbaaRows(F.figY.accts, F.chart), (F.rec && F.rec.scbaa) || { rows: {} })).length);

// Checks of the statements: { st, t } and the status of each statement.
export function afsChecks(F, doc) {
  const out = [], stat = {};
  const [perf, pos, scne, scf] = doc.stmts; void perf; void pos; void scne;
  if (!F.figY.any) { out.push({ st: 'wait', t: `Enter the CY ${F.y} trial balances on the Trial Balance tab first` }); }
  else {
    const fs = tabs(F).map((x) => tbState(F.tb[x.yr][x.fund] && !F.tb[x.yr][x.fund].none ? F.tb[x.yr][x.fund] : null, F.chart));
    const fix = fs.reduce((n, s) => n + s.fix, 0);
    if (fix) out.push({ st: 'warn', t: `The Trial Balance tab still has ${fix} item${fix > 1 ? 's' : ''} to fix` });
    const post = tabs(F).filter((x) => tabStatus(F, x).post).map((x) => `${x.label} CY ${x.yr}${x.cmp ? ' Comparative' : ''}`);
    if (post.length) out.push({ st: 'warn', t: `${post.join(', ')}: post-closing trial balance; import the pre-closing one (with revenue and expenses)` });
    if (!F.confirmed) out.push({ st: 'warn', t: 'Not yet confirmed as submitted (Results tab)' });
    [[F.figY, F.y], [F.figP, F.yp]].forEach(([fig, yr]) => {
      if (!fig.any) return;
      const p = posTotals(fig);
      out.push(p.ta === p.tle ? { st: 'ok', t: `Financial Position ${yr}: assets equal liabilities and net assets/equity` }
        : { st: 'warn', t: `Financial Position ${yr} is off by ₱${money(Math.abs(p.ta - p.tle))}; check the trial balance` });
      if (p.ta !== p.tle) stat.sfpos = 'warn';
    });
    const m = equityMoves(F.figY);
    out.push({ st: 'ok', t: `Surplus for the period ₱${money(m.sur, { dash: '0.00' })} carried to Changes in Net Assets/Equity` });
    if (F.figP.any) {
      const mp = equityMoves(F.figP);
      out.push(mp.dec31 === m.jan1 ? { st: 'ok', t: `Net Assets/Equity January 1, ${F.y} agrees with December 31, ${F.yp}` }
        : { st: 'warn', t: `Net Assets/Equity January 1, ${F.y} (₱${money(m.jan1)}) differs from December 31, ${F.yp} (₱${money(mp.dec31)})` });
      if (mp.dec31 !== m.jan1) stat.scne = 'warn';
    } else out.push({ st: 'wait', t: `Net Assets/Equity January 1 vs. December 31, ${F.yp}: runs when the CY ${F.yp} comparative is entered` });
    [[0, F.figY, F.y], [1, F.figP, F.yp]].forEach(([i, fig, yr]) => {
      const t = scf.totals[i];
      if (!fig.any || !t) return;
      if (t.end === null) { out.push({ st: 'wait', t: `Cash Flows ${yr}: type the cash at the beginning of the year` }); stat.scf = stat.scf || 'grey'; return; }
      const cash = fig.lines.cash || 0;
      if (t.end === cash) out.push({ st: 'ok', t: `Cash Flows ${yr} end with the cash in Financial Position (₱${money(cash)})` });
      else { out.push({ st: 'warn', t: `Cash Flows ${yr}: ₱${money(Math.abs(cash - t.end))} left to explain (end ₱${money(t.end, { dash: '0.00' })} vs. cash ₱${money(cash, { dash: '0.00' })})` }); stat.scf = 'warn'; }
    });
    const typed = doc.allRows.some((r) => !r.h && scbaaLine(r, doc.scbaa.data).typed);
    if (doc.noScbaa) { out.push({ st: 'info', t: 'Budget and Actual: not submitted by management · left out of the audited financial statements (Possible Findings)' }); stat.scbaa = 'none'; }
    else if (!typed) { out.push({ st: 'wait', t: 'Budget and Actual: enter the budget' }); stat.scbaa = 'grey'; }
    else out.push({ st: 'ok', t: `Budget and Actual: ${doc.scbaa.rows.filter((r) => !r.h).length} rows with amounts` });
    if (F.funds.length > 1) out.push(...interCheck(F.figY, F));
    const waitFunds = [...new Set(tabs(F).filter((x) => !entered(F.tb[x.yr][x.fund])).map((x) => x.label))];
    if (waitFunds.length) out.push({ st: 'wait', t: `${waitFunds.join(' and ')}: waiting for the trial balance` });
  }
  const base = !F.figY.any ? 'grey' : !F.confirmed ? 'warn' : 'ok';
  ['sfperf', 'sfpos', 'scne', 'scf', 'scbaa'].forEach((k) => { stat[k] = stat[k] || base; });
  return { out, stat };
}
const STAT_PILL = { ok: ['Ready', 'ok'], warn: ['Check', 'warn'], grey: ['Enter amounts', 'grey'], none: ['Not submitted', 'grey'] };
const stmtPill = (k, s) => pill(k === 'scbaa' && s === 'grey' ? 'Enter budget' : STAT_PILL[s][0], STAT_PILL[s][1]);

// The pill of Part 06 on the parts strip.
export function fsPill(F, start = 1) {
  if (!F.figY.any) return pill('Not Started', 'grey');
  if (!F.confirmed) return pill('Not Confirmed', 'warn');
  const c = afsChecks(F, fsDoc(F, start));
  return c.out.some((x) => x.st === 'warn' || x.st === 'wait') ? pill('In Progress', 'warn') : pill('Ready to Print', 'ok');
}
export const checkHTML = (list) => list.map((c) => `<span class="ck-${c.st}">${c.st === 'ok' ? '✓' : c.st === 'warn' ? '!' : c.st === 'info' ? '•' : '○'} ${esc(c.t)}</span>`).join('');

/* ───────── The screen ───────── */
export async function fsPart({ ctx, me, L, q, head, strip, wireComplete, start }) {
  const F = L.FS;
  const base = `#/baar/${ctx.rec.id}?p=06`;
  const v = afsScreen({ F, ctx, me, q, base, canEdit: false, start, mode: 'baar' });
  return {
    active: '#/baar', crumbs: `<a href="#/baar">BAAR Reports</a> / <a href="#/baar/${ctx.rec.id}">${esc(ctx.title)}</a> / <b>06 · Audited Financial Statements</b>`,
    body: `${head}<section class="panel" style="padding:10px 12px">${strip}</section>${v.body}`,
    mount(root) { wireComplete(root); v.mount(root); }
  };
}

/* ── Trial Balance tab ── */
export function inputScreen({ F, ctx, me, q, base, canEdit }) {
  const all = tabs(F);
  const cur = all.find((x) => x.key === q.get('t')) || all[0];
  const t = F.tb[cur.yr][cur.fund];
  const prior = cur.cmp && fromPrior(F, cur.fund);
  const editable = canEdit && !F.confirmed && !prior;
  const canChart = canEditChart(me);
  const filter = q.get('f') || 'all';
  const s = t && !t.none ? tbState(t, F.chart) : null;
  const link = (x) => `${base}&s=input&t=${x.key}`;
  const tabsHTML = all.map((x) => `<a class="t ${x.key === cur.key ? 'on' : ''}" href="${link(x)}">${esc(tabLabel(F, x))}</a>`).join('');
  let content = '';
  if (prior) content += `<div class="note ok" style="display:block">From the CY ${F.yp} BAAR of Barangay ${esc(ctx.lgu.name)} (final audited figures). You only check it here.</div>`;
  if (!t) {
    content += `<div class="empty">${cur.cmp ? `Enter the CY ${F.yp} audited figures once: import last year's audited trial balance, or paste the rows per account. From next year, the comparative fills in by itself from this BAAR.`
      : 'No trial balance yet. Import the bookkeeper\'s Excel file, or paste the rows.'}</div>`;
  } else if (t.none) {
    content += '<div class="empty">No separate trial balance for this fund.</div>';
  } else {
    // A row the team has corrected counts as Corrected, no longer as Check or For Verification.
    const fixed = (x) => !!(x.r.use && x.res.acct);
    const h = headingCheck(t, ctx.lgu.name, cur.yr);
    const ft = t.file && t.file.totals;
    if (t.rows.length && postClosing(F, cur, t, s)) content += `<div class="note bad" style="display:block"><b>This looks like a post-closing trial balance</b> (${h.post ? 'the heading says Post-Closing' : 'it has no revenue or expense accounts'}). The statements need the <b>pre-closing</b> trial balance, with the revenue and expense accounts. Ask the bookkeeper for it, then Clear this one and import it. Confirm stays locked until then.</div>`;
    content += `<div class="note ${h.known && !(h.okName && h.okYear) ? 'warn' : 'ok'}" style="display:block;font-weight:400">${t.file && t.file.name ? `Imported <b>${esc(t.file.name)}</b>` : 'Pasted rows'}${h.known ? ` · ${esc(h.text)}${h.okName && h.okYear ? ' ✓' : ''}` : ''} · ${t.rows.length} accounts${t.file && t.file.byName ? ` · by ${esc(nice(t.file.byName))}, ${esc(longDate((t.file.at || '').slice(0, 10)))}` : ''}
      ${ft ? `<br><span class="hint">Grand totals in the file: debit ${esc(shown(ft.dr))} · credit ${esc(shown(ft.cr))}</span>` : ''}</div>
      <div class="sumc" style="grid-template-columns:repeat(5,1fr)"><div><b>${s.rows.filter((x) => x.res.m.st === 'ok' && x.res.m.chart === 'manual').length}</b>Manual</div><div><b>${s.rows.filter((x) => x.res.m.st === 'ok' && x.res.m.chart !== 'manual').length}</b>COA Circular 2015-009${s.rows.some((x) => x.res.m.chart === 'added') ? ' / Added' : ''}</div><div><b style="color:var(--warn-ink)">${s.rows.filter((x) => x.res.m.st === 'check' && !fixed(x)).length}</b>Check</div><div><b style="color:var(--bad-ink)">${s.rows.filter((x) => x.res.m.st === 'ver' && !fixed(x)).length}</b>For Verification</div><div><b style="color:var(--ok-ink)">${s.rows.filter(fixed).length}</b>Corrected</div></div>`;
    // Amounts with more than 2 decimals
    const decRows = s.rows.filter((x) => hasDec(x.r.dr) || hasDec(x.r.cr));
    if (decRows.length) {
      const chosen = decRows.filter((x) => !needsFix(x.r)).length;
      content += `<div class="note warn" style="display:block;font-weight:400"><b>${decRows.length} amount${decRows.length > 1 ? 's have' : ' has'} more than 2 decimals.</b> Excel shows them rounded, but the file keeps more decimals, so the totals can be off once they are rounded to centavos. Check each one against the books: click <b>Use</b> to adopt the amount Excel shows, or type the correct amount.
        <table class="tbt" style="margin-top:8px;background:#fff"><thead><tr><th>Account</th><th class="n">Shown in Excel</th><th class="n">In the file</th><th class="n" style="width:290px">Correct amount</th></tr></thead><tbody>
        ${decRows.map(({ r, i }) => { const raw = r[decSide(r)]; const done = !needsFix(r);
          return `<tr><td>${esc(r.title)}</td><td class="n">${esc(shown(raw))}</td><td class="n">${esc(rawText(raw))}</td><td class="n"><span class="fixcell" style="flex-wrap:wrap">
            ${done ? `<input class="input fixin" data-fix="${i}" value="${esc(shown(r.fix))}" aria-label="Correct amount for ${esc(r.title)}" ${editable ? '' : 'disabled'}>${pill('✓ Chosen', 'ok')}${cents(r.fix) !== cents(raw) ? `<span class="hint" style="flex-basis:100%;text-align:right">₱${money(Math.abs(cents(r.fix) - cents(raw)))} ${cents(r.fix) > cents(raw) ? 'more' : 'less'} than shown in Excel</span>` : ''}`
              : `${editable ? `<button class="btn sm" type="button" data-use="${i}">Use ${esc(shown(raw))}</button>` : ''}<input class="input fixin" data-fix="${i}" placeholder="or type" aria-label="Correct amount for ${esc(r.title)}" ${editable ? '' : 'disabled'}>`}</span></td></tr>`; }).join('')}
        </tbody></table>
        <div class="lr-row" style="margin-top:8px;justify-content:flex-start;gap:10px"><b>${chosen} of ${decRows.length} chosen</b><span>With the amounts so far: debits ${money(s.dr)} · credits ${money(s.cr)}</span>${s.balanced ? pill('Balanced', 'ok') : pill(`Off by ₱${money(Math.abs(s.dr - s.cr))}`, 'warn')}<span class="hint">Rows not yet chosen are counted as shown in Excel.</span></div></div>`;
    }
    const rowHTML = ({ r, i, res }) => {
      const m = res.m;
      const hid = (filter === 'open' && !res.open && !needsFix(r)) || (filter === 'check' && (m.st !== 'check' || fixed({ r, res }))) || (filter === 'ver' && (m.st !== 'ver' || fixed({ r, res }))) || (filter === 'fixed' && !fixed({ r, res }));
      let chart = '';
      const a = res.acct;
      // What the file had, shown only when it differs from the account used.
      const same = (x, y) => String(x || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(y || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const inFile = a && (!same(r.code, a.code) || !same(r.title, a.title)) ? `<div class="hint" style="margin-top:3px">In file: ${!same(r.code, a.code) ? esc(r.code) + ' ' : ''}${esc(r.title)}</div>` : '';
      const src = a ? ` <span class="hint">${esc(CHART_NAME[a.chart] || '')}</span>` : '';
      const inter = a && interChoice(r, a) ? `<select class="sel" data-inter="${i}" style="margin-top:4px" aria-label="Subsidy between funds" ${editable ? '' : 'disabled'}><option value="combined" ${isCombined(r, a) ? 'selected' : ''}>Combined (GF ↔ 5% BDRRMF)</option><option value="transfer" ${isCombined(r, a) ? '' : 'selected'}>Transfer to the 10% SK Fund</option></select>` : '';
      const cn = (x) => `${CHART_NAME[x.chart]} · ${x.code} ${x.title}`;
      if (r.use && a) {
        chart = `${pill('✓ Corrected', 'ok')}${src}${r.rem ? ' <span class="hint">remembered from before</span>' : ''}${editable ? ` <button class="reset" type="button" data-undo="${i}">Change</button>` : ''}${inFile}${inter}`;
      } else if (m.st === 'ok' && a) {
        chart = `${pill('✓ Matched', 'ok')}${src}${inFile}${inter}`;
      } else if (m.st === 'check') {
        chart = `${pill('Check', 'warn')}<div class="hint" style="margin:4px 0">${m.acct ? `The code may not have been updated. ${esc(m.acct.code)} is <b>${esc(m.acct.title)}</b> in the ${esc(CHART_NAME[m.acct.chart])}; the title points to <b>${esc(m.sugg.code)} ${esc(m.sugg.title)}</b>.`
          : `Code ${esc(r.code)} is not in the Manual nor in COA Circular 2015-009; the title points to <b>${esc(m.sugg.code)} ${esc(m.sugg.title)}</b>.`}</div>
          ${editable ? `<select class="sel" data-pick="${i}" aria-label="Account for ${esc(r.title)}"><option value="">Choose…</option><option value="${esc(m.sugg.key)}">${esc(cn(m.sugg))} (suggested)</option>${m.sugg2 && m.sugg2 !== m.sugg ? `<option value="${esc(m.sugg2.key)}">${esc(cn(m.sugg2))}</option>` : ''}${m.acct ? `<option value="${esc(m.acct.key)}">Keep the code's account (${esc(m.acct.title)})</option>` : ''}<option value="other">Choose another account…</option></select>` : ''}`;
      } else {
        chart = `${pill('For Verification', 'bad')}<div class="hint" style="margin:4px 0">Not in the Manual nor in COA Circular 2015-009.${m.codeAcct ? ` In the ${esc(CHART_NAME[m.codeAcct.chart])}, ${esc(m.codeAcct.code)} is ${esc(m.codeAcct.title)}.` : ''}${m.sugg ? ` Closest: ${esc(m.sugg.code)} ${esc(m.sugg.title)}.` : ''}</div>
          ${editable && zeroRow(r) ? `<div class="btn-row" style="margin-top:4px"><button class="btn sm" type="button" data-del="${i}">Delete</button></div><div class="hint">Zero balance: delete it from this trial balance.</div>` : ''}
          ${editable && !zeroRow(r) ? `<div class="btn-row" style="margin-top:4px"><button class="btn sm" type="button" data-match="${i}">Match Account</button>${canChart ? `<button class="btn sm ghost" type="button" data-add="${i}">+ Add Account</button>` : ''}</div>${canChart ? '' : '<div class="hint">Only the SA or Admin can add an account to the Chart.</div>'}` : ''}`;
      }
      const cls = res.open ? (m.st === 'ver' ? 'r-bad' : 'r-chk') : '';
      const code = a && !res.open ? a.code : r.code, title = a && !res.open ? a.title : r.title;
      return `<tr class="${cls}" ${hid ? 'hidden' : ''} data-f="${esc((code + ' ' + title + ' ' + r.code + ' ' + r.title).toLowerCase())}"><td class="mono">${esc(code)}</td><td>${esc(title)}</td><td class="n">${esc(shown(r.dr))}</td><td class="n">${esc(shown(r.cr))}</td><td>${chart}</td></tr>`;
    };
    const flink = (f, label) => `<a href="${base}&s=input&t=${cur.key}&f=${f}" class="${filter === f ? 'on' : ''}">${label}</a>`;
    content += `<div class="lr-row"><span class="fl">Showing: ${flink('all', 'All')} · ${flink('open', 'To fix')} · ${flink('check', 'Check')} · ${flink('ver', 'For Verification')} · ${flink('fixed', 'Corrected')}</span><input class="input" id="tb-find" placeholder="Find an account" aria-label="Find an account" style="width:240px;height:34px"></div>
      <div class="tbwrap"><table class="tbt fixed"><colgroup><col style="width:96px"><col><col style="width:106px"><col style="width:106px"><col style="width:250px"></colgroup><thead><tr><th>Code</th><th>Account Title</th><th class="n">Debit</th><th class="n">Credit</th><th>Status</th></tr></thead>
        <tbody>${s.rows.map(rowHTML).join('')}</tbody>
        <tfoot><tr><td></td><td>Totals${s.decOpen ? ' (amounts as shown in Excel)' : ''}</td><td class="n">${money(s.dr)}</td><td class="n">${money(s.cr)}</td><td>${s.balanced ? pill('✓ Balanced', 'ok') : pill(`Off by ₱${money(Math.abs(s.dr - s.cr))}${s.decOpen ? ' after rounding' : ''}`, 'warn')}</td></tr></tfoot></table></div>
      ${s.deleted ? `<div class="lr-row" style="justify-content:flex-start;gap:10px"><span class="hint">${s.deleted} zero-balance row${s.deleted > 1 ? 's' : ''} deleted (${esc(t.rows.filter((r) => r.del).map((r) => r.title).join(', '))})</span>${editable ? '<button class="reset" type="button" id="tb-putback">Put back</button>' : ''}</div>` : ''}`;
  }
  const status = all.map((x) => ({ x, ...tabStatus(F, x) }));
  const statusHTML = `<table class="coat"><colgroup><col style="width:30%"><col><col></colgroup><thead><tr><th>Trial Balance</th><th>CY ${F.y}</th><th>CY ${F.yp} Comparative</th></tr></thead><tbody>
    ${[...new Map(all.map((x) => [x.fund, x.label])).entries()].map(([k, label]) => `<tr><td>${esc(label)}</td>${[F.y, F.yp].map((yr) => { const z = status.find((q) => q.x.fund === k && q.x.yr === yr); return `<td>${z ? z.pill : '<span class="hint">–</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
    <p class="hint" style="margin:8px 0 0">This year, enter the CY ${F.yp} audited figures once: import last year's audited trial balance or paste them per account. From next year, the comparative fills in by itself from this BAAR (final audited figures); you only check it.</p>`;
  const noneBox = cur.fund !== 'GF' && cur.fund !== 'ALL' && editable && (!t || t.none) ? `<label class="check" style="min-height:0"><input type="checkbox" id="tb-none" ${t && t.none ? 'checked' : ''}>No separate trial balance for this fund</label>` : '';
  const body = `<div class="topnote">${F.consolidated ? 'Import the consolidated trial balance (all funds) from the bookkeeper\'s Excel file, or paste it.' : 'Import each fund\'s trial balance from the bookkeeper\'s Excel file, or paste it.'} Accounts are matched to the Manual first, then to COA Circular 2015-009; check the rows marked Check or For Verification.</div>
    <div class="xcols" style="grid-template-columns:minmax(0,1fr) 300px">
      <section class="panel"><div class="panel-head"><h2>Trial Balance</h2></div><div class="panel-body">
        <div class="lr-row" style="align-items:flex-start"><div class="tabs2">${tabsHTML}</div>
          ${editable ? `<span class="btn-row"><label class="btn sm primary" for="tb-file">Import Excel File</label><button class="btn sm ghost" type="button" id="tb-paste">Paste</button>${t && !t.none ? '<button class="btn sm ghost" type="button" id="tb-clear">Clear</button>' : ''}</span>` : ''}</div>
        <input type="file" id="tb-file" accept=".xlsx,.xls,.xlsm" hidden>
        ${noneBox}${content}</div></section>
      <div class="xform">
        <section class="panel"><div class="panel-head"><h2>Entry Status</h2></div><div class="panel-body">${statusHTML}</div></section>
        <section class="panel"><div class="panel-head"><h2>Trial Balance Results</h2></div><div class="panel-body ck">${tbResultsHTML(F)}</div></section>
      </div></div>`;

  return {
    body,
    mount(root) {
      const { audit, lgu } = ctx;
      const id = tbId(F.lguId, cur.fund, cur.yr);
      const save = async (data, what) => {
        await store.save('letters', id, data, { silent: true });
        if (what) await store.log(what, `${lgu.name} · ${tabLabel(F, cur)}`, ctx.teamId, me.email);
        emitChange('local');
      };
      const rows = () => JSON.parse(JSON.stringify(t.rows));
      const put = (rs) => save({ ...t, rows: rs });
      const find = $('#tb-find', root);
      if (find) { find.setAttribute('data-transient', ''); find.oninput = () => { const v = find.value.trim().toLowerCase(); $$('tr[data-f]', root).forEach((r) => { if (v) r.hidden = !r.dataset.f.includes(v); else r.hidden = false; }); }; }
      // Import or paste: the rows, with this barangay's earlier choices put back.
      const take = async (got, file) => {
        if (t && !t.none && t.rows.length && !(await confirmBox('Replace Trial Balance', `Replace the ${t.rows.length} accounts of ${esc(tabLabel(F, cur))} with the ${got.rows.length} in this ${file ? 'file' : 'paste'}? Corrections made before for the same code and title are put back; decimal amounts are checked again.`, 'Replace'))) return;
        const mem = await rememberedChoices(F.lguId);
        const rs = got.rows.map((r) => { const key = rowKey(r); const x = { code: r.code, title: r.title, dr: r.dr, cr: r.cr, key }; if (mem[key] && acctOfKey(F.chart, mem[key])) { x.use = mem[key]; x.rem = true; } return x; });
        await save({ type: 'tb', teamId: ctx.teamId, lguId: F.lguId, fund: cur.fund, year: cur.yr, kind: cur.cmp ? 'comparative' : 'current', auditId: ctx.rec.id,
          file: { name: file ? file.name : '', heading: got.heading, totals: got.totals, at: new Date().toISOString(), by: me.email, byName: me.name }, rows: rs },
          `${file ? 'imported' : 'pasted'} the trial balance`);
        toast(`${rs.length} accounts ${file ? 'imported' : 'pasted'}.`, 'ok');
      };
      const fileIn = $('#tb-file', root);
      if (fileIn) fileIn.onchange = async () => {
        const f = fileIn.files[0]; fileIn.value = ''; if (!f) return;
        try { await take(await readTbFile(f), f); } catch (e) { toast(e.message, 'bad'); }
      };
      const pst = $('#tb-paste', root);
      if (pst) pst.onclick = async () => {
        let text = '';
        const ok = await modal({ title: `Paste · ${tabLabel(F, cur)}`, wide: true,
          body: '<p class="hint" style="margin:0 0 8px">Copy the rows from Excel (account title, account code, debit, credit) and paste them here. Rows without an account code are skipped.</p><textarea class="input" id="tp-text" rows="12" style="font-family:var(--mono);font-size:12px"></textarea>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Use These Rows', cls: 'primary', value: 'ok', check: (bg) => { text = $('#tp-text', bg).value; return !!text.trim(); } }] });
        if (!ok) return;
        try { await take(readTbPaste(text), null); } catch (e) { toast(e.message, 'bad'); }
      };
      const clr = $('#tb-clear', root);
      if (clr) clr.onclick = async () => {
        if (!(await confirmBox('Clear Trial Balance', `Remove the trial balance of ${esc(tabLabel(F, cur))}?`, 'Clear'))) return;
        await store.save('letters', id, { ...t, rows: [] }, { deleted: true, silent: true });
        await store.log('cleared the trial balance', `${lgu.name} · ${tabLabel(F, cur)}`, ctx.teamId, me.email);
        emitChange('local');
      };
      const nb = $('#tb-none', root);
      if (nb) nb.onchange = async () => {
        if (nb.checked) await save({ type: 'tb', teamId: ctx.teamId, lguId: F.lguId, fund: cur.fund, year: cur.yr, kind: cur.cmp ? 'comparative' : 'current', auditId: ctx.rec.id, none: true, rows: [] }, 'marked the fund as having no separate trial balance');
        else { await store.save('letters', id, { ...t }, { deleted: true, silent: true }); emitChange('local'); }
      };
      const choose = async (i, code) => { const rs = rows(); rs[i].use = code; rs[i].key = rowKey(rs[i]); delete rs[i].rem; await put(rs); };
      $$('[data-pick]', root).forEach((el) => { el.onchange = async () => {
        const i = +el.dataset.pick;
        if (el.value === 'other') { const c = await pickAccount({ title: 'Choose Account', hintText: `${t.rows[i].code} · ${t.rows[i].title}`, start: '' }); if (c) await choose(i, c); else el.value = ''; return; }
        if (el.value) await choose(i, el.value);
      }; });
      $$('[data-inter]', root).forEach((el) => { el.onchange = async () => { const rs = rows(); rs[+el.dataset.inter].inter = el.value; await put(rs); }; });
      $$('[data-undo]', root).forEach((b) => { b.onclick = async () => { const rs = rows(); delete rs[+b.dataset.undo].use; delete rs[+b.dataset.undo].rem; await put(rs); }; });
      $$('[data-del]', root).forEach((b) => { b.onclick = async () => {
        const rs = rows(), r = rs[+b.dataset.del];
        r.del = true; await save({ ...t, rows: rs }, `deleted the zero-balance row ${r.code} ${r.title} from`);
      }; });
      const pb = $('#tb-putback', root);
      if (pb) pb.onclick = async () => { const rs = rows(); rs.forEach((r) => { delete r.del; }); await save({ ...t, rows: rs }, 'put back the deleted zero-balance rows of'); };
      $$('[data-match]', root).forEach((b) => { b.onclick = async () => {
        const r = t.rows[+b.dataset.match];
        const c = await pickAccount({ title: 'Match Account', hintText: `${r.code} · ${r.title}`, start: normTitle(r.title)[0] || '' });
        if (c) await choose(+b.dataset.match, c);
      }; });
      $$('[data-add]', root).forEach((b) => { b.onclick = async () => {
        const r = t.rows[+b.dataset.add];
        const a = await openAddAccount({ me, preset: { code: F.chart.M[r.code] || F.chart.A[r.code] || F.chart.D[r.code] ? '' : r.code, title: r.title } });
        if (a) await choose(+b.dataset.add, 'added:' + a.code);
      }; });
      $$('[data-use]', root).forEach((b) => { b.onclick = async () => { const rs = rows(), r = rs[+b.dataset.use]; r.fix = cents(r[decSide(r)]) / 100; await put(rs); }; });
      $$('[data-fix]', root).forEach((el) => { el.onchange = async () => {
        const rs = rows(), r = rs[+el.dataset.fix], n = parseAmt(el.value);
        if (n === null) delete r.fix;
        else if (isNaN(n)) { toast('Type an amount like 37,732.65.', 'bad'); return; }
        else r.fix = Math.round(n * 100) / 100;
        await put(rs);
      }; });
    }
  };
}

/* ── Audited Financial Statements ── */
// mode: 'baar' (Part 06: the confirmed statements, read-only), 'fs' (Statements tab: cash flows entry and the preview),
// 'budget' (Budget tab: where the amounts come from, the RAO, the Budget and Actual entry and the statutory allocations).
export function afsScreen({ F, ctx, me, q, base, canEdit: canEdit0, start, mode = 'baar', extra = null }) {
  const KEYS = [['sfperf', 'Financial Performance'], ['sfpos', 'Financial Position'], ['scne', 'Changes in Net Assets/Equity'], ['scf', 'Cash Flows'], ['scbaa', 'Comparison of Budget and Actual']];
  const canEdit = !!canEdit0 && mode !== 'baar' && !F.confirmed;
  const sel = mode === 'budget' ? 'scbaa' : KEYS.some(([k]) => k === q.get('t')) ? q.get('t') : 'sfperf';
  const tabKey = mode === 'budget' ? 'budget' : 'fs';
  const showAll = q.get('b') === 'all';
  const work = {
    scfY: JSON.parse(JSON.stringify((F.rec && F.rec.scf) || {})),
    scfP: JSON.parse(JSON.stringify((F.recP && F.recP.scf) || {})),
    scbaa: JSON.parse(JSON.stringify((F.rec && F.rec.scbaa) || { rows: {} }))
  };
  work.scbaa.rows = work.scbaa.rows || {};
  const pLock = !canEdit || scfPriorLocked(F);
  const dis = canEdit ? '' : 'disabled';
  const doc0 = fsDoc(F, start, work);
  const missingFunds = tabs(F).filter((x) => !entered(F.tb[x.yr] && F.tb[x.yr][x.fund])).map((x) => `${x.label} CY ${x.yr}${x.cmp ? ' Comparative' : ''}`);
  const fsMode = mode === 'fs', noTb = fsMode && !F.figY.any, showCash = !fsMode || sel === 'scf';
  const fundsLine = F.funds.map((f) => { const t = F.tb[F.y][f.k]; return !entered(t) ? pill(`${f.label} · not yet entered`, 'grey') : t.none ? pill(`${f.label} · no separate trial balance`, 'grey') : pill(`✓ ${f.label}`, 'ok'); }).join(' ');
  // Budget and Actual entry
  const bRows = doc0.allRows;
  const bShow = (r) => r.h || showAll || inTb(r, F.figY.accts) || r.always || scbaaLine(r, work.scbaa).typed;
  const num = (r, f) => { const v = (work.scbaa.rows[r.k] || {})[f]; return v === undefined || v === null ? '' : esc(amtText(v)); };
  const ph = (r, f) => { const a = ((work.scbaa.auto || {})[r.k] || {})[f]; return a === undefined || a === null ? '' : ` placeholder="${esc(shown(a))}"`; };
  const vis = bRows.filter(bShow).filter((r, i, arr) => !r.h || arr.slice(i + 1).findIndex((x) => x.h && (r.sub || !x.sub)) !== 0 && arr.slice(i + 1).some((x) => !x.h));
  const bHTML = vis.map((r) => r.h ? `<tr class="${r.sub ? 'h2' : 'h'}"><td colspan="6">${esc(r.h)}</td></tr>`
    : `<tr><td class="i">${esc(r.t)}${r.extra ? ' <span class="hint">(account in the trial balance)</span>' : ''}</td>
      <td><input class="amt" data-b="${r.k}" data-f="ob" value="${num(r, 'ob')}"${ph(r, 'ob')} aria-label="${esc(r.t)} original budget" ${dis}></td>
      <td><input class="amt" data-b="${r.k}" data-f="adj" value="${num(r, 'adj')}"${ph(r, 'adj')} aria-label="${esc(r.t)} adjustments" ${dis}></td>
      <td class="n" data-bf="${r.k}"></td>
      <td><input class="amt" data-b="${r.k}" data-f="act" value="${num(r, 'act')}"${ph(r, 'act')} aria-label="${esc(r.t)} actual" ${dis}></td>
      <td class="n" data-bd="${r.k}"></td></tr>`).join('');
  // Cash flow entry
  const scfIn = (yrKey, k, locked) => {
    const s = yrKey === 'Y' ? work.scfY : work.scfP, fig = yrKey === 'Y' ? F.figY : F.figP;
    const typed = s[k] !== undefined && s[k] !== null && s[k] !== '';
    const val = typed ? amtText(s[k]) : scfFromTb(s, k) && fig.any ? shown(scfVal(s, k, fig) / 100) : '';
    return `<input class="amt" data-c="${yrKey}" data-k="${k}" value="${esc(val)}" ${locked ? 'disabled' : ''} aria-label="${k} ${yrKey === 'Y' ? F.y : F.yp}">`;
  };
  const cRows = SCF.map((d) => {
    if (d.h) return `<tr class="h"><td colspan="3">${esc(d.h)}</td></tr>`;
    if (d.h2) return `<tr class="h2"><td colspan="3">${esc(d.h2)}</td></tr>`;
    if (d.k) return `<tr><td class="i">${esc(d.t)}${d.from ? ' <span class="chip" data-chip="' + d.k + '">from the trial balance</span>' : ''}</td><td>${scfIn('Y', d.k, !canEdit)}</td><td>${scfIn('P', d.k, pLock)}</td></tr>`;
    return `<tr class="sum"><td>${esc(d.t)}</td><td class="n" data-ct="Y-${d.tot || d.net}"></td><td class="n" data-ct="P-${d.tot || d.net}"></td></tr>`;
  }).join('');
  const begCell = (yrKey) => {
    if (yrKey === 'Y' && F.figP.any) return `<td class="n">${money(F.figP.lines.cash || 0, { dash: '0.00' })} <span class="chip">CY ${F.yp} Financial Position</span></td>`;
    const s = yrKey === 'Y' ? work.scfY : work.scfP, locked = yrKey === 'Y' ? !canEdit : pLock;
    return `<td><input class="amt" data-c="${yrKey}" data-k="beg" value="${esc(amtText(s.beg ?? ''))}" ${locked ? 'disabled' : ''} aria-label="Cash at the beginning ${yrKey === 'Y' ? F.y : F.yp}"></td>`;
  };
  const cashCell = (fig) => (fig.any ? money(fig.lines.cash || 0, { dash: '0.00' }) : 'not yet entered');
  const body = `<style>${FS_CSS}</style>
    ${mode === 'baar' ? `<div class="topnote">The audited financial statements, from the trial balances confirmed in the Financial Statements step. Nothing is typed here.</div>${F.confirmed ? '' : `<div class="note warn" style="display:block">The financial statements are not yet confirmed. <a href="#/audits/${ctx.rec.id}/fs?v=1&s=results">Go to Financial Statements</a></div>`}`
      : mode === 'budget' ? '<div class="topnote">Enter the budget from the Annual Budget, the RAO, or both. Import the Excel file or type the amounts; the files stay on your computer.</div>'
      : `<div class="topnote">The statements are built from the trial balances, all funds combined. Only the cash flow lines are typed here.</div>${missingFunds.length ? `<div class="note warn" style="display:block">Not yet entered: ${esc(missingFunds.join(', '))}. <a href="${base}&s=input">Go to the Trial Balance</a></div>` : ''}`}
    ${extra && extra.top ? extra.top : ''}
    <div class="xcols" style="grid-template-columns:${fsMode ? 'minmax(0,1fr)' : 'minmax(0,1fr) 300px'}">
      <div class="xform">
        <section class="panel"><div class="panel-head"><h2>Statements</h2><span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" type="button" id="f-print">Print</button><button class="btn sm primary" type="button" id="f-word">Word</button></span></div><div class="panel-body">
          ${mode === 'budget' ? '' : `<div class="tabs2" id="f-tabs">${KEYS.map(([k, t]) => `<a class="t ${k === sel ? 'on' : ''}" href="${base}&s=${tabKey}&t=${k}${showAll ? '&b=all' : ''}">${esc(t)} ${noTb ? '' : `<span data-sp="${k}"></span>`}</a>`).join('')}</div>`}
          ${fsMode ? '' : `<div class="lr-row" style="justify-content:flex-start;gap:8px"><span class="hint">Funds combined:</span>${fundsLine}<span class="hint" style="flex-basis:100%">The ${F.yp} column comes from the CY ${F.yp} Comparative trial balance (entered once this year; from next year, taken from last year's BAAR).</span></div>
          <div class="lr-row"><b style="color:var(--navy)">Print View</b><span class="hint" id="f-pg"></span></div>`}
          <div class="paper-wrap big" id="f-paper"></div></div></section>
        ${mode === 'budget' ? `<section class="panel"><div class="panel-head"><h2>Comparison of Budget and Actual Amounts</h2><span class="btn-row" style="margin-left:auto;align-items:center"><span class="hint">Show:</span>
          <div class="seg" role="group" aria-label="Rows shown"><a class="${showAll ? '' : 'on'}" href="${base}&s=${tabKey}&t=${sel}">Accounts in the trial balance</a><a class="${showAll ? 'on' : ''}" href="${base}&s=${tabKey}&t=${sel}&b=all">All rows</a></div>
          ${canEdit ? '<button class="btn sm ghost" type="button" id="b-paste">Paste from Excel</button>' : ''}</span></div><div class="panel-body">
          <table class="ent bud"><colgroup><col style="width:30%"><col><col><col><col><col></colgroup><thead><tr><th>Item</th><th>Original Budget</th><th>Adjustments</th><th>Final Budget</th><th>Actual on comparable basis</th><th>Performance Difference</th></tr></thead><tbody>${bHTML}</tbody></table>
          <label class="check" style="min-height:0"><input type="checkbox" id="b-all" ${work.scbaa.printAll ? '' : 'checked'} ${dis}>Print only the rows with amounts</label>
          <span class="hint">Original Budget: current-year plus continuing appropriations; Adjustments: supplemental budgets; Actual: obligations. Typed amounts take the place of amounts from the RAO. Final Budget and the Difference are computed.</span></div></section>` : ''}
        ${extra && extra.mid ? extra.mid : ''}
        ${fsMode && showCash ? `<section class="panel"><div class="panel-head"><h2>Cash Flows</h2><span class="hint" style="margin-left:8px">all funds combined</span></div><div class="panel-body">
          <table class="ent"><thead><tr><th>Line</th><th>${F.y}</th><th>${F.yp}</th></tr></thead><tbody>${cRows}
            <tr class="h"><td colspan="3">Cash balance</td></tr>
            <tr><td class="i">Cash at the Beginning of the Year</td>${begCell('Y')}${begCell('P')}</tr>
            <tr class="sum"><td>Cash Balance at the End of the Year</td><td class="n" data-ct="Y-end"></td><td class="n" data-ct="P-end"></td></tr>
            <tr><td class="i">Cash in Financial Position</td><td class="n">${cashCell(F.figY)}</td><td class="n">${cashCell(F.figP)}</td></tr>
            <tr class="sum"><td>Left to explain</td><td class="n" data-ct="Y-left"></td><td class="n" data-ct="P-left"></td></tr></tbody></table>
          <p class="hint" style="margin:8px 0 0">Amounts marked "from the trial balance" are a starting point only; change them to the actual cash received or paid. Clear the box to go back to the trial balance amount.${scfPriorLocked(F) ? ` The ${F.yp} column comes from the CY ${F.yp} BAAR.` : ''}</p></div></section>` : ''}
        ${canEdit && mode !== 'baar' && showCash ? `<div class="panel savebar"><span class="save-state saved"><span class="d"></span>All Changes Saved</span><div class="btn-row" style="margin-left:auto"><button class="btn primary" id="f-save" type="button">Save</button></div></div>` : ''}
      </div>
      ${fsMode ? '' : `<div class="xform">
        <section class="panel"><div class="panel-head"><h2>Statement Status</h2></div><div class="panel-body"><table class="coat"><colgroup><col><col style="width:46px"><col style="width:104px"></colgroup><thead><tr><th>Statement</th><th>Page</th><th>Status</th></tr></thead><tbody id="f-status"></tbody></table>
          <p class="hint" style="margin:8px 0 0">${start ? 'Pages continue after Part 05 and go to the Table of Contents by themselves.' : 'Page numbers are given in the BAAR (Part 06).'}</p></div></section>
        ${extra && extra.side ? extra.side : ''}
        <section class="panel"><div class="panel-head"><h2>Statement Results</h2></div><div class="panel-body ck" id="f-checks"></div></section>
      </div>`}</div>`;

  return {
    body,
    mount(root) {
      const { audit, lgu, mun } = ctx;
      let timer = null;
      const draw = () => {
        if (!document.body.contains(root)) return;
        const d = fsDoc(F, start, work);
        const pages = d.pages;
        const idx = { sfperf: 0, sfpos: 1, scne: 2, scf: 3 };
        const html = sel === 'scbaa' && d.noScbaa ? ['<div class="empty" style="padding:40px 20px">Not submitted by management. The Statement of Comparison of Budget and Actual Amounts is left out of the audited financial statements.</div>']
          : sel === 'scbaa' ? scbaaHTML({ ...d.scbaa, y: F.y, lgu, mun, start: pages.scbaa }) : [stmtHTML(d.stmts[idx[sel]], { lgu, mun, page: pages[sel] })];
        $('#f-paper', root).innerHTML = html.map((x) => `<div class="sheet fsheet">${x}</div>`).join('');
        const pgEl = $('#f-pg', root); if (pgEl) pgEl.textContent = !pages[sel] ? '' : sel === 'scbaa' && html.length > 1 ? `Pages ${pages.scbaa}–${pages.scbaa + html.length - 1}` : `Page ${pages[sel]}`;
        const c = afsChecks(F, d);
        const ckEl = $('#f-checks', root); if (ckEl) ckEl.innerHTML = checkHTML(c.out);
        KEYS.forEach(([k]) => { const el = $(`[data-sp="${k}"]`, root); if (el) el.innerHTML = stmtPill(k, c.stat[k]); });
        const stEl = $('#f-status', root); if (stEl) stEl.innerHTML = KEYS.map(([k, t]) => `<tr><td>${esc(t)}</td><td>${!pages[k] ? '–' : k === 'scbaa' && pages.next - pages.scbaa > 1 ? `${pages.scbaa}–${pages.next - 1}` : pages[k]}</td><td>${stmtPill(k, c.stat[k])}</td></tr>`).join('');
        // Budget and Actual computed cells
        bRows.forEach((r) => { if (r.h) return; const x = scbaaLine(r, work.scbaa); const f = $(`[data-bf="${r.k}"]`, root), df = $(`[data-bd="${r.k}"]`, root); if (f) f.textContent = money(x.fin, { dash: '' }); if (df) df.textContent = money(x.diff, { dash: '' }); });
        // Cash flow totals
        const T = d.stmts[3].totals;
        [['Y', T[0], F.figY], ['P', T[1], F.figP]].forEach(([yk, t, fig]) => {
          ['opIn', 'opOut', 'op', 'inIn', 'inOut', 'in', 'fiIn', 'fiOut', 'fi'].forEach((k) => { const el = $(`[data-ct="${yk}-${k}"]`, root); if (el) el.textContent = t ? money(t[k], { dash: '0.00' }) : ''; });
          const e = $(`[data-ct="${yk}-end"]`, root), l = $(`[data-ct="${yk}-left"]`, root);
          if (e) e.textContent = t && t.end !== null ? money(t.end, { dash: '0.00' }) : 'needs the beginning cash';
          if (l) { const left = t && t.end !== null && fig.any ? (fig.lines.cash || 0) - t.end : null; l.textContent = left === null ? '' : money(left, { dash: '0.00' }); l.classList.toggle('bad-t', !!left); }
        });
        SCF.filter((x) => x.from).forEach((x) => { const ch = $(`[data-chip="${x.k}"]`, root); if (ch) ch.hidden = !scfFromTb(work.scfY, x.k); });
      };
      const later = () => { clearTimeout(timer); timer = setTimeout(draw, 120); };
      async function save() {
        const at = new Date().toISOString();
        const recY = (await loadFsRec(F.lguId, F.y)) || { type: 'fs', teamId: ctx.teamId, lguId: F.lguId, year: F.y, auditId: ctx.rec.id };
        await store.save('letters', fsId(F.lguId, F.y), { ...recY, scf: work.scfY, scbaa: work.scbaa, savedAt: at }, { silent: true });
        if (!pLock) {
          const recP = (await loadFsRec(F.lguId, F.yp)) || { type: 'fs', teamId: ctx.teamId, lguId: F.lguId, year: F.yp, cmpFor: ctx.rec.id };
          await store.save('letters', fsId(F.lguId, F.yp), { ...recP, scf: work.scfP, savedAt: at }, { silent: true });
        }
        await store.log('saved the budget and cash flow entries of the financial statements', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
        setDirty(false); toast('Saved.', 'ok'); emitChange('local'); return true;
      }
      const changed = () => { if (!canEdit) return; setDirty(true, save); later(); };
      root.addEventListener('input', (e) => {
        const el = e.target;
        if (el.dataset.b) { const r = work.scbaa.rows[el.dataset.b] = work.scbaa.rows[el.dataset.b] || {}; r[el.dataset.f] = el.value.trim(); if (!r.ob && !r.adj && !r.act) delete work.scbaa.rows[el.dataset.b]; changed(); }
        else if (el.dataset.c) { (el.dataset.c === 'Y' ? work.scfY : work.scfP)[el.dataset.k] = el.value.trim(); changed(); }
      });
      root.addEventListener('change', (e) => {
        const el = e.target;
        if (el.matches('input.amt')) { const n = parseAmt(el.value); if (n !== null && isNaN(n)) { el.classList.add('bad-in'); toast('Type an amount like 1,234.50.', 'bad'); } else el.classList.remove('bad-in'); }
      });
      const ba = $('#b-all', root); if (ba) ba.onchange = () => { work.scbaa.printAll = !ba.checked; changed(); };
      const bp = $('#b-paste', root);
      if (bp) bp.onclick = async () => {
        let text = '';
        const ok = await modal({ title: 'Paste Budget and Actual', wide: true,
          body: '<p class="hint" style="margin:0 0 8px">Copy the rows from Excel: the item, then Original Budget, Adjustments and Actual (or all five columns of the statement). Items are matched by name.</p><textarea class="input" id="bp-text" rows="12" style="font-family:var(--mono);font-size:12px"></textarea>',
          buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Use These Rows', cls: 'primary', value: 'ok', check: (bg) => { text = $('#bp-text', bg).value; return !!text.trim(); } }] });
        if (!ok) return;
        const byName = Object.fromEntries(bRows.filter((r) => !r.h).map((r) => [normTitle(r.t).join(' '), r]));
        let used = 0; const missed = [];
        text.split(/\r?\n/).forEach((line) => {
          const cells = line.split('\t').map((x) => x.trim()); if (!cells[0]) return;
          const r = byName[normTitle(cells[0].replace(/[¹²³⁴⁵\d]+$/, '')).join(' ')];
          const ns = cells.slice(1).map((x) => (x === '' || x === '-' ? '' : x));
          if (!r) { missed.push(cells[0]); return; }
          const [ob, adj, act] = ns.length >= 5 ? [ns[0], ns[1], ns[3]] : [ns[0], ns[1], ns[2]];
          work.scbaa.rows[r.k] = { ob: ob || '', adj: adj || '', act: act || '' }; used++;
        });
        if (used) { await save(); toast(`${used} rows filled.${missed.length ? ` Not matched: ${missed.slice(0, 3).join(', ')}${missed.length > 3 ? '…' : ''}` : ''}`, missed.length ? 'bad' : 'ok'); }
        else toast('No item names matched the rows of the statement.', 'bad');
      };
      const sv = $('#f-save', root); if (sv) sv.onclick = save;
      const docNow = () => fsDoc(F, start, work);
      $('#f-print', root).onclick = async () => {
        const p = fsPrint(docNow()); printPages(p.css, p.html, `BAAR ${audit.auditYear} · ${lgu.name} · 06 Audited Financial Statements`);
        await store.log('printed the audited financial statements', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      $('#f-word', root).onclick = async () => {
        try { toast('Preparing the Word file…'); await saveDocx(await fsSections(docNow()), fsFileName(audit, lgu, mun), 'BAAR Audited Financial Statements'); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log('downloaded the audited financial statements (Word)', `${lgu.name} · ${audit.auditYear}`, ctx.teamId, me.email);
      };
      draw(); setDirty(false, save);
    }
  };
}
