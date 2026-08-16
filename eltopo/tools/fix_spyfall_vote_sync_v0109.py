from pathlib import Path

p = Path('eltopo/social-game.js')
s = p.read_text(encoding='utf-8')

s = s.replace("./game-data.js?v=0.10.8", "./game-data.js?v=0.10.9")
s = s.replace("const VERSION = '0.10.8';", "const VERSION = '0.10.9';")

old = "let spyFinalizeTimer = null;\nlet spyCountdownTicker = null;"
new = "let spyFinalizeTimer = null;\nlet spyCountdownTicker = null;\nlet spyPhaseSyncTicker = null;"
assert old in s
s = s.replace(old, new, 1)

old = "function broadcastRoster(){\n  if(!isAdmin)return;\n  send('roster',{members:state.members,adminId:state.adminId,mode:state.mode,phase:state.phase,started:state.started}).catch(()=>{});\n  renderAll();\n}\nfunction onRoster(p){\n  if(!p?.members)return;\n  const localMe=state.members[selfId];\n  state.members=p.members; if(localMe&&state.members[selfId]) state.members[selfId].online=true;\n  state.adminId=p.adminId; state.mode=p.mode; state.phase=p.phase; state.started=p.started; isAdmin=state.adminId===selfId;\n  renderAll();\n}"
new = "function broadcastRoster(){\n  if(!isAdmin)return;\n  const spyFinal=state.mode==='spyfall'&&state.phase==='spy-voting'&&state.spyfall?.voting\n    ? {active:true,deadline:Number(state.spyfall.deadline||0)} : null;\n  send('roster',{members:state.members,adminId:state.adminId,mode:state.mode,phase:state.phase,started:state.started,spyFinal}).catch(()=>{});\n  renderAll();\n}\nfunction onRoster(p){\n  if(!p?.members)return;\n  const localMe=state.members[selfId];\n  state.members=p.members; if(localMe&&state.members[selfId]) state.members[selfId].online=true;\n  state.adminId=p.adminId; state.mode=p.mode; state.phase=p.phase; state.started=p.started; isAdmin=state.adminId===selfId;\n  if(p.spyFinal?.active&&state.mode==='spyfall'&&!state.final){\n    state.phase='spy-voting';\n    state.spyfall ||= {};\n    state.spyfall.voting=true;\n    state.spyfall.deadline=Number(p.spyFinal.deadline)||state.spyfall.deadline||now()+20000;\n    state.spyfall.locationWindow=!!privateInfo?.isSpy;\n  }\n  renderAll();\n  ensureSpyFinalChoiceUI();\n}"
assert old in s
s = s.replace(old, new, 1)

old = "  if(!state.started && !myAvatar) openAvatarPicker();\n  renderAll();\n}"
new = "  if(!state.started && !myAvatar) openAvatarPicker();\n  renderAll();\n  ensureSpyFinalChoiceUI();\n}"
assert old in s
s = s.replace(old, new, 1)

old = "function startSpyfall(ids){\n  state.started=true; state.phase='playing'; state.mode='spyfall'; state.final=false;"
new = "function startSpyfall(ids){\n  clearInterval(spyPhaseSyncTicker);\n  state.started=true; state.phase='playing'; state.mode='spyfall'; state.final=false;"
assert old in s
s = s.replace(old, new, 1)

old = "  const payload={active:true,deadline};\n  send('spy-final-phase',payload).catch(()=>{});\n  onSpyFinalPhase(payload);\n  clearTimeout(spyFinalizeTimer);\n  spyFinalizeTimer=setTimeout(finalizeSpyfall,20050);\n}"
new = "  const payload={active:true,deadline};\n  send('spy-final-phase',payload).catch(()=>{});\n  onSpyFinalPhase(payload);\n\n  // Redundant synchronization through the long-established roster channel.\n  // This makes the forced modal survive a missed packet, mobile backgrounding,\n  // or a client that reconnects during the 20-second final phase.\n  broadcastRoster();\n  clearInterval(spyPhaseSyncTicker);\n  spyPhaseSyncTicker=setInterval(()=>{\n    if(!isAdmin||state.mode!=='spyfall'||state.final||state.phase!=='spy-voting'||now()>=deadline){\n      clearInterval(spyPhaseSyncTicker);\n      return;\n    }\n    broadcastRoster();\n    send('spy-final-phase',{active:true,deadline}).catch(()=>{});\n  },1500);\n\n  clearTimeout(spyFinalizeTimer);\n  spyFinalizeTimer=setTimeout(finalizeSpyfall,20050);\n}"
assert old in s
s = s.replace(old, new, 1)

old = "  renderGameBar();\n  setTimeout(()=>privateInfo?.isSpy?openSpyLocationVoteModal():openSpyVoteModal(),0);\n}\nfunction onSpyVoting(p){"
new = "  renderGameBar();\n  setTimeout(ensureSpyFinalChoiceUI,0);\n}\nfunction ensureSpyFinalChoiceUI(){\n  if(state.mode!=='spyfall'||!state.started||state.final||state.phase!=='spy-voting'||!state.spyfall?.voting)return;\n  if(now()>=Number(state.spyfall.deadline||0))return;\n  const modal=$('characterSelectModal');\n  if(privateInfo?.isSpy){\n    state.spyfall.locationWindow=true;\n    if(!modal||modal.classList.contains('hidden')||modal.dataset.spyFinalChoice!=='location')openSpyLocationVoteModal();\n  }else{\n    if(!modal||modal.classList.contains('hidden')||modal.dataset.spyFinalChoice!=='vote')openSpyVoteModal();\n  }\n}\nfunction onSpyVoting(p){"
assert old in s
s = s.replace(old, new, 1)

old = "function spyLocationWindowOpen(){\n  return state.mode==='spyfall'&&state.started&&!state.final&&privateInfo?.isSpy&&state.spyfall?.locationWindow&&now()<Number(state.spyfall.deadline||0)&&!state.spyfall.spyGuessSubmitted;\n}"
new = "function spyLocationWindowOpen(){\n  return state.mode==='spyfall'&&state.started&&!state.final&&privateInfo?.isSpy&&state.phase==='spy-voting'&&state.spyfall?.voting&&now()<Number(state.spyfall.deadline||0)&&!state.spyfall.spyGuessSubmitted;\n}"
assert old in s
s = s.replace(old, new, 1)

old = "function onSpyFinal(p){\n  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); closeSpyFinalChoiceModal();"
new = "function onSpyFinal(p){\n  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); clearInterval(spyPhaseSyncTicker); closeSpyFinalChoiceModal();"
assert old in s
s = s.replace(old, new, 1)

# Ensure returning to lobby cannot leave the sync heartbeat running.
old = "clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); clearTimeout(incognitoFinalizeTimer);"
new = "clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); clearInterval(spyPhaseSyncTicker); clearTimeout(incognitoFinalizeTimer);"
assert old in s
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

idx = Path('eltopo/index.html')
i = idx.read_text(encoding='utf-8')
i = i.replace('v0.10.8', 'v0.10.9')
idx.write_text(i, encoding='utf-8')

mix = Path('eltopo/mixed-avatar-sync.js')
if mix.exists():
    m = mix.read_text(encoding='utf-8').replace("const BUILD_VERSION = '0.10.8';", "const BUILD_VERSION = '0.10.9';")
    mix.write_text(m, encoding='utf-8')
