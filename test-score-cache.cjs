const assert=require('node:assert/strict'),h=require('./test-support-netlify.cjs')();
(async()=>{
  const policy=await h.moduleFor('_score-policy'),fetcher=await h.moduleFor('_score-fetch'),summary=(await h.moduleFor('summary')).default;
  const now=Date.now(),stamp=age=>new Date(now-age).toISOString();
  assert(policy.dayFresh({complete:true,updatedAt:stamp(3600000)}));assert(!policy.dayFresh({complete:true,updatedAt:stamp(86400001)}));assert(!policy.dayFresh({updatedAt:stamp(31000)}));assert(!policy.dayFresh({complete:true,error:true,updatedAt:stamp(0)}));
  h.state.onFetch=async()=>({ok:true,json:async()=>({events:[]})});
  const days=['2026-09-15','2026-09-16'],one=await fetcher.fetchDays('nfl',days);const count=h.state.fetches.length;await fetcher.fetchDays('nfl',days,one.scoreDays);assert.equal(h.state.fetches.length,count);
  h.state.onFetch=async url=>{if(String(url).includes('20260916'))throw Error('offline');return{ok:true,json:async()=>({events:[{id:'good'}]})}};
  const partial=await fetcher.fetchDays('nfl',days);assert.equal(partial.items[0].id,'good');assert.match(partial.error,/offline/);assert(partial.scoreDays['2026-09-16'].error);
  h.state.onFetch=async()=>({ok:true,json:async()=>({header:{competitions:[{status:{type:{state:'post',completed:true}}}]},boxscore:{players:[]}})});
  const before=h.state.fetches.length;await Promise.all([summary(h.request('summary?sport=nfl&event=42')),summary(h.request('summary?sport=nfl&event=42'))]);assert.equal(h.state.fetches.length-before,1,'concurrent summaries coalesce');
  await summary(h.request('summary?sport=nfl&event=42'));assert.equal(h.state.fetches.length-before,1,'final summary reused');
  const cached=h.state.memory.get('football-score-history/summary/nfl/42');cached.data.updatedAt=stamp(86400001);await summary(h.request('summary?sport=nfl&event=42'));assert.equal(h.state.fetches.length-before,2,'final stats rechecked daily for corrections');
  await summary(h.request('summary?sport=college&event=42'));assert.equal(h.state.fetches.length-before,3,'sport is part of cache key');
  assert.equal((await summary(h.request('summary?sport=nfl&event=bad'))).status,400);
  console.log('PASS scoreboard TTLs, final-day reuse, partial outage preservation, coalesced summary requests, final-stat corrections and sport isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
