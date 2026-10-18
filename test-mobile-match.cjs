const fs=require('node:fs'),assert=require('node:assert/strict');
const h=require('./test-support-netlify.cjs')();
(async()=>{
 const normal=await h.moduleFor('_bet-normalize'),m=await h.moduleFor('_manual-match'),planner=await h.moduleFor('_csv-plan'),priv=await h.moduleFor('_private');
 const endpoint=(await h.moduleFor('game-match')).default,csvEndpoint=(await h.moduleFor('csv-import')).default;
 const csv=fs.readFileSync('test-mobile-nebraska.csv','utf8'),week='2026-10-13';
 // Representative ESPN response: date/status here are fixtures, not live-score evidence.
 const id='401858492',header={id,league:{id:'23',slug:'college-football'},competitions:[{id,date:'2026-10-18T02:30Z',competitors:[
  {homeAway:'away',team:{id:'158',uid:'s:20~l:23~t:158',location:'Nebraska',displayName:'Nebraska Cornhuskers',abbreviation:'NEB'}},
  {homeAway:'home',team:{id:'2483',uid:'s:20~l:23~t:2483',location:'Oregon',displayName:'Oregon Ducks',abbreviation:'ORE'}}]}]};
 const event=m.verifiedEvent(header,id,'College'),empty=[{week,bets:[],scores:{nfl:[],college:[]}}];
 let plan=planner.makePlan(csv,empty);assert.equal(plan.summary.new,2);
 for(const item of plan.items){assert.equal(item.matchingTargets[0].pair.join('|'),'NEBRASKA|OREGON');assert.equal(item.matchingTargets[0].sport,'');assert.equal(item.matchingTargets[0].date,null,'placement/graded date must not become scheduled date');}
 const withScores=planner.makePlan(csv,[{week,bets:[],scores:{college:[event],nfl:[]}}]);
 for(const item of withScores.items){assert.equal(item.after.espnEventId,id);assert.equal(item.after.sport,'College');assert.equal(item.after.league,'NCAA');assert.equal(item.after.eventDate,'2026-10-17');}
 assert.equal(withScores.items[0].after.betId,'1006556268-1');assert.equal(withScores.items[1].after.betId,'1006552542-1');assert.equal(withScores.items[1].after.period,'third_quarter');assert.equal(withScores.items[1].after.line,-6.5);
 const source=plan.items[0].after,target=plan.items[0].matchingTargets[0];
 for(const input of [id,'https://www.espn.com/college-football/game/_/gameId/'+id+'/nebraska-oregon']){
  const candidate=await m.findCandidate(input,target,async()=>({header}));assert.equal(candidate.event.id,id);assert.equal(candidate.warnings.length,2);
  assert.throws(()=>m.applyMatches(source,{[target.key]:{receipt:candidate.receipt}}),/acknowledge/);
  const saved=m.applyMatches(source,{[target.key]:{receipt:candidate.receipt,acknowledged:true}});assert.equal(saved.sport,'College');assert.equal(saved.league,'NCAA');assert.equal(saved.manualMatch.sport,'College');
  for(const k of ['betId','description','selection','risk','toWin','period','status','betOnlineStatus'])assert.equal(saved[k],source[k]);
  assert.equal(normal.normalizeBet(source,{},saved).manualMatch.eventId,id,'manual choice survives fresh CSV normalization');
 }
 await assert.rejects(m.findCandidate(id,{...target,pair:['Nebraska','Oregon State']},async()=>({header})),/Both original opponents/);
 await assert.rejects(m.findCandidate(id,{...target,pair:null},async()=>({header})),/both original opponents/);
 await assert.rejects(m.findCandidate(id,{...target,sport:'NFL'},async()=>({header})),/league/);
 await assert.rejects(m.findCandidate(id,target,async()=>{throw Error('offline')}),/could not verify/);
 const dated=normal.normalizeBet({...source,sport:'College',eventDate:'2026-10-24'},{college:[event]});assert.equal(dated.espnEventId,undefined,'supplied scheduled date remains strict');
 const duplicate={...event,id:'401858493'};assert.equal(normal.normalizeBet(source,{college:[event,duplicate]}).espnEventId,undefined,'multiple possible games remain unmatched');
 const nfl={...event,id:'401858494',uid:'s:20~l:28~e:401858494'};assert.equal(normal.normalizeBet(source,{college:[event],nfl:[nfl]}).espnEventId,undefined,'cross-league ambiguity never silently resolves');
 // Authenticated API path and CSV preview/save, with no score pool to infer the league.
 const auth={cookie:'football_session='+priv.session(),origin:'https://example.netlify.app'};
 h.state.onFetch=async()=>({ok:true,json:async()=>({header})});
 const r=await endpoint(h.request('game-match','POST',{action:'find',mode:'csv',csv,choices:{[source.betId]:week},targetKey:target.key,input:id},auth)),found=await r.json();assert.equal(r.status,200,JSON.stringify(found));
 assert.equal(found.confirmations.length,1,'unknown date/league cannot silently group related wagers');
 const matches={[target.key]:{receipt:found.receipt,acknowledged:true}};
 let res=await csvEndpoint(h.request('csv-import','POST',{action:'preview',csv,matches},auth)),preview=await res.json();assert.equal(res.status,200,JSON.stringify(preview));assert.equal(preview.items[0].after.espnEventId,id);
 res=await csvEndpoint(h.request('csv-import','POST',{action:'save',csv,matches,token:preview.token},auth));assert.equal(res.status,200,await res.text());
 const stored=await h.getStore('football-private-bets').get('week/'+week);assert.equal(stored.bets.find(b=>b.betId===source.betId).manualMatch.eventId,id);
 res=await csvEndpoint(h.request('csv-import','POST',{action:'preview',csv},auth));preview=await res.json();assert.equal(preview.summary.unchanged,2,'repeat CSV stays unchanged');
 console.log('PASS actual Nebraska/Oregon mobile CSV, both IDs, automatic two-team matching, unknown-league ID/URL confirmation, strict league/date/opponent guards, save and reimport');
})().catch(e=>{console.error(e);process.exitCode=1});
