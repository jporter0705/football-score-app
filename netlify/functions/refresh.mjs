import { bettingWeek,readWeek,writeWeek,mergeGames,mergeBets,json,validWeek } from './_archive.mjs';

const BET_BASE='https://raw.githubusercontent.com/jporter0705/football-score-data/main/';
const timeout=()=>AbortSignal.timeout(20000);
function days(start,end){const out=[],d=new Date(start+'T12:00:00');while(d.toISOString().slice(0,10)<=end&&out.length<7){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}return out;}
async function fetchScores(source,w){
  const league=source==='nfl'?'nfl':'college-football',games=new Map(),errors=[];
  await Promise.all(days(w.start,w.end).map(async day=>{try{const u='https://site.api.espn.com/apis/site/v2/sports/football/'+league+'/scoreboard?dates='+day.replaceAll('-','')+'&limit=300'+(source==='college'?'&groups=80':'');const r=await fetch(u,{signal:timeout(),headers:{accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.events))throw Error('invalid scoreboard');j.events.forEach(e=>games.set(String(e.id),e));}catch(e){errors.push(day+' '+e.message);}}));
  return {items:[...games.values()],updatedAt:new Date().toISOString(),error:errors.length?errors.join('; '):null};
}
async function fetchBets(w){const path=w.start===bettingWeek().start?'current-week.json':'weeks/'+w.start+'.json',r=await fetch(BET_BASE+path,{signal:timeout(),headers:{accept:'application/json'}});if(!r.ok)throw Error('Bet feed HTTP '+r.status);const j=await r.json();if(!j.week||j.week.start!==w.start||!Array.isArray(j.bets))throw Error('Bet feed week mismatch');return {items:j.bets,updatedAt:j.generatedAt||new Date().toISOString()};}
async function refreshWeek(w){
  const h=await readWeek(w.start);h.week=w;h.sources=h.sources||{};
  const results=await Promise.allSettled([fetchScores('nfl',w),fetchScores('college',w),fetchBets(w)]),names=['nfl','college','bets'];
  results.forEach((r,i)=>{const name=names[i];if(r.status==='fulfilled'){const x=r.value;if(name==='bets')h.bets=mergeBets(h.bets,x.items);else h[name]=mergeGames(h[name],x.items);h.sources[name]={updatedAt:x.updatedAt,error:x.error||null};}else h.sources[name]={...(h.sources[name]||{}),error:r.reason?.message||String(r.reason)};});
  h.archivedAt=new Date().toISOString();await writeWeek(w.start,h);return h;
}
export default async (request)=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  try{const url=new URL(request.url),key=url.searchParams.get('week')||bettingWeek().start;if(!validWeek(key))return json({error:'Invalid Tuesday week start'},400);const w=bettingWeek(new Date(key+'T12:00:00')),h=await refreshWeek(w);return json({ok:true,week:w.start,archivedAt:h.archivedAt,sources:h.sources});}catch(e){return json({error:e.message||String(e)},500);}
};
export const config={path:'/api/refresh'};
