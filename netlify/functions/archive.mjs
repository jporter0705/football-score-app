import { json,listWeeks,readWeek,validWeek } from './_archive.mjs';
import { authorized,readBets,betStore } from './_private.mjs';

export default async (request)=>{
  try{
    const url=new URL(request.url),week=url.searchParams.get('week');
    if(!week){const keys=new Set(await listWeeks());if(authorized(request)){for await(const page of betStore().list({prefix:'week/',paginate:true})){page.blobs.forEach(b=>keys.add(b.key.slice(5)));}}return json({weeks:[...keys].sort()});}
    if(!validWeek(week))return json({error:'Invalid Tuesday week start'},400);
    const h=await readWeek(week),unlocked=authorized(request),privateBets=unlocked?await readBets(week):null;
    // Never expose legacy bets embedded in score snapshots to anonymous readers.
    h.bets=unlocked?(privateBets?.bets||h.bets||[]):[];
    h.betsLocked=!unlocked;h.sources={...h.sources};delete h.sources.bets;
    // A week with no imported bets is a normal empty state, not a refresh failure.
    if(unlocked)h.sources.bets=privateBets?{updatedAt:privateBets.generatedAt,error:null}:{updatedAt:null,error:null,empty:true};
    return json(h);
  }catch(e){return json({error:e.message||String(e)},500);}
};

export const config={path:'/api/archive'};
