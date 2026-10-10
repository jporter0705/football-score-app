const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const assets = ['index.html','team-matching.js','upload-bets.html','csv-import-ui.mjs','import.html','recovery.html','sgp-details.js','live-progress.js','position-estimates.js','wager-display.js','results.js','results.css','midnight-ui.js','midnight-ui.css','enhancements.js','weeks.js','sw.js','manifest.webmanifest','icon-192.png','icon-512.png'];
fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output, {recursive:true});
for (const name of assets.filter(n=>n!=='team-matching.js')) fs.copyFileSync(path.join(root,name),path.join(output,name));
fs.writeFileSync(path.join(output,'team-matching.js'),fs.readFileSync(path.join(root,'team-matching.mjs'),'utf8').replace('export default TeamMatching;',''));
const imports = path.join(root,'imports');
if (fs.existsSync(imports)) fs.cpSync(imports,path.join(output,'imports'),{recursive:true});

const indexPath = path.join(output,'index.html');
let html = fs.readFileSync(indexPath,'utf8');
const overrides = `<script>
function legRequirement(l){
  var sel=l.selection||l.player||l.raw||'Leg',p=l.player||sel;
  if(l.market==='moneyline')return sel+' — Moneyline';
  if(l.market==='player_prop'&&l.propType==='anytime_td')return p+' — Anytime TD';
  if(l.market==='player_prop'&&l.propType==='passing_interceptions')return p+' — '+(l.line!=null?Math.floor(Number(l.line)+1)+'+ ':'')+'Pass INT';
  if(l.market==='spread'&&l.line!=null)return sel+' '+(Number(l.line)>0?'+':'')+l.line;
  if(l.market==='total'&&l.line!=null)return sel+' '+l.line;
  return l.raw||sel;
}

// Never fall back from a declared college league into NFL (or vice versa).
function canonicalTeamMatch(c,name){var t=c&&c.team||c||{},sp=/~l:28~/.test(t.uid||'')?'NFL':'College';return TeamMatching.teamMatches(c,name,sp)}
function resolveAcrossPools(item,preferredSport){
  if(!item)return null;
  var sp=TeamMatching.sport(item.sport||item.league)||TeamMatching.sport(preferredSport);if(!sp)return null;
  var itemCache=matchupRenderCache&&matchupRenderCache.get(item),cacheKey=sp+':'+selectedWeek.start+':'+selectedWeek.end;
  if(itemCache&&itemCache.has(cacheKey))return itemCache.get(cacheKey);
  var scoped=Object.assign({},item,{sport:sp}),p=TeamMatching.pair(scoped);
  // Legacy records without an event date must be unique inside their selected game week.
  var bounds=TeamMatching.eventDay(scoped).provided?{requireStoredId:true}:{start:selectedWeek.start,end:selectedWeek.end,requireStoredId:true};
  var g=exactMatchGame(eventPoolForSport(sp),scoped,bounds),result=g?{game:g,sport:sp}:null;
  if(matchupRenderCache){if(!itemCache){itemCache=new Map();matchupRenderCache.set(item,itemCache)}itemCache.set(cacheKey,result)}return result;
}
function findGame(b){
  var r=resolveAcrossPools(b,b.sport||'College');
  if(r&&b.sport!==r.sport)b.sport=r.sport;
  return r?r.game:null;
}
function legGame(leg,parent){
  var sp=leg.sport||parent.sport||'College',inputCache=matchupRenderCache&&matchupRenderCache.get('legInputs'),byParent=inputCache&&inputCache.get(leg),item=byParent&&byParent.get(parent);
  if(!item){item=Object.assign({sport:sp},leg);if(matchupRenderCache){if(!inputCache){inputCache=new Map();matchupRenderCache.set('legInputs',inputCache)}if(!byParent){byParent=new Map();inputCache.set(leg,byParent)}byParent.set(parent,item)}}
  if(!item.espnEventId&&parent.structure==='same_game_parlay')item.espnEventId=parent.espnEventId;
  var r=resolveAcrossPools(item,sp);
  if(r&&leg.sport&&leg.sport!==r.sport)leg.sport=r.sport;
  return r?r.game:null;
}
function itemMatchesEvent(item,parent,e,sp){var declared=TeamMatching.sport(item.sport||item.league||(parent&&parent.sport)),requested=sp==='nfl'?'NFL':'College';if(declared&&declared!==requested)return false;var g=parent?legGame(item,parent):findGame(item);return !!g&&String(g.id)===String(e.id)}

function betGames(b){var out=[],seen={};function add(g){if(g&&!seen[String(g.id)]){seen[String(g.id)]=1;out.push(g)}}add(findGame(b));(b.legs||[]).forEach(function(l){add(legGame(l,b))});return out}
function betKickoff(b){var gs=betGames(b),ts=gs.map(function(g){return Date.parse(g.date||0)||0}).filter(Boolean);return ts.length?Math.min.apply(null,ts):0}
function betGameKey(b){var gs=betGames(b).sort(function(a,c){var ad=Date.parse(a.date||0)||0,cd=Date.parse(c.date||0)||0;return ad-cd||String(a.id).localeCompare(String(c.id))});return gs.length?String(gs[0].id):String(b.espnEventId||'~')}
function sortBets(a,b){
  var sa=stateOrder(a),sb=stateOrder(b);if(sa!==sb)return sa-sb;
  if(sa===0){var ga=findGame(a),gb=findGame(b),pa=ga?Number(comp(ga).status&&comp(ga).status.period||0):0,pb=gb?Number(comp(gb).status&&comp(gb).status.period||0):0;if(pa!==pb)return pb-pa}
  if(sa===1){var ta=betKickoff(a),tb=betKickoff(b);if(ta!==tb)return (ta||Infinity)-(tb||Infinity);var ka=betGameKey(a),kb=betGameKey(b);if(ka!==kb)return ka.localeCompare(kb);return String(a.betId||'').localeCompare(String(b.betId||''))}
  var da=Date.parse(a.gradedDate||a.acceptedDate||0)||0,db=Date.parse(b.gradedDate||b.acceptedDate||0)||0;return sa===2?db-da:da-db;
}

// Reuse matchup results within one synchronous render, including unmatched records.
// Each render gets a fresh cache so refreshed schedules and edited bets are respected.
var matchupRenderCache=null;
var uncachedExactMatchGame=exactMatchGame;
exactMatchGame=function(pool,item,options){
  if(!matchupRenderCache||!item)return uncachedExactMatchGame(pool,item,options);
  var cache=matchupRenderCache.get(pool);
  if(!cache){cache=new Map();matchupRenderCache.set(pool,cache)}
  var key=JSON.stringify([item.espnEventId||null,item.awayTeam||null,item.homeTeam||null,item.gameText||null,item.sport||null,item.league||null,item.eventDate||null,item.eventStart||null,item.gameDate||null,item.startTime||null,item.expandedText||null,item.raw||null,item.description||null,options||null]);
  if(cache.has(key))return cache.get(key);
  var result=uncachedExactMatchGame(pool,item,options);cache.set(key,result);return result;
};
var uncachedRenderAll=renderAll;
renderAll=function(){
  var previous=matchupRenderCache;matchupRenderCache=new Map();
  try{return uncachedRenderAll()}finally{matchupRenderCache=previous}
};
// Cache resolver work across every synchronous render entry point and summary scan.
// Nested renderers share the same cache; no results survive a render or data refresh.
function withMatchupRenderCache(fn){return function(){
  if(matchupRenderCache)return fn.apply(this,arguments);
  matchupRenderCache=new Map();
  try{return fn.apply(this,arguments)}finally{matchupRenderCache=null}
}}
renderAll=withMatchupRenderCache(uncachedRenderAll);
renderBets=withMatchupRenderCache(renderBets);
renderScoreboard=withMatchupRenderCache(renderScoreboard);
renderAllGames=withMatchupRenderCache(renderAllGames);
refreshSummaries=withMatchupRenderCache(refreshSummaries);

</script>`;

// Enhancements are explicit production dependencies. The compatibility layer follows them so shared resolvers win.
html = html.replace('</body>','<script src="/team-matching.js"></script><script src="/enhancements.js?v=4.7.5"></script>'+overrides+'<script src="/sgp-details.js"></script><script src="/live-progress.js"></script><script src="/position-estimates.js"></script><script src="/wager-display.js"></script><link rel="stylesheet" href="/results.css"><script src="/results.js"></script><link rel="stylesheet" href="/midnight-ui.css"><script src="/midnight-ui.js"></script></body>');
fs.writeFileSync(indexPath,html);
console.log('Built app: '+assets.length+' public assets plus named imports and integrated UI enhancements.');






