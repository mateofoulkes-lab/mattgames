from pathlib import Path

root = Path('eltopo')
game_path = root / 'social-game.js'
s = game_path.read_text(encoding='utf-8')

s = s.replace("import { AVATARS } from './game-data.js?v=0.8.2';", "import { AVATARS } from './game-data.js?v=0.8.3';")
s = s.replace("const VERSION = '0.8.2';", "const VERSION = '0.8.3';")
s = s.replace("'Alguien del grupo ganó una suma importante de dinero y propone gastarla entre todos. ¿En qué?',", "'{player} ganó una suma importante de dinero y propone gastarla entre todos. ¿En qué?',")

old_derangement = """function derangement(ids){
  if(ids.length<2)return ids;
  for(let tries=0;tries<100;tries++){ const s=shuffle(ids); if(s.every((x,i)=>x!==ids[i]))return s; }
  return [...ids.slice(1),ids[0]];
}
function startMixed(ids){"""
new_derangement = """function derangement(ids){
  if(ids.length<2)return ids;
  for(let tries=0;tries<100;tries++){ const s=shuffle(ids); if(s.every((x,i)=>x!==ids[i]))return s; }
  return [...ids.slice(1),ids[0]];
}
function personalizeMixedTrigger(template,identities){
  const names=Object.values(identities||{}).map(x=>x?.name).filter(Boolean);
  const chosen=names.length?pick(names):'Alguien del grupo';
  return String(template||'').replaceAll('{player}',chosen);
}
function startMixed(ids){"""
if old_derangement not in s:
    raise SystemExit('Could not locate derangement/startMixed boundary')
s = s.replace(old_derangement, new_derangement, 1)

old_state = "state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.trigger=pick(TRIGGERS); state.messages=[]; replyingTo=null; lastMixedIntroTrigger='';"
new_state = "state.started=true; state.phase='playing'; state.mode='mixed'; state.final=false; state.scores=null; state.guesses={}; state.reveal=null; state.mixedVoting={closing:false,deadline:0,reason:''}; state.trigger=personalizeMixedTrigger(pick(TRIGGERS),identities); state.messages=[]; replyingTo=null; lastMixedIntroTrigger='';"
if old_state not in s:
    raise SystemExit('Could not locate mixed state initialization')
s = s.replace(old_state, new_state, 1)

old_info = "const info={mode:'mixed',targetName:target.name,targetId,realName:state.members[actorId].realName};"
new_info = "const info={mode:'mixed',targetName:target.name,targetAvatar:target.avatar,targetId,realName:state.members[actorId].realName};"
if old_info not in s:
    raise SystemExit('Could not locate mixed private info payload')
s = s.replace(old_info, new_info, 1)

old_intro = """function maybeShowMixedIntro(){
  if(state.mode!=='mixed'||!state.started||privateInfo?.mode!=='mixed'||!state.trigger||lastMixedIntroTrigger===state.trigger)return;
  lastMixedIntroTrigger=state.trigger;
  showModal('Todo mezclado',`<div class=\"mixed-start-modal\"><span class=\"mixed-start-kicker\">VAS A INTERPRETAR A</span><h2>${esc(privateInfo.targetName||'—')}</h2><div class=\"mixed-trigger-card\"><span>DISPARADOR DE CONVERSACIÓN</span><strong>${esc(state.trigger)}</strong></div><button id=\"mixedStartClose\" class=\"primary-btn\">Empezar a chatear</button></div>`,()=>{$('mixedStartClose')?.addEventListener('click',closeGenericModal);});
}"""
new_intro = """function maybeShowMixedIntro(){
  if(state.mode!=='mixed'||!state.started||privateInfo?.mode!=='mixed'||!state.trigger||lastMixedIntroTrigger===state.trigger)return;
  lastMixedIntroTrigger=state.trigger;
  const targetVisual={avatar:privateInfo.targetAvatar,publicName:privateInfo.targetName,realName:privateInfo.targetName};
  showModal('Todo mezclado',`<div class=\"mixed-start-modal\"><span class=\"mixed-start-kicker\">VAS A INTERPRETAR A</span><div class=\"profile-big\">${avatarMarkup(targetVisual)}</div><h2>${esc(privateInfo.targetName||'—')}</h2><div class=\"mixed-trigger-card\"><span>DISPARADOR DE CONVERSACIÓN</span><strong>${esc(state.trigger)}</strong></div><button id=\"mixedStartClose\" class=\"primary-btn\">Empezar a chatear</button></div>`,()=>{$('mixedStartClose')?.addEventListener('click',closeGenericModal);});
}"""
if old_intro not in s:
    raise SystemExit('Could not locate mixed intro modal')
s = s.replace(old_intro, new_intro, 1)

old_private = """  if(state.mode==='mixed'){
    showModal('Tu papel secreto',`<div class=\"private-character\"><div class=\"secret-emoji\">🔀</div><span>Vos sos realmente</span><strong>${esc(privateInfo?.realName||m.realName)}</strong><span>Durante esta partida tenés que interpretar a</span><h2>${esc(privateInfo?.targetName||displayName(m))}</h2><p>Escribí, opiná y reaccioná como pensás que lo haría esa persona. El resto intenta descubrir quién está detrás.</p></div>`); return;
  }"""
new_private = """  if(state.mode==='mixed'){
    const targetVisual={avatar:privateInfo?.targetAvatar||m.avatar,publicName:privateInfo?.targetName||displayName(m),realName:privateInfo?.targetName||displayName(m)};
    showModal('Tu papel secreto',`<div class=\"private-character\"><div class=\"secret-emoji\">🔀</div><span>Vos sos realmente</span><strong>${esc(privateInfo?.realName||m.realName)}</strong><span>Durante esta partida tenés que interpretar a</span><div class=\"profile-big\">${avatarMarkup(targetVisual)}</div><h2>${esc(privateInfo?.targetName||displayName(m))}</h2><p>Escribí, opiná y reaccioná como pensás que lo haría esa persona. El resto intenta descubrir quién está detrás.</p></div>`); return;
  }"""
if old_private not in s:
    raise SystemExit('Could not locate mixed private card')
s = s.replace(old_private, new_private, 1)

game_path.write_text(s, encoding='utf-8')

index_path = root / 'index.html'
h = index_path.read_text(encoding='utf-8').replace('0.8.2', '0.8.3')
index_path.write_text(h, encoding='utf-8')

sync_path = root / 'mixed-avatar-sync.js'
m = sync_path.read_text(encoding='utf-8').replace("const BUILD_VERSION = '0.8.2';", "const BUILD_VERSION = '0.8.3';")
sync_path.write_text(m, encoding='utf-8')
