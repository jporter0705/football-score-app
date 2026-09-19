// Dry-run by default. --upload requires a separately approved configured site.
import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2),upload=args.includes('--upload'),dir=args.find(x=>!x.startsWith('--'));
if(!dir)throw Error('Usage: node scripts/import-bets.mjs <local-export-directory> [--upload]');
const files=[];
try{for(const name of await readdir(path.join(dir,'weeks')))if(/^\d{4}-\d{2}-\d{2}\.json$/.test(name))files.push(path.join(dir,'weeks',name));}catch(e){if(e.code!=='ENOENT')throw e;}
files.push(path.join(dir,'current-week.json'));
const exports=[];
for(const file of files){const data=JSON.parse(await readFile(file,'utf8'));if(!/^\d{4}-\d{2}-\d{2}$/.test(data.week?.start||'')||!Array.isArray(data.bets)||data.bets.some(b=>typeof b.betId!=='string'||!b.betId))throw Error('Invalid export: '+file);exports.push(data);}
if(upload){
  const site=new URL(process.env.FOOTBALL_SITE_URL||'');if(site.protocol!=='https:'||!process.env.BET_IMPORT_TOKEN)throw Error('Set HTTPS FOOTBALL_SITE_URL and BET_IMPORT_TOKEN');
  for(const data of exports){const r=await fetch(new URL('/api/bets',site),{method:'POST',redirect:'error',headers:{authorization:'Bearer '+process.env.BET_IMPORT_TOKEN,'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Import failed: HTTP '+r.status);const result=await r.json();console.log(result.week+': imported '+result.count+' bets');}
}else for(const data of exports)console.log(data.week.start+': validated '+data.bets.length+' bets (dry run; no upload)');
