import { joinRoom, selfId } from 'https://esm.sh/trystero@0.25.3';
import { APP_ID, MAX_PLAYERS, MIN_PLAYERS, THEMES, CONSEQUENCES, ROLES, TOPO_ROLE, AVATARS } from './game-data.js';

const VERSION = '0.2.0';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => [...a].sort(() => Math.random() - .5);
const makeCode = () => Array.from({length: 4}, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ')).join('');

let room = null;
let actions = {};
let isHost = false;
let hostId = null;
let roomCode = '';
let myName = '';
let myRole = null;
let myAvatar = null;
let joinedConfirmed = false;
let joinTimer = null;
let usedAbility = false;
let votes = {};

let game = freshGame();
function freshGame(){
  return {phase:'lobby',theme:'escape',round:0,totalRounds:5,reputation:5,scenario:'',antagonist:THEMES.escape.antagonist,players:{},messages:[],lastLeak:null,result:null};
}

function addVersionBadge(){
  const b=document.createElement('div');
  b.className='version-badge';
  b.textContent=`v${VERSION}`;
  document.body.appendChild(b);
}
addVersionBadge();

function toast(text){
  const el=$('toast'); if(!el) return;
  el.textContent=text; el.classList.remove('hidden');
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.add('hidden'),2200);
}
function systemMessage(text){
  game.messages.push({id:crypto.randomUUID(),system:true,text,ts:Date.now(),round:game.round});
}
function publicState(){ return JSON.parse(JSON.stringify(game)); }
function me(){ return game.players[selfId]; }
function currentRole(){ return myRole?.key==='topo' ? TOPO_ROLE : ROLES.find(r=>r.key===myRole?.key); }
function sendState(target){
  if(!isHost) return;
  const opts=target?{target}:undefined;
  actions.state.send(publicState(),opts);
}
function syncAll(){ sendState(); renderAll(); }

function setupRoom(code, host){
  roomCode=code;
  isHost=host;
  if(room) try{room.leave()}catch{}
  room=joinRoom({appId:APP_ID}, code);
  actions={
    hello:room.makeAction('hello'),
    welcome:room.makeAction('welcome'),
    state:room.makeAction('state'),
    chat:room.makeAction('chat'),
    avatar:room.makeAction('avatar'),
    role:room.makeAction('role'),
    leak:room.makeAction('leak'),
    vote:room.makeAction('vote'),
    ability:room.makeAction('ability'),
    reject:room.makeAction('reject')
  };

  actions.hello.onMessage=(data,{peerId})=>{
    if(!isHost) return;
    if(game.phase!=='lobby'){
      actions.reject.send({reason:'La partida ya comenzó.'},{target:peerId}); return;
    }
    if(Object.keys(game.players).length>=MAX_PLAYERS){
      actions.reject.send({reason:'La sala está llena.'},{target:peerId}); return;
    }
    if(!game.players[peerId]){
      game.players[peerId]={name:String(data?.name||'Jugador').slice(0,20),avatar:null,alive:true,joinIndex:Object.keys(game.players).length};
      systemMessage(`${game.players[peerId].name} se unió al grupo.`);
    }
    actions.welcome.send({hostId:selfId,state:publicState(),version:VERSION},{target:peerId});
    sendState(); renderAll();
  };

  actions.welcome.onMessage=(data,{peerId})=>{
    if(isHost || joinedConfirmed) return;
    hostId=data.hostId||peerId;
    game=data.state||game;
    joinedConfirmed=true;
    clearTimeout(joinTimer);
    enterMessenger();
    renderAll();
    toast(`Conectado · host v${data.version||'?'}`);
  };

  actions.reject.onMessage=(data)=>{
    if(isHost) return;
    clearTimeout(joinTimer);
    joinedConfirmed=false;
    try{room.leave()}catch{}
    room=null;
    showLanding(data?.reason||'No se pudo entrar a la sala.');
  };

  actions.state.onMessage=(data,{peerId})=>{
    if(isHost || (hostId && peerId!==hostId)) return;
    game=data; renderAll();
  };

  actions.chat.onMessage=(data,{peerId})=>{
    if(!isHost) return;
    const p=game.players[peerId];
    if(!p || p.alive===false || game.phase!=='discussion') return;
    const text=String(data?.text||'').trim().slice(0,500); if(!text) return;
    game.messages.push({id:crypto.randomUUID(),authorId:peerId,author:p.name,text,ts:Date.now(),round:game.round});
    syncAll();
  };

  actions.avatar.onMessage=(data,{peerId})=>{
    if(!isHost || game.phase!=='avatar' || !game.players[peerId]) return;
    if(!AVATARS.some(a=>a.id===data?.id)) return;
    game.players[peerId].avatar=data.id; sendState(); renderAll();
  };

  actions.leak.onMessage=(data,{peerId})=>{
    if(!isHost || game.phase!=='leak' || myRole?.key==='topo') return;
    if(peerId!==game.topoId) return;
    resolveLeak(data?.messageId);
  };

  actions.vote.onMessage=(data,{peerId})=>{
    if(!isHost || game.phase!=='voting' || votes[peerId]) return;
    if(!game.players[data?.targetId] || game.players[data.targetId].alive===false) return;
    votes[peerId]=data.targetId;
    if(Object.keys(votes).length>=Object.values(game.players).filter(p=>p.alive!==false).length) finishVote();
    else renderAll();
  };

  actions.role.onMessage=(data,{peerId})=>{
    if(isHost || (hostId && peerId!==hostId)) return;
    myRole=data; showRole();
  };

  room.onPeerJoin=peerId=>{
    if(!isHost) actions.hello.send({name:myName,version:VERSION},{target:peerId});
    else if(game.players[peerId]) actions.welcome.send({hostId:selfId,state:publicState(),version:VERSION},{target:peerId});
  };

  room.onPeerLeave=peerId=>{
    if(isHost && game.players[peerId]){
      game.players[peerId].disconnected=true;
      systemMessage(`${game.players[peerId].name} se desconectó.`);
      syncAll();
    }
  };
}

function createRoom(){
  myName=$('playerName').value.trim();
  if(!myName){$('landingError').textContent='Poné tu nombre.';return;}
  $('landingError').textContent='';
  game=freshGame(); roomCode=makeCode(); hostId=selfId; joinedConfirmed=true;
  game.players[selfId]={name:myName,avatar:null,alive:true,joinIndex:0};
  setupRoom(roomCode,true);
  enterMessenger(); renderAll();
}

function joinExistingRoom(){
  myName=$('playerName').value.trim();
  const code=$('roomCodeInput').value.trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
  if(!myName){$('landingError').textContent='Poné tu nombre.';return;}
  if(code.length!==4){$('landingError').textContent='El código tiene 4 letras.';return;}
  $('landingError').textContent='Buscando sala…';
  joinedConfirmed=false; hostId=null; game=freshGame();
  setupRoom(code,false);
  clearTimeout(joinTimer);
  joinTimer=setTimeout(()=>{
    if(joinedConfirmed) return;
    try{room?.leave()}catch{}
    room=null;
    $('landingError').textContent='No encontré esa sala. Revisá el código o probá de nuevo.';
  },10000);
}

function enterMessenger(){
  $('landing').classList.remove('active'); $('messenger').classList.add('active');
  $('roomCodeDisplay').textContent=roomCode;
  $('meAvatar').textContent=(myName[0]||'?').toUpperCase();
  $('hostSettings').classList.toggle('hidden',!isHost);
  if(isHost){ $('themeSelect').value=game.theme; $('roundsSelect').value=String(game.totalRounds); }
}
function showLanding(error=''){
  $('messenger').classList.remove('active'); $('landing').classList.add('active');
  $('landingError').textContent=error;
}

function renderAll(){
  const theme=THEMES[game.theme]||THEMES.escape;
  document.querySelectorAll('#groupName,#sidebarGroupName,#infoGroupName').forEach(e=>e.textContent=theme.name);
  $('groupSubtitle').textContent=`${Object.keys(game.players).length} participante${Object.keys(game.players).length===1?'':'s'} · código ${roomCode}`;
  $('sidebarPreview').textContent=game.phase==='lobby'?'Esperando jugadores':`Ronda ${game.round}/${game.totalRounds}`;
  renderPlayers(); renderMessages(); renderBanner(); renderActions();
  $('infoCount').textContent=`${Object.keys(game.players).length} participantes`;
  $('participantTitle').textContent=`${Object.keys(game.players).length} participantes`;
}

function avatarData(id){return AVATARS.find(a=>a.id===id)}
function avatarMarkup(p){
  const a=avatarData(p?.avatar);
  if(!a) return `<span>${esc((p?.name||'?')[0]?.toUpperCase())}</span>`;
  return `<img class="avatar-img" src="${a.file}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="avatar-fallback" style="display:none">${a.emoji}</span>`;
}
function renderPlayers(){
  const box=$('participants'); box.innerHTML='';
  Object.entries(game.players).sort((a,b)=>(a[1].joinIndex||0)-(b[1].joinIndex||0)).forEach(([id,p])=>{
    const d=document.createElement('div'); d.className='participant'+(p.alive===false?' eliminated':'');
    d.innerHTML=`<div class="participant-avatar">${avatarMarkup(p)}</div><div class="participant-copy"><strong>${esc(p.name)}${id===selfId?' (vos)':''}</strong><span>${p.disconnected?'desconectado':p.alive===false?'expulsado':p.avatar?'listo':'sin avatar'}</span></div>${id===hostId?'<span class="host-badge">ADMIN</span>':''}`;
    box.appendChild(d);
  });
}
function renderMessages(){
  const box=$('messages'); box.innerHTML='<div class="day-chip">HOY</div>';
  for(const m of game.messages){
    if(m.system){box.insertAdjacentHTML('beforeend',`<div class="system-chip">${esc(m.text)}</div>`);continue;}
    const mine=m.authorId===selfId,p=game.players[m.authorId]||{name:m.author||'Anónimo'};
    box.insertAdjacentHTML('beforeend',`<div class="message-row ${mine?'mine':''}"><article class="bubble"><div class="sender-name">${mine?'Vos':esc(p.name)}</div><span>${esc(m.text)}</span><span class="bubble-meta">${new Date(m.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}${mine?' <span class="ticks">✓✓</span>':''}</span></article></div>`);
  }
  box.scrollTop=box.scrollHeight;
}
function renderBanner(){
  const labels={lobby:'Esperando jugadores',avatar:'Elegí tu avatar público',discussion:`Ronda ${game.round}/${game.totalRounds}`,leak:'El Topo está eligiendo una captura',investigation:'Investigación',voting:'Encuesta de expulsión',between:'Fin de ronda',gameover:'Partida terminada'};
  $('gameBanner').textContent=`${labels[game.phase]||game.phase} · Reputación ${'●'.repeat(game.reputation)}${'○'.repeat(5-game.reputation)}`+(game.scenario?` · ${game.scenario}`:'');
  $('gameBanner').classList.remove('hidden');
}
function button(text,fn,primary=false){const b=document.createElement('button');b.className='action-btn'+(primary?' primary-action':'');b.textContent=text;b.onclick=fn;return b;}
function renderActions(){
  const t=$('actionTray'); t.innerHTML=''; t.classList.remove('hidden');
  if(!me()){t.innerHTML='<h4>Sincronizando sala…</h4>';return;}
  if(me().alive===false){t.innerHTML='<h4>Fuiste expulsado. Seguís mirando la partida.</h4>';return;}
  if(game.phase==='lobby'){
    t.innerHTML=`<h4>${isHost?'Compartí el código '+roomCode+'.':'Esperando que el administrador inicie.'}</h4>`;
    if(isHost){const b=button(`Iniciar partida (${Object.keys(game.players).length}/${MAX_PLAYERS})`,startGame,true);b.disabled=Object.keys(game.players).length<MIN_PLAYERS;t.appendChild(b);} return;
  }
  if(game.phase==='avatar'){renderAvatars(t); if(isHost){const ready=Object.values(game.players).every(p=>p.avatar);const b=button(ready?'Comenzar ronda':'Esperando avatares…',beginRound,true);b.disabled=!ready;t.appendChild(b);}return;}
  if(game.phase==='discussion'){
    t.innerHTML='<h4>Debatan libremente. Cualquier mensaje puede terminar en una captura.</h4>';
    if(isHost)t.appendChild(button('Cerrar conversación',()=>{game.phase='leak';systemMessage('🔒 Conversación cerrada. El Topo está eligiendo qué filtrar.');syncAll();},true)); return;
  }
  if(game.phase==='leak'){
    if(myRole?.key==='topo'){
      t.innerHTML='<h4>🐀 Elegí qué mensaje filtrar.</h4>';
      game.messages.filter(m=>!m.system&&m.round===game.round).slice(-30).forEach(m=>{
        const d=document.createElement('div');d.className='leak-choice';d.innerHTML=`<div><b>${esc(game.players[m.authorId]?.name||m.author)}</b>: ${esc(m.text)}</div><button>📸 Filtrar esta captura</button>`;
        d.querySelector('button').onclick=()=>isHost?resolveLeak(m.id):actions.leak.send({messageId:m.id},{target:hostId});t.appendChild(d);
      });
    } else t.innerHTML='<h4>Algo está pasando fuera del grupo…</h4>'; return;
  }
  if(game.phase==='investigation'){t.innerHTML='<h4>Discutan lo ocurrido y busquen al Topo.</h4>';if(isHost)t.appendChild(button('Crear encuesta de expulsión',openVote,true));return;}
  if(game.phase==='voting'){renderVote(t);return;}
  if(game.phase==='between'){t.innerHTML='<h4>El Topo sigue dentro del grupo.</h4>';if(isHost)t.appendChild(button('Siguiente ronda',beginRound,true));return;}
  if(game.phase==='gameover')t.innerHTML=`<h4>${esc(game.result||'Fin de la partida')}</h4>`;
}

function renderAvatars(t){
  const title=document.createElement('h4'); title.textContent='Tu rol es secreto. Elegí una foto pública:';t.appendChild(title);
  const grid=document.createElement('div');grid.className='avatar-picker';
  AVATARS.forEach(a=>{
    const b=document.createElement('button');b.className='avatar-choice'+(myAvatar===a.id?' selected':'');
    b.innerHTML=`<div class="avatar-choice-img"><img src="${a.file}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span style="display:none">${a.emoji}</span></div><small>${esc(a.name)}</small>`;
    b.onclick=()=>chooseAvatar(a.id);grid.appendChild(b);
  });t.appendChild(grid);
}
function chooseAvatar(id){myAvatar=id;if(isHost){game.players[selfId].avatar=id;syncAll();}else actions.avatar.send({id},{target:hostId});renderAll();}

function startGame(){
  if(!isHost || Object.keys(game.players).length<MIN_PLAYERS)return;
  game.theme=$('themeSelect').value;game.totalRounds=Number($('roundsSelect').value)||5;game.antagonist=THEMES[game.theme].antagonist;
  const ids=shuffle(Object.keys(game.players)); const topo=ids[0]; game.topoId=topo;
  ids.forEach((id,i)=>{
    const role=i===0?{...TOPO_ROLE}: {...ROLES[(i-1)%ROLES.length]};
    if(id===selfId){myRole=role;showRole();} else actions.role.send(role,{target:id});
  });
  systemMessage('🔐 Los roles fueron repartidos en secreto.');game.phase='avatar';syncAll();
}
function showRole(){
  if(!myRole)return;const d=currentRole()||myRole;
  $('roleEmoji').textContent=d.emoji;$('roleName').textContent=d.name;$('roleDescription').textContent=d.desc;$('roleAlignment').textContent=myRole.key==='topo'?'TOPO':'LEAL';$('roleAlignment').classList.toggle('topo',myRole.key==='topo');$('roleModal').classList.remove('hidden');
}
function beginRound(){
  if(!isHost)return;
  game.round++; if(game.round>game.totalRounds){endGame('🐀 El Topo sobrevivió hasta el final.');return;}
  game.scenario=pick(THEMES[game.theme].situations);game.phase='discussion';usedAbility=false;votes={};
  systemMessage(`📌 SITUACIÓN ${game.round}: ${game.scenario}`);syncAll();
}
function resolveLeak(messageId){
  if(!isHost)return;const m=game.messages.find(x=>x.id===messageId);if(!m)return;
  game.lastLeak={messageId,consequence:pick(CONSEQUENCES)};game.reputation=Math.max(0,game.reputation-1);
  systemMessage(`📸 Se filtró una captura: “${m.text.slice(0,120)}${m.text.length>120?'…':''}”`);
  systemMessage(`⚠️ La recibió: ${game.antagonist}. ${game.lastLeak.consequence}`);
  if(game.reputation<=0){endGame('🐀 El Topo destruyó la reputación del grupo.');return;}
  game.phase='investigation';syncAll();
}
function openVote(){if(!isHost)return;votes={};game.phase='voting';systemMessage('📊 Se abrió la encuesta para expulsar a un sospechoso.');syncAll();}
function renderVote(t){
  const card=document.createElement('div');card.className='poll-card';card.innerHTML='<h3>¿Quién es El Topo?</h3><p>Elegí a una persona para expulsar.</p>';
  Object.entries(game.players).filter(([,p])=>p.alive!==false).forEach(([id,p])=>{
    const row=document.createElement('div');row.className='poll-option';row.innerHTML=`<span class="poll-radio"></span><span class="poll-name">${esc(p.name)}</span>`;
    row.onclick=()=>castVote(id);card.appendChild(row);
  });t.appendChild(card);
}
function castVote(targetId){
  if(usedAbility)return;usedAbility=true;
  if(isHost){votes[selfId]=targetId;if(Object.keys(votes).length>=Object.values(game.players).filter(p=>p.alive!==false).length)finishVote();else renderAll();}
  else actions.vote.send({targetId},{target:hostId});
  toast('Voto enviado');
}
function finishVote(){
  if(!isHost)return;const counts={};Object.values(votes).forEach(id=>counts[id]=(counts[id]||0)+1);
  const max=Math.max(...Object.values(counts),0);const winners=Object.keys(counts).filter(id=>counts[id]===max);
  if(winners.length!==1){systemMessage('🤝 Hubo empate. Nadie fue expulsado.');game.reputation=Math.max(0,game.reputation-1);} else {
    const id=winners[0],p=game.players[id];p.alive=false;systemMessage(`🚪 ${p.name} fue expulsado del grupo.`);
    if(id===game.topoId){endGame('✅ ¡Encontraron al Topo! Gana el grupo.');return;}
    game.reputation=Math.max(0,game.reputation-1);systemMessage('❌ Era inocente. El grupo pierde reputación.');
  }
  if(game.reputation<=0){endGame('🐀 El Topo ganó: la reputación llegó a cero.');return;}
  game.phase='between';syncAll();
}
function endGame(text){game.phase='gameover';game.result=text;systemMessage(text);syncAll();}

function sendChat(){
  const input=$('messageInput'),text=input.value.trim();if(!text||game.phase!=='discussion')return;input.value='';
  if(isHost){game.messages.push({id:crypto.randomUUID(),authorId:selfId,author:myName,text:text.slice(0,500),ts:Date.now(),round:game.round});syncAll();}
  else actions.chat.send({text:text.slice(0,500)},{target:hostId});
}

$('createRoomBtn')?.addEventListener('click',createRoom);
$('joinRoomBtn')?.addEventListener('click',joinExistingRoom);
$('roomCodeInput')?.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4)});
$('roomCodeInput')?.setAttribute('maxlength','4');
$('sendBtn')?.addEventListener('click',sendChat);
$('messageInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat()});
$('groupInfoBtn')?.addEventListener('click',()=>$('infoPanel').classList.add('open'));
$('closeInfoBtn')?.addEventListener('click',()=>$('infoPanel').classList.remove('open'));
$('closeRoleBtn')?.addEventListener('click',()=>$('roleModal').classList.add('hidden'));
$('copyCodeBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomCode);toast('Código copiado')}catch{toast(roomCode)}});
$('themeSelect')?.addEventListener('change',e=>{if(isHost&&game.phase==='lobby'){game.theme=e.target.value;game.antagonist=THEMES[game.theme].antagonist;syncAll()}});
$('roundsSelect')?.addEventListener('change',e=>{if(isHost&&game.phase==='lobby'){game.totalRounds=Number(e.target.value)||5;syncAll()}});
$('leaveRoomBtn')?.addEventListener('click',()=>{try{room?.leave()}catch{}location.reload()});
