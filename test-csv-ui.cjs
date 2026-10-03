const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
function node(tag='div'){return {tag,children:[],textContent:'',value:'',hidden:false,checked:false,disabled:false,files:[],append(n){this.children.push(n);},replaceChildren(){this.children=[];}};}
(async()=>{
 const ids=['login','file','preview','save','unlock','key','confirmed','actions','rows','summary','status'];
 const els=Object.fromEntries(ids.map(id=>[id,node()]));let mode='preview',calls=[];
 const plan={summary:{new:1,updated:0,unchanged:0,review:0},token:'preview-token',weeks:['2026-09-29'],items:[{betId:'test-1',description:'<img src=x onerror=alert(1)>',action:'new',week:'2026-09-29',after:{betOnlineStatus:'PENDING',risk:40,toWin:36.36},changes:[]}]};
 const ctx=vm.createContext({console,Date,Set,Intl,AbortSignal,document:{getElementById:id=>els[id],createElement:node},fetch:async(url,options)=>{
   if(url==='/api/session')return{ok:true,json:async()=>({authenticated:true})};
   const body=JSON.parse(options.body);calls.push(body);
   if(mode==='stale')return{ok:false,status:409,json:async()=>({error:'Bets changed. Preview again.'})};
   return{ok:true,json:async()=>body.action==='preview'?structuredClone(plan):{summary:plan.summary,savedWeeks:['2026-09-29']}};
 }});
 await vm.runInContext('(async()=>{'+fs.readFileSync('csv-import-ui.mjs','utf8')+'})()',ctx);
 assert.equal(els.login.hidden,true);assert.equal(els.preview.disabled,true);
 els.file.files=[{name:'bets.csv',size:10,text:async()=> 'sample csv'}];await els.file.onchange();assert.equal(els.preview.disabled,false);
 await els.preview.onclick();assert.match(els.summary.textContent,/1 new/);assert.equal(els.save.disabled,true);assert.equal(els.rows.children[0].children[1].textContent,plan.items[0].description,'file text is rendered as text, not HTML');
 els.confirmed.checked=true;els.confirmed.onchange();assert.equal(els.save.disabled,false);
 mode='stale';await els.save.onclick();assert.equal(els.actions.hidden,true);assert.match(els.status.textContent,/Preview again/);assert.equal(calls.at(-1).token,'preview-token');
 mode='preview';await els.preview.onclick();els.confirmed.checked=true;els.confirmed.onchange();await els.save.onclick();assert.match(els.status.textContent,/Saved 1 new/);assert.equal(els.actions.hidden,true);assert.equal(els.rows.children.length,0);
 await els.preview.onclick();const label=els.rows.children[0].children.find(n=>n.tag==='label'),select=label.children[0];select.value='2026-10-06';select.onchange();assert.equal(els.save.disabled,true);await els.preview.onclick();assert.equal(calls.at(-1).choices['test-1'],'2026-10-06');
 els.file.files=[{name:'bad.json',size:10}];await els.file.onchange();assert.equal(els.preview.disabled,true);assert.equal(els.save.disabled,true);
 for(const asset of ['upload-bets.html','csv-import-ui.mjs'])assert(fs.existsSync('dist/'+asset));
 assert(!fs.existsSync('dist/csv-records.mjs'),'server-only parsing is not published as a data asset');
 assert.match(fs.readFileSync('dist/index.html','utf8'),/href="\/upload-bets.html"/);
 console.log('PASS upload selection, private access, review checkbox, plain-text rendering, stale-save recovery, success state, week re-preview, invalid files and public asset inclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
