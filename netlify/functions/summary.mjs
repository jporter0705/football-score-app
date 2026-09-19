import { json } from './_archive.mjs';
export default async request=>{
  const u=new URL(request.url),sport=u.searchParams.get('sport'),id=u.searchParams.get('event');
  if(!['nfl','college'].includes(sport)||!/^\d{1,12}$/.test(id||''))return json({error:'Invalid event'},400);
  try{const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/'+(sport==='nfl'?'nfl':'college-football')+'/summary?event='+id,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();return json(await r.json());}catch{return json({error:'Summary delayed'},502);}
};
export const config={path:'/api/summary'};
