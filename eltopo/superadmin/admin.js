const PUBLISHABLE_KEY='pk_live_f3999f9364b91c8c878fe6d646063389eee28486';
const CHANNEL='topo-global-v1';
const ADAPTER_MARK='eltopo-metered-v1';
const APP_MARK='mattgames-social-whatsapp-v1';
const SOCIAL_ACTION='social7';
const PASSWORD_HASH='f52acce5d5e525dc7e108db0f97651448ec60c0e773863cf2ead2f5aa337bf6c';
const ADMIN_PROOF=PASSWORD_HASH;
const ADMIN_LOGICAL_ID=`superadmin${crypto.randomUUID().replace(/-/g,'').slice(0,14)}`;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let peer=null;
let connected=false;
const clients=new Map(); // meteredId -> info
const logicalToMetered=new Map();
const aliases=loadAliases();

function loadAliases(){try{return JSON.parse(localStorage.getItem('eltopo-superadmin-aliases-v1')||'{}')}catch{return {}}}
function saveAliases(){localStorage.setItem('eltopo-superadmin-aliases-v1',JSON.stringify(aliases));}
function toast(text){const e=$('toast');if(!e)return;e.textContent=text;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),2200)}
function status(text,kind='wait'){const e=$('connectionState');if(!e)return;e.textContent=text;e.className=`status ${kind}`;}
function toHex(buffer){return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function sha256(text){return toHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const hash=await sha256($('password').value);
  if(hash!==PASSWORD_HASH){$('loginError').textContent='Contraseña incorrecta.';$('password').select();return;}
  sessionStorage.setItem('eltopo-superadmin-unlocked','1');
  unlock();
});
$('logoutBtn').addEventListener('click',()=>{sessionStorage.removeItem('eltopo-superadmin-unlocked');location.reload();});

function unlock(){
  $('loginView').classList.add('hidden');
  $('dashboardView').classList.remove('hidden');
  connect();
}
if(sessionStorage.getItem('eltopo-superadmin-unlocked')==='1')unlock();

function sdkClass(){return globalThis.MeteredPeer?.MeteredPeer||null;}
function adminIntro(){return {__adapter:ADAPTER_MARK,kind:'intro',logicalId:ADMIN_LOGICAL_ID};}
async function sendAdminIntro(meteredId){try{await peer?.sendTo(meteredId,adminIntro());}catch{}}

async function connect(){
  if(connected||peer)return;
  const MeteredPeer=sdkClass();
  if(!MeteredPeer){status('SDK no cargó','error');return;}
  status('Conectando…','wait');
  peer=new MeteredPeer({apiKey:PUBLISHABLE_KEY});
  peer.on('state-change',({to})=>{
    if(to==='joined'){connected=true;status('En vivo','ok');}
    else if(to==='closed'){connected=false;status('Desconectado','error');}
    else if(to==='reconnecting')status('Reconectando…','wait');
  });
  peer.on('peer-joined',({peer:remote})=>{
    const info={meteredId:remote.id,remote,logicalId:null,room:null,name:null,avatar:null,version:null,isAdmin:false,lastSeen:Date.now(),ip:null,candidateType:null,route:'conectando'};
    clients.set(remote.id,info);
    wireRemote(info);
    sendAdminIntro(remote.id);
    render();
  });
  peer.on('peer-left',({peer:remote})=>{
    const info=clients.get(remote.id);
    if(info?.logicalId)logicalToMetered.delete(info.logicalId);
    clients.delete(remote.id);
    render();
  });
  peer.on('data',({senderPeerId,data})=>onData(senderPeerId,data));
  peer.on('error',({err})=>{console.error('[ElTopo Superadmin]',err);status('Error de conexión','error');});
  try{await peer.join(CHANNEL);connected=true;status('En vivo','ok');}
  catch(err){console.error(err);status('No pudo conectar','error');}
}

function wireRemote(info){
  const remote=info.remote;
  remote.on?.('state-change',({to})=>{info.route=to||info.route;if(to==='connected')refreshNetwork(info);render();});
  remote.on?.('connection-reset',()=>{info.route='reconectando';render();});
  refreshNetwork(info);
}

async function selectedCandidate(remote){
  try{
    const stats=await remote.pc?.getStats?.(); if(!stats)return null;
    let pair=null;
    stats.forEach(r=>{if(r.type==='transport'&&r.selectedCandidatePairId)pair=stats.get(r.selectedCandidatePairId)||pair;});
    if(!pair)stats.forEach(r=>{if(r.type==='candidate-pair'&&r.state==='succeeded'&&(r.nominated||r.selected))pair=r;});
    if(!pair)return null;
    const rc=stats.get(pair.remoteCandidateId); if(!rc)return null;
    return {address:rc.address||rc.ip||rc.ipAddress||null,type:rc.candidateType||'unknown',protocol:rc.protocol||''};
  }catch{return null;}
}
async function refreshNetwork(info){
  const c=await selectedCandidate(info.remote);
  if(!c)return;
  info.ip=c.address;
  info.candidateType=c.type;
  info.protocol=c.protocol;
  info.route=c.type==='relay'?'TURN relay':'directo';
  render();
}
setInterval(()=>{for(const info of clients.values())refreshNetwork(info);},3500);

function onData(senderPeerId,data){
  if(!data||data.__adapter!==ADAPTER_MARK)return;
  const info=clients.get(senderPeerId)||{meteredId:senderPeerId,remote:null,lastSeen:Date.now()};
  clients.set(senderPeerId,info); info.lastSeen=Date.now();
  if(data.logicalId){
    info.logicalId=data.logicalId;
    logicalToMetered.set(data.logicalId,senderPeerId);
  }
  if(data.kind==='intro'){
    sendAdminIntro(senderPeerId);
    render();
    return;
  }
  if(data.kind!=='action'||data.action!==SOCIAL_ACTION)return;
  const env=data.payload;
  if(!env||env.__app!==APP_MARK)return;
  info.room=env.room||info.room;
  if(env.from){info.logicalId=env.from;logicalToMetered.set(env.from,senderPeerId);}
  if(env.type==='intro'){
    const p=env.payload||{};
    info.logicalId=p.clientId||info.logicalId;
    info.name=String(p.name||'Jugador').slice(0,40);
    info.avatar=p.avatar||null;
    info.version=p.version||null;
    info.isAdmin=!!p.admin;
    if(info.logicalId)logicalToMetered.set(info.logicalId,senderPeerId);
  }
  render();
}

function roomGroups(){
  const groups=new Map();
  for(const c of clients.values()){
    if(!c.room||!c.logicalId||!c.name)continue;
    if(!groups.has(c.room))groups.set(c.room,[]);
    groups.get(c.room).push(c);
  }
  return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function identifiedClients(){return [...clients.values()].filter(c=>c.room&&c.logicalId&&c.name);}
function unknownClients(){return [...clients.values()].filter(c=>!c.room||!c.logicalId||!c.name);}

function networkHtml(c){
  if(!c.ip)return `<span class="net-main">No expuesta</span><span class="net-sub">${esc(c.route||'RTC')}</span>`;
  if(c.candidateType==='relay')return `<span class="net-main">${esc(c.ip)}</span><span class="net-sub">TURN relay · no es IP real del jugador</span>`;
  return `<span class="net-main">${esc(c.ip)}</span><span class="net-sub">${esc(c.candidateType||'RTC')} ${esc(c.protocol||'')}</span>`;
}
function render(){
  const groups=roomGroups(),identified=identifiedClients(),unknown=unknownClients();
  $('roomCount').textContent=groups.length;
  $('playerCount').textContent=identified.length;
  $('unknownCount').textContent=unknown.length;
  $('rooms').innerHTML=groups.length?groups.map(([room,list])=>roomHtml(room,list)).join(''):'<div class="notice"><strong>Sin salas activas</strong><span>Cuando alguien entre a El Topo aparecerá acá en tiempo real.</span></div>';
  $('unknownPeers').classList.toggle('hidden',!unknown.length);
  $('unknownList').innerHTML=unknown.map(c=>`<div class="unknown-peer">${esc(c.logicalId||c.meteredId)} · esperando identificación del juego…</div>`).join('');
  bindRows();
}
function roomHtml(room,list){
  const sorted=[...list].sort((a,b)=>(b.isAdmin?1:0)-(a.isAdmin?1:0)||(a.name||'').localeCompare(b.name||''));
  return `<article class="room-card"><header class="room-head"><div class="room-title"><span>🎮</span><div><div class="room-code">${esc(room)}</div><div class="room-meta">${sorted.length} jugador${sorted.length===1?'':'es'} activo${sorted.length===1?'':'s'}</div></div></div></header><table class="player-table"><thead><tr><th>Jugador</th><th>Alias privado</th><th>IP WebRTC</th><th>Conexión</th><th>Acciones</th></tr></thead><tbody>${sorted.map(playerRow).join('')}</tbody></table></article>`;
}
function playerRow(c){
  const key=c.logicalId||c.meteredId; const alias=aliases[key]||'';
  return `<tr data-client="${esc(c.meteredId)}"><td data-label="Jugador"><div class="player-main"><strong>${esc(c.name||'Jugador')} ${c.isAdmin?'<span class="pill admin">ADMIN SALA</span>':''}</strong><small>${esc(c.logicalId||c.meteredId)}${c.version?` · v${esc(c.version)}`:''}</small></div></td><td data-label="Alias privado"><input class="alias-input" data-alias="${esc(key)}" value="${esc(alias)}" placeholder="Ej. Dani celu"></td><td data-label="IP WebRTC">${networkHtml(c)}</td><td data-label="Conexión"><span class="pill ${c.candidateType==='relay'?'relay':c.ip?'direct':'unknown'}">${esc(c.route||'RTC')}</span></td><td data-label="Acciones"><div class="row-actions"><button class="rename" data-rename="${esc(c.meteredId)}">Cambiar nombre</button><button class="kick" data-kick="${esc(c.meteredId)}">Echar</button></div></td></tr>`;
}
function bindRows(){
  document.querySelectorAll('[data-alias]').forEach(input=>input.addEventListener('change',()=>{aliases[input.dataset.alias]=input.value.trim();if(!aliases[input.dataset.alias])delete aliases[input.dataset.alias];saveAliases();toast('Alias guardado');}));
  document.querySelectorAll('[data-rename]').forEach(btn=>btn.addEventListener('click',()=>renameClient(btn.dataset.rename)));
  document.querySelectorAll('[data-kick]').forEach(btn=>btn.addEventListener('click',()=>kickClient(btn.dataset.kick)));
}

async function sendCommand(c,command,value=''){
  if(!peer||!c?.meteredId||!c?.logicalId||!c?.room)throw new Error('Cliente no identificado');
  const social={__app:APP_MARK,room:c.room,type:'superadmin-command',from:ADMIN_LOGICAL_ID,payload:{proof:ADMIN_PROOF,command,targetId:c.logicalId,value},ts:Date.now()};
  const outer={__adapter:ADAPTER_MARK,kind:'action',action:SOCIAL_ACTION,logicalId:ADMIN_LOGICAL_ID,payload:social};
  await peer.sendTo(c.meteredId,outer);
}
async function renameClient(meteredId){
  const c=clients.get(meteredId); if(!c)return;
  const value=prompt(`Nuevo nombre para ${c.name}:`,c.name||'');
  if(value===null)return;
  const name=value.trim().slice(0,20); if(!name)return;
  try{await sendCommand(c,'rename',name);c.name=name;render();toast('Renombre enviado');}catch(e){toast(`Error: ${e.message}`);}
}
async function kickClient(meteredId){
  const c=clients.get(meteredId); if(!c)return;
  if(!confirm(`¿Echar a ${c.name||'este jugador'} de la sala ${c.room}?`))return;
  try{await sendCommand(c,'kick');toast('Expulsión enviada');}catch(e){toast(`Error: ${e.message}`);}
}

render();