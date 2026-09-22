/* Football Score App UI enhancements. */
function betFirstKickoff(b){
  var times=[];
  (b.legs||[]).forEach(function(l){var g=legGame(l,b);if(g&&g.date)times.push(Date.parse(g.date)||0);else ['eventStart','startTime','gameDate','eventDate'].some(function(k){var t=Date.parse(l[k]||0)||0;if(t){times.push(t);return true}return false})});
  var g=findGame(b);if(g&&g.date)times.push(Date.parse(g.date)||0);
  times=times.filter(Boolean);return times.length?Math.min.apply(null,times):(Date.parse(b.acceptedDate||0)||0);
}
function sortBets(a,b){var sa=stateOrder(a),sb=stateOrder(b);if(sa!==sb)return sa-sb;return betFirstKickoff(a)-betFirstKickoff(b)}
function gameNetwork(g){var out=[];(comp(g).broadcasts||[]).forEach(function(b){(b.names||[]).forEach(function(n){if(n&&out.indexOf(n)<0)out.push(n)})});return out.join(' / ')}
function compactBetLine(item,g,sp){
  if(!item.awayTeam||!item.homeTeam)return esc(item.description||item.selection||item.raw||item.rawWager||'Wager');
  var t=g?teams(g):{},away=betTeamHtml(t.away,item.awayTeam,sp),home=betTeamHtml(t.home,item.homeTeam,sp),line=item.line!=null?Number(item.line):null;
  if(item.market==='spread'){
    var pickAway=t.away&&teamMatches(t.away,item.selection),pick=pickAway?away:home,opp=pickAway?home:away;
    return '<span class="compact-pick">'+pick+(line!=null?' '+(line>0?'+':'')+line:'')+' <span class="pick-word">over</span> '+opp+'</span>';
  }
  if(item.market==='total')return '<span class="compact-pick">'+away+' <span class="pick-word">vs</span> '+home+' · '+esc(item.selection||'Total')+(line!=null?' '+line:'')+'</span>';
  return esc(item.description||item.selection||item.raw||item.rawWager||'Wager');
}
function legHtml(l,b){
  var st=legDisplayStatus(l,b),g=legGame(l,b),h=itemHealth(l,g),pe=l.market==='player_prop'?propEval(l,g):null,stat=pe&&pe.value!=null?' · '+pe.value+(pe.target!=null?' / '+pe.target:''):'';
  var label=st==='won'?'Won':st==='lost'?'Lost':st==='push'?'Push':st==='live'?'Live':'Upcoming';h=st==='won'?5:st==='lost'?1:st==='push'?null:h;
  var primary=l.market==='player_prop'?esc(l.description||l.selection||l.raw||'Prop'):compactBetLine(l,g,l.sport||b.sport);
  var matchup=l.market==='player_prop'&&l.awayTeam&&l.homeTeam?'<div class="leg-matchup">'+betMatchupHtml(Object.assign({sport:b.sport},l),g)+'</div>':'';
  var meta=[shortScore(g),g?gameDetail(g):'Upcoming',gameNetwork(g)].filter(Boolean).filter(function(v,i,a){return a.indexOf(v)===i}).join(' · ');
  return '<div class="leg"><div><div class="legmain">'+primary+'</div>'+matchup+'<div class="legsub">'+esc(meta)+stat+'</div>'+gamecastLink(l.sport||b.sport,l.espnEventId||b.espnEventId)+'</div><div class="status-pack">'+healthHtml(h)+'<span class="legstatus '+st+'">'+label+'</span></div></div>';
}
function betCard(b){
  var g=findGame(b),gid=betGameId(b),hasLegs=Array.isArray(b.legs)&&b.legs.length,id='m'+String(b.betId).replace(/[^a-zA-Z0-9]/g,''),legsId='l'+String(b.betId).replace(/[^a-zA-Z0-9]/g,'');
  var title=hasLegs?esc(b.description||(b.structure==='teaser'?'Teaser':b.structure==='same_game_parlay'?'Same Game Parlay':'Parlay')):(b.market==='player_prop'?esc(b.description||b.selection||b.rawWager||'Player prop'):compactBetLine(b,g,b.sport));
  var propMatch=!hasLegs&&b.market==='player_prop'?betMatchupHtml(b,g):'',money=b.risk!=null?'$'+Number(b.risk).toFixed(0)+(b.toWin!=null?' → $'+Number(b.toWin).toFixed(2):''):'';
  var scoreText=g?[gameDetail(g),gameNetwork(g)].filter(Boolean).filter(function(v,i,a){return a.indexOf(v)===i}).join(' · '):(hasLegs?'Linked games':'No ESPN match yet');
  var r=authoritativeResult(b),health=r==='won'?5:r==='lost'?1:r?null:hasLegs?parlayHealth(b):itemHealth(b,g);
  return '<div class="card '+(betState(b,g)==='live'?'live':'')+'" data-gameid="'+gid+'"><div class="top"><div><b>'+title+'</b>'+(propMatch?'<div class="prop-matchup">'+propMatch+'</div>':'')+'<div class="sub">'+(b.sport||'Other')+' · '+String(b.structure||'straight').replace(/_/g,' ')+'</div></div><div class="status-pack">'+healthHtml(health)+'<button class="status-button" aria-label="Change wager status" onclick="toggleM(\''+id+'\')">'+pill(b,g)+'</button></div></div>'+(money?'<div class="money">'+money+'</div>':'')+liveBetContext(g)+'<div class="game-clock-row">'+(gid?'<div class="scorelink" onclick="goToGame(\''+gid+'\')">'+esc(scoreText)+'</div>':'<div class="scorelink">'+esc(scoreText)+'</div>')+(b.espnEventId?gamecastLink(b.sport,b.espnEventId):'')+'</div>'+(hasLegs?'<button class="expand" onclick="toggleLegs(\''+legsId+'\')">Show '+b.legs.length+' legs</button><div class="legs" id="'+legsId+'">'+b.legs.map(function(l){return legHtml(l,b)}).join('')+'</div>':'')+'<div class="manual" id="'+id+'"><button onclick="setOv(\''+b.betId+'\',\'won\')">Won</button><button onclick="setOv(\''+b.betId+'\',\'lost\')">Lost</button><button onclick="setOv(\''+b.betId+'\',\'push\')">Push</button><button onclick="setOv(\''+b.betId+'\',\'auto\')">Auto</button></div></div>';
}
var enhancementStyle=document.createElement('style');enhancementStyle.textContent='.scorelink{text-decoration:none;font-size:13px;color:#b8d4e8}.situation{font-size:13px;font-weight:400;color:#b8d4e8}.game-clock-row .state{font-size:13px;color:#b8d4e8}.compact-pick{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.compact-pick .bet-team{font-weight:800}.pick-word{font-weight:500;color:var(--muted);font-size:11px}.prop-matchup{margin-top:5px}.gamecast:hover{text-decoration:none}';document.head.appendChild(enhancementStyle);
renderAll();
