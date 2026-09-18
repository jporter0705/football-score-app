const assert=require('node:assert/strict');
const {createClient}=require('./score-feed.js');
(async()=>{
 let clock=Date.parse('2026-09-16T12:00:00'),calls=[],active=0,maximum=0,fail=false;
 const client=createClient({now:()=>clock,fetch:async url=>{
   calls.push(url);active++;maximum=Math.max(maximum,active);await new Promise(setImmediate);active--;
   const day=new URL(url).searchParams.get('dates');assert.match(day,/^\d{8}$/);
   return {ok:!fail,status:fail?503:200,json:async()=>({events:[{id:day,competitions:[{status:{type:{completed:day<'20260916'}}}]}]})};
 }});
 const [a,b]=await Promise.all([client.fetchWeek('nfl','2026-09-15','2026-09-21'),client.fetchWeek('nfl','2026-09-15','2026-09-21')]);
 assert.equal(a.events.length,7);assert.equal(b.events.length,7);assert.equal(calls.length,7);assert.ok(maximum<=3);assert.equal(a.error,null);
 await client.fetchWeek('nfl','2026-09-15','2026-09-21');assert.equal(calls.length,7);
 clock+=31000;fail=true;
 const [c,d]=await Promise.all([client.fetchWeek('nfl','2026-09-15','2026-09-21'),client.fetchWeek('nfl','2026-09-15','2026-09-21')]);
 assert.equal(calls.length,8);assert.equal(c.events.length,7);assert.match(c.error,/2026-09-16 HTTP 503/);assert.equal(d.error,c.error);
 fail=false;const college=await client.fetchWeek('college','2026-09-19','2026-09-19','8');assert.equal(college.events.length,1);assert.ok(calls.at(-1).includes('groups=8'));
 const duplicate=createClient({fetch:async()=>({ok:true,json:async()=>({events:[{id:'same-game'}]})})});assert.equal((await duplicate.fetchWeek('nfl','2026-09-15','2026-09-21')).events.length,1);
 await assert.rejects(client.fetchWeek('nfl','2026-09-15','2026-09-30'),/at most seven/);
 console.log('PASS single-date requests; complete week merge; concurrency limit; overlapping request deduplication; daily caching; cached scores survive partial errors; conference parameter; game deduplication; bounded dates');
})().catch(e=>{console.error(e);process.exitCode=1});
