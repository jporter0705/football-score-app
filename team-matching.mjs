/* Shared by Netlify normalization and the built browser; aliases are league-scoped. */
var TeamMatching=(function(){
  'use strict';
  var aliases=[
    ['ucf','central florida','university of central florida'],
    ['appalachian state','app state','appalachian state university'],
    ['old dominion','odu','old dominion university'],
    ['massachusetts','umass'],['connecticut','uconn'],['mississippi','ole miss'],
    ['southern mississippi','southern miss'],['florida international','fiu'],
    ['florida atlantic','fau'],['texas san antonio','utsa','texas at san antonio'],
    ['texas el paso','utep','texas at el paso'],['southern methodist','smu'],
    ['texas christian','tcu'],['louisiana state','lsu'],
    ['nevada las vegas','unlv'],['louisiana monroe','ul monroe','ulm']
  ];
  // Deliberately do not equate OSU/MSU, Miami, USC, Louisiana, or directional schools.
  var mascots=['wildcats','bearcats','cougars','red raiders','raiders','bears','eagles','seahawks','commanders','bills','chargers','49ers','cardinals','vikings','ducks','panthers','tigers','bulldogs','aggies','horned frogs','knights','huskies','spartans','wolverines','mountaineers','cyclones','cowboys','sooners','longhorns','jayhawks','utes','buffaloes','buffs','falcons','rams','trojans','bruins','beavers','sun devils','blue devils','fighting irish','gamecocks','volunteers','vols','razorbacks','rebels','crimson tide','buckeyes','nittany lions','boilermakers','hoosiers','terrapins','terps','scarlet knights','hawkeyes','badgers','golden gophers','cornhuskers','hurricanes','seminoles','gators','yellow jackets','demon deacons','orange','cardinal','golden bears','tar heels','wolfpack','cavaliers','hokies','mustangs','green wave','mean green','golden eagles','owls','bobcats','warhawks','ragin cajuns','jaguars','blazers','miners','roadrunners','rainbow warriors','broncos','aztecs','bulldogs','lobos','wolf pack' ,'monarchs','minutemen','chanticleers','blue hens','bearkats'].sort(function(a,b){return b.length-a.length}),cache=new Map();
  function clean(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[.'’]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\bst\b/g,'state').replace(/\buniv\b/g,'university').replace(/\s+/g,' ')}
  function sport(v){if(v==='NFL'||v==='College')return v;var s=clean(v);return /^(nfl|national football league)$/.test(s)?'NFL':/^(college|ncaa|ncaaf|college football)$/.test(s)?'College':''}
  function teamName(v){return String(v||'').replace(/Ã[\u0080-\u00bf]/g,function(s){try{return decodeURIComponent('%'+s.charCodeAt(0).toString(16)+'%'+s.charCodeAt(1).toString(16))}catch(e){return s}}).replace(/^Mobile\s*-\s*/i,'').trim()}
  function key(v,sp){var k=sp+':'+v;if(cache.has(k))return cache.get(k);var s=clean(teamName(v)),without=s;
    mascots.some(function(m){if(s.endsWith(' '+m)){without=s.slice(0,-m.length-1);return true}return false});
    s=without.replace(/^university of /,'').replace(/ university$/,'');
    if(sp!=='NFL')for(var group of aliases)if(group.some(function(a){return clean(a)===s})){s=group[0];break}
    if(cache.size>=4096)cache.clear();cache.set(k,s);return s;
  }
  function teamMatches(c,value,sp){var t=c&&c.team||c||{},n=key(value,sp);if(!n)return false;
    // Mascot-only NCAA names are not identities, even when one happens to be in the pool.
    if(sp==='College'&&(mascots.includes(clean(value))||['osu','msu'].includes(clean(value))))return false;
    var vals=[t.location,t.displayName,t.shortDisplayName,t.abbreviation];if(sp!=='College')vals.push(t.name);
    return vals.filter(Boolean).some(function(v){return key(v,sp)===n});
  }
  var dayCache=new Map();
  function day(value){var s=String(value||'').trim();if(dayCache.has(s))return dayCache.get(s);var result=parseDay(s);if(dayCache.size>=4096)dayCache.clear();dayCache.set(s,result);return result}
  function parseDay(s){var m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/)||s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m){var out=s.includes('/')?m[3]+'-'+m[1]+'-'+m[2]:s,d=new Date(out+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===out?out:null}
    if(!/T.*(?:Z|[+-]\d\d:?\d\d)$/i.test(s))return null;var date=new Date(s);if(!Number.isFinite(date.getTime()))return null;
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),p={};parts.forEach(function(x){p[x.type]=x.value});return p.year+'-'+p.month+'-'+p.day;
  }
  function eventDay(item){for(var k of ['eventDate','eventStart','gameDate','startTime'])if(item[k])return {provided:true,day:day(item[k])};
    var text=[item.expandedText,item.expanded_text,item.raw,item.description,item.gameText].filter(Boolean).join(' '),m=text.match(/\|\s*(\d{2}\/\d{2}\/\d{4})\s*\|/);
    return {provided:!!m,day:m?day(m[1]):null};
  }
  function pair(item){if(item.awayTeam&&item.homeTeam)return [teamName(item.awayTeam),teamName(item.homeTeam)];var s=teamName(item.gameText||item.description||item.raw||'').replace(/^Football\s*-\s*(?:NFL|NCAA)\s*-\s*/i,'').replace(/^(?:NFL|NCAAF) Game Props\s*-\s*/i,''),m=s.match(/^(.+?)\s+(?:at|vs\.?|versus|v|@)\s+(.+?)(?:\s+-\s+|\s*\||$)/i);return m?[teamName(m[1]),teamName(m[2])]:null}
  function eventSport(e){var uid=String(e.uid||e.competitions&&e.competitions[0]&&e.competitions[0].uid||'');return /~l:23~/.test(uid)?'College':/~l:28~/.test(uid)?'NFL':''}
  function correctedEventDay(pool,item){
    var sp=sport(item.sport||item.league),p=pair(item),date=eventDay(item);
    if(item.manualMatch||!sp||!p||!item.espnEventId||!date.day||sport(item.league)&&sport(item.league)!==sp)return null;
    var found=(pool||[]).filter(function(e){return String(e.id)===String(item.espnEventId)&&eventSport(e)===sp});if(found.length!==1)return null;
    var g=found[0],stamp=g.date||g.competitions&&g.competitions[0]&&g.competitions[0].date,gd=day(stamp),cs=g.competitions&&g.competitions[0]&&g.competitions[0].competitors||[];
    if(!gd||gd===date.day||String(stamp).slice(0,10)!==date.day||cs.length!==2)return null;
    if(!((teamMatches(cs[0],p[0],sp)&&teamMatches(cs[1],p[1],sp))||(teamMatches(cs[1],p[0],sp)&&teamMatches(cs[0],p[1],sp))))return null;
    var source=eventDay({expandedText:item.expandedText,expanded_text:item.expanded_text,raw:item.raw,description:item.description,gameText:item.gameText});
    if(source.provided&&source.day!==gd||item.eventStart&&day(item.eventStart)!==gd)return null;
    return gd;
  }
  function resolve(pool,item,options){if(!item)return null;options=options||{};var sp=sport(item.sport||item.league)||sport(options.sport),p=pair(item),date=eventDay(item);
    if(sport(item.sport)&&sport(item.league)&&sport(item.sport)!==sport(item.league))return null;
    if(item.manualMatch){var m=item.manualMatch;if(m.version!==1||m.sport!==sp||String(item.espnEventId)!==String(m.eventId))return null;var found=(pool||[]).filter(function(e){return String(e.id)===String(m.eventId)&&(!eventSport(e)||eventSport(e)===sp)});if(found.length>1)return null;if(found.length)return found[0];var snap=m.event;return snap&&String(snap.id)===String(m.eventId)&&snap.sport===sp?snap:null;}
    var corrected=correctedEventDay(pool,item);if(corrected)date={provided:true,day:corrected};
    if(date.provided&&!date.day)return null;
    if(options.requireStoredId&&item.espnEventId&&!(pool||[]).some(function(e){return String(e.id)===String(item.espnEventId)}))return null;
    var candidates=(pool||[]).filter(function(e){var esp=eventSport(e);if(sp&&esp&&sp!==esp)return false;
      var gd=day(e.date||e.competitions&&e.competitions[0]&&e.competitions[0].date);
      if(date.provided&&gd!==date.day)return false;
      if(options.start&&(!gd||gd<options.start||gd>options.end))return false;
      var cs=e.competitions&&e.competitions[0]&&e.competitions[0].competitors||[];
      if(p)return cs.length===2&&((teamMatches(cs[0],p[0],sp)&&teamMatches(cs[1],p[1],sp))||(teamMatches(cs[1],p[0],sp)&&teamMatches(cs[0],p[1],sp)));
      // Compatibility for old, ID-only props; validate every supplied constraint above.
      if(item.espnEventId)return String(e.id)===String(item.espnEventId);
      return false;
    });
    var unique=Array.from(new Map(candidates.map(function(e){return [String(e.id),e]})).values());return unique.length===1?unique[0]:null;
  }
  return {aliases:aliases,mascots:mascots,teamName:teamName,key:key,sport:sport,teamMatches:teamMatches,day:day,eventDay:eventDay,pair:pair,correctedEventDay:correctedEventDay,resolve:resolve};
})();
export default TeamMatching;
