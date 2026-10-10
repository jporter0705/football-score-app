const $=id=>document.getElementById(id);
let csv='',choices={},plan=null,busy=false,unlocked=false,fileVersion=0,weekInputs=[];
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0);
function el(tag,text,parent){const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;}
function ready(){
  $('login').hidden=unlocked;$('file').disabled=busy;
  $('preview').disabled=busy||!csv||!unlocked;
  $('save').disabled=busy||!unlocked||!plan||!!plan.summary.review||!$('confirmed').checked||!(plan.summary.new+plan.summary.updated);
  const reason=$('saveReason');reason.replaceChildren();
  if(plan?.summary.review){
    el('span',`${plan.summary.review} wager(s) still need review. Checking this box does not resolve those rows. `,reason);
    const first=plan.items.find(item=>item.action==='review');
    if(first){const link=el('a','Go to first wager needing review',reason);link.href='#review-row-'+first.row;}
  }else if(plan&&!unlocked)reason.textContent='Unlock private bets before saving.';
  else if(plan&&!busy&&!$('confirmed').checked)reason.textContent='Check “I reviewed these changes” to enable Save changes.';
  $('unlock').disabled=busy;
  weekInputs.forEach(input=>{input.disabled=busy;});
}
function invalidate(){plan=null;$('confirmed').checked=false;$('actions').hidden=true;ready();}
async function api(path,body){
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const j=await r.json();if(!r.ok){if(r.status===401)unlocked=false;throw Error((j.savedWeeks?.length?j.savedWeeks.length+' weeks saved. ':'')+(j.error||'Request failed'));}return j;
}
function render(){
  $('rows').replaceChildren();weekInputs=[];const s=plan.summary;
  $('summary').textContent=`${s.new} new · ${s.updated} updated · ${s.unchanged} unchanged · ${s.review} needs review`;
  for(const item of plan.items){
    const card=el('article','',$('rows'));card.className=item.action;
    if(item.action==='review')card.id='review-row-'+item.row;
    el('h2',`${item.action==='review'?'Needs review':item.action[0].toUpperCase()+item.action.slice(1)} · Bet ${item.betId||'row '+item.row}`,card);
    el('p',item.description,card);
    if(item.reason)el('p',item.reason,card);
    if(item.notice)el('small',item.notice,card);
    if(item.after){el('p',`${item.after.betOnlineStatus} · Risk ${money(item.after.risk)} · To win ${money(item.after.toWin)}`,card);}
    if(item.existing)el('small','Saved week '+item.week+' is retained.',card);
    else if(item.week||item.suggestedWeek){
      const label=el('label','Game week (Tuesday start)',card),select=el('select','',label);
      weekInputs.push(select);
      const blank=el('option','Choose week',select);blank.value='';
      const weeks=new Set([...plan.weeks,item.week,item.suggestedWeek].filter(Boolean));
      const nearby=item.suggestedWeek||item.week;
      if(nearby)for(let i=-1;i<=4;i++)weeks.add(new Date(Date.parse(nearby+'T12:00:00Z')+i*7*86400000).toISOString().slice(0,10));
      [...weeks].sort().reverse().forEach(w=>{el('option','Week of '+w,select).value=w;});select.value=item.week||'';
      select.onchange=async()=>{if(busy)return;choices[item.betId]=select.value;if(!select.value)delete choices[item.betId];invalidate();$('status').textContent='Checking your updated week…';await $('preview').onclick();};
    }
    if(item.changes?.length){const d=el('details','',card);el('summary','See changed fields',d);for(const k of item.changes)el('pre',k+': '+JSON.stringify(item.before[k]??null)+' → '+JSON.stringify(item.after[k]),d);}
    if(item.after?.legs?.length){const d=el('details','',card);el('summary',item.after.legs.length+' legs',d);for(const leg of item.after.legs)el('p',leg.raw||[leg.selection,leg.side,leg.line,leg.period].filter(v=>v!=null&&v!=='').join(' '),d);}
  }
  $('actions').hidden=!(s.new+s.updated+s.review);$('confirmed').checked=false;ready();
}
$('file').onchange=async()=>{
  const version=++fileVersion;csv='';choices={};invalidate();$('rows').replaceChildren();$('summary').textContent='';
  try{const file=$('file').files[0];if(!file)return;if(!/\.csv$/i.test(file.name)||file.size>1_900_000)throw Error('Choose a BetOnline CSV smaller than 1.9 MB.');const text=await file.text();if(version!==fileVersion)return;csv=text;$('status').textContent='File ready. Preview changes to compare it with saved wagers.';}catch(e){$('status').textContent=e.message;}ready();
};
$('preview').onclick=async()=>{busy=true;invalidate();ready();$('status').textContent='Comparing with saved bets…';try{plan=await api('/api/csv-import',{action:'preview',csv,choices});render();$('status').textContent=plan.summary.review?'Some rows still need review. Choose a week where requested; the preview refreshes automatically. Exporter warnings must be resolved before saving.':'Preview ready. No bets have been changed.';}catch(e){$('status').textContent=e.message;}finally{busy=false;ready();}};
$('confirmed').onchange=ready;
$('save').onclick=async()=>{
  if($('save').disabled)return;busy=true;ready();$('status').textContent='Saving reviewed changes…';
  try{const result=await api('/api/csv-import',{action:'save',csv,choices,token:plan.token});invalidate();$('rows').replaceChildren();$('summary').textContent='Import complete';$('status').textContent=`Saved ${result.summary.new} new · ${result.summary.updated} updated. ${result.summary.unchanged} unchanged. Return to bets and refresh.`;}
  catch(e){invalidate();$('status').textContent=e.message+' Preview again to check what saved before retrying. Matching Bet IDs will not be added twice.';}
  finally{busy=false;ready();}
};
$('unlock').onclick=async()=>{busy=true;ready();try{await api('/api/session',{key:$('key').value});$('key').value='';unlocked=true;$('status').textContent='Unlocked. Choose a CSV or preview your selected file.';}catch(e){$('status').textContent=e.message;}finally{busy=false;ready();}};
try{const r=await fetch('/api/session',{cache:'no-store'});unlocked=r.ok&&(await r.json()).authenticated;$('status').textContent=unlocked?'Choose your latest BetOnline CSV.':'Unlock private bets to preview and save.';}catch{$('status').textContent='Could not check access. Try unlocking again.';}ready();
