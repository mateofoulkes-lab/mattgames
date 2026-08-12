from pathlib import Path

p=Path('eltopo/social-game.js')
s=p.read_text()

# version bump
s=s.replace("./game-data.js?v=0.8.4", "./game-data.js?v=0.9.0")
s=s.replace("const VERSION = '0.8.4';", "const VERSION = '0.9.0';")

# superadmin peer set
s=s.replace("let transportPeers = new Set();\nlet state = freshState();", "let transportPeers = new Set();\nlet superadminPeers = new Set();\nlet state = freshState();")

# richer canonical room state
s=s.replace(
"    final:false, reveal:null, createdAt:now(), mixedVoting:{closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null}\n",
"    final:false, reveal:null, createdAt:now(), roomLocked:false, chatDisabled:false, pinnedMessageId:null, adminForcedSpyId:null, mixedVoting:{closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null}\n"
)

# peer cleanup
s=s.replace("    transportPeers.delete(peerId);\n    if(state.members[peerId])", "    transportPeers.delete(peerId);\n    superadminPeers.delete(peerId);\n    if(state.members[peerId])")

# switch hello
s=s.replace("    case 'superadmin-command': return onSuperadminCommand(data.payload,cid);", "    case 'superadmin-hello': return onSuperadminHello(data.payload,cid);\n    case 'superadmin-command': return onSuperadminCommand(data.payload,cid);")

start=s.index("function onSuperadminCommand(p,cid){")
end=s.index("\nfunction onIntro(cid,p){", start)
new_block=r'''function quickStateHash(value){
  const text=JSON.stringify(value); let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}
function superadminSnapshot(){
  const mine=me();
  return {
    clientId:selfId,room:roomCode,name:myName,publicName:displayName(mine),avatar:mine?.avatar||myAvatar,
    isAdmin,version:VERSION,mode:state.mode,phase:state.phase,started:state.started,createdAt:state.createdAt,
    stateHash:quickStateHash(snapshotForClient()),
    flags:{muted:!!mine?.muted,voteBlocked:!!mine?.voteBlocked,spectator:!!mine?.spectator},
    privateInfo:privateInfo?clone(privateInfo):null,
    canonical:isAdmin?{state:clone(state)}:null,ts:now()
  };
}
function sendSuperadminState(targetId){
  if(!joined||!socialAction||!targetId)return;
  send('superadmin-state',superadminSnapshot(),targetId).catch(()=>{});
}
function onSuperadminHello(p,cid){
  if(!p||p.proof!==SUPERADMIN_PROOF||!cid)return;
  superadminPeers.add(cid);
  sendSuperadminState(cid);
}
function broadcastFullState(){
  if(!isAdmin)return;
  send('snapshot',{state:snapshotForClient()}).catch(()=>{});
  renderAll();
  for(const id of superadminPeers)sendSuperadminState(id);
}
function canonicalPlayerCommand(p){
  if(!isAdmin||!p?.targetId)return false;
  const m=state.members[p.targetId];
  if(!m&& !['kick','ban'].includes(p.command))return false;
  switch(p.command){
    case 'rename': {
      const next=String(p.value||'').trim().slice(0,20); if(!next)return true;
      m.realName=next; if(!state.started)m.publicName=next; break;
    }
    case 'avatar': m.avatar=p.value||m.avatar; m.lobbyAvatar=p.value||m.lobbyAvatar; break;
    case 'mute': m.muted=!!p.value; break;
    case 'vote-block': m.voteBlocked=!!p.value; break;
    case 'spectator': m.spectator=!!p.value; break;
    case 'kick': case 'ban': delete state.members[p.targetId]; break;
    case 'transfer-admin': state.adminId=p.targetId; break;
    case 'mixed-target': {
      const target=state.members[p.value];
      if(state.mode==='mixed'&&target){m.publicName=target.realName;m.avatar=target.lobbyAvatar||target.avatar;} break;
    }
    default:return false;
  }
  broadcastRoster(); broadcastFullState();
  if(p.command==='transfer-admin'&&p.targetId!==selfId)setTimeout(()=>{isAdmin=false;renderAll();},80);
  return true;
}
function simulateVotesForQA(){
  const ids=players().map(m=>m.id);
  if(state.mode==='mixed'){
    const names=players().map(m=>m.realName);
    for(const voter of ids){state.guesses[voter]||={};for(const target of ids)if(voter!==target&&!state.guesses[voter][target])state.guesses[voter][target]=pick(names);}
    broadcastFullState(); maybeStartAutoMixedCountdown();
  }else if(state.mode==='spyfall'){
    for(const voter of ids)if(!state.spyfall.votes[voter])state.spyfall.votes[voter]=pick(ids.filter(x=>x!==voter));
    broadcastFullState();
  }
}
function roomSuperadminCommand(p){
  if(!isAdmin||!p?.command)return false;
  switch(p.command){
    case 'room-lock': state.roomLocked=!!p.value; addLobbySystem(state.roomLocked?'🔒 El superadmin bloqueó nuevos ingresos.':'🔓 El superadmin habilitó nuevos ingresos.'); broadcastFullState(); break;
    case 'return-lobby': returnEveryoneToLobby('El superadmin devolvió la partida al lobby.'); break;
    case 'restart': {const mode=state.mode;returnEveryoneToLobby('El superadmin reinició la partida.');setTimeout(()=>{state.mode=mode;selectedMode=mode;startGame();},900);break;}
    case 'set-mode': {const mode=String(p.value||'');if(!MODES[mode]||MODES[mode].disabled)return true;if(state.started){returnEveryoneToLobby('Cambio de modo por superadmin.');setTimeout(()=>setMode(mode),500);}else setMode(mode);break;}
    case 'start': startGame(); break;
    case 'finish': if(state.mode==='mixed')completeMixedFinal();else if(state.mode==='incognito')revealIncognito();else if(state.mode==='spyfall')finalizeSpyfall(); break;
    case 'timer': if(state.mode==='mixed'&&state.mixedVoting?.closing){state.mixedVoting.deadline=Math.max(now()+500,Number(state.mixedVoting.deadline||now())+Number(p.value||0));send('mixed-countdown',state.mixedVoting).catch(()=>{});onMixedCountdown(state.mixedVoting);} break;
    case 'system-message': state.started?addSystem(String(p.value||'').slice(0,500)):addLobbySystem(String(p.value||'').slice(0,500)); break;
    case 'chat-disable': state.chatDisabled=!!p.value; broadcastFullState(); break;
    case 'chat-clear': state.messages=[]; broadcastFullState(); break;
    case 'delete-message': state.messages=state.messages.filter(m=>m.id!==p.value); broadcastFullState(); break;
    case 'edit-message': {const m=state.messages.find(m=>m.id===p.messageId);if(m&&!m.system)m.text=String(p.value||'').slice(0,1000);broadcastFullState();break;}
    case 'pin-message': state.pinnedMessageId=p.value||null;if(p.value)addSystem('📌 El superadmin fijó un mensaje.');broadcastFullState();break;
    case 'force-trigger': state.trigger=String(p.value||'').slice(0,500);if(state.trigger)addSystem(`💬 Nuevo disparador: ${state.trigger}`);broadcastFullState();break;
    case 'force-spy': state.adminForcedSpyId=p.targetId||null;addLobbySystem(p.targetId?`🧪 Próximo espía fijado por superadmin.`:'🧪 Próximo espía vuelve a ser aleatorio.');broadcastFullState();break;
    case 'simulate-votes': simulateVotesForQA(); break;
    case 'set-vote': {
      if(state.mode==='mixed'&&p.voterId&&p.targetId){state.guesses[p.voterId]||={};state.guesses[p.voterId][p.targetId]=String(p.value||'');broadcastFullState();}
      else if(state.mode==='spyfall'&&p.voterId&&p.targetId){state.spyfall.votes[p.voterId]=p.targetId;broadcastFullState();}
      break;
    }
    default:return false;
  }
  return true;
}
function onSuperadminCommand(p,cid){
  if(!p||p.proof!==SUPERADMIN_PROOF)return;
  const targetMe=!p.targetId||p.targetId===selfId;
  if(p.canonical&&isAdmin)canonicalPlayerCommand(p);
  if(p.roomCommand&&isAdmin){roomSuperadminCommand(p);return;}
  if(!targetMe)return;
  if(p.command==='ping'){send('superadmin-pong',{requestId:p.requestId,clientId:selfId,at:now()},cid).catch(()=>{});return;}
  if(p.command==='rename'){
    const next=String(p.value||'').trim().slice(0,20); if(!next)return;
    myName=next;if($('playerName'))$('playerName').value=next;const m=me();if(m){m.realName=next;if(!state.started)m.publicName=next;}renderAll();sendIntro();toast('El superadmin cambió tu nombre.');
  }else if(p.command==='avatar'){
    myAvatar=p.value||myAvatar;const m=me();if(m){m.avatar=myAvatar;if(!state.started)m.lobbyAvatar=myAvatar;}renderAll();sendIntro();toast('El superadmin cambió tu foto.');
  }else if(p.command==='mute'){if(me())me().muted=!!p.value;renderAll();toast(p.value?'El superadmin silenció tu chat.':'Chat habilitado nuevamente.');
  }else if(p.command==='vote-block'){if(me())me().voteBlocked=!!p.value;renderAll();toast(p.value?'El superadmin bloqueó tus votos.':'Votación habilitada nuevamente.');
  }else if(p.command==='spectator'){if(me())me().spectator=!!p.value;renderAll();
  }else if(p.command==='mixed-target'){
    const t=state.members[p.value];if(t){privateInfo={mode:'mixed',targetName:t.realName,targetAvatar:t.lobbyAvatar||t.avatar,targetId:p.value,realName:me()?.realName||myName};if(me()){me().publicName=t.realName;me().avatar=t.lobbyAvatar||t.avatar;}lastMixedIntroTrigger='';renderAll();maybeShowMixedIntro();}
  }else if(p.command==='reconnect'){
    const code=roomCode,admin=isAdmin;try{transportRoom?.leave?.();}catch{}joined=false;setTimeout(()=>connectToRoom(code,admin).then(()=>sendIntro()),550);
  }else if(p.command==='ban'){
    const minutes=Math.max(1,Number(p.value||15));localStorage.setItem(`eltopo-ban-${roomCode}`,String(now()+minutes*60000));try{transportRoom?.leave?.();}catch{}sessionStorage.setItem('eltopo-superadmin-notice',`Fuiste bloqueado de esta sala por ${minutes} minutos.`);location.reload();
  }else if(p.command==='kick'){
    try{transportRoom?.leave?.();}catch{}joined=false;sessionStorage.setItem('eltopo-superadmin-notice','El superadmin te sacó de la sala.');location.reload();
  }
  sendSuperadminState(cid);
}
'''
s=s[:start]+new_block+s[end:]

# locked room rejects fresh members
s=s.replace("  if(isAdmin){\n    let m=state.members[cid];", "  if(isAdmin){\n    let m=state.members[cid];\n    if(!m&&state.roomLocked){send('system',{text:'La sala está bloqueada por el superadmin.'},cid).catch(()=>{});return;}")

# admin transfer awareness
s=s.replace("  state.adminId=p.adminId; state.mode=p.mode; state.phase=p.phase; state.started=p.started;\n  renderAll();", "  state.adminId=p.adminId; state.mode=p.mode; state.phase=p.phase; state.started=p.started; isAdmin=state.adminId===selfId;\n  renderAll();")

# ban guard on join
s=s.replace("  if(code.length!==4){$('landingError').textContent='El código tiene 4 letras.';return;}\n  state=freshState();", "  if(code.length!==4){$('landingError').textContent='El código tiene 4 letras.';return;}\n  const banUntil=Number(localStorage.getItem(`eltopo-ban-${code}`)||0);if(banUntil>now()){$('landingError').textContent=`Estás bloqueado de esta sala por ${Math.ceil((banUntil-now())/60000)} min.`;return;}else if(banUntil)localStorage.removeItem(`eltopo-ban-${code}`);\n  state=freshState();")

# chat/mute guards
s=s.replace("function sendLobbyChat(){\n  if(state.started)return;", "function sendLobbyChat(){\n  if(state.started)return;if(state.chatDisabled||me()?.muted){toast('El chat está deshabilitado.');return;}")
s=s.replace("function sendChat(){\n  const input=$('messageInput');", "function sendChat(){\n  if(state.chatDisabled||me()?.muted){toast('El chat está deshabilitado.');return;}\n  const input=$('messageInput');")

# vote guards
s=s.replace("function castGuess(targetId,realName){\n  if(!mixedVoteWindowOpen())return;", "function castGuess(targetId,realName){\n  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}\n  if(!mixedVoteWindowOpen())return;")
s=s.replace("function castSpyVote(targetId){\n  if(state.mode!=='spyfall'||state.final||targetId===selfId)return;", "function castSpyVote(targetId){\n  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}\n  if(state.mode!=='spyfall'||state.final||targetId===selfId)return;")

# forced next spy
s=s.replace("  const location=pick(SPY_LOCATIONS); const spyId=pick(ids); const roles=shuffle(location.roles);", "  const location=pick(SPY_LOCATIONS); const spyId=state.adminForcedSpyId&&ids.includes(state.adminForcedSpyId)?state.adminForcedSpyId:pick(ids); state.adminForcedSpyId=null; const roles=shuffle(location.roles);")

# telemetry heartbeat
marker="buildEmojiPicker(); renderComposerReply(); renderAll();"
s=s.replace(marker, marker+"\nsetInterval(()=>{if(joined&&roomCode)for(const id of [...superadminPeers])sendSuperadminState(id);},3000);")

p.write_text(s)

# index/cache bump
p=Path('eltopo/index.html');s=p.read_text().replace('0.8.4','0.9.0');p.write_text(s)
p=Path('eltopo/mixed-avatar-sync.js');
if p.exists():p.write_text(p.read_text().replace("const BUILD_VERSION = '0.8.4';","const BUILD_VERSION = '0.9.0';"))
