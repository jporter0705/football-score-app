/* Shared by CSV review and saved-wager correction; no private browser storage. */
function mountGameMatch(parent,target,options){
  function add(tag,text,host){var n=document.createElement(tag);n.textContent=text;host.append(n);return n;}
  var panel=add('details','',parent);panel.className='game-match';panel.open=!target.matchedEventId&&!target.manualMatch;
  add('summary',(target.legNumber?'Leg '+target.legNumber+' · ':'')+target.status+(target.manualMatch?' · Change game':''),panel);
  add('p',target.original,panel);add('small',[target.requirement,target.date||'Game date unavailable',target.sport||'League unavailable'].filter(Boolean).join(' · '),panel);
  if(target.manualMatch)add('p','Manually confirmed · ESPN '+target.manualMatch.eventId,panel);
  else if(target.matchedEventId)add('p','ESPN '+target.matchedEventId+' · You can change this match below.',panel);
  var label=add('label','ESPN Game ID or URL',panel),input=add('input','',label);input.type='text';input.inputMode='text';input.placeholder='401864523 or paste ESPN URL';input.autocomplete='off';input.maxLength=500;
  var find=add('button','Find Game',panel);find.type='button';var result=add('div','',panel);result.setAttribute('aria-live','polite');var sequence=0;
  input.oninput=function(){sequence++;result.replaceChildren()};
  find.onclick=async function(){
    if(options.isBusy())return;var seq=++sequence;find.disabled=true;options.setBusy(true);result.replaceChildren();add('p','Checking ESPN…',result);
    try{
      var c=await options.find(input.value,target.key);if(seq!==sequence)return;result.replaceChildren();
      var teams=c.event.competitions[0].competitors,away=teams.find(x=>x.homeAway==='away'),home=teams.find(x=>x.homeAway==='home');
      add('strong',away.team.displayName+' at '+home.team.displayName,result);
      add('p',new Date(c.event.date).toLocaleString([],{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})+' · '+c.event.sport+' · ESPN '+c.event.id,result);
      var ack=null;if(c.warnings.length){var warning=add('p',c.warnings.join(' '),result);warning.className='match-warning';var a=add('label','',result);ack=add('input','',a);ack.type='checkbox';add('span','I checked the team/date differences and this is the correct game.',a);}
      var reuse=null,others=c.confirmations.filter(x=>x.key!==target.key);
      if(others.length){var r=add('label','',result);reuse=add('input','',r);reuse.type='checkbox';add('span','Also use for '+others.length+' related wager/leg'+(others.length===1?'':'s')+' with the same matchup, league and date.',r);var related=add('details','',result);add('summary','See affected wagers',related);others.forEach(x=>add('small','Bet '+x.betId+(x.legNumber?' · leg '+x.legNumber:'')+' ',related));}
      var use=add('button','Use This Game',result);use.type='button';use.disabled=!!ack;if(ack)ack.onchange=function(){use.disabled=!ack.checked};
      add('small','This stages the match. Review the preview and Save changes to keep it.',result);
      use.onclick=async function(){if(options.isBusy()||ack&&!ack.checked)return;var chosen={};c.confirmations.filter(x=>x.key===target.key||reuse&&reuse.checked).forEach(x=>{chosen[x.key]={receipt:x.receipt,acknowledged:!!(ack&&ack.checked)}});await options.onChoose(chosen);};
    }catch(e){if(seq===sequence){result.replaceChildren();add('p',e.message,result);}}
    finally{find.disabled=false;options.setBusy(false);}
  };
  return panel;
}
