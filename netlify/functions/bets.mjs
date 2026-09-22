import { betStore,equal,updateBlob } from './_private.mjs';
import { validWeek,bettingWeek,mergeBets,json } from './_archive.mjs';
export function validateImport(body){
  if(!body?.week||!validWeek(body.week.start)||!Array.isArray(body.bets)||body.bets.length>10000)throw Error('Expected a Tuesday week and bets array');
  const ids=new Set();
  for(const b of body.bets){if(!b||typeof b.betId!=='string'||!b.betId.trim()||ids.has(b.betId)||b.legs&&!Array.isArray(b.legs))throw Error('Invalid or duplicate bet ID / legs');ids.add(b.betId);}
  return body;
}
function explicitDate(x){for(const k of ['eventStart','espnEventDate','startTime','gameDate','eventDate','date']){const t=Date.parse(x?.[k]||'');if(Number.isFinite(t))return new Date(t)}return null}
async function espnDate(id,sport){
  if(!/^\d+$/.test(String(id||'')))return null;
  const league=String(sport||'').toUpperCase()==='NFL'?'nfl':'college-football';
  try{const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/'+league+'/summary?event='+id,{signal:AbortSignal.timeout(10000)});if(!r.ok)return null;const j=await r.json();const d=j?.header?.competitions?.[0]?.date||j?.header?.season?.date;const t=Date.parse(d||'');return Number.isFinite(t)?new Date(t):null}catch{return null}
}
async function itemDate(x,parent){return explicitDate(x)||await espnDate(x?.espnEventId||parent?.espnEventId,x?.sport||parent?.sport)}
async function ownerWeek(b,fallback){
  const dates=[];for(const l of b.legs||[]){const d=await itemDate(l,b);if(d)dates.push(d)}
  if(!dates.length){const d=await itemDate(b,b);if(d)dates.push(d)}
  if(!dates.length)return fallback;
  return bettingWeek(new Date(Math.max(...dates.map(d=>d.getTime())))).start;
}
export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  const token=process.env.BET_IMPORT_TOKEN;
  if(!token||!equal(request.headers.get('authorization'),'Bearer '+token))return json({error:'Unauthorized'},401);
  let body;try{const raw=await request.text();if(raw.length>2000000)throw Error('Import too large');body=validateImport(JSON.parse(raw));}catch(e){return json({error:e.message},400);}
  try{
    const groups=new Map();
    for(const b of body.bets){const key=await ownerWeek(b,body.week.start);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b)}
    const incomingIds=new Set(body.bets.map(b=>String(b.betId)));
    await updateBlob(betStore(),'week/'+body.week.start,old=>({...(old||{}),week:bettingWeek(new Date(body.week.start+'T12:00:00')),bets:(old?.bets||[]).filter(b=>!incomingIds.has(String(b.betId))),generatedAt:new Date().toISOString()}));
    const saved=[];
    for(const [key,bets] of groups){const result=await updateBlob(betStore(),'week/'+key,old=>({...(old||{}),week:bettingWeek(new Date(key+'T12:00:00')),bets:mergeBets(old?.bets,bets),generatedAt:new Date().toISOString()}));saved.push({week:key,count:result.bets.length,imported:bets.length})}
    return json({ok:true,weeks:saved});
  }catch(e){return json({error:'Import unavailable; retry',detail:e?.message||String(e)},503);}
};
export const config={path:'/api/bets'};
