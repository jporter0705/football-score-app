// Live positions describe observed scores, never a probability of winning.
function fullGameScope(item){return ['game','full game','full_game'].includes(String(item.scope||item.period||item.segment||'game').toLowerCase())}
var auditedPropEval=propEval;
propEval=function(item,g){
  if(!fullGameScope(item)||item.matchIssue||!g||(!finalGame(g)&&gs(g)!=='in'))return {status:'unavailable',locked:false,value:null,target:item.line};
  if(item.propType!=='anytime_td'&&(item.line==null||item.line===''||!Number.isFinite(Number(item.line))))return {status:'unavailable',locked:false,value:null,target:null};
  return auditedPropEval(item,g);
};
var auditedMarketEval=evaluateMarket;
evaluateMarket=function(item,g){
  if(item.matchIssue||!fullGameScope(item))return {status:'unavailable',locked:false};
  if(isPlayerProp(item)&&g)return propEval(item,g);
  return auditedMarketEval(item,g);
};
function remainingGameText(g){
  var st=comp(g).status||g.status||{},p=Number(st.period),clock=String(st.displayClock||''),m=clock.match(/^(\d{1,2}):(\d{2})$/);
  if(p>4)return 'Overtime — result still open';
  if(/halftime/i.test((st.type||{}).description||'')||/halftime/i.test((st.type||{}).detail||''))return 'Halftime · 30:00 regulation left';
  if(p>=1&&p<=4&&m&&Number(m[1])<=15&&Number(m[2])<60){var seconds=(4-p)*900+Number(m[1])*60+Number(m[2]);return 'Q'+p+' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' regulation left'}
  return 'Live · time remaining unavailable';
}
function livePosition(item,g){
  if(!g||gs(g)!=='in'||finalGame(g)||bookResult(item))return '';
  if(item.matchIssue)return item.matchIssue;
  if(!fullGameScope(item))return 'Period-specific tracking unavailable — awaiting sportsbook result';
  var detail='',line=Number(item.line),validLine=item.line!=null&&item.line!==''&&Number.isFinite(line);
  if(isPlayerProp(item)){
    var e=propEval(item,g);if(e.value==null)return 'Player stats unavailable · '+remainingGameText(g);
    var under=/under/i.test(item.side||item.selection||''),gte=/_gte$/.test(item.propType||'')||item.propType==='anytime_td',target=gte?e.target:Math.floor(line)+1;
    detail=propRequirement(item)+' · Current: '+e.value;
    if(under)detail+=' · '+(e.value<line?'Below line by '+(line-e.value):e.value===line?'At push line':'Above line by '+(e.value-line));
    else detail+=' · '+(e.value>=target?'Target reached':'Needs '+(target-e.value)+' more');
    detail+=' · Stats can be corrected';
  }else{
    var t=teams(g),a=t.away&&t.away.score,h=t.home&&t.home.score;if(a==null||h==null||a===''||h===''||!Number.isFinite(Number(a))||!Number.isFinite(Number(h)))return 'Score unavailable';
    a=Number(a);h=Number(h);
    if(item.market==='spread'||item.market==='moneyline'){
      var away=exactTeam(t.away,item.selection),home=exactTeam(t.home,item.selection);if(away===home||item.market==='spread'&&!validLine)return 'Selection needs review';
      var edge=(away?a-h:h-a)+(item.market==='spread'?line:0);
      detail=item.market==='spread'?(edge>0?'Currently covering by '+edge:edge<0?'Currently short of covering by '+(-edge):'Currently at push line'):(edge>0?'Currently leading by '+edge:edge<0?'Currently trailing by '+(-edge):'Currently tied');
    }else if(item.market==='total'&&validLine){
      var side=String(item.side||item.selection||'').toLowerCase();if(!/^(over|under)\b/.test(side))return 'Selection needs review';
      detail='Current total: '+(a+h)+' · '+(/^under/.test(side)?(a+h<line?'Below line by '+(line-a-h):a+h===line?'At push line':'Above line by '+(a+h-line)):'Needs '+Math.max(0,Math.floor(line)+1-a-h)+' more points to go over');
    }
  }
  return detail?detail+' · '+remainingGameText(g)+' · Current position, not a prediction':'';
}
function livePositionHtml(item,g){var text=livePosition(item,g);return text?'<div class="legsub live-position" style="margin:8px 0;line-height:1.5">'+esc(text)+'</div>':''}
// Remove the unsupported five-level confidence indicator throughout the app.
healthHtml=function(){return ''};
var positionBetCard=betCard;
betCard=function(b){var html=positionBetCard(b);if(!(b.legs||[]).length&&!authoritativeResult(b))html=html.replace('<div class="game-clock-row">',livePositionHtml(b,findGame(b))+'<div class="game-clock-row">');return html};
var positionLegHtml=legHtml;
legHtml=function(l,b){var html=positionLegHtml(l,b),status=legDisplayStatus(l,b);if(status==='unavailable')html=html.replace('>Upcoming</span>','>Review</span>');if(!['won','lost','push'].includes(status))html=html.replace('<div class="legmain">',livePositionHtml(Object.assign({sport:b.sport},l),legGame(l,b))+'<div class="legmain">');return html};
