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
p=Path('eltopo/mixed-avatar-sync.js')
if p.exists():p.write_text(p.read_text().replace("const BUILD_VERSION = '0.9.0';","const BUILD_VERSION = '0.9.1';"))

# Superadmin UI final pass
p=Path('eltopo/superadmin/index.html');p.write_text(p.read_text().replace('0.9.0','0.9.1'))
p=Path('eltopo/superadmin/admin.js');a=p.read_text().replace("../game-data.js?v=0.9.0","../game-data.js?v=0.9.1").replace("const CURRENT_CLIENT='0.9.0';","const CURRENT_CLIENT='0.9.1';")
a=a.replace("function render(){renderSummary();renderRooms();if(selectedRoom)renderInspector();renderUnknown();}","function render(){renderSummary();renderRooms();const editing=document.activeElement?.matches?.('input,textarea,select');if(selectedRoom&&!editing)renderInspector();renderUnknown();}")
old="['Trigger',st?.trigger||'—'],['Creada',age(st?.createdAt)]].map"
new="['Trigger',st?.trigger||'—'],['Creada',age(st?.createdAt)],['Histórico',`${Object.keys(stats.rooms).length} salas · ${Object.keys(stats.clients).length} clientes`],['Inicios',Object.entries(stats.modeStarts).map(([k,v])=>`${k}:${v}`).join(' · ')||'—']].map"
if old not in a: raise SystemExit('overview stats marker not found')
a=a.replace(old,new)
a=a.replace("<button class=\"danger\" data-roomcmd=\"finish\">■ Finalizar</button>","<button class=\"danger\" data-roomcmd=\"finish\">■ Finalizar</button><button id=\"closeRoomBtn\" class=\"danger\">💥 Cerrar sala</button>")
a=a.replace("$('modeSelect').value=st?.mode||'mixed';bindRoomCmds();$('setModeBtn').onclick=()=>roomCommand('set-mode',$('modeSelect').value);", "$('modeSelect').value=st?.mode||'mixed';bindRoomCmds();$('closeRoomBtn').onclick=closeSelectedRoom;$('setModeBtn').onclick=()=>roomCommand('set-mode',$('modeSelect').value);")
marker="async function roomCommand(command,value=null,extra={}){const host=roomHost(selectedRoom);if(!host){toast('No encuentro host');return;}try{await sendCommand(host,{command,value,roomCommand:true,...extra});log(selectedRoom,'ADMIN',`Sala: ${command}`);toast('Orden enviada');}catch(e){toast(`Error: ${e.message}`);}}\n"
addition=marker+"async function closeSelectedRoom(){const list=roomClients(selectedRoom);if(!list.length)return;if(!confirm(`¿Cerrar completamente la sala ${selectedRoom} y echar a ${list.length} jugadores?`))return;for(const c of [...list].sort((a,b)=>(a.isAdmin?1:0)-(b.isAdmin?1:0))){try{await sendCommand(c,{command:'kick',targetId:c.logicalId});}catch{}}log(selectedRoom,'ADMIN','Sala cerrada por superadmin','bad');toast('Sala cerrada');}\n"
if marker not in a: raise SystemExit('roomCommand marker not found')
a=a.replace(marker,addition)
oldqa="<div class=\"qa-row\"><button id=\"qaTriggerBtn\" class=\"ghost\">Cambiar disparador</button><button id=\"qaSystemBtn\" class=\"ghost\">Anunciarlo</button></div>"
newqa="<div class=\"qa-row\"><button id=\"qaTriggerBtn\" class=\"ghost\">Cambiar ahora</button><button id=\"qaNextTrigger\" class=\"ghost\">Usar próxima ronda</button><button id=\"qaSystemBtn\" class=\"ghost\">Anunciarlo</button></div>"
a=a.replace(oldqa,newqa)
oldsecret="${secretStateHtml(st,list)}<div class=\"qa-row\"><button id=\"qaFinish\" class=\"danger\">Forzar fin</button><button id=\"qaRestart\" class=\"ghost\">Reiniciar ronda</button></div></section>"
newsecret="${secretStateHtml(st,list)}<label>Forzar ganador (Todo mezclado)</label><select id=\"qaWinner\">${opts}</select><button id=\"qaWinnerBtn\" class=\"ghost\">Declarar ganador</button><div class=\"qa-row\"><button id=\"qaSpyWins\" class=\"ghost\">Spyfall: gana espía</button><button id=\"qaGroupWins\" class=\"ghost\">Spyfall: gana grupo</button></div><div class=\"qa-row\"><button id=\"qaFinish\" class=\"danger\">Forzar fin</button><button id=\"qaRestart\" class=\"ghost\">Reiniciar ronda</button></div></section>"
if oldsecret not in a: raise SystemExit('QA secret marker not found')
a=a.replace(oldsecret,newsecret)
a=a.replace("$('qaTriggerBtn').onclick=()=>roomCommand('force-trigger',$('qaTrigger').value.trim());$('qaSystemBtn')", "$('qaTriggerBtn').onclick=()=>roomCommand('force-trigger',$('qaTrigger').value.trim());$('qaNextTrigger').onclick=()=>roomCommand('force-next-trigger',$('qaTrigger').value.trim());$('qaSystemBtn')")
a=a.replace("$('qaFinish').onclick=()=>roomCommand('finish');$('qaRestart').onclick=()=>roomCommand('restart');", "$('qaWinnerBtn').onclick=()=>roomCommand('force-winner',null,{targetId:$('qaWinner').value});$('qaSpyWins').onclick=()=>roomCommand('force-winner','spy');$('qaGroupWins').onclick=()=>roomCommand('force-winner','group');$('qaFinish').onclick=()=>roomCommand('finish');$('qaRestart').onclick=()=>roomCommand('restart');")
p.write_text(a)
