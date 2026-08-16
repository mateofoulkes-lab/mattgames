from pathlib import Path
p=Path('eltopo/index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('./social-game.js?v=0.10.8','./social-game.js?v=0.10.9')
s=s.replace('./mixed-avatar-sync.js?v=0.10.8','./mixed-avatar-sync.js?v=0.10.9')
s=s.replace('./social.css?v=0.10.8','./social.css?v=0.10.9')
s=s.replace('./lobby.css?v=0.10.8','./lobby.css?v=0.10.9')
s=s.replace('./fixes-v010.css?v=0.10.8','./fixes-v010.css?v=0.10.9')
assert './social-game.js?v=0.10.9' in s
assert './mixed-avatar-sync.js?v=0.10.9' in s
p.write_text(s,encoding='utf-8')
