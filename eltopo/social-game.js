import { AVATARS } from './game-data.js?v=0.10.5';
import { makeIncognitoPersona } from './incognito-personas.js';
import { joinRoom as joinTransport, selfId } from './metered-trystero-adapter.js';

const VERSION = '0.10.5';
const SUPERADMIN_PROOF = 'f52acce5d5e525dc7e108db0f97651448ec60c0e773863cf2ead2f5aa337bf6c';
const APP_MARK = 'mattgames-social-whatsapp-v1';
const MAX_PLAYERS = 12;
const MIN_PLAYERS = 2;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => {
  const out=[...a];
  for(let i=out.length-1;i>0;i--){
    const r=new Uint32Array(1); crypto.getRandomValues(r); const j=r[0]%(i+1);
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
};
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
  '{player} ganó una suma importante de dinero y propone gastarla entre todos. ¿En qué?',
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
let mixedFinalizeTimer = null;
let mixedCountdownTicker = null;
let spyFinalizeTimer = null;
let spyCountdownTicker = null;
let incognitoFinalizeTimer = null;
let incognitoCountdownTicker = null;
const peerLeaveTimers = new Map();
let lastMixedIntroTrigger = '';
let myName = '';
let myAvatar = null;
let replyingTo = null;
let reactionTarget = null;
let selectedMode = 'mixed';
let privateInfo = null;
let personaOptions = null;
let transportPeers = new Set();
let superadminPeers = new Set();
let state = freshState();

function freshState(){
  return {
    roomCode:'', adminId:null, mode:null, phase:'lobby', started:false,
    members:{}, lobbyMessages:[], messages:[], chatSeq:0, trigger:'', guesses:{}, scores:null,
    final:false, reveal:null, createdAt:now(), roomLocked:false, chatDisabled:false, pinnedMessageId:null, adminForcedSpyId:null, adminForcedTrigger:null, mixedPreviousTargets:{}, mixedVoting:{closing:false,deadline:0,reason:''}, incognitoVoting:{votes:{},closing:false,deadline:0,reason:''}, spyfall:{votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0,locationWindow:false,spyGuessSubmitted:false,spyLocationGuess:null,spyLocationCorrect:false}
  };
}

function me(){ return state.members[selfId]; }
function onlineMembers(){ return Object.values(state.members).filter(m=>m.online!==false); }
function players(){ return Object.values(state.members).filter(m=>!m.spectator && m.online!==false); }
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
    clearTimeout(peerLeaveTimers.get(peerId)); peerLeaveTimers.delete(peerId);
    if(state.members[peerId]) state.members[peerId].online=true;
    sendIntro(peerId);
    renderAll(); updateConnectionBadge();
  };
  transportRoom.onPeerLeave=peerId=>{
    transportPeers.delete(peerId);
    superadminPeers.delete(peerId);
    // Browsers (especially mobile) can briefly drop WebRTC when backgrounded.
    // Keep the player visible for one minute and cancel this removal if they reconnect.
    clearTimeout(peerLeaveTimers.get(peerId));
    peerLeaveTimers.set(peerId,setTimeout(()=>{
      peerLeaveTimers.delete(peerId);
      if(state.members[peerId]){
        state.members[peerId].online=false;
        if(isAdmin&&!state.started) delete state.members[peerId];
        if(isAdmin) broadcastRoster();
      }
      renderAll(); updateConnectionBadge();
    },60000));
    updateConnectionBadge();
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
    case 'return-lobby-request': return onReturnLobbyRequest(data.payload,cid);
    case 'chat': return onChat(data.payload,cid);
    case 'chat-submit': return onChatSubmit(data.payload,cid);
    case 'reaction': return onReaction(data.payload,cid);
    case 'mode': return onMode(data.payload);
    case 'start-mixed': return onStartMixed(data.payload);
    case 'mixed-private': return onMixedPrivate(data.payload);
    case 'guess': return onGuess(data.payload,cid);
    case 'mixed-countdown': return onMixedCountdown(data.payload);
    case 'mixed-final': return onMixedFinal(data.payload);
    case 'persona-options': return onPersonaOptions(data.payload);
    case 'persona-choice': return onPersonaChoice(data.payload,cid);
    case 'incognito-start': return onIncognitoStart(data.payload);
    case 'incognito-guess': return onIncognitoGuess(data.payload,cid);
    case 'incognito-countdown': return onIncognitoCountdown(data.payload);
    case 'incognito-final': return onIncognitoFinal(data.payload);
    case 'spy-private': return onSpyPrivate(data.payload);
    case 'spy-start': return onSpyStart(data.payload);
    case 'spy-vote': return onSpyVote(data.payload,cid);
    case 'spy-question': return onSpyQuestion(data.payload,cid);
    case 'spy-turn': return onSpyTurn(data.payload);
    case 'spy-voting': return onSpyVoting(data.payload);
    case 'spy-location-window': return onSpyLocationWindow(data.payload);
    case 'spy-location-ack': return onSpyLocationAck(data.payload);
    case 'admin-kick': return onAdminKick(data.payload,cid);
    case 'spy-final': return onSpyFinal(data.payload);
    case 'spy-guess-location': return onSpyGuessLocation(data.payload,cid);
    case 'superadmin-hello': return onSuperadminHello(data.payload,cid);
    case 'superadmin-command': return onSuperadminCommand(data.payload,cid);
    case 'system': return onSystem(data.payload,cid);
  }
}

function quickStateHash(value){
  const text=JSON.stringify(value); let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}
function superadminSnapshot(){
  const mine=me();
  return {
    clientId:selfId,room:roomCode,name:myName,publicName:displayName(mine),avatar:mine?.avatar||myAvatar,
    isAdmin,version:VERSION,mode:state.mode,phase:state.phase,started:state.started,createdAt:state.createdAt,
    stateHash:quickStateHash(snapshotForClient()),
    flags:{muted:!!mine?.muted,voteBlocked:!!mine?.voteBlocked,spectator:!!mine?.spectator},
    privateInfo:privateInfo?clone(privateInfo):null,
    canonical:isAdmin?{state:clone(state)}:null,ts:now()
  };
}
function sendSuperadminState(targetId){
  if(!joined||!socialAction||!targetId)return;
  send('superadmin-state',superadminSnapshot(),targetId).catch(()=>{});
}
function onSuperadminHello(p,cid){
  if(!p||p.proof!==SUPERADMIN_PROOF||!cid)return;
  superadminPeers.add(cid);
  sendSuperadminState(cid);
}
function broadcastFullState(){
  if(!isAdmin)return;
  send('snapshot',{state:snapshotForClient()}).catch(()=>{});
  renderAll();
  for(const id of superadminPeers)sendSuperadminState(id);
}
function canonicalPlayerCommand(p){
  if(!isAdmin||!p?.targetId)return false;
  const m=state.members[p.targetId];
  if(!m&& !['kick','ban'].includes(p.command))return false;
  switch(p.command){
    case 'rename': {
      const next=String(p.value||'').trim().slice(0,20); if(!next)return true;
      m.realName=next; if(!state.started)m.publicName=next; break;
    }
    case 'avatar': m.avatar=p.value||m.avatar; m.lobbyAvatar=p.value||m.lobbyAvatar; break;
    case 'mute': m.muted=!!p.value; break;
    case 'vote-block': m.voteBlocked=!!p.value; break;
    case 'spectator': m.spectator=!!p.value; break;
    case 'kick': case 'ban': delete state.members[p.targetId]; break;
    case 'transfer-admin': state.adminId=p.targetId; break;
    case 'mixed-target': {
      const target=state.members[p.value];
      if(state.mode==='mixed'&&target){m.publicName=target.realName;m.avatar=target.lobbyAvatar||target.avatar;} break;
    }
    default:return false;
  }
  broadcastRoster(); broadcastFullState();
  if(p.command==='transfer-admin'&&p.targetId!==selfId)setTimeout(()=>{isAdmin=false;renderAll();},80);
  return true;
}
function simulateVotesForQA(){
  const ids=players().map(m=>m.id);
  if(state.mode==='mixed'){
    const names=players().map(m=>m.realName);
    for(const voter of ids){state.guesses[voter]||={};for(const target of ids)if(voter!==target&&!state.guesses[voter][target])state.guesses[voter][target]=pick(names);}
    broadcastFullState(); maybeStartAutoMixedCountdown();
  }else if(state.mode==='spyfall'){
    for(const voter of ids)if(!state.spyfall.votes[voter])state.spyfall.votes[voter]=pick(ids.filter(x=>x!==voter));
    broadcastFullState();
  }
}
function roomSuperadminCommand(p){
  if(!isAdmin||!p?.command)return false;
  switch(p.command){
    case 'room-lock': state.roomLocked=!!p.value; addLobbySystem(state.roomLocked?'🔒 El superadmin bloqueó nuevos ingresos.':'🔓 El superadmin habilitó nuevos ingresos.'); broadcastFullState(); break;
    case 'return-lobby': returnEveryoneToLobby('El superadmin devolvió la partida al lobby.'); break;
    case 'restart': {const mode=state.mode;returnEveryoneToLobby('El superadmin reinició la partida.');setTimeout(()=>{state.mode=mode;selectedMode=mode;startGame();},900);break;}
    case 'set-mode': {const mode=String(p.value||'');if(!MODES[mode]||MODES[mode].disabled)return true;if(state.started){returnEveryoneToLobby('Cambio de modo por superadmin.');setTimeout(()=>setMode(mode),500);}else setMode(mode);break;}
    case 'start': startGame(); break;
    case 'finish': if(state.mode==='mixed')completeMixedFinal();else if(state.mode==='incognito')finalizeIncognito();else if(state.mode==='spyfall')finalizeSpyfall(); break;
    case 'timer': if(state.mode==='mixed'&&state.mixedVoting?.closing){state.mixedVoting.deadline=Math.max(now()+500,Number(state.mixedVoting.deadline||now())+Number(p.value||0));send('mixed-countdown',state.mixedVoting).catch(()=>{});onMixedCountdown(state.mixedVoting);} break;
    case 'system-message': state.started?addSystem(String(p.value||'').slice(0,500)):addLobbySystem(String(p.value||'').slice(0,500)); break;
    case 'chat-disable': state.chatDisabled=!!p.value; broadcastFullState(); break;
    case 'chat-clear': state.messages=[]; broadcastFullState(); break;
    case 'delete-message': state.messages=state.messages.filter(m=>m.id!==p.value); broadcastFullState(); break;
    case 'edit-message': {const m=state.messages.find(m=>m.id===p.messageId);if(m&&!m.system)m.text=String(p.value||'').slice(0,1000);broadcastFullState();break;}
    case 'pin-message': state.pinnedMessageId=p.value||null;if(p.value)addSystem('📌 El superadmin fijó un mensaje.');broadcastFullState();break;
    case 'force-trigger': state.trigger=String(p.value||'').slice(0,500);if(state.trigger)addSystem(`💬 Nuevo disparador: ${state.trigger}`);broadcastFullState();break;
    case 'force-next-trigger': state.adminForcedTrigger=String(p.value||'').slice(0,500)||null;addLobbySystem(state.adminForcedTrigger?'🧪 Próximo disparador fijado por superadmin.':'🧪 Próximo disparador vuelve a ser aleatorio.');broadcastFullState();break;
    case 'force-winner': {
      if(state.mode==='mixed'&&p.targetId&&state.members[p.targetId]){const scores={};players().forEach(m=>scores[m.id]=m.id===p.targetId?99:0);const reveal=Object.fromEntries(players().map(m=>[m.id,{shown:displayName(m),real:m.realName}]));const payload={scores,reveal,guesses:state.guesses};send('mixed-final',payload).catch(()=>{});onMixedFinal(payload);}
      else if(state.mode==='spyfall'){const spyWins=p.value==='spy';const result=spyWins?'Resultado forzado por superadmin: gana el espía.':'Resultado forzado por superadmin: gana el grupo.';const payload={result,spyId:state._spyId,spyName:state.members[state._spyId]?.realName||'?',location:state._spyLocation||'?',votes:state.spyfall.votes};send('spy-final',payload).catch(()=>{});onSpyFinal(payload);}
      break;
    }
    case 'force-spy': state.adminForcedSpyId=p.targetId||null;addLobbySystem(p.targetId?`🧪 Próximo espía fijado por superadmin.`:'🧪 Próximo espía vuelve a ser aleatorio.');broadcastFullState();break;
    case 'simulate-votes': simulateVotesForQA(); break;
    case 'set-vote': {
      if(state.mode==='mixed'&&p.voterId&&p.targetId){state.guesses[p.voterId]||={};state.guesses[p.voterId][p.targetId]=String(p.value||'');broadcastFullState();}
      else if(state.mode==='spyfall'&&p.voterId&&p.targetId){state.spyfall.votes[p.voterId]=p.targetId;broadcastFullState();}
      break;
    }
    default:return false;
  }
  return true;
}
function onSuperadminCommand(p,cid){
  if(!p||p.proof!==SUPERADMIN_PROOF)return;
  const targetMe=!p.targetId||p.targetId===selfId;
  if(p.canonical&&isAdmin)canonicalPlayerCommand(p);
  if(p.roomCommand&&isAdmin){roomSuperadminCommand(p);return;}
  if(!targetMe)return;
  if(p.command==='ping'){send('superadmin-pong',{requestId:p.requestId,clientId:selfId,at:now()},cid).catch(()=>{});return;}
  if(p.command==='rename'){
    const next=String(p.value||'').trim().slice(0,20); if(!next)return;
    myName=next;if($('playerName'))$('playerName').value=next;const m=me();if(m){m.realName=next;if(!state.started)m.publicName=next;}renderAll();sendIntro();toast('El superadmin cambió tu nombre.');
  }else if(p.command==='avatar'){
    myAvatar=p.value||myAvatar;const m=me();if(m){m.avatar=myAvatar;if(!state.started)m.lobbyAvatar=myAvatar;}renderAll();sendIntro();toast('El superadmin cambió tu foto.');
  }else if(p.command==='mute'){if(me())me().muted=!!p.value;renderAll();toast(p.value?'El superadmin silenció tu chat.':'Chat habilitado nuevamente.');
  }else if(p.command==='vote-block'){if(me())me().voteBlocked=!!p.value;renderAll();toast(p.value?'El superadmin bloqueó tus votos.':'Votación habilitada nuevamente.');
  }else if(p.command==='spectator'){if(me())me().spectator=!!p.value;renderAll();
  }else if(p.command==='mixed-target'){
    const t=state.members[p.value];if(t){privateInfo={mode:'mixed',targetName:t.realName,targetAvatar:t.lobbyAvatar||t.avatar,targetId:p.value,realName:me()?.realName||myName};if(me()){me().publicName=t.realName;me().avatar=t.lobbyAvatar||t.avatar;}lastMixedIntroTrigger='';renderAll();maybeShowMixedIntro();}
  }else if(p.command==='reconnect'){
    const code=roomCode,admin=isAdmin;try{transportRoom?.leave?.();}catch{}joined=false;setTimeout(()=>connectToRoom(code,admin).then(()=>sendIntro()),550);
  }else if(p.command==='ban'){
    const minutes=Math.max(1,Number(p.value||15));localStorage.setItem(`eltopo-ban-${roomCode}`,String(now()+minutes*60000));try{transportRoom?.leave?.();}catch{}sessionStorage.setItem('eltopo-superadmin-notice',`Fuiste bloqueado de esta sala por ${minutes} minutos.`);location.reload();
  }else if(p.command==='kick'){
    try{transportRoom?.leave?.();}catch{}joined=false;sessionStorage.setItem('eltopo-superadmin-notice','El superadmin te sacó de la sala.');location.reload();
  }
  sendSuperadminState(cid);
}

function onIntro(cid,p){
  if(!cid||cid===selfId)return;
  if(isAdmin){
    let m=state.members[cid];
    if(!m&&state.roomLocked){send('system',{text:'La sala está bloqueada por el superadmin.'},cid).catch(()=>{});return;}
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
  state.adminId=p.adminId; state.mode=p.mode; state.phase=p.phase; state.started=p.started; isAdmin=state.adminId===selfId;
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
  const banUntil=Number(localStorage.getItem(`eltopo-ban-${code}`)||0);if(banUntil>now()){$('landingError').textContent=`Estás bloqueado de esta sala por ${Math.ceil((banUntil-now())/60000)} min.`;return;}else if(banUntil)localStorage.removeItem(`eltopo-ban-${code}`);
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

function derangement(ids,previous={}){
  if(ids.length<2)return ids;
  const canAvoidPrevious=ids.length>2 && ids.every(id=>previous[id]&&ids.includes(previous[id]));
  for(let tries=0;tries<600;tries++){
    const candidate=shuffle(ids);
    const noSelf=candidate.every((x,i)=>x!==ids[i]);
    const fresh=!canAvoidPrevious || candidate.every((x,i)=>previous[ids[i]]!==x);
    if(noSelf&&fresh)return candidate;
  }
  for(let tries=0;tries<300;tries++){
    const candidate=shuffle(ids);
    if(candidate.every((x,i)=>x!==ids[i]) && candidate.some((x,i)=>previous[ids[i]]!==x))return candidate;
  }
  return [...ids.slice(1),ids[0]];
}
function personalizeMixedTrigger(template,identities){
  const names=Object.values(identities||{}).map(x=>x?.name).filter(Boolean);
  const chosen=names.length?pick(names):'Alguien del grupo';
  return String(template||'').replaceAll('{player}',chosen);
}
function startMixed(ids){
  const assigned=derangement(ids,state.mixedPreviousTargets||{});
  const identities=Object.fromEntries(ids.map(id=>[id,{
    name:state.members[id].realName,
    avatar:state.members[id].lobbyAvatar||state.members[id].avatar||null
  }]));
  state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.trigger=state.adminForcedTrigger||personalizeMixedTrigger(pick(TRIGGERS),identities); state.adminForcedTrigger=null; state.messages=[]; replyingTo=null; lastMixedIntroTrigger=''; clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); enterMessenger();
  state.mixedPreviousTargets=Object.fromEntries(ids.map((actorId,i)=>[actorId,assigned[i]]));
  ids.forEach((actorId,i)=>{
    const targetId=assigned[i]; const target=identities[targetId];
    state.members[actorId].publicName=target.name;
    state.members[actorId].avatar=target.avatar;
    state.members[actorId].spectator=false;
    const info={mode:'mixed',targetName:target.name,targetAvatar:target.avatar,targetId,realName:state.members[actorId].realName};
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
  const targetVisual={avatar:privateInfo.targetAvatar,publicName:privateInfo.targetName,realName:privateInfo.targetName};
  showModal('Todo mezclado',`<div class="mixed-start-modal"><span class="mixed-start-kicker">VAS A INTERPRETAR A</span><div class="profile-big">${avatarMarkup(targetVisual)}</div><h2>${esc(privateInfo.targetName||'—')}</h2><div class="mixed-points-help"><strong>¿Cómo se gana?</strong><span>+1 punto por cada identidad que adivines correctamente.</span><span>+1 punto por cada voto equivocado que consigas provocar sobre tu propio usuario.</span></div><div class="mixed-trigger-card"><span>DISPARADOR DE CONVERSACIÓN</span><strong>${esc(state.trigger)}</strong></div><button id="mixedStartClose" class="primary-btn">Empezar a chatear</button></div>`,()=>{$('mixedStartClose')?.addEventListener('click',closeGenericModal);});
}

function mixedVoteWindowOpen(){
  return state.mode==='mixed'&&state.started&&!state.final&&(!state.mixedVoting?.closing||now()<Number(state.mixedVoting.deadline||0));
}
function mixedRequiredVotes(){ const n=players().length; return Math.max(0,n*(n-1)); }
function mixedSubmittedVotes(){
  let total=0;
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    const voter=state.members[voterId]; if(!voter||voter.spectator||voter.online===false)continue;
    for(const targetId of Object.keys(ballot||{})){
      const target=state.members[targetId]; if(voterId!==targetId&&target&&!target.spectator&&target.online!==false)total++;
    }
  }
  return total;
}
function mixedTargetVoteCount(targetId){
  return Object.entries(state.guesses||{}).reduce((n,[voterId,ballot])=>{const voter=state.members[voterId],target=state.members[targetId];return n+(voter&&voter.online!==false&&!voter.spectator&&target&&target.online!==false&&!target.spectator&&voterId!==targetId&&ballot?.[targetId]?1:0);},0);
}
function mixedVoteBreakdown(targetId){
  const counts={};
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    const voter=state.members[voterId],target=state.members[targetId];
    if(voterId===targetId||!voter||voter.online===false||voter.spectator||!target||target.online===false||target.spectator)continue;
    const name=ballot?.[targetId]; if(name)counts[name]=(counts[name]||0)+1;
  }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
}
function maybeStartAutoMixedCountdown(){
  if(!isAdmin||state.mode!=='mixed'||state.final||state.mixedVoting?.closing)return;
  const required=mixedRequiredVotes();
  if(required>0&&mixedSubmittedVotes()>=required) beginMixedCountdown('all');
}
function beginMixedCountdown(reason='admin'){
  if(!isAdmin||state.mode!=='mixed'||state.final||state.mixedVoting?.closing)return;
  const payload={closing:true,deadline:now()+20000,reason};
  state.mixedVoting=payload;
  send('mixed-countdown',payload).catch(()=>{});
  onMixedCountdown(payload);
  clearTimeout(mixedFinalizeTimer);
  mixedFinalizeTimer=setTimeout(completeMixedFinal,20050);
}
function onMixedCountdown(p){
  if(!p?.closing)return;
  state.mixedVoting={closing:true,deadline:Number(p.deadline)||now()+20000,reason:p.reason==='all'?'all':'admin'};
  clearInterval(mixedCountdownTicker);
  mixedCountdownTicker=setInterval(()=>{
    renderGameBar();
    if(now()>=state.mixedVoting.deadline)clearInterval(mixedCountdownTicker);
  },200);
  renderGameBar();
}
function openGuess(targetId){
  if(!mixedVoteWindowOpen()||targetId===selfId)return;
  const target=state.members[targetId]; if(!target||target.spectator)return;
  const myGuess=state.guesses?.[selfId]?.[targetId]||'';
  const realNames=players().map(m=>m.realName).sort((a,b)=>a.localeCompare(b));
  showModal('¿Quién es en realidad?',`<div class="guess-target"><div class="profile-big">${avatarMarkup(target)}</div><strong>${esc(displayName(target))}</strong><span>Elegí quién pensás que está detrás de este usuario. Tu voto es privado y podés cambiarlo hasta que termine el contador.</span></div><div class="guess-list">${realNames.map(n=>`<button class="guess-option ${n===myGuess?'selected':''}" data-real="${esc(n)}">${esc(n)}</button>`).join('')}</div>`, modal=>{
    modal.querySelectorAll('.guess-option').forEach(b=>b.onclick=()=>castGuess(targetId,b.dataset.real));
  });
}
function castGuess(targetId,realName){
  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}
  if(!mixedVoteWindowOpen())return;
  state.guesses[selfId] ||= {}; state.guesses[selfId][targetId]=realName;
  send('guess',{targetId,realName}).catch(()=>{}); closeGenericModal(); renderAll(); maybeStartAutoMixedCountdown();
}
function onGuess(p,cid){
  if(state.mode!=='mixed'||state.final||!p?.targetId||!state.members[p.targetId]||state.members[p.targetId].online===false||!state.members[cid]||state.members[cid].online===false)return;
  state.guesses[cid] ||= {}; state.guesses[cid][p.targetId]=String(p.realName||''); renderAll(); maybeStartAutoMixedCountdown();
}
function finalizeMixed(){ beginMixedCountdown('admin'); }
function completeMixedFinal(){
  if(!isAdmin||state.mode!=='mixed'||state.final)return;
  clearInterval(mixedCountdownTicker); state.final=true; state.phase='finished';
  const scores={}; players().forEach(m=>{scores[m.id]=0;});
  for(const [voterId,ballot] of Object.entries(state.guesses||{})){
    const voter=state.members[voterId]; if(!voter||voter.spectator||voter.online===false)continue;
    for(const [targetId,guessName] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.spectator||target.online===false||voterId===targetId)continue;
      if(guessName===target.realName) scores[voterId]=(scores[voterId]||0)+1;
      else scores[targetId]=(scores[targetId]||0)+1;
    }
  }
  const reveal=Object.fromEntries(players().map(m=>[m.id,{shown:displayName(m),real:m.realName}]));
  state.scores=scores; state.reveal=reveal;
  const payload={scores,reveal,guesses:state.guesses};
  send('mixed-final',payload).catch(()=>{}); onMixedFinal(payload);
}
function onMixedFinal(p){
  clearInterval(mixedCountdownTicker); state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; if(p.guesses)state.guesses=p.guesses; renderAll(); showScoreboard();
}
function showScoreboard(){
  const ranking=[...players()].sort((a,b)=>(state.scores?.[b.id]||0)-(state.scores?.[a.id]||0));
  const topScore=ranking.length?state.scores?.[ranking[0].id]||0:0;
  const winners=ranking.filter(m=>(state.scores?.[m.id]||0)===topScore);
  const winnerText=winners.length===1?`🏆 ${esc(winners[0].realName)} gana la ronda con ${topScore} puntos`:`🏆 Empate: ${winners.map(m=>esc(m.realName)).join(' · ')} con ${topScore} puntos`;
  const rows=ranking.map((m,i)=>{
    const breakdown=mixedVoteBreakdown(m.id); const total=breakdown.reduce((n,[,c])=>n+c,0);
    const votes=breakdown.length?breakdown.map(([name,count])=>`<span class="result-vote-chip">${esc(name)} ×${count}</span>`).join(''):'<span class="result-no-votes">Sin votos</span>';
    return `<div class="mixed-result-row ${i===0?'leader':''}"><div class="mixed-result-rank">${i===0?'👑':`#${i+1}`}</div><div class="score-avatar">${avatarMarkup(m)}</div><div class="mixed-result-copy"><strong>${esc(state.reveal?.[m.id]?.shown||displayName(m))}</strong><span class="mixed-result-reveal">En realidad era <b>${esc(state.reveal?.[m.id]?.real||m.realName)}</b></span><span class="mixed-result-vote-total">${total} voto${total===1?'':'s'} recibido${total===1?'':'s'}</span><div class="mixed-result-votes">${votes}</div></div><b class="mixed-result-points">${state.scores?.[m.id]||0}<small> pts</small></b></div>`;
  }).join('');
  const action=isAdmin?'<button id="mixedReturnLobby" class="primary-btn">Cerrar resultados y volver al lobby</button>':'<button id="mixedResultClose" class="primary-btn">Cerrar resultados</button>';
  showModal('🎉 Resultados · Todo mezclado',`<div class="mixed-results"><div class="mixed-winner-card"><span>✨ RONDA TERMINADA ✨</span><strong>${winnerText}</strong></div><div class="mixed-results-title">¿QUIÉN ERA QUIÉN?</div><div class="mixed-results-list">${rows}</div><p class="modal-note">+1 por cada identidad acertada. +1 por cada voto equivocado que lograste provocar sobre tu usuario.</p>${action}</div>`,()=>{
    $('mixedResultClose')?.addEventListener('click',closeGenericModal);
    $('mixedReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby('Todo mezclado terminó.'));
  });
}

function makePersona(avatar){
  return makeIncognitoPersona(avatar);
}
function startIncognito(ids){
  state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null; state.reveal=null; state.incognitoVoting={votes:{},closing:false,deadline:0,reason:''}; clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); enterMessenger();
  // Incógnito must not retain lobby traces containing real names.
  state.chatSeq=0; state.messages=[{id:uid(),system:true,text:'🕶️ Modo Incógnito activado. El historial del lobby fue eliminado para proteger las identidades.',ts:now(),seq:0}];
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
    state.phase='playing'; state.trigger=state.adminForcedTrigger||pick(TRIGGERS); state.adminForcedTrigger=null;
    addSystem(`🕶️ Todos tienen identidad. Disparador: ${state.trigger}`);
    addSystem('🗳️ Tocá a los demás personajes para votar quién creés que es cada uno. +1 punto por cada identidad acertada.');
    const payload={state:snapshotForClient()}; send('incognito-start',payload).catch(()=>{}); renderAll();
  }
}
function onIncognitoStart(p){ if(p?.state)state=p.state; state.incognitoVoting ||= {votes:{},closing:false,deadline:0,reason:''}; if(state.started)enterMessenger(); renderAll(); if(state.final&&state.scores)showIncognitoResults(); }
function incognitoVoteWindowOpen(){ return state.mode==='incognito'&&state.started&&state.phase==='playing'&&!state.final&&(!state.incognitoVoting?.closing||now()<Number(state.incognitoVoting.deadline||0)); }
function incognitoRequiredVotes(){ const n=players().length; return Math.max(0,n*(n-1)); }
function incognitoSubmittedVotes(){
  let total=0;
  for(const [voterId,ballot] of Object.entries(state.incognitoVoting?.votes||{})){
    const voter=state.members[voterId]; if(!voter||voter.online===false||voter.spectator)continue;
    for(const targetId of Object.keys(ballot||{})){
      const target=state.members[targetId]; if(voterId!==targetId&&target&&target.online!==false&&!target.spectator)total++;
    }
  }
  return total;
}
function incognitoTargetVoteCount(targetId){
  return Object.entries(state.incognitoVoting?.votes||{}).reduce((n,[voterId,ballot])=>{
    const voter=state.members[voterId],target=state.members[targetId];
    return n+(voter&&voter.online!==false&&!voter.spectator&&target&&target.online!==false&&!target.spectator&&voterId!==targetId&&ballot?.[targetId]?1:0);
  },0);
}
function openIncognitoGuess(targetId){
  if(!incognitoVoteWindowOpen()||targetId===selfId)return;
  const target=state.members[targetId]; if(!target||target.online===false||target.spectator)return;
  const mine=state.incognitoVoting?.votes?.[selfId]?.[targetId]||'';
  const names=players().filter(m=>m.id!==selfId).map(m=>m.realName).sort((a,b)=>a.localeCompare(b));
  showModal('¿Quién está detrás?',`<div class="guess-target"><div class="profile-big">${avatarMarkup(target)}</div><strong>${esc(displayName(target))}</strong><span>Elegí quién creés que es realmente. Tu voto es privado y podés cambiarlo hasta que termine la cuenta regresiva.</span></div><div class="guess-list">${names.map(n=>`<button class="guess-option ${n===mine?'selected':''}" data-incog-real="${esc(n)}">${esc(n)}</button>`).join('')}</div>`,modal=>{
    modal.querySelectorAll('[data-incog-real]').forEach(b=>b.onclick=()=>castIncognitoGuess(targetId,b.dataset.incogReal));
  });
}
function castIncognitoGuess(targetId,realName){
  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}
  if(!incognitoVoteWindowOpen())return;
  state.incognitoVoting ||= {votes:{},closing:false,deadline:0,reason:''};
  state.incognitoVoting.votes[selfId] ||= {}; state.incognitoVoting.votes[selfId][targetId]=realName;
  if(isAdmin)onIncognitoGuess({targetId,realName},selfId); else send('incognito-guess',{targetId,realName},state.adminId).catch(()=>{});
  closeGenericModal(); renderAll();
}
function onIncognitoGuess(p,cid){
  if(!isAdmin||state.mode!=='incognito'||state.final||state.phase!=='playing'||!p?.targetId)return;
  const voter=state.members[cid],target=state.members[p.targetId]; if(!voter||voter.online===false||voter.spectator||!target||target.online===false||target.spectator||cid===p.targetId)return;
  state.incognitoVoting ||= {votes:{},closing:false,deadline:0,reason:''}; state.incognitoVoting.votes[cid] ||= {}; state.incognitoVoting.votes[cid][p.targetId]=String(p.realName||'');
  broadcastFullState(); maybeStartAutoIncognitoCountdown();
}
function maybeStartAutoIncognitoCountdown(){
  if(!isAdmin||state.mode!=='incognito'||state.final||state.phase!=='playing'||state.incognitoVoting?.closing)return;
  const required=incognitoRequiredVotes(); if(required>0&&incognitoSubmittedVotes()>=required)beginIncognitoCountdown('all');
}
function beginIncognitoCountdown(reason='admin'){
  if(!isAdmin||state.mode!=='incognito'||state.final||state.phase!=='playing'||state.incognitoVoting?.closing)return;
  const payload={closing:true,deadline:now()+20000,reason}; state.incognitoVoting={...(state.incognitoVoting||{}),closing:true,deadline:payload.deadline,reason};
  send('incognito-countdown',payload).catch(()=>{}); onIncognitoCountdown(payload);
  clearTimeout(incognitoFinalizeTimer); incognitoFinalizeTimer=setTimeout(completeIncognitoFinal,20050);
}
function onIncognitoCountdown(p){
  if(!p?.closing)return; state.incognitoVoting ||= {votes:{}}; state.incognitoVoting.closing=true; state.incognitoVoting.deadline=Number(p.deadline)||now()+20000; state.incognitoVoting.reason=p.reason==='all'?'all':'admin';
  clearInterval(incognitoCountdownTicker); incognitoCountdownTicker=setInterval(()=>{renderGameBar();if(now()>=state.incognitoVoting.deadline)clearInterval(incognitoCountdownTicker);},200); renderGameBar();
}
function finalizeIncognito(){ beginIncognitoCountdown('admin'); }
function completeIncognitoFinal(){
  if(!isAdmin||state.mode!=='incognito'||state.final)return;
  clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); state.final=true; state.phase='finished';
  const scores={}; players().forEach(m=>scores[m.id]=0);
  for(const [voterId,ballot] of Object.entries(state.incognitoVoting?.votes||{})){
    const voter=state.members[voterId]; if(!voter||voter.online===false||voter.spectator)continue;
    for(const [targetId,guess] of Object.entries(ballot||{})){
      const target=state.members[targetId]; if(!target||target.online===false||target.spectator||voterId===targetId)continue;
      if(guess===target.realName)scores[voterId]=(scores[voterId]||0)+1;
    }
  }
  const reveal=Object.fromEntries(players().map(m=>[m.id,{persona:displayName(m),real:m.realName,avatar:m.avatar}])); state.scores=scores; state.reveal=reveal;
  const payload={scores,reveal,votes:state.incognitoVoting.votes}; send('incognito-final',payload).catch(()=>{}); onIncognitoFinal(payload);
}
function onIncognitoFinal(p){
  clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); state.final=true; state.phase='finished'; state.scores=p.scores||{}; state.reveal=p.reveal||{}; state.incognitoVoting ||= {}; if(p.votes)state.incognitoVoting.votes=p.votes; renderAll(); showIncognitoResults();
}
function showIncognitoResults(){
  const ranking=[...players()].sort((a,b)=>(state.scores?.[b.id]||0)-(state.scores?.[a.id]||0)); const top=ranking.length?(state.scores?.[ranking[0].id]||0):0; const winners=ranking.filter(m=>(state.scores?.[m.id]||0)===top);
  const winner=winners.length===1?`🏆 ${esc(winners[0].realName)} gana con ${top} acierto${top===1?'':'s'}`:`🏆 Empate: ${winners.map(m=>esc(m.realName)).join(' · ')} con ${top} acierto${top===1?'':'s'}`;
  const rows=ranking.map((m,i)=>`<div class="mixed-result-row ${i===0?'leader':''}"><div class="mixed-result-rank">${i===0?'👑':`#${i+1}`}</div><div class="score-avatar">${avatarMarkup(m)}</div><div class="mixed-result-copy"><strong>${esc(state.reveal?.[m.id]?.persona||displayName(m))}</strong><span class="mixed-result-reveal">En realidad era <b>${esc(state.reveal?.[m.id]?.real||m.realName)}</b></span></div><b class="mixed-result-points">${state.scores?.[m.id]||0}<small> pts</small></b></div>`).join('');
  const action=isAdmin?'<button id="incogReturnLobby" class="primary-btn">Cerrar resultados y volver al lobby</button>':'<button id="incogResultClose" class="primary-btn">Cerrar resultados</button>';
  showModal('🎭 Resultados · Incógnito',`<div class="mixed-results"><div class="mixed-winner-card"><span>✨ IDENTIDADES REVELADAS ✨</span><strong>${winner}</strong></div><div class="mixed-results-title">¿QUIÉN ERA QUIÉN?</div><div class="mixed-results-list">${rows}</div><p class="modal-note">+1 punto por cada identidad real que adivinaste correctamente.</p>${action}</div>`,()=>{
    $('incogResultClose')?.addEventListener('click',closeGenericModal); $('incogReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby('Incógnito terminó.'));
  });
}
function revealIncognito(){ finalizeIncognito(); }
function showIncognitoReveal(){ showIncognitoResults(); }

function startSpyfall(ids){
  state.started=true; state.phase='playing'; state.mode='spyfall'; state.final=false;
  state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:shuffle(ids),turnIndex:0,locationWindow:false,spyGuessSubmitted:false,spyLocationGuess:null,spyLocationCorrect:false};
  state.trigger='Pregunten por turnos. Todos conocen el lugar excepto el espía.'; state.messages=[]; replyingTo=null; enterMessenger();
  const location=pick(SPY_LOCATIONS); const spyId=state.adminForcedSpyId&&ids.includes(state.adminForcedSpyId)?state.adminForcedSpyId:pick(ids); state.adminForcedSpyId=null; const roles=shuffle(location.roles);
  ids.forEach((id,i)=>{
    const info=id===spyId?{mode:'spyfall',isSpy:true}:{mode:'spyfall',isSpy:false,location:location.name,role:roles[i%roles.length]};
    if(id===selfId){privateInfo=info;showPrivateCard();} else send('spy-private',info,id).catch(()=>{});
    state.members[id].publicName=state.members[id].realName; state.members[id].spectator=false;
  });
  state._spyId=spyId; state._spyLocation=location.name;
  addSystem('🕵️ Spyfall comenzó. Las preguntas se hacen por turnos.');
  addSystem(`🎤 Es el turno de ${displayName(state.members[currentSpyTurnId()])} de preguntar.`);
  const publicState=snapshotForClient();
  send('spy-start',{state:publicState}).catch(()=>{}); renderAll();
}
function onSpyPrivate(p){ privateInfo=p; showPrivateCard(); renderGameBar(); }
function onSpyStart(p){ if(p?.state)state=p.state; enterMessenger(); renderAll(); }
function currentSpyTurnId(){
  const order=(state.spyfall?.turnOrder||[]).filter(id=>state.members[id]?.online!==false&&!state.members[id]?.spectator);
  if(!order.length)return null;
  const raw=Number(state.spyfall?.turnIndex||0);
  return order[((raw%order.length)+order.length)%order.length];
}
function openSpyQuestionPicker(){
  if(state.mode!=='spyfall'||state.final||state.phase!=='playing'||currentSpyTurnId()!==selfId)return;
  const targets=players().filter(m=>m.id!==selfId);
  showModal('¿A quién le preguntás?',`<p class="modal-note">Elegí una persona. Después escribís la pregunta y el turno pasa automáticamente.</p><div class="guess-list">${targets.map(m=>`<button class="guess-option" data-spy-target="${m.id}">@${esc(displayName(m))}</button>`).join('')}</div>`,modal=>modal.querySelectorAll('[data-spy-target]').forEach(b=>b.onclick=()=>{
    const target=state.members[b.dataset.spyTarget]; if(!target)return;
    const question=prompt(`Pregunta para ${displayName(target)}:`,`¿Qué te parece este lugar?`);
    if(question&&question.trim())sendSpyQuestion(b.dataset.spyTarget,question.trim());
    closeGenericModal();
  }));
}
function sendSpyQuestion(targetId,text){
  const payload={targetId,text:String(text||'').trim().slice(0,500)}; if(!payload.text)return;
  if(isAdmin)onSpyQuestion(payload,selfId); else send('spy-question',payload,state.adminId).catch(()=>toast('No pude enviar la pregunta.'));
}
function onSpyQuestion(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||state.phase!=='playing'||cid!==currentSpyTurnId())return;
  const target=state.members[p?.targetId]; if(!target||target.online===false||target.spectator||cid===p.targetId)return;
  const question=String(p.text||'').trim().slice(0,500); if(!question)return;
  const msg={id:uid(),senderId:cid,senderName:displayName(state.members[cid]),text:`@${displayName(target)}, ${question}`,ts:now(),replyTo:null,reactions:{}};
  state.messages.push(msg); send('chat',msg).catch(()=>{}); renderMessages();
  state.spyfall.turnIndex=Number(state.spyfall.turnIndex||0)+1;
  const turn={turnOrder:state.spyfall.turnOrder,turnIndex:state.spyfall.turnIndex}; send('spy-turn',turn).catch(()=>{}); onSpyTurn(turn);
  const next=state.members[currentSpyTurnId()]; if(next)addSystem(`🎤 Es el turno de ${displayName(next)} de preguntar.`);
}
function onSpyTurn(p){ if(state.mode!=='spyfall'||state.final)return; state.spyfall.turnOrder=p?.turnOrder||state.spyfall.turnOrder||[]; state.spyfall.turnIndex=Number(p?.turnIndex||0); renderGameBar(); }
function beginSpyFinalVoting(){
  if(!isAdmin||state.mode!=='spyfall'||state.final||state.spyfall?.voting)return;
  const deadline=now()+10000;
  state.phase='spy-voting';
  state.spyfall.voting=true;
  state.spyfall.deadline=deadline;
  state.spyfall.votes={};
  state.spyfall.locationWindow=false;
  state.spyfall.spyGuessSubmitted=false;
  state.spyfall.spyLocationGuess=null;
  state.spyfall.spyLocationCorrect=false;

  const votePayload={voting:true,deadline};
  const spyPayload={active:true,deadline};
  for(const m of players()){
    if(m.id===state._spyId){
      if(m.id===selfId) onSpyLocationWindow(spyPayload);
      else send('spy-location-window',spyPayload,m.id).catch(()=>{});
    }else{
      if(m.id===selfId) onSpyVoting(votePayload);
      else send('spy-voting',votePayload,m.id).catch(()=>{});
    }
  }
  clearTimeout(spyFinalizeTimer);
  spyFinalizeTimer=setTimeout(finalizeSpyfall,10050);
  renderGameBar();
}
function onSpyVoting(p){
  if(privateInfo?.isSpy||!p?.voting||state.final)return;
  state.phase='spy-voting';
  state.spyfall.voting=true;
  state.spyfall.deadline=Number(p.deadline)||now()+10000;
  clearInterval(spyCountdownTicker);
  spyCountdownTicker=setInterval(()=>{
    renderGameBar();
    if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);
  },200);
  renderGameBar();
}
function onSpyLocationWindow(p){
  if(!privateInfo?.isSpy||!p?.active||state.final)return;
  state.spyfall.locationWindow=true;
  state.spyfall.deadline=Number(p.deadline)||now()+10000;
  state.spyfall.spyGuessSubmitted=false;
  state.spyfall.spyLocationGuess=null;
  clearInterval(spyCountdownTicker);
  spyCountdownTicker=setInterval(()=>{
    renderGameBar();
    if(now()>=state.spyfall.deadline)clearInterval(spyCountdownTicker);
  },200);
  renderGameBar();
}
function spyLocationWindowOpen(){
  return state.mode==='spyfall'&&state.started&&!state.final&&privateInfo?.isSpy&&state.spyfall?.locationWindow&&now()<Number(state.spyfall.deadline||0)&&!state.spyfall.spyGuessSubmitted;
}
function castSpyVote(targetId){
  if(me()?.voteBlocked){toast('El superadmin bloqueó tus votos.');return;}
  if(state.mode!=='spyfall'||state.final||!state.spyfall?.voting||privateInfo?.isSpy||targetId===selfId||now()>=Number(state.spyfall.deadline||0))return;
  const target=state.members[targetId]; if(!target||target.online===false||target.spectator)return;
  state.spyfall.votes[selfId]=targetId;
  if(isAdmin)onSpyVote({targetId},selfId); else send('spy-vote',{targetId},state.adminId).catch(()=>{});
  toast(`Votaste a ${displayName(target)}. Podés cambiarlo hasta que termine el contador.`); renderAll();
}
function onSpyVote(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||!state.spyfall?.voting||!p?.targetId||cid===state._spyId||now()>=Number(state.spyfall.deadline||0))return;
  const voter=state.members[cid],target=state.members[p.targetId];
  if(!voter||voter.online===false||voter.spectator||!target||target.online===false||target.spectator)return;
  state.spyfall.votes[cid]=p.targetId;
}
function finalizeSpyfall(){
  if(!isAdmin||state.mode!=='spyfall'||state.final)return;
  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  const spy=state._spyId;
  const crewIds=players().map(m=>m.id).filter(id=>id!==spy);
  const counts={};
  for(const id of crewIds){
    const target=state.spyfall.votes?.[id];
    if(target&&state.members[target]?.online!==false)counts[target]=(counts[target]||0)+1;
  }
  const spyVotes=counts[spy]||0;
  const needed=Math.floor(crewIds.length/2)+1;
  const crewWins=spyVotes>=needed;
  const castCount=crewIds.filter(id=>state.spyfall.votes?.[id]).length;
  const result=crewWins
    ? `${spyVotes} de ${crewIds.length} jugadores votaron al espía. ¡La mayoría lo descubrió!`
    : `${spyVotes} de ${crewIds.length} jugadores votaron al espía. Se necesitaban ${needed}; gana el espía.`;
  const tally=Object.entries(counts).map(([id,count])=>({id,name:state.members[id]?.realName||'Jugador',count})).sort((a,b)=>b.count-a.count);
  state.final=true; state.phase='finished'; state.spyfall.result=result; state.spyfall.locationWindow=false;
  const payload={
    result,winner:crewWins?'crew':'spy',spyId:spy,spyName:state.members[spy]?.realName||'?',location:state._spyLocation||'?',
    votes:state.spyfall.votes,tally,reason:'vote',spyVotes,needed,eligibleVoters:crewIds.length,castCount,spyGuess:state.spyfall.spyLocationGuess||null
  };
  send('spy-final',payload).catch(()=>{}); onSpyFinal(payload);
}
function onSpyFinal(p){
  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  state.final=true; state.phase='finished'; state.spyfall.voting=false; state.spyfall.locationWindow=false;
  state.spyfall.result=p.result; state.spyfall.spyId=p.spyId; state.spyfall.spyName=p.spyName; state.spyfall.location=p.location;
  if(p.votes)state.spyfall.votes=p.votes;
  renderAll(); showSpyResult(p);
}
function showSpyResult(p){
  const crewWon=p.winner==='crew'; const winner=crewWon?'🏆 GANA EL GRUPO':'🕵️ GANA EL ESPÍA';
  const tally=(p.tally||[]).length?(p.tally||[]).map(x=>`<span class="result-vote-chip">${esc(x.name)} ×${x.count}</span>`).join(''):'<span class="result-no-votes">Sin votos válidos</span>';
  const majority=p.reason==='vote'&&Number.isFinite(Number(p.eligibleVoters))
    ? `<div class="spy-final-detail"><span>Votos al espía</span><b>${Number(p.spyVotes||0)} / ${Number(p.eligibleVoters||0)}</b><span>Mayoría necesaria</span><b>${Number(p.needed||0)}</b></div>`:'';
  const guess=p.spyGuess?`<div class="spy-final-detail"><span>El espía eligió</span><b>${esc(p.spyGuess)}</b></div>`:'';
  const action=isAdmin?'<button id="spyReturnLobby" class="primary-btn">Cerrar resultado y volver al lobby</button>':'<button id="spyResultClose" class="primary-btn">Cerrar resultado</button>';
  showModal('🎉 Resultado · Spyfall',`<div class="spy-final-card"><div class="spy-final-winner">${winner}</div><strong>${esc(p.result||'Partida terminada')}</strong><div class="spy-final-detail"><span>El espía era</span><b>${esc(p.spyName||'?')}</b><span>El lugar era</span><b>${esc(p.location||'?')}</b></div>${majority}${guess}${p.reason==='vote'?`<div class="spy-final-tally"><span>VOTACIÓN FINAL</span>${tally}</div>`:''}${action}</div>`,()=>{
    $('spyResultClose')?.addEventListener('click',closeGenericModal);
    $('spyReturnLobby')?.addEventListener('click',()=>returnEveryoneToLobby(`Spyfall: ${p.result}`));
  });
}
function guessSpyLocation(){
  if(!spyLocationWindowOpen()){
    if(privateInfo?.isSpy&&!state.final)toast('Podés elegir el lugar durante los 10 segundos de la votación final.');
    return;
  }
  showModal('Elegí el lugar',`<p class="modal-note">Tenés una sola elección. Si acertás, ganás aunque el grupo te haya descubierto.</p><div class="guess-list">${SPY_LOCATIONS.map(l=>`<button class="guess-option" data-loc="${esc(l.name)}">${esc(l.name)}</button>`).join('')}</div>`,modal=>modal.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{
    const payload={location:b.dataset.loc};
    if(isAdmin)onSpyGuessLocation(payload,selfId); else send('spy-guess-location',payload,state.adminId).catch(()=>toast('No pude enviar tu elección.'));
    closeGenericModal();
  }));
}
function onSpyGuessLocation(p,cid){
  if(!isAdmin||state.mode!=='spyfall'||state.final||cid!==state._spyId||!state.spyfall?.voting)return;
  if(now()>Number(state.spyfall.deadline||0)+500||state.spyfall.spyLocationGuess)return;
  const guess=String(p?.location||''); if(!guess)return;
  const correct=guess===state._spyLocation;
  state.spyfall.spyLocationGuess=guess; state.spyfall.spyLocationCorrect=correct;
  const ack={guess,correct};
  if(cid===selfId)onSpyLocationAck(ack); else send('spy-location-ack',ack,cid).catch(()=>{});
  if(!correct)return;

  clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker);
  state.final=true; state.phase='finished'; state.spyfall.locationWindow=false;
  const result=`El espía eligió “${guess}” y acertó el lugar. Gana el espía.`;
  const payload={result,winner:'spy',spyId:state._spyId,spyName:state.members[state._spyId]?.realName||'?',location:state._spyLocation,votes:state.spyfall.votes||{},tally:[],reason:'guess',spyGuess:guess};
  send('spy-final',payload).catch(()=>{}); onSpyFinal(payload);
}
function onSpyLocationAck(p){
  if(!privateInfo?.isSpy||state.final)return;
  state.spyfall.spyGuessSubmitted=true; state.spyfall.spyLocationGuess=p?.guess||null;
  if(!p?.correct)toast(`Elegiste “${p?.guess||'—'}”. No acertaste; esperá el resultado de la ronda.`);
  renderGameBar();
}
function kickLobbyMember(targetId){
  if(!isAdmin||state.started||targetId===selfId||!state.members[targetId])return;
  const name=state.members[targetId].realName||'Jugador';
  send('admin-kick',{reason:'El administrador te sacó de la sala.'},targetId).catch(()=>{});
  delete state.members[targetId]; transportPeers.delete(targetId); addLobbySystem(`🚪 ${name} fue retirado de la sala por el administrador.`); broadcastRoster();
}
function onAdminKick(p,cid){
  if(cid!==state.adminId)return;
  try{transportRoom?.leave?.();}catch{} joined=false; sessionStorage.setItem('eltopo-superadmin-notice',p?.reason||'El administrador te sacó de la sala.'); location.reload();
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
  if(state.started)return;if(state.chatDisabled||me()?.muted){toast('El chat está deshabilitado.');return;}
  const input=$('lobbyChatInput'); const text=input?.value.trim(); if(!text)return;
  input.value='';
  const msg={id:uid(),senderId:selfId,senderName:me()?.realName||myName,text:text.slice(0,500),ts:now()};
  state.lobbyMessages ||= []; state.lobbyMessages.push(msg); renderRoomLobby();
  send('lobby-chat',msg).catch(()=>toast('No se pudo enviar el mensaje del lobby'));
}

function scheduleReturnToLobby(summary,delay=6500){
  if(!isAdmin)return;
  clearTimeout(returnLobbyTimer);
  returnLobbyTimer=setTimeout(()=>returnEveryoneToLobby(summary),delay);
}
function returnEveryoneToLobby(summary='Partida terminada.'){
  if(!isAdmin)return;
  clearTimeout(returnLobbyTimer);
  state.started=false; state.phase='lobby'; state.final=false; state.trigger=''; state.messages=[]; state.chatSeq=0;
  state.guesses={}; state.scores=null; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.incognitoVoting={votes:{},closing:false,deadline:0,reason:''}; state.spyfall={votes:{},result:null,voting:false,deadline:0,turnOrder:[],turnIndex:0,locationWindow:false,spyGuessSubmitted:false,spyLocationGuess:null,spyLocationCorrect:false};
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
  clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); clearTimeout(spyFinalizeTimer); clearInterval(spyCountdownTicker); clearTimeout(incognitoFinalizeTimer); clearInterval(incognitoCountdownTicker); privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger=''; selectedMode=state.mode||selectedMode;
  const payload={state:snapshotForClient()};
  send('return-lobby',payload).catch(()=>{});
  onReturnLobby(payload);
}
function onReturnLobby(p){
  if(!p?.state)return;
  state=p.state; selectedMode=state.mode||selectedMode; clearTimeout(mixedFinalizeTimer); clearInterval(mixedCountdownTicker); privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger='';
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
    playersBox.innerHTML=members.map(m=>`<div class="lobby-player-card"><button class="lobby-player-main" data-lobby-profile="${m.id}"><div class="lobby-player-avatar">${avatarMarkup(m)}</div><div class="lobby-player-copy"><strong>${esc(m.realName)}${m.id===selfId?' (vos)':''}</strong><span>listo</span></div>${m.id===state.adminId?'<b class="lobby-admin-tag">ADMIN</b>':''}</button>${isAdmin&&m.id!==selfId?`<button class="lobby-kick-user" data-lobby-kick="${m.id}" title="Echar de la sala">Echar</button>`:''}</div>`).join('');
    playersBox.querySelectorAll('[data-lobby-profile]').forEach(b=>b.onclick=()=>b.dataset.lobbyProfile===selfId?showPrivateCard():showPublicProfile(b.dataset.lobbyProfile));
    playersBox.querySelectorAll('[data-lobby-kick]').forEach(b=>b.onclick=()=>{const m=state.members[b.dataset.lobbyKick];if(m&&confirm(`¿Echar a ${m.realName} de la sala?`))kickLobbyMember(b.dataset.lobbyKick);});
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
  if(state.mode==='incognito'&&state.started&&isAdmin){state.chatSeq=Number(state.chatSeq||0)+1;msg.seq=state.chatSeq;msg.canonical=true;}
  if(!state.messages.some(m=>m.id===msg.id))state.messages.push(msg);
  if(isAdmin&&joined) send('system',msg).catch(()=>{});
  renderMessages();
}
function onSystem(payload,cid){
  const text=payload?.text||''; if(!text)return;
  const msg={id:payload.id||uid(),system:true,text,ts:Number(payload.ts||now()),seq:Number(payload.seq||0),canonical:payload.canonical===true};
  if(state.messages.some(m=>m.id===msg.id))return;
  state.messages.push(msg);
  if(state.mode==='incognito')state.messages.sort((a,b)=>Number(a.seq||0)-Number(b.seq||0)||Number(a.ts||0)-Number(b.ts||0));
  renderMessages();
}
function onChat(msg,cid){
  if(!msg?.id||state.messages.some(m=>m.id===msg.id))return;
  const canonicalIncognito=state.mode==='incognito'&&msg.canonical===true;
  const senderId=canonicalIncognito?(msg.senderId||cid):cid;
  const sender=state.members[senderId]; msg.senderId=senderId; msg.senderName=msg.senderName||displayName(sender); state.messages.push(msg);
  if(state.mode==='incognito') state.messages.sort((a,b)=>Number(a.seq||0)-Number(b.seq||0)||Number(a.ts||0)-Number(b.ts||0));
  else state.messages.sort((a,b)=>a.ts-b.ts);
  renderMessages();
}
function onChatSubmit(msg,cid){
  if(!isAdmin||state.mode!=='incognito'||!state.started||!msg?.id||!msg?.text)return;
  const sender=state.members[cid]; if(!sender||sender.online===false||sender.spectator||sender.muted)return;
  if(state.messages.some(m=>m.id===msg.id))return;
  state.chatSeq=Number(state.chatSeq||0)+1;
  const canonical={id:msg.id,senderId:cid,senderName:displayName(sender),text:String(msg.text||'').slice(0,1000),ts:now(),seq:state.chatSeq,canonical:true,replyTo:msg.replyTo||null,reactions:{}};
  state.messages.push(canonical); renderMessages(); send('chat',canonical).catch(()=>{});
}
function sendChat(){
  if(state.chatDisabled||me()?.muted){toast('El chat está deshabilitado.');return;}
  const input=$('messageInput'); const text=input?.value.trim(); if(!text)return;
  input.value=''; const msg={id:uid(),senderId:selfId,senderName:displayName(me()),text:text.slice(0,1000),ts:now(),replyTo:replyingTo?{id:replyingTo.id,senderName:replyingTo.senderName,text:replyingTo.text.slice(0,120)}:null,reactions:{}};
  replyingTo=null; renderComposerReply();
  if(state.mode==='incognito'&&state.started){
    if(isAdmin)onChatSubmit(msg,selfId); else send('chat-submit',msg,state.adminId).catch(()=>toast('No se pudo enviar'));
    return;
  }
  state.messages.push(msg); renderMessages(); send('chat',msg).catch(()=>toast('No se pudo enviar'));
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
  Object.entries(state.members).filter(([,m])=>m.online!==false).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)).forEach(([id,m])=>{
    const d=document.createElement('button'); d.className='participant social-participant';
    const status=m.spectator?'espectador':m.online===false?'desconectado':state.mode==='incognito'&&m.persona?m.occupation:'en línea';
    d.innerHTML=`<div class="participant-avatar">${avatarMarkup(m)}</div><div class="participant-copy"><strong>${esc(displayName(m))}${id===selfId?' (vos)':''}</strong><span>${esc(status)}</span>${renderPublicVoteSummary(id)}</div>${!state.started&&id===state.adminId?'<span class="host-badge">ADMIN</span>':''}`;
    d.onclick=()=>onMemberClick(id); box.appendChild(d);
  });
}
function renderPublicVoteSummary(targetId){
  if(state.mode==='mixed'&&state.started&&!state.final){
    const count=mixedTargetVoteCount(targetId);
    if(count) return `<small class="public-votes">🗳️ ${count} voto${count===1?'':'s'} emitido${count===1?'':'s'}</small>`;
  }
  if(state.mode==='incognito'&&state.started&&!state.final&&state.phase==='playing'){
    const count=incognitoTargetVoteCount(targetId);
    if(count)return `<small class="public-votes">🗳️ ${count} voto${count===1?'':'s'} emitido${count===1?'':'s'}</small>`;
  }
  return '';
}
function onMemberClick(id){
  if(id===selfId){showPrivateCard();return;}
  if(state.mode==='mixed'&&state.started&&!state.final){openGuess(id);return;}
  if(state.mode==='incognito'&&state.started&&!state.final&&state.phase==='playing'){openIncognitoGuess(id);return;}
  if(state.mode==='spyfall'&&state.started&&!state.final&&state.spyfall?.voting&&!privateInfo?.isSpy){castSpyVote(id);return;}
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
  if(state.mode==='mixed'&&!state.final){
    const submitted=mixedSubmittedVotes(),required=mixedRequiredVotes();
    if(state.mixedVoting?.closing){
      const left=Math.max(0,Math.ceil((Number(state.mixedVoting.deadline||0)-now())/1000));
      const text=state.mixedVoting.reason==='all'?'Todos votaron. Tenés 20 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 20 segundos para votar o cambiar tu voto.';
      html+=`<div class="mixed-countdown"><span>${esc(text)}</span><strong>${left}</strong></div>`;
    }else{
      html+=`<div class="game-help">Los votos son privados. Tocá un usuario para elegir quién creés que es. ${submitted}/${required} votos emitidos.</div>`;
      if(isAdmin)html+=`<button id="finalMixedBtn" class="banner-btn">Finalizar votación</button>`;
    }
  }
  if(state.mode==='mixed'&&state.final) html+=`<button id="showScoresBtn" class="banner-btn">Ver resultado</button>`;
  if(state.mode==='incognito'&&!state.final&&state.phase==='playing'){
    const submitted=incognitoSubmittedVotes(),required=incognitoRequiredVotes();
    if(state.incognitoVoting?.closing){
      const left=Math.max(0,Math.ceil((Number(state.incognitoVoting.deadline||0)-now())/1000));
      const text=state.incognitoVoting.reason==='all'?'Todos votaron. Tenés 20 segundos para cambiar tu voto.':'Ronda cerrada. Tenés 20 segundos para votar o cambiar tu voto.';
      html+=`<div class="mixed-countdown"><span>${esc(text)}</span><strong>${left}</strong></div>`;
    }else{
      html+=`<div class="game-help">Tocá a los demás personajes para adivinar quién es quién. Los votos son privados. ${submitted}/${required} votos emitidos.</div>`;
      if(isAdmin)html+=`<button id="revealIncognitoBtn" class="banner-btn">Finalizar votación</button>`;
    }
  }
  if(state.mode==='incognito'&&state.final) html+=`<button id="showIncognitoBtn" class="banner-btn">Ver resultados</button>`;
  if(state.mode==='spyfall'&&!state.final){
    const turnId=currentSpyTurnId(),turn=state.members[turnId];
    if(privateInfo?.isSpy&&state.spyfall?.locationWindow){
      const left=Math.max(0,Math.ceil((Number(state.spyfall.deadline||0)-now())/1000));
      html+=`<div class="mixed-countdown"><span>Tenés 10 segundos para elegir en qué lugar están.</span><strong>${left}</strong></div>`;
      if(state.spyfall.spyGuessSubmitted)html+=`<div class="game-help">Elegiste “${esc(state.spyfall.spyLocationGuess||'—')}”. Esperá el resultado.</div>`;
      else html+=`<button id="spyGuessBtn" class="banner-btn">Elegir lugar</button>`;
    }else if(state.spyfall?.voting&&!privateInfo?.isSpy){
      const left=Math.max(0,Math.ceil((Number(state.spyfall.deadline||0)-now())/1000));
      html+=`<div class="mixed-countdown"><span>Votación final. Tenés 10 segundos para votar o cambiar tu voto.</span><strong>${left}</strong></div><div class="game-help">Tocá el nombre de quien creés que es el espía. El voto es privado.</div>`;
    }else{
      html+=`<div class="spy-turn-banner"><span>ES EL TURNO DE</span><strong>${esc(turn?displayName(turn):'—')}</strong><small>para hacer una pregunta</small></div>`;
      if(turnId===selfId)html+=`<button id="askSpyQuestionBtn" class="banner-btn">Elegir a quién preguntar</button>`;
    }
  }
  if(state.mode==='spyfall'&&isAdmin&&!state.final&&!state.spyfall?.voting) html+=`<button id="finalSpyBtn" class="banner-btn">Votación final</button>`;
  b.innerHTML=html;
  $('myCharacterBtn')?.addEventListener('click',showPrivateCard); $('finalMixedBtn')?.addEventListener('click',finalizeMixed); $('showScoresBtn')?.addEventListener('click',showScoreboard); $('revealIncognitoBtn')?.addEventListener('click',finalizeIncognito); $('showIncognitoBtn')?.addEventListener('click',showIncognitoReveal); $('spyGuessBtn')?.addEventListener('click',guessSpyLocation); $('askSpyQuestionBtn')?.addEventListener('click',openSpyQuestionPicker); $('finalSpyBtn')?.addEventListener('click',beginSpyFinalVoting);
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
    const targetVisual={avatar:privateInfo?.targetAvatar||m.avatar,publicName:privateInfo?.targetName||displayName(m),realName:privateInfo?.targetName||displayName(m)};
    showModal('Tu papel secreto',`<div class="private-character"><div class="secret-emoji">🔀</div><span>Vos sos realmente</span><strong>${esc(privateInfo?.realName||m.realName)}</strong><span>Durante esta partida tenés que interpretar a</span><div class="profile-big">${avatarMarkup(targetVisual)}</div><h2>${esc(privateInfo?.targetName||displayName(m))}</h2><p>Escribí, opiná y reaccioná como pensás que lo haría esa persona. El resto intenta descubrir quién está detrás.</p></div>`); return;
  }
  if(state.mode==='incognito'){
    const p=m.persona; if(!p){toast('Todavía estás eligiendo personaje.');return;}
    showModal('Tu identidad de incógnito',`<div class="private-character"><div class="profile-big">${avatarMarkup(m)}</div><h2>${esc(p.name)}</h2><strong>${esc(p.occupation)}</strong><p>${esc(p.detail)}</p><small>Tu nombre real: ${esc(m.realName)}</small></div>`); return;
  }
  if(state.mode==='spyfall'){
    const canGuess=spyLocationWindowOpen();
    const html=privateInfo?.isSpy?`<div class="private-character spy"><div class="secret-emoji">🕵️</div><h2>SOS EL ESPÍA</h2><p>No conocés el lugar. Hacé preguntas, mezclate y tratá de deducirlo.</p>${canGuess?'<button id="spyGuessInside" class="primary-btn">Elegir lugar ahora</button>':'<small>Cuando empiece la votación final vas a tener 10 segundos para elegir el lugar.</small>'}</div>`:`<div class="private-character"><div class="secret-emoji">📍</div><span>Ubicación</span><h2>${esc(privateInfo?.location||'—')}</h2><span>Tu rol</span><strong>${esc(privateInfo?.role||'—')}</strong><p>Respondé sin decir el lugar de forma demasiado obvia.</p></div>`;
    showModal('Tu información secreta',html,()=>{$('spyGuessInside')?.addEventListener('click',()=>{closeGenericModal();guessSpyLocation();});});
  }
}

function showModal(title,html,after){ const m=$('genericModal'); $('genericModalTitle').textContent=title; $('genericModalBody').innerHTML=html; m.classList.remove('hidden'); after?.(m); }
function closeGenericModal(){ $('genericModal')?.classList.add('hidden'); }
function leaveRoom(){ try{transportRoom?.leave?.();}catch{} location.reload(); }
function backToLobby(){
  if(!joined)return;
  if(!state.started){enterLobby();renderAll();return;}
  if(!confirm('¿Volver al lobby? La partida actual terminará para todos.'))return;
  if(isAdmin)returnEveryoneToLobby('La partida volvió al lobby.');
  else send('return-lobby-request',{},state.adminId).then(()=>toast('Volviendo al lobby…')).catch(()=>toast('No pude volver al lobby.'));
}
function onReturnLobbyRequest(p,cid){
  if(!isAdmin||!state.started||!state.members[cid]||state.members[cid].online===false)return;
  returnEveryoneToLobby('La partida volvió al lobby.');
}

$('createRoomBtn')?.addEventListener('click',createRoom);
$('joinRoomBtn')?.addEventListener('click',joinRoom);
$('joinCode')?.addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('lobbyChatSend')?.addEventListener('click',sendLobbyChat);
$('lobbyChatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendLobbyChat();}});
$('lobbyCopyCode')?.addEventListener('click',()=>navigator.clipboard?.writeText(roomCode).then(()=>toast('Código copiado')));
$('lobbyStartBtn')?.addEventListener('click',startGame);
$('lobbyChangeAvatarBtn')?.addEventListener('click',openAvatarPicker);
$('lobbyLeaveBtn')?.addEventListener('click',leaveRoom);
$('messengerBackBtn')?.addEventListener('click',backToLobby);
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
setInterval(()=>{if(joined&&roomCode)for(const id of [...superadminPeers])sendSuperadminState(id);},3000);
const superadminNotice=sessionStorage.getItem('eltopo-superadmin-notice'); if(superadminNotice){sessionStorage.removeItem('eltopo-superadmin-notice'); if($('landingError'))$('landingError').textContent=superadminNotice;}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&joined){ sendIntro(); renderAll(); } });
