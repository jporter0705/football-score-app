import { bettingWeek,readWeek,writeWeek,mergeGames,json,validWeek } from './_archive.mjs';

const timeout=()=>AbortSignal.timeout(12000);
function compactDay(d){return d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0');}
function pacificDate(offsetDays=0){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const y=+parts.find(x=>x.type==='year').value,m=+parts.find(x=>x.type==='month').value,d=+parts.find(x=>x.type==='day').value;const date=new Date(Date.UTC(y,m-1,d+offsetDays));return compactDay(date);}
async function liveScores(source){
  const league=source==='nfl'?'nfl':'college-football',days=[pacificDate(-1),pacificDate(0)],games=new Map();
  await Promise.all(days.map(async day=>{const url='https://site.api.espn.com/apis/site/v2/sports/football/'+league+'/scoreboard?dates='+day+'&limit=300'+(source==='college'?'&groups=80':'');const r=await fetch(url,{signal:timeout(),headers:{accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.events))throw Error('invalid scoreboard');j.events.forEach(e=>games.set(String(e.id),e));}));return [...games.values()];
}
export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  try{
    const u=new URL(request.url),key=u.searchParams.get('week')||bettingWeek().start;if(!validWeek(key))return json({error:'Invalid Tuesday week start'},400);
    const current=bettingWeek();if(key!==current.start)return json({ok:true,week:key,skipped:'historical week'});
    const h=await readWeek(key);h.sources=h.sources||{};const results=await Promise.allSettled([liveScores('nfl'),liveScores('college')]);
    ['nfl','college'].forEach((name,i)=>{const r=results[i];if(r.status==='fulfilled'){h[name]=mergeGames(h[name],r.value);h.sources[name]={updatedAt:new Date().toISOString(),error:null};}else h.sources[name]={...(h.sources[name]||{}),error:r.reason?.message||String(r.reason)};});
    h.archivedAt=new Date().toISOString();await writeWeek(key,h);return json({ok:true,week:key,archivedAt:h.archivedAt,sources:h.sources});
  }catch(e){return json({error:e.message||String(e)},500);}
};
export const config={path:'/api/live'};
