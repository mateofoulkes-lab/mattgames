from pathlib import Path

root = Path('.')
js_path = root / 'eltopo/social-game.js'
html_path = root / 'eltopo/index.html'
css_path = root / 'eltopo/fixes-v010.css'
mix_path = root / 'eltopo/mixed-avatar-sync.js'

s = js_path.read_text(encoding='utf-8')

# Version/import.
s = s.replace("./game-data.js?v=0.10.9", "./game-data.js?v=0.10.10")
s = s.replace("const VERSION = '0.10.9';", "const VERSION = '0.10.10';")

# Host-only fair spy rotation: complete a shuffled bag before repeating.
old = "let spyPhaseSyncTicker = null;\nlet incognitoFinalizeTimer = null;"
new = "let spyPhaseSyncTicker = null;\nlet spyBag = [];\nlet spyBagRosterKey = '';\nlet lastSpyId = null;\nlet incognitoFinalizeTimer = null;"
assert old in s, 'spy ticker vars block not found'
s = s.replace(old, new, 1)

marker = "function startSpyfall(ids){\n"
assert marker in s, 'startSpyfall marker not found'
helper = """function chooseNextSpy(ids){
  const eligible=[...new Set(ids)].filter(id=>state.members[id]&&state.members[id].online!==false&&!state.members[id].spectator);
  if(!eligible.length)return null;
  if(state.adminForcedSpyId&&eligible.includes(state.adminForcedSpyId)){
    const forced=state.adminForcedSpyId; state.adminForcedSpyId=null; lastSpyId=forced;
    spyBag=spyBag.filter(id=>id!==forced);
    return forced;
  }
  state.adminForcedSpyId=null;
  const rosterKey=[...eligible].sort().join('|');
  if(rosterKey!==spyBagRosterKey){
    spyBagRosterKey=rosterKey;
    spyBag=shuffle([...eligible]);
  }else{
    spyBag=spyBag.filter(id=>eligible.includes(id));
    if(!spyBag.length)spyBag=shuffle([...eligible]);
  }
  if(spyBag.length>1&&spyBag[0]===lastSpyId){
    const swap=1+Math.floor(Math.random()*(spyBag.length-1));
    [spyBag[0],spyBag[swap]]=[spyBag[swap],spyBag[0]];
  }
  const spyId=spyBag.shift();
  lastSpyId=spyId;
  return spyId;
}

"""
s = s.replace(marker, helper + marker, 1)

old = "  const location=pick(SPY_LOCATIONS); const spyId=state.adminForcedSpyId&&ids.includes(state.adminForcedSpyId)?state.adminForcedSpyId:pick(ids); state.adminForcedSpyId=null; const roles=shuffle(location.roles);"
new = "  const location=pick(SPY_LOCATIONS); const spyId=chooseNextSpy(ids); if(!spyId){toast('No hay jugadores válidos para Spyfall.');return;} const roles=shuffle(location.roles);"
assert old in s, 'spy selection line not found'
s = s.replace(old, new, 1)

# Reliable, individually targeted final-phase delivery.
marker = "function beginSpyFinalVoting(){\n"
assert marker in s, 'beginSpyFinalVoting marker not found'
helper = """function pushSpyFinalPhaseToEveryPlayer(deadline){
  const payload={active:true,deadline};
  const snapshot={state:snapshotForClient()};
  for(const id of activePlayerIds()){
    if(id===selfId){
      onSpyFinalPhase(payload);
      continue;
    }
    send('spy-final-phase',payload,id).catch(()=>send('spy-final-phase',payload).catch(()=>{}));
    send('snapshot',snapshot,id).catch(()=>{});
  }
}

"""
s = s.replace(marker, helper + marker, 1)

old = """  // One public phase signal is more robust than two different targeted setup messages.
  // Each device already knows its private role and opens the correct forced modal locally.
  const payload={active:true,deadline};
  send('spy-final-phase',payload).catch(()=>{});
  onSpyFinalPhase(payload);

  // Redundant synchronization through the long-established roster channel.
  // This makes the forced modal survive a missed packet, mobile backgrounding,
  // or a client that reconnects during the 20-second final phase.
  broadcastRoster();
  clearInterval(spyPhaseSyncTicker);
  spyPhaseSyncTicker=setInterval(()=>{
    if(!isAdmin||state.mode!=='spyfall'||state.final||state.phase!=='spy-voting'||now()>=deadline){
      clearInterval(spyPhaseSyncTicker);
      return;
    }
    broadcastRoster();
    send('spy-final-phase',{active:true,deadline}).catch(()=>{});
  },1500);
"""
new = """  // Deliver the final phase directly to every logical player ID. Do not rely on
  // one room-wide broadcast: mobile clients may miss it while WebRTC is renegotiating.
  pushSpyFinalPhaseToEveryPlayer(deadline);
  broadcastRoster(); // fallback/state visibility
  clearInterval(spyPhaseSyncTicker);
  spyPhaseSyncTicker=setInterval(()=>{
    if(!isAdmin||state.mode!=='spyfall'||state.final||state.phase!=='spy-voting'||now()>=deadline){
      clearInterval(spyPhaseSyncTicker);
      return;
    }
    pushSpyFinalPhaseToEveryPlayer(deadline);
    broadcastRoster();
  },1000);
"""
assert old in s, 'old final phase broadcast block not found'
s = s.replace(old, new, 1)

# Make back action direct and independent of a normal bubbling click handler.
old = """function backToLobby(){
  if(!joined)return;
  if(!state.started){enterLobby();renderAll();return;}
  if(!confirm('¿Volver al lobby? La partida actual terminará para todos.'))return;
  if(isAdmin)returnEveryoneToLobby('La partida volvió al lobby.');
  else send('return-lobby-request',{}).then(()=>toast('Volviendo al lobby…')).catch(()=>toast('No pude volver al lobby.'));
}
"""
new = """function backToLobby(event){
  event?.preventDefault?.(); event?.stopPropagation?.();
  closeGenericModal(); closeSpyFinalChoiceModal(); $('infoPanel')?.classList.remove('open');
  if(!state.started){enterLobby();renderAll();return;}
  if(isAdmin){returnEveryoneToLobby('La partida volvió al lobby.');return;}
  if(!state.adminId){toast('No encuentro al administrador de la sala.');return;}
  send('return-lobby-request',{},state.adminId)
    .then(()=>toast('Volviendo al lobby…'))
    .catch(()=>send('return-lobby-request',{}).then(()=>toast('Volviendo al lobby…')).catch(()=>toast('No pude volver al lobby.')));
}
window.ELTOPO_BACK_TO_LOBBY=backToLobby;
"""
assert old in s, 'backToLobby block not found'
s = s.replace(old, new, 1)

old = "$('messengerBackBtn')?.addEventListener('click',backToLobby);"
new = "// messengerBackBtn uses a direct inline handler so overlays/bubbling cannot steal navigation."
assert old in s, 'old back listener not found'
s = s.replace(old, new, 1)

js_path.write_text(s, encoding='utf-8')

# HTML: bump all assets and direct back handler.
h = html_path.read_text(encoding='utf-8')
h = h.replace('v=0.10.9', 'v=0.10.10')
h = h.replace('>v0.10.9</div>', '>v0.10.10</div>')
old_btn = '<button id="messengerBackBtn" class="icon-btn messenger-back-btn" type="button" title="Volver al lobby" aria-label="Volver al lobby">‹</button>'
new_btn = '<button id="messengerBackBtn" class="icon-btn messenger-back-btn" type="button" title="Volver al lobby" aria-label="Volver al lobby" onclick="window.ELTOPO_BACK_TO_LOBBY?.(event)">‹</button>'
assert old_btn in h, 'back button html not found'
h = h.replace(old_btn, new_btn, 1)
html_path.write_text(h, encoding='utf-8')

# Keep companion build version aligned.
m = mix_path.read_text(encoding='utf-8')
m = m.replace("const BUILD_VERSION = '0.10.9';", "const BUILD_VERSION = '0.10.10';")
mix_path.write_text(m, encoding='utf-8')

# Ensure the back control wins hit-testing on desktop/mobile.
c = css_path.read_text(encoding='utf-8')
if '/* v0.10.10 navigation reliability */' not in c:
    c += "\n\n/* v0.10.10 navigation reliability */\n.messenger-back-btn{position:relative!important;z-index:30!important;flex:0 0 auto!important;pointer-events:auto!important;touch-action:manipulation;min-width:40px;min-height:40px}\n"
css_path.write_text(c, encoding='utf-8')

print('Applied v0.10.10: fair spy bag, targeted final vote sync, reliable back button')
