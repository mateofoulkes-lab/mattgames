from pathlib import Path
p=Path(__file__).resolve().parents[1]/'index.html'
s=p.read_text(encoding='utf-8')
s=s.replace('?v=0.10.5','?v=0.10.8').replace('?v=0.10.6','?v=0.10.8').replace('?v=0.10.7','?v=0.10.8')
p.write_text(s,encoding='utf-8')
print('Updated El Topo asset cache versions to 0.10.8')
