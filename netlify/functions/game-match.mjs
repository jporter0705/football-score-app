import {authorized,sameOrigin,equal} from './_private.mjs';
import {json,validWeek} from './_archive.mjs';
import {updatePrivateBets} from './_bet-backups.mjs';
import {loadWeeks,lock,tokenFor} from './csv-import.mjs';
import {makePlan,stable} from './_csv-plan.mjs';
import {targets,findCandidate,candidateFor,groupKey,applyMatches,validateMatches} from './_manual-match.mjs';
import {summary} from './summary.mjs';

export function savedPlan(weeks,matches={},focus){
  matches=validateMatches(matches);const seen=new Set(),items=[];
  for(const w of weeks)for(const b of w.bets){
    if(seen.has(String(b.betId)))throw Error('A Bet ID is saved in multiple weeks. Resolve duplicates before matching.');seen.add(String(b.betId));
    const after=applyMatches(b,matches),action=stable(after)===stable(b)?'unchanged':'updated';
    const matchingTargets=targets(after,w.scores),visible=focus?String(b.betId)===focus:matchingTargets.some(t=>!t.matchedEventId||t.manualMatch);
    if(visible||action==='updated')items.push({betId:b.betId,week:w.week,existing:true,description:b.description||b.gameText||b.selection,after,before:b,action,matchingTargets,changes:action==='updated'?['espnEventId','manualMatch','legs'].filter(k=>stable(after[k])!==stable(b[k])):[]});
  }
  return {items,summary:{new:0,updated:items.filter(i=>i.action==='updated').length,unchanged:items.filter(i=>i.action==='unchanged').length,review:0},count:items.length};
}
export default async request=>{
  if(request.method!=='POST')return json({error:'POST required'},405);
  if(!sameOrigin(request))return json({error:'Forbidden'},403);
  if(!authorized(request))return json({error:'Unlock private bets first'},401);
  let unlock;const savedWeeks=[];
  try{
    const raw=await request.text();if(Buffer.byteLength(raw)>2_000_000)throw Error('Matching request too large');
    const body=JSON.parse(raw);if(!['find','previewSaved','saveSaved'].includes(body.action))throw Error('Unknown matching action');
    const choices=body.choices||{};if(Object.values(choices).some(w=>!validWeek(w)))throw Error('Invalid week');
    if(body.action==='saveSaved')unlock=await lock();
    const weeks=await loadWeeks(choices);
    if(body.action==='find'){
      // Recreate the source server-side. Never trust client-supplied wager/team/league details.
      const plan=body.mode==='saved'?savedPlan(weeks):makePlan(body.csv,weeks,choices);
      const savedTargets=weeks.flatMap(w=>w.bets.flatMap(b=>targets(b,w.scores)));
      const available=[...new Map((body.mode==='saved'?savedTargets:[...savedTargets,...plan.items.flatMap(i=>i.matchingTargets||[])]).map(t=>[t.key,t])).values()];
      const target=available.find(t=>t.key===body.targetKey);if(!target)throw Error('Preview the wager and choose its game first.');
      const candidate=await findCandidate(body.input,target,summary),group=groupKey(target);
      const related=group?available.filter(t=>t.key!==target.key&&groupKey(t)===group):[];
      return json({...candidate,targetKey:target.key,confirmations:[{key:target.key,betId:target.betId,legNumber:target.legNumber,receipt:candidate.receipt,warnings:candidate.warnings},...related.map(t=>({key:t.key,betId:t.betId,legNumber:t.legNumber,...candidateFor(candidate.event,t)}))]});
    }
    const plan=savedPlan(weeks,body.matches,body.betId),token=tokenFor(plan,weeks);
    if(body.action==='previewSaved')return json({...plan,token,weeks:weeks.map(w=>w.week)});
    if(!equal(body.token,token))return json({error:'Saved wagers changed. Preview again before saving.',repreview:true},409);
    for(const w of weeks){const updates=plan.items.filter(i=>i.week===w.week&&i.action==='updated');if(!updates.length)continue;
      await updatePrivateBets(w.week,old=>{const map=new Map((old?.bets||w.bets).map(b=>[String(b.betId),b]));updates.forEach(i=>map.set(i.betId,i.after));return {...old,week:old?.week||{start:w.week},bets:[...map.values()],generatedAt:new Date().toISOString()};},{reason:'manual-game-match',expectedRevision:w.revision});savedWeeks.push(w.week);
    }
    return json({ok:true,summary:plan.summary,savedWeeks});
  }catch(e){return json({error:e.message,savedWeeks,repreview:true},e.status||(savedWeeks.length?503:400));}
  finally{if(unlock)await unlock().catch(()=>{});}
};
export const config={path:'/api/game-match'};
