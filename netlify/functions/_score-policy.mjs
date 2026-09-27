export const finalEvent=e=>{const t=(e.competitions?.[0]?.status||e.status||{}).type||{};return t.completed===true||t.name==='STATUS_FINAL';};
export function dayFresh(meta,now=Date.now()){
  if(!meta||meta.error)return false;
  const ttl=meta.complete?86400000:meta.future?3600000:30000;
  return now-Date.parse(meta.updatedAt)<ttl;
}
export function dayMetadata(items,day){
  const now=Date.now(),past=Date.parse(day+'T23:59:59Z')<now-6*3600000;
  return {updatedAt:new Date(now).toISOString(),complete:past&&items.every(finalEvent),future:Date.parse(day+'T00:00:00Z')>now+86400000};
}
