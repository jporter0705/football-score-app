import assert from 'node:assert/strict';
import {makePlan} from './netlify/functions/_csv-plan.mjs';
const headers=['bet_id','accepted_date','type','description','market','selection','side','line','period','risk','to_win','status','leg_count','legs_json','extraction_error'];
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
