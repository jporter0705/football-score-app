import { getStore } from '@netlify/blobs';

export const store = () => getStore('football-score-history');

export function isoDay(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export function bettingWeek(now=new Date()){
  const d=new Date(now);d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+5)%7);
  const start=isoDay(d),a=(d.getMonth()+1)+'/'+d.getDate();d.setDate(d.getDate()+6);
  return {start,end:isoDay(d),label:a+'–'+(d.getMonth()+1)+'/'+d.getDate()};
}
export function validWeek(k){return /^\d{4}-\d{2}-\d{2}$/.test(k)&&bettingWeek(new Date(k+'T12:00:00')).start===k;}
export function blankWeek(k){return {week:bettingWeek(new Date(k+'T12:00:00')),nfl:[],college:[],bets:[],sources:{}};}
export async function readWeek(k){return (await store().get('week/'+k,{type:'json',consistency:'strong'}))||blankWeek(k);}
export async function writeWeek(k,value){await store().setJSON('week/'+k,value);return value;}
export function mergeGames(oldItems=[],incoming=[]){const m=new Map(oldItems.map(x=>[String(x.id),x]));incoming.forEach(x=>m.set(String(x.id),x));return [...m.values()];}
export function settled(b){return ['WON','LOST','PUSH','VOID','CANCELLED','CANCELED'].includes(String(b.betOnlineStatus||'').toUpperCase());}
export function mergeBets(oldItems=[],incoming=[]){
  const m=new Map(oldItems.map(b=>[String(b.betId),b]));
  for(const b of incoming){const prev=m.get(String(b.betId))||{},merged={...prev,...b};
    if(prev.legs){const legs=prev.legs.slice();(b.legs||[]).forEach((l,i)=>{const n=l.legNumber!=null?legs.findIndex(x=>x.legNumber===l.legNumber):i;if(n<0)legs.push(l);else legs[n]={...legs[n],...l};});merged.legs=legs;}
    if(settled(prev)&&!settled(b)){merged.betOnlineStatus=prev.betOnlineStatus;merged.toWin=prev.toWin;merged.risk=prev.risk;}
    m.set(String(b.betId),merged);
  }return [...m.values()];
}
export async function listWeeks(){
  const found=new Set([bettingWeek().start]);let cursor;
  do{const page=await store().list({prefix:'week/',cursor});for(const b of page.blobs){const k=b.key.slice(5);if(validWeek(k))found.add(k);}cursor=page.next_cursor;}while(cursor);
  return [...found].sort();
}
export function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
