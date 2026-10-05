// Financial Audit · supporting working papers for the audit foci.
// Each working paper follows one layout: header, objective, procedures, detail table, conclusion, sign-off.
// The balance comes from the lead schedule so the working paper always ties to it.
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
export const wpTemplate = (focusId) => TEMPLATES[focusId] || GENERIC;

/** A new working paper body from the template of an audit focus. */
export function newBody(focusId, me) {
  const t = wpTemplate(focusId);
  return {
    tpl: TEMPLATES[focusId] ? focusId : 'generic',
    objective: t.objective,
    procedures: t.procedures.map((x) => ({ t: x, done: false })),
    recon: t.recon ? { bank: '', dit: '', oc: '', other: '' } : null,
    table: { label: t.table.label, cols: t.table.cols.map((c) => ({ ...c })), age: !!t.table.age, stale: t.table.stale || 0, tie: !!t.table.tie, rows: [] },
    conclusion: '', result: '', notes: '',
    prepBy: (me && (me.name || me.email)) || '', prepAt: new Date().toISOString().slice(0, 10), revBy: '', revAt: ''
  };
}

/* ── Helpers ── */
// Working papers saved before the wording change.
export const OLD_RESULT = { 'No exceptions noted': 'No Findings', 'With exception – for AOM': 'With Finding' };
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
const tableTotal = (tb) => { const i = amtCol(tb); return i < 0 ? 0 : tb.rows.reduce((s, r) => s + amtOf(r[i]), 0); };
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
  return out;
}
function staleCheck(b, F) {
  const tb = b.table, di = dateCol(tb); if (!tb.stale || di < 0) return null;
  const n = tb.rows.filter((r) => (ageDays(r[di], F) ?? 0) > tb.stale).length;
  return n ? { ok: false, t: `${n} check${n > 1 ? 's are' : ' is'} over six months old (stale) and should be cancelled and taken up in the books.` } : null;
}

/* ── The working paper as a printable sheet (also used for the read-only view) ── */
function sheetHTML(w, item, F, ctx) {
  const b = w.wpb, tb = b.table, ai = amtCol(tb), di = dateCol(tb);
  const rf = reconFigures(b, item.cy || 0);
  return `<div class="wps">
    <table class="wps-head"><tr><td>Barangay ${esc(ctx.lgu.name)}, ${esc(ctx.mun.name)}, Quirino</td><td class="n"><b>${esc(w.ref)}</b></td></tr>
      <tr><td>${esc(w.title)} · ${esc(item.title)}</td><td class="n">CY ${esc(F.y)}</td></tr></table>
    <p><b>Balance per lead schedule:</b> ${money(item.cy || 0)}</p>
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
    ${tb.rows.length ? `<table class="pf"><thead><tr>${tb.cols.map((c) => `<th class="${c.type === 'amt' ? 'n' : ''}">${esc(c.t)}</th>`).join('')}${tb.age && di >= 0 ? '<th>Age</th>' : ''}</tr></thead><tbody>
      ${tb.rows.map((r) => `<tr>${tb.cols.map((c, i) => `<td class="${c.type === 'amt' ? 'n' : ''}">${c.type === 'amt' ? money(amtOf(r[i])) : esc(r[i] || '')}</td>`).join('')}${tb.age && di >= 0 ? `<td>${esc(ageLabel(r[di], tb, F))}</td>` : ''}</tr>`).join('')}
      ${ai >= 0 ? `<tr style="font-weight:700">${tb.cols.map((c, i) => `<td class="${i === ai ? 'n' : ''}">${i === 0 ? 'Total' : i === ai ? money(tableTotal(tb)) : ''}</td>`).join('')}${tb.age && di >= 0 ? '<td></td>' : ''}</tr>` : ''}
    </tbody></table>` : '<p class="hint">No details entered.</p>'}
    <h4>Conclusion</h4><p>${(b.result = OLD_RESULT[b.result] || b.result) ? `<b>${esc(b.result)}.</b> ` : ''}${esc(b.conclusion || '—')}</p>
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
  b.result = OLD_RESULT[b.result] || b.result;
  const tb = b.table, ai = amtCol(tb), di = dateCol(tb);
  const RESULTS = ['No Findings', 'With Finding'];

  const drawRows = (bg) => {
    $('#wp-rows', bg).innerHTML = tb.rows.map((r, ri) => `<tr>${tb.cols.map((c, ci) => `<td><input class="input wp-in ${c.type === 'amt' ? 'n' : ''}" ${c.type === 'date' ? 'type="date"' : ''} data-wr="${ri}:${ci}" value="${esc(r[ci] || '')}" aria-label="${esc(c.t)}"></td>`).join('')}
      ${tb.age && di >= 0 ? `<td class="hint wp-age" data-age="${ri}">${esc(ageLabel(r[di], tb, F))}</td>` : ''}
      <td><button class="x sm" type="button" data-wrm="${ri}" aria-label="Remove row">✕</button></td></tr>`).join('')
      || `<tr><td colspan="${tb.cols.length + 2}" class="hint" style="padding:10px 4px">No rows yet. Add one below.</td></tr>`;
    drawChecks(bg);
  };
  const drawChecks = (bg) => {
    const total = $('#wp-total', bg); if (total) total.textContent = money(tableTotal(tb), { dash: '0.00' });
    const rf = reconFigures(b, item.cy || 0);
    if (rf) { $('#wp-adj', bg).textContent = money(rf.adj, { dash: '0.00' }); $('#wp-diff', bg).textContent = money(rf.diff, { dash: '0.00' }); }
    const c = checks(b, item); const st = staleCheck(b, F); if (st) c.push(st);
    $('#wp-checks', bg).innerHTML = c.length ? c.map((x) => `<span class="${x.ok ? 'ck-ok' : 'ck-warn'}">${x.ok ? '✓' : '!'} ${esc(x.t)}</span>`).join('') : '<span class="hint">Checks appear once figures are entered.</span>';
  };

  const field = (id, label, val, type = 'text') => `<div class="field"><label class="label" for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(val || '')}"></div>`;
  const body = `<div class="wp-ed">
    <div class="wp-ed-top"><div><span class="hint">Barangay ${esc(ctx.lgu.name)}, ${esc(ctx.mun.name)} · CY ${esc(F.y)}</span><div><b>${esc(item.title)}</b></div></div>
      <div class="wp-bal"><span>Balance per lead schedule</span><b>${money(item.cy || 0, { dash: '0.00' })}</b></div></div>
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
      <div class="wp-tbl"><table class="pf"><thead><tr>${tb.cols.map((c) => `<th class="${c.type === 'amt' ? 'n' : ''}">${esc(c.t)}</th>`).join('')}${tb.age && di >= 0 ? '<th>Age at Dec 31</th>' : ''}<th></th></tr></thead>
        <tbody id="wp-rows"></tbody>
        ${ai >= 0 ? `<tfoot><tr class="tot">${tb.cols.map((c, i) => `<td class="${i === ai ? 'n' : ''}" ${i === ai ? 'id="wp-total"' : ''}>${i === 0 ? 'Total' : ''}</td>`).join('')}${tb.age && di >= 0 ? '<td></td>' : ''}<td></td></tr></tfoot>` : ''}</table></div>
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
      $('#wp-addrow', bg).onclick = () => { tb.rows.push(tb.cols.map(() => '')); drawRows(bg); const ins = $$('#wp-rows input', bg); if (ins.length) ins[ins.length - tb.cols.length].focus(); };
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
  const b = w.wpb, tb = b.table, di = dateCol(tb), ai = amtCol(tb);
  const aoa = [[`Barangay ${ctx.lgu.name}, ${ctx.mun.name}, Quirino`, '', '', w.ref], [`${w.title} · ${item.title}`, '', '', `CY ${F.y}`], [],
    ['Balance per lead schedule', (item.cy || 0) / 100], [], ['OBJECTIVE'], [b.objective], [], ['PROCEDURES PERFORMED'],
    ...b.procedures.map((p, i) => [`${i + 1}. ${p.t}`, p.done ? 'Done' : '']), []];
  const rf = reconFigures(b, item.cy || 0);
  if (rf) aoa.push(['BANK RECONCILIATION'], ['Balance per bank', amtOf(b.recon.bank) / 100], ['Add: Deposits in transit', amtOf(b.recon.dit) / 100], ['Less: Outstanding checks', amtOf(b.recon.oc) / 100], ['Add/(Less): Other reconciling items', amtOf(b.recon.other) / 100], ['Adjusted balance per bank', rf.adj / 100], ['Balance per books', rf.book / 100], ['Difference', rf.diff / 100], []);
  aoa.push([tb.label.toUpperCase()], [...tb.cols.map((c) => c.t), ...(tb.age && di >= 0 ? ['Age at Dec 31'] : [])]);
  tb.rows.forEach((r) => aoa.push([...tb.cols.map((c, i) => (c.type === 'amt' ? amtOf(r[i]) / 100 : r[i] || '')), ...(tb.age && di >= 0 ? [ageLabel(r[di], tb, F)] : [])]));
  if (ai >= 0) aoa.push(tb.cols.map((c, i) => (i === 0 ? 'Total' : i === ai ? tableTotal(tb) / 100 : '')));
  aoa.push([], ['CONCLUSION'], [[b.result, b.conclusion].filter(Boolean).join('. ')], []);
  if (b.notes) aoa.push(['NOTES'], [b.notes], []);
  aoa.push(['Prepared by:', b.prepBy, 'Reviewed by:', b.revBy], ['Date:', b.prepAt, 'Date:', b.revAt]);
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 40 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, w.ref.slice(0, 31));
  XLSX.writeFile(wb, `${w.ref} ${ctx.lgu.name} ${F.y}.xlsx`);
}
