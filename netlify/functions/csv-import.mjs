import { createHmac, randomUUID } from 'node:crypto';
import { authorized, sameOrigin, betStore, equal } from './_private.mjs';
import { validWeek, listWeeks, readWeek, bettingWeek, json } from './_archive.mjs';
import { updatePrivateBets } from './_bet-backups.mjs';
import { makePlan, stable } from './_csv-plan.mjs';

async function loadWeeks(choices) {
  const store = betStore(), keys = new Set(await listWeeks());
  for await (const page of store.list({prefix:'week/',paginate:true})) for (const b of page.blobs) if (validWeek(b.key.slice(5))) keys.add(b.key.slice(5));
  Object.values(choices).forEach(k => keys.add(k));
  const weeks = [];
  for (const week of [...keys].sort()) {
    const [privateData,scores] = await Promise.all([store.getWithMetadata('week/'+week,{type:'json',consistency:'strong'}),readWeek(week)]);
    weeks.push({week,revision:privateData?.etag || 'empty',scores,bets:privateData?.data?.bets || scores.bets || []});
  }
  return weeks;
}
function tokenFor(plan, weeks) {
  return createHmac('sha256',process.env.BET_ACCESS_TOKEN).update(stable({items:plan.items,revisions:weeks.map(w=>[w.week,w.revision])})).digest('hex');
}
async function lock() {
  const store=betStore(),key='csv-import-lock',old=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
  if (old?.data?.expires > Date.now()) throw Object.assign(Error('Another CSV import is saving. Try again shortly.'),{status:409});
  const id=randomUUID(), saved=await store.setJSON(key,{id,expires:Date.now()+120000},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
  if (!saved.modified || !saved.etag) throw Object.assign(Error('Another CSV import started. Preview again.'),{status:409});
  return async()=>{await store.setJSON(key,{id,expires:0},{onlyIfMatch:saved.etag});};
}
export default async request => {
  if(request.method !== 'POST') return json({error:'POST required'},405);
  if(!sameOrigin(request)) return json({error:'Forbidden'},403);
  if(!authorized(request)) return json({error:'Unlock private bets first'},401);
  let unlock; const savedWeeks=[];
  try {
    const text=await request.text(); if(Buffer.byteLength(text)>2_000_000) throw Error('Choose a CSV smaller than 2 MB');
    const body=JSON.parse(text),choices=body.choices || {};
    if(typeof body.csv !== 'string' || !['preview','save'].includes(body.action)) throw Error('Choose a CSV and preview it first');
    if(!choices || typeof choices !== 'object' || Array.isArray(choices) || Object.keys(choices).length>500 || Object.values(choices).some(w=>!validWeek(w))) throw Error('Choose valid Tuesday-start weeks');
    if(body.action === 'save') unlock=await lock();
    let weeks=await loadWeeks(choices),plan=makePlan(body.csv,weeks,choices);
    const missing=[...new Set(plan.items.map(i=>i.week).filter(w=>w&&!weeks.some(x=>x.week===w)))];
    if(missing.length){weeks=await loadWeeks({...choices,...Object.fromEntries(missing.map((w,i)=>['extra'+i,w]))});plan=makePlan(body.csv,weeks,choices);}
    const token=tokenFor(plan,weeks);
    if(body.action === 'preview') return json({...plan,token,weeks:weeks.map(w=>w.week)});
    if(!equal(body.token,token)) return json({error:'Saved bets or game information changed. Preview again before saving.',repreview:true},409);
    if(plan.summary.review) return json({error:'Resolve the rows needing review before saving.'},400);
    for(const week of [...new Set(plan.items.filter(i=>['new','updated'].includes(i.action)).map(i=>i.week))]) {
      const w=weeks.find(w=>w.week===week),updates=plan.items.filter(i=>i.week===week&&['new','updated'].includes(i.action));
      await updatePrivateBets(week,old=>{
        const byId=new Map((old?.bets || w.bets).map(b=>[String(b.betId),b]));
        updates.forEach(i=>byId.set(i.betId,i.after));
        return {...old,week:bettingWeek(new Date(week+'T12:00:00')),bets:[...byId.values()],generatedAt:new Date().toISOString()};
      },{reason:'csv-import',expectedRevision:w.revision});
      savedWeeks.push(week);
    }
    return json({ok:true,summary:plan.summary,savedWeeks});
  } catch(e) {
    return json({error:e.message || 'Import failed',savedWeeks,repreview:true},e.status || (savedWeeks.length?503:400));
  } finally { if(unlock) await unlock().catch(()=>{}); }
};
export const config={path:'/api/csv-import'};
