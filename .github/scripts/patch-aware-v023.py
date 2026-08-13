from pathlib import Path
import re

# Editor: source scene/waypoints from layout.json
p=Path('a-ware/editor.html')
s=p.read_text(encoding='utf-8')
repl="const layout=await(await fetch('./layout.json',{cache:'no-store'})).json();const init=layout.instances.map(d=>[d.name,d.file,d.h,d.position,d.rotation,d.scale]);"
s,n=re.subn(r"const init=\[.*?\];(?=const R=)",repl,s,count=1,flags=re.S)
if n!=1: raise SystemExit('editor init missing')
old="for(const d of init)await add(d[1],{name:d[0],h:d[2],position:d[3],rotation:d[4],scale:d[5]});pickObj(null);"
new="for(const d of init)await add(d[1],{name:d[0],h:d[2],position:d[3],rotation:d[4],scale:d[5]});for(const d of layout.waypoints){$('wpName').value=d.name;$('wpAnim').value=d.animation;await createWp();const w=wps[wps.length-1];w.position.fromArray(d.position);w.rotation.set(...d.rotation);}$('wpName').value='';pickObj(null);"
if old not in s: raise SystemExit('editor preload missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# Game: same layout.json drives all props
p=Path('a-ware/index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('A-WARE v0.22 · POINT-CLOUD PROTOTYPE','A-WARE v0.23 · WAYPOINT ROUTINE')
start=s.index("loadStatic('desktop_computer.glb'")
end=s.index("\n\nlet resources=",start)
shared="""const houseLayout=await(await fetch('./layout.json',{cache:'no-store'})).json();
function layoutColor(file){if(file==='router.glb')return palette.network;if(file==='cellphone.fbx')return palette.phone;if(file==='desktop_computer.glb'||file==='Laptop.fbx'||file==='tv.glb')return palette.computer;return palette.structure;}
for(const d of houseLayout.instances)loadStatic(d.file,d.position,d.rotation,layoutColor(d.file),d.h,d.scale);loadHuman();
const named=n=>houseLayout.instances.find(x=>x.name===n),rp=named('ROUTER').position,pp=named('PC').position,ph=named('PHONE').position,lp=named('LAPTOP').position;
const wifiPC=link([rp[0],rp[1]+.35,rp[2]],[pp[0],pp[1]+.55,pp[2]],palette.network,.16),wifiPhone=link([rp[0],rp[1]+.35,rp[2]],[ph[0],ph[1]+.05,ph[2]],palette.phone,.06),wifiLaptop=link([rp[0],rp[1]+.35,rp[2]],[lp[0],lp[1]+.35,lp[2]],palette.computer,.035);"""
s=s[:start]+shared+s[end:]
anchor="function playHuman(name){const clip=humanClips[name];if(!clip||!humanMixer)return;if(currentAction)currentAction.fadeOut(.3);currentAction=humanMixer.clipAction(clip);currentAction.reset().fadeIn(.3).play();}"
route="""function playHuman(name){const clip=humanClips[name];if(!clip||!humanMixer)return;if(currentAction)currentAction.fadeOut(.3);currentAction=humanMixer.clipAction(clip);currentAction.reset().fadeIn(.3).play();}
let routeStarted=false,routeIndex=0,routeMode='wait',routeTimer=0,routeNext=0,routeElapsed=0,routeDuration=1;const routeFrom=new THREE.Vector3(),routeTo=new THREE.Vector3(),routeAnim={typing:'typing',idle:'idle',sitting:'sit',phone:'phone',stairs:'stairs',sleep:'sleep',interact:'interact'};
function arriveRoute(i){const w=houseLayout.waypoints[i];humanRoot.position.fromArray(w.position);humanRoot.rotation.set(...w.rotation);playHuman(routeAnim[w.animation]||'idle');activity.textContent='ACTIVIDAD: '+w.animation;routeIndex=i;routeMode='wait';routeTimer=w.animation==='sleep'?8:5;}
function beginRouteMove(){routeNext=(routeIndex+1)%houseLayout.waypoints.length;const w=houseLayout.waypoints[routeNext];routeFrom.copy(humanRoot.position);routeTo.fromArray(w.position);routeDuration=Math.max(1.2,routeFrom.distanceTo(routeTo)/1.35);routeElapsed=0;routeMode='move';const dx=routeTo.x-routeFrom.x,dz=routeTo.z-routeFrom.z;if(Math.hypot(dx,dz)>.01)humanRoot.rotation.set(0,Math.atan2(dx,dz),0);playHuman('walk');activity.textContent='ACTIVIDAD: desplazándose';}
function updateRoute(dt){if(!humanRoot||!humanClips.walk||!houseLayout.waypoints.length)return;if(!routeStarted){routeStarted=true;arriveRoute(0);return;}if(routeMode==='wait'){routeTimer-=dt;if(routeTimer<=0)beginRouteMove();return;}routeElapsed+=dt;const q=Math.min(1,routeElapsed/routeDuration),e=q*q*(3-2*q);humanRoot.position.lerpVectors(routeFrom,routeTo,e);if(q>=1)arriveRoute(routeNext);}"""
if anchor not in s: raise SystemExit('route anchor missing')
s=s.replace(anchor,route,1)
hook="for(const m of mixers)m.update(dt);for(const c of animatedClouds)updateHumanCloud(c);"
if hook not in s: raise SystemExit('animate hook missing')
s=s.replace(hook,"for(const m of mixers)m.update(dt);updateRoute(dt);for(const c of animatedClouds)updateHumanCloud(c);",1)
p.write_text(s,encoding='utf-8')
