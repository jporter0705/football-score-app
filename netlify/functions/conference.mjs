import { json,validWeek,bettingWeek } from './_archive.mjs';
import { fetchScores } from './refresh.mjs';
export default async request=>{
  const u=new URL(request.url),key=u.searchParams.get('week'),group=u.searchParams.get('group');
  if(!validWeek(key||'')||!/^\d{1,3}$/.test(group||''))return json({error:'Invalid conference or week'},400);
  try{return json(await fetchScores('college',bettingWeek(new Date(key+'T12:00:00')),group));}catch{return json({error:'Conference delayed'},502);}
};
export const config={path:'/api/conference'};
