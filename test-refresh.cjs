const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={},storage=new Map(),listeners={},requests=[];
const ctx={console,Date,Map,Set,Number,String,Array,JSON,Math,Promise,AbortSignal,URLSearchParams,encodeURIComponent,setTimeout,
  location:{hostname:'example.netlify.app',search:''},navigator:{},window:{addEventListener:(k,v)=>listeners[k]=v},setInterval:()=>{},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  document:{hidden:false,addEventListener:(k,v)=>listeners[k]=v,getElementById:id=>elements[id]||(elements[id]={style:{},parentElement:{},setAttribute(){}}),querySelectorAll:()=>[]}};
vm.createContext(ctx);
const html=fs.readFileSync('index.html','utf8').replace('startHistory();setInterval','setInterval');
for(const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))vm.runInContext(script[1].includes('src=')?fs.readFileSync(script[1].match(/src="([^"]+)"/)[1],'utf8'):script[2],ctx);
const week=ctx.selectedWeek,game={id:'42',competitions:[{competitors:[],status:{type:{state:'pre'}}}]};
const snapshot=()=>({week,nfl:[game],college:[],bets:[],sources:{nfl:{updatedAt:new Date().toISOString()},college:{updatedAt:new Date().toISOString()}}});
ctx.fetch=async(url,options)=>{requests.push([url,options]);return {ok:true,json:async()=>url==='/api/session'?{authenticated:false}:url==='/api/archive'?{weeks:[week.start]}:snapshot()}};
(async()=>{
  ctx.historyWeeks[week.start]=snapshot();ctx.showWeek();assert.equal(ctx.S.nfl[0].id,'42');
  await ctx.startHistory();assert.equal(requests.filter(([u])=>u.startsWith('/api/refresh?')).length,1);
  assert.equal(requests.filter(([u])=>u.startsWith('/api/live?')).length,0);
  assert.equal(listeners.focus,undefined);
  ctx.lastRefreshAttempt=Date.now()-31000;ctx.automaticRefresh();await new Promise(setImmediate);
  assert.equal(requests.filter(([u])=>u.startsWith('/api/live?')).length,1);
  listeners.visibilitychange();ctx.automaticRefresh();await new Promise(setImmediate);
  assert.equal(requests.filter(([u])=>u.startsWith('/api/live?')).length,1,'no redundant visibility refresh');
  ctx.document.hidden=true;ctx.lastRefreshAttempt=0;ctx.automaticRefresh();await ctx.refresh('full');
  assert.equal(requests.filter(([u])=>u.startsWith('/api/live?')).length,1);ctx.document.hidden=false;
  let release;ctx.jsonFetch=async url=>url.startsWith('/api/refresh')?new Promise(r=>release=r):snapshot();
  const updating=ctx.refresh('full');assert.equal(elements.updated.textContent,'Updating…');assert.equal(ctx.S.nfl.length,1,'cached scores remain during update');
  await ctx.refresh('full');release({});await updating;
  assert.match(elements.updated.textContent,/Updated/);
  ctx.jsonFetch=async()=>{throw Error('offline')};await ctx.refresh('full');assert.equal(elements.updated.textContent,'Delayed');assert.equal(ctx.S.nfl.length,1);
  const prior=ctx.previousWeek(week);ctx.selectedWeek=prior;ctx.lastRefreshAttempt=0;let called=false;ctx.jsonFetch=async()=>{called=true};await ctx.refresh('live');assert.equal(called,false);
  ctx.selectedWeek=week;ctx.historyWeeks[week.start].bets=[{betId:'secret'}];ctx.remember();assert.doesNotMatch(storage.get('football-history-v1'),/secret/);
  ctx.mergeArchive({...snapshot(),betsLocked:true});assert.equal(ctx.historyWeeks[week.start].bets.length,0);
  let late;ctx.jsonFetch=()=>new Promise(r=>late=r);const pending=ctx.loadHostedWeek(week.start);ctx.sessionGeneration++;late({...snapshot(),bets:[{betId:'late-secret'}]});await pending;assert.equal(ctx.historyWeeks[week.start].bets.length,0,'late response cannot restore locked bets');
  console.log('PASS hosted startup, cache-first display, manual/live routing, 30s deduplication, hidden and historical tabs, delayed recovery, private cache exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
