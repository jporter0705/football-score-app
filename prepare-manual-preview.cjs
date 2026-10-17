// Generates a local-only review fixture using the real backend for all stages.
const fs=require('fs'),path=require('path'),h=require('./test-support-netlify.cjs')();
(async()=>{
const header=JSON.parse(fs.readFileSync('test-manual-event.json','utf8')),p=await h.moduleFor('_private'),game=(await h.moduleFor('game-match')).default;
const auth={cookie:'football_session='+p.session(),origin:'https://example.netlify.app'},week='2026-10-13',b={betId:'1006052157-3',sport:'College',league:'NCAA',structure:'straight',market:'spread',gameText:'San Jose State vs UTEP',awayTeam:'San Jose State',homeTeam:'UTEP',selection:'San Jose State',line:-7,odds:-102,eventDate:'2026-10-17',risk:40,toWin:39.22,betOnlineStatus:'PENDING',status:'PENDING',acceptedDate:'2026-10-17T03:40:00Z',description:'181 San Jose State -7 -102'};
await h.getStore('football-private-bets').setJSON('week/'+week,{week:{start:week},bets:[b,{...b,betId:'1006052157-5',line:7,selection:'UTEP',risk:25,toWin:22}]});h.state.onFetch=async()=>({ok:true,json:async()=>({header})});
const call=async body=>{const r=await game(h.request('game-match','POST',body,auth));const j=await r.json();if(r.status!==200)throw Error(j.error);return j};
const initial=await call({action:'previewSaved',betId:b.betId}),candidate=await call({action:'find',mode:'saved',targetKey:JSON.stringify([b.betId,0]),input:'401864523'});
const matches=Object.fromEntries(candidate.confirmations.map(x=>[x.key,{receipt:x.receipt,acknowledged:false}]));const staged=await call({action:'previewSaved',matches,betId:b.betId});
const fixture={initial,candidate,staged,saved:await call({action:'saveSaved',matches,betId:b.betId,token:staged.token})};fs.writeFileSync('manual-ui-fixture.json',JSON.stringify(fixture));
const mock=`<script>var fixture=${JSON.stringify(fixture).replaceAll('<','\\u003c')};var uiRequests=[];window.fetch=async function(url,opts){var b=opts&&opts.body?JSON.parse(opts.body):{};uiRequests.push(b);if(url==='/api/session')return {ok:true,json:async()=>({authenticated:true})};var j=b.action==='find'?fixture.candidate:b.action==='previewSaved'?Object.keys(b.matches||{}).length?fixture.staged:fixture.initial:fixture.saved;return {ok:true,json:async()=>structuredClone(j)};};</script>`;
let html=fs.readFileSync('dist/upload-bets.html','utf8').replace('<main>','<main><p style="color:#ffd28b">LOCAL TEST DATA · no production writes</p>');
html=html.replace(/<link rel="stylesheet" href="\/([^\"]+)">/g,(_,f)=>'<style>'+fs.readFileSync('dist/'+f,'utf8')+'</style>');
html=html.replace('<script src="/game-match-ui.js"></script>',mock+'<script>'+fs.readFileSync('dist/game-match-ui.js','utf8')+'</script>');
html=html.replace('<script type="module" src="/csv-import-ui.mjs"></script>','<script>(async()=>{'+fs.readFileSync('dist/csv-import-ui.mjs','utf8')+'})()</script>');
fs.writeFileSync('manual-review-preview.html',html);console.log('Prepared built-page local preview and real backend stage fixtures');
})();
