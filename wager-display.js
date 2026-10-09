// Recover older exports too: the preview retained this text even when the market was unknown.
function teamPointsItem(item){
  var raw=String(item.raw||item.description||item.selection||'').replace(/½/g,'.5'),m=raw.match(/^Team (?:points|total)\s*-\s*(.+?)\s+(Over|Under)\s+(\d+(?:\.\d+)?)(?:\s*\(Game\))?$/i);
  return m?Object.assign({},item,{market:'team_total',selection:m[1].trim(),side:m[2].toLowerCase(),line:Number(m[3])}):item;
}
var beforeTeamTotalLine=compactBetLine;
compactBetLine=function(item,g,sp){item=teamPointsItem(item);if(item.market==='team_total')return esc(item.selection+' — Team total '+item.side+' '+item.line);if(item.market==='unknown')return esc(item.raw||item.selection||item.description||'Unrecognized wager');return beforeTeamTotalLine(item,g,sp)};
var beforeTeamTotalEval=evaluateMarket;
evaluateMarket=function(item,g){item=teamPointsItem(item);if(item.market!=='team_total')return beforeTeamTotalEval(item,g);
  if(!g)return {status:'pending',locked:false};
  var t=teams(g),away=exactTeam(t.away,item.selection),home=exactTeam(t.home,item.selection),line=Number(item.line),side=String(item.side||'').toLowerCase();
  if(item.matchIssue||away===home||item.line==null||item.line===''||!Number.isFinite(line)||!['over','under'].includes(side))return {status:'unavailable',locked:false};
  var value=(away?t.away:t.home).score,done=finalGame(g);
  if(!fullGameScope(item)){var e=periodEvidence(item,g);if(!e)return {status:'unavailable',locked:false};if(e.upcoming)return {status:'pending',locked:false};if(e.scope.last===4)return {status:'unavailable',locked:false};value=away?e.away:e.home;done=e.complete;}
  if(value==null||value===''||!Number.isFinite(Number(value)))return {status:'unavailable',locked:false};
  if(!done)return {status:gs(g)==='in'?'live':'pending',locked:false,value:Number(value),target:line};
  var diff=Number(value)-line;return {status:diff===0?'push':(side==='over'?diff>0:diff<0)?'won':'lost',locked:true,value:Number(value),target:line};
};
var beforeTeamTotalResult=result;
result=function(item,g){var auth=authoritativeResult(item);if(auth)return auth;var parsed=teamPointsItem(item);if(parsed.market!=='team_total')return beforeTeamTotalResult(item,g);var e=evaluateMarket(parsed,g);return e.locked?e.status:null};
// Evidence is informational; sportsbook settlements remain authoritative.
function gradingEvidence(item,g){
  item=teamPointsItem(item);
  if(!g)return 'Score/stat detail unavailable — game not matched';
  if(item.matchIssue)return 'Score/stat detail unavailable — matchup needs review';
  if(isPlayerProp(item)){
    if(gs(g)==='pre'&&!finalGame(g))return 'Player stats available after kickoff';
    if(!fullGameScope(item))return 'Period-specific player stats unavailable';
    var e=propEval(item,g);return e.value==null?'Player stat unavailable':(finalGame(g)?'Final stat: ':'Current stat: ')+e.value+' · '+propRequirement(item);
  }
  var scope=trackedPeriod(item),t=teams(g),a=t.away&&t.away.score,h=t.home&&t.home.score,label=finalGame(g)?'Final':'Current score';
  if(!fullGameScope(item)){var evidence=periodEvidence(item,g);if(!evidence||evidence.upcoming)return 'Period score unavailable';a=evidence.away;h=evidence.home;label=evidence.scope.label+(evidence.complete?' final':' so far');if(evidence.scope.last===4)label+=' (regulation)'}
  if(a==null||h==null||a===''||h===''||!Number.isFinite(Number(a))||!Number.isFinite(Number(h)))return 'Score unavailable';
  function name(c){return c&&c.team&&(c.team.abbreviation||c.team.shortDisplayName||c.team.displayName)||'?'}
  var selected=exactTeam(t.away,item.selection)?a:exactTeam(t.home,item.selection)?h:null;
  return label+': '+name(t.away)+' '+a+' · '+name(t.home)+' '+h+(item.market==='total'?' · Total '+(Number(a)+Number(h)):item.market==='team_total'&&selected!=null?' · '+item.selection+' team points '+selected+' / '+item.side+' '+item.line:'');
}
function wagerBars(item,g){var e=(item.legs||[]).length?parlayPositionEstimate(item):positionEstimate(item,g);if(!e)return '';return '<span class="position-bars level-'+e.level+'" role="img" title="'+esc(e.label+' — '+e.reason)+'" aria-label="'+esc(e.label+' — position estimate, not a win probability')+'">'+[1,2,3,4,5].map(function(i){return '<i class="'+(i<=e.level?'filled':'')+'"></i>'}).join('')+'</span>'}
// Keep the familiar score/situation layout; no extra covering-margin commentary.
positionEstimateHtml=function(){return ''};
livePositionHtml=function(){return ''};
var evidenceBetCard=betCard;
betCard=function(b){var g=findGame(b),html=evidenceBetCard(b),closed=authoritativeResult(b),hasLegs=(b.legs||[]).length;
  if(!closed)html=html.replace('</button></div></div>','</button>'+wagerBars(b,g)+'</div></div>');
  if(!hasLegs&&(closed||finalGame(g)||isPlayerProp(b)||!fullGameScope(b)))html=html.replace('<div class="game-clock-row">','<div class="grading-evidence">'+esc(gradingEvidence(b,g))+'</div><div class="game-clock-row">');
  return html;
};
var evidenceOriginalLeg=legHtml;
legHtml=function(l,b){if(l.matchIssue||isPlayerProp(l)&&!playerGameEvidence(Object.assign({sport:b.sport},l),legGame(l,b)).verified)return evidenceOriginalLeg(l,b);var item=Object.assign({sport:b.sport},l),g=legGame(l,b),st=legDisplayStatus(l,b),closed=['won','lost','push'].includes(st),prop=isPlayerProp(item),title=prop?esc(propRequirement(item)):compactBetLine(item,g,item.sport),label={won:'Won',lost:'Lost',push:'Push',live:'Live',pending:'Upcoming',unavailable:'Review'}[st]||'Upcoming';
  var detail=closed||finalGame(g)||prop||!fullGameScope(item)?'<div class="grading-evidence">'+esc(gradingEvidence(item,g))+'</div>':'';
  return '<div class="leg"><div><div class="legmain">'+title+'</div>'+(prop?'<div class="legsub">'+betMatchupHtml(item,g)+'</div>':'')+detail+(!closed&&g?liveBetContext(g):'')+'<div class="legsub">'+esc(g?enhancedGameDetail(g):'Game not matched')+'</div>'+gamecastLink(item.sport,resolvedEventId(l,b))+'</div><div class="status-pack"><span class="legstatus '+st+'">'+label+'</span>'+(!closed?wagerBars(item,g):'')+'</div></div>';
};
