// CSV and Pacific betting-week utilities. No AI or external requests.
export function csvRows(text){
  text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c==='"'){if(field||closed)throw Error('Invalid CSV quote');quoted=true;}
    else if(c===','||c==='\n'||c==='\r'){row.push(field);field='';closed=false;if(c!==','){if(row.some(x=>x!==''))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}
    else {if(closed)throw Error('Unexpected text after CSV quote');field+=c;}
  }
  if(quoted)throw Error('Unclosed CSV quote');
  row.push(field);if(row.some(x=>x!==''))rows.push(row);
  const headers=rows.shift();if(!headers||new Set(headers).size!==headers.length)throw Error('Missing or duplicate CSV headers');
  for(const h of ['bet_id','accepted_date','risk','to_win','status'])if(!headers.includes(h))throw Error('Missing CSV column: '+h);
  return rows.map((r,i)=>{if(r.length!==headers.length)throw Error('CSV row '+(i+2)+' has the wrong number of columns');return Object.fromEntries(headers.map((h,n)=>[h,r[n]]));});
}
export function date(value){
  const s=String(value||'').trim();
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s+GMT([+-]\d{1,2}))?$/i);
  if(m){const year=m[3].length===2?'20'+m[3]:m[3],day=year+'-'+m[1]+'-'+m[2];if(new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)throw Error('Invalid accepted date');if(!m[4])return day+'T12:00:00-07:00';const hour=Number(m[4]);if(hour<1||hour>12||Number(m[5])>59||Math.abs(Number(m[7]))>14)throw Error('Invalid accepted time');return day+'T'+String(hour%12+(m[6].toUpperCase()==='PM'?12:0)).padStart(2,'0')+':'+m[5]+':00'+(Number(m[7])<0?'-':'+')+String(Math.abs(Number(m[7]))).padStart(2,'0')+':00';}
  if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('Accepted date needs a date, time and timezone');return s;
}
export function weekFor(value){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value])),d=new Date(p.year+'-'+p.month+'-'+p.day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+5)%7);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {start,end:d.toISOString().slice(0,10)};
}
