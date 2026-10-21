const assert=require('node:assert/strict'),h=require('./test-support-netlify.cjs')();
const event=(id,date,away,home)=>({id,uid:'s:20~l:23~e:'+id,date,competitions:[{id,date,competitors:[{homeAway:'away',team:{location:away[0],displayName:away[1],shortDisplayName:away[2],abbreviation:away[3]}},{homeAway:'home',team:{location:home[0],displayName:home[1],shortDisplayName:home[2],abbreviation:home[3]}}]}]});
const umass=event('401861965','2026-10-23T23:00Z',['Massachusetts','Massachusetts Minutemen','UMass','MASS'],['UConn','UConn Huskies','UConn','CONN']);
const pitt=event('401858274','2026-10-24T16:00Z',['Pittsburgh','Pittsburgh Panthers','Pitt','PITT'],['Miami','Miami Hurricanes','Miami','MIA']);
const headers=['bet_id','accepted_date','risk','to_win','status','type','description','market','selection','side','line','odds','period','game_text','sport','league','legs_json','leg_count','expanded_text','extraction_error'];
const csv=rows=>[headers,...rows.map(r=>headers.map(k=>r[k]??''))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
const row=(id,selection,game,day)=>({bet_id:id,accepted_date:'10/20/26 09:00 PM GMT-7',risk:30,to_win:28.57,status:'PENDING',type:'Spread',description:selection+' +14',market:'spread',selection,line:14,period:'game',game_text:game,sport:'College',league:'NCAA',legs_json:'[]',leg_count:0,expanded_text:'Description:\nFootball - NCAA - '+game+' - Spread | selection | '+day+' | 07:00:00 PM (EST) | Pending'});
(async()=>{
 const {makePlan}=await h.moduleFor('_csv-plan'),{hydrateImportScores}=await h.moduleFor('_import-scores');
 const {default:T}=await import('./team-matching.mjs');
 const weeks=[{week:'2026-10-20',revision:'empty',scores:{nfl:[],college:[]},bets:[]}];
 const text=csv([row('upcoming-umass','Massachusetts','Massachusetts vs Connecticut','10/23/2026'),row('upcoming-pitt','Pittsburgh','Pittsburgh vs Miami Florida','10/24/2026')]);
 let plan=makePlan(text,weeks);assert(plan.items.every(i=>i.matchingTargets[0].status==='No ESPN match yet'));
 h.state.onFetch=async url=>({ok:true,json:async()=>({events:String(url).includes('20261023')?[umass]:[pitt]})});
 await hydrateImportScores(weeks,plan);plan=makePlan(text,weeks);
 assert.deepEqual(Array.from(plan.items,i=>i.after.espnEventId),[umass.id,pitt.id]);
 assert.equal(h.state.fetches.length,2,'only the two unresolved dates, not every game week');
 assert(h.state.fetches.every(u=>u.includes('/college-football/')&&u.includes('groups=80')));
 assert.equal((await h.getStore('football-score-history').get('week/2026-10-20')).college.length,2,'schedule persisted for Bets');
 assert(!h.state.writes.some(k=>k.startsWith('football-private-bets/')),'preview must not modify private wagers');
 await hydrateImportScores(weeks,plan);assert.equal(h.state.fetches.length,2,'resolved repeat needs no new fetch');
 assert.equal(T.resolve([pitt],{sport:'College',awayTeam:'Pitt',homeTeam:'Miami (FL)',eventDate:'2026-10-24'}).id,pitt.id);
 for(const bad of [{homeTeam:'Miami Ohio'},{sport:'NFL'},{eventDate:'2026-10-23'},{awayTeam:'Wrong opponent'}])assert.equal(T.resolve([pitt],{sport:'College',awayTeam:'Pittsburgh',homeTeam:'Miami Florida',eventDate:'2026-10-24',...bad}),null);
 const missing=[{...weeks[0],scores:{college:[],nfl:[]}}];await hydrateImportScores(missing,makePlan(text,missing),{fetch:async()=>{throw Error('offline')}});assert.equal(missing[0].scores.college.length,0);
 await hydrateImportScores(missing,makePlan(text,missing),{persist:async()=>{throw Error('write failed')}});assert.equal(missing[0].scores.college.length,0,'failed cache write cannot claim a usable match');
 // A known saved wager may reuse identity only after its source terms agree.
 const old={betId:'saved-live',acceptedDate:'2026-10-16T18:53:00-07:00',risk:25,toWin:30,status:'WON',betOnlineStatus:'WON',type:'Live',description:'Saved complete description',market:'spread',selection:'PURDUE',period:'third_quarter',line:-.5,sport:'College',league:'NCAA',awayTeam:'Washington Huskies',homeTeam:'Purdue Boilermakers',espnEventId:'401858493',eventDate:'2026-10-16'};
 const incomplete={bet_id:old.betId,accepted_date:'10/16/26 06:53 PM GMT-7',risk:25,to_win:30,status:'WON',type:'Live',market:'spread',selection:'PURDUE',line:-.5,period:'third_quarter',leg_count:0,legs_json:'[]',expanded_text:'Description: Mobile - WASHINGTON at PURDUE - Side [3rd Quarter] - PURDUE -0.5\nType:\nLive',extraction_error:'Straight bet description missing; '};
 const saved=[{week:'2026-10-13',scores:{},bets:[old]}];
 const repaired=makePlan(csv([incomplete]),saved).items[0];assert.notEqual(repaired.action,'review');assert.match(repaired.notice,/same saved Bet ID/);assert.equal(repaired.after.espnEventId,old.espnEventId);assert.equal(repaired.after.description,old.description);assert.equal(repaired.after.risk,25);assert.equal(repaired.after.toWin,30);
 for(const change of [{bet_id:'new-id'},{line:-1.5},{risk:30},{period:'game'},{selection:'WASHINGTON'},{expanded_text:incomplete.expanded_text.replace('WASHINGTON at PURDUE','IOWA at PURDUE')},{expanded_text:incomplete.expanded_text.replace('-0.5','-1.5')},{expanded_text:incomplete.expanded_text.replace('3rd Quarter','1st Quarter')},{extraction_error:'Missing parlay legs; '}])assert.equal(makePlan(csv([{...incomplete,...change}]),saved).summary.review,1,'unsafe incomplete input remains review');
 // Authenticated preview/save integration: public cache loading keeps the signed
 // plan stable; subsequent import preserves the full wager identity.
 const api=(await h.moduleFor('csv-import')).default,priv=await h.moduleFor('_private');
 const call=async body=>{const r=await api(h.request('csv-import','POST',body,{cookie:'football_session='+priv.session(),origin:'https://example.netlify.app'}));return {status:r.status,...await r.json()};};
 let p=await call({action:'preview',csv:text});assert.equal(p.status,200);assert.equal(p.summary.review,0);assert(p.items.every(i=>i.matchingTargets[0].status==='Automatically matched'));
 let result=await call({action:'save',csv:text,token:p.token});assert.equal(result.status,200,JSON.stringify(result));
 assert.equal((await call({action:'preview',csv:text})).summary.unchanged,2);
 console.log('PASS upcoming UMass/Pitt schedule hydration, bounded league/date fetches, shared aliases, strict matching, saved-description recovery, conflict guards and signed preview/save idempotence');
})().catch(e=>{console.error(e);process.exitCode=1});
