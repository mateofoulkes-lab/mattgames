from pathlib import Path

p=Path('eltopo/social-game.js')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'NOT FOUND: {label}')
    s=s.replace(old,new,1)

rep("./game-data.js?v=0.9.1","./game-data.js?v=0.10.0","game-data version")
rep("const VERSION = '0.9.1';","const VERSION = '0.10.0';","version")
rep("const shuffle = a => [...a].sort(() => Math.random() - .5);",'''const shuffle = a => {
  const out=[...a];
  for(let i=out.length-1;i>0;i--){
    const r=new Uint32Array(1); crypto.getRandomValues(r); const j=r[0]%(i+1);
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
};''',"shuffle")
rep("let mixedCountdownTicker = null;",'''let mixedCountdownTicker = null;
let spyFinalizeTimer = null;
let spyCountdownTicker = null;
const peerLeaveTimers = new Map();''',"timers")
rep("final:false, reveal:null, createdAt:now(), roomLocked:false, chatDisabled:false, pinnedMessageId:null, adminForcedSpyId:null, adminForcedTrigger:null, mixedVoting:{closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null}","final:false, reveal:null, createdAt:now(), roomLocked:false, chatDisabled:false, pinnedMessageId:null, adminForcedSpyId:null, adminForcedTrigger:null, mixedPreviousTargets:{}, mixedVoting:{closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0}","fresh state")
rep("function players(){ return Object.values(state.members).filter(m=>!m.spectator); }","function players(){ return Object.values(state.members).filter(m=>!m.spectator && m.online!==false); }","players online")

old='''  transportRoom.onPeerJoin=peerId=>{
    transportPeers.add(peerId);
    sendIntro(peerId);
    updateConnectionBadge();
  };
  transportRoom.onPeerLeave=peerId=>{
    transportPeers.delete(peerId);
    superadminPeers.delete(peerId);
    if(state.members[peerId]) state.members[peerId].online=false;
    renderAll(); updateConnectionBadge();
  };'''
new='''  transportRoom.onPeerJoin=peerId=>{
    transportPeers.add(peerId);
    clearTimeout(peerLeaveTimers.get(peerId)); peerLeaveTimers.delete(peerId);
    if(state.members[peerId]) state.members[peerId].online=true;
    sendIntro(peerId);
    renderAll(); updateConnectionBadge();
  };
  transportRoom.onPeerLeave=peerId=>{
    transportPeers.delete(peerId);
    superadminPeers.delete(peerId);
    // Browsers (especially mobile) can briefly drop WebRTC when backgrounded.
    // Keep the player visible for one minute and cancel this removal if they reconnect.
    clearTimeout(peerLeaveTimers.get(peerId));
    peerLeaveTimers.set(peerId,setTimeout(()=>{
      peerLeaveTimers.delete(peerId);
      if(state.members[peerId]){
        state.members[peerId].online=false;
        if(isAdmin&&!state.started) delete state.members[peerId];
        if(isAdmin) broadcastRoster();
      }
      renderAll(); updateConnectionBadge();
    },60000));
    updateConnectionBadge();
  };'''
rep(old,new,"peer presence")

rep("    case 'spy-vote': return onSpyVote(data.payload,cid);",'''    case 'spy-vote': return onSpyVote(data.payload,cid);
    case 'spy-question': return onSpyQuestion(data.payload,cid);
    case 'spy-turn': return onSpyTurn(data.payload);
    case 'spy-voting': return onSpyVoting(data.payload);
    case 'admin-kick': return onAdminKick(data.payload,cid);''',"new message cases")

old='''function derangement(ids){
  if(ids.length<2)return ids;
  for(let tries=0;tries<100;tries++){ const s=shuffle(ids); if(s.every((x,i)=>x!==ids[i]))return s; }
  return [...ids.slice(1),ids[0]];
}'''
new='''function derangement(ids,previous={}){
  if(ids.length<2)return ids;
  const canAvoidPrevious=ids.length>2 && ids.every(id=>previous[id]&&ids.includes(previous[id]));
  for(let tries=0;tries<600;tries++){
    const candidate=shuffle(ids);
    const noSelf=candidate.every((x,i)=>x!==ids[i]);
    const fresh=!canAvoidPrevious || candidate.every((x,i)=>previous[ids[i]]!==x);
    if(noSelf&&fresh)return candidate;
  }
  for(let tries=0;tries<300;tries++){
    const candidate=shuffle(ids);
    if(candidate.every((x,i)=>x!==ids[i]) && candidate.some((x,i)=>previous[ids[i]]!==x))return candidate;
  }
  return [...ids.slice(1),ids[0]];
}'''
rep(old,new,"derangement")
rep("  const assigned=derangement(ids);","  const assigned=derangement(ids,state.mixedPreviousTargets||{});","mixed assign")
rep("  ids.forEach((actorId,i)=>{",'''  state.mixedPreviousTargets=Object.fromEntries(ids.map((actorId,i)=>[actorId,assigned[i]]));
  ids.forEach((actorId,i)=>{''',"remember assignment")

old="""  showModal('Todo mezclado',`<div class=\"mixed-start-modal\"><span class=\"mixed-start-kicker\">VAS A INTERPRETAR A</span><div class=\"profile-big\">${avatarMarkup(targetVisual)}</div><h2>${esc(privateInfo.targetName||'—')}</h2><div class=\"mixed-trigger-card\"><span>DISPARADOR DE CONVERSACIÓN</span><strong>${esc(state.trigger)}</strong></div><button id=\"mixedStartClose\" class=\"primary-btn\">Empezar a chatear</button></div>`,()=>{$('mixedStartClose')?.addEventListener('click',closeGenericModal);});"""
new="""  showModal('Todo mezclado',`<div class=\"mixed-start-modal\"><span class=\"mixed-start-kicker\">VAS A INTERPRETAR A</span><div class=\"profile-big\">${avatarMarkup(targetVisual)}</div><h2>${esc(privateInfo.targetName||'—')}</h2><div class=\"mixed-points-help\"><strong>¿Cómo se gana?</strong><span>+1 punto por cada identidad que adivines correctamente.</span><span>+1 punto por cada voto equivocado que consigas provocar sobre tu propio usuario.</span></div><div class=\"mixed-trigger-card\"><span>DISPARADOR DE CONVERSACIÓN</span><strong>${esc(state.trigger)}</strong></div><button id=\"mixedStartClose\" class=\"primary-btn\">Empezar a chatear</button></div>`,()=>{$('mixedStartClose')?.addEventListener('click',closeGenericModal);});"""
rep(old,new,"mixed intro points")
rep("  const payload={closing:true,deadline:now()+10000,reason};","  const payload={closing:true,deadline:now()+20000,reason};","mixed 20 deadline")
rep("  state.mixedVoting={closing:true,deadline:Number(p.deadline)||now()+10000,reason:p.reason==='all'?'all':'admin'};","  state.mixedVoting={closing:true,deadline:Number(p.deadline)||now()+20000,reason:p.reason==='all'?'all':'admin'};","mixed 20 fallback")
rep("  mixedFinalizeTimer=setTimeout(completeMixedFinal,10050);","  mixedFinalizeTimer=setTimeout(completeMixedFinal,20050);","mixed timer")

start=s.index('function onMixedFinal(p){')
end=s.index('\nfunction makePersona(avatar){',start)
block=s[start:end]
newblock=r'''function onMixedFinal(p){
  clearInterval(mixedCountdownTicker); state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; if(p.guesses)state.guesses=p.guesses; renderAll(); showScoreboard();
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
  const action=isAdmin?'<button id="mixedReturnLobby" class="primary-btn">Cerrar resultados y volver al lobby</button>':'<button id="mixedResultClose" class="primary-btn">Cerrar resultados</button>';
  showModal('🎉 Resultados · Todo mezclado',`<div class="mixed-results"><div class="mixed-winner-card"><span>✨ RONDA TERMINADA ✨</span><strong>${winnerText}</strong></div><div class="mixed-results-title">¿QUIÉN ERA QUIÉN?</div><div class="mixed-results-list">${rows}</div><p class="modal-note">+1 por cada identidad acertada. +1 por cada voto equivocado que lograste provocar sobre tu usuario.</p>${action}</div>`,()=>{
    $('mixedResultClose')?.addEventListener('click',closeGenericModal);
    $('mixedReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby('Todo mezclado terminó.'));
  });
}
'''
s=s[:start]+newblock+s[end:]

# Replace all Spyfall implementation in one controlled block.
start=s.index('function startSpyfall(ids){')
end=s.index('\nfunction addLobbySystem(text){',start)
spy=r'''function startSpyfall(ids){
  state.started=true; state.phase='playing'; state.mode='spyfall'; state.final=false;
  state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:shuffle(ids),turnIndex:0};
  state.trigger='Pregunten por turnos. Todos conocen el lugar excepto el espía.'; state.messages=[]; replyingTo=null; enterMessenger();
  const location=pick(SPY_LOCATIONS); const spyId=state.adminForcedSpyId&&ids.includes(state.adminForcedSpyId)?state.adminForcedSpyId:pick(ids); state.adminForcedSpyId=null; const roles=shuffle(location.roles);
  ids.forEach((id,i)=>{
    const info=id===spyId?{mode:'spyfall',isSpy:true}:{mode:'spyfall',isSpy:false,location:location.name,role:roles[i%roles.length]};
    if(id===selfId){privateInfo=info;showPrivateCard();} else send('spy-private',info,id).catch(()=>{});
    state.members[id].publicName=state.members[id].realName; state.members[id].spectator=false;
  });
  state._spyId=spyId; state._spyLocation=location.name;
  addSystem('🕵️ Spyfall comenzó. Las preguntas se hacen por turnos.');
  const publicState=snapshotForClient();
  send('spy-start',{state:publicState}).catch(()=>{}); renderAll();
}
function onSpyPrivate(p){ privateInfo=p; showPrivateCard(); renderGameBar(); }
function onSpyStart(p){ if(p?.state)state=p.state; enterMessenger(); renderAll(); }
function currentSpyTurnId(){
  const order=(state.spyfall?.turnOrder||[]).filter(id=>state.members[id]?.online!==false&&!state.members[id]?.spectator);
  if(!order.length)return null;
  const raw=Number(state.spyfall?.turnIndex||0);
  return order[((raw%order.length)+order.length)%order.length];
}
function openSpyQuestionPicker(){
  if(state.mode!=='spyfall'||state.final||state.phase!=='playing'||currentSpyTurnId()!==selfId)return;
  const targets=players().filter(m=>m.id!==selfId);
  showModal('¿A quién le preguntás?',`<p class="modal-note">Elegí una persona. Después escribís la pregunta y el turno pasa automáticamente.</p><div class="guess-list">${targets.map(m=>`<button class="guess-option" data-spy-target="${m.id}">@${esc(displayName(m))}</button>`).join('')}</div>`,modal=>modal.querySelectorAll('[data-spy-target]').forEach(b=>b.onclick=()=>{
    const target=state.members[b.dataset.spyTarget]; if(!target)return;
    const question=prompt(`Pregunta para ${displayName(target)}:`,`¿Qué te parece este lugar?`);
    if(question&&question.trim())sendSpyQuestion(b.dataset.spyTarget,question.trim());
    closeGenericModal();
  }));
}
function sendSpyQuestion(targetId,text){
  const payload={targetId,text:String(text||'').trim().slice(0,500)}; if(!payload.text)return;
  if(isAdmin)onSpyQuestion(payload,selfId); else send('spy-question',payload,state.adminId).catch(()=>toast('No pude enviar la pregunta.'));
}
function onSpyQuestion(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||state.phase!=='playing'||cid!==currentSpyTurnId())return;
  const target=state.members[p?.targetId]; if(!target||target.online===false||target.spectator||cid===p.targetId)return;
  const question=String(p.text||'').trim().slice(0,500); if(!question)return;
  const msg={id:uid(),senderId:cid,senderName:displayName(state.members[cid]),text:`@${displayName(target)}, ${question}`,ts:now(),replyTo:null,reactions:{}};
  state.messages.push(msg); send('chat',msg).catch(()=>{}); renderMessages();
  state.spyfall.turnIndex=Number(state.spyfall.turnIndex||0)+1;
  const turn={turnOrder:state.spyfall.turnOrder,turnIndex:state.spyfall.turnIndex}; send('spy-turn',turn).catch(()=>{}); onSpyTurn(turn);
}
function onSpyTurn(p){ if(state.mode!=='spyfall'||state.final)return; state.spyfall.turnOrder=p?.turnOrder||state.spyfall.turnOrder||[]; state.spyfall.turnIndex=Number(p?.turnIndex||0); renderGameBar(); }
function beginSpyFinalVoting(){
  if(!isAdmin||state.mode!=='spyfall'||state.final||state.spyfall?.voting)return;
  state.phase='spy-voting'; state.spyfall.voting=true; state.spyfall.deadline=now()+20000; state.spyfall.votes={};
  const payload={voting:true,deadline:state.spyfall.deadline};
  for(const m of players()) if(m.id!==state._spyId){ if(m.id===selfId)onSpyVoting(payload); else send('spy-voting',payload,m.id).catch(()=>{}); }
  clearTimeout(spyFinalizeTimer); spyFinalizeTimer=setTimeout(finalizeSpyfall,20050); renderGameBar();
}
function onSpyVoting(p){
  if(privateInfo?.isSpy||!p?.voting||state.final)return;
  state.phase='spy-voting'; state.spyfall.voting=true; state.spyfall.deadline=Number(p.deadline)||now()+20000;
  clearInterval(spyCountdownTicker); spyCountdownTicker=setInterval(()=>{renderGameBar();if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);},200); renderGameBar();
}
function castSpyVote(targetId){
  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}
  if(state.mode!=='spyfall'||state.final||!state.spyfall?.voting||privateInfo?.isSpy||targetId===selfId)return;
  const target=state.members[targetId]; if(!target||target.online===false||target.spectator)return;
  state.spyfall.votes[selfId]=targetId;
  if(isAdmin)onSpyVote({targetId},selfId); else send('spy-vote',{targetId},state.adminId).catch(()=>{});
  toast(`Votaste a ${displayName(target)}. Podés cambiarlo hasta que termine el contador.`); renderAll();
}
function onSpyVote(p,cid){ if(!isAdmin||state.mode!=='spyfall'||state.final||!state.spyfall?.voting||!p?.targetId||cid===state._spyId)return; if(!state.members[p.targetId]||state.members[p.targetId].online===false)return; state.spyfall.votes[cid]=p.targetId; }
function finalizeSpyfall(){
  if(!isAdmin||state.mode!=='spyfall'||state.final)return;
  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  const crewIds=players().map(m=>m.id).filter(id=>id!==state._spyId);
  const counts={}; for(const id of crewIds){const target=state.spyfall.votes?.[id];if(target&&state.members[target]?.online!==false)counts[target]=(counts[target]||0)+1;}
  const max=Math.max(0,...Object.values(counts)); const top=max?Object.keys(counts).filter(id=>counts[id]===max):[];
  const accused=top.length===1?top[0]:null; const spy=state._spyId; const crewWins=accused===spy;
  const result=accused?`${displayName(state.members[accused])} fue el más votado. ${crewWins?'¡Era el espía!':'No era el espía.'}`:'La votación terminó empatada o sin mayoría.';
  const tally=Object.entries(counts).map(([id,count])=>({id,name:state.members[id]?.realName||'Jugador',count})).sort((a,b)=>b.count-a.count);
  state.final=true; state.phase='finished'; state.spyfall.result=result;
  const payload={result,winner:crewWins?'crew':'spy',spyId:spy,spyName:state.members[spy]?.realName||'?',location:state._spyLocation||'?',votes:state.spyfall.votes,tally,reason:'vote'};
  send('spy-final',payload).catch(()=>{}); onSpyFinal(payload);
}
function onSpyFinal(p){
  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); state.final=true; state.phase='finished'; state.spyfall.voting=false; state.spyfall.result=p.result; state.spyfall.spyId=p.spyId; state.spyfall.spyName=p.spyName; state.spyfall.location=p.location; if(p.votes)state.spyfall.votes=p.votes; renderAll(); showSpyResult(p);
}
function showSpyResult(p){
  const crewWon=p.winner==='crew'; const winner=crewWon?'🏆 GANA EL GRUPO':'🕵️ GANA EL ESPÍA';
  const tally=(p.tally||[]).length?(p.tally||[]).map(x=>`<span class="result-vote-chip">${esc(x.name)} ×${x.count}</span>`).join(''):'<span class="result-no-votes">Sin votos válidos</span>';
  const action=isAdmin?'<button id="spyReturnLobby" class="primary-btn">Cerrar resultado y volver al lobby</button>':'<button id="spyResultClose" class="primary-btn">Cerrar resultado</button>';
  showModal('🎉 Resultado · Spyfall',`<div class="spy-final-card"><div class="spy-final-winner">${winner}</div><strong>${esc(p.result||'Partida terminada')}</strong><div class="spy-final-detail"><span>El espía era</span><b>${esc(p.spyName||'?')}</b><span>El lugar era</span><b>${esc(p.location||'?')}</b></div>${p.reason==='vote'?`<div class="spy-final-tally"><span>VOTACIÓN FINAL</span>${tally}</div>`:''}${action}</div>`,()=>{
    $('spyResultClose')?.addEventListener('click',closeGenericModal);
    $('spyReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby(`Spyfall: ${p.result}`));
  });
}
function guessSpyLocation(){
  if(privateInfo?.mode!=='spyfall'||!privateInfo.isSpy||state.final)return;
  showModal('Adivinar ubicación',`<p class="modal-note">Si acertás, ganás inmediatamente. Si fallás, gana el grupo.</p><div class="guess-list">${SPY_LOCATIONS.map(l=>`<button class="guess-option" data-loc="${esc(l.name)}">${esc(l.name)}</button>`).join('')}</div>`,modal=>modal.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{const payload={location:b.dataset.loc}; if(isAdmin)onSpyGuessLocation(payload,selfId); else send('spy-guess-location',payload,state.adminId).catch(()=>{}); closeGenericModal();}));
}
function onSpyGuessLocation(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||cid!==state._spyId)return;
  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  const correct=p?.location===state._spyLocation;
  const result=correct?`El espía adivinó “${state._spyLocation}”.`:`El espía falló: dijo “${p?.location}”.`;
  const payload={result,winner:correct?'spy':'crew',spyId:state._spyId,spyName:state.members[state._spyId]?.realName||'?',location:state._spyLocation,votes:state.spyfall.votes||{},tally:[],reason:'guess'};
  send('spy-final',payload).catch(()=>{}); onSpyFinal(payload);
}
'''
s=s[:start]+spy+s[end:]

# Lobby kick helpers before lobby system section.
marker='function addLobbySystem(text){'
kick=r'''function kickLobbyMember(targetId){
  if(!isAdmin||state.started||targetId===selfId||!state.members[targetId])return;
  const name=state.members[targetId].realName||'Jugador';
  send('admin-kick',{reason:'El administrador te sacó de la sala.'},targetId).catch(()=>{});
  delete state.members[targetId]; transportPeers.delete(targetId); addLobbySystem(`🚪 ${name} fue retirado de la sala por el administrador.`); broadcastRoster();
}
function onAdminKick(p,cid){
  if(cid!==state.adminId)return;
  try{transportRoom?.leave?.();}catch{} joined=false; sessionStorage.setItem('eltopo-superadmin-notice',p?.reason||'El administrador te sacó de la sala.'); location.reload();
}

'''+marker
if marker not in s: raise SystemExit('lobby marker missing')
s=s.replace(marker,kick,1)

# Reset Spyfall timers/state at lobby return.
rep("state.guesses={}; state.scores=null; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.spyfall={votes:{},result:null};","state.guesses={}; state.scores=null; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0};","return spy state")
rep("  clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); privateInfo=null;","  clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); privateInfo=null;","return timers")

# Lobby cards + admin kick button.
old='''    playersBox.innerHTML=members.map(m=>`<button class="lobby-player-card" data-lobby-profile="${m.id}"><div class="lobby-player-avatar">${avatarMarkup(m)}</div><div class="lobby-player-copy"><strong>${esc(m.realName)}${m.id===selfId?' (vos)':''}</strong><span>${m.online===false?'desconectado':'listo'}</span></div>${m.id===state.adminId?'<b class="lobby-admin-tag">ADMIN</b>':''}</button>`).join('');
    playersBox.querySelectorAll('[data-lobby-profile]').forEach(b=>b.onclick=()=>b.dataset.lobbyProfile===selfId?showPrivateCard():showPublicProfile(b.dataset.lobbyProfile));'''
new='''    playersBox.innerHTML=members.map(m=>`<div class="lobby-player-card"><button class="lobby-player-main" data-lobby-profile="${m.id}"><div class="lobby-player-avatar">${avatarMarkup(m)}</div><div class="lobby-player-copy"><strong>${esc(m.realName)}${m.id===selfId?' (vos)':''}</strong><span>listo</span></div>${m.id===state.adminId?'<b class="lobby-admin-tag">ADMIN</b>':''}</button>${isAdmin&&m.id!==selfId?`<button class="lobby-kick-user" data-lobby-kick="${m.id}" title="Echar de la sala">Echar</button>`:''}</div>`).join('');
    playersBox.querySelectorAll('[data-lobby-profile]').forEach(b=>b.onclick=()=>b.dataset.lobbyProfile===selfId?showPrivateCard():showPublicProfile(b.dataset.lobbyProfile));
    playersBox.querySelectorAll('[data-lobby-kick]').forEach(b=>b.onclick=()=>{const m=state.members[b.dataset.lobbyKick];if(m&&confirm(`¿Echar a ${m.realName} de la sala?`))kickLobbyMember(b.dataset.lobbyKick);});'''
rep(old,new,"lobby kick cards")

# Members: current players only, and never reveal host/admin inside a running game.
old="""  Object.entries(state.members).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)).forEach(([id,m])=>{"""
new="""  Object.entries(state.members).filter(([,m])=>m.online!==false).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)).forEach(([id,m])=>{"""
rep(old,new,"render active members")
rep("${id===state.adminId?'<span class=\"host-badge\">ADMIN</span>':''}","${!state.started&&id===state.adminId?'<span class=\"host-badge\">ADMIN</span>':''}","hide admin in game")

# Spyfall must not publish who voted for whom.
start=s.index("  if(state.mode==='spyfall'&&state.started){")
end=s.index("  return '';",start)
s=s[:start]+s[end:]

old='''  if(state.mode==='spyfall'&&state.started&&!state.final){castSpyVote(id);toast(`Ahora sospechás de ${displayName(state.members[id])}`);return;}'''
new='''  if(state.mode==='spyfall'&&state.started&&!state.final&&state.spyfall?.voting&&!privateInfo?.isSpy){castSpyVote(id);return;}'''
rep(old,new,"spy member click")

# Game bar texts / controls.
rep("const text=state.mixedVoting.reason==='all'?'Todos votaron. Tenés 10 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 10 segundos para votar o cambiar tu voto.';","const text=state.mixedVoting.reason==='all'?'Todos votaron. Tenés 20 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 20 segundos para votar o cambiar tu voto.';","mixed banner 20")
old='''  if(state.mode==='spyfall'&&!state.final) html+=`<div class="game-help">Tocá un nombre para marcarlo como sospechoso. Podés cambiar tu voto.</div>`;
  if(state.mode==='spyfall'&&privateInfo?.isSpy&&!state.final) html+=`<button id="spyGuessBtn" class="banner-btn">Adivinar lugar</button>`;
  if(state.mode==='spyfall'&&isAdmin&&!state.final) html+=`<button id="finalSpyBtn" class="banner-btn">Votación final</button>`;'''
new='''  if(state.mode==='spyfall'&&!state.final){
    const turnId=currentSpyTurnId(),turn=state.members[turnId];
    if(state.spyfall?.voting&&!privateInfo?.isSpy){
      const left=Math.max(0,Math.ceil((Number(state.spyfall.deadline||0)-now())/1000));
      html+=`<div class="mixed-countdown"><span>Votación final. Tu voto es privado. Tenés 20 segundos para votar o cambiarlo.</span><strong>${left}</strong></div><div class="game-help">Tocá el nombre de quien creés que es el espía.</div>`;
    }else{
      html+=`<div class="spy-turn-banner"><span>ES EL TURNO DE</span><strong>${esc(turn?displayName(turn):'—')}</strong><small>para hacer una pregunta</small></div>`;
      if(turnId===selfId)html+=`<button id="askSpyQuestionBtn" class="banner-btn">Elegir a quién preguntar</button>`;
    }
  }
  if(state.mode==='spyfall'&&privateInfo?.isSpy&&!state.final) html+=`<button id="spyGuessBtn" class="banner-btn">Adivinar lugar</button>`;
  if(state.mode==='spyfall'&&isAdmin&&!state.final&&!state.spyfall?.voting) html+=`<button id="finalSpyBtn" class="banner-btn">Votación final</button>`;'''
rep(old,new,"spy game bar")
rep("$('spyGuessBtn')?.addEventListener('click',guessSpyLocation); $('finalSpyBtn')?.addEventListener('click',finalizeSpyfall);","$('spyGuessBtn')?.addEventListener('click',guessSpyLocation); $('askSpyQuestionBtn')?.addEventListener('click',openSpyQuestionPicker); $('finalSpyBtn')?.addEventListener('click',beginSpyFinalVoting);","spy listeners")

# Make visible-tab return proactively re-announce presence.
append="""
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&joined){ sendIntro(); renderAll(); } });
"""
s=s+append
p.write_text(s)

# Version/cache-bust HTML and attach small CSS extension.
p=Path('eltopo/index.html')
h=p.read_text().replace('0.9.1','0.10.0')
if 'fixes-v010.css' not in h:
    h=h.replace('</head>','  <link rel="stylesheet" href="./fixes-v010.css?v=0.10.0" />\n</head>')
p.write_text(h)

p=Path('eltopo/mixed-avatar-sync.js')
if p.exists(): p.write_text(p.read_text().replace("0.9.1","0.10.0"))
