import { AVATARS } from './game-data.js?v=0.8.1';
import { makeIncognitoPersona } from './incognito-personas.js';
import { joinRoom as joinTransport, selfId } from './metered-trystero-adapter.js';

const VERSION = '0.8.1';
const APP_MARK = 'mattgames-social-whatsapp-v1';
const MAX_PLAYERS = 12;
const MIN_PLAYERS = 2;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => [...a].sort(() => Math.random() - .5);
const uid = () => crypto.randomUUID();
const now = () => Date.now();

const MODES = {
  topo: {name:'El Topo', emoji:'🐀', disabled:true, desc:'Capturas, traiciones y deducción. Próximamente.'},
  mixed: {name:'Todo mezclado', emoji:'🔀', desc:'Interpretá a otra persona del grupo y descubrí quién es quién.'},
  incognito: {name:'Incógnito', emoji:'🕶️', desc:'Convertite en un personaje nuevo con nombre, trabajo, foto y pasado.'},
  spyfall: {name:'Spyfall', emoji:'🕵️', desc:'Todos conocen el lugar menos el espía. Preguntá sin regalar la respuesta.'}
};

const TRIGGERS = [
  'Organizan un viaje juntos y hay que decidir destino, presupuesto y quién duerme con quién.',
  'Alguien del grupo ganó una suma importante de dinero y propone gastarla entre todos. ¿En qué?',
  'Les ofrecen participar en un reality. Solo pueden entrar tres personas del grupo. ¿Quiénes?',
  'Tienen que abrir un negocio juntos mañana. ¿Qué negocio sería y qué trabajo tendría cada uno?',
  'Apareció una foto comprometedora de una fiesta vieja. ¿Quién la subió y qué hacemos con ella?',
  'Van a quedar encerrados 48 horas en una casa sin internet. Solo pueden llevar cinco objetos.',
  'Una productora quiere hacer una película basada en el grupo. ¿Quién interpreta a quién y cuál sería el conflicto?',
  'Uno de ustedes tiene que ser elegido presidente del grupo por un año. Defiendan candidatos.',
  'Reciben una invitación a una mansión misteriosa para pasar el fin de semana. ¿Quién acepta y quién sospecha?',
  'Se enteran de que uno del grupo lleva una doble vida. Inventen teorías y defiendan la propia.'
];

const PERSONA_NAMES = ['Mabel Montenegro','Tony Falcón','Lola Centella','Rocco Palermo','Mirta Neblina','Kevin Champagne','Greta Salvatierra','Pipo Mancini','Nadia Tormenta','Beto Almirón','Cintia Cobalto','Renzo Deneuve','Yamila Fox','Hugo Diamante','Norma Glam','Lautaro Velvet','Patricia Eclipse','Marcelo Bombay','Silvina Royale','Fabián Tokio','Vicky Nevada','Ramón Ferrari','Débora Mónaco','Nico Babilonia','Mónica Safari','Leo Manhattan','Sandra Volcán','Tito Champagne','Gilda Marfil','Walter Miami'];
const OCCUPATIONS = ['conductora de TV local','cantante de cumbia','maquilladora funeraria','empleada municipal','mentalista de cruceros','representante de artistas','inspectora gastronómica','dueño de un karaoke','productora de reality shows','fotógrafo de casamientos','abogado de famosos','guía paranormal','chef de hotel cinco estrellas','cronista de espectáculos','DJ de fiestas de quince','tasador de antigüedades','entrenador personal de celebridades','agente de viajes de lujo','organizador de eventos','profesor de teatro','vendedor de autos importados','astróloga televisiva','encargado de boliche','restauradora de obras de arte'];
const DETAILS = [
  'dice que una vez cenó con una celebridad internacional, pero cambia la historia cada vez que la cuenta',
  'colecciona llaves de lugares en los que nunca vivió',
  'tiene tres teléfonos y asegura que cada uno es para una vida distinta',
  'no puede resistirse a corregir la pronunciación de los demás',
  'está convencido de que su mascota entiende conversaciones humanas',
  'fue campeón regional de algo que nunca especifica del todo',
  'lleva una libreta donde anota frases sospechosas que escucha',
  'jamás admite haberse perdido, incluso cuando claramente no sabe dónde está',
  'odia los audios de más de treinta segundos pero manda audios de siete minutos',
  'dice reconocer a una persona mentirosa por la forma en que sostiene una taza',
  'tiene una deuda absurda con un mago y evita explicar cómo ocurrió',
  'aparece en una publicidad vieja que nadie logra encontrar en internet',
  'se cambia de perfume según el estado de ánimo',
  'asegura haber rechazado una propuesta para entrar a un reality',
  'guarda tickets de todos los lugares importantes de su vida',
  'cree que cada grupo necesita un líder y naturalmente piensa que debería ser él o ella',
  'tiene un talento secreto para imitar voces por teléfono',
  'se niega a sentarse de espaldas a una puerta',
  'sabe demasiado sobre cámaras de seguridad',
  'cada vez que cuenta su edad da un número ligeramente diferente'
];

const SPY_LOCATIONS = [
  {name:'Aeropuerto', roles:['piloto','azafata','agente de migraciones','maletero','pasajero frecuente','controlador aéreo']},
  {name:'Hospital', roles:['cirujano','enfermera','paciente','camillero','recepcionista','visitante']},
  {name:'Casino', roles:['crupier','apostador','seguridad','cantante del bar','cajero','turista']},
  {name:'Crucero', roles:['capitán','bartender','turista','animador','chef','fotógrafo']},
  {name:'Escuela', roles:['directora','docente','alumno','preceptor','portero','madre de alumno']},
  {name:'Estación espacial', roles:['comandante','científica','ingeniero','médico','turista espacial','operador de misión']},
  {name:'Hotel de lujo', roles:['conserje','huésped','gerente','mucama','botones','chef']},
  {name:'Comisaría', roles:['comisario','detective','detenido','abogado','recepcionista','periodista']},
  {name:'Playa', roles:['guardavidas','turista','vendedor ambulante','surfista','fotógrafo','dueño de parador']},
  {name:'Teatro', roles:['actor','directora','maquilladora','acomodador','crítico','tramoyista']},
  {name:'Supermercado', roles:['cajera','repositor','gerente','cliente','seguridad','proveedor']},
  {name:'Museo', roles:['guía','turista','restauradora','seguridad','curador','estudiante']},
  {name:'Restaurante', roles:['chef','mozo','cliente','dueña','proveedor','crítico gastronómico']},
  {name:'Estadio', roles:['jugador','árbitro','hincha','periodista','seguridad','vendedor']},
  {name:'Embajada', roles:['embajador','diplomática','visitante','seguridad','traductor','periodista']},
  {name:'Circo', roles:['payaso','trapecista','domador','vendedor','director','espectador']}
];

const EMOJIS = ['😀','😂','😍','😎','🤔','😮','😡','😢','👍','👎','❤️','🔥','👏','🙏','💀','🐀'];
const REACTIONS = ['👍','❤️','😂','😮','😢','🙏'];

let transportRoom = null;
let socialAction = null;
let roomCode = '';
let isAdmin = false;
let joined = false;
let connectTimer = null;
let returnLobbyTimer = null;
let lastMixedIntroTrigger = '';
let myName = '';
let myAvatar = null;
let replyingTo = null;
let reactionTarget = null;
let selectedMode = 'mixed';
let privateInfo = null;
let personaOptions = null;
let transportPeers = new Set();
let state = freshState();

function freshState(){
  return {
    roomCode:'', adminId:null, mode:null, phase:'lobby', started:false,
    members:{}, lobbyMessages:[], messages:[], trigger:'', guesses:{}, scores:null,
    final:false, reveal:null, createdAt:now(), spyfall:{votes:{},result:null}
  };
}

function me(){ return state.members[selfId]; }
function onlineMembers(){ return Object.values(state.members).filter(m=>m.online!==false); }
function players(){ return Object.values(state.members).filter(m=>!m.spectator); }
function activePlayerIds(){ return Object.entries(state.members).filter(([,m])=>!m.spectator && m.online!==false).map(([id])=>id); }
function displayName(member){ return member?.publicName || member?.realName || 'Jugador'; }
function avatarData(id){ return AVATARS.find(a=>a.id===id); }
function avatarUrl(id){ return avatarData(id)?.file || ''; }
function toast(text){ const e=$('toast'); if(!e)return; e.textContent=text; e.classList.remove('hidden'); clearTimeout(toast.t); toast.t=setTimeout(()=>e.classList.add('hidden'),2300); }
function cleanCode(v){ return String(v||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4); }
function makeCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ'; return Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }

function avatarMarkup(member, cls='wa-avatar-img'){
  const avatar = member?.avatar;
  const url = avatarUrl(avatar);
  if(url) return `<img class="${cls}" src="${url}" alt="${esc(displayName(member))}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="wa-avatar-fallback" style="display:none">${esc(displayName(member).slice(0,1).toUpperCase())}</span>`;
  return `<span class="wa-avatar-fallback">${esc(displayName(member).slice(0,1).toUpperCase())}</span>`;
}

function setConnectStatus(){
  const e=$('connectionBadge'); if(!e)return;
  e.textContent=`v${VERSION}`;
  e.className='connection-badge';
}
function updateConnectionBadge(){ setConnectStatus(); }

async function connectToRoom(code, admin){
  roomCode=cleanCode(code); isAdmin=admin; joined=false; transportPeers.clear(); privateInfo=null; personaOptions=null;
  clearTimeout(connectTimer);
  try{ transportRoom?.leave?.(); }catch{}
  setConnectStatus('conectando…','wait');

  transportRoom=joinTransport({appId:'mattgames-eltopo-social-v07'}, roomCode, {
    onJoinError:({error})=>{
      console.error('[ElTopo/Metered]',error);
      setConnectStatus('error de conexión','error');
      toast('No se pudo conectar a Metered.');
    }
  });
  socialAction=transportRoom.makeAction('social7');
  socialAction.onMessage=(data,{peerId})=>handleEnvelope(peerId,data);
  transportRoom.onPeerJoin=peerId=>{
    transportPeers.add(peerId);
    sendIntro(peerId);
    updateConnectionBadge();
  };
  transportRoom.onPeerLeave=peerId=>{
    transportPeers.delete(peerId);
    if(state.members[peerId]) state.members[peerId].online=false;
    renderAll(); updateConnectionBadge();
  };

  joined=true;
  updateConnectionBadge();
  sendIntro();
  if(!isAdmin){
    connectTimer=setTimeout(()=>{
      if(!state.adminId){
        $('landingError').textContent='No encontré al administrador de esa sala.';
        toast('Sala no encontrada');
      }
    },6500);
  }
}

function envelope(type,payload={}){ return {__app:APP_MARK,room:roomCode,type,from:selfId,payload,ts:now()}; }
async function send(type,payload={},targetClientId=null){
  if(!socialAction) throw new Error('No conectado');
  return socialAction.send(envelope(type,payload), targetClientId ? {target:targetClientId} : undefined);
}
function sendIntro(targetPeerId=null){
  if(!socialAction)return;
  socialAction.send(envelope('intro',{clientId:selfId,name:myName,avatar:myAvatar,version:VERSION,admin:isAdmin}), targetPeerId?{target:targetPeerId}:undefined).catch(()=>{});
}

function handleEnvelope(peerId,data){
  if(!data||data.__app!==APP_MARK||data.room!==roomCode)return;
  const cid=data.from||peerId;
  switch(data.type){
    case 'intro': return onIntro(cid,data.payload);
    case 'snapshot': return onSnapshot(data.payload);
    case 'roster': return onRoster(data.payload);
    case 'lobby-chat': return onLobbyChat(data.payload,cid);
    case 'return-lobby': return onReturnLobby(data.payload);
    case 'chat': return onChat(data.payload,cid);
    case 'reaction': return onReaction(data.payload,cid);
    case 'mode': return onMode(data.payload);
    case 'start-mixed': return onStartMixed(data.payload);
    case 'mixed-private': return onMixedPrivate(data.payload);
    case 'guess': return onGuess(data.payload,cid);
    case 'mixed-final': return onMixedFinal(data.payload);
    case 'persona-options': return onPersonaOptions(data.payload);
    case 'persona-choice': return onPersonaChoice(data.payload,cid);
    case 'incognito-start': return onIncognitoStart(data.payload);
    case 'spy-private': return onSpyPrivate(data.payload);
    case 'spy-start': return onSpyStart(data.payload);
    case 'spy-vote': return onSpyVote(data.payload,cid);
    case 'spy-final': return onSpyFinal(data.payload);
    case 'spy-guess-location': return onSpyGuessLocation(data.payload,cid);
    case 'system': return addSystem(data.payload?.text||'');
  }
}

function onIntro(cid,p){
  if(!cid||cid===selfId)return;
  if(isAdmin){
    let m=state.members[cid];
    if(!m){
      const late=state.started || players().length>=MAX_PLAYERS;
      m=state.members[cid]={id:cid,realName:String(p?.name||'Jugador').slice(0,20),publicName:String(p?.name||'Jugador').slice(0,20),avatar:p?.avatar||null,lobbyAvatar:p?.avatar||null,online:true,spectator:late,joinedAt:now()};
      if(state.started) addSystem(state.mode==='incognito' ? 'Un participante entró tarde y quedó como espectador hasta la próxima partida.' : `${m.realName} entró tarde y quedó como espectador hasta la próxima partida.`);
      else if(late) addLobbySystem(`${m.realName} entró como espectador porque la sala ya tiene ${MAX_PLAYERS} jugadores.`);
      else addLobbySystem(`${m.realName} se unió a la sala.`);
    }else{
      m.online=true; m.realName=String(p?.name||m.realName).slice(0,20); if(!state.started)m.publicName=m.realName; if(p?.avatar&&!state.started){m.avatar=p.avatar;m.lobbyAvatar=p.avatar;} if(!state.started&&!m.lobbyAvatar)m.lobbyAvatar=m.avatar||null;
    }
    sendSnapshot(cid);
    broadcastRoster();
  }else{
    const existing=state.members[cid]; if(existing) existing.online=true;
  }
  renderAll(); updateConnectionBadge();
}
function snapshotForClient(){ const snap=clone(state); delete snap._spyId; delete snap._spyLocation; return snap; }
function sendSnapshot(cid){ send('snapshot',{state:snapshotForClient()},cid).catch(()=>{}); }
function onSnapshot(p){
  if(!p?.state)return;
  state=p.state; state.members[selfId] ||= {id:selfId,realName:myName,publicName:myName,avatar:myAvatar,online:true,spectator:state.started,joinedAt:now()};
  state.members[selfId].online=true;
  clearTimeout(connectTimer);
  state.started ? enterMessenger() : enterLobby();
  if(!state.started && !myAvatar) openAvatarPicker();
  renderAll();
}
function broadcastRoster(){
  if(!isAdmin)return;
  send('roster',{members:state.members,adminId:state.adminId,mode:state.mode,phase:state.phase,started:state.started}).catch(()=>{});
  renderAll();
}
function onRoster(p){
  if(!p?.members)return;
  const localMe=state.members[selfId];
  state.members=p.members; if(localMe&&state.members[selfId]) state.members[selfId].online=true;
  state.adminId=p.adminId; state.mode=p.mode; state.phase=p.phase; state.started=p.started;
  renderAll();
}

function createRoom(){
  myName=$('playerName')?.value.trim()||'';
  if(!myName){$('landingError').textContent='Poné tu nombre real.';return;}
  roomCode=makeCode();
  state=freshState(); state.roomCode=roomCode; state.adminId=selfId;
  state.members[selfId]={id:selfId,realName:myName,publicName:myName,avatar:myAvatar,lobbyAvatar:myAvatar,online:true,spectator:false,joinedAt:now()};
  selectedMode='mixed'; state.mode='mixed';
  $('landingError').textContent='Creando sala…';
  connectToRoom(roomCode,true).then(()=>{ enterLobby(); addLobbySystem(`Sala ${roomCode} creada. Compartí el código.`); openAvatarPicker(); renderAll(); }).catch(e=>{$('landingError').textContent=e.message;});
}
function joinRoom(){
  myName=$('playerName')?.value.trim()||''; const code=cleanCode($('joinCode')?.value);
  if(!myName){$('landingError').textContent='Poné tu nombre real.';return;}
  if(code.length!==4){$('landingError').textContent='El código tiene 4 letras.';return;}
  state=freshState(); state.roomCode=code;
  state.members[selfId]={id:selfId,realName:myName,publicName:myName,avatar:myAvatar,lobbyAvatar:myAvatar,online:true,spectator:false,joinedAt:now()};
  $('landingError').textContent='Buscando sala…';
  connectToRoom(code,false).then(()=>{ $('landingError').textContent='Esperando al administrador…'; }).catch(e=>{$('landingError').textContent=e.message;});
}
function enterLobby(){ $('landing')?.classList.remove('active'); $('messenger')?.classList.remove('active'); $('roomLobby')?.classList.add('active'); if($('landingError'))$('landingError').textContent=''; }
function enterMessenger(){ $('landing')?.classList.remove('active'); $('roomLobby')?.classList.remove('active'); $('messenger')?.classList.add('active'); if($('landingError'))$('landingError').textContent=''; }

function setMode(mode){
  if(!isAdmin||state.started||MODES[mode]?.disabled)return;
  selectedMode=mode; state.mode=mode; send('mode',{mode}).catch(()=>{}); renderAll();
}
function onMode(p){ if(state.started)return; if(MODES[p?.mode]&&!MODES[p.mode].disabled){state.mode=p.mode;selectedMode=p.mode;renderAll();} }

function startGame(){
  if(!isAdmin)return;
  const ids=activePlayerIds();
  if(ids.length<MIN_PLAYERS){toast('Se necesitan al menos 2 jugadores.');return;}
  const mode=state.mode||selectedMode;
  if(mode==='topo'){toast('El Topo todavía no está habilitado.');return;}
  if(mode==='mixed') startMixed(ids);
  if(mode==='incognito') startIncognito(ids);
  if(mode==='spyfall') startSpyfall(ids);
}

function derangement(ids){
  if(ids.length<2)return ids;
  for(let tries=0;tries<100;tries++){ const s=shuffle(ids); if(s.every((x,i)=>x!==ids[i]))return s; }
  return [...ids.slice(1),ids[0]];
}
function startMixed(ids){
  const assigned=derangement(ids);
  const identities=Object.fromEntries(ids.map(id=>[id,{
    name:state.members[id].realName,
    avatar:state.members[id].lobbyAvatar||state.members[id].avatar||null
  }]));
  state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.trigger=pick(TRIGGERS); state.messages=[]; replyingTo=null; lastMixedIntroTrigger=''; enterMessenger();
  ids.forEach((actorId,i)=>{
    const targetId=assigned[i]; const target=identities[targetId];
    state.members[actorId].publicName=target.name;
    state.members[actorId].avatar=target.avatar;
    state.members[actorId].spectator=false;
    const info={mode:'mixed',targetName:target.name,targetId,realName:state.members[actorId].realName};
    if(actorId===selfId) privateInfo=info;
    else send('mixed-private',info,actorId).catch(()=>{});
  });
  send('start-mixed',{publicState:snapshotForClient()}).catch(()=>{});
  addSystem('🔀 Todo mezclado comenzó. Cada persona recibió a quién debe interpretar.');
  addSystem(`💬 Disparador: ${state.trigger}`);
  renderAll();
  maybeShowMixedIntro();
}
function onStartMixed(p){ if(!p?.publicState)return; state=p.publicState; enterMessenger(); renderAll(); maybeShowMixedIntro(); }
function onMixedPrivate(p){ privateInfo=p; maybeShowMixedIntro(); }
function maybeShowMixedIntro(){
  if(state.mode!=='mixed'||!state.started||privateInfo?.mode!=='mixed'||!state.trigger||lastMixedIntroTrigger===state.trigger)return;
  lastMixedIntroTrigger=state.trigger;
  showModal('Todo mezclado',`<div class="mixed-start-modal"><span class="mixed-start-kicker">VAS A INTERPRETAR A</span><h2>${esc(privateInfo.targetName||'—')}</h2><div class="mixed-trigger-card"><span>DISPARADOR DE CONVERSACIÓN</span><strong>${esc(state.trigger)}</strong></div><button id="mixedStartClose" class="primary-btn">Empezar a chatear</button></div>`,()=>{$('mixedStartClose')?.addEventListener('click',closeGenericModal);});
}

function openGuess(targetId){
  if(state.mode!=='mixed'||!state.started||state.final||targetId===selfId)return;
  const target=state.members[targetId]; if(!target||target.spectator)return;
  const myGuess=state.guesses?.[selfId]?.[targetId]||'';
  const realNames=players().map(m=>m.realName).sort((a,b)=>a.localeCompare(b));
  showModal('¿Quién es en realidad?',`<div class="guess-target"><div class="profile-big">${avatarMarkup(target)}</div><strong>${esc(displayName(target))}</strong><span>Elegí quién pensás que está detrás de este usuario. Tu voto es público y podés cambiarlo.</span></div><div class="guess-list">${realNames.map(n=>`<button class="guess-option ${n===myGuess?'selected':''}" data-real="${esc(n)}">${esc(n)}</button>`).join('')}</div>`, modal=>{
    modal.querySelectorAll('.guess-option').forEach(b=>b.onclick=()=>castGuess(targetId,b.dataset.real));
  });
}
function castGuess(targetId,realName){
  state.guesses[selfId] ||= {}; state.guesses[selfId][targetId]=realName;
  send('guess',{targetId,realName}).catch(()=>{}); closeGenericModal(); renderAll();
}
function onGuess(p,cid){
  if(state.mode!=='mixed'||state.final||!p?.targetId||!state.members[p.targetId])return;
  state.guesses[cid] ||= {}; state.guesses[cid][p.targetId]=String(p.realName||''); renderAll();
}
function finalizeMixed(){
  if(!isAdmin||state.mode!=='mixed'||state.final)return;
  state.final=true; const scores={};
  players().forEach(m=>{scores[m.id]=0;});
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    for(const [targetId,guessName] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.spectator||voterId===targetId)continue;
      if(guessName===target.realName) scores[voterId]=(scores[voterId]||0)+1;
      else scores[targetId]=(scores[targetId]||0)+1;
    }
  }
  const reveal=Object.fromEntries(players().map(m=>[m.id,{shown:displayName(m),real:m.realName}]));
  state.scores=scores; state.reveal=reveal;
  const payload={scores,reveal,guesses:state.guesses};
  send('mixed-final',payload).catch(()=>{}); onMixedFinal(payload); addSystem('🏁 El administrador cerró la votación. Se revelaron las identidades.');
}
function onMixedFinal(p){ state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; if(p.guesses)state.guesses=p.guesses; renderAll(); showScoreboard(); if(isAdmin)scheduleReturnToLobby('Todo mezclado terminó.'); }
function showScoreboard(){
  const rows=players().sort((a,b)=>(state.scores?.[b.id]||0)-(state.scores?.[a.id]||0)).map(m=>`<div class="score-row"><div class="score-avatar">${avatarMarkup(m)}</div><div><strong>${esc(state.reveal?.[m.id]?.shown||displayName(m))}</strong><span>Era ${esc(state.reveal?.[m.id]?.real||m.realName)}</span></div><b>${state.scores?.[m.id]||0} pts</b></div>`).join('');
  showModal('Resultado · Todo mezclado',`<div class="score-list">${rows}</div><p class="modal-note">+1 por cada identidad acertada. +1 por cada voto equivocado que lograste provocar sobre tu usuario.</p>`);
}

function makePersona(avatar){
  return makeIncognitoPersona(avatar);
}
function startIncognito(ids){
  state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null; enterMessenger();
  // Incógnito must not retain lobby traces containing real names.
  state.messages=[{id:uid(),system:true,text:'🕶️ Modo Incógnito activado. El historial del lobby fue eliminado para proteger las identidades.',ts:now()}];
  replyingTo=null;
  const pool=shuffle(AVATARS).slice(0,Math.min(AVATARS.length,ids.length*2));
  ids.forEach((id,i)=>{
    const options=[makePersona(pool[i*2%pool.length]),makePersona(pool[(i*2+1)%pool.length])];
    state.members[id].publicName='Incógnito…'; state.members[id].persona=null; state.members[id].spectator=false;
    if(id===selfId) onPersonaOptions({options}); else send('persona-options',{options},id).catch(()=>{});
  });
  broadcastRoster();
  // Sync the clean Incognito history immediately, before anyone can see old lobby names.
  send('incognito-start',{state:snapshotForClient()}).catch(()=>{});
  renderAll();
}
function onPersonaOptions(p){ personaOptions=p?.options||[]; openPersonaPicker(); }
function openPersonaPicker(){
  if(!personaOptions?.length)return;
  const modal=$('characterSelectModal'); const grid=$('characterSelectGrid');
  $('characterSelectTitle').textContent='Elegí tu identidad de incógnito';
  $('characterSelectSub').textContent='La que elijas será tu nombre, foto y personalidad pública durante la partida.';
  grid.innerHTML=personaOptions.map((p,i)=>`<button class="persona-card" data-i="${i}"><div class="persona-photo"><img src="${avatarUrl(p.avatar)}" alt=""></div><strong>${esc(p.name)}</strong><span>${esc(p.occupation)}</span><small>${esc(p.detail)}</small></button>`).join('');
  grid.querySelectorAll('.persona-card').forEach(b=>b.onclick=()=>choosePersona(Number(b.dataset.i)));
  modal.classList.remove('hidden');
}
function choosePersona(i){
  const persona=personaOptions?.[i]; if(!persona)return;
  $('characterSelectModal').classList.add('hidden'); personaOptions=null;
  if(isAdmin) onPersonaChoice({persona},selfId); else send('persona-choice',{persona}).catch(()=>toast('No pude enviar la selección'));
}
function onPersonaChoice(p,cid){
  if(!isAdmin||state.mode!=='incognito'||state.phase!=='persona-select'||!p?.persona||!state.members[cid])return;
  const persona=p.persona; state.members[cid].persona=persona; state.members[cid].publicName=persona.name; state.members[cid].avatar=persona.avatar; state.members[cid].occupation=persona.occupation; state.members[cid].detail=persona.detail;
  broadcastRoster();
  if(players().every(m=>m.persona)){
    state.phase='playing'; state.trigger=pick(TRIGGERS);
    addSystem(`🕶️ Todos tienen identidad. Disparador: ${state.trigger}`);
    const payload={state:snapshotForClient()}; send('incognito-start',payload).catch(()=>{}); renderAll();
  }
}
function onIncognitoStart(p){ if(p?.state)state=p.state; if(state.started)enterMessenger(); renderAll(); if(state.final)showIncognitoReveal(); }
function revealIncognito(){
  if(!isAdmin||state.mode!=='incognito'||state.final)return;
  state.final=true; state.phase='finished'; state.reveal=Object.fromEntries(players().map(m=>[m.id,{persona:displayName(m),real:m.realName}]));
  const payload={state:snapshotForClient()}; send('incognito-start',payload).catch(()=>{}); showIncognitoReveal(); renderAll(); scheduleReturnToLobby('Incógnito terminó.');
}
function showIncognitoReveal(){
  const rows=players().map(m=>`<div class="score-row"><div class="score-avatar">${avatarMarkup(m)}</div><div><strong>${esc(displayName(m))}</strong><span>Era ${esc(m.realName)}</span></div></div>`).join('');
  showModal('Se levantó el incógnito',`<div class="score-list">${rows}</div>`);
}

function startSpyfall(ids){
  state.started=true; state.phase='playing'; state.mode='spyfall'; state.final=false; state.spyfall={votes:{},result:null}; state.trigger='Hagan preguntas de a uno. Todos conocen el lugar excepto el espía. No sean demasiado obvios.'; state.messages=[]; replyingTo=null; enterMessenger();
  const location=pick(SPY_LOCATIONS); const spyId=pick(ids); const roles=shuffle(location.roles);
  ids.forEach((id,i)=>{
    const info=id===spyId?{mode:'spyfall',isSpy:true}:{mode:'spyfall',isSpy:false,location:location.name,role:roles[i%roles.length]};
    if(id===selfId){privateInfo=info;showPrivateCard();} else send('spy-private',info,id).catch(()=>{});
    state.members[id].publicName=state.members[id].realName; state.members[id].spectator=false;
  });
  state._spyId=spyId; state._spyLocation=location.name;
  addSystem('🕵️ Spyfall comenzó. Hagan preguntas sin decir el lugar.');
  const publicState=snapshotForClient();
  send('spy-start',{state:publicState}).catch(()=>{}); renderAll();
}
function onSpyPrivate(p){ privateInfo=p; showPrivateCard(); }
function onSpyStart(p){ if(p?.state)state=p.state; enterMessenger(); renderAll(); }
function castSpyVote(targetId){
  if(state.mode!=='spyfall'||state.final||targetId===selfId)return;
  state.spyfall.votes[selfId]=targetId; send('spy-vote',{targetId}).catch(()=>{}); renderAll();
}
function onSpyVote(p,cid){ if(state.mode!=='spyfall'||state.final||!p?.targetId)return; state.spyfall.votes[cid]=p.targetId; renderAll(); }
function finalizeSpyfall(){
  if(!isAdmin||state.mode!=='spyfall'||state.final)return;
  const counts={}; Object.values(state.spyfall.votes||{}).forEach(id=>counts[id]=(counts[id]||0)+1);
  const max=Math.max(0,...Object.values(counts)); const top=Object.keys(counts).filter(id=>counts[id]===max);
  const accused=top.length===1?top[0]:null; const spy=state._spyId;
  const crewWins=accused===spy;
  const result=accused?`${displayName(state.members[accused])} fue el más votado. ${crewWins?'¡Era el espía! Gana el grupo.':'No era el espía. Gana el espía.'}`:'Hubo empate. Gana el espía.';
  state.final=true; state.phase='finished'; state.spyfall.result=result;
  const payload={result,spyId:spy,spyName:state.members[spy]?.realName||'?',location:state._spyLocation||'?',votes:state.spyfall.votes};
  send('spy-final',payload).catch(()=>{}); onSpyFinal(payload);
}
function onSpyFinal(p){ state.final=true; state.phase='finished'; state.spyfall.result=p.result; state.spyfall.spyId=p.spyId; state.spyfall.spyName=p.spyName; state.spyfall.location=p.location; if(p.votes)state.spyfall.votes=p.votes; renderAll(); showModal('Resultado · Spyfall',`<div class="spy-result"><strong>${esc(p.result)}</strong><span>Espía: ${esc(p.spyName)}</span><span>Lugar: ${esc(p.location)}</span><small>Volviendo al lobby en unos segundos…</small></div>`); if(isAdmin)scheduleReturnToLobby(`Spyfall: ${p.result}`); }
function guessSpyLocation(){
  if(privateInfo?.mode!=='spyfall'||!privateInfo.isSpy||state.final)return;
  showModal('Adivinar ubicación',`<p class="modal-note">Si acertás, ganás inmediatamente. Si fallás, gana el grupo.</p><div class="guess-list">${SPY_LOCATIONS.map(l=>`<button class="guess-option" data-loc="${esc(l.name)}">${esc(l.name)}</button>`).join('')}</div>`,modal=>modal.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{const payload={location:b.dataset.loc}; if(isAdmin)onSpyGuessLocation(payload,selfId); else send('spy-guess-location',payload).catch(()=>{}); closeGenericModal();}));
}
function onSpyGuessLocation(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||cid!==state._spyId)return;
  const correct=p?.location===state._spyLocation;
  state.final=true; const result=correct?`El espía adivinó “${state._spyLocation}”. Gana el espía.`:`El espía falló: dijo “${p?.location}”. El lugar era “${state._spyLocation}”. Gana el grupo.`;
  onSpyFinal({result,spyId:state._spyId,spyName:state.members[state._spyId]?.realName||'?',location:state._spyLocation,votes:state.spyfall.votes});
  send('spy-final',{result,spyId:state._spyId,spyName:state.members[state._spyId]?.realName||'?',location:state._spyLocation,votes:state.spyfall.votes}).catch(()=>{});
}

function addLobbySystem(text){
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
  privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger=''; selectedMode=state.mode||selectedMode;
  const payload={state:snapshotForClient()};
  send('return-lobby',payload).catch(()=>{});
  onReturnLobby(payload);
}
function onReturnLobby(p){
  if(!p?.state)return;
  state=p.state; selectedMode=state.mode||selectedMode; privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger='';
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

function addSystem(text){
  if(!text)return;
  const msg={id:uid(),system:true,text,ts:now()};
  if(!state.messages.some(m=>m.id===msg.id))state.messages.push(msg);
  if(isAdmin&&joined) send('system',{text}).catch(()=>{});
  renderMessages();
}
function onChat(msg,cid){
  if(!msg?.id||state.messages.some(m=>m.id===msg.id))return;
  const sender=state.members[cid]; msg.senderId=cid; msg.senderName=msg.senderName||displayName(sender); state.messages.push(msg); state.messages.sort((a,b)=>a.ts-b.ts); renderMessages();
}
function sendChat(){
  const input=$('messageInput'); const text=input?.value.trim(); if(!text)return;
  input.value=''; const msg={id:uid(),senderId:selfId,senderName:displayName(me()),text:text.slice(0,1000),ts:now(),replyTo:replyingTo?{id:replyingTo.id,senderName:replyingTo.senderName,text:replyingTo.text.slice(0,120)}:null,reactions:{}};
  state.messages.push(msg); replyingTo=null; renderComposerReply(); renderMessages(); send('chat',msg).catch(()=>toast('No se pudo enviar'));
}
function setReply(msg){ replyingTo=msg; renderComposerReply(); $('messageInput')?.focus(); }
function renderComposerReply(){
  const b=$('replyPreview'); if(!b)return;
  if(!replyingTo){b.classList.add('hidden');b.innerHTML='';return;}
  b.innerHTML=`<div><strong>${esc(replyingTo.senderName)}</strong><span>${esc(replyingTo.text)}</span></div><button id="cancelReply">×</button>`; b.classList.remove('hidden'); $('cancelReply').onclick=()=>{replyingTo=null;renderComposerReply();};
}
function toggleReaction(messageId,emoji){
  const msg=state.messages.find(m=>m.id===messageId); if(!msg)return;
  msg.reactions ||= {}; msg.reactions[emoji] ||= [];
  const arr=msg.reactions[emoji]; const i=arr.indexOf(selfId); if(i>=0)arr.splice(i,1);else arr.push(selfId); if(!arr.length)delete msg.reactions[emoji];
  send('reaction',{messageId,emoji}).catch(()=>{}); renderMessages(); closeReactionPicker();
}
function onReaction(p,cid){
  const msg=state.messages.find(m=>m.id===p?.messageId); if(!msg||!p?.emoji)return;
  msg.reactions ||= {}; msg.reactions[p.emoji] ||= []; const arr=msg.reactions[p.emoji]; const i=arr.indexOf(cid); if(i>=0)arr.splice(i,1);else arr.push(cid); if(!arr.length)delete msg.reactions[p.emoji]; renderMessages();
}

function renderAll(){ renderRoomLobby(); renderHeader(); renderMembers(); renderMessages(); renderLobby(); renderGameBar(); renderSelfProfile(); updateConnectionBadge(); }
function renderHeader(){
  const title=state.started?modeGroupName():`Sala ${roomCode||'----'}`;
  ['groupName','sidebarGroupName','infoGroupName'].forEach(id=>{if($(id))$(id).textContent=title;});
  if($('groupSubtitle')) $('groupSubtitle').textContent=`${onlineMembers().length||1} participante${onlineMembers().length===1?'':'s'}${state.started?` · ${MODES[state.mode]?.name||''}`:''}`;
  if($('roomCodeDisplay')) $('roomCodeDisplay').textContent=roomCode||'----';
  if($('infoCount')) $('infoCount').textContent=`${onlineMembers().length||1} participantes`;
}
function modeGroupName(){ return ({mixed:'Todo mezclado 🔀',incognito:'Incógnito 🕶️',spyfall:'Spyfall 🕵️',topo:'El Topo 🐀'})[state.mode]||'El Topo'; }
function renderSelfProfile(){
  const m=me()||{realName:myName,publicName:myName,avatar:myAvatar}; const box=$('meAvatar'); if(box)box.innerHTML=avatarMarkup(m,'profile-avatar-img');
  if($('meName'))$('meName').textContent=displayName(m);
}
function renderMembers(){
  const box=$('participants'); if(!box)return; box.innerHTML='';
  Object.entries(state.members).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)).forEach(([id,m])=>{
    const d=document.createElement('button'); d.className='participant social-participant';
    const status=m.spectator?'espectador':m.online===false?'desconectado':state.mode==='incognito'&&m.persona?m.occupation:'en línea';
    d.innerHTML=`<div class="participant-avatar">${avatarMarkup(m)}</div><div class="participant-copy"><strong>${esc(displayName(m))}${id===selfId?' (vos)':''}</strong><span>${esc(status)}</span>${renderPublicVoteSummary(id)}</div>${id===state.adminId?'<span class="host-badge">ADMIN</span>':''}`;
    d.onclick=()=>onMemberClick(id); box.appendChild(d);
  });
}
function renderPublicVoteSummary(targetId){
  if(state.mode==='mixed'&&state.started){
    const entries=Object.entries(state.guesses||{}).filter(([v])=>v!==targetId).map(([v,b])=>b?.[targetId]?[state.members[v]?.publicName||state.members[v]?.realName,b[targetId]]:null).filter(Boolean);
    if(entries.length) return `<small class="public-votes">${entries.map(([v,g])=>`${esc(v)} → ${esc(g)}`).join(' · ')}</small>`;
  }
  if(state.mode==='spyfall'&&state.started){
    const names=Object.entries(state.spyfall?.votes||{}).filter(([,t])=>t===targetId).map(([v])=>state.members[v]?.publicName||state.members[v]?.realName).filter(Boolean);
    if(names.length)return `<small class="public-votes">Sospechan: ${names.map(esc).join(', ')}</small>`;
  }
  return '';
}
function onMemberClick(id){
  if(id===selfId){showPrivateCard();return;}
  if(state.mode==='mixed'&&state.started&&!state.final){openGuess(id);return;}
  if(state.mode==='spyfall'&&state.started&&!state.final){castSpyVote(id);toast(`Ahora sospechás de ${displayName(state.members[id])}`);return;}
  showPublicProfile(id);
}
function showPublicProfile(id){ const m=state.members[id]; if(!m)return; showModal(displayName(m),`<div class="public-profile-card"><div class="profile-big">${avatarMarkup(m)}</div>${m.occupation?`<strong>${esc(m.occupation)}</strong>`:''}${m.detail?`<p>${esc(m.detail)}</p>`:''}<span>${m.online===false?'desconectado':'en línea'}</span></div>`); }
function renderLobby(){
  const box=$('lobbyControls'); if(!box)return;
  if(state.started){box.classList.add('hidden');return;} box.classList.remove('hidden');
  if(isAdmin){
    box.innerHTML=`<div class="lobby-head"><div><span class="section-kicker">CÓDIGO DE SALA</span><strong class="big-room-code">${esc(roomCode)}</strong></div><button id="copyRoomCode" class="ghost-btn">Copiar</button></div><h3>Elegí el modo de juego</h3><div class="mode-grid">${Object.entries(MODES).map(([k,m])=>`<button class="mode-card ${state.mode===k?'selected':''} ${m.disabled?'disabled':''}" data-mode="${k}" ${m.disabled?'disabled':''}><span>${m.emoji}</span><strong>${esc(m.name)}</strong><small>${esc(m.desc)}</small>${m.disabled?'<em>PRÓXIMAMENTE</em>':''}</button>`).join('')}</div><button id="startModeBtn" class="primary-btn">Iniciar ${esc(MODES[state.mode]?.name||'partida')} (${activePlayerIds().length})</button>`;
    box.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode)); $('copyRoomCode').onclick=()=>navigator.clipboard?.writeText(roomCode).then(()=>toast('Código copiado')); $('startModeBtn').onclick=startGame;
  }else{
    box.innerHTML=`<div class="waiting-lobby"><strong>Sala ${esc(roomCode)}</strong><span>El administrador está preparando la partida.</span><b>${MODES[state.mode]?.emoji||'🎮'} ${esc(MODES[state.mode]?.name||'Esperando modo')}</b></div>`;
  }
}
function renderGameBar(){
  const b=$('gameBanner'); if(!b)return;
  if(!state.started){b.classList.add('hidden');return;} b.classList.remove('hidden');
  let html=`<div class="game-phase"><strong>${MODES[state.mode]?.emoji||'🎮'} ${esc(MODES[state.mode]?.name||'Juego')}</strong><span>${esc(state.trigger||phaseText())}</span></div><button id="myCharacterBtn" class="banner-btn subtle">Mi personaje</button>`;
  if(state.mode==='mixed'&&!state.final) html+=`<div class="game-help">Tocá el nombre de otro usuario para votar quién creés que es. La votación es pública y se puede cambiar.</div>`;
  if(state.mode==='mixed'&&isAdmin&&!state.final) html+=`<button id="finalMixedBtn" class="banner-btn">Votación final</button>`;
  if(state.mode==='mixed'&&state.final) html+=`<button id="showScoresBtn" class="banner-btn">Ver resultado</button>`;
  if(state.mode==='incognito'&&isAdmin&&!state.final&&state.phase==='playing') html+=`<button id="revealIncognitoBtn" class="banner-btn">Revelar identidades</button>`;
  if(state.mode==='incognito'&&state.final) html+=`<button id="showIncognitoBtn" class="banner-btn">Ver identidades</button>`;
  if(state.mode==='spyfall'&&!state.final) html+=`<div class="game-help">Tocá un nombre para marcarlo como sospechoso. Podés cambiar tu voto.</div>`;
  if(state.mode==='spyfall'&&privateInfo?.isSpy&&!state.final) html+=`<button id="spyGuessBtn" class="banner-btn">Adivinar lugar</button>`;
  if(state.mode==='spyfall'&&isAdmin&&!state.final) html+=`<button id="finalSpyBtn" class="banner-btn">Votación final</button>`;
  b.innerHTML=html;
  $('myCharacterBtn')?.addEventListener('click',showPrivateCard); $('finalMixedBtn')?.addEventListener('click',finalizeMixed); $('showScoresBtn')?.addEventListener('click',showScoreboard); $('revealIncognitoBtn')?.addEventListener('click',revealIncognito); $('showIncognitoBtn')?.addEventListener('click',showIncognitoReveal); $('spyGuessBtn')?.addEventListener('click',guessSpyLocation); $('finalSpyBtn')?.addEventListener('click',finalizeSpyfall);
}
function phaseText(){ if(state.mode==='incognito'&&state.phase==='persona-select')return 'Todos están eligiendo su identidad…'; if(state.final)return 'Partida terminada'; return 'Conversación en curso'; }

function renderMessages(){
  const box=$('messages'); if(!box)return;
  box.innerHTML='<div class="day-chip">HOY</div>';
  for(const m of state.messages){
    if(m.system){box.insertAdjacentHTML('beforeend',`<div class="system-chip">${esc(m.text)}</div>`);continue;}
    const mine=m.senderId===selfId; const member=state.members[m.senderId]||{publicName:m.senderName,realName:m.senderName};
    const reply=m.replyTo?`<div class="quoted-reply"><strong>${esc(m.replyTo.senderName)}</strong><span>${esc(m.replyTo.text)}</span></div>`:'';
    const reactions=Object.entries(m.reactions||{}).filter(([,ids])=>ids?.length).map(([e,ids])=>`<button class="reaction-chip ${ids.includes(selfId)?'mine-reaction':''}" data-msg="${m.id}" data-emoji="${e}">${e} ${ids.length}</button>`).join('');
    box.insertAdjacentHTML('beforeend',`<div class="message-row ${mine?'mine':''}" data-message-id="${m.id}">${mine?'':`<button class="message-avatar" data-profile="${m.senderId}">${avatarMarkup(member)}</button>`}<article class="bubble"><button class="sender-name" data-profile="${m.senderId}">${mine?'Vos':esc(m.senderName||displayName(member))}</button>${reply}<span class="message-text">${esc(m.text)}</span><span class="bubble-meta">${new Date(m.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}${mine?' <span class="ticks">✓✓</span>':''}</span><div class="message-tools"><button data-reply="${m.id}" title="Responder">↩</button><button data-react="${m.id}" title="Reaccionar">☺</button></div>${reactions?`<div class="reaction-row">${reactions}</div>`:''}</article></div>`);
  }
  box.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>{const m=state.messages.find(x=>x.id===b.dataset.reply);if(m)setReply(m);});
  box.querySelectorAll('[data-react]').forEach(b=>b.onclick=e=>openReactionPicker(b.dataset.react,e.currentTarget));
  box.querySelectorAll('.reaction-chip').forEach(b=>b.onclick=()=>toggleReaction(b.dataset.msg,b.dataset.emoji));
  box.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>onMemberClick(b.dataset.profile));
  box.scrollTop=box.scrollHeight;
}

function openReactionPicker(messageId,anchor){
  reactionTarget=messageId; const p=$('reactionPicker'); p.innerHTML=REACTIONS.map(e=>`<button data-r="${e}">${e}</button>`).join('');
  const r=anchor.getBoundingClientRect(); p.style.left=`${Math.max(8,Math.min(innerWidth-260,r.left-120))}px`; p.style.top=`${Math.max(8,r.top-52)}px`; p.classList.remove('hidden'); p.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>toggleReaction(messageId,b.dataset.r));
}
function closeReactionPicker(){ $('reactionPicker')?.classList.add('hidden'); reactionTarget=null; }
function toggleEmojiPicker(){ $('emojiPicker')?.classList.toggle('hidden'); }
function buildEmojiPicker(){ const p=$('emojiPicker'); if(!p)return; p.innerHTML=EMOJIS.map(e=>`<button data-e="${e}">${e}</button>`).join(''); p.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{const input=$('messageInput');input.value+=b.dataset.e;input.focus();}); }

function openAvatarPicker(){
  if(state.started)return;
  const modal=$('characterSelectModal'),grid=$('characterSelectGrid'); if(!modal||!grid)return;
  $('characterSelectTitle').textContent='Elegí tu foto de perfil'; $('characterSelectSub').textContent='Es pública y va a aparecer como en WhatsApp. Después puede cambiar según el modo de juego.';
  grid.innerHTML=AVATARS.map(a=>`<button class="avatar-select-card ${myAvatar===a.id?'selected':''}" data-avatar="${a.id}"><img src="${a.file}" alt="${esc(a.name)}"><span>${esc(a.name)}</span></button>`).join('');
  grid.querySelectorAll('[data-avatar]').forEach(b=>b.onclick=()=>chooseLobbyAvatar(b.dataset.avatar)); modal.classList.remove('hidden');
}
function chooseLobbyAvatar(id){
  myAvatar=id; if(state.members[selfId]){state.members[selfId].avatar=id;state.members[selfId].lobbyAvatar=id;} $('characterSelectModal').classList.add('hidden'); renderAll();
  if(joined){ sendIntro(); if(isAdmin)broadcastRoster(); }
}

function showPrivateCard(){
  const m=me(); if(!m)return;
  if(!state.started){
    showModal('Tu perfil',`<div class="private-character"><div class="profile-big">${avatarMarkup(m)}</div><strong>${esc(m.realName)}</strong><span>Este es tu nombre real en el lobby.</span><button id="changeAvatarBtn" class="ghost-btn">Cambiar foto</button></div>`,modal=>{$('changeAvatarBtn').onclick=()=>{closeGenericModal();openAvatarPicker();};}); return;
  }
  if(state.mode==='mixed'){
    showModal('Tu papel secreto',`<div class="private-character"><div class="secret-emoji">🔀</div><span>Vos sos realmente</span><strong>${esc(privateInfo?.realName||m.realName)}</strong><span>Durante esta partida tenés que interpretar a</span><h2>${esc(privateInfo?.targetName||displayName(m))}</h2><p>Escribí, opiná y reaccioná como pensás que lo haría esa persona. El resto intenta descubrir quién está detrás.</p></div>`); return;
  }
  if(state.mode==='incognito'){
    const p=m.persona; if(!p){toast('Todavía estás eligiendo personaje.');return;}
    showModal('Tu identidad de incógnito',`<div class="private-character"><div class="profile-big">${avatarMarkup(m)}</div><h2>${esc(p.name)}</h2><strong>${esc(p.occupation)}</strong><p>${esc(p.detail)}</p><small>Tu nombre real: ${esc(m.realName)}</small></div>`); return;
  }
  if(state.mode==='spyfall'){
    const html=privateInfo?.isSpy?`<div class="private-character spy"><div class="secret-emoji">🕵️</div><h2>SOS EL ESPÍA</h2><p>No conocés el lugar. Hacé preguntas, mezclate y tratá de deducirlo.</p><button id="spyGuessInside" class="primary-btn">Adivinar ubicación</button></div>`:`<div class="private-character"><div class="secret-emoji">📍</div><span>Ubicación</span><h2>${esc(privateInfo?.location||'—')}</h2><span>Tu rol</span><strong>${esc(privateInfo?.role||'—')}</strong><p>Respondé sin decir el lugar de forma demasiado obvia.</p></div>`;
    showModal('Tu información secreta',html,()=>{$('spyGuessInside')?.addEventListener('click',()=>{closeGenericModal();guessSpyLocation();});});
  }
}

function showModal(title,html,after){ const m=$('genericModal'); $('genericModalTitle').textContent=title; $('genericModalBody').innerHTML=html; m.classList.remove('hidden'); after?.(m); }
function closeGenericModal(){ $('genericModal')?.classList.add('hidden'); }
function leaveRoom(){ try{transportRoom?.leave?.();}catch{} location.reload(); }

$('createRoomBtn')?.addEventListener('click',createRoom);
$('joinRoomBtn')?.addEventListener('click',joinRoom);
$('joinCode')?.addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('lobbyChatSend')?.addEventListener('click',sendLobbyChat);
$('lobbyChatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendLobbyChat();}});
$('lobbyCopyCode')?.addEventListener('click',()=>navigator.clipboard?.writeText(roomCode).then(()=>toast('Código copiado')));
$('lobbyStartBtn')?.addEventListener('click',startGame);
$('lobbyChangeAvatarBtn')?.addEventListener('click',openAvatarPicker);
$('lobbyLeaveBtn')?.addEventListener('click',leaveRoom);
$('sendBtn')?.addEventListener('click',sendChat);
$('messageInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}});
$('emojiBtn')?.addEventListener('click',toggleEmojiPicker);
$('groupInfoBtn')?.addEventListener('click',()=>$('infoPanel')?.classList.add('open'));
$('closeInfoBtn')?.addEventListener('click',()=>$('infoPanel')?.classList.remove('open'));
$('leaveRoomBtn')?.addEventListener('click',leaveRoom);
$('editAvatarBtn')?.addEventListener('click',openAvatarPicker);
$('meProfileBtn')?.addEventListener('click',showPrivateCard);
$('closeGenericModal')?.addEventListener('click',closeGenericModal);
$('genericModal')?.addEventListener('click',e=>{if(e.target.id==='genericModal')closeGenericModal();});
document.addEventListener('click',e=>{ if(reactionTarget&&!e.target.closest('#reactionPicker')&&!e.target.closest('[data-react]'))closeReactionPicker(); });
buildEmojiPicker(); renderComposerReply(); renderAll();