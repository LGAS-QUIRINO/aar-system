// Financial Statements · Lead Schedules: one per statement line, the accounts under it (all funds combined) for the
// current and the comparative year, the change, and the working paper reference.
import { store, emitChange } from '../store.js';
import { esc, toast, $, $$ } from '../ui.js';
import { fsId, loadFsRec, money } from '../fs.js';
import { LINES, LINE } from '../coa.js';
import { printPages } from '../baar-doc.js';
import { loadScript } from '../wp.js';
import { openNewWp } from './wpfill.js';

// The WP reference of each account: a finding's working paper, a supporting working paper, or one typed here.
export function wpRefs(F, ctx) {
  const out = {};
  const put = (key, ref, t) => { if (key && ref && !out[key]) out[key] = { ref, t }; };
  (ctx.aoms || []).forEach((a) => {
    const d = a.data; if (!d.wp) return;
    (d.wpDef && d.wpDef.accounts || []).forEach((k) => put(k, d.wp, d.title));
    (d.flagCodes || []).forEach((c) => Object.keys(F.figY.accts).filter((k) => F.chart.byKey[k] && F.chart.byKey[k].code === c).forEach((k) => put(k, d.wp, d.title)));
  });
  ((F.rec && F.rec.wps) || []).forEach((w) => (w.accounts || []).forEach((k) => put(k, w.ref, w.title)));
  Object.entries((F.rec && F.rec.leadRefs) || {}).forEach(([k, ref]) => { if (ref) out[k] = { ref, t: '', typed: true }; });
  return out;
}
export function leadData(F) {
  const keys = new Set([...Object.keys(F.figY.accts || {}), ...Object.keys(F.figP.accts || {})]);
  const by = {};
  keys.forEach((k) => { const a = F.chart.byKey[k]; if (!a || !LINE[a.line]) return; const cy = F.figY.accts[k] || 0, py = F.figP.accts[k] || 0; if (!cy && !py) return; (by[a.line] = by[a.line] || []).push({ k, a, cy, py }); });
  Object.values(by).forEach((l) => l.sort((x, y) => x.a.code.localeCompare(y.a.code)));
  return LINES.filter((l) => by[l.k]).map((l) => ({ line: l, rows: by[l.k], cy: by[l.k].reduce((t, x) => t + x.cy, 0), py: by[l.k].reduce((t, x) => t + x.py, 0) }));
}
const lineName = (l) => `${l.label}${l.note ? ` (Note ${l.note})` : ''}`;

export async function leadsTab({ F, ctx, me, q, base, canEdit }) {
  const all = leadData(F);
  if (!all.length) return { body: '<section class="panel"><div class="panel-body"><div class="empty">The lead schedules come from the trial balances. Enter them on the Trial Balance tab first.</div></div></section>', mount() {} };
  const cur = all.find((x) => x.line.k === q.get('l')) || all[0];
  const refs = wpRefs(F, ctx);
  const body = `<section class="panel" data-transient><div class="panel-head"><h2>Lead Schedules</h2><span class="hint" style="margin-left:8px">all funds combined · CY ${F.y} and CY ${F.yp}</span>
      <span class="btn-row" style="margin-left:auto"><button class="btn sm ghost" type="button" id="ls-print">Print</button><button class="btn sm primary" type="button" id="ls-xl">Excel</button></span></div><div class="panel-body">
    <div class="tabs2">${all.map((x) => `<a class="t ${x === cur ? 'on' : ''}" href="${base}&s=leads&l=${x.line.k}">${esc(x.line.label)}</a>`).join('')}</div>
    <table class="pf"><colgroup><col style="width:120px"><col><col style="width:130px"><col style="width:130px"><col style="width:130px"><col style="width:220px"></colgroup>
      <thead><tr><th>Code</th><th>Account Title</th><th class="n">CY ${F.y}</th><th class="n">CY ${F.yp}</th><th class="n">Change</th><th>WP Ref.</th></tr></thead><tbody>
      ${cur.rows.map((x) => { const r = refs[x.k]; return `<tr><td class="mono">${esc(x.a.code)}</td><td>${esc(x.a.title)}</td><td class="n">${money(x.cy)}</td><td class="n">${money(x.py)}</td><td class="n">${money(x.cy - x.py)}</td>
        <td>${r && !r.typed ? `<b>${esc(r.ref)}</b> <span class="hint">${esc(r.t)}</span>` : `<span class="btn-row" style="justify-content:flex-start"><input class="input" style="height:30px;width:96px" data-lref="${esc(x.k)}" value="${esc(r ? r.ref : '')}" placeholder="No WP" aria-label="WP reference for ${esc(x.a.title)}" ${canEdit ? '' : 'disabled'}>${canEdit ? `<button class="reset" type="button" data-lnew="${esc(x.k)}">+ New WP</button>` : ''}</span>`}</td></tr>`; }).join('')}
      <tr style="font-weight:700"><td></td><td>Total ${esc(lineName(cur.line))}</td><td class="n">${money(cur.cy)}</td><td class="n">${money(cur.py)}</td><td class="n">${money(cur.cy - cur.py)}</td><td></td></tr></tbody></table>
    <p class="hint" style="margin:8px 0 0">One lead schedule per statement line, from the trial balances (all funds combined${F.confirmed ? ', as confirmed' : ''}). The WP Ref. fills in by itself when a finding's working paper covers the account; otherwise type your own reference, or add a supporting working paper with + New WP.</p></div></section>`;
  return {
    body,
    mount(root) {
      const saveRec = async (patch) => {
        const rec = (await loadFsRec(F.lguId, F.y)) || { type: 'fs', teamId: ctx.teamId, lguId: F.lguId, year: F.y, auditId: ctx.rec.id };
        await store.save('letters', fsId(F.lguId, F.y), { ...rec, ...patch(rec) }, { silent: true });
        emitChange('local');
      };
      $$('[data-lref]', root).forEach((el) => { el.onchange = () => saveRec((r) => ({ leadRefs: { ...(r.leadRefs || {}), [el.dataset.lref]: el.value.trim() } })); });
      $$('[data-lnew]', root).forEach((b) => { b.onclick = async () => {
        const w = await openNewWp({ F, ctx, me, accounts: [b.dataset.lnew], supporting: true });
        if (!w) return;
        await saveRec((r) => ({ wps: [...(r.wps || []), w] }));
        await store.log('added a supporting working paper', `${ctx.lgu.name} · ${w.ref} ${w.title}`, ctx.teamId, me.email);
        toast(`${w.ref} added.`, 'ok');
      }; });
      const rowsAoa = (x) => [[`${lineName(x.line)}`], ['Code', 'Account Title', `CY ${F.y}`, `CY ${F.yp}`, 'Change', 'WP Ref.'],
        ...x.rows.map((r) => [r.a.code, r.a.title, r.cy / 100, r.py / 100, (r.cy - r.py) / 100, (refs[r.k] || {}).ref || '']), ['', 'Total', x.cy / 100, x.py / 100, (x.cy - x.py) / 100, '']];
      $('#ls-xl', root).onclick = async () => {
        const XLSX = await loadScript('lib/xlsx.full.min.js', 'XLSX');
        const wb = XLSX.utils.book_new();
        all.forEach((x, i) => {
          const ws = XLSX.utils.aoa_to_sheet([[`Barangay ${ctx.lgu.name}, ${ctx.mun.name}, Quirino`], ['Lead Schedule'], [], ...rowsAoa(x)]);
          ws['!cols'] = [{ wch: 14 }, { wch: 48 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
          XLSX.utils.book_append_sheet(wb, ws, `${i + 1} ${x.line.label.replace(/[\\/?*[\]:]/g, '')}`.slice(0, 31));
        });
        XLSX.writeFile(wb, `Lead Schedules ${ctx.lgu.name} ${F.y}.xlsx`);
        await store.log('downloaded the lead schedules (Excel)', `${ctx.lgu.name} · ${ctx.audit.auditYear}`, ctx.teamId, me.email);
      };
      $('#ls-print', root).onclick = () => {
        const css = '.pg{padding:.6in;font:11pt "Times New Roman",serif}.pg h2{font-size:12pt;margin:0 0 2px}.pg p{margin:0 0 8px}.pg table{width:100%;border-collapse:collapse}.pg th,.pg td{border-bottom:1px solid #999;padding:3px 4px;text-align:left}.pg .n{text-align:right}.pg tr.t td{font-weight:700;border-top:1px solid #000}.pg{page-break-after:always}';
        const html = all.map((x) => `<div class="pg"><h2>Barangay ${esc(ctx.lgu.name)}, ${esc(ctx.mun.name)}, Quirino</h2><p>Lead Schedule · ${esc(lineName(x.line))} · December 31, ${F.y} and ${F.yp}</p>
          <table><thead><tr><th>Code</th><th>Account Title</th><th class="n">CY ${F.y}</th><th class="n">CY ${F.yp}</th><th class="n">Change</th><th>WP Ref.</th></tr></thead><tbody>
          ${x.rows.map((r) => `<tr><td>${esc(r.a.code)}</td><td>${esc(r.a.title)}</td><td class="n">${money(r.cy)}</td><td class="n">${money(r.py)}</td><td class="n">${money(r.cy - r.py)}</td><td>${esc((refs[r.k] || {}).ref || '')}</td></tr>`).join('')}
          <tr class="t"><td></td><td>Total</td><td class="n">${money(x.cy)}</td><td class="n">${money(x.py)}</td><td class="n">${money(x.cy - x.py)}</td><td></td></tr></tbody></table></div>`).join('');
        printPages(css, html, `Lead Schedules · ${ctx.lgu.name} · ${F.y}`);
      };
    }
  };
}
