const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
function node(tag='div'){return{tag,children:[],textContent:'',value:'',hidden:false,checked:false,disabled:false,files:[],style:{},setAttribute(k,v){this[k]=v;},append(n){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n);n.parentElement=this;this.children.push(n);},after(n){const parent=this.parentElement;if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n);n.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,n);},replaceChildren(){this.children=[];}}}
function all(root){return[root,...root.children.flatMap(all)]}
const fixture=JSON.parse(fs.readFileSync('manual-ui-fixture.json','utf8'));
(async()=>{
 const root=node(),ids=['pageTitle','intro','clearMatches','saveReason','login','file','preview','save','unlock','key','confirmed','actions','rows','summary','status'],els=Object.fromEntries(ids.map(k=>[k,node(k)]));Object.values(els).forEach(n=>root.append(n));const upload=node('section');root.append(upload);upload.append(els.file);upload.append(els.preview);
 const calls=[];let selected=true;
 const ctx=vm.createContext({console,Date,Set,Intl,AbortSignal,URLSearchParams,location:{search:'?saved=1&betId=1006052157-3'},setTimeout,document:{getElementById:id=>els[id],createElement:node},fetch:async(url,opts)=>{
   if(url==='/api/session')return{ok:true,json:async()=>({authenticated:true})};let body=JSON.parse(opts.body);calls.push(body);
   if(body.action==='find')return{ok:true,json:async()=>structuredClone(fixture.candidate)};
   if(body.action==='previewSaved')return{ok:true,json:async()=>structuredClone(Object.keys(body.matches||{}).length?fixture.staged:fixture.initial)};
   if(body.action==='saveSaved')return{ok:true,json:async()=>fixture.saved};throw Error('Unexpected call');
 }});
 vm.runInContext(fs.readFileSync('dist/game-match-ui.js','utf8'),ctx);
 await vm.runInContext('(async()=>{'+fs.readFileSync('dist/csv-import-ui.mjs','utf8')+'})()',ctx);
 assert.equal(upload.hidden,true);assert.equal(els.preview.parentElement,root,'saved review remains accessible outside hidden file section');assert.equal(calls[0].action,'previewSaved');
 let nodes=all(els.rows),input=nodes.find(n=>n.tag==='input'),find=nodes.find(n=>n.textContent==='Find Game');input.value='https://www.espn.com/college-football/game/_/gameId/401864523/san-jose-st-utep';await find.onclick();assert.equal(calls.at(-1).action,'find');assert.equal(calls.some(c=>c.action==='saveSaved'),false);
 let use=all(els.rows).find(n=>n.textContent==='Use This Game');await use.onclick();assert.equal(calls.at(-1).action,'previewSaved');assert.equal(els.save.disabled,true,'staging requires overall review confirmation');assert.match(els.rows.children.map(n=>all(n).map(x=>x.textContent).join(' ')).join(' '),/Manually confirmed/);
 assert.equal(els.pageTitle.textContent,'Match saved games');assert.equal(els.clearMatches.hidden,false);await els.clearMatches.onclick();assert.equal(Object.keys(calls.at(-1).matches).length,0);assert.equal(els.clearMatches.hidden,true);await use.onclick();
 els.confirmed.checked=true;els.confirmed.onchange();assert.equal(els.save.disabled,false);await els.save.onclick();assert.equal(calls.at(-1).action,'saveSaved');assert.match(els.status.textContent,/Saved 0 new · 2 updated/);
 // The reusable panel itself blocks warning confirmation and scopes reuse.
 const host=node(),target=fixture.initial.items[0].matchingTargets[0];let busy=false,chosen;
 const warningCandidate={...fixture.candidate,warnings:['Teams differ. Scheduled date differs.']};
 ctx.testHost=host;ctx.testTarget=target;ctx.testOptions={isBusy:()=>busy,setBusy:v=>busy=v,find:async()=>warningCandidate,onChoose:async v=>{chosen=v}};
 vm.runInContext('mountGameMatch(testHost,testTarget,testOptions)',ctx);input=all(host).find(n=>n.tag==='input'&&n.type==='text');find=all(host).find(n=>n.textContent==='Find Game');input.value='401864523';await find.onclick();use=all(host).find(n=>n.textContent==='Use This Game');assert.equal(use.disabled,true);await use.onclick();assert.equal(chosen,undefined);
 const checks=all(host).filter(n=>n.type==='checkbox');checks[0].checked=true;checks[0].onchange();await use.onclick();assert.equal(Object.keys(chosen).length,1,'related wagers require explicit opt in');checks[1].checked=true;await use.onclick();assert.equal(Object.keys(chosen).length,2);
 input.oninput();assert(!all(host).some(n=>n.textContent==='Use This Game'),'editing invalidates candidate');
 const css=fs.readFileSync('dist/game-match.css','utf8');assert.match(css,/font-size:16px/);assert.match(css,/min-height:44px/);assert.match(css,/overflow-wrap:anywhere/);
 console.log('PASS built review UI: saved mode, pasted URL, Find/stage/save separation, review checkbox, warning acknowledgment, explicit related opt-in, manual badge, changed-input invalidation and mobile control CSS');
})().catch(e=>{console.error(e);process.exitCode=1});
