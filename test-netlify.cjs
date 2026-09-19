const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const memory=new Map();let revision=0,conflict=false;
function getStore(options){const name=typeof options==='string'?options:options.name;
  const key=k=>name+'/'+k;
  return {get:async k=>structuredClone(memory.get(key(k))?.data||null),getWithMetadata:async k=>structuredClone(memory.get(key(k))||null),
    setJSON:async(k,data,condition)=>{const old=memory.get(key(k));if(conflict){conflict=false;return {modified:false};}if(condition?.onlyIfNew&&old||condition?.onlyIfMatch&&condition.onlyIfMatch!==old?.etag)return {modified:false};memory.set(key(k),{data:structuredClone(data),etag:String(++revision)});return {modified:true,etag:String(revision)};},
    list:options=>{const blobs=[...memory.keys()].filter(k=>k.startsWith(name+'/'+(options.prefix||''))).map(k=>({key:k.slice(name.length+1)}));return options.paginate?{async *[Symbol.asyncIterator](){yield {blobs}}}:Promise.resolve({blobs});}};
}
const env={BET_ACCESS_TOKEN:'test-access-key',BET_IMPORT_TOKEN:'test-import-key'};
let failESPN=false,fetchCount=0;
const context=vm.createContext({console,Date,Map,Set,Number,String,Array,JSON,Math,Promise,Buffer,Intl,Response,Request,URL,AbortSignal,process:{env},
  fetch:async()=>{fetchCount++;if(failESPN)throw Error('offline');return {ok:true,json:async()=>({events:[{id:'123',date:new Date().toISOString()}]})}}});
const cache=new Map();
async function load(name){
  if(cache.has(name))return cache.get(name);
  let mod;if(name==='@netlify/blobs')mod=new vm.SyntheticModule(['getStore'],function(){this.setExport('getStore',getStore)},{context});
  else if(name==='node:crypto'){const crypto=require(name);mod=new vm.SyntheticModule(['createHmac','timingSafeEqual'],function(){this.setExport('createHmac',crypto.createHmac);this.setExport('timingSafeEqual',crypto.timingSafeEqual)},{context});}
  else mod=new vm.SourceTextModule(fs.readFileSync(name,'utf8'),{context,identifier:name});
  cache.set(name,mod);await mod.link((specifier,parent)=>load(specifier.startsWith('.')?path.resolve(path.dirname(parent.identifier),specifier):specifier));return mod;
}
async function moduleFor(name){const m=await load(path.resolve('netlify/functions/'+name+'.mjs'));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}
const request=(route,method='GET',body,headers={})=>new Request('https://example.netlify.app/api/'+route,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
  const api=await moduleFor('_archive'),privateApi=await moduleFor('_private'),session=(await moduleFor('session')).default,archive=(await moduleFor('archive')).default,bets=(await moduleFor('bets')).default,refresh=(await moduleFor('refresh')).default,live=(await moduleFor('live')).default;
  const week=api.bettingWeek(),key=week.start;
  const inWeek=(await moduleFor('live')).inWeek;
  assert.equal(inWeek({date:'2026-09-15T03:00:00Z'},{start:'2026-09-15',end:'2026-09-21'}),false,'Monday night stays in previous week');
  assert.equal(inWeek({date:'2026-09-15T18:00:00Z'},{start:'2026-09-15',end:'2026-09-21'}),true);
  await api.writeWeek(key,{week,nfl:[{id:'old'}],college:[],bets:[{betId:'legacy'}],sources:{}});
  let response=await archive(request('archive?week='+key));assert.deepEqual((await response.json()).bets,[]);
  assert.equal((await bets(request('bets','POST',{week,bets:[]}))).status,401);
  assert.equal((await session(request('session','POST',{key:'wrong'}))).status,401);
  assert.equal((await session(request('session','POST',{key:env.BET_ACCESS_TOKEN},{origin:'https://evil.example'}))).status,403);
  response=await session(request('session','POST',{key:env.BET_ACCESS_TOKEN}));assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.equal(privateApi.authorized(request('archive','GET',null,{cookie})),true);
  assert.equal(privateApi.authorized(request('archive','GET',null,{cookie:cookie+'tampered'})),false);
  const headers={authorization:'Bearer '+env.BET_IMPORT_TOKEN};
  response=await bets(request('bets','POST',{week,bets:[{betId:'a',betOnlineStatus:'WON',risk:10,toWin:15,legs:[{legNumber:1,raw:'preserved'}]}]},headers));assert.equal(response.status,200);
  conflict=true;response=await bets(request('bets','POST',{week,bets:[{betId:'a',betOnlineStatus:'PENDING',legs:[]},{betId:'b'}]},headers));assert.equal(response.status,200);
  response=await archive(request('archive?week='+key,'GET',null,{cookie}));const data=await response.json();assert.equal(data.bets.length,2);assert.equal(data.bets[0].betOnlineStatus,'WON');assert.equal(data.bets[0].legs[0].raw,'preserved');
  response=await archive(request('archive?week='+key));assert.equal((await response.json()).bets.length,0);
  assert.equal((await bets(request('bets','POST',{week,bets:[{betId:'x'},{betId:'x'}]},headers))).status,400);
  const before=fetchCount;await refresh(request('refresh?week='+key,'POST'));assert.equal(fetchCount-before,14);
  const now=fetchCount;await live(request('live?week='+key,'POST'));assert.equal(fetchCount-now,4);
  const stored=await api.readWeek(key);assert.equal(stored.nfl.length,2);
  failESPN=true;await live(request('live?week='+key,'POST'));const failed=await api.readWeek(key);assert.equal(failed.nfl.length,2);assert.equal(failed.sources.nfl.updatedAt,stored.sources.nfl.updatedAt);assert.match(failed.sources.nfl.error,/offline/);
  response=await live(request('live?week=2020-09-08','POST'));assert.equal((await response.json()).skipped,'historical week');
  assert.equal((await refresh(request('refresh?week=bad','POST'))).status,400);
  assert.equal((await session(request('session','DELETE'))).status,204);
  delete env.BET_ACCESS_TOKEN;assert.equal(privateApi.authorized(request('archive','GET',null,{cookie})),false);
  console.log('PASS private read/write authorization, cookie security, legacy redaction, import validation, settled-leg preservation, conflict retry, full/live fetch counts, retained scores and timestamps on failure');
})().catch(e=>{console.error(e);process.exitCode=1});
