from pathlib import Path
p=Path('eltopo/social-game.js')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s: raise SystemExit('NOT FOUND '+label)
    s=s.replace(old,new,1)

rep("./game-data.js?v=0.10.1","./game-data.js?v=0.10.2","game data")
rep("const VERSION = '0.10.1';","const VERSION = '0.10.2';","version")
rep("let spyFinalizeTimer = null;\nlet spyCountdownTicker = null;","let spyFinalizeTimer = null;\nlet spyCountdownTicker = null;\nlet incognitoFinalizeTimer = null;\nlet incognitoCountdownTicker = null;","incog timers")
rep("mixedPreviousTargets:{}, mixedVoting:{closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0}","mixedPreviousTargets:{}, mixedVoting:{closing:false,deadline:0,reason:''}, incognitoVoting:{votes:{},closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0}","fresh incog state")

rep("    case 'incognito-start': return onIncognitoStart(data.payload);","    case 'incognito-start': return onIncognitoStart(data.payload);\n    case 'incognito-guess': return onIncognitoGuess(data.payload,cid);\n    case 'incognito-countdown': return onIncognitoCountdown(data.payload);\n    case 'incognito-final': return onIncognitoFinal(data.payload);","incog events")

rep("  state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null; enterMessenger();","  state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null; state.reveal=null; state.incognitoVoting={votes:{},closing:false,deadline:0,reason:''}; clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); enterMessenger();","incog start reset")
rep("    addSystem(`🕶️ Todos tienen identidad. Disparador: ${state.trigger}`);","    addSystem(`🕶️ Todos tienen identidad. Disparador: ${state.trigger}`);\n    addSystem('🗳️ Tocá a los demás personajes para votar quién creés que es cada uno. +1 punto por cada identidad acertada.');","incog instructions")

start=s.index('function onIncognitoStart(p){')
end=s.index('\nfunction startSpyfall(ids){',start)
newblock=r'''function onIncognitoStart(p){ if(p?.state)state=p.state; state.incognitoVoting ||= {votes:{},closing:false,deadline:0,reason:''}; if(state.started)enterMessenger(); renderAll(); if(state.final&&state.scores)showIncognitoResults(); }
function incognitoVoteWindowOpen(){ return state.mode==='incognito'&&state.started&&state.phase==='playing'&&!state.final&&(!state.incognitoVoting?.closing||now()<Number(state.incognitoVoting.deadline||0)); }
function incognitoRequiredVotes(){ const n=players().length; return Math.max(0,n*(n-1)); }
function incognitoSubmittedVotes(){
  let total=0;
  for(const [voterId,ballot] of Object.entries(state.incognitoVoting?.votes||{})){
    const voter=state.members[voterId]; if(!voter||voter.online===false||voter.spectator)continue;
    for(const targetId of Object.keys(ballot||{})){
      const target=state.members[targetId]; if(voterId!==targetId&&target&&target.online!==false&&!target.spectator)total++;
    }
  }
  return total;
}
function incognitoTargetVoteCount(targetId){
  return Object.entries(state.incognitoVoting?.votes||{}).reduce((n,[voterId,ballot])=>{
    const voter=state.members[voterId],target=state.members[targetId];
    return n+(voter&&voter.online!==false&&!voter.spectator&&target&&target.online!==false&&!target.spectator&&voterId!==targetId&&ballot?.[targetId]?1:0);
  },0);
}
function openIncognitoGuess(targetId){
  if(!incognitoVoteWindowOpen()||targetId===selfId)return;
  const target=state.members[targetId]; if(!target||target.online===false||target.spectator)return;
  const mine=state.incognitoVoting?.votes?.[selfId]?.[targetId]||'';
  const names=players().filter(m=>m.id!==selfId).map(m=>m.realName).sort((a,b)=>a.localeCompare(b));
  showModal('¿Quién está detrás?',`<div class="guess-target"><div class="profile-big">${avatarMarkup(target)}</div><strong>${esc(displayName(target))}</strong><span>Elegí quién creés que es realmente. Tu voto es privado y podés cambiarlo hasta que termine la cuenta regresiva.</span></div><div class="guess-list">${names.map(n=>`<button class="guess-option ${n===mine?'selected':''}" data-incog-real="${esc(n)}">${esc(n)}</button>`).join('')}</div>`,modal=>{
    modal.querySelectorAll('[data-incog-real]').forEach(b=>b.onclick=()=>castIncognitoGuess(targetId,b.dataset.incogReal));
  });
}
function castIncognitoGuess(targetId,realName){
  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}
  if(!incognitoVoteWindowOpen())return;
  state.incognitoVoting ||= {votes:{},closing:false,deadline:0,reason:''};
  state.incognitoVoting.votes[selfId] ||= {}; state.incognitoVoting.votes[selfId][targetId]=realName;
  if(isAdmin)onIncognitoGuess({targetId,realName},selfId); else send('incognito-guess',{targetId,realName},state.adminId).catch(()=>{});
  closeGenericModal(); renderAll();
}
function onIncognitoGuess(p,cid){
  if(!isAdmin||state.mode!=='incognito'||state.final||state.phase!=='playing'||!p?.targetId)return;
  const voter=state.members[cid],target=state.members[p.targetId]; if(!voter||voter.online===false||voter.spectator||!target||target.online===false||target.spectator||cid===p.targetId)return;
  state.incognitoVoting ||= {votes:{},closing:false,deadline:0,reason:''}; state.incognitoVoting.votes[cid] ||= {}; state.incognitoVoting.votes[cid][p.targetId]=String(p.realName||'');
  broadcastFullState(); maybeStartAutoIncognitoCountdown();
}
function maybeStartAutoIncognitoCountdown(){
  if(!isAdmin||state.mode!=='incognito'||state.final||state.phase!=='playing'||state.incognitoVoting?.closing)return;
  const required=incognitoRequiredVotes(); if(required>0&&incognitoSubmittedVotes()>=required)beginIncognitoCountdown('all');
}
function beginIncognitoCountdown(reason='admin'){
  if(!isAdmin||state.mode!=='incognito'||state.final||state.phase!=='playing'||state.incognitoVoting?.closing)return;
  const payload={closing:true,deadline:now()+20000,reason}; state.incognitoVoting={...(state.incognitoVoting||{}),closing:true,deadline:payload.deadline,reason};
  send('incognito-countdown',payload).catch(()=>{}); onIncognitoCountdown(payload);
  clearTimeout(incognitoFinalizeTimer); incognitoFinalizeTimer=setTimeout(completeIncognitoFinal,20050);
}
function onIncognitoCountdown(p){
  if(!p?.closing)return; state.incognitoVoting ||= {votes:{}}; state.incognitoVoting.closing=true; state.incognitoVoting.deadline=Number(p.deadline)||now()+20000; state.incognitoVoting.reason=p.reason==='all'?'all':'admin';
  clearInterval(incognitoCountdownTicker); incognitoCountdownTicker=setInterval(()=>{renderGameBar();if(now()>=state.incognitoVoting.deadline)clearInterval(incognitoCountdownTicker);},200); renderGameBar();
}
function finalizeIncognito(){ beginIncognitoCountdown('admin'); }
function completeIncognitoFinal(){
  if(!isAdmin||state.mode!=='incognito'||state.final)return;
  clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); state.final=true; state.phase='finished';
  const scores={}; players().forEach(m=>scores[m.id]=0);
  for(const [voterId,ballot] of Object.entries(state.incognitoVoting?.votes||{})){
    const voter=state.members[voterId]; if(!voter||voter.online===false||voter.spectator)continue;
    for(const [targetId,guess] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.online===false||target.spectator||voterId===targetId)continue;
      if(guess===target.realName)scores[voterId]=(scores[voterId]||0)+1;
    }
  }
  const reveal=Object.fromEntries(players().map(m=>[m.id,{persona:displayName(m),real:m.realName,avatar:m.avatar}])); state.scores=scores; state.reveal=reveal;
  const payload={scores,reveal,votes:state.incognitoVoting.votes}; send('incognito-final',payload).catch(()=>{}); onIncognitoFinal(payload);
}
function onIncognitoFinal(p){
  clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; state.incognitoVoting ||= {}; if(p.votes)state.incognitoVoting.votes=p.votes; renderAll(); showIncognitoResults();
}
function showIncognitoResults(){
  const ranking=[...players()].sort((a,b)=>(state.scores?.[b.id]||0)-(state.scores?.[a.id]||0)); const top=ranking.length?(state.scores?.[ranking[0].id]||0):0; const winners=ranking.filter(m=>(state.scores?.[m.id]||0)===top);
  const winner=winners.length===1?`🏆 ${esc(winners[0].realName)} gana con ${top} acierto${top===1?'':'s'}`:`🏆 Empate: ${winners.map(m=>esc(m.realName)).join(' · ')} con ${top} acierto${top===1?'':'s'}`;
  const rows=ranking.map((m,i)=>`<div class="mixed-result-row ${i===0?'leader':''}"><div class="mixed-result-rank">${i===0?'👑':`#${i+1}`}</div><div class="score-avatar">${avatarMarkup(m)}</div><div class="mixed-result-copy"><strong>${esc(state.reveal?.[m.id]?.persona||displayName(m))}</strong><span class="mixed-result-reveal">En realidad era <b>${esc(state.reveal?.[m.id]?.real||m.realName)}</b></span></div><b class="mixed-result-points">${state.scores?.[m.id]||0}<small> pts</small></b></div>`).join('');
  const action=isAdmin?'<button id="incogReturnLobby" class="primary-btn">Cerrar resultados y volver al lobby</button>':'<button id="incogResultClose" class="primary-btn">Cerrar resultados</button>';
  showModal('🎭 Resultados · Incógnito',`<div class="mixed-results"><div class="mixed-winner-card"><span>✨ IDENTIDADES REVELADAS ✨</span><strong>${winner}</strong></div><div class="mixed-results-title">¿QUIÉN ERA QUIÉN?</div><div class="mixed-results-list">${rows}</div><p class="modal-note">+1 punto por cada identidad real que adivinaste correctamente.</p>${action}</div>`,()=>{
    $('incogResultClose')?.addEventListener('click',closeGenericModal); $('incogReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby('Incógnito terminó.'));
  });
}
function revealIncognito(){ finalizeIncognito(); }
function showIncognitoReveal(){ showIncognitoResults(); }
'''
s=s[:start]+newblock+s[end:]

# Incognito votes are initiated by clicking participants.
rep("  if(state.mode==='mixed'&&state.started&&!state.final){openGuess(id);return;}","  if(state.mode==='mixed'&&state.started&&!state.final){openGuess(id);return;}\n  if(state.mode==='incognito'&&state.started&&!state.final&&state.phase==='playing'){openIncognitoGuess(id);return;}","incog member click")

# Show public vote counts only, never voter identity.
old='''  if(state.mode==='mixed'&&state.started&&!state.final){
    const count=mixedTargetVoteCount(targetId);
    if(count) return `<small class="public-votes">🗳️ ${count} voto${count===1?'':'s'} emitido${count===1?'':'s'}</small>`;
  }
  return '';'''
new='''  if(state.mode==='mixed'&&state.started&&!state.final){
    const count=mixedTargetVoteCount(targetId);
    if(count) return `<small class="public-votes">🗳️ ${count} voto${count===1?'':'s'} emitido${count===1?'':'s'}</small>`;
  }
  if(state.mode==='incognito'&&state.started&&!state.final&&state.phase==='playing'){
    const count=incognitoTargetVoteCount(targetId);
    if(count)return `<small class="public-votes">🗳️ ${count} voto${count===1?'':'s'} emitido${count===1?'':'s'}</small>`;
  }
  return '';'''
rep(old,new,"incog public counts")

# Replace Incognito game bar controls.
old="""  if(state.mode==='incognito'&&isAdmin&&!state.final&&state.phase==='playing') html+=`<button id=\"revealIncognitoBtn\" class=\"banner-btn\">Revelar identidades</button>`;
  if(state.mode==='incognito'&&state.final) html+=`<button id=\"showIncognitoBtn\" class=\"banner-btn\">Ver identidades</button>`;"""
new="""  if(state.mode==='incognito'&&!state.final&&state.phase==='playing'){
    const submitted=incognitoSubmittedVotes(),required=incognitoRequiredVotes();
    if(state.incognitoVoting?.closing){
      const left=Math.max(0,Math.ceil((Number(state.incognitoVoting.deadline||0)-now())/1000));
      const text=state.incognitoVoting.reason==='all'?'Todos votaron. Tenés 20 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 20 segundos para votar o cambiar tu voto.';
      html+=`<div class=\"mixed-countdown\"><span>${esc(text)}</span><strong>${left}</strong></div>`;
    }else{
      html+=`<div class=\"game-help\">Tocá a los demás personajes para adivinar quién es quién. Los votos son privados. ${submitted}/${required} votos emitidos.</div>`;
      if(isAdmin)html+=`<button id=\"revealIncognitoBtn\" class=\"banner-btn\">Finalizar votación</button>`;
    }
  }
  if(state.mode==='incognito'&&state.final) html+=`<button id=\"showIncognitoBtn\" class=\"banner-btn\">Ver resultados</button>`;"""
rep(old,new,"incog gamebar")
rep("$('revealIncognitoBtn')?.addEventListener('click',revealIncognito);","$('revealIncognitoBtn')?.addEventListener('click',finalizeIncognito);","incog final listener")

# Superadmin finish should use the voting countdown rather than instant reveal.
rep("else if(state.mode==='incognito')revealIncognito();","else if(state.mode==='incognito')finalizeIncognito();","superadmin finish")

# Reset Incognito voting on return and clear its timers.
rep("state.guesses={}; state.scores=null; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0};","state.guesses={}; state.scores=null; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.incognitoVoting={votes:{},closing:false,deadline:0,reason:''}; state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0};","return incog state")
rep("clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); privateInfo=null;","clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); privateInfo=null;","return incog timers")

p.write_text(s)

p=Path('eltopo/index.html');p.write_text(p.read_text().replace('0.10.1','0.10.2'))
p=Path('eltopo/mixed-avatar-sync.js')
if p.exists():p.write_text(p.read_text().replace('0.10.1','0.10.2'))
p=Path('eltopo/superadmin/admin.js');p.write_text(p.read_text().replace("0.10.1","0.10.2"))
p=Path('eltopo/superadmin/index.html');p.write_text(p.read_text().replace('0.10.1','0.10.2'))
