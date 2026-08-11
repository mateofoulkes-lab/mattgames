from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / 'social-game.js'
INDEX = ROOT / 'index.html'
MIXED = ROOT / 'mixed-avatar-sync.js'


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'Missing patch target: {label}')
    return text.replace(old, new, 1)


js = JS.read_text(encoding='utf-8')
js = replace_once(js, "const VERSION = '0.7.2';", "const VERSION = '0.8.0';", 'version')
js = replace_once(js, "let connectTimer = null;", "let connectTimer = null;\nlet returnLobbyTimer = null;", 'return timer')
js = replace_once(js, "members:{}, messages:[], trigger:'', guesses:{}, scores:null,", "members:{}, lobbyMessages:[], messages:[], trigger:'', guesses:{}, scores:null,", 'lobby messages state')
js = replace_once(js, "    case 'roster': return onRoster(data.payload);\n    case 'chat': return onChat(data.payload,cid);", "    case 'roster': return onRoster(data.payload);\n    case 'lobby-chat': return onLobbyChat(data.payload,cid);\n    case 'return-lobby': return onReturnLobby(data.payload);\n    case 'chat': return onChat(data.payload,cid);", 'lobby envelopes')
js = replace_once(js, "m=state.members[cid]={id:cid,realName:String(p?.name||'Jugador').slice(0,20),publicName:String(p?.name||'Jugador').slice(0,20),avatar:p?.avatar||null,online:true,spectator:late,joinedAt:now()};", "m=state.members[cid]={id:cid,realName:String(p?.name||'Jugador').slice(0,20),publicName:String(p?.name||'Jugador').slice(0,20),avatar:p?.avatar||null,lobbyAvatar:p?.avatar||null,online:true,spectator:late,joinedAt:now()};", 'remote lobby avatar')
js = replace_once(js, "      else if(late) addSystem(`${m.realName} entró como espectador porque la sala ya tiene ${MAX_PLAYERS} jugadores.`);\n      else addSystem(`${m.realName} se unió al grupo.`);", "      else if(late) addLobbySystem(`${m.realName} entró como espectador porque la sala ya tiene ${MAX_PLAYERS} jugadores.`);\n      else addLobbySystem(`${m.realName} se unió a la sala.`);", 'lobby join system')
js = replace_once(js, "      m.online=true; m.realName=String(p?.name||m.realName).slice(0,20); if(!state.started)m.publicName=m.realName; if(p?.avatar&&!state.started)m.avatar=p.avatar;", "      m.online=true; m.realName=String(p?.name||m.realName).slice(0,20); if(!state.started)m.publicName=m.realName; if(p?.avatar&&!state.started){m.avatar=p.avatar;m.lobbyAvatar=p.avatar;} if(!state.started&&!m.lobbyAvatar)m.lobbyAvatar=m.avatar||null;", 'existing member avatar')
js = replace_once(js, "  clearTimeout(connectTimer);\n  enterMessenger();\n  if(!state.started && !myAvatar) openAvatarPicker();", "  clearTimeout(connectTimer);\n  state.started ? enterMessenger() : enterLobby();\n  if(!state.started && !myAvatar) openAvatarPicker();", 'snapshot screen')
js = replace_once(js, "state.members[selfId]={id:selfId,realName:myName,publicName:myName,avatar:myAvatar,online:true,spectator:false,joinedAt:now()};", "state.members[selfId]={id:selfId,realName:myName,publicName:myName,avatar:myAvatar,lobbyAvatar:myAvatar,online:true,spectator:false,joinedAt:now()};", 'create member avatar')
js = replace_once(js, "connectToRoom(roomCode,true).then(()=>{ enterMessenger(); addSystem(`Sala ${roomCode} creada. Compartí el código.`); openAvatarPicker(); renderAll(); })", "connectToRoom(roomCode,true).then(()=>{ enterLobby(); addLobbySystem(`Sala ${roomCode} creada. Compartí el código.`); openAvatarPicker(); renderAll(); })", 'create enters lobby')
js = replace_once(js, "state.members[selfId]={id:selfId,realName:myName,publicName:myName,avatar:myAvatar,online:true,spectator:false,joinedAt:now()};", "state.members[selfId]={id:selfId,realName:myName,publicName:myName,avatar:myAvatar,lobbyAvatar:myAvatar,online:true,spectator:false,joinedAt:now()};", 'join member avatar')
js = replace_once(js, "function enterMessenger(){ $('landing')?.classList.remove('active'); $('messenger')?.classList.add('active'); $('landingError').textContent=''; }", "function enterLobby(){ $('landing')?.classList.remove('active'); $('messenger')?.classList.remove('active'); $('roomLobby')?.classList.add('active'); if($('landingError'))$('landingError').textContent=''; }\nfunction enterMessenger(){ $('landing')?.classList.remove('active'); $('roomLobby')?.classList.remove('active'); $('messenger')?.classList.add('active'); if($('landingError'))$('landingError').textContent=''; }", 'screen helpers')
js = replace_once(js, "state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.trigger=pick(TRIGGERS);", "state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.trigger=pick(TRIGGERS); state.messages=[]; replyingTo=null; enterMessenger();", 'mixed clean game chat')
js = replace_once(js, "function onMixedFinal(p){ state.final=true; state.scores=p.scores||{}; state.reveal=p.reveal||{}; if(p.guesses)state.guesses=p.guesses; renderAll(); showScoreboard(); }", "function onMixedFinal(p){ state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; if(p.guesses)state.guesses=p.guesses; renderAll(); showScoreboard(); if(isAdmin)scheduleReturnToLobby('Todo mezclado terminó.'); }", 'mixed return lobby')
js = replace_once(js, "state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null;", "state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null; enterMessenger();", 'incognito enters whatsapp')
js = replace_once(js, "function onIncognitoStart(p){ if(p?.state)state=p.state; renderAll(); }", "function onIncognitoStart(p){ if(p?.state)state=p.state; if(state.started)enterMessenger(); renderAll(); if(state.final)showIncognitoReveal(); }", 'incognito client screen')
js = replace_once(js, "  const payload={state:snapshotForClient()}; send('incognito-start',payload).catch(()=>{}); showIncognitoReveal(); renderAll();", "  const payload={state:snapshotForClient()}; send('incognito-start',payload).catch(()=>{}); showIncognitoReveal(); renderAll(); scheduleReturnToLobby('Incógnito terminó.');", 'incognito return lobby')
js = replace_once(js, "state.started=true; state.phase='playing'; state.mode='spyfall'; state.final=false; state.spyfall={votes:{},result:null}; state.trigger='Hagan preguntas de a uno. Todos conocen el lugar excepto el espía. No sean demasiado obvios.';", "state.started=true; state.phase='playing'; state.mode='spyfall'; state.final=false; state.spyfall={votes:{},result:null}; state.trigger='Hagan preguntas de a uno. Todos conocen el lugar excepto el espía. No sean demasiado obvios.'; state.messages=[]; replyingTo=null; enterMessenger();", 'spyfall clean game chat')
js = replace_once(js, "function onSpyStart(p){ if(p?.state)state=p.state; renderAll(); }", "function onSpyStart(p){ if(p?.state)state=p.state; enterMessenger(); renderAll(); }", 'spyfall client screen')
js = replace_once(js, "function onSpyFinal(p){ state.final=true; state.phase='finished'; state.spyfall.result=p.result; state.spyfall.spyId=p.spyId; state.spyfall.spyName=p.spyName; state.spyfall.location=p.location; if(p.votes)state.spyfall.votes=p.votes; renderAll(); showModal('Resultado · Spyfall',`<div class=\"spy-result\"><strong>${esc(p.result)}</strong><span>Espía: ${esc(p.spyName)}</span><span>Lugar: ${esc(p.location)}</span></div>`); }", "function onSpyFinal(p){ state.final=true; state.phase='finished'; state.spyfall.result=p.result; state.spyfall.spyId=p.spyId; state.spyfall.spyName=p.spyName; state.spyfall.location=p.location; if(p.votes)state.spyfall.votes=p.votes; renderAll(); showModal('Resultado · Spyfall',`<div class=\"spy-result\"><strong>${esc(p.result)}</strong><span>Espía: ${esc(p.spyName)}</span><span>Lugar: ${esc(p.location)}</span><small>Volviendo al lobby en unos segundos…</small></div>`); if(isAdmin)scheduleReturnToLobby(`Spyfall: ${p.result}`); }", 'spyfall notify admin and return')
js = replace_once(js, "b.onclick=()=>{send('spy-guess-location',{location:b.dataset.loc}).catch(()=>{});closeGenericModal();}", "b.onclick=()=>{const payload={location:b.dataset.loc}; if(isAdmin)onSpyGuessLocation(payload,selfId); else send('spy-guess-location',payload).catch(()=>{}); closeGenericModal();}", 'admin spy guess')

lobby_block = r'''function addLobbySystem(text){
  if(!text)return;
  state.lobbyMessages ||= [];
  const msg={id:uid(),system:true,text,ts:now()};
  state.lobbyMessages.push(msg);
  if(isAdmin&&joined)send('lobby-chat',msg).catch(()=>{});
  renderRoomLobby();
}
function onLobbyChat(msg,cid){
  if(!msg?.id)return;
  state.lobbyMessages ||= [];
  if(state.lobbyMessages.some(m=>m.id===msg.id))return;
  const copy=clone(msg);
  if(!copy.system){
    const sender=state.members[cid];
    copy.senderId=cid;
    copy.senderName=copy.senderName||sender?.realName||'Jugador';
  }
  state.lobbyMessages.push(copy);
  state.lobbyMessages.sort((a,b)=>a.ts-b.ts);
  renderRoomLobby();
}
function sendLobbyChat(){
  if(state.started)return;
  const input=$('lobbyChatInput'); const text=input?.value.trim(); if(!text)return;
  input.value='';
  const msg={id:uid(),senderId:selfId,senderName:me()?.realName||myName,text:text.slice(0,500),ts:now()};
  state.lobbyMessages ||= []; state.lobbyMessages.push(msg); renderRoomLobby();
  send('lobby-chat',msg).catch(()=>toast('No se pudo enviar el mensaje del lobby'));
}

function scheduleReturnToLobby(summary){
  if(!isAdmin)return;
  clearTimeout(returnLobbyTimer);
  returnLobbyTimer=setTimeout(()=>returnEveryoneToLobby(summary),6500);
}
function returnEveryoneToLobby(summary='Partida terminada.'){
  if(!isAdmin)return;
  clearTimeout(returnLobbyTimer);
  state.started=false; state.phase='lobby'; state.final=false; state.trigger=''; state.messages=[];
  state.guesses={}; state.scores=null; state.reveal=null; state.spyfall={votes:{},result:null};
  delete state._spyId; delete state._spyLocation;
  for(const m of Object.values(state.members)){
    m.publicName=m.realName;
    m.lobbyAvatar ||= m.avatar||null;
    m.avatar=m.lobbyAvatar||m.avatar;
    m.spectator=false;
    delete m.persona; delete m.occupation; delete m.detail;
  }
  state.lobbyMessages ||= [];
  state.lobbyMessages.push({id:uid(),system:true,text:`🏁 ${summary}`,ts:now()});
  privateInfo=null; personaOptions=null; replyingTo=null; selectedMode=state.mode||selectedMode;
  const payload={state:snapshotForClient()};
  send('return-lobby',payload).catch(()=>{});
  onReturnLobby(payload);
}
function onReturnLobby(p){
  if(!p?.state)return;
  state=p.state; selectedMode=state.mode||selectedMode; privateInfo=null; personaOptions=null; replyingTo=null;
  closeGenericModal(); $('characterSelectModal')?.classList.add('hidden');
  enterLobby(); renderAll();
}

function renderRoomLobby(){
  if(!$('roomLobby')||state.started)return;
  const members=onlineMembers().sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));
  if($('lobbyRoomCode'))$('lobbyRoomCode').textContent=roomCode||state.roomCode||'----';
  if($('lobbyTitle'))$('lobbyTitle').textContent=`Sala ${roomCode||state.roomCode||'----'}`;
  if($('lobbyPlayerCount'))$('lobbyPlayerCount').textContent=`${members.length}/${MAX_PLAYERS} jugadores`;
  if($('lobbyModeHint'))$('lobbyModeHint').textContent=isAdmin?'Elegí qué van a jugar.':'El administrador está eligiendo el modo.';
  const playersBox=$('lobbyPlayers');
  if(playersBox){
    playersBox.innerHTML=members.map(m=>`<button class="lobby-player-card" data-lobby-profile="${m.id}"><div class="lobby-player-avatar">${avatarMarkup(m)}</div><div class="lobby-player-copy"><strong>${esc(m.realName)}${m.id===selfId?' (vos)':''}</strong><span>${m.online===false?'desconectado':'listo'}</span></div>${m.id===state.adminId?'<b class="lobby-admin-tag">ADMIN</b>':''}</button>`).join('');
    playersBox.querySelectorAll('[data-lobby-profile]').forEach(b=>b.onclick=()=>b.dataset.lobbyProfile===selfId?showPrivateCard():showPublicProfile(b.dataset.lobbyProfile));
  }
  const grid=$('lobbyModeGrid');
  if(grid){
    grid.innerHTML=Object.entries(MODES).map(([k,m])=>`<button class="lobby-mode-card ${state.mode===k?'selected':''} ${m.disabled?'unavailable':''}" data-lobby-mode="${k}" ${(m.disabled||!isAdmin)?'disabled':''}><span class="lobby-mode-icon">${m.emoji}</span><strong>${esc(m.name)}</strong><small>${esc(m.desc)}</small>${m.disabled?'<em class="lobby-soon">PRÓXIMAMENTE</em>':''}</button>`).join('');
    grid.querySelectorAll('[data-lobby-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.lobbyMode));
  }
  const start=$('lobbyStartBtn');
  if(start){
    start.classList.toggle('hidden',!isAdmin);
    start.disabled=activePlayerIds().length<MIN_PLAYERS||MODES[state.mode]?.disabled;
    start.textContent=`Iniciar ${MODES[state.mode]?.name||'partida'} · ${activePlayerIds().length}`;
  }
  const chat=$('lobbyChatMessages');
  if(chat){
    const msgs=state.lobbyMessages||[];
    chat.innerHTML=msgs.length?msgs.map(m=>m.system?`<div class="lobby-chat-system">${esc(m.text)}</div>`:`<div class="lobby-chat-msg ${m.senderId===selfId?'mine':''}"><strong>${m.senderId===selfId?'Vos':esc(m.senderName||'Jugador')}</strong><span>${esc(m.text)}</span></div>`).join(''):'<div class="lobby-chat-empty">Todavía no hablaron por acá.</div>';
    chat.scrollTop=chat.scrollHeight;
  }
}

'''
js = replace_once(js, "function addSystem(text){", lobby_block + "function addSystem(text){", 'lobby helpers')
js = replace_once(js, "function renderAll(){ renderHeader(); renderMembers(); renderMessages(); renderLobby(); renderGameBar(); renderSelfProfile(); updateConnectionBadge(); }", "function renderAll(){ renderRoomLobby(); renderHeader(); renderMembers(); renderMessages(); renderLobby(); renderGameBar(); renderSelfProfile(); updateConnectionBadge(); }", 'render room lobby')
js = replace_once(js, "myAvatar=id; if(state.members[selfId])state.members[selfId].avatar=id; $('characterSelectModal').classList.add('hidden'); renderAll();", "myAvatar=id; if(state.members[selfId]){state.members[selfId].avatar=id;state.members[selfId].lobbyAvatar=id;} $('characterSelectModal').classList.add('hidden'); renderAll();", 'remember chosen lobby avatar')
js = replace_once(js, "$('sendBtn')?.addEventListener('click',sendChat);", "$('lobbyChatSend')?.addEventListener('click',sendLobbyChat);\n$('lobbyChatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendLobbyChat();}});\n$('lobbyCopyCode')?.addEventListener('click',()=>navigator.clipboard?.writeText(roomCode).then(()=>toast('Código copiado')));\n$('lobbyStartBtn')?.addEventListener('click',startGame);\n$('lobbyChangeAvatarBtn')?.addEventListener('click',openAvatarPicker);\n$('lobbyLeaveBtn')?.addEventListener('click',leaveRoom);\n$('sendBtn')?.addEventListener('click',sendChat);", 'lobby listeners')
JS.write_text(js, encoding='utf-8')

index = INDEX.read_text(encoding='utf-8')
index = index.replace('0.7.2', '0.8.0')
index = replace_once(index, '  <link rel="stylesheet" href="./social.css?v=0.8.0" />', '  <link rel="stylesheet" href="./social.css?v=0.8.0" />\n  <link rel="stylesheet" href="./lobby.css?v=0.8.0" />', 'lobby stylesheet')

lobby_html = r'''
  <section id="roomLobby" class="room-lobby screen">
    <div class="lobby-shell">
      <header class="room-lobby-top">
        <div class="lobby-brand">
          <div class="lobby-logo">🎲</div>
          <div class="lobby-brand-copy"><span class="lobby-eyebrow">SALA DE JUEGO</span><h1 id="lobbyTitle">Sala</h1></div>
        </div>
        <div class="lobby-code-box">
          <div class="lobby-code-copy"><span>CÓDIGO</span><strong id="lobbyRoomCode">----</strong></div>
          <button id="lobbyCopyCode" class="lobby-copy-btn">Copiar</button>
        </div>
        <button id="lobbyLeaveBtn" class="lobby-quiet-btn">Salir</button>
      </header>

      <div class="lobby-layout">
        <main class="lobby-main">
          <section class="lobby-panel">
            <div class="lobby-section-head"><div><h2>Jugadores</h2><p>Acá están las identidades reales. Al empezar, el juego puede cambiarlas.</p></div><span id="lobbyPlayerCount" class="lobby-count">1/12 jugadores</span></div>
            <div id="lobbyPlayers" class="lobby-player-grid"></div>
            <button id="lobbyChangeAvatarBtn" class="lobby-avatar-btn">Cambiar mi foto</button>
          </section>

          <section class="lobby-panel">
            <div class="lobby-section-head"><div><h2>Modo de juego</h2><p id="lobbyModeHint">El administrador está preparando la partida.</p></div></div>
            <div id="lobbyModeGrid" class="lobby-mode-grid"></div>
            <div class="lobby-start-row"><span class="lobby-start-note">WhatsApp se abre recién cuando empieza la partida.</span><button id="lobbyStartBtn" class="lobby-start-btn hidden">Iniciar partida</button></div>
          </section>
        </main>

        <aside class="lobby-chat-panel">
          <div class="lobby-chat-head"><h2>Chat de sala</h2><span>Un chat simple para organizarse antes de jugar.</span></div>
          <div id="lobbyChatMessages" class="lobby-chat-messages"></div>
          <div class="lobby-chat-compose"><input id="lobbyChatInput" maxlength="500" placeholder="Escribí algo…"><button id="lobbyChatSend" title="Enviar">➤</button></div>
        </aside>
      </div>
    </div>
  </section>

'''
index = replace_once(index, '  <section id="messenger" class="messenger screen">', lobby_html + '  <section id="messenger" class="messenger screen">', 'lobby DOM')
index = index.replace('      <div id="lobbyControls" class="lobby-controls"></div>\n', '')
INDEX.write_text(index, encoding='utf-8')

mixed = MIXED.read_text(encoding='utf-8')
mixed = mixed.replace("const BUILD_VERSION = '0.7.1';", "const BUILD_VERSION = '0.8.0';")
MIXED.write_text(mixed, encoding='utf-8')

print('El Topo v0.8.0 patch applied')
