const assert=require('node:assert/strict'),{ctx}=require('./test-support-browser.cjs')();
const g={id:'td',competitions:[{status:{type:{state:'post'}},competitors:[{team:{id:'kc'}}]}]};
function group(name,key,rows){return{name,keys:[key],labels:['TD'],athletes:rows.map(([displayName,value])=>({athlete:{displayName},stats:[value]}))}}
const summary={boxscore:{players:[{team:{id:'kc'},statistics:[
  group('rushing','rushingTouchdowns',[['Kenneth Walker III','1'],['Patrick Mahomes','0']]),
  group('receiving','receivingTouchdowns',[['Travis Kelce','1'],['Kenneth Walker III','1'],['Noah Gray','0']]),
  group('passing','passingTouchdowns',[['Patrick Mahomes','2']])
]}]}},base={sport:'NFL',market:'player_prop',espnEventId:'td',propType:'anytime_td',line:.5};
ctx.S.summaries['NFL:td']=summary;
const grade=(player,extra={})=>ctx.propEval({...base,player,...extra},g);
assert.equal(grade('T. Kelce').status,'won');assert.equal(grade('Kenneth Walker III').value,2);
assert.equal(grade('Kenneth Walker III',{propType:'rushing_tds_gte',line:1}).value,1);
assert.equal(grade('Kenneth Walker III',{propType:'receiving_tds_gte',line:1}).value,1);
assert.equal(grade('Kenneth Walker III',{propType:'total_tds_gte',line:2}).status,'won');
assert.equal(grade('Patrick Mahomes').status,'lost','passing TDs are not TDs scored');
assert.equal(grade('Patrick Mahomes',{propType:'passing_tds_gte',line:2}).status,'won');
assert.equal(grade('Noah Gray').status,'lost','explicit zero in completed boxscore');
assert.equal(grade('Travis Kelce',{propType:'receiving_tds',side:'under',line:1.5}).status,'won');
assert.equal(grade('Travis Kelce',{propType:'rushing_tds_gte',line:1}).status,'unavailable','missing category is not a known zero');
summary.boxscore.players[0].statistics[1].athletes[0].stats=['--'];
assert.equal(grade('T. Kelce').status,'unavailable','unreadable TD column never becomes zero');
delete ctx.S.summaries['NFL:td'];assert.equal(grade('T. Kelce').status,'unavailable');
console.log('PASS boxscore TD scoring, initial names, combined TDs, category-specific TDs, passing exclusion, missing-data safeguards');
