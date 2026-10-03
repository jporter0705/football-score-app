const assert=require('node:assert/strict'),fs=require('node:fs'),h=require('./test-support-netlify.cjs')();
const headers=['bet_id','accepted_date','risk','to_win','status','type','description','market','selection','side','line','odds','period','legs_json','leg_count','extraction_error'];
const row=(id,extra={})=>({bet_id:id,accepted_date:'09/28/26 08:38 PM GMT-7',risk:'40',to_win:'36.36',status:'PENDING',type:'Spread',description:'Cincinnati +7 -110',market:'spread',selection:'Cincinnati',line:'7',odds:'-110',period:'game',legs_json:'[]',leg_count:'0',...extra});
const csv=rows=>[headers,...rows.map(r=>headers.map(k=>r[k]??''))].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
(async()=>{
 const api=(await h.moduleFor('csv-import')).default,priv=await h.moduleFor('_private'),store=h.getStore('football-private-bets');
 const auth={cookie:'football_session='+priv.session(),origin:'https://example.netlify.app'};
 const call=(body,headers=auth)=>api(h.request('csv-import','POST',body,headers));
 const request=async body=>{const r=await call(body);return {status:r.status,...await r.json()};};
 const preview=(text,choices={})=>request({action:'preview',csv:text,choices});
 const save=(text,plan,choices={})=>request({action:'save',csv:text,token:plan.token,choices});
 assert.equal((await call({action:'preview',csv:csv([row('a')])},{})).status,401);
 assert.equal((await call({}, {...auth,origin:'https://evil.example'})).status,403);
 assert.equal((await request({action:'preview',csv:'bad'})).status,400);
 let text=csv([row('existing')]);
 await store.setJSON('week/2026-09-29',{week:{start:'2026-09-29'},bets:[{betId:'existing',description:'Original rich description',betOnlineStatus:'PENDING',risk:40,toWin:36.36,sport:'College',espnEventId:'good'}]});
 let p=await preview(text);assert.equal(p.items[0].week,'2026-09-29','existing game week wins over Monday placement');assert.equal(p.summary.updated,1);
 let r=await save(text,p);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.summary.updated,1);
 p=await preview(text);assert.equal(p.summary.unchanged,1,'identical re-import is unchanged');
 let backups=h.state.writes.filter(k=>k.includes('/backup/')).length;await save(text,p);assert.equal(h.state.writes.filter(k=>k.includes('/backup/')).length,backups,'unchanged saves do not write snapshots');
 text=csv([row('existing',{status:'LOST',to_win:'0'})]);p=await preview(text);assert.equal(p.items[0].after.toWin,36.36);assert.equal(p.items[0].after.description,'Original rich description');assert.equal(p.items[0].after.espnEventId,'good');await save(text,p);
 text=csv([row('existing')]);p=await preview(text);assert.equal(p.items[0].after.betOnlineStatus,'LOST','old pending cannot reverse settlement');
 text=csv([row('new')]);p=await preview(text);assert.equal(p.summary.review,1,'ambiguous new week requires a choice');
 const choices={new:'2026-09-29'};p=await preview(text,choices);assert.equal(p.summary.new,1);assert.equal((await save(text,{...p,token:'forged'},choices)).status,409);
 await store.setJSON('week/2026-09-29',{...(await store.get('week/2026-09-29')),extra:'concurrent'});assert.equal((await save(text,p,choices)).status,409,'stale preview rejected');
 p=await preview(text,choices);h.state.onSet=k=>k.includes('/backup/')?{modified:false}:null;r=await save(text,p,choices);assert.equal(r.status,400);assert(!(await store.get('week/2026-09-29')).bets.some(b=>b.betId==='new'));h.state.onSet=null;
 p=await preview(text,choices);r=await save(text,p,choices);assert.equal(r.status,200);assert.equal((await preview(text,choices)).summary.unchanged,1);
 assert.equal((await preview(csv([row('dup'),row('dup')]))).summary.review,2);
 const suffixes=await preview(csv([row('ticket-1'),row('ticket-2')]),{'ticket-1':'2026-09-29','ticket-2':'2026-09-29'});assert.equal(suffixes.summary.new,2,'full ID suffixes identify distinct wagers');
 await store.setJSON('week/2026-09-22',{week:{start:'2026-09-22'},bets:[{betId:'existing'}]});assert.equal((await preview(csv([row('existing')]))).summary.review,1,'duplicates across weeks are blocked');
 assert.equal((await preview(csv([row('bad',{risk:'',extraction_error:''})]))).summary.review,1);
 assert.equal((await preview(csv([row('warn',{extraction_error:'Missing legs'})]))).summary.review,1);
 // The real 91-row export must parse, retain all legs, and become idempotent.
 const fixture=process.env.BET_CSV_FIXTURE;
 if(fixture){const full=fs.readFileSync(fixture,'utf8');const parsed=(await h.moduleFor('_csv-plan')).makePlan(full,[],{});assert.equal(parsed.count,91);assert(parsed.items.every(i=>!i.reason||i.reason.startsWith('Choose the game week')),JSON.stringify(parsed.items.filter(i=>i.reason&&!i.suggestedWeek)));
 const explicit=Object.fromEntries(parsed.items.map(i=>[i.betId,i.week||i.suggestedWeek]));const plan=(await h.moduleFor('_csv-plan')).makePlan(full,[],explicit);assert.equal(plan.summary.review,0);assert.equal(plan.summary.new,91);const weeks=[...new Set(plan.items.map(i=>i.week))].map(week=>({week,scores:{},bets:plan.items.filter(i=>i.week===week).map(i=>i.after)}));assert.equal((await h.moduleFor('_csv-plan')).makePlan(full,weeks,explicit).summary.unchanged,91);}
 // Partial save: first week saved, second fails. Re-preview saves only remainder.
 text=csv([row('partial1'),row('partial2')]);const two={partial1:'2026-10-06',partial2:'2026-10-13'};p=await preview(text,two);h.state.onSet=k=>k.startsWith('football-private-bets/backup/2026-10-13/')?{modified:false}:null;r=await save(text,p,two);assert.equal(r.status,503);assert.deepEqual(r.savedWeeks,['2026-10-06']);h.state.onSet=null;p=await preview(text,two);assert.equal(p.summary.unchanged,1);assert.equal(p.summary.new,1);assert.equal((await save(text,p,two)).status,200);
 // Simultaneous CSV saves cannot route the same new ID into different weeks.
 text=csv([row('race')]);const ca={race:'2026-10-06'},cb={race:'2026-10-13'},pa=await preview(text,ca),pb=await preview(text,cb);const results=await Promise.all([save(text,pa,ca),save(text,pb,cb)]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal([...h.state.memory.entries()].filter(([k,x])=>k.startsWith('football-private-bets/week/')&&x.data?.bets?.some(b=>b.betId==='race')).length,1);
 console.log('PASS CSV auth, preview/save, full-ID cross-week lookup, date ambiguity, stale previews, payouts, settlement protection, duplicate detection, backup failure, partial retries, concurrent saves and real CSV idempotence');
})().catch(e=>{console.error(e);process.exitCode=1});
