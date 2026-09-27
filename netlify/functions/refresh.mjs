import { fetchDays } from './_score-fetch.mjs';
import { bettingWeek,readWeek,writeWeek,mergeGames,json,validWeek } from './_archive.mjs';

const timeout=()=>AbortSignal.timeout(20000);
function days(start,end){const out=[],d=new Date(start+'T12:00:00');while(d.toISOString().slice(0,10)<=end&&out.length<7){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}return out;}
export async function fetchScores(source,w,group='80',dayCache={}){return fetchDays(source,days(w.start,w.end),dayCache,group,20000)}
async function refreshWeek(w){
  const h=await readWeek(w.start);h.week=w;h.sources=h.sources||{};
  const results=await Promise.allSettled([fetchScores('nfl',w,'80',h.scoreDays?.nfl),fetchScores('college',w,'80',h.scoreDays?.college)]),names=['nfl','college'];h.scoreDays=h.scoreDays||{};h.gameUpdates={};
  results.forEach((r,i)=>{const name=names[i];if(r.status==='fulfilled'){const x=r.value;h[name]=mergeGames(h[name],x.items);h.scoreDays[name]=x.scoreDays;h.gameUpdates[name]=x.items;h.sources[name]={updatedAt:x.updatedAt,error:x.error||null};}else h.sources[name]={...(h.sources[name]||{}),error:r.reason?.message||String(r.reason)};});
  h.archivedAt=new Date().toISOString();await writeWeek(w.start,h);return h;
}
export default async (request)=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  try{const url=new URL(request.url),key=url.searchParams.get('week')||bettingWeek().start;if(!validWeek(key))return json({error:'Invalid Tuesday week start'},400);const w=bettingWeek(new Date(key+'T12:00:00')),h=await refreshWeek(w);return json({ok:true,week:w.start,archivedAt:h.archivedAt,sources:h.sources});}catch(e){return json({error:e.message||String(e)},500);}
};
export const config={path:'/api/refresh'};


