from pathlib import Path

path = Path('eltopo/social-game.js')
s = path.read_text(encoding='utf-8')

replacements = [
    (
        "import { AVATARS } from './game-data.js';\n",
        "import { AVATARS } from './game-data.js';\nimport { makeIncognitoPersona } from './incognito-personas.js';\n",
    ),
    (
        "const VERSION = '0.7.0';",
        "const VERSION = '0.7.2';",
    ),
    (
        "      if(state.started) addSystem(`${m.realName} entró tarde y quedó como espectador hasta la próxima partida.`);",
        "      if(state.started) addSystem(state.mode==='incognito' ? 'Un participante entró tarde y quedó como espectador hasta la próxima partida.' : `${m.realName} entró tarde y quedó como espectador hasta la próxima partida.`);",
    ),
    (
        "function makePersona(avatar){\n  return {name:pick(PERSONA_NAMES),occupation:pick(OCCUPATIONS),detail:pick(DETAILS),avatar:avatar.id};\n}",
        "function makePersona(avatar){\n  return makeIncognitoPersona(avatar);\n}",
    ),
    (
        "function startIncognito(ids){\n  state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null;",
        "function startIncognito(ids){\n  state.started=true; state.phase='persona-select'; state.mode='incognito'; state.final=false; state.trigger=''; state.scores=null;\n  // Incógnito must not retain lobby traces containing real names.\n  state.messages=[{id:uid(),system:true,text:'🕶️ Modo Incógnito activado. El historial del lobby fue eliminado para proteger las identidades.',ts:now()}];\n  replyingTo=null;",
    ),
    (
        "    if(id===selfId) onPersonaOptions({options}); else send('persona-options',{options},id).catch(()=>{});\n  });\n  broadcastRoster(); renderAll();\n}",
        "    if(id===selfId) onPersonaOptions({options}); else send('persona-options',{options},id).catch(()=>{});\n  });\n  broadcastRoster();\n  // Sync the clean Incognito history immediately, before anyone can see old lobby names.\n  send('incognito-start',{state:snapshotForClient()}).catch(()=>{});\n  renderAll();\n}",
    ),
]

for old, new in replacements:
    if old not in s:
        raise SystemExit(f'Expected snippet not found:\n{old[:180]}')
    s = s.replace(old, new, 1)

path.write_text(s, encoding='utf-8')
print('Incognito v0.7.2 patch applied')
