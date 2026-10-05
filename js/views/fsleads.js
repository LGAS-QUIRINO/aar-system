// Financial Statements · Financial Audit lead schedules.
// Main categories follow the SAI structure used by the team:
//   C.1 Audit Foci / Areas · C.6 Other Financial Related Issues · OMA (Other Material Accounts).
import { store, emitChange } from '../store.js';
import { esc, toast, $, $$, modal, pill } from '../ui.js';
import { fsId, loadFsRec, money } from '../fs.js';
import { printPages } from '../baar-doc.js';
import { loadScript } from '../wp.js';
import { openNewWp } from './wpfill.js';
import { openWp, newBody, wpTemplate } from './fswp.js';

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
const isFocusAccount = (a,f) => f.re.some(re => re.test(norm(a.title)));

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
    return { ...f, rows, cy:rows.reduce((s,x)=>s+x.cy,0), py:rows.reduce((s,x)=>s+x.py,0), status:rows.length?'Applicable':'Not Applicable' };
  });
}

function omaData(F) {
  const accts = allAccounts(F);
  return accts.filter(x => !FOCI.some(f => isFocusAccount(x.a,f))).map((x,i)=>({
    id:x.k, title:x.a.title, cls:x.a.cls || 'Account', rows:[x], cy:x.cy, py:x.py, status:'For Verification'
  }));
}

function relatedAoms(item, ctx) {
  const keys = new Set((item.rows || []).map(r => r.k));
  const codes = new Set((item.rows || []).map(r => r.a.code));
  return (ctx.aoms || []).filter(a => {
    const d = a.data || {};
    return (d.wpDef && d.wpDef.accounts || []).some(k => keys.has(k)) || (d.flagCodes || []).some(code => codes.has(code));
  });
}

function workingPapersFor(item, F, ctx) {
  const seen = new Set(), out = [];
  relatedAoms(item, ctx).forEach(a => {
    const d = a.data || {};
    if (d.wp && !seen.has(d.wp)) {
      seen.add(d.wp);
      out.push({ ref:d.wp, title:(d.wpDef && d.wpDef.title) || d.title || 'Working Paper', status:d.status || 'Draft', kind:'aom', id:a.id });
    }
  });
  ((F.rec && F.rec.wps) || []).forEach(w => {
    if ((w.accounts || []).some(k => (item.rows || []).some(r => r.k === k)) && !seen.has(w.ref)) {
      seen.add(w.ref);
      const b = w.wpb || {};
      out.push({ ref:w.ref, title:w.title || 'Supporting Working Paper', status:b.revBy ? 'Reviewed' : b.result ? 'Completed' : 'Draft', kind:'supporting' });
    }
  });
  return out;
}

const resultKey = (cat, item) => cat + ':' + item.id;
function auditResultOf(item, cat, F, ctx) {
  if (!item || item.status !== 'Applicable') return '';
  if (relatedAoms(item, ctx).length) return 'With Finding';
  const saved = F.rec && F.rec.auditResults && F.rec.auditResults[resultKey(cat,item)];
  if (saved) return saved;
  return workingPapersFor(item,F,ctx).length ? 'In Progress' : 'Not Started';
}
const RESULT_CLS = { 'Not Started':'rs-ns', 'In Progress':'rs-ip', 'No Findings':'rs-nf', 'With Finding':'rs-wf' };
function auditResultHTML(item, cat, F, ctx, canEdit) {
  const v = auditResultOf(item,cat,F,ctx);
  if (!v) return '<span class="hint">—</span>';
  if (v === 'With Finding') return pill('With Finding','bad');
  if (!canEdit) return pill(v, v === 'No Findings' ? 'ok' : v === 'In Progress' ? '' : 'grey');
  const k = resultKey(cat,item);
  return '<select class="sel fa-result ' + RESULT_CLS[v] + '" data-fa-result="' + esc(k) + '" aria-label="Audit result">' +
    ['Not Started','In Progress','No Findings'].map(x => '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>').join('') +
    '</select>';
}

const statusPill = st => st === 'Applicable' ? pill('● Applicable','ok') : st === 'Not Applicable' ? pill('● Not Applicable','grey') : pill('● For Verification','warn');

function detailTable(item,F,refs){
  if(!item.rows || !item.rows.length) return '<div class="empty">No matching account balance was found in the trial balances.</div>';
  return `<table class="pf"><thead><tr><th>Code</th><th>Account Title</th><th class="n">CY ${F.y}</th><th class="n">CY ${F.yp}</th><th class="n">Change</th><th>WP Ref.</th></tr></thead><tbody>
    ${item.rows.map(r=>`<tr><td class="mono">${esc(r.a.code)}</td><td>${esc(r.a.title)}</td><td class="n">${money(r.cy)}</td><td class="n">${money(r.py)}</td><td class="n">${money(r.cy-r.py)}</td><td>${esc((refs[r.k]||{}).ref||'')}</td></tr>`).join('')}
    <tr style="font-weight:700"><td></td><td>Total</td><td class="n">${money(item.cy||0)}</td><td class="n">${money(item.py||0)}</td><td class="n">${money((item.cy||0)-(item.py||0))}</td><td></td></tr>
  </tbody></table>`;
}

const pct = (cy, py) => py ? ((cy - py) / Math.abs(py) * 100) : null;
function leadPanel(cur, F, refs) {
  if (!cur.rows || !cur.rows.length) return '<div class="empty" style="padding:18px 6px">No balance for this item in the trial balance.</div>';
  const ch = (cur.cy||0) - (cur.py||0), p = pct(cur.cy||0, cur.py||0);
  const multi = cur.rows.length > 1;
  return `<div class="ls-figs">
      <div><span>CY ${esc(F.y)}</span><b>${money(cur.cy||0,{dash:'0.00'})}</b></div>
      <div><span>CY ${esc(F.yp)}</span><b>${money(cur.py||0,{dash:'0.00'})}</b></div>
      <div><span>Change</span><b>${money(ch,{dash:'0.00'})}</b>${p===null?'':`<small>${p>0?'+':''}${p.toFixed(1)}%</small>`}</div>
    </div>
    ${multi ? `<table class="pf ls-lines"><thead><tr><th>Account</th><th class="n">CY ${esc(F.y)}</th><th class="n">CY ${esc(F.yp)}</th></tr></thead><tbody>
      ${cur.rows.map(r=>`<tr><td><span class="mono">${esc(r.a.code)}</span><br>${esc(r.a.title)}${(refs[r.k]||{}).ref?` <span class="chip">${esc(refs[r.k].ref)}</span>`:''}</td><td class="n">${money(r.cy)}</td><td class="n">${money(r.py)}</td></tr>`).join('')}
    </tbody></table>` : ''}`;
}

export async function leadsTab({ F, ctx, me, q, base, canEdit }) {
  const cat = ['focus','c6','oma'].includes(q.get('cat')) ? q.get('cat') : 'focus';
  const focus = focusData(F), oma = omaData(F);
  const all = cat==='focus' ? focus : cat==='c6' ? C6.map(x=>({...x,cls:'Financial Issue',rows:[],status:'For Review'})) : oma;
  // Applicability filter. The audit foci open on Applicable so the 16 or so not-applicable rows stay out of the way.
  const FILTERS = { all:'All', app:'Applicable', na:'Not Applicable', ver:'For Verification' };
  const f = cat==='focus' ? (FILTERS[q.get('f')] ? q.get('f') : 'app') : 'all';
  const match = (x) => f==='all' || (f==='app' && x.status==='Applicable') || (f==='na' && x.status==='Not Applicable') || (f==='ver' && x.status==='For Verification');
  const list = all.filter(match);
  const selectedId = q.get('item') || (list[0] && list[0].id);
  const cur = all.find(x=>x.id===selectedId) || list[0] || null;
  const refs = wpRefs(F,ctx);
  const wps = cur ? workingPapersFor(cur,F,ctx) : [];
  const counts = cat==='focus' ? {
    all:focus.length,
    app:focus.filter(x=>x.status==='Applicable').length,
    na:focus.filter(x=>x.status==='Not Applicable').length,
    ver:focus.filter(x=>x.status==='For Verification').length
  } : null;

  const catLink=(k)=>`${base}&s=leads&cat=${k}`;
  const fLink=(k)=>`${base}&s=leads&cat=${cat}&f=${k}`;
  const rowLink=(x)=>`${base}&s=leads&cat=${cat}${cat==='focus'?`&f=${f}`:''}&item=${encodeURIComponent(x.id)}`;
  const canAddWp = canEdit && cur && cur.status!=='Not Applicable' && cur.rows && cur.rows.length;

  const body = `<div class="fa-head"><div><h1>C. Financial Audit</h1><p>Review and assess material accounts and other financial matters.</p></div>
    <div class="btn-row"><button class="btn sm ghost" id="ls-print" type="button">Print</button><button class="btn sm primary" id="ls-xl" type="button">Export to Excel</button></div></div>
    <nav class="fa-tabs" aria-label="Category">
      <a class="${cat==='focus'?'on':''}" href="${catLink('focus')}">Audit Foci <span>${focus.length}</span></a>
      <a class="${cat==='c6'?'on':''}" href="${catLink('c6')}">Other Financial Related Issues <span>${C6.length}</span></a>
      <a class="${cat==='oma'?'on':''}" href="${catLink('oma')}">Other Material Accounts <span>${oma.length}</span></a>
    </nav>
    <div class="fa-grid">
      <section class="panel fa-list"><div class="panel-body">
        <div class="fa-tools">
          ${counts?`<div class="fa-filters">${Object.entries(FILTERS).map(([k,l])=>`<a class="${f===k?'on':''} f-${k}" href="${fLink(k)}">${l} <span>${counts[k]}</span></a>`).join('')}</div>`:'<div></div>'}
          <div class="fa-search"><select class="sel" id="fa-result-filter" aria-label="Filter by audit result"><option value="">Any result</option><option>Not Started</option><option>In Progress</option><option>No Findings</option><option>With Finding</option></select><input class="input" id="fa-search" placeholder="Search…" aria-label="Search"></div>
        </div>
        <table class="pf fa-table"><thead><tr><th>#</th><th>${cat==='focus'?'Audit Focus':cat==='oma'?'Other Material Account':'Other Financial Related Issue'}</th><th>Applicability</th><th>Audit Result</th></tr></thead><tbody>
          ${list.map((x,i)=>`<tr data-fa-row data-fa-href="${rowLink(x)}" data-fa-result-value="${esc(auditResultOf(x,cat,F,ctx))}" data-fa-text="${esc((x.title+' '+(x.cls||'')).toLowerCase())}" class="${cur===x?'sel':''} ${x.status==='Not Applicable'?'na':''}">
            <td>${cat==='focus'?esc(x.id):i+1}</td><td><a class="fa-link" href="${rowLink(x)}">${esc(x.title)}</a>${x.rows&&x.rows.length===1?`<small>${esc(x.rows[0].a.code)}</small>`:x.rows&&x.rows.length>1?`<small>${x.rows.length} accounts</small>`:''}</td><td>${statusPill(x.status==='For Review'?'For Verification':x.status)}</td><td>${auditResultHTML(x,cat,F,ctx,canEdit)}</td></tr>`).join('')}
          ${!list.length?`<tr><td colspan="4"><div class="empty">${cat==='focus'&&f!=='all'?`No ${esc(FILTERS[f].toLowerCase())} items. <a href="${fLink('all')}">Show all</a>`:'No accounts are currently listed here.'}</div></td></tr>`:''}
        </tbody></table>
      </div></section>
      <aside class="panel fa-wp"><div class="panel-body">
        ${cur?`<div class="fa-wp-head"><div><h2>${esc(cur.title)}</h2><div class="fa-wp-meta">${cur.rows&&cur.rows.length===1?`<span class="hint mono">${esc(cur.rows[0].a.code)}</span>`:''}${statusPill(cur.status==='For Review'?'For Verification':cur.status)}</div></div></div>
          ${cat!=='c6'?`<h3>Lead Schedule</h3>${leadPanel(cur,F,refs)}`:''}
          <div class="fa-wp-sub"><h3>Working Papers <span>${wps.length}</span></h3>${canAddWp?`<button class="btn sm primary" type="button" id="fa-newwp">+ Add Working Paper</button>`:''}</div>
          ${wps.length?`<div class="wp-list">${wps.map((w,i)=>`<button type="button" class="wp-item" data-wp-open="${i}"><span><b>${esc(w.ref)}</b><span>${esc(w.title)}</span></span>${pill(w.status, w.status==='Reviewed'||w.status==='Completed'?'ok':w.kind==='aom'?'violet':'grey')}</button>`).join('')}</div>`
            :`<div class="empty" style="padding:18px 6px">No working paper yet.${canAddWp?`<br><span class="hint">Suggested: <b>${esc(wpTemplate(cur.id).title)}</b></span>`:''}</div>`}`
          :'<div class="empty">Select an item to view its lead schedule and working papers.</div>'}
      </div></aside>
    </div>`;

  return {
    body,
    mount(root) {
      const saveRec = async (patch) => {
        const rec = (await loadFsRec(F.lguId,F.y)) || { type:'fs',teamId:ctx.teamId,lguId:F.lguId,year:F.y,auditId:ctx.rec.id };
        await store.save('letters',fsId(F.lguId,F.y),{...rec,...patch(rec)},{silent:true}); emitChange('local');
      };
      const s=$('#fa-search',root), rf=$('#fa-result-filter',root); if (rf) rf.value='';
      const applyFilters=()=>$$('[data-fa-row]',root).forEach(tr=>{ const okText=!s||tr.dataset.faText.includes(s.value.trim().toLowerCase()); const okResult=!rf||!rf.value||tr.dataset.faResultValue===rf.value; tr.style.display=okText&&okResult?'':'none'; });
      if(s) s.oninput=applyFilters; if(rf) rf.onchange=applyFilters;
      // The whole row opens the account, like a link.
      $$('[data-fa-row]',root).forEach(tr=>{ tr.onclick=(e)=>{ if(e.target.closest('select,button,a,input')) return; location.hash=tr.dataset.faHref; }; });
      $$('[data-fa-result]',root).forEach(sel=>{ sel.onchange=async()=>{ await saveRec(r=>({auditResults:{...(r.auditResults||{}),[sel.dataset.faResult]:sel.value}})); toast('Audit result saved.','ok'); }; });

      const editWp = async (ref) => {
        const w = ((F.rec && F.rec.wps) || []).find(x=>x.ref===ref); if(!w) return;
        const b = await openWp({ w, item:cur, F, ctx, me, canEdit });
        if (!b) { emitChange('local'); return; }   // redraw so a just-created paper still shows
        const k = resultKey(cat,cur);
        await saveRec(r=>({ wps:(r.wps||[]).map(x=>x.ref===ref?{...x,wpb:b}:x),
          auditResults: b.result==='No Findings' && !relatedAoms(cur,ctx).length ? {...(r.auditResults||{}),[k]:'No Findings'} : (r.auditResults||{}) }));
        await store.log('updated a supporting working paper',`${ctx.lgu.name} · ${ref}`,ctx.teamId,me.email);
        toast(b.result==='With Finding' ? `${ref} saved. Add the finding in Findings to draft the AOM.` : `${ref} saved.`,'ok');
      };

      const n=$('#fa-newwp',root); if(n&&cur) n.onclick=async()=>{
        const w=await openNewWp({F,ctx,me,accounts:(cur.rows||[]).map(r=>r.k),supporting:true,title:wpTemplate(cur.id).title}); if(!w)return;
        w.wpb = newBody(cur.id, me);
        await saveRec(r=>({wps:[...(r.wps||[]),w],auditResults:{...(r.auditResults||{}),[resultKey(cat,cur)]:'In Progress'}})); await store.log('added a supporting working paper',`${ctx.lgu.name} · ${w.ref} ${w.title}`,ctx.teamId,me.email); toast(`${w.ref} added.`,'ok');
        F.rec = { ...(F.rec||{}), wps:[...((F.rec&&F.rec.wps)||[]), w] };
        editWp(w.ref);
      };
      $$('[data-wp-open]',root).forEach(b=>{ b.onclick=()=>{
        const w=wps[+b.dataset.wpOpen]; if(!w)return;
        if(w.kind==='aom'){ location.hash='#/audits/'+ctx.rec.id+'/findings?sel='+encodeURIComponent(w.id); return; }
        editWp(w.ref);
      }; });
      $('#ls-xl',root).onclick=async()=>{
        const XLSX=await loadScript('lib/xlsx.full.min.js','XLSX'); const wb=XLSX.utils.book_new();
        const src=cat==='focus'?focus:cat==='oma'?oma:[];
        src.forEach((x,i)=>{ if(!x.rows||!x.rows.length)return; const aoa=[[x.title],['Code','Account Title',`CY ${F.y}`,`CY ${F.yp}`,'Change','WP Ref.'],...x.rows.map(r=>[r.a.code,r.a.title,r.cy/100,r.py/100,(r.cy-r.py)/100,(refs[r.k]||{}).ref||''])]; const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=[{wch:16},{wch:50},{wch:16},{wch:16},{wch:16},{wch:14}]; XLSX.utils.book_append_sheet(wb,ws,`${i+1} ${x.title.replace(/[\\/?*[\]:]/g,'')}`.slice(0,31));});
        XLSX.writeFile(wb,`Financial Audit ${ctx.lgu.name} ${F.y}.xlsx`);
      };
      $('#ls-print',root).onclick=()=>{
        if(!cur||!cur.rows||!cur.rows.length){ toast('Select an applicable account with balances to print its lead schedule.','bad'); return; }
        const css='.pg{padding:.6in;font:11pt "Times New Roman",serif}.pg table{width:100%;border-collapse:collapse}.pg th,.pg td{border-bottom:1px solid #999;padding:4px}.pg .n{text-align:right}';
        printPages(css,`<div class="pg"><h2>Barangay ${esc(ctx.lgu.name)}, ${esc(ctx.mun.name)}, Quirino</h2><p>Lead Schedule · ${esc(cur.title)}</p>${detailTable(cur,F,refs)}</div>`,`Financial Audit · ${ctx.lgu.name}`);
      };
    }
  };
}
