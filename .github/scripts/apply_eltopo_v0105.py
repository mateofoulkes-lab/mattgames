from pathlib import Path
import re

ROOT = Path('.')
js_path = ROOT / 'eltopo/social-game.js'
index_path = ROOT / 'eltopo/index.html'
sync_path = ROOT / 'eltopo/mixed-avatar-sync.js'

js = js_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
sync = sync_path.read_text(encoding='utf-8')


def replace_function(text, name, new_code):
    marker = f'function {name}('
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f'Function not found: {name}')
    next_start = text.find('\nfunction ', start + len(marker))
    if next_start < 0:
        raise RuntimeError(f'Next function not found after: {name}')
    return text[:start] + new_code.rstrip() + text[next_start:]

# Version bump.
js = js.replace("./game-data.js?v=0.10.4", "./game-data.js?v=0.10.5")
js = js.replace("const VERSION = '0.10.4';", "const VERSION = '0.10.5';")
index = index.replace('0.10.4', '0.10.5')
sync = sync.replace("const BUILD_VERSION = '0.10.4';", "const BUILD_VERSION = '0.10.5';")

# Spyfall state carries a private location-guess window in addition to crew voting.
js = js.replace(
    "spyfall:{votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0}",
    "spyfall:{votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0,locationWindow:false,spyGuessSubmitted:false,spyLocationGuess:null,spyLocationCorrect:false}"
)

# New targeted events. The spy gets a location window, never the crew-voting event.
needle = "    case 'spy-voting': return onSpyVoting(data.payload);\n"
if needle not in js:
    raise RuntimeError('spy-voting switch entry not found')
js = js.replace(needle, needle + "    case 'spy-location-window': return onSpyLocationWindow(data.payload);\n    case 'spy-location-ack': return onSpyLocationAck(data.payload);\n", 1)
needle = "    case 'return-lobby': return onReturnLobby(data.payload);\n"
if needle not in js:
    raise RuntimeError('return-lobby switch entry not found')
js = js.replace(needle, needle + "    case 'return-lobby-request': return onReturnLobbyRequest(data.payload,cid);\n", 1)

# Start Spyfall with the expanded state.
js = js.replace(
    "state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:shuffle(ids),turnIndex:0};",
    "state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:shuffle(ids),turnIndex:0,locationWindow:false,spyGuessSubmitted:false,spyLocationGuess:null,spyLocationCorrect:false};"
)

new_begin = r'''function beginSpyFinalVoting(){
  if(!isAdmin||state.mode!=='spyfall'||state.final||state.spyfall?.voting)return;
  const deadline=now()+10000;
  state.phase='spy-voting';
  state.spyfall.voting=true;
  state.spyfall.deadline=deadline;
  state.spyfall.votes={};
  state.spyfall.locationWindow=false;
  state.spyfall.spyGuessSubmitted=false;
  state.spyfall.spyLocationGuess=null;
  state.spyfall.spyLocationCorrect=false;

  const votePayload={voting:true,deadline};
  const spyPayload={active:true,deadline};
  for(const m of players()){
    if(m.id===state._spyId){
      if(m.id===selfId) onSpyLocationWindow(spyPayload);
      else send('spy-location-window',spyPayload,m.id).catch(()=>{});
    }else{
      if(m.id===selfId) onSpyVoting(votePayload);
      else send('spy-voting',votePayload,m.id).catch(()=>{});
    }
  }
  clearTimeout(spyFinalizeTimer);
  spyFinalizeTimer=setTimeout(finalizeSpyfall,10050);
  renderGameBar();
}'''
js = replace_function(js, 'beginSpyFinalVoting', new_begin)

new_on_voting = r'''function onSpyVoting(p){
  if(privateInfo?.isSpy||!p?.voting||state.final)return;
  state.phase='spy-voting';
  state.spyfall.voting=true;
  state.spyfall.deadline=Number(p.deadline)||now()+10000;
  clearInterval(spyCountdownTicker);
  spyCountdownTicker=setInterval(()=>{
    renderGameBar();
    if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);
  },200);
  renderGameBar();
}
function onSpyLocationWindow(p){
  if(!privateInfo?.isSpy||!p?.active||state.final)return;
  state.spyfall.locationWindow=true;
  state.spyfall.deadline=Number(p.deadline)||now()+10000;
  state.spyfall.spyGuessSubmitted=false;
  state.spyfall.spyLocationGuess=null;
  clearInterval(spyCountdownTicker);
  spyCountdownTicker=setInterval(()=>{
    renderGameBar();
    if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);
  },200);
  renderGameBar();
}
function spyLocationWindowOpen(){
  return state.mode==='spyfall'&&state.started&&!state.final&&privateInfo?.isSpy&&state.spyfall?.locationWindow&&now()<Number(state.spyfall.deadline||0)&&!state.spyfall.spyGuessSubmitted;
}'''
js = replace_function(js, 'onSpyVoting', new_on_voting)

new_cast = r'''function castSpyVote(targetId){
  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}
  if(state.mode!=='spyfall'||state.final||!state.spyfall?.voting||privateInfo?.isSpy||targetId===selfId||now()>=Number(state.spyfall.deadline||0))return;
  const target=state.members[targetId]; if(!target||target.online===false||target.spectator)return;
  state.spyfall.votes[selfId]=targetId;
  if(isAdmin)onSpyVote({targetId},selfId); else send('spy-vote',{targetId},state.adminId).catch(()=>{});
  toast(`Votaste a ${displayName(target)}. Podés cambiarlo hasta que termine el contador.`); renderAll();
}'''
js = replace_function(js, 'castSpyVote', new_cast)

new_on_vote = r'''function onSpyVote(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||!state.spyfall?.voting||!p?.targetId||cid===state._spyId||now()>=Number(state.spyfall.deadline||0))return;
  const voter=state.members[cid],target=state.members[p.targetId];
  if(!voter||voter.online===false||voter.spectator||!target||target.online===false||target.spectator)return;
  state.spyfall.votes[cid]=p.targetId;
}'''
js = replace_function(js, 'onSpyVote', new_on_vote)

new_finalize = r'''function finalizeSpyfall(){
  if(!isAdmin||state.mode!=='spyfall'||state.final)return;
  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  const spy=state._spyId;
  const crewIds=players().map(m=>m.id).filter(id=>id!==spy);
  const counts={};
  for(const id of crewIds){
    const target=state.spyfall.votes?.[id];
    if(target&&state.members[target]?.online!==false)counts[target]=(counts[target]||0)+1;
  }
  const spyVotes=counts[spy]||0;
  const needed=Math.floor(crewIds.length/2)+1;
  const crewWins=spyVotes>=needed;
  const castCount=crewIds.filter(id=>state.spyfall.votes?.[id]).length;
  const result=crewWins
    ? `${spyVotes} de ${crewIds.length} jugadores votaron al espía. ¡La mayoría lo descubrió!`
    : `${spyVotes} de ${crewIds.length} jugadores votaron al espía. Se necesitaban ${needed}; gana el espía.`;
  const tally=Object.entries(counts).map(([id,count])=>({id,name:state.members[id]?.realName||'Jugador',count})).sort((a,b)=>b.count-a.count);
  state.final=true; state.phase='finished'; state.spyfall.result=result; state.spyfall.locationWindow=false;
  const payload={
    result,winner:crewWins?'crew':'spy',spyId:spy,spyName:state.members[spy]?.realName||'?',location:state._spyLocation||'?',
    votes:state.spyfall.votes,tally,reason:'vote',spyVotes,needed,eligibleVoters:crewIds.length,castCount,spyGuess:state.spyfall.spyLocationGuess||null
  };
  send('spy-final',payload).catch(()=>{}); onSpyFinal(payload);
}'''
js = replace_function(js, 'finalizeSpyfall', new_finalize)

new_on_final = r'''function onSpyFinal(p){
  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  state.final=true; state.phase='finished'; state.spyfall.voting=false; state.spyfall.locationWindow=false;
  state.spyfall.result=p.result; state.spyfall.spyId=p.spyId; state.spyfall.spyName=p.spyName; state.spyfall.location=p.location;
  if(p.votes)state.spyfall.votes=p.votes;
  renderAll(); showSpyResult(p);
}'''
js = replace_function(js, 'onSpyFinal', new_on_final)

new_result = r'''function showSpyResult(p){
  const crewWon=p.winner==='crew'; const winner=crewWon?'🏆 GANA EL GRUPO':'🕵️ GANA EL ESPÍA';
  const tally=(p.tally||[]).length?(p.tally||[]).map(x=>`<span class="result-vote-chip">${esc(x.name)} ×${x.count}</span>`).join(''):'<span class="result-no-votes">Sin votos válidos</span>';
  const majority=p.reason==='vote'&&Number.isFinite(Number(p.eligibleVoters))
    ? `<div class="spy-final-detail"><span>Votos al espía</span><b>${Number(p.spyVotes||0)} / ${Number(p.eligibleVoters||0)}</b><span>Mayoría necesaria</span><b>${Number(p.needed||0)}</b></div>`:'';
  const guess=p.spyGuess?`<div class="spy-final-detail"><span>El espía eligió</span><b>${esc(p.spyGuess)}</b></div>`:'';
  const action=isAdmin?'<button id="spyReturnLobby" class="primary-btn">Cerrar resultado y volver al lobby</button>':'<button id="spyResultClose" class="primary-btn">Cerrar resultado</button>';
  showModal('🎉 Resultado · Spyfall',`<div class="spy-final-card"><div class="spy-final-winner">${winner}</div><strong>${esc(p.result||'Partida terminada')}</strong><div class="spy-final-detail"><span>El espía era</span><b>${esc(p.spyName||'?')}</b><span>El lugar era</span><b>${esc(p.location||'?')}</b></div>${majority}${guess}${p.reason==='vote'?`<div class="spy-final-tally"><span>VOTACIÓN FINAL</span>${tally}</div>`:''}${action}</div>`,()=>{
    $('spyResultClose')?.addEventListener('click',closeGenericModal);
    $('spyReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby(`Spyfall: ${p.result}`));
  });
}'''
js = replace_function(js, 'showSpyResult', new_result)

new_guess = r'''function guessSpyLocation(){
  if(!spyLocationWindowOpen()){
    if(privateInfo?.isSpy&&!state.final)toast('Podés elegir el lugar durante los 10 segundos de la votación final.');
    return;
  }
  showModal('Elegí el lugar',`<p class="modal-note">Tenés una sola elección. Si acertás, ganás aunque el grupo te haya descubierto.</p><div class="guess-list">${SPY_LOCATIONS.map(l=>`<button class="guess-option" data-loc="${esc(l.name)}">${esc(l.name)}</button>`).join('')}</div>`,modal=>modal.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{
    const payload={location:b.dataset.loc};
    if(isAdmin)onSpyGuessLocation(payload,selfId); else send('spy-guess-location',payload,state.adminId).catch(()=>toast('No pude enviar tu elección.'));
    closeGenericModal();
  }));
}'''
js = replace_function(js, 'guessSpyLocation', new_guess)

new_guess_handler = r'''function onSpyGuessLocation(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||cid!==state._spyId||!state.spyfall?.voting)return;
  if(now()>Number(state.spyfall.deadline||0)+500||state.spyfall.spyLocationGuess)return;
  const guess=String(p?.location||''); if(!guess)return;
  const correct=guess===state._spyLocation;
  state.spyfall.spyLocationGuess=guess; state.spyfall.spyLocationCorrect=correct;
  const ack={guess,correct};
  if(cid===selfId)onSpyLocationAck(ack); else send('spy-location-ack',ack,cid).catch(()=>{});
  if(!correct)return;

  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  state.final=true; state.phase='finished'; state.spyfall.locationWindow=false;
  const result=`El espía eligió “${guess}” y acertó el lugar. Gana el espía.`;
  const payload={result,winner:'spy',spyId:state._spyId,spyName:state.members[state._spyId]?.realName||'?',location:state._spyLocation,votes:state.spyfall.votes||{},tally:[],reason:'guess',spyGuess:guess};
  send('spy-final',payload).catch(()=>{}); onSpyFinal(payload);
}
function onSpyLocationAck(p){
  if(!privateInfo?.isSpy||state.final)return;
  state.spyfall.spyGuessSubmitted=true; state.spyfall.spyLocationGuess=p?.guess||null;
  if(!p?.correct)toast(`Elegiste “${p?.guess||'—'}”. No acertaste; esperá el resultado de la ronda.`);
  renderGameBar();
}'''
js = replace_function(js, 'onSpyGuessLocation', new_guess_handler)

# Replace the game banner so the crew sees a 10-second secret vote, while the spy sees only a location-choice countdown.
new_banner = r'''function renderGameBar(){
  const b=$('gameBanner'); if(!b)return;
  if(!state.started){b.classList.add('hidden');return;} b.classList.remove('hidden');
  let html=`<div class="game-phase"><strong>${MODES[state.mode]?.emoji||'🎮'} ${esc(MODES[state.mode]?.name||'Juego')}</strong><span>${esc(state.trigger||phaseText())}</span></div><button id="myCharacterBtn" class="banner-btn subtle">Mi personaje</button>`;
  if(state.mode==='mixed'&&!state.final){
    const submitted=mixedSubmittedVotes(),required=mixedRequiredVotes();
    if(state.mixedVoting?.closing){
      const left=Math.max(0,Math.ceil((Number(state.mixedVoting.deadline||0)-now())/1000));
      const text=state.mixedVoting.reason==='all'?'Todos votaron. Tenés 20 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 20 segundos para votar o cambiar tu voto.';
      html+=`<div class="mixed-countdown"><span>${esc(text)}</span><strong>${left}</strong></div>`;
    }else{
      html+=`<div class="game-help">Los votos son privados. Tocá un usuario para elegir quién creés que es. ${submitted}/${required} votos emitidos.</div>`;
      if(isAdmin)html+=`<button id="finalMixedBtn" class="banner-btn">Finalizar votación</button>`;
    }
  }
  if(state.mode==='mixed'&&state.final) html+=`<button id="showScoresBtn" class="banner-btn">Ver resultado</button>`;
  if(state.mode==='incognito'&&!state.final&&state.phase==='playing'){
    const submitted=incognitoSubmittedVotes(),required=incognitoRequiredVotes();
    if(state.incognitoVoting?.closing){
      const left=Math.max(0,Math.ceil((Number(state.incognitoVoting.deadline||0)-now())/1000));
      const text=state.incognitoVoting.reason==='all'?'Todos votaron. Tenés 20 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 20 segundos para votar o cambiar tu voto.';
      html+=`<div class="mixed-countdown"><span>${esc(text)}</span><strong>${left}</strong></div>`;
    }else{
      html+=`<div class="game-help">Tocá a los demás personajes para adivinar quién es quién. Los votos son privados. ${submitted}/${required} votos emitidos.</div>`;
      if(isAdmin)html+=`<button id="revealIncognitoBtn" class="banner-btn">Finalizar votación</button>`;
    }
  }
  if(state.mode==='incognito'&&state.final) html+=`<button id="showIncognitoBtn" class="banner-btn">Ver resultados</button>`;
  if(state.mode==='spyfall'&&!state.final){
    const turnId=currentSpyTurnId(),turn=state.members[turnId];
    if(privateInfo?.isSpy&&state.spyfall?.locationWindow){
      const left=Math.max(0,Math.ceil((Number(state.spyfall.deadline||0)-now())/1000));
      html+=`<div class="mixed-countdown"><span>Tenés 10 segundos para elegir en qué lugar están.</span><strong>${left}</strong></div>`;
      if(state.spyfall.spyGuessSubmitted)html+=`<div class="game-help">Elegiste “${esc(state.spyfall.spyLocationGuess||'—')}”. Esperá el resultado.</div>`;
      else html+=`<button id="spyGuessBtn" class="banner-btn">Elegir lugar</button>`;
    }else if(state.spyfall?.voting&&!privateInfo?.isSpy){
      const left=Math.max(0,Math.ceil((Number(state.spyfall.deadline||0)-now())/1000));
      html+=`<div class="mixed-countdown"><span>Votación final. Tenés 10 segundos para votar o cambiar tu voto.</span><strong>${left}</strong></div><div class="game-help">Tocá el nombre de quien creés que es el espía. El voto es privado.</div>`;
    }else{
      html+=`<div class="spy-turn-banner"><span>ES EL TURNO DE</span><strong>${esc(turn?displayName(turn):'—')}</strong><small>para hacer una pregunta</small></div>`;
      if(turnId===selfId)html+=`<button id="askSpyQuestionBtn" class="banner-btn">Elegir a quién preguntar</button>`;
    }
  }
  if(state.mode==='spyfall'&&isAdmin&&!state.final&&!state.spyfall?.voting) html+=`<button id="finalSpyBtn" class="banner-btn">Votación final</button>`;
  b.innerHTML=html;
  $('myCharacterBtn')?.addEventListener('click',showPrivateCard); $('finalMixedBtn')?.addEventListener('click',finalizeMixed); $('showScoresBtn')?.addEventListener('click',showScoreboard); $('revealIncognitoBtn')?.addEventListener('click',finalizeIncognito); $('showIncognitoBtn')?.addEventListener('click',showIncognitoReveal); $('spyGuessBtn')?.addEventListener('click',guessSpyLocation); $('askSpyQuestionBtn')?.addEventListener('click',openSpyQuestionPicker); $('finalSpyBtn')?.addEventListener('click',beginSpyFinalVoting);
}'''
js = replace_function(js, 'renderGameBar', new_banner)

# In the secret card, guessing the location is available only during the final 10-second window.
old_spy_card = "const html=privateInfo?.isSpy?`<div class=\"private-character spy\"><div class=\"secret-emoji\">🕵️</div><h2>SOS EL ESPÍA</h2><p>No conocés el lugar. Hacé preguntas, mezclate y tratá de deducirlo.</p><button id=\"spyGuessInside\" class=\"primary-btn\">Adivinar ubicación</button></div>`:`<div class=\"private-character\"><div class=\"secret-emoji\">📍</div><span>Ubicación</span><h2>${esc(privateInfo?.location||'—')}</h2><span>Tu rol</span><strong>${esc(privateInfo?.role||'—')}</strong><p>Respondé sin decir el lugar de forma demasiado obvia.</p></div>`;"
new_spy_card = "const canGuess=spyLocationWindowOpen();\n    const html=privateInfo?.isSpy?`<div class=\"private-character spy\"><div class=\"secret-emoji\">🕵️</div><h2>SOS EL ESPÍA</h2><p>No conocés el lugar. Hacé preguntas, mezclate y tratá de deducirlo.</p>${canGuess?'<button id=\"spyGuessInside\" class=\"primary-btn\">Elegir lugar ahora</button>':'<small>Cuando empiece la votación final vas a tener 10 segundos para elegir el lugar.</small>'}</div>`:`<div class=\"private-character\"><div class=\"secret-emoji\">📍</div><span>Ubicación</span><h2>${esc(privateInfo?.location||'—')}</h2><span>Tu rol</span><strong>${esc(privateInfo?.role||'—')}</strong><p>Respondé sin decir el lugar de forma demasiado obvia.</p></div>`;"
if old_spy_card not in js:
    raise RuntimeError('Spy private-card block not found')
js = js.replace(old_spy_card, new_spy_card, 1)

# Reset expanded Spyfall state when returning to lobby.
js = js.replace(
    "state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0};",
    "state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0,locationWindow:false,spyGuessSubmitted:false,spyLocationGuess:null,spyLocationCorrect:false};"
)

# Back arrow: returning from the game means returning the shared room to its lobby.
old_leave = "function leaveRoom(){ try{transportRoom?.leave?.();}catch{} location.reload(); }"
new_leave = r'''function leaveRoom(){ try{transportRoom?.leave?.();}catch{} location.reload(); }
function backToLobby(){
  if(!joined)return;
  if(!state.started){enterLobby();renderAll();return;}
  if(!confirm('¿Volver al lobby? La partida actual terminará para todos.'))return;
  if(isAdmin)returnEveryoneToLobby('La partida volvió al lobby.');
  else send('return-lobby-request',{},state.adminId).then(()=>toast('Volviendo al lobby…')).catch(()=>toast('No pude volver al lobby.'));
}
function onReturnLobbyRequest(p,cid){
  if(!isAdmin||!state.started||!state.members[cid]||state.members[cid].online===false)return;
  returnEveryoneToLobby('La partida volvió al lobby.');
}'''
if old_leave not in js:
    raise RuntimeError('leaveRoom function not found')
js = js.replace(old_leave, new_leave, 1)

listener = "$('lobbyLeaveBtn')?.addEventListener('click',leaveRoom);\n"
if listener not in js:
    raise RuntimeError('Lobby leave listener not found')
js = js.replace(listener, listener + "$('messengerBackBtn')?.addEventListener('click',backToLobby);\n", 1)

# Give the existing top-left arrow an id.
old_button = '<button class="icon-btn mobile-only">‹</button>'
new_button = '<button id="messengerBackBtn" class="icon-btn mobile-only" title="Volver al lobby">‹</button>'
if old_button not in index:
    raise RuntimeError('Messenger back button not found')
index = index.replace(old_button, new_button, 1)

# Basic sanity checks.
for required in [
    "const VERSION = '0.10.5';",
    "deadline=now()+10000",
    "case 'spy-location-window'",
    "Math.floor(crewIds.length/2)+1",
    "messengerBackBtn",
    "Si acertás, ganás aunque el grupo te haya descubierto"
]:
    if required not in js and required not in index:
        raise RuntimeError(f'Missing expected marker: {required}')

js_path.write_text(js, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
sync_path.write_text(sync, encoding='utf-8')
print('El Topo v0.10.5 patch applied')
