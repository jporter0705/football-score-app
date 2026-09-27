import { randomUUID } from 'node:crypto';
import { betStore } from './_private.mjs';

// Back up the exact CAS preimage before writing. On conflict an extra recovery
// point can remain, but no successfully changed version can lack a backup.
export async function updatePrivateBets(week,transform,{reason='import',expectedRevision}={}){
  const store=betStore(),key='week/'+week;
  for(let attempt=0;attempt<6;attempt++){
    const old=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
    if(expectedRevision!==undefined&&(old?.etag||'empty')!==expectedRevision)throw Object.assign(Error('Bets changed; reload before restoring'),{status:409});
    const value=transform(old?.data);
    if(value===old?.data)return value;
    const createdAt=new Date().toISOString(),backupId=createdAt+'_'+randomUUID();
    const backup={week,backupId,createdAt,reason,sourceRevision:old?.etag||'empty',snapshot:old?.data||{week:{start:week},bets:[]}};
    const saved=await store.setJSON('backup/'+week+'/'+backupId,backup,{onlyIfNew:true,metadata:{createdAt,reason,count:backup.snapshot.bets?.length||0}});
    if(!saved.modified||!saved.etag)throw Error('Recovery copy could not be confirmed; bets were not changed');
    const result=await store.setJSON(key,value,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(result.modified&&result.etag)return value;
    if(result.modified)throw Error('Storage did not confirm the write');
  }
  throw Object.assign(Error('Concurrent update; retry'),{status:409});
}
