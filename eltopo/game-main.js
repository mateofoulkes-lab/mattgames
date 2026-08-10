import { joinRoom, selfId } from 'https://esm.sh/trystero@0.25.3';
import { APP_ID, MAX_PLAYERS, MIN_PLAYERS, THEMES, CONSEQUENCES, ROLES, TOPO_ROLE, AVATARS } from './game-data.js';

const VERSION='0.3.1';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
const makeCode=()=>Array.from({length:4},()=>pick('ABCDEFGHJKLMNPQRSTUVWXYZ')).join('');
const chatAllowed=()=>!['leak','gameover'].includes(game.phase);

let room=null, A={}, isHost=false, hostId=null, roomCode='', myName='', myRole=null, myAvatar=null;
let joinTimer=null, heartbeat=null, joinedConfirmed=false, usedVote=false, votes={};
const peers=new Map();
let game=freshGame();

function freshGame(){return{phase:'lobby',theme:'escape',round:0,totalRounds:5,reputation:5,scenario:'',antagonist:THEMES.escape.antagonist,players:{},messages:[],lastLeak:null,result:null}}
function me(){return game.players[selfId]}
function toast(text){const e=$('toast');if(!e)return;e.textContent=text;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),2200)}
function sys(text){game.messages.push({id:crypto.randomUUID(),system:true,text,ts:Date.now(),round:game.round})}
function pub(){return JSON.parse(JSON.stringify(game))}
function currentRole(){return myRole?.key==='topo'?TOPO_ROLE:ROLES.find(r=>r.key===myRole?.key)}
function peerCount(){return peers.size}
function updateVersion(){const v=$('versionBadge');if(v)v.textContent=`v${VERSION} · ${peerCount()} peer${peerCount()===1?'':'s'}`}
function sendPresence(target){if(!A.pres)return;A.pres.send({name:myName,host:isHost,version:VERSION,ts:Date.now()},target?{target}:undefined).catch(()=>{})}
function sendState(target){if(!isHost||!A.st)return;A.st.send(pub(),target?{target}:undefined).catch(()=>{})}
function syncAll(){sendState();renderAll()}

function setupRoom(code,host){
  roomCode=code;isHost=host;joinedConfirmed=host;hostId=host?selfId:null;
  try{room?.leave()}catch{}
  clearInterval(heartbeat);peers.clear();updateVersion();
  room=joinRoom({appId:APP_ID},roomCode,{onJoinError:({error})=>{console.warn('Trystero join error',error);$('landingError').textContent='Error P2P. Reintentá.'}});
  A={pres:room.makeAction('pres'),st:room.makeAction('st'),chat:room.makeAction('chat'),av:room.makeAction('av'),role:room.makeAction('role'),leak:room.makeAction('leak'),vote:room.makeAction('vote'),rej:room.makeAction('rej')};

  room.onPeerJoin=peerId=>{
    peers.set(peerId,Date.now());updateVersion();sendPresence(peerId);
    if(isHost&&game.players[peerId])sendState(peerId);
  };
  room.onPeerLeave=peerId=>{
    peers.delete(peerId);updateVersion();
    if(isHost&&game.players[peerId]){game.players[peerId].disconnected=true;sys(`${game.players[peerId].name} se desconectó.`);syncAll()}
  };
  A.pres.onMessage=(data,{peerId})=>{
    peers.set(peerId,Date.now());updateVersion();
    if(isHost){
      if(game.phase!=='lobby'&&!game.players[peerId]){A.rej.send({reason:'La partida ya comenzó.'},{target:peerId}).catch(()=>{});return}
      if(Object.keys(game.players).length>=MAX_PLAYERS&&!game.players[peerId]){A.rej.send({reason:'La sala está llena.'},{target:peerId}).catch(()=>{});return}
      if(!game.players[peerId]){const name=String(data?.name||'Jugador').slice(0,20);game.players[peerId]={name,avatar:null,alive:true,joinIndex:Object.keys(game.players).length,disconnected:false};sys(`${name} se unió al grupo.`)}else game.players[peerId].disconnected=false;
      sendPresence(peerId);sendState(peerId);renderAll();
    }else if(data?.host){
      hostId=peerId;
      if(!joinedConfirmed){joinedConfirmed=true;clearTimeout(joinTimer);enterMessenger();toast(`Conectado · host v${data.version||'?'}`)}
      sendPresence(peerId);
    }
  };
  A.st.onMessage=(data,{peerId})=>{if(isHost)return;if(hostId&&peerId!==hostId)return;if(!hostId)hostId=peerId;game=data;renderAll()};
  A.rej.onMessage=data=>{if(isHost)return;clearTimeout(joinTimer);try{room?.leave()}catch{};room=null;showLanding(data?.reason||'No se pudo entrar a la sala.')};
  A.chat.onMessage=(data,{peerId})=>{
    if(!isHost)return;
    const p=game.players[peerId];
    if(!p||p.alive===false||!chatAllowed())return;
    const text=String(data?.text||'').trim().slice(0,500);if(!text)return;
    game.messages.push({id:crypto.randomUUID(),authorId:peerId,author:p.name,text,ts:Date.now(),round:game.round});
    syncAll();
  };
  A.av.onMessage=(data,{peerId})=>{if(!isHost||game.phase!=='avatar'||!game.players[peerId])return;if(!AVATARS.some(a=>a.id===data?.id))return;game.players[peerId].avatar=data.id;syncAll()};
  A.role.onMessage=(data,{peerId})=>{if(isHost)return;if(hostId&&peerId!==hostId)return;myRole=data;showRole()};
  A.leak.onMessage=(data,{peerId})=>{if(!isHost||game.phase!=='leak'||peerId!==game.topoId)return;resolveLeak(data?.messageId)};
  A.vote.onMessage=(data,{peerId})=>{if(!isHost||game.phase!=='voting'||votes[peerId])return;if(!game.players[data?.targetId]||game.players[data.targetId].alive===false)return;votes[peerId]=data.targetId;if(Object.keys(votes).length>=Object.values(game.players).filter(p=>p.alive!==false).length)finishVote();else renderAll()};

  heartbeat=setInterval(()=>{sendPresence();const now=Date.now();for(const [id,t] of peers)if(now-t>7000)peers.delete(id);updateVersion();if(isHost)sendState()},1500);
  sendPresence();
}

function createRoom(){myName=$('playerName').value.trim();if(!myName){$('landingError').textContent='Poné tu nombre.';return}$('landingError').textContent='';game=freshGame();roomCode=makeCode();game.players[selfId]={name:myName,avatar:null,alive:true,joinIndex:0,disconnected:false};setupRoom(roomCode,true);enterMessenger();renderAll()}
function joinExistingRoom(){myName=$('playerName').value.trim();const code=$('roomCodeInput').value.trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);if(!myName){$('landingError').textContent='Poné tu nombre.';return}if(code.length!==4){$('landingError').textContent='El código tiene 4 letras.';return}$('landingError').textContent='Buscando sala…';game=freshGame();joinedConfirmed=false;hostId=null;setupRoom(code,false);clearTimeout(joinTimer);joinTimer=setTimeout(()=>{if(joinedConfirmed)return;try{room?.leave()}catch{};room=null;$('landingError').textContent='No apareció ningún host con ese código.'},12000)}
function enterMessenger(){$('landing').classList.remove('active');$('messenger').classList.add('active');$('roomCodeDisplay').textContent=roomCode;$('meAvatar').textContent=(myName[0]||'?').toUpperCase();$('hostSettings').classList.toggle('hidden',!isHost);renderAll()}
function showLanding(error=''){$('messenger').classList.remove('active');$('landing').classList.add('active');$('landingError').textContent=error}

function avatarData(id){return AVATARS.find(a=>a.id===id)}
function avatarMarkup(p){const a=avatarData(p?.avatar);if(!a)return `<span>${esc((p?.name||'?')[0]?.toUpperCase())}</span>`;return `<img class="avatar-img" src="${a.file}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="avatar-fallback" style="display:none">${a.emoji}</span>`}
function renderAll(){
  const theme=THEMES[game.theme]||THEMES.escape;
  document.querySelectorAll('#groupName,#sidebarGroupName,#infoGroupName').forEach(e=>e.textContent=theme.name);
  $('groupSubtitle').textContent=`${Object.keys(game.players).length} participante${Object.keys(game.players).length===1?'':'s'} · ${peerCount()} peer${peerCount()===1?'':'s'} · código ${roomCode}`;
  $('sidebarPreview').textContent=game.phase==='lobby'?'Esperando jugadores':`Ronda ${game.round}/${game.totalRounds}`;
  const input=$('messageInput'),send=$('sendBtn');
  if(input){input.disabled=!chatAllowed();input.placeholder=chatAllowed()?'Escribe un mensaje':'Chat bloqueado durante la filtración';}
  if(send)send.disabled=!chatAllowed();
  renderPlayers();renderMessages();renderBanner();renderActions();updateVersion();
  $('infoCount').textContent=`${Object.keys(game.players).length} participantes`;$('participantTitle').textContent=`${Object.keys(game.players).length} participantes`;
}
function renderPlayers(){const box=$('participants');box.innerHTML='';Object.entries(game.players).sort((a,b)=>(a[1].joinIndex||0)-(b[1].joinIndex||0)).forEach(([id,p])=>{const d=document.createElement('div');d.className='participant'+(p.alive===false?' eliminated':'');d.innerHTML=`<div class="participant-avatar">${avatarMarkup(p)}</div><div class="participant-copy"><strong>${esc(p.name)}${id===selfId?' (vos)':''}</strong><span>${p.disconnected?'desconectado':p.alive===false?'expulsado':p.avatar?'listo':'sin avatar'}</span></div>${id===hostId?'<span class="host-badge">ADMIN</span>':''}`;box.appendChild(d)})}
function renderMessages(){const box=$('messages');box.innerHTML='<div class="day-chip">HOY</div>';for(const m of game.messages){if(m.system){box.insertAdjacentHTML('beforeend',`<div class="system-chip">${esc(m.text)}</div>`);continue}const mine=m.authorId===selfId,p=game.players[m.authorId]||{name:m.author||'Anónimo'};box.insertAdjacentHTML('beforeend',`<div class="message-row ${mine?'mine':''}"><article class="bubble"><div class="sender-name">${mine?'Vos':esc(p.name)}</div><span>${esc(m.text)}</span><span class="bubble-meta">${new Date(m.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}${mine?' <span class="ticks">✓✓</span>':''}</span></article></div>`)}box.scrollTop=box.scrollHeight}
function renderBanner(){const labels={lobby:'Esperando jugadores',avatar:'Elegí tu avatar público',discussion:`Ronda ${game.round}/${game.totalRounds}`,leak:'El Topo está eligiendo una captura',investigation:'Investigación',voting:'Encuesta de expulsión',between:'Fin de ronda',gameover:'Partida terminada'};$('gameBanner').textContent=`${labels[game.phase]||game.phase} · Reputación ${'●'.repeat(game.reputation)}${'○'.repeat(5-game.reputation)}`+(game.scenario?` · ${game.scenario}`:'');$('gameBanner').classList.remove('hidden')}
function button(text,fn,primary=false){const b=document.createElement('button');b.className='action-btn'+(primary?' primary-action':'');b.textContent=text;b.onclick=fn;return b}
function renderActions(){
  const t=$('actionTray');t.innerHTML='';t.classList.remove('hidden');
  if(!me()){t.innerHTML='<h4>Sincronizando sala…</h4>';return}
  if(me().alive===false){t.innerHTML='<h4>Fuiste expulsado. Seguís mirando la partida.</h4>';return}
  if(game.phase==='lobby'){
    const n=Object.keys(game.players).length;
    t.innerHTML=`<h4>${isHost?(n<MIN_PLAYERS?`Esperando al menos ${MIN_PLAYERS} jugadores. Compartí ${roomCode}.`:`Todo listo. Podés iniciar la partida.`):'Esperando que el administrador inicie.'}</h4>`;
    if(isHost){const b=button(`Iniciar partida (${n}/${MAX_PLAYERS})`,startGame,true);b.disabled=n<MIN_PLAYERS;t.appendChild(b)}return;
  }
  if(game.phase==='avatar'){renderAvatars(t);if(isHost){const ready=Object.values(game.players).every(p=>p.avatar);const b=button(ready?'Comenzar ronda':'Esperando avatares…',beginRound,true);b.disabled=!ready;t.appendChild(b)}return}
  if(game.phase==='discussion'){t.innerHTML='<h4>Debatan libremente. Cualquier mensaje puede terminar en una captura.</h4>';if(isHost)t.appendChild(button('Cerrar conversación',()=>{game.phase='leak';sys('🔒 Conversación cerrada. El Topo está eligiendo qué filtrar.');syncAll()},true));return}
  if(game.phase==='leak'){if(myRole?.key==='topo'){t.innerHTML='<h4>🐀 Elegí qué mensaje filtrar.</h4>';game.messages.filter(m=>!m.system&&m.round===game.round).slice(-30).forEach(m=>{const d=document.createElement('div');d.className='leak-choice';d.innerHTML=`<div><b>${esc(game.players[m.authorId]?.name||m.author)}</b>: ${esc(m.text)}</div><button>📸 Filtrar esta captura</button>`;d.querySelector('button').onclick=()=>isHost?resolveLeak(m.id):A.leak.send({messageId:m.id},{target:hostId});t.appendChild(d)})}else t.innerHTML='<h4>Algo está pasando fuera del grupo…</h4>';return}
  if(game.phase==='investigation'){t.innerHTML='<h4>Discutan lo ocurrido y busquen al Topo.</h4>';if(isHost)t.appendChild(button('Crear encuesta de expulsión',openVote,true));return}
  if(game.phase==='voting'){renderVote(t);return}
  if(game.phase==='between'){t.innerHTML='<h4>El Topo sigue dentro del grupo.</h4>';if(isHost)t.appendChild(button('Siguiente ronda',beginRound,true));return}
  if(game.phase==='gameover')t.innerHTML=`<h4>${esc(game.result||'Fin de la partida')}</h4>`;
}
function renderAvatars(t){const title=document.createElement('h4');title.textContent='Tu rol es secreto. Elegí una foto pública:';t.appendChild(title);const grid=document.createElement('div');grid.className='avatar-picker';AVATARS.forEach(a=>{const b=document.createElement('button');b.className='avatar-choice'+(myAvatar===a.id?' selected':'');b.innerHTML=`<div class="avatar-choice-img"><img src="${a.file}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span style="display:none">${a.emoji}</span></div><small>${esc(a.name)}</small>`;b.onclick=()=>chooseAvatar(a.id);grid.appendChild(b)});t.appendChild(grid)}
function chooseAvatar(id){myAvatar=id;if(isHost){game.players[selfId].avatar=id;syncAll()}else A.av.send({id},{target:hostId});renderAll()}
function startGame(){
  if(!isHost)return;
  const n=Object.keys(game.players).length;
  if(n<MIN_PLAYERS){toast(`Faltan jugadores: mínimo ${MIN_PLAYERS}.`);return}
  game.theme=$('themeSelect').value;game.totalRounds=Number($('roundsSelect').value)||5;game.antagonist=THEMES[game.theme].antagonist;
  const ids=shuffle(Object.keys(game.players)),topo=ids[0];game.topoId=topo;
  ids.forEach((id,i)=>{const role=i===0?{...TOPO_ROLE}:{...ROLES[(i-1)%ROLES.length]};if(id===selfId){myRole=role;showRole()}else A.role.send(role,{target:id}).catch(()=>{})});
  sys('🔐 Los roles fueron repartidos en secreto.');game.phase='avatar';syncAll();
}
function showRole(){if(!myRole)return;const d=currentRole()||myRole;$('roleEmoji').textContent=d.emoji;$('roleName').textContent=d.name;$('roleDescription').textContent=d.desc;$('roleAlignment').textContent=myRole.key==='topo'?'TOPO':'LEAL';$('roleAlignment').classList.toggle('topo',myRole.key==='topo');$('roleModal').classList.remove('hidden')}
function beginRound(){if(!isHost)return;game.round++;if(game.round>game.totalRounds){endGame('🐀 El Topo sobrevivió hasta el final.');return}game.scenario=pick(THEMES[game.theme].situations);game.phase='discussion';usedVote=false;votes={};sys(`📌 SITUACIÓN ${game.round}: ${game.scenario}`);syncAll()}
function resolveLeak(messageId){if(!isHost)return;const m=game.messages.find(x=>x.id===messageId);if(!m)return;game.lastLeak={messageId,consequence:pick(CONSEQUENCES)};game.reputation=Math.max(0,game.reputation-1);sys(`📸 Se filtró una captura: “${m.text.slice(0,120)}${m.text.length>120?'…':''}”`);sys(`⚠️ La recibió: ${game.antagonist}. ${game.lastLeak.consequence}`);if(game.reputation<=0){endGame('🐀 El Topo destruyó la reputación del grupo.');return}game.phase='investigation';syncAll()}
function openVote(){if(!isHost)return;votes={};game.phase='voting';sys('📊 Se abrió la encuesta para expulsar a un sospechoso.');syncAll()}
function renderVote(t){const card=document.createElement('div');card.className='poll-card';card.innerHTML='<h3>¿Quién es El Topo?</h3><p>Elegí a una persona para expulsar.</p>';Object.entries(game.players).filter(([,p])=>p.alive!==false).forEach(([id,p])=>{const row=document.createElement('div');row.className='poll-option';row.innerHTML=`<span class="poll-radio"></span><span class="poll-name">${esc(p.name)}</span>`;row.onclick=()=>castVote(id);card.appendChild(row)});t.appendChild(card)}
function castVote(targetId){if(usedVote)return;usedVote=true;if(isHost){votes[selfId]=targetId;if(Object.keys(votes).length>=Object.values(game.players).filter(p=>p.alive!==false).length)finishVote();else renderAll()}else A.vote.send({targetId},{target:hostId});toast('Voto enviado')}
function finishVote(){if(!isHost)return;const counts={};Object.values(votes).forEach(id=>counts[id]=(counts[id]||0)+1);const max=Math.max(...Object.values(counts),0),winners=Object.keys(counts).filter(id=>counts[id]===max);if(winners.length!==1){sys('🤝 Hubo empate. Nadie fue expulsado.');game.reputation=Math.max(0,game.reputation-1)}else{const id=winners[0],p=game.players[id];p.alive=false;sys(`🚪 ${p.name} fue expulsado del grupo.`);if(id===game.topoId){endGame('✅ ¡Encontraron al Topo! Gana el grupo.');return}game.reputation=Math.max(0,game.reputation-1);sys('❌ Era inocente. El grupo pierde reputación.')}if(game.reputation<=0){endGame('🐀 El Topo ganó: la reputación llegó a cero.');return}game.phase='between';syncAll()}
function endGame(text){game.phase='gameover';game.result=text;sys(text);syncAll()}
function sendChat(){
  const input=$('messageInput'),text=input.value.trim();
  if(!text||!chatAllowed())return;
  input.value='';
  if(isHost){game.messages.push({id:crypto.randomUUID(),authorId:selfId,author:myName,text:text.slice(0,500),ts:Date.now(),round:game.round});syncAll()}
  else A.chat.send({text:text.slice(0,500)},{target:hostId}).catch(()=>toast('No se pudo enviar'));
}

$('createRoomBtn')?.addEventListener('click',createRoom);
$('joinRoomBtn')?.addEventListener('click',joinExistingRoom);
$('roomCodeInput')?.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4)});
$('startGameBtn')?.addEventListener('click',startGame);
$('sendBtn')?.addEventListener('click',sendChat);
$('messageInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat()});
$('groupInfoBtn')?.addEventListener('click',()=>$('infoPanel').classList.add('open'));
$('closeInfoBtn')?.addEventListener('click',()=>$('infoPanel').classList.remove('open'));
$('closeRoleBtn')?.addEventListener('click',()=>$('roleModal').classList.add('hidden'));
$('copyCodeBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomCode);toast('Código copiado')}catch{toast(roomCode)}});
$('themeSelect')?.addEventListener('change',e=>{if(isHost&&game.phase==='lobby'){game.theme=e.target.value;game.antagonist=THEMES[game.theme].antagonist;syncAll()}});
$('roundsSelect')?.addEventListener('change',e=>{if(isHost&&game.phase==='lobby'){game.totalRounds=Number(e.target.value)||5;syncAll()}});
$('leaveRoomBtn')?.addEventListener('click',()=>{clearInterval(heartbeat);try{room?.leave()}catch{};location.reload()});
updateVersion();