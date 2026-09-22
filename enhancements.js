/* Football Score App UI enhancements. */
function betFirstKickoff(b){
  var times=[];
  (b.legs||[]).forEach(function(l){var g=legGame(l,b);if(g&&g.date)times.push(Date.parse(g.date)||0);else ['eventStart','startTime','gameDate','eventDate'].some(function(k){var t=Date.parse(l[k]||0)||0;if(t){times.push(t);return true}return false})});
  var g=findGame(b);if(g&&g.date)times.push(Date.parse(g.date)||0);
  times=times.filter(Boolean);return times.length?Math.min.apply(null,times):(Date.parse(b.acceptedDate||0)||0);
}
function sortBets(a,b){var sa=stateOrder(a),sb=stateOrder(b);if(sa!==sb)return sa-sb;return betFirstKickoff(a)-betFirstKickoff(b)}
function gameNetwork(g){var out=[];(comp(g).broadcasts||[]).forEach(function(b){(b.names||[]).forEach(function(n){if(n&&out.indexOf(n)<0)out.push(n)})});return out.join(' / ')}
function isPlayerProp(x){
  if(!x)return false;if(x.market==='player_prop')return true;
  var s=[x.description,x.selection,x.raw,x.rawWager].filter(Boolean).join(' ').toLowerCase();
  return /\b(anytime|touchdown|td scorer|receptions?|receiving|rushing|passing|yards?|completions?|attempts?|interceptions?|sacks?|carries|longest|player)\b/.test(s)&&!/\b(team total|game total)\b/.test(s);
}
function displayBetType(b){if(b.structure==='teaser')return 'teaser';if(b.structure==='parlay')return 'parlay';if(isPlayerProp(b))return 'prop';return String(b.structure||'straight').replace(/_/g,' ')}
function pickIsAway(item,t){
  if(t&&t.away&&teamMatches(t.away,item.selection))return true;
  if(t&&t.home&&teamMatches(t.home,item.selection))return false;
  var s=String(item.selection||item.description||item.raw||item.rawWager||'').toLowerCase();
  return item.awayTeam&&s.indexOf(String(item.awayTeam).toLowerCase())>=0;
}
function compactBetLine(item,g,sp){
  if(!item.awayTeam||!item.homeTeam)return esc(item.description||item.selection||item.raw||item.rawWager||'Wager');
  var t=g?teams(g):{},away=betTeamHtml(t.away,item.awayTeam,sp),home=betTeamHtml(t.home,item.homeTeam,sp),line=item.line!=null?Number(item.line):null;
  if(item.market==='spread'||item.market==='moneyline'||item.market==='ml'){
    var pa=pickIsAway(item,t),pick=pa?away:home,opp=pa?home:away;
    var n=(item.market==='spread'&&line!=null&&line!==0)?' '+(line>0?'+':'')+line:'';
    return '<span class="compact-pick">'+pick+n+' <span class="pick-word">over</span> '+opp+'</span>';
  }
  if(item.market==='total')return '<span class="compact-pick">'+away+' <span class="pick-word">vs</span> '+home+' · '+esc(item.selection||'Total')+(line!=null?' '+line:'')+'</span>';
  return '<span class="compact-pick">'+away+' <span class="pick-word">at</span> '+home+'</span>';
}
function legHtml(l,b){
  var st=legDisplayStatus(l,b),g=legGame(l,b),h=itemHealth(l,g),prop=isPlayerProp(l),pe=prop?propEval(l,g):null,stat=pe&&pe.value!=null?' · '+pe.value+(pe.target!=null?' / '+pe.target:''):'';
  var label=st==='won'?'Won':st==='lost'?'Lost':st==='push'?'Push':st==='live'?'Live':'Upcoming';h=st==='won'?5:st==='lost'?1:st==='push'?null:h;
  var primary=prop?compactBetLine(l,g,l.sport||b.sport):compactBetLine(l,g,l.sport||b.sport);
  var propLine=prop?'<div class="leg-prop">'+esc(l.description||l.selection||l.raw||'Prop')+'</div>':'';
  var meta=[shortScore(g),g?gameDetail(g):'Upcoming',gameNetwork(g)].filter(Boolean).filter(function(v,i,a){return a.indexOf(v)===i}).join(' · ');
  return '<div class="leg"><div><div class="legmain">'+primary+'</div>'+propLine+'<div class="legsub">'+esc(meta)+stat+'</div>'+gamecastLink(l.sport||b.sport,l.espnEventId||b.espnEventId)+'</div><div class="status-pack">'+healthHtml(h)+'<span class="legstatus '+st+'">'+label+'</span></div></div>';
}
function betCard(b){
  var g=findGame(b),gid=betGameId(b),prop=isPlayerProp(b),hasLegs=Array.isArray(b.legs)&&b.legs.length;
  var id='m'+String(b.betId).replace(/[^a-zA-Z0-9]/g,''),legsId='l'+String(b.betId).replace(/[^a-zA-Z0-9]/g,'');
  var money=b.risk!=null?'$'+Number(b.risk).toFixed(0)+(b.toWin!=null?' → $'+Number(b.toWin).toFixed(2):''):'';
  var scoreText=g?gameDetail(g):(hasLegs?'View linked games':'No ESPN match yet');
  var closedResult=authoritativeResult(b)||parlayAutoResult(b)||result(b,g),health=closedResult==='won'?5:closedResult==='lost'?1:closedResult?null:hasLegs?parlayHealth(b):itemHealth(b,g);
  var title;
  if(hasLegs)title=esc(b.structure==='teaser'?'Teaser':b.structure==='parlay'?'Parlay':'Wager');
  else if(b.awayTeam&&b.homeTeam)title=compactBetLine(b,g,b.sport);
  else title=esc(b.description||b.selection||'Wager');
  var propLine=!hasLegs&&prop?'<div class="pick">'+esc(b.description||b.selection||b.raw||b.rawWager||'Prop')+'</div>':(!hasLegs&&b.awayTeam&&b.homeTeam?'':'<div class="pick">'+fmtPick(b)+'</div>');
  return '<div class="card '+(betState(b,g)==='live'?'live':'')+'" data-gameid="'+gid+'"><div class="top"><div><b>'+title+'</b><div class="sub">'+(b.sport||'Other')+' · '+displayBetType(b)+'</div></div><div class="status-pack">'+healthHtml(health)+'<button class="status-button" aria-label="Change wager status" onclick="toggleM(\''+id+'\')">'+pill(b,g)+'</button></div></div>'+propLine+(money?'<div class="money">'+money+'</div>':'')+liveBetContext(g)+'<div class="game-clock-row">'+(gid?'<div class="scorelink" onclick="goToGame(\''+gid+'\')">'+scoreText+'</div>':'<div class="scorelink">'+scoreText+'</div>')+(b.espnEventId?gamecastLink(b.sport,b.espnEventId):'')+'</div>'+(hasLegs?'<button class="expand" onclick="toggleLegs(\''+legsId+'\')">Show '+b.legs.length+' legs</button><div class="legs" id="'+legsId+'">'+b.legs.map(function(l){return legHtml(l,b)}).join('')+'</div>':'')+'<div class="manual" id="'+id+'"><button onclick="setOv(\''+b.betId+'\',\'won\')">Won</button><button onclick="setOv(\''+b.betId+'\',\'lost\')">Lost</button><button onclick="setOv(\''+b.betId+'\',\'push\')">Push</button><button onclick="setOv(\''+b.betId+'\',\'auto\')">Auto</button></div></div>';
}
var enhancementStyle=document.createElement('style');enhancementStyle.textContent='.scorelink{text-decoration:none;font-size:13px;color:#b8d4e8}.situation{font-size:13px;font-weight:400;color:#b8d4e8}.game-clock-row .state{font-size:13px;color:#b8d4e8}.compact-pick{display:inline-flex;flex-wrap:wrap;align-items:center;gap:5px}.compact-pick .bet-team{font-weight:800}.pick-word{font-weight:500;color:var(--muted);font-size:11px}.leg-prop{font-size:12px;font-weight:800;margin-top:4px}.gamecast:hover{text-decoration:none}';document.head.appendChild(enhancementStyle);
renderAll();
