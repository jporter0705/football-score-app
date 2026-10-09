/* Approved Midnight presentation. Matching and sportsbook grades stay in the shared modules. */
function displayTeamName(name){return String(name||'').replace(/\bState\b/g,'St.').replace(/\bUniversity\b/g,'Univ.').replace(/\bWestern\b/g,'W.').replace(/\bEastern\b/g,'E.').replace(/\bNorthern\b/g,'N.').replace(/\bSouthern\b/g,'S.')}
var midnightTeamHtml=betTeamHtml;
betTeamHtml=function(c,name,sp){return midnightTeamHtml(c,displayTeamName(name||c&&c.team&&(c.team.displayName||c.team.shortDisplayName)),sp)};
function midnightMatchup(g,sp){var t=teams(g);return '<span class="bet-matchup">'+betTeamHtml(t.away,null,sp)+'<span class="matchup-at">at</span>'+betTeamHtml(t.home,null,sp)+'</span>'}
function midnightGameDetails(g,sp){
  if(!g)return '<div class="sub unmatched">Game details unavailable · no ESPN match</div>';
  if(gs(g)==='pre')return '<div class="kickoff">'+esc(enhancedGameDetail(g))+'</div>';
  var t=teams(g),sit=comp(g).situation||{},poss=String(possessionCompetitorId(g)),live=gs(g)==='in';
  function side(c){var tm=c&&c.team||{},ball=live&&poss&&(poss===String(c&&c.id)||poss===String(tm.id));return (ball?'<span class="poss" role="img" aria-label="Possession">🏈</span> ':'')+esc(tm.abbreviation||displayTeamName(tm.shortDisplayName)||'Team')}
  var score='<div class="score-inset"><span>'+side(t.away)+'</span><b>'+esc(t.away&&t.away.score!=null?t.away.score:'—')+' – '+esc(t.home&&t.home.score!=null?t.home.score:'—')+'</b><span>'+side(t.home)+'</span></div>';
  var dd=sit.shortDownDistanceText||sit.downDistanceText||'',field=sit.possessionText||'',last=sit.lastPlay&&sit.lastPlay.text;
  if(live&&(dd||field||last))score+='<div class="live-detail-row"><span class="down-distance">'+esc(dd)+(field&&dd.indexOf(field)<0?' · '+esc(field):'')+'</span>'+(last?'<span class="lastplay">Last: '+esc(last)+'</span>':'')+'</div>';
  return score+'<div class="game-footer"><span class="game-clock">'+esc(gameClock(g))+'</span><span class="watch-links"><span>'+esc(gameNetwork(g))+'</span>'+gamecastLink(sp,g.id)+'</span></div>';
}
gameCard=function(g,sp){var key=sp+':'+g.id,linked=betsFor(g,sp).length;return '<div class="game '+(gs(g)==='in'?'live':'')+'" data-scoregame="'+esc(g.id)+'"><div class="gh"><div><div class="sub">'+(sp==='nfl'?'NFL':'College')+'</div><b>'+midnightMatchup(g,sp)+'</b></div><div class="game-actions"><button class="star '+(favs.has(key)?'on':'')+'" aria-label="'+(favs.has(key)?'Unstar game':'Star game')+'" data-key="'+esc(key)+'">'+(favs.has(key)?'★':'☆')+'</button><span class="pill '+(gs(g)==='in'?'livepill':'')+'">'+(gs(g)==='in'?'Live':gs(g)==='post'?'Final':'Upcoming')+'</span></div></div>'+midnightGameDetails(g,sp)+(linked?'<button class="bet-linked" onclick="goToBetsForGame(\''+esc(g.id)+'\')">'+linked+' bet'+(linked===1?'':'s')+' · view wagers</button>':'')+'</div>'};
function midnightLegTeam(item,g){
  if(!g)return null;var t=teams(g),candidates=[t.away,t.home].filter(Boolean);
  var named=item.playerTeam||item.teamName||item.team||(!isPlayerProp(item)?item.selection:'');
  var matched=candidates.filter(function(c){return named&&canonicalTeamMatch(c,named)});if(matched.length===1)return matched[0];
  if(!isPlayerProp(item))return null;
  var sum=summaryFor(g.id,item.sport),ids=[];
  ((sum&&sum.boxscore&&sum.boxscore.players)||[]).forEach(function(group){(group.statistics||[]).forEach(function(cat){(cat.athletes||[]).forEach(function(a){if(playerNameMatches(a.athlete&&a.athlete.displayName,item.player))ids.push(String(group.team&&group.team.id))})})});
  ((sum&&sum.rosters)||[]).forEach(function(group){(group.roster||[]).forEach(function(a){if(playerNameMatches(a.athlete&&a.athlete.displayName,item.player))ids.push(String(group.team&&group.team.id))})});
  matched=candidates.filter(function(c){return ids.includes(String(c.team&&c.team.id))});return matched.length===1?matched[0]:null;
}
legHtml=function(l,b){var item=teamPointsItem(Object.assign({sport:b.sport},l)),g=legGame(l,b),st=legDisplayStatus(l,b),closed=['won','lost','push'].includes(st),team=midnightLegTeam(item,g),label={won:'Won',lost:'Lost',push:'Push',live:'Live',pending:'Upcoming',unavailable:'Review'}[st]||'Upcoming';
  var verification=isPlayerProp(item)?playerGameEvidence(item,g):null,evidence=verification&&!verification.verified&&gs(g)!=='pre'?verification.issue:gradingEvidence(item,g);
  if(item.matchIssue)evidence=item.matchIssue;
  var requirement=isPlayerProp(item)?propRequirement(item):item.market==='team_total'?item.selection+' — Team total '+item.side+' '+item.line:legRequirement(item);
  if(!fullGameScope(item)){var scope=trackedPeriod(item);if(scope&&scope.label)requirement+=' · '+scope.label;}
  var logo=team&&team.team&&team.team.logo?'<img class="logo" alt="'+esc(team.team.displayName||'Team')+'" src="'+esc(team.team.logo)+'">':'';
  return '<div class="leg"><div><div class="legmain">'+logo+'<span>'+esc(requirement)+'</span></div>'+((closed||isPlayerProp(item)||!fullGameScope(item))?'<div class="grading-evidence">'+esc(evidence)+'</div>':'')+midnightGameDetails(g,item.sport)+'</div><div class="status-pack"><span class="legstatus '+st+'">'+label+'</span>'+(!closed?wagerBars(item,g):'')+'</div></div>';
};
betCard=function(b){var g=findGame(b),hasLegs=(b.legs||[]).length,closed=authoritativeResult(b)||parlayAutoResult(b)||result(b,g),id='m'+String(b.betId).replace(/[^a-zA-Z0-9]/g,''),legsId='l'+String(b.betId).replace(/[^a-zA-Z0-9]/g,'');
  var linked=hasLegs?sortedLegs(b).map(function(l){return legGame(l,b)}).filter(Boolean):[],common=linked.length&&linked.every(function(x){return String(x.id)===String(linked[0].id)})?linked[0]:null;
  if(!g&&common)g=common;
  var title=hasLegs?(g?midnightMatchup(g,b.sport):esc(displayBetType(b))):compactBetLine(b,g,b.sport),prop=isPlayerProp(b)&&!hasLegs;
  var pick=prop?'<div class="pick">'+esc(propRequirement(b))+'</div>':'';
  var evidence=!hasLegs&&(closed||finalGame(g)||prop||!fullGameScope(b))?'<div class="grading-evidence">'+esc(gradingEvidence(b,g))+'</div>':'';
  var html='<div class="card '+(betState(b,g)==='live'?'live':'')+'" data-gameid="'+esc(g&&g.id||betGameId(b))+'"><div class="top"><div><b>'+title+'</b><div class="sub">'+esc(b.sport||'Other')+' · '+esc(displayBetType(b))+'</div></div><div class="status-pack"><button class="status-button" aria-label="Change wager status" onclick="toggleM(\''+id+'\')">'+pill(b,g)+'</button>'+(!closed?wagerBars(b,g):'')+'</div></div>'+pick+'<div class="money">'+resultsMoney(Number(b.risk||0))+' risk → '+resultsMoney(Number(b.toWin||0))+' to win</div>'+midnightGameDetails(g,b.sport)+evidence+(hasLegs?'<button class="expand" aria-controls="'+legsId+'" onclick="toggleLegs(\''+legsId+'\')">'+hasLegs+' legs</button><div class="legs" id="'+legsId+'">'+sortedLegs(b).map(function(l){return legHtml(l,b)}).join('')+'</div>':'')+'<div class="manual" id="'+id+'">'+['won','lost','push','auto'].map(function(s){return '<button onclick="setOv(\''+esc(b.betId)+'\',\''+s+'\')">'+s.charAt(0).toUpperCase()+s.slice(1)+'</button>'}).join('')+'</div></div>';
  if(!canManualGrade(b,g))html=html.replace(/<button class="status-button"[^>]*>([\s\S]*?)<\/button>/,'<span>$1</span>').replace(/<div class="manual"[\s\S]*?<\/div>/,'');
  return html;
};
var midnightPill=pill; pill=function(b,g){return midnightPill(b,g).replace(/>WON/i,'><span aria-hidden="true">✓</span> Won').replace(/>LOST/i,'><span aria-hidden="true">✕</span> Lost')};
var midnightRenderBets=renderBets;
renderBets=function(){midnightRenderBets();var root=document.querySelector('#bets .summary');if(!root)return;var rows=S.bets.filter(function(b){return betSport==='all'||(betSport==='nfl'?b.sport==='NFL':b.sport==='College')}),a={w:0,l:0,p:0,net:0,open:0,risk:0,win:0};rows.forEach(function(b){var r=authoritativeResult(b)||parlayAutoResult(b)||result(b,findGame(b));if(r==='won'){a.w++;a.net+=profit(b)}else if(r==='lost'){a.l++;a.net-=Number(b.risk||0)}else if(r==='push')a.p++;else{a.open++;a.risk+=Number(b.risk||0);a.win+=Number(b.toWin||0)}});root.innerHTML='<div class="metric"><span>Total bets</span><b>'+rows.length+'</b><small>'+a.w+'–'+a.l+'–'+a.p+'</small></div><div class="metric"><span>Open bets</span><b>'+a.open+'</b><small>still in play</small></div><div class="metric '+(a.net>=0?'positive':'negative')+'"><span>Settled P/L</span><b>'+resultsMoney(a.net,true)+'</b></div><div class="metric exposure"><span>Open exposure</span><div><strong>'+resultsMoney(a.risk)+'</strong> at risk</div><div>to win <strong>'+resultsMoney(a.win)+'</strong></div></div>'};
var midnightTabs=renderTabs;renderTabs=function(){midnightTabs();['betImport','betLogout'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display=tab==='bets'?'':'none'});if(tab==='results')document.getElementById('toolbar').style.display='none';var view=document.getElementById(tab);if(view){view.classList.toggle('midnight-enter',true);setTimeout(function(){view.classList.toggle('midnight-enter',false)},1200)}};
renderAll();renderTabs();
