from pathlib import Path

GAME = Path('eltopo/social-game.js')
INDEX = Path('eltopo/index.html')
SYNC = Path('eltopo/mixed-avatar-sync.js')

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing block: {label}')
    return text.replace(old, new, 1)

s = GAME.read_text(encoding='utf-8')
s = replace_once(s, "import { AVATARS } from './game-data.js?v=0.8.3';", "import { AVATARS } from './game-data.js?v=0.8.4';", 'game-data cache')
s = replace_once(s, "const VERSION = '0.8.3';\nconst APP_MARK", "const VERSION = '0.8.4';\nconst SUPERADMIN_PROOF = 'f52acce5d5e525dc7e108db0f97651448ec60c0e773863cf2ead2f5aa337bf6c';\nconst APP_MARK", 'version/proof')
s = replace_once(s,
"    case 'spy-guess-location': return onSpyGuessLocation(data.payload,cid);\n    case 'system': return addSystem(data.payload?.text||'');",
"    case 'spy-guess-location': return onSpyGuessLocation(data.payload,cid);\n    case 'superadmin-command': return onSuperadminCommand(data.payload,cid);\n    case 'system': return addSystem(data.payload?.text||'');",
'command route')
anchor = "function onIntro(cid,p){\n"
handler = """function onSuperadminCommand(p,cid){
  if(!p||p.proof!==SUPERADMIN_PROOF||p.targetId!==selfId)return;
  if(p.command==='rename'){
    const next=String(p.value||'').trim().slice(0,20); if(!next)return;
    myName=next;
    if($('playerName'))$('playerName').value=next;
    const m=me();
    if(m){m.realName=next;if(!state.started)m.publicName=next;}
    renderAll();
    sendIntro();
    if(isAdmin)broadcastRoster();
    toast('El superadmin cambió tu nombre.');
    return;
  }
  if(p.command==='kick'){
    try{transportRoom?.leave?.();}catch{}
    joined=false;
    sessionStorage.setItem('eltopo-superadmin-notice','El superadmin te sacó de la sala.');
    location.reload();
  }
}

"""
if handler not in s:
    s = replace_once(s, anchor, handler + anchor, 'superadmin handler')
# Show kick notice after reload.
needle = "buildEmojiPicker(); renderComposerReply(); renderAll();"
replacement = "buildEmojiPicker(); renderComposerReply(); renderAll();\nconst superadminNotice=sessionStorage.getItem('eltopo-superadmin-notice'); if(superadminNotice){sessionStorage.removeItem('eltopo-superadmin-notice'); if($('landingError'))$('landingError').textContent=superadminNotice;}"
s = replace_once(s, needle, replacement, 'kick notice')
GAME.write_text(s, encoding='utf-8')

h = INDEX.read_text(encoding='utf-8')
h = h.replace('v=0.8.3', 'v=0.8.4').replace('v0.8.3', 'v0.8.4')
INDEX.write_text(h, encoding='utf-8')

m = SYNC.read_text(encoding='utf-8')
m = m.replace("const BUILD_VERSION = '0.8.2';", "const BUILD_VERSION = '0.8.4';").replace("const BUILD_VERSION = '0.8.3';", "const BUILD_VERSION = '0.8.4';")
SYNC.write_text(m, encoding='utf-8')
