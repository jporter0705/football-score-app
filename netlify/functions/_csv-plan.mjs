import { csvRows, date, weekFor } from '../../csv-records.mjs';
import { canonicalFields, normalizeBet, validateRecords } from './_bet-normalize.mjs';
import { ownSport } from './_bet-sport.mjs';

const statuses = new Set(['PENDING','WON','LOST','PUSH','VOID','CANCELLED','CANCELED']);
const stable = value => JSON.stringify(sort(value));
function sort(v) {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])]));
  return v;
}
export { stable };
function amount(v, name) {
  if (v == null || String(v).trim() === '') throw Error('Missing '+name);
  const n = Number(String(v).replace(/[$,]/g,''));
  if (!Number.isFinite(n) || n < 0) throw Error('Invalid '+name);
  return n;
}
function recoverTeamTotal(row) {
  if(!/^Straight bet selection\/market not parsed;?\s*$/.test(row.extraction_error||'')||!/^(Live|Straight)$/i.test(row.type||'')||Number(row.leg_count||0)!==0)return null;
  const m=String(row.description||'').match(/^(?:Mobile\s*-\s*)?(.+?) at (.+?) - (.+?) - Team Total - (OVER|UNDER) (\d+(?:\.\d+)?)$/i);
  if(!m||![m[1],m[2]].some(t=>t.trim().toLowerCase()===m[3].trim().toLowerCase()))return null;
  return {...row,market:'team_total',selection:m[3].trim(),side:m[4].toLowerCase(),line:m[5],game_text:m[1]+' at '+m[2],extraction_error:''};
}
function parse(row) {
  if (!/^[\w-]{1,80}$/.test(row.bet_id || '')) throw Error('Missing or invalid Bet ID');
  const status = String(row.status || '').toUpperCase();
  if (!statuses.has(status)) throw Error('Unknown settlement status');
  const acceptedDate = date(row.accepted_date);
  const b = {betId:row.bet_id, acceptedDate, risk:amount(row.risk,'risk'), toWin:amount(row.to_win,'to win'), status, betOnlineStatus:status};
  for (const k of ['type','description','market','selection','side','period','graded_date','raw_row','game_text']) if (row[k] && row[k] !== 'N/A') b[k] = row[k];
  for (const k of ['line','odds']) if (row[k] !== '' && row[k] != null) {
    b[k] = Number(row[k]); if (!Number.isFinite(b[k])) throw Error('Invalid '+k);
  }
  let legs;
  try { legs = JSON.parse(row.legs_json || '[]'); } catch { throw Error('Unreadable wager legs'); }
  if (!Array.isArray(legs) || legs.some(l => !l || typeof l !== 'object' || Array.isArray(l))) throw Error('Invalid wager legs');
  if (row.leg_count && Number(row.leg_count) !== legs.length) throw Error('Leg count does not match');
  if (/parlay|teaser/i.test(row.type) && legs.length < 2) throw Error('Missing parlay or teaser legs');
  if (legs.length) b.legs = legs.map((l,i) => canonicalFields(Object.fromEntries(Object.entries({...l,legNumber:i+1}).filter(([,v]) => v !== null && v !== ''))));
  const sport = ownSport({...b,rawRow:row.raw_row}); if (sport) b.sport = sport;
  b.source = 'betonline-csv';
  const out = canonicalFields(b); validateRecords([out]); return out;
}
function weekFromDay(day) {
  try { return weekFor(date(day)).start; } catch { return null; }
}
function chooseWeek(b, weeks, explicit) {
  if (explicit) return {week:explicit};
  const dates = [...new Set((b.legs || []).map(l => l.eventDate).filter(Boolean))];
  const eventWeeks = [...new Set(dates.map(weekFromDay).filter(Boolean))];
  if (eventWeeks.length === 1) return {week:eventWeeks[0]};
  const acceptedWeek = weekFor(b.acceptedDate).start;
  if(String(b.type).toLowerCase()==='live')return {week:acceptedWeek};
  // Consider this week and the following week: bets may be placed before Tuesday.
  const candidates = weeks.filter(w => w.week >= acceptedWeek && w.week <= new Date(Date.parse(acceptedWeek+'T12:00:00Z')+7*86400000).toISOString().slice(0,10))
    .filter(w => normalizeBet(b,w.scores).espnEventId);
  if (candidates.length === 1) return {week:candidates[0].week};
  return {week:null,suggestedWeek:acceptedWeek,reason:'Choose the game week. The placement date alone cannot establish it.'};
}
function mergedRecord(previous, incoming, scores) {
  const b = {...incoming};
  // Zero on a losing ticket is a settlement display, not the original potential payout.
  if (previous && b.betOnlineStatus === 'LOST' && b.toWin === 0 && previous.toWin > 0) b.toWin = previous.toWin;
  if (previous?.description) b.description = previous.description;
  if (!b.description) b.description = b.legs?.length ? b.legs.length+'-leg '+b.type : b.selection || b.rawRow;
  if (!b.description) throw Error('Missing wager description');
  // An older pending export must not undo an official settled record.
  if (previous && previous.betOnlineStatus !== 'PENDING' && statuses.has(previous.betOnlineStatus) && b.betOnlineStatus === 'PENDING') {
    for (const k of ['status','betOnlineStatus','risk','toWin','gradedDate']) if (previous[k] != null) b[k] = previous[k];
  }
  if (previous?.legs && b.legs) b.legs = b.legs.map((leg,i) => {
    const old = previous.legs.find((l,j) => (l.legNumber ?? j+1) === leg.legNumber);
    if (old && statuses.has(old.status) && old.status !== 'PENDING' && (!leg.status || leg.status === 'PENDING')) return {...leg,status:old.status};
    return leg;
  });
  return normalizeBet(b,scores,previous || {});
}
export function makePlan(csv, weeks, choices = {}) {
  const rows = csvRows(csv);
  if (!rows.length || rows.length > 500) throw Error('Choose a CSV containing 1–500 wagers');
  const existing = new Map(), counts = new Map();
  for (const w of weeks) for (const b of w.bets) {
    const id = String(b.betId); if (!existing.has(id)) existing.set(id,[]); existing.get(id).push({week:w.week,bet:b});
  }
  for (const row of rows) counts.set(row.bet_id,(counts.get(row.bet_id)||0)+1);
  const items = rows.map((row,index) => {
    const item = {row:index+2,betId:row.bet_id || '',description:row.description || row.raw_row || '',action:'review'};
    try {
      if (counts.get(row.bet_id) > 1) throw Error('Duplicate Bet ID in this CSV');
      const recovered=recoverTeamTotal(row);
      const input=recovered||row;
      const b = parse(input), matches = existing.get(b.betId) || [];
      if (matches.length > 1) throw Error('This Bet ID is already saved in multiple weeks; resolve it before importing');
      if (input.extraction_error) throw Error('Exporter warning: '+input.extraction_error);
      if(recovered)item.notice='Team total recovered from the complete wager description.';
      const prior = matches[0], destination = prior ? {week:prior.week} : chooseWeek(b,weeks,Object.hasOwn(choices,b.betId)?choices[b.betId]:null);
      Object.assign(item,destination,{existing:!!prior,risk:b.risk,status:b.betOnlineStatus});
      if (!destination.week) return item;
      const w = weeks.find(w => w.week === destination.week), next = mergedRecord(prior?.bet,b,w?.scores || {});
      item.after = next; item.before = prior?.bet || null; item.description = next.description;
      item.action = !prior ? 'new' : stable(next) === stable(prior.bet) ? 'unchanged' : 'updated';
      item.changes = prior ? Object.keys(next).filter(k => stable(next[k]) !== stable(prior.bet[k])) : [];
      return item;
    } catch (e) { item.reason = e.message; return item; }
  });
  const summary = {new:0,updated:0,unchanged:0,review:0}; items.forEach(i => summary[i.action]++);
  return {items,summary,count:rows.length};
}
