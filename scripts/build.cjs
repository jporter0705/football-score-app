const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const assets = ['index.html','import.html','enhancements.js','weeks.js','sw.js','manifest.webmanifest','icon-192.png','icon-512.png'];
// Netlify can leave metadata from a prior build in the publish folder. Build a
// clean directory each time so only the explicitly listed public assets ship.
fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output, {recursive:true});
for (const name of assets) fs.copyFileSync(path.join(root,name),path.join(output,name));
const imports = path.join(root,'imports');
if (fs.existsSync(imports)) fs.cpSync(imports,path.join(output,'imports'),{recursive:true});

// Production-only UI overrides. Keeping these small transforms here avoids
// rewriting the large single-file app when making focused display/sort fixes.
const indexPath = path.join(output,'index.html');
let html = fs.readFileSync(indexPath,'utf8');
const overrides = `
function legRequirement(l){
  var sel=l.selection||l.player||l.raw||'Leg',p=l.player||sel;
  if(l.market==='moneyline')return sel+' — Moneyline';
  if(l.market==='player_prop'&&l.propType==='anytime_td')return p+' — Anytime TD';
  if(l.market==='player_prop'&&l.propType==='passing_interceptions')return p+' — '+(l.line!=null?Math.floor(Number(l.line)+1)+'+ ':'')+'Pass INT';
  if(l.market==='spread'&&l.line!=null)return sel+' '+(Number(l.line)>0?'+':'')+l.line;
  if(l.market==='total'&&l.line!=null)return sel+' '+l.line;
  return l.raw||sel;
}
function legHtml(l,b){
  var st=legDisplayStatus(l,b),g=legGame(l,b),game=l.awayTeam&&l.homeTeam?l.awayTeam+' at '+l.homeTeam:'',detail=g?gameDetail(g):'Upcoming',h=itemHealth(l,g),pe=l.market==='player_prop'?propEval(l,g):null,stat=pe&&pe.value!=null?' · '+pe.value+(pe.target!=null?' / '+pe.target:''):'';
  var label=st==='won'?'Won':st==='lost'?'Lost':st==='push'?'Push':st==='live'?'Live':'Upcoming';h=st==='won'?5:st==='lost'?1:st==='push'?null:h;
  return '<div class="leg"><div><div class="legmain">'+esc(legRequirement(l))+'</div>'+(game?'<div class="leg-matchup">'+betMatchupHtml(Object.assign({sport:b.sport},l),g)+'</div>':'')+'<div class="legsub">'+esc([shortScore(g),detail].filter(Boolean).join(' · '))+stat+'</div>'+gamecastLink(l.sport||b.sport,l.espnEventId||b.espnEventId)+'</div><div class="status-pack">'+healthHtml(h)+'<span class="legstatus '+st+'">'+label+'</span></div></div>';
}
function betGames(b){
  var out=[],seen={};function add(g){if(g&&!seen[String(g.id)]){seen[String(g.id)]=1;out.push(g)}}add(findGame(b));(b.legs||[]).forEach(function(l){add(legGame(l,b))});return out;
}
function betKickoff(b){var gs=betGames(b),ts=gs.map(function(g){return Date.parse(g.date||0)||0}).filter(Boolean);return ts.length?Math.min.apply(null,ts):0}
function betGameKey(b){var gs=betGames(b).sort(function(a,c){var ad=Date.parse(a.date||0)||0,cd=Date.parse(c.date||0)||0;return ad-cd||String(a.id).localeCompare(String(c.id))});return gs.length?String(gs[0].id):String(b.espnEventId||'~')}
function sortBets(a,b){
  var sa=stateOrder(a),sb=stateOrder(b);if(sa!==sb)return sa-sb;
  if(sa===0){var ga=findGame(a),gb=findGame(b),pa=ga?Number(comp(ga).status&&comp(ga).status.period||0):0,pb=gb?Number(comp(gb).status&&comp(gb).status.period||0):0;if(pa!==pb)return pb-pa}
  if(sa===1){var ta=betKickoff(a),tb=betKickoff(b);if(ta!==tb)return (ta||Infinity)-(tb||Infinity);var ka=betGameKey(a),kb=betGameKey(b);if(ka!==kb)return ka.localeCompare(kb);return String(a.betId||'').localeCompare(String(b.betId||''))}
  var da=Date.parse(a.gradedDate||a.acceptedDate||0)||0,db=Date.parse(b.gradedDate||b.acceptedDate||0)||0;return sa===2?db-da:da-db;
}
`;
const marker='</script>';
const pos=html.lastIndexOf(marker);
if(pos<0) throw new Error('index.html script marker not found');
html=html.slice(0,pos)+overrides+html.slice(pos);
fs.writeFileSync(indexPath,html);
console.log('Built app: '+assets.length+' public assets plus named imports and UI overrides.');
