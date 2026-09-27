const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),{ctx,elements,storage,run}=require('./test-support-browser.cjs')();
function game(id,away,home,state='pre'){return{id:String(id),date:'2026-09-27T17:00:00Z',competitions:[{status:{period:state==='pre'?0:4,type:{state,completed:state==='post'}},competitors:[{homeAway:'away',score:'24',team:{displayName:away,shortDisplayName:away,name:away}},{homeAway:'home',score:'20',team:{displayName:home,shortDisplayName:home,name:home}}]}]}}
const games=Array.from({length:100},(_,i)=>game(100+i,'Away '+i,'Home '+i,i%3===0?'post':i%3===1?'in':'pre'));
function bets(n){return Array.from({length:n},(_,i)=>{const x=i%games.length,unmatched=i%10===0;return{betId:'synthetic-'+i,sport:'College',structure:i%4===0?'parlay':'straight',market:'spread',selection:'Away '+x,line:3,risk:10,toWin:9,awayTeam:unmatched?'Unknown '+i:'Away '+x,homeTeam:'Home '+x,legs:i%4===0?Array.from({length:6},(_,l)=>({legNumber:l+1,market:'spread',selection:'Away '+x,line:3,sport:'College',awayTeam:unmatched?'Unknown '+i:'Away '+x,homeTeam:'Home '+x})):[]}})}
(async()=>{
  ctx.S.nfl=[];ctx.S.collegeAll=games;ctx.S.collegeView=games;ctx.S.bets=bets(500);ctx.S.week=ctx.selectedWeek;ctx.sport='college';
  const financial=ctx.S.bets.map(b=>[b.betId,b.risk,b.toWin,b.line]);const timing={};
  for(const filter of ['all','upcoming','live','closed','review']){ctx.betFilter=filter;const start=performance.now();run('renderBets()');timing[filter]=Math.round(performance.now()-start);assert(timing[filter]<2000,filter+' should stay responsive with 500 bets');assert.equal(ctx.matchupRenderCache,null)}
  const start=performance.now();run('renderAll()');timing.full=Math.round(performance.now()-start);assert(timing.full<2500);assert.deepEqual(ctx.S.bets.map(b=>[b.betId,b.risk,b.toWin,b.line]),financial);
  ctx.S.bets=bets(8);ctx.betFilter='all';run('renderBets()');const cached=elements.bets.innerHTML,fast=ctx.exactMatchGame;ctx.exactMatchGame=ctx.uncachedExactMatchGame;run('renderBets()');assert.equal(elements.bets.innerHTML,cached,'cache must not change grades/order/markup');ctx.exactMatchGame=fast;
  const weeks=[];let w=ctx.bettingWeek();for(let i=0;i<60;i++){weeks.push(w.start);w=ctx.previousWeek(w)}
  const requests=[];ctx.jsonFetch=async url=>{requests.push(url);if(url==='/api/session')return{authenticated:true};if(url==='/api/archive')return{weeks};if(url.startsWith('/api/archive?')){const key=new URL('https://example.test'+url).searchParams.get('week');return{week:ctx.bettingWeek(new Date(key+'T12:00:00')),bets:[{betId:'PRIVATE-'+key}],nfl:[],college:[],sources:{}}}return{ok:true}};
  ctx.refreshSummaries=async()=>true;await ctx.startHistory();
  assert(requests.filter(u=>u.startsWith('/api/archive?')).every(u=>u.endsWith(ctx.selectedWeek.start)),'startup fetches no unselected historical week');
  for(const key of weeks.slice(1)){ctx.selectedWeek=ctx.bettingWeek(new Date(key+'T12:00:00'));await ctx.loadHostedWeek(key);assert(Object.keys(ctx.historyWeeks).length<=3,'in-memory week snapshots bounded')}
  assert.equal(ctx.knownWeekKeys.length,60,'all weeks remain selectable');const saved=storage.get('football-history-v1');assert(!saved.includes('PRIVATE-'),'private bets are not persisted in browser');assert(Object.keys(JSON.parse(saved).snapshots).length<=3);
  ctx.mergeArchive({week:ctx.selectedWeek,bets:[],nfl:[],college:[],sources:{}});assert.equal(ctx.historyWeeks[ctx.selectedWeek.start].bets.length,0,'restore/deletion snapshot cannot be reintroduced from old browser bets');
  console.log('PASS 500 bets/750 legs/100 games, cache output parity, 60 weeks on demand, bounded storage and private cache exclusion. Timings ms:',timing);
})().catch(e=>{console.error(e);process.exitCode=1});
