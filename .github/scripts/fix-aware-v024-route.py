from pathlib import Path
p=Path('a-ware/index.html')
s=p.read_text(encoding='utf-8')
dup="if(routeMode==='wait'){routeTimer-=dt;if(routeTimer<=0)beginRouteMove();return;}routeElapsed+=dt;const q=Math.min(1,routeElapsed/routeDuration),e=q*q*(3-2*q);humanRoot.position.lerpVectors(routeFrom,routeTo,e);if(q>=1)arriveRoute(routeNext);}\nfunction room()"
if dup not in s: raise SystemExit('duplicate route fragment not found')
s=s.replace(dup,"function room()",1)
p.write_text(s,encoding='utf-8')