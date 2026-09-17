// Local-only preview and durable score archive. Never writes to the bet export repository.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const dataRoot = path.resolve(process.env.FOOTBALL_DATA_DIR || path.join(root, '..', 'football-score-data'));
const archiveRoot = path.join(root, 'data', 'score-history');
fs.mkdirSync(archiveRoot, {recursive:true});
const betArchiveRoot = path.join(root, 'data', 'bet-history');
fs.mkdirSync(betArchiveRoot, {recursive:true});
const pending = new Map();
function read(file, fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
function write(file,value){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file)}
function week(date=new Date()){const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+5)%7);const start=day(d),label=(d.getMonth()+1)+'/'+d.getDate();d.setDate(d.getDate()+6);return {start,end:day(d),label:label+'–'+(d.getMonth()+1)+'/'+d.getDate()}}
function day(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function valid(k){return /^\d{4}-\d{2}-\d{2}$/.test(k)&&week(new Date(k+'T12:00:00')).start===k}
function settled(b){return ['WON','LOST','PUSH','VOID','CANCELLED','CANCELED'].includes(String(b.betOnlineStatus||'').toUpperCase())}
function feed(k){
  const current=read(path.join(dataRoot,'current-week.json'),null),incoming=current&&current.week&&current.week.start===k?current:read(path.join(dataRoot,'weeks',k+'.json'),null);
  const file=path.join(betArchiveRoot,k+'.json'),old=read(file,null);if(!incoming)return old;
  const bets=new Map((old?.bets||[]).map(b=>[String(b.betId),b]));
  for(const b of incoming.bets||[]){const previous=bets.get(String(b.betId))||{},merged={...previous,...b};if(previous.legs){const legs=previous.legs.slice();(b.legs||[]).forEach((l,i)=>{const index=l.legNumber!=null?legs.findIndex(x=>x.legNumber===l.legNumber):i;if(index<0)legs.push(l);else legs[index]={...legs[index],...l}});merged.legs=legs}if(settled(previous)&&!settled(b)){merged.betOnlineStatus=previous.betOnlineStatus;merged.toWin=previous.toWin;merged.risk=previous.risk}bets.set(String(b.betId),merged)}
  const result={...old,...incoming,bets:[...bets.values()]};if(JSON.stringify(old)!==JSON.stringify(result))write(file,result);return result;
}
function snapshot(k){const scores=read(path.join(archiveRoot,k+'.json'),{week:week(new Date(k+'T12:00:00')),nfl:[],college:[],sources:{}});const bets=feed(k);return {...scores,bets:bets?bets.bets:[],sources:{...scores.sources,...(bets?{bets:{updatedAt:bets.generatedAt||new Date().toISOString()}}:{})}}}
async function refreshSource(k,source){
  if(source==='bets'){const j=feed(k);if(!j||!Array.isArray(j.bets))throw Error('No local BetOnline export for this week');return {items:j.bets,updatedAt:new Date().toISOString()}}
  const jobKey=k+source;if(pending.has(jobKey))return pending.get(jobKey);
  const job=(async()=>{
    const w=week(new Date(k+'T12:00:00')),league=source==='nfl'?'nfl':'college-football';
    const url='https://site.api.espn.com/apis/site/v2/sports/football/'+league+'/scoreboard?dates='+k.replaceAll('-','')+'-'+w.end.replaceAll('-','')+'&limit=1000'+(source==='college'?'&groups=80':'');
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('ESPN '+source+' HTTP '+response.status);
    const data=await response.json();if(!Array.isArray(data.events))throw Error('Invalid ESPN response');
    const file=path.join(archiveRoot,k+'.json'),h=read(file,{week:w,nfl:[],college:[],sources:{}}),games=new Map(h[source].map(e=>[e.id,e]));
    data.events.forEach(e=>games.set(e.id,e));h[source]=Array.from(games.values());h.sources[source]={updatedAt:new Date().toISOString()};write(file,h);
    return {items:h[source],updatedAt:h.sources[source].updatedAt};
  })();pending.set(jobKey,job);try{return await job}finally{pending.delete(jobKey)}
}
function keys(){const set=new Set([week().start]);const d=new Date();d.setDate(d.getDate()-7);set.add(week(d).start);for(const dir of [archiveRoot,betArchiveRoot,path.join(dataRoot,'weeks')]){if(fs.existsSync(dir))fs.readdirSync(dir).forEach(n=>{if(valid(n.replace('.json','')))set.add(n.replace('.json',''))})}const current=read(path.join(dataRoot,'current-week.json'),null);if(current?.week?.start&&valid(current.week.start))set.add(current.week.start);return [...set].sort()}
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='POST'&&req.headers.origin&&!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin))return send(res,403,{error:'Local requests only'});
    if(url.pathname==='/api/weeks')return send(res,200,{weeks:keys()});
    const m=url.pathname.match(/^\/api\/week\/(\d{4}-\d{2}-\d{2})(?:\/(nfl|college|bets))?$/);
    if(m&&valid(m[1])){if(!m[2])return send(res,200,snapshot(m[1]));if(req.method!=='POST')return send(res,405,{error:'POST required'});try{return send(res,200,await refreshSource(m[1],m[2]))}catch(e){const h=snapshot(m[1]);if(m[2]!=='bets'&&h[m[2]].length)return send(res,200,{items:h[m[2]],updatedAt:h.sources[m[2]]?.updatedAt,error:e.message});throw e}}
    const allowed={'/':'index.html','/index.html':'index.html','/weeks.js':'weeks.js','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png'};
    const file=allowed[url.pathname];if(!file){res.writeHead(404);return res.end('Not found')}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});fs.createReadStream(path.join(root,file)).pipe(res);
  }catch(e){send(res,502,{error:e.message})}
});
async function maintain(){// Refresh current and previous weeks; older final snapshots remain on disk.
  const today=new Date(),prev=new Date();prev.setDate(prev.getDate()-7);
  const all=keys(),last=week(prev).start,now=week(today).start;
  // Backfill missed weeks on the next launch; never prune stored weeks.
  for(let d=new Date(all[0]+'T12:00:00');day(d)<=now;d.setDate(d.getDate()+7)){const k=day(d);feed(k);const h=snapshot(k);for(const source of ['nfl','college']){if(k>=last||!h[source].length||h[source].some(e=>!(e.competitions?.[0]?.status?.type?.completed))){try{await refreshSource(k,source)}catch(e){console.error(source+' '+k+': '+e.message)}}}}
}
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>{console.log('Local preview: http://127.0.0.1:'+(process.env.PORT||4173));maintain()});
setInterval(maintain,5*60*1000).unref();
