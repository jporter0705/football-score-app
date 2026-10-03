/* Ordinal position indicators, NOT calibrated probabilities. Thresholds are product heuristics. */
function positionEstimate(item,g){
  if(!g||gs(g)!=='in'||finalGame(g)||item.matchIssue||bookResult(item)||(item.legs||[]).length)return null;
  var status=comp(g).status||g.status||{},p=Number(status.period),match=String(status.displayClock||'').match(/^(\d{1,2}):(\d{2})$/);
  if(p<1||p>4||!match||Number(match[1])>15||Number(match[2])>59)return null;
  var left=(4-p)*900+Number(match[1])*60+Number(match[2]),scores=teams(g),a=scores.away&&scores.away.score,h=scores.home&&scores.home.score;
  if(!fullGameScope(item)){var evidence=periodEvidence(item,g);if(!evidence||evidence.upcoming||evidence.complete)return null;left=(evidence.scope.last-p)*900+Number(match[1])*60+Number(match[2]);a=evidence.away;h=evidence.home}
  if(left<=0)return null;
  function result(level,reason){return {level:level,label:['','Very unfavorable','Unfavorable','Uncertain','Favorable','Strong position'][level],reason:reason}}
  if(isPlayerProp(item)){
    var prop=propEval(item,g);if(prop.value==null)return null;
    // Without usage/injury data, elapsed clock is not enough to forecast a player's output.
    var under=/under/i.test(item.side||item.selection||''),line=Number(item.line);
    if(!under&&item.line!=null&&Number.isFinite(line)&&prop.value>line)return result(4,'Target currently exceeded; stats can change. No player-usage forecast.');
    return result(3,'Current box-score stat is available, but remaining player usage is unknown.');
  }
  if(a==null||h==null||a===''||h===''||!Number.isFinite(Number(a))||!Number.isFinite(Number(h)))return null;
  a=Number(a);h=Number(h);var line=Number(item.line),valid=item.line!=null&&item.line!==''&&Number.isFinite(line);
  if(item.market==='spread'||item.market==='moneyline'){
    var away=exactTeam(scores.away,item.selection),home=exactTeam(scores.home,item.selection);if(away===home||item.market==='spread'&&!valid)return null;
    var edge=(away?a-h:h-a)+(item.market==='spread'?line:0);
    if(left>=1800)return result(3,'At least half of regulation remains; the current margin is not a safe lead.');
    var scale=left>900?24:left>300?16:left>120?10:8;
    var level=edge>scale?4:edge<-scale?2:3;
    if(left<=120){level=edge>0?4:edge<0?2:3;if(edge>8)level=5;if(edge<-8)level=1}
    var situation=comp(g).situation||{},pick=scores[away?'away':'home'],opponent=scores[away?'home':'away'],pos=String(situation.possession||''),pickId=String(pick.team&&pick.team.id||''),oppId=String(opponent.team&&opponent.team.id||'');
    // A one-score cushion with the opponent in possession remains uncertain.
    if(left<=300&&edge>0&&edge<=8&&pos&&pos===oppId)level=3;
    if(left<=300&&edge<0&&edge>=-8&&pos&&pos===pickId)level=3;
    if(level===5&&(!pos||left>60))level=4;
    return result(level,'Based on line-adjusted margin and remaining clock; possession tempers one-score situations. Not a win probability.');
  }
  if(item.market==='total'&&valid){var side=String(item.side||item.selection||'').toLowerCase();if(!/^(over|under)\b/.test(side))return null;
    if(left>300)return result(3,'Too much time remains to infer the finish from the current scoring pace.');
    var gap=line-a-h,under=/^under/.test(side),level=3;
    if(gap<0)return result(under?1:5,'The total has already crossed the line; subject to score corrections and settlement.');
    // Conservative scoring-opportunity budget, not linear extrapolation or fitted probability.
    var budget=8*Math.ceil(left/60);if(gap>budget)level=under?4:2;
    if(left<=60&&gap>16)level=under?5:1;
    if(fullGameScope(item)&&a===h)return result(3,'A tied game can go to overtime; regulation clock alone is insufficient.');
    if(gap<=3&&left>0)level=under?2:4;
    return result(level,'Late-game rule of thumb using points needed and time remaining. Overtime, turnovers and quick scores can change it.');
  }
  return null;
}
function positionEstimateHtml(item,g){var e=(item.legs||[]).length?parlayPositionEstimate(item):positionEstimate(item,g);if(!e)return '';return '<div class="position-estimate" title="'+esc(e.reason)+'"><span class="position-bars level-'+e.level+'" role="img" aria-label="'+esc(e.label)+' — rough position estimate, not a probability">'+[1,2,3,4,5].map(function(i){return '<i class="'+(i<=e.level?'filled':'')+'"></i>'}).join('')+'</span><span>'+e.label+' <small>· rough estimate</small></span></div>'}
var factualPositionHtml=livePositionHtml;
livePositionHtml=function(item,g){return positionEstimateHtml(item,g)+factualPositionHtml(item,g)};
// Overall parlay position follows the weakest remaining leg, never a multiplied probability.
function parlayPositionEstimate(b){
  if(!(b.legs||[]).length||authoritativeResult(b))return null;
  var levels=[],pending=false;
  for(var l of b.legs){var st=legDisplayStatus(l,b);if(st==='lost')return {level:1,label:'Very unfavorable',reason:'A leg is lost; sportsbook settlement determines the wager result.'};if(st==='won'||st==='push')continue;var g=legGame(l,b);if(!g||gs(g)!=='in'){pending=true;continue}var e=positionEstimate(Object.assign({sport:b.sport},l),g);if(!e)pending=true;else levels.push(e.level)}
  var level=levels.length?Math.min.apply(null,levels):3;if(pending)level=Math.min(level,3);
  return {level:level,label:['','Very unfavorable','Unfavorable','Uncertain','Favorable','Strong position'][level],reason:pending?'Some legs have not started or lack enough data; overall position cannot exceed the middle.':'Overall position follows the weakest remaining leg. It is not a combined win probability.'};
}

var parlayPositionCard=betCard;betCard=function(b){var html=parlayPositionCard(b);if((b.legs||[]).length&&!authoritativeResult(b))html=html.replace('<div class="game-clock-row">',positionEstimateHtml(b,findGame(b))+'<div class="game-clock-row">');return html};
