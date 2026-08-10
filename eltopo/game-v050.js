import { joinRoom, selfId } from 'https://esm.sh/trystero@0.25.3';
import { APP_ID, MAX_PLAYERS, THEMES, CONSEQUENCES, ROLES, TOPO_ROLE, AVATARS } from './game-data.js';

const VERSION = '0.5.0';
const ROOM_ID = 'eltopo-prueba-global-v2';
const MIN_PLAYERS = 2;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => [...a].sort(() => Math.random() - .5);

let room = null;
let A = {};
let heartbeat = null;
let autoRoundTimer = null;
let myName = '';
let myRole = null;
let myAvatar = null;
let controllerId = null;
let secretTopoId = null;
let usedVote = false;
let votes = {};
const peers = new Map();
let game = freshGame();

function freshGame(){
  return {
    phase:'lobby', theme:'escape', round:0, totalRounds:5, reputation:5,
    scenario:'', antagonist:THEMES.escape.antagonist, players:{}, messages:[],
    lastLeak:null, result:null
  };
}

function me(){ return game.players[selfId]; }
function toast(text){
  const e=$('toast'); if(!e) return;
  e.textContent=text; e.classList.remove('hidden');
  clearTimeout(toast.t); toast.t=setTimeout(()=>e.classList.add('hidden'),2400);
}
function systemMessage(text){
  const m={id:crypto.randomUUID(),system:true,text,ts:Date.now(),round:game.round};
  addMessage(m);
}
function currentRole(){ return myRole?.key==='topo' ? TOPO_ROLE : ROLES.find(r=>r.key===myRole?.key); }
function peerCount(){ return peers.size; }
function updateVersion(){
  const e=$('versionBadge');
  if(e) e.textContent=`v${VERSION} · ${peerCount()} peer${peerCount()===1?'':'s'}`;
}
function activePlayerIds(){
  return Object.entries(game.players)
    .filter(([id,p])=>id===selfId || (!p.disconnected && peers.has(id)))
    .map(([id])=>id);
}
function upsertPlayer(id,name){
  const clean=String(name||game.players[id]?.name||'Jugador').trim().slice(0,20)||'Jugador';
  if(!game.players[id]) {
    game.players[id]={name:clean,avatar:null,alive:true,joinIndex:Object.keys(game.players).length,disconnected:false};
  } else {
    game.players[id].name=clean;
    game.players[id].disconnected=false;
  }
}
function addMessage(m){
  if(!m?.id || game.messages.some(x=>x.id===m.id)) return;
  game.messages.push(m);
  game.messages.sort((a,b)=>(a.ts||0)-(b.ts||0));
}
function chatAllowed(){ return !['leak','gameover'].includes(game.phase); }
function avatarData(id){ return AVATARS.find(a=>a.id===id); }

function avatarMarkup(p, cls='avatar-img'){
  const a=avatarData(p?.avatar);
  if(!a) return `<span class="avatar-letter">${esc((p?.name||'?')[0]?.toUpperCase())}</span>`;
  return `<img class="${cls}" src="${a.file}" alt="${esc(a.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="avatar-fallback" style="display:none">${a.emoji}</span>`;
}
function setMyProfilePhoto(){
  const box=$('meAvatar'); if(!box) return;
  box.innerHTML=avatarMarkup({name:myName,avatar:myAvatar},'profile-avatar-img');
}

function sendPresence(target){
  if(!A.pres) return;
  A.pres.send({name:myName,avatar:myAvatar,version:VERSION,ts:Date.now()}, target ? {target} : undefined).catch(()=>{});
}

function enterTestRoom(){
  myName=$('playerName')?.value.trim()||'';
  if(!myName){ $('landingError').textContent='Poné tu nombre.'; return; }
  $('landingError').textContent='Entrando…';

  game=freshGame();
  myRole=null; myAvatar=null; controllerId=null; secretTopoId=null; votes={}; usedVote=false;
  upsertPlayer(selfId,myName);
  try{ room?.leave(); }catch{}
  clearInterval(heartbeat); clearTimeout(autoRoundTimer);
  peers.clear();

  room=joinRoom({appId:APP_ID}, ROOM_ID, {
    onJoinError:({error})=>{
      console.warn('[ElTopo] WebRTC join error',error);
      toast('La red no pudo establecer P2P. Probablemente necesite TURN.');
    }
  });

  A={
    pres:room.makeAction('p'),
    chat:room.makeAction('c'),
    start:room.makeAction('s'),
    role:room.makeAction('r'),
    avatar:room.makeAction('a'),
    phase:room.makeAction('f'),
    leak:room.makeAction('l'),
    vote:room.makeAction('v')
  };

  room.onPeerJoin=peerId=>{
    peers.set(peerId,Date.now());
    updateVersion();
    sendPresence(peerId);
  };

  room.onPeerLeave=peerId=>{
    peers.delete(peerId);
    if(game.players[peerId]) game.players[peerId].disconnected=true;
    updateVersion(); renderAll();
  };

  A.pres.onMessage=(data,{peerId})=>{
    peers.set(peerId,Date.now());
    upsertPlayer(peerId,data?.name);
    if(data?.avatar && AVATARS.some(a=>a.id===data.avatar)) game.players[peerId].avatar=data.avatar;
    updateVersion(); renderAll(); maybeAutoBeginRound();
  };

  A.chat.onMessage=(data,{peerId})=>{
    if(!data || !chatAllowed()) return;
    upsertPlayer(peerId,data.author||game.players[peerId]?.name);
    addMessage({...data,authorId:peerId});
    renderAll();
  };

  A.start.onMessage=(data,{peerId})=>applyStart(data,peerId);
  A.role.onMessage=data=>{ myRole=data; showRole(); };
  A.avatar.onMessage=(data,{peerId})=>{
    if(!AVATARS.some(a=>a.id===data?.id)) return;
    upsertPlayer(peerId,data?.name);
    game.players[peerId].avatar=data.id;
    renderAll(); maybeAutoBeginRound();
  };
  A.phase.onMessage=data=>applyPhase(data);
  A.leak.onMessage=data=>applyLeak(data);
  A.vote.onMessage=(data,{peerId})=>{
    if(game.phase!=='voting' || !game.players[peerId]?.alive || !game.players[data?.targetId]?.alive) return;
    votes[peerId]=data.targetId;
    renderAll(); maybeFinishVote();
  };

  heartbeat=setInterval(()=>{
    sendPresence();
    const now=Date.now();
    for(const [id,last] of peers){
      if(now-last>9000){
        peers.delete(id);
        if(game.players[id]) game.players[id].disconnected=true;
      }
    }
    updateVersion(); renderPlayers();
  },1800);

  enterMessenger();
  sendPresence();
  $('landingError').textContent='';
  systemMessage('🧪 Sala única de prueba. Cuando haya 2 jugadores ya pueden iniciar.');
  renderAll();
}

function enterMessenger(){
  $('landing')?.classList.remove('active');
  $('messenger')?.classList.add('active');
  if($('roomCodeDisplay')) $('roomCodeDisplay').textContent='GLOBAL';
  setMyProfilePhoto();
  $('hostSettings')?.classList.remove('hidden');
}

function renderAll(){
  const theme=THEMES[game.theme]||THEMES.escape;
  document.querySelectorAll('#groupName,#sidebarGroupName,#infoGroupName').forEach(e=>e.textContent=theme.name);
  const active=activePlayerIds().length;
  if($('groupSubtitle')) $('groupSubtitle').textContent=`${active} participante${active===1?'':'s'} · ${peerCount()} peer${peerCount()===1?'':'s'}`;
  if($('sidebarPreview')) $('sidebarPreview').textContent=phaseLabel();
  const input=$('messageInput'), send=$('sendBtn');
  if(input){ input.disabled=!chatAllowed(); input.placeholder=chatAllowed()?'Escribe un mensaje':'El chat está bloqueado durante la filtración'; }
  if(send) send.disabled=!chatAllowed();
  setMyProfilePhoto();
  renderPlayers(); renderMessages(); renderBanner(); renderActions(); updateVersion();
  if($('infoCount')) $('infoCount').textContent=`${active} participantes`;
  if($('participantTitle')) $('participantTitle').textContent=`${active} participantes`;
}

function phaseLabel(){
  return ({
    lobby:'Esperando jugadores', avatar:'Eligiendo fotos de perfil', discussion:`Ronda ${game.round}: debate`,
    leak:'El Topo está sacando una captura', investigation:'Investigando al Topo', voting:'Votación abierta',
    between:'Fin de ronda', gameover:'Partida terminada'
  })[game.phase]||game.phase;
}

function renderPlayers(){
  const box=$('participants'); if(!box) return; box.innerHTML='';
  Object.entries(game.players).sort((a,b)=>(a[1].joinIndex||0)-(b[1].joinIndex||0)).forEach(([id,p])=>{
    const d=document.createElement('div');
    d.className='participant'+(p.alive===false?' eliminated':'');
    d.innerHTML=`<div class="participant-avatar">${avatarMarkup(p)}</div><div class="participant-copy"><strong>${esc(p.name)}${id===selfId?' (vos)':''}</strong><span>${p.disconnected?'desconectado':p.alive===false?'expulsado':p.avatar?'foto elegida':'conectado'}</span></div>${id===controllerId?'<span class="host-badge">ADMIN</span>':''}`;
    box.appendChild(d);
  });
}

function renderMessages(){
  const box=$('messages'); if(!box) return;
  box.innerHTML='<div class="day-chip">HOY</div>';
  for(const m of game.messages){
    if(m.system){
      box.insertAdjacentHTML('beforeend',`<div class="system-chip">${esc(m.text)}</div>`);
      continue;
    }
    const mine=m.authorId===selfId;
    const p=game.players[m.authorId]||{name:m.author||'Jugador',avatar:null};
    const name=mine?'Vos':esc(m.author||p.name||'Jugador');
    box.insertAdjacentHTML('beforeend',`<div class="message-row ${mine?'mine':''}">${mine?'':`<div class="message-avatar">${avatarMarkup(p)}</div>`}<article class="bubble"><div class="sender-name">${name}</div><span>${esc(m.text)}</span><span class="bubble-meta">${new Date(m.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}${mine?' <span class="ticks">✓✓</span>':''}</span></article></div>`);
  }
  box.scrollTop=box.scrollHeight;
}

function renderBanner(){
  const b=$('gameBanner'); if(!b) return;
  const rep=`${'●'.repeat(game.reputation)}${'○'.repeat(5-game.reputation)}`;
  const round=game.round?` · Ronda ${game.round}/${game.totalRounds}`:'';
  b.innerHTML=`<strong>${esc(phaseLabel())}</strong>${round} · Reputación ${rep}`;
  b.classList.remove('hidden');
}

function button(text,fn,primary=false){
  const b=document.createElement('button');
  b.className='action-btn'+(primary?' primary-action':'');
  b.textContent=text; b.onclick=fn; return b;
}

function scenarioCard(){
  return `<div class="scenario-card"><span class="scenario-kicker">SITUACIÓN DE LA RONDA</span><strong>${esc(game.scenario)}</strong><small>Hablen en el grupo como si esto estuviera pasando de verdad. Todo lo que escriban puede terminar en una captura.</small></div>`;
}

function renderActions(){
  const t=$('actionTray'); if(!t) return;
  t.innerHTML=''; t.classList.remove('hidden');
  if(!me()){ t.innerHTML='<h4>Esperando presencia P2P…</h4>'; return; }
  if(me().alive===false){ t.innerHTML='<h4>🚪 Fuiste expulsado. Seguís mirando la partida.</h4>'; return; }

  if(game.phase==='lobby'){
    const n=activePlayerIds().length;
    t.innerHTML=`<h4>${n<MIN_PLAYERS?'Conectá un segundo dispositivo para probar.':'✅ Conexión lista. El chat ya funciona y pueden iniciar.'}</h4>`;
    const b=button(`Iniciar partida (${n})`,startGame,true);
    b.disabled=n<MIN_PLAYERS; t.appendChild(b); return;
  }

  if(game.phase==='avatar'){
    renderAvatarPicker(t);
    return;
  }

  if(game.phase==='discussion'){
    t.insertAdjacentHTML('beforeend',scenarioCard());
    const h=document.createElement('h4'); h.textContent='💬 Debatan en el chat. Cuando haya suficiente material, el administrador cierra el debate.'; t.appendChild(h);
    if(controllerId===selfId) t.appendChild(button('Cerrar debate y pasar a la filtración',()=>broadcastPhase({phase:'leak'}),true));
    return;
  }

  if(game.phase==='leak'){
    if(myRole?.key==='topo'){
      t.innerHTML='<h4>🐀 Sos El Topo. Elegí UN mensaje de esta ronda para sacar captura y filtrarlo.</h4>';
      const candidates=game.messages.filter(m=>!m.system && m.round===game.round);
      if(!candidates.length){
        t.insertAdjacentHTML('beforeend','<div class="waiting-card">Todavía no hay mensajes de esta ronda para filtrar.</div>');
        if(controllerId===selfId) t.appendChild(button('Volver al debate',()=>broadcastPhase({phase:'discussion',round:game.round,scenario:game.scenario}),false));
      }
      candidates.slice(-30).forEach(m=>{
        const d=document.createElement('div'); d.className='leak-choice';
        d.innerHTML=`<div><b>${esc(m.author||game.players[m.authorId]?.name||'Jugador')}</b>: ${esc(m.text)}</div><button>📸 Filtrar esta captura</button>`;
        d.querySelector('button').onclick=()=>emitLeak(m.id);
        t.appendChild(d);
      });
    } else {
      t.innerHTML='<div class="waiting-card"><strong>📵 Conversación cerrada</strong><span>El Topo está eligiendo qué mensaje filtrar. Esperá unos segundos…</span></div>';
    }
    return;
  }

  if(game.phase==='investigation'){
    t.innerHTML=`<div class="investigation-card"><strong>🚨 HUBO UNA FILTRACIÓN</strong><span>${esc(game.lastLeak?.summary||'Una captura salió del grupo.')}</span></div><h4>🕵️ Ahora discutan quién pudo haber sido.</h4>`;
    if(controllerId===selfId) t.appendChild(button('Abrir encuesta: ¿Quién es El Topo?',()=>{votes={};broadcastPhase({phase:'voting'});},true));
    return;
  }

  if(game.phase==='voting'){ renderVote(t); return; }

  if(game.phase==='between'){
    t.innerHTML='<div class="waiting-card"><strong>🐀 El Topo sigue adentro</strong><span>Perdieron reputación. Empieza una nueva situación.</span></div>';
    if(controllerId===selfId) t.appendChild(button('Siguiente ronda',beginRound,true));
    return;
  }

  if(game.phase==='gameover'){
    t.innerHTML=`<div class="gameover-card"><strong>${esc(game.result||'Fin de la partida')}</strong><span>Recargá la página para volver a probar desde cero.</span></div>`;
  }
}

function renderAvatarPicker(t){
  if(myAvatar){
    const a=avatarData(myAvatar);
    t.innerHTML=`<div class="avatar-selected-card"><div class="avatar-selected-img">${avatarMarkup({name:myName,avatar:myAvatar})}</div><div><strong>✓ Foto de perfil elegida</strong><span>${esc(a?.name||'Perfil')}</span><small>Ahora aparece como tu foto en el grupo y en los mensajes.</small></div></div>`;
    if(controllerId===selfId){
      const ready=allAvatarsReady();
      t.insertAdjacentHTML('beforeend',`<div class="ready-status">${ready?'Todos eligieron. Arrancando la ronda…':'Esperando que los demás elijan su foto…'}</div>`);
    } else {
      t.insertAdjacentHTML('beforeend','<div class="ready-status">Esperando que todos terminen de elegir…</div>');
    }
    return;
  }

  const title=document.createElement('div');
  title.className='avatar-picker-title';
  title.innerHTML='<strong>Elegí tu foto de perfil pública</strong><span>Tu rol es secreto; esta foto la ve todo el grupo.</span>';
  t.appendChild(title);

  const grid=document.createElement('div'); grid.className='avatar-picker compact-avatar-picker';
  AVATARS.forEach(a=>{
    const b=document.createElement('button'); b.className='avatar-choice'; b.title=a.name;
    b.innerHTML=`<div class="avatar-choice-img"><img src="${a.file}" alt="${esc(a.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span style="display:none">${a.emoji}</span></div><small>${esc(a.name)}</small>`;
    b.onclick=()=>chooseAvatar(a.id); grid.appendChild(b);
  });
  t.appendChild(grid);
}

function chooseAvatar(id){
  if(!AVATARS.some(a=>a.id===id) || game.phase!=='avatar') return;
  myAvatar=id;
  game.players[selfId].avatar=id;
  setMyProfilePhoto();
  A.avatar.send({id,name:myName}).catch(()=>toast('No pude compartir la foto'));
  sendPresence();
  renderAll();
  toast('Foto de perfil elegida');
  maybeAutoBeginRound();
}

function allAvatarsReady(){
  const ids=activePlayerIds();
  return ids.length>=MIN_PLAYERS && ids.every(id=>game.players[id]?.avatar);
}
function maybeAutoBeginRound(){
  if(controllerId!==selfId || game.phase!=='avatar' || !allAvatarsReady()) return;
  clearTimeout(autoRoundTimer);
  autoRoundTimer=setTimeout(()=>{
    if(controllerId===selfId && game.phase==='avatar' && allAvatarsReady()) beginRound();
  },900);
}

function startGame(){
  const ids=activePlayerIds();
  if(ids.length<MIN_PLAYERS){ toast('Necesitamos 2 jugadores para esta prueba.'); return; }
  controllerId=selfId;
  const theme=$('themeSelect')?.value||'escape';
  const totalRounds=Number($('roundsSelect')?.value)||5;
  const roster=Object.fromEntries(ids.map(id=>[id,{...game.players[id],avatar:null,alive:true,disconnected:false}]));
  const payload={controllerId,theme,totalRounds,players:roster,startedAt:Date.now()};

  myAvatar=null;
  applyStart(payload,selfId);
  A.start.send(payload).catch(()=>toast('No pude anunciar el inicio'));

  const shuffled=shuffle(ids);
  secretTopoId=shuffled[0];
  let loyalIndex=0;
  ids.forEach(id=>{
    const role=id===secretTopoId ? {...TOPO_ROLE} : {...ROLES[loyalIndex++ % ROLES.length]};
    if(id===selfId){ myRole=role; showRole(); }
    else A.role.send(role,{target:id}).catch(()=>{});
  });
}

function applyStart(data,peerId){
  if(!data?.players) return;
  controllerId=data.controllerId||peerId;
  game.phase='avatar';
  game.theme=data.theme||'escape';
  game.totalRounds=Number(data.totalRounds)||5;
  game.round=0; game.reputation=5; game.result=null; game.scenario=''; game.lastLeak=null;
  game.antagonist=(THEMES[game.theme]||THEMES.escape).antagonist;
  game.players=JSON.parse(JSON.stringify(data.players));
  myAvatar=null;
  upsertPlayer(selfId,myName);
  game.players[selfId].avatar=null;
  setMyProfilePhoto();
  systemMessage('🔐 La partida comenzó. Mirá tu rol secreto y elegí una foto de perfil pública.');
  renderAll();
}

function showRole(){
  if(!myRole) return;
  const d=currentRole()||myRole;
  $('roleEmoji').textContent=d.emoji;
  $('roleName').textContent=d.name;
  $('roleDescription').textContent=d.desc;
  $('roleAlignment').textContent=myRole.key==='topo'?'TOPO':'LEAL';
  $('roleAlignment').classList.toggle('topo',myRole.key==='topo');
  $('roleModal').classList.remove('hidden');
}

function beginRound(){
  if(controllerId!==selfId) return;
  const next=game.round+1;
  if(next>game.totalRounds){
    broadcastPhase({phase:'gameover',result:'🐀 El Topo sobrevivió hasta el final. Gana El Topo.'});
    return;
  }
  const scenario=pick((THEMES[game.theme]||THEMES.escape).situations);
  votes={}; usedVote=false;
  broadcastPhase({phase:'discussion',round:next,scenario});
}

function broadcastPhase(data){
  applyPhase(data);
  A.phase.send(data).catch(()=>toast('No pude sincronizar la fase'));
}

function applyPhase(data){
  if(!data?.phase) return;
  const previous=game.phase;
  game.phase=data.phase;
  if(Number.isFinite(data.round)) game.round=data.round;
  if(typeof data.scenario==='string') game.scenario=data.scenario;
  if(Number.isFinite(data.reputation)) game.reputation=data.reputation;
  if(data.players) game.players=data.players;
  if(data.result) game.result=data.result;
  if(data.notice) systemMessage(data.notice);

  if(data.phase==='discussion' && (previous!=='discussion' || data.round!==game.round)){
    systemMessage(`📌 RONDA ${data.round}: ${data.scenario}`);
  } else if(data.phase==='discussion' && previous!=='discussion'){
    systemMessage(`📌 RONDA ${data.round}: ${data.scenario}`);
  }
  if(data.phase==='leak' && previous!=='leak') systemMessage('🔒 Debate cerrado. El Topo está eligiendo una captura.');
  if(data.phase==='voting' && previous!=='voting'){
    votes={}; usedVote=false;
    systemMessage('📊 Se abrió la encuesta para expulsar a un sospechoso.');
  }
  renderAll();
}

function emitLeak(messageId){
  if(myRole?.key!=='topo' || game.phase!=='leak') return;
  const m=game.messages.find(x=>x.id===messageId); if(!m) return;
  const consequence=pick(CONSEQUENCES);
  const summary=`“${m.text.slice(0,90)}${m.text.length>90?'…':''}” llegó a ${game.antagonist}.`;
  const data={messageId,consequence,antagonist:game.antagonist,summary};
  applyLeak(data);
  A.leak.send(data).catch(()=>toast('No pude filtrar la captura'));
}

function applyLeak(data){
  if(game.phase!=='leak') return;
  const m=game.messages.find(x=>x.id===data?.messageId); if(!m) return;
  game.lastLeak={...data,summary:data.summary||`Se filtró: ${m.text}`};
  game.reputation=Math.max(0,game.reputation-1);
  systemMessage(`📸 CAPTURA FILTRADA — ${m.author||game.players[m.authorId]?.name||'Jugador'}: “${m.text.slice(0,120)}${m.text.length>120?'…':''}”`);
  systemMessage(`⚠️ La recibió ${data.antagonist||game.antagonist}. ${data.consequence||''}`);
  if(game.reputation<=0){
    game.phase='gameover'; game.result='🐀 El Topo destruyó la reputación del grupo. Gana El Topo.';
  } else game.phase='investigation';
  renderAll();
}

function renderVote(t){
  const card=document.createElement('div');
  card.className='poll-card';
  card.innerHTML='<h3>¿Quién es El Topo?</h3><p>Elegí una persona. No podés cambiar el voto.</p>';
  Object.entries(game.players).filter(([,p])=>p.alive!==false&&!p.disconnected).forEach(([id,p])=>{
    const row=document.createElement('div');
    row.className='poll-option'+(votes[selfId]===id?' voted':'');
    row.innerHTML=`<div class="poll-avatar">${avatarMarkup(p)}</div><span class="poll-radio"></span><span class="poll-name">${esc(p.name)}${id===selfId?' (vos)':''}</span>`;
    if(!usedVote) row.onclick=()=>castVote(id);
    card.appendChild(row);
  });
  if(usedVote) card.insertAdjacentHTML('beforeend','<div class="poll-footer">✓ Voto enviado. Esperando al resto…</div>');
  t.appendChild(card);
}

function castVote(targetId){
  if(usedVote || game.phase!=='voting') return;
  usedVote=true; votes[selfId]=targetId;
  A.vote.send({targetId}).catch(()=>toast('No pude enviar el voto'));
  toast('Voto enviado'); renderAll(); maybeFinishVote();
}

function maybeFinishVote(){
  if(controllerId!==selfId || game.phase!=='voting') return;
  const alive=Object.entries(game.players).filter(([,p])=>p.alive!==false&&!p.disconnected).map(([id])=>id);
  if(alive.some(id=>!votes[id])) return;

  const counts={};
  alive.forEach(id=>{ const target=votes[id]; counts[target]=(counts[target]||0)+1; });
  const max=Math.max(...Object.values(counts),0);
  const winners=Object.keys(counts).filter(id=>counts[id]===max);
  let rep=game.reputation, result=null, phase='between', notice='';
  const players=JSON.parse(JSON.stringify(game.players));

  if(winners.length!==1){
    rep=Math.max(0,rep-1);
    notice='🤝 Hubo empate. Nadie fue expulsado. El grupo pierde reputación.';
  } else {
    const id=winners[0];
    players[id].alive=false;
    notice=`🚪 ${players[id].name} fue expulsado del grupo.`;
    if(id===secretTopoId){
      phase='gameover'; result='✅ ¡Encontraron al Topo! Gana el grupo.';
    } else {
      rep=Math.max(0,rep-1);
      notice+=' ❌ Era inocente. El grupo pierde reputación.';
    }
  }

  if(rep<=0 && phase!=='gameover'){
    phase='gameover'; result='🐀 El Topo ganó: la reputación llegó a cero.';
  }
  broadcastPhase({phase,reputation:rep,players,result,notice});
}

function sendChat(){
  const input=$('messageInput');
  const text=input?.value.trim();
  if(!text || !chatAllowed()) return;
  input.value='';
  const m={id:crypto.randomUUID(),authorId:selfId,author:myName,text:text.slice(0,500),ts:Date.now(),round:game.round};
  addMessage(m); renderAll();
  A.chat.send(m).catch(()=>toast('No se pudo enviar'));
}

$('createRoomBtn')?.addEventListener('click',enterTestRoom);
$('joinRoomBtn')?.addEventListener('click',enterTestRoom);
$('startGameBtn')?.addEventListener('click',startGame);
$('sendBtn')?.addEventListener('click',sendChat);
$('messageInput')?.addEventListener('keydown',e=>{ if(e.key==='Enter') sendChat(); });
$('groupInfoBtn')?.addEventListener('click',()=>$('infoPanel')?.classList.add('open'));
$('closeInfoBtn')?.addEventListener('click',()=>$('infoPanel')?.classList.remove('open'));
$('closeRoleBtn')?.addEventListener('click',()=>$('roleModal')?.classList.add('hidden'));
$('copyCodeBtn')?.addEventListener('click',()=>toast('Modo prueba: todos entran a la misma sala.'));
$('leaveRoomBtn')?.addEventListener('click',()=>{
  clearInterval(heartbeat); clearTimeout(autoRoundTimer);
  try{room?.leave();}catch{}
  location.reload();
});

updateVersion();
