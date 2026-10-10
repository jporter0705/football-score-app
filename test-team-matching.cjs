const assert=require('node:assert/strict'),fs=require('node:fs');
const {ctx}=require('./test-support-browser.cjs')();const T=ctx.TeamMatching;
const events=JSON.parse(fs.readFileSync('test-matching-events.json','utf8'));
const bets=[{betId:'1003959095-6',sport:'College',league:'NCAA',structure:'straight',market:'spread',selection:'Old Dominion',awayTeam:'Old Dominion',homeTeam:'Appalachian State',gameText:'Old Dominion vs Appalachian State',eventDate:'2026-10-10',line:9.5,odds:-105,risk:40,toWin:38.10,status:'PENDING',betOnlineStatus:'PENDING',acceptedDate:'2026-10-10T05:31:00Z'},
{betId:'1003959095-4',sport:'College',league:'NCAA',structure:'straight',market:'spread',selection:'Central Florida',awayTeam:'Central Florida',homeTeam:'Oklahoma State',gameText:'Central Florida vs Oklahoma State',eventDate:'2026-10-10',line:10,odds:-115,risk:40,toWin:34.78,status:'PENDING',betOnlineStatus:'PENDING',acceptedDate:'2026-10-10T05:31:00Z'}];
const expected=['401869843','401856824'];
ctx.S.collegeAll=events;ctx.S.nfl=[];ctx.S.bets=bets;ctx.selectedWeek={start:'2026-10-06',end:'2026-10-12'};
function clone(v){return JSON.parse(JSON.stringify(v))}
function altered(e,id,date){return {...clone(e),id,date}}
for(let i=0;i<bets.length;i++){
 assert.equal(T.resolve(events,bets[i]).id,expected[i]);assert.equal(ctx.findGame(bets[i]).id,expected[i]);
 const legacy={...bets[i]};delete legacy.eventDate;assert.equal(ctx.findGame(legacy).id,expected[i],'saved legacy record rematches without reimport');
 assert.equal(ctx.betsFor(events.find(e=>e.id===expected[i]),'college').some(b=>b.betId===bets[i].betId),true);
 const event=events.find(e=>e.id===expected[i]),wrongDay=altered(event,'wrong-day','2026-10-17T16:00Z');
 assert.equal(T.resolve([wrongDay],{...bets[i],espnEventId:'wrong-day'}),null,'ID cannot bypass scheduled day');
 assert.equal(T.resolve([wrongDay,event],bets[i]).id,expected[i]);
 assert.equal(T.resolve([event,altered(event,'duplicate',event.date)],bets[i]),null,'ambiguous games cannot be resolved by first match or stored ID');
 assert.equal(T.resolve([event],{...bets[i],homeTeam:'Wrong Opponent',espnEventId:event.id}),null,'both teams checked even with saved ID');
 assert.equal(ctx.itemMatchesEvent({...bets[i],homeTeam:'Wrong Opponent',espnEventId:event.id},null,event,'college'),false,'My Games cannot use an unvalidated stored ID');
 assert.equal(T.resolve([event],{...bets[i],league:'NFL'}),null,'conflicting league must not match');
 const final=clone(event);final.competitions[0].status={type:{state:'post',completed:true}};final.competitions[0].competitors.forEach(c=>c.score=c.homeAway==='away'?'20':'27');
 assert.equal(ctx.evaluateMarket(bets[i],final).status,'won','selection alias grades the picked team, never assumes home');
 assert.equal(ctx.pickIsAway(bets[i],ctx.teams(event)),true,'picked-team display uses the alias');
 assert.equal(T.resolve([event],{...bets[i],awayTeam:bets[i].homeTeam,homeTeam:bets[i].awayTeam}).id,expected[i],'vs order is not home/away proof');
 assert.equal(T.resolve([event],{...bets[i],eventDate:'2026-02-30'}),null,'invalid calendar day not normalized');
 assert.equal(T.resolve([event],{...bets[i],eventDate:'2026-10-09'}),null,'placement day is not game day');
 assert.equal(T.resolve([event],{...bets[i],awayTeam:'Mountaineers',homeTeam:'Monarchs'}),null,'mascot-only matching rejected');
 const old=ctx.selectedWeek;ctx.selectedWeek={start:'2026-10-13',end:'2026-10-19'};assert.equal(ctx.findGame(legacy),null,'legacy records restricted to their selected week');ctx.selectedWeek=old;
}
for(const [a,b] of [['Central Florida','UCF Knights'],['University of Central Florida','UCF'],['Appalachian St.','App State Mountaineers'],['ODU','Old Dominion Monarchs'],['Ole Miss','Mississippi Rebels'],['UMass','Massachusetts Minutemen'],['UConn','Connecticut Huskies'],['Southern Miss','Southern Mississippi'],['UTSA','Texas San Antonio'],['UNLV','Nevada Las Vegas'],['SMU','Southern Methodist'],['TCU','Texas Christian'],['FIU','Florida International'],['FAU','Florida Atlantic'],['UL Monroe','Louisiana Monroe']])assert.equal(T.key(a,'College'),T.key(b,'College'),a+' / '+b);
for(const [a,b] of [['Oklahoma State','Ohio State'],['Miami Ohio','Miami'],['Western Michigan','West Michigan'],['Michigan State','Michigan'],['Louisiana','Louisiana Monroe'],['USC','South Carolina']])assert.notEqual(T.key(a,'College'),T.key(b,'College'));
const fakeNFL=events.map(e=>({...clone(e),uid:'s:20~l:28~e:'+e.id}));ctx.S.nfl=fakeNFL;ctx.S.collegeAll=[];
for(const b of bets)assert.equal(ctx.findGame(b),null,'NCAA never falls back to NFL');
ctx.S.collegeAll=events;
assert.equal(T.day('2026-10-11T02:30:00Z'),'2026-10-10','late night UTC crosses calendar day');
assert.equal(T.teamMatches({team:{location:'Ohio State',abbreviation:'OSU'}},'OSU','College'),false,'ambiguous acronym cannot create identity');
// Same-render cache keys must include scheduled date.
ctx.renderBets=function(){};
assert.equal(ctx.exactMatchGame(events,{...bets[1],eventDate:'2026-10-09'}),null);
assert.equal(ctx.exactMatchGame(events,bets[1]).id,expected[1]);
(async()=>{
 const {normalizeBet,resolveMatch}=await import('./netlify/functions/_bet-normalize.mjs');
 const {makePlan}=await import('./netlify/functions/_csv-plan.mjs');
 const scores={college:events,nfl:fakeNFL};
 const headers=['bet_id','accepted_date','description','type','sport','league','risk','to_win','status','game_text','market','selection','line','odds','period','leg_count','legs_json','expanded_text','extraction_error'];
 const csv=[headers.join(','),...bets.map(b=>{const row={bet_id:b.betId,accepted_date:'10/09/26 10:31 PM GMT-7',description:b.selection+' +'+b.line+' '+b.odds,type:'Spread',sport:b.sport,league:b.league,risk:b.risk,to_win:b.toWin,status:'PENDING',game_text:b.gameText,market:b.market,selection:b.selection,line:b.line,odds:b.odds,period:'game',leg_count:0,legs_json:'[]',expanded_text:'Football - NCAA - '+b.gameText+' - Spread | '+b.selection+' For Game | 10/10/2026 | 01:00:00 PM (EST) | Pending',extraction_error:''};return headers.map(k=>'"'+String(row[k]??'').replaceAll('"','""')+'"').join(',')})].join('\n');
 const p=makePlan(csv,[{week:'2026-10-06',scores,bets:[]}]);assert.equal(p.summary.review,0);assert.equal(p.summary.new,2);
 assert.deepEqual(p.items.map(i=>i.betId),bets.map(b=>b.betId));
 for(let i=0;i<2;i++){assert.equal(p.items[i].after.espnEventId,expected[i]);assert.equal(p.items[i].after.eventDate,'2026-10-10');assert.equal(p.items[i].after.toWin,bets[i].toWin);assert.equal(p.items[i].after.risk,40);assert.equal(p.items[i].after.line,bets[i].line);assert.equal(p.items[i].week,'2026-10-06');}
 const repeated=makePlan(csv,[{week:'2026-10-06',scores,bets:p.items.map(i=>i.after)}]);assert.equal(repeated.summary.unchanged,2,'complete suffix IDs survive repeat import');
 const multiRow={bet_id:'multi-1',accepted_date:'10/09/26 10:31 PM GMT-7',description:'Parlay',type:'Parlay',sport:'College',league:'NCAA',risk:40,to_win:90,status:'PENDING',leg_count:2,legs_json:JSON.stringify([{market:'spread',selection:'Old Dominion',line:9.5,eventDate:'2026-10-10'},{market:'spread',selection:'UCF',line:10,eventDate:'2026-10-17'}]),expanded_text:'Parlay | 10/10/2026 | Other game | 10/17/2026 |'};
 const multi=headers.map(k=>'"'+String(multiRow[k]??'').replaceAll('"','""')+'"').join(',');
 const mp=makePlan(headers.join(',')+'\n'+multi,[{week:'2026-10-06',scores,bets:[]}]);assert.notEqual(mp.items[0].after?.eventDate,'2026-10-10','multi-game raw text cannot establish a single parent date');
 for(let i=0;i<2;i++){assert.equal(resolveMatch(bets[i],scores).espnEventId,expected[i]);assert.equal(resolveMatch({...bets[i],homeTeam:'Wrong'},scores),null);assert.equal(resolveMatch(bets[i],{nfl:fakeNFL,college:[]}),null);assert.equal(normalizeBet(bets[i],scores).espnEventId,expected[i]);}
 console.log('PASS exact ODU/UCF imports and built rematching, aliases, two-team/date/league checks, ambiguity, legacy-week bounds, suffix IDs and repeat import');
})().catch(e=>{console.error(e);process.exitCode=1});
