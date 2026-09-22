/* Football Score App UI enhancements. */
function betFirstKickoff(b){
  var times=[];
  (b.legs||[]).forEach(function(l){var g=legGame(l,b);if(g&&g.date)times.push(Date.parse(g.date)||0)});
  var g=findGame(b);if(g&&g.date)times.push(Date.parse(g.date)||0);
  times=times.filter(Boolean);
  return times.length?Math.min.apply(null,times):(Date.parse(b.acceptedDate||0)||0);
}
function sortBets(a,b){var sa=stateOrder(a),sb=stateOrder(b);if(sa!==sb)return sa-sb;return betFirstKickoff(a)-betFirstKickoff(b)}
function gameNetwork(g){var out=[];(comp(g).broadcasts||[]).forEach(function(b){(b.names||[]).forEach(function(n){if(n&&out.indexOf(n)<0)out.push(n)})});return out.join(' / ')}
