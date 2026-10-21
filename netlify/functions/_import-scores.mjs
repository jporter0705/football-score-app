import {fetchDays} from './_score-fetch.mjs';
import {mergeGames,writeWeek} from './_archive.mjs';
import {weekFor} from '../../csv-records.mjs';

// Importing an upcoming wager must not depend on somebody opening All Games first.
// Fetch only unresolved, explicitly dated league/day targets; cache public scores,
// never wagers. Preview and save then use the same ordinary reconciliation plan.
export async function hydrateImportScores(weeks,plan,{fetch=fetchDays,persist=writeWeek}={}){
  for(const w of weeks){
    const end=weekFor(w.week+'T12:00:00Z').end;
    for(const [sport,source] of [['NFL','nfl'],['College','college']]){
      const days=[...new Set(plan.items.filter(i=>i.week===w.week).flatMap(i=>i.matchingTargets||[])
        .filter(t=>t.sport===sport&&!t.matchedEventId&&!t.manualMatch&&t.date&&t.date>=w.week&&t.date<=end)
        .map(t=>t.date))];
      if(!days.length)continue;
      let result;try{result=await fetch(source,days,w.scores.scoreDays?.[source]||{});}catch{continue;}
      const scores={...w.scores,[source]:mergeGames(w.scores[source]||[],result.items),
        sources:{...w.scores.sources,[source]:{updatedAt:result.updatedAt,error:result.error}},
        scoreDays:{...w.scores.scoreDays,[source]:result.scoreDays},gameUpdates:{[source]:result.items}};
      // If persistence fails, retain the old plan rather than claiming a match
      // that the Bets page cannot subsequently load.
      try{await persist(w.week,scores);w.scores=scores;}catch{}
    }
  }
}
