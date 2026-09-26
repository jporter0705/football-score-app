// Classify only from each leg's own evidence, never an inherited parent sport.
export function canonicalSport(value){
  const s=String(value||'').trim().toLowerCase();
  if(s==='nfl'||s.includes('national football'))return 'NFL';
  if(s==='college'||s==='ncaa'||s==='ncaaf'||s.includes('college'))return 'College';
  return '';
}
export function ownSport(item={}){
  if(!item||typeof item!=='object')return '';
  const explicit=canonicalSport(item.sport)||canonicalSport(item.league);
  if(explicit)return explicit;
  const text=[item.raw,item.description,item.rawWager,item.rawRow,item.gameText].filter(Boolean).join(' ');
  const college=/\bNCAA(?:F)?\b|college football/i.test(text),nfl=/\bNFL\b/i.test(text);
  return college===nfl?'':college?'College':'NFL';
}
export function normalizeParentSport(b){
  if(!b||!Array.isArray(b.legs)||!b.legs.length)return b;
  const sports=b.legs.map(ownSport),sport=sports[0];
  if(!sport||!sports.every(s=>s===sport))return b;
  return {...b,sport,league:sport==='College'?'NCAA':'NFL'};
}
