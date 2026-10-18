/* Reuse the import review component for saved bets; URL contains no credentials. */
function savedMatchLink(b,leg){return '<a class="game-match-link" href="/upload-bets.html?saved=1&amp;betId='+encodeURIComponent(b.betId)+'">'+(leg&&leg.manualMatch||!leg&&b.manualMatch?'Change matched game':'Match ESPN game')+'</a>';}
var beforeMatchingBetCard=betCard;
betCard=function(b){var html=beforeMatchingBetCard(b),hasLegs=Array.isArray(b.legs)&&b.legs.length;if(b.manualMatch||!hasLegs&&!findGame(b))html=html.replace(/<\/div>$/, (b.manualMatch?'<div class="manual-match-badge">Manually confirmed · ESPN '+esc(b.manualMatch.eventId)+'</div>':'')+savedMatchLink(b)+'</div>');return html;};
var beforeMatchingLegHtml=legHtml;
legHtml=function(l,b){var html=beforeMatchingLegHtml(l,b);if(l.manualMatch||l.matchIssue||!legGame(l,b))html=html.replace(/<\/div>$/,(l.manualMatch?'<div class="manual-match-badge">Manually confirmed · ESPN '+esc(l.manualMatch.eventId)+'</div>':'')+savedMatchLink(b,l)+'</div>');return html;};
renderAll();
