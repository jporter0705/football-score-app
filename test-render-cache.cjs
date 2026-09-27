const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const build=fs.readFileSync('scripts/build.cjs','utf8'),start=build.indexOf('var matchupRenderCache=null;');
const patch=build.slice(start,build.indexOf('</script>`;',start));
let calls=0,found=null;const pool=[],other=[],item={awayTeam:'A',homeTeam:'B'};
const ctx={Map,JSON,exactMatchGame(){calls++;return found}};
function scan(){ctx.exactMatchGame(pool,item);ctx.exactMatchGame(pool,{...item});ctx.exactMatchGame(other,item)}
ctx.renderBets=scan;ctx.renderScoreboard=scan;ctx.renderAllGames=scan;
ctx.renderAll=()=>{ctx.renderScoreboard();ctx.renderBets();ctx.renderAllGames()};
let release;ctx.refreshSummaries=async()=>{scan();await new Promise(r=>release=r)};
vm.createContext(ctx);vm.runInContext(patch,ctx);
for(const method of ['renderAll','renderBets','renderScoreboard','renderAllGames']){
 calls=0;ctx[method]();assert.equal(calls,2,method+' caches misses and shares nested work');assert.equal(ctx.matchupRenderCache,null);
}
found={id:'new-game'};assert.equal(ctx.exactMatchGame(pool,item),found,'outside-render lookup stays fresh');
const pending=ctx.refreshSummaries();assert.equal(ctx.matchupRenderCache,null,'network waits cannot hold cache');
calls=0;ctx.renderBets();assert.equal(calls,2,'filters remain independently usable while loading');release();
ctx.uncachedRenderAll=()=>{throw Error('error')};
console.log('PASS direct filters, nested rendering, pool isolation, cache cleanup and pending summary request');
