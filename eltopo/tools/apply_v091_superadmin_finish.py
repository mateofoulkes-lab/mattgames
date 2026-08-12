from pathlib import Path
p=Path('eltopo/social-game.js')
s=p.read_text()
s=s.replace("./game-data.js?v=0.9.0","./game-data.js?v=0.9.1")
s=s.replace("const VERSION = '0.9.0';","const VERSION = '0.9.1';")
s=s.replace("roomLocked:false, chatDisabled:false, pinnedMessageId:null, adminForcedSpyId:null,", "roomLocked:false, chatDisabled:false, pinnedMessageId:null, adminForcedSpyId:null, adminForcedTrigger:null,")
s=s.replace("state.trigger=personalizeMixedTrigger(pick(TRIGGERS),identities);", "state.trigger=state.adminForcedTrigger||personalizeMixedTrigger(pick(TRIGGERS),identities); state.adminForcedTrigger=null;")
s=s.replace("state.phase='playing'; state.trigger=pick(TRIGGERS);", "state.phase='playing'; state.trigger=state.adminForcedTrigger||pick(TRIGGERS); state.adminForcedTrigger=null;")
needle="    case 'force-trigger': state.trigger=String(p.value||'').slice(0,500);if(state.trigger)addSystem(`💬 Nuevo disparador: ${state.trigger}`);broadcastFullState();break;\n"
insert=needle+"    case 'force-next-trigger': state.adminForcedTrigger=String(p.value||'').slice(0,500)||null;addLobbySystem(state.adminForcedTrigger?'🧪 Próximo disparador fijado por superadmin.':'🧪 Próximo disparador vuelve a ser aleatorio.');broadcastFullState();break;\n    case 'force-winner': {\n      if(state.mode==='mixed'&&p.targetId&&state.members[p.targetId]){const scores={};players().forEach(m=>scores[m.id]=m.id===p.targetId?99:0);const reveal=Object.fromEntries(players().map(m=>[m.id,{shown:displayName(m),real:m.realName}]));const payload={scores,reveal,guesses:state.guesses};send('mixed-final',payload).catch(()=>{});onMixedFinal(payload);}\n      else if(state.mode==='spyfall'){const spyWins=p.value==='spy';const result=spyWins?'Resultado forzado por superadmin: gana el espía.':'Resultado forzado por superadmin: gana el grupo.';const payload={result,spyId:state._spyId,spyName:state.members[state._spyId]?.realName||'?',location:state._spyLocation||'?',votes:state.spyfall.votes};send('spy-final',payload).catch(()=>{});onSpyFinal(payload);}\n      break;\n    }\n"
if needle not in s: raise SystemExit('force-trigger block not found')
s=s.replace(needle,insert)
p.write_text(s)

p=Path('eltopo/index.html');p.write_text(p.read_text().replace('0.9.0','0.9.1'))
p=Path('eltopo/mixed-avatar-sync.js');
if p.exists():p.write_text(p.read_text().replace("const BUILD_VERSION = '0.9.0';","const BUILD_VERSION = '0.9.1';"))
