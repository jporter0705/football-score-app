import {createHmac,timingSafeEqual} from 'node:crypto';
import T from '../../team-matching.mjs';
const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);};

export function eventId(input){
  const s=String(input||'').trim();if(/^\d{6,12}$/.test(s))return s;
  let u;try{u=new URL(s)}catch{throw Error('Enter a numeric ESPN Game ID or full ESPN game URL.');}
  const m=u.pathname.match(/^\/(?:college-football|nfl)\/(?:game|boxscore|playbyplay|summary)\/_\/gameId\/(\d{6,12})(?:\/[^/]*)?\/?$/);
  if(u.protocol!=='https:'||!['espn.com','www.espn.com'].includes(u.hostname)||u.username||u.password||u.port||!m)throw Error('Use an https://www.espn.com football game URL.');
  return m[1];
}
export const targetKey=(id,legNumber=0)=>JSON.stringify([String(id),Number(legNumber)]);
export function targets(b,scores={}){
  const single=!b.legs?.length,sgp=b.structure==='same_game_parlay';
  const rows=single||sgp?[{item:b,legNumber:0}]:[];
  (b.legs||[]).forEach((item,i)=>rows.push({item,legNumber:item.legNumber??i+1}));
  return rows.map(({item,legNumber})=>{
    const context={...item,sport:item.sport||b.sport,league:item.league||(item.sport?(T.sport(item.sport)==='NFL'?'NFL':'NCAA'):b.league)};
    if(legNumber&&sgp){context.awayTeam||=b.awayTeam;context.homeTeam||=b.homeTeam;context.gameText||=b.gameText;context.eventDate||=b.eventDate;}
    const pair=T.pair(context),date=T.eventDay(context),sport=T.sport(context.sport||context.league);
    const g=T.resolve(sport==='NFL'?scores.nfl:scores.college,context);
    return {key:targetKey(b.betId,legNumber),betId:b.betId,legNumber,sport,league:context.league,pair,date:date.day||null,
      original:item.gameText||b.gameText||pair?.join(' vs ')||item.raw||item.description||b.description||'Matchup unavailable',
      requirement:[item.selection||item.player,item.side,item.line,item.period].filter(x=>x!==undefined&&x!==null&&x!=='').join(' '),
      status:item.manualMatch?'Manually confirmed':g?'Automatically matched':'No ESPN match yet',manualMatch:item.manualMatch||null,
      matchedEventId:g?.id||null};
  });
}
const signature=data=>createHmac('sha256',process.env.BET_ACCESS_TOKEN).update(JSON.stringify(data)).digest('hex');
const identity=t=>JSON.stringify([t.key,t.sport,t.date,t.pair?.map(n=>T.key(n,t.sport)).sort()||null]);
export function groupKey(t){return t.sport&&t.date&&t.pair?.length===2?JSON.stringify([t.sport,t.date,t.pair.map(n=>T.key(n,t.sport)).sort()]):null;}
export function warningsFor(t,event){
  const sport=T.sport(t.sport),league=T.sport(t.league);
  if(sport&&sport!==event.sport||league&&league!==event.sport)throw Error('Wrong league. NCAA wagers can only use NCAA games; NFL wagers can only use NFL games.');
  const warnings=[];
  const sameTeams=t.pair&&T.resolve([event],{sport:event.sport,awayTeam:t.pair[0],homeTeam:t.pair[1]});
  if(!sport&&!sameTeams)throw Error('The wager has no league. Both original opponents must match ESPN before its league can be confirmed.');
  if(!sport)warnings.push('Original league is unavailable. Verify the ESPN league below.');
  if(!sameTeams)warnings.push('Teams differ from the original BetOnline matchup or cannot be verified.');
  if(!t.date)warnings.push('Original scheduled date is unavailable. Verify the date below.');
  else if(t.date!==T.day(event.date))warnings.push('Scheduled date differs from the original wager ('+t.date+').');
  return warnings;
}
export function verifiedEvent(header,id,sport){
  const c=header?.competitions?.[0],league=header?.league,slug=league?.slug;
  const actual=slug==='nfl'&&String(league.id)==='28'?'NFL':slug==='college-football'&&String(league.id)==='23'?'College':null;
  if(String(header?.id)!==id||String(c?.id)!==id||!actual||actual!==sport)throw Error('ESPN event was not found in the wager’s league.');
  if(header.competitions.length!==1||!T.day(c.date)||c.competitors?.length!==2||!['home','away'].every(side=>c.competitors.some(x=>x.homeAway===side&&x.team?.id&&x.team?.displayName)))throw Error('ESPN returned incomplete or ambiguous game details. Try again later.');
  const leagueId=actual==='NFL'?'28':'23';if(c.competitors.some(x=>x.team.uid&&!String(x.team.uid).includes('~l:'+leagueId+'~')))throw Error('ESPN returned conflicting league details.');
  // Persist identity only: no score, result or financial grading comes from this snapshot.
  return {id,date:c.date,sport:actual,uid:'s:20~l:'+(actual==='NFL'?'28':'23')+'~e:'+id,competitions:[{id,date:c.date,status:{type:{state:'pre',completed:false}},competitors:c.competitors.map(x=>({homeAway:x.homeAway,team:{id:String(x.team.id),uid:x.team.uid,location:x.team.location,displayName:x.team.displayName,shortDisplayName:x.team.shortDisplayName,abbreviation:x.team.abbreviation,name:x.team.name}}))}]};
}
export async function findCandidate(input,target,lookup){
  const id=eventId(input),sp=T.sport(target.sport)||T.sport(target.league);
  if(!sp){
    if(!target.pair)throw Error('The wager needs both original opponents before its league can be confirmed.');
    const found=[];
    for(const sport of ['NFL','College']){let data;try{data=await lookup(sport==='NFL'?'nfl':'college',id)}catch{continue;}
      try{found.push(verifiedEvent(data.header,id,sport))}catch{continue;}}
    if(found.length!==1)throw Error('ESPN could not verify one NFL or NCAA game. Check the ID and try again.');
    return candidateFor(found[0],target);
  }
  let data;try{data=await lookup(sp==='NFL'?'nfl':'college',id)}catch{throw Error('ESPN could not find this game or is temporarily unavailable. Check the ID and try again.');}
  const event=verifiedEvent(data.header,id,sp);return candidateFor(event,target);
}
export function candidateFor(event,target){
  const warnings=warningsFor(target,event);
  const payload={identity:identity(target),event,expires:Date.now()+30*60000};
  return {event,warnings,receipt:{payload,signature:signature(payload)},relatedGroup:groupKey(target)};
}
export function applyMatches(record,matches={}){
  let b={...record,legs:record.legs?.map(l=>({...l}))};if(!record.legs)delete b.legs;
  for(const t of targets(record)){
    const choice=Object.hasOwn(matches,t.key)?matches[t.key]:null;if(!choice)continue;
    const {receipt,acknowledged}=choice,p=receipt?.payload;
    if(!p||!equal(receipt.signature,signature(p))||p.expires<Date.now()||p.identity!==identity(t))throw Error('Game confirmation expired or this wager changed. Find the game again.');
    const warnings=warningsFor(t,p.event);if(warnings.length&&acknowledged!==true)throw Error('Review and acknowledge the game differences before confirming.');
    const match={version:1,eventId:p.event.id,sport:p.event.sport,event:p.event,confirmedAt:new Date(p.expires-30*60000).toISOString(),warningsAcknowledged:!!warnings.length};
    const item=t.legNumber?b.legs.find((l,i)=>(l.legNumber??i+1)===t.legNumber):b;
    item.manualMatch=match;item.espnEventId=match.eventId;
    if(!t.sport){item.sport=match.sport;item.league=match.sport==='NFL'?'NFL':'NCAA';}
  }
  return b;
}
export function validateMatches(value){if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>1000)throw Error('Invalid game confirmations');return value;}
