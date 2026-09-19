import { json,listWeeks,readWeek,validWeek } from './_archive.mjs';

export default async (request)=>{
  try{
    const url=new URL(request.url),week=url.searchParams.get('week');
    if(!week)return json({weeks:await listWeeks()});
    if(!validWeek(week))return json({error:'Invalid Tuesday week start'},400);
    return json(await readWeek(week));
  }catch(e){return json({error:e.message||String(e)},500);}
};

export const config={path:'/api/archive'};
