import { canonicalSport, ownSport, normalizeParentSport } from './_bet-sport.mjs';

const aliases={bet_id:'betId',accepted_date:'acceptedDate',graded_date:'gradedDate',to_win:'toWin',bet_online_status:'betOnlineStatus',raw_wager:'rawWager',raw_row:'rawRow',game_text:'gameText',leg_number:'legNumber',prop_type:'propType',espn_event_id:'espnEventId',away_team:'awayTeam',home_team:'homeTeam',event_date:'eventDate',event_time:'eventTime',event_start:'eventStart',leg_count:'legCount'};
const metadata=['sport','league','espnEventId','awayTeam','homeTeam','player','propType','market','selection','description','eventDate','eventStart'];
const clean=s=>String(s??'').replace(/½/g,'.5').replace(/¼/g,'.25').replace(/¾/g,'.75').replace(/\s+/g,' ').trim();
const name=s=>clean(s).toLowerCase().replace(/[.'’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export function canonicalFields(input={}){
  const x={...input};for(const [from,to] of Object.entries(aliases)){if(x[to]==null||x[to]==='')if(x[from]!=null)x[to]=x[from];delete x[from];}
  for(const key of ['risk','toWin','line','odds','legNumber'])if(x[key]!=null&&x[key]!==''){const n=Number(clean(x[key]).replace(/[$,]/g,''));if(Number.isFinite(n))x[key]=n;}
  if(x.betId!=null)x.betId=String(x.betId).trim();
  if(Array.isArray(x.legs))x.legs=x.legs.map(l=>l&&typeof l==='object'&&!Array.isArray(l)?canonicalFields(l):l);
  return x;
}
export function validateRecords(bets){
  for(const b of bets){
    if(b.legs!=null&&(!Array.isArray(b.legs)||b.legs.length>100||b.legs.some(l=>!l||typeof l!=='object'||Array.isArray(l))))throw Error('Invalid bet legs');
    for(const item of [b,...(b.legs||[])])for(const k of ['risk','toWin','line','odds'])if(item[k]!=null&&item[k]!==''){
      if(typeof item[k]!=='number'||!Number.isFinite(item[k])||(['risk','toWin'].includes(k)&&item[k]<0))throw Error('Invalid '+k);
    }
  }
}
function blend(old={},incoming={}){
  const x={...old,...incoming};for(const key of metadata)if(incoming[key]==null||incoming[key]==='')if(old[key]!=null)x[key]=old[key];
  return x;
}
function teamsFrom(text){
  const s=clean(text).replace(/^FOOTBALL\s*-\s*(?:NFL|NCAA)\s*-\s*/i,'').replace(/^(?:NFL|NCAAF) Game Props\s*-\s*/i,'');
  const m=s.match(/^(.+?)\s+(?:@|at|v|vs\.?|versus)\s+(.+?)(?:\s+-\s+|\s*\||$)/i);
  return m?{awayTeam:m[1],homeTeam:m[2]}:{};
}
function teamMatches(c,value){const t=c?.team||{},n=name(value);return !!n&&[t.location,t.displayName,t.shortDisplayName,t.name,t.abbreviation].some(v=>name(v)===n);}
export function resolveMatch(item,scores={}){
  const pools=[['NFL',scores.nfl||[]],['College',scores.college||[]]];
  const sport=canonicalSport(item.sport||item.league);
  if(sport)pools.sort((a,b)=>(a[0]===sport?-1:1));
  for(const [sp,pool] of pools){
    let matches=[];
    if(item.espnEventId)matches=pool.filter(e=>String(e.id)===String(item.espnEventId));
    if(!matches.length){
      if(sp!==sport&&sport)continue;
      matches=pool.filter(e=>{const cs=e.competitions?.[0]?.competitors||[];
        if(item.awayTeam&&item.homeTeam)return cs.some(c=>teamMatches(c,item.awayTeam))&&cs.some(c=>teamMatches(c,item.homeTeam))&&!teamMatches(cs.find(c=>teamMatches(c,item.awayTeam)),item.homeTeam);
        return !item.legs?.length&&['spread','moneyline'].includes(item.market)&&cs.some(c=>teamMatches(c,item.selection));
      });
    }
    if(matches.length===1){const e=matches[0],cs=e.competitions?.[0]?.competitors||[],away=cs.find(c=>c.homeAway==='away')?.team,home=cs.find(c=>c.homeAway==='home')?.team;
      if(away&&home)return{espnEventId:String(e.id),sport:sp,league:sp==='NFL'?'NFL':'NCAA',awayTeam:away.displayName||away.shortDisplayName,homeTeam:home.displayName||home.shortDisplayName};}
  }
  return null;
}
function normalizeItem(input,parent={},previous={}){
  const x=blend(previous,canonicalFields(input)),raw=clean(x.raw||x.description||x.selection),text=clean([x.description,x.raw,x.rawRow,x.gameText].filter(Boolean).join(' '));
  x.sport=ownSport(x)||parent.sport||canonicalSport(previous.sport)||(/\b(NCAA|NCAAF|college)\b/i.test(text)?'College':/\bNFL\b/i.test(text)?'NFL':undefined);
  // Keep a previously expanded player name when a later export abbreviates it.
  if(previous.player&&x.player){const a=name(x.player).split(' '),p=name(previous.player).split(' ');if(a[0]?.length===1&&a[0]===p[0]?.[0]&&a.slice(1).join(' ')===p.slice(1).join(' '))x.player=previous.player;}
  if(x.sport)x.league=x.sport==='NFL'?'NFL':'NCAA';
  const pair=teamsFrom(x.gameText||raw);x.awayTeam=x.awayTeam||pair.awayTeam||parent.awayTeam;x.homeTeam=x.homeTeam||pair.homeTeam||parent.homeTeam;
  if(parent.structure==='same_game_parlay'&&!x.espnEventId)x.espnEventId=parent.espnEventId;
  if(!x.market&&/spread/i.test(x.type||''))x.market='spread';if(!x.market&&/moneyline/i.test(x.type||''))x.market='moneyline';if(!x.market&&/total/i.test(x.type||''))x.market='total';
  const ml=raw.match(/money\s*line\s*-\s*(.+?)(?:\s*\(|$)/i);
  if(ml){x.market='moneyline';x.selection=ml[1];}
  const td=raw.match(/(?:Player TDs\s*-\s*)?([^|]+?)\s+(?:Score anytime|Score a Touchdown|anytime TD)/i);
  if(td||x.propType==='anytime_td'){x.market='player_prop';x.propType='anytime_td';x.player=x.player||td?.[1];x.line=.5;}
  const stat=raw.match(/(?:Player stats\s*-\s*)?(.+?)\s+(\d+(?:\.\d+)?)\+\s+(Rushing yds|Receiving yds|Passing yds|Passing TDs(?: thrown)?|Rushing TDs|Receiving TDs|Total TDs|Pass interceptions?|Receptions?)/i);
  if(stat){x.market='player_prop';x.player=x.player||stat[1];x.propType=x.propType||({'rushing yds':'rushing_yards','receiving yds':'receiving_yards','passing yds':'passing_yards'}[stat[3].toLowerCase()]||(/td/i.test(stat[3])?stat[3].toLowerCase().split(' ')[0]+'_tds_gte':/interception/i.test(stat[3])?'passing_interceptions':'receptions'));if(!x.side||x.side==='gte'){x.line=Number(stat[2]);x.side='gte';}}
  if(x.market==='player_prop'&&x.side==='gte'&&!String(x.propType).endsWith('_gte')&&Number.isFinite(x.line)){x.line-=.5;x.side='over';}
  if(x.market==='total'&&!x.awayTeam){const m=raw.match(/^(?:FOOTBALL\s*-\s*)?\d*\s*(.+?)\/(.+?)\s+(over|under)\s+/i);if(m){x.awayTeam=m[1];x.homeTeam=m[2];x.side=x.side||m[3].toLowerCase();}}
  if(!x.market){const total=raw.match(/Total points\s*-\s*(Over|Under)\s+([\d.]+)/i);if(total){x.market='total';x.selection=total[1].toLowerCase();x.side=x.selection;x.line=Number(total[2]);}}
  if(x.selection)x.selection=clean(x.selection);return x;
}
export function normalizeBet(input,scores={},previous={}){
  const incoming=canonicalFields(input);let x=normalizeItem(incoming,{},previous);
  const type=String(x.type||x.structure||'').toLowerCase();
  x.structure=/same.?game/.test(type)?'same_game_parlay':/teaser/.test(type)?'teaser':/parlay/.test(type)?'parlay':x.structure||(x.legs?.length>1?'parlay':'straight');
  const resolved=resolveMatch(x,scores);if(resolved)Object.assign(x,resolved);
  const legs=Array.isArray(incoming.legs)&&incoming.legs.length?incoming.legs:previous.legs||x.legs;
  if(Array.isArray(legs)){x.legs=legs.map((l,i)=>{const num=l.legNumber??i+1,old=(previous.legs||[]).find((p,j)=>(p.legNumber??j+1)===num)||{};const leg=normalizeItem({...l,legNumber:num},x,old);const match=resolveMatch(leg,scores);if(match)Object.assign(leg,match);return leg;});}
  if(x.structure==='same_game_parlay'&&x.espnEventId)(x.legs||[]).forEach(l=>{if(l.espnEventId&&l.espnEventId!==x.espnEventId)l.matchIssue='Leg points to a different game';else delete l.matchIssue;});
  if(!resolved)x=normalizeParentSport(x);delete x.replaceLegs;
  return Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined));
}
export function reconcileBets(old=[],incoming=[],scores={}){const existing=new Map(old.map(b=>[String(b.betId),b]));return incoming.map(b=>normalizeBet(b,scores,existing.get(String(b.betId))||{}));}
