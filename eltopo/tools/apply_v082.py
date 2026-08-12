from pathlib import Path

root = Path('eltopo')
game = root / 'social-game.js'
s = game.read_text(encoding='utf-8')

s = s.replace("const VERSION = '0.8.1';", "const VERSION = '0.8.2';")
s = s.replace("import { AVATARS } from './game-data.js?v=0.8.1';", "import { AVATARS } from './game-data.js?v=0.8.2';")
s = s.replace("let returnLobbyTimer = null;\nlet lastMixedIntroTrigger = '';", "let returnLobbyTimer = null;\nlet mixedFinalizeTimer = null;\nlet mixedCountdownTicker = null;\nlet lastMixedIntroTrigger = '';")

s = s.replace(
"""    members:{}, lobbyMessages:[], messages:[], trigger:'', guesses:{}, scores:null,
    final:false, reveal:null, createdAt:now(), spyfall:{votes:{},result:null}""",
"""    members:{}, lobbyMessages:[], messages:[], trigger:'', guesses:{}, scores:null,
    final:false, reveal:null, createdAt:now(), mixedVoting:{closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null}"""
)

s = s.replace(
"""    case 'guess': return onGuess(data.payload,cid);
    case 'mixed-final': return onMixedFinal(data.payload);""",
"""    case 'guess': return onGuess(data.payload,cid);
    case 'mixed-countdown': return onMixedCountdown(data.payload);
    case 'mixed-final': return onMixedFinal(data.payload);"""
)

old_start = "state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.trigger=pick(TRIGGERS); state.messages=[]; replyingTo=null; lastMixedIntroTrigger=''; enterMessenger();"
new_start = "state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.trigger=pick(TRIGGERS); state.messages=[]; replyingTo=null; lastMixedIntroTrigger=''; clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); enterMessenger();"
if old_start not in s:
    raise SystemExit('startMixed state line not found')
s = s.replace(old_start, new_start)

old_vote = '''function openGuess(targetId){
  if(state.mode!=='mixed'||!state.started||state.final||targetId===selfId)return;
  const target=state.members[targetId]; if(!target||target.spectator)return;
  const myGuess=state.guesses?.[selfId]?.[targetId]||'';
  const realNames=players().map(m=>m.realName).sort((a,b)=>a.localeCompare(b));
  showModal('¿Quién es en realidad?',`<div class="guess-target"><div class="profile-big">${avatarMarkup(target)}</div><strong>${esc(displayName(target))}</strong><span>Elegí quién pensás que está detrás de este usuario. Tu voto es público y podés cambiarlo.</span></div><div class="guess-list">${realNames.map(n=>`<button class="guess-option ${n===myGuess?'selected':''}" data-real="${esc(n)}">${esc(n)}</button>`).join('')}</div>`, modal=>{
    modal.querySelectorAll('.guess-option').forEach(b=>b.onclick=()=>castGuess(targetId,b.dataset.real));
  });
}
function castGuess(targetId,realName){
  state.guesses[selfId] ||= {}; state.guesses[selfId][targetId]=realName;
  send('guess',{targetId,realName}).catch(()=>{}); closeGenericModal(); renderAll();
}
function onGuess(p,cid){
  if(state.mode!=='mixed'||state.final||!p?.targetId||!state.members[p.targetId])return;
  state.guesses[cid] ||= {}; state.guesses[cid][p.targetId]=String(p.realName||''); renderAll();
}
function finalizeMixed(){
  if(!isAdmin||state.mode!=='mixed'||state.final)return;
  state.final=true; const scores={};
  players().forEach(m=>{scores[m.id]=0;});
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    for(const [targetId,guessName] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.spectator||voterId===targetId)continue;
      if(guessName===target.realName) scores[voterId]=(scores[voterId]||0)+1;
      else scores[targetId]=(scores[targetId]||0)+1;
    }
  }
  const reveal=Object.fromEntries(players().map(m=>[m.id,{shown:displayName(m),real:m.realName}]));
  state.scores=scores; state.reveal=reveal;
  const payload={scores,reveal,guesses:state.guesses};
  send('mixed-final',payload).catch(()=>{}); onMixedFinal(payload); addSystem('🏁 El administrador cerró la votación. Se revelaron las identidades.');
}
function onMixedFinal(p){ state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; if(p.guesses)state.guesses=p.guesses; renderAll(); showScoreboard(); if(isAdmin)scheduleReturnToLobby('Todo mezclado terminó.'); }
function showScoreboard(){
  const rows=players().sort((a,b)=>(state.scores?.[b.id]||0)-(state.scores?.[a.id]||0)).map(m=>`<div class="score-row"><div class="score-avatar">${avatarMarkup(m)}</div><div><strong>${esc(state.reveal?.[m.id]?.shown||displayName(m))}</strong><span>Era ${esc(state.reveal?.[m.id]?.real||m.realName)}</span></div><b>${state.scores?.[m.id]||0} pts</b></div>`).join('');
  showModal('Resultado · Todo mezclado',`<div class="score-list">${rows}</div><p class="modal-note">+1 por cada identidad acertada. +1 por cada voto equivocado que lograste provocar sobre tu usuario.</p>`);
}'''

new_vote = '''function mixedVoteWindowOpen(){
  return state.mode==='mixed'&&state.started&&!state.final&&(!state.mixedVoting?.closing||now()<Number(state.mixedVoting.deadline||0));
}
function mixedRequiredVotes(){ const n=players().length; return Math.max(0,n*(n-1)); }
function mixedSubmittedVotes(){
  let total=0;
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    for(const targetId of Object.keys(ballot||{})) if(voterId!==targetId&&state.members[targetId]&&!state.members[targetId].spectator) total++;
  }
  return total;
}
function mixedTargetVoteCount(targetId){
  return Object.entries(state.guesses||{}).reduce((n,[voterId,ballot])=>n+(voterId!==targetId&&ballot?.[targetId]?1:0),0);
}
function mixedVoteBreakdown(targetId){
  const counts={};
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    if(voterId===targetId)continue;
    const name=ballot?.[targetId]; if(name)counts[name]=(counts[name]||0)+1;
  }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
}
function maybeStartAutoMixedCountdown(){
  if(!isAdmin||state.mode!=='mixed'||state.final||state.mixedVoting?.closing)return;
  const required=mixedRequiredVotes();
  if(required>0&&mixedSubmittedVotes()>=required) beginMixedCountdown('all');
}
function beginMixedCountdown(reason='admin'){
  if(!isAdmin||state.mode!=='mixed'||state.final||state.mixedVoting?.closing)return;
  const payload={closing:true,deadline:now()+10000,reason};
  state.mixedVoting=payload;
  send('mixed-countdown',payload).catch(()=>{});
  onMixedCountdown(payload);
  clearTimeout(mixedFinalizeTimer);
  mixedFinalizeTimer=setTimeout(completeMixedFinal,10050);
}
function onMixedCountdown(p){
  if(!p?.closing)return;
  state.mixedVoting={closing:true,deadline:Number(p.deadline)||now()+10000,reason:p.reason==='all'?'all':'admin'};
  clearInterval(mixedCountdownTicker);
  mixedCountdownTicker=setInterval(()=>{
    renderGameBar();
    if(now()>=state.mixedVoting.deadline)clearInterval(mixedCountdownTicker);
  },200);
  renderGameBar();
}
function openGuess(targetId){
  if(!mixedVoteWindowOpen()||targetId===selfId)return;
  const target=state.members[targetId]; if(!target||target.spectator)return;
  const myGuess=state.guesses?.[selfId]?.[targetId]||'';
  const realNames=players().map(m=>m.realName).sort((a,b)=>a.localeCompare(b));
  showModal('¿Quién es en realidad?',`<div class="guess-target"><div class="profile-big">${avatarMarkup(target)}</div><strong>${esc(displayName(target))}</strong><span>Elegí quién pensás que está detrás de este usuario. Tu voto es privado y podés cambiarlo hasta que termine el contador.</span></div><div class="guess-list">${realNames.map(n=>`<button class="guess-option ${n===myGuess?'selected':''}" data-real="${esc(n)}">${esc(n)}</button>`).join('')}</div>`, modal=>{
    modal.querySelectorAll('.guess-option').forEach(b=>b.onclick=()=>castGuess(targetId,b.dataset.real));
  });
}
function castGuess(targetId,realName){
  if(!mixedVoteWindowOpen())return;
  state.guesses[selfId] ||= {}; state.guesses[selfId][targetId]=realName;
  send('guess',{targetId,realName}).catch(()=>{}); closeGenericModal(); renderAll(); maybeStartAutoMixedCountdown();
}
function onGuess(p,cid){
  if(state.mode!=='mixed'||state.final||!p?.targetId||!state.members[p.targetId])return;
  state.guesses[cid] ||= {}; state.guesses[cid][p.targetId]=String(p.realName||''); renderAll(); maybeStartAutoMixedCountdown();
}
function finalizeMixed(){ beginMixedCountdown('admin'); }
function completeMixedFinal(){
  if(!isAdmin||state.mode!=='mixed'||state.final)return;
  clearInterval(mixedCountdownTicker); state.final=true; state.phase='finished';
  const scores={}; players().forEach(m=>{scores[m.id]=0;});
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    for(const [targetId,guessName] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.spectator||voterId===targetId)continue;
      if(guessName===target.realName) scores[voterId]=(scores[voterId]||0)+1;
      else scores[targetId]=(scores[targetId]||0)+1;
    }
  }
  const reveal=Object.fromEntries(players().map(m=>[m.id,{shown:displayName(m),real:m.realName}]));
  state.scores=scores; state.reveal=reveal;
  const payload={scores,reveal,guesses:state.guesses};
  send('mixed-final',payload).catch(()=>{}); onMixedFinal(payload);
}
function onMixedFinal(p){
  clearInterval(mixedCountdownTicker); state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; if(p.guesses)state.guesses=p.guesses; renderAll(); showScoreboard();
  if(isAdmin)scheduleReturnToLobby('Todo mezclado terminó.',14000);
}
function showScoreboard(){
  const ranking=[...players()].sort((a,b)=>(state.scores?.[b.id]||0)-(state.scores?.[a.id]||0));
  const topScore=ranking.length?state.scores?.[ranking[0].id]||0:0;
  const winners=ranking.filter(m=>(state.scores?.[m.id]||0)===topScore);
  const winnerText=winners.length===1?`🏆 ${esc(winners[0].realName)} gana la ronda con ${topScore} puntos`:`🏆 Empate: ${winners.map(m=>esc(m.realName)).join(' · ')} con ${topScore} puntos`;
  const rows=ranking.map((m,i)=>{
    const breakdown=mixedVoteBreakdown(m.id); const total=breakdown.reduce((n,[,c])=>n+c,0);
    const votes=breakdown.length?breakdown.map(([name,count])=>`<span class="result-vote-chip">${esc(name)} ×${count}</span>`).join(''):'<span class="result-no-votes">Sin votos</span>';
    return `<div class="mixed-result-row ${i===0?'leader':''}"><div class="mixed-result-rank">${i===0?'👑':`#${i+1}`}</div><div class="score-avatar">${avatarMarkup(m)}</div><div class="mixed-result-copy"><strong>${esc(state.reveal?.[m.id]?.shown||displayName(m))}</strong><span class="mixed-result-reveal">En realidad era <b>${esc(state.reveal?.[m.id]?.real||m.realName)}</b></span><span class="mixed-result-vote-total">${total} voto${total===1?'':'s'} recibido${total===1?'':'s'}</span><div class="mixed-result-votes">${votes}</div></div><b class="mixed-result-points">${state.scores?.[m.id]||0}<small> pts</small></b></div>`;
  }).join('');
  showModal('🎉 Resultados · Todo mezclado',`<div class="mixed-results"><div class="mixed-winner-card"><span>✨ RONDA TERMINADA ✨</span><strong>${winnerText}</strong></div><div class="mixed-results-title">¿QUIÉN ERA QUIÉN?</div><div class="mixed-results-list">${rows}</div><p class="modal-note">+1 por cada identidad acertada. +1 por cada voto equivocado que lograste provocar sobre tu usuario.</p><div class="mixed-return-note">Volviendo al lobby en unos segundos…</div></div>`);
}'''

if old_vote not in s:
    raise SystemExit('mixed voting block not found')
s = s.replace(old_vote, new_vote)

old_public = '''  if(state.mode==='mixed'&&state.started){
    const entries=Object.entries(state.guesses||{}).filter(([v])=>v!==targetId).map(([v,b])=>b?.[targetId]?[state.members[v]?.publicName||state.members[v]?.realName,b[targetId]]:null).filter(Boolean);
    if(entries.length) return `<small class="public-votes">${entries.map(([v,g])=>`${esc(v)} → ${esc(g)}`).join(' · ')}</small>`;
  }'''
new_public = '''  if(state.mode==='mixed'&&state.started&&!state.final){
    const count=mixedTargetVoteCount(targetId);
    if(count) return `<small class="public-votes">🗳️ ${count} voto${count===1?'':'s'} emitido${count===1?'':'s'}</small>`;
  }'''
if old_public not in s:
    raise SystemExit('public vote summary block not found')
s = s.replace(old_public, new_public)

old_bar = '''  if(state.mode==='mixed'&&!state.final) html+=`<div class="game-help">Tocá el nombre de otro usuario para votar quién creés que es. La votación es pública y se puede cambiar.</div>`;
  if(state.mode==='mixed'&&isAdmin&&!state.final) html+=`<button id="finalMixedBtn" class="banner-btn">Votación final</button>`;'''
new_bar = '''  if(state.mode==='mixed'&&!state.final){
    const submitted=mixedSubmittedVotes(),required=mixedRequiredVotes();
    if(state.mixedVoting?.closing){
      const left=Math.max(0,Math.ceil((Number(state.mixedVoting.deadline||0)-now())/1000));
      const text=state.mixedVoting.reason==='all'?'Todos votaron. Tenés 10 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 10 segundos para votar o cambiar tu voto.';
      html+=`<div class="mixed-countdown"><span>${esc(text)}</span><strong>${left}</strong></div>`;
    }else{
      html+=`<div class="game-help">Los votos son privados. Tocá un usuario para elegir quién creés que es. ${submitted}/${required} votos emitidos.</div>`;
      if(isAdmin)html+=`<button id="finalMixedBtn" class="banner-btn">Finalizar votación</button>`;
    }
  }'''
if old_bar not in s:
    raise SystemExit('mixed game bar block not found')
s = s.replace(old_bar, new_bar)

s = s.replace("function scheduleReturnToLobby(summary){\n  if(!isAdmin)return;\n  clearTimeout(returnLobbyTimer);\n  returnLobbyTimer=setTimeout(()=>returnEveryoneToLobby(summary),6500);\n}", "function scheduleReturnToLobby(summary,delay=6500){\n  if(!isAdmin)return;\n  clearTimeout(returnLobbyTimer);\n  returnLobbyTimer=setTimeout(()=>returnEveryoneToLobby(summary),delay);\n}")

s = s.replace("state.guesses={}; state.scores=null; state.reveal=null; state.spyfall={votes:{},result:null};", "state.guesses={}; state.scores=null; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.spyfall={votes:{},result:null};")
s = s.replace("privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger=''; selectedMode=state.mode||selectedMode;", "clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger=''; selectedMode=state.mode||selectedMode;")
s = s.replace("state=p.state; selectedMode=state.mode||selectedMode; privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger='';", "state=p.state; selectedMode=state.mode||selectedMode; clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger='';")

game.write_text(s, encoding='utf-8')

# Cache/version updates
index = root / 'index.html'
h = index.read_text(encoding='utf-8').replace('0.8.1','0.8.2')
index.write_text(h, encoding='utf-8')
helper = root / 'mixed-avatar-sync.js'
mh = helper.read_text(encoding='utf-8').replace("const BUILD_VERSION = '0.8.1';", "const BUILD_VERSION = '0.8.2';")
helper.write_text(mh, encoding='utf-8')

css = root / 'social.css'
c = css.read_text(encoding='utf-8')
c += '''\n.mixed-countdown{min-width:min(470px,48vw);background:#fff3c4;border:2px solid #f0b429;border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)}.mixed-countdown span{font-size:12px;font-weight:700;line-height:1.25;flex:1}.mixed-countdown strong{width:38px;height:38px;border-radius:50%;background:#111b21;color:#fff;display:grid;place-items:center;font-size:19px}.mixed-results{display:flex;flex-direction:column;gap:14px}.mixed-winner-card{background:linear-gradient(135deg,#fff7c2,#ffe08a);border:2px solid #e9b824;border-radius:16px;padding:18px;text-align:center;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(233,184,36,.22)}.mixed-winner-card span{font-size:12px;font-weight:900;letter-spacing:.12em;color:#735b00}.mixed-winner-card strong{font-size:clamp(20px,3vw,30px);line-height:1.2}.mixed-results-title{text-align:center;font-size:12px;font-weight:900;letter-spacing:.14em;color:var(--muted)}.mixed-results-list{display:flex;flex-direction:column;gap:8px}.mixed-result-row{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px;background:#fff}.mixed-result-row.leader{border-color:#e9b824;background:#fffdf1}.mixed-result-rank{width:28px;text-align:center;font-weight:900;color:#667781}.mixed-result-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.mixed-result-copy>strong{font-size:15px}.mixed-result-reveal{font-size:12px;color:#41525d}.mixed-result-vote-total{font-size:11px;color:var(--muted);margin-top:3px}.mixed-result-votes{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.result-vote-chip{font-size:10px;background:#f0f2f5;border-radius:999px;padding:3px 7px}.result-no-votes{font-size:10px;color:var(--muted)}.mixed-result-points{font-size:24px;color:var(--wa-dark);white-space:nowrap}.mixed-result-points small{font-size:10px}.mixed-return-note{text-align:center;font-size:11px;color:var(--muted)}\n@media(max-width:700px){.mixed-countdown{min-width:0;flex:1}.mixed-result-row{align-items:flex-start}.mixed-result-points{font-size:20px}.mixed-winner-card strong{font-size:21px}}\n'''
css.write_text(c, encoding='utf-8')
