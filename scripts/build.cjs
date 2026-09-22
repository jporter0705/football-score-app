const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const assets = ['index.html','import.html','enhancements.js','weeks.js','sw.js','manifest.webmanifest','icon-192.png','icon-512.png'];
fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output, {recursive:true});
for (const name of assets) fs.copyFileSync(path.join(root,name),path.join(output,name));
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

// ESPN competitors wrap school metadata under competitor.team. Normalize against that object.
function canonicalTeamMatch(c,name){
  var t=c&&c.team?c.team:c||{},vals=[t.location,t.displayName,t.shortDisplayName,t.name,t.abbreviation].filter(Boolean),target=schoolNameVariants(name);
  for(var i=0;i<vals.length;i++){var vv=schoolNameVariants(vals[i]);for(var a=0;a<vv.length;a++)for(var b=0;b<target.length;b++)if(vv[a]===target[b])return true}
  return false;
}

// Prefer the imported sport, but if that metadata is wrong, safely recover from the other ESPN pool.
// Only exactMatchGame results are accepted, so canonical fallback still has to resolve to one matchup.
function resolveAcrossPools(item,preferredSport){
  var preferred=eventPoolForSport(preferredSport),g=exactMatchGame(preferred,item);if(g)return{game:g,sport:preferredSport};
  var other=preferredSport==='NFL'?S.collegeAll:S.nfl,otherSport=preferredSport==='NFL'?'College':'NFL',alt=exactMatchGame(other,item);
  return alt?{game:alt,sport:otherSport}:null;
}
function findGame(b){
  var r=resolveAcrossPools(b,b.sport||'College');
  if(r&&b.sport!==r.sport)b.sport=r.sport;
  return r?r.game:null;
}
function legGame(leg,parent){
  var sp=leg.sport||parent.sport||'College',item=Object.assign({sport:sp},leg);
  if(!item.espnEventId&&parent.structure==='same_game_parlay')item.espnEventId=parent.espnEventId;
  var r=resolveAcrossPools(item,sp);
  if(r&&leg.sport&&leg.sport!==r.sport)leg.sport=r.sport;
  return r?r.game:null;
}
function itemMatchesEvent(item,parent,e,sp){var id=resolvedEventId(item,parent);return id?String(id)===String(e.id):false}

function betGames(b){var out=[],seen={};function add(g){if(g&&!seen[String(g.id)]){seen[String(g.id)]=1;out.push(g)}}add(findGame(b));(b.legs||[]).forEach(function(l){add(legGame(l,b))});return out}
function betKickoff(b){var gs=betGames(b),ts=gs.map(function(g){return Date.parse(g.date||0)||0}).filter(Boolean);return ts.length?Math.min.apply(null,ts):0}
function betGameKey(b){var gs=betGames(b).sort(function(a,c){var ad=Date.parse(a.date||0)||0,cd=Date.parse(c.date||0)||0;return ad-cd||String(a.id).localeCompare(String(c.id))});return gs.length?String(gs[0].id):String(b.espnEventId||'~')}
function sortBets(a,b){
  var sa=stateOrder(a),sb=stateOrder(b);if(sa!==sb)return sa-sb;
  if(sa===0){var ga=findGame(a),gb=findGame(b),pa=ga?Number(comp(ga).status&&comp(ga).status.period||0):0,pb=gb?Number(comp(gb).status&&comp(gb).status.period||0):0;if(pa!==pb)return pb-pa}
  if(sa===1){var ta=betKickoff(a),tb=betKickoff(b);if(ta!==tb)return (ta||Infinity)-(tb||Infinity);var ka=betGameKey(a),kb=betGameKey(b);if(ka!==kb)return ka.localeCompare(kb);return String(a.betId||'').localeCompare(String(b.betId||''))}
  var da=Date.parse(a.gradedDate||a.acceptedDate||0)||0,db=Date.parse(b.gradedDate||b.acceptedDate||0)||0;return sa===2?db-da:da-db;
}
</script>`;

// Enhancements are explicit production dependencies. The compatibility layer follows them so shared resolvers win.
html = html.replace('</body>','<script src="/enhancements.js?v=4.7.5"></script>'+overrides+'</body>');
fs.writeFileSync(indexPath,html);
console.log('Built app: '+assets.length+' public assets plus named imports and integrated UI enhancements.');
