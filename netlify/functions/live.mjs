import { fetchDays } from './_score-fetch.mjs';
import { bettingWeek,readWeek,writeWeek,mergeGames,json,validWeek } from './_archive.mjs';

const timeout=()=>AbortSignal.timeout(12000);
function compactDay(d){return d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0');}
function pacificDate(offsetDays=0){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const y=+parts.find(x=>x.type==='year').value,m=+parts.find(x=>x.type==='month').value,d=+parts.find(x=>x.type==='day').value;const date=new Date(Date.UTC(y,m-1,d+offsetDays));return compactDay(date);}
export function inWeek(event,w){const d=new Date(event.date);if(!Number.isFinite(d.getTime()))return false;const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return day>=w.start&&day<=w.end;}
async function liveScores(source,w,dayCache={}){const days=[pacificDate(-1),pacificDate(0)].map(d=>d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6));const x=await fetchDays(source,days,dayCache);x.items=x.items.filter(e=>inWeek(e,w));return x;}
export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  try{
    const u=new URL(request.url),key=u.searchParams.get('week')||bettingWeek().start;if(!validWeek(key))return json({error:'Invalid Tuesday week start'},400);
    const current=bettingWeek();if(key!==current.start)return json({ok:true,week:key,skipped:'historical week'});
    const h=await readWeek(key);h.sources=h.sources||{};h.scoreDays=h.scoreDays||{};h.gameUpdates={};const results=await Promise.allSettled([liveScores('nfl',current,h.scoreDays?.nfl),liveScores('college',current,h.scoreDays?.college)]);
    ['nfl','college'].forEach((name,i)=>{const r=results[i];if(r.status==='fulfilled'){h[name]=mergeGames(h[name],r.value.items);h.scoreDays[name]=r.value.scoreDays;h.gameUpdates[name]=r.value.items;h.sources[name]={updatedAt:r.value.updatedAt,error:r.value.error};}else h.sources[name]={...(h.sources[name]||{}),error:r.reason?.message||String(r.reason)};});
    h.archivedAt=new Date().toISOString();await writeWeek(key,h);return json({ok:true,week:key,archivedAt:h.archivedAt,sources:h.sources});
  }catch(e){return json({error:e.message||String(e)},500);}
};
export const config={path:'/api/live'};


