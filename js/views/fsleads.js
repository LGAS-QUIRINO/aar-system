// Financial Statements · Financial Audit lead schedules.
// Main categories follow the SAI structure used by the team:
//   C.1 Audit Foci / Areas · C.6 Other Financial Related Issues · OMA (Other Material Accounts).
import { store, emitChange, newId } from '../store.js';
import { esc, toast, $, $$, modal, pill } from '../ui.js';
import { fsId, loadFsRec, money } from '../fs.js';
import { printPages } from '../baar-doc.js';
import { loadScript } from '../wp.js';
import { nextRef, allWpRefs } from './wpfill.js';
import { readWorkingPaper } from '../wp.js';
import { activeTemplates } from './library.js';
import { fromTemplate, blankAom, ST } from '../aom.js';

const FOCI = [
  { id:'a', title:'Cash in Bank – Local Currency, Current Account', cls:'Assets', re:[/^cash in bank\s*-?\s*local currency,? current account$/i] },
  { id:'b', title:'Cash in Bank – Local Currency, Savings Account', cls:'Assets', re:[/^cash in bank\s*-?\s*local currency,? savings account$/i] },
  { id:'c', title:'Loans Receivable – Others', cls:'Assets', re:[/^loans receivable\s*-?\s*others$/i,/^allowance for impairment\s*-?\s*loans receivable\s*-?\s*others$/i] },
  { id:'d', title:'Due from Local Government Units', cls:'Assets', re:[/^due from local government units$/i] },
  { id:'e', title:'Advances to Officers and Employees', cls:'Assets', re:[/^advances to officers and employees$/i] },
  { id:'f', title:'Other Receivables', cls:'Assets', re:[/^other receivables$/i,/^allowance for impairment\s*-?\s*other receivables$/i] },
  { id:'g', title:'Advances to Contractors', cls:'Assets', re:[/^advances to contractors$/i] },
  { id:'h', title:'Welfare Goods for Distribution', cls:'Assets', re:[/^welfare goods for distribution$/i] },
  { id:'i', title:'Other Supplies and Materials for Distribution', cls:'Assets', re:[/^other supplies and materials for distribution$/i] },
  { id:'j', title:'Construction Materials Inventory', cls:'Assets', re:[/^construction materials inventory$/i] },
  { id:'k', title:'Flood Control Systems', cls:'Assets', re:[/^flood control systems$/i,/^(accumulated depreciation|accumulated impairment losses)\s*-?\s*flood control systems$/i] },
  { id:'l', title:'Disaster Response and Rescue Equipment', cls:'Assets', re:[/^disaster response and rescue equipment$/i,/^(accumulated depreciation|accumulated impairment losses)\s*-?\s*disaster response and rescue equipment$/i] },
  { id:'m', title:'Other Structures', cls:'Assets', re:[/^other structures$/i,/^(accumulated depreciation|accumulated impairment losses)\s*-?\s*other structures$/i] },
  { id:'n', title:'Other Property, Plant and Equipment', cls:'Assets', re:[/^other property,? plant and equipment$/i,/^(accumulated depreciation|accumulated impairment losses)\s*-?\s*other property,? plant and equipment$/i] },
  { id:'o', title:'Breeding Stocks', cls:'Assets', re:[/^breeding stocks$/i] },
  { id:'p', title:'Accounts Payable', cls:'Liabilities', re:[/^accounts payable$/i] },
  { id:'q', title:'Due to National Government Agencies', cls:'Liabilities', re:[/^due to national government agencies$/i] },
  { id:'r', title:'Due to Local Government Units', cls:'Liabilities', re:[/^due to local government units$/i] },
  { id:'s', title:'Trust Liabilities', cls:'Liabilities', re:[/^trust liabilities$/i] },
  { id:'t', title:'Trust Liabilities – DRRM', cls:'Liabilities', re:[/^trust liabilities\s*-?\s*(disaster risk reduction and management fund|drrm|drrmf)$/i] },
  { id:'u', title:'Guaranty/Security Deposits Payable', cls:'Liabilities', re:[/^guaranty\/security deposits payable$/i] },
  { id:'v', title:'Subsidy to Local Government Units', cls:'Expenses', re:[/^subsidy to local government units$/i] },
  { id:'w', title:'Government Equity', cls:'Equity', re:[/^government equity$/i] },
  { id:'x', title:'Transfers from General Fund of Unspent DRRMF', cls:'Revenue', re:[/^transfers from general fund of unspent drrmf$/i] },
  { id:'y', title:'Donations', cls:'Expenses', re:[/^donations$/i] },
  { id:'z', title:'Other Maintenance and Operation Expenses', cls:'Expenses', re:[/^other maintenance and operat(ing|ion) expenses$/i] }
];

const C6 = [
  'Taxes withheld from employees and suppliers and remittances to the Bureau of Internal Revenue (BIR)',
  'GSIS and HDMF remittances',
  'Premium contributions and remittance to PhilHealth',
  'Foreign-assisted projects / Official Development Assistance (ODA)',
  'National Task Force to End Local Communist Armed Conflict (NTF-ELCAC) Funds',
  'LGSP – Support to Barangay Development Program of the NTF-ELCAC',
  '20% Development Fund',
  'Payments to casuals, job order, contractuals and consultants',
  'LDRRM Funds / QRF',
  'Gender and Development (GAD) Funds'
].map((title,i)=>({ id:String(i+1), title }));

const norm = s => String(s || '').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
// The title as is, and without a closing note in brackets: the Manual's "Trust Liabilities - Disaster Risk Reduction and Management Fund (DRRMF)".
const isFocusAccount = (a,f) => { const t = norm(a.title), t2 = t.replace(/\s*\([^)]*\)\s*$/,''); return f.re.some(re => re.test(t) || re.test(t2)); };

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

function allAccounts(F) {
  const keys = new Set([...Object.keys(F.figY.accts || {}), ...Object.keys(F.figP.accts || {})]);
  return [...keys].map(k => {
    const a = F.chart.byKey[k]; if (!a) return null;
    const cy = F.figY.accts[k] || 0, py = F.figP.accts[k] || 0;
    if (!cy && !py) return null;
    return { k, a, cy, py };
  }).filter(Boolean).sort((x,y)=>x.a.code.localeCompare(y.a.code));
}

function focusData(F) {
  const accts = allAccounts(F);
  return FOCI.map(f => {
    const rows = accts.filter(x => isFocusAccount(x.a,f));
    // Trust Liabilities – DRRM must be in the trial balance whenever the 5% BDRRMF has an unutilized balance at year-end.
    // Until the 5% BDRRMF trial balance shows the fund fully utilized, it is never Not Applicable.
    const hasFund = f.id === 't' && F.funds.some(x => x.k === 'BDRRMF');
    const b = hasFund && F.figY && F.figY.bdrrmf;
    const pending = !!(hasFund && !rows.length && !b);
    const must = !!(b && b.unutilized > 0 && !rows.length);
    return { ...f, rows, cy:rows.reduce((s,x)=>s+x.cy,0), py:rows.reduce((s,x)=>s+x.py,0), status:rows.length||must||pending?'Applicable':'Not Applicable', missing: must ? b.unutilized : 0, pending };
  });
}

function omaData(F) {
  const accts = allAccounts(F);
  return accts.filter(x => !FOCI.some(f => isFocusAccount(x.a,f))).map((x,i)=>({
    id:x.k, title:x.a.title, cls:x.a.cls || 'Account', rows:[x], cy:x.cy, py:x.py, status:'For Verification'
  }));
}

function relatedAoms(item, ctx, cat) {
  const key = cat ? cat + ':' + item.id : null;
  const keys = new Set((item.rows || []).map(r => r.k));
  const codes = new Set((item.rows || []).map(r => r.a.code));
  return (ctx.aoms || []).filter(a => {
    const d = a.data || {};
    return (key && d.faItem === key) || (d.wpDef && d.wpDef.accounts || []).some(k => keys.has(k)) || (d.flagCodes || []).some(code => codes.has(code));
  });
}

const resultKey = (cat, item) => cat + ':' + item.id;

// Working papers of an item: those behind its AOMs, then the supporting ones (matched by account, or by item for issues without balances).
function workingPapersFor(item, cat, F, ctx) {
  const seen = new Set(), out = [];
  relatedAoms(item, ctx, cat).forEach(a => {
    const d = a.data || {};
    if (d.wp && !seen.has(d.wp)) {
      seen.add(d.wp);
      out.push({ ref:d.wp, title:(d.wpDef && d.wpDef.title) || d.title || 'Working Paper', status:d.status || 'Draft', kind:'aom', id:a.id, imp:d.wpData || null });
    }
  });
  const key = resultKey(cat, item);
  ((F.rec && F.rec.wps) || []).forEach(w => {
    const mine = w.item ? w.item === key : (w.accounts || []).some(k => (item.rows || []).some(r => r.k === k));
    if (mine && !seen.has(w.ref)) { seen.add(w.ref); out.push({ ref:w.ref, title:w.title || 'Working Paper', kind:'supporting', imp:w.imp || null, w }); }
  });
  return out;
}

// Other Financial Related Issues: whether each applies is set by the auditor (with a reason when it does not).
const JO_ITEM = '8';
function c6Status(item, F) {
  const s = F.rec && F.rec.c6 && F.rec.c6[item.id];
  if (s && s.status) return s;
  if (item.id === JO_ITEM) return { status:'Not Applicable', reason:`Barangay workers are paid honoraria; no casual, job order, contract of service or consultant was engaged in CY ${F.y}.`, auto:true };
  return { status:'To be set', reason:'' };
}

function auditResultOf(item, cat, F, ctx) {
  if (!item || item.status !== 'Applicable') return '';
  if (relatedAoms(item, ctx, cat).length) return 'With Finding';
  const saved = F.rec && F.rec.auditResults && F.rec.auditResults[resultKey(cat,item)];
  if (saved) return saved;
  return workingPapersFor(item,cat,F,ctx).length ? 'In Progress' : 'Not Started';
}
// Lead schedule items marked No Findings (no AOM on them): their accounts, so Possible Findings can set their flags aside.
export function leadNoFindings(F, ctx) {
  if (!F.figY || !F.figY.any) return [];
  const out = [];
  [['focus', focusData(F)], ['oma', omaData(F)]].forEach(([cat, items]) => items.forEach((it) => {
    if (auditResultOf(it, cat, F, ctx) !== 'No Findings') return;
    out.push({ title: it.title, codes: new Set((it.rows || []).map((r) => r.a.code)), bdrrmf: cat === 'focus' && it.id === 't' });
  }));
  return out;
}
const RESULT_PILL = { 'Not Started':'grey', 'In Progress':'', 'No Findings':'ok', 'With Finding':'bad' };
const resultPill = (v) => v ? pill(v, RESULT_PILL[v]) : '<span class="hint">—</span>';
const appPill = (st) => st === 'Applicable' ? pill('Applicable','ok') : st === 'Not Applicable' ? pill('Not Applicable','grey') : st === 'To be set' ? pill('To be set','warn') : pill('For Verification','warn');

function detailTable(item,F,refs){
  if(!item.rows || !item.rows.length) return '<div class="empty">No matching account balance was found in the trial balances.</div>';
  return `<table class="pf"><thead><tr><th>Code</th><th>Account Title</th><th class="n">CY ${F.y}</th><th class="n">CY ${F.yp}</th><th class="n">Change</th><th>WP Ref.</th></tr></thead><tbody>
    ${item.rows.map(r=>`<tr><td class="mono">${esc(r.a.code)}</td><td>${esc(r.a.title)}</td><td class="n">${money(r.cy)}</td><td class="n">${money(r.py)}</td><td class="n">${money(r.cy-r.py)}</td><td>${esc((refs[r.k]||{}).ref||'')}</td></tr>`).join('')}
    <tr style="font-weight:700"><td></td><td>Total</td><td class="n">${money(item.cy||0)}</td><td class="n">${money(item.py||0)}</td><td class="n">${money((item.cy||0)-(item.py||0))}</td><td></td></tr>
  </tbody></table>`;
}

function leadPanel(cur, F, refs) {
  if (cur.pending) return `<div class="note info" style="display:block">Runs once the 5% BDRRMF trial balance for CY ${esc(F.y)} is entered.</div>`;
  if (cur.missing) return `<div class="note warn" style="display:block">Not in the trial balance. The unutilized 5% BDRRMF of ₱${money(cur.missing)} should be shown here as Trust Liabilities – DRRM. See Possible Findings on the Results tab.</div>`;
  if (!cur.rows || !cur.rows.length) return '<div class="empty" style="padding:14px 4px">No balance in the trial balance.</div>';
  const ch = (cur.cy||0) - (cur.py||0), pct = cur.py ? (ch / Math.abs(cur.py) * 100) : null;
  return `<div class="ls-figs">
      <div><span>CY ${esc(F.y)}</span><b>${money(cur.cy||0,{dash:'0.00'})}</b></div>
      <div><span>CY ${esc(F.yp)}</span><b>${money(cur.py||0,{dash:'0.00'})}</b></div>
      <div><span>Change</span><b>${money(ch,{dash:'0.00'})}</b>${pct===null?'':`<small>${pct>0?'+':''}${pct.toFixed(1)}%</small>`}</div>
    </div>
    ${cur.rows.length>1?`<table class="pf ls-lines"><tbody>${cur.rows.map(r=>`<tr><td><span class="mono">${esc(r.a.code)}</span> ${esc(r.a.title)}${(refs[r.k]||{}).ref?` · <b>${esc(refs[r.k].ref)}</b>`:''}</td><td class="n">${money(r.cy)}</td></tr>`).join('')}</tbody></table>`:''}`;
}

const impLine = (imp) => {
  if (!imp) return 'Not imported yet';
  const n = Object.keys(imp.vars || {}).length, t = Object.keys(imp.tables || {}).map(Number).sort((a,b)=>a-b);
  const d = imp.at ? new Date(imp.at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '';
  return `Imported ${d} · ${n} value${n===1?'':'s'}${t.length?' · '+t.map(x=>'AOM Table '+x).join(', '):''}`;
};

// Suggested working paper titles for the accounts that usually have one.
const WP_TITLES = { a:'Bank Reconciliation Review', e:'Aging of Cash Advances', f:'Aging and Existence of Other Receivables' };

export async function leadsTab({ F, ctx, me, q, base, canEdit }) {
  const cat = ['focus','c6','oma'].includes(q.get('cat')) ? q.get('cat') : 'focus';
  const focus = focusData(F), oma = omaData(F);
  const c6 = C6.map(x => { const s = c6Status(x, F); return { ...x, rows:[], status:s.status, reason:s.reason, autoReason:!!s.auto }; });
  const all = cat==='focus' ? focus : cat==='c6' ? c6 : oma;
  const f = cat==='focus' && ['all','app','na'].includes(q.get('f')) ? q.get('f') : cat==='focus' ? 'app' : 'all';
  const list = all.filter(x => f==='all' || (f==='app' && x.status==='Applicable') || (f==='na' && x.status==='Not Applicable'));
  const cur = all.find(x => x.id === q.get('item')) || list[0] || null;
  const refs = wpRefs(F,ctx);
  const wps = cur ? workingPapersFor(cur,cat,F,ctx) : [];
  const nApp = focus.filter(x=>x.status==='Applicable').length, nNa = focus.length - nApp;
  const result = cur ? auditResultOf(cur,cat,F,ctx) : '';
  const aoms = cur ? relatedAoms(cur, ctx, cat) : [];
  const tpls = cur && result === 'With Finding' && canEdit ? await activeTemplates('barangay') : [];
  // Supporting working papers of the item (including ones already behind an AOM): any of them can fill an AOM.
  const supWps = cur ? ((F.rec && F.rec.wps) || []).filter(w => w.item ? w.item === resultKey(cat,cur) : (w.accounts || []).some(k => (cur.rows || []).some(r => r.k === k))) : [];

  const link = (o) => { const p = { cat, f: cat==='focus' ? f : null, item: cur && cur.id, ...o }; return `${base}&s=leads` + Object.entries(p).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>`&${k}=${encodeURIComponent(v)}`).join(''); };
  const tabLink = (k) => `${base}&s=leads&cat=${k}`;
  const rowLink = (x) => link({ item: x.id });
  const instruction = cat==='c6' ? 'Select an item to set whether it applies and record its working papers.' : 'Select an account to see its lead schedule and working papers.';
  const wpCol = (x) => { const r = workingPapersFor(x,cat,F,ctx).map(w=>w.ref); return r.length ? `<span class="fa-wpref">${esc(r.join(', '))}</span>` : '<span class="hint">—</span>'; };

  const listHTML = `<section class="panel fa-list"><div class="panel-body">
      <div class="fa-tools">
        ${cat==='focus'?`<div class="fa-filters"><a class="${f==='all'?'on':''}" href="${link({f:'all',item:null})}">All ${focus.length}</a><a class="${f==='app'?'on':''}" href="${link({f:'app',item:null})}">Applicable ${nApp}</a><a class="${f==='na'?'on':''}" href="${link({f:'na',item:null})}">Not Applicable ${nNa}</a></div>`:'<div></div>'}
        <input class="input fa-search" id="fa-search" type="search" placeholder="${cat==='c6'?'Search items…':'Search accounts…'}" aria-label="Search">
      </div>
      <div class="fa-scroll"><table class="pf fa-table"><thead><tr><th>#</th>
        <th>${cat==='focus'?'Audit Focus':cat==='oma'?'Other Material Account':'Other Financial Related Issue'}</th>
        ${cat==='c6'?'<th>Applies?</th>':`<th class="n">CY ${esc(F.y)}</th><th>WP</th>`}<th>Audit Result</th></tr></thead><tbody>
        ${list.map((x,i)=>`<tr data-fa-row data-href="${rowLink(x)}" data-text="${esc(x.title.toLowerCase())}" class="${cur===x?'sel':''} ${x.status==='Not Applicable'?'na':''}">
          <td>${cat==='focus'?esc(x.id):i+1}</td>
          <td><a class="fa-link" href="${rowLink(x)}">${esc(x.title)}</a>${x.rows&&x.rows.length===1?`<small class="mono">${esc(x.rows[0].a.code)}</small>`:x.rows&&x.rows.length>1?`<small>${x.rows.length} accounts</small>`:''}</td>
          ${cat==='c6'?`<td>${appPill(x.status)}</td>`:`<td class="n">${x.rows&&x.rows.length?money(x.cy||0,{dash:'0.00'}):x.missing?'<span class="fa-missing">Not in the TB</span>':x.pending?'<span class="hint">Waits for TB</span>':'<span class="hint">—</span>'}</td><td>${wpCol(x)}</td>`}
          <td>${resultPill(auditResultOf(x,cat,F,ctx))}</td></tr>`).join('')}
        ${!list.length?`<tr><td colspan="5"><div class="empty">No items to show.</div></td></tr>`:''}
      </tbody></table></div>
      ${cat==='focus'&&f==='app'&&nNa?`<a class="fa-more" href="${link({f:'all'})}">Show ${nNa} not applicable</a>`:''}
    </div></section>`;

  // Right panel
  let panel = '<div class="empty">Select an item.</div>';
  if (cur) {
    const applicable = cur.status === 'Applicable';
    const appRow = cat==='c6' ? `<div class="fa-line"><span class="label">Applies to this barangay</span>
        ${canEdit?`<div class="seg" role="group" aria-label="Applies to this barangay">${['Applicable','Not Applicable'].map(s=>`<button type="button" data-c6="${s}" class="${cur.status===s?'on':''}">${s}</button>`).join('')}</div>`:appPill(cur.status)}</div>
      ${cur.status==='Not Applicable'?`<div class="field"><label class="label" for="c6-reason">Reason</label><textarea class="input fa-ta" id="c6-reason" rows="3" ${canEdit?'':'disabled'}>${esc(cur.reason||'')}</textarea></div>`:''}` : '';
    const leadHTML = cat!=='c6' ? `<div><div class="fa-sub"><h3>Lead Schedule</h3>${cur.rows&&cur.rows.length?'<button class="linkbtn" type="button" id="ls-print">Print</button>':''}</div>${leadPanel(cur,F,refs)}</div>` : '';
    const canAdd = canEdit && applicable;
    const wpHTML = (applicable || wps.length) ? `<div><div class="fa-sub"><h3>Working Papers</h3>${canAdd?'<button class="btn sm primary" type="button" id="fa-newwp">+ Add Working Paper</button>':''}</div>
        ${wps.length?`<div class="wp-list">${wps.map((w,i)=>`<div class="wp-item"><div><b>${esc(w.ref)}</b> ${esc(w.title)}<span>${w.kind==='aom'?`Linked to AOM · ${esc(w.status)}`:esc(impLine(w.imp))}</span></div>
          ${w.kind==='aom'?`<a href="#/audits/${esc(ctx.rec.id)}/findings?sel=${encodeURIComponent(w.id)}">Open in Findings</a>`:canEdit?`<label class="linkbtn">${w.imp?'Re-import':'Import Excel'}<input type="file" class="sr-only" accept=".xlsx,.xlsm,.xls" data-wp-imp="${i}"></label>`:''}</div>`).join('')}</div>`
          :'<div class="empty" style="padding:14px 4px">No working paper yet.</div>'}</div>` : '';
    const resHTML = applicable ? `<div class="fa-line fa-result-row"><span class="label">Audit Result</span>
        ${canEdit && !aoms.length ? `<div class="seg fa-res" role="group" aria-label="Audit Result">${['In Progress','No Findings','With Finding'].map(r=>`<button type="button" data-res="${r}" class="${result===r?'on r-'+RESULT_PILL[r]:''}">${r}</button>`).join('')}</div>` : resultPill(result)}</div>` : '';
    let aomHTML = '';
    if (applicable && (aoms.length || (result==='With Finding' && canEdit))) {
      const used = new Set(aoms.map(a=>a.data.poolCode).filter(Boolean));
      const avail = tpls.filter(t=>!used.has(t.code));
      const src = supWps.find(w=>w.imp) || supWps[0] || null;
      const letters = src ? (/^WP-([A-Z]+)/i.exec(src.ref)||[])[1] : '';
      const pick = (src && avail.find(t=>t.wp===src.ref)) || (letters && avail.find(t=>(/^WP-([A-Z]+)/i.exec(t.wp||'')||[])[1]===letters.toUpperCase())) || null;
      const picker = canEdit ? `<div class="fa-pick" id="fa-pick" ${aoms.length?'hidden':''}>
          <div class="fa-line"><label class="label" for="fa-tpl">${aoms.length?'Another AOM':'AOM'}</label>
            <select class="sel" id="fa-tpl"><option value="">No matching AOM – blank finding</option>${avail.map(t=>`<option value="${esc(t.id)}" ${pick===t?'selected':''}>${esc(t.code)} ${esc(t.title)}</option>`).join('')}</select></div>
          ${supWps.length>1?`<div class="fa-line"><label class="label" for="fa-src">Filled from</label><select class="sel" id="fa-src">${supWps.map(w=>`<option value="${esc(w.ref)}" ${src===w?'selected':''}>${esc(w.ref)} ${esc(w.title)}</option>`).join('')}<option value="">No working paper yet</option></select></div>`:''}
          <div class="hint" id="fa-src-hint"></div>
          <button class="btn sm primary" type="button" id="fa-draft" style="align-self:flex-end">Draft AOM</button></div>` : '';
      aomHTML = `<div class="fa-aom">${aoms.length?`<span class="label">AOM</span>${aoms.map(a=>`<div class="fa-aom-row"><span>${esc(a.data.poolCode?a.data.poolCode+' · ':'')}${esc(a.data.title)}</span><a href="#/audits/${esc(ctx.rec.id)}/findings?sel=${encodeURIComponent(a.id)}">Open in Findings</a></div>`).join('')}
          ${canEdit?'<button class="linkbtn" type="button" id="fa-another" style="align-self:flex-start">+ Draft another AOM</button>':''}`:''}${picker}</div>`;
    }
    panel = `<div class="fa-wp-head"><h2>${esc(cur.title)}</h2>${cur.rows&&cur.rows.length===1?`<span class="hint mono">${esc(cur.rows[0].a.code)}</span>`:''}${cat==='oma'?`<div style="margin-top:6px">${appPill(cur.status)}</div>`:''}</div>
      ${appRow}${leadHTML}${wpHTML}${resHTML}${aomHTML}
      ${cat==='c6'&&!applicable?'<div class="hint fa-note">Working papers and Audit Result open when the item is Applicable.</div>':''}`;
  }

  const body = `<div class="fa-head"><div><h1>C. Financial Audit</h1><p>${instruction}</p></div>
      ${cat!=='c6'?'<button class="btn sm primary" id="ls-xl" type="button">Export All Lead Schedules</button>':''}</div>
    <nav class="fa-tabs" aria-label="Category">
      <a class="${cat==='focus'?'on':''}" href="${tabLink('focus')}">Audit Foci <span>${focus.length}</span></a>
      <a class="${cat==='c6'?'on':''}" href="${tabLink('c6')}">Other Financial Related Issues <span>${C6.length}</span></a>
      <a class="${cat==='oma'?'on':''}" href="${tabLink('oma')}">Other Material Accounts <span>${oma.length}</span></a>
    </nav>
    <div class="fa-grid">${listHTML}<aside class="panel fa-wp"><div class="panel-body">${panel}</div></aside></div>`;

  return {
    body,
    mount(root) {
      const saveRec = async (patch) => {
        const rec = (await loadFsRec(F.lguId,F.y)) || { type:'fs',teamId:ctx.teamId,lguId:F.lguId,year:F.y,auditId:ctx.rec.id };
        await store.save('letters',fsId(F.lguId,F.y),{...rec,...patch(rec)},{silent:true}); emitChange('local');
      };
      // Rows open the item, like a link.
      $$('[data-fa-row]',root).forEach(tr=>{ tr.onclick=(e)=>{ if(e.target.closest('a,button,input,select,label')) return; location.hash=tr.dataset.href; }; });
      const s=$('#fa-search',root); if(s) s.oninput=()=>{ const t=s.value.trim().toLowerCase(); $$('[data-fa-row]',root).forEach(tr=>{ tr.style.display=!t||tr.dataset.text.includes(t)?'':'none'; }); };

      $$('[data-c6]',root).forEach(b=>{ b.onclick=async()=>{
        const st=b.dataset.c6; if(st===cur.status && !cur.autoReason) return;
        const reason = st==='Not Applicable' ? (cur.reason || '') : '';
        await saveRec(r=>({c6:{...(r.c6||{}),[cur.id]:{status:st,reason,at:new Date().toISOString(),by:me.email}}}));
      }; });
      const rs=$('#c6-reason',root); if(rs&&cur) rs.onchange=async()=>{ await saveRec(r=>({c6:{...(r.c6||{}),[cur.id]:{status:'Not Applicable',reason:rs.value.trim(),at:new Date().toISOString(),by:me.email}}})); toast('Reason saved.','ok'); };

      $$('[data-res]',root).forEach(b=>{ b.onclick=async()=>{ const k=resultKey(cat,cur); await saveRec(r=>({auditResults:{...(r.auditResults||{}),[k]:b.dataset.res}})); }; });

      const n=$('#fa-newwp',root); if(n&&cur) n.onclick=()=>addWp();
      async function addWp() {
        const accounts=(cur.rows||[]).map(r=>r.k);
        const S={ ref: nextRef(F,ctx,accounts,cur.title), title: WP_TITLES[cat==='focus'?cur.id:''] || cur.title, imp:null };
        const ok = await modal({ title:`Add Working Paper · ${cur.title}`, wide:true,
          body:`<div class="grid-2"><div class="field"><label class="label" for="aw-ref">WP Reference</label><input class="input" id="aw-ref" value="${esc(S.ref)}"></div>
              <div class="field"><label class="label" for="aw-title">Title</label><input class="input" id="aw-title" value="${esc(S.title)}"></div></div>
            <div class="aw-imp"><div><span class="label">Excel working paper</span><div class="hint" id="aw-imp-info">Only the AOM Values (variables) and AOM Tables are read and saved. You can also import it later.</div></div>
              <label class="btn sm ghost">Import Excel<input type="file" class="sr-only" id="aw-file" accept=".xlsx,.xlsm,.xls"></label></div>
            ${accounts.length?`<div class="field"><span class="label">Accounts covered</span><div>${(cur.rows||[]).map(r=>`<span class="chip">${esc(r.a.code)} ${esc(r.a.title)}</span>`).join(' ')}</div></div>`:''}
            <div class="aw-tpl"><span>Start from the standard Excel template for this account</span><button class="linkbtn" type="button" id="aw-tpl">Download template</button></div>`,
          onOpen:(bg)=>{
            $('#aw-file',bg).onchange=async(e)=>{ const file=e.target.files[0]; if(!file) return;
              try { const wp=await readWorkingPaper(file); S.imp={ file:wp.file, at:new Date().toISOString(), by:me.email, vars:wp.vars, tables:wp.tables }; $('#aw-imp-info',bg).textContent=`${file.name} · ${impLine(S.imp).replace(/^Imported [^·]*· /,'')}`; }
              catch(err){ toast('This file could not be read as an Excel working paper.','bad'); } };
            $('#aw-tpl',bg).onclick=()=>downloadTemplate($('#aw-ref',bg).value.trim()||S.ref, $('#aw-title',bg).value.trim()||S.title);
          },
          buttons:[{label:'Cancel',cls:'ghost',value:null},{label:'Add Working Paper',cls:'primary',value:'ok',check:(bg)=>{
            S.ref=$('#aw-ref',bg).value.trim().toUpperCase(); S.title=$('#aw-title',bg).value.trim();
            if(!/^WP-[A-Z0-9-]+$/.test(S.ref)){ toast('Type the reference like WP-CB01.','bad'); return false; }
            if(allWpRefs(F,ctx).has(S.ref)){ toast(`${S.ref} is already used in this audit.`,'bad'); return false; }
            if(!S.title){ toast('Type the title.','bad'); return false; }
            return true; }}] });
        if(!ok) return;
        const w={ ref:S.ref, title:S.title, accounts, item:resultKey(cat,cur), ph:[], tables:[], supporting:true, imp:S.imp, at:new Date().toISOString(), by:me.email };
        const k=resultKey(cat,cur);
        await saveRec(r=>({ wps:[...(r.wps||[]),w], auditResults: (r.auditResults||{})[k] ? r.auditResults : {...(r.auditResults||{}),[k]:'In Progress'} }));
        await store.log('added a working paper',`${ctx.lgu.name} · ${w.ref} ${w.title}`,ctx.teamId,me.email); toast(`${w.ref} added.`,'ok');
      }
      async function downloadTemplate(ref, title) {
        const XLSX=await loadScript('lib/xlsx.full.min.js','XLSX');
        const aoa=[[`${ref} · ${title}`],[`Barangay ${ctx.lgu.name}, ${ctx.mun.name}, Quirino`],[`${cur.title} · CY ${F.y}`],[]];
        if(cur.rows&&cur.rows.length){ aoa.push(['Code','Account Title',`CY ${F.y}`,`CY ${F.yp}`]); cur.rows.forEach(r=>aoa.push([r.a.code,r.a.title,r.cy/100,r.py/100])); aoa.push(['','Total',(cur.cy||0)/100,(cur.py||0)/100],[]); }
        aoa.push(['(Your working paper details go here.)'],[],['AOM VALUES'],['VARIABLE','VALUE']);
        const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=[{wch:30},{wch:50},{wch:18},{wch:18}];
        const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'WP'); XLSX.writeFile(wb,`${ref} ${ctx.lgu.name} ${F.y}.xlsx`);
      }

      $$('[data-wp-imp]',root).forEach(inp=>{ inp.onchange=async()=>{
        const w=wps[+inp.dataset.wpImp], file=inp.files[0]; if(!w||!file) return;
        let wp; try { wp=await readWorkingPaper(file); } catch(err){ toast('This file could not be read as an Excel working paper.','bad'); return; }
        const imp={ file:wp.file, at:new Date().toISOString(), by:me.email, vars:wp.vars, tables:wp.tables };
        await saveRec(r=>({ wps:(r.wps||[]).map(x=>x.ref===w.ref?{...x,imp}:x) }));
        await store.log('imported a working paper',`${ctx.lgu.name} · ${w.ref} · ${file.name}`,ctx.teamId,me.email);
        toast(`${w.ref}: ${impLine(imp).replace(/^Imported [^·]*· /,'')} imported.`,'ok');
      }; });

      const srcOf=()=>{ const sel=$('#fa-src',root); if(!sel) return supWps.find(w=>w.imp)||supWps[0]||null; return supWps.find(w=>w.ref===sel.value)||null; };
      const srcHint=()=>{ const h=$('#fa-src-hint',root); if(!h) return; const w=srcOf();
        h.textContent = !w ? 'No working paper yet; the AOM can be drafted now and its working paper added later.'
          : w.imp ? `Filled from ${w.ref}: its imported values${Object.keys(w.imp.tables||{}).length?' and AOM Tables':''}.`
          : `${w.ref} has no imported Excel yet; you can import it later and the AOM will fill from it.`; };
      srcHint(); const fs=$('#fa-src',root); if(fs) fs.onchange=srcHint;
      const an=$('#fa-another',root); if(an) an.onclick=()=>{ const pk=$('#fa-pick',root); pk.hidden=!pk.hidden; an.textContent=pk.hidden?'+ Draft another AOM':'Cancel'; };
      const dr=$('#fa-draft',root); if(dr&&cur) dr.onclick=async()=>{
        const tid=$('#fa-tpl',root).value, t=tpls.find(x=>x.id===tid)||null;
        const sw=srcOf(), src=sw?{ ref:sw.ref, title:sw.title, imp:sw.imp||null, w:sw }:null;
        const now=new Date().toISOString();
        const data=t?fromTemplate(t):{...blankAom(),title:cur.title};
        const accounts=(cur.rows||[]).map(r=>r.k);
        const seq=Math.max(0,...(ctx.aoms||[]).map(a=>a.data.seq||0))+1, id=newId('aom');
        await store.save('aoms',id,{ ...data, wp: src?src.ref:data.wp, wpDef:{ title: src?src.title:(data.title), accounts: accounts.length?accounts:(src&&src.w&&src.w.accounts)||[], ph:[], tables:[] },
          faItem:resultKey(cat,cur), auditId:ctx.rec.id, teamId:ctx.teamId, lguId:F.lguId, status:ST.DRAFT, wpData: src&&src.imp ? { file:src.imp.file, at:src.imp.at, by:src.imp.by, vars:src.imp.vars, tables:src.imp.tables } : null,
          comments:[], history:[{at:now,by:me.email,action:`Added to findings from the Financial Audit (${cur.title})`}], seq, memberId:ctx.audit.memberId||me.id },{silent:true});
        await store.log('drafted an AOM from the Financial Audit',`${ctx.lgu.name} · ${data.title}`,ctx.teamId,me.email);
        toast(`Draft AOM added to Findings: ${data.title}.`,'ok');
        location.hash='#/audits/'+ctx.rec.id+'/findings?sel='+encodeURIComponent(id);
      };

      const xl=$('#ls-xl',root); if(xl) xl.onclick=async()=>{
        const XLSX=await loadScript('lib/xlsx.full.min.js','XLSX'); const wb=XLSX.utils.book_new();
        (cat==='focus'?focus:oma).forEach((x,i)=>{ if(!x.rows||!x.rows.length)return; const aoa=[[x.title],['Code','Account Title',`CY ${F.y}`,`CY ${F.yp}`,'Change','WP Ref.'],...x.rows.map(r=>[r.a.code,r.a.title,r.cy/100,r.py/100,(r.cy-r.py)/100,(refs[r.k]||{}).ref||''])]; const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=[{wch:16},{wch:50},{wch:16},{wch:16},{wch:16},{wch:14}]; XLSX.utils.book_append_sheet(wb,ws,`${i+1} ${x.title.replace(/[\\/?*[\]:]/g,'')}`.slice(0,31));});
        XLSX.writeFile(wb,`Financial Audit ${ctx.lgu.name} ${F.y}.xlsx`);
      };
      const pr=$('#ls-print',root); if(pr&&cur) pr.onclick=()=>{
        const css='.pg{padding:.6in;font:11pt "Times New Roman",serif}.pg table{width:100%;border-collapse:collapse}.pg th,.pg td{border-bottom:1px solid #999;padding:4px;text-align:left}.pg .n{text-align:right}';
        printPages(css,`<div class="pg"><h2>Barangay ${esc(ctx.lgu.name)}, ${esc(ctx.mun.name)}, Quirino</h2><p>Lead Schedule · ${esc(cur.title)}</p>${detailTable(cur,F,refs)}</div>`,`Lead Schedule · ${ctx.lgu.name}`);
      };
    }
  };
}
