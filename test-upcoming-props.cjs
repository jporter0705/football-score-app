const assert=require('node:assert/strict'),{ctx}=require('./test-support-browser.cjs')();
function game(id,state){return {id,date:ctx.selectedWeek.start+'T17:00:00Z',competitions:[{status:{period:state==='pre'?0:2,displayClock:'10:00',type:{state,completed:state==='post'}},competitors:[{homeAway:'away',score:'7',team:{id:'dal',displayName:'Dallas Cowboys'}},{homeAway:'home',score:'0',team:{id:'tb',displayName:'Tampa Bay Buccaneers'}}]}]}}
const pre=game('pre','pre'),live=game('live','in'),post=game('post','post');ctx.S.nfl=[pre,live,post];
const dak={sport:'NFL',espnEventId:'pre',market:'player_prop',player:'D Prescott',propType:'passing_tds_gte',line:2},pickens={...dak,player:'George Pickens',propType:'anytime_td',line:.5};
const parent={sport:'NFL',structure:'same_game_parlay',legs:[dak,pickens]};
for(const summary of [undefined,{boxscore:{players:[]}}]){ctx.S.summaries['NFL:pre']=summary;for(const leg of parent.legs){assert.equal(ctx.legDisplayStatus(leg,parent),'pending');assert.equal(ctx.propEval(leg,pre).status,'pending');assert.match(ctx.legHtml(leg,parent),/>Upcoming</);assert.doesNotMatch(ctx.legHtml(leg,parent),/>Review</);}assert.equal(ctx.wagerBars(parent,pre),'');}
assert.equal(ctx.legDisplayStatus({...dak,matchIssue:'Wrong game'},parent),'unavailable');
assert.equal(ctx.legDisplayStatus({...dak,espnEventId:'missing'},parent),'unavailable');
assert.equal(ctx.legDisplayStatus({...dak,status:'WON'},parent),'won');
const ml={sport:'NFL',market:'moneyline',selection:'Dallas Cowboys',espnEventId:'pre'};
assert.equal(ctx.wagerBars({...parent,legs:[ml]},pre),'');
assert.match(ctx.wagerBars({...parent,legs:[ml,{...ml,espnEventId:'live'}]},pre),/position-bars/);
assert.match(ctx.wagerBars({...parent,legs:[ml,{...ml,status:'WON'}]},pre),/level-3/);
assert.equal(ctx.wagerBars({...parent,legs:[ml,{...ml,status:'LOST'}]},pre),'','Closed lost wagers have no forecast');
assert.equal(ctx.wagerBars(dak,pre),'');
ctx.S.summaries['NFL:live']={boxscore:{players:[{team:{id:'dal'},statistics:[{name:'passing',keys:['passingTouchdowns'],athletes:[{athlete:{id:'dak',displayName:'Dak Prescott'},stats:['2']}]},{name:'receiving',keys:['receivingTouchdowns'],athletes:[{athlete:{id:'gp',displayName:'George Pickens'},stats:['1']}]}]}]}};
assert.equal(ctx.propEval({...dak,espnEventId:'live'},live).value,2);
assert.equal(ctx.propEval({...pickens,espnEventId:'live'},live).value,1);
console.log('PASS upcoming props, missing pregame data, matching safeguards, TD box scores, and parlay bar start gate');
