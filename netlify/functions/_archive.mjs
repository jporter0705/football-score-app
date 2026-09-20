import { getStore } from '@netlify/blobs';
import { updateBlob } from './_private.mjs';

export const store = () => getStore('football-score-history');

export function isoDay(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export function bettingWeek(now=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'}))){
  const d=new Date(now);d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+5)%7);
  const start=isoDay(d),a=(d.getMonth()+1)+'/'+d.getDate();d.setDate(d.getDate()+6);
  return {start,end:isoDay(d),label:a+'–'+(d.getMonth()+1)+'/'+d.getDate()};
}
export function validWeek(k){return /^\d{4}-\d{2}-\d{2}$/.test(k)&&bettingWeek(new Date(k+'T12:00:00')).start===k;}
export function blankWeek(k){return {week:bettingWeek(new Date(k+'T12:00:00')),nfl:[],college:[],bets:[],sources:{}};}
export async function readWeek(k){return (await store().get('week/'+k,{type:'json',consistency:'strong'}))||blankWeek(k);}
export async function writeWeek(k,value){return updateBlob(store(),'week/'+k,old=>{const next={...old,...value,sources:{...old?.sources}};for(const name of ['nfl','college']){const incoming=value.sources?.[name],prior=old?.sources?.[name];if(!prior?.updatedAt||!incoming?.updatedAt||incoming.updatedAt>=prior.updatedAt){next[name]=mergeGames(old?.[name],value[name]);if(incoming)next.sources[name]=incoming;}else next[name]=old[name];}return next;});}
export function mergeGames(oldItems=[],incoming=[]){const m=new Map(oldItems.map(x=>[String(x.id),x]));incoming.forEach(x=>m.set(String(x.id),x));return [...m.values()];}
export function settled(b){return ['WON','LOST','PUSH','VOID','CANCELLED','CANCELED'].includes(String(b.betOnlineStatus||'').toUpperCase());}
export function mergeBets(oldItems=[],incoming=[]){
  const m=new Map(oldItems.map(b=>[String(b.betId),b]));
  for(const b of incoming){const prev=m.get(String(b.betId))||{},merged={...prev,...b};
    if(Array.isArray(b.legs)){
      if(b.replaceLegs) merged.legs=b.legs.map(x=>({...x}));
      else if(prev.legs){const legs=prev.legs.slice();b.legs.forEach((l,i)=>{let n=l.legNumber!=null?legs.findIndex(x=>x.legNumber===l.legNumber):i;if(n<0&&l.legNumber!=null)n=Number(l.legNumber)-1;if(n<0)legs.push(l);else{const prior=legs[n]||{};legs[n]={...prior,...l};if(settled({betOnlineStatus:prior.status})&&!settled({betOnlineStatus:l.status}))legs[n].status=prior.status;}});merged.legs=legs;}
      else merged.legs=b.legs;
    }
    delete merged.replaceLegs;
    if(settled(prev)&&!settled(b)){merged.betOnlineStatus=prev.betOnlineStatus;merged.toWin=prev.toWin;merged.risk=prev.risk;merged.sourceSnapshot=prev.sourceSnapshot;merged.gradedDate=prev.gradedDate;}
    m.set(String(b.betId),merged);
  }return [...m.values()];
}
export async function listWeeks(){
  const found=new Set([bettingWeek().start]);let cursor;
  do{const page=await store().list({prefix:'week/',cursor});for(const b of page.blobs){const k=b.key.slice(5);if(validWeek(k))found.add(k);}cursor=page.next_cursor;}while(cursor);
  return [...found].sort();
}
export function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
