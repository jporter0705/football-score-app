import assert from 'node:assert/strict';
import {makePlan} from './netlify/functions/_csv-plan.mjs';
import {resolveMatch,normalizeBet} from './netlify/functions/_bet-normalize.mjs';
const headers=['bet_id','accepted_date','type','description','market','selection','side','line','period','risk','to_win','status','leg_count','legs_json','extraction_error','game_text'];
function csv(extra={}){const row={bet_id:'team-total-1',accepted_date:'10/03/26 06:17 PM GMT-7',type:'Live',description:'Mobile - WASHINGTON at USC - USC - Team Total - OVER 26.5',market:'live',period:'game',risk:'30',to_win:'0',status:'LOST',leg_count:'0',legs_json:'[]',extraction_error:'Straight bet selection/market not parsed; ',...extra};return headers.join(',')+'\n'+headers.map(k=>'"'+String(row[k]??'').replaceAll('"','""')+'"').join(',')}
let p=makePlan(csv(),[]);assert.equal(p.summary.review,0);assert.equal(p.items[0].week,'2026-09-29');assert.equal(p.items[0].after.market,'team_total');assert.equal(p.items[0].after.selection,'USC');assert.equal(p.items[0].after.line,26.5);assert.equal(p.items[0].after.betOnlineStatus,'LOST');assert.equal(p.items[0].after.risk,30);
const saved={week:'2026-09-22',bets:[p.items[0].after],scores:{}};assert.equal(makePlan(csv(),[saved]).items[0].week,'2026-09-22');assert.equal(makePlan(csv(),[],{'team-total-1':'2026-10-06'}).items[0].week,'2026-10-06');
assert.equal(makePlan(csv({extraction_error:'Other warning'}),[]).summary.review,1);assert.equal(makePlan(csv({description:'Mobile - WASHINGTON at USC - UNKNOWN - Team Total - OVER 26.5'}),[]).summary.review,1);assert.equal(makePlan(csv({description:'Mobile - WASHINGTON at USC - USC - Team Total - OVER ???'}),[]).summary.review,1);
console.log('PASS complete team-total recovery, live week, retained/explicit weeks and unresolved warning safeguards');
for(const status of ['PUSH','VOID','CANCELLED','CANCELED']) {
  for(const payout of ['-','–','—']) {
    const plan=makePlan(csv({status,to_win:payout}),[]);
    assert.equal(plan.summary.review,0,status+' '+payout);
    assert.equal(plan.items[0].after.toWin,0);
    assert.equal(plan.items[0].after.risk,30);
    assert.equal(plan.items[0].after.betOnlineStatus,status);
  }
}
for(const status of ['WON','LOST','PENDING'])assert.equal(makePlan(csv({status,to_win:'-'}),[]).items[0].reason,'Invalid to win');
for(const payout of ['', 'garbage', '-30'])assert.equal(makePlan(csv({status:'CANCELLED',to_win:payout}),[]).summary.review,1);
console.log('PASS refunded dash payouts, preserved official status/stake, and invalid payout safeguards');
const event=(id,team,opponent)=>({id,competitions:[{competitors:[{homeAway:'away',team:{location:'Buffalo',displayName:team}},{homeAway:'home',team:{location:opponent,displayName:opponent}}]}]});
const scores={nfl:[event('bills','Buffalo Bills','NFL opponent')],college:[event('bulls','Buffalo Bulls','College opponent')]};
assert.equal(resolveMatch({market:'spread',selection:'Buffalo'},scores),null,'Ambiguous Buffalo must not default to NFL');
assert.equal(resolveMatch({market:'spread',selection:'Buffalo',gameText:'Buffalo vs College opponent',league:'NCAA'},scores).espnEventId,'bulls');
assert.equal(resolveMatch({market:'spread',selection:'Buffalo',gameText:'Buffalo vs College opponent',league:'NCAA',espnEventId:'bills'},scores).espnEventId,'bulls','Wrong-league ID cannot bypass NCAA restriction');
assert.equal(resolveMatch({market:'spread',selection:'Buffalo',gameText:'Buffalo vs College opponent',league:'NCAA'},{nfl:scores.nfl}),null);
const corrected=normalizeBet({betId:'buffalo',market:'spread',selection:'Buffalo',gameText:'Buffalo vs College opponent',league:'NCAA',sport:'College'},scores,{sport:'NFL',league:'NFL',espnEventId:'bills',awayTeam:'Buffalo Bills',homeTeam:'NFL opponent'});
assert.equal(corrected.espnEventId,'bulls');assert.equal(corrected.awayTeam,'Buffalo Bulls');
const collegiateCSV=csv({bet_id:'buffalo',type:'Spread',description:'335 Buffalo +20.5 -110',game_text:'Buffalo vs College opponent',market:'spread',selection:'Buffalo',line:'20.5',status:'PENDING',to_win:'36.36',extraction_error:''}).split('\n').map((line,i)=>line+(i?',"College","NCAA"':',sport,league')).join('\n');
const repaired=makePlan(collegiateCSV,[{week:'2026-10-06',scores,bets:[{betId:'buffalo',sport:'NFL',league:'NFL',espnEventId:'bills',awayTeam:'Buffalo Bills',homeTeam:'NFL opponent'}]}]);
assert.equal(repaired.summary.review,0);assert.equal(repaired.items[0].after.espnEventId,'bulls');assert.equal(repaired.items[0].after.league,'NCAA');
console.log('PASS NCAA-only matching, cross-league ambiguity, stale NFL match repair and CSV league preservation');
for(const line of [27.5,28.5]){
 const sgp=csv({type:'Same Game Parlay',description:'Dallas Cowboys v Tampa Bay Buccaneers',market:'same game parlay',extraction_error:'',leg_count:'2',legs_json:JSON.stringify([{market:'moneyline',selection:'Cowboys'},{market:'unknown',selection:'Team points - Cowboys Over '+line,raw:'Team points - Cowboys Over '+line,line:null}])});
 const p=makePlan(sgp,[],{'team-total-1':'2026-10-06'});assert.equal(p.summary.review,0);const leg=p.items[0].after.legs[1];assert.equal(leg.market,'team_total');assert.equal(leg.selection,'Cowboys');assert.equal(leg.side,'over');assert.equal(leg.line,line);
}
const unsupported=csv({type:'Same Game Parlay',extraction_error:'',leg_count:'2',legs_json:JSON.stringify([{market:'moneyline',selection:'Cowboys'},{market:'unknown',raw:'Unsupported market'}])});
assert.match(makePlan(unsupported,[],{'team-total-1':'2026-10-06'}).items[0].reason,/Unrecognized wager leg/);
console.log('PASS SGP team-points import recovery and unrecognized-leg warning');
