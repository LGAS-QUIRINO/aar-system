// Financial Audit · supporting working papers for the audit foci and the Other Financial Related Issues (C.6).
// Each working paper follows one layout: header, objective, procedures, detail table, conclusion, sign-off.
// The balance comes from the lead schedule (or, for C.6, the linked Due to account) so the working paper always ties to it.
import { esc, toast, modal, $, $$ } from '../ui.js';
import { money, cents, parseAmt } from '../fs.js';
import { printPages } from '../baar-doc.js';
import { loadScript } from '../wp.js';

// Templates by audit focus letter. Anything without its own template uses GENERIC.
const TEMPLATES = {
  a: {
    title: 'Bank Reconciliation Review',
    objective: 'To determine whether the Cash in Bank balance exists, is complete and agrees with the bank balance at year-end, and whether the reconciling items are valid and properly taken up.',
    procedures: [
      'Obtain the Bank Reconciliation Statement (BRS) as at December 31 and the bank statement or bank certification.',
      'Compare the balance per books with the general ledger and the lead schedule.',
      'Trace the balance per bank to the bank statement or confirmation.',
      'Vouch deposits in transit to credits in the following month\'s bank statement.',
      'List the outstanding checks and identify those over six months old (stale) for cancellation.',
      'Verify that book reconciling items (bank charges, interest, errors) were taken up in the books.',
      'Check that the BRS is prepared monthly and submitted on time.'
    ],
    recon: true,
    table: { label: 'Outstanding Checks', cols: [{ t: 'Check No.', type: 'text' }, { t: 'Date', type: 'date' }, { t: 'Payee', type: 'text' }, { t: 'Amount', type: 'amt' }], age: true, stale: 180, tie: false }
  },
  e: {
    title: 'Aging of Cash Advances',
    objective: 'To determine whether cash advances to officers and employees are valid, properly granted and liquidated within the prescribed periods, and whether the balance agrees with the lead schedule.',
    procedures: [
      'Obtain the subsidiary ledgers of cash advances per officer or employee.',
      'Agree the total of the subsidiary ledgers to the general ledger and the lead schedule.',
      'Age each unliquidated cash advance from the date granted to December 31.',
      'Check that no additional cash advance was granted before the previous one was liquidated.',
      'Identify advances not liquidated within the deadlines under COA Circular No. 97-002.',
      'Check whether demand letters were issued for overdue advances.'
    ],
    table: { label: 'Unliquidated Cash Advances', cols: [{ t: 'Officer / Employee', type: 'text' }, { t: 'Purpose', type: 'text' }, { t: 'Date Granted', type: 'date' }, { t: 'Amount', type: 'amt' }], age: true, tie: true }
  },
  f: {
    title: 'Aging and Existence of Other Receivables',
    objective: 'To determine whether Other Receivables exist, are collectible and correctly stated, and whether the balance agrees with the lead schedule.',
    procedures: [
      'Obtain the subsidiary ledgers or schedule of Other Receivables per debtor.',
      'Agree the total of the schedule to the general ledger and the lead schedule.',
      'Age each receivable from the date it arose to December 31.',
      'Examine the supporting documents of significant balances.',
      'Check collection efforts (demand letters) on long-outstanding balances.',
      'Identify dormant balances that may qualify for write-off under COA Circular No. 2016-005.'
    ],
    table: { label: 'Schedule of Other Receivables', cols: [{ t: 'Debtor', type: 'text' }, { t: 'Particulars', type: 'text' }, { t: 'Date', type: 'date' }, { t: 'Amount', type: 'amt' }], age: true, tie: true }
  }
};
const GENERIC = {
  title: 'Analysis of Account Balance',
  objective: 'To determine whether the account balance exists, is complete and correctly stated, and agrees with the lead schedule.',
  procedures: [
    'Obtain the subsidiary ledger or schedule supporting the balance.',
    'Agree the schedule to the general ledger and the lead schedule.',
    'Examine the supporting documents of significant transactions.',
    'Investigate significant changes from the prior year.'
  ],
  table: { label: 'Details of Balance', cols: [{ t: 'Particulars', type: 'text' }, { t: 'Reference', type: 'text' }, { t: 'Amount', type: 'amt' }], tie: true }
};

// Templates for the Other Financial Related Issues (C.6), keyed by C.6 item id.
// Column types: text, date, amt, sel (opts), fixed (pre-filled, not editable) and calc (of: [a, b] → column a less column b).
// months: twelve rows, January to December. due: the calc column total should equal the Due to account balance.
// over: [a, b] flags a row where column b is more than column a.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const REMIT_COLS = [{ t: 'Month', type: 'fixed' }, { t: 'Withheld', type: 'amt' }, { t: 'Remitted', type: 'amt' }, { t: 'Date Remitted', type: 'date' }, { t: 'Unremitted', type: 'calc', of: [1, 2] }];
const GENERAL_COLS = [{ t: 'Particulars', type: 'text' }, { t: 'Reference', type: 'text' }, { t: 'Date', type: 'date' }, { t: 'Amount', type: 'amt' }];
const C6_TEMPLATES = {
  bir: {
    title: 'Withholding and Remittance of Taxes to the BIR',
    objective: 'To determine whether taxes were withheld from the compensation of officials and employees and from payments to suppliers, and whether these were remitted to the Bureau of Internal Revenue (BIR) in full and on time.',
    procedures: [
      'Obtain the monthly remittance returns and proofs of payment to the BIR for the year.',
      'Compare the taxes withheld per payroll and disbursement vouchers with the amounts remitted each month.',
      'Check that the remittances were made within the BIR deadlines (on or before the 10th day of the following month).',
      'Agree the year-end unremitted taxes with the balance of Due to BIR.',
      'Inquire into long-outstanding balances and any penalties or surcharges paid for late remittance.'
    ],
    table: { label: 'Monthly Withholding and Remittances', cols: REMIT_COLS, months: true, due: true }
  },
  gsis: {
    title: 'GSIS and HDMF Contributions and Remittances',
    objective: 'To determine whether the personal and government shares of GSIS and Pag-IBIG (HDMF) contributions and loan amortizations were deducted and remitted in full and on time.',
    procedures: [
      'Obtain the GSIS and Pag-IBIG remittance lists, official receipts and billing statements for the year.',
      'Compare the contributions and loan amortizations deducted per payroll with the amounts remitted each month.',
      'Check that the remittances were made within the prescribed period (within the first ten days of the following month).',
      'Agree the year-end unremitted balance with Due to GSIS and Due to Pag-IBIG.',
      'Inquire into delayed remittances and any interest or penalties charged.'
    ],
    table: { label: 'Monthly Deductions and Remittances (GSIS and HDMF)', cols: REMIT_COLS, months: true, due: true }
  },
  philhealth: {
    title: 'PhilHealth Premium Contributions and Remittances',
    objective: 'To determine whether the personal and government shares of PhilHealth premium contributions were deducted, computed at the prescribed rate and remitted in full and on time.',
    procedures: [
      'Obtain the PhilHealth remittance reports and official receipts for the year.',
      'Check that the premiums were computed at the rate prescribed for the year.',
      'Compare the premiums deducted per payroll plus the government share with the amounts remitted each month.',
      'Check that the remittances were made on time.',
      'Agree the year-end unremitted balance with Due to PhilHealth.'
    ],
    table: { label: 'Monthly Premiums and Remittances', cols: REMIT_COLS, months: true, due: true }
  },
  oda: {
    title: 'Foreign-Assisted Projects / ODA',
    objective: 'To determine whether funds received for foreign-assisted projects or Official Development Assistance were recorded, used for the purposes agreed and reported as required.',
    procedures: [
      'Obtain the agreement or memorandum covering the project and the list of funds received.',
      'Check that the receipts were recorded in the books and deposited.',
      'Examine the disbursements charged to the project for consistency with the agreement.',
      'Determine the status of the project and any unutilized balance.'
    ],
    table: { label: 'Receipts and Utilization', cols: GENERAL_COLS }
  },
  ntf: {
    title: 'NTF-ELCAC Funds',
    objective: 'To determine whether funds received under the National Task Force to End Local Communist Armed Conflict were recorded and used for the programs and activities they were given for.',
    procedures: [
      'Obtain the list of NTF-ELCAC funds received, with the issuing agency and purpose.',
      'Check that the funds were recorded in the books and deposited.',
      'Examine the disbursements charged to the funds against the approved programs and activities.',
      'Determine any unutilized balance and whether it was returned or reported.'
    ],
    table: { label: 'Receipts and Utilization', cols: GENERAL_COLS }
  },
  bdp: {
    title: 'Support to the Barangay Development Program (SBDP)',
    objective: 'To determine whether the LGSP-SBDP funds were received, recorded and used for the projects approved under the Barangay Development Program, and the status of those projects.',
    procedures: [
      'Obtain the list of approved SBDP projects with their allocations.',
      'Check that the funds received were recorded in the books and deposited.',
      'Examine the disbursements for each project against the program of work.',
      'Inspect or confirm the status of each project and any delays.',
      'Determine any unutilized balance and its intended disposition.'
    ],
    table: { label: 'SBDP Projects', cols: [{ t: 'Project', type: 'text' }, { t: 'Allocation', type: 'amt' }, { t: 'Utilized', type: 'amt' }, { t: 'Status', type: 'sel', opts: ['Completed', 'Ongoing', 'Not Started'] }], over: [1, 2] }
  },
  df20: {
    title: '20% Development Fund Utilization',
    objective: 'To determine whether at least 20% of the National Tax Allotment was appropriated for development projects, and whether the projects were implemented and the fund used for its purpose.',
    procedures: [
      'Obtain the Annual Investment Program and the appropriation ordinance for the 20% Development Fund.',
      'Check that the appropriation is at least 20% of the National Tax Allotment for the year.',
      'Compare the projects implemented with the approved list and the amounts used.',
      'Check that no expenses outside the allowed development projects were charged to the fund.',
      'Determine the status of each project and the unutilized balance at year-end.'
    ],
    table: { label: 'Development Projects', cols: [{ t: 'Project', type: 'text' }, { t: 'Appropriation', type: 'amt' }, { t: 'Utilized', type: 'amt' }, { t: 'Status', type: 'sel', opts: ['Completed', 'Ongoing', 'Not Started'] }], over: [1, 2] }
  },
  casuals: {
    title: 'Payments to Casuals, Job Orders, Contractuals and Consultants',
    objective: 'To determine whether payments to casual, job order, contract of service workers and consultants were supported by valid contracts or appointments and accomplishment reports, and charged to the proper account.',
    procedures: [
      'Obtain the list of casual, job order and contract of service workers and consultants for the year.',
      'Check that each payment is supported by an appointment or contract, daily time record and accomplishment report.',
      'Check that the hiring and the services rendered follow the CSC-COA-DBM rules on contract of service and job order workers.',
      'Check that the required taxes were withheld from the payments.',
      'Agree the total payments with the expense accounts in the trial balance.'
    ],
    table: { label: 'Payments Made', cols: [{ t: 'Name', type: 'text' }, { t: 'Nature of Work', type: 'text' }, { t: 'Period Covered', type: 'text' }, { t: 'Amount Paid', type: 'amt' }] }
  },
  ldrrm: {
    title: 'LDRRM Fund and Quick Response Fund',
    objective: 'To determine whether at least 5% of the estimated revenue was set aside for the LDRRM Fund, 30% of it for the Quick Response Fund, and whether the fund was used for its purpose and any unexpended balance transferred to the special trust fund.',
    procedures: [
      'Obtain the LDRRM plan, the appropriation ordinance and the statement of funds utilized.',
      'Check that the LDRRMF is at least 5% of the estimated revenue and that 30% of it is set aside as the QRF.',
      'Examine the disbursements charged to the fund for consistency with the plan.',
      'Check that QRF disbursements were made only upon a declaration of a state of calamity.',
      'Check that the unexpended balance was transferred to the special trust fund (Trust Liabilities – DRRMF).'
    ],
    table: { label: 'Utilization of LDRRMF / QRF', cols: GENERAL_COLS }
  },
  gad: {
    title: 'Gender and Development (GAD) Funds',
    objective: 'To determine whether at least 5% of the total appropriations was set aside for Gender and Development, and whether the GAD Plan and Budget was implemented as approved.',
    procedures: [
      'Obtain the GAD Plan and Budget and the GAD Accomplishment Report for the year.',
      'Check that the GAD budget is at least 5% of the total appropriations.',
      'Compare the activities implemented with those in the approved GAD Plan.',
      'Examine the disbursements charged to GAD for consistency with the plan.'
    ],
    table: { label: 'GAD Activities and Expenses', cols: [{ t: 'Activity', type: 'text' }, { t: 'Reference', type: 'text' }, { t: 'Date', type: 'date' }, { t: 'Amount', type: 'amt' }] }
  }
};
export const wpTemplate = (id) => TEMPLATES[id] || C6_TEMPLATES[id] || GENERIC;

/** A new working paper body from the template of an audit focus or C.6 item. */
export function newBody(id, me) {
  const t = wpTemplate(id), cols = t.table.cols;
  return {
    tpl: TEMPLATES[id] || C6_TEMPLATES[id] ? id : 'generic',
    objective: t.objective,
    procedures: t.procedures.map((x) => ({ t: x, done: false })),
    recon: t.recon ? { bank: '', dit: '', oc: '', other: '' } : null,
    table: { label: t.table.label, cols: cols.map((c) => ({ ...c })), age: !!t.table.age, stale: t.table.stale || 0, tie: !!t.table.tie, due: !!t.table.due, over: t.table.over || null,
      rows: t.table.months ? MONTHS.map((m) => cols.map((c, i) => (i === 0 ? m : ''))) : [] },
    conclusion: '', result: '', notes: '',
    prepBy: (me && (me.name || me.email)) || '', prepAt: new Date().toISOString().slice(0, 10), revBy: '', revAt: ''
  };
}

/* ── Helpers ── */
const amtOf = (v) => { const n = parseAmt(v); return n === null || isNaN(n) ? 0 : cents(n); };
const yearEnd = (F) => new Date(`${F.y}-12-31T00:00:00`);
function ageDays(d, F) {
  const t = new Date(`${d}T00:00:00`); if (!d || isNaN(t)) return null;
  return Math.floor((yearEnd(F) - t) / 86400000);
}
function bucket(days) {
  if (days === null) return '';
  if (days < 0) return 'After year-end';
  if (days <= 90) return '0–90 days';
  if (days <= 180) return '91–180 days';
  if (days <= 365) return '181–365 days';
  if (days <= 3650) return 'Over 1 year';
  return 'Over 10 years';
}
const amtCol = (tb) => tb.cols.findIndex((c) => c.type === 'amt');
const dateCol = (tb) => tb.cols.findIndex((c) => c.type === 'date');
const isNum = (c) => c.type === 'amt' || c.type === 'calc';
// A cell in cents; a calc column is one amount column less another.
const cellAmt = (tb, r, i) => { const c = tb.cols[i]; return c.type === 'calc' ? amtOf(r[c.of[0]]) - amtOf(r[c.of[1]]) : amtOf(r[i]); };
const colTotal = (tb, i) => tb.rows.reduce((s, r) => s + cellAmt(tb, r, i), 0);
const tableTotal = (tb) => { const i = amtCol(tb); return i < 0 ? 0 : colTotal(tb, i); };
const cellText = (tb, r, i) => (isNum(tb.cols[i]) ? money(cellAmt(tb, r, i)) : r[i] || '');
// The balance shown at the top. A C.6 item has one only when a Due to account is linked to it.
const balInfo = (item) => (item.c6 ? (item.due && item.due.length ? { label: `Balance per trial balance (${item.due.map((r) => r.a.title).join(', ')})`, v: item.cy || 0 } : null) : { label: 'Balance per lead schedule', v: item.cy || 0 });
function reconFigures(b, bookBal) {
  const r = b.recon; if (!r) return null;
  const adj = amtOf(r.bank) + amtOf(r.dit) - amtOf(r.oc) + amtOf(r.other);
  return { adj, book: bookBal, diff: adj - bookBal };
}
// The outstanding checks listed should total the "Less: Outstanding checks" figure.
function checks(b, item) {
  const out = [];
  const tb = b.table, tot = tableTotal(tb);
  if (tb.tie && tb.rows.length) out.push(tot === (item.cy || 0) ? { ok: true, t: `${tb.label} agrees with the lead schedule balance.` } : { ok: false, t: `${tb.label} total differs from the lead schedule by ${money(tot - (item.cy || 0), { paren: false })}.` });
  const rf = reconFigures(b, item.cy || 0);
  if (rf && b.recon.bank !== '') out.push(rf.diff === 0 ? { ok: true, t: 'Adjusted bank balance agrees with the balance per books.' } : { ok: false, t: `Adjusted bank balance differs from the books by ${money(rf.diff, { paren: false })}.` });
  if (rf && b.recon.oc !== '' && tb.rows.length && tot !== amtOf(b.recon.oc)) out.push({ ok: false, t: `Listed outstanding checks (${money(tot)}) do not equal the outstanding checks in the reconciliation (${money(amtOf(b.recon.oc))}).` });
  // Remittances: the year-end unremitted total should equal the Due to balance.
  const ci = tb.cols.findIndex((c) => c.type === 'calc');
  if (tb.due && ci >= 0 && tb.rows.some((r) => tb.cols.some((c, i) => c.type === 'amt' && String(r[i] || '').trim()))) {
    const un = colTotal(tb, ci), names = (item.due || []).map((r) => r.a.title).join(' and ');
    if (item.due && item.due.length) out.push(un === (item.cy || 0) ? { ok: true, t: `Unremitted total agrees with the ${names} balance.` } : { ok: false, t: `Unremitted total (${money(un)}) differs from the ${names} balance (${money(item.cy || 0)}) by ${money(un - (item.cy || 0), { paren: false })}.` });
    else out.push(un === 0 ? { ok: true, t: 'Everything withheld was remitted; no Due to balance is in the trial balance.' } : { ok: false, t: `Unremitted total of ${money(un)}, but no matching Due to balance is in the trial balance.` });
    const late = tb.rows.filter((r) => cellAmt(tb, r, ci) < 0).length;
    if (late) out.push({ ok: false, t: `${late} month${late > 1 ? 's show' : ' shows'} more remitted than withheld; check for catch-up remittances or errors.` });
  }
  if (tb.over) {
    const [a, u] = tb.over, n = tb.rows.filter((r) => amtOf(r[u]) > amtOf(r[a])).length;
    if (n) out.push({ ok: false, t: `${n} row${n > 1 ? 's' : ''} used more than ${tb.cols[a].t.toLowerCase()}.` });
  }
  return out;
}
function staleCheck(b, F) {
  const tb = b.table, di = dateCol(tb); if (!tb.stale || di < 0) return null;
  const n = tb.rows.filter((r) => (ageDays(r[di], F) ?? 0) > tb.stale).length;
  return n ? { ok: false, t: `${n} check${n > 1 ? 's are' : ' is'} over six months old (stale) and should be cancelled and taken up in the books.` } : null;
}

/* ── The working paper as a printable sheet (also used for the read-only view) ── */
function sheetHTML(w, item, F, ctx) {
  const b = w.wpb, tb = b.table, di = dateCol(tb);
  const rf = reconFigures(b, item.cy || 0), bal = balInfo(item), tot = tb.cols.some(isNum);
  return `<div class="wps">
    <table class="wps-head"><tr><td>Barangay ${esc(ctx.lgu.name)}, ${esc(ctx.mun.name)}, Quirino</td><td class="n"><b>${esc(w.ref)}</b></td></tr>
      <tr><td>${esc(w.title)} · ${esc(item.title)}</td><td class="n">CY ${esc(F.y)}</td></tr></table>
    ${bal ? `<p><b>${esc(bal.label)}:</b> ${money(bal.v)}</p>` : ''}
    <h4>Objective</h4><p>${esc(b.objective)}</p>
    <h4>Procedures Performed</h4><ol>${b.procedures.map((p) => `<li>${p.done ? '✓ ' : ''}${esc(p.t)}</li>`).join('')}</ol>
    ${rf ? `<h4>Bank Reconciliation</h4><table class="pf"><tbody>
      <tr><td>Balance per bank</td><td class="n">${money(amtOf(b.recon.bank))}</td></tr>
      <tr><td>Add: Deposits in transit</td><td class="n">${money(amtOf(b.recon.dit))}</td></tr>
      <tr><td>Less: Outstanding checks</td><td class="n">${money(amtOf(b.recon.oc))}</td></tr>
      <tr><td>Add/(Less): Other reconciling items</td><td class="n">${money(amtOf(b.recon.other))}</td></tr>
      <tr style="font-weight:700"><td>Adjusted balance per bank</td><td class="n">${money(rf.adj)}</td></tr>
      <tr><td>Balance per books</td><td class="n">${money(rf.book)}</td></tr>
      <tr style="font-weight:700"><td>Difference</td><td class="n">${money(rf.diff, { dash: '0.00' })}</td></tr></tbody></table>` : ''}
    <h4>${esc(tb.label)}</h4>
    ${tb.rows.length ? `<table class="pf"><thead><tr>${tb.cols.map((c) => `<th class="${isNum(c) ? 'n' : ''}">${esc(c.t)}</th>`).join('')}${tb.age && di >= 0 ? '<th>Age</th>' : ''}</tr></thead><tbody>
      ${tb.rows.map((r) => `<tr>${tb.cols.map((c, i) => `<td class="${isNum(c) ? 'n' : ''}">${esc(cellText(tb, r, i))}</td>`).join('')}${tb.age && di >= 0 ? `<td>${esc(ageLabel(r[di], tb, F))}</td>` : ''}</tr>`).join('')}
      ${tot ? `<tr style="font-weight:700">${tb.cols.map((c, i) => `<td class="${isNum(c) ? 'n' : ''}">${i === 0 ? 'Total' : isNum(c) ? money(colTotal(tb, i)) : ''}</td>`).join('')}${tb.age && di >= 0 ? '<td></td>' : ''}</tr>` : ''}
    </tbody></table>` : '<p class="hint">No details entered.</p>'}
    <h4>Conclusion</h4><p>${b.result ? `<b>${esc(b.result)}.</b> ` : ''}${esc(b.conclusion || '—')}</p>
    ${b.notes ? `<h4>Notes</h4><p>${esc(b.notes)}</p>` : ''}
    <table class="wps-sign"><tr><td>Prepared by: <b>${esc(b.prepBy || '')}</b><br>Date: ${esc(b.prepAt || '')}</td><td>Reviewed by: <b>${esc(b.revBy || '')}</b><br>Date: ${esc(b.revAt || '')}</td></tr></table>
  </div>`;
}
function ageLabel(d, tb, F) {
  const days = ageDays(d, F); if (days === null) return '';
  const st = tb.stale && days > tb.stale ? ' · Stale' : '';
  return bucket(days) + st;
}

/* ── The editor ── */
/**
 * Opens a supporting working paper. Resolves with the updated body, or null if closed without saving.
 */
export async function openWp({ w, item, F, ctx, me, canEdit }) {
  if (!w.wpb) w = { ...w, wpb: newBody(item.id, me) };
  const b = JSON.parse(JSON.stringify(w.wpb));
  const tb = b.table, di = dateCol(tb), bal = balInfo(item);
  const RESULTS = ['No exceptions noted', 'With exception – for AOM'];

  const drawRows = (bg) => {
    $('#wp-rows', bg).innerHTML = tb.rows.map((r, ri) => `<tr>${tb.cols.map((c, ci) => `<td>${cellInput(r, ri, c, ci)}</td>`).join('')}
      ${tb.age && di >= 0 ? `<td class="hint wp-age" data-age="${ri}">${esc(ageLabel(r[di], tb, F))}</td>` : ''}
      <td><button class="x sm" type="button" data-wrm="${ri}" aria-label="Remove row">✕</button></td></tr>`).join('')
      || `<tr><td colspan="${tb.cols.length + 2}" class="hint" style="padding:10px 4px">No rows yet. Add one below.</td></tr>`;
    drawChecks(bg);
  };
  const cellInput = (r, ri, c, ci) => {
    if (c.type === 'fixed') return `<span class="wp-fixed">${esc(r[ci] || '')}</span>`;
    if (c.type === 'calc') return `<span class="wp-calc" data-calc="${ri}:${ci}"></span>`;
    if (c.type === 'sel') return `<select class="sel wp-in" data-wr="${ri}:${ci}" aria-label="${esc(c.t)}"><option value=""></option>${c.opts.map((o) => `<option ${o === r[ci] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `<input class="input wp-in ${c.type === 'amt' ? 'n' : ''}" ${c.type === 'date' ? 'type="date"' : ''} data-wr="${ri}:${ci}" value="${esc(r[ci] || '')}" aria-label="${esc(c.t)}">`;
  };
  const drawChecks = (bg) => {
    $$('[data-wtot]', bg).forEach((x) => { x.textContent = money(colTotal(tb, +x.dataset.wtot), { dash: '0.00' }); });
    $$('[data-calc]', bg).forEach((x) => { const [ri, ci] = x.dataset.calc.split(':').map(Number); if (tb.rows[ri]) x.textContent = money(cellAmt(tb, tb.rows[ri], ci), { dash: '0.00' }); });
    const rf = reconFigures(b, item.cy || 0);
    if (rf) { $('#wp-adj', bg).textContent = money(rf.adj, { dash: '0.00' }); $('#wp-diff', bg).textContent = money(rf.diff, { dash: '0.00' }); }
    const c = checks(b, item); const st = staleCheck(b, F); if (st) c.push(st);
    $('#wp-checks', bg).innerHTML = c.length ? c.map((x) => `<span class="${x.ok ? 'ck-ok' : 'ck-warn'}">${x.ok ? '✓' : '!'} ${esc(x.t)}</span>`).join('') : '<span class="hint">Checks appear once figures are entered.</span>';
  };

  const field = (id, label, val, type = 'text') => `<div class="field"><label class="label" for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(val || '')}"></div>`;
  const body = `<div class="wp-ed">
    <div class="wp-ed-top"><div><span class="hint">Barangay ${esc(ctx.lgu.name)}, ${esc(ctx.mun.name)} · CY ${esc(F.y)}</span><div><b>${esc(item.title)}</b></div></div>
      ${bal ? `<div class="wp-bal"><span>${esc(bal.label)}</span><b>${money(bal.v, { dash: '0.00' })}</b></div>` : ''}</div>
    <div class="field"><label class="label" for="wp-obj">Objective</label><textarea class="input wp-ta" id="wp-obj" rows="3">${esc(b.objective)}</textarea></div>
    <div class="field"><span class="label">Procedures Performed</span><div class="wp-procs">${b.procedures.map((p, i) => `<label class="check"><input type="checkbox" data-wp="${i}" ${p.done ? 'checked' : ''}><span>${esc(p.t)}</span></label>`).join('')}</div></div>
    ${b.recon ? `<div class="field"><span class="label">Bank Reconciliation</span><table class="pf wp-recon"><tbody>
      <tr><td>Balance per bank</td><td><input class="input n" data-rc="bank" value="${esc(b.recon.bank)}" aria-label="Balance per bank"></td></tr>
      <tr><td>Add: Deposits in transit</td><td><input class="input n" data-rc="dit" value="${esc(b.recon.dit)}" aria-label="Deposits in transit"></td></tr>
      <tr><td>Less: Outstanding checks</td><td><input class="input n" data-rc="oc" value="${esc(b.recon.oc)}" aria-label="Outstanding checks"></td></tr>
      <tr><td>Add/(Less): Other reconciling items</td><td><input class="input n" data-rc="other" value="${esc(b.recon.other)}" aria-label="Other reconciling items"></td></tr>
      <tr class="tot"><td>Adjusted balance per bank</td><td class="n" id="wp-adj"></td></tr>
      <tr><td>Balance per books (lead schedule)</td><td class="n">${money(item.cy || 0, { dash: '0.00' })}</td></tr>
      <tr class="tot"><td>Difference</td><td class="n" id="wp-diff"></td></tr></tbody></table></div>` : ''}
    <div class="field"><span class="label">${esc(tb.label)}</span>
      <div class="wp-tbl"><table class="pf"><thead><tr>${tb.cols.map((c) => `<th class="${isNum(c) ? 'n' : ''}">${esc(c.t)}</th>`).join('')}${tb.age && di >= 0 ? '<th>Age at Dec 31</th>' : ''}<th></th></tr></thead>
        <tbody id="wp-rows"></tbody>
        ${tb.cols.some(isNum) ? `<tfoot><tr class="tot">${tb.cols.map((c, i) => `<td class="${isNum(c) ? 'n' : ''}" ${isNum(c) ? `data-wtot="${i}"` : ''}>${i === 0 ? 'Total' : ''}</td>`).join('')}${tb.age && di >= 0 ? '<td></td>' : ''}<td></td></tr></tfoot>` : ''}</table></div>
      <button class="reset" type="button" id="wp-addrow">+ Row</button></div>
    <div class="ck" id="wp-checks"></div>
    <div class="field"><span class="label">Conclusion</span>
      <div class="seg" role="group" aria-label="Result">${RESULTS.map((r) => `<button type="button" data-res="${esc(r)}" class="${b.result === r ? 'on' : ''}">${esc(r)}</button>`).join('')}</div>
      <textarea class="input wp-ta" id="wp-conc" rows="3" placeholder="e.g. The balance of Cash in Bank is fairly stated.">${esc(b.conclusion)}</textarea></div>
    <div class="field"><label class="label" for="wp-notes">Notes (optional)</label><textarea class="input wp-ta" id="wp-notes" rows="2">${esc(b.notes)}</textarea></div>
    <div class="grid-2">${field('wp-pb', 'Prepared by', b.prepBy)}${field('wp-pa', 'Date', b.prepAt, 'date')}${field('wp-rb', 'Reviewed by', b.revBy)}${field('wp-ra', 'Date', b.revAt, 'date')}</div>
    <div class="btn-row" style="margin-top:6px"><button class="btn sm ghost" type="button" id="wp-print">Print</button><button class="btn sm ghost" type="button" id="wp-xl">Download Excel</button></div>
  </div>`;

  const read = (bg) => {
    b.objective = $('#wp-obj', bg).value.trim(); b.conclusion = $('#wp-conc', bg).value.trim(); b.notes = $('#wp-notes', bg).value.trim();
    b.prepBy = $('#wp-pb', bg).value.trim(); b.prepAt = $('#wp-pa', bg).value; b.revBy = $('#wp-rb', bg).value.trim(); b.revAt = $('#wp-ra', bg).value;
  };

  if (!canEdit) {
    await modal({ title: `${w.ref} · ${w.title}`, wide: true, body: sheetHTML({ ...w, wpb: b }, item, F, ctx), buttons: [{ label: 'Close', cls: 'ghost', value: null }] });
    return null;
  }

  const res = await modal({ title: `${w.ref} · ${w.title}`, wide: true, body,
    onOpen: (bg) => {
      $('.modal', bg).classList.add('wp-modal');
      drawRows(bg);
      $('#wp-addrow', bg).onclick = () => { tb.rows.push(tb.cols.map(() => '')); drawRows(bg); const last = $('#wp-rows tr:last-child [data-wr]', bg); if (last) last.focus(); };
      bg.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset.wr) { const [ri, ci] = t.dataset.wr.split(':').map(Number); tb.rows[ri][ci] = t.value; if (ci === di) { const a = $(`[data-age="${ri}"]`, bg); if (a) a.textContent = ageLabel(t.value, tb, F); } drawChecks(bg); }
        else if (t.dataset.rc) { b.recon[t.dataset.rc] = t.value; drawChecks(bg); }
      });
      bg.addEventListener('change', (e) => { const t = e.target; if (t.dataset.wp !== undefined) b.procedures[+t.dataset.wp].done = t.checked; });
      bg.addEventListener('click', (e) => {
        const t = e.target;
        if (t.dataset.wrm !== undefined) { tb.rows.splice(+t.dataset.wrm, 1); drawRows(bg); }
        else if (t.dataset.res !== undefined) { b.result = b.result === t.dataset.res ? '' : t.dataset.res; $$('[data-res]', bg).forEach((x) => x.classList.toggle('on', x.dataset.res === b.result)); }
      });
      $('#wp-print', bg).onclick = () => { read(bg); printWp({ ...w, wpb: b }, item, F, ctx); };
      $('#wp-xl', bg).onclick = () => { read(bg); excelWp({ ...w, wpb: b }, item, F, ctx); };
    },
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Save Working Paper', cls: 'primary', value: 'ok', check: (bg) => {
      read(bg);
      tb.rows = tb.rows.filter((r) => r.some((x) => String(x || '').trim()));
      if (b.result && !b.conclusion) { toast('Write the conclusion for the result you picked.', 'bad'); return false; }
      return true;
    } }] });
  return res ? b : null;
}

/* ── Print and Excel ── */
const PRINT_CSS = '.wps{font:11pt "Times New Roman",serif}.wps h4{margin:14px 0 4px;font-size:11pt}.wps p{margin:4px 0}.wps table{width:100%;border-collapse:collapse}.wps td,.wps th{border-bottom:1px solid #999;padding:3px 4px;text-align:left;vertical-align:top}.wps .n{text-align:right}.wps-head td{border:0;padding:0}.wps-sign{margin-top:28px}.wps-sign td{border:0;width:50%}.hint{color:#666}';
export function printWp(w, item, F, ctx) {
  printPages(PRINT_CSS, `<div class="pg">${sheetHTML(w, item, F, ctx)}</div>`, `${w.ref} · ${ctx.lgu.name}`);
}
export async function excelWp(w, item, F, ctx) {
  const XLSX = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const b = w.wpb, tb = b.table, di = dateCol(tb), bal = balInfo(item);
  const aoa = [[`Barangay ${ctx.lgu.name}, ${ctx.mun.name}, Quirino`, '', '', w.ref], [`${w.title} · ${item.title}`, '', '', `CY ${F.y}`], [],
    ...(bal ? [[bal.label, bal.v / 100], []] : []), ['OBJECTIVE'], [b.objective], [], ['PROCEDURES PERFORMED'],
    ...b.procedures.map((p, i) => [`${i + 1}. ${p.t}`, p.done ? 'Done' : '']), []];
  const rf = reconFigures(b, item.cy || 0);
  if (rf) aoa.push(['BANK RECONCILIATION'], ['Balance per bank', amtOf(b.recon.bank) / 100], ['Add: Deposits in transit', amtOf(b.recon.dit) / 100], ['Less: Outstanding checks', amtOf(b.recon.oc) / 100], ['Add/(Less): Other reconciling items', amtOf(b.recon.other) / 100], ['Adjusted balance per bank', rf.adj / 100], ['Balance per books', rf.book / 100], ['Difference', rf.diff / 100], []);
  aoa.push([tb.label.toUpperCase()], [...tb.cols.map((c) => c.t), ...(tb.age && di >= 0 ? ['Age at Dec 31'] : [])]);
  tb.rows.forEach((r) => aoa.push([...tb.cols.map((c, i) => (isNum(c) ? cellAmt(tb, r, i) / 100 : r[i] || '')), ...(tb.age && di >= 0 ? [ageLabel(r[di], tb, F)] : [])]));
  if (tb.cols.some(isNum)) aoa.push(tb.cols.map((c, i) => (i === 0 ? 'Total' : isNum(c) ? colTotal(tb, i) / 100 : '')));
  aoa.push([], ['CONCLUSION'], [[b.result, b.conclusion].filter(Boolean).join('. ')], []);
  if (b.notes) aoa.push(['NOTES'], [b.notes], []);
  aoa.push(['Prepared by:', b.prepBy, 'Reviewed by:', b.revBy], ['Date:', b.prepAt, 'Date:', b.revAt]);
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 40 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, w.ref.slice(0, 31));
  XLSX.writeFile(wb, `${w.ref} ${ctx.lgu.name} ${F.y}.xlsx`);
}
