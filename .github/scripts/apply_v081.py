from pathlib import Path
from PIL import Image, ImageOps

root = Path('eltopo')

# 1) Preserve originals and generate web-friendly 512x512 copies.
src_dir = root / 'portraits'
dst_dir = root / 'portraits-web'
dst_dir.mkdir(exist_ok=True)
for src in sorted(src_dir.glob('*.jpg')):
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        im = ImageOps.fit(im, (512, 512), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        im.save(dst_dir / src.name, 'JPEG', quality=78, optimize=True, progressive=True, subsampling=2)

# 2) Point runtime at optimized copies.
game_data = root / 'game-data.js'
gd = game_data.read_text(encoding='utf-8')
old = "file:`./portraits/${id}.jpg`"
new = "file:`./portraits-web/${id}.jpg`"
if old not in gd and new not in gd:
    raise SystemExit('Could not locate avatar file template in game-data.js')
gd = gd.replace(old, new)
game_data.write_text(gd, encoding='utf-8')

# 3) Main game fixes.
game = root / 'social-game.js'
s = game.read_text(encoding='utf-8')
s = s.replace("import { AVATARS } from './game-data.js';", "import { AVATARS } from './game-data.js?v=0.8.1';")
s = s.replace("const VERSION = '0.8.0';", "const VERSION = '0.8.1';")
s = s.replace("let returnLobbyTimer = null;", "let returnLobbyTimer = null;\nlet lastMixedIntroTrigger = '';")

old_status = """function setConnectStatus(text, kind='wait'){
  const e=$('connectionBadge'); if(!e)return;
  e.textContent=`v${VERSION} · ${text}`;
  e.className=`connection-badge ${kind}`;
}
function updateConnectionBadge(){
  const n=onlineMembers().length || (joined?1:0);
  setConnectStatus(`${joined?'Metered online':'conectando'} · ${n} jugador${n===1?'':'es'}`, joined?'ok':'wait');
}"""
new_status = """function setConnectStatus(){
  const e=$('connectionBadge'); if(!e)return;
  e.textContent=`v${VERSION}`;
  e.className='connection-badge';
}
function updateConnectionBadge(){ setConnectStatus(); }"""
if old_status not in s:
    raise SystemExit('Could not locate connection badge block')
s = s.replace(old_status, new_status)

old_mixed = """function startMixed(ids){
  const assigned=derangement(ids);
  state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.trigger=pick(TRIGGERS); state.messages=[]; replyingTo=null; enterMessenger();
  ids.forEach((actorId,i)=>{
    const targetId=assigned[i]; const targetName=state.members[targetId].realName;
    state.members[actorId].publicName=targetName;
    state.members[actorId].spectator=false;
    const info={mode:'mixed',targetName,targetId,realName:state.members[actorId].realName};
    if(actorId===selfId){ privateInfo=info; showPrivateCard(); }
    else send('mixed-private',info,actorId).catch(()=>{});
  });
  send('start-mixed',{publicState:snapshotForClient()}).catch(()=>{});
  addSystem('🔀 Todo mezclado comenzó. Cada persona recibió a quién debe interpretar.');
  addSystem(`💬 Disparador: ${state.trigger}`);
  renderAll();
}
function onStartMixed(p){ if(!p?.publicState)return; state=p.publicState; enterMessenger(); renderAll(); }
function onMixedPrivate(p){ privateInfo=p; showPrivateCard(); }"""
new_mixed = """function startMixed(ids){
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
}"""
if old_mixed not in s:
    raise SystemExit('Could not locate Todo mezclado start block')
s = s.replace(old_mixed, new_mixed)

s = s.replace(
    "privateInfo=null; personaOptions=null; replyingTo=null; selectedMode=state.mode||selectedMode;",
    "privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger=''; selectedMode=state.mode||selectedMode;"
)
s = s.replace(
    "state=p.state; selectedMode=state.mode||selectedMode; privateInfo=null; personaOptions=null; replyingTo=null;",
    "state=p.state; selectedMode=state.mode||selectedMode; privateInfo=null; personaOptions=null; replyingTo=null; lastMixedIntroTrigger='';"
)
game.write_text(s, encoding='utf-8')

# 4) Version/cache busting.
index = root / 'index.html'
h = index.read_text(encoding='utf-8').replace('0.8.0', '0.8.1')
index.write_text(h, encoding='utf-8')

helper = root / 'mixed-avatar-sync.js'
mh = helper.read_text(encoding='utf-8').replace("const BUILD_VERSION = '0.8.0';", "const BUILD_VERSION = '0.8.1';")
helper.write_text(mh, encoding='utf-8')

# 5) Version badge: left, version only. Larger mixed-game opener.
css = root / 'social.css'
c = css.read_text(encoding='utf-8')
c = c.replace(
    '.connection-badge{position:fixed;right:8px;bottom:7px;',
    '.connection-badge{position:fixed;left:8px;right:auto;bottom:7px;'
)
if '.mixed-start-modal{' not in c:
    c += """
.mixed-start-modal{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:8px 2px 2px}.mixed-start-kicker{font-size:11px;font-weight:800;letter-spacing:.1em;color:var(--muted)}.mixed-start-modal h2{font-size:28px;margin:0 0 4px}.mixed-trigger-card{width:100%;background:#f3fff9;border:2px solid var(--wa);border-radius:14px;padding:18px 16px;display:flex;flex-direction:column;gap:8px}.mixed-trigger-card span{font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--wa-dark)}.mixed-trigger-card strong{font-size:clamp(20px,3vw,30px);line-height:1.25}.mixed-start-modal .primary-btn{margin-top:4px;min-width:190px}
"""
css.write_text(c, encoding='utf-8')

files = list(dst_dir.glob('*.jpg'))
total = sum(p.stat().st_size for p in files)
print(f'{len(files)} optimized portraits, {total/1024:.1f} KiB total, {total/max(len(files),1)/1024:.1f} KiB avg')
