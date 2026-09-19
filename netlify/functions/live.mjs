import { bettingWeek,readWeek,writeWeek,mergeGames,json,validWeek } from './_archive.mjs';

const timeout=()=>AbortSignal.timeout(12000);
function compactDay(d){return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');}
async function todayScores(source){
  const league=source==='nfl'?'nfl':'college-football',day=compactDay(new Date());
  const url='https://site.api.espn.com/apis/site/v2/sports/football/'+league+'/scoreboard?dates='+day+'&limit=300'+(source==='college'?'&groups=80':'');
  const r=await fetch(url,{signal:timeout(),headers:{accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.events))throw Error('invalid scoreboard');return j.events;
}
export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  try{
    const u=new URL(request.url),key=u.searchParams.get('week')||bettingWeek().start;if(!validWeek(key))return json({error:'Invalid Tuesday week start'},400);
    const current=bettingWeek();if(key!==current.start)return json({ok:true,week:key,skipped:'historical week'});
    const h=await readWeek(key);h.sources=h.sources||{};const results=await Promise.allSettled([todayScores('nfl'),todayScores('college')]);
    ['nfl','college'].forEach((name,i)=>{const r=results[i];if(r.status==='fulfilled'){h[name]=mergeGames(h[name],r.value);h.sources[name]={updatedAt:new Date().toISOString(),error:null};}else h.sources[name]={...(h.sources[name]||{}),error:r.reason?.message||String(r.reason)};});
    h.archivedAt=new Date().toISOString();await writeWeek(key,h);return json({ok:true,week:key,archivedAt:h.archivedAt,sources:h.sources});
  }catch(e){return json({error:e.message||String(e)},500);}
};
export const config={path:'/api/live'};
