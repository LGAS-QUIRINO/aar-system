// Working papers of the findings, filled in here: the placeholders (amounts from the trial balance fill in by
// themselves) and the AOM Tables (typed or pasted, with a Total row). Also the New Working Paper window, the
// Download Excel in the same layout as the Excel working papers, and the list of the audit's working papers.
import { store } from '../store.js';
import { esc, toast, modal, pill, $, $$ } from '../ui.js';
import { has } from '../refs.js';
import { placeholders, SETUP_VAR_NAMES, formatVar, plannedCols, isTableVar, isCalcRow, isFixedTable, isMoneyName } from '../aom.js';
import { money, cents, parseAmt, amtText } from '../fs.js';
import { loadScript } from '../wp.js';

const FILLED = '(filled in the app)';
const WP_COLS = { 'WP-CA01': ['Name of Accountable Officer', 'Date Granted', 'Amount'], 'WP-REC001': ['Name of Debtor', 'Date', 'Amount'], 'WP-TAX01': ['Particulars', 'Month', 'Amount'] };
const isAmtCol = (h) => /amount|total|balance|appropriation|disburs|utiliz|cost|₱/i.test(h || '') || /^(19|20)\d\d$/.test(String(h || '').trim());   // a year heading is an amount column
const KINDS = ['Amount', 'Number', 'Date', 'Text'];

/* ── What a finding's working paper needs ── */
export function wpNeeds(d) {
  const def = d.wpDef || {};
  const ph = [...new Set([...placeholders(d).filter((n) => !SETUP_VAR_NAMES.includes(n)), ...(def.ph || []).map((p) => p.name)])];
  const tn = [...new Set([...(d.blocks || []).filter((b) => b.type === 'table' && !isFixedTable(b)).map((b) => Number(b.n) || 1), ...(def.tables || []).map((t) => t.n)])].sort((a, b) => a - b);
  return { ph, tn, def };
}
const tbKeysOf = (d, F) => {
  if (!F) return [];
  const keys = new Set((d.wpDef && d.wpDef.accounts) || []);
  (d.flagCodes || []).forEach((c) => Object.keys(F.figY.accts).forEach((k) => { const a = F.chart.byKey[k]; if (a && a.code === c) keys.add(k); }));
  return [...keys];
};
// The trial balance amount a placeholder is checked against: { amt (centavos), label } or null.
function tbFor(d, p, F) {
  if (isMoneyName(p) && /TOTAL/.test(p) && wpNeeds(d).tn.length) return null;   // a TOTAL with an AOM Table comes from the table
  const w = d.wpData || {};
  if (w.tb && w.tb[p]) return w.tb[p];
  const def = ((d.wpDef && d.wpDef.ph) || []).find((x) => x.name === p);
  const fromTb = (def && def.from === 'tb') || (w.src && /^Trial balance/.test(w.src[p] || ''));
  if (!fromTb || !F) return null;
  const keys = tbKeysOf(d, F);
  if (!keys.length) return null;
  return { amt: keys.reduce((t, k) => t + (F.figY.accts[k] || 0), 0), label: keys.map((k) => F.chart.byKey[k].title).join(', ') };
}
// v: the finding's values (Setup years), for columns planned in the AOM Table block.
const colsFor = (d, n, v) => {
  const t = d.wpData && d.wpData.tables && d.wpData.tables[n];
  if (t && t.cols) return t.cols;   // a grouped table keeps its typed columns (the printed one may hide the Year column)
  if (t && t.rows && t.rows.length) return t.rows[0];
  const blk = (d.blocks || []).find((b) => b.type === 'table' && (Number(b.n) || 1) === n);
  const planned = plannedCols(blk, v);
  if (planned && planned.length) return planned;
  const def = ((d.wpDef && d.wpDef.tables) || []).find((x) => x.n === n);
  if (def) return def.cols.map((c) => c.t);
  return (WP_COLS[d.wp] && n === 1) ? WP_COLS[d.wp] : ['Particulars', 'Amount'];
};
const amtCols = (d, n, cols) => {
  const def = ((d.wpDef && d.wpDef.tables) || []).find((x) => x.n === n);
  return cols.map((h, i) => (def && def.cols[i] ? !!def.cols[i].amt : isAmtCol(h)) ? i : -1).filter((i) => i >= 0);
};
// Data rows of a table (without its header and the year headings, Sub-Total and Total rows added here).
// A grouped table keeps its rows in the order typed (t.data), so the boxes do not move while typing.
const dataRows = (t) => { if (!t || !t.rows) return []; if (t.data) return t.data; const r = t.rows.slice(1); return t.filled ? r.filter((x) => !isCalcRow(x)) : r; };
const yearOf = (r) => { const m = /(?:19|20)\d\d/.exec(String((r || [])[0] ?? '')); return m ? m[0] : ''; };
function withTotal(d, n, cols, rows) {
  const ac = amtCols(d, n, cols);
  // Sub-Total per Year (set in the AOM Table block): rows grouped by the year in the first column, each group with
  // a "CY 2024" heading and a Sub-Total, then the Total. The labels sit in the column before the first amount column.
  const blk = (d.blocks || []).find((b) => b.type === 'table' && (Number(b.n) || 1) === n);
  if (blk && blk.subYear && ac.length && rows.length) {
    // A first column headed "Year" only groups the rows; the printout leaves it out (the CY headings show the year).
    const dropYear = /^year$/i.test(String(cols[0] || '').trim()) && cols.length > 2;
    const hc = dropYear ? 1 : 0;
    const lab = Math.max(hc, ac[0] - 1);
    const sumRow = (label, rs) => cols.map((_, i) => (i === lab ? label : ac.includes(i) ? money(rs.reduce((s, r) => s + cents(parseAmt(r[i]) || 0), 0), { dash: '-' }) : ''));
    const out = [cols];
    [...new Set(rows.map(yearOf))].sort().forEach((y) => {
      const rs = rows.filter((r) => yearOf(r) === y);
      if (y) out.push(cols.map((_, i) => (i === hc ? `CY ${y}` : '')));
      out.push(...rs, sumRow('Sub-Total', rs));
    });
    out.push(sumRow('Total', rows));
    return { sheet: FILLED, filled: true, rows: dropYear ? out.map((r) => r.slice(1)) : out, data: rows, cols };
  }
  const tot = cols.map((_, i) => (i === 0 ? 'Total' : ac.includes(i) ? money(rows.reduce((s, r) => s + cents(parseAmt(r[i]) || 0), 0), { dash: '-' }) : ''));
  return { sheet: FILLED, filled: true, rows: [cols, ...rows, ...(rows.length && ac.length ? [tot] : [])] };
}
const tableTotal = (d, n) => { const t = d.wpData && d.wpData.tables && d.wpData.tables[n]; if (!t) return null; const cols = t.cols || t.rows[0] || []; const ac = amtCols(d, n, cols); if (!ac.length) return null; return dataRows(t).reduce((s, r) => s + cents(parseAmt(r[ac[ac.length - 1]]) || 0), 0); };

/* ── Totals taken from the AOM Table ── */
// A money placeholder named with TOTAL (PAYABLE_TOTAL, TOTAL_RECEIVABLES, …) is the total of the AOM Table, not a guess
// from the trial balance: the column of the year it names (_PY = the year before, _PY2 = two years before; otherwise
// the last year of the audit period), or the last amount column when the columns are not years.
const yearWanted = (p, v) => { const end = Number(v && v.PERIOD_END_YEAR) || 0; return /_PY2$/.test(p) ? end - 2 : /_PY$/.test(p) ? end - 1 : end; };
export function tableSourced(d, p, v) {
  if (!isMoneyName(p) || !/TOTAL/.test(p)) return null;
  const { tn } = wpNeeds(d);
  for (const n of tn) {
    const t = d.wpData && d.wpData.tables && d.wpData.tables[n];
    const cols = colsFor(d, n, v), ac = amtCols(d, n, cols);
    if (!ac.length) continue;
    const y = yearWanted(p, v);
    let ci = ac.find((i) => new RegExp(`\\b${y}\\b`).test(String(cols[i])));
    let rows = dataRows(t);
    const yearCol = /^\s*year\s*$/i.test(String(cols[0] || ''));
    if (ci === undefined) {
      if (/_PY2?$/.test(p) && !yearCol) return null;       // a prior-year total needs a column (or a Year column) for that year
      ci = ac[ac.length - 1];
      if (yearCol && /_(CY|PY2?)$/.test(p)) rows = rows.filter((r) => yearOf(r) === String(y));
    }
    const amt = rows.reduce((s, r) => s + cents(parseAmt(r[ci]) || 0), 0);
    return { n, amt, label: `AOM Table ${n} total${/^(19|20)\d\d$/.test(String(cols[ci]).trim()) ? `, ${String(cols[ci]).trim()}` : ` (${cols[ci]})`}`, rows: rows.length };
  }
  return null;
}
// Puts the table totals in their placeholders (unless a different amount was typed on purpose). Returns true when one changed.
export function syncTableTotals(d, v) {
  const w = d.wpData; if (!w) return false;
  w.vars = w.vars || {};
  let changed = false;
  wpNeeds(d).ph.forEach((p) => {
    if (w.typed && w.typed[p]) return;
    const s = tableSourced(d, p, v);
    if (!s || !s.rows) return;
    const raw = s.amt / 100;
    if (!w.vars[p] || cents(w.vars[p].raw) !== s.amt) { w.vars[p] = { raw }; changed = true; }
  });
  return changed;
}

/* ── Fill in Here ── */
export function fillHTML(d, F, ctx, editable) {
  const { ph, tn } = wpNeeds(d);
  const v = ctx.varsFor({ data: d });
  const w = d.wpData || {};
  const dis = editable ? '' : 'disabled';
  const filled = ph.filter((p) => v[p] !== undefined).length;
  const phRows = ph.map((p) => {
    const ts = tableSourced(d, p, v);
    if (ts) {
      const raw = w.vars && w.vars[p] ? w.vars[p].raw : '', typedOwn = !!(w.typed && w.typed[p]) && cents(raw) !== ts.amt;
      return `<tr><td class="mono">${esc(p)}</td><td><input class="input" style="height:32px" data-wpv="${esc(p)}" data-amt value="${esc(raw === '' ? '' : amtText(raw))}" placeholder="${esc(ts.rows ? money(ts.amt, { dash: '0.00' }) : 'fill in the table')}" aria-label="${esc(p)}" ${dis}></td>
        <td>${typedOwn ? `Typed · <span class="hint">${esc(ts.label)} ₱${money(ts.amt, { dash: '0.00' })}</span>${editable ? ` <button class="reset" type="button" data-wptt="${esc(p)}">Use table total</button>` : ''}` : `${esc(ts.label)} <span class="hint">· follows the table by itself</span>`}</td></tr>`;
    }
    const tb = tbFor(d, p, F), raw = w.vars && w.vars[p] ? w.vars[p].raw : '';
    const typed = tb && raw !== '' && cents(raw) !== tb.amt, empty = raw === '';
    return `<tr><td class="mono">${esc(p)}</td><td><input class="input" style="height:32px" data-wpv="${esc(p)}"${isMoneyName(p) ? ' data-amt' : ''} value="${esc(isMoneyName(p) && typeof raw === 'number' ? amtText(raw) : raw)}" ${tb && empty ? `placeholder="${esc(money(tb.amt, { dash: '0.00' }))}"` : ''} aria-label="${esc(p)}" ${dis}></td>
      <td>${tb ? `${typed ? 'Typed' : empty ? 'Trial balance (not yet used)' : 'Trial balance'} · <span class="hint">${esc(tb.label)}${typed ? ` ₱${money(tb.amt, { dash: '0.00' })}` : ''}</span>${(typed || empty) && editable ? ` <button class="reset" type="button" data-wptb="${esc(p)}">Use trial balance</button>` : ''}${!typed && !empty ? ' <span class="hint">· type instead in the box</span>' : ''}` : '<span class="hint">Typed</span>'}</td></tr>`;
  }).join('');
  const tables = tn.map((n) => {
    const t = w.tables && w.tables[n];
    const cols = colsFor(d, n, v), rows = dataRows(t), ac = amtCols(d, n, cols);
    const tot = ac.length ? cols.map((_, i) => ac.includes(i) ? money(rows.reduce((s, r) => s + cents(parseAmt(r[i]) || 0), 0), { dash: '-' }) : '') : null;
    return `<div style="margin-top:12px"><div class="lr-row"><b style="color:var(--navy)">AOM Table ${n}</b>${editable ? `<span class="btn-row">${F && (F.figY.any || F.figP.any) && ac.length ? `<button class="btn sm ghost" type="button" data-wptbfill="${n}" title="Fills the empty amount boxes from the trial balances: all funds combined, or the GF or 5% BDRRMF only when the row says so">Fill from Trial Balance</button>` : ''}<button class="btn sm ghost" type="button" data-wppaste="${n}">Paste from Excel</button><button class="btn sm ghost" type="button" data-wpaddrow="${n}">+ Add Row</button><button class="btn sm ghost" type="button" data-wpaddcol="${n}">+ Column</button></span>` : ''}</div>
      <table class="pf wpt"><thead><tr>${cols.map((h, i) => `<th${ac.includes(i) ? ' class="n"' : ''}>${editable ? `<input class="input" data-wph="${n}:${i}" value="${esc(h)}" aria-label="Column ${i + 1}">` : esc(h)}</th>`).join('')}<th style="width:30px"></th></tr></thead><tbody>
      ${rows.map((r, ri) => `<tr>${cols.map((_, i) => `<td><input class="input${ac.includes(i) ? ' amt' : ''}" data-wpc="${n}:${ri}:${i}" value="${esc(ac.includes(i) ? amtText(r[i] ?? '') : r[i] ?? '')}" aria-label="${esc(cols[i])} row ${ri + 1}" ${dis}></td>`).join('')}<td>${editable ? `<button class="x sm" type="button" data-wprm="${n}:${ri}" aria-label="Remove row">✕</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="hint">No rows yet.</td></tr>`}
      ${tot && rows.length ? `<tr style="font-weight:700">${tot.map((x, i) => `<td class="${ac.includes(i) ? 'n' : ''}">${i === 0 ? 'Total' : esc(x)}</td>`).join('')}<td></td></tr>` : ''}</tbody></table></div>`;
  }).join('');
  return `<div class="label">Placeholders · ${filled} of ${ph.length} Filled</div>
    ${ph.length ? `<table class="pf"><colgroup><col style="width:220px"><col style="width:200px"><col></colgroup><thead><tr><th>Placeholder</th><th>Value</th><th>From</th></tr></thead><tbody>${phRows}</tbody></table>` : '<p class="hint">This finding has no placeholders to fill (Setup values such as the year and names fill in by themselves).</p>'}
    ${tables || ''}
    <div style="margin-top:12px"><div class="label">Working Paper Results</div><div class="ck">${wpResults(d, F, ctx).map((c) => `<span class="ck-${c.st}">${c.st === 'ok' ? '✓' : '!'} ${esc(c.t)}</span>`).join('') || '<span class="hint">Nothing to check yet.</span>'}</div></div>`;
}
export function wpResults(d, F, ctx) {
  const out = [], { ph, tn } = wpNeeds(d), v = ctx.varsFor({ data: d }), w = d.wpData || {};
  const amtPh = ph.find((p) => /TOTAL|BALANCE|AMOUNT/.test(p));
  tn.forEach((n) => {
    const t = tableTotal(d, n);
    if (!(w.tables && w.tables[n])) { out.push({ st: 'warn', t: `AOM Table ${n} has no rows yet` }); return; }
    if (t !== null && amtPh && w.vars && w.vars[amtPh]) out.push(Math.abs(t) === Math.abs(cents(w.vars[amtPh].raw)) ? { st: 'ok', t: `AOM Table ${n} total ₱${money(t)} agrees with ${amtPh}` } : { st: 'warn', t: `AOM Table ${n} total ₱${money(t, { dash: '0.00' })} differs from ${amtPh} ₱${money(cents(w.vars[amtPh].raw), { dash: '0.00' })}` });
  });
  ph.forEach((p) => { const ts = tableSourced(d, p, v); if (ts && w.vars && w.vars[p]) out.push(cents(w.vars[p].raw) === ts.amt ? { st: 'ok', t: `${p} is the ${ts.label} (₱${money(ts.amt, { dash: '0.00' })})` } : { st: 'warn', t: `${p} ₱${money(cents(w.vars[p].raw), { dash: '0.00' })} was typed; the ${ts.label} is ₱${money(ts.amt, { dash: '0.00' })}` }); });
  ph.forEach((p) => { const tb = tbFor(d, p, F); if (tb && w.vars && w.vars[p]) out.push(cents(w.vars[p].raw) === tb.amt ? { st: 'ok', t: `${p} agrees with the trial balance (${tb.label}, all funds)` } : { st: 'warn', t: `${p} ₱${money(cents(w.vars[p].raw), { dash: '0.00' })} differs from the trial balance ₱${money(tb.amt, { dash: '0.00' })} (${tb.label})` }); });
  const miss = ph.filter((p) => v[p] === undefined);
  out.push(miss.length ? { st: 'warn', t: `Not yet filled: ${miss.join(', ')}` } : { st: 'ok', t: 'All placeholders filled' });
  return out;
}
// Wires the Fill in Here inputs. d: the finding (changed in place); changed(): marks it unsaved and redraws.
export function wireFill(root, d, me, changed, F, v) {
  const W = () => { d.wpData = d.wpData || { file: FILLED, at: new Date().toISOString(), by: me.email, vars: {}, tables: {} }; d.wpData.vars = d.wpData.vars || {}; d.wpData.tables = d.wpData.tables || {}; if (d.wpData.file !== FILLED) { d.wpData.file = FILLED; } d.wpData.at = new Date().toISOString(); d.wpData.by = me.email; return d.wpData; };
  const getRows = (n) => { const t = (d.wpData && d.wpData.tables || {})[n]; return { cols: [...colsFor(d, n, v)], rows: dataRows(t).map((r) => [...r]) }; };
  const putRows = (n, cols, rows) => { W().tables[n] = withTotal(d, n, cols, rows); syncTableTotals(d, v); changed(); };
  $$('[data-wpv]', root).forEach((el) => { el.onchange = () => { const w = W(), p = el.dataset.wpv, t = el.value.trim();
    if (tableSourced(d, p, v)) {   // a different amount typed on purpose stays; clearing the box goes back to the table total
      w.typed = w.typed || {};
      if (t === '') { delete w.typed[p]; syncTableTotals(d, v); } else { w.typed[p] = true; const n = parseAmt(t); w.vars[p] = { raw: n !== null && !isNaN(n) ? n : t }; }
      changed(); return;
    }
    if (t === '') delete w.vars[p]; else { const n = parseAmt(t); w.vars[p] = { raw: n !== null && !isNaN(n) && /^[-\d,.()₱\s]+$/.test(t) ? n : t }; } changed(); }; });
  $$('[data-wptt]', root).forEach((b) => { b.onclick = () => { const w = W(); if (w.typed) delete w.typed[b.dataset.wptt]; syncTableTotals(d, v); changed(); }; });
  if (d.wpData && root.querySelector('[data-wpc]:not([disabled]),[data-wpv]:not([disabled])') && syncTableTotals(d, v)) setTimeout(changed, 0);   // an older total (e.g. from the trial balance) is replaced by the table total
  $$('[data-wptb]', root).forEach((b) => { b.onclick = () => { const p = b.dataset.wptb, tb = tbFor(d, p, F); if (!tb) return; const w = W(); w.vars[p] = { raw: tb.amt / 100 }; changed(); }; });
  $$('[data-wph]', root).forEach((el) => { el.onchange = () => { const [n, i] = el.dataset.wph.split(':').map(Number); const g = getRows(n); g.cols[i] = el.value.trim() || `Column ${i + 1}`; putRows(n, g.cols, g.rows); }; });
  $$('[data-wpc]', root).forEach((el) => { el.onchange = () => { const [n, ri, i] = el.dataset.wpc.split(':').map(Number); const g = getRows(n); g.rows[ri][i] = el.value.trim(); putRows(n, g.cols, g.rows); }; });
  $$('[data-wpaddrow]', root).forEach((b) => { b.onclick = () => { const n = +b.dataset.wpaddrow, g = getRows(n); g.rows.push(g.cols.map(() => '')); putRows(n, g.cols, g.rows); }; });
  $$('[data-wpaddcol]', root).forEach((b) => { b.onclick = () => { const n = +b.dataset.wpaddcol, g = getRows(n); g.cols.push(`Column ${g.cols.length + 1}`); g.rows.forEach((r) => r.push('')); putRows(n, g.cols, g.rows); }; });
  $$('[data-wprm]', root).forEach((b) => { b.onclick = () => { const [n, ri] = b.dataset.wprm.split(':').map(Number); const g = getRows(n); g.rows.splice(ri, 1); putRows(n, g.cols, g.rows); }; });
  $$('[data-wptbfill]', root).forEach((b) => { b.onclick = () => {
    const n = +b.dataset.wptbfill, g = getRows(n), ac = amtCols(d, n, g.cols);
    const res = fillFromTb(F, g.cols, g.rows, ac);
    if (res.filled) putRows(n, g.cols, g.rows);
    const notes = [res.missing.length ? `Not found in the trial balance: ${res.missing.slice(0, 4).join(', ')}${res.missing.length > 4 ? '…' : ''}` : '', res.noYear.length ? res.noYear.join('; ') : ''].filter(Boolean);
    toast(`${res.filled ? `${res.filled} amount${res.filled > 1 ? 's' : ''} filled from the trial balance.` : 'Nothing was filled (boxes with amounts are kept).'}${notes.length ? ' ' + notes.join('. ') + '.' : ''}`, notes.length ? 'bad' : 'ok');
  }; });
  $$('[data-wppaste]', root).forEach((b) => { b.onclick = async () => {
    const n = +b.dataset.wppaste; let text = '', head = false;
    const ok = await modal({ title: `Paste · AOM Table ${n}`, wide: true, body: '<p class="hint" style="margin:0 0 8px">Copy the rows from Excel and paste them here. Leave out the Total row; it is added by itself.</p><textarea class="input" id="wp-p" rows="10" style="font-family:var(--mono);font-size:12px"></textarea><label class="check" style="min-height:0"><input type="checkbox" id="wp-h">The first row is the column headings</label>',
      buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Use These Rows', cls: 'primary', value: 'ok', check: (bg) => { text = $('#wp-p', bg).value; head = $('#wp-h', bg).checked; return !!text.trim(); } }] });
    if (!ok) return;
    let rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split('\t').map((x) => x.trim()));
    rows = rows.filter((r) => !/^total$/i.test(r[0] || ''));
    const g = getRows(n);
    let cols = g.cols;
    if (head) { cols = rows.shift(); }
    const w = Math.max(cols.length, ...rows.map((r) => r.length));
    while (cols.length < w) cols.push(`Column ${cols.length + 1}`);
    putRows(n, cols, [...g.rows, ...rows.map((r) => cols.map((_, i) => r[i] || ''))]);
  }; });
}

/* ── Fill an AOM Table from the trial balances ── */
// The fund a row asks for: 'GF', 'BDRRMF', another fund code named in the row, or '' for all funds combined.
const FUND_WORDS = [[/\b5\s*%|\bb?drrm/i, 'BDRRMF'], [/\bgf\b|general fund/i, 'GF']];
function fundOfLabel(label, F) {
  for (const [re, k] of FUND_WORDS) if (re.test(label)) return k;
  const other = (F.funds || []).concat(F.fundsP || []).map((f) => f.k).find((k) => k !== 'ALL' && k !== 'GF' && k !== 'BDRRMF' && new RegExp(`\\b${k}\\b`, 'i').test(label));
  return other || '';
}
// Account names compared loosely: case, punctuation, a plural "s", and the fund words do not matter.
const normName = (s) => String(s || '').toLowerCase().replace(/\b5\s*%|\(?\b(gf|general fund|b?drrmf?|bdrrm fund)\b\)?/g, ' ')
  .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)).join(' ');
// The trial balance account a row names: by account code, by the same name, or by the only name that contains it.
function acctOfLabel(label, keys, chart) {
  const code = (String(label).match(/\b\d-\d{2}-\d{2}-\d{3}\b/) || [])[0];
  if (code) return keys.find((k) => chart.byKey[k].code === code) || null;
  const n = normName(label);
  if (!n) return null;
  const same = keys.filter((k) => normName(chart.byKey[k].title) === n);
  if (same.length === 1) return same[0];
  const near = keys.filter((k) => { const t = normName(chart.byKey[k].title); return t.includes(n) || n.includes(t); });
  return near.length === 1 ? near[0] : null;
}
// The amount of one account for one year and fund (centavos), or why there is none.
function tbAmount(F, yr, fund, key) {
  const fig = yr === F.y ? F.figY : yr === F.yp ? F.figP : null;
  if (!fig || !fig.any) return { why: `no trial balance for ${yr}` };
  if (!fund) return { amt: fig.accts[key] || 0 };
  const st = fig.st && fig.st[fund];
  if (!st) return { why: fig.st && fig.st.ALL ? `only a consolidated trial balance for ${yr}` : `no ${fund} trial balance for ${yr}` };
  return { amt: st.accts[key] || 0 };
}
// Fills the empty amount boxes of AOM Table n. Returns { filled, missing: [labels], noYear: [notes] }.
export function fillFromTb(F, cols, rows, ac) {
  const keys = [...new Set([F.figY, F.figP].flatMap((f) => (f && f.st ? Object.values(f.st) : []).flatMap((s) => Object.keys(s.accts || {})).concat(Object.keys((f && f.accts) || {}))))].filter((k) => F.chart.byKey[k]);
  const yearCol = cols.findIndex((c) => /^\s*(year|cy)\s*$/i.test(c));
  const labCol = cols.findIndex((c, i) => !ac.includes(i) && i !== yearCol);
  const out = { filled: 0, missing: [], noYear: new Set() };
  if (labCol < 0) return out;
  rows.forEach((r) => {
    const label = String(r[labCol] || '').trim();
    if (!label) return;
    const empty = ac.filter((i) => String(r[i] ?? '').trim() === '');
    if (!empty.length) return;
    const key = acctOfLabel(label, keys, F.chart);
    if (!key) { out.missing.push(label); return; }
    const fund = fundOfLabel(label, F);
    empty.forEach((i) => {
      const y = Number((String(cols[i]).match(/\b(19|20)\d{2}\b/) || [])[0] || (yearCol >= 0 ? (String(r[yearCol]).match(/\b(19|20)\d{2}\b/) || [])[0] : 0) || F.y);
      const got = tbAmount(F, y, fund, key);
      if (got.why) { out.noYear.add(got.why); return; }
      r[i] = amtText(got.amt / 100); out.filled++;
    });
  });
  out.noYear = [...out.noYear];
  return out;
}

/* ── Download Excel: VARIABLE / VALUE and the "AOM Table n" sheets ── */
export async function downloadWp(d, ctx) {
  const XLSX = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const { ph, tn } = wpNeeds(d), w = d.wpData || {}, v = ctx.varsFor({ data: d });
  const wb = XLSX.utils.book_new();
  const head = [[`${d.wp || 'Working Paper'} · ${d.title}`], [`Barangay ${ctx.lgu.name}, ${ctx.mun.name}, Quirino`], [], ['VARIABLE', 'VALUE']];
  const vars = [...SETUP_VAR_NAMES.filter((k) => v[k] !== undefined && !isTableVar(k)).map((k) => [k, v[k]]), ...ph.map((p) => [p, w.vars && w.vars[p] ? w.vars[p].raw : ''])];
  const ws = XLSX.utils.aoa_to_sheet([...head, ...vars]); ws['!cols'] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'WP');
  tn.forEach((n) => {
    const t = w.tables && w.tables[n];
    const cols = colsFor(d, n, v), rows = dataRows(t), ac = amtCols(d, n, cols);
    const data = rows.map((r) => cols.map((_, i) => { const x = r[i] ?? ''; if (ac.includes(i)) { const k = parseAmt(x); return k === null || isNaN(k) ? x : k; } return x; }));
    const tot = ac.length && rows.length ? [cols.map((_, i) => (i === 0 ? 'Total' : ac.includes(i) ? data.reduce((s, r) => s + (typeof r[i] === 'number' ? r[i] : 0), 0) : ''))] : [];
    const s = XLSX.utils.aoa_to_sheet([cols, ...data, ...tot]); s['!cols'] = cols.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, s, `AOM Table ${n}`);
  });
  XLSX.writeFile(wb, `${d.wp || 'WP'} ${ctx.lgu.name} ${ctx.audit.auditYear}.xlsx`);
}

/* ── New Working Paper ── */
const PREFIX = [[/advance/i, 'CA'], [/receivable/i, 'AR'], [/payable/i, 'AP'], [/cash in bank/i, 'CB'], [/cash/i, 'CASH'], [/due to (bir)/i, 'TAX'], [/property|plant|equipment|building|depreciation/i, 'PPE']];
export function allWpRefs(F, ctx) {
  const s = new Set();
  (ctx.aoms || []).forEach((a) => { if (a.data.wp) s.add(a.data.wp); });
  ((F && F.rec && F.rec.wps) || []).forEach((w) => s.add(w.ref));
  return s;
}
export function nextRef(F, ctx, accounts, title = '') {
  const t = (accounts || []).map((k) => (F.chart.byKey[k] || {}).title || '').join(' ') + ' ' + title;
  const p = (PREFIX.find(([re]) => re.test(t)) || [null, 'GEN'])[1];
  const used = allWpRefs(F, ctx);
  for (let i = 1; i < 100; i++) { const r = `WP-${p}${String(i).padStart(2, '0')}`; if (!used.has(r)) return r; }
  return `WP-${p}99`;
}
/**
 * The New Working Paper window. Resolves with { ref, title, accounts, ph: [{ name, kind, from }], tables: [{ n, cols: [{ t, amt }] }], template }
 * or null. supporting: a working paper for an account only (no finding).
 */
export async function openNewWp({ F, ctx, me, accounts = [], supporting = false, title = '' }) {
  const S = { ref: nextRef(F, ctx, accounts, title), title, accounts: [...accounts], ph: supporting ? [] : [{ name: '', kind: 'Amount', from: 'tb' }], tables: supporting ? [] : [{ n: 1, cols: [{ t: 'Particulars', amt: false }, { t: 'Amount', amt: true }] }], template: false };
  const tbAccts = Object.keys(F.figY.accts || {}).filter((k) => F.chart.byKey[k]).sort((a, b) => F.chart.byKey[a].code.localeCompare(F.chart.byKey[b].code));
  const canTpl = has(me, 'sa') || has(me, 'admin');
  const draw = (bg) => {
    $('#nw-acc', bg).innerHTML = S.accounts.map((k, i) => `<span class="chip">${esc(F.chart.byKey[k] ? `${F.chart.byKey[k].code} ${F.chart.byKey[k].title}` : k)} <button class="x sm" type="button" data-nwrma="${i}" aria-label="Remove">✕</button></span>`).join(' ') || '<span class="hint">None yet</span>';
    $('#nw-ph', bg).innerHTML = S.ph.map((p, i) => `<tr><td><input class="input" data-nwp="${i}:name" value="${esc(p.name)}" placeholder="TOTAL_PAYABLES" aria-label="Placeholder name"></td>
      <td><select class="sel" data-nwp="${i}:kind">${KINDS.map((k) => `<option ${k === p.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
      <td><select class="sel" data-nwp="${i}:from"><option value="tb" ${p.from === 'tb' ? 'selected' : ''}>Trial balance · accounts covered</option><option value="typed" ${p.from === 'typed' ? 'selected' : ''}>Typed</option></select></td>
      <td><button class="x sm" type="button" data-nwrmp="${i}" aria-label="Remove">✕</button></td></tr>`).join('');
    $('#nw-tb', bg).innerHTML = S.tables.map((t, ti) => `<div style="margin:6px 0"><b>AOM Table ${t.n}</b> ${t.cols.map((c, ci) => `<span class="chip"><input class="input" style="height:28px;width:150px" data-nwc="${ti}:${ci}" value="${esc(c.t)}" aria-label="Column"><label style="font-size:12px"><input type="checkbox" data-nwamt="${ti}:${ci}" ${c.amt ? 'checked' : ''}> amount · total</label><button class="x sm" type="button" data-nwrmc="${ti}:${ci}" aria-label="Remove column">✕</button></span>`).join(' ')}
      <button class="reset" type="button" data-nwaddc="${ti}">+ Column</button></div>`).join('');
  };
  const read = (bg) => { S.ref = $('#nw-ref', bg).value.trim(); S.title = $('#nw-title', bg).value.trim(); };
  const ok = await modal({ title: supporting ? 'New Working Paper · Supporting' : `New Working Paper${title ? ' · ' + title : ''}`, wide: true,
    body: `<div class="grid-2"><div class="field"><label class="label" for="nw-ref">WP Reference</label><input class="input" id="nw-ref" value="${esc(S.ref)}"><span class="hint">next free number; you can change it</span></div>
        <div class="field"><label class="label" for="nw-title">Title</label><input class="input" id="nw-title" value="${esc(S.title)}"></div></div>
      <div class="field"><span class="label">Accounts covered</span><div id="nw-acc"></div>
        <select class="sel" id="nw-addacc" aria-label="Add an account"><option value="">+ Account…</option>${tbAccts.map((k) => `<option value="${esc(k)}">${esc(F.chart.byKey[k].code)} ${esc(F.chart.byKey[k].title)}</option>`).join('')}</select>
        <span class="hint">From the trial balance. The Lead Schedules show this reference beside these accounts.</span></div>
      <div class="field"><span class="label">Placeholders</span><table class="pf"><thead><tr><th>Name</th><th>Kind</th><th>Fills in from</th><th></th></tr></thead><tbody id="nw-ph"></tbody></table>
        <button class="reset" type="button" id="nw-addp">+ Placeholder</button> <span class="hint">Use them in the AOM wording as [NAME]. Year, barangay and officials come from Setup.</span></div>
      <div class="field"><span class="label">AOM Tables</span><div id="nw-tb"></div><button class="reset" type="button" id="nw-addt">+ Table</button></div>
      ${supporting ? '' : `<label class="check" style="min-height:0"><input type="checkbox" id="nw-tpl" ${canTpl ? '' : 'disabled'}>Save as a template in the AOM Library${canTpl ? ' (as a Draft, for approval)' : ' (SA and Admin; others send it to the SA)'}</label>`}`,
    onOpen: (bg) => {
      draw(bg);
      $('#nw-addacc', bg).onchange = (e) => { if (e.target.value && !S.accounts.includes(e.target.value)) S.accounts.push(e.target.value); e.target.value = ''; draw(bg); };
      $('#nw-addp', bg).onclick = () => { S.ph.push({ name: '', kind: 'Amount', from: 'typed' }); draw(bg); };
      $('#nw-addt', bg).onclick = () => { S.tables.push({ n: S.tables.length + 1, cols: [{ t: 'Particulars', amt: false }, { t: 'Amount', amt: true }] }); draw(bg); };
      bg.addEventListener('click', (e) => {
        const t = e.target;
        if (t.dataset.nwrma !== undefined) { S.accounts.splice(+t.dataset.nwrma, 1); draw(bg); }
        else if (t.dataset.nwrmp !== undefined) { S.ph.splice(+t.dataset.nwrmp, 1); draw(bg); }
        else if (t.dataset.nwrmc !== undefined) { const [ti, ci] = t.dataset.nwrmc.split(':').map(Number); S.tables[ti].cols.splice(ci, 1); if (!S.tables[ti].cols.length) { S.tables.splice(ti, 1); S.tables.forEach((x, i) => { x.n = i + 1; }); } draw(bg); }
        else if (t.dataset.nwaddc !== undefined) { S.tables[+t.dataset.nwaddc].cols.push({ t: `Column ${S.tables[+t.dataset.nwaddc].cols.length + 1}`, amt: false }); draw(bg); }
      });
      bg.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.nwp) { const [i, f] = t.dataset.nwp.split(':'); S.ph[+i][f] = f === 'name' ? t.value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_') : t.value; if (f === 'name') t.value = S.ph[+i].name; }
        else if (t.dataset.nwc) { const [ti, ci] = t.dataset.nwc.split(':').map(Number); S.tables[ti].cols[ci].t = t.value.trim(); }
        else if (t.dataset.nwamt) { const [ti, ci] = t.dataset.nwamt.split(':').map(Number); S.tables[ti].cols[ci].amt = t.checked; }
      });
    },
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Create Working Paper', cls: 'primary', value: 'ok', check: (bg) => {
      read(bg);
      if (!/^WP-[A-Z0-9-]+$/i.test(S.ref)) { toast('Type the reference like WP-AP01.', 'bad'); return false; }
      if (allWpRefs(F, ctx).has(S.ref)) { toast(`${S.ref} is already used in this audit.`, 'bad'); return false; }
      if (!S.title) { toast('Type the title.', 'bad'); return false; }
      S.ph = S.ph.filter((p) => p.name);
      const tpl = $('#nw-tpl', bg); S.template = !!(tpl && tpl.checked);
      return true;
    } }] });
  if (!ok) return null;
  return { ref: S.ref, title: S.title, accounts: S.accounts, ph: S.ph, tables: S.tables, template: S.template, supporting, at: new Date().toISOString(), by: me.email };
}

// Saves a finding with its new working paper as a Draft template in the AOM Library (SA and Admin).
export async function saveAsTemplate(d, me) {
  const all = await store.list('aom_library');
  const nums = all.map((r) => Number((/^(?:OBS|FND|POOL)-(\d+)$/.exec(r.data.code) || [])[1] || 0));
  const code = 'OBS-' + String(Math.max(0, ...nums) + 1).padStart(3, '0');
  const wpDef = { ...d.wpDef }; delete wpDef.template;
  await store.save('aom_library', `obs-${code}-v1`, { code, version: 1, status: 'Draft', title: d.title, area: d.area || '', section: d.section || 'B', wp: d.wp, wpDef, entityTypes: ['barangay'], saor: '', note: 'From a finding with a new working paper', blocks: JSON.parse(JSON.stringify(d.blocks || [])), createdBy: me.email, createdAt: new Date().toISOString() }, { silent: true });
  return code;
}

/* ── Working Papers of this audit ── */
export function wpListHTML(items, F, ctx) {
  const rows = [];
  items.forEach((it) => {
    const d = it.data; if (!d.wp && !d.wpDef) return;
    const { ph, tn } = wpNeeds(d), v = ctx.varsFor({ data: d });
    const miss = ph.filter((p) => v[p] === undefined).length + tn.filter((n) => !(d.wpData && d.wpData.tables && d.wpData.tables[n])).length;
    rows.push({ ref: d.wp || '—', title: d.wpDef ? d.wpDef.title : d.title, for: `AOM (${d.poolCode || 'new'})`, st: !d.wpData ? pill('Not started', 'grey') : miss ? pill(`${miss} missing`, 'warn') : pill('Complete', 'ok'), sel: it.id });
  });
  ((F && F.rec && F.rec.wps) || []).forEach((w) => rows.push({ ref: w.ref, title: w.title, for: `Supporting · ${(w.accounts || []).map((k) => (F.chart.byKey[k] || {}).title || k).join(', ')}`, st: pill('Supporting', 'grey') }));
  if (!rows.length) return '';
  return `<section class="panel"><div class="panel-head"><h2>Working Papers of this audit</h2></div><div class="panel-body"><table class="pf"><thead><tr><th>WP Ref.</th><th>Title</th><th>For</th><th>Status</th></tr></thead><tbody>
    ${rows.sort((a, b) => a.ref.localeCompare(b.ref)).map((r) => `<tr${r.sel ? ` class="click" data-sel="${r.sel}"` : ''}><td class="mono">${esc(r.ref)}</td><td>${esc(r.title)}</td><td>${esc(r.for)}</td><td>${r.st}</td></tr>`).join('')}</tbody></table></div></section>`;
}
export { FILLED, formatVar };
