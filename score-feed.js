/* ESPN accepts single dates; assemble a betting week without date-range queries. */
var ScoreFeed=(function(){
  function createClient(options){
    options=options||{};var request=options.fetch||function(url,init){return fetch(url,init)},now=options.now||Date.now;
    var cache=new Map(),pending=new Map(),active=0,queue=[];
    function limited(job){return new Promise(function(resolve,reject){queue.push({job:job,resolve:resolve,reject:reject});pump()})}
    function pump(){while(active<3&&queue.length){var next=queue.shift();active++;(function(task){Promise.resolve().then(task.job).then(task.resolve,task.reject).finally(function(){active--;pump()})})(next)}}
    function key(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
    function days(start,end){var d=new Date(start+'T12:00:00'),out=[];if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(d.getTime()))throw Error('Invalid score dates');while(key(d)<=end&&out.length<8){out.push(key(d));d.setDate(d.getDate()+1)}if(!out.length||out.length>7||out[out.length-1]!==end)throw Error('Expected a date window of at most seven days');return out}
    function ttl(day,events){var today=key(new Date(now()));if(day===today)return 30000;if(day>today)return 6*60*60*1000;return events.every(function(e){var c=e.competitions&&e.competitions[0];return (c&&c.status||e.status||{}).type?.completed})?24*60*60*1000:5*60*1000}
    async function one(source,day,group){
      var id=source+':'+group+':'+day,old=cache.get(id);
      if(old&&now()-old.fetchedAt<ttl(day,old.events))return old;
      if(pending.has(id))return pending.get(id);
      var job=limited(async function(){
        var league=source==='nfl'?'nfl':'college-football';
        var url='https://site.api.espn.com/apis/site/v2/sports/football/'+league+'/scoreboard?dates='+day.replace(/-/g,'')+'&limit=300'+(source==='college'?'&groups='+encodeURIComponent(group):'');
        var r=await request(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(source+' '+day+' HTTP '+r.status);
        var j=await r.json();if(!Array.isArray(j.events))throw Error(source+' '+day+' invalid scoreboard');
        var result={events:j.events,fetchedAt:now()};cache.set(id,result);return result;
      }).catch(function(e){return {events:old?old.events:[],fetchedAt:old?old.fetchedAt:null,error:e.message}});pending.set(id,job);
      try{return await job}finally{pending.delete(id)}
    }
    async function fetchWeek(source,start,end,group){
      if(source!=='nfl'&&source!=='college')throw Error('Invalid football league');
      var dates=days(start,end),out=await Promise.all(dates.map(function(day){return one(source,day,group||'80')})),games=new Map(),errors=[],latest=0;
      out.forEach(function(r){r.events.forEach(function(e){games.set(String(e.id),e)});if(r.error)errors.push(r.error);latest=Math.max(latest,r.fetchedAt||0)});
      return {events:Array.from(games.values()),updatedAt:latest?new Date(latest).toISOString():null,error:errors.length?errors.join('; '):null};
    }
    return {fetchWeek:fetchWeek};
  }
  var client=createClient();return {createClient:createClient,fetchWeek:client.fetchWeek};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ScoreFeed;
