// Financial Statements · Statements tab: management's statements, imported from Excel and compared line by line with
// the statements built from the trial balances. Where they differ or don't follow the template, the Results record
// that the statement was reconstructed by the audit team. Only the amounts are kept, never the file.
import { store, emitChange } from '../store.js';
import { esc, toast, confirmBox, pill, $, $$ } from '../ui.js';
import { fsId, loadFsRec, money, cents, parseAmt } from '../fs.js';
import { normTitle, similar } from '../coa.js';
import { loadScript } from '../wp.js';
import { fsDoc } from './baarfs.js';

const KINDS = [['sfperf', 'Financial Performance', /FINANCIAL\s+PERFORMANCE/], ['sfpos', 'Financial Position', /FINANCIAL\s+POSITION/],
  ['scne', 'Changes in Net Assets/Equity', /CHANGES\s+IN\s+(NET\s+ASSETS|EQUITY)/], ['scf', 'Cash Flows', /CASH\s+FLOWS?/]];
const NAME = Object.fromEntries(KINDS.map(([k, t]) => [k, t]));
const IDX = { sfperf: 0, sfpos: 1, scne: 2, scf: 3 };

async function readMgmt(file) {
  if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) throw new Error('Choose the Excel file of management\'s statements (.xlsx or .xls).');
  const XLSX = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellNF: true, cellText: true, bookVBA: false });
  const out = {};
  const txt = (c) => (c ? String(c.w !== undefined ? c.w : c.v !== undefined ? c.v : '').trim() : '');
  const num = (c) => { if (!c || c.v === undefined || c.v === '' || c.v === null) return null; if (typeof c.v === 'number') return c.v; const n = parseAmt(c.v); return n === null || isNaN(n) ? null : n; };
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]; if (!ws || !ws['!ref']) continue;
    const rg = XLSX.utils.decode_range(ws['!ref']), at = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    let kind = (KINDS.find(([, , re]) => re.test(name.toUpperCase())) || [])[0] || null;
    const rows = [];
    for (let r = rg.s.r; r <= rg.e.r; r++) {
      let line = '';
      for (let c = rg.s.c; c <= rg.e.c; c++) line += ' ' + txt(at(r, c));
      const U = line.toUpperCase();
      const k = /STATEMENT\s+OF/.test(U) && KINDS.find(([, , re]) => re.test(U));
      if (k) { kind = k[0]; continue; }
      if (!kind) continue;
      let label = '', lc = -1;
      for (let c = rg.s.c; c <= Math.min(rg.e.c, rg.s.c + 5); c++) { const t = txt(at(r, c)); if (/[a-z]{3}/i.test(t) && num(at(r, c)) === null) { label = t; lc = c; break; } }
      if (!label) continue;
      const vals = [];
      for (let c = lc + 1; c <= rg.e.c; c++) { const n = num(at(r, c)); if (n !== null) vals.push({ c, n }); }
      if (vals.length) rows.push({ kind, label: label.replace(/\s+/g, ' '), vals });
    }
    // per statement: leave out the Note column (small whole numbers), then take the first amount column (the current year)
    KINDS.forEach(([k]) => {
      const rs = rows.filter((x) => x.kind === k); if (!rs.length) return;
      const cols = {};
      rs.forEach((x) => x.vals.forEach((v) => { (cols[v.c] = cols[v.c] || []).push(v.n); }));
      const amtCols = Object.keys(cols).map(Number).filter((c) => !cols[c].every((n) => Number.isInteger(n) && Math.abs(n) <= 60)).sort((a, b) => a - b);
      if (!amtCols.length) return;
      const cy = amtCols[0];
      out[k] = { sheet: name, lines: rs.map((x) => { const v = x.vals.find((y) => y.c === cy); return v ? { label: x.label, amt: cents(v.n) / 100 } : null; }).filter(Boolean) };
    });
  }
  if (!Object.keys(out).length) throw new Error('No statement was found in this file. Each statement needs its title (for example "Statement of Financial Position") and the amounts beside the lines.');
  return out;
}

// Line by line: { rows: [{ t, mine, theirs, diff, label }], extra: [lines not in the template], diffs }
function compare(stmt, m) {
  const lines = stmt.rows.filter((r) => ['row', 'tot', 'grand1', 'grand'].includes(r.k) && r.v && r.v[0] !== null && r.v[0] !== undefined).map((r) => ({ r, n: normTitle(r.t) }));
  const used = new Set(), rows = [], extra = [];
  (m.lines || []).forEach((x) => {
    const n = normTitle(x.label);
    let best = null;
    lines.forEach((l) => { if (used.has(l)) return; const s = similar(n, l.n); if (!best || s > best.s) best = { l, s }; });
    if (best && best.s >= 0.6) { used.add(best.l); const theirs = cents(x.amt), mine = best.l.r.v[0]; rows.push({ t: best.l.r.t, label: x.label, theirs, mine, diff: theirs - mine }); }
    else extra.push(x);
  });
  lines.filter((l) => !used.has(l) && l.r.v[0]).forEach((l) => rows.push({ t: l.r.t, label: '', theirs: null, mine: l.r.v[0], diff: null, missing: true }));
  return { rows, extra, diffs: rows.filter((x) => x.diff).length };
}
function status(F) {
  const m = (F.rec && F.rec.mgmt) || null;
  const doc = fsDoc(F, 0);
  return KINDS.map(([k, t]) => {
    const g = m && m.stmts && m.stmts[k];
    const notTpl = !!(m && m.notTpl && m.notTpl[k]);
    if (!g) return { k, t, given: false, notTpl, c: null };
    const c = compare(doc.stmts[IDX[k]], g);
    return { k, t, given: true, notTpl: notTpl || c.extra.length > Math.max(2, g.lines.length * 0.3), c };
  });
}
const pillOf = (s) => !s.given ? pill('Not given', 'grey') : s.notTpl ? pill('Not in the template', 'warn') : s.c.diffs ? pill(`${s.c.diffs} difference${s.c.diffs > 1 ? 's' : ''}`, 'warn') : pill('✓ Agrees', 'ok');

// For the Statement Results on the Results tab.
export function mgmtResults(F) {
  const m = F.rec && F.rec.mgmt;
  if (!m) return [{ st: 'info', t: 'Management\'s statements not imported (Statements tab)' }];
  return status(F).flatMap((s) => {
    if (!s.given) return [{ st: 'info', t: `${s.t}: management gave none · reconstructed by the audit team` }];
    const out = [];
    if (s.c.diffs) out.push({ st: 'warn', t: `${s.t} differs from management's (${s.c.diffs} line${s.c.diffs > 1 ? 's' : ''})` });
    else out.push({ st: 'ok', t: `${s.t} agrees with management's` });
    if (s.notTpl || s.c.diffs) out.push({ st: 'info', t: `${s.t} reconstructed by the audit team` });
    return out;
  });
}

export async function mgmtPanel({ F, ctx, me, q, base, canEdit: can0 }) {
  const canEdit = !!can0 && !F.confirmed;
  const m = (F.rec && F.rec.mgmt) || null;
  const st = status(F);
  const cur = st.find((s) => s.k === q.get('ms')) || st.find((s) => s.given) || st[0];
  let detail = '';
  if (m && cur.given) {
    const c = cur.c;
    detail = `<table class="pf" style="margin-top:8px"><thead><tr><th>Line</th><th class="n">Management</th><th class="n">From the trial balance</th><th class="n">Difference</th></tr></thead><tbody>
      ${c.rows.map((x) => `<tr><td>${esc(x.t)}${x.label && normTitle(x.label).join(' ') !== normTitle(x.t).join(' ') ? `<div class="hint">In management's: ${esc(x.label)}</div>` : ''}</td><td class="n">${x.theirs === null ? '<span class="hint">not shown</span>' : money(x.theirs, { dash: '-' })}</td><td class="n">${money(x.mine, { dash: '-' })}</td>
        <td class="n">${x.diff === null ? '' : x.diff ? `<b style="color:var(--warn-ink)">${money(x.diff)}</b>` : '-'}</td></tr>`).join('')}
      ${c.extra.map((x) => `<tr><td>${esc(x.label)}<div class="hint">Not in the template</div></td><td class="n">${money(cents(x.amt), { dash: '-' })}</td><td></td><td></td></tr>`).join('')}</tbody></table>`;
  }
  const body = `<section class="panel" data-transient><div class="panel-head"><h2>Management's Statements vs. the Trial Balance</h2>
      <span class="btn-row" style="margin-left:auto">${canEdit ? `<label class="btn sm ${m ? 'ghost' : 'primary'}" for="m-file">${m ? 'Replace' : 'Import Management\'s Statements'}</label>${m ? '<button class="btn sm ghost" type="button" id="m-rm">Remove</button>' : ''}<input type="file" id="m-file" accept=".xlsx,.xls,.xlsm" hidden>` : ''}</span></div><div class="panel-body">
    ${m ? `<div class="hint" style="margin-bottom:6px">📄 ${esc(m.name)} · read ${esc((m.at || '').slice(0, 10))}; only the amounts are kept.</div>
      <div class="tabs2">${st.map((s) => `<a class="t ${s === cur ? 'on' : ''}" href="${base}&s=fs&ms=${s.k}">${esc(s.t)} ${pillOf(s)}</a>`).join('')}</div>
      ${cur.given ? `<label class="check" style="min-height:0"><input type="checkbox" id="m-nt" ${m.notTpl && m.notTpl[cur.k] ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>Management's ${esc(cur.t)} does not follow the template (reconstructed by the audit team)</label>` : `<p class="hint">Management gave no ${esc(cur.t)}; the one built from the trial balance is recorded as reconstructed by the audit team.</p>`}
      ${detail}
      <p class="hint" style="margin:8px 0 0">The BAAR uses the statements built from the confirmed trial balances. A statement that differs from management's, does not follow the template, or was not given is recorded in the Results as "Reconstructed by the audit team". The Statement of Comparison of Budget and Actual Amounts is entered on the Budget tab and not compared here.</p>`
      : '<p class="hint" style="margin:0">Import management\'s statements (Excel) to compare them line by line with the statements built from the trial balance. Each statement needs its title, for example "Statement of Financial Position", and the amounts beside the lines.</p>'}
    </div></section>`;
  return {
    body,
    mount(root) {
      const save = async (mg, what) => {
        const rec = (await loadFsRec(F.lguId, F.y)) || { type: 'fs', teamId: ctx.teamId, lguId: F.lguId, year: F.y, auditId: ctx.rec.id };
        const r2 = { ...rec, mgmt: mg }; if (!mg) delete r2.mgmt;
        await store.save('letters', fsId(F.lguId, F.y), r2, { silent: true });
        if (what) await store.log(what, `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
        emitChange('local');
      };
      const fi = $('#m-file', root);
      if (fi) fi.onchange = async () => {
        const f = fi.files[0]; fi.value = ''; if (!f) return;
        try { const stmts = await readMgmt(f); await save({ name: f.name, at: new Date().toISOString(), by: me.email, byName: me.name, stmts, notTpl: {} }, 'imported management\'s financial statements');
          toast(`Read: ${Object.keys(stmts).map((k) => NAME[k]).join(', ')}.`, 'ok'); } catch (e) { toast(e.message, 'bad'); }
      };
      const rm = $('#m-rm', root);
      if (rm) rm.onclick = async () => { if (await confirmBox('Remove', 'Remove management\'s statements read from the file?', 'Remove')) await save(null, 'removed management\'s financial statements'); };
      const nt = $('#m-nt', root);
      if (nt) nt.onchange = () => save({ ...m, notTpl: { ...(m.notTpl || {}), [cur.k]: nt.checked } }, '');
      void $$;
    }
  };
}
