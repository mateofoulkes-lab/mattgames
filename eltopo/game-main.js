import { joinRoom, selfId } from 'https://esm.sh/trystero@0.25.3';
import { APP_ID, MAX_PLAYERS, THEMES, CONSEQUENCES, ROLES, TOPO_ROLE, AVATARS } from './game-data.js';

const VERSION = '0.4.0';
const ROOM_ID = 'eltopo-prueba-global-v1';
const MIN_PLAYERS = 2;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => [...a].sort(() => Math.random() - .5);

let room = null;
let A = {};
let heartbeat = null;
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
  return {phase:'lobby',theme:'escape',round:0,totalRounds:5,reputation:5,scenario:'',antagonist:THEMES.escape.antagonist,players:{},messages:[],lastLeak:null,result:null};
}
function me(){ return game.players[selfId]; }
function toast(text){ const e=$('toast'); if(!e) return; e.textContent=text; e.classList.remove('hidden'); clearTimeout(toast.t); toast.t=setTimeout(()=>e.classList.add('hidden'),2200); }
function systemMessage(text){ game.messages.push({id:crypto.randomUUID(),system:true,text,ts:Date.now(),round:game.round}); }
function currentRole(){ return myRole?.key==='topo' ? TOPO_ROLE : ROLES.find(r=>r.key===myRole?.key); }
function peerCount(){ return peers.size; }
function updateVersion(){ const e=$('versionBadge'); if(e) e.textContent=`v${VERSION} · ${peerCount()} peer${peerCount()===1?'':'s'}`; }
function upsertPlayer(id,name){
  const clean=String(name||'Jugador').trim().slice(0,20)||'Jugador';
  if(!game.players[id]) game.players[id]={name:clean,avatar:null,alive:true,joinIndex:Object.keys(game.players).length,disconnected:false};
  else { game.players[id].name=clean; game.players[id].disconnected=false; }
}
function addMessage(m){
  if(!m?.id || game.messages.some(x=>x.id===m.id)) return;
  game.messages.push(m);
  game.messages.sort((a,b)=>(a.ts||0)-(b.ts||0));
}
function chatAllowed(){ return game.phase!=='leak' && game.phase!=='gameover'; }

function sendPresence(target){
  if(!A.pres) return;
  A.pres.send({name:myName,version:VERSION,ts:Date.now()}, target ? {target} : undefined).catch(()=>{});
}

function enterTestRoom(){
  myName=$('playerName')?.value.trim()||'';
  if(!myName){ $('landingError').textContent='Poné tu nombre.'; return; }
  $('landingError').textContent='Entrando a la sala única…';

  game=freshGame();
  upsertPlayer(selfId,myName);
  try{ room?.leave(); }catch{}
  clearInterval(heartbeat);
  peers.clear();

  room=joinRoom({appId:APP_ID}, ROOM_ID, {
    onJoinError:({error})=>{
      console.warn('[ElTopo] join error',error);
      $('landingError').textContent='Error P2P. Recargá e intentá otra vez.';
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
    updateVersion();
    renderAll();
  };

  A.pres.onMessage=(data,{peerId})=>{
    peers.set(peerId,Date.now());
    if(game.phase==='lobby' || game.players[peerId]) upsertPlayer(peerId,data?.name);
    updateVersion();
    renderAll();
  };

  A.chat.onMessage=(data,{peerId})=>{
    if(!data || !chatAllowed()) return;
    upsertPlayer(peerId,data.author||game.players[peerId]?.name||'Jugador');
    addMessage({...data,authorId:peerId});
    renderAll();
  };

  A.start.onMessage=(data,{peerId})=>applyStart(data,peerId);
  A.role.onMessage=data=>{ myRole=data; showRole(); };
  A.avatar.onMessage=(data,{peerId})=>{
    if(!AVATARS.some(a=>a.id===data?.id)) return;
    upsertPlayer(peerId,data?.name||game.players[peerId]?.name);
    game.players[peerId].avatar=data.id;
    renderAll();
  };
  A.phase.onMessage=data=>applyPhase(data);
  A.leak.onMessage=data=>applyLeak(data);
  A.vote.onMessage=(data,{peerId})=>{
    if(game.phase!=='voting' || !game.players[peerId]?.alive || !game.players[data?.targetId]?.alive) return;
    votes[peerId]=data.targetId;
    renderAll();
    maybeFinishVote();
  };

  heartbeat=setInterval(()=>{
    sendPresence();
    const now=Date.now();
    for(const [id,last] of peers){ if(now-last>8000) peers.delete(id); }
    updateVersion();
  },1500);

  enterMessenger();
  sendPresence();
  $('landingError').textContent='';
  systemMessage('🧪 Modo prueba: todos entran a una única sala P2P.');
  renderAll();
}

function enterMessenger(){
  $('landing')?.classList.remove('active');
  $('messenger')?.classList.add('active');
  if($('roomCodeDisplay')) $('roomCodeDisplay').textContent='GLOBAL';
  if($('meAvatar')) $('meAvatar').textContent=(myName[0]||'?').toUpperCase();
  $('hostSettings')?.classList.remove('hidden');
}

function avatarData(id){ return AVATARS.find(a=>a.id===id); }
function avatarMarkup(p){
  const a=avatarData(p?.avatar);
  if(!a) return `<span>${esc((p?.name||'?')[0]?.toUpperCase())}</span>`;
  return `<img class="avatar-img" src="${a.file}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="avatar-fallback" style="display:none">${a.emoji}</span>`;
}

function renderAll(){
  const theme=THEMES[game.theme]||THEMES.escape;
  document.querySelectorAll('#groupName,#sidebarGroupName,#infoGroupName').forEach(e=>e.textContent=theme.name);
  if($('groupSubtitle')) $('groupSubtitle').textContent=`${Object.keys(game.players).length} participante${Object.keys(game.players).length===1?'':'s'} · ${peerCount()} peer${peerCount()===1?'':'s'} · sala única`;
  if($('sidebarPreview')) $('sidebarPreview').textContent=game.phase==='lobby'?'Sala global de prueba':`Ronda ${game.round}/${game.totalRounds}`;
  const input=$('messageInput'), send=$('sendBtn');
  if(input){ input.disabled=!chatAllowed(); input.placeholder=chatAllowed()?'Escribe un mensaje':'Chat bloqueado durante la filtración'; }
  if(send) send.disabled=!chatAllowed();
  renderPlayers();
  renderMessages();
  renderBanner();
  renderActions();
  updateVersion();
  if($('infoCount')) $('infoCount').textContent=`${Object.keys(game.players).length} participantes`;
  if($('participantTitle')) $('participantTitle').textContent=`${Object.keys(game.players).length} participantes`;
}

function renderPlayers(){
  const box=$('participants'); if(!box) return; box.innerHTML='';
  Object.entries(game.players).sort((a,b)=>(a[1].joinIndex||0)-(b[1].joinIndex||0)).forEach(([id,p])=>{
    const d=document.createElement('div'); d.className='participant'+(p.alive===false?' eliminated':'');
    d.innerHTML=`<div class="participant-avatar">${avatarMarkup(p)}</div><div class="participant-copy"><strong>${esc(p.name)}${id===selfId?' (vos)':''}</strong><span>${p.disconnected?'desconectado':p.alive===false?'expulsado':p.avatar?'listo':'conectado'}</span></div>${id===controllerId?'<span class="host-badge">ADMIN</span>':''}`;
    box.appendChild(d);
  });
}

function renderMessages(){
  const box=$('messages'); if(!box) return; box.innerHTML='<div class="day-chip">HOY</div>';
  for(const m of game.messages){
    if(m.system){ box.insertAdjacentHTML('beforeend',`<div class="system-chip">${esc(m.text)}</div>`); continue; }
    const mine=m.authorId===selfId;
    const name=mine?'Vos':esc(m.author||game.players[m.authorId]?.name||'Jugador');
    box.insertAdjacentHTML('beforeend',`<div class="message-row ${mine?'mine':''}"><article class="bubble"><div class="sender-name">${name}</div><span>${esc(m.text)}</span><span class="bubble-meta">${new Date(m.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}${mine?' <span class="ticks">✓✓</span>':''}</span></article></div>`);
  }
  box.scrollTop=box.scrollHeight;
}

function renderBanner(){
  const labels={lobby:'Sala única de prueba',avatar:'Elegí tu avatar público',discussion:`Ronda ${game.round}/${game.totalRounds}`,leak:'El Topo está eligiendo una captura',investigation:'Investigación',voting:'Encuesta de expulsión',between:'Fin de ronda',gameover:'Partida terminada'};
  const b=$('gameBanner'); if(!b) return;
  b.textContent=`${labels[game.phase]||game.phase} · Reputación ${'●'.repeat(game.reputation)}${'○'.repeat(5-game.reputation)}`+(game.scenario?` · ${game.scenario}`:'');
  b.classList.remove('hidden');
}

function button(text,fn,primary=false){ const b=document.createElement('button'); b.className='action-btn'+(primary?' primary-action':''); b.textContent=text; b.onclick=fn; return b; }

function renderActions(){
  const t=$('actionTray'); if(!t) return; t.innerHTML=''; t.classList.remove('hidden');
  if(!me()){ t.innerHTML='<h4>Esperando presencia P2P…</h4>'; return; }
  if(me().alive===false){ t.innerHTML='<h4>Fuiste expulsado. Seguís mirando.</h4>'; return; }

  if(game.phase==='lobby'){
    const n=Object.keys(game.players).filter(id=>!game.players[id].disconnected).length;
    t.innerHTML=`<h4>${n<MIN_PLAYERS?'Necesitamos 2 dispositivos para probar.':'P2P conectado. Ya podés probar el chat o iniciar.'}</h4>`;
    const b=button(`Iniciar partida (${n})`,startGame,true); b.disabled=n<MIN_PLAYERS; t.appendChild(b); return;
  }
  if(game.phase==='avatar'){
    renderAvatars(t);
    if(controllerId===selfId){
      const ready=Object.values(game.players).filter(p=>!p.disconnected).every(p=>p.avatar);
      const b=button(ready?'Comenzar ronda':'Esperando avatares…',beginRound,true); b.disabled=!ready; t.appendChild(b);
    }
    return;
  }
  if(game.phase==='discussion'){
    t.innerHTML='<h4>Debatan libremente. El chat ahora viaja directo entre peers.</h4>';
    if(controllerId===selfId) t.appendChild(button('Cerrar conversación',()=>broadcastPhase({phase:'leak'}),true));
    return;
  }
  if(game.phase==='leak'){
    if(myRole?.key==='topo'){
      t.innerHTML='<h4>🐀 Elegí qué mensaje filtrar.</h4>';
      game.messages.filter(m=>!m.system).slice(-30).forEach(m=>{
        const d=document.createElement('div'); d.className='leak-choice';
        d.innerHTML=`<div><b>${esc(m.author||game.players[m.authorId]?.name||'Jugador')}</b>: ${esc(m.text)}</div><button>📸 Filtrar esta captura</button>`;
        d.querySelector('button').onclick=()=>emitLeak(m.id); t.appendChild(d);
      });
    } else t.innerHTML='<h4>Algo está pasando fuera del grupo…</h4>';
    return;
  }
  if(game.phase==='investigation'){
    t.innerHTML='<h4>Discutan lo ocurrido y busquen al Topo.</h4>';
    if(controllerId===selfId) t.appendChild(button('Crear encuesta de expulsión',()=>{votes={};broadcastPhase({phase:'voting'});},true));
    return;
  }
  if(game.phase==='voting'){ renderVote(t); return; }
  if(game.phase==='between'){
    t.innerHTML='<h4>El Topo sigue dentro del grupo.</h4>';
    if(controllerId===selfId) t.appendChild(button('Siguiente ronda',beginRound,true));
    return;
  }
  if(game.phase==='gameover') t.innerHTML=`<h4>${esc(game.result||'Fin de la partida')}</h4>`;
}

function renderAvatars(t){
  const title=document.createElement('h4'); title.textContent='Tu rol es secreto. Elegí una foto pública:'; t.appendChild(title);
  const grid=document.createElement('div'); grid.className='avatar-picker';
  AVATARS.forEach(a=>{
    const b=document.createElement('button'); b.className='avatar-choice'+(myAvatar===a.id?' selected':'');
    b.innerHTML=`<div class="avatar-choice-img"><img src="${a.file}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span style="display:none">${a.emoji}</span></div><small>${esc(a.name)}</small>`;
    b.onclick=()=>chooseAvatar(a.id); grid.appendChild(b);
  });
  t.appendChild(grid);
}

function chooseAvatar(id){
  if(!AVATARS.some(a=>a.id===id)) return;
  myAvatar=id; game.players[selfId].avatar=id;
  A.avatar.send({id,name:myName}).catch(()=>{});
  renderAll();
}

function startGame(){
  const ids=Object.keys(game.players).filter(id=>!game.players[id].disconnected);
  if(ids.length<MIN_PLAYERS){ toast('Necesitamos 2 jugadores para esta prueba.'); return; }
  controllerId=selfId;
  const theme=$('themeSelect')?.value||'escape';
  const totalRounds=Number($('roundsSelect')?.value)||5;
  const roster=Object.fromEntries(ids.map(id=>[id,{...game.players[id],alive:true,disconnected:false}]));
  const payload={controllerId,theme,totalRounds,players:roster,startedAt:Date.now()};
  applyStart(payload,selfId);
  A.start.send(payload).catch(()=>{});

  const shuffled=shuffle(ids); secretTopoId=shuffled[0];
  ids.forEach((id,i)=>{
    const role=id===secretTopoId?{...TOPO_ROLE}:{...ROLES[Math.max(0,(i-1)%ROLES.length)]};
    if(id===selfId){ myRole=role; showRole(); }
    else A.role.send(role,{target:id}).catch(()=>{});
  });
}

function applyStart(data,peerId){
  if(!data?.players) return;
  controllerId=data.controllerId||peerId;
  game.phase='avatar'; game.theme=data.theme||'escape'; game.totalRounds=Number(data.totalRounds)||5; game.round=0; game.reputation=5; game.result=null;
  game.antagonist=(THEMES[game.theme]||THEMES.escape).antagonist;
  game.players=JSON.parse(JSON.stringify(data.players));
  upsertPlayer(selfId,myName);
  systemMessage('🔐 La partida comenzó. Los roles se repartieron en secreto.');
  renderAll();
}

function showRole(){
  if(!myRole) return; const d=currentRole()||myRole;
  $('roleEmoji').textContent=d.emoji; $('roleName').textContent=d.name; $('roleDescription').textContent=d.desc;
  $('roleAlignment').textContent=myRole.key==='topo'?'TOPO':'LEAL'; $('roleAlignment').classList.toggle('topo',myRole.key==='topo');
  $('roleModal').classList.remove('hidden');
}

function beginRound(){
  if(controllerId!==selfId) return;
  const next=game.round+1;
  if(next>game.totalRounds){ broadcastPhase({phase:'gameover',result:'🐀 El Topo sobrevivió hasta el final.'}); return; }
  const scenario=pick((THEMES[game.theme]||THEMES.escape).situations);
  votes={}; usedVote=false;
  broadcastPhase({phase:'discussion',round:next,scenario});
}

function broadcastPhase(data){ applyPhase(data); A.phase.send(data).catch(()=>{}); }
function applyPhase(data){
  if(!data?.phase) return;
  game.phase=data.phase;
  if(Number.isFinite(data.round)) game.round=data.round;
  if(typeof data.scenario==='string') game.scenario=data.scenario;
  if(Number.isFinite(data.reputation)) game.reputation=data.reputation;
  if(data.players) game.players=data.players;
  if(data.result) game.result=data.result;
  if(data.notice) systemMessage(data.notice);
  if(data.phase==='discussion' && data.scenario) systemMessage(`📌 SITUACIÓN ${data.round}: ${data.scenario}`);
  if(data.phase==='leak') systemMessage('🔒 Conversación cerrada. El Topo está eligiendo qué filtrar.');
  if(data.phase==='voting'){ votes={}; usedVote=false; systemMessage('📊 Se abrió la encuesta para expulsar a un sospechoso.'); }
  renderAll();
}

function emitLeak(messageId){
  const m=game.messages.find(x=>x.id===messageId); if(!m) return;
  const data={messageId,consequence:pick(CONSEQUENCES),antagonist:game.antagonist};
  applyLeak(data); A.leak.send(data).catch(()=>{});
}
function applyLeak(data){
  if(game.phase!=='leak') return;
  const m=game.messages.find(x=>x.id===data?.messageId); if(!m) return;
  game.lastLeak=data; game.reputation=Math.max(0,game.reputation-1);
  systemMessage(`📸 Se filtró una captura: “${m.text.slice(0,120)}${m.text.length>120?'…':''}”`);
  systemMessage(`⚠️ La recibió: ${data.antagonist||game.antagonist}. ${data.consequence||''}`);
  game.phase=game.reputation<=0?'gameover':'investigation';
  if(game.phase==='gameover') game.result='🐀 El Topo destruyó la reputación del grupo.';
  renderAll();
}

function renderVote(t){
  const card=document.createElement('div'); card.className='poll-card'; card.innerHTML='<h3>¿Quién es El Topo?</h3><p>Elegí a una persona para expulsar.</p>';
  Object.entries(game.players).filter(([,p])=>p.alive!==false&&!p.disconnected).forEach(([id,p])=>{
    const row=document.createElement('div'); row.className='poll-option'; row.innerHTML=`<span class="poll-radio"></span><span class="poll-name">${esc(p.name)}</span>`;
    row.onclick=()=>castVote(id); card.appendChild(row);
  }); t.appendChild(card);
}
function castVote(targetId){
  if(usedVote || game.phase!=='voting') return;
  usedVote=true; votes[selfId]=targetId; A.vote.send({targetId}).catch(()=>{}); toast('Voto enviado'); renderAll(); maybeFinishVote();
}
function maybeFinishVote(){
  if(controllerId!==selfId || game.phase!=='voting') return;
  const alive=Object.entries(game.players).filter(([,p])=>p.alive!==false&&!p.disconnected).map(([id])=>id);
  if(alive.some(id=>!votes[id])) return;
  const counts={}; alive.forEach(id=>{const target=votes[id];counts[target]=(counts[target]||0)+1;});
  const max=Math.max(...Object.values(counts),0); const winners=Object.keys(counts).filter(id=>counts[id]===max);
  let rep=game.reputation; let result=null; let phase='between'; let notice=''; const players=JSON.parse(JSON.stringify(game.players));
  if(winners.length!==1){ rep=Math.max(0,rep-1); notice='🤝 Hubo empate. Nadie fue expulsado.'; }
  else {
    const id=winners[0]; players[id].alive=false; notice=`🚪 ${players[id].name} fue expulsado del grupo.`;
    if(id===secretTopoId){ phase='gameover'; result='✅ ¡Encontraron al Topo! Gana el grupo.'; }
    else { rep=Math.max(0,rep-1); notice+=' ❌ Era inocente.'; }
  }
  if(rep<=0 && phase!=='gameover'){ phase='gameover'; result='🐀 El Topo ganó: la reputación llegó a cero.'; }
  broadcastPhase({phase,reputation:rep,players,result,notice});
}

function sendChat(){
  const input=$('messageInput'); const text=input?.value.trim();
  if(!text || !chatAllowed()) return;
  input.value='';
  const m={id:crypto.randomUUID(),authorId:selfId,author:myName,text:text.slice(0,500),ts:Date.now(),round:game.round};
  addMessage(m); renderAll(); A.chat.send(m).catch(()=>toast('No se pudo enviar'));
}

$('createRoomBtn')?.addEventListener('click',enterTestRoom);
$('joinRoomBtn')?.addEventListener('click',enterTestRoom);
$('startGameBtn')?.addEventListener('click',startGame);
$('sendBtn')?.addEventListener('click',sendChat);
$('messageInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
$('groupInfoBtn')?.addEventListener('click',()=>$('infoPanel')?.classList.add('open'));
$('closeInfoBtn')?.addEventListener('click',()=>$('infoPanel')?.classList.remove('open'));
$('closeRoleBtn')?.addEventListener('click',()=>$('roleModal')?.classList.add('hidden'));
$('copyCodeBtn')?.addEventListener('click',()=>toast('En v0.4.0 no hay código: es una sala única.'));
$('leaveRoomBtn')?.addEventListener('click',()=>{clearInterval(heartbeat);try{room?.leave();}catch{}location.reload();});
updateVersion();