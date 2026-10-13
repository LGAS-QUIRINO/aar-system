// Standalone SK SAOR and transmittal; intentionally independent of BAAR and Barangay SAOR.
import { store } from '../store.js';
import { esc, toast, $, $$, confirmBox, setDirty } from '../ui.js';
import { has, myTeamIds } from '../refs.js';
import { loadScript } from '../wp.js';

const clean = s => String(s ?? '');
const validYear = y => /^20\d\d$/.test(String(y));
const docName = (name, year, kind) => ('SK_'+name+'_'+year+'_'+kind).toUpperCase().replace(/[^A-Z0-9_]+/g,'_');
const defaultLetter = (sk, year) => 'Respectfully transmitted herewith is the Summary of Audit Observations and Recommendations (SAOR) pertaining to the Sangguniang Kabataan of Barangay '+sk+' for Audit Year '+year+'.\n\nFor your information and appropriate action.';
const pageCSS = `@page{size:13in 8.5in;margin:.7in}body{font:12pt 'Times New Roman',serif;color:#111;margin:0}.sheet{padding:0}.center{text-align:center}.header{text-align:center;font-size:11pt;line-height:1.3}.heading{font-weight:bold;text-decoration:underline;margin:18pt 0 8pt}.meta{margin:12pt 0}.saor-grid{width:100%;border-collapse:collapse;font-size:10.5pt;table-layout:fixed}.saor-grid th,.saor-grid td{border:1px solid #111;padding:6px;vertical-align:top;white-space:pre-wrap}.saor-grid thead{display:table-header-group}.saor-grid tr{break-inside:avoid;page-break-inside:avoid}.saor-grid th{font-weight:bold}.letter{max-width:9in;white-space:pre-wrap;line-height:1.5;margin:30pt auto}.signature{margin-top:45pt}h2{break-after:avoid;page-break-after:avoid}@media print{.sheet{break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}}`;
const headHTML = () => '<div class="header">Republic of the Philippines<br><b>COMMISSION ON AUDIT</b><br>Regional Office No. II<br>Province of Quirino<br>Provincial Satellite Auditing Office</div>';
const heading = (d,sk,year) => '<div class="center heading">SUMMARY OF AUDIT OBSERVATIONS AND RECOMMENDATIONS</div><div class="center">Sangguniang Kabataan of Barangay '+esc(sk)+'<br>Audit Year '+year+'</div>';
function saorContent(d,sk,year) {
  const rows=(d.entries||[]).map((r,i)=>'<tr><td style="width:4%">'+(i+1)+'</td><td>'+esc(r.reference||'')+'</td><td>'+esc(r.observation||'')+'</td><td>'+esc(r.recommendation||'')+'</td><td>'+esc(r.comment||'')+'</td><td>'+esc(r.rejoinder||'')+'</td></tr>').join('');
  return headHTML()+heading(d,sk,year)+'<table class="saor-grid"><thead><tr><th>No.</th><th>Reference No.</th><th>Observations</th><th>Recommendations</th><th>Management Comments</th><th>Auditor\'s Rejoinder</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="6">No SK observations entered yet.</td></tr>')+'</tbody></table>';
}
function transContent(d,sk,year) {
  return headHTML()+'<div class="letter"><div>'+esc(d.date||'')+'</div><p><b>'+esc(d.addressee||'')+'</b><br>'+esc(d.position||'')+'<br>'+esc(d.office||'Sangguniang Kabataan of Barangay '+sk)+'</p><p>'+esc(d.salutation||'Dear Sir/Madam:')+'</p><p>'+esc(d.letter||defaultLetter(sk,year))+'</p><div class="signature">Very truly yours,<br><br><br><b>'+esc(d.signatory||'')+'</b><br>'+esc(d.designation||'Audit Team Leader')+'</div><p><b>Enclosure:</b> SK Summary of Audit Observations and Recommendations</p></div>';
}
const printHTML=(d,sk,year,which) => '<!doctype html><html><head><meta charset="utf-8"><base href="'+location.href.split('#')[0]+'"><style>'+pageCSS+'</style></head><body>'+(which!=='saor'?'<div class="sheet">'+transContent(d,sk,year)+'</div>':'')+(which!=='letter'?'<div class="sheet">'+saorContent(d,sk,year)+'</div>':'')+'</body></html>';
function printSK(d,sk,year,which) {
  const f=document.createElement('iframe');f.style.cssText='position:fixed;width:0;height:0;border:0';document.body.appendChild(f);
  f.contentDocument.open();f.contentDocument.write(printHTML(d,sk,year,which));f.contentDocument.close();
  setTimeout(()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),60000)},350);
}
async function wordSK(d,sk,year,which) {
  const D=await loadScript('lib/docx.min.js','docx');
  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,PageOrientation}=D;
  const P=(t,b=false)=>new Paragraph({children:[new TextRun({text:clean(t),bold:b,font:'Times New Roman',size:22})],spacing:{after:140}});
  const paragraphs=t=>clean(t).split(/\n/).map(x=>P(x));
  const hd=()=>[P('Republic of the Philippines'),P('COMMISSION ON AUDIT',true),P('Regional Office No. II · Province of Quirino')];
  const sections=[];
  if(which!=='saor') sections.push({properties:{page:{size:{width:12240,height:18720},margin:{top:1000,right:1100,bottom:1000,left:1100}}},children:[...hd(),P(d.date),P(d.addressee,true),P(d.position),P(d.office),P(d.salutation),...paragraphs(d.letter||defaultLetter(sk,year)),P('Very truly yours,'),P(' '),P(' '),P(d.signatory,true),P(d.designation),P('Enclosure: SK Summary of Audit Observations and Recommendations')]});
  if(which!=='letter'){
    const cols=['No.','Reference No.','Observations','Recommendations','Management Comments',"Auditor's Rejoinder"];
    const row=values=>new TableRow({cantSplit:true,children:values.map(v=>new TableCell({children:paragraphs(v),width:{size:16,type:WidthType.PERCENTAGE}}))});
    const table=new Table({rows:[row(cols),...(d.entries||[]).map((r,i)=>row([String(i+1),r.reference,r.observation,r.recommendation,r.comment,r.rejoinder]))],width:{size:100,type:WidthType.PERCENTAGE}});
    sections.push({properties:{page:{size:{width:18720,height:12240,orientation:PageOrientation.LANDSCAPE},margin:{top:850,bottom:850,left:850,right:850}}},children:[...hd(),P('SUMMARY OF AUDIT OBSERVATIONS AND RECOMMENDATIONS',true),P('Sangguniang Kabataan of Barangay '+sk),P('Audit Year '+year),table]});
  }
  const blob=await Packer.toBlob(new Document({sections}));
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=docName(sk,year,which)+'.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function skSaor(refs,params,q) {
  const teams=myTeamIds(refs.me,refs.teams);
  const lgus=refs.lgus.filter(r=>r.data.kind==='barangay' && teams.includes(r.data.teamId)).sort((a,b)=>a.data.name.localeCompare(b.data.name));
  if(!lgus.length)return {active:'#/sk-saor',crumbs:'<b>SK SAOR</b>',body:'<div class="page-head"><h1>SK SAOR</h1></div><div class="empty">No assigned Barangays in the LGU Master List.</div>'};
  const chosen=lgus.find(r=>r.id===q.get('lgu'))||lgus[0], year=validYear(q.get('year'))?Number(q.get('year')):new Date().getFullYear();
  const key='sk-saor-'+chosen.id+'-'+year;
  const stored=await store.get('letters',key);
  const d=stored?.data?.type==='sk_saor'?stored.data:{type:'sk_saor',lguId:chosen.id,teamId:chosen.data.teamId,year,entries:[],date:new Date().toISOString().slice(0,10),addressee:'',position:'SK Chairperson',office:'Sangguniang Kabataan of Barangay '+chosen.data.name,salutation:'Dear Sir/Madam:',letter:defaultLetter(chosen.data.name,year),signatory:'',designation:'Audit Team Leader'};
  const canEdit=has(refs.me,'member')||has(refs.me,'atl')||has(refs.me,'sa')||has(refs.me,'admin');
  const txt=(id,label,value,rows=0)=>'<div class="field"><label class="label" for="'+id+'">'+label+'</label>'+(rows?'<textarea class="input" id="'+id+'" rows="'+rows+'" '+(canEdit?'':'readonly')+'>'+esc(value||'')+'</textarea>':'<input class="input" id="'+id+'" value="'+esc(value||'')+'" '+(canEdit?'':'readonly')+'>')+'</div>';
  const entries=(d.entries||[]).map((r,i)=>'<section class="panel" data-entry="'+i+'"><div class="panel-head"><h2>Observation '+(i+1)+'</h2>'+(canEdit?'<button class="btn sm ghost" data-remove="'+i+'">Remove</button>':'')+'</div><div class="panel-body">'+[['reference','Reference No.'],['observation','Observation'],['recommendation','Recommendation'],['comment','Management Comments'],['rejoinder',"Auditor's Rejoinder"]].map(([k,label])=>'<div class="field"><label class="label">'+label+'</label><textarea class="input" data-field="'+k+'" rows="'+(k==='reference'?1:3)+'" '+(canEdit?'':'readonly')+'>'+esc(r[k]||'')+'</textarea></div>').join('')+'</div></section>').join('');
  const body='<div class="page-head"><div><h1>SK SAOR & Transmittal</h1><p>Independent SK reporting · Not included in BAAR or Barangay SAOR</p></div></div>'
   +'<section class="panel"><div class="panel-body"><div class="grid-2"><div class="field"><label class="label">SK / Barangay</label><select class="input" id="sk-lgu">'+lgus.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===chosen.id?'selected':'')+'>'+esc(x.data.name)+'</option>').join('')+'</select></div>'+txt('sk-year','Audit Year',year)+'</div><div class="note info">SK SAOR records are saved independently. The transmittal and SAOR can be printed separately or together.</div></div></section>'
   +'<div class="panel rv-bar"><div class="seg"><button class="on" data-tab="saor">SK SAOR</button><button data-tab="letter">Transmittal Letter</button><button data-tab="preview">Print Preview</button></div><span class="btn-row" style="margin-left:auto"><button class="btn sm primary" id="sk-save" '+(canEdit?'':'disabled')+'>Save</button><button class="btn sm ghost" id="sk-print">Print</button><button class="btn sm ghost" id="sk-word">Word</button></span></div>'
   +'<div id="sk-saor-tab"><section class="panel"><div class="panel-head"><h2>SK Findings</h2>'+(canEdit?'<button class="btn sm primary" id="sk-add">+ Add Observation</button>':'')+'</div><div class="panel-body"><span class="hint">Enter SK-specific findings only. No Barangay AOM data is imported.</span></div></section><div id="sk-entries">'+entries+'</div></div>'
   +'<div id="sk-letter-tab" hidden><section class="panel"><div class="panel-head"><h2>Transmittal Letter</h2></div><div class="panel-body">'+txt('sk-date','Date',d.date)+txt('sk-addressee','Addressee / Name',d.addressee)+txt('sk-position','Position',d.position)+txt('sk-office','Office',d.office)+txt('sk-salutation','Salutation',d.salutation)+txt('sk-letter','Letter Body',d.letter,9)+txt('sk-signatory','Signatory',d.signatory)+txt('sk-designation','Designation',d.designation)+'</div></section></div>'
   +'<div id="sk-preview-tab" hidden><section class="panel"><div class="panel-head"><h2>Print Preview</h2></div><div class="panel-body"><div id="sk-preview" style="overflow:auto"></div></div></section></div>'
   +'<section class="panel"><div class="panel-body"><label class="label">Output</label><select class="input" id="sk-output"><option value="both">Transmittal and SK SAOR</option><option value="letter">Transmittal only</option><option value="saor">SK SAOR only</option></select></div></section>';
  return {active:'#/sk-saor',crumbs:'<b>SK SAOR</b>',body,mount(root){
    const read=()=>{ const v={...d};['date','addressee','position','office','salutation','letter','signatory','designation'].forEach(k=>v[k]=$('#sk-'+k,root).value.trim());v.entries=$$('[data-entry]',root).map(el=>Object.fromEntries($$('[data-field]',el).map(x=>[x.dataset.field,x.value.trim()])));return v; };
    const save=async()=>{if(!canEdit)return false;const v=read();await store.save('letters',key,v);setDirty(false);toast('SK SAOR saved.','ok');return true;};
    $('#sk-save',root).onclick=save;
    const dirty=()=>setDirty(true,save);
    $$('input,textarea',root).forEach(x=>{if(!['sk-year'].includes(x.id))x.addEventListener('input',dirty)});
    $('#sk-lgu',root).onchange=e=>location.hash='#/sk-saor?lgu='+encodeURIComponent(e.target.value)+'&year='+year;
    $('#sk-year',root).onchange=e=>{if(validYear(e.target.value))location.hash='#/sk-saor?lgu='+encodeURIComponent(chosen.id)+'&year='+e.target.value;else toast('Enter a valid four-digit audit year.','warn')};
    $('#sk-add',root)?.addEventListener('click',async()=>{if(!(await save()))return;const v=read();v.entries.push({reference:'',observation:'',recommendation:'',comment:'',rejoinder:''});await store.save('letters',key,v);location.hash='#/sk-saor?lgu='+encodeURIComponent(chosen.id)+'&year='+year+'&edit='+Date.now()});
    $$('[data-remove]',root).forEach(btn=>btn.onclick=async()=>{if(!(await confirmBox('Remove SK Observation','Remove this observation from the SK SAOR?','Remove')))return;const v=read();v.entries.splice(Number(btn.dataset.remove),1);await store.save('letters',key,v);location.hash='#/sk-saor?lgu='+encodeURIComponent(chosen.id)+'&year='+year+'&edit='+Date.now()});
    $$('[data-tab]',root).forEach(b=>b.onclick=()=>{const k=b.dataset.tab;$$('[data-tab]',root).forEach(x=>x.classList.toggle('on',x===b));['saor','letter','preview'].forEach(x=>$('#sk-'+x+'-tab',root).hidden=x!==k);if(k==='preview')$('#sk-preview',root).innerHTML='<div style="padding:20px;background:white;color:black">'+printHTML(read(),chosen.data.name,year,'both').split('<body>')[1].split('</body>')[0]+'</div>'});
    $('#sk-print',root).onclick=()=>printSK(read(),chosen.data.name,year,$('#sk-output',root).value);
    $('#sk-word',root).onclick=async()=>{try{await wordSK(read(),chosen.data.name,year,$('#sk-output',root).value)}catch(e){toast('Word generation failed: '+e.message,'bad')}};
  }};
}
