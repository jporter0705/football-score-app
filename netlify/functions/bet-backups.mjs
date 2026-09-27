import { authorized,sameOrigin,betStore } from './_private.mjs';
import { validWeek,json } from './_archive.mjs';
import { updatePrivateBets } from './_bet-backups.mjs';
const validId=id=>/^\d{4}-\d\d-\d\dT[\d:.]+Z_[a-f0-9-]{36}$/.test(id||'');
export default async request=>{
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  if(!sameOrigin(request))return json({error:'Forbidden'},403);
  if(!authorized(request))return json({error:'Unlock private bets first'},401);
  try{
    const u=new URL(request.url),store=betStore();
    const body=request.method==='POST'?JSON.parse(await request.text()):null;
    const week=body?.week||u.searchParams.get('week'),backupId=body?.backupId||u.searchParams.get('backup');
    if(!validWeek(week))return json({error:'Invalid week'},400);
    if(backupId&&!validId(backupId))return json({error:'Invalid backup'},400);
    if(request.method==='GET'&&!backupId){
      const cursor=u.searchParams.get('cursor')||undefined,page=await store.list({prefix:'backup/'+week+'/',cursor});
      return json({backups:page.blobs.map(b=>({backupId:b.key.split('/').pop()})),nextCursor:page.next_cursor||null});
    }
    if(!backupId)return json({error:'Choose a backup'},400);
    const backup=await store.get('backup/'+week+'/'+backupId,{type:'json',consistency:'strong'});
    if(!backup)return json({error:'Backup not found'},404);
    const current=await store.getWithMetadata('week/'+week,{type:'json',consistency:'strong'});
    if(request.method==='GET')return json({...backup,currentRevision:current?.etag||'empty',currentCount:current?.data?.bets?.length||0});
    if(!body.expectedRevision||body.confirmRestore!==true)return json({error:'Review the backup and confirm restore first'},400);
    const restored=await updatePrivateBets(week,()=>({...backup.snapshot,generatedAt:new Date().toISOString()}),{reason:'restore',expectedRevision:body.expectedRevision});
    return json({ok:true,week,count:restored.bets.length});
  }catch(e){return json({error:e.message||'Recovery unavailable'},e.status||503);}
};
export const config={path:'/api/bet-backups'};
