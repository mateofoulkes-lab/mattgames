from pathlib import Path
p=Path('eltopo/social-game.js')
s=p.read_text(encoding='utf-8')
old="toast('Podés elegir el lugar durante los 10 segundos de la votación final.')"
new="toast('Podés elegir el lugar durante los 20 segundos de la votación final.')"
if old not in s: raise SystemExit('expected text not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
