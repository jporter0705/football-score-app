import { dayFresh,dayMetadata } from './_score-policy.mjs';
// Fetch only stale scoreboard dates. Successful dates survive a partial outage.
export async function fetchDays(source,days,dayCache={},group='80',timeout=12000){
  const league=source==='nfl'?'nfl':'college-football',games=new Map(),errors=[],scoreDays={...dayCache};
  await Promise.all(days.map(async day=>{
    if(dayFresh(dayCache[day]))return;
    try{
      const url='https://site.api.espn.com/apis/site/v2/sports/football/'+league+'/scoreboard?dates='+day.replaceAll('-','')+'&limit=300'+(source==='college'?'&groups='+group:'');
      const r=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{accept:'application/json'}});
      if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.events))throw Error('invalid scoreboard');
      j.events.forEach(e=>games.set(String(e.id),e));scoreDays[day]=dayMetadata(j.events,day);
    }catch(e){errors.push(day+' '+e.message);scoreDays[day]={...scoreDays[day],updatedAt:new Date().toISOString(),error:true};}
  }));
  if(errors.length===days.length)throw Error(errors.join('; '));
  return {items:[...games.values()],updatedAt:new Date().toISOString(),scoreDays,error:errors.join('; ')||null};
}
