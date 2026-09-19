const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={},storage=new Map();
const context={console,Date,Map,Set,Number,String,Array,JSON,Math,Promise,AbortSignal,URLSearchParams,encodeURIComponent,
 location:{hostname:'example.netlify.app',search:''},navigator:{},window:{addEventListener(){}},setInterval(){},setTimeout,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 document:{hidden:false,addEventListener(){},getElementById:id=>elements[id]||(elements[id]={style:{},parentElement:{},setAttribute(k,v){this[k]=v}}),querySelectorAll:()=>[]},
 fetch:async url=>({ok:true,json:async()=>url.includes('index.json')?{weeks:['2026-09-08','2026-09-15']}:url.includes('scoreboard')?{events:[]}:{week:context.bettingWeek(),bets:[]}})};
vm.createContext(context);
const html=fs.readFileSync(__dirname+'/index.html','utf8');
for(const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
 const source=script[1].includes('src=')?fs.readFileSync(__dirname+'/'+script[1].match(/src="([^"]+)"/)[1],'utf8'):script[2];
 vm.runInContext(source,context);
}
setImmediate(()=>{try{
 assert.equal(context.localPreview,false);assert.equal(context.sampleRankings,false);assert.equal(elements.sampleRankings.parentElement.hidden,true);
 assert.equal(context.selectedWeek.start,context.bettingWeek().start);assert.equal(context.S.bets.length,0);
 assert.match(html,/build v4\.7\.1/);assert.match(html,/\.preview-tools\[hidden\]\{display:none\}/);
 assert.doesNotMatch(html,/BET_URL|connectionCheck|site\.api\.espn|score-feed\.js/);
 assert.equal(JSON.parse(fs.readFileSync(__dirname+'/manifest.webmanifest')).theme_color,'#0B162A');
 console.log('PASS hosted startup, real-data default, current week, hidden sample controls, release version and manifest');
 }catch(e){console.error(e);process.exitCode=1}});
