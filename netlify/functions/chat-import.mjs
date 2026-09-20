import { authorized,betStore,sameOrigin,updateBlob } from './_private.mjs';
import { validWeek,bettingWeek,mergeBets,json } from './_archive.mjs';

function validate(body){
  if(!body?.week||!validWeek(body.week.start)||!Array.isArray(body.bets)||!body.bets.length||body.bets.length>50)throw Error('Expected a Tuesday week and 1-50 bets');
  const ids=new Set();
  for(const b of body.bets){
    if(!b||typeof b.betId!=='string'||!b.betId.trim()||ids.has(b.betId)||b.legs&&!Array.isArray(b.legs))throw Error('Invalid or duplicate bet ID / legs');
    ids.add(b.betId);
  }
  return body;
}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function inferTeams(text){
  const s=clean(text),m=s.match(/(?:NFL Game Props\s*-\s*)?(.+?)\s+(?:@|v|vs\.?|versus)\s+(.+?)(?:\s*[-|]\s*|$)/i);
  if(!m)return{};return{awayTeam:clean(m[1]).replace(/^FOOTBALL\s*-\s*NFL\s*-\s*/i,''),homeTeam:clean(m[2])};
}
function normalizeLeg(l={},parent={}){
  const raw=clean(l.raw||l.description||l.selection),x={...l};x.raw=x.raw||raw;x.selection=x.selection||raw;x.sport=x.sport||parent.sport;x.awayTeam=x.awayTeam||parent.awayTeam;x.homeTeam=x.homeTeam||parent.homeTeam;
  if(/money\s*line/i.test(raw)){x.market='moneyline';const m=raw.match(/money\s*line\s*-\s*(.+?)(?:\s*\(|$)/i);if(m)x.selection=clean(m[1]);}
  else if(/score\s+(?:anytime|a touchdown)|anytime\s+td|touchdown\s*-\s*yes/i.test(raw)){x.market='player_prop';x.propType='anytime_td';const m=raw.match(/(?:Player TDs\s*-\s*)?(.+?)\s+(?:Score anytime|Score a Touchdown|anytime TD)/i);if(m)x.selection=clean(m[1]);x.line=0.5;}
  else if(/pass\s+interceptions?/i.test(raw)){x.market='player_prop';x.propType='pass_interceptions';const m=raw.match(/(?:Player stats\s*-\s*)?(.+?)\s+(\d+)\+\s*Pass interceptions?/i);if(m){x.selection=clean(m[1]);x.line=Number(m[2])-.5;}}
  return x;
}
function normalizeBet(b){
  const x={...b},text=clean(b.description||b.rawWager||'');x.sport=x.sport||(/NFL|Vikings|Bears/i.test(text)?'nfl':x.sport);
  const teams=inferTeams(text);x.awayTeam=x.awayTeam||teams.awayTeam;x.homeTeam=x.homeTeam||teams.homeTeam;
  if(/same game parlay/i.test(text)||String(x.type||'').toLowerCase().includes('same game'))x.structure='same_game_parlay';
  else x.structure=x.structure||'straight';
  if(Array.isArray(x.legs))x.legs=x.legs.map((l,i)=>normalizeLeg({...l,legNumber:l.legNumber??i+1},x));
  if(x.structure==='straight'){
    const l=normalizeLeg({raw:text,selection:x.selection,market:x.market,propType:x.propType,line:x.line},x);x.market=x.market||l.market;x.propType=x.propType||l.propType;x.selection=x.selection||l.selection;x.line=x.line??l.line;
  }
  return x;
}

export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  if(!sameOrigin(request))return json({error:'Forbidden'},403);
  if(!authorized(request))return json({error:'Unlock private bets first'},401);
  let body;
  try{const raw=await request.text();if(raw.length>100000)throw Error('Import too large');body=validate(JSON.parse(raw));body={...body,bets:body.bets.map(normalizeBet)};}
  catch(e){return json({error:e.message},400);}
  try{
    const key=body.week.start;
    const saved=await updateBlob(betStore(),'week/'+key,old=>({week:bettingWeek(new Date(key+'T12:00:00')),bets:mergeBets(old?.bets,body.bets),generatedAt:new Date().toISOString()}));
    return json({ok:true,week:key,count:saved.bets.length,added:body.bets.length});
  }catch{return json({error:'Import unavailable; retry'},503);}
};

export const config={path:'/api/chat-import'};
