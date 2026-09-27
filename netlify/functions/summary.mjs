import { json,store } from './_archive.mjs';
import { finalEvent } from './_score-policy.mjs';
const pending=new Map();
async function summary(sport,id){
  const key='summary/'+sport+'/'+id,cache=store();let old;
  try{old=await cache.get(key,{type:'json',consistency:'strong'})}catch{}
  const ttl=old?.final?86400000:30000;
  if(old&&Date.now()-Date.parse(old.updatedAt)<ttl)return old.data;
  const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/'+(sport==='nfl'?'nfl':'college-football')+'/summary?event='+id,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Summary delayed');const data=await r.json();
  if(!data||typeof data!=='object'||!data.header)throw Error('Invalid summary');
  const final=finalEvent(data.header);
  try{await cache.setJSON(key,{data,final,updatedAt:new Date().toISOString()})}catch{}
  return data;
}
export default async request=>{
  if(request.method!=='GET')return json({error:'GET required'},405);
  const u=new URL(request.url),sport=u.searchParams.get('sport'),id=u.searchParams.get('event');
  if(!['nfl','college'].includes(sport)||!/^\d{1,12}$/.test(id||''))return json({error:'Invalid event'},400);
  const key=sport+':'+id;
  try{if(!pending.has(key))pending.set(key,summary(sport,id).finally(()=>pending.delete(key)));return json(await pending.get(key))}catch{return json({error:'Summary delayed'},502)}
};
export const config={path:'/api/summary'};
