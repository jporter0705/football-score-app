import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
export const betStore=()=>getStore({name:'football-private-bets',consistency:'strong'});
export function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
const sign=value=>createHmac('sha256',process.env.BET_ACCESS_TOKEN||'').update(value).digest('hex');
export function session(){const expires=String(Date.now()+7*86400000);return expires+'.'+sign(expires);}
export function authorized(request){
  if(!process.env.BET_ACCESS_TOKEN)return false;
  const value=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('football_session='))?.slice(17)||'';
  const [expires,signature]=value.split('.');return Number(expires)>Date.now()&&equal(signature,sign(expires));
}
export function sameOrigin(request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
export async function readBets(key){return betStore().get('week/'+key,{type:'json'});}
export async function updateBlob(store,key,transform){
  for(let attempt=0;attempt<6;attempt++){
    const old=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
    const value=transform(old?.data);
    const result=await store.setJSON(key,value,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    // Some SDK versions report modified on non-412 errors; successful writes carry an ETag.
    if(result.modified&&result.etag)return value;
    if(result.modified)throw Error('Storage did not confirm the write');
  }
  throw Error('Concurrent update; retry');
}
