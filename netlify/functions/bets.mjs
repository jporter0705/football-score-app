import { betStore,equal,updateBlob } from './_private.mjs';
import { validWeek,bettingWeek,mergeBets,json } from './_archive.mjs';

export function validateImport(body){
  if(!body?.week||!validWeek(body.week.start)||!Array.isArray(body.bets)||body.bets.length>10000)throw Error('Expected a Tuesday week and bets array');
  const ids=new Set();
  for(const b of body.bets){if(!b||typeof b.betId!=='string'||!b.betId.trim()||ids.has(b.betId)||b.legs&&!Array.isArray(b.legs))throw Error('Invalid or duplicate bet ID / legs');ids.add(b.betId);}
  return body;
}
function eventDates(b){
  const out=[];
  const add=v=>{if(!v)return;const d=new Date(v);if(!Number.isNaN(d.getTime()))out.push(d);};
  for(const l of b.legs||[]){
    add(l.eventStart||l.startTime||l.gameDate);
    if(l.eventDate){
      const m=String(l.eventDate).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)add(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T12:00:00`);else add(l.eventDate);
    }
  }
  add(b.eventStart||b.startTime||b.gameDate||b.eventDate);
  return out;
}
function targetWeek(b,fallback){const ds=eventDates(b);if(!ds.length)return fallback;return bettingWeek(new Date(Math.max(...ds.map(d=>d.getTime())))).start;}
async function removeIdsFromOtherWeeks(ids,keep){
  const store=betStore();
  for await(const page of store.list({prefix:'week/',paginate:true})){
    for(const blob of page.blobs){const wk=blob.key.slice(5);if(wk===keep)continue;
      await updateBlob(store,blob.key,old=>{if(!old)return old;const bets=(old.bets||[]).filter(b=>!ids.has(String(b.betId)));return bets.length===(old.bets||[]).length?old:{...old,bets,generatedAt:new Date().toISOString()};});
    }
  }
}
export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  const token=process.env.BET_IMPORT_TOKEN;
  if(!token||!equal(request.headers.get('authorization'),'Bearer '+token))return json({error:'Unauthorized'},401);
  let body;try{const raw=await request.text();if(raw.length>2000000)throw Error('Import too large');body=validateImport(JSON.parse(raw));}catch(e){return json({error:e.message},400);}
  try{
    const groups=new Map();for(const b of body.bets){const wk=targetWeek(b,body.week.start);if(!groups.has(wk))groups.set(wk,[]);groups.get(wk).push(b);}
    const results=[];
    for(const [key,bets] of groups){
      const ids=new Set(bets.map(b=>String(b.betId)));await removeIdsFromOtherWeeks(ids,key);
      const saved=await updateBlob(betStore(),'week/'+key,old=>({week:bettingWeek(new Date(key+'T12:00:00')),bets:mergeBets(old?.bets,bets),generatedAt:new Date().toISOString()}));
      results.push({week:key,imported:bets.length,count:saved.bets.length});
    }
    return json({ok:true,weeks:results});
  }catch(e){return json({error:'Import unavailable; retry',detail:e.message||String(e)},503);}
};
export const config={path:'/api/bets'};
