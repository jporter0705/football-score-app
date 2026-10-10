/* Player evidence comes from this game's ESPN response, never from a remembered roster. */
function playerNameMatches(a,b){
  function tokens(s){return String(s||'').toLowerCase().replace(/[.'’]/g,'').replace(/[^a-z0-9]+/g,' ').trim().split(' ')}
  var x=tokens(a),y=tokens(b);if(x.join(' ')===y.join(' '))return true;
  return x.length>1&&y.length>1&&x.slice(1).join(' ')===y.slice(1).join(' ')&&(x[0]===y[0]||x[0].length===1&&x[0]===y[0][0]||y[0].length===1&&y[0]===x[0][0]);
}
function playerGameEvidence(item,g){
  if(!isPlayerProp(item))return {verified:true};
  if(item.matchIssue)return {verified:false,issue:item.matchIssue};
  if(!g)return {verified:false,issue:'Game not matched'};
  var sum=summaryFor(g.id,item.sport),matches=[];
  if(!sum)return {verified:false,pending:true,issue:'Player verification pending'};
  var teamIds=(comp(g).competitors||[]).map(function(c){return String(c.team&&c.team.id||c.id||'')}).filter(Boolean);
  (sum.boxscore&&sum.boxscore.players||[]).forEach(function(t){if(teamIds.length&&teamIds.indexOf(String(t.team&&t.team.id))<0)return;(t.statistics||[]).forEach(function(group){(group.athletes||[]).forEach(function(a){if(playerNameMatches(a.athlete&&a.athlete.displayName,item.player))matches.push({name:a.athlete.displayName,key:String(t.team&&t.team.id||'')+':'+String(a.athlete.id||a.athlete.displayName)})})})});
  (sum.rosters||[]).forEach(function(t){if(teamIds.length&&teamIds.indexOf(String(t.team&&t.team.id))<0)return;(t.roster||[]).forEach(function(a){if(playerNameMatches(a.athlete&&a.athlete.displayName,item.player))matches.push({name:a.athlete.displayName,key:String(t.team&&t.team.id||'')+':'+String(a.athlete.id||a.athlete.displayName)})})});
  var names=Array.from(new Map(matches.map(function(m){return [m.key,m.name]})).values());return names.length===1?{verified:true,player:names[0]}:{verified:false,issue:'Player not verified for this game'};
}
function propRequirement(l){
  var player=l.player||l.selection||'Player',type=l.propType||l.prop_type||'',raw=l.raw||l.description||'';
  if(type==='anytime_td'||/score anytime|anytime td|score a touchdown/i.test(raw))return player+' — Score TD';
  var units={rushing_receiving_yards:'Rush + receiving yds',passing_rushing_tds_gte:'Passing + rushing TDs',rushing_yards:'Rushing yds',receiving_yards:'Receiving yds',passing_yards:'Passing yds',passing_tds:'Passing TDs',passing_tds_gte:'Passing TDs',rushing_tds:'Rushing TDs',rushing_tds_gte:'Rushing TDs',receiving_tds:'Receiving TDs',receiving_tds_gte:'Receiving TDs',total_tds:'Total TDs',total_tds_gte:'Total TDs',receptions:'Receptions',passing_interceptions:'Pass interceptions'};
  if(units[type]&&l.line!=null){var line=Number(l.line),under=/under/i.test(l.side||l.selection||'');var target=/_gte$/.test(type)||l.side==='gte'?line+'+':under?'Under '+line:Math.floor(line)+1+'+';return player+' — '+target+' '+units[type]}
  return raw.replace(/^Player (stats|TDs)\s*-\s*/i,'')||l.selection||'Prop';
}
var originalVerifiedPropEval=propEval;
propEval=function(item,g){var evidence=playerGameEvidence(item,g);if(!evidence.verified)return{status:g&&gs(g)==='in'?'live':'unavailable',locked:false,value:null,target:item.line};return originalVerifiedPropEval(Object.assign({},item,{player:evidence.player||item.player}),g)};
var originalEvidenceLegStatus=legDisplayStatus;
legDisplayStatus=function(l,b){if(bookResult({betOnlineStatus:l.status}))return originalEvidenceLegStatus(l,b);if(l.matchIssue)return 'unavailable';if(isPlayerProp(l)){var g=legGame(l,b),e=playerGameEvidence(Object.assign({sport:b.sport},l),g);if(g&&gs(g)==='pre'&&!finalGame(g))return 'pending';if(!e.verified&&!e.pending)return 'unavailable'}return originalEvidenceLegStatus(l,b)};
var originalDetailedLegHtml=legHtml;
legHtml=function(l,b){
  if(!isPlayerProp(l)&&!l.matchIssue)return originalDetailedLegHtml(l,b);
  var g=legGame(l,b),e=playerGameEvidence(Object.assign({sport:b.sport},l),g);if(l.matchIssue)e={verified:false,issue:l.matchIssue};
  var status=legDisplayStatus(l,b),label=status==='won'?'Won':status==='lost'?'Lost':status==='push'?'Push':status==='live'?'Live':status==='unavailable'?'Review':'Upcoming';
  var stat=e.verified?propEval(l,g):null,progress=stat&&stat.value!=null?' · '+stat.value+(stat.target!=null?' / '+stat.target:''):'';
  return '<div class="leg"><div><div class="legmain">'+esc(propRequirement(l))+'</div><div class="legsub">'+(e.verified?esc((g?enhancedGameDetail(g):'')+progress):esc(status==='pending'&&g?'Player stats available after kickoff':e.issue))+'</div>'+(e.verified?'<div class="legsub">'+betMatchupHtml(l,g)+'</div>'+gamecastLink(l.sport||b.sport,resolvedEventId(l,b)):'')+'</div><span class="legstatus '+status+'">'+label+'</span></div>';
};
