import { betStore,equal,updateBlob } from './_private.mjs';
import { validWeek,bettingWeek,mergeBets,json } from './_archive.mjs';
export function validateImport(body){
  if(!body?.week||!validWeek(body.week.start)||!Array.isArray(body.bets)||body.bets.length>10000)throw Error('Expected a Tuesday week and bets array');
  const ids=new Set();
  for(const b of body.bets){if(!b||typeof b.betId!=='string'||!b.betId.trim()||ids.has(b.betId)||b.legs&&!Array.isArray(b.legs))throw Error('Invalid or duplicate bet ID / legs');ids.add(b.betId);}
  return body;
}
export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  const token=process.env.BET_IMPORT_TOKEN;
  if(!token||!equal(request.headers.get('authorization'),'Bearer '+token))return json({error:'Unauthorized'},401);
  let body;try{const raw=await request.text();if(raw.length>2000000)throw Error('Import too large');body=validateImport(JSON.parse(raw));}catch(e){return json({error:e.message},400);}
  try{
    const key=body.week.start;
    const saved=await updateBlob(betStore(),'week/'+key,old=>({week:bettingWeek(new Date(key+'T12:00:00')),bets:mergeBets(old?.bets,body.bets),generatedAt:new Date().toISOString()}));
    return json({ok:true,week:key,count:saved.bets.length});
  }catch{return json({error:'Import unavailable; retry'},503);}
};
export const config={path:'/api/bets'};
