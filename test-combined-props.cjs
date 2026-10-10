const assert=require('node:assert/strict'),{ctx}=require('./test-support-browser.cjs')();
const g={id:'combined',competitions:[{status:{period:2,type:{state:'in'}},competitors:[{team:{id:'a'}}]}]};
function group(name,keys,values){return{name,keys,athletes:[{athlete:{displayName:'Joe Runner'},stats:values}]};}
const stats=[group('rushing',['rushingYards','rushingTouchdowns'],['50','1']),group('receiving',['receivingYards','receivingTouchdowns'],['35','3']),group('passing',['passingTouchdowns'],['1'])];ctx.S.summaries['NFL:combined']={boxscore:{players:[{team:{id:'a'},statistics:stats}]}};
const item={sport:'NFL',market:'player_prop',player:'Joe Runner',espnEventId:'combined',propType:'rushing_receiving_yards',line:79.5,side:'over'};
assert.equal(ctx.propEval(item,g).value,85);assert.equal(ctx.propEval(item,g).locked,false,'Combined yards can decrease before final');g.competitions[0].status.type.state='post';assert.equal(ctx.propEval(item,g).status,'won');
const td={...item,propType:'passing_rushing_tds_gte',line:2};assert.equal(ctx.propEval(td,g).value,2,'Receiving TDs must not count for passing + rushing TDs');assert.equal(ctx.propEval(td,g).status,'won');assert.match(ctx.propRequirement(td),/2\+ Passing \+ rushing TDs/);
stats[0].athletes[0].stats=['--','1'];assert.equal(ctx.propEval(item,g).value,null);stats.pop();assert.equal(ctx.propEval(td,g).value,null,'Missing category must not become zero');console.log('PASS combined stats, category-specific TD sums, reversible yards, readable labels and missing-stat safeguards');
